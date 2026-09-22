import { RiskEngineConfig, RiskLockStatus } from './types';

export interface DrawdownState {
  startingDailyEquity: number;
  lastDailyResetTimestamp: number;
  peakEquity: number;
  dailyRealizedPnl: number;
  dailyFeesPaid: number;
  dailyFundingPaid: number;
  consecutiveLosses: number;
  consecutiveWins: number;
  lastClosedTradePnl?: number;
  lastClosedTradeSizeUsdt?: number;
  lastClosedTradeLeverage?: number;
}

export class DrawdownTracker {
  private state: DrawdownState;

  constructor(initialEquity: number = 1000) {
    this.state = {
      startingDailyEquity: initialEquity,
      lastDailyResetTimestamp: Date.now(),
      peakEquity: initialEquity,
      dailyRealizedPnl: 0,
      dailyFeesPaid: 0,
      dailyFundingPaid: 0,
      consecutiveLosses: 0,
      consecutiveWins: 0,
    };
  }

  public getState(): DrawdownState {
    return { ...this.state };
  }

  public setState(newState: Partial<DrawdownState>) {
    this.state = { ...this.state, ...newState };
  }

  /**
   * Check and reset daily baseline on UTC midnight
   */
  public checkDailyReset(currentEquity: number) {
    const now = new Date();
    const lastReset = new Date(this.state.lastDailyResetTimestamp);
    
    // If UTC day changed
    if (
      now.getUTCDate() !== lastReset.getUTCDate() ||
      now.getUTCMonth() !== lastReset.getUTCMonth() ||
      now.getUTCFullYear() !== lastReset.getUTCFullYear()
    ) {
      this.state.startingDailyEquity = currentEquity > 0 ? currentEquity : this.state.startingDailyEquity;
      this.state.dailyRealizedPnl = 0;
      this.state.dailyFeesPaid = 0;
      this.state.dailyFundingPaid = 0;
      this.state.lastDailyResetTimestamp = Date.now();
    }

    if (currentEquity > this.state.peakEquity) {
      this.state.peakEquity = currentEquity;
    }
  }

  /**
   * Calculate exact daily loss metrics
   */
  public calculateDailyMetrics(currentEquity: number, unrealizedPnl: number = 0) {
    this.checkDailyReset(currentEquity);

    const startEquity = this.state.startingDailyEquity > 0 ? this.state.startingDailyEquity : currentEquity;
    const netDailyPnlUsdt = this.state.dailyRealizedPnl + unrealizedPnl - this.state.dailyFeesPaid - this.state.dailyFundingPaid;
    const netDailyPnlPercent = startEquity > 0 ? (netDailyPnlUsdt / startEquity) * 100 : 0;
    
    // Daily Loss is positive when losing
    const dailyLossPercent = netDailyPnlPercent < 0 ? Math.abs(netDailyPnlPercent) : 0;

    // Account Drawdown from all-time peak
    const peak = Math.max(this.state.peakEquity, currentEquity);
    const accountDrawdownUsdt = peak > currentEquity ? peak - currentEquity : 0;
    const accountDrawdownPercent = peak > 0 ? (accountDrawdownUsdt / peak) * 100 : 0;

    return {
      startingDailyEquity: startEquity,
      currentEquity,
      peakEquity: peak,
      netDailyPnlUsdt,
      netDailyPnlPercent,
      dailyLossPercent,
      accountDrawdownPercent,
    };
  }

  /**
   * Evaluate if Daily Loss or Drawdown limits are breached
   */
  public evaluateLimits(
    currentEquity: number,
    unrealizedPnl: number,
    config: RiskEngineConfig
  ): {
    isBreached: boolean;
    reasonCode?: 'DAILY_LOSS_LIMIT' | 'MAX_DRAWDOWN';
    message?: string;
    lockStatus: RiskLockStatus;
    dailyLossPercent: number;
    accountDrawdownPercent: number;
  } {
    const metrics = this.calculateDailyMetrics(currentEquity, unrealizedPnl);

    // 1. Check Hard Daily Loss Limit (Default 3%)
    if (metrics.dailyLossPercent >= config.maxDailyLossPercent) {
      return {
        isBreached: true,
        reasonCode: 'DAILY_LOSS_LIMIT',
        message: `Daily loss limit reached (${metrics.dailyLossPercent.toFixed(2)}% >= ${config.maxDailyLossPercent}%). Trading locked for capital preservation.`,
        lockStatus: 'LOCKED',
        dailyLossPercent: metrics.dailyLossPercent,
        accountDrawdownPercent: metrics.accountDrawdownPercent,
      };
    }

    // 2. Check Maximum Account Drawdown (Default 10%)
    if (metrics.accountDrawdownPercent >= config.maxAccountDrawdownPercent) {
      return {
        isBreached: true,
        reasonCode: 'MAX_DRAWDOWN',
        message: `Maximum account drawdown exceeded (${metrics.accountDrawdownPercent.toFixed(2)}% >= ${config.maxAccountDrawdownPercent}%). Manual unlock required.`,
        lockStatus: 'LOCKED',
        dailyLossPercent: metrics.dailyLossPercent,
        accountDrawdownPercent: metrics.accountDrawdownPercent,
      };
    }

    // Loss Streak Warnings
    if (this.state.consecutiveLosses >= config.consecutiveLossStreakLock) {
      return {
        isBreached: true,
        reasonCode: 'DAILY_LOSS_LIMIT',
        message: `Loss streak limit reached (${this.state.consecutiveLosses} consecutive losses). Risk lock activated.`,
        lockStatus: 'LOCKED',
        dailyLossPercent: metrics.dailyLossPercent,
        accountDrawdownPercent: metrics.accountDrawdownPercent,
      };
    }

    if (this.state.consecutiveLosses >= config.consecutiveLossStreakPause) {
      return {
        isBreached: true,
        reasonCode: 'DAILY_LOSS_LIMIT',
        message: `Loss streak cooling-off active (${this.state.consecutiveLosses} consecutive losses). New trades paused.`,
        lockStatus: 'RESTRICTED',
        dailyLossPercent: metrics.dailyLossPercent,
        accountDrawdownPercent: metrics.accountDrawdownPercent,
      };
    }

    let status: RiskLockStatus = 'NORMAL';
    if (metrics.dailyLossPercent >= config.maxDailyLossPercent * 0.75 || this.state.consecutiveLosses >= config.consecutiveLossStreakReduce50) {
      status = 'WARNING';
    }

    return {
      isBreached: false,
      lockStatus: status,
      dailyLossPercent: metrics.dailyLossPercent,
      accountDrawdownPercent: metrics.accountDrawdownPercent,
    };
  }

  /**
   * Anti-Martingale / Anti-Revenge Validation
   * Rejects attempts to double position size or leverage after losing trades
   */
  public checkAntiMartingale(
    proposedRiskPercent: number,
    proposedLeverage: number,
    configuredRiskPercent: number
  ): { isValid: boolean; error?: string } {
    // If the trader is on a loss streak
    if (this.state.consecutiveLosses > 0) {
      // Risk percentage cannot exceed normal baseline
      if (proposedRiskPercent > configuredRiskPercent * 1.2) {
        return {
          isValid: false,
          error: `Anti-Martingale Violation: Risk percentage (${proposedRiskPercent}%) increased after consecutive losses. Increasing risk to recover losses is strictly forbidden.`,
        };
      }

      // Leverage cannot be escalated abnormally after a loss (only flag if previous trade was leveraged and new leverage is spiked > 2x)
      const lastLev = this.state.lastClosedTradeLeverage || 1;
      if (lastLev > 1 && proposedLeverage > lastLev * 2.0 && proposedLeverage > 5) {
        return {
          isValid: false,
          error: `Anti-Revenge Violation: Leverage escalated from ${lastLev}x to ${proposedLeverage}x after a loss. Overleveraging on loss is forbidden.`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Record a completed trade result
   */
  public recordTradeClosed(pnlUsdt: number, feesUsdt: number = 0, sizeUsdt: number = 0, leverage: number = 1) {
    this.state.dailyRealizedPnl += pnlUsdt;
    this.state.dailyFeesPaid += feesUsdt;
    this.state.lastClosedTradePnl = pnlUsdt;
    this.state.lastClosedTradeSizeUsdt = sizeUsdt;
    this.state.lastClosedTradeLeverage = leverage;

    if (pnlUsdt < 0) {
      this.state.consecutiveLosses += 1;
      this.state.consecutiveWins = 0;
    } else if (pnlUsdt > 0) {
      this.state.consecutiveWins += 1;
      this.state.consecutiveLosses = 0;
    }
  }
}
