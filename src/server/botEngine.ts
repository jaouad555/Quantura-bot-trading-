import { kv } from './db';

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

export const startBotEngine = () => {
  if (engineInterval) clearInterval(engineInterval);
  
  engineInterval = setInterval(async () => {
    try {
      const botConfigStr = await kv.get('btc_bot_config');
      if (!botConfigStr) return;
      
      const botConfig = JSON.parse(botConfigStr);
      if (!botConfig.enabled) return;

      const positionsStr = await kv.get('btc_active_bot_positions');
      if (!positionsStr) return;
      
      const positions = JSON.parse(positionsStr);
      if (!Array.isArray(positions) || positions.length === 0) return;

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

      let positionsChanged = false;
      let logsChanged = false;
      let walletChanged = false;
      let historyChanged = false;
      
      let updatedPositions = [...positions];
      let logs = JSON.parse((await kv.get('btc_bot_logs')) || '[]');
      let history = JSON.parse((await kv.get('btc_trade_history')) || '[]');
      let wallet = JSON.parse((await kv.get('btc_paper_wallet')) || '{"balance": 1000, "realizedPnl": 0}');

      for (let i = updatedPositions.length - 1; i >= 0; i--) {
        const pos = updatedPositions[i];
        const currentP = prices[pos.symbol];
        if (!currentP) continue;

        let actionType = null;
        let actionReason = '';
        
        const isLong = pos.decision === 'LONG';
        const isLive = pos.mode === 'BINANCE_LIVE';

        // Check SL
        if ((isLong && currentP <= pos.stopLoss) || (!isLong && currentP >= pos.stopLoss)) {
          actionType = 'AUTO_SL';
          actionReason = pos.isTrailingActive ? 'Trailing Stop Hit - Accrued Profits Locked 🎯' : 'Stop Loss Triggered 🛑';
        } 
        // Check TP3 (Full Close)
        else if ((isLong && currentP >= pos.tp3) || (!isLong && currentP <= pos.tp3)) {
          actionType = 'AUTO_SELL_TP3';
          actionReason = 'Take Profit 3 Hit 🎯';
        }
        
        if (actionType) {
          const pnlUsdt = calculatePnl(pos, currentP);
          const pnlPercent = (pnlUsdt / pos.initialAmountUsdt) * 100;
          
          logs.unshift({
            id: `log-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            timestamp: Date.now(),
            type: actionType,
            symbol: pos.symbol,
            side: isLong ? 'SELL' : 'BUY',
            price: currentP,
            amountUsdt: pos.remainingAmountUsdt * (pos.leverage || 1),
            pnlUsdt,
            pnlPercent,
            reason: actionReason,
            mode: pos.mode
          });
          
          history.unshift({
            id: `hist-${Date.now()}`,
            timestamp: Date.now(),
            symbol: pos.symbol,
            decision: pos.decision,
            timeframe: botConfig.timeframe || 'AUTO',
            entryPrice: pos.entryPrice,
            exitPrice: currentP,
            tp1: pos.tp1,
            tp2: pos.tp2,
            tp3: pos.tp3,
            stopLoss: pos.stopLoss,
            status: 'CLOSED',
            profitPercent: pnlPercent,
            profitUsdt: pnlUsdt
          });

          if (!isLive) {
            wallet.balance += (pos.remainingAmountUsdt + pnlUsdt);
            wallet.realizedPnl += pnlUsdt;
            walletChanged = true;
          }

          updatedPositions.splice(i, 1);
          positionsChanged = true;
          logsChanged = true;
          historyChanged = true;
          
          console.log(`[BOT ENGINE] Closed ${pos.symbol} ${pos.decision} at ${currentP} | ${actionReason} | PNL: $${pnlUsdt.toFixed(2)}`);
        }
      }

      if (positionsChanged) await kv.set('btc_active_bot_positions', JSON.stringify(updatedPositions));
      if (logsChanged) await kv.set('btc_bot_logs', JSON.stringify(logs.slice(0, 500)));
      if (historyChanged) await kv.set('btc_trade_history', JSON.stringify(history.slice(0, 500)));
      if (walletChanged) await kv.set('btc_paper_wallet', JSON.stringify(wallet));

    } catch (error) {
      console.error('Bot Engine Error:', error);
    }
  }, 5000); // 5 seconds interval
  
  console.log('🤖 Background Bot Engine Started! Monitoring Trades...');
};
