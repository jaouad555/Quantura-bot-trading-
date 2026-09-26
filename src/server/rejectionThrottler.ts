/**
 * Rejection Throttler & Circuit Breaker Layer
 * Prevents overtrading retry loops when the Risk Engine rejects entry signals.
 */

export interface RejectionThrottleState {
  consecutiveRejections: number;
  lastRejectedAt: number;
  cooldownUntil: number;
  lastReasonCode?: string;
  lastLoggedAt: number;
}

// Configurable via environment variables with sane defaults
const REJECT_COOLDOWN_MS = Number(process.env.REJECT_COOLDOWN_MS) || 5 * 60 * 1000; // 5 minutes
const MAX_CONSECUTIVE_REJECTIONS = Number(process.env.MAX_CONSECUTIVE_REJECTIONS) || 5; // 5 attempts
const EXTENDED_COOLDOWN_MS = Number(process.env.EXTENDED_COOLDOWN_MS) || 30 * 60 * 1000; // 30 minutes
const LOG_SUPPRESSION_INTERVAL_MS = 60 * 1000; // Log at most once per 60s during cooldown

// In-memory registry for (symbol + strategy) rejection states
const rejectionMap = new Map<string, RejectionThrottleState>();

function getThrottleKey(symbol: string, strategyId: string): string {
  return `${symbol.toUpperCase()}:${strategyId}`;
}

/**
 * Checks if a given (symbol + strategy) pair is currently in a rejection cooldown.
 */
export function isSignalThrottled(symbol: string, strategyId: string): {
  throttled: boolean;
  remainingSec: number;
  consecutive: number;
  isCircuitBreaker: boolean;
  shouldLog: boolean;
} {
  const key = getThrottleKey(symbol, strategyId);
  const state = rejectionMap.get(key);

  if (!state) {
    return { throttled: false, remainingSec: 0, consecutive: 0, isCircuitBreaker: false, shouldLog: false };
  }

  const now = Date.now();
  if (now < state.cooldownUntil) {
    const remainingSec = Math.ceil((state.cooldownUntil - now) / 1000);
    const isCircuitBreaker = state.consecutiveRejections >= MAX_CONSECUTIVE_REJECTIONS;
    const shouldLog = now - state.lastLoggedAt >= LOG_SUPPRESSION_INTERVAL_MS;

    if (shouldLog) {
      state.lastLoggedAt = now;
    }

    return {
      throttled: true,
      remainingSec,
      consecutive: state.consecutiveRejections,
      isCircuitBreaker,
      shouldLog,
    };
  }

  return { throttled: false, remainingSec: 0, consecutive: state.consecutiveRejections, isCircuitBreaker: false, shouldLog: false };
}

/**
 * Records a risk rejection for a (symbol + strategy) pair.
 * Applies standard cooldown (5m) or circuit-breaker extended cooldown (30m).
 */
export function recordSignalRejection(
  symbol: string,
  strategyId: string,
  reasonCode?: string,
  message?: string
): {
  consecutive: number;
  isCircuitBreaker: boolean;
  cooldownMinutes: number;
  cooldownUntil: number;
} {
  const key = getThrottleKey(symbol, strategyId);
  const now = Date.now();
  const state = rejectionMap.get(key) || {
    consecutiveRejections: 0,
    lastRejectedAt: 0,
    cooldownUntil: 0,
    lastLoggedAt: 0,
  };

  state.consecutiveRejections += 1;
  state.lastRejectedAt = now;
  state.lastReasonCode = reasonCode;
  state.lastLoggedAt = now;

  const isCircuitBreaker = state.consecutiveRejections >= MAX_CONSECUTIVE_REJECTIONS;
  const cooldownDuration = isCircuitBreaker ? EXTENDED_COOLDOWN_MS : REJECT_COOLDOWN_MS;
  state.cooldownUntil = now + cooldownDuration;

  rejectionMap.set(key, state);

  return {
    consecutive: state.consecutiveRejections,
    isCircuitBreaker,
    cooldownMinutes: Math.round(cooldownDuration / 60000),
    cooldownUntil: state.cooldownUntil,
  };
}

/**
 * Resets the rejection counter and clears cooldown upon successful entry.
 */
export function resetSignalRejection(symbol: string, strategyId: string): void {
  const key = getThrottleKey(symbol, strategyId);
  rejectionMap.delete(key);
}

/**
 * Returns current snapshot of all active rejection throttles for diagnostics.
 */
export function getRejectionThrottleStats(): Record<string, RejectionThrottleState> {
  const stats: Record<string, RejectionThrottleState> = {};
  const now = Date.now();
  rejectionMap.forEach((val, key) => {
    if (now < val.cooldownUntil) {
      stats[key] = { ...val };
    }
  });
  return stats;
}
