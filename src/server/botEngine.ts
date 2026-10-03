import { kv } from './db';
import { RiskEngine } from './riskEngine/RiskEngine';
import { RoeEngine, DEFAULT_ROE_CONFIG } from './roeEngine';
import { symbolCooldownMap, scannerState } from './marketScanner.js';
import { strategyManager } from './strategyManager.js';
import { binanceWs } from './binanceWebSocket.js';
import { binanceRestCache } from './binanceRestCache.js';
import { formatBinancePrecisionQty, formatBinancePrecisionPrice, getSymbolFilterRules } from './binancePrecision.js';

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
  MATICUSDT: 0.42,
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
 * Resilient live price fetcher powered by Binance WebSocket Live Stream (Zero REST Rate Limits)
 */
export const fetchSymbolPrice = async (rawSymbol: string, marketType: 'SPOT' | 'FUTURES' = 'FUTURES'): Promise<number> => {
  const symbol = (rawSymbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BTCUSDT';
  const now = Date.now();
  const cacheKey = `${marketType}_${symbol}`;

  // 1. PRIMARY: Instant WebSocket stream price (0ms latency, 0 HTTP weight, immune to IP bans)
  const wsPrice = binanceWs.getPrice(symbol);
  if (wsPrice && wsPrice > 0) {
    priceCache.set(cacheKey, { price: wsPrice, timestamp: now });
    return wsPrice;
  }

  // 2. Check local memory cache (valid up to 10 seconds)
  const cached = priceCache.get(cacheKey);
  if (cached && now - cached.timestamp < 10000) {
    return cached.price;
  }

  // 3. If IP is currently banned by Binance, NEVER hammer REST API
  if (binanceRestCache.isIpBanned()) {
    if (cached && cached.price > 0) return cached.price;
    const fallback = FALLBACK_PRICES[symbol] || 25.0;
    return fallback;
  }

  const futuresEndpoints = [
    `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
    `https://fapi1.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
  ];

  const spotEndpoints = [
    `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`,
  ];

  const endpoints = marketType === 'FUTURES' ? [...futuresEndpoints, ...spotEndpoints] : spotEndpoints;

  for (const url of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await fetch(url, { headers: HTTP_HEADERS, signal: controller.signal });
      clearTimeout(timeout);
      
      if (res.status === 418 || res.status === 429) {
        // IP ban or rate limit hit!
        try {
          const errData: any = await res.json();
          const match = (errData?.msg || '').match(/banned until (\d+)/i);
          const banUntil = match ? parseInt(match[1], 10) : undefined;
          binanceRestCache.recordIpBan(banUntil);
        } catch (_) {
          binanceRestCache.recordIpBan();
        }
        break; // Stop querying REST endpoints immediately
      }

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

// Helper to calculate accurate PnL for both Spot and Futures
const calculatePnl = (pos: any, exitPrice: number) => {
  if (!pos || !pos.entryPrice || pos.entryPrice <= 0 || !exitPrice || exitPrice <= 0) return 0;
  const isLong = pos.decision === 'LONG' || pos.side === 'BUY' || !pos.decision;
  const isSpot = pos.marketType === 'SPOT' || pos.leverage === 1;
  const lev = isSpot ? 1 : (pos.leverage || 1);
  const qty = pos.remainingAmountBtc || pos.initialAmountBtc || (pos.remainingAmountUsdt ? (pos.remainingAmountUsdt / pos.entryPrice) : 0);

  if (isSpot) {
    return (exitPrice - pos.entryPrice) * qty;
  }

  const priceDiffPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1);
  const margin = pos.remainingAmountUsdt || pos.marginUsdt || ((qty * pos.entryPrice) / lev);
  return margin * priceDiffPct * lev;
};

let lastSyncPositionsCount = -1;
let lastSyncTimestamp = 0;

/**
 * Records an alert in the central KV store so it is synced to all connected web clients and Notification Center
 */
export const recordPushAlertDirect = async (alert: {
  title: string;
  body: string;
  type?: string;
  decision?: 'LONG' | 'SHORT' | 'WAIT';
  symbol: string;
}) => {
  try {
    // Spot Mode Filter: Do not emit or record SHORT signal alerts if marketType is SPOT
    if (alert.decision === 'SHORT') {
      try {
        const botCfgStr = await kv.get('btc_bot_config');
        const appMt = await kv.get('app_binance_market_type');
        let isSpot = appMt === 'SPOT';
        if (botCfgStr) {
          const parsed = JSON.parse(botCfgStr);
          if (parsed.marketType === 'SPOT') isSpot = true;
        }
        if (isSpot) {
          return null;
        }
      } catch {}
    }

    const alertsStr = await kv.get('btc_push_alerts');
    const alerts = alertsStr ? JSON.parse(alertsStr) : [];
    const newAlert = {
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: alert.title,
      body: alert.body,
      timestamp: Date.now(),
      type: alert.type || 'SIGNAL',
      decision: alert.decision || 'WAIT',
      symbol: alert.symbol,
      read: false,
    };
    alerts.unshift(newAlert);
    await kv.set('btc_push_alerts', JSON.stringify(alerts.slice(0, 100)));
    return newAlert;
  } catch (err) {
    console.error('[ALERT] Failed to record push alert:', err);
    return null;
  }
};

/**
 * Safely resolves Telegram bot credentials from KV store or system environment
 */
export const getTelegramCredentials = async () => {
  const kvToken = await kv.get('app_telegram_bot_token');
  const kvChatId = await kv.get('app_telegram_chat_id');
  
  const token = (kvToken && kvToken !== 'null' ? kvToken : (process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '')).trim();
  const chatId = (kvChatId && kvChatId !== 'null' ? kvChatId : (process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID || '')).trim();
  
  return { token, chatId };
};

const sentTelegramMessageCache = new Map<string, number>();

export const startTelegramSync = () => {
  if (telegramInterval) clearInterval(telegramInterval);

  telegramInterval = setInterval(async () => {
    try {
      const { token, chatId } = await getTelegramCredentials();
      if (!token || !chatId) return;

      const mode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
      const isLive = mode === 'BINANCE_LIVE';
      const isTestnet = mode === 'BINANCE_TESTNET';
      const isExchange = isLive || isTestnet;

      const kvMarketType = await kv.get('app_binance_market_type');
      const marketType = (kvMarketType === 'SPOT' || kvMarketType === 'FUTURES') ? kvMarketType : 'SPOT';

      const positionsStr = await kv.get('btc_active_bot_positions');
      const allPositions = positionsStr ? JSON.parse(positionsStr) : [];
      
      // --- STRICT MODE & MARKET SEPARATION ---
      const positions = allPositions.filter((p: any) => (p.mode || 'PAPER') === mode && (p.marketType || 'SPOT') === marketType);

      const now = Date.now();
      const isIntervalElapsed = now - lastSyncTimestamp >= 60 * 60 * 1000; // 1 hour periodic health sync

      // Only send periodic summary once per hour (never duplicate individual trade alerts)
      if (!isIntervalElapsed) return;

      lastSyncPositionsCount = positions.length;
      lastSyncTimestamp = now;

      const walletStr = await kv.get('btc_paper_wallet');
      const wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000, realizedPnl: 0 };

      let unrealizedPnl = 0;
      let availableBalance = wallet.balance || 0;
      let totalEquity = wallet.balance || 1000;

      if (isExchange) {
        const realAcc = await fetchRealBinanceAccountDirect();
        if (realAcc.success) {
          availableBalance = realAcc.freeUsdt || 0;
          totalEquity = realAcc.totalUsdtEquity || realAcc.freeUsdt || 0;
        }
      }

      let inTradeMargin = 0;
      if (positions.length > 0) {
        for (const pos of positions) {
          const currentP = await fetchSymbolPrice(pos.symbol, pos.marketType || marketType);
          const posPnl = pos.unrealizedPnlUsdt !== undefined ? pos.unrealizedPnlUsdt : (currentP && currentP > 0 ? calculatePnl(pos, currentP) : 0);
          unrealizedPnl += posPnl;
          inTradeMargin += (pos.marginUsdt || pos.remainingAmountUsdt || 0);
        }
      }

      if (!isExchange) {
        totalEquity = Math.round((wallet.balance + inTradeMargin + unrealizedPnl) * 100) / 100;
      }

      const modeTitle = isLive ? '⚡ Binance Live (حقيقي)' : (isTestnet ? '🧪 Binance Testnet (تجريبي)' : '📝 Paper Trading (وهمي)');
      const marketTitle = marketType === 'SPOT' ? '🪙 Spot Market (سبوت)' : '⚡ USDT-M Futures (عقود)';

      const message = `🤖 <b>Quantura AI Bot - تقرير المزامنة الدورية (ساعة)</b>\n\n` +
                      `🌐 <b>البيئة:</b> ${modeTitle}\n` +
                      `🎯 <b>السوق:</b> ${marketTitle}\n` +
                      `📊 <b>الصفقات النشطة:</b> ${positions.length} صفقة\n` +
                      `📈 <b>الربح اللحظي (Floating PnL):</b> ${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)} USDT\n` +
                      `💵 <b>الرصيد المتاح:</b> $${availableBalance.toFixed(2)} USDT\n` +
                      `🏦 <b>إجمالي قيمة المحفظة:</b> $${totalEquity.toFixed(2)} USDT`;

      await sendServerTelegramNotification(message);

    } catch (error) {
      console.error('Telegram Sync Error:', error);
    }
  }, 60000);

  console.log('📢 Telegram Periodic Smart Sync Started!');
  startTelegramCommandListener();
};

/**
 * Instant Telegram Notification Helper for Trade Events with Deduplication & Plaintext Fallback
 */
export const sendServerTelegramNotification = async (text: string, targetChatId?: string) => {
  try {
    const { token, chatId } = await getTelegramCredentials();
    const destinationChatId = targetChatId || chatId;
    if (!token || !destinationChatId || !text) return;

    // Strict 8-second deduplication: normalized text prevents duplicate identical alerts
    const now = Date.now();
    const normalizedText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const dedupeKey = `${destinationChatId}_${normalizedText}`;
    const lastSentTime = sentTelegramMessageCache.get(dedupeKey);
    if (lastSentTime && (now - lastSentTime < 8000)) {
      console.log(`[TELEGRAM DEDUPE] Dropped duplicate message to ${destinationChatId}`);
      return;
    }
    sentTelegramMessageCache.set(dedupeKey, now);

    // Garbage collect cache
    if (sentTelegramMessageCache.size > 200) {
      for (const [k, v] of sentTelegramMessageCache.entries()) {
        if (now - v > 45000) sentTelegramMessageCache.delete(k);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: destinationChatId,
        text,
        parse_mode: 'HTML',
      }),
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);

    if (res && !res.ok) {
      const errData = await res.json().catch(() => ({}));
      // If HTML entity parsing fails (e.g. unescaped '<' or '>'), fallback to clean plain text
      if (res.status === 400) {
        const plainText = text.replace(/<[^>]*>/g, '');
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: destinationChatId, text: plainText }),
        }).catch(() => {});
      } else if (res.status === 429) {
        console.warn(`[TELEGRAM RATE LIMIT] 429 received from Telegram API: ${errData?.description || 'Too many requests'}.`);
      } else {
        console.warn(`[TELEGRAM ERROR] ${errData?.description || res.statusText}`);
      }
    }
  } catch (err: any) {
    console.warn('[TELEGRAM EXCEPTION]', err?.message);
  }
};

/**
 * Interactive Telegram Inbound Command Processor
 */
let telegramCommandPollingActive = false;
let lastTelegramUpdateOffset = 0;
const processedUpdateIds = new Set<number>();

async function handleTelegramCommand(command: string, argument: string, chatId: string) {
  try {
    switch (command) {
      case '/start':
      case '/help': {
        const helpText = `🤖 <b>Quantura AI Bot - لوحة أوامر التحكم التفاعلية</b>\n\n` +
          `<b>📊 الاستعلام والمراقبة:</b>\n` +
          `• <code>/status</code> - فحص حالة البوت الشاملة (تشغيل/إيقاف، الرصيد، الأرباح، والوضع)\n` +
          `• <code>/balance</code> أو <code>/wallet</code> - رصيد المحفظة الفعلي (Binance / Testnet / Paper)\n` +
          `• <code>/positions</code> أو <code>/pos</code> - الصفقات المفتوحة مع الأرباح اللحظية وأهداف TP/SL\n` +
          `• <code>/history</code> أو <code>/trades</code> - سجل آخر الصفقات المكتملة والأرباح المحققة\n` +
          `• <code>/scan</code> - تقرير فحص رادار السوق لجميع العملات والإشارات\n` +
          `• <code>/signals</code> - أقوى الإشارات ونسب الثقة ومستويات الدخول\n` +
          `• <code>/price [رمز]</code> - السعر اللحظي لأي عملة (مثال: <code>/price btc</code> أو <code>/price dot</code>)\n` +
          `• <code>/risk</code> - تقرير إدارة المخاطر ونسبة التراجع اليومي\n\n` +
          `<b>🤖 التحكم في البوت:</b>\n` +
          `• <code>/start_bot</code> أو <code>/bot on</code> - 🟢 تفعيل وتشغيل التداول الآلي للبوت\n` +
          `• <code>/stop_bot</code> أو <code>/bot off</code> - 🔴 إيقاف التداول الآلي للبوت مؤقتاً\n\n` +
          `<b>🌐 بيئات التنفيذ والتداول:</b>\n` +
          `• <code>/live</code> أو <code>/mode live</code> - ⚡ التداول الحقيقي (Binance Mainnet Live)\n` +
          `• <code>/testnet</code> أو <code>/mode testnet</code> - 🧪 بيئة اختبار بايننس (Binance Testnet)\n` +
          `• <code>/paper</code> أو <code>/mode paper</code> - 📝 بيئة المحاكاة الوهمية (Paper Sandbox)\n\n` +
          `<b>🎯 نوع السوق والرافعة:</b>\n` +
          `• <code>/spot</code> أو <code>/market spot</code> - 🪙 تحويل السوق إلى الفوري (Spot Market)\n` +
          `• <code>/futures</code> أو <code>/market futures</code> - ⚡ تحويل السوق إلى العقود الآجلة (Futures)\n` +
          `• <code>/leverage [1-50]</code> - ضبط الرافعة المالية (مثال: <code>/leverage 5</code>)\n\n` +
          `<b>🚨 أوامر الطوارئ:</b>\n` +
          `• <code>/panic</code> - 🚨 إغلاق طوارئ فوري لجميع الصفقات المفتوحة وتسييل المراكز`;
        await sendServerTelegramNotification(helpText, chatId);
        break;
      }

      // --- 1. BOT AUTOMATION TOGGLE COMMANDS ---
      case '/start_bot':
      case '/enable':
      case '/bot_on': {
        const configStr = await kv.get('btc_bot_config');
        const config = configStr ? JSON.parse(configStr) : {};
        config.enabled = true;
        config.circuitBreakerTripped = false;
        await kv.set('btc_bot_config', JSON.stringify(config));

        const mode = (await kv.get('trading_execution_mode')) || 'PAPER';
        const kvMarketType = await kv.get('app_binance_market_type');
        const marketType = kvMarketType || config.marketType || 'SPOT';
        const activeStratsCount = strategyManager.getActiveStrategies().length;

        const reply = `🟢 <b>تم تشغيل التداول الآلي للبوت بنجاح!</b>\n\n` +
          `• <b>حالة البوت:</b> 🟢 نشط ويعمل تلقائياً (ON)\n` +
          `• <b>بيئة التنفيذ:</b> ${mode === 'BINANCE_LIVE' ? '⚡ Binance Live' : (mode === 'BINANCE_TESTNET' ? '🧪 Binance Testnet' : '📝 Paper Sandbox')}\n` +
          `• <b>السوق:</b> ${marketType === 'SPOT' ? '🪙 Spot Market (سبوت)' : '⚡ USDT-M Futures (عقود)'}\n` +
          `• <b>الاستراتيجيات النشطة:</b> ${activeStratsCount} استراتيجية\n` +
          `• <b>أقصى عدد صفقات:</b> ${config.maxOpenTrades || 3} صفقات\n\n` +
          `سيبدأ البوت الآن بفحص السوق واقتناص أفضل الفرص تلقائياً.\n` +
          `للإيقاف المؤقت أرسل: <code>/stop_bot</code>`;
        await sendServerTelegramNotification(reply, chatId);
        break;
      }

      case '/stop_bot':
      case '/disable':
      case '/bot_off': {
        const configStr = await kv.get('btc_bot_config');
        const config = configStr ? JSON.parse(configStr) : {};
        config.enabled = false;
        await kv.set('btc_bot_config', JSON.stringify(config));

        const reply = `🔴 <b>تم إيقاف التداول الآلي للبوت مؤقتاً!</b>\n\n` +
          `• <b>حالة البوت:</b> 🔴 متوقف (OFF)\n` +
          `لن يقوم البوت بفتح أي صفقات جديدة حتى تعيد تشغيله.\n` +
          `<i>(ملاحظة: الصفقات المفتوحة مسبقاً ستظل خاضعة للمراقبة وأهداف TP/SL لحمايتها).</i>\n\n` +
          `لإعادة التشغيل أرسل: <code>/start_bot</code>`;
        await sendServerTelegramNotification(reply, chatId);
        break;
      }

      case '/bot': {
        const target = (argument || '').toLowerCase().trim();
        if (target === 'on' || target === 'start' || target === 'true' || target === '1') {
          const configStr = await kv.get('btc_bot_config');
          const config = configStr ? JSON.parse(configStr) : {};
          config.enabled = true;
          config.circuitBreakerTripped = false;
          await kv.set('btc_bot_config', JSON.stringify(config));
          await sendServerTelegramNotification(`🟢 <b>تم تشغيل البوت بنجاح (Bot ON)!</b>`, chatId);
        } else if (target === 'off' || target === 'stop' || target === 'false' || target === '0') {
          const configStr = await kv.get('btc_bot_config');
          const config = configStr ? JSON.parse(configStr) : {};
          config.enabled = false;
          await kv.set('btc_bot_config', JSON.stringify(config));
          await sendServerTelegramNotification(`🔴 <b>تم إيقاف البوت مؤقتاً (Bot OFF)!</b>`, chatId);
        } else {
          const configStr = await kv.get('btc_bot_config');
          const config = configStr ? JSON.parse(configStr) : {};
          await sendServerTelegramNotification(`🤖 <b>حالة البوت الحالية:</b> ${config.enabled ? '🟢 مفعل (ON)' : '🔴 متوقف (OFF)'}\n\nللتحكم أرسل:\n• <code>/bot on</code> أو <code>/start_bot</code>\n• <code>/bot off</code> أو <code>/stop_bot</code>`, chatId);
        }
        break;
      }

      // --- 2. EXECUTION ENVIRONMENT MODES ---
      case '/testnet': {
        await kv.set('trading_execution_mode', 'BINANCE_TESTNET');
        await kv.set('app_execution_mode', 'BINANCE_TESTNET');
        await kv.set('app_binance_use_testnet', 'true');
        
        const realAcc = await fetchRealBinanceAccountDirect();
        let reply = `🧪 <b>تم التحويل إلى وضع Binance Testnet Sandbox (بيئة الاختبار)!</b>\n\n`;
        if (realAcc.success) {
          reply += `💰 <b>الرصيد المتاح (Free USDT):</b> $${realAcc.freeUsdt.toFixed(2)} USDT\n` +
            `📊 <b>إجمالي المحفظة (Equity):</b> $${realAcc.totalUsdtEquity.toFixed(2)} USDT\n` +
            `🎯 <b>نوع السوق:</b> ${realAcc.marketType}\n` +
            `🟢 <b>حالة الاتصال:</b> تم الاتصال بنجاح (${realAcc.latencyMs || 24}ms)\n` +
            `🔐 <b>صلاحية التداول:</b> ${realAcc.canTrade ? '🟢 مفعّلة' : '🔴 مقيدة'}\n`;
        } else {
          reply += `⚠️ <b>تنبيه الاتصال:</b> ${realAcc.error || 'يرجى مراجعة مفاتيح API الخاصة بـ Testnet في الإعدادات'}\n`;
        }
        reply += `\nللتحويل للتداول الحقيقي أرسل: <code>/live</code> | للمحفظة الوهمية: <code>/paper</code>`;
        await sendServerTelegramNotification(reply, chatId);
        break;
      }

      case '/live':
      case '/real': {
        await kv.set('trading_execution_mode', 'BINANCE_LIVE');
        await kv.set('app_execution_mode', 'BINANCE_LIVE');
        await kv.set('app_binance_use_testnet', 'false');

        const realAcc = await fetchRealBinanceAccountDirect();
        let reply = `⚡ <b>تم تفعيل وضع التداول الحقيقي (Binance Mainnet Live)!</b>\n\n` +
          `سيقوم الروبوت بتنفيذ الأوامر بأموال حقيقية على حسابك في بايننس.\n\n`;
        if (realAcc.success) {
          reply += `💰 <b>رصيد Binance المتاح:</b> $${realAcc.freeUsdt.toFixed(2)} USDT\n` +
            `📊 <b>إجمالي قيمة المحفظة:</b> $${realAcc.totalUsdtEquity.toFixed(2)} USDT\n` +
            `🎯 <b>السوق:</b> ${realAcc.marketType}\n` +
            `🔐 <b>صلاحية التداول:</b> ${realAcc.canTrade ? '🟢 مفعّلة' : '🔴 صلاحية التداول مقيدة'}\n` +
            `⚡ <b>سرعة الاستجابة:</b> ${realAcc.latencyMs || 20}ms\n`;
        } else {
          reply += `⚠️ <b>تنبيه الاتصال:</b> ${realAcc.error || 'يرجى مراجعة مفاتيح API'}\n`;
        }
        reply += `\nللإلغاء والعودة لبيئة الاختبار أرسل: <code>/testnet</code> أو <code>/paper</code>`;
        await sendServerTelegramNotification(reply, chatId);
        break;
      }

      case '/paper':
      case '/sandbox': {
        await kv.set('trading_execution_mode', 'PAPER');
        await kv.set('app_execution_mode', 'PAPER');
        const walletStr = await kv.get('btc_paper_wallet');
        const wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000, realizedPnl: 0 };
        const reply = `📝 <b>تم التحويل إلى وضع المحفظة الوهمية (Paper Sandbox)!</b>\n\n` +
          `• <b>الرصيد التجريبي المتاح:</b> $${wallet.balance.toFixed(2)} USDT\n` +
          `• <b>الأرباح المحققة:</b> $${wallet.realizedPnl.toFixed(2)} USDT\n\n` +
          `للتحويل للتست نت أرسل: <code>/testnet</code> | للتداول الحقيقي: <code>/live</code>`;
        await sendServerTelegramNotification(reply, chatId);
        break;
      }

      case '/mode': {
        const target = (argument || '').toLowerCase().trim();
        if (target === 'live' || target === 'real') {
          await kv.set('trading_execution_mode', 'BINANCE_LIVE');
          await kv.set('app_execution_mode', 'BINANCE_LIVE');
          await kv.set('app_binance_use_testnet', 'false');
          const realAcc = await fetchRealBinanceAccountDirect();
          let reply = `⚡ <b>تم تفعيل وضع التداول الحقيقي (Binance Live)!</b>\n\n`;
          if (realAcc.success) {
            reply += `💰 <b>رصيد Binance المتاح:</b> $${realAcc.freeUsdt.toFixed(2)} USDT\n` +
              `📊 <b>إجمالي المحفظة:</b> $${realAcc.totalUsdtEquity.toFixed(2)} USDT\n`;
          }
          await sendServerTelegramNotification(reply, chatId);
        } else if (target === 'testnet' || target === 'test') {
          await kv.set('trading_execution_mode', 'BINANCE_TESTNET');
          await kv.set('app_execution_mode', 'BINANCE_TESTNET');
          await kv.set('app_binance_use_testnet', 'true');
          const realAcc = await fetchRealBinanceAccountDirect();
          let reply = `🧪 <b>تم التحويل إلى وضع Binance Testnet Sandbox!</b>\n\n`;
          if (realAcc.success) {
            reply += `💰 <b>رصيد Testnet المتاح:</b> $${realAcc.freeUsdt.toFixed(2)} USDT\n`;
          }
          await sendServerTelegramNotification(reply, chatId);
        } else if (target === 'paper' || target === 'sandbox') {
          await kv.set('trading_execution_mode', 'PAPER');
          await kv.set('app_execution_mode', 'PAPER');
          await sendServerTelegramNotification(`📝 <b>تم التحويل إلى وضع المحفظة الوهمية (Paper Sandbox).</b>`, chatId);
        } else {
          const currentMode = (await kv.get('trading_execution_mode')) || 'PAPER';
          let modeLabel = '📝 Paper Sandbox (وهمي)';
          if (currentMode === 'BINANCE_LIVE') modeLabel = '⚡ Binance Live (حقيقي)';
          if (currentMode === 'BINANCE_TESTNET') modeLabel = '🧪 Binance Testnet (تجريبي)';
          await sendServerTelegramNotification(`⚙️ <b>وضع التنفيذ الحالي:</b> ${modeLabel}\n\nللتبديل أرسل:\n• <code>/testnet</code> (بيئة الاختبار)\n• <code>/live</code> (التداول الحقيقي)\n• <code>/paper</code> (المحاكاة الوهمية)`, chatId);
        }
        break;
      }

      // --- 3. MARKET TYPE & LEVERAGE ---
      case '/spot': {
        await kv.set('app_binance_market_type', 'SPOT');
        binanceWs.setMarketType('SPOT');
        const configStr = await kv.get('btc_bot_config');
        const config = configStr ? JSON.parse(configStr) : {};
        config.marketType = 'SPOT';
        config.leverage = 1;
        await kv.set('btc_bot_config', JSON.stringify(config));

        await sendServerTelegramNotification(
          `🪙 <b>تم ضبط السوق على: التداول الفوري (Binance Spot Market)!</b>\n\n` +
          `• <b>نوع السوق:</b> SPOT (شراء وتملك أصول العملات الحقيقية)\n` +
          `• <b>الرافعة المالية:</b> 1x (بدون رافعة / بدون رسوم تمويل)\n` +
          `• <b>الاتجاه:</b> الشراء فقط (Long / Buy Only)\n` +
          `• <b>ملاحظة:</b> تم تعطيل سوق العقود الآجلة (Futures) بالكامل!\n\n` +
          `للتحويل إلى العقود الآجلة أرسل: <code>/futures</code>`,
          chatId
        );
        break;
      }

      case '/futures': {
        await kv.set('app_binance_market_type', 'FUTURES');
        binanceWs.setMarketType('FUTURES');
        const configStr = await kv.get('btc_bot_config');
        const config = configStr ? JSON.parse(configStr) : {};
        config.marketType = 'FUTURES';
        if (!config.leverage || config.leverage < 2) config.leverage = 5;
        await kv.set('btc_bot_config', JSON.stringify(config));

        await sendServerTelegramNotification(
          `⚡ <b>تم ضبط السوق على: العقود الآجلة (USDT-M Futures)!</b>\n\n` +
          `• <b>نوع السوق:</b> FUTURES (عقود المشتقات)\n` +
          `• <b>الرافعة المالية:</b> ${config.leverage}x\n` +
          `• <b>الاتجاهات المدعومة:</b> صفقات الشراء (LONG) والبيع (SHORT)\n` +
          `• <b>ملاحظة:</b> تم تعطيل سوق التداول الفوري (Spot) بالكامل!\n\n` +
          `لتغيير الرافعة أرسل: <code>/leverage 5</code> أو <code>/leverage 10</code>\n` +
          `للتحويل للتداول الفوري أرسل: <code>/spot</code>`,
          chatId
        );
        break;
      }

      case '/market': {
        const target = (argument || '').toUpperCase().trim();
        if (target === 'SPOT') {
          await kv.set('app_binance_market_type', 'SPOT');
          binanceWs.setMarketType('SPOT');
          const configStr = await kv.get('btc_bot_config');
          const config = configStr ? JSON.parse(configStr) : {};
          config.marketType = 'SPOT';
          config.leverage = 1;
          await kv.set('btc_bot_config', JSON.stringify(config));
          await sendServerTelegramNotification(`🪙 <b>تم التحويل إلى سوق السبوت (Spot Market) وتعطيل العقود الآجلة.</b>`, chatId);
        } else if (target === 'FUTURES') {
          await kv.set('app_binance_market_type', 'FUTURES');
          binanceWs.setMarketType('FUTURES');
          const configStr = await kv.get('btc_bot_config');
          const config = configStr ? JSON.parse(configStr) : {};
          config.marketType = 'FUTURES';
          await kv.set('btc_bot_config', JSON.stringify(config));
          await sendServerTelegramNotification(`⚡ <b>تم التحويل إلى سوق العقود الآجلة (USDT-M Futures) وتعطيل السبوت.</b>`, chatId);
        } else {
          const kvMt = (await kv.get('app_binance_market_type')) || 'SPOT';
          await sendServerTelegramNotification(`🎯 <b>نوع السوق الحالي:</b> ${kvMt}\n\nللتبديل أرسل:\n• <code>/spot</code> أو <code>/market spot</code>\n• <code>/futures</code> أو <code>/market futures</code>`, chatId);
        }
        break;
      }

      case '/leverage':
      case '/lev': {
        const val = parseInt(argument, 10);
        if (isNaN(val) || val < 1 || val > 50) {
          const configStr = await kv.get('btc_bot_config');
          const config = configStr ? JSON.parse(configStr) : {};
          await sendServerTelegramNotification(`⚙️ <b>الرافعة المالية الحالية:</b> ${config.leverage || 5}x\n\nلتغيير الرافعة، أرسل رقم بين 1 و 50 (مثال: <code>/leverage 5</code> أو <code>/leverage 10</code>).`, chatId);
          break;
        }

        const configStr = await kv.get('btc_bot_config');
        const config = configStr ? JSON.parse(configStr) : {};
        config.leverage = val;
        await kv.set('btc_bot_config', JSON.stringify(config));

        await sendServerTelegramNotification(`🎯 <b>تم تعديل الرافعة المالية بنجاح إلى: ${val}x</b>`, chatId);
        break;
      }

      // --- 4. STATUS & BALANCE & METRICS ---
      case '/status': {
        const configStr = await kv.get('btc_bot_config');
        const config = configStr ? JSON.parse(configStr) : {};
        const isBotEnabled = !!config.enabled;
        const mode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
        const isLive = mode === 'BINANCE_LIVE';
        const isTestnet = mode === 'BINANCE_TESTNET';
        const isExchange = isLive || isTestnet;

        const kvMarketType = await kv.get('app_binance_market_type');
        const marketType = (kvMarketType === 'SPOT' || kvMarketType === 'FUTURES') ? kvMarketType : (config.marketType || 'SPOT');

        const positionsStr = await kv.get('btc_active_bot_positions');
        const allPositions = positionsStr ? JSON.parse(positionsStr) : [];
        const positions = allPositions.filter((p: any) => (p.mode || 'PAPER') === mode && (p.marketType || 'SPOT') === marketType);

        let unrealizedPnl = 0;
        let inTradeMargin = 0;
        for (const pos of positions) {
          const currentP = await fetchSymbolPrice(pos.symbol, pos.marketType || marketType);
          const pnl = pos.unrealizedPnlUsdt !== undefined ? pos.unrealizedPnlUsdt : (currentP && currentP > 0 ? calculatePnl(pos, currentP) : 0);
          unrealizedPnl += pnl;
          inTradeMargin += (pos.marginUsdt || pos.remainingAmountUsdt || 0);
        }

        const walletStr = await kv.get('btc_paper_wallet');
        const wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000, realizedPnl: 0 };

        let availableBalance = wallet.balance || 0;
        let totalEquity = Math.round((wallet.balance + inTradeMargin + unrealizedPnl) * 100) / 100;
        let canTradeStatus = true;
        let latencyMs = 24;

        if (isExchange) {
          const realAccount = await fetchRealBinanceAccountDirect();
          if (realAccount.success) {
            availableBalance = realAccount.freeUsdt || 0;
            totalEquity = realAccount.totalUsdtEquity || realAccount.freeUsdt || 0;
            inTradeMargin = realAccount.inTradeMargin || inTradeMargin;
            canTradeStatus = realAccount.canTrade ?? true;
            latencyMs = realAccount.latencyMs || 24;
          }
        }

        const activeStrats = strategyManager.getActiveStrategies();
        const modeLabel = isLive ? '⚡ Binance Live (حقيقي)' : (isTestnet ? '🧪 Binance Testnet (تجريبي)' : '📝 Paper Sandbox (وهمي)');
        const marketLabel = marketType === 'SPOT' ? '🪙 Spot Market (سبوت)' : `⚡ USDT-M Futures (${config.leverage || 5}x)`;

        let statusText = `📊 <b>Quantura Trading Engine - الحالة العامة</b>\n\n` +
          `• <b>تشغيل الروبوت:</b> ${isBotEnabled ? '🟢 مفعل (ON)' : '🔴 متوقف (OFF)'}\n` +
          `• <b>بيئة التنفيذ:</b> ${modeLabel}\n` +
          `• <b>نوع السوق:</b> ${marketLabel}\n` +
          `• <b>الصفقات النشطة:</b> ${positions.length} / ${config.maxOpenTrades || 3} صفقات\n` +
          `• <b>الربح اللحظي العائم:</b> ${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)} USDT\n` +
          `• <b>الرصيد المتاح (Free):</b> $${availableBalance.toFixed(2)} USDT\n` +
          `• <b>الهامش في الصفقات:</b> $${inTradeMargin.toFixed(2)} USDT\n` +
          `• <b>إجمالي قيمة المحفظة (Equity):</b> $${totalEquity.toFixed(2)} USDT\n` +
          `• <b>الأرباح المحققة:</b> $${(wallet.realizedPnl || 0).toFixed(2)} USDT\n` +
          `• <b>الاستراتيجيات النشطة:</b> ${activeStrats.length} استراتيجية\n` +
          `• <b>صلاحية التداول:</b> ${canTradeStatus ? '🟢 مفعّلة' : '🔴 مقيدة'}\n` +
          `• <b>سرعة الاستجابة:</b> ${latencyMs}ms\n` +
          `• <b>التوقيت:</b> ${new Date().toLocaleTimeString()}`;

        await sendServerTelegramNotification(statusText, chatId);
        break;
      }

      case '/balance':
      case '/wallet': {
        const mode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
        const isLive = mode === 'BINANCE_LIVE';
        const isTestnet = mode === 'BINANCE_TESTNET';
        const isExchange = isLive || isTestnet;
        const kvMarketType = await kv.get('app_binance_market_type');
        const marketType = kvMarketType || 'SPOT';

        const positionsStr = await kv.get('btc_active_bot_positions');
        const allPositions = positionsStr ? JSON.parse(positionsStr) : [];
        const positions = allPositions.filter((p: any) => (p.mode || 'PAPER') === mode && (p.marketType || 'SPOT') === marketType);

        let unrealizedPnl = 0;
        let inTradeMargin = 0;
        for (const pos of positions) {
          const currentP = await fetchSymbolPrice(pos.symbol, pos.marketType || marketType);
          const pnl = pos.unrealizedPnlUsdt !== undefined ? pos.unrealizedPnlUsdt : (currentP && currentP > 0 ? calculatePnl(pos, currentP) : 0);
          unrealizedPnl += pnl;
          inTradeMargin += (pos.marginUsdt || pos.remainingAmountUsdt || 0);
        }

        let balText = `💼 <b>تقرير رصيد المحفظة الشامل</b>\n\n`;

        if (isExchange) {
          const realAcc = await fetchRealBinanceAccountDirect();
          const netName = isTestnet ? 'Binance Testnet Sandbox' : 'Binance Mainnet Live';
          if (realAcc.success) {
            balText += `🌐 <b>شبكة: ${netName} (${realAcc.marketType || marketType})</b>\n` +
              `• <b>الرصيد المتاح للتداول (Free USDT):</b> $${realAcc.freeUsdt.toFixed(2)} USDT\n` +
              `• <b>إجمالي قيمة المحفظة (Total Equity):</b> $${realAcc.totalUsdtEquity.toFixed(2)} USDT\n` +
              `• <b>الهامش المستثمر في الصفقات:</b> $${(realAcc.inTradeMargin || inTradeMargin).toFixed(2)} USDT\n` +
              `• <b>الربح اللحظي العائم (Floating PnL):</b> ${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)} USDT\n` +
              `• <b>صلاحية التداول:</b> ${realAcc.canTrade ? '🟢 مفعّلة (canTrade: OK)' : '🔴 مقيدة (راجع مفاتيح API)'}\n` +
              `• <b>زمن الاستجابة:</b> ${realAcc.latencyMs || 20}ms\n`;
          } else {
            const walletStr = await kv.get('btc_paper_wallet');
            const wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000, realizedPnl: 0 };
            const paperEquity = Math.round((wallet.balance + inTradeMargin + unrealizedPnl) * 100) / 100;
            
            balText += `⚠️ <b>مفاتيح Binance API غير متصلة بالسيرفر:</b>\n` +
              `• لم يتم العثور على مفاتيح API صالحة محفوظة على السيرفر لوضع <b>${netName}</b>.\n` +
              `• <b>لربط المفاتيح:</b> افتح نافذة <b>Binance API Settings</b> في التطبيق، وأدخل مفاتيحك ثم اضغط <b>Save / حفظ</b>.\n` +
              `• <b>أو للتبديل لوضع المحاكاة:</b> أرسل الأمر <code>/paper</code>.\n\n` +
              `📝 <b>رصيد محفظة المحاكاة (Paper Sandbox):</b>\n` +
              `• <b>الرصيد المتاح (Free):</b> $${wallet.balance.toFixed(2)} USDT\n` +
              `• <b>إجمالي قيمة المحفظة (Equity):</b> $${paperEquity.toFixed(2)} USDT\n`;
          }
        } else {
          const walletStr = await kv.get('btc_paper_wallet');
          const wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000, realizedPnl: 0 };
          const paperEquity = Math.round((wallet.balance + inTradeMargin + unrealizedPnl) * 100) / 100;
          balText += `📝 <b>محفظة المحاكاة الوهمية (Paper Sandbox):</b>\n` +
            `• <b>الرصيد المتاح (Free Cash):</b> $${wallet.balance.toFixed(2)} USDT\n` +
            `• <b>الهامش في الصفقات (In-Trade):</b> $${inTradeMargin.toFixed(2)} USDT\n` +
            `• <b>الربح اللحظي العائم (Floating PnL):</b> ${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)} USDT\n` +
            `• <b>إجمالي قيمة المحفظة (Total Equity):</b> $${paperEquity.toFixed(2)} USDT\n` +
            `• <b>الأرباح المحققة (Realized PnL):</b> $${wallet.realizedPnl.toFixed(2)} USDT\n` +
            `• <b>الإيداع المبدئي:</b> $1,000.00 USDT\n`;
        }

        balText += `\n⏱️ <b>التوقيت:</b> ${new Date().toLocaleTimeString()}`;
        await sendServerTelegramNotification(balText, chatId);
        break;
      }

      case '/positions':
      case '/pos': {
        const mode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
        const kvMarketType = await kv.get('app_binance_market_type');
        const defaultMt = kvMarketType || 'SPOT';

        const positionsStr = await kv.get('btc_active_bot_positions');
        const allPositions = positionsStr ? JSON.parse(positionsStr) : [];
        const positions = allPositions.filter((p: any) => (p.mode || 'PAPER') === mode && (p.marketType || 'SPOT') === defaultMt);

        const modeName = mode === 'BINANCE_LIVE' ? 'Live' : (mode === 'BINANCE_TESTNET' ? 'Testnet' : 'Paper');

        if (!Array.isArray(positions) || positions.length === 0) {
          await sendServerTelegramNotification(
            `ℹ️ <b>لا توجد صفقات مفتوحة حالياً في وضع ${modeName} لسوق ${defaultMt}.</b>\n` +
            `رادار السوق في حالة ترصد وبانتظار تشكل فرص ذات موثوقية عالية.`,
            chatId
          );
          break;
        }

        let msg = `📋 <b>الصفقات المفتوحة حالياً (${modeName} - ${positions.length} صفقات):</b>\n\n`;
        for (let i = 0; i < positions.length; i++) {
          const pos = positions[i];
          const posMt = pos.marketType || defaultMt;
          const currentP = await fetchSymbolPrice(pos.symbol, posMt);
          const posPrice = (currentP && currentP > 0) ? currentP : (pos.currentPrice || pos.entryPrice);
          const pnl = pos.unrealizedPnlUsdt !== undefined ? pos.unrealizedPnlUsdt : (posPrice ? calculatePnl(pos, posPrice) : 0);
          const isLong = pos.decision === 'LONG' || pos.side === 'BUY' || !pos.decision;
          const lev = posMt === 'SPOT' ? 1 : (pos.leverage || 1);
          const margin = pos.marginUsdt || pos.remainingAmountUsdt || 0;
          const roe = pos.roePercent !== undefined ? pos.roePercent : (margin > 0 ? (pnl / margin) * 100 : 0);
          const sign = pnl >= 0 ? '+' : '';

          msg += `<b>${i + 1}. ${pos.symbol}</b> [${isLong ? '🟢 LONG' : '🔴 SHORT'} ${lev}x - ${posMt}]\n` +
            `• <b>سعر الدخول:</b> $${pos.entryPrice}\n` +
            `• <b>السعر اللحظي:</b> $${posPrice ? posPrice.toFixed(posPrice < 10 ? 4 : 2) : 'N/A'}\n` +
            `• <b>الربح اللحظي:</b> ${sign}$${pnl.toFixed(2)} (${sign}${roe.toFixed(1)}% ROE)\n` +
            `• <b>الهامش:</b> $${margin.toFixed(2)} USDT\n` +
            `• <b>الهدف TP1:</b> $${pos.tp1 || '-'}\n` +
            `• <b>وقف الخسارة SL:</b> $${pos.stopLoss || '-'}\n` +
            `• <b>الاستراتيجية:</b> ${pos.strategyName || 'Quantitative Signal'}\n\n`;
        }

        await sendServerTelegramNotification(msg.trim(), chatId);
        break;
      }

      // --- 5. TRADE HISTORY & METRICS ---
      case '/history':
      case '/trades': {
        const histStr = await kv.get('btc_trade_history');
        const history: any[] = histStr ? JSON.parse(histStr) : [];
        if (history.length === 0) {
          await sendServerTelegramNotification(`ℹ️ لا توجد صفقات مغلقة مسجلة في السجل حتى الآن.`, chatId);
          break;
        }

        const recent = history.slice(0, 6);
        let histText = `📜 <b>سجل آخر الصفقات المكتملة (${recent.length}):</b>\n\n`;
        for (let i = 0; i < recent.length; i++) {
          const t = recent[i];
          const isWin = (t.profitUsdt || t.pnlUsdt || 0) >= 0;
          const emoji = isWin ? '🟢' : '🔴';
          const pnlVal = t.profitUsdt ?? t.pnlUsdt ?? 0;
          const pnlPct = t.profitPercent ?? t.pnlPercent ?? 0;
          const sign = pnlVal >= 0 ? '+' : '';

          histText += `${emoji} <b>${i + 1}. ${t.symbol}</b> (${t.decision || t.type})\n` +
            `• <b>الدخول:</b> $${t.entryPrice || 0} | <b>الخروج:</b> $${t.exitPrice || 0}\n` +
            `• <b>النتيجة:</b> ${sign}$${Number(pnlVal).toFixed(2)} (${sign}${Number(pnlPct).toFixed(2)}%)\n` +
            `• <b>سبب الإغلاق:</b> ${t.reason || t.exitReason || t.status || 'Take Profit'}\n` +
            `• <b>التوقيت:</b> ${t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : 'مؤخراً'}\n\n`;
        }

        await sendServerTelegramNotification(histText.trim(), chatId);
        break;
      }

      case '/risk':
      case '/metrics': {
        const configStr = await kv.get('btc_bot_config');
        const config = configStr ? JSON.parse(configStr) : {};
        const histStr = await kv.get('btc_trade_history');
        const history: any[] = histStr ? JSON.parse(histStr) : [];
        
        const totalTrades = history.length;
        const winTrades = history.filter((t: any) => (t.profitUsdt || t.pnlUsdt || 0) > 0).length;
        const winRate = totalTrades > 0 ? ((winTrades / totalTrades) * 100).toFixed(1) : '0.0';
        const totalRealizedPnl = history.reduce((acc: number, t: any) => acc + (t.profitUsdt || t.pnlUsdt || 0), 0);

        const riskText = `🛡️ <b>تقرير إدارة المخاطر والأداء (Risk & Performance)</b>\n\n` +
          `• <b>نسبة نجاح الصفقات (Win Rate):</b> ${winRate}%\n` +
          `• <b>إجمالي الصفقات المكتملة:</b> ${totalTrades} صفقة (${winTrades} رابحة)\n` +
          `• <b>إجمالي الأرباح المحققة:</b> ${totalRealizedPnl >= 0 ? '+' : ''}$${totalRealizedPnl.toFixed(2)} USDT\n` +
          `• <b>أقصى تراجع يومي مسموح (Daily Drawdown Limit):</b> ${config.dailyDrawdownLimitPercent || 5}%\n` +
          `• <b>توزيع رأس المال لكل صفقة:</b> ${config.tradeAllocationPercent || 25}%\n` +
          `• <b>أقصى عدد صفقات متزامنة:</b> ${config.maxOpenTrades || 3} صفقات\n` +
          `• <b>قاطع الدائرة الآلي (Circuit Breaker):</b> ${config.circuitBreakerTripped ? '🔴 نشط (حماية رأس المال)' : '🟢 سليم'}`;

        await sendServerTelegramNotification(riskText, chatId);
        break;
      }

      // --- 6. SCANNER, SIGNALS & PRICE CHECK ---
      case '/signals':
      case '/signal': {
        const states = (scannerState as any)?.symbolStates || {};
        const entries = Object.values(states).filter((s: any) => s.price && s.price > 0 && s.signalDirection && s.signalDirection !== 'WAIT');

        if (entries.length === 0) {
          await sendServerTelegramNotification(`🎯 <b>إشارات التداول اللحظية:</b>\nلا توجد إشارات اختراق نشطة الآن. الرادار يمسح السوق باستمرار.`, chatId);
          break;
        }

        let sigText = `🎯 <b>أحدث الإشارات المرصودة من رادار الاستراتيجيات:</b>\n\n`;
        entries.slice(0, 5).forEach((s: any, idx: number) => {
          const isLong = s.signalDirection === 'LONG' || s.signalDirection === 'BUY';
          sigText += `<b>${idx + 1}. ${s.symbol}</b> [${isLong ? '🟢 شراء LONG' : '🔴 بيع SHORT'}]\n` +
            `• <b>الاستراتيجية:</b> ${s.strategyName || 'Quantitative AI'}\n` +
            `• <b>نسبة الثقة:</b> ${s.confidence || 80}%\n` +
            `• <b>سعر الدخول المقترح:</b> $${s.price}\n` +
            `• <b>الهدف TP1:</b> $${s.tp1 || '-'}\n` +
            `• <b>وقف الخسارة SL:</b> $${s.stopLoss || '-'}\n\n`;
        });

        await sendServerTelegramNotification(sigText.trim(), chatId);
        break;
      }

      case '/price': {
        let sym = (argument || 'BTC').toUpperCase().trim();
        if (!sym.endsWith('USDT')) sym += 'USDT';
        const kvMarketType = await kv.get('app_binance_market_type');
        const mt = (kvMarketType === 'SPOT' || kvMarketType === 'FUTURES') ? kvMarketType : 'SPOT';
        const price = await fetchSymbolPrice(sym, mt);
        if (price && price > 0) {
          await sendServerTelegramNotification(
            `🪙 <b>السعر المباشر: ${sym} (${mt})</b>\n\n` +
            `💰 <b>السعر:</b> $${price.toFixed(price < 10 ? 4 : 2)} USDT\n` +
            `⏱️ <b>التوقيت:</b> ${new Date().toLocaleTimeString()}`,
            chatId
          );
        } else {
          await sendServerTelegramNotification(`⚠️ لم يتم العثور على سعر للرمز: <b>${sym}</b>`, chatId);
        }
        break;
      }

      case '/scan': {
        const states = (scannerState as any)?.symbolStates || {};
        const entries = Object.values(states).filter((s: any) => s.price && s.price > 0);
        if (entries.length === 0) {
          await sendServerTelegramNotification(`⚡ <b>رادار السوق الشامل (Scanner):</b>\nجاري مسح الأزواج وتحديث المؤشرات، حاول بعد قليل.`, chatId);
          break;
        }

        const signalEntries = entries.filter((s: any) => s.signalDirection && s.signalDirection !== 'WAIT');
        let scanText = `⚡ <b>نتائج مسح رادار السوق (Global Scanner)</b>\n\n` +
          `• <b>عدد الأزواج المراقبة:</b> ${entries.length} زوج\n`;

        if (signalEntries.length > 0) {
          scanText += `\n🎯 <b>الإشارات النشطة المرصودة:</b>\n`;
          signalEntries.slice(0, 5).forEach((s: any) => {
            scanText += `• <b>${s.symbol}</b>: ${s.signalDirection} (ثقة: ${s.confidence || 75}%) | السعر: $${s.price}\n`;
          });
        } else {
          scanText += `\nالسوق حالياً في مرحلة توازن وترقب (لا توجد إشارات اختراق مفرطة المخاطر).`;
        }

        await sendServerTelegramNotification(scanText, chatId);
        break;
      }

      // --- 7. EMERGENCY COMMANDS ---
      case '/panic': {
        const res = await panicCloseAllDirect();
        if (res.success) {
          await sendServerTelegramNotification(`🚨 <b>تم تنفيذ أمر إغلاق الطوارئ (PANIC CLOSE)!</b>\n\nتم إغلاق وتصفية جميع الصفقات المفتوحة (${res.closedCount} صفقة) وتسييل المراكز للحفاظ على رأس المال.`, chatId);
        } else {
          await sendServerTelegramNotification(`⚠️ فشل تنفيذ أمر الإغلاق الطارئ: ${res.error || 'لا توجد صفقات مفتوحة'}`, chatId);
        }
        break;
      }

      default:
        await sendServerTelegramNotification(
          `❓ أمر غير معروف: <code>${command}</code>\n` +
          `أرسل <code>/help</code> لعرض قائمة الأوامر الكاملة والمحدثة.`,
          chatId
        );
        break;
    }
  } catch (err: any) {
    console.error('Error handling Telegram command:', err);
  }
}

export const startTelegramCommandListener = async () => {
  if (telegramCommandPollingActive) return;
  telegramCommandPollingActive = true;

  // Restore persistent lastTelegramUpdateOffset from KV
  try {
    const savedOffset = await kv.get('last_telegram_update_offset');
    if (savedOffset) {
      const parsed = parseInt(savedOffset, 10);
      if (!isNaN(parsed) && parsed > lastTelegramUpdateOffset) {
        lastTelegramUpdateOffset = parsed;
      }
    }
  } catch {}

  const localInstanceId = `quantura_${process.pid}_${Math.random().toString(36).substring(2, 8)}`;

  const pollLoop = async () => {
    try {
      if (process.env.DISABLE_TELEGRAM_POLLING === 'true') {
        setTimeout(pollLoop, 15000);
        return;
      }

      const { token, chatId } = await getTelegramCredentials();
      if (token && chatId) {
        // --- DISTRIBUTED LEASE LOCK ---
        // Guarantees only ONE server instance (VPS or preview) handles Telegram commands
        // Lease lasts 12 seconds; active poller renews every iteration
        const now = Date.now();
        let isLeader = false;
        try {
          const leaseData = await kv.get('telegram_poller_lease');
          if (leaseData) {
            const lease = JSON.parse(leaseData);
            if (lease.instanceId === localInstanceId || now > (lease.expiresAt || 0)) {
              await kv.set('telegram_poller_lease', JSON.stringify({ instanceId: localInstanceId, expiresAt: now + 12000 }));
              isLeader = true;
            } else {
              isLeader = false;
            }
          } else {
            await kv.set('telegram_poller_lease', JSON.stringify({ instanceId: localInstanceId, expiresAt: now + 12000 }));
            isLeader = true;
          }
        } catch {
          isLeader = true;
        }

        if (!isLeader) {
          // Another instance is already the active Telegram leader; yield to prevent duplicates
          setTimeout(pollLoop, 6000);
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastTelegramUpdateOffset}&timeout=5`;
        const res = await fetch(url, { signal: controller.signal }).catch(() => null);
        clearTimeout(timeout);

        if (res && res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              if (processedUpdateIds.has(update.update_id)) continue;
              processedUpdateIds.add(update.update_id);
              if (processedUpdateIds.size > 2000) {
                const first = processedUpdateIds.values().next().value;
                if (first !== undefined) processedUpdateIds.delete(first);
              }

              lastTelegramUpdateOffset = Math.max(lastTelegramUpdateOffset, update.update_id + 1);
              await kv.set('last_telegram_update_offset', String(lastTelegramUpdateOffset));

              const msg = update.message;
              if (!msg || !msg.text) continue;

              // Security gate: only accept commands from authorized chatId
              if (String(msg.chat?.id) !== String(chatId)) {
                continue;
              }

              // Deduplication by Telegram message_id across processes
              const msgKey = `tg_handled_msg_${msg.message_id}`;
              const alreadyHandled = await kv.get(msgKey);
              if (alreadyHandled) {
                continue;
              }
              await kv.set(msgKey, String(now));

              const rawText = msg.text.trim();
              if (!rawText.startsWith('/')) continue;

              const parts = rawText.split(/\s+/);
              const cmd = parts[0].toLowerCase().split('@')[0];
              const arg = parts.slice(1).join(' ').trim();

              console.log(`[TELEGRAM] Executing single command: ${cmd} (msgId: ${msg.message_id})`);
              await handleTelegramCommand(cmd, arg, chatId);
            }
          }
        }
      } else {
        // Missing credentials - check periodically without log spam or CPU waste
        setTimeout(pollLoop, 15000);
        return;
      }
    } catch (e: any) {
      // Non-fatal network error
    }

    setTimeout(pollLoop, 3500);
  };

  pollLoop();
  console.log('🤖 Interactive Telegram Single-Leader Command Listener Started!');
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

// Add helper to fetch binance config from KV or process.env
const getBinanceConfig = async () => {
  const envCreds = getEnvBinanceCredentials();
  const kvTestnet = await kv.get('app_binance_use_testnet');
  const kvMarketType = await kv.get('app_binance_market_type');

  let dbKey = '';
  let dbSecret = '';
  let dbTestnet: boolean | null = null;
  let dbMarketType: 'SPOT' | 'FUTURES' | null = null;

  const storedStr = await kv.get('binance_api_config');
  if (storedStr) {
    try {
      const parsed = JSON.parse(storedStr);
      const parsedKey = (parsed.apiKey || '').trim();
      const parsedSecret = (decryptSecret(parsed.apiSecret) || '').trim();
      if (isValidBinanceKey(parsedKey)) {
        dbKey = parsedKey;
      }
      if (isValidBinanceSecret(parsedSecret)) {
        dbSecret = parsedSecret;
      }
      if (parsed.useTestnet !== undefined) {
        dbTestnet = Boolean(parsed.useTestnet);
      }
      if (parsed.marketType) {
        dbMarketType = parsed.marketType;
      }
    } catch(e) {}
  }

  const legacyKey = (await kv.get('app_binance_api_key') || '').trim();
  const legacySecret = (await kv.get('app_binance_api_secret') || '').trim();
  if (isValidBinanceKey(legacyKey) && !dbKey) dbKey = legacyKey;
  if (isValidBinanceSecret(legacySecret) && !dbSecret) dbSecret = legacySecret;

  const effectiveKey = dbKey || envCreds.apiKey;
  const effectiveSecret = dbSecret || envCreds.apiSecret;

  const mode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || '';
  const isTestnetMode = mode === 'BINANCE_TESTNET';
  const isLiveMode = mode === 'BINANCE_LIVE';

  const useTestnet = isTestnetMode
    ? true
    : (isLiveMode ? false : (kvTestnet !== null ? (kvTestnet === 'true') : (dbTestnet !== null ? dbTestnet : envCreds.useTestnet)));

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

  const marketType = ((kvMarketType as any) || botCfgMarketType || dbMarketType || envCreds.marketType || 'SPOT') as 'SPOT' | 'FUTURES';

  const isConnected = isValidBinanceKey(effectiveKey) && isValidBinanceSecret(effectiveSecret);

  return {
    apiKey: effectiveKey,
    apiSecret: effectiveSecret,
    useTestnet,
    marketType,
    isConnected,
  };
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
  inTradeMargin?: number;
  latencyMs?: number;
  useTestnet?: boolean;
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

  const baseUrlsToTry = isFutures
    ? (config.useTestnet ? ['https://testnet.binancefuture.com', 'https://demo-fapi.binance.com', 'https://fapi.binance.com'] : ['https://fapi.binance.com'])
    : (config.useTestnet ? ['https://demo-api.binance.com', 'https://testnet.binance.vision', 'https://api.binance.com'] : ['https://api.binance.com']);

  let lastData: any = null;
  let lastError = 'Failed to fetch account info';
  let lastCode: number | undefined;

  for (const baseUrl of baseUrlsToTry) {
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
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        lastData = data;
        break;
      } else {
        lastError = data?.msg || `HTTP ${res.status}`;
        lastCode = data?.code;
      }
    } catch (err: any) {
      lastError = err.message;
    }
  }

  if (!lastData) {
    return {
      success: false,
      canTrade: false,
      freeUsdt: 0,
      totalUsdtEquity: 0,
      marketType: effectiveMarketType,
      error: lastError,
      binanceCode: lastCode,
    };
  }

  const data = lastData;
  let canTrade = data.canTrade ?? true;
  let freeUsdt = 0;
  let totalUsdtEquity = 0;

    if (isFutures) {
      const usdtAsset = (data.assets || []).find((a: any) => a.asset === 'USDT');
      const usdcAsset = (data.assets || []).find((a: any) => a.asset === 'USDC');
      const totalMargin = parseFloat(data.totalMarginBalance || '0') || 0;
      const totalWallet = parseFloat(data.totalWalletBalance || '0') || 0;
      const availMargin = parseFloat(data.availableBalance || '0') || 0;
      const totalUnrealized = parseFloat(data.totalUnrealizedProfit || '0') || 0;
      const usdtFree = parseFloat(usdtAsset?.availableBalance || '0') || 0;
      const usdcFree = parseFloat(usdcAsset?.availableBalance || '0') || 0;
      
      freeUsdt = availMargin > 0 ? availMargin : (usdtFree + usdcFree);
      // In Binance Futures, totalMarginBalance is the true total account equity (Wallet Balance + Floating PnL)
      totalUsdtEquity = totalMargin > 0 ? totalMargin : (totalWallet + totalUnrealized);
      if (totalUsdtEquity <= 0) totalUsdtEquity = freeUsdt;
    } else {
      const balances = data.balances || [];
      const usdt = balances.find((b: any) => b.asset === 'USDT');
      const usdc = balances.find((b: any) => b.asset === 'USDC');
      const fdusd = balances.find((b: any) => b.asset === 'FDUSD');
      freeUsdt = (parseFloat(usdt?.free || '0') || 0) + (parseFloat(usdc?.free || '0') || 0) + (parseFloat(fdusd?.free || '0') || 0);

      // Include all non-stablecoin crypto assets valued at live prices
      let cryptoHoldingsUsdt = 0;
      for (const b of balances) {
        const free = parseFloat(b.free || '0');
        const locked = parseFloat(b.locked || '0');
        const total = free + locked;
        const asset = b.asset?.toUpperCase();
        if (total > 0 && asset && !['USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'TUSD', 'EUR', 'USD'].includes(asset)) {
          const ticker = binanceWs.getTicker(`${asset}USDT`);
          let p = ticker?.price || 0;
          if (!p || p <= 0) {
            p = FALLBACK_PRICES[`${asset}USDT`] || 0;
          }
          if (p > 0) {
            cryptoHoldingsUsdt += total * p;
          }
        }
      }

      const stableLocked = (parseFloat(usdt?.locked || '0') || 0) + (parseFloat(usdc?.locked || '0') || 0) + (parseFloat(fdusd?.locked || '0') || 0);
      totalUsdtEquity = freeUsdt + stableLocked + cryptoHoldingsUsdt;
    }

    const inTradeMargin = Math.max(0, totalUsdtEquity - freeUsdt);

    return {
      success: true,
      canTrade,
      freeUsdt: Math.round(freeUsdt * 100) / 100,
      totalUsdtEquity: Math.round(totalUsdtEquity * 100) / 100,
      inTradeMargin: Math.round(inTradeMargin * 100) / 100,
      marketType: effectiveMarketType,
      useTestnet: config.useTestnet,
      latencyMs: 25,
    };
};

export const formatBinanceQuantity = (symbol: string, quantity: number, price?: number, marketType: 'SPOT' | 'FUTURES' = 'SPOT'): string => {
  return formatBinancePrecisionQty(symbol, quantity, marketType);
};

// Simulate or real execute order
export const serverExecuteOrder = async (
  symbol: string, 
  side: string, 
  quoteOrderQty: number, 
  quantity: number, 
  currentPrice: number,
  leverage: number = 3,
  reduceOnly: boolean = false,
  stopLossPrice?: number,
  takeProfitPrice?: number
) => {
    const config = await getBinanceConfig();
    if (!config.isConnected) {
      return { success: false, error: 'Not connected' };
    }
    
    try {
        const normSymbol = symbol.toUpperCase().replace('/', '').trim();
        const effectiveMt = (config.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT') as 'SPOT' | 'FUTURES';
        const formattedQty = formatBinancePrecisionQty(normSymbol, quantity, effectiveMt);

        if (formattedQty === '0' || parseFloat(formattedQty) <= 0) {
          return { success: false, error: `Position size too small for ${normSymbol} (Min Qty not met). Try increasing margin or leverage.` };
        }

        console.log(`[SERVER-SIDE EXECUTE] ${side} ${symbol} Qty: ${formattedQty} Price: ${currentPrice} Lev: ${leverage}x ReduceOnly: ${reduceOnly} Mode: ${effectiveMt}`);

        if (effectiveMt === 'FUTURES') {
          const baseUrl = getBinanceFuturesApiBase(config.useTestnet);
          
          // 1. Ensure symbol leverage and margin type are configured
          try {
            const now = Date.now();
            try {
              const marginQuery = `symbol=${normSymbol}&marginType=ISOLATED&timestamp=${now}&recvWindow=10000`;
              const marginSig = createBinanceSignature(marginQuery, config.apiSecret!);
              await fetch(`${baseUrl}/fapi/v1/marginType?${marginQuery}&signature=${marginSig}`, {
                method: 'POST',
                headers: { 'X-MBX-APIKEY': config.apiKey!, 'Content-Type': 'application/json' },
              });
            } catch (mErr) { /* Ignore "No need to change margin type" */ }

            const targetLev = Math.max(1, Math.min(50, leverage || 3));
            const levQuery = `symbol=${normSymbol}&leverage=${targetLev}&timestamp=${now}&recvWindow=10000`;
            const levSig = createBinanceSignature(levQuery, config.apiSecret!);
            await fetch(`${baseUrl}/fapi/v1/leverage?${levQuery}&signature=${levSig}`, {
              method: 'POST',
              headers: {
                'X-MBX-APIKEY': config.apiKey!,
                'Content-Type': 'application/json',
              },
            });
          } catch (levErr) {
            console.warn(`[SERVER ENGINE] Setup notice for ${normSymbol}:`, levErr);
          }

          // 2. Prepare Futures order parameters
          const params: Record<string, string> = {
            symbol: normSymbol,
            side: side.toUpperCase(),
            type: 'MARKET',
            quantity: formattedQty,
            timestamp: Date.now().toString(),
            recvWindow: '10000',
          };

          if (reduceOnly) {
            params.reduceOnly = 'true';
          }

          const queryString = new URLSearchParams(params).toString();
          const signature = createBinanceSignature(queryString, config.apiSecret!);
          const orderUrl = `${baseUrl}/fapi/v1/order?${queryString}&signature=${signature}`;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
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
            console.error("[SERVER ENGINE] Binance Futures Order Error:", data);
            return { success: false, error: data.msg || 'Binance order rejected', binanceCode: data.code };
          }

          console.log(`[SERVER ENGINE] Binance Futures Order SUCCESS:`, data);
          const primaryOrderId = data.orderId || Date.now().toString();

          // 3. Place native Conditional Stop Loss on Binance Futures so it appears in "Open Orders"
          if (!reduceOnly && stopLossPrice && stopLossPrice > 0) {
            try {
              const slSide = side.toUpperCase() === 'BUY' ? 'SELL' : 'BUY';
              const formattedSlPrice = formatBinancePrecisionPrice(normSymbol, stopLossPrice, 'FUTURES');
              const slParams: Record<string, string> = {
                symbol: normSymbol,
                side: slSide,
                type: 'STOP_MARKET',
                stopPrice: formattedSlPrice,
                closePosition: 'true',
                timestamp: Date.now().toString(),
                recvWindow: '10000',
              };
              const slQuery = new URLSearchParams(slParams).toString();
              const slSig = createBinanceSignature(slQuery, config.apiSecret!);
              await fetch(`${baseUrl}/fapi/v1/order?${slQuery}&signature=${slSig}`, {
                method: 'POST',
                headers: { 'X-MBX-APIKEY': config.apiKey!, 'Content-Type': 'application/json' },
              });
              console.log(`[SERVER ENGINE] Stop Loss conditional order placed on Binance Testnet Open Orders for ${normSymbol} at $${formattedSlPrice}`);
            } catch (slErr) {
              console.warn('[SERVER ENGINE] Non-fatal SL conditional order placement notice:', slErr);
            }
          }

          return { success: true, orderId: primaryOrderId, executedQty: data.executedQty || formattedQty };
        } else {
          // SPOT Order (Testnet & Live)
          const primaryBaseUrl = config.useTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
          const fallbackBaseUrl = config.useTestnet ? 'https://demo-api.binance.com' : 'https://api.binance.com';

          const params: Record<string, string> = {
            symbol: normSymbol,
            side: side.toUpperCase(),
            type: 'MARKET',
            timestamp: Date.now().toString(),
            recvWindow: '10000',
          };

          // On Binance Spot:
          // MARKET BUY orders can use quoteOrderQty (USDT amount to spend), which prevents LOT_SIZE and precision errors!
          // MARKET SELL orders MUST use quantity (base asset amount) formatted to exact stepSize.
          if (side.toUpperCase() === 'BUY' && quoteOrderQty && quoteOrderQty > 0) {
            params.quoteOrderQty = Number(Math.max(10, quoteOrderQty)).toFixed(2);
          } else {
            params.quantity = formattedQty;
          }

          const queryString = new URLSearchParams(params).toString();
          const signature = createBinanceSignature(queryString, config.apiSecret!);

          const candidateUrls = [
            `${primaryBaseUrl}/api/v3/order?${queryString}&signature=${signature}`,
            ...(config.useTestnet ? [`${fallbackBaseUrl}/api/v3/order?${queryString}&signature=${signature}`] : []),
          ];

          let lastSpotError: any = null;
          let lastSpotCode: any = null;

          for (const orderUrl of candidateUrls) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 8000);
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

              if (response.ok) {
                console.log(`[SERVER ENGINE] Binance Spot Order SUCCESS:`, data);
                return { success: true, orderId: data.orderId || Date.now().toString(), executedQty: data.executedQty || formattedQty };
              } else {
                lastSpotError = data.msg || 'Binance Spot order rejected';
                lastSpotCode = data.code;
                console.warn(`[SERVER ENGINE] Spot order attempt failed on ${orderUrl}:`, data);
                if (data.code === -2015 && candidateUrls.length > 1) {
                  continue; // Try fallback testnet host if API key mismatch
                }
                break;
              }
            } catch (netErr: any) {
              lastSpotError = netErr.message;
            }
          }

          return { success: false, error: lastSpotError || 'Spot order execution failed', binanceCode: lastSpotCode };
        }
    } catch (err: any) {
        console.error("[SERVER ENGINE] Fetch Error:", err);
        return { success: false, error: err.message || 'Network error executing order' };
    }
};


export const recentlyClosedPositionMap = new Map<string, number>();

export const isPositionPermanentlyClosed = (id: string): boolean => {
  if (!id) return false;
  const closedAt = recentlyClosedPositionMap.get(id);
  if (!closedAt) return false;
  if (Date.now() - closedAt > 30000) { // expired after 30s
    recentlyClosedPositionMap.delete(id);
    return false;
  }
  return true;
};

export const markPositionClosed = (id: string) => {
  if (id) {
    recentlyClosedPositionMap.set(id, Date.now());
  }
};

export const resetBotEngineState = () => {
  recentlyClosedPositionMap.clear();
};

/**
 * Reconciles the paper wallet to exact mathematical truth:
 * Free Balance = Base Deposit (1000) + Total Realized PnL - Total Active In-Trade Margins
 * This prevents any possibility of wallet balances multiplying or drifting when trades are lost!
 */
export const reconcilePaperWalletDirect = async () => {
  try {
    const histStr = await kv.get('btc_trade_history');
    const history = histStr ? JSON.parse(histStr) : [];
    
    // Deduplicate history by trade id or key to ensure PnL is counted strictly once
    const seenHistoryIds = new Set<string>();
    const currentMode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
    const paperTrades = history.filter((h: any) => !h.mode || h.mode === 'PAPER' || h.mode === currentMode);
    const uniquePaperTrades = paperTrades.filter((h: any) => {
      const id = h.posId || h.id || `${h.symbol}_${h.timestamp}`;
      if (seenHistoryIds.has(id)) return false;
      seenHistoryIds.add(id);
      return true;
    });

    const totalRealizedPnl = uniquePaperTrades.reduce((acc: number, h: any) => acc + (Number(h.profitUsdt) || 0), 0);
    
    // Get active open positions
    const posStr = await kv.get('btc_active_bot_positions');
    const positions = posStr ? JSON.parse(posStr) : [];
    const activePaperPositions = positions.filter((p: any) => !isPositionPermanentlyClosed(p.id) && (!p.mode || p.mode === 'PAPER' || p.mode === currentMode));
    
    const inTradeMargin = activePaperPositions.reduce((acc: number, p: any) => {
      const m = typeof p.remainingAmountUsdt === 'number' && p.remainingAmountUsdt >= 0
        ? p.remainingAmountUsdt
        : (p.marginUsdt || p.initialAmountUsdt || 0);
      return acc + Math.max(0, m);
    }, 0);

    const baseCapitalStr = await kv.get('paper_wallet_initial_deposit');
    const baseCapital = baseCapitalStr ? (Number(baseCapitalStr) || 1000) : 1000;

    const reconciledFreeCash = Math.max(0, Math.round((baseCapital + totalRealizedPnl - inTradeMargin) * 100) / 100);
    const reconciledRealizedPnl = Math.round(totalRealizedPnl * 100) / 100;

    const reconciledWallet = {
      balance: reconciledFreeCash,
      realizedPnl: reconciledRealizedPnl,
      openPosition: null,
      history: [],
    };

    await kv.set('btc_paper_wallet', JSON.stringify(reconciledWallet));
    console.log(`[ACCOUNTING RECONCILE] Paper Wallet Restored to Truth: Free Balance: $${reconciledFreeCash}, Realized PnL: $${reconciledRealizedPnl}, In-Trade Margin: $${inTradeMargin}`);
    return reconciledWallet;
  } catch (err) {
    console.error('[ACCOUNTING RECONCILE] Error reconciling paper wallet:', err);
    return null;
  }
};

export const startBotEngine = () => {
  console.log("🤖 Initializing Server-Side Bot Execution Engine...");

  // Start Binance WebSocket live price stream (0 rate limit overhead)
  binanceWs.start();

  // Run initial sanity reconciliation on startup
  reconcilePaperWalletDirect().catch(() => {});

  if (engineInterval) clearInterval(engineInterval);

  engineInterval = setInterval(async () => {
    try {
      const botConfigStr = await kv.get('btc_bot_config');
      const botConfig = botConfigStr ? JSON.parse(botConfigStr) : { enabled: false };

      // DAILY DRAWDOWN & CIRCUIT BREAKER EVALUATION (Server-Side Automated Protection)
      if (botConfig.enabled && botConfig.dailyDrawdownLimitPercent && botConfig.dailyDrawdownLimitPercent > 0 && !botConfig.circuitBreakerTripped) {
        const startOfTodayUtc = new Date().setUTCHours(0, 0, 0, 0);
        const baselineTime = Math.max(startOfTodayUtc, botConfig.circuitBreakerResetAt || 0);
        const logsStr = await kv.get('btc_bot_logs');
        const logs = logsStr ? JSON.parse(logsStr) : [];
        const todayLogs = logs.filter((l: any) => l.timestamp >= baselineTime);
        const todayRealizedLoss = todayLogs.reduce((acc: number, l: any) => acc + (l.pnlUsdt || 0), 0);

        const walletStr = await kv.get('btc_paper_wallet');
        const wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000 };
        const totalEquity = Math.max(10, wallet.balance || 1000);
        const maxDailyLossAllowedUsdt = totalEquity * (botConfig.dailyDrawdownLimitPercent / 100);

        if (todayRealizedLoss <= -maxDailyLossAllowedUsdt) {
          console.log(`[SERVER CIRCUIT BREAKER ACTIVATED] Daily loss reached -$${Math.abs(todayRealizedLoss).toFixed(2)}. Tripping circuit breaker and pausing bot.`);
          botConfig.enabled = false;
          botConfig.circuitBreakerTripped = true;
          botConfig.circuitBreakerTrippedAt = Date.now();
          await kv.set('btc_bot_config', JSON.stringify(botConfig));

          sendServerTelegramNotification(
            `⛔ <b>CIRCUIT BREAKER ACTIVATED (SAFETY LOCK)</b>\n\n` +
            `🚨 Max daily loss limit (-$${Math.abs(todayRealizedLoss).toFixed(2)} / ${botConfig.dailyDrawdownLimitPercent}%) was reached.\n` +
            `🛑 Trading Bot was automatically PAUSED to preserve remaining capital.`
          );

          recordPushAlertDirect({
            title: `⛔ Circuit Breaker Activated!`,
            body: `Max daily loss limit reached (-$${Math.abs(todayRealizedLoss).toFixed(2)}). Bot paused automatically to protect capital.`,
            type: 'SYSTEM',
            symbol: 'PORTFOLIO',
          }).catch(() => {});
        }
      }

      const positionsStr = await kv.get('btc_active_bot_positions');
      if (!positionsStr) return;
      
      let positions = JSON.parse(positionsStr);
      if (!Array.isArray(positions) || positions.length === 0) return;

      // Filter out any positions that were already closed within cooldown to prevent duplicate triggers
      positions = positions.filter((p: any) => p && p.id && !isPositionPermanentlyClosed(p.id));
      if (positions.length === 0) return;

      let stateChanged = false;
      let walletPnlDelta = 0;
      let walletBalanceDelta = 0;
      const logsToAdd: any[] = [];
      const historyToAdd: any[] = [];

      // Group by symbol and marketType to fetch prices efficiently
      const uniqueKeys: string[] = Array.from(new Set(positions.map((p: any) => `${(p.marketType || 'FUTURES')}_${String(p.symbol || 'BTCUSDT')}`)));
      const priceResults = await Promise.allSettled(uniqueKeys.map(k => {
        const [mt, sym] = k.split('_');
        return fetchSymbolPrice(sym, mt as 'SPOT' | 'FUTURES');
      }));
      const prices: Record<string, number> = {};
      uniqueKeys.forEach((k: string, idx: number) => {
        const res = priceResults[idx];
        const [_, sym] = k.split('_');
        if (res.status === 'fulfilled' && (res.value as number) > 0) {
          prices[k] = res.value as number;
        } else {
          const matchingPos = positions.find((p: any) => p.symbol === sym);
          prices[k] = matchingPos?.currentPrice || matchingPos?.entryPrice || FALLBACK_PRICES[sym] || 50.0;
        }
      });

      const binanceConfig = await getBinanceConfig();
      const mode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
      const isLiveMode = mode === 'BINANCE_LIVE';
      const roeEngineInstance = RoeEngine.getInstance(botConfig.roeEngine);

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        
        // --- STRICT MODE SEPARATION ---
        // Skip positions that don't match the current execution mode to ensure Live/Paper separation
        const posMode = pos.mode || 'PAPER';
        if (posMode !== mode) continue; 

        // --- STRICT MARKET TYPE SEPARATION ---
        // If the active bot is in SPOT mode, completely disable and ignore FUTURES positions.
        // If in FUTURES mode, completely disable and ignore SPOT positions.
        const currentActiveMarketType = (await kv.get('app_binance_market_type')) || binanceConfig.marketType || botConfig.marketType || 'SPOT';
        const posMarketType = pos.marketType || 'FUTURES';
        if (posMarketType !== currentActiveMarketType) continue; 

        const pKey = `${pos.marketType || 'FUTURES'}_${pos.symbol}`;
        const currentP = prices[pKey] || pos.currentPrice || pos.entryPrice;
        
        if (!currentP || currentP <= 0) continue;

        const isLong = pos.decision === 'LONG' || pos.side === 'LONG' || pos.side === 'BUY' || !pos.decision;
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

        const isPosLive = pos.mode === 'BINANCE_LIVE' || pos.mode === 'BINANCE_TESTNET';

        if (isLiquidated) {
          console.warn(`[SERVER ENGINE] 🚨 LIQUIDATION TRIGGERED for ${pos.symbol} at ${currentP} (Entry: ${pos.entryPrice}, Liq: ${pos.liquidationPrice})`);
          const marginLost = pos.remainingAmountUsdt;
          const tranchePnl = -marginLost;
          const totalTradePnl = (pos.realizedPnlUsdt || 0) + tranchePnl;

          if (isPosLive) {
            if (binanceConfig.isConnected) {
              await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginLost * lev, pos.remainingAmountBtc, currentP, lev, true);
            }
          } else {
            // Margin lost entirely; zero returned to paper wallet
            walletPnlDelta += tranchePnl;
          }

          sendServerTelegramNotification(
            `🚨 <b>LIQUIDATION TRIGGERED</b>\n\n` +
            `🔹 Pair: <b>${pos.symbol}</b> (${pos.decision})\n` +
            `📊 Price: $${currentP.toLocaleString()}\n` +
            `💵 Loss: -$${marginLost.toFixed(2)} (-100% Margin)`
          );

          recordPushAlertDirect({
            title: `[${pos.symbol}] Liquidation Guard Triggered 🚨`,
            body: `Margin lost: -$${marginLost.toFixed(2)} at $${currentP.toLocaleString()}`,
            type: 'TRADE',
            decision: pos.decision,
            symbol: pos.symbol,
          }).catch(() => {});

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
            mode: pos.mode || 'PAPER',
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
            mode: pos.mode || 'PAPER',
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
              await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc * 0.5, currentP, lev, true);
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
            `🎯 <b>تم تحقيق الهدف الأول (TP1) بنجاح!</b>\n\n` +
            `• <b>الزوج:</b> <b>${pos.symbol}</b> (${pos.decision || 'LONG'})\n` +
            `• <b>سعر الإغلاق الجزئي:</b> $${currentP.toFixed(currentP < 10 ? 4 : 2)}\n` +
            `• <b>الكمية المغلقة:</b> 50% تأمين أرباح\n` +
            `• <b>الربح المحقق:</b> +$${tranchePnl.toFixed(2)} USDT (+${roeMetrics.netROE.toFixed(1)}% ROE)\n` +
            `• <b>حماية رأس المال:</b> تم رفع وقف الخسارة SL إلى نقطة الدخول عند $${(pos.stopLoss || pos.entryPrice).toFixed(currentP < 10 ? 4 : 2)}`
          );

          recordPushAlertDirect({
            title: `[${pos.symbol}] TP1 Target Achieved! 🎯`,
            body: `Closed 50% at $${currentP.toLocaleString()} | PnL: +$${tranchePnl.toFixed(2)} (+${roeMetrics.netROE.toFixed(1)}%)`,
            type: 'TRADE',
            decision: pos.decision,
            symbol: pos.symbol,
          }).catch(() => {});

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
            mode: pos.mode || 'PAPER',
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
              await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc * 0.5, currentP, lev, true);
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
            `🎯 <b>تم تحقيق الهدف الثاني (TP2)!</b>\n\n` +
            `• <b>الزوج:</b> <b>${pos.symbol}</b> (${pos.decision || 'LONG'})\n` +
            `• <b>سعر الإغلاق الجزئي:</b> $${currentP.toFixed(currentP < 10 ? 4 : 2)}\n` +
            `• <b>الكمية المغلقة:</b> 50% من المتبقي\n` +
            `• <b>الربح المحقق:</b> +$${tranchePnl.toFixed(2)} USDT (+${roeMetrics.netROE.toFixed(1)}% ROE)\n` +
            `• <b>تأمين الأرباح:</b> تم رفع وقف الخسارة SL إلى سعر الهدف الأول TP1 عند $${(pos.tp1 || 0).toFixed(currentP < 10 ? 4 : 2)}`
          );

          recordPushAlertDirect({
            title: `[${pos.symbol}] TP2 Target Hit! 🎯`,
            body: `Closed 50% remaining at $${currentP.toLocaleString()} | PnL: +$${tranchePnl.toFixed(2)} (+${roeMetrics.netROE.toFixed(1)}%)`,
            type: 'TRADE',
            decision: pos.decision,
            symbol: pos.symbol,
          }).catch(() => {});

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
            mode: pos.mode || 'PAPER',
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
              await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc, currentP, lev, true);
            }
          } else {
            walletBalanceDelta += cashReturned;
            walletPnlDelta += tranchePnl;
          }
          
          const logType = isTp3 ? 'AUTO_SELL_TP3' : (pos.isTrailingActive ? 'AUTO_TRAILING_SL' : 'AUTO_SL');
          
          const closeTitle = isTp3 
            ? '🏆 <b>تم تحقيق الهدف النهائي بالكامل (TP3)!</b>' 
            : (pos.isTrailingActive ? '⚡ <b>تم تفعيل وقف الخسارة المتحرك وتأمين الأرباح (Trailing SL)</b>' : '🛑 <b>تم تفعيل وقف الخسارة (Stop Loss)</b>');
          const pnlSign = totalTradePnl >= 0 ? '+' : '';

          sendServerTelegramNotification(
            `${closeTitle}\n\n` +
            `• <b>الزوج:</b> <b>${pos.symbol}</b> (${pos.decision || 'LONG'})\n` +
            `• <b>سعر الدخول:</b> $${pos.entryPrice}\n` +
            `• <b>سعر الخروج:</b> $${currentP.toFixed(currentP < 10 ? 4 : 2)}\n` +
            `• <b>صافي النتيجة:</b> ${pnlSign}$${totalTradePnl.toFixed(2)} USDT\n` +
            `• <b>الاستراتيجية:</b> ${pos.strategyName || 'Quantitative AI'}`
          );

          recordPushAlertDirect({
            title: `[${pos.symbol}] ${isTp3 ? 'TP3 Hit 🏆' : (pos.isTrailingActive ? 'Trailing Stop Hit ⚡' : 'Stop Loss Hit 🛑')}`,
            body: `Exit at $${currentP.toLocaleString()} | Net PnL: ${pnlSign}$${totalTradePnl.toFixed(2)}`,
            type: 'TRADE',
            decision: pos.decision,
            symbol: pos.symbol,
          }).catch(() => {});

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
            mode: pos.mode || 'PAPER'
          });

          const initialMargin = pos.initialAmountUsdt || pos.marginUsdt || pos.remainingAmountUsdt || 10;
          historyToAdd.push({
            id: `history-server-${Date.now()}-${i}`,
            timestamp: Date.now(),
            closedAt: Date.now(),
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
            mode: pos.mode || 'PAPER',
          });

          // Enforce 20 minutes cooldown on this symbol to prevent repeated immediate re-entry
          symbolCooldownMap.set(pos.symbol.toUpperCase().trim(), Date.now() + 20 * 60 * 1000);

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

          markPositionClosed(pos.id);
          pos._delete = true;
          stateChanged = true;
        }
      }

      // 6. ALWAYS PERSIST UPDATED LIVE POSITIONS TO KV
      // This guarantees that open trades NEVER stay stuck at 0.00% ROE in the UI!
      const freshPositionsStr = await kv.get('btc_active_bot_positions');
      const freshPositions = freshPositionsStr ? JSON.parse(freshPositionsStr) : [];
      
      const updatedPositions = freshPositions.map((freshPos: any) => {
         if (isPositionPermanentlyClosed(freshPos.id)) return null;
         const loopPos = positions.find((p: any) => p.id === freshPos.id);
         if (loopPos) {
             if (loopPos._delete) return null;
             const { _delete, ...safeLoopPos } = loopPos;
             return { ...freshPos, ...safeLoopPos };
         }
         return freshPos;
      }).filter(Boolean);
      
      await kv.set('btc_active_bot_positions', JSON.stringify(updatedPositions));

      if (logsToAdd.length > 0) {
        const logsStr = await kv.get('btc_bot_logs');
        const logs = logsStr ? JSON.parse(logsStr) : [];
        await kv.set('btc_bot_logs', JSON.stringify([...logsToAdd, ...logs].slice(0, 500)));
      }

      if (historyToAdd.length > 0) {
        const histStr = await kv.get('btc_trade_history');
        const history = histStr ? JSON.parse(histStr) : [];
        const seenHistIds = new Set<string>();
        const deduplicatedHist = [...historyToAdd, ...history].filter((h: any) => {
          const id = h.posId || h.id || `${h.symbol}_${h.timestamp}`;
          if (seenHistIds.has(id)) return false;
          seenHistIds.add(id);
          return true;
        });
        await kv.set('btc_trade_history', JSON.stringify(deduplicatedHist.slice(0, 500)));
      }

      // 7. ATOMIC RECONCILIATION: Free Balance = Base Deposit (1000) + Realized PnL - In-Trade Margin
      // Eliminates balance multiplication and drift forever!
      if (walletBalanceDelta !== 0 || walletPnlDelta !== 0 || historyToAdd.length > 0 || stateChanged) {
        await reconcilePaperWalletDirect();
      }

    } catch (err) {
      console.error("[SERVER ENGINE] Error evaluating positions:", err);
    }
  }, 3000); // Run every 3 seconds independently
};

/**
 * Server-authoritative position closer (Manual / SL / TP / Panic)
 */
export const closePositionDirect = async (
  posId: string,
  customExitPrice?: number,
  reason: string = 'Manual Close',
  extraData?: {
    realizedPnlUsdt?: number;
    profitPercent?: number;
    tradeHistoryItem?: any;
    marketType?: string;
    leverage?: number;
    symbol?: string;
    side?: string;
  }
) => {
  try {
    const posStr = await kv.get('btc_active_bot_positions');
    const positions = posStr ? JSON.parse(posStr) : [];
    const pos = positions.find((p: any) => p.id === posId);

    // If position is not in the array (e.g. client removed it first), handle fallback gracefully
    if (!pos) {
      markPositionClosed(posId);
      if (extraData?.tradeHistoryItem) {
        const histStr = await kv.get('btc_trade_history');
        const history = histStr ? JSON.parse(histStr) : [];
        const seenHistIds = new Set<string>();
        const deduplicatedHist = [extraData.tradeHistoryItem, ...history].filter((h: any) => {
          const id = h.posId || h.id || `${h.symbol}_${h.timestamp}`;
          if (seenHistIds.has(id)) return false;
          seenHistIds.add(id);
          return true;
        });
        await kv.set('btc_trade_history', JSON.stringify(deduplicatedHist.slice(0, 500)));
      }
      await reconcilePaperWalletDirect();
      return { success: true, message: 'Position already closed & wallet reconciled', posId };
    }

    const currentP = (customExitPrice && customExitPrice > 0) ? customExitPrice : await fetchSymbolPrice(pos.symbol, pos.marketType || 'FUTURES');
    const isLong = pos.decision === 'LONG' || pos.side === 'LONG' || pos.side === 'BUY' || !pos.decision;
    const lev = Math.max(1, pos.leverage || 1);
    const marginClosed = pos.remainingAmountUsdt || 0;

    let roePercent = 0;
    let tranchePnl = 0;

    if (extraData?.realizedPnlUsdt !== undefined && !isNaN(Number(extraData.realizedPnlUsdt))) {
      tranchePnl = Number(extraData.realizedPnlUsdt);
      roePercent = extraData.profitPercent !== undefined ? Number(extraData.profitPercent) : (marginClosed > 0 ? (tranchePnl / marginClosed) * 100 : 0);
    } else {
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

      roePercent = roeMetrics.netROE;
      tranchePnl = roeMetrics.netPnL;
    }

    if (tranchePnl < -marginClosed) tranchePnl = -marginClosed;
    const totalTradePnl = (pos.realizedPnlUsdt || 0) + tranchePnl;

    const binanceConfig = await getBinanceConfig();
    const isPosExchange = pos.mode === 'BINANCE_LIVE' || pos.mode === 'BINANCE_TESTNET';

    if (isPosExchange) {
      if (binanceConfig.isConnected) {
        await serverExecuteOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc, currentP, lev, true);
      }
    }

    markPositionClosed(posId);

    // Enforce cooldown on manual or api position closure
    symbolCooldownMap.set(pos.symbol.toUpperCase().trim(), Date.now() + 20 * 60 * 1000);

    // Immediately remove from active positions
    const remainingPositions = positions.filter((p: any) => p.id !== posId);
    await kv.set('btc_active_bot_positions', JSON.stringify(remainingPositions));

    // Add to history
    const histStr = await kv.get('btc_trade_history');
    const history = histStr ? JSON.parse(histStr) : [];
    const initialMargin = pos.initialAmountUsdt || pos.marginUsdt || marginClosed || 10;
    const historyItem = extraData?.tradeHistoryItem || {
      id: `history-manual-${Date.now()}`,
      posId: posId,
      timestamp: Date.now(),
      closedAt: Date.now(),
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
      mode: pos.mode || 'PAPER',
    };
    const seenHistIds = new Set<string>();
    const deduplicatedHist = [historyItem, ...history].filter((h: any) => {
      const id = h.posId || h.id || `${h.symbol}_${h.timestamp}`;
      if (seenHistIds.has(id)) return false;
      seenHistIds.add(id);
      return true;
    });
    await kv.set('btc_trade_history', JSON.stringify(deduplicatedHist.slice(0, 500)));

    if (!isPosExchange) {
      await reconcilePaperWalletDirect();
    }

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
      mode: pos.mode || 'PAPER',
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
export const panicCloseAllDirect = async (fallbackPositions?: any[]) => {
  try {
    const posStr = await kv.get('btc_active_bot_positions');
    let positions = posStr ? JSON.parse(posStr) : [];
    if (!Array.isArray(positions) || positions.length === 0) {
      if (Array.isArray(fallbackPositions) && fallbackPositions.length > 0) {
        positions = fallbackPositions;
      } else {
        await reconcilePaperWalletDirect();
        return { success: true, closedCount: 0 };
      }
    }

    for (const pos of positions) {
      if (pos && pos.id) {
        await closePositionDirect(pos.id, undefined, 'Panic emergency close all');
      }
    }

    await kv.set('btc_active_bot_positions', '[]');
    await reconcilePaperWalletDirect();

    return { success: true, closedCount: positions.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

