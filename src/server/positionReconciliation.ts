import crypto from 'crypto';
import { kv } from './db.js';
import { fetchSymbolPrice } from './botEngine.js';
import { binanceWs } from './binanceWebSocket.js';
import { clearOrderGuardState } from './botControl.js';

export interface BinanceApiLogEntry {
  timestamp: number;
  marketType: 'SPOT' | 'FUTURES';
  executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE';
  symbol?: string;
  endpoint: string;
  orderId?: string | number;
  clientOrderId?: string;
  httpStatus: number;
  binanceCode?: number;
  binanceMessage?: string;
  error?: string;
}

const apiCallLogs: BinanceApiLogEntry[] = [];

export function logBinanceApiCall(entry: BinanceApiLogEntry) {
  apiCallLogs.unshift(entry);
  if (apiCallLogs.length > 200) apiCallLogs.pop();

  if (entry.httpStatus >= 400 || entry.error || entry.binanceCode) {
    const isExpectedAuthMismatch = entry.httpStatus === 401 || entry.binanceCode === -2015;
    const logFn = isExpectedAuthMismatch ? console.warn : console.error;
    logFn(
      `[BINANCE API ${isExpectedAuthMismatch ? 'AUTH NOTICE' : 'ERROR'}] [${entry.executionMode}] [${entry.marketType}] ${entry.endpoint} - ` +
      `Status: ${entry.httpStatus} Code: ${entry.binanceCode || 'N/A'} Msg: ${entry.binanceMessage || entry.error || 'Unknown error'}` +
      (entry.symbol ? ` Symbol: ${entry.symbol}` : '')
    );
  }
}

export function getBinanceApiLogs(): BinanceApiLogEntry[] {
  return [...apiCallLogs];
}

/**
 * Authoritative Spot API Base URL
 * Strictly separated: Testnet NEVER calls Live, Live NEVER calls Testnet.
 */
export function getAuthoritativeBinanceApiBase(useTestnet: boolean): string {
  return useTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
}

/**
 * Authoritative Futures API Base URL
 * Strictly separated: Testnet NEVER calls Live, Live NEVER calls Testnet.
 */
export function getAuthoritativeBinanceFuturesApiBase(useTestnet: boolean): string {
  return useTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';
}

/**
 * Robust HMAC-SHA256 Signed Query Generator:
 * 1. Collects and normalizes query parameters.
 * 2. Injects recvWindow (default 10000).
 * 3. Injects timestamp immediately prior to signing.
 * 4. Serializes query string via URLSearchParams.
 * 5. Computes HMAC-SHA256 hex digest using the resolved secret.
 * 6. Appends &signature=<hex> without re-encoding or altering parameters.
 */
export function createBinanceSignedQuery(
  params: Record<string, string | number | boolean | undefined> = {},
  secret: string
): { queryString: string; signature: string; fullQuery: string } {
  const cleanParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      cleanParams[k] = String(v);
    }
  }
  if (!cleanParams.recvWindow) {
    cleanParams.recvWindow = '10000';
  }
  cleanParams.timestamp = Date.now().toString();

  const queryString = new URLSearchParams(cleanParams).toString();
  const signature = crypto.createHmac('sha256', secret.trim()).update(queryString).digest('hex');
  const fullQuery = `${queryString}&signature=${signature}`;
  return { queryString, signature, fullQuery };
}

export interface ReconciliationStatus {
  isSyncing: boolean;
  lastSyncTime: number;
  marketType: 'SPOT' | 'FUTURES';
  executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE';
  openPositionsCount: number;
  openOrdersCount: number;
  importedPositionsCount: number;
  closedPositionsCount: number;
  updatedPositionsCount: number;
  error: string | null;
}

let latestReconciliationStatus: ReconciliationStatus = {
  isSyncing: false,
  lastSyncTime: 0,
  marketType: 'SPOT',
  executionMode: 'PAPER',
  openPositionsCount: 0,
  openOrdersCount: 0,
  importedPositionsCount: 0,
  closedPositionsCount: 0,
  updatedPositionsCount: 0,
  error: null,
};

export function getReconciliationStatus(): ReconciliationStatus {
  return { ...latestReconciliationStatus };
}

function decryptSecret(text: string): string {
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
      if (res && isValidBinanceCredential(res)) return res;
    } catch (_) {}
  }
  return text;
}

function isValidBinanceCredential(val: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (trimmed.includes('...') || trimmed.includes('*') || trimmed.includes('•') || trimmed.length < 15) return false;
  return true;
}

/**
 * Authoritative Binance Credentials Resolver
 * Uniformly resolves credentials from secure KV and environment variables.
 */
export async function getAuthoritativeBinanceConfig(): Promise<{
  apiKey?: string;
  apiSecret?: string;
  useTestnet: boolean;
  marketType: 'SPOT' | 'FUTURES';
  executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE';
  isConnected: boolean;
}> {
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
      if (isValidBinanceCredential(parsedKey)) dbKey = parsedKey;
      if (isValidBinanceCredential(parsedSecret)) dbSecret = parsedSecret;
      if (parsed.useTestnet !== undefined) dbTestnet = Boolean(parsed.useTestnet);
      if (parsed.marketType === 'SPOT' || parsed.marketType === 'FUTURES') dbMarketType = parsed.marketType;
    } catch (_) {}
  }

  const legacyKey = ((await kv.get('app_binance_api_key')) || '').trim();
  const legacySecret = ((await kv.get('app_binance_api_secret')) || '').trim();
  if (isValidBinanceCredential(legacyKey) && !dbKey) dbKey = legacyKey;
  if (isValidBinanceCredential(legacySecret) && !dbSecret) dbSecret = legacySecret;

  const envKey = (
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

  const envSecret = (
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

  const apiKey = dbKey || (isValidBinanceCredential(envKey) ? envKey : '');
  const apiSecret = dbSecret || (isValidBinanceCredential(envSecret) ? envSecret : '');

  const rawTestnet = await kv.get('app_binance_use_testnet');
  const rawMode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';

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

  const rawMt = (await kv.get('app_binance_market_type')) || botCfgMarketType || dbMarketType || (process.env.BINANCE_MARKET_TYPE || process.env.MARKET_TYPE || 'SPOT');

  const executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE' =
    rawMode === 'BINANCE_LIVE' ? 'BINANCE_LIVE' : (rawMode === 'BINANCE_TESTNET' ? 'BINANCE_TESTNET' : 'PAPER');

  const useTestnet =
    executionMode === 'BINANCE_TESTNET'
      ? true
      : executionMode === 'BINANCE_LIVE'
      ? false
      : rawTestnet !== null
      ? rawTestnet === 'true'
      : dbTestnet !== null
      ? dbTestnet
      : process.env.BINANCE_USE_TESTNET === 'true' || process.env.BINANCE_TESTNET === 'true' || process.env.USE_TESTNET === 'true';

  const marketType: 'SPOT' | 'FUTURES' = String(rawMt).toUpperCase() === 'FUTURES' ? 'FUTURES' : 'SPOT';
  const isConnected = Boolean(isValidBinanceCredential(apiKey) && isValidBinanceCredential(apiSecret));

  return { apiKey, apiSecret, useTestnet, marketType, executionMode, isConnected };
}

/**
 * Authoritative Account Fetching with Absolute Spot/Futures Isolation
 * Calculates exact account values and balances without mixing or double counting.
 */
export async function fetchAuthoritativeAccount(
  marketType: 'SPOT' | 'FUTURES',
  executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE',
  credentials?: { apiKey?: string; apiSecret?: string; useTestnet?: boolean; forceLiveFetch?: boolean }
) {
  const hasRealCredentials = Boolean(
    credentials?.apiKey &&
    credentials?.apiSecret &&
    isValidBinanceCredential(credentials.apiKey) &&
    isValidBinanceCredential(credentials.apiSecret)
  );

  // Return local paper wallet calculation ONLY if in PAPER mode AND we are not testing/fetching real API credentials
  if (executionMode === 'PAPER' && !hasRealCredentials && !credentials?.forceLiveFetch) {
    // Return clean paper wallet calculation strictly isolated by marketType
    const walletKey = marketType === 'SPOT' ? 'btc_paper_wallet_spot' : 'btc_paper_wallet_futures';
    const raw = await kv.get(walletKey);
    const wallet = raw ? JSON.parse(raw) : { balance: 1000, initialDeposit: 1000, realizedPnl: 0 };
    
    let unrealizedPnl = 0;
    let inTradeMargin = 0;
    try {
      const posStr = await kv.get('btc_active_bot_positions');
      const positions = posStr ? JSON.parse(posStr) : [];
      const paperPositions = positions.filter((p: any) => (p.marketType || 'SPOT') === marketType && (!p.mode || p.mode === 'PAPER'));
      unrealizedPnl = paperPositions.reduce((acc: number, p: any) => acc + (Number(p.unrealizedPnlUsdt) || 0), 0);
      inTradeMargin = paperPositions.reduce((acc: number, p: any) => acc + (Number(p.marginUsdt || p.initialAmountUsdt) || 0), 0);
    } catch (_) {}

    const freeCash = wallet.balance !== undefined ? wallet.balance : 1000;
    const totalEquity = Math.round((freeCash + inTradeMargin + unrealizedPnl) * 100) / 100;

    return {
      success: true,
      marketType,
      executionMode,
      freeUsdt: freeCash,
      availableBalance: freeCash,
      walletBalance: freeCash + inTradeMargin,
      inTradeMargin,
      positionMargin: inTradeMargin,
      initialMargin: inTradeMargin,
      maintenanceMargin: inTradeMargin * 0.5,
      totalEquity,
      totalFuturesEquity: marketType === 'FUTURES' ? totalEquity : undefined,
      totalSpotEquity: marketType === 'SPOT' ? totalEquity : undefined,
      totalUsdtEquity: totalEquity,
      cryptoHoldings: marketType === 'SPOT' ? [] : undefined,
      holdingsMarketValue: marketType === 'SPOT' ? inTradeMargin : undefined,
      unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
      realizedPnl: Math.round((wallet.realizedPnl || 0) * 100) / 100,
      canTrade: true,
      canWithdraw: false,
      canDeposit: true,
      isPaper: true,
      balances: [
        { asset: 'USDT', free: freeCash, locked: inTradeMargin, total: freeCash + inTradeMargin }
      ],
    };
  }

  const auth = credentials || (await getAuthoritativeBinanceConfig());
  if (!auth.apiKey || !auth.apiSecret) {
    return {
      success: false,
      error: 'BINANCE CONNECTION ERROR: Missing API Key or Secret Key',
      code: 'MISSING_CREDENTIALS',
      marketType,
      executionMode,
    };
  }

  if (marketType === 'FUTURES') {
    const baseUrl = getAuthoritativeBinanceFuturesApiBase(auth.useTestnet ?? false);
    const endpoint = '/fapi/v2/account';
    const { fullQuery } = createBinanceSignedQuery({}, auth.apiSecret);
    const url = `${baseUrl}${endpoint}?${fullQuery}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'X-MBX-APIKEY': auth.apiKey, 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => null);

      logBinanceApiCall({
        timestamp: Date.now(),
        marketType: 'FUTURES',
        executionMode,
        endpoint,
        httpStatus: res.status,
        binanceCode: data?.code,
        binanceMessage: data?.msg,
        error: !res.ok ? (data?.msg || `HTTP ${res.status}`) : undefined,
      });

      if (!res.ok || !data) {
        return {
          success: false,
          error: data?.msg || 'BINANCE CONNECTION ERROR: Failed to fetch Futures account',
          binanceCode: data?.code,
          marketType: 'FUTURES',
          executionMode,
        };
      }

      const walletBalance = parseFloat(data.totalWalletBalance || '0') || 0;
      const availableBalance = parseFloat(data.availableBalance || '0') || 0;
      const totalMarginBalance = parseFloat(data.totalMarginBalance || '0') || 0;
      const initialMargin = parseFloat(data.totalInitialMargin || '0') || 0;
      const maintenanceMargin = parseFloat(data.totalMaintMargin || '0') || 0;
      const positionMargin = parseFloat(data.totalPositionInitialMargin || '0') || initialMargin;
      const unrealizedPnl = parseFloat(data.totalUnrealizedProfit || '0') || 0;
      const totalFuturesEquity = totalMarginBalance > 0 ? totalMarginBalance : (walletBalance + unrealizedPnl);

      let futuresRealizedPnl = 0;
      try {
        const histStr = await kv.get('btc_trade_history');
        const history = histStr ? JSON.parse(histStr) : [];
        const futuresTrades = history.filter((h: any) => (h.marketType || (h.leverage && h.leverage > 1 ? 'FUTURES' : 'SPOT')) === 'FUTURES' && (!h.mode || h.mode === executionMode));
        futuresRealizedPnl = futuresTrades.reduce((acc: number, h: any) => acc + (Number(h.profitUsdt || h.pnlUsdt) || 0), 0);
      } catch (_) {}

      const futuresBalances = (data.assets || [])
        .map((b: any) => ({
          asset: b.asset,
          free: parseFloat(b.availableBalance || '0') || 0,
          locked: Math.max(0, (parseFloat(b.walletBalance || '0') || 0) - (parseFloat(b.availableBalance || '0') || 0)),
          total: parseFloat(b.walletBalance || '0') || 0,
        }))
        .filter((b: any) => b.total > 0 || b.free > 0);

      return {
        success: true,
        marketType: 'FUTURES',
        executionMode,
        walletBalance: Math.round(walletBalance * 100) / 100,
        availableBalance: Math.round(availableBalance * 100) / 100,
        freeUsdt: Math.round(availableBalance * 100) / 100,
        initialMargin: Math.round(initialMargin * 100) / 100,
        maintenanceMargin: Math.round(maintenanceMargin * 100) / 100,
        positionMargin: Math.round(positionMargin * 100) / 100,
        inTradeMargin: Math.round(positionMargin * 100) / 100,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        realizedPnl: Math.round(futuresRealizedPnl * 100) / 100,
        totalEquity: Math.round(totalFuturesEquity * 100) / 100,
        totalFuturesEquity: Math.round(totalFuturesEquity * 100) / 100,
        totalUsdtEquity: Math.round(totalFuturesEquity * 100) / 100,
        canTrade: data.canTrade ?? true,
        canWithdraw: data.canWithdraw ?? false,
        canDeposit: data.canDeposit ?? true,
        balances: futuresBalances,
      };
    } catch (err: any) {
      logBinanceApiCall({
        timestamp: Date.now(),
        marketType: 'FUTURES',
        executionMode,
        endpoint,
        httpStatus: 0,
        error: err.message,
      });
      return {
        success: false,
        error: `BINANCE CONNECTION ERROR: ${err.message}`,
        marketType: 'FUTURES',
        executionMode,
      };
    }
  } else {
    // SPOT Account
    const baseUrl = getAuthoritativeBinanceApiBase(auth.useTestnet ?? false);
    const endpoint = '/api/v3/account';
    const { fullQuery } = createBinanceSignedQuery({}, auth.apiSecret);
    const url = `${baseUrl}${endpoint}?${fullQuery}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'X-MBX-APIKEY': auth.apiKey, 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => null);

      logBinanceApiCall({
        timestamp: Date.now(),
        marketType: 'SPOT',
        executionMode,
        endpoint,
        httpStatus: res.status,
        binanceCode: data?.code,
        binanceMessage: data?.msg,
        error: !res.ok ? (data?.msg || `HTTP ${res.status}`) : undefined,
      });

      if (!res.ok || !data) {
        return {
          success: false,
          error: data?.msg || 'BINANCE CONNECTION ERROR: Failed to fetch Spot account',
          binanceCode: data?.code,
          marketType: 'SPOT',
          executionMode,
        };
      }

      const rawBalances = Array.isArray(data.balances) ? data.balances : [];
      let freeUsdt = 0;
      let lockedStable = 0;
      const cryptoHoldings: any[] = [];
      let holdingsMarketValue = 0;

      for (const b of rawBalances) {
        const free = parseFloat(b.free || '0');
        const locked = parseFloat(b.locked || '0');
        const total = free + locked;
        const asset = (b.asset || '').toUpperCase();
        if (total <= 0) continue;

        if (['USDT', 'USDC', 'FDUSD', 'BUSD'].includes(asset)) {
          freeUsdt += free;
          lockedStable += locked;
        } else {
          const sym = `${asset}USDT`;
          const wsPrice = binanceWs.getPrice(sym);
          const price = wsPrice > 0 ? wsPrice : 0;
          const val = total * price;
          holdingsMarketValue += val;
          cryptoHoldings.push({
            asset,
            free,
            locked,
            total,
            price,
            valueUsdt: Math.round(val * 100) / 100,
          });
        }
      }

      const totalSpotEquity = freeUsdt + lockedStable + holdingsMarketValue;

      let spotRealizedPnl = 0;
      try {
        const histStr = await kv.get('btc_trade_history');
        const history = histStr ? JSON.parse(histStr) : [];
        const spotTrades = history.filter((h: any) => (h.marketType || 'SPOT') === 'SPOT' && (!h.mode || h.mode === executionMode));
        spotRealizedPnl = spotTrades.reduce((acc: number, h: any) => acc + (Number(h.profitUsdt || h.pnlUsdt) || 0), 0);
      } catch (_) {}

      let spotUnrealizedPnl = 0;
      try {
        const posStr = await kv.get('btc_active_bot_positions');
        const positions = posStr ? JSON.parse(posStr) : [];
        const spotPositions = positions.filter((p: any) => (p.marketType || 'SPOT') === 'SPOT' && (!p.mode || p.mode === executionMode));
        spotUnrealizedPnl = spotPositions.reduce((acc: number, p: any) => acc + (Number(p.unrealizedPnlUsdt) || 0), 0);
      } catch (_) {}

      const spotBalances = rawBalances
        .map((b: any) => ({
          asset: b.asset,
          free: parseFloat(b.free || '0') || 0,
          locked: parseFloat(b.locked || '0') || 0,
          total: (parseFloat(b.free || '0') || 0) + (parseFloat(b.locked || '0') || 0),
        }))
        .filter((b: any) => b.total > 0);

      return {
        success: true,
        marketType: 'SPOT',
        executionMode,
        freeUsdt: Math.round(freeUsdt * 100) / 100,
        availableBalance: Math.round(freeUsdt * 100) / 100,
        cryptoHoldings,
        holdingsMarketValue: Math.round(holdingsMarketValue * 100) / 100,
        inTradeMargin: Math.round(holdingsMarketValue * 100) / 100,
        totalEquity: Math.round(totalSpotEquity * 100) / 100,
        totalSpotEquity: Math.round(totalSpotEquity * 100) / 100,
        totalUsdtEquity: Math.round(totalSpotEquity * 100) / 100,
        unrealizedPnl: Math.round(spotUnrealizedPnl * 100) / 100,
        realizedPnl: Math.round(spotRealizedPnl * 100) / 100,
        canTrade: data.canTrade ?? true,
        canWithdraw: data.canWithdraw ?? false,
        canDeposit: data.canDeposit ?? true,
        balances: spotBalances,
      };
    } catch (err: any) {
      logBinanceApiCall({
        timestamp: Date.now(),
        marketType: 'SPOT',
        executionMode,
        endpoint,
        httpStatus: 0,
        error: err.message,
      });
      return {
        success: false,
        error: `BINANCE CONNECTION ERROR: ${err.message}`,
        marketType: 'SPOT',
        executionMode,
      };
    }
  }
}

/**
 * RECONCILIATION ENGINE:
 * Robust, bidirectional synchronization between Binance exchange and local state:
 * - Detects Binance positions missing locally -> Automatically imports them!
 * - Detects local positions no longer existing on Binance -> Moves to history and cleans up.
 * - Updates quantity, entry price, current price, unrealized PnL, leverage.
 * - Strictly separates SPOT and FUTURES positions.
 * - Completely prevents duplicates and stale in-flight state locks.
 */
export async function reconcilePositionsWithBinance(options?: {
  customBinancePositions?: any[];
  customBinanceSpotBalances?: any[];
}): Promise<{
  success: boolean;
  syncing: boolean;
  activePositions: any[];
  openOrdersCount: number;
  importedCount: number;
  closedCount: number;
  updatedCount: number;
  error?: string;
}> {
  latestReconciliationStatus.isSyncing = true;

  const auth = await getAuthoritativeBinanceConfig();
  latestReconciliationStatus.marketType = auth.marketType;
  latestReconciliationStatus.executionMode = auth.executionMode;

  try {
    const rawLocalPositions = await kv.get('btc_active_bot_positions');
    let localPositions: any[] = rawLocalPositions ? JSON.parse(rawLocalPositions) : [];
    if (!Array.isArray(localPositions)) localPositions = [];

    // Filter out invalid records
    localPositions = localPositions.filter(p => p && p.symbol && typeof p === 'object');

    let importedCount = 0;
    let closedCount = 0;
    let updatedCount = 0;
    let openOrdersCount = 0;

    if (auth.executionMode === 'PAPER') {
      // Paper Mode: Simply deduplicate and clean up local positions
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const p of localPositions) {
        const key = `${p.symbol}_${p.marketType || 'SPOT'}_${p.mode || 'PAPER'}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(p);
        }
      }
      await kv.set('btc_active_bot_positions', JSON.stringify(deduped));
      latestReconciliationStatus.isSyncing = false;
      latestReconciliationStatus.lastSyncTime = Date.now();
      latestReconciliationStatus.openPositionsCount = deduped.length;
      return {
        success: true,
        syncing: false,
        activePositions: deduped,
        openOrdersCount: 0,
        importedCount: 0,
        closedCount: 0,
        updatedCount: 0,
      };
    }

    // Exchange Mode: Reconcile with real Binance API
    if (!auth.isConnected) {
      latestReconciliationStatus.isSyncing = false;
      latestReconciliationStatus.error = 'BINANCE CONNECTION ERROR: No API credentials';
      return {
        success: false,
        syncing: false,
        activePositions: localPositions,
        openOrdersCount: 0,
        importedCount: 0,
        closedCount: 0,
        updatedCount: 0,
        error: 'BINANCE CONNECTION ERROR: Missing credentials',
      };
    }

    if (auth.marketType === 'FUTURES') {
      let rawBinancePositions: any[] = [];
      let rawOpenOrders: any[] = [];

      if (options?.customBinancePositions) {
        rawBinancePositions = options.customBinancePositions;
      } else {
        const baseUrl = getAuthoritativeBinanceFuturesApiBase(auth.useTestnet);
        // 1. Fetch active Futures positions
        const posSigned = createBinanceSignedQuery({}, auth.apiSecret!);
        const posRes = await fetch(`${baseUrl}/fapi/v2/positionRisk?${posSigned.fullQuery}`, {
          headers: { 'X-MBX-APIKEY': auth.apiKey!, 'Accept': 'application/json' },
        });
        const posData = await posRes.json().catch(() => []);
        if (posRes.ok && Array.isArray(posData)) {
          rawBinancePositions = posData;
        } else {
          throw new Error(posData?.msg || `Failed to fetch Futures positions (HTTP ${posRes.status})`);
        }

        // 2. Fetch open conditional/limit orders
        try {
          const ordersSigned = createBinanceSignedQuery({}, auth.apiSecret!);
          const ordersRes = await fetch(`${baseUrl}/fapi/v1/openOrders?${ordersSigned.fullQuery}`, {
            headers: { 'X-MBX-APIKEY': auth.apiKey!, 'Accept': 'application/json' },
          });
          const ordersData = await ordersRes.json().catch(() => []);
          if (ordersRes.ok && Array.isArray(ordersData)) {
            rawOpenOrders = ordersData;
            openOrdersCount = rawOpenOrders.length;
          }
        } catch (_) {}
      }

      // Filter only real open positions with non-zero positionAmt
      const activeBinanceFutures = rawBinancePositions.filter(p => p && parseFloat(p.positionAmt || '0') !== 0);

      // Separate local positions into those belonging to current mode/market vs other markets
      const otherMarketPositions = localPositions.filter(
        p => (p.marketType || 'SPOT') !== 'FUTURES' || (p.mode || 'PAPER') !== auth.executionMode
      );
      const currentFuturesPositions = localPositions.filter(
        p => (p.marketType || 'SPOT') === 'FUTURES' && (p.mode || 'PAPER') === auth.executionMode
      );

      const reconciledCurrent: any[] = [];
      const binanceSeenSymbols = new Set<string>();

      // A. Reconcile Binance positions -> Local
      for (const bp of activeBinanceFutures) {
        const sym = bp.symbol.toUpperCase();
        binanceSeenSymbols.add(sym);
        const posAmt = parseFloat(bp.positionAmt || '0');
        const side: 'LONG' | 'SHORT' = posAmt > 0 ? 'LONG' : 'SHORT';
        const qty = Math.abs(posAmt);
        const entryPrice = parseFloat(bp.entryPrice || '0') || 1;
        const markPrice = parseFloat(bp.markPrice || '0') || entryPrice;
        const unrealizedPnl = parseFloat(bp.unRealizedProfit || '0') || 0;
        const leverage = parseInt(bp.leverage || '1', 10) || 1;
        const margin = parseFloat(bp.isolatedMargin || '0') || ((qty * entryPrice) / leverage);
        const liquidationPrice = parseFloat(bp.liquidationPrice || '0') || undefined;

        const existingLocal = currentFuturesPositions.find(p => p.symbol.toUpperCase() === sym);

        if (existingLocal) {
          // Update existing position with live authoritative Binance values
          reconciledCurrent.push({
            ...existingLocal,
            quantity: qty,
            remainingAmountBtc: qty,
            entryPrice,
            currentPrice: markPrice,
            unrealizedPnlUsdt: unrealizedPnl,
            leverage,
            side,
            decision: side,
            marginUsdt: margin,
            remainingAmountUsdt: margin,
            liquidationPrice,
            marketType: 'FUTURES',
            mode: auth.executionMode,
            isManaged: existingLocal.isManaged ?? true,
            lastSyncedAt: Date.now(),
          });
          updatedCount++;
        } else {
          // CRITICAL: POSITION EXISTS ON BINANCE BUT NOT IN QUANTURA -> IMPORT IT!
          const stableId = `binance-futures-${sym}-${auth.executionMode}`;
          console.log(`[RECONCILIATION] IMPORTING position for ${sym} (${side} ${qty}) from Binance Futures.`);
          reconciledCurrent.push({
            id: stableId,
            symbol: sym,
            side,
            decision: side,
            entryPrice,
            currentPrice: markPrice,
            quantity: qty,
            remainingAmountBtc: qty,
            initialAmountUsdt: margin,
            remainingAmountUsdt: margin,
            marginUsdt: margin,
            positionSizeUsdt: qty * entryPrice,
            leverage,
            unrealizedPnlUsdt: unrealizedPnl,
            liquidationPrice,
            marketType: 'FUTURES',
            mode: auth.executionMode,
            source: 'BINANCE_RECONCILED',
            openedAt: existingLocal?.openedAt || Date.now(),
            strategyName: 'Binance Exchange Position',
            isManaged: false,
            lastSyncedAt: Date.now(),
          });
          importedCount++;
        }
      }

      // B. Detect local positions that no longer exist on Binance -> Position closed on exchange
      for (const lp of currentFuturesPositions) {
        const sym = lp.symbol.toUpperCase();
        if (!binanceSeenSymbols.has(sym)) {
          console.log(`[RECONCILIATION] Local Futures position ${sym} no longer exists on Binance. Moving to trade history.`);
          closedCount++;

          // Clear any in-flight execution lock for this symbol
          clearOrderGuardState(sym);

          // Move to History as closed trade
          const histStr = await kv.get('btc_trade_history');
          const history = histStr ? JSON.parse(histStr) : [];
          const exitPrice = lp.currentPrice || lp.entryPrice;
          const pnl = lp.unrealizedPnlUsdt || 0;
          const histId = `hist-reconciled-${sym}-${lp.openedAt || Date.now()}`;
          if (!history.some((h: any) => h.id === histId || (h.posId === lp.id && Math.abs((h.closedAt || 0) - Date.now()) < 60000))) {
            const historyItem = {
              id: histId,
              posId: lp.id,
              symbol: sym,
              decision: lp.decision || lp.side || 'LONG',
              entryPrice: lp.entryPrice,
              exitPrice,
              quantity: lp.quantity,
              profitUsdt: pnl,
              profitPercent: lp.initialAmountUsdt > 0 ? (pnl / lp.initialAmountUsdt) * 100 : 0,
              status: pnl >= 0 ? 'CLOSED_ON_EXCHANGE_WIN' : 'CLOSED_ON_EXCHANGE_LOSS',
              timestamp: lp.openedAt || Date.now() - 3600000,
              closedAt: Date.now(),
              marketType: 'FUTURES',
              mode: auth.executionMode,
              strategyName: lp.strategyName || 'Binance Trade',
            };
            history.unshift(historyItem);
            await kv.set('btc_trade_history', JSON.stringify(history.slice(0, 500)));
          }
        }
      }

      const finalPositions = [...otherMarketPositions, ...reconciledCurrent];
      await kv.set('btc_active_bot_positions', JSON.stringify(finalPositions));

      latestReconciliationStatus = {
        isSyncing: false,
        lastSyncTime: Date.now(),
        marketType: 'FUTURES',
        executionMode: auth.executionMode,
        openPositionsCount: reconciledCurrent.length,
        openOrdersCount,
        importedPositionsCount: importedCount,
        closedPositionsCount: closedCount,
        updatedPositionsCount: updatedCount,
        error: null,
      };

      return {
        success: true,
        syncing: false,
        activePositions: finalPositions,
        openOrdersCount,
        importedCount,
        closedCount,
        updatedCount,
      };
    } else {
      // SPOT Reconciliation
      let rawBalances: any[] = [];
      let rawOpenOrders: any[] = [];

      if (options?.customBinanceSpotBalances) {
        rawBalances = options.customBinanceSpotBalances;
      } else {
        const baseUrl = getAuthoritativeBinanceApiBase(auth.useTestnet);
        // 1. Fetch Spot Account Balances with freshly signed query
        const accSigned = createBinanceSignedQuery({}, auth.apiSecret!);
        const accRes = await fetch(`${baseUrl}/api/v3/account?${accSigned.fullQuery}`, {
          headers: { 'X-MBX-APIKEY': auth.apiKey!, 'Accept': 'application/json' },
        });
        const accData = await accRes.json().catch(() => ({}));
        if (accRes.ok && Array.isArray(accData.balances)) {
          rawBalances = accData.balances;
        } else {
          throw new Error(accData?.msg || `Failed to fetch Spot balances (HTTP ${accRes.status})`);
        }

        // 2. Fetch Spot Open Orders with freshly signed query
        try {
          const ordersSigned = createBinanceSignedQuery({}, auth.apiSecret!);
          const ordersRes = await fetch(`${baseUrl}/api/v3/openOrders?${ordersSigned.fullQuery}`, {
            headers: { 'X-MBX-APIKEY': auth.apiKey!, 'Accept': 'application/json' },
          });
          const ordersData = await ordersRes.json().catch(() => []);
          if (ordersRes.ok && Array.isArray(ordersData)) {
            rawOpenOrders = ordersData;
            openOrdersCount = rawOpenOrders.length;
          }
        } catch (_) {}
      }

      // Map non-stablecoin spot assets with total > 0
      const activeSpotAssets = rawBalances.filter(b => {
        const total = parseFloat(b.free || '0') + parseFloat(b.locked || '0');
        const asset = (b.asset || '').toUpperCase();
        return total > 0 && !['USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'TUSD', 'EUR', 'USD'].includes(asset);
      });

      const otherMarketPositions = localPositions.filter(
        p => (p.marketType || 'SPOT') !== 'SPOT' || (p.mode || 'PAPER') !== auth.executionMode
      );
      const currentSpotPositions = localPositions.filter(
        p => (p.marketType || 'SPOT') === 'SPOT' && (p.mode || 'PAPER') === auth.executionMode
      );

      const reconciledCurrent: any[] = [];
      const binanceSeenAssets = new Set<string>();
      for (const b of activeSpotAssets) {
        binanceSeenAssets.add(b.asset.toUpperCase());
      }

      const binanceOpenOrderSymbols = new Set<string>();
      for (const o of rawOpenOrders) {
        if (o.symbol) binanceOpenOrderSymbols.add(o.symbol.toUpperCase());
      }

      for (const b of activeSpotAssets) {
        const asset = b.asset.toUpperCase();
        const sym = `${asset}USDT`;
        const free = parseFloat(b.free || '0');
        const locked = parseFloat(b.locked || '0');
        const totalQty = free + locked;

        const livePrice = binanceWs.getPrice(sym) || 0;
        const notionalVal = totalQty * livePrice;

        // Skip micro-dust balances (< $1.00) unless matched with existing local trade
        const existingLocal = currentSpotPositions.find(p => p.symbol.toUpperCase() === sym);
        if (!existingLocal && notionalVal < 1.0) continue;

        const entryPrice = existingLocal?.entryPrice || livePrice || 1;
        const currentP = livePrice > 0 ? livePrice : entryPrice;
        const unrealizedPnl = totalQty * (currentP - entryPrice);

        if (existingLocal) {
          reconciledCurrent.push({
            ...existingLocal,
            quantity: totalQty,
            remainingAmountBtc: totalQty,
            currentPrice: currentP,
            unrealizedPnlUsdt: Math.round(unrealizedPnl * 100) / 100,
            marketType: 'SPOT',
            mode: auth.executionMode,
            isManaged: existingLocal.isManaged ?? true,
            lastSyncedAt: Date.now(),
          });
          updatedCount++;
        }
      }

      // Check local Spot positions whose balance is now zero on Binance AND has no open orders
      for (const lp of currentSpotPositions) {
        const sym = lp.symbol.toUpperCase();
        const baseAsset = sym.replace('USDT', '').replace('USDC', '').replace('FDUSD', '');
        const hasBalance = binanceSeenAssets.has(baseAsset);
        const hasOpenOrder = binanceOpenOrderSymbols.has(sym);

        if (!hasBalance && !hasOpenOrder) {
          console.log(`[RECONCILIATION] Spot symbol ${sym} balance is 0 and no open orders on Binance. Removing stale internal position and clearing in-flight lock.`);
          closedCount++;

          // Clear any in-flight execution lock or guard idempotency for this symbol
          clearOrderGuardState(sym);

          const histStr = await kv.get('btc_trade_history');
          const history = histStr ? JSON.parse(histStr) : [];
          const exitPrice = lp.currentPrice || lp.entryPrice;
          const pnl = lp.unrealizedPnlUsdt || 0;
          const histId = `hist-reconciled-spot-${sym}-${lp.openedAt || Date.now()}`;
          if (!history.some((h: any) => h.id === histId || (h.posId === lp.id && Math.abs((h.closedAt || 0) - Date.now()) < 60000))) {
            const historyItem = {
              id: histId,
              posId: lp.id,
              symbol: sym,
              decision: 'LONG',
              entryPrice: lp.entryPrice,
              exitPrice,
              quantity: lp.quantity,
              profitUsdt: pnl,
              profitPercent: lp.initialAmountUsdt > 0 ? (pnl / lp.initialAmountUsdt) * 100 : 0,
              status: pnl >= 0 ? 'CLOSED_ON_EXCHANGE_WIN' : 'CLOSED_ON_EXCHANGE_LOSS',
              timestamp: lp.openedAt || Date.now() - 3600000,
              closedAt: Date.now(),
              marketType: 'SPOT',
              mode: auth.executionMode,
              strategyName: lp.strategyName || 'Binance Spot Trade',
            };
            history.unshift(historyItem);
            await kv.set('btc_trade_history', JSON.stringify(history.slice(0, 500)));
          }
        }
      }

      // If no open orders and no positions exist in this mode, ensure all in-flight locks are cleanly cleared
      if (reconciledCurrent.length === 0 && openOrdersCount === 0) {
        clearOrderGuardState();
      }

      const finalPositions = [...otherMarketPositions, ...reconciledCurrent];
      await kv.set('btc_active_bot_positions', JSON.stringify(finalPositions));

      latestReconciliationStatus = {
        isSyncing: false,
        lastSyncTime: Date.now(),
        marketType: 'SPOT',
        executionMode: auth.executionMode,
        openPositionsCount: reconciledCurrent.length,
        openOrdersCount,
        importedPositionsCount: importedCount,
        closedPositionsCount: closedCount,
        updatedPositionsCount: updatedCount,
        error: null,
      };

      return {
        success: true,
        syncing: false,
        activePositions: finalPositions,
        openOrdersCount,
        importedCount,
        closedCount,
        updatedCount,
      };
    }
  } catch (err: any) {
    console.error('[RECONCILIATION ERROR]', err);
    latestReconciliationStatus.isSyncing = false;
    latestReconciliationStatus.error = err.message;
    return {
      success: false,
      syncing: false,
      activePositions: [],
      openOrdersCount: 0,
      importedCount: 0,
      closedCount: 0,
      updatedCount: 0,
      error: err.message,
    };
  }
}

/**
 * STARTUP RECONCILIATION:
 * Executed once during server initialization before starting any bot engine or scanner.
 */
export async function runStartupReconciliation(): Promise<void> {
  console.log('🔄 [STARTUP] Running authoritative Binance account and position reconciliation...');
  try {
    const auth = await getAuthoritativeBinanceConfig();
    if (auth.isConnected && auth.executionMode !== 'PAPER') {
      const res = await reconcilePositionsWithBinance();
      console.log(
        `✅ [STARTUP RECONCILIATION COMPLETE] Mode: ${auth.executionMode}, Market: ${auth.marketType} - ` +
        `Active: ${res.activePositions.length}, Imported: ${res.importedCount}, Closed: ${res.closedCount}`
      );
    } else {
      console.log('ℹ️ [STARTUP RECONCILIATION] Running in Paper / Local mode. Reconciling local state.');
      await reconcilePositionsWithBinance();
    }
  } catch (err) {
    console.error('⚠️ [STARTUP RECONCILIATION ERROR]:', err);
  }
}

