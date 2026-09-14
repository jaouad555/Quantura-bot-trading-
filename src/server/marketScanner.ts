import WebSocket from 'ws';
import { kv } from './db';
import { serverExecuteOrder } from './botEngine';
import { RiskEngine } from './riskEngine/RiskEngine';
import { generateQuantitativePlan } from '../utils/quantEngine';
import { RESPECTED_TRADING_PAIRS } from '../utils/tradingPairs';

// Interfaces
interface ScannerState {
  status: 'RUNNING' | 'STOPPED' | 'ERROR';
  lastGlobalScan: number;
  symbolStates: Record<string, SymbolState>;
}

interface SymbolState {
  symbol: string;
  lastAnalyzed: number;
  lastSignal?: string;
  confidence?: number;
  lastError?: string;
}

// Global Scanner State
export const scannerState: ScannerState = {
  status: 'STOPPED',
  lastGlobalScan: 0,
  symbolStates: {},
};

let wsClient: WebSocket | null = null;
let isReconnecting = false;
let scanningInterval: NodeJS.Timeout | null = null;

const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "LINKUSDT", "AVAXUSDT"];

export async function startMarketScanner() {
  if (scannerState.status === 'RUNNING') return;
  console.log('[SCANNER] Starting Multi-Pair Market Scanner...');
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

async function scanAllPairs() {
  try {
    const configStr = await kv.get('btc_bot_config');
    const config = configStr ? JSON.parse(configStr) : {};
    
    // Stop scanning if globally disabled
    if (!config.enabled) {
      if (scannerState.status === 'RUNNING') {
        scannerState.status = 'STOPPED';
        scannerState.symbolStates = {}; // Clear symbols
      }
      return;
    }
    
    if (scannerState.status === 'STOPPED') {
       scannerState.status = 'RUNNING';
    }

    
    
    let rawAllowed = config.allowedSymbols || [];
    // Convert base symbols like "BTC" to "BTCUSDT"
    let allowedToExecute = rawAllowed.map(s => s.endsWith('USDT') ? s : s + 'USDT');
    
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
      await analyzeSymbol(symbol, config, isLive, marketType, allowedToExecute);
      await new Promise(r => setTimeout(r, 2000)); // 2s stagger
    }

  } catch (error) {
    console.error('[SCANNER] Error in global scan loop:', error);
  }
}

async function analyzeSymbol(symbol: string, config: any, isLive: boolean, marketType: string, allowedToExecute: string[]) {
  try {
    const normSymbol = symbol.toUpperCase();
    if (!scannerState.symbolStates[normSymbol]) {
      scannerState.symbolStates[normSymbol] = { symbol: normSymbol, lastAnalyzed: 0 };
    }

    // 1. Fetch Market Data via internal API to reuse logic and synthetic fallbacks
    // Use localhost since we are on the server
    const timeframe = config.timeframe && config.timeframe !== 'AUTO' ? config.timeframe : '1h';
    const devMode = process.env.NODE_ENV !== 'production';
    const apiUrl = `http://127.0.0.1:3000/api/binance/market-data?symbol=${normSymbol}&timeframe=${timeframe}&devMode=${devMode}&marketType=${marketType}`;
    
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Market data fetch failed: ${res.statusText}`);
    
    const data = await res.json();
    if (!data || !data.ticker || !data.indicators) throw new Error('Invalid market data payload');

    scannerState.symbolStates[normSymbol].lastAnalyzed = Date.now();

    // 2. Generate Signal
    const signal = generateQuantitativePlan(
      data.timeframe,
      data.ticker.price,
      data.indicators,
      data.orderBook,
      data.derivatives,
      data.mtfConfluence,
      devMode,
      normSymbol
    );

    scannerState.symbolStates[normSymbol].lastSignal = signal.decision;
    scannerState.symbolStates[normSymbol].confidence = signal.confidence;
    scannerState.symbolStates[normSymbol].lastError = undefined;

    // 3. Execution Logic
    const isAllowedToTrade = allowedToExecute.includes(normSymbol);
    if (signal.confidence >= (config.minConfidence || 75) && (signal.decision === 'LONG' || signal.decision === 'SHORT')) {
      if (isAllowedToTrade) {
        await processTradingSignal(normSymbol, signal, data.ticker.price, config, isLive);
      }
    }

  } catch (error: any) {
    scannerState.symbolStates[symbol.toUpperCase()].lastError = error.message;
    console.error(`[ERROR] ${symbol} analysis failed:`, error.message);
  }
}

async function processTradingSignal(symbol: string, signal: any, currentPrice: number, config: any, isLive: boolean) {
  try {
    // Check existing positions
    const posStr = await kv.get('btc_active_bot_positions');
    const positions = posStr ? JSON.parse(posStr) : [];
    
    // Risk Management Checks
    const currentModePositions = positions.filter((p: any) => isLive ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
    
    // Max Trades limit
    const maxTrades = Math.max(1, config.maxOpenTrades || 3);
    if (currentModePositions.length >= maxTrades) return; // Reject
    
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

    // We can proceed to execute
    console.log(`[EXECUTION] ${symbol} -> APPROVED. ORDER SENT.`);
    
    const lev = config.leverage || 10;
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

    // Open position
    const newPos = {
      id: `bot-pos-${Date.now()}`,
      symbol: symbol,
      decision: signal.decision,
      entryPrice: currentPrice,
      initialAmountUsdt: margin,
      remainingAmountUsdt: margin,
      remainingAmountBtc: quantity,
      leverage: lev,
      tp1: signal.tp1,
      tp2: signal.tp2,
      tp3: signal.tp3,
      stopLoss: signal.stopLoss,
      tp1Hit: false,
      tp2Hit: false,
      realizedPnlUsdt: 0,
      openedAt: Date.now(),
      strategyName: signal.strategyName || 'Quantitative AI',
      confidence: signal.confidence,
      mode: isLive ? 'BINANCE_LIVE' : 'PAPER',
      lastAction: 'Position Opened (Server)',
      isTrailingActive: false,
      peakPrice: currentPrice
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
      reason: `Multi-Pair Scanner detected strong ${signal.decision} setup.`,
      mode: isLive ? 'BINANCE_LIVE' : 'PAPER'
    };
    const logsStr = await kv.get('btc_bot_logs');
    const logs = logsStr ? JSON.parse(logsStr) : [];
    logs.unshift(newLog);
    await kv.set('btc_bot_logs', JSON.stringify(logs.slice(0, 500)));
    
    positions.push(newPos);
    await kv.set('btc_active_bot_positions', JSON.stringify(positions));
    
    console.log(`[POSITION] ${symbol} -> POSITION OPENED.`);

  } catch (err) {
    console.error(`[ERROR] Processing trading signal for ${symbol}:`, err);
  }
}
