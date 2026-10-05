console.log("Starting Quantura Server...");
import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Resilient .env loader to ensure environment variables are ALWAYS loaded on all VPS environments
function loadEnvFallback() {
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '../.env'),
    path.join(process.cwd(), 'bot', '.env'),
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const key = trimmed.substring(0, idx).trim();
            const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        });
      } catch {
        // silent fallback
      }
    }
  }
}
loadEnvFallback();

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { calculateTechnicalIndicators } from './src/utils/indicators';
import { generateQuantitativePlan, detectMarketRegime } from './src/utils/quantEngine';
import { initDb, kv } from './src/server/db';
import { startBotEngine, stopBotEngine, startTelegramSync, fetchSymbolPrice, closePositionDirect, panicCloseAllDirect, resetBotEngineState, reconcilePaperWalletDirect } from './src/server/botEngine';
import { startMarketScanner, stopMarketScanner, scannerState, scanAllPairs, setMarketDataProvider, inFlightExecutionLocks, symbolCooldownMap } from './src/server/marketScanner';
import { canSubmitOrder, startBotAuthoritative, stopBotAuthoritative, getAuthoritativeBotState } from './src/server/botControl';
import {
  reconcilePositionsWithBinance,
  runStartupReconciliation,
  fetchAuthoritativeAccount,
  getAuthoritativeBinanceApiBase,
  getAuthoritativeBinanceFuturesApiBase,
  createBinanceSignedQuery,
  logBinanceApiCall,
  getBinanceApiLogs,
  getReconciliationStatus,
} from './src/server/positionReconciliation';
import { binanceWs } from './src/server/binanceWebSocket';
import { binanceRestCache } from './src/server/binanceRestCache';
import { strategyManager } from './src/server/strategyManager';
import { RiskEngine } from './src/server/riskEngine/RiskEngine';
import { AuditTrail } from './src/server/riskEngine/AuditTrail';
import { isValidPersistedPosition } from './src/server/riskEngine/types';
import {
  AIAnalysisResult,
  BinanceTicker,
  DerivativesData,
  KlineCandle,
  MarketDataResponse,
  MTFConfluenceData,
  OrderBookSummary,
  Timeframe,
} from './src/types';

const app = express();
const PORT = 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- HEALTH CHECK: Must be first and unthrottled for container/platform ingress ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/debug/binance-config', async (req, res) => {
  try {
    const auth = await resolveBinanceAuth(req);
    res.json({
      hasApiKey: Boolean(auth.apiKey),
      hasApiSecret: Boolean(auth.apiSecret),
      useTestnet: auth.useTestnet,
      marketType: auth.marketType,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- SECURITY: Rate Limiting OWASP (Throttling API routes only, never static assets) ---
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3000, // Generous limit for high-frequency trading dashboard polling
  message: { error: 'API rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit for sensitive actions like trading or saving config
  message: { error: 'Too many sensitive requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply API-specific limiter to /api/ routes only
app.use('/api/', apiLimiter);

// Apply strict limiter to sensitive routes
app.use('/api/config/binance', sensitiveActionLimiter);
app.use('/api/binance/order', sensitiveActionLimiter);


// Lazy-initialized AI Clients
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

let openAiClient: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!openAiClient && process.env.QWEN_API_KEY && process.env.QWEN_API_KEY !== 'YOUR_QWEN_API_KEY') {
    openAiClient = new OpenAI({
      apiKey: process.env.QWEN_API_KEY,
      baseURL: process.env.QWEN_BASE_URL || 'https://openrouter.ai/api/v1',
    });
  }
  return openAiClient;
}

// -----------------------------------------------------
// Local Database Configuration Endpoints (With Sensitive Secret Redaction)
// -----------------------------------------------------
const SENSITIVE_CONFIG_KEYS = new Set([
  'app_binance_api_secret',
  'app_binance_api_key',
  'binance_api_config',
  'app_telegram_bot_token',
  'gemini_api_key',
  'openai_api_key',
  'deepseek_api_key',
  'qwen_api_key',
  'encryption_key',
  'database_secret',
  'user_passcode',
  'admin_password',
]);

function maskSensitiveValue(key: string, val: string | null): string {
  if (!val) return '';
  if (key === 'binance_api_config') {
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify({
        configured: true,
        apiKeyPrefix: parsed.apiKey ? parsed.apiKey.substring(0, 4) + '...' : '',
        useTestnet: parsed.useTestnet,
        marketType: parsed.marketType,
      });
    } catch (_) {
      return '[REDACTED]';
    }
  }
  return val.length > 8 ? val.substring(0, 4) + '••••••••' + val.slice(-2) : '••••••••';
}

app.get('/api/config', async (req, res) => {
  const { key } = req.query;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Key is required' });
  }
  try {
    const rawKey = key.trim().toLowerCase();
    const value = await kv.get(key);
    if (SENSITIVE_CONFIG_KEYS.has(rawKey) || rawKey.includes('secret') || rawKey.includes('password') || (rawKey.includes('token') && !rawKey.includes('symbol'))) {
      return res.json({
        key,
        value: maskSensitiveValue(key, value),
        configured: Boolean(value),
        isSensitive: true,
      });
    }
    res.json({ key, value });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

app.get('/api/config/all', async (req, res) => {
  try {
    const data = await kv.getAll();
    const sanitizedData: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      const lowerKey = k.toLowerCase();
      if (SENSITIVE_CONFIG_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password') || (lowerKey.includes('token') && !lowerKey.includes('symbol'))) {
        sanitizedData[k] = maskSensitiveValue(k, v);
      } else {
        sanitizedData[k] = v;
      }
    }
    res.json(sanitizedData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read all configs' });
  }
});

app.post('/api/config', async (req, res) => {
  const { key, value } = req.body;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Key is required' });
  }
  try {
    if (value === null || value === undefined) {
      await kv.delete(key);
    } else {
      let finalValue = String(value);

      // Protect binance_api_config from being overwritten with masked or empty secrets via generic /api/config
      if (key === 'binance_api_config') {
        try {
          const parsed = JSON.parse(String(value));
          const pKey = (parsed.apiKey || '').trim();
          const pSecret = (decryptSecret(parsed.apiSecret) || '').trim();
          if (isValidBinanceKey(pKey) && isValidBinanceSecret(pSecret)) {
            parsed.apiKey = pKey;
            parsed.apiSecret = encryptSecret(pSecret);
            finalValue = JSON.stringify(parsed);
          } else {
            // Do not overwrite existing valid binance_api_config with empty/masked secret; only update non-secret metadata
            const existingStr = await kv.get('binance_api_config');
            if (existingStr) {
              const existingParsed = JSON.parse(existingStr);
              if (parsed.useTestnet !== undefined) existingParsed.useTestnet = Boolean(parsed.useTestnet);
              if (parsed.marketType) existingParsed.marketType = parsed.marketType;
              finalValue = JSON.stringify(existingParsed);
            } else {
              return res.json({ success: true, ignored: true });
            }
          }
        } catch (_) {
          return res.json({ success: true, ignored: true });
        }
      }

      // Schema validation & sanitization for active bot positions to prevent NaN propagation
      if (key === 'btc_active_bot_positions') {
        try {
          const parsed = JSON.parse(String(value));
          if (Array.isArray(parsed)) {
            const valid = parsed
              .map((p: any) => {
                if (!p || typeof p !== 'object' || !p.symbol) return null;
                const rawSide = String(p.side || p.decision || 'LONG').toUpperCase();
                const decision = rawSide === 'SELL' || rawSide === 'SHORT' ? 'SHORT' : 'LONG';
                const entryPrice = Number(p.entryPrice || p.currentPrice || 1);
                const currentPrice = Number(p.currentPrice || p.entryPrice || entryPrice);
                const leverage = Math.max(1, Number(p.leverage || 1));
                const quantity = Number(p.quantity || p.remainingAmountBtc || p.initialAmountBtc || p.positionAmt || p.amount || 0);
                const margin = Number(p.marginUsdt || p.initialAmountUsdt || p.remainingAmountUsdt) || (quantity > 0 ? (quantity * entryPrice) / leverage : 10);
                const positionSize = Number(p.positionSizeUsdt) || (margin * leverage);

                return {
                  ...p,
                  id: p.id || `pos-${p.symbol.toUpperCase()}-${Date.now()}`,
                  symbol: String(p.symbol).toUpperCase(),
                  decision,
                  side: decision,
                  entryPrice,
                  currentPrice,
                  leverage,
                  quantity: quantity > 0 ? quantity : p.quantity,
                  remainingAmountBtc: quantity > 0 ? quantity : (p.remainingAmountBtc || 0.001),
                  marginUsdt: margin,
                  positionSizeUsdt: positionSize,
                };
              })
              .filter((p: any) => p && isValidPersistedPosition(p));

            finalValue = JSON.stringify(valid);
          }
        } catch (e) {
          console.warn('[CONFIG API WARN] Failed to parse btc_active_bot_positions JSON, ignoring write:', e);
          return res.status(400).json({ error: 'Invalid JSON for positions' });
        }
      }

      console.log(`[CONFIG API] Setting ${key} = ${finalValue.substring(0, 100)}${finalValue.length > 100 ? '...' : ''}`);
      await kv.set(key, finalValue);

      // Auto-synchronize strategyManager and marketType if botConfig or active_strategies changed
      if (key === 'btc_bot_config') {
        try {
          const parsed = JSON.parse(String(value));
          if (parsed.marketType === 'SPOT' || parsed.marketType === 'FUTURES') {
            await kv.set('app_binance_market_type', parsed.marketType);
            binanceWs.setMarketType(parsed.marketType);
          }
          if (parsed.enabled === true) {
            console.log('[CONFIG API] Bot enabled requested. Starting bot engine and scanner...');
            startBotEngine();
            startBotAuthoritative();
          } else if (parsed.enabled === false) {
            console.log('[CONFIG API] Bot disabled requested. Stopping bot engine and scanner...');
            stopBotEngine();
            stopBotAuthoritative('Disabled via Config API');
          }
          if (Array.isArray(parsed.activePresets)) {
            const activeSet = new Set(parsed.activePresets);
            for (const strat of strategyManager.getAllStrategies()) {
              const shouldEnable = activeSet.has(strat.id);
              if (strat.enabled !== shouldEnable) {
                strat.enabled = shouldEnable;
                strat.activatedAt = shouldEnable ? (strat.activatedAt || Date.now()) : undefined;
              }
            }
          }
        } catch (e) {}
      } else if (key === 'app_binance_market_type') {
        if (finalValue === 'SPOT' || finalValue === 'FUTURES') {
          binanceWs.setMarketType(finalValue as 'SPOT' | 'FUTURES');
        }
      } else if (key === 'trading_execution_mode') {
        await kv.set('app_execution_mode', finalValue);
      } else if (key === 'app_execution_mode') {
        await kv.set('trading_execution_mode', finalValue);
      } else if (key === 'quantura_active_strategies') {
        try {
          const parsed = JSON.parse(String(value));
          if (parsed && typeof parsed === 'object') {
            for (const [id, enabled] of Object.entries(parsed)) {
              const strat = strategyManager.getStrategy(id);
              if (strat && typeof enabled === 'boolean') {
                strat.enabled = enabled;
                strat.activatedAt = enabled ? (strat.activatedAt || Date.now()) : undefined;
              }
            }
          }
        } catch (e) {}
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to write config' });
  }
});

app.post('/api/config/clear', async (req, res) => {
  try {
    await kv.clear();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear config' });
  }
});

// Live symbol prices endpoint for all open contracts and watchlists
app.get('/api/bot/prices', async (req, res) => {
  try {
    const rawSymbols = (req.query.symbols as string) || '';
    const marketType = (req.query.marketType as 'SPOT' | 'FUTURES') || 'FUTURES';
    const symbols = rawSymbols ? rawSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];
    
    // Also include symbols from active positions
    const posStr = await kv.get('btc_active_bot_positions');
    if (posStr) {
      try {
        const positions = JSON.parse(posStr);
        if (Array.isArray(positions)) {
          positions.forEach((p: any) => {
            if (p.symbol && !symbols.includes(p.symbol.toUpperCase())) {
              symbols.push(p.symbol.toUpperCase());
            }
          });
        }
      } catch {}
    }

    if (symbols.length === 0) {
      return res.json({ prices: {} });
    }

    const results = await Promise.allSettled(symbols.map(s => fetchSymbolPrice(s, marketType)));
    const prices: Record<string, number> = {};
    symbols.forEach((sym, idx) => {
      const r = results[idx];
      if (r.status === 'fulfilled' && (r.value as number) > 0) {
        prices[sym] = r.value as number;
      }
    });

    res.json({ prices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Explicit Server-Authoritative Position Closing Endpoints
app.post('/api/bot/close-position', async (req, res) => {
  const posId = req.body.posId || req.body.positionId || req.body.id;
  const { price, exitPrice, reason, realizedPnlUsdt, profitPercent, tradeHistoryItem, marketType, leverage, symbol, side } = req.body;
  if (!posId) {
    return res.status(400).json({ error: 'posId or positionId is required' });
  }
  const result = await closePositionDirect(posId, (price || exitPrice) ? Number(price || exitPrice) : undefined, reason || 'Manual Close', {
    realizedPnlUsdt,
    profitPercent,
    tradeHistoryItem,
    marketType,
    leverage,
    symbol,
    side,
  });
  return res.json(result);
});

app.post('/api/bot/panic-close-all', async (req, res) => {
  const { positions } = req.body || {};
  const result = await panicCloseAllDirect(positions);
  return res.json(result);
});

// --- STRATEGY ACTIVATION & MANAGEMENT ROUTES ---
app.get('/api/strategies', (req, res) => {
  try {
    const all = strategyManager.getAllStrategies();
    const active = strategyManager.getActiveStrategies();
    res.json({
      success: true,
      strategies: all,
      activeCount: active.length,
      activeStrategies: active.map(s => s.id),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/strategies/toggle', async (req, res) => {
  const { strategyId, enabled } = req.body;
  if (!strategyId || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'strategyId and boolean enabled are required' });
  }
  try {
    const strat = await strategyManager.setStrategyState(strategyId, enabled);
    const active = strategyManager.getActiveStrategies();
    res.json({
      success: true,
      strategy: strat,
      activeCount: active.length,
      activeStrategies: active.map(s => s.id),
      allStrategies: strategyManager.getAllStrategies(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/strategies/set', async (req, res) => {
  const { strategies } = req.body;
  if (!strategies || typeof strategies !== 'object') {
    return res.status(400).json({ error: 'strategies map object is required' });
  }
  try {
    const all = await strategyManager.setAllStrategiesState(strategies);
    const active = strategyManager.getActiveStrategies();
    res.json({
      success: true,
      strategies: all,
      activeCount: active.length,
      activeStrategies: active.map(s => s.id),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Comprehensive Root-Level Reset Engine
// Preserves: Binance API Keys, Telegram bot token/chatId, AI Model keys/config, User auth and UI preferences.
// Wipes: Active positions, trade history, logs, paper wallet (to $1,000 USDT baseline), symbol cooldowns,
//        Risk Engine drawdown/daily PnL/streaks (to exact 0.00 baseline), and sets all strategies/bot to inactive.
export async function executeFullPlatformReset() {
  console.log('[RESET ENGINE] Initiating Full Platform Reset (Preserving API keys, Telegram, AI models & Auth)...');

  // 1. Reset Strategy Manager & Deactivate All Strategies
  try {
    strategyManager.resetToDefaults();
  } catch (e) {
    console.error('[RESET ENGINE] StrategyManager reset error:', e);
  }

  await kv.set('quantura_active_strategies', JSON.stringify({
    INSTITUTIONAL_SMC: false,
    MOMENTUM: false,
    SWING: false,
    MTF_CONFLUENCE: false,
    VWAP_VOLUME_DELTA: false,
    FUNDING_SQUEEZE: false,
    BREAKOUT: false,
    SCALPER: false,
    MEAN_REVERSION: false,
    LIQUIDITY_HUNT: false,
  }));

  // 2. Clear symbol cooldowns and in-flight locks in scanner
  try {
    symbolCooldownMap.clear();
    inFlightExecutionLocks.clear();
    if (scannerState) {
      scannerState.activeStrategiesCount = 0;
      if (scannerState.symbolStates) {
        Object.keys(scannerState.symbolStates).forEach((k) => {
          if (scannerState.symbolStates[k]) {
            scannerState.symbolStates[k].lastSignal = undefined;
            scannerState.symbolStates[k].signalDirection = undefined;
            scannerState.symbolStates[k].strategyName = undefined;
          }
        });
      }
    }
  } catch (e) {
    console.error('[RESET ENGINE] Scanner reset error:', e);
  }

  // 3. Clear bot engine in-memory position tracker
  try {
    resetBotEngineState();
  } catch (e) {
    console.error('[RESET ENGINE] resetBotEngineState error:', e);
  }

  // 4. Reset Paper Wallet to clean $1,000 USDT mathematical truth
  const cleanWallet = {
    balance: 1000,
    realizedPnl: 0,
    openPosition: null,
    history: [],
  };
  await kv.set('btc_paper_wallet', JSON.stringify(cleanWallet));
  await kv.set('paper_wallet_initial_deposit', '1000');

  // 5. Clear active positions, history, logs and alerts
  await kv.set('btc_active_bot_positions', '[]');
  await kv.delete('btc_active_bot_position');
  await kv.set('btc_trade_history', '[]');
  await kv.set('btc_bot_logs', '[]');
  await kv.set('btc_push_alerts', '[]');

  // 6. Reset Risk Engine to zero baseline (0% drawdown, $0 daily loss, 0 streaks)
  try {
    const riskEngine = RiskEngine.getInstance();
    await riskEngine.resetAllToZero(1000);
    await riskEngine.setEmergencyStop(false);
  } catch (err) {
    console.error('[RESET ENGINE] Error resetting RiskEngine:', err);
  }

  // Clear Audit Trail entries
  try {
    await AuditTrail.clear();
  } catch (err) {
    console.error('[RESET ENGINE] Error clearing AuditTrail:', err);
  }

  // Set explicit clean zero drawdown state in kv
  await kv.set('quantura_risk_drawdown_state', JSON.stringify({
    startingDailyEquity: 1000,
    lastDailyResetTimestamp: Date.now(),
    peakEquity: 1000,
    dailyRealizedPnl: 0,
    dailyFeesPaid: 0,
    dailyFundingPaid: 0,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    lastClosedTradePnl: 0,
    lastClosedTradeSizeUsdt: 0,
    lastClosedTradeLeverage: 1,
  }));

  // Clean Risk Config
  await kv.set('quantura_risk_config', JSON.stringify({
    maxDailyLossPercent: 3.0,
    maxAccountDrawdownPercent: 5.0,
    maxLeverageLimit: 10,
    minLeverageLimit: 1,
    maxRiskPerTradePercent: 2.5,
    minRiskRewardRatio: 1.5,
    consecutiveLossLimit: 3,
    consecutiveLossCooldownMinutes: 30,
    maxOpenCorrelatedTrades: 2,
    emergencyStop: false,
    riskLockStatus: 'NORMAL',
  }));

  // 7. Reset Bot Config to clean disabled defaults while PRESERVING marketType preference if already set
  let preservedMarketType: 'SPOT' | 'FUTURES' = 'FUTURES';
  try {
    const currentCfgStr = await kv.get('btc_bot_config');
    if (currentCfgStr) {
      const parsed = JSON.parse(currentCfgStr);
      if (parsed.marketType === 'SPOT' || parsed.marketType === 'FUTURES') {
        preservedMarketType = parsed.marketType;
      }
    }
    const appMarketType = await kv.get('app_binance_market_type');
    if (appMarketType === 'SPOT' || appMarketType === 'FUTURES') {
      preservedMarketType = appMarketType;
    }
  } catch {}

  const defaultBotConfig = {
    enabled: false,
    activePresets: [],
    tradeAllocationPercent: 25,
    minConfidence: 75,
    mode: 'SCALE_OUT_REBUY',
    autoCompound: true,
    maxOpenTrades: 3,
    timeframe: 'AUTO',
    marketType: preservedMarketType,
    leverage: 3,
    marginMode: 'ISOLATED',
    trailingStopEnabled: true,
    trailingStopPercent: 1.2,
    trailingActivationProfitPercent: 1.5,
    dailyDrawdownLimitPercent: 5.0,
    circuitBreakerTripped: false,
    circuitBreakerTrippedAt: undefined,
    circuitBreakerResetAt: Date.now(),
    sizingMode: 'FIXED_PERCENT',
    riskPerTradePercent: 2.0,
    cooldownMinutes: 10,
    multiPairScanning: true,
    allowedSymbols: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'DOGE', 'LTC', 'UNI', 'ATOM', 'TRX', 'ETC', 'BCH', 'XLM', 'ALGO', 'VET'],
  };
  await kv.set('btc_bot_config', JSON.stringify(defaultBotConfig));

  // 8. Wipe backtest settings & checklist progress & audit logs
  await kv.delete('quantura_backtest_settings');
  await kv.delete('quantura_checklist_progress');
  await kv.delete('risk_audit_log_entries');

  console.log('[RESET ENGINE] Platform fully reset to clean baseline (API keys, Telegram, AI model and auth preserved).');
  return {
    success: true,
    message: 'Reset complete: Risk Engine, positions, history, logs and wallet reset to zero. API keys, Telegram, and AI model preserved.',
  };
}

// Unified Full Factory Reset endpoint
app.post('/api/system/full-factory-reset', async (req, res) => {
  try {
    const result = await executeFullPlatformReset();
    res.json(result);
  } catch (error: any) {
    console.error('[RESET ENGINE] Error in /api/system/full-factory-reset:', error);
    res.status(500).json({ error: error.message || 'Failed to execute factory reset' });
  }
});

// Backward-compatible trading reset endpoint
app.post('/api/trading/reset', async (req, res) => {
  try {
    const result = await executeFullPlatformReset();
    res.json(result);
  } catch (error: any) {
    console.error('[RESET ENGINE] Error in /api/trading/reset:', error);
    res.status(500).json({ error: error.message || 'Failed to reset trading data' });
  }
});

// Backward-compatible system reset endpoint
app.post('/api/system/reset', async (req, res) => {
  try {
    const result = await executeFullPlatformReset();
    res.json(result);
  } catch (error: any) {
    console.error('[RESET ENGINE] Error in /api/system/reset:', error);
    res.status(500).json({ error: error.message || 'Failed to reset system data' });
  }
});

app.post('/api/config/batch', async (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Data object is required' });
  }
  try {
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        await kv.delete(key);
      } else {
        await kv.set(key, String(value));
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to write config batch' });
  }
});

// Telegram High-Speed Safe Proxy (Instant delivery with HTML & Plaintext auto-fallback)
app.post('/api/telegram/send', async (req, res) => {
  const { token, chatId, message } = req.body;
  if (!token || !chatId || !message) {
    return res.status(400).json({ error: 'token, chatId and message are required' });
  }
  if (typeof token !== 'string' || !/^[0-9]+:[a-zA-Z0-9_-]+$/.test(token.trim())) {
    return res.status(400).json({ error: 'Invalid Telegram bot token format' });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    
    // First attempt: HTML formatted
    let tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: String(message),
        parse_mode: 'HTML',
      }),
      signal: controller.signal,
    }).catch(() => null);

    // If HTML parsing failed (status 400), instantly retry without HTML formatting
    if (!tgRes || (!tgRes.ok && tgRes.status === 400)) {
      const plainText = String(message).replace(/<[^>]*>/g, '');
      tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText,
        }),
        signal: controller.signal,
      }).catch(() => null);
    }

    clearTimeout(timeout);
    const data = tgRes ? await tgRes.json().catch(() => ({})) : {};
    return res.json({ success: tgRes?.ok ?? false, data });
  } catch (err: any) {
    return res.json({ success: false, error: err.message || 'Telegram network issue' });
  }
});

// In-memory Short TTL Caches for Binance Public Endpoints (prevents IP rate-limiting)
const cachedTickers: Map<string, { data: BinanceTicker; timestamp: number }> = new Map();
const cachedKlines: Map<string, { data: KlineCandle[]; timestamp: number }> = new Map();
const cachedOrderBooks: Map<string, { data: OrderBookSummary; timestamp: number }> = new Map();
const cachedMtfConfluence: Map<string, { data: { allTimeframes: any; mtfConfluence: MTFConfluenceData }; timestamp: number }> = new Map();
const cachedDerivatives: Map<string, { data: DerivativesData; timestamp: number }> = new Map();
const cachedAIAnalysis: Map<string, { analysis: { fr: string; ar: string; en: string }; timestamp: number; price: number }> = new Map();

const CACHE_TTL_MS = 15000; // 15 seconds cache for active klines
const MTF_CACHE_TTL_MS = 90000; // 90 seconds cache for multi-timeframe confluence calculations
const AI_CACHE_TTL_MS = 120000; // 120 seconds AI analysis cache

// Periodically clean up expired cache entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  // Do NOT delete cachedTickers or cachedKlines to retain last known data for synthetic fallbacks during disconnects
  for (const [key, value] of cachedOrderBooks.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS * 5) cachedOrderBooks.delete(key);
  }
  for (const [key, value] of cachedMtfConfluence.entries()) {
    if (now - value.timestamp > MTF_CACHE_TTL_MS * 3) cachedMtfConfluence.delete(key);
  }
  for (const [key, value] of cachedAIAnalysis.entries()) {
    if (now - value.timestamp > AI_CACHE_TTL_MS * 5) cachedAIAnalysis.delete(key);
  }
}, 60000);

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Cache-Control': 'no-cache',
};

/**
 * Fetch 24h Ticker from Binance WebSocket Live Stream (Zero REST Rate Limits) with REST Fallback
 */
async function fetchBinanceTicker(symbol = 'BTCUSDT', marketType: 'SPOT' | 'FUTURES' = 'SPOT'): Promise<BinanceTicker> {
  const normSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BTCUSDT';
  const cacheKey = `ticker_${marketType}_${normSymbol}`;
  const now = Date.now();

  // 1. PRIMARY: Instant WebSocket stream ticker (0ms latency, zero HTTP requests, immune to IP bans)
  const wsData = binanceWs.getTicker(normSymbol);
  if (wsData && wsData.price > 0) {
    const ticker: BinanceTicker = {
      symbol: normSymbol,
      price: wsData.price,
      priceChange24h: wsData.change24h,
      priceChangePercent24h: wsData.changePercent24h,
      high24h: wsData.high || wsData.price,
      low24h: wsData.low || wsData.price,
      volume24h: wsData.volume || 1000,
      quoteVolume24h: wsData.quoteVolume || 500000,
      updatedAt: wsData.timestamp,
    };
    cachedTickers.set(cacheKey, { data: ticker, timestamp: now });
    return ticker;
  }

  const cached = cachedTickers.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. If IP is banned by Binance, never hammer REST endpoints
  if (binanceRestCache.isIpBanned()) {
    if (cached) return cached.data;
    const baseP = getBasePriceForSymbol(normSymbol);
    return {
      symbol: normSymbol,
      price: baseP,
      priceChange24h: 0,
      priceChangePercent24h: 0,
      high24h: baseP * 1.02,
      low24h: baseP * 0.98,
      volume24h: 1000,
      quoteVolume24h: 500000,
      updatedAt: now,
    };
  }

  // Multi-mirror endpoints: primary + backups
  const futuresUrls = [
    `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${normSymbol}`,
    `https://fapi1.binance.com/fapi/v1/ticker/24hr?symbol=${normSymbol}`,
  ];

  const spotUrls = [
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${normSymbol}`,
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${normSymbol}`,
  ];

  const urls = marketType === 'FUTURES' ? [...futuresUrls, ...spotUrls] : spotUrls;

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch(url, {
        headers: HTTP_HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 418 || res.status === 429) {
        try {
          const errData: any = await res.json();
          const match = (errData?.msg || '').match(/banned until (\d+)/i);
          const banUntil = match ? parseInt(match[1], 10) : undefined;
          binanceRestCache.recordIpBan(banUntil);
        } catch (_) {
          binanceRestCache.recordIpBan();
        }
        break;
      }

      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.lastPrice || data.price);
        if (!isNaN(price) && price > 0) {
          const ticker: BinanceTicker = {
            symbol: normSymbol,
            price,
            priceChange24h: parseFloat(data.priceChange || '0') || 0,
            priceChangePercent24h: parseFloat(data.priceChangePercent || '0') || 0,
            high24h: parseFloat(data.highPrice || data.price) || price,
            low24h: parseFloat(data.lowPrice || data.price) || price,
            volume24h: parseFloat(data.volume || '1000') || 1000,
            quoteVolume24h: parseFloat(data.quoteVolume || '500000') || 500000,
            updatedAt: data.closeTime || Date.now(),
          };

          cachedTickers.set(cacheKey, { data: ticker, timestamp: now });
          return ticker;
        }
      }
    } catch {
      clearTimeout(timeout);
    }
  }

  if (cached) {
    return cached.data; // Return slightly older cache if available
  }

  // If all failed, check cached Spot/Futures or realistic up-to-date base price
  const basePrice = getBasePriceForSymbol(normSymbol);
  const fallbackTicker: BinanceTicker = {
    symbol: normSymbol,
    price: basePrice,
    priceChange24h: basePrice * 0.015,
    priceChangePercent24h: 1.5,
    high24h: basePrice * 1.02,
    low24h: basePrice * 0.98,
    volume24h: 50000,
    quoteVolume24h: basePrice * 50000,
    updatedAt: Date.now(),
  };
  cachedTickers.set(cacheKey, { data: fallbackTicker, timestamp: now });
  return fallbackTicker;
}

/**
 * Fetch Klines from Binance Spot or Futures REST API with multi-mirror resilience
 */
async function fetchBinanceKlines(
  symbol = 'BTCUSDT',
  interval: Timeframe = '1h',
  limit = 350,
  marketType: 'SPOT' | 'FUTURES' = 'SPOT'
): Promise<KlineCandle[]> {
  const normSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BTCUSDT';
  const cacheKey = `${marketType}_${normSymbol}_${interval}_${limit}`;
  const now = Date.now();
  const cached = cachedKlines.get(cacheKey);

  // Extend cache TTL to 30 seconds for klines
  if (cached && now - cached.timestamp < 30000) {
    return cached.data;
  }

  // If IP is banned by Binance, never hammer REST endpoints
  if (binanceRestCache.isIpBanned()) {
    if (cached && cached.data && cached.data.length > 0) {
      return cached.data;
    }
  }

  const futuresUrls = [
    `https://fapi.binance.com/fapi/v1/klines?symbol=${normSymbol}&interval=${interval}&limit=${limit}`,
    `https://fapi1.binance.com/fapi/v1/klines?symbol=${normSymbol}&interval=${interval}&limit=${limit}`,
  ];

  const spotUrls = [
    `https://api.binance.com/api/v3/klines?symbol=${normSymbol}&interval=${interval}&limit=${limit}`,
    `https://data-api.binance.vision/api/v3/klines?symbol=${normSymbol}&interval=${interval}&limit=${limit}`,
  ];

  const urls = marketType === 'FUTURES' ? [...futuresUrls, ...spotUrls] : spotUrls;

  if (!binanceRestCache.isIpBanned()) {
    for (const url of urls) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      try {
        const res = await fetch(url, { headers: HTTP_HEADERS, signal: controller.signal });
        clearTimeout(timeout);

        if (res.status === 418 || res.status === 429) {
          try {
            const errData: any = await res.json();
            const match = (errData?.msg || '').match(/banned until (\d+)/i);
            const banUntil = match ? parseInt(match[1], 10) : undefined;
            binanceRestCache.recordIpBan(banUntil);
          } catch (_) {
            binanceRestCache.recordIpBan();
          }
          break;
        }

        if (res.ok) {
          const rawData = await res.json();
          if (Array.isArray(rawData) && rawData.length > 0) {
            const klines: KlineCandle[] = rawData.map((item: any) => ({
              time: Math.floor(item[0] / 1000),
              open: parseFloat(item[1]),
              high: parseFloat(item[2]),
              low: parseFloat(item[3]),
              close: parseFloat(item[4]),
              volume: parseFloat(item[5]),
            }));

            cachedKlines.set(cacheKey, { data: klines, timestamp: now });
            return klines;
          }
        }
      } catch {
        clearTimeout(timeout);
      }
    }
  }

  if (cached && cached.data && cached.data.length > 0) {
    return cached.data;
  }

  // Generate realistic synthetic klines if all endpoints are temporarily unreachable
  const syntheticKlines: KlineCandle[] = [];
  const nowTs = Math.floor(Date.now() / 1000);
  let tfSeconds = 3600;
  if (interval === '15m') tfSeconds = 15 * 60;
  else if (interval === '1h') tfSeconds = 3600;
  else if (interval === '4h') tfSeconds = 4 * 3600;
  else if (interval === '1d') tfSeconds = 24 * 3600;
  else if (interval === '1w') tfSeconds = 7 * 24 * 3600;

  let currentPrice = getBasePriceForSymbol(normSymbol);
  for (let i = limit - 1; i >= 0; i--) {
    const time = nowTs - (i * tfSeconds);
    const open = currentPrice;
    const volatility = currentPrice * 0.004;
    const close = open + (Math.random() - 0.49) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.8;
    const low = Math.min(open, close) - Math.random() * volatility * 0.8;
    const volume = Math.random() * 5000 + 500;
    
    syntheticKlines.push({
      time,
      open: Math.round(open * 10000) / 10000,
      high: Math.round(high * 10000) / 10000,
      low: Math.round(low * 10000) / 10000,
      close: Math.round(close * 10000) / 10000,
      volume: Math.round(volume * 100) / 100,
    });
    currentPrice = close;
  }

  cachedKlines.set(cacheKey, { data: syntheticKlines, timestamp: now });
  return syntheticKlines;
}

/**
 * Accurate real-world base prices for all major cryptocurrencies (used as realistic backup during API timeouts/rate-limits)
 */
function getBasePriceForSymbol(rawSymbol: string): number {
  const s = (rawSymbol || '').toUpperCase();
  
  // Return last known cached price to prevent massive price jumps during API disconnects
  const cachedSpot = cachedTickers.get(`ticker_SPOT_${s}`);
  if (cachedSpot && cachedSpot.data?.price > 0) return cachedSpot.data.price;
  const cachedFutures = cachedTickers.get(`ticker_FUTURES_${s}`);
  if (cachedFutures && cachedFutures.data?.price > 0) return cachedFutures.data.price;

  if (s.includes('BTC')) return 83500;
  if (s.includes('ETH')) return 3100;
  if (s.includes('SOL')) return 135;
  if (s.includes('BNB')) return 620;
  if (s.includes('XRP')) return 2.30;
  if (s.includes('DOGE')) return 0.18;
  if (s.includes('ADA')) return 0.72;
  if (s.includes('AVAX')) return 24.5;
  if (s.includes('LINK')) return 14.8;
  if (s.includes('SUI')) return 2.45;
  if (s.includes('NEAR')) return 4.8;
  if (s.includes('DOT')) return 4.6;
  if (s.includes('PEPE')) return 0.000010;
  if (s.includes('SHIB')) return 0.000014;
  if (s.includes('LTC')) return 98;
  if (s.includes('TRX')) return 0.22;
  if (s.includes('UNI')) return 8.2;
  if (s.includes('ATOM')) return 4.5;
  if (s.includes('ARB')) return 0.52;
  if (s.includes('OP')) return 1.25;
  if (s.includes('APT')) return 7.8;
  if (s.includes('INJ')) return 16.5;
  if (s.includes('RENDER')) return 5.1;
  if (s.includes('FTM')) return 0.58;
  if (s.includes('TIA')) return 4.2;
  if (s.includes('SEI')) return 0.28;
  if (s.includes('WIF')) return 1.15;
  if (s.includes('FET')) return 0.85;
  if (s.includes('GALA')) return 0.019;
  if (s.includes('AAVE')) return 195;
  if (s.includes('MKR')) return 1450;
  if (s.includes('CRV')) return 0.35;
  return 25.0;
}

/**
 * Generate synthetic realistic candles if Binance API fails or is rate-limited
 */
function generateServerFallbackKlines(
  symbol = 'BTCUSDT',
  interval: Timeframe = '1h',
  months = 6
): KlineCandle[] {
  const normSymbol = symbol.toUpperCase();
  const klines: KlineCandle[] = [];
  const nowTs = Math.floor(Date.now() / 1000);
  let tfSeconds = 3600;
  if (interval === '5m') tfSeconds = 5 * 60;
  else if (interval === '15m') tfSeconds = 15 * 60;
  else if (interval === '30m') tfSeconds = 30 * 60;
  else if (interval === '1h') tfSeconds = 3600;
  else if (interval === '4h') tfSeconds = 4 * 3600;
  else if (interval === '1d') tfSeconds = 24 * 3600;
  else if (interval === '1w') tfSeconds = 7 * 24 * 3600;

  const validMonths = Math.min(24, Math.max(1, months));
  const numCandles = Math.min(1000, Math.ceil((validMonths * 30 * 24 * 3600) / tfSeconds));

  const basePrice = getBasePriceForSymbol(normSymbol);
  let currentPrice = basePrice * (0.92 + Math.random() * 0.16);

  for (let i = numCandles - 1; i >= 0; i--) {
    const time = nowTs - (i * tfSeconds);
    const open = currentPrice;
    const volatility = currentPrice * 0.007;
    const change = (Math.random() - 0.492) * volatility;
    const close = Math.max(0.000001, open + change);
    const high = Math.max(open, close) + Math.random() * volatility * 0.6;
    const low = Math.min(open, close) - Math.random() * volatility * 0.6;
    const volume = Math.random() * 8000 + 400;

    klines.push({
      time,
      open: Math.round(open * 1000000) / 1000000,
      high: Math.round(high * 1000000) / 1000000,
      low: Math.round(low * 1000000) / 1000000,
      close: Math.round(close * 1000000) / 1000000,
      volume: Math.round(volume * 100) / 100,
    });
    currentPrice = close;
  }

  return klines;
}

/**
 * Fetch Deep Historical Klines for Backtesting (up to 24 months) from Binance REST API with resilient fallback
 */
async function fetchBinanceHistoricalKlines(
  symbol = 'BTCUSDT',
  interval: Timeframe = '1d',
  months = 6,
  marketType: 'SPOT' | 'FUTURES' = 'SPOT'
): Promise<KlineCandle[]> {
  const normSymbol = symbol.toUpperCase();
  const validMonths = Math.min(24, Math.max(1, months));
  const cacheKey = `hist_${marketType}_${normSymbol}_${interval}_${validMonths}m`;
  const now = Date.now();
  const cached = cachedKlines.get(cacheKey);

  if (cached && now - cached.timestamp < 300000) { // 5 minutes cache
    return cached.data;
  }

  // Calculate target candles and start time
  const startTime = now - validMonths * 30 * 24 * 3600 * 1000;
  
  let candleDurationSec = 3600;
  if (interval === '5m') candleDurationSec = 5 * 60;
  else if (interval === '15m') candleDurationSec = 15 * 60;
  else if (interval === '30m') candleDurationSec = 30 * 60;
  else if (interval === '1h') candleDurationSec = 3600;
  else if (interval === '4h') candleDurationSec = 4 * 3600;
  else if (interval === '1d') candleDurationSec = 24 * 3600;
  else if (interval === '1w') candleDurationSec = 7 * 24 * 3600;

  const totalCandlesExpected = Math.ceil((validMonths * 30 * 24 * 3600) / candleDurationSec);
  const baseUrl = marketType === 'FUTURES'
    ? 'https://fapi.binance.com/fapi/v1/klines'
    : 'https://api.binance.com/api/v3/klines';
  
  let allCandles: KlineCandle[] = [];
  const maxRequests = Math.min(2, Math.ceil(totalCandlesExpected / 1000));
  let currentStartTime = startTime;

  try {
    for (let iter = 0; iter < maxRequests; iter++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const limit = Math.min(1000, totalCandlesExpected - allCandles.length + 50);

      const url = `${baseUrl}?symbol=${normSymbol}&interval=${interval}&startTime=${currentStartTime}&limit=${limit}`;
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) break;
        const rawData = await res.json();
        if (!Array.isArray(rawData) || rawData.length === 0) break;

        const batch: KlineCandle[] = rawData.map((item: any) => ({
          time: Math.floor(item[0] / 1000),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
        }));

        allCandles = [...allCandles, ...batch];
        const lastRaw = rawData[rawData.length - 1];
        currentStartTime = lastRaw[0] + (candleDurationSec * 1000);
        if (currentStartTime >= now || batch.length < limit) break;
      } catch (e) {
        clearTimeout(timeout);
        break;
      }
    }

    // Deduplicate and sort
    const map = new Map<number, KlineCandle>();
    for (const c of allCandles) {
      map.set(c.time, c);
    }
    const sorted = Array.from(map.values()).sort((a, b) => a.time - b.time);

    if (sorted.length >= 20) {
      cachedKlines.set(cacheKey, { data: sorted, timestamp: now });
      return sorted;
    }

    // Attempt single fast fetch
    const fallbackKlines = await fetchBinanceKlines(symbol, interval, Math.min(1000, totalCandlesExpected), marketType);
    if (fallbackKlines && fallbackKlines.length >= 20) {
      cachedKlines.set(cacheKey, { data: fallbackKlines, timestamp: now });
      return fallbackKlines;
    }
  } catch (err) {
    // Graceful catch
  }

  // Fallback to high-quality synthetic generation if Binance is unreachable
  const synthetic = generateServerFallbackKlines(symbol, interval, validMonths);
  cachedKlines.set(cacheKey, { data: synthetic, timestamp: now });
  return synthetic;
}

/**
 * Fetch Order Book Depth from Binance Spot or Futures REST API
 */
async function fetchBinanceOrderBook(symbol = 'BTCUSDT', marketType: 'SPOT' | 'FUTURES' = 'SPOT'): Promise<OrderBookSummary> {
  const normSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BTCUSDT';
  const cacheKey = `depth_${marketType}_${normSymbol}`;
  const now = Date.now();
  const cached = cachedOrderBooks.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // STRICT SEPARATION: Depth endpoints
  const urls = marketType === 'FUTURES'
    ? [
        `https://fapi.binance.com/fapi/v1/depth?symbol=${normSymbol}&limit=20`,
      ]
    : [
        `https://api.binance.com/api/v3/depth?symbol=${normSymbol}&limit=20`,
        `https://api1.binance.com/api/v3/depth?symbol=${normSymbol}&limit=20`,
        `https://data-api.binance.vision/api/v3/depth?symbol=${normSymbol}&limit=20`,
      ];

  for (const url of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.bids && data.asks) {
          const topBids = data.bids.map((b: string[]) => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
          const topAsks = data.asks.map((a: string[]) => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));

          const bidTotal = topBids.reduce((acc: number, b: any) => acc + b.qty * b.price, 0);
          const askTotal = topAsks.reduce((acc: number, a: any) => acc + a.qty * a.price, 0);
          const total = bidTotal + askTotal;

          const bidAskRatio = askTotal > 0 ? Math.round((bidTotal / askTotal) * 100) / 100 : 1;
          const imbalancePercent = total > 0 ? Math.round(((bidTotal - askTotal) / total) * 1000) / 10 : 0;

          let bias: 'BUYERS_STRONG' | 'SELLERS_STRONG' | 'BALANCED' = 'BALANCED';
          if (bidAskRatio >= 1.2) bias = 'BUYERS_STRONG';
          else if (bidAskRatio <= 0.82) bias = 'SELLERS_STRONG';

          const largeWalls: { price: number; type: 'BID' | 'ASK'; volume: number }[] = [];
          const avgBidVol = bidsVolume(topBids) / (topBids.length || 1);
          const avgAskVol = asksVolume(topAsks) / (topAsks.length || 1);

          topBids.forEach((b: any) => {
            if (b.qty > avgBidVol * 2.2) {
              largeWalls.push({ price: b.price, type: 'BID', volume: Math.round(b.qty * b.price) });
            }
          });

          topAsks.forEach((a: any) => {
            if (a.qty > avgAskVol * 2.2) {
              largeWalls.push({ price: a.price, type: 'ASK', volume: Math.round(a.qty * a.price) });
            }
          });

          const summary: OrderBookSummary = {
            bidTotal: Math.round(bidTotal),
            askTotal: Math.round(askTotal),
            bidAskRatio,
            imbalancePercent,
            bias,
            topBids: topBids.slice(0, 10),
            topAsks: topAsks.slice(0, 10),
            largeWalls: largeWalls.slice(0, 4),
          };

          cachedOrderBooks.set(cacheKey, { data: summary, timestamp: now });
          return summary;
        }
      }
    } catch {
      clearTimeout(timeout);
    }
  }

  if (cached) {
    return cached.data;
  }

  const basePrice = getBasePriceForSymbol(normSymbol);
  const syntheticBids = Array.from({ length: 10 }, (_, i) => ({
    price: Math.round((basePrice * (1 - (i + 1) * 0.0005)) * 100) / 100,
    qty: Math.round((Math.random() * 5 + 1) * 100) / 100,
  }));
  const syntheticAsks = Array.from({ length: 10 }, (_, i) => ({
    price: Math.round((basePrice * (1 + (i + 1) * 0.0005)) * 100) / 100,
    qty: Math.round((Math.random() * 5 + 1) * 100) / 100,
  }));

  const fallbackSummary: OrderBookSummary = {
    bidTotal: Math.round(basePrice * 25),
    askTotal: Math.round(basePrice * 25),
    bidAskRatio: 1.0,
    imbalancePercent: 0,
    bias: 'BALANCED',
    topBids: syntheticBids,
    topAsks: syntheticAsks,
    largeWalls: [],
  };

  cachedOrderBooks.set(cacheKey, { data: fallbackSummary, timestamp: now });
  return fallbackSummary;
}

function bidsVolume(bids: { price: number; qty: number }[]): number {
  return bids.reduce((acc, b) => acc + b.qty, 0);
}

function asksVolume(asks: { price: number; qty: number }[]): number {
  return asks.reduce((acc, a) => acc + a.qty, 0);
}

/**
 * Fetch Derivatives Data from Binance Futures Public REST API
 */
async function fetchBinanceDerivatives(symbol = 'BTCUSDT'): Promise<DerivativesData> {
  const normSymbol = symbol.toUpperCase();
  const now = Date.now();
  const cached = cachedDerivatives.get(normSymbol);
  if (cached && now - cached.timestamp < 60000) {
    return cached.data;
  }

  if (binanceRestCache.isIpBanned()) {
    if (cached) return cached.data;
    return {
      openInterest: null,
      fundingRate: 0.01,
      takerLongShortRatio: 1.05,
      futuresVolume24h: null,
      isAvailable: false,
      source: 'Binance Safe Backoff (IP Rate Limit Protected)',
      lastUpdated: now,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const [oiRes, fundingRes, ratioRes] = await Promise.allSettled([
      fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${normSymbol}`, { signal: controller.signal }),
      fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${normSymbol}`, { signal: controller.signal }),
      fetch(`https://fapi.binance.com/fapi/v1/takerlongshortRatio?symbol=${normSymbol}&period=5m&limit=1`, { signal: controller.signal }),
    ]);

    clearTimeout(timeout);

    // Detect IP Ban on any endpoint
    for (const r of [oiRes, fundingRes, ratioRes]) {
      if (r.status === 'fulfilled' && (r.value.status === 418 || r.value.status === 429)) {
        binanceRestCache.recordIpBan();
        break;
      }
    }

    let openInterest: number | null = null;
    let fundingRate: number | null = null;
    let takerLongShortRatio: number | null = null;
    let isAvailable = false;

    if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
      const oiData = await oiRes.value.json();
      openInterest = parseFloat(oiData.openInterest);
      isAvailable = true;
    }

    if (fundingRes.status === 'fulfilled' && fundingRes.value.ok) {
      const fundData = await fundingRes.value.json();
      fundingRate = Math.round(parseFloat(fundData.lastFundingRate) * 10000) / 100; // in %
      isAvailable = true;
    }

    if (ratioRes.status === 'fulfilled' && ratioRes.value.ok) {
      const ratioData = await ratioRes.value.json();
      if (Array.isArray(ratioData) && ratioData.length > 0) {
        takerLongShortRatio = parseFloat(ratioData[0].buySellRatio);
        isAvailable = true;
      }
    }

    const derivatives: DerivativesData = {
      openInterest,
      fundingRate,
      takerLongShortRatio,
      futuresVolume24h: null,
      isAvailable,
      source: isAvailable ? 'Binance Futures Live API' : 'Binance Futures Unreachable',
      lastUpdated: now,
    };

    cachedDerivatives.set(normSymbol, { data: derivatives, timestamp: now });
    return derivatives;
  } catch (err) {
    return {
      openInterest: null,
      fundingRate: null,
      takerLongShortRatio: null,
      futuresVolume24h: null,
      isAvailable: false,
      source: 'Binance Futures Unreachable',
      lastUpdated: now,
    };
  }
}

/**
 * Fetch Multi-Timeframe Series & Compute Confluence
 */
async function fetchMultiTimeframeConfluence(symbol = 'BTCUSDT', marketType: 'SPOT' | 'FUTURES' = 'SPOT'): Promise<{
  allTimeframes: Record<Timeframe, { klines: KlineCandle[]; indicators: any }>;
  mtfConfluence: MTFConfluenceData;
}> {
  const normSymbol = symbol.toUpperCase();
  const cacheKey = `mtf_${marketType}_${normSymbol}`;
  const now = Date.now();
  const cached = cachedMtfConfluence.get(cacheKey);

  if (cached && now - cached.timestamp < MTF_CACHE_TTL_MS) {
    return cached.data;
  }

  if (binanceRestCache.isIpBanned() && cached) {
    return cached.data;
  }

  const tfList: Timeframe[] = ['5m', '15m', '30m', '1h', '4h', '1d', '1w'];

  const results = await Promise.allSettled(
    tfList.map(async (tf) => {
      const klines = await fetchBinanceKlines(normSymbol, tf, 80, marketType);
      const indicators = calculateTechnicalIndicators(klines);
      return { tf, klines, indicators };
    })
  );

  const allTimeframes: any = {};
  const tfConfluenceMap: any = {};
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  results.forEach((res, idx) => {
    const tf = tfList[idx];
    if (res.status === 'fulfilled') {
      const { klines, indicators } = res.value;
      allTimeframes[tf] = { klines, indicators };

      const lastClose = klines[klines.length - 1].close;
      const isEmaBull = lastClose > indicators.ema50;
      const isRsiBull = indicators.rsi14 >= 52;
      const isMacdBull = indicators.macd.histogram >= 0;

      let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      if ((isEmaBull && isRsiBull) || (isEmaBull && isMacdBull)) {
        bias = 'BULLISH';
        bullishCount++;
      } else if ((!isEmaBull && !isRsiBull) || (!isEmaBull && !isMacdBull)) {
        bias = 'BEARISH';
        bearishCount++;
      } else {
        bias = 'NEUTRAL';
        neutralCount++;
      }

      tfConfluenceMap[tf] = {
        bias,
        trend: indicators?.marketStructure?.trend || 'NEUTRAL',
        rsi: indicators?.rsi14 || 50,
        emaTrend: lastClose > (indicators?.ema200 || lastClose) ? 'BULLISH' : 'BEARISH',
      };
    }
  });

  const total = bullishCount + bearishCount + neutralCount || 1;
  const alignmentPercent = Math.round((Math.max(bullishCount, bearishCount) / total) * 100);
  const overallBias =
    bullishCount >= 3 ? 'BULLISH' : bearishCount >= 3 ? 'BEARISH' : 'NEUTRAL';

  const mtfConfluence: MTFConfluenceData = {
    timeframes: tfConfluenceMap,
    overallBias,
    bullishCount,
    bearishCount,
    neutralCount,
    alignmentPercent,
  };

  const finalResult = { allTimeframes, mtfConfluence };
  cachedMtfConfluence.set(cacheKey, { data: finalResult, timestamp: now });
  return finalResult;
}

// -------------------------------------------------------------

app.get('/api/scanner/status', (req, res) => {
  res.json(scannerState);
});

app.post('/api/scanner/scan-now', async (req, res) => {
  try {
    scanAllPairs().catch((err) => console.error('[SCANNER] Manual scan trigger error:', err));
    res.json({ success: true, message: 'Scan initiated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DIRECT IN-PROCESS MARKET DATA FETCHER (FOR BOT, SCANNER & API)
export async function getMarketDataDirect(
  symbol = 'BTCUSDT',
  timeframe: Timeframe = '1h',
  marketType: 'SPOT' | 'FUTURES' = 'FUTURES',
  isDevMode = false
): Promise<MarketDataResponse> {
  const normSymbol = (symbol || 'BTCUSDT').toUpperCase();
  const [tickerResult, klinesResult, orderBookResult, derivativesResult, mtfResult] =
    await Promise.allSettled([
      fetchBinanceTicker(normSymbol, marketType),
      fetchBinanceKlines(normSymbol, timeframe, 350, marketType),
      fetchBinanceOrderBook(normSymbol, marketType),
      marketType === 'FUTURES' ? fetchBinanceDerivatives(normSymbol) : Promise.resolve(null),
      fetchMultiTimeframeConfluence(normSymbol, marketType),
    ]);

  if (tickerResult.status === 'rejected' || klinesResult.status === 'rejected') {
    const errorMsg =
      tickerResult.status === 'rejected'
        ? (tickerResult as PromiseRejectedResult).reason?.message
        : (klinesResult as PromiseRejectedResult).reason?.message;

    console.warn(`Falling back to synthetic data for ${normSymbol} due to: ${errorMsg}`);
    
    const numCandles = 350;
    const syntheticKlines: KlineCandle[] = [];
    const nowTs = Math.floor(Date.now() / 1000);
    let tfSeconds = 3600;
    if (timeframe === '5m') tfSeconds = 5 * 60;
    else if (timeframe === '15m') tfSeconds = 15 * 60;
    else if (timeframe === '30m') tfSeconds = 30 * 60;
    else if (timeframe === '1h') tfSeconds = 3600;
    else if (timeframe === '4h') tfSeconds = 4 * 3600;
    else if (timeframe === '1d') tfSeconds = 24 * 3600;
    else if (timeframe === '1w') tfSeconds = 7 * 24 * 3600;

    let currentPrice = binanceWs.getPrice(normSymbol) || getBasePriceForSymbol(normSymbol);
    for (let i = numCandles - 1; i >= 0; i--) {
      const time = nowTs - (i * tfSeconds);
      const open = currentPrice;
      const volatility = currentPrice * 0.005;
      const close = open + (Math.random() - 0.5) * volatility;
      const high = Math.max(open, close) + Math.random() * volatility;
      const low = Math.min(open, close) - Math.random() * volatility;
      const volume = Math.random() * 1000 + 100;
      
      syntheticKlines.push({
        time,
        open: Math.round(open * 1000000) / 1000000,
        high: Math.round(high * 1000000) / 1000000,
        low: Math.round(low * 1000000) / 1000000,
        close: Math.round(close * 1000000) / 1000000,
        volume: Math.round(volume * 100) / 100,
      });
      currentPrice = close;
    }
    
    const wsTick = binanceWs.getTicker(normSymbol);
    const latestClose = wsTick?.price || syntheticKlines[syntheticKlines.length - 1].close;
    const firstClose = syntheticKlines[0].close;
    const change = wsTick ? wsTick.change24h : (latestClose - firstClose);
    const changePct = wsTick ? wsTick.changePercent24h : ((change / firstClose) * 100);
    const syntheticTicker: BinanceTicker = {
      symbol: normSymbol,
      price: latestClose,
      priceChange24h: change,
      priceChangePercent24h: changePct,
      volume24h: wsTick?.volume || (Math.random() * 50000 + 10000),
      quoteVolume24h: wsTick?.quoteVolume || (Math.random() * 50000000 + 10000000),
      high24h: wsTick?.high || Math.max(...syntheticKlines.map((k) => k.high)),
      low24h: wsTick?.low || Math.min(...syntheticKlines.map((k) => k.low)),
      updatedAt: Date.now(),
    };

    const syntheticIndicators = calculateTechnicalIndicators(syntheticKlines);
    const syntheticRegime = detectMarketRegime(syntheticIndicators, syntheticTicker.price);

    return {
      status: 'ONLINE',
      errorMessage: `Mode Démo : API Binance bloquée (${errorMsg}). Données synthétiques utilisées.`,
      ticker: syntheticTicker,
      timeframe,
      klines: syntheticKlines,
      indicators: syntheticIndicators,
      orderBook: null,
      derivatives: null,
      marketRegime: syntheticRegime,
      mtfConfluence: null,
      updatedAt: Date.now(),
      isDeveloperMode: true,
    };
  }

  const ticker = (tickerResult as PromiseFulfilledResult<BinanceTicker>).value;
  const klines = (klinesResult as PromiseFulfilledResult<KlineCandle[]>).value;
  const orderBook =
    orderBookResult.status === 'fulfilled'
      ? (orderBookResult as PromiseFulfilledResult<OrderBookSummary>).value
      : null;
  const derivatives =
    derivativesResult.status === 'fulfilled'
      ? (derivativesResult as PromiseFulfilledResult<DerivativesData>).value
      : null;
  const { allTimeframes, mtfConfluence } =
    mtfResult.status === 'fulfilled'
      ? (mtfResult as PromiseFulfilledResult<any>).value
      : { allTimeframes: {}, mtfConfluence: null };

  const indicators = calculateTechnicalIndicators(klines);
  const marketRegime = detectMarketRegime(indicators, ticker.price);

  return {
    status: 'ONLINE',
    ticker,
    timeframe,
    klines,
    indicators,
    orderBook,
    derivatives,
    marketRegime,
    mtfConfluence,
    allTimeframes,
    updatedAt: Date.now(),
    isDeveloperMode: isDevMode,
  };
}

// API ROUTE 1: GET /api/binance/market-data
// -------------------------------------------------------------
app.get('/api/binance/market-data', async (req, res) => {
  try {
    const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
    const timeframe = (req.query.timeframe as Timeframe) || '1h';
    const marketType = (req.query.marketType as 'SPOT' | 'FUTURES') === 'FUTURES' ? 'FUTURES' : 'SPOT';
    const useTestnet = req.query.useTestnet === 'true';
    const isDevMode = req.query.devMode === 'true';

    const payload = await getMarketDataDirect(symbol, timeframe, marketType, isDevMode);
    res.json(payload);
  } catch (error: any) {
    console.error('Market data server error:', error);
    res.status(500).json({
      status: 'OFFLINE',
      errorMessage: error.message || 'Erreur interne du serveur de données de marché',
      ticker: null,
      timeframe: '1h',
      klines: [],
      indicators: null,
      orderBook: null,
      derivatives: null,
      marketRegime: null,
      mtfConfluence: null,
      updatedAt: Date.now(),
      isDeveloperMode: false,
    });
  }
});

// -------------------------------------------------------------
// API ROUTE 1B: GET /api/binance/historical-klines (Backtesting Deep History)
// -------------------------------------------------------------
app.get('/api/binance/historical-klines', async (req, res) => {
  try {
    const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
    const timeframe = (req.query.timeframe as Timeframe) || '1d';
    const months = parseInt(req.query.months as string, 10) || 6;
    const marketType = (req.query.marketType as 'SPOT' | 'FUTURES') === 'FUTURES' ? 'FUTURES' : 'SPOT';

    const klines = await fetchBinanceHistoricalKlines(symbol, timeframe, months, marketType);
    return res.json({
      success: true,
      symbol,
      timeframe,
      months,
      candleCount: klines.length,
      klines,
    });
  } catch (error: any) {
    console.error('Historical klines error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch historical klines',
      klines: [],
    });
  }
});

// -------------------------------------------------------------
// API ROUTE 1C: POST /api/binance/batch-historical-klines (Multi-Coin Backtesting)
// -------------------------------------------------------------
app.post('/api/binance/batch-historical-klines', async (req, res) => {
  try {
    const { symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'], timeframe = '1d', months = 6, marketType = 'SPOT' } = req.body;
    const normSymbols = (symbols as string[]).map(s => s.toUpperCase());
    const validMonths = Math.min(24, Math.max(1, Number(months) || 6));
    const validMarketType = marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';

    // Fetch all in parallel with settlements
    const results = await Promise.allSettled(
      normSymbols.map(sym => fetchBinanceHistoricalKlines(sym, timeframe as Timeframe, validMonths, validMarketType))
    );

    const klinesMap: Record<string, KlineCandle[]> = {};
    normSymbols.forEach((sym, idx) => {
      const resItem = results[idx];
      if (resItem.status === 'fulfilled') {
        klinesMap[sym] = resItem.value;
      } else {
        klinesMap[sym] = [];
      }
    });

    return res.json({
      success: true,
      timeframe,
      months: validMonths,
      results: klinesMap,
    });
  } catch (error: any) {
    console.error('Batch historical klines error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to batch fetch historical klines',
      results: {},
    });
  }
});

// -------------------------------------------------------------
// AI Status & Key Configuration Endpoint
// -------------------------------------------------------------
app.get('/api/ai/status', async (req, res) => {
  loadEnvFallback();
  const key = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
  const hasGeminiKey = !!(key && key !== 'MY_GEMINI_API_KEY' && key !== 'YOUR_KEY_HERE');
  const hasQwenKey = !!(process.env.QWEN_API_KEY && process.env.QWEN_API_KEY !== 'YOUR_QWEN_API_KEY');
  const dsKeyKv = await kv.get('DEEPSEEK_API_KEY');
  const hasDeepSeekKey = !!((process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'YOUR_DEEPSEEK_API_KEY') || (dsKeyKv && dsKeyKv.trim() !== ''));
  const openAiKeyKv = await kv.get('OPENAI_API_KEY');
  const hasOpenAiKey = !!((process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'YOUR_OPENAI_API_KEY' && process.env.OPENAI_API_KEY.trim() !== '') || (openAiKeyKv && openAiKeyKv.trim() !== ''));
  const provider = hasGeminiKey ? 'gemini' : (hasQwenKey ? 'qwen' : (hasDeepSeekKey ? 'deepseek' : (hasOpenAiKey ? 'chatgpt' : 'deterministic')));
  res.json({
    status: 'ok',
    provider,
    geminiConfigured: hasGeminiKey,
    qwenConfigured: hasQwenKey,
    deepseekConfigured: hasDeepSeekKey,
    chatGptConfigured: hasOpenAiKey,
    openaiConfigured: hasOpenAiKey,
    activeModel: hasGeminiKey ? 'gemini-2.5-flash' : (hasQwenKey ? 'qwen-2.5-32b' : (hasDeepSeekKey ? 'deepseek-chat' : (hasOpenAiKey ? 'gpt-4o' : 'quant-deterministic'))),
  });
});

app.post('/api/config/gemini-key', (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return res.status(400).json({ error: 'Valid Gemini API key required' });
    }
    const cleanKey = apiKey.trim();
    process.env.GEMINI_API_KEY = cleanKey;
    geminiClient = new GoogleGenAI({ apiKey: cleanKey });

    // Persist to .env file on disk
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('GEMINI_API_KEY=')) {
        envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${cleanKey}`);
      } else {
        envContent += `\nGEMINI_API_KEY=${cleanKey}\n`;
      }
    } else {
      envContent = `GEMINI_API_KEY=${cleanKey}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');

    return res.json({
      success: true,
      message: 'GEMINI_API_KEY set and saved to .env successfully',
      geminiConfigured: true,
      provider: 'gemini',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save key' });
  }
});

// -------------------------------------------------------------
// API ROUTE 2: POST /api/qwen/analyze or /api/ai/analyze
// -------------------------------------------------------------
app.post(['/api/qwen/analyze', '/api/ai/analyze'], async (req, res) => {
  try {
    const { marketData, isDeveloperMode = false } = req.body;

    let finalMarketData = marketData;
    if (!finalMarketData || !finalMarketData.ticker) {
      const rawSymbol = (req.body.symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BTCUSDT';
      const rawMarketType = (req.body.marketType || 'FUTURES') as 'SPOT' | 'FUTURES';
      const rawTf = (req.body.timeframe || '1h') as Timeframe;

      const [ticker, klines] = await Promise.all([
        fetchBinanceTicker(rawSymbol, rawMarketType),
        fetchBinanceKlines(rawSymbol, rawTf, 100, rawMarketType),
      ]);

      const currentPrice = ticker.price;
      finalMarketData = {
        ticker,
        timeframe: rawTf,
        indicators: {
          rsi14: 52.4,
          ema20: currentPrice * 0.995,
          ema50: currentPrice * 0.985,
          ema200: currentPrice * 0.965,
          atr14: currentPrice * 0.015,
          adx14: 28.5,
          macd: { macd: currentPrice * 0.002, signal: currentPrice * 0.0015, histogram: currentPrice * 0.0005 },
          marketStructure: { trend: 'BULLISH', structure: 'EXPANSION', bos: 'BULLISH_BOS' },
        },
        orderBook: { bidAskRatio: 1.25, bias: 'BULLISH' },
      };
    }

    const { ticker, indicators, orderBook, derivatives, mtfConfluence, timeframe } = finalMarketData;
    const currentPrice = ticker.price;
    const currentSymbol = (ticker.symbol || 'BTCUSDT').toUpperCase();
    const pairName = currentSymbol.includes('/') ? currentSymbol : `${currentSymbol.replace('USDT', '')}/USDT`;

    // 1. Generate Deterministic Quantitative Plan
    const deterministicPlan = generateQuantitativePlan(
      timeframe,
      currentPrice,
      indicators,
      orderBook,
      derivatives,
      mtfConfluence,
      isDeveloperMode,
      currentSymbol
    );

    // 2. Attempt LLM Interpretation (Gemini or Qwen) if available, with in-memory caching
    const cacheKey = `${currentSymbol}_${timeframe}_${deterministicPlan.decision}_${deterministicPlan.marketRegime}`;
    const cached = cachedAIAnalysis.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < AI_CACHE_TTL_MS) && Math.abs(cached.price - currentPrice) / currentPrice < 0.015) {
      deterministicPlan.detailedAnalysis = cached.analysis;
      return res.json({ ...deterministicPlan, provider: 'gemini' });
    }

    const gemini = getGemini();
    const openai = getOpenAI();
    let usedProvider = 'deterministic';

    if (gemini) {
      const candidateModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.8-flash'];
      const prompt = `
Tu es un Analyste Quantitatif Senior & Moteur d'Interprétation Technique pour ${pairName} sur Binance.
Voici les données de marché réelles et calculées mathématiquement:

PAIR: ${pairName}
PRIX ACTUEL: $${currentPrice} USDT
TIMEFRAME: ${timeframe}
RÉGIME DE MARCHÉ: ${deterministicPlan.marketRegime}
DÉCISION QUANTITATIVE: ${deterministicPlan.decision} (Force du Signal: ${deterministicPlan.confidence}%)
NOTE D'ENTRÉE: Grade ${deterministicPlan.entryQuality.grade} (${deterministicPlan.entryQuality.score}/100)
ZONE D'ENTRÉE: ${deterministicPlan.entryZone ? `$${deterministicPlan.entryZone.min} - $${deterministicPlan.entryZone.max} (Idéal: $${deterministicPlan.entryZone.ideal})` : 'N/A'}
STOP LOSS: ${deterministicPlan.stopLoss ? `$${deterministicPlan.stopLoss}` : 'N/A'}
OBJECTIFS: ${deterministicPlan.targets ? `TP1: $${deterministicPlan.targets.tp1}, TP2: $${deterministicPlan.targets.tp2}, TP3: $${deterministicPlan.targets.tp3}` : 'N/A'}
RATIO R/R: ${deterministicPlan.riskRewardRatio ? `1:${deterministicPlan.riskRewardRatio}` : 'N/A'}
INVALIDATION: ${deterministicPlan.invalidation.reason}
STRUCTURE: ${indicators?.marketStructure?.trend || 'NEUTRAL'} (${indicators?.marketStructure?.structure || 'RANGE'}) | ${indicators?.marketStructure?.bos || 'N/A'}
INDICATEURS: RSI14 = ${indicators?.rsi14 || 50}, MACD Histogram = ${indicators?.macd?.histogram || 0}, EMA20 = $${indicators?.ema20 || currentPrice}, EMA50 = $${indicators?.ema50 || currentPrice}, EMA200 = $${indicators?.ema200 || currentPrice}, ATR14 = $${indicators?.atr14 || 0}, ADX14 = ${indicators?.adx14 || 0}
CARNET D'ORDRES: ${orderBook ? `Ratio Bids/Asks = ${orderBook.bidAskRatio} (${orderBook.bias})` : 'Données spot Binance'}

TÂCHE:
Rédige une explication technique concise et professionnelle en 3 langues:
1. "fr" (Français fluide et technique pour trader institutionnel)
2. "ar" (العربية الفصحى مع المصطلحات الفنية الواضحة)
3. "en" (English concise institutional trader format)

Réponds UNIQUEMENT sous forme d'objet JSON valide:
{
  "fr": "string",
  "ar": "string",
  "en": "string"
}
`;

      let generated = false;
      for (const modelName of candidateModels) {
        try {
          const response = await gemini.models.generateContent({
            model: modelName,
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          });

          const text = response.text?.trim();
          if (text) {
            const parsed = JSON.parse(text);
            if (parsed.fr && parsed.ar && parsed.en) {
              deterministicPlan.detailedAnalysis = parsed;
              cachedAIAnalysis.set(cacheKey, {
                analysis: parsed,
                timestamp: Date.now(),
                price: currentPrice,
              });
              usedProvider = 'gemini';
              generated = true;
              break;
            }
          }
        } catch (modelErr: any) {
          // If model is busy (503) or rate-limited (429), try next candidate
          continue;
        }
      }
    } else if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'Qwen/Qwen2.5-32B-Instruct',
          messages: [
            {
              role: 'system',
              content: 'You are an institutional crypto quantitative trading engine. Output strict JSON with keys "fr", "ar", "en".',
            },
            {
              role: 'user',
              content: `Summarize the deterministic trading plan for ${pairName} ${timeframe}: Decision ${deterministicPlan.decision}, Regime ${deterministicPlan.marketRegime}, Entry $${deterministicPlan.entryZone?.ideal || 'N/A'}, TP1 $${deterministicPlan.targets?.tp1 || 'N/A'}, SL $${deterministicPlan.stopLoss || 'N/A'}. Return JSON: { "fr": "...", "ar": "...", "en": "..." }`,
            },
          ],
          temperature: 0.2,
        });

        const content = completion.choices[0]?.message?.content?.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.fr && parsed.ar && parsed.en) {
            deterministicPlan.detailedAnalysis = parsed;
            cachedAIAnalysis.set(cacheKey, {
              analysis: parsed,
              timestamp: Date.now(),
              price: currentPrice,
            });
            usedProvider = 'qwen';
          }
        }
      } catch (qwenErr) {
        console.warn('Qwen LLM interpretation skipped, using quant deterministic text.');
      }
    }

    res.json({ ...deterministicPlan, provider: usedProvider });
  } catch (error: any) {
    console.error('AI Analysis endpoint error:', error.stack || error);
    res.status(500).json({ error: error.message || 'AI Analysis failed', stack: error.stack });
  }
});


// -------------------------------------------------------------
// SECURE BINANCE CONFIGURATION & ENCRYPTION
// -------------------------------------------------------------
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_quantura_2026';
const IV_LENGTH = 16;

function encryptSecret(text) {
  if (!text) return text;
  try {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substring(0, 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
    return text;
  }
}

function decryptSecret(text) {
  if (!text) return text;
  const keysToTry = [
    process.env.ENCRYPTION_KEY || 'default_secret_key_quantura_2026',
    'default_secret_key_quantura_2026',
    'quantura_secure_default_key_32_bytes_long!',
  ];
  for (const encKey of keysToTry) {
    try {
      const textParts = text.split(':');
      if (textParts.length !== 2) return text;
      const iv = Buffer.from(textParts[0], 'hex');
      const encryptedText = Buffer.from(textParts[1], 'hex');
      const key = crypto.createHash('sha256').update(String(encKey)).digest('base64').substring(0, 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      const res = decrypted.toString();
      if (res && isValidBinanceSecret(res)) return res;
    } catch (_) {}
  }
  return text;
}

function isValidBinanceKey(key: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.includes('...') || trimmed.includes('*') || trimmed.length < 15) return false;
  return true;
}

function isValidBinanceSecret(secret: string): boolean {
  if (!secret) return false;
  const trimmed = secret.trim();
  if (trimmed.includes('...') || trimmed.includes('*') || trimmed.length < 15) return false;
  return true;
}

function getEnvBinanceCredentials() {
  const rawKey = (
    process.env.BINANCE_API_KEY ||
    process.env.BINANCE_KEY ||
    process.env.BINANCE_APIKEY ||
    process.env.BINANCE_PUBLIC_KEY ||
    process.env.BINANCE_API ||
    process.env.API_KEY ||
    process.env.VITE_BINANCE_API_KEY ||
    process.env.VITE_BINANCE_KEY ||
    ''
  ).trim();

  const rawSecret = (
    process.env.BINANCE_SECRET_KEY ||
    process.env.BINANCE_API_SECRET ||
    process.env.BINANCE_SECRET ||
    process.env.BINANCE_APISECRET ||
    process.env.BINANCE_PRIVATE_KEY ||
    process.env.API_SECRET ||
    process.env.SECRET_KEY ||
    process.env.VITE_BINANCE_SECRET_KEY ||
    process.env.VITE_BINANCE_API_SECRET ||
    process.env.VITE_BINANCE_SECRET ||
    ''
  ).trim();

  const apiKey = isValidBinanceKey(rawKey) ? rawKey : '';
  const apiSecret = isValidBinanceSecret(rawSecret) ? rawSecret : '';

  const useTestnet =
    process.env.BINANCE_USE_TESTNET === 'true' ||
    process.env.BINANCE_TESTNET === 'true' ||
    process.env.USE_TESTNET === 'true';

  const marketType = (
    (process.env.BINANCE_MARKET_TYPE || process.env.MARKET_TYPE || 'SPOT').toUpperCase() === 'FUTURES'
      ? 'FUTURES'
      : 'SPOT'
  ) as 'SPOT' | 'FUTURES';

  return { apiKey, apiSecret, useTestnet, marketType };
}

app.get('/api/config/binance', async (req, res) => {
  const envCreds = getEnvBinanceCredentials();
  const kvTestnet = await kv.get('app_binance_use_testnet');
  const kvMarketType = await kv.get('app_binance_market_type');

  const storedStr = await kv.get('binance_api_config');
  if (storedStr) {
    try {
      const parsed = JSON.parse(storedStr);
      let effectiveKey = (parsed.apiKey || '').trim();
      let effectiveSecret = (decryptSecret(parsed.apiSecret) || '').trim();

      // Clean corrupted mask in KV
      if (!isValidBinanceKey(effectiveKey)) {
        effectiveKey = envCreds.apiKey;
      }
      if (!isValidBinanceSecret(effectiveSecret)) {
        effectiveSecret = envCreds.apiSecret;
      }

      if (effectiveKey && effectiveSecret) {
        return res.json({
          configured: true,
          apiKeyPrefix: effectiveKey.length > 8 ? effectiveKey.substring(0, 6) + '...' + effectiveKey.slice(-4) : effectiveKey.substring(0, 4) + '...',
          useTestnet: kvTestnet !== null ? (kvTestnet === 'true') : (parsed.useTestnet !== undefined ? parsed.useTestnet : envCreds.useTestnet),
          marketType: (kvMarketType as any) || parsed.marketType || envCreds.marketType
        });
      }
    } catch(e) {}
  }

  if (envCreds.apiKey && envCreds.apiSecret) {
    return res.json({
      configured: true,
      apiKeyPrefix: envCreds.apiKey.length > 8 ? envCreds.apiKey.substring(0, 6) + '...' + envCreds.apiKey.slice(-4) : envCreds.apiKey.substring(0, 4) + '...',
      useTestnet: kvTestnet !== null ? (kvTestnet === 'true') : envCreds.useTestnet,
      marketType: (kvMarketType as any) || envCreds.marketType
    });
  }

  return res.json({ 
    configured: false, 
    useTestnet: kvTestnet !== null ? (kvTestnet === 'true') : false, 
    marketType: (kvMarketType as any) || 'SPOT' 
  });
});

app.post('/api/config/binance', async (req, res) => {
  let { apiKey, apiSecret, useTestnet, marketType } = req.body;
  
  let finalKey = (apiKey || '').trim();
  let finalSecret = (apiSecret || '').trim();
  
  const envCreds = getEnvBinanceCredentials();
  
  // Persist network preference in dedicated KV keys so toggling Testnet never gets wiped
  if (useTestnet !== undefined) {
    await kv.set('app_binance_use_testnet', Boolean(useTestnet) ? 'true' : 'false');
  }
  if (marketType) {
    await kv.set('app_binance_market_type', marketType);
    binanceWs.setMarketType(marketType);
  }

  // If user provided a mask or empty string, retrieve existing valid key
  const storedStr = await kv.get('binance_api_config');
  let existingStoredKey = '';
  let existingStoredSecret = '';
  if (storedStr) {
    try {
      const parsed = JSON.parse(storedStr);
      existingStoredKey = (parsed.apiKey || '').trim();
      existingStoredSecret = (decryptSecret(parsed.apiSecret) || '').trim();

      if (!isValidBinanceKey(finalKey)) {
        finalKey = isValidBinanceKey(existingStoredKey) ? existingStoredKey : envCreds.apiKey;
      }
      if (!isValidBinanceSecret(finalSecret)) {
        finalSecret = isValidBinanceSecret(existingStoredSecret) ? existingStoredSecret : envCreds.apiSecret;
      }
    } catch(e) {}
  } else {
    if (!isValidBinanceKey(finalKey)) finalKey = envCreds.apiKey;
    if (!isValidBinanceSecret(finalSecret)) finalSecret = envCreds.apiSecret;
  }

  if (isValidBinanceKey(finalKey) && isValidBinanceSecret(finalSecret)) {
    const secureConfig = {
      apiKey: finalKey,
      apiSecret: encryptSecret(finalSecret),
      useTestnet: Boolean(useTestnet),
      marketType: marketType || 'SPOT'
    };
    await kv.set('binance_api_config', JSON.stringify(secureConfig));
  } else if (storedStr) {
    try {
      const parsed = JSON.parse(storedStr);
      if (useTestnet !== undefined) parsed.useTestnet = Boolean(useTestnet);
      if (marketType) parsed.marketType = marketType;
      await kv.set('binance_api_config', JSON.stringify(parsed));
    } catch(e) {}
  }

  res.json({ 
    success: true, 
    useTestnet: Boolean(useTestnet), 
    message: 'Binance configuration and network preference saved successfully.' 
  });
});

app.delete('/api/config/binance', async (req, res) => {
  await kv.delete('binance_api_config');
  await kv.delete('app_binance_use_testnet');
  res.json({ success: true, message: 'Binance credentials and network configuration reset.' });
});

app.post('/api/config/telegram', async (req, res) => {
  const { token, chatId } = req.body;
  if (token) await kv.set('app_telegram_bot_token', token);
  if (chatId) await kv.set('app_telegram_chat_id', chatId);
  res.json({ success: true });
});

// -------------------------------------------------------------
// BINANCE LIVE TRADING & ACCOUNT API INTEGRATION
// -------------------------------------------------------------

interface BinanceAuthData {
  apiKey: string;
  apiSecret: string;
  useTestnet: boolean;
  marketType: 'SPOT' | 'FUTURES';
}

async function resolveBinanceAuth(req: express.Request): Promise<BinanceAuthData> {
  const headerKey = (req.headers['x-binance-api-key'] as string || '').trim();
  const headerSecret = (req.headers['x-binance-api-secret'] as string || '').trim();
  const headerTestnet = req.headers['x-binance-testnet'] === 'true';
  const headerMarketType = req.headers['x-binance-market-type'] as 'SPOT' | 'FUTURES';

  const bodyKey = (req.body?.apiKey || (req.query?.apiKey as string) || '').trim();
  const bodySecret = (req.body?.apiSecret || (req.query?.apiSecret as string) || '').trim();
  const bodyTestnet = req.body?.useTestnet === true || req.query?.useTestnet === 'true';
  const bodyMarketType = req.body?.marketType || (req.query?.marketType as 'SPOT' | 'FUTURES');

  const envCreds = getEnvBinanceCredentials();

  let dbKey = '';
  let dbSecret = '';
  let dbTestnet = null;
  let dbMarketType = null;
  
  const storedStr = await kv.get('binance_api_config');
  if (storedStr) {
    try {
      const parsed = JSON.parse(storedStr);
      const parsedKey = (parsed.apiKey || '').trim();
      const parsedSecret = (decryptSecret(parsed.apiSecret) || '').trim();
      if (isValidBinanceKey(parsedKey) && isValidBinanceSecret(parsedSecret)) {
        dbKey = parsedKey;
        dbSecret = parsedSecret;
      } else {
        // If stored config had a masked placeholder or was corrupted, remove it so it falls back cleanly to .env
        await kv.delete('binance_api_config');
      }
      dbTestnet = parsed.useTestnet;
      dbMarketType = parsed.marketType;
    } catch(e) {}
  }

  // Resolve API Key: prefer valid explicitly passed key, then stored valid key, then env key
  let apiKey = '';
  if (isValidBinanceKey(headerKey)) {
    apiKey = headerKey;
  } else if (isValidBinanceKey(bodyKey)) {
    apiKey = bodyKey;
  } else if (isValidBinanceKey(dbKey)) {
    apiKey = dbKey;
  } else if (isValidBinanceKey(envCreds.apiKey)) {
    apiKey = envCreds.apiKey;
  }

  // Resolve API Secret: prefer valid explicitly passed secret, then stored valid secret, then env secret
  let apiSecret = '';
  if (isValidBinanceSecret(headerSecret)) {
    apiSecret = headerSecret;
  } else if (isValidBinanceSecret(bodySecret)) {
    apiSecret = bodySecret;
  } else if (isValidBinanceSecret(dbSecret)) {
    apiSecret = dbSecret;
  } else if (isValidBinanceSecret(envCreds.apiSecret)) {
    apiSecret = envCreds.apiSecret;
  }

  const kvTestnet = await kv.get('app_binance_use_testnet');
  const kvMarketType = await kv.get('app_binance_market_type');
  const kvMode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || '';
  const reqMode = (req.query?.executionMode as string) || (req.headers['x-execution-mode'] as string) || (req.body?.executionMode as string) || '';
  const effectiveMode = reqMode || kvMode;

  const explicitTestnetParam =
    req.body?.useTestnet !== undefined
      ? Boolean(req.body.useTestnet)
      : req.query?.useTestnet !== undefined
      ? req.query.useTestnet === 'true'
      : req.headers['x-binance-testnet'] !== undefined
      ? req.headers['x-binance-testnet'] === 'true'
      : undefined;

  const isTestnetMode = effectiveMode === 'BINANCE_TESTNET';
  const isLiveMode = effectiveMode === 'BINANCE_LIVE';

  const useTestnet =
    explicitTestnetParam !== undefined
      ? explicitTestnetParam
      : isTestnetMode
      ? true
      : isLiveMode
      ? false
      : kvTestnet !== null
      ? kvTestnet === 'true'
      : dbTestnet !== null
      ? Boolean(dbTestnet)
      : envCreds.useTestnet;

  const botCfgStr = await kv.get('btc_bot_config');
  let botCfgMarketType: 'SPOT' | 'FUTURES' | null = null;
  if (botCfgStr) {
    try {
      const parsed = JSON.parse(botCfgStr);
      if (parsed.marketType === 'SPOT' || parsed.marketType === 'FUTURES') {
        botCfgMarketType = parsed.marketType;
      }
    } catch (_) {}
  }

  const marketType = headerMarketType || bodyMarketType || (kvMarketType as any) || botCfgMarketType || dbMarketType || envCreds.marketType || 'SPOT';

  return { apiKey, apiSecret, useTestnet, marketType: marketType as any };
}

function getBinanceApiBase(useTestnet: boolean): string {
  return useTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
}

function getBinanceFuturesApiBase(useTestnet: boolean): string {
  return useTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';
}

function createBinanceSignature(queryString: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

async function handleBinanceAccountFetch(req: express.Request, res: express.Response) {
  const startTime = Date.now();
  try {
    const { apiKey, apiSecret, useTestnet, marketType } = await resolveBinanceAuth(req);
    const rawMode = (req.body?.executionMode as string) || (req.query.executionMode as string) || (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
    const executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE' =
      rawMode === 'BINANCE_LIVE'
        ? 'BINANCE_LIVE'
        : rawMode === 'BINANCE_TESTNET' || useTestnet
        ? 'BINANCE_TESTNET'
        : 'PAPER';

    if (executionMode !== 'PAPER' && (!apiKey || !apiSecret)) {
      return res.status(400).json({
        error: 'BINANCE CONNECTION ERROR: Missing Binance API Key or Secret Key.',
        code: 'MISSING_CREDENTIALS',
      });
    }

    let effectiveMarket: 'SPOT' | 'FUTURES' = (marketType === 'FUTURES' || marketType === 'SPOT') ? marketType : 'SPOT';
    let accountData = await fetchAuthoritativeAccount(
      effectiveMarket,
      executionMode,
      { apiKey, apiSecret, useTestnet }
    );

    // Smart Auto-Detection: If user entered valid Spot Testnet keys while FUTURES was selected (or vice-versa),
    // automatically test the opposite marketType on the same network if the first failed with -2015 or auth error!
    if (!accountData.success && apiKey && apiSecret && ((accountData as any).binanceCode === -2015 || (accountData as any).binanceCode === -2014 || String(accountData.error).includes('Invalid API-key'))) {
      const alternateMarket: 'SPOT' | 'FUTURES' = effectiveMarket === 'FUTURES' ? 'SPOT' : 'FUTURES';
      const altAccountData = await fetchAuthoritativeAccount(
        alternateMarket,
        executionMode,
        { apiKey, apiSecret, useTestnet }
      );
      if (altAccountData.success) {
        effectiveMarket = alternateMarket;
        accountData = altAccountData;
        await kv.set('app_binance_market_type', effectiveMarket);
        binanceWs.setMarketType(effectiveMarket);
      }
    }

    // Second Smart Fallback: If user entered Testnet keys while useTestnet was false, try useTestnet = true!
    let finalUseTestnet = useTestnet;
    if (!accountData.success && apiKey && apiSecret && !useTestnet && ((accountData as any).binanceCode === -2015 || String(accountData.error).includes('Invalid API-key'))) {
      const testnetTry = await fetchAuthoritativeAccount(
        effectiveMarket,
        'BINANCE_TESTNET',
        { apiKey, apiSecret, useTestnet: true }
      );
      if (testnetTry.success) {
        finalUseTestnet = true;
        accountData = testnetTry;
        await kv.set('app_binance_use_testnet', 'true');
      } else {
        const altMarket: 'SPOT' | 'FUTURES' = effectiveMarket === 'FUTURES' ? 'SPOT' : 'FUTURES';
        const testnetAltTry = await fetchAuthoritativeAccount(
          altMarket,
          'BINANCE_TESTNET',
          { apiKey, apiSecret, useTestnet: true }
        );
        if (testnetAltTry.success) {
          finalUseTestnet = true;
          effectiveMarket = altMarket;
          accountData = testnetAltTry;
          await kv.set('app_binance_use_testnet', 'true');
          await kv.set('app_binance_market_type', effectiveMarket);
          binanceWs.setMarketType(effectiveMarket);
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    if (!accountData.success) {
      let friendlyError = accountData.error || 'BINANCE CONNECTION ERROR: Failed to fetch account';
      if ((accountData as any).binanceCode === -2015) {
        friendlyError = finalUseTestnet
          ? `Invalid Testnet API Key or Secret for ${effectiveMarket} (${finalUseTestnet ? (effectiveMarket === 'SPOT' ? 'testnet.binance.vision' : 'testnet.binancefuture.com') : 'binance.com'}). Note: Spot Testnet keys are generated at testnet.binance.vision, while Futures Testnet keys are generated at testnet.binancefuture.com.`
          : `Invalid API Key, IP restriction, or permissions for ${effectiveMarket}.`;
      }
      return res.status(400).json({
        error: friendlyError,
        binanceCode: (accountData as any).binanceCode,
        latencyMs,
        marketType: effectiveMarket,
        useTestnet: finalUseTestnet,
        executionMode,
      });
    }

    let tradePermissionWarning = null;
    if (!accountData.canTrade) {
      tradePermissionWarning = effectiveMarket === 'FUTURES'
        ? 'Futures trading permission is disabled on this API Key. Please edit your API Key on Binance and check "Enable Futures".'
        : 'Spot trading permission is disabled on this API Key. Please edit your API Key on Binance and check "Enable Spot & Margin Trading".';
    }

    return res.json({
      ...accountData,
      tradePermissionWarning,
      useTestnet: finalUseTestnet,
      marketType: effectiveMarket,
      latencyMs,
      accountType: effectiveMarket,
    });
  } catch (error: any) {
    console.error('Binance Account Error:', error);
    return res.status(500).json({
      error: `BINANCE CONNECTION ERROR: ${error.message || 'Internal connection failure'}`,
      latencyMs: Date.now() - startTime,
    });
  }
}

/**
 * 1. Test Connection & Fetch Binance Account Balances (GET & POST)
 */
app.get('/api/server-ip', async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const ipRes = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeout);
    const data = await ipRes.json();
    return res.json({ ip: data.ip });
  } catch (err: any) {
    return res.json({ error: err.message || 'Unable to fetch public IP' });
  }
});

app.get('/api/binance/account', handleBinanceAccountFetch);
app.post('/api/binance/account', handleBinanceAccountFetch);

/**
 * Multi-Market Dedicated Wallets Summary Endpoint
 * Returns Spot Wallet, Futures Wallet, and Combined Global Portfolio metrics
 */
app.get('/api/wallet/summary', async (_req, res) => {
  try {
    const multiPortfolioStr = await kv.get('btc_multi_market_portfolio');
    const spotWalletStr = await kv.get('btc_paper_wallet_spot');
    const futuresWalletStr = await kv.get('btc_paper_wallet_futures');
    const activeWalletStr = await kv.get('btc_paper_wallet');
    const positionsStr = await kv.get('btc_active_bot_positions');
    const positions = positionsStr ? JSON.parse(positionsStr) : [];
    const executionMode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
    const activeMarketType = (await kv.get('app_binance_market_type')) || 'SPOT';

    let multiPortfolio = multiPortfolioStr ? JSON.parse(multiPortfolioStr) : null;
    let spotWallet = spotWalletStr ? JSON.parse(spotWalletStr) : null;
    let futuresWallet = futuresWalletStr ? JSON.parse(futuresWalletStr) : null;
    let activeWallet = activeWalletStr ? JSON.parse(activeWalletStr) : null;

    if (!multiPortfolio || !spotWallet || !futuresWallet) {
      const rec = await reconcilePaperWalletDirect();
      if (rec) {
        spotWallet = rec.spotWallet;
        futuresWallet = rec.futuresWallet;
        activeWallet = rec.activeWallet;
        multiPortfolio = {
          spot: spotWallet,
          futures: futuresWallet,
          combined: rec.combined,
          activeMarketType,
          executionMode,
          lastUpdated: Date.now(),
        };
      }
    }

    return res.json({
      success: true,
      multiPortfolio,
      spotWallet,
      futuresWallet,
      activeWallet,
      activeMarketType,
      executionMode,
      openPositionsCount: positions.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Dedicated Wallet Balance Updater & Reset
 * Allows modifying initial capital or resetting Spot or Futures independently
 */
app.post('/api/wallet/update', async (req, res) => {
  try {
    const { marketType, newBalance, resetHistory } = req.body;
    const targetMarket = marketType === 'SPOT' ? 'SPOT' : (marketType === 'FUTURES' ? 'FUTURES' : 'ALL');
    const numBalance = Number(newBalance);
    if (isNaN(numBalance) || numBalance < 10) {
      return res.status(400).json({ error: 'Valid balance required (minimum 10 USDT)' });
    }

    if (targetMarket === 'SPOT' || targetMarket === 'ALL') {
      await kv.set('paper_wallet_initial_deposit_spot', String(numBalance));
    }
    if (targetMarket === 'FUTURES' || targetMarket === 'ALL') {
      await kv.set('paper_wallet_initial_deposit_futures', String(numBalance));
    }
    await kv.set('paper_wallet_initial_deposit', String(numBalance));

    if (resetHistory) {
      const histStr = await kv.get('btc_trade_history');
      const history = histStr ? JSON.parse(histStr) : [];
      const filteredHist = targetMarket === 'ALL'
        ? []
        : history.filter((h: any) => (h.marketType || (h.leverage && h.leverage > 1 ? 'FUTURES' : 'SPOT')) !== targetMarket);
      await kv.set('btc_trade_history', JSON.stringify(filteredHist));

      const posStr = await kv.get('btc_active_bot_positions');
      const positions = posStr ? JSON.parse(posStr) : [];
      const filteredPos = targetMarket === 'ALL'
        ? positions.filter((p: any) => p.mode === 'BINANCE_LIVE')
        : positions.filter((p: any) => p.mode === 'BINANCE_LIVE' || (p.marketType || 'SPOT') !== targetMarket);
      await kv.set('btc_active_bot_positions', JSON.stringify(filteredPos));
    }

    const rec = await reconcilePaperWalletDirect();
    return res.json({
      success: true,
      spotWallet: rec?.spotWallet,
      futuresWallet: rec?.futuresWallet,
      combined: rec?.combined,
      activeWallet: rec?.activeWallet,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =====================================================
// QUANTURA RISK MANAGEMENT ENGINE REST API ENDPOINTS
// =====================================================

app.post('/api/risk/evaluate', async (req, res) => {
  try {
    const riskEngine = RiskEngine.getInstance();
    const proposal = req.body.proposal || req.body;
    
    // Fetch active positions for portfolio evaluation
    const positionsStr = await kv.get('btc_active_bot_positions');
    const existingPositions = positionsStr ? JSON.parse(positionsStr) : [];
    
    const result = await riskEngine.evaluateProposal(proposal, existingPositions);
    return res.json(result);
  } catch (error: any) {
    console.error('Risk Evaluation Error:', error);
    return res.status(500).json({ error: error.message || 'Risk engine evaluation failed' });
  }
});

app.get('/api/risk/config', async (req, res) => {
  try {
    const riskEngine = RiskEngine.getInstance();
    const config = riskEngine.getConfig();
    return res.json({
      ...config,
      maxDrawdownPercent: (config as any).maxDrawdownPercent ?? config.maxAccountDrawdownPercent,
      antiMartingaleEnabled: (config as any).antiMartingaleEnabled ?? true,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch risk config' });
  }
});

app.post('/api/risk/config', async (req, res) => {
  try {
    const riskEngine = RiskEngine.getInstance();
    const body = { ...req.body };
    if (body.maxDrawdownPercent !== undefined && body.maxAccountDrawdownPercent === undefined) {
      body.maxAccountDrawdownPercent = body.maxDrawdownPercent;
    }
    const updated = await riskEngine.updateConfig(body);
    return res.json({ 
      success: true, 
      config: {
        ...updated,
        maxDrawdownPercent: (updated as any).maxDrawdownPercent ?? updated.maxAccountDrawdownPercent,
        antiMartingaleEnabled: (updated as any).antiMartingaleEnabled ?? true,
      }
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to update risk config' });
  }
});

app.get('/api/risk/metrics', async (req, res) => {
  try {
    const riskEngine = RiskEngine.getInstance();
    let accountEquity = 10000;
    const walletStr = await kv.get('btc_paper_wallet');
    if (walletStr) {
      const parsed = JSON.parse(walletStr);
      if (parsed.balance) accountEquity = parsed.balance;
    }
    const positionsStr = await kv.get('btc_active_bot_positions');
    const existingPositions = positionsStr ? JSON.parse(positionsStr) : [];
    
    const metrics = await riskEngine.getMetrics(accountEquity, existingPositions);
    return res.json(metrics);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to calculate risk metrics' });
  }
});

app.post('/api/risk/emergency-stop', async (req, res) => {
  try {
    const { active, reason } = req.body;
    const riskEngine = RiskEngine.getInstance();
    const config = await riskEngine.setEmergencyStop(!!active, reason);
    return res.json({ success: true, emergencyStop: config.emergencyStop, status: config.riskLockStatus });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to toggle emergency stop' });
  }
});

app.post('/api/risk/unlock', async (req, res) => {
  try {
    const { manualAdminOverride = true } = req.body;
    const riskEngine = RiskEngine.getInstance();
    const config = await riskEngine.unlockRiskLock(manualAdminOverride);
    return res.json({ success: true, status: config.riskLockStatus });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to unlock risk lock' });
  }
});

app.post('/api/risk/reset-all', async (req, res) => {
  try {
    const { customEquity } = req.body || {};
    let equity = Number(customEquity);
    if (!equity || equity <= 0) {
      try {
        const walletStr = await kv.get('btc_paper_wallet');
        if (walletStr) {
          const parsed = JSON.parse(walletStr);
          if (typeof parsed.balance === 'number' && parsed.balance > 0) {
            equity = parsed.balance;
          }
        }
      } catch {}
    }
    const riskEngine = RiskEngine.getInstance();
    const result = await riskEngine.resetAllToZero(equity);
    return res.json({
      success: true,
      message: 'Risk lock, daily loss, drawdown, and loss streak successfully reset to ZERO',
      status: result.config.riskLockStatus,
      drawdownState: result.drawdownState,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to reset risk engine' });
  }
});

app.get('/api/risk/audit-logs', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const symbol = req.query.symbol as string;
    const decision = req.query.decision as 'APPROVED' | 'REJECTED';
    
    const logs = AuditTrail.getLogs({ limit, offset, symbol, decision });
    const stats = AuditTrail.getStats();
    return res.json({ logs, stats });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch risk audit logs' });
  }
});

app.delete('/api/risk/audit-logs', async (req, res) => {
  try {
    await AuditTrail.clear();
    return res.json({ success: true, message: 'All risk audit logs successfully wiped and reset to zero.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to clear risk audit logs' });
  }
});

app.post('/api/risk/record-outcome', async (req, res) => {
  try {
    const { pnlUsdt, feeUsdt, symbol, strategyName, durationMs } = req.body;
    const riskEngine = RiskEngine.getInstance();
    const updatedState = riskEngine.recordTradeClosed(Number(pnlUsdt) || 0, Number(feeUsdt) || 0, {
      symbol,
      strategyName,
      durationMs,
    });
    return res.json({ success: true, drawdownState: updatedState });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to record trade outcome' });
  }
});

/**
 * 2. Execute Real Spot/Futures Order on Binance (Protected by Risk Management Engine)
 */
app.post('/api/binance/order', async (req, res) => {
  try {
    const { apiKey, apiSecret, useTestnet, marketType } = await resolveBinanceAuth(req);

    if (!apiKey || !apiSecret) {
      return res.status(400).json({
        error: 'Missing Binance API Credentials.',
        code: 'MISSING_CREDENTIALS',
      });
    }

    const { symbol, side, type = 'MARKET', quantity, quoteOrderQty, price, timeInForce } = req.body;

    if (!symbol || !side) {
      return res.status(400).json({ error: 'Symbol and Side are required.' });
    }

    const normSymbol = symbol.toUpperCase();
    const normSide = side.toUpperCase();
    const normType = type.toUpperCase();

    const rawMode = (req.body.executionMode as string) || (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
    const executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE' =
      rawMode === 'BINANCE_LIVE' ? 'BINANCE_LIVE' : (rawMode === 'BINANCE_TESTNET' ? 'BINANCE_TESTNET' : 'PAPER');

    const isManual = req.body.isManual ?? true;
    const isReduceOnly = Boolean(req.body.reduceOnly);

    // =============================================================
    // AUTHORITATIVE ORDER SUBMISSION GUARD
    // =============================================================
    const guardResult = await canSubmitOrder({
      isManual,
      isReduceOnly,
      symbol: normSymbol,
      side: normSide,
      marketType: (marketType || 'SPOT') as 'SPOT' | 'FUTURES',
      executionMode,
      clientOrderId: req.body.clientOrderId,
    });

    if (!guardResult.allowed) {
      return res.status(403).json({
        error: `Order rejected by execution guard: ${guardResult.reason}`,
        code: guardResult.code || 'ORDER_GUARD_REJECT',
      });
    }

    // -------------------------------------------------------------
    // QUANTURA RISK MANAGEMENT ENGINE EVALUATION (MANDATORY GATEWAY)
    // -------------------------------------------------------------
    const riskEngine = RiskEngine.getInstance();
    
    const positionsStr = await kv.get('btc_active_bot_positions');
    const existingPositions = positionsStr ? JSON.parse(positionsStr) : [];
    
    let accountEquity = 10000;
    if (executionMode === 'PAPER') {
      const walletKey = marketType === 'SPOT' ? 'btc_paper_wallet_spot' : 'btc_paper_wallet_futures';
      const walletStr = (await kv.get(walletKey)) || (await kv.get('btc_paper_wallet'));
      if (walletStr) {
        const parsedWallet = JSON.parse(walletStr);
        if (parsedWallet.balance) accountEquity = parsedWallet.balance;
      }
    } else {
      const realAcc = await fetchAuthoritativeAccount((marketType || 'SPOT') as 'SPOT' | 'FUTURES', executionMode, { apiKey, apiSecret, useTestnet });
      if (realAcc.success) {
        accountEquity = realAcc.totalEquity || realAcc.freeUsdt || 10000;
      }
    }

    const currentTicker = await fetchBinanceTicker(normSymbol, marketType);
    const entryPrice = Number(price) || currentTicker.price || 1;
    
    const proposedSide = (normSide === 'BUY' ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT';
    const stopLoss = Number(req.body.stopLoss) || (proposedSide === 'LONG' ? entryPrice * 0.98 : entryPrice * 1.02);
    const tp1 = Number(req.body.tp1) || (proposedSide === 'LONG' ? entryPrice * 1.05 : entryPrice * 0.95);

    const riskProposal = {
      clientOrderId: req.body.clientOrderId || `order-${Date.now()}`,
      symbol: normSymbol,
      side: proposedSide,
      entryPrice,
      stopLoss,
      takeProfit: { tp1, tp2: req.body.tp2, tp3: req.body.tp3 },
      marketType: (marketType || 'SPOT') as 'SPOT' | 'FUTURES',
      leverage: Number(req.body.leverage) || 1,
      accountEquity,
      availableBalance: accountEquity,
      quantity: Number(quantity) || (quoteOrderQty ? quoteOrderQty / entryPrice : undefined),
      orderType: normType as 'MARKET' | 'LIMIT',
      timestamp: Date.now(),
      marketData: {
        currentPrice: entryPrice,
        bidPrice: entryPrice * 0.9998,
        askPrice: entryPrice * 1.0002,
        volume24hUsdt: currentTicker.quoteVolume24h || 10000000,
        timestamp: Date.now(),
      },
    };

    const riskEvaluation = await riskEngine.evaluateProposal(riskProposal, existingPositions);

    if (riskEvaluation.decision === 'REJECTED') {
      return res.status(403).json({
        error: `Trade rejected by Quantura Risk Management Engine: ${riskEvaluation.message}`,
        rejected: true,
        reasonCode: riskEvaluation.reasonCode,
        message: riskEvaluation.message,
        auditId: riskEvaluation.auditId,
        riskScore: riskEvaluation.riskScore,
        riskLevel: riskEvaluation.riskLevel,
        result: riskEvaluation,
      });
    }

    // Use safe clamped quantity and leverage approved by Risk Management Engine
    const finalQuantity = riskEvaluation.approvedQuantity > 0 ? riskEvaluation.approvedQuantity : Number(quantity);

    const params: Record<string, string> = {
      symbol: normSymbol,
      side: normSide,
      type: normType,
      timestamp: Date.now().toString(),
      recvWindow: '10000',
    };

    if (normType === 'MARKET') {
      if (marketType === 'FUTURES') {
        if (finalQuantity && finalQuantity > 0) {
          params.quantity = Number(finalQuantity).toString();
        } else {
          return res.status(400).json({ error: 'Futures market orders require a specific coin quantity (quantity).' });
        }
      } else {
        // SPOT
        if (quoteOrderQty && quoteOrderQty > 0 && !quantity) {
          params.quoteOrderQty = Number(quoteOrderQty).toFixed(2);
        } else if (finalQuantity && finalQuantity > 0) {
          params.quantity = Number(finalQuantity).toString();
        } else {
          return res.status(400).json({ error: 'Either quantity or quoteOrderQty (USDT amount) must be provided for SPOT MARKET orders.' });
        }
      }
    } else if (normType === 'LIMIT') {
      if (!price || !finalQuantity) {
        return res.status(400).json({ error: 'Price and Quantity are required for LIMIT orders.' });
      }
      params.price = Number(price).toString();
      params.quantity = Number(finalQuantity).toString();
      params.timeInForce = timeInForce || 'GTC';
    }

    const { fullQuery } = createBinanceSignedQuery(params, apiSecret);
    
    let orderUrl = '';
    if (marketType === 'FUTURES') {
      const baseUrl = getAuthoritativeBinanceFuturesApiBase(useTestnet);
      orderUrl = `${baseUrl}/fapi/v1/order?${fullQuery}`;
    } else {
      const baseUrl = getAuthoritativeBinanceApiBase(useTestnet);
      orderUrl = `${baseUrl}/api/v3/order?${fullQuery}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(orderUrl, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json();

    logBinanceApiCall({
      timestamp: Date.now(),
      marketType: (marketType || 'SPOT') as 'SPOT' | 'FUTURES',
      executionMode,
      symbol: normSymbol,
      endpoint: marketType === 'FUTURES' ? '/fapi/v1/order' : '/api/v3/order',
      orderId: data?.orderId,
      clientOrderId: data?.clientOrderId || req.body.clientOrderId,
      httpStatus: response.status,
      binanceCode: data?.code,
      binanceMessage: data?.msg,
      error: !response.ok ? (data?.msg || `HTTP ${response.status}`) : undefined,
    });

    if (!response.ok) {
      let userFriendlyHint = '';
      if (data.code === -2010) {
        userFriendlyHint = 'Insufficient balance in Binance account for this trade.';
      } else if (data.code === -1013) {
        userFriendlyHint = 'Order size is too small (Binance minimum order is typically ~$10 USD).';
      } else if (data.code === -2015) {
        userFriendlyHint = 'Invalid API-key, IP address restriction mismatch, or permission not enabled.';
      } else if (data.code === -1021) {
        userFriendlyHint = 'Timestamp out of sync. Please check your system clock.';
      }

      return res.status(response.status).json({
        error: data.msg || 'Binance order execution failed',
        binanceCode: data.code,
        hint: userFriendlyHint,
      });
    }

    // Schedule background reconciliation to immediately sync with live position
    reconcilePositionsWithBinance().catch(() => {});

    return res.json({
      success: true,
      order: data,
      orderId: data.orderId || data.clientOrderId,
      riskEvaluation,
    });
  } catch (error: any) {
    console.error('Binance Order Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to place Binance order.' });
  }
});

/**
 * 3. Fetch Open Orders
 */
app.get('/api/binance/open-orders', async (req, res) => {
  try {
    const { apiKey, apiSecret, useTestnet, marketType } = await resolveBinanceAuth(req);
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'Missing API Credentials' });
    }

    const symbol = (req.query.symbol as string)?.toUpperCase();
    const params: Record<string, string> = {};
    if (symbol) params.symbol = symbol;

    const { fullQuery } = createBinanceSignedQuery(params, apiSecret);
    const isFutures = marketType === 'FUTURES';
    const baseUrl = isFutures ? getBinanceFuturesApiBase(useTestnet) : getBinanceApiBase(useTestnet);
    const endpoint = isFutures ? '/fapi/v1/openOrders' : '/api/v3/openOrders';
    
    const response = await fetch(`${baseUrl}${endpoint}?${fullQuery}`, {
      headers: { 'X-MBX-APIKEY': apiKey, 'Accept': 'application/json' },
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.msg });
    }

    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 4. Cancel Open Order
 */
app.post('/api/binance/cancel-order', async (req, res) => {
  try {
    const { apiKey, apiSecret, useTestnet, marketType } = await resolveBinanceAuth(req);
    const { symbol, orderId } = req.body;

    if (!apiKey || !apiSecret || !symbol || !orderId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const { fullQuery } = createBinanceSignedQuery({ symbol: symbol.toUpperCase(), orderId }, apiSecret);
    const isFutures = marketType === 'FUTURES';
    const baseUrl = isFutures ? getBinanceFuturesApiBase(useTestnet) : getBinanceApiBase(useTestnet);
    const endpoint = isFutures ? '/fapi/v1/order' : '/api/v3/order';

    const response = await fetch(`${baseUrl}${endpoint}?${fullQuery}`, {
      method: 'DELETE',
      headers: { 'X-MBX-APIKEY': apiKey, 'Accept': 'application/json' },
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.msg });
    }

    return res.json({ success: true, canceled: data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 5. Futures Position Risk & Live Positions on Binance (Authoritative Reconciled Source)
 */
app.get('/api/binance/futures/positions', async (req, res) => {
  try {
    const { apiKey, apiSecret, useTestnet } = await resolveBinanceAuth(req);
    const rawMode = (req.query.executionMode as string) || (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
    const executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE' =
      rawMode === 'BINANCE_LIVE' ? 'BINANCE_LIVE' : (rawMode === 'BINANCE_TESTNET' ? 'BINANCE_TESTNET' : 'PAPER');

    if (executionMode === 'PAPER' || !apiKey || !apiSecret) {
      return res.json({
        success: true,
        activePositionsCount: 0,
        positions: [],
        allPositions: [],
        executionMode,
      });
    }

    const { fullQuery } = createBinanceSignedQuery({}, apiSecret);
    const baseUrl = getBinanceFuturesApiBase(useTestnet);

    const posRes = await fetch(`${baseUrl}/fapi/v2/positionRisk?${fullQuery}`, {
      headers: { 'X-MBX-APIKEY': apiKey, 'Accept': 'application/json' },
    });
    const posData = await posRes.json().catch(() => []);
    if (!posRes.ok || !Array.isArray(posData)) {
      return res.json({
        success: false,
        activePositionsCount: 0,
        positions: [],
        allPositions: [],
        error: posData?.msg || 'Failed to fetch Futures positions',
      });
    }

    const activePositions = posData.filter((p: any) => p && parseFloat(p.positionAmt || '0') !== 0);

    return res.json({
      success: true,
      activePositionsCount: activePositions.length,
      positions: activePositions,
      allPositions: posData,
      executionMode,
    });
  } catch (error: any) {
    console.error('[BINANCE FUTURES POSITIONS ERROR]', error);
    return res.json({ success: true, activePositionsCount: 0, positions: [], allPositions: [], error: error.message });
  }
});

app.get('/api/binance/spot/positions', async (req, res) => {
  try {
    const rawMode = (req.query.executionMode as string) || (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
    const executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE' =
      rawMode === 'BINANCE_LIVE' ? 'BINANCE_LIVE' : (rawMode === 'BINANCE_TESTNET' ? 'BINANCE_TESTNET' : 'PAPER');

    if (executionMode !== 'PAPER') {
      await reconcilePositionsWithBinance();
    }

    const posStr = await kv.get('btc_active_bot_positions');
    const allPositions: any[] = posStr ? JSON.parse(posStr) : [];
    const spotPositions = allPositions.filter(p => (p.marketType || 'SPOT') === 'SPOT' && (p.mode || 'PAPER') === executionMode);
    const status = getReconciliationStatus();

    return res.json({
      success: true,
      positions: spotPositions,
      syncing: status.isSyncing,
      lastSyncTime: status.lastSyncTime,
      executionMode,
    });
  } catch (error: any) {
    console.error('[BINANCE SPOT POSITIONS ERROR]', error);
    return res.json({ success: true, positions: [], error: error.message });
  }
});

/**
 * Authoritative Unified Positions Endpoint
 */
app.get('/api/binance/positions', async (req, res) => {
  try {
    const rawMode = (req.query.executionMode as string) || (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
    const executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE' =
      rawMode === 'BINANCE_LIVE' ? 'BINANCE_LIVE' : (rawMode === 'BINANCE_TESTNET' ? 'BINANCE_TESTNET' : 'PAPER');
    const marketType = ((req.query.marketType as string) || (await kv.get('app_binance_market_type')) || 'SPOT').toUpperCase() as 'SPOT' | 'FUTURES';

    if (executionMode !== 'PAPER') {
      await reconcilePositionsWithBinance();
    }

    const posStr = await kv.get('btc_active_bot_positions');
    const allPositions: any[] = posStr ? JSON.parse(posStr) : [];
    const filtered = allPositions.filter(p => (p.marketType || 'SPOT') === marketType && (p.mode || 'PAPER') === executionMode);
    const status = getReconciliationStatus();

    return res.json({
      success: true,
      marketType,
      executionMode,
      activePositionsCount: filtered.length,
      positions: filtered,
      openOrdersCount: status.openOrdersCount,
      isSyncing: status.isSyncing,
      lastSyncTime: status.lastSyncTime,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger Authoritative Position & Account Reconciliation
 */
app.post('/api/binance/reconcile', async (req, res) => {
  try {
    const result = await reconcilePositionsWithBinance();
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/binance/reconcile/status', async (_req, res) => {
  return res.json(getReconciliationStatus());
});

app.get('/api/binance/logs', async (_req, res) => {
  return res.json({ logs: getBinanceApiLogs() });
});

/**
 * Authoritative Bot State & Control Endpoints
 */
app.get('/api/bot/status', async (_req, res) => {
  try {
    const state = await getAuthoritativeBotState();
    const reconStatus = getReconciliationStatus();
    return res.json({
      success: true,
      ...state,
      syncing: reconStatus.isSyncing,
      lastSyncTime: reconStatus.lastSyncTime,
      openOrdersCount: reconStatus.openOrdersCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/bot/state', async (_req, res) => {
  try {
    const state = await getAuthoritativeBotState();
    return res.json(state);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/bot/start', async (_req, res) => {
  try {
    const state = await startBotAuthoritative();
    startBotEngine();
    return res.json({ success: true, state });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/bot/stop', async (req, res) => {
  try {
    const reason = req.body?.reason || 'User clicked stop';
    const state = await stopBotAuthoritative(reason);
    stopBotEngine();
    return res.json({ success: true, state });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 6. Futures Test Order (Dry-Run: tests API key, HMAC signature, Futures permissions & lot size without risking funds)
 */
app.post('/api/binance/futures/test-order', async (req, res) => {
  try {
    const { apiKey, apiSecret, useTestnet } = await resolveBinanceAuth(req);
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'Missing Binance API Credentials', code: 'MISSING_CREDENTIALS' });
    }

    const { symbol = 'BTCUSDT', side = 'BUY', quantity = '0.002', type = 'MARKET' } = req.body;
    const params: Record<string, string> = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: type.toUpperCase(),
      quantity: String(quantity),
    };

    const { fullQuery } = createBinanceSignedQuery(params, apiSecret);
    const baseUrl = getBinanceFuturesApiBase(useTestnet);

    // Binance Futures order test endpoint validates syntax and permissions without creating order
    const response = await fetch(`${baseUrl}/fapi/v1/order/test?${fullQuery}`, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Accept': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: (data as any).msg || 'Binance Futures test order failed',
        binanceCode: (data as any).code,
        testedParams: params,
      });
    }

    return res.json({
      success: true,
      message: '✅ Binance Futures API Credentials & Order Signature Verified Successfully! (Test Dry-Run passed)',
      testedParams: params,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 7. Futures Set Leverage
 */
app.post('/api/binance/futures/leverage', async (req, res) => {
  try {
    const { apiKey, apiSecret, useTestnet } = await resolveBinanceAuth(req);
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'Missing Binance API Credentials' });
    }

    const { symbol = 'BTCUSDT', leverage = 5 } = req.body;
    const timestamp = Date.now();
    const params: Record<string, string> = {
      symbol: symbol.toUpperCase(),
      leverage: String(leverage),
      timestamp: timestamp.toString(),
      recvWindow: '10000',
    };

    const queryString = new URLSearchParams(params).toString();
    const signature = createBinanceSignature(queryString, apiSecret);
    const baseUrl = getBinanceFuturesApiBase(useTestnet);

    const response = await fetch(`${baseUrl}/fapi/v1/leverage?${queryString}&signature=${signature}`, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.msg || 'Failed to adjust leverage', data });
    }

    return res.json({ success: true, symbol, leverage: data.leverage, maxNotionalValue: data.maxNotionalValue });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// VITE / STATIC PRODUCTION SERVER
// -------------------------------------------------------------
let viteHandler: express.Handler | null = null;

// Dynamic frontend middleware handler to serve requests immediately while Vite prepares
app.use((req, res, next) => {
  if (viteHandler) {
    return viteHandler(req, res, next);
  }
  if (req.path === '/api/health') {
    return res.json({ status: 'ok', timestamp: Date.now() });
  }
  if (!req.path.startsWith('/api/')) {
    return res.send(`<!doctype html><html><head><meta http-equiv="refresh" content="1"><title>Quantura</title></head><body style="background:#020617;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,-apple-system,sans-serif;"><div style="text-align:center;"><div style="font-size:18px;font-weight:600;color:#38bdf8;margin-bottom:8px;">Quantura Terminal</div><div style="font-size:13px;">Starting development runtime...</div></div></body></html>`);
  }
  next();
});

// Bind port 3000 immediately to eliminate cold-start timeouts and container ingress delays
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening immediately on http://0.0.0.0:${PORT}`);
});

server.on('error', (err: any) => {
  console.error('Server listen error:', err);
});

async function initFrontendAndServices() {
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isProd = process.env.NODE_ENV === 'production' || (process.env.NODE_ENV !== 'development' && hasDist);

  if (!isProd) {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: {
          middlewareMode: true,
          watch: {
            ignored: [
              '**/data/**',
              '**/*.sqlite*',
              '**/*.sqlite-wal',
              '**/*.sqlite-shm',
              '**/data/bot_database*',
              '**/local_kv_cache.json',
              '**/*.json',
            ],
          },
        },
        appType: 'spa',
      });
      viteHandler = vite.middlewares;
      console.log('Vite middleware ready on port 3000');
    } catch (err) {
      console.error('Failed to create Vite server:', err);
    }
  } else {
    console.log(`Serving production frontend from ${distPath}`);
    const staticMiddleware = express.static(distPath, {
      index: false,
      maxAge: '1d',
    });

    viteHandler = (req, res, next) => {
      // 1. Try serving static assets (js, css, images, etc.)
      staticMiddleware(req, res, (err) => {
        if (err) return next(err);
        // 2. If it's a GET request and not an API call, serve SPA index.html
        if (req.method === 'GET' && !req.path.startsWith('/api/')) {
          const indexPath = path.join(distPath, 'index.html');
          if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
          }
        }
        next();
      });
    };
  }

  // Initialize SQLite Database, Strategy Manager & background engines safely
  try {
    initDb();
    const kvMt = await kv.get('app_binance_market_type');
    const botCfgStr = await kv.get('btc_bot_config');
    let initialMt: 'SPOT' | 'FUTURES' = 'SPOT';
    if (kvMt === 'SPOT' || kvMt === 'FUTURES') {
      initialMt = kvMt as any;
    } else if (botCfgStr) {
      try {
        const parsed = JSON.parse(botCfgStr);
        if (parsed.marketType === 'SPOT' || parsed.marketType === 'FUTURES') {
          initialMt = parsed.marketType;
        }
      } catch (_) {}
    } else {
      initialMt = ((process.env.BINANCE_MARKET_TYPE || process.env.MARKET_TYPE || 'SPOT').toUpperCase() === 'FUTURES' ? 'FUTURES' : 'SPOT');
    }
    binanceWs.start(initialMt);
    await strategyManager.init();
    setMarketDataProvider(getMarketDataDirect);

    // 10. STARTUP RECONCILIATION
    // START -> CONNECT BINANCE -> FETCH ACCOUNT -> FETCH OPEN ORDERS -> FETCH OPEN POSITIONS -> RECONCILE LOCAL STATE -> UPDATE DATABASE/KV
    await runStartupReconciliation();

    // START BOT ENGINE ONLY IF BOT IS ENABLED
    // If the bot was OFF before restart, it must remain OFF.
    const authoritativeState = await getAuthoritativeBotState();
    if (authoritativeState.enabled && authoritativeState.status === 'RUNNING') {
      console.log('🤖 [STARTUP] Bot was previously ENABLED. Resuming Bot Engine & Market Scanner.');
      startBotEngine();
      startMarketScanner();
    } else {
      console.log('🛑 [STARTUP] Bot is currently DISABLED/STOPPED. Order generation loops remain OFF.');
      // Position monitoring loop ensures SL/TP safety for existing positions without generating new orders
      startBotEngine();
      stopMarketScanner();
    }
    startTelegramSync();
  } catch (err) {
    console.error('Warning: Background engine initialization error:', err);
  }
}

initFrontendAndServices();

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});
