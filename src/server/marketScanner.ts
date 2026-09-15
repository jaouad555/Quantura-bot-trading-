import WebSocket from 'ws';
import { kv } from './db.js';
import { serverExecuteOrder } from './botEngine.js';
import { RiskEngine } from './riskEngine/RiskEngine.js';
import { RESPECTED_TRADING_PAIRS } from '../utils/tradingPairs.js';
import { strategyManager, StrategySignal, StrategyDefinition } from './strategyManager.js';

// Interfaces
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
  
  // Start polling loop as fallback and primary driver
  if (scanningInterval) clearInterval(scanningInterval);
  scanningInterval = setInterval(scanAllPairs, 15000); // Scan every 15s
  
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
    
    // Check Active Strategies
    const activeStrategies = strategyManager.getActiveStrategies();
    scannerState.activeStrategiesCount = activeStrategies.length;
    scannerState.status = 'RUNNING';

    let rawAllowed = config.allowedSymbols || [];
    // Convert base symbols like "BTC" to "BTCUSDT"
    let allowedToExecute = rawAllowed.map((s: string) => s.endsWith('USDT') ? s : s + 'USDT');
    
    // The scanner will ALWAYS monitor all respected pairs from the Header.
    let enabledPairs = RESPECTED_TRADING_PAIRS.map(p => p.symbol);

    // Clean up state for symbols that are no longer enabled
    Object.keys(scannerState.symbolStates).forEach(sym => {
      if (!enabledPairs.includes(sym)) {
        delete scannerState.symbolStates[sym];
      }
    });

    const mode = await kv.get('app_execution_mode') || 'PAPER';
    const isLive = mode === 'BINANCE_LIVE';
    const marketType = config.marketType || 'FUTURES';

    scannerState.lastGlobalScan = Date.now();

    // Concurrency control: scan sequentially with slight delay to respect Binance API limits
    for (const symbol of enabledPairs) {
      if (scannerState.status !== 'RUNNING') break;
      await analyzeSymbol(symbol, config, isLive, marketType, allowedToExecute, activeStrategies);
      await new Promise(r => setTimeout(r, 1500)); // 1.5s stagger
    }

  } catch (error) {
    console.error('[SCANNER] Error in global scan loop:', error);
  }
}

async function analyzeSymbol(
  symbol: string,
  config: any,
  isLive: boolean,
  marketType: string,
  allowedToExecute: string[],
  activeStrategies: StrategyDefinition[]
) {
  try {
    const normSymbol = symbol.toUpperCase();
    if (!scannerState.symbolStates[normSymbol]) {
      scannerState.symbolStates[normSymbol] = { symbol: normSymbol, lastAnalyzed: 0 };
    }

    // 1. Fetch Market Data via internal API
    const timeframe = config.timeframe && config.timeframe !== 'AUTO' ? config.timeframe : '1h';
    const devMode = process.env.NODE_ENV !== 'production';
    const apiUrl = `http://127.0.0.1:3000/api/binance/market-data?symbol=${normSymbol}&timeframe=${timeframe}&devMode=${devMode}&marketType=${marketType}`;
    
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Market data fetch failed: ${res.statusText}`);
    
    const data = await res.json();
    if (!data || !data.ticker || !data.indicators) throw new Error('Invalid market data payload');

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
      lastError: undefined,
    };

    const isAllowedToTrade = allowedToExecute.includes(normSymbol);
    const isBotTradingEnabled = !!config.enabled;

    // 2. Generate Signals ONLY if Active Strategies exist
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

        scannerState.symbolStates[normSymbol].lastSignal = `${stratSignal.strategyName}: ${stratSignal.decision}`;
        scannerState.symbolStates[normSymbol].signalDirection = stratSignal.decision;
        scannerState.symbolStates[normSymbol].strategyName = stratSignal.strategyName;
        scannerState.symbolStates[normSymbol].confidence = stratSignal.confidence;

        // 3. Execution Logic - Gated by bot.enabled
        const minConfidence = config.minConfidence || 65;
        if (isBotTradingEnabled && stratSignal.confidence >= minConfidence && (stratSignal.decision === 'LONG' || stratSignal.decision === 'SHORT')) {
          if (isAllowedToTrade) {
            await processTradingSignal(normSymbol, stratSignal, data.ticker.price, config, isLive);
          }
        }
      }
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
  isLive: boolean
) {
  try {
    // CRITICAL GATE 1: Authorization with StrategyManager
    const auth = await strategyManager.authorizeTrade({
      strategyId: signal.strategyId,
      symbol: symbol,
      side: signal.decision === 'LONG' ? 'LONG' : 'SHORT',
    });

    if (!auth.authorized) {
      console.log(`[TRADE BLOCKED] ${symbol} ${signal.decision} Strategy: ${signal.strategyName} Reason: ${auth.reason}`);
      return;
    }

    // Check existing positions
    const posStr = await kv.get('btc_active_bot_positions');
    const positions = posStr ? JSON.parse(posStr) : [];
    
    // Risk Management Checks
    const currentModePositions = positions.filter((p: any) => isLive ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
    
    // Max Trades limit
    const maxTrades = Math.max(1, config.maxOpenTrades || 3);
    if (currentModePositions.length >= maxTrades) {
      console.log(`[RISK BLOCKED] ${symbol} max trades reached (${currentModePositions.length}/${maxTrades})`);
      return;
    }
    
    // Duplicate position check
    const existing = currentModePositions.find((p: any) => p.symbol.toUpperCase() === symbol.toUpperCase());
    if (existing) return; // Reject duplicate

    // Cooldown check
    const histStr = await kv.get('btc_trade_history');
    const history = histStr ? JSON.parse(histStr) : [];
    const symbolHistory = history.filter((h: any) => h.symbol.toUpperCase() === symbol.toUpperCase());
    if (symbolHistory.length > 0) {
      const lastClosed = symbolHistory[0].timestamp;
      const cooldownMs = (config.cooldownMinutes || 10) * 60 * 1000;
      if (Date.now() - lastClosed < cooldownMs) return; // Reject cooldown
    }

    // Allocate Wallet
    const walletStr = await kv.get('btc_paper_wallet');
    let wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000, realizedPnl: 0 };
    
    const allocationPct = (config.tradeAllocationPercent || 10) / 100;
    const margin = wallet.balance * allocationPct;
    
    if (margin < 10) return; // Minimum 10 USDT

    // CRITICAL GATE 2: Protection against stale signals:
    // Re-check strategy status immediately before order submission!
    if (!strategyManager.isStrategyActive(signal.strategyId)) {
      console.log(`[TRADE BLOCKED] ${symbol} ${signal.decision} Strategy: ${signal.strategyName} Reason: STRATEGY_INACTIVE (stale signal)`);
      return;
    }

    // We can proceed to execute
    console.log(`[EXECUTION] ${symbol} [${signal.strategyName}] -> APPROVED. ORDER SENT.`);
    
    const lev = config.leverage || auth.strategy?.defaultLeverage || 3;
    const notional = margin * lev;
    const quantity = notional / currentPrice;

    if (isLive) {
      const orderSide = signal.decision === 'LONG' ? 'BUY' : 'SELL';
      const orderRes = await serverExecuteOrder(symbol, orderSide, margin, quantity, currentPrice);
      if (!orderRes.success) {
        console.error(`[EXECUTION] ${symbol} LIVE ORDER FAILED:`, orderRes.error);
        return;
      }
    } else {
      wallet.balance -= margin;
      await kv.set('btc_paper_wallet', JSON.stringify(wallet));
    }

    // Open position with authoritative strategy metadata and risk controls
    const isLong = signal.decision === 'LONG';
    let safeSl = signal.stopLoss;
    let safeTp1 = signal.tp1;
    let safeTp2 = signal.tp2;
    let safeTp3 = signal.tp3;

    if (isLong) {
      if (!safeSl || safeSl >= currentPrice) safeSl = currentPrice * 0.985;
      const risk = currentPrice - safeSl;
      if (!safeTp1 || safeTp1 <= currentPrice) safeTp1 = currentPrice + risk * 1.5;
      if (!safeTp2 || safeTp2 <= safeTp1) safeTp2 = safeTp1 + risk * 1.0;
      if (!safeTp3 || safeTp3 <= safeTp2) safeTp3 = safeTp2 + risk * 1.5;
    } else {
      if (!safeSl || safeSl <= currentPrice) safeSl = currentPrice * 1.015;
      const risk = safeSl - currentPrice;
      if (!safeTp1 || safeTp1 >= currentPrice) safeTp1 = currentPrice - risk * 1.5;
      if (!safeTp2 || safeTp2 >= safeTp1) safeTp2 = safeTp1 - risk * 1.0;
      if (!safeTp3 || safeTp3 >= safeTp2) safeTp3 = Math.max(currentPrice * 0.05, safeTp2 - risk * 1.5);
    }

    const liqPrice = isLong
      ? currentPrice * Math.max(0.001, 1 - (1 / lev) + 0.005)
      : currentPrice * (1 + (1 / lev) - 0.005);

    const newPos = {
      id: `bot-pos-${Date.now()}`,
      symbol: symbol,
      decision: signal.decision,
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      initialAmountUsdt: margin,
      remainingAmountUsdt: margin,
      remainingAmountBtc: quantity,
      marginUsdt: margin,
      positionSizeUsdt: notional,
      leverage: lev,
      tp1: safeTp1,
      tp2: safeTp2,
      tp3: safeTp3,
      stopLoss: safeSl,
      liquidationPrice: liqPrice,
      marketType: (config.marketType || 'FUTURES') as 'FUTURES' | 'SPOT',
      marginMode: (config.marginMode || 'ISOLATED') as 'ISOLATED' | 'CROSS',
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
      mode: isLive ? 'BINANCE_LIVE' : 'PAPER',
      lastAction: `Position Opened (${signal.strategyName})`,
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
      amountUsdt: margin,
      pnlUsdt: 0,
      reason: `[${signal.strategyName}] Scanner executed ${signal.decision} (${signal.reason})`,
      mode: isLive ? 'BINANCE_LIVE' : 'PAPER',
      strategyId: signal.strategyId,
      strategyName: signal.strategyName,
    };
    const logsStr = await kv.get('btc_bot_logs');
    const logs = logsStr ? JSON.parse(logsStr) : [];
    logs.unshift(newLog);
    await kv.set('btc_bot_logs', JSON.stringify(logs.slice(0, 500)));
    
    positions.push(newPos);
    await kv.set('btc_active_bot_positions', JSON.stringify(positions));
    
    console.log(`[POSITION] ${symbol} -> POSITION OPENED. Strategy: ${signal.strategyName}`);

  } catch (err) {
    console.error(`[ERROR] Processing trading signal for ${symbol}:`, err);
  }
}
