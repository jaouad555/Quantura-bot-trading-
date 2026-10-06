import { kv } from './db.js';
import { stopMarketScanner, startMarketScanner, inFlightExecutionLocks, symbolCooldownMap } from './marketScanner.js';

export interface AuthoritativeBotState {
  enabled: boolean;
  status: 'RUNNING' | 'STOPPED' | 'PAUSED';
  marketType: 'SPOT' | 'FUTURES';
  executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE';
  circuitBreakerTripped: boolean;
  activePresets: string[];
  lastStateChange: number;
  stoppedReason?: string;
}

// In-memory idempotency cache for order requests to prevent duplicate submissions
const orderIdempotencyCache = new Map<string, { timestamp: number; status: 'PENDING' | 'EXECUTED' | 'REJECTED'; result?: any }>();

export function clearIdempotencyCache() {
  orderIdempotencyCache.clear();
}

export function clearOrderGuardState(symbol?: string) {
  if (symbol) {
    const sym = symbol.toUpperCase().trim();
    inFlightExecutionLocks.delete(sym);
    for (const key of Array.from(orderIdempotencyCache.keys())) {
      if (key.toUpperCase().includes(sym)) {
        orderIdempotencyCache.delete(key);
      }
    }
  } else {
    inFlightExecutionLocks.clear();
    orderIdempotencyCache.clear();
  }
}

// Clean idempotency cache older than 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of orderIdempotencyCache.entries()) {
    if (now - entry.timestamp > 60000) {
      orderIdempotencyCache.delete(key);
    }
  }
}, 30000);

/**
 * Single Authoritative Source for Bot Engine State
 */
export async function getAuthoritativeBotState(): Promise<AuthoritativeBotState> {
  let botConfig: any = { enabled: false, marketType: 'SPOT', activePresets: [] };
  try {
    const raw = await kv.get('btc_bot_config');
    if (raw) botConfig = JSON.parse(raw);
  } catch (e) {
    console.warn('[BOT CONTROL] Error reading btc_bot_config:', e);
  }

  const rawMode = (await kv.get('trading_execution_mode')) || (await kv.get('app_execution_mode')) || 'PAPER';
  const executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE' =
    rawMode === 'BINANCE_LIVE' ? 'BINANCE_LIVE' : (rawMode === 'BINANCE_TESTNET' ? 'BINANCE_TESTNET' : 'PAPER');

  const rawMt = (await kv.get('app_binance_market_type')) || botConfig.marketType || 'SPOT';
  const marketType: 'SPOT' | 'FUTURES' = rawMt === 'FUTURES' ? 'FUTURES' : 'SPOT';

  const isEnabled = Boolean(botConfig.enabled);
  const isCircuitBreaker = Boolean(botConfig.circuitBreakerTripped);

  let status: 'RUNNING' | 'STOPPED' | 'PAUSED' = 'STOPPED';
  if (isCircuitBreaker) {
    status = 'PAUSED';
  } else if (isEnabled) {
    status = 'RUNNING';
  }

  return {
    enabled: isEnabled && !isCircuitBreaker,
    status,
    marketType,
    executionMode,
    circuitBreakerTripped: isCircuitBreaker,
    activePresets: Array.isArray(botConfig.activePresets) ? botConfig.activePresets : [],
    lastStateChange: botConfig.enabledAt || Date.now(),
    stoppedReason: botConfig.stoppedReason,
  };
}

export interface OrderSubmissionGuardParams {
  isManual?: boolean;
  isReduceOnly?: boolean;
  symbol: string;
  side: string;
  marketType: 'SPOT' | 'FUTURES';
  executionMode: string;
  strategyId?: string;
  clientOrderId?: string;
  quantity?: number;
  price?: number;
}

export interface GuardEvaluationResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

/**
 * MANDATORY FINAL EXECUTION GUARD:
 * Applied immediately before every real/testnet order submission.
 * Applies to: Spot orders, Futures orders, Testnet orders, automatic strategies,
 * retries, background jobs, scheduled tasks, WebSocket callbacks, recovery logic.
 */
export async function canSubmitOrder(params: OrderSubmissionGuardParams): Promise<GuardEvaluationResult> {
  const normSymbol = (params.symbol || '').toUpperCase().trim();
  const normSide = (params.side || '').toUpperCase().trim();
  const normMarket = params.marketType || 'SPOT';

  // 1. Reduce-Only / Position Close Guard:
  // If an order is explicitly closing an existing position (reduceOnly), verify the position genuinely exists
  if (params.isReduceOnly) {
    try {
      const posStr = await kv.get('btc_active_bot_positions');
      const positions = posStr ? JSON.parse(posStr) : [];
      const hasPos = positions.some((p: any) => p && p.symbol && p.symbol.toUpperCase() === normSymbol);
      if (!hasPos) {
        console.warn(`[EXECUTION GUARD] Reduce-only order rejected: No active position found for ${normSymbol}`);
        return {
          allowed: false,
          code: 'NO_POSITION_TO_CLOSE',
          reason: `Cannot submit reduce-only order: No open position found for ${normSymbol}`,
        };
      }
    } catch (_) {}
    return { allowed: true };
  }

  // 2. Manual Orders: User explicitly initiated via UI terminal
  if (params.isManual) {
    if (normMarket === 'SPOT' && (normSide === 'SELL' || normSide === 'SHORT')) {
      // In Spot, a new open order cannot be a short/sell without holding
      // (Sell orders in Spot can only reduce existing holdings)
    }
    return { allowed: true };
  }

  // 3. Automatic Orders: MUST pass Authoritative Bot State verification
  const botState = await getAuthoritativeBotState();

  if (!botState.enabled || botState.status === 'STOPPED') {
    const msg = `[EXECUTION GUARD REJECT] Bot is STOPPED / DISABLED. Automatic order rejected for ${normSymbol} (${normSide}).`;
    console.warn(msg);
    return {
      allowed: false,
      code: 'BOT_DISABLED',
      reason: `Bot Engine is currently STOPPED/DISABLED. New orders are strictly forbidden.`,
    };
  }

  if (botState.circuitBreakerTripped || botState.status === 'PAUSED') {
    const msg = `[EXECUTION GUARD REJECT] Circuit Breaker is active. Trading paused for ${normSymbol}.`;
    console.warn(msg);
    return {
      allowed: false,
      code: 'CIRCUIT_BREAKER_ACTIVE',
      reason: `Circuit Breaker is active due to daily loss protection. Order rejected.`,
    };
  }

  // 4. Spot Market Rule: No Short/Sell opening orders
  if (normMarket === 'SPOT' && (normSide === 'SHORT' || normSide === 'SELL')) {
    return {
      allowed: false,
      code: 'SPOT_SHORT_FORBIDDEN',
      reason: `Short selling is not supported on Binance Spot market (Long/Buy only).`,
    };
  }

  // 5. Market Type Mismatch Guard:
  if (normMarket !== botState.marketType) {
    return {
      allowed: false,
      code: 'MARKET_TYPE_MISMATCH',
      reason: `Order market type (${normMarket}) does not match active Bot market type (${botState.marketType}).`,
    };
  }

  // 5b. Execution Mode Mismatch Guard:
  if (params.executionMode && params.executionMode !== botState.executionMode) {
    return {
      allowed: false,
      code: 'EXECUTION_MODE_MISMATCH',
      reason: `Order execution mode (${params.executionMode}) does not match active Bot mode (${botState.executionMode}).`,
    };
  }

  // 6. Anti-Duplicate & Idempotency Check:
  // If clientOrderId is provided, use it. If not, generate a key.
  const idempotencyKey = params.clientOrderId 
    ? `order_${params.clientOrderId}`
    : `${normSymbol}_${normMarket}_${normSide}_${params.strategyId || 'AUTO'}`;
    
  const existingLock = orderIdempotencyCache.get(idempotencyKey);
  // Only block if a previous identical order is still strictly PENDING and within 8 seconds
  if (existingLock && existingLock.status === 'PENDING' && Date.now() - existingLock.timestamp < 8000) {
    // If the exact same clientOrderId is passed again within the same execution flow, permit it
    if (params.clientOrderId && idempotencyKey === `order_${params.clientOrderId}`) {
      // Re-entrant check within the same execution pipeline: allow
      return { allowed: true };
    }
    return {
      allowed: false,
      code: 'DUPLICATE_ORDER_IN_FLIGHT',
      reason: `Duplicate order execution in-flight for ${normSymbol} (${normSide}). Please wait for current order to settle.`,
    };
  }

  // 7. Check In-Flight Lock on Symbol (only for new opening orders, not reduceOnly)
  if (inFlightExecutionLocks.has(normSymbol) && !params.clientOrderId) {
    return {
      allowed: false,
      code: 'SYMBOL_LOCKED_IN_FLIGHT',
      reason: `Symbol ${normSymbol} is currently in-flight. Parallel duplicate order rejected.`,
    };
  }

  // 8. Check Existing Active Position for this symbol, marketType, and executionMode
  try {
    const posStr = await kv.get('btc_active_bot_positions');
    const positions = posStr ? JSON.parse(posStr) : [];
    const duplicatePos = positions.find((p: any) =>
      p &&
      p.symbol &&
      p.symbol.toUpperCase() === normSymbol &&
      (p.marketType || 'SPOT') === normMarket &&
      (p.mode || 'PAPER') === botState.executionMode
    );
    if (duplicatePos) {
      return {
        allowed: false,
        code: 'POSITION_ALREADY_EXISTS',
        reason: `An active position for ${normSymbol} already exists in ${normMarket} (${botState.executionMode}). Duplicate order rejected.`,
      };
    }
  } catch (_) {}

  // 9. Cooldown Check
  const nextAllowed = symbolCooldownMap.get(normSymbol) || 0;
  if (Date.now() < nextAllowed) {
    const remainingSec = Math.ceil((nextAllowed - Date.now()) / 1000);
    return {
      allowed: false,
      code: 'SYMBOL_IN_COOLDOWN',
      reason: `Symbol ${normSymbol} is in cooldown (${remainingSec}s remaining).`,
    };
  }

  // Record idempotency lock
  orderIdempotencyCache.set(idempotencyKey, { timestamp: Date.now(), status: 'PENDING' });

  return { allowed: true };
}

/**
 * Stop the Bot Engine:
 * Stops all automatic order-generation loops, timers, and cancels internal pending trade jobs.
 * PRESERVES existing positions (does NOT close or delete them).
 */
export async function stopBotAuthoritative(reason: string = 'User requested stop'): Promise<AuthoritativeBotState> {
  console.log(`🛑 [BOT CONTROL] STOPPING BOT ENGINE: ${reason}`);

  // 1. Stop Market Scanner & background polling
  stopMarketScanner();

  // 2. Clear in-flight execution locks
  inFlightExecutionLocks.clear();

  // 3. Update authoritative config in KV
  let config: any = {};
  try {
    const raw = await kv.get('btc_bot_config');
    if (raw) config = JSON.parse(raw);
  } catch (_) {}

  config.enabled = false;
  config.stoppedAt = Date.now();
  config.stoppedReason = reason;

  await kv.set('btc_bot_config', JSON.stringify(config));

  console.log(`✅ [BOT CONTROL] Bot state successfully set to DISABLED (enabled: false). Existing positions preserved.`);

  return getAuthoritativeBotState();
}

/**
 * Start the Bot Engine:
 * Enables automatic strategy scanning and trade execution.
 */
export async function startBotAuthoritative(): Promise<AuthoritativeBotState> {
  console.log(`▶️ [BOT CONTROL] STARTING BOT ENGINE`);

  let config: any = {};
  try {
    const raw = await kv.get('btc_bot_config');
    if (raw) config = JSON.parse(raw);
  } catch (_) {}

  config.enabled = true;
  config.circuitBreakerTripped = false;
  config.enabledAt = Date.now();
  delete config.stoppedAt;
  delete config.stoppedReason;

  await kv.set('btc_bot_config', JSON.stringify(config));

  // Start market scanner
  startMarketScanner();

  console.log(`✅ [BOT CONTROL] Bot state successfully set to ENABLED (enabled: true).`);

  return getAuthoritativeBotState();
}
