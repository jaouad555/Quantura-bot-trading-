import { kv } from './db';
import { RiskEngine } from './riskEngine/RiskEngine';
import { RoeEngine, DEFAULT_ROE_CONFIG } from './roeEngine';

let engineInterval: NodeJS.Timeout | null = null;
let telegramInterval: NodeJS.Timeout | null = null;

// Reliable fallback prices for major assets
const FALLBACK_PRICES: Record<string, number> = {
  BTCUSDT: 83500,
  ETHUSDT: 3100,
  SOLUSDT: 135,
  BNBUSDT: 620,
  XRPUSDT: 2.30,
  DOGEUSDT: 0.18,
  ADAUSDT: 0.72,
  AVAXUSDT: 24.5,
  LINKUSDT: 14.8,
  SUIUSDT: 2.45,
  NEARUSDT: 4.8,
  DOTUSDT: 4.6,
  PEPEUSDT: 0.00001,
  SHIBUSDT: 0.000014,
  LTCUSDT: 98,
  TRXUSDT: 0.22,
  UNIUSDT: 8.2,
  ATOMUSDT: 4.5,
  ARBUSDT: 0.52,
  OPUSDT: 1.25,
  APTUSDT: 7.8,
  INJUSDT: 16.5,
  RENDERUSDT: 5.1,
  FTMUSDT: 0.58,
  TIAUSDT: 4.2,
  SEIUSDT: 0.28,
  WIFUSDT: 1.15,
  FETUSDT: 0.85,
  AAVEUSDT: 195,
  MKRUSDT: 1450,
  CRVUSDT: 0.35,
};

const priceCache = new Map<string, { price: number; timestamp: number }>();

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Cache-Control': 'no-cache',
};

/**
 * Resilient live price fetcher with multi-endpoint failover and in-memory cache
 */
export const fetchSymbolPrice = async (rawSymbol: string, marketType: 'SPOT' | 'FUTURES' = 'FUTURES'): Promise<number> => {
  const symbol = (rawSymbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BTCUSDT';
  const now = Date.now();
  const cacheKey = `${marketType}_${symbol}`;
  const cached = priceCache.get(cacheKey);
  
  // Return cached price if fresh (less than 3 seconds old)
  if (cached && now - cached.timestamp < 3000) {
    return cached.price;
  }

  const futuresEndpoints = [
    `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
    `https://fapi1.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
    `https://fapi2.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
    `https://fapi3.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
    `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`,
  ];

  const spotEndpoints = [
    `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://api1.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`,
    `https://api2.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
  ];

  const endpoints = marketType === 'FUTURES' ? [...futuresEndpoints, ...spotEndpoints] : spotEndpoints;

  for (const url of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(url, { headers: HTTP_HEADERS, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data: any = await res.json();
        const priceStr = data?.price || data?.lastPrice;
        if (priceStr) {
          const p = parseFloat(priceStr);
          if (!isNaN(p) && p > 0) {
            priceCache.set(cacheKey, { price: p, timestamp: now });
            return p;
          }
        }
      }
    } catch {
      clearTimeout(timeout);
    }
  }

  // Fallback to recent cache if available
  if (cached && cached.price > 0) {
    return cached.price;
  }

  // Check Spot cache as failover for Futures
  const spotCache = priceCache.get(`SPOT_${symbol}`);
  if (spotCache && spotCache.price > 0) {
    return spotCache.price;
  }

  // Fallback to accurate baseline prices
  const fallback = FALLBACK_PRICES[symbol] || 25.0;
  priceCache.set(cacheKey, { price: fallback, timestamp: now });
  return fallback;
};

// Helper to calculate PnL
const calculatePnl = (pos: any, exitPrice: number) => {
  const isLong = pos.decision === 'LONG';
  const lev = pos.leverage || 1;
  const priceDiffPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1);
  return pos.remainingAmountUsdt * priceDiffPct * lev;
};

export const startTelegramSync = () => {
  if (telegramInterval) clearInterval(telegramInterval);

  telegramInterval = setInterval(async () => {
    try {
      const token = await kv.get('app_telegram_bot_token');
      const chatId = await kv.get('app_telegram_chat_id');
      
      if (!token || !chatId) return;

      const positionsStr = await kv.get('btc_active_bot_positions');
      const positions = positionsStr ? JSON.parse(positionsStr) : [];
      
      const walletStr = await kv.get('btc_paper_wallet');
      const wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000, realizedPnl: 0 };

      let unrealizedPnl = 0;

      if (positions.length > 0) {
        const uniqueKeys: string[] = Array.from(new Set(positions.map((p: any) => `${(p.marketType || 'FUTURES')}_${String(p.symbol || 'BTCUSDT')}`)));
        const prices: Record<string, number> = {};
        
        const priceResults = await Promise.allSettled(uniqueKeys.map((k: string) => {
          const [mt, sym] = k.split('_');
          return fetchSymbolPrice(sym, mt as 'SPOT' | 'FUTURES');
        }));
        uniqueKeys.forEach((k: string, idx: number) => {
          const res = priceResults[idx];
          const [_, sym] = k.split('_');
          if (res.status === 'fulfilled' && (res.value as number) > 0) {
            prices[k] = res.value as number;
          } else {
            prices[k] = FALLBACK_PRICES[sym] || 50.0;
          }
        });
        
        for (const pos of positions) {
          const pKey = `${pos.marketType || 'FUTURES'}_${pos.symbol}`;
          const currentP = prices[pKey];
          if (currentP) {
            unrealizedPnl += calculatePnl(pos, currentP);
          }
        }
      }

      const totalPnl = wallet.realizedPnl + unrealizedPnl;
      const balance = wallet.balance + unrealizedPnl;

      const message = `🤖 *Bot Health Sync*\n\n` +
                      `📊 *Active Positions:* ${positions.length}\n` +
                      `💵 *Realized PnL:* $${wallet.realizedPnl.toFixed(2)}\n` +
                      `📈 *Unrealized PnL:* $${unrealizedPnl.toFixed(2)}\n` +
                      `💰 *Total PnL:* $${totalPnl.toFixed(2)}\n` +
                      `🏦 *Est. Portfolio Value:* $${balance.toFixed(2)}`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });

    } catch (error) {
      console.error('Telegram Sync Error:', error);
    }
  }, 60000); // 1 minute interval

  console.log('📢 Telegram Periodic Sync Started!');
};

/**
 * Instant Telegram Notification Helper for Trade Events
 */
export const sendServerTelegramNotification = async (text: string) => {
  try {
    const token = await kv.get('app_telegram_bot_token');
    const chatId = await kv.get('app_telegram_chat_id');
    if (!token || !chatId || !text) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
      signal: controller.signal,
    }).catch(() => {});
    clearTimeout(timeout);
  } catch (err) {
    // Non-blocking
  }
};


// SECURE BINANCE CONFIGURATION & ENCRYPTION
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_quantura_2026';
const IV_LENGTH = 16;

function decryptSecret(text: string): string {
  if (!text) return text;
  try {
    const textParts = text.split(':');
    if (textParts.length !== 2) return text;
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substring(0, 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text;
  }
}

function getEnvBinanceCredentials() {
  const apiKey = (
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

  const apiSecret = (
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

// Add helper to fetch binance config from KV or process.env
const getBinanceConfig = async () => {
  const envCreds = getEnvBinanceCredentials();

  const storedStr = await kv.get('binance_api_config');
  if (storedStr) {
    try {
      const parsed = JSON.parse(storedStr);
      const effectiveKey = (parsed.apiKey || envCreds.apiKey || '').trim();
      const effectiveSecret = (decryptSecret(parsed.apiSecret) || envCreds.apiSecret || '').trim();
      if (effectiveKey && effectiveSecret) {
        return {
          apiKey: effectiveKey,
          apiSecret: effectiveSecret,
          useTestnet: parsed.useTestnet !== undefined ? parsed.useTestnet : envCreds.useTestnet,
          marketType: (parsed.marketType || envCreds.marketType) as 'SPOT' | 'FUTURES',
          isConnected: true,
        };
      }
    } catch(e) {}
  }

  const legacyApiKey = (await kv.get('app_binance_api_key') || '').trim();
  const legacyApiSecret = (await kv.get('app_binance_api_secret') || '').trim();
  if (legacyApiKey && legacyApiSecret) {
    const useTestnet = (await kv.get('app_binance_use_testnet')) === 'true';
    const marketType = ((await kv.get('app_binance_market_type')) || 'SPOT') as 'SPOT' | 'FUTURES';
    return { apiKey: legacyApiKey, apiSecret: legacyApiSecret, useTestnet, marketType, isConnected: true };
  }

  if (envCreds.apiKey && envCreds.apiSecret) {
    return {
      apiKey: envCreds.apiKey,
      apiSecret: envCreds.apiSecret,
      useTestnet: envCreds.useTestnet,
      marketType: envCreds.marketType,
      isConnected: true,
    };
  }

  return { apiKey: '', apiSecret: '', useTestnet: false, marketType: 'SPOT', isConnected: false };
};


import crypto from 'crypto';

// Binance Utilities
const getBinanceApiBase = (useTestnet: boolean) => useTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
const getBinanceFuturesApiBase = (useTestnet: boolean) => useTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';

const createBinanceSignature = (queryString: string, apiSecret: string) => {
  return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
};

export interface RealBinanceAccountInfo {
  success: boolean;
  canTrade: boolean;
  freeUsdt: number;
  totalUsdtEquity: number;
  marketType: 'SPOT' | 'FUTURES';
  error?: string;
  binanceCode?: number;
}

/**
 * Direct real Binance account state query for backend risk validation and execution sizing.
 */
export const fetchRealBinanceAccountDirect = async (): Promise<RealBinanceAccountInfo> => {
  const config = await getBinanceConfig();
  const effectiveMarketType: 'SPOT' | 'FUTURES' = config.marketType === 'SPOT' ? 'SPOT' : 'FUTURES';
  if (!config.isConnected || !config.apiKey || !config.apiSecret) {
    return {
      success: false,
      canTrade: false,
      freeUsdt: 0,
      totalUsdtEquity: 0,
      marketType: effectiveMarketType,
      error: 'Binance credentials not configured or incomplete.',
    };
  }

  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}&recvWindow=10000`;
  const signature = createBinanceSignature(queryString, config.apiSecret);
  const isFutures = effectiveMarketType === 'FUTURES';
  const baseUrl = isFutures ? getBinanceFuturesApiBase(config.useTestnet) : getBinanceApiBase(config.useTestnet);
  const url = isFutures
    ? `${baseUrl}/fapi/v2/account?${queryString}&signature=${signature}`
    : `${baseUrl}/api/v3/account?${queryString}&signature=${signature}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': config.apiKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        canTrade: false,
        freeUsdt: 0,
        totalUsdtEquity: 0,
        marketType: effectiveMarketType,
        error: data.msg || 'Binance API request rejected',
        binanceCode: data.code,
      };
    }

    let canTrade = data.canTrade ?? true;
    let freeUsdt = 0;
    let totalUsdtEquity = 0;

    if (isFutures) {
      const usdtAsset = (data.assets || []).find((a: any) => a.asset === 'USDT');
      const usdcAsset = (data.assets || []).find((a: any) => a.asset === 'USDC');
      const totalMargin = parseFloat(data.totalMarginBalance || data.totalWalletBalance || '0') || 0;
      const availMargin = parseFloat(data.availableBalance || '0') || 0;
      const usdtFree = parseFloat(usdtAsset?.availableBalance || '0') || 0;
      const usdcFree = parseFloat(usdcAsset?.availableBalance || '0') || 0;
      freeUsdt = availMargin > 0 ? availMargin : (usdtFree + usdcFree);
      totalUsdtEquity = totalMargin > 0 ? totalMargin : (usdtAsset ? parseFloat(usdtAsset.walletBalance || '0') : freeUsdt);
    } else {
      const balances = data.balances || [];
      const usdt = balances.find((b: any) => b.asset === 'USDT');
      const usdc = balances.find((b: any) => b.asset === 'USDC');
      const fdusd = balances.find((b: any) => b.asset === 'FDUSD');
      freeUsdt = (parseFloat(usdt?.free || '0') || 0) + (parseFloat(usdc?.free || '0') || 0) + (parseFloat(fdusd?.free || '0') || 0);
      totalUsdtEquity = freeUsdt + (parseFloat(usdt?.locked || '0') || 0) + (parseFloat(usdc?.locked || '0') || 0) + (parseFloat(fdusd?.locked || '0') || 0);
    }

    return {
      success: true,
      canTrade,
      freeUsdt: Math.round(freeUsdt * 100) / 100,
      totalUsdtEquity: Math.round(totalUsdtEquity * 100) / 100,
      marketType: effectiveMarketType,
    };
  } catch (err: any) {
    return {
      success: false,
      canTrade: false,
      freeUsdt: 0,
      totalUsdtEquity: 0,
      marketType: effectiveMarketType,
      error: err.message || 'Network timeout contacting Binance',
    };
  }
};

// Simulate or real execute order
export const serverExecuteOrder = async (symbol: string, side: string, quoteOrderQty: number, quantity: number, currentPrice: number) => {
    const config = await getBinanceConfig();
    if (!config.isConnected) {
      return { success: false, error: 'Not connected' };
    }
    
    console.log(`[SERVER-SIDE EXECUTE] ${side} ${symbol} Qty: ${quantity} Price: ${currentPrice}`);
    
    try {
        let formattedQty = quantity;
        if (quantity && currentPrice) {
          if (currentPrice > 1000) formattedQty = Number(quantity.toFixed(3)); // BTC, ETH
          else if (currentPrice > 10) formattedQty = Number(quantity.toFixed(1)); // SOL, BNB
          else if (currentPrice > 1) formattedQty = Math.floor(quantity); // low price coins
          else formattedQty = Math.floor(quantity); // DOGE, SHIB, PEPE etc
        } else if (quantity) {
          formattedQty = Number(quantity.toFixed(3)); // fallback
        }

        const params: Record<string, string> = {
          symbol: symbol.toUpperCase(),
          side: side.toUpperCase(),
          type: 'MARKET',
          timestamp: Date.now().toString(),
          recvWindow: '10000',
        };

        if (config.marketType === 'FUTURES') {
            params.quantity = Number(formattedQty).toString();
        } else {
            if (quoteOrderQty && quoteOrderQty > 0) {
              params.quoteOrderQty = Number(Math.max(10, quoteOrderQty)).toFixed(2);
            } else if (formattedQty && formattedQty > 0) {
              params.quantity = Number(formattedQty).toString();
            }
        }

        const queryString = new URLSearchParams(params).toString();
        const signature = createBinanceSignature(queryString, config.apiSecret!);
        
        let orderUrl = '';
        if (config.marketType === 'FUTURES') {
          const baseUrl = getBinanceFuturesApiBase(config.useTestnet);
          orderUrl = `${baseUrl}/fapi/v1/order?${queryString}&signature=${signature}`;
        } else {
          const baseUrl = getBinanceApiBase(config.useTestnet);
          orderUrl = `${baseUrl}/api/v3/order?${queryString}&signature=${signature}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(orderUrl, {
          method: 'POST',
          headers: {
            'X-MBX-APIKEY': config.apiKey!,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await response.json();

        if (!response.ok) {
           console.error("[SERVER ENGINE] Binance Error:", data);
           return { success: false, error: data.msg };
        }

        return { success: true, orderId: data.orderId || Date.now().toString() };
    } catch (err) {
        console.error("[SERVER ENGINE] Fetch Error:", err);
        return { success: false, error: 'Network error executing order' };
    }
}


export const startBotEngine = () => {
  console.log("🤖 Initializing Server-Side Bot Execution Engine...");

  if (engineInterval) clearInterval(engineInterval);

  engineInterval = setInterval(async () => {
    try {
      const botConfigStr = await kv.get('btc_bot_config');
      const botConfig = botConfigStr ? JSON.parse(botConfigStr) : { enabled: false };

      const positionsStr = await kv.get('btc_active_bot_positions');
      if (!positionsStr) return;
      
      let positions = JSON.parse(positionsStr);
      if (!Array.isArray(positions) || positions.length === 0) return;

      let stateChanged = false;
      let walletBalanceDelta = 0;
      let walletPnlDelta = 0;
      const logsToAdd: any[] = [];
      const historyToAdd: any[] = [];


      // Group by symbol and marketType to fetch prices efficiently
      const uniqueKeys = Array.from(new Set(positions.map((p: any) => `${(p.marketType || 'FUTURES')}_${String(p.symbol || 'BTCUSDT')}`)));
      const priceResults = await Promise.allSettled(uniqueKeys.map(k => {
        const [mt, sym] = k.split('_');
        return fetchSymbolPrice(sym, mt as 'SPOT' | 'FUTURES');
      }));
      const prices: Record<string, number> = {};
      uniqueKeys.forEach((k, idx) => {
        const res = priceResults[idx];
        const [_, sym] = k.split('_');
        if (res.status === 'fulfilled' && (res.value as number) > 0) {
          prices[k] = res.value as number;
        } else {
          prices[k] = FALLBACK_PRICES[sym] || 50.0;
        }
      });

      const binanceConfig = await getBinanceConfig();
      const isLiveMode = await kv.get('app_execution_mode') === 'BINANCE_LIVE';
      const roeEngineInstance = RoeEngine.getInstance(botConfig.roeEngine);

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const pKey = `${pos.marketType || 'FUTURES'}_${pos.symbol}`;
        const currentP = prices[pKey];
        
        if (!currentP || currentP <= 0) continue;

        const isLong = pos.decision === 'LONG';
        const lev = Math.max(1, pos.leverage || 1);
        const activeMargin = typeof pos.remainingAmountUsdt === 'number' && pos.remainingAmountUsdt > 0
          ? pos.remainingAmountUsdt
          : (pos.marginUsdt || pos.initialAmountUsdt || 10);

        // Advanced Server-Authoritative ROE Engine Calculation (Separating Gross, Net, Fees, Funding, Slippage)
        const roeMetrics = roeEngineInstance.evaluatePosition({
          symbol: pos.symbol,
          decision: pos.decision,
          entryPrice: pos.entryPrice,
          currentPrice: currentP,
          leverage: lev,
          marginUsdt: activeMargin,
          initialMarginUsdt: pos.initialAmountUsdt,
          realizedPnlUsdt: pos.realizedPnlUsdt,
          currentStopLoss: pos.stopLoss,
          initialStopLoss: pos.initialStopLoss,
          peakROE: pos.peakROE,
          peakPrice: pos.peakPrice,
          previousState: pos.roeState,
          tp1Hit: pos.tp1Hit,
          tp2Hit: pos.tp2Hit,
          tp3Hit: pos.tp3Hit,
          openedAt: pos.openedAt,
        });

        // Audit Logging for state transitions and SL updates
        roeEngineInstance.logEvaluation(pos.symbol, pos.decision, roeMetrics, pos.entryPrice, currentP, lev);

        // Update live position state on every tick
        pos.currentPrice = currentP;
        pos.grossROE = roeMetrics.grossROE;
        pos.netROE = roeMetrics.netROE;
        pos.roePercent = roeMetrics.netROE; // Backward-compatible alias
        pos.unrealizedPnlUsdt = roeMetrics.netPnL;
        pos.peakROE = roeMetrics.peakROE;
        pos.roeDrawdown = roeMetrics.roeDrawdown;
        pos.roeState = roeMetrics.state;
        pos.estimatedFeesUsdt = roeMetrics.estimatedFees;
        pos.fundingCostUsdt = roeMetrics.fundingCost;
        pos.estimatedSlippageUsdt = roeMetrics.estimatedSlippage;
        pos.breakevenPrice = roeMetrics.breakevenPrice;
        pos.protectedProfitUsdt = roeMetrics.protectedProfitUsdt;
        pos.trailingStatus = roeMetrics.trailingStatus;

        if (!pos.marginUsdt) pos.marginUsdt = activeMargin;
        if (!pos.positionSizeUsdt) pos.positionSizeUsdt = activeMargin * lev;
        if (!pos.pnlHistory) pos.pnlHistory = [];
        pos.pnlHistory = [...pos.pnlHistory, Math.round(roeMetrics.netROE * 10) / 10].slice(-50);

        // In SPOT mode (or 1x leverage), there is NO liquidation mechanism whatsoever
        const isPosFutures = pos.marketType === 'FUTURES' && (pos.leverage || 1) > 1;

        if (isPosFutures) {
          // Calculate liquidation price if missing for Futures
          if (!pos.liquidationPrice) {
            pos.liquidationPrice = isLong
              ? pos.entryPrice * Math.max(0.001, 1 - (1 / lev) + 0.005)
              : pos.entryPrice * (1 + (1 / lev) - 0.005);
          }
          pos.distanceToLiqPct = Math.abs((currentP - pos.liquidationPrice) / currentP) * 100;
        } else {
          pos.liquidationPrice = undefined;
          pos.distanceToLiqPct = undefined;
          pos.leverage = 1;
        }

        // 1. LIQUIDATION GUARD CHECK (FUTURES ONLY - HIGHEST RISK HIERARCHY)
        const isLiquidated = isPosFutures && (
          (isLong && currentP <= (pos.liquidationPrice || 0)) ||
          (!isLong && currentP >= (pos.liquidationPrice || Infinity)) ||
          roeMetrics.netROE <= -99.0
        );

        const isPosLive = pos.mode === 'BINANCE_LIVE';

        if (isLiquidated) {
          console.warn(`[SERVER ENGINE] 🚨 LIQUIDATION TRIGGERED for ${pos.symbol} at ${currentP} (Entry: ${pos.entryPrice}, Liq: ${pos.liquidationPrice})`);
          const marginLost = pos.remainingAmountUsdt;
          const tranchePnl = -marginLost;
          const totalTradePnl = (pos.realizedPnlUsdt || 0) + tranchePnl;

          if (isPosLive) {
            if (binanceConfig.isConnected) {
              await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginLost * lev, pos.remainingAmountBtc, currentP);
            }
          } else {
            // Margin lost entirely; zero returned to paper wallet
            walletPnlDelta += tranchePnl;
          }

          logsToAdd.push({
            id: `log-liq-${Date.now()}-${i}`,
            timestamp: Date.now(),
            type: 'LIQUIDATION',
            symbol: pos.symbol,
            side: isLong ? 'SELL' : 'BUY',
            price: currentP,
            amountUsdt: marginLost * lev,
            pnlUsdt: tranchePnl,
            pnlPercent: -100,
            reason: `Liquidation threshold reached (-100% Margin Depleted)`,
            mode: isPosLive ? 'BINANCE_LIVE' : 'PAPER',
          });

          historyToAdd.push({
            id: `history-liq-${Date.now()}-${i}`,
            timestamp: Date.now(),
            symbol: pos.symbol,
            decision: pos.decision,
            timeframe: '1h',
            entryPrice: pos.entryPrice,
            exitPrice: currentP,
            tp1: pos.tp1,
            tp2: pos.tp2,
            tp3: pos.tp3,
            stopLoss: pos.stopLoss,
            status: 'LIQUIDATED',
            profitPercent: (totalTradePnl / pos.initialAmountUsdt) * 100,
            profitUsdt: totalTradePnl,
            confidence: pos.confidence || 75,
            strategyName: pos.strategyName,
            mode: isPosLive ? 'BINANCE_LIVE' : 'PAPER',
          });

          try {
            const riskEngine = RiskEngine.getInstance();
            riskEngine.recordTradeClosed(totalTradePnl, 0, {
              symbol: pos.symbol,
              strategyName: pos.strategyName,
              durationMs: Date.now() - (pos.openedAt || Date.now()),
            });
          } catch (err) {}

          pos._delete = true;
          stateChanged = true;
          continue;
        }

        // 2. ADVANCED ROE ENGINE STOP LOSS RATCHETING & TRAILING (Server-Side)
        // Strict Monotonicity: Long SL only moves UP, Short SL only moves DOWN, never loosens!
        let currentPeak = pos.peakPrice || pos.entryPrice;
        if ((isLong && currentP > currentPeak) || (!isLong && currentP < currentPeak)) {
          currentPeak = currentP;
          pos.peakPrice = currentPeak;
          stateChanged = true;
        }

        if (botConfig.trailingStopEnabled !== false && botConfig.roeEngine?.enabled !== false) {
          if (roeMetrics.shouldUpdateStopLoss && roeMetrics.candidateStopLoss) {
            const candidateSL = roeMetrics.candidateStopLoss;
            const isTighter = isLong
              ? (!pos.stopLoss || candidateSL > pos.stopLoss)
              : (!pos.stopLoss || candidateSL < pos.stopLoss);

            if (isTighter) {
              pos.stopLoss = candidateSL;
              pos.trailingStopPrice = candidateSL;
              pos.isTrailingActive = true;
              pos.lastAction = `${roeMetrics.state} | SL: $${candidateSL.toFixed(2)} ⚡ (${roeMetrics.stopLossUpdateReason || 'Locked Profit'})`;
              stateChanged = true;
            }
          }
        }

        // 3. TP1 HIT (Take 50% profit, move SL to Fee-Aware Breakeven without degrading existing Trailing SL)
        const isTp1Valid = isLong ? pos.tp1 > pos.entryPrice : pos.tp1 < pos.entryPrice;
        const isTp1Triggered = isTp1Valid && !pos.tp1Hit && (isLong ? currentP >= pos.tp1 : currentP <= pos.tp1);

        if (isTp1Triggered) {
          console.log(`[SERVER ENGINE] TP1 Hit for ${pos.symbol} at ${currentP}`);
          const marginClosed = pos.remainingAmountUsdt * 0.5;
          const tranchePnl = marginClosed * (roeMetrics.netROE / 100);
          const cashReturned = Math.max(0, marginClosed + tranchePnl);

          if (isPosLive) {
            if (binanceConfig.isConnected) {
              await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc * 0.5, currentP);
            }
          } else {
            walletBalanceDelta += cashReturned;
            walletPnlDelta += tranchePnl;
          }

          pos.tp1Hit = true;
          pos.remainingAmountUsdt -= marginClosed;
          pos.marginUsdt = pos.remainingAmountUsdt;
          pos.positionSizeUsdt = pos.remainingAmountUsdt * lev;
          pos.remainingAmountBtc *= 0.5;
          pos.realizedPnlUsdt += tranchePnl;

          // Protect capital: move stop loss to fee-aware breakeven, NEVER lowering an already higher trailing SL
          const breakevenFloor = roeMetrics.breakevenPrice || (isLong ? pos.entryPrice * 1.001 : pos.entryPrice * 0.999);
          pos.stopLoss = isLong
            ? Math.max(pos.stopLoss || 0, breakevenFloor)
            : Math.min(pos.stopLoss || breakevenFloor, breakevenFloor);

          pos.lastAction = 'TP1 hit: 50% closed, SL locked at fee-aware breakeven+ ✓ (Server)';
          stateChanged = true;

          sendServerTelegramNotification(
            `🎯 <b>TP1 Target Achieved!</b>\n\n` +
            `🔹 Pair: <b>${pos.symbol}</b> (${pos.decision})\n` +
            `💰 Closed: 50% at $${currentP.toLocaleString()}\n` +
            `📈 Realized PnL: +$${tranchePnl.toFixed(2)} (+${roeMetrics.netROE.toFixed(1)}% Net ROE)\n` +
            `🛡️ Stop Loss secured at Fee-Aware Breakeven ($${pos.stopLoss?.toLocaleString()})`
          );

          logsToAdd.push({
            id: `log-tp1-${Date.now()}-${i}`,
            timestamp: Date.now(),
            type: 'AUTO_SELL_TP1',
            symbol: pos.symbol,
            side: isLong ? 'SELL' : 'BUY',
            price: currentP,
            amountUsdt: marginClosed * lev,
            pnlUsdt: tranchePnl,
            pnlPercent: roeMetrics.netROE,
            reason: `TP1 achieved (50% closed at ${currentP}, SL secured at fee-aware breakeven)`,
            mode: isPosLive ? 'BINANCE_LIVE' : 'PAPER',
          });
        }
        
        // 4. TP2 HIT (Take 50% of remaining, lock SL at TP1 price)
        const isTp2Valid = isLong ? pos.tp2 > pos.entryPrice : pos.tp2 < pos.entryPrice;
        const isTp2Triggered = isTp2Valid && pos.tp1Hit && !pos.tp2Hit && (isLong ? currentP >= pos.tp2 : currentP <= pos.tp2);

        if (isTp2Triggered) {
          console.log(`[SERVER ENGINE] TP2 Hit for ${pos.symbol} at ${currentP}`);
          const marginClosed = pos.remainingAmountUsdt * 0.5;
          const tranchePnl = marginClosed * (roeMetrics.netROE / 100);
          const cashReturned = Math.max(0, marginClosed + tranchePnl);

          if (isPosLive) {
            if (binanceConfig.isConnected) {
              await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc * 0.5, currentP);
            }
          } else {
            walletBalanceDelta += cashReturned;
            walletPnlDelta += tranchePnl;
          }

          pos.tp2Hit = true;
          pos.remainingAmountUsdt -= marginClosed;
          pos.marginUsdt = pos.remainingAmountUsdt;
          pos.positionSizeUsdt = pos.remainingAmountUsdt * lev;
          pos.remainingAmountBtc *= 0.5;
          pos.realizedPnlUsdt += tranchePnl;

          // Lock SL at TP1 price to guarantee massive gain on the remaining runner
          if (pos.tp1 && pos.tp1 > 0) {
            pos.stopLoss = isLong
              ? Math.max(pos.stopLoss || 0, pos.tp1)
              : Math.min(pos.stopLoss || pos.tp1, pos.tp1);
          }

          pos.lastAction = 'TP2 hit: 50% remaining closed, SL locked at TP1 ✓ (Server)';
          stateChanged = true;

          sendServerTelegramNotification(
            `🎯 <b>TP2 Target Hit! (Runner Secured)</b>\n\n` +
            `🔹 Pair: <b>${pos.symbol}</b> (${pos.decision})\n` +
            `💰 Closed: 50% remaining at $${currentP.toLocaleString()}\n` +
            `📈 Realized PnL: +$${tranchePnl.toFixed(2)} (+${roeMetrics.netROE.toFixed(1)}%)\n` +
            `🛡️ Stop Loss advanced to TP1 (${(pos.tp1 || 0).toLocaleString()})`
          );

          logsToAdd.push({
            id: `log-tp2-${Date.now()}-${i}`,
            timestamp: Date.now(),
            type: 'AUTO_SELL_TP2',
            symbol: pos.symbol,
            side: isLong ? 'SELL' : 'BUY',
            price: currentP,
            amountUsdt: marginClosed * lev,
            pnlUsdt: tranchePnl,
            pnlPercent: roeMetrics.netROE,
            reason: `TP2 achieved (50% remaining closed at ${currentP}, SL advanced to TP1)`,
            mode: isPosLive ? 'BINANCE_LIVE' : 'PAPER',
          });
        }
        
        // 5. TP3 OR STOP LOSS HIT (Full position closure)
        const isTp3Valid = isLong ? pos.tp3 > pos.entryPrice : pos.tp3 < pos.entryPrice;
        const isTp3Hit = isTp3Valid && (isLong ? currentP >= pos.tp3 : currentP <= pos.tp3);
        const isSlHit = pos.stopLoss && pos.stopLoss > 0 && (isLong ? currentP <= pos.stopLoss : currentP >= pos.stopLoss);

        if (isTp3Hit || isSlHit) {
          const isTp3 = isTp3Hit;
          console.log(`[SERVER ENGINE] ${isTp3 ? 'TP3' : 'SL'} Hit for ${pos.symbol} at ${currentP}`);
          
          const marginClosed = pos.remainingAmountUsdt;
          let tranchePnl = marginClosed * (roeMetrics.netROE / 100);
          
          // Liquidation clamp
          if (tranchePnl < -marginClosed) {
            tranchePnl = -marginClosed;
          }
          
          const cashReturned = Math.max(0, marginClosed + tranchePnl);
          const totalTradePnl = (pos.realizedPnlUsdt || 0) + tranchePnl;

          if (isPosLive) {
            if (binanceConfig.isConnected) {
              await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc, currentP);
            }
          } else {
            walletBalanceDelta += cashReturned;
            walletPnlDelta += tranchePnl;
          }
          
          const logType = isTp3 ? 'AUTO_SELL_TP3' : (pos.isTrailingActive ? 'AUTO_TRAILING_SL' : 'AUTO_SL');
          
          const closeTitle = isTp3 
            ? '🏆 <b>TP3 Final Moonbag Target Achieved!</b>' 
            : (pos.isTrailingActive ? '⚡ <b>Trailing Stop Executed (Profit Locked)</b>' : '🛑 <b>Stop Loss Triggered</b>');
          const pnlSign = totalTradePnl >= 0 ? '+' : '';

          sendServerTelegramNotification(
            `${closeTitle}\n\n` +
            `🔹 Pair: <b>${pos.symbol}</b> (${pos.decision})\n` +
            `📊 Exit Price: $${currentP.toLocaleString()}\n` +
            `💵 Net Trade PnL: ${pnlSign}$${totalTradePnl.toFixed(2)}\n` +
            `⏱ Strategy: ${pos.strategyName || 'Quantitative'}`
          );

          logsToAdd.push({
            id: `log-server-${Date.now()}-${i}`,
            timestamp: Date.now(),
            type: logType,
            symbol: pos.symbol,
            side: isLong ? 'SELL' : 'BUY',
            price: currentP,
            amountUsdt: marginClosed * lev,
            pnlUsdt: Math.round(tranchePnl * 100) / 100,
            pnlPercent: Math.round(roeMetrics.netROE * 100) / 100,
            reason: isTp3 ? `TP3 target achieved (${currentP})` : (pos.isTrailingActive ? `Trailing Stop triggered (${currentP})` : `Stop Loss hit (${currentP})`),
            mode: isPosLive ? 'BINANCE_LIVE' : 'PAPER'
          });

          const initialMargin = pos.initialAmountUsdt || pos.marginUsdt || pos.remainingAmountUsdt || 10;
          historyToAdd.push({
            id: `history-server-${Date.now()}-${i}`,
            timestamp: Date.now(),
            symbol: pos.symbol,
            decision: pos.decision,
            timeframe: '1h',
            entryPrice: pos.entryPrice,
            exitPrice: currentP,
            tp1: pos.tp1,
            tp2: pos.tp2,
            tp3: pos.tp3,
            stopLoss: pos.stopLoss,
            status: isTp3 ? 'TP3_HIT' : (pos.isTrailingActive ? 'TP1_HIT' : 'SL_HIT'),
            profitPercent: Math.round(((totalTradePnl / initialMargin) * 100) * 100) / 100,
            profitUsdt: Math.round(totalTradePnl * 100) / 100,
            confidence: pos.confidence || 75,
            strategyName: pos.strategyName,
            pnlHistory: pos.pnlHistory,
            mode: isPosLive ? 'BINANCE_LIVE' : 'PAPER',
          });

          try {
            const riskEngine = RiskEngine.getInstance();
            riskEngine.recordTradeClosed(totalTradePnl, 0, {
              symbol: pos.symbol,
              strategyName: pos.strategyName,
              durationMs: Date.now() - (pos.openedAt || Date.now()),
            });
          } catch (err) {
            console.error('[SERVER ENGINE] Risk Engine record error:', err);
          }

          pos._delete = true;
          stateChanged = true;
        }
      }

      // 6. ALWAYS PERSIST UPDATED LIVE POSITIONS TO KV
      // This guarantees that open trades NEVER stay stuck at 0.00% ROE in the UI!
      const freshPositionsStr = await kv.get('btc_active_bot_positions');
      const freshPositions = freshPositionsStr ? JSON.parse(freshPositionsStr) : [];
      
      const updatedPositions = freshPositions.map((freshPos: any) => {
         const loopPos = positions.find((p: any) => p.id === freshPos.id);
         if (loopPos) {
             if (loopPos._delete) return null;
             const { _delete, ...safeLoopPos } = loopPos;
             return { ...freshPos, ...safeLoopPos };
         }
         return freshPos;
      }).filter(Boolean);
      
      await kv.set('btc_active_bot_positions', JSON.stringify(updatedPositions));

      if (walletBalanceDelta !== 0 || walletPnlDelta !== 0) {
        const currentWalletStr = await kv.get('btc_paper_wallet');
        const currentWallet = currentWalletStr ? JSON.parse(currentWalletStr) : { balance: 1000, realizedPnl: 0 };
        currentWallet.balance = Math.max(0, Math.round(((Number(currentWallet.balance) || 1000) + walletBalanceDelta) * 100) / 100);
        currentWallet.realizedPnl = Math.round(((Number(currentWallet.realizedPnl) || 0) + walletPnlDelta) * 100) / 100;
        await kv.set('btc_paper_wallet', JSON.stringify(currentWallet));
      }

      if (logsToAdd.length > 0) {
        const logsStr = await kv.get('btc_bot_logs');
        const logs = logsStr ? JSON.parse(logsStr) : [];
        await kv.set('btc_bot_logs', JSON.stringify([...logsToAdd, ...logs].slice(0, 500)));
      }

      if (historyToAdd.length > 0) {
        const histStr = await kv.get('btc_trade_history');
        const history = histStr ? JSON.parse(histStr) : [];
        await kv.set('btc_trade_history', JSON.stringify([...historyToAdd, ...history].slice(0, 500)));
      }

    } catch (err) {
      console.error("[SERVER ENGINE] Error evaluating positions:", err);
    }
  }, 3000); // Run every 3 seconds independently
};

/**
 * Server-authoritative position closer (Manual / SL / TP / Panic)
 */
export const closePositionDirect = async (posId: string, customExitPrice?: number, reason: string = 'Manual Close') => {
  try {
    const posStr = await kv.get('btc_active_bot_positions');
    const positions = posStr ? JSON.parse(posStr) : [];
    const pos = positions.find((p: any) => p.id === posId);
    if (!pos) {
      return { success: false, error: 'Position not found' };
    }

    const currentP = (customExitPrice && customExitPrice > 0) ? customExitPrice : await fetchSymbolPrice(pos.symbol, pos.marketType || 'FUTURES');
    const isLong = pos.decision === 'LONG';
    const lev = Math.max(1, pos.leverage || 1);
    const marginClosed = pos.remainingAmountUsdt || 0;

    const roeMetrics = RoeEngine.getInstance().evaluatePosition({
      symbol: pos.symbol,
      decision: pos.decision,
      entryPrice: pos.entryPrice,
      currentPrice: currentP,
      leverage: lev,
      marginUsdt: marginClosed,
      initialMarginUsdt: pos.initialAmountUsdt,
      realizedPnlUsdt: pos.realizedPnlUsdt,
      tp1Hit: pos.tp1Hit,
      tp2Hit: pos.tp2Hit,
      tp3Hit: pos.tp3Hit,
      openedAt: pos.openedAt,
    });

    const roePercent = roeMetrics.netROE;
    let tranchePnl = roeMetrics.netPnL;
    if (tranchePnl < -marginClosed) tranchePnl = -marginClosed;
    const cashReturned = Math.max(0, marginClosed + tranchePnl);
    const totalTradePnl = (pos.realizedPnlUsdt || 0) + tranchePnl;

    const binanceConfig = await getBinanceConfig();
    const isPosLive = pos.mode === 'BINANCE_LIVE';

    if (isPosLive) {
      if (binanceConfig.isConnected) {
        await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc, currentP);
      }
    } else {
      const currentWalletStr = await kv.get('btc_paper_wallet');
      const currentWallet = currentWalletStr ? JSON.parse(currentWalletStr) : { balance: 1000, realizedPnl: 0 };
      currentWallet.balance = Math.max(0, Math.round(((Number(currentWallet.balance) || 1000) + cashReturned) * 100) / 100);
      currentWallet.realizedPnl = Math.round(((Number(currentWallet.realizedPnl) || 0) + tranchePnl) * 100) / 100;
      await kv.set('btc_paper_wallet', JSON.stringify(currentWallet));
    }

    // Immediately remove from active positions
    const remainingPositions = positions.filter((p: any) => p.id !== posId);
    await kv.set('btc_active_bot_positions', JSON.stringify(remainingPositions));

    // Add to history
    const histStr = await kv.get('btc_trade_history');
    const history = histStr ? JSON.parse(histStr) : [];
    const initialMargin = pos.initialAmountUsdt || pos.marginUsdt || marginClosed || 10;
    const historyItem = {
      id: `history-manual-${Date.now()}`,
      timestamp: Date.now(),
      symbol: pos.symbol,
      decision: pos.decision,
      timeframe: '1h',
      entryPrice: pos.entryPrice,
      exitPrice: currentP,
      tp1: pos.tp1,
      tp2: pos.tp2,
      tp3: pos.tp3,
      stopLoss: pos.stopLoss,
      status: totalTradePnl >= 0 ? 'TP_MANUAL' : 'SL_MANUAL',
      profitPercent: Math.round(((totalTradePnl / initialMargin) * 100) * 100) / 100,
      profitUsdt: Math.round(totalTradePnl * 100) / 100,
      confidence: pos.confidence || 75,
      strategyName: pos.strategyName,
      pnlHistory: pos.pnlHistory,
      mode: isPosLive ? 'BINANCE_LIVE' : 'PAPER',
    };
    await kv.set('btc_trade_history', JSON.stringify([historyItem, ...history].slice(0, 500)));

    // Add to logs
    const logsStr = await kv.get('btc_bot_logs');
    const logs = logsStr ? JSON.parse(logsStr) : [];
    const logItem = {
      id: `log-manual-${Date.now()}`,
      timestamp: Date.now(),
      type: 'MANUAL_CLOSE',
      symbol: pos.symbol,
      side: isLong ? 'SELL' : 'BUY',
      price: currentP,
      amountUsdt: marginClosed * lev,
      pnlUsdt: Math.round(tranchePnl * 100) / 100,
      pnlPercent: Math.round(roePercent * 100) / 100,
      reason,
      mode: isPosLive ? 'BINANCE_LIVE' : 'PAPER',
      marketType: pos.marketType,
      leverage: lev,
    };
    await kv.set('btc_bot_logs', JSON.stringify([logItem, ...logs].slice(0, 500)));

    try {
      const riskEngine = RiskEngine.getInstance();
      riskEngine.recordTradeClosed(totalTradePnl, 0, {
        symbol: pos.symbol,
        strategyName: pos.strategyName,
        durationMs: Date.now() - (pos.openedAt || Date.now()),
      });
    } catch (err) {}

    return { success: true, closedPosition: pos, remainingPositions };
  } catch (err: any) {
    console.error('[SERVER ENGINE] Close Position error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Panic close all active positions immediately
 */
export const panicCloseAllDirect = async () => {
  try {
    const posStr = await kv.get('btc_active_bot_positions');
    const positions = posStr ? JSON.parse(posStr) : [];
    if (!Array.isArray(positions) || positions.length === 0) {
      return { success: true, closedCount: 0 };
    }

    for (const pos of positions) {
      await closePositionDirect(pos.id, undefined, 'Panic emergency close all');
    }

    return { success: true, closedCount: positions.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

