import WebSocket from 'ws';
import { kv } from './db.js';
import { serverExecuteOrder, sendServerTelegramNotification, fetchRealBinanceAccountDirect, reconcilePaperWalletDirect, recordPushAlertDirect } from './botEngine.js';
import { RiskEngine } from './riskEngine/RiskEngine.js';
import { RESPECTED_TRADING_PAIRS } from '../utils/tradingPairs.js';
import { strategyManager, StrategySignal, StrategyDefinition } from './strategyManager.js';
import { EntryQualityEngine } from '../utils/entryQualityEngine.js';
import { calculateQuantitativeScore, detectMarketRegime } from '../utils/quantEngine.js';
import { isSignalThrottled, recordSignalRejection, resetSignalRejection } from './rejectionThrottler.js';
import { binanceWs } from './binanceWebSocket.js';
import { binanceRestCache } from './binanceRestCache.js';

// In-Flight execution locks & per-symbol cooldowns to prevent parallel duplicate orders and cascade entries
export const inFlightExecutionLocks = new Set<string>();
export const symbolCooldownMap = new Map<string, number>();

// Interfaces
export type MarketDataProvider = (symbol: string, timeframe: any, marketType: any, isDevMode?: boolean) => Promise<any>;
let directMarketDataProvider: MarketDataProvider | null = null;

export function setMarketDataProvider(provider: MarketDataProvider) {
  directMarketDataProvider = provider;
}

export interface ScannerState {
  status: 'RUNNING' | 'STOPPED' | 'ERROR';
  lastGlobalScan: number;
  symbolStates: Record<string, SymbolState>;
  activeStrategiesCount: number;
}

export interface SymbolState {
  symbol: string;
  lastAnalyzed: number;
  lastSignal?: string;
  signalDirection?: 'LONG' | 'SHORT' | 'WAIT';
  strategyName?: string;
  strategyId?: string;
  timeframe?: string;
  confidence?: number;
  lastError?: string;
  price?: number;
  change24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  indicators?: any;
  mtfConfluence?: any;
  marketStructure?: any;
  stopLoss?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
  signalTimestamp?: number;
  reason?: string;
}

// Global Scanner State
export const scannerState: ScannerState = {
  status: 'STOPPED',
  lastGlobalScan: 0,
  symbolStates: {},
  activeStrategiesCount: 0,
};

let wsClient: WebSocket | null = null;
let scanningInterval: NodeJS.Timeout | null = null;

export async function startMarketScanner() {
  if (scannerState.status === 'RUNNING') return;
  console.log('[SCANNER] Starting Multi-Pair Market Scanner with Strategy Activation Gate...');
  scannerState.status = 'RUNNING';
  
  // Start polling loop as fallback and primary driver (calm 35s cadence)
  if (scanningInterval) clearInterval(scanningInterval);
  scanningInterval = setInterval(scanAllPairs, 35000); // Scan every 35s
  
  // Initially run once
  setTimeout(scanAllPairs, 1000);
}

export function stopMarketScanner() {
  console.log('[SCANNER] Stopping Multi-Pair Market Scanner...');
  scannerState.status = 'STOPPED';
  if (scanningInterval) clearInterval(scanningInterval);
  if (wsClient) wsClient.close();
}

export async function scanAllPairs() {
  try {
    const configStr = await kv.get('btc_bot_config');
    const config = configStr ? JSON.parse(configStr) : {};
    
    // Auto-sync strategyManager if activePresets are specified in bot config
    if (Array.isArray(config.activePresets)) {
      const activeSet = new Set(config.activePresets);
      for (const strat of strategyManager.getAllStrategies()) {
        const shouldEnable = activeSet.has(strat.id);
        if (strat.enabled !== shouldEnable) {
          strat.enabled = shouldEnable;
          strat.activatedAt = shouldEnable ? (strat.activatedAt || Date.now()) : undefined;
        }
      }
    }

    // Check Active Strategies
    const activeStrategies = strategyManager.getActiveStrategies();
    scannerState.activeStrategiesCount = activeStrategies.length;
    scannerState.status = 'RUNNING';

    const allAvailablePairs = RESPECTED_TRADING_PAIRS.map(p => p.symbol);
    const rawAllowed = (Array.isArray(config.allowedSymbols) && config.allowedSymbols.length > 0 && !config.allowedSymbols.includes('ALL'))
      ? config.allowedSymbols
      : allAvailablePairs;
    // Convert base symbols like "BTC" to "BTCUSDT"
    const allowedToExecute = rawAllowed.map((s: string) => {
      const u = s.toUpperCase().trim();
      return u.endsWith('USDT') ? u : `${u}USDT`;
    });
    
    // The scanner will ALWAYS monitor all respected pairs from the Header.
    let enabledPairs = RESPECTED_TRADING_PAIRS.map(p => p.symbol);

    // Clean up state for symbols that are no longer enabled
    Object.keys(scannerState.symbolStates).forEach(sym => {
      if (!enabledPairs.includes(sym)) {
        delete scannerState.symbolStates[sym];
      }
    });

    const mode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
    const isExchangeMode = mode === 'BINANCE_LIVE' || mode === 'BINANCE_TESTNET';
    const kvMarketType = await kv.get('app_binance_market_type');
    const marketType = (kvMarketType === 'SPOT' || kvMarketType === 'FUTURES') ? (kvMarketType as 'SPOT' | 'FUTURES') : (config.marketType || 'FUTURES');

    scannerState.lastGlobalScan = Date.now();

    // Concurrency control: scan sequentially with 2.5s delay to respect Binance API limits
    for (const symbol of enabledPairs) {
      if (scannerState.status !== 'RUNNING') break;
      await analyzeSymbol(symbol, config, mode, marketType, allowedToExecute, activeStrategies);
      await new Promise(r => setTimeout(r, 2500)); // 2.5s safe stagger
    }

  } catch (error) {
    console.error('[SCANNER] Error in global scan loop:', error);
  }
}

async function analyzeSymbol(
  symbol: string,
  config: any,
  mode: string,
  marketType: string,
  allowedToExecute: string[],
  activeStrategies: StrategyDefinition[]
) {
  try {
    const normSymbol = symbol.toUpperCase();
    if (!scannerState.symbolStates[normSymbol]) {
      scannerState.symbolStates[normSymbol] = { symbol: normSymbol, lastAnalyzed: 0 };
    }

    // 0. Update price from WebSocket stream immediately (0 REST cost)
    const wsTicker = binanceWs.getTicker(normSymbol);
    if (wsTicker && wsTicker.price > 0) {
      scannerState.symbolStates[normSymbol] = {
        ...scannerState.symbolStates[normSymbol],
        price: wsTicker.price,
        change24h: wsTicker.changePercent24h,
        high24h: wsTicker.high,
        low24h: wsTicker.low,
        volume24h: wsTicker.volume,
        lastAnalyzed: Date.now(),
      };
    }

    // If IP is banned by Binance, rely on WebSocket ticker updates and existing indicators until unbanned
    if (binanceRestCache.isIpBanned()) {
      return;
    }

    // 1. Fetch Market Data via direct provider or internal API fallback
    const targetStrategyTf = activeStrategies[0]?.timeframe;
    const timeframe = config.timeframe && config.timeframe !== 'AUTO' 
      ? config.timeframe 
      : (targetStrategyTf || '1h');
    const devMode = process.env.NODE_ENV !== 'production';
    
    let data: any = null;
    if (directMarketDataProvider) {
      try {
        data = await directMarketDataProvider(normSymbol, timeframe, marketType, devMode);
      } catch (e: any) {
        console.warn(`[SCANNER] Direct market data provider failed for ${normSymbol}, falling back:`, e?.message);
      }
    }

    if (!data) {
      const serverPort = process.env.PORT || 3000;
      const endpointsToTry = [
        `http://127.0.0.1:${serverPort}/api/binance/market-data?symbol=${normSymbol}&timeframe=${timeframe}&devMode=${devMode}&marketType=${marketType}`,
        `http://localhost:${serverPort}/api/binance/market-data?symbol=${normSymbol}&timeframe=${timeframe}&devMode=${devMode}&marketType=${marketType}`
      ];
      
      let res: any = null;
      for (const url of endpointsToTry) {
        try {
          const attempt = await fetch(url, { signal: AbortSignal.timeout(6000) });
          if (attempt.ok) {
            res = attempt;
            break;
          }
        } catch (e) {
          // try next endpoint
        }
      }
      
      if (res && res.ok) {
        data = await res.json();
      }
    }
    
    if (!data || !data.ticker || !data.indicators) {
      throw new Error(`Market data unavailable for ${normSymbol}`);
    }

    // Save comprehensive indicators and real-time market data
    scannerState.symbolStates[normSymbol] = {
      ...scannerState.symbolStates[normSymbol],
      symbol: normSymbol,
      lastAnalyzed: Date.now(),
      price: data.ticker?.price,
      change24h: data.ticker?.change24h,
      high24h: data.ticker?.high24h,
      low24h: data.ticker?.low24h,
      volume24h: data.ticker?.volume24h,
      indicators: data.indicators,
      mtfConfluence: data.mtfConfluence,
      marketStructure: data.indicators?.marketStructure,
      timeframe: timeframe,
      lastError: undefined,
    };

    const isAllowedToTrade = allowedToExecute.includes(normSymbol);
    const isBotTradingEnabled = !!config.enabled;

    // 2. Generate Signals ONLY if Active Strategies exist
    let foundActiveSignal = false;
    if (activeStrategies.length > 0) {
      for (const strategy of activeStrategies) {
        if (!strategyManager.isStrategyActive(strategy.id)) {
          continue;
        }

        const stratSignal = strategyManager.evaluateStrategy(
          strategy.id,
          normSymbol,
          data.ticker.price,
          data.indicators,
          data.orderBook,
          data.derivatives,
          data.mtfConfluence
        );

        if (!stratSignal || stratSignal.decision === 'WAIT') {
          continue;
        }

        // SPOT Mode Protection: In Spot trading, only LONG (Buy) signals are valid. SHORT is strictly ignored.
        const isSpotConfig = (config.marketType || 'SPOT') === 'SPOT';
        if (isSpotConfig && stratSignal.decision === 'SHORT') {
          continue;
        }

        // =========================================================================
        // QUANTITATIVE RISK & STRUCTURAL SAFETY GATE
        // =========================================================================
        const currentP = data.ticker.price;
        const atr = Math.max(data.indicators?.atr14 || currentP * 0.01, currentP * 0.004);
        const ema20 = data.indicators?.ema20 || currentP;
        const isLong = stratSignal.decision === 'LONG';

        // 1. Anti-Chase Gate: Reject entries on extreme parabolic exhaustion (3x ATR extension)
        const distanceToEma20 = Math.abs(currentP - ema20);
        if (isLong && currentP > ema20 && distanceToEma20 > 3.2 * atr) {
          console.log(`[ENTRY BLOCKED] ${normSymbol} LONG Anti-Chase: Price is extended >3.2 ATR from EMA20`);
          continue;
        }
        if (!isLong && currentP < ema20 && distanceToEma20 > 3.2 * atr) {
          console.log(`[ENTRY BLOCKED] ${normSymbol} SHORT Anti-Chase: Price is dumped >3.2 ATR below EMA20`);
          continue;
        }

        // 2. Stop Loss & Take Profit Structural Safety Bounds
        let safeSl = stratSignal.stopLoss;
        if (isLong) {
          if (!safeSl || safeSl >= currentP || isNaN(safeSl)) {
            safeSl = currentP - Math.max(atr * 1.5, currentP * 0.01);
          }
        } else {
          if (!safeSl || safeSl <= currentP || isNaN(safeSl)) {
            safeSl = currentP + Math.max(atr * 1.5, currentP * 0.01);
          }
        }

        const riskDistance = Math.abs(currentP - safeSl);
        let safeTp1 = stratSignal.tp1;
        let safeTp2 = stratSignal.tp2;
        let safeTp3 = stratSignal.tp3;

        if (isLong) {
          if (!safeTp1 || safeTp1 <= currentP || isNaN(safeTp1)) safeTp1 = currentP + riskDistance * 1.8;
          if (!safeTp2 || safeTp2 <= safeTp1 || isNaN(safeTp2)) safeTp2 = safeTp1 + riskDistance * 1.2;
          if (!safeTp3 || safeTp3 <= safeTp2 || isNaN(safeTp3)) safeTp3 = safeTp2 + riskDistance * 1.8;
        } else {
          if (!safeTp1 || safeTp1 >= currentP || isNaN(safeTp1)) safeTp1 = currentP - riskDistance * 1.8;
          if (!safeTp2 || safeTp2 >= safeTp1 || isNaN(safeTp2)) safeTp2 = safeTp1 - riskDistance * 1.2;
          if (!safeTp3 || safeTp3 >= safeTp2 || isNaN(safeTp3)) safeTp3 = Math.max(currentP * 0.05, safeTp2 - riskDistance * 1.8);
        }

        const calculatedRR = Math.abs(safeTp1 - currentP) / Math.max(0.0001, riskDistance);
        if (calculatedRR < 1.15) {
          console.log(`[ENTRY BLOCKED] ${normSymbol} ${stratSignal.decision} Insufficient R:R (${calculatedRR.toFixed(2)})`);
          continue;
        }

        stratSignal.stopLoss = safeSl;
        stratSignal.tp1 = safeTp1;
        stratSignal.tp2 = safeTp2;
        stratSignal.tp3 = safeTp3;
        stratSignal.riskRewardRatio = calculatedRR;
        stratSignal.confidence = Math.max(70, stratSignal.confidence || 75);

        foundActiveSignal = true;
        scannerState.symbolStates[normSymbol].lastSignal = `${stratSignal.strategyName}: ${stratSignal.decision}`;
        scannerState.symbolStates[normSymbol].signalDirection = stratSignal.decision;
        scannerState.symbolStates[normSymbol].strategyId = stratSignal.strategyId;
        scannerState.symbolStates[normSymbol].strategyName = stratSignal.strategyName;
        scannerState.symbolStates[normSymbol].timeframe = stratSignal.timeframe || timeframe;
        scannerState.symbolStates[normSymbol].confidence = stratSignal.confidence;
        scannerState.symbolStates[normSymbol].stopLoss = stratSignal.stopLoss;
        scannerState.symbolStates[normSymbol].tp1 = stratSignal.tp1;
        scannerState.symbolStates[normSymbol].tp2 = stratSignal.tp2;
        scannerState.symbolStates[normSymbol].tp3 = stratSignal.tp3;
        scannerState.symbolStates[normSymbol].signalTimestamp = stratSignal.timestamp || Date.now();
        scannerState.symbolStates[normSymbol].reason = stratSignal.reason;

        // 3. Execution Logic - Gated by bot.enabled
        const minConfidence = config.minConfidence || 65;
        if (isBotTradingEnabled && stratSignal.confidence >= minConfidence && (stratSignal.decision === 'LONG' || stratSignal.decision === 'SHORT')) {
          if (isAllowedToTrade) {
            await processTradingSignal(normSymbol, stratSignal, data.ticker.price, config, mode, data.orderBook, data.ticker);
          }
        }
      }
    }

    // If no active signal was found in this cycle, clear obsolete trigger state so we don't spam alerts
    if (!foundActiveSignal) {
      scannerState.symbolStates[normSymbol].signalDirection = undefined;
    }

  } catch (error: any) {
    scannerState.symbolStates[symbol.toUpperCase()].lastError = error.message;
    console.error(`[ERROR] ${symbol} analysis failed:`, error.message);
  }
}

async function processTradingSignal(
  symbol: string,
  signal: StrategySignal,
  currentPrice: number,
  config: any,
  mode: string,
  orderBook?: any,
  ticker?: any
) {
  const symUpper = (symbol || '').toUpperCase().trim();
  if (!symUpper) return;

  // CRITICAL GATE 0: In-Flight Lock & Strict Cooldown Gate
  if (inFlightExecutionLocks.has(symUpper)) {
    console.log(`[TRADE BLOCKED] ${symUpper} - Execution lock currently active.`);
    return;
  }

  const nextAllowedTime = symbolCooldownMap.get(symUpper) || 0;
  if (Date.now() < nextAllowedTime) {
    const waitSec = Math.ceil((nextAllowedTime - Date.now()) / 1000);
    console.log(`[COOLDOWN] ${symUpper} in strict cooldown (${waitSec}s remaining)`);
    return;
  }

  inFlightExecutionLocks.add(symUpper);

  try {
    // CRITICAL GATE 0.5: Re-check latest authoritative botConfig from KV
    // Prevents entering trades if user disabled the bot or presets in UI while scan loop was running
    const latestConfigStr = await kv.get('btc_bot_config');
    const latestConfig = latestConfigStr ? JSON.parse(latestConfigStr) : config;
    if (!latestConfig || !latestConfig.enabled) {
      console.log(`[TRADE BLOCKED] ${symUpper} ${signal.decision} - Bot is disabled (enabled: false)`);
      return;
    }

    if (latestConfig.circuitBreakerTripped) {
      console.log(`[TRADE BLOCKED] ${symUpper} - Circuit Breaker Tripped`);
      return;
    }

    const activePresets: string[] = Array.isArray(latestConfig.activePresets)
      ? latestConfig.activePresets
      : strategyManager.getActiveStrategies().map(s => s.id);
    if (!activePresets.includes(signal.strategyId)) {
      console.log(`[TRADE BLOCKED] ${symUpper} ${signal.decision} - Strategy ${signal.strategyId} not in activePresets (total active: ${activePresets.length})`);
      return;
    }

    // CRITICAL GATE 1: Authorization with StrategyManager
    const isSpotMode = (latestConfig.marketType || config.marketType) === 'SPOT';
    if (isSpotMode && signal.decision === 'SHORT') {
      console.log(`[SPOT BLOCKED] ${symUpper} SHORT - Short selling is not allowed in Spot trading mode (Long/Buy only).`);
      return;
    }

    const auth = await strategyManager.authorizeTrade({
      strategyId: signal.strategyId,
      symbol: symUpper,
      side: signal.decision === 'LONG' ? 'LONG' : 'SHORT',
    });

    if (!auth.authorized) {
      console.log(`[TRADE BLOCKED] ${symUpper} ${signal.decision} Strategy: ${signal.strategyName} Reason: ${auth.reason}`);
      return;
    }

    // spin-lock to ensure atomicity of the trade-opening process
    let locked = false;
    for (let i = 0; i < 20; i++) {
        const lock = await kv.get('btc_positions_lock');
        const lockAge = lock ? Date.now() - Number(lock) : Infinity;
        if (!lock || isNaN(lockAge) || lockAge > 8000) {
            await kv.set('btc_positions_lock', Date.now().toString());
            locked = true;
            break;
        }
        await new Promise(r => setTimeout(r, 100)); // wait 100ms
    }

    if (!locked) {
        console.log(`[LOCK ABORT] ${symUpper} - Could not acquire lock for positions.`);
        return;
    }

    const posStr = await kv.get('btc_active_bot_positions');
    const positions = posStr ? JSON.parse(posStr) : [];
        
        // Risk Management Checks
        const kvMt = await kv.get('app_binance_market_type');
        const effectiveMarketType: 'SPOT' | 'FUTURES' = (kvMt === 'SPOT' || kvMt === 'FUTURES') 
          ? (kvMt as 'SPOT' | 'FUTURES') 
          : ((config.marketType === 'SPOT' || config.marketType === 'FUTURES') ? config.marketType : 'SPOT');
        const marketType = effectiveMarketType;

        // Spot Market Protection: In Spot trading, only LONG orders are allowed. SHORT is rejected.
        if (marketType === 'SPOT' && signal.decision === 'SHORT') {
            console.log(`[SPOT FILTER] ${symUpper} SHORT trade blocked (Spot only allows LONG / BUY).`);
            return;
        }

        const isExchangeMode = mode === 'BINANCE_LIVE' || mode === 'BINANCE_TESTNET';
        const currentModePositions = positions.filter((p: any) => {
            const pMode = p.mode || 'PAPER';
            const pMarket = p.marketType || 'SPOT';
            return pMode === mode && pMarket === marketType;
        });
        
        // Max Trades limit
        const maxTrades = Math.max(1, config.maxOpenTrades || 3);
        if (currentModePositions.length >= maxTrades) {
            console.log(`[CAPACITY FULL] ${symUpper} skipped: Portfolio at max trades (${currentModePositions.length}/${maxTrades})`);
            return;
        }
        
        // Strict Duplicate position check: Only 1 position per asset allowed
        const existing = currentModePositions.find((p: any) => p.symbol.toUpperCase() === symUpper);
        if (existing) {
            console.log(`[DEDUPLICATION] ${symUpper} already has an active position.`);
            symbolCooldownMap.set(symUpper, Date.now() + 60000);
            return;
        }

        // Cooldown check from trade history
        const histStr = await kv.get('btc_trade_history');
        const history = histStr ? JSON.parse(histStr) : [];
        const symbolHistory = history.filter((h: any) => h.symbol && h.symbol.toUpperCase() === symUpper);
        if (symbolHistory.length > 0) {
            const timestamps = symbolHistory.map((h: any) => h.closedAt || h.timestamp || 0).filter((t: number) => t > 0);
            const lastClosed = timestamps.length > 0 ? Math.max(...timestamps) : 0;
            const cooldownMs = Math.max(15, config.cooldownMinutes || 20) * 60 * 1000;
            if (lastClosed > 0 && Date.now() - lastClosed < cooldownMs) {
                console.log(`[COOLDOWN] ${symUpper} in cooldown (${Math.ceil((cooldownMs - (Date.now() - lastClosed)) / 60000)}m remaining)`);
                symbolCooldownMap.set(symUpper, lastClosed + cooldownMs);
                return;
            }
        }

        // -----------------------------------------------------------------
        // SIZING & BALANCE RESOLUTION (Strict PAPER vs LIVE isolation)
        // -----------------------------------------------------------------
        let totalEquity = 0;
        let availableBalance = 0;

        if (isExchangeMode) {
          const realAcc = await fetchRealBinanceAccountDirect();
          if (!realAcc.success || !realAcc.canTrade || realAcc.freeUsdt <= 0 || realAcc.totalUsdtEquity <= 0) {
            console.log(`[TRADE BLOCKED] ${symUpper} ${mode} Trading Blocked: Binance real account unavailable or zero balance (${realAcc.error || 'Zero funds'})`);
            return;
          }
          totalEquity = realAcc.totalUsdtEquity;
          availableBalance = realAcc.freeUsdt;
        } else {
          // Market-specific paper wallet check (SPOT vs FUTURES)
          const walletKey = effectiveMarketType === 'SPOT' ? 'btc_paper_wallet_spot' : 'btc_paper_wallet_futures';
          const walletStr = (await kv.get(walletKey)) || (await kv.get('btc_paper_wallet'));
          let wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000, realizedPnl: 0, initialDeposit: 1000 };
          wallet.balance = typeof wallet.balance === 'number' && !isNaN(wallet.balance) ? Math.max(0, wallet.balance) : 1000;
          wallet.realizedPnl = typeof wallet.realizedPnl === 'number' && !isNaN(wallet.realizedPnl) ? wallet.realizedPnl : 0;

          // In-Trade margin for this specific market type
          const marketPositions = currentModePositions.filter((p: any) => (p.marketType || 'FUTURES') === effectiveMarketType);
          let marketInTradeMargin = 0;
          marketPositions.forEach((p: any) => {
            marketInTradeMargin += (typeof p.remainingAmountUsdt === 'number' ? p.remainingAmountUsdt : (p.marginUsdt || p.initialAmountUsdt || 0));
          });

          totalEquity = wallet.totalEquity || (wallet.balance + marketInTradeMargin);
          availableBalance = wallet.balance;
        }

        if (availableBalance < 10 || totalEquity < 10) {
          console.log(`[TRADE BLOCKED] ${symUpper} Insufficient balance ($${availableBalance.toFixed(2)} available).`);
          return;
        }
    
    // In SPOT mode, short positions cannot be opened (Spot market is strictly Long-only)
    if (effectiveMarketType === 'SPOT' && signal.decision === 'SHORT') {
      console.log(`[SPOT FILTER] ${symUpper} SHORT signal skipped: Spot market only supports LONG (Buy) positions.`);
      return;
    }

    const isLong = signal.decision === 'LONG';
    let safeSl = signal.stopLoss;
    let safeTp1 = signal.tp1;
    let safeTp2 = signal.tp2;
    let safeTp3 = signal.tp3;

    if (isLong) {
      if (!safeSl || safeSl >= currentPrice) safeSl = currentPrice * 0.985;
      const risk = currentPrice - safeSl;
      if (!safeTp1 || safeTp1 <= currentPrice || (safeTp1 - currentPrice) < risk * 2.0) safeTp1 = currentPrice + risk * 2.0;
      if (!safeTp2 || safeTp2 <= safeTp1) safeTp2 = safeTp1 + risk * 1.2;
      if (!safeTp3 || safeTp3 <= safeTp2) safeTp3 = safeTp2 + risk * 1.8;
    } else {
      if (!safeSl || safeSl <= currentPrice) safeSl = currentPrice * 1.015;
      const risk = safeSl - currentPrice;
      if (!safeTp1 || safeTp1 >= currentPrice || (currentPrice - safeTp1) < risk * 2.0) safeTp1 = currentPrice - risk * 2.0;
      if (!safeTp2 || safeTp2 >= safeTp1) safeTp2 = safeTp1 - risk * 1.2;
      if (!safeTp3 || safeTp3 >= safeTp2) safeTp3 = Math.max(currentPrice * 0.05, safeTp2 - risk * 1.8);
    }

    const slDistancePct = Math.abs(currentPrice - safeSl) / currentPrice;
    const isFutures = effectiveMarketType === 'FUTURES';
    const lev = isFutures ? (config.leverage || auth.strategy?.defaultLeverage || 3) : 1;

    let margin = 0;
    if (config.sizingMode === 'RISK_BASED') {
        const targetRiskUsdt = totalEquity * ((config.riskPerTradePercent || 2.0) / 100);
        const notionalSize = targetRiskUsdt / Math.max(0.008, slDistancePct);
        margin = isFutures ? notionalSize / lev : notionalSize;
        margin = Math.min(margin, totalEquity * 0.45); // Max 45% of portfolio per position
    } else {
        const allocationPct = Math.min(0.5, Math.max(0.02, (config.tradeAllocationPercent || 25) / 100));
        margin = totalEquity * allocationPct;
    }

    margin = Math.round(margin * 100) / 100;
    if (margin > availableBalance) margin = availableBalance;

    if (margin < 10) {
      console.log(`[TRADE BLOCKED] Insufficient free margin: $${availableBalance.toFixed(2)} available, min required: $10.00`);
      return;
    }

    // CRITICAL GATE 2: Protection against stale signals:
    // Re-check strategy status immediately before order submission!
    if (!strategyManager.isStrategyActive(signal.strategyId)) {
      console.log(`[TRADE BLOCKED] ${symbol} ${signal.decision} Strategy: ${signal.strategyName} Reason: STRATEGY_INACTIVE (stale signal)`);
      return;
    }

    // CRITICAL GATE 2.5: REJECTION COOLDOWN & CIRCUIT BREAKER THROTTLING
    const throttleStatus = isSignalThrottled(symbol, signal.strategyId);
    if (throttleStatus.throttled) {
      if (throttleStatus.shouldLog) {
        if (throttleStatus.isCircuitBreaker) {
          console.log(`[CIRCUIT BREAKER] ${symbol}:${signal.strategyId} paused (circuit breaker active, retry in ${throttleStatus.remainingSec}s, ${throttleStatus.consecutive} consecutive rejections)`);
        } else {
          console.log(`[COOLDOWN] ${symbol}:${signal.strategyId} skipped (retry in ${throttleStatus.remainingSec}s, attempt #${throttleStatus.consecutive})`);
        }
      }
      return;
    }

    // Build real market depth and quote structure for MarketProtection validation
    const topBids = orderBook?.topBids?.map((b: any) => ({ price: b.price, amount: b.qty || b.amount })) || [];
    const topAsks = orderBook?.topAsks?.map((a: any) => ({ price: a.price, amount: a.qty || a.amount })) || [];
    const bestBid = topBids[0]?.price || currentPrice * 0.9998;
    const bestAsk = topAsks[0]?.price || currentPrice * 1.0002;
    const volume24hUsdt = ticker?.quoteVolume24h || (ticker?.volume24h ? ticker.volume24h * currentPrice : 10000000);

    // CRITICAL GATE 3: QUANTURA RISK MANAGEMENT ENGINE EVALUATION (Zero-Bypass Gateway)
    const riskEngine = RiskEngine.getInstance();
    const riskProposal = {
      clientOrderId: `scan-pos-${Date.now()}-${symbol}`,
      symbol: symbol.toUpperCase(),
      side: (signal.decision === 'LONG' ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
      entryPrice: currentPrice,
      stopLoss: safeSl,
      takeProfit: { tp1: safeTp1, tp2: safeTp2, tp3: safeTp3 },
      marketType: effectiveMarketType,
      leverage: lev,
      accountEquity: totalEquity,
      availableBalance: availableBalance,
      quantity: (margin * lev) / currentPrice,
      orderType: 'MARKET' as const,
      timestamp: Date.now(),
      isPaper: !isExchangeMode,
      marketData: {
        currentPrice: currentPrice,
        bidPrice: bestBid,
        askPrice: bestAsk,
        volume24hUsdt: volume24hUsdt,
        timestamp: Date.now(),
        orderBook: topBids.length > 0 && topAsks.length > 0 ? { topBids, topAsks } : undefined,
      },
    };

    const riskEvaluation = await riskEngine.evaluateProposal(riskProposal, positions);
    if (riskEvaluation.decision === 'REJECTED') {
      const rejResult = recordSignalRejection(symbol, signal.strategyId, riskEvaluation.reasonCode, riskEvaluation.message);
      if (rejResult.isCircuitBreaker) {
        console.log(`[CIRCUIT BREAKER TRIPPED] ${symbol} [${signal.strategyName}] -> PAUSED for ${rejResult.cooldownMinutes}m after ${rejResult.consecutive} consecutive rejections: ${riskEvaluation.message} (${riskEvaluation.reasonCode})`);
      } else {
        console.log(`[RISK ENGINE BLOCKED] ${symbol} [${signal.strategyName}] -> REJECTED: ${riskEvaluation.message} (${riskEvaluation.reasonCode}) | Cooldown: ${rejResult.cooldownMinutes}m`);
      }
      return;
    }

    // If sizingMode is explicitly RISK_BASED, adapt to RiskEngine recommended quantity:
    if (config.sizingMode === 'RISK_BASED' && riskEvaluation.approvedQuantity > 0 && riskEvaluation.approvedQuantity * currentPrice < margin * lev) {
      margin = Math.max(10, Math.round((riskEvaluation.approvedQuantity * currentPrice / lev) * 100) / 100);
    }
    if (margin > availableBalance) margin = availableBalance;

    // We can proceed to execute
    console.log(`\n[ENTRY ENGINE] -----------------------------------------`);
    console.log(`SYMBOL: ${symbol} | TIMEFRAME: ${signal.timeframe || '15m'} | PRICE: $${currentPrice}`);
    console.log(`SIGNAL: ${signal.decision} | SCORE: ${signal.confidence} | STRATEGY: ${signal.strategyName}`);
    console.log(`SL: $${safeSl} | TP1: $${safeTp1} | TP2: $${safeTp2} | TP3: $${safeTp3} | RR: 1:${((Math.abs(safeTp1 - currentPrice) / Math.max(0.01, Math.abs(currentPrice - safeSl)))).toFixed(2)}`);
    console.log(`ENTRY QUALITY: VALID | DECISION: ${signal.decision}`);
    console.log(`MARGIN: $${margin} | LEVERAGE: ${lev}x | NOTIONAL: $${(margin * lev).toFixed(2)} | MODE: ${mode}`);
    console.log(`---------------------------------------------------------\n`);

    const notional = margin * lev;
    let quantity = notional / currentPrice;

    let binanceOrderId = null;
    if (isExchangeMode) {
      const orderSide = isLong ? 'BUY' : 'SELL';
      const orderRes = await serverExecuteOrder(symbol, orderSide, margin, quantity, currentPrice, lev, false, safeSl, safeTp1, isFutures ? 'FUTURES' : 'SPOT');
      if (!orderRes.success || !orderRes.orderId) {
        console.error(`[EXECUTION] ${symbol} ${mode} ORDER FAILED:`, orderRes.error);
        const errorMsg = orderRes.error || 'Unknown Binance Error';
        const binanceCode = orderRes.binanceCode ? ` (Code: ${orderRes.binanceCode})` : '';
        
        sendServerTelegramNotification(
          `⚠️ <b>Binance Order Execution Warning (${mode})</b>\n\n` +
          `🔹 Pair: <b>${symbol}</b> (${signal.decision})\n` +
          `❌ Reason: <b>${errorMsg}${binanceCode}</b>\n` +
          `ℹ️ Mode: ${mode}\n` +
          `📍 Action: Check API keys and account balance.`
        );
        recordPushAlertDirect({
          title: `[${symbol}] Binance ${mode} Order Failed ⚠️`,
          body: `Order rejected: ${errorMsg}${binanceCode}`,
          type: 'SYSTEM',
          symbol: symbol,
        }).catch(() => {});
        return;
      }
      binanceOrderId = orderRes.orderId;
      if (orderRes.executedQty && parseFloat(orderRes.executedQty) > 0) {
        quantity = parseFloat(orderRes.executedQty);
      }
    } else {
      const walletKey = effectiveMarketType === 'SPOT' ? 'btc_paper_wallet_spot' : 'btc_paper_wallet_futures';
      const freshWalletStr = (await kv.get(walletKey)) || (await kv.get('btc_paper_wallet'));
      let freshWallet = freshWalletStr ? JSON.parse(freshWalletStr) : { balance: 1000, realizedPnl: 0, initialDeposit: 1000 };
      freshWallet.balance = Math.max(0, Math.round(((freshWallet.balance || 1000) - margin) * 100) / 100);
      await kv.set(walletKey, JSON.stringify(freshWallet));
      await kv.set('btc_paper_wallet', JSON.stringify(freshWallet));
    }

    const liqPrice = isFutures && lev > 1
      ? (isLong
          ? currentPrice * Math.max(0.001, 1 - (1 / lev) + 0.005)
          : currentPrice * (1 + (1 / lev) - 0.005))
      : undefined;

    const newPos = {
      id: `bot-pos-${Date.now()}`,
      symbol: symbol,
      side: signal.decision as 'LONG' | 'SHORT',
      decision: signal.decision,
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      quantity: quantity,
      initialAmountUsdt: margin,
      remainingAmountUsdt: margin,
      remainingAmountBtc: quantity,
      marginUsdt: margin,
      positionSizeUsdt: notional,
      leverage: isFutures ? lev : 1,
      tp1: safeTp1,
      tp2: safeTp2,
      tp3: safeTp3,
      stopLoss: safeSl,
      liquidationPrice: liqPrice,
      marketType: isFutures ? 'FUTURES' : 'SPOT',
      marginMode: isFutures ? ((config.marginMode || 'ISOLATED') as 'ISOLATED' | 'CROSS') : undefined,
      tp1Hit: false,
      tp2Hit: false,
      realizedPnlUsdt: 0,
      unrealizedPnlUsdt: 0,
      roePercent: 0,
      pnlHistory: [0],
      openedAt: Date.now(),
      strategyId: signal.strategyId,
      strategyName: signal.strategyName,
      strategyStatus: 'ACTIVE',
      confidence: signal.confidence,
      mode: mode,
      binanceOrderId: binanceOrderId,
      lastAction: isFutures ? `Futures ${lev}x ${signal.decision} Opened (${signal.strategyName})` : `Spot Buy Executed (${signal.strategyName})`,
      isTrailingActive: false,
      peakPrice: currentPrice,
    };

    const newLog = {
      id: `log-pos-${Date.now()}`,
      timestamp: Date.now(),
      type: 'ENTRY',
      symbol: symbol,
      side: signal.decision === 'LONG' ? 'BUY' : 'SELL',
      price: currentPrice,
      amountUsdt: notional,
      marginUsdt: margin,
      leverage: lev,
      pnlUsdt: 0,
      reason: `[${signal.strategyName}] الهامش: $${margin.toFixed(2)} (${config.tradeAllocationPercent || 25}%) | حجم العقد: $${notional.toFixed(2)} (${lev}x)`,
      mode: mode,
      strategyId: signal.strategyId,
      strategyName: signal.strategyName,
    };
    const logsStr = await kv.get('btc_bot_logs');
    const logs = logsStr ? JSON.parse(logsStr) : [];
    logs.unshift(newLog);
    await kv.set('btc_bot_logs', JSON.stringify(logs.slice(0, 500)));
    
    const freshPosStr = await kv.get('btc_active_bot_positions');
    const freshPositions = freshPosStr ? JSON.parse(freshPosStr) : [];
    
    // Filter by mode and marketType to check for duplicate and capacity
    const freshCurrentModePositions = freshPositions.filter((p: any) => {
      const pMode = p.mode || 'PAPER';
      const pMarket = p.marketType || 'SPOT';
      return pMode === mode && pMarket === marketType;
    });

    // Final duplicate and capacity guard right before writing
    if (freshCurrentModePositions.some((p: any) => p.symbol && p.symbol.toUpperCase() === symUpper)) {
      console.log(`[DEDUPLICATION ABORT] ${symUpper} already inserted by another worker.`);
      return;
    }
    if (freshCurrentModePositions.length >= maxTrades) {
      console.log(`[CAPACITY FULL] Portfolio max trades reached (${freshCurrentModePositions.length}/${maxTrades}). Trade not opened.`);
      return;
    }

    freshPositions.push(newPos);
    await kv.set('btc_active_bot_positions', JSON.stringify(freshPositions));
    
    // Activate strict 20-minute cooldown on symbol after opening trade
    const cooldownMs = Math.max(15, config.cooldownMinutes || 20) * 60 * 1000;
    symbolCooldownMap.set(symUpper, Date.now() + cooldownMs);

    // Reset rejection counter on successful position creation
    resetSignalRejection(symUpper, signal.strategyId);
    
    if (!isExchangeMode) {
      await reconcilePaperWalletDirect();
    }
    
    // Dispatch instant Telegram Notification
    const sideEmoji = signal.decision === 'LONG' ? '🟢' : '🔴';
    const modeLabel = isExchangeMode ? (mode === 'BINANCE_LIVE' ? 'Binance Live (حقيقي)' : 'Binance Testnet (تجريبي)') : 'Paper Sandbox (وهمي)';
    const marketLabel = marketType === 'SPOT' ? 'Spot (سبوت)' : `Futures (عقود x${lev})`;
    
    sendServerTelegramNotification(
      `🤖 <b>تم فتح صفقة جديدة | ${symUpper}</b>\n\n` +
      `• <b>نوع الصفقة:</b> ${sideEmoji} ${signal.decision} (${marketLabel})\n` +
      `• <b>بيئة التداول:</b> ${modeLabel}\n` +
      `• <b>الاستراتيجية:</b> ${signal.strategyName} (ثقة: ${signal.confidence}%)\n` +
      `• <b>سعر الدخول:</b> $${currentPrice.toFixed(currentPrice < 10 ? 4 : 2)}\n` +
      `• <b>الهامش المستثمر:</b> $${margin.toFixed(2)} USDT\n` +
      `• <b>الهدف الأول TP1:</b> $${safeTp1.toFixed(safeTp1 < 10 ? 4 : 2)}\n` +
      `• <b>الهدف الثاني TP2:</b> $${safeTp2.toFixed(safeTp2 < 10 ? 4 : 2)}\n` +
      `• <b>الهدف النهائي TP3:</b> $${safeTp3.toFixed(safeTp3 < 10 ? 4 : 2)}\n` +
      `• <b>وقف الخسارة SL:</b> $${safeSl.toFixed(safeSl < 10 ? 4 : 2)}`
    );

    recordPushAlertDirect({
      title: `[${symUpper}] ${signal.decision} Position Opened ${sideEmoji}`,
      body: `Strategy: ${signal.strategyName} (${signal.confidence}%) | Entry: $${currentPrice.toLocaleString()} | Margin: $${margin.toFixed(2)} (${lev}x)`,
      type: 'TRADE',
      decision: signal.decision,
      symbol: symUpper,
    }).catch(() => {});

    console.log(`[POSITION] ${symUpper} -> POSITION OPENED. Strategy: ${signal.strategyName}`);

  } catch (err) {
    console.error(`[ERROR] Processing trading signal for ${symUpper}:`, err);
  } finally {
    await kv.delete('btc_positions_lock');
    inFlightExecutionLocks.delete(symUpper);
  }
}
