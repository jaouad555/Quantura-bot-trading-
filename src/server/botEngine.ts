import { kv } from './db';
import { RiskEngine } from './riskEngine/RiskEngine';

let engineInterval: NodeJS.Timeout | null = null;
let telegramInterval: NodeJS.Timeout | null = null;

// Reliable fallback prices for major assets
const FALLBACK_PRICES: Record<string, number> = {
  BTCUSDT: 65000,
  ETHUSDT: 3500,
  SOLUSDT: 106.72,
  BNBUSDT: 580,
  AVAXUSDT: 28.5,
  LINKUSDT: 14.5,
  SUIUSDT: 2.2,
  NEARUSDT: 5.2,
  XRPUSDT: 0.58,
  DOGEUSDT: 0.13,
  ADAUSDT: 0.42,
  DOTUSDT: 4.8,
  PEPEUSDT: 0.00001,
  SHIBUSDT: 0.000018,
  LTCUSDT: 75,
  TRXUSDT: 0.16,
  UNIUSDT: 7.5,
  ATOMUSDT: 4.8,
  ARBUSDT: 0.55,
  OPUSDT: 1.45,
  APTUSDT: 8.5,
  INJUSDT: 18.5,
  RENDERUSDT: 5.8,
  FTMUSDT: 0.65,
  TIAUSDT: 5.2,
  SEIUSDT: 0.35,
  WIFUSDT: 1.8,
  FETUSDT: 1.2,
  AAVEUSDT: 155,
  MKRUSDT: 1600,
  CRVUSDT: 0.28,
};

const priceCache = new Map<string, { price: number; timestamp: number }>();

/**
 * Resilient live price fetcher with multi-endpoint failover and in-memory cache
 */
export const fetchSymbolPrice = async (rawSymbol: string): Promise<number> => {
  const symbol = (rawSymbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BTCUSDT';
  const now = Date.now();
  const cached = priceCache.get(symbol);
  
  // Return cached price if fresh (less than 4 seconds old)
  if (cached && now - cached.timestamp < 4000) {
    return cached.price;
  }

  const endpoints = [
    `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
    `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`,
    `https://api1.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
  ];

  for (const url of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data: any = await res.json();
        const priceStr = data?.price || data?.lastPrice;
        if (priceStr) {
          const p = parseFloat(priceStr);
          if (!isNaN(p) && p > 0) {
            priceCache.set(symbol, { price: p, timestamp: now });
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

  // Fallback to accurate baseline prices
  const fallback = FALLBACK_PRICES[symbol] || 50.0;
  priceCache.set(symbol, { price: fallback, timestamp: now });
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
        const symbols: string[] = Array.from(new Set(positions.map((p: any) => String(p.symbol || 'BTCUSDT'))));
        const prices: Record<string, number> = {};
        
        const priceResults = await Promise.allSettled(symbols.map(s => fetchSymbolPrice(s)));
        symbols.forEach((sym, idx) => {
          const res = priceResults[idx];
          if (res.status === 'fulfilled' && res.value > 0) {
            prices[sym] = res.value;
          } else {
            prices[sym] = FALLBACK_PRICES[sym] || 50.0;
          }
        });
        
        for (const pos of positions) {
          const currentP = prices[pos.symbol];
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


// Add helper to fetch binance config
const getBinanceConfig = async () => {
  const apiKey = await kv.get('app_binance_api_key');
  const apiSecret = await kv.get('app_binance_api_secret');
  const useTestnet = await kv.get('app_binance_use_testnet') === 'true';
  const marketType = (await kv.get('app_binance_market_type')) || 'FUTURES';
  return { apiKey, apiSecret, useTestnet, marketType, isConnected: !!(apiKey && apiSecret) };
};


import crypto from 'crypto';

// Binance Utilities
const getBinanceApiBase = (useTestnet: boolean) => useTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
const getBinanceFuturesApiBase = (useTestnet: boolean) => useTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';

const createBinanceSignature = (queryString: string, apiSecret: string) => {
  return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
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


      // Group by symbol to fetch prices efficiently
      const symbols = Array.from(new Set(positions.map((p: any) => p.symbol)));
      const priceResults = await Promise.allSettled(symbols.map(s => fetchSymbolPrice(s)));
      const prices: Record<string, number> = {};
      symbols.forEach((sym, idx) => {
        const res = priceResults[idx];
        if (res.status === 'fulfilled' && (res.value as number) > 0) {
          prices[sym as string] = res.value as number;
        }
      });

      const binanceConfig = await getBinanceConfig();
      const isLiveMode = await kv.get('app_execution_mode') === 'BINANCE_LIVE';

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const currentP = prices[pos.symbol];
        
        if (!currentP || currentP <= 0) continue;

        const isLong = pos.decision === 'LONG';
        const lev = Math.max(1, pos.leverage || 1);
        
        // Exact ROE% and Price Difference Math
        // LONG: (current - entry) / entry * 100
        // SHORT: (entry - current) / entry * 100
        const priceDiffPct = ((currentP - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1) * 100;
        const roePercent = priceDiffPct * lev;
        const unrealizedPnlUsdt = pos.remainingAmountUsdt * (roePercent / 100);

        // Update live position state on every tick
        pos.currentPrice = currentP;
        pos.unrealizedPnlUsdt = Math.round(unrealizedPnlUsdt * 100) / 100;
        pos.roePercent = Math.round(roePercent * 100) / 100;
        if (!pos.marginUsdt) pos.marginUsdt = pos.remainingAmountUsdt;
        if (!pos.positionSizeUsdt) pos.positionSizeUsdt = pos.remainingAmountUsdt * lev;
        if (!pos.pnlHistory) pos.pnlHistory = [];
        pos.pnlHistory = [...pos.pnlHistory, Math.round(roePercent * 10) / 10].slice(-50);

        // Calculate liquidation price if missing
        if (!pos.liquidationPrice) {
          pos.liquidationPrice = isLong
            ? pos.entryPrice * Math.max(0.001, 1 - (1 / lev) + 0.005)
            : pos.entryPrice * (1 + (1 / lev) - 0.005);
        }
        pos.distanceToLiqPct = Math.abs((currentP - pos.liquidationPrice) / currentP) * 100;

        // 1. LIQUIDATION GUARD CHECK
        const isLiquidated = (isLong && currentP <= pos.liquidationPrice) ||
                             (!isLong && currentP >= pos.liquidationPrice) ||
                             roePercent <= -99.0;

        if (isLiquidated) {
          console.warn(`[SERVER ENGINE] 🚨 LIQUIDATION TRIGGERED for ${pos.symbol} at ${currentP} (Entry: ${pos.entryPrice}, Liq: ${pos.liquidationPrice})`);
          const marginLost = pos.remainingAmountUsdt;
          const tranchePnl = -marginLost;
          const totalTradePnl = pos.realizedPnlUsdt + tranchePnl;

          if (isLiveMode && binanceConfig.isConnected) {
            await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginLost * lev, pos.remainingAmountBtc, currentP);
          } else {
            // Margin lost entirely; zero returned
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
            mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
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

        // 2. TRAILING STOP LOSS (Server-Side)
        if (botConfig.trailingStopEnabled) {
          const trailGapPercent = (botConfig.trailingStopPercent || 1.2) / 100;
          const activationProfit = botConfig.trailingActivationProfitPercent || 1.5;
          
          let currentPeak = pos.peakPrice || pos.entryPrice;
          if ((isLong && currentP > currentPeak) || (!isLong && currentP < currentPeak)) {
            currentPeak = currentP;
            pos.peakPrice = currentPeak;
            stateChanged = true;
          }

          if (roePercent >= activationProfit || pos.tp1Hit) {
            const calculatedTrailingSl = isLong ? currentPeak * (1 - trailGapPercent) : currentPeak * (1 + trailGapPercent);
            const isTslTighter = isLong
              ? (!pos.stopLoss || calculatedTrailingSl > pos.stopLoss)
              : (!pos.stopLoss || calculatedTrailingSl < pos.stopLoss);

            if (isTslTighter) {
              pos.stopLoss = calculatedTrailingSl;
              pos.trailingStopPrice = calculatedTrailingSl;
              pos.isTrailingActive = true;
              pos.lastAction = `Trailing SL: ${calculatedTrailingSl.toFixed(2)} ⚡ (Server)`;
              stateChanged = true;
            }
          }
        }

        // 3. TP1 HIT (Take 50% profit, move SL to breakeven)
        const isTp1Valid = isLong ? pos.tp1 > pos.entryPrice : pos.tp1 < pos.entryPrice;
        const isTp1Triggered = isTp1Valid && !pos.tp1Hit && (isLong ? currentP >= pos.tp1 : currentP <= pos.tp1);

        if (isTp1Triggered) {
          console.log(`[SERVER ENGINE] TP1 Hit for ${pos.symbol} at ${currentP}`);
          const marginClosed = pos.remainingAmountUsdt * 0.5;
          const tranchePnl = marginClosed * (roePercent / 100);
          const cashReturned = Math.max(0, marginClosed + tranchePnl);

          if (isLiveMode && binanceConfig.isConnected) {
            await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc * 0.5, currentP);
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
          // Protect capital: move stop loss to entry price
          pos.stopLoss = pos.entryPrice;
          pos.lastAction = 'TP1 hit: 50% closed, SL moved to breakeven ✓ (Server)';
          stateChanged = true;

          logsToAdd.push({
            id: `log-tp1-${Date.now()}-${i}`,
            timestamp: Date.now(),
            type: 'AUTO_SELL_TP1',
            symbol: pos.symbol,
            side: isLong ? 'SELL' : 'BUY',
            price: currentP,
            amountUsdt: marginClosed * lev,
            pnlUsdt: tranchePnl,
            pnlPercent: roePercent,
            reason: `TP1 achieved (50% closed at ${currentP}, SL moved to breakeven)`,
            mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
          });
        }
        
        // 4. TP2 HIT (Take 50% of remaining, lock more profit)
        const isTp2Valid = isLong ? pos.tp2 > pos.entryPrice : pos.tp2 < pos.entryPrice;
        const isTp2Triggered = isTp2Valid && pos.tp1Hit && !pos.tp2Hit && (isLong ? currentP >= pos.tp2 : currentP <= pos.tp2);

        if (isTp2Triggered) {
          console.log(`[SERVER ENGINE] TP2 Hit for ${pos.symbol} at ${currentP}`);
          const marginClosed = pos.remainingAmountUsdt * 0.5;
          const tranchePnl = marginClosed * (roePercent / 100);
          const cashReturned = Math.max(0, marginClosed + tranchePnl);

          if (isLiveMode && binanceConfig.isConnected) {
            await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc * 0.5, currentP);
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
          pos.lastAction = 'TP2 hit: 50% of remaining closed ✓ (Server)';
          stateChanged = true;

          logsToAdd.push({
            id: `log-tp2-${Date.now()}-${i}`,
            timestamp: Date.now(),
            type: 'AUTO_SELL_TP2',
            symbol: pos.symbol,
            side: isLong ? 'SELL' : 'BUY',
            price: currentP,
            amountUsdt: marginClosed * lev,
            pnlUsdt: tranchePnl,
            pnlPercent: roePercent,
            reason: `TP2 achieved (50% remaining closed at ${currentP})`,
            mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
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
          let tranchePnl = marginClosed * (roePercent / 100);
          
          // Liquidation clamp
          if (tranchePnl < -marginClosed) {
            tranchePnl = -marginClosed;
          }
          
          const cashReturned = Math.max(0, marginClosed + tranchePnl);
          const totalTradePnl = (pos.realizedPnlUsdt || 0) + tranchePnl;

          if (isLiveMode && binanceConfig.isConnected) {
            await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc, currentP);
          } else {
            walletBalanceDelta += cashReturned;
            walletPnlDelta += tranchePnl;
          }
          
          const logType = isTp3 ? 'AUTO_SELL_TP3' : (pos.isTrailingActive ? 'AUTO_TRAILING_SL' : 'AUTO_SL');
          logsToAdd.push({
            id: `log-server-${Date.now()}-${i}`,
            timestamp: Date.now(),
            type: logType,
            symbol: pos.symbol,
            side: isLong ? 'SELL' : 'BUY',
            price: currentP,
            amountUsdt: marginClosed * lev,
            pnlUsdt: Math.round(tranchePnl * 100) / 100,
            pnlPercent: Math.round(roePercent * 100) / 100,
            reason: isTp3 ? `TP3 target achieved (${currentP})` : (pos.isTrailingActive ? `Trailing Stop triggered (${currentP})` : `Stop Loss hit (${currentP})`),
            mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER'
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

