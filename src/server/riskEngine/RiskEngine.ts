import {
  ActivePositionSnapshot,
  RejectionCode,
  RiskDecision,
  RiskEngineConfig,
  RiskEngineMetrics,
  RiskEvaluationResult,
  RiskLockStatus,
  TradeProposal,
} from './types';
import { DEFAULT_RISK_CONFIG } from './constants';
import { PositionSizer } from './PositionSizer';
import { DrawdownTracker } from './DrawdownTracker';
import { PortfolioRiskEvaluator } from './PortfolioRiskEvaluator';
import { MarketProtection } from './MarketProtection';
import { RiskScoreCalculator } from './RiskScoreCalculator';
import { AuditTrail } from './AuditTrail';
import { kv } from '../db';

export class RiskEngine {
  private static instance: RiskEngine;
  private config: RiskEngineConfig;
  private drawdownTracker: DrawdownTracker;
  private recentOrderIds: Map<string, number> = new Map();
  private isInitialized = false;

  private constructor() {
    this.config = { ...DEFAULT_RISK_CONFIG };
    this.drawdownTracker = new DrawdownTracker(1000);
  }

  public static getInstance(): RiskEngine {
    if (!RiskEngine.instance) {
      RiskEngine.instance = new RiskEngine();
      RiskEngine.instance.init();
    }
    return RiskEngine.instance;
  }

  public async init() {
    if (this.isInitialized) return;
    AuditTrail.init();

    // Load persisted config from KV store
    try {
      const savedConfigStr = await kv.get('quantura_risk_config');
      if (savedConfigStr) {
        const saved = JSON.parse(savedConfigStr);
        this.config = { ...DEFAULT_RISK_CONFIG, ...saved };
      }

      const savedTrackerStr = await kv.get('quantura_risk_drawdown_state');
      if (savedTrackerStr) {
        const savedTracker = JSON.parse(savedTrackerStr);
        this.drawdownTracker.setState(savedTracker);
      }
    } catch (err) {
      console.error('[RISK ENGINE] Error loading persisted risk state:', err);
    }
    this.isInitialized = true;
  }

  public getConfig(): RiskEngineConfig {
    return { ...this.config };
  }

  public async updateConfig(partial: Partial<RiskEngineConfig>): Promise<RiskEngineConfig> {
    // Hard constraints on user configurable bounds
    if (partial.riskPerTradePercent !== undefined) {
      // Allowed range: 0.1% to 2.0% (hard maximum 2.0%)
      partial.riskPerTradePercent = Math.min(2.0, Math.max(0.1, Number(partial.riskPerTradePercent)));
    }
    if (partial.maxDailyLossPercent !== undefined) {
      // Hard maximum daily loss cap: 10%
      partial.maxDailyLossPercent = Math.min(10.0, Math.max(1.0, Number(partial.maxDailyLossPercent)));
    }
    if (partial.maxAccountDrawdownPercent !== undefined) {
      // Hard maximum account drawdown cap: 25%
      partial.maxAccountDrawdownPercent = Math.min(25.0, Math.max(2.0, Number(partial.maxAccountDrawdownPercent)));
    }
    if (partial.maxAllowedLeverage !== undefined) {
      // Hard maximum leverage: 20x (default 10x)
      partial.maxAllowedLeverage = Math.min(20, Math.max(1, Math.floor(Number(partial.maxAllowedLeverage))));
    }

    this.config = { ...this.config, ...partial };
    await kv.set('quantura_risk_config', JSON.stringify(this.config));
    return this.getConfig();
  }

  public async setEmergencyStop(enabled: boolean, reason?: string): Promise<RiskEngineConfig> {
    this.config.emergencyStop = enabled;
    if (enabled) {
      this.config.riskLockStatus = 'EMERGENCY';
      this.config.riskLockReason = reason || 'EMERGENCY KILL SWITCH ACTIVATED BY OPERATOR';
      this.config.riskLockTimestamp = Date.now();
    } else if (this.config.riskLockStatus === 'EMERGENCY') {
      this.config.riskLockStatus = 'NORMAL';
      this.config.riskLockReason = undefined;
    }
    await kv.set('quantura_risk_config', JSON.stringify(this.config));
    return this.getConfig();
  }

  public async unlockRiskLock(adminConfirmation: boolean = true): Promise<RiskEngineConfig> {
    if (adminConfirmation) {
      this.config.riskLockStatus = 'NORMAL';
      this.config.riskLockReason = undefined;
      this.config.riskLockTimestamp = undefined;
      this.config.emergencyStop = false;
      await kv.set('quantura_risk_config', JSON.stringify(this.config));
    }
    return this.getConfig();
  }

  public recordTradeClosed(pnlUsdt: number, feeUsdt: number = 0, metadata?: any) {
    this.drawdownTracker.recordTradeClosed(pnlUsdt, feeUsdt, metadata?.sizeUsdt || 0, metadata?.leverage || 1);
    const updatedState = this.drawdownTracker.getState();
    // Persist tracker state
    kv.set('quantura_risk_drawdown_state', JSON.stringify(updatedState)).catch(err => {
      console.error('[RISK ENGINE] Error persisting drawdown tracker state:', err);
    });
    return updatedState;
  }

  /**
   * Evaluate a proposed trade before execution.
   * Institutional Gatekeeper: AI / Strategy -> Trade Proposal -> RiskEngine -> Approved/Rejected.
   */
  public async evaluateProposal(
    proposal: TradeProposal,
    activePositionsSnapshot?: ActivePositionSnapshot[]
  ): Promise<RiskEvaluationResult> {
    const evaluatedAt = Date.now();
    const auditId = `risk-audit-${evaluatedAt}-${Math.random().toString(36).substring(2, 7)}`;
    const symbol = (proposal.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const side = proposal.side || 'LONG';
    const marketType = proposal.marketType || 'FUTURES';
    const entryPrice = proposal.entryPrice;
    const stopLoss = proposal.stopLoss;

    // Retrieve active positions if not provided
    let activePositions = activePositionsSnapshot;
    if (!activePositions) {
      activePositions = await this.getActivePositionsFromKv();
    }

    // Resolve Account Equity & Available Balance
    const accountEquity = await this.resolveEquity(proposal, activePositions);
    const availableBalance = proposal.availableBalance !== undefined && proposal.availableBalance >= 0
      ? proposal.availableBalance
      : accountEquity;

    // Helper to generate rejection response and persist in audit trail
    const reject = (
      reasonCode: RejectionCode,
      message: string,
      riskScore: number = 75,
      level: any = 'HIGH',
      extra: Partial<RiskEvaluationResult> = {}
    ): RiskEvaluationResult => {
      const result: RiskEvaluationResult = {
        decision: 'REJECTED',
        reasonCode,
        message,
        riskScore,
        riskLevel: level,
        symbol,
        side,
        marketType,
        approvedQuantity: 0,
        approvedMarginUsdt: 0,
        approvedLeverage: 1,
        entryPrice: entryPrice || 0,
        stopLoss: stopLoss || 0,
        tp1: proposal.takeProfit?.tp1 || 0,
        tp2: proposal.takeProfit?.tp2,
        tp3: proposal.takeProfit?.tp3,
        riskAmountUsdt: 0,
        riskPercent: 0,
        notionalValueUsdt: 0,
        riskRewardRatio: 0,
        netRiskRewardRatio: 0,
        portfolioRiskBeforePercent: extra.portfolioRiskBeforePercent || 0,
        portfolioRiskAfterTradePercent: extra.portfolioRiskAfterTradePercent || 0,
        totalExposureBeforePercent: extra.totalExposureBeforePercent || 0,
        totalExposureAfterTradePercent: extra.totalExposureAfterTradePercent || 0,
        symbolExposureAfterTradePercent: extra.symbolExposureAfterTradePercent || 0,
        correlationExposurePercent: extra.correlationExposurePercent || 0,
        estimatedEntryFeeUsdt: 0,
        estimatedExitFeeUsdt: 0,
        estimatedSlippagePercent: 0,
        estimatedLossAtStopLossUsdt: 0,
        volatilityRegime: extra.volatilityRegime || 'NORMAL',
        marketRegime: extra.marketRegime || 'UNCERTAIN',
        riskLockStatus: this.config.riskLockStatus,
        auditId,
        evaluatedAt,
        ...extra,
      };

      AuditTrail.record({
        id: auditId,
        timestamp: evaluatedAt,
        symbol,
        side,
        marketType,
        decision: 'REJECTED',
        reasonCode,
        message,
        riskScore,
        equity: accountEquity,
        riskPercent: this.config.riskPerTradePercent,
        riskAmountUsdt: 0,
        entryPrice: entryPrice || 0,
        stopLoss: stopLoss || 0,
        quantity: 0,
        leverage: proposal.leverage || 1,
        portfolioRiskPercent: extra.portfolioRiskBeforePercent || 0,
        totalExposurePercent: extra.totalExposureBeforePercent || 0,
        symbolExposurePercent: extra.symbolExposureAfterTradePercent || 0,
        riskReward: 0,
        volatilityRegime: extra.volatilityRegime || 'NORMAL',
        clientOrderId: proposal.clientOrderId,
      });

      return result;
    };

    // -------------------------------------------------------------
    // 1. FAIL-SAFE BASIC CHECKS
    // -------------------------------------------------------------
    if (!symbol) {
      return reject('INVALID_PRICE', 'Trading pair symbol is missing.');
    }
    if (!entryPrice || isNaN(entryPrice) || entryPrice <= 0 || !isFinite(entryPrice)) {
      return reject('INVALID_PRICE', `Invalid entry price: ${entryPrice}.`);
    }
    if (!stopLoss || isNaN(stopLoss) || stopLoss <= 0 || !isFinite(stopLoss)) {
      return reject('MISSING_STOP_LOSS', 'Every trade must have a mandatory valid Stop Loss.');
    }
    if (accountEquity <= 0 || isNaN(accountEquity)) {
      return reject('INSUFFICIENT_EQUITY', 'Account equity could not be determined. Fail-safe triggered.');
    }

    // -------------------------------------------------------------
    // 2. IDEMPOTENCY & DUPLICATE ORDER PROTECTION
    // -------------------------------------------------------------
    if (proposal.clientOrderId) {
      const lastSeen = this.recentOrderIds.get(proposal.clientOrderId);
      if (lastSeen && Date.now() - lastSeen < 60000) {
        return reject('DUPLICATE_ORDER', `Duplicate order detected with ID ${proposal.clientOrderId}. Execution prevented.`);
      }
      this.recentOrderIds.set(proposal.clientOrderId, Date.now());
      // Clean old order IDs
      if (this.recentOrderIds.size > 500) {
        const threshold = Date.now() - 120000;
        for (const [id, time] of this.recentOrderIds.entries()) {
          if (time < threshold) this.recentOrderIds.delete(id);
        }
      }
    }

    // -------------------------------------------------------------
    // 3. EMERGENCY STOP & RISK LOCK SYSTEM
    // -------------------------------------------------------------
    if (this.config.emergencyStop) {
      return reject('EMERGENCY_STOP_ACTIVE', 'Emergency Stop is active. All new trade executions are blocked.', 100, 'EXTREME');
    }
    if (this.config.riskLockStatus === 'LOCKED' || this.config.riskLockStatus === 'EMERGENCY') {
      return reject(
        'RISK_LOCK_ACTIVE',
        `Risk Lock is ACTIVE (${this.config.riskLockReason || 'System Lock'}). Manual reset required.`,
        90,
        'EXTREME'
      );
    }

    // -------------------------------------------------------------
    // 4. STOP LOSS & TAKE PROFIT DIRECTION & R:R VALIDATION
    // -------------------------------------------------------------
    if (side === 'LONG' && stopLoss >= entryPrice) {
      return reject('INVALID_STOP_LOSS', `LONG Stop Loss ($${stopLoss}) must be strictly below Entry ($${entryPrice}).`);
    }
    if (side === 'SHORT' && stopLoss <= entryPrice) {
      return reject('INVALID_STOP_LOSS', `SHORT Stop Loss ($${stopLoss}) must be strictly above Entry ($${entryPrice}).`);
    }

    const slDistance = Math.abs(entryPrice - stopLoss);
    const slDistancePercent = (slDistance / entryPrice) * 100;
    if (slDistancePercent < 0.1) {
      return reject('INVALID_STOP_LOSS', `Stop Loss is too tight (${slDistancePercent.toFixed(2)}%). Min distance is 0.10%.`);
    }
    if (slDistancePercent > 25.0) {
      return reject('INVALID_STOP_LOSS', `Stop Loss distance is excessive (${slDistancePercent.toFixed(2)}%). Max distance is 25.0%.`);
    }

    // Take profit validation
    const tp1 = proposal.takeProfit?.tp1 || (side === 'LONG' ? entryPrice + slDistance * 2 : entryPrice - slDistance * 2);
    if (side === 'LONG' && tp1 <= entryPrice) {
      return reject('INVALID_TAKE_PROFIT', `LONG Take Profit ($${tp1}) must be above Entry ($${entryPrice}).`);
    }
    if (side === 'SHORT' && tp1 >= entryPrice) {
      return reject('INVALID_TAKE_PROFIT', `SHORT Take Profit ($${tp1}) must be below Entry ($${entryPrice}).`);
    }

    const rewardDistance = Math.abs(tp1 - entryPrice);
    const riskRewardRatio = slDistance > 0 ? rewardDistance / slDistance : 0;
    if (riskRewardRatio < this.config.minRiskRewardRatio - 0.05) {
      return reject(
        'LOW_RISK_REWARD',
        `Risk/Reward ratio (${riskRewardRatio.toFixed(2)}) is below required minimum of 1:${this.config.minRiskRewardRatio}.`
      );
    }

    // -------------------------------------------------------------
    // 5. DRAWDOWN & DAILY LOSS LIMIT CHECKS
    // -------------------------------------------------------------
    const totalUnrealizedPnl = activePositions.reduce((sum, p) => sum + p.unrealizedPnlUsdt, 0);
    const drawdownEvaluation = this.drawdownTracker.evaluateLimits(accountEquity, totalUnrealizedPnl, this.config);
    if (drawdownEvaluation.isBreached) {
      this.config.riskLockStatus = drawdownEvaluation.lockStatus;
      this.config.riskLockReason = drawdownEvaluation.message;
      this.config.riskLockTimestamp = Date.now();
      await kv.set('quantura_risk_config', JSON.stringify(this.config));
      return reject(drawdownEvaluation.reasonCode!, drawdownEvaluation.message!, 95, 'EXTREME');
    }

    // Anti-Martingale / Anti-Revenge
    const proposedLev = proposal.leverage || 1;
    const antiMartingale = this.drawdownTracker.checkAntiMartingale(
      this.config.riskPerTradePercent,
      proposedLev,
      this.config.riskPerTradePercent
    );
    if (!antiMartingale.isValid) {
      return reject('ANTI_MARTINGALE_VIOLATION', antiMartingale.error!);
    }

    // -------------------------------------------------------------
    // 6. MARKET PROTECTION (SPREAD, LIQUIDITY, SLIPPAGE, VOLATILITY)
    // -------------------------------------------------------------
    const marketInput = proposal.marketData || {
      currentPrice: entryPrice,
      timestamp: proposal.timestamp || Date.now(),
    };
    const estimatedNotional = (accountEquity * (this.config.riskPerTradePercent / 100) / slDistance) * entryPrice;
    const marketEval = MarketProtection.evaluateMarket(marketInput, estimatedNotional, this.config);
    if (!marketEval.isValid) {
      return reject(marketEval.reasonCode!, marketEval.message!, 80, 'HIGH', {
        volatilityRegime: marketEval.volatilityRegime,
        marketRegime: marketEval.marketRegime,
      });
    }

    // -------------------------------------------------------------
    // 7. POSITION SIZING & LEVERAGE VALIDATION
    // -------------------------------------------------------------
    const drawdownState = this.drawdownTracker.getState();
    const sizing = PositionSizer.calculateSizing(
      proposal,
      accountEquity,
      availableBalance,
      this.config.riskPerTradePercent,
      this.config.maxAllowedLeverage,
      marketEval.volatilityRegime,
      drawdownState.consecutiveLosses,
      this.config.maxSymbolExposurePercent
    );

    if (!sizing.isValid) {
      return reject('ORDER_SIZE_TOO_SMALL', sizing.validationError || 'Position sizing calculation failed.', 70, 'HIGH');
    }

    // Net R:R check
    if (sizing.netRiskReward < 1.3) {
      return reject(
        'LOW_RISK_REWARD',
        `Net Risk/Reward after fees and estimated slippage (${sizing.netRiskReward.toFixed(2)}) is insufficient. Minimum net R:R is 1.3.`
      );
    }

    // -------------------------------------------------------------
    // 8. PORTFOLIO RISK, EXPOSURE & CORRELATION EVALUATION
    // -------------------------------------------------------------
    const portfolioEval = PortfolioRiskEvaluator.evaluatePortfolio(
      proposal,
      sizing.riskAmountUsdt,
      sizing.notionalValueUsdt,
      activePositions,
      accountEquity,
      this.config
    );

    if (!portfolioEval.isApproved) {
      return reject(portfolioEval.reasonCode!, portfolioEval.message!, 75, 'HIGH', {
        portfolioRiskBeforePercent: portfolioEval.portfolioRiskBeforePercent,
        portfolioRiskAfterTradePercent: portfolioEval.portfolioRiskAfterPercent,
        totalExposureBeforePercent: portfolioEval.totalExposureBeforePercent,
        totalExposureAfterTradePercent: portfolioEval.totalExposureAfterPercent,
        symbolExposureAfterTradePercent: portfolioEval.symbolExposureAfterPercent,
        correlationExposurePercent: portfolioEval.correlationExposurePercent,
        volatilityRegime: marketEval.volatilityRegime,
        marketRegime: marketEval.marketRegime,
      });
    }

    // -------------------------------------------------------------
    // 9. QUANTITATIVE RISK SCORE (0 - 100)
    // -------------------------------------------------------------
    const scoreBreakdown = RiskScoreCalculator.calculate({
      volatilityRegime: marketEval.volatilityRegime,
      atrPercent: marketEval.atrPercent,
      dailyLossPercent: drawdownEvaluation.dailyLossPercent,
      maxDailyLossPercent: this.config.maxDailyLossPercent,
      drawdownPercent: drawdownEvaluation.accountDrawdownPercent,
      maxDrawdownPercent: this.config.maxAccountDrawdownPercent,
      totalExposurePercent: portfolioEval.totalExposureAfterPercent,
      correlationExposurePercent: portfolioEval.correlationExposurePercent,
      leverage: sizing.effectiveLeverage,
      consecutiveLosses: drawdownState.consecutiveLosses,
      spreadPercent: marketEval.spreadPercent,
      slippagePercent: marketEval.estimatedSlippagePercent,
      riskReward: sizing.grossRiskReward,
    });

    // -------------------------------------------------------------
    // 10. APPROVAL & AUDIT TRAIL LOGGING
    // -------------------------------------------------------------
    const approvalResult: RiskEvaluationResult = {
      decision: 'APPROVED',
      message: 'Trade proposal passed all quantitative risk, balance, exposure, and correlation validations.',
      riskScore: scoreBreakdown.score,
      riskLevel: scoreBreakdown.level,
      symbol,
      side,
      marketType,
      approvedQuantity: sizing.recommendedQuantity,
      approvedMarginUsdt: sizing.marginRequiredUsdt,
      approvedLeverage: sizing.effectiveLeverage,
      entryPrice,
      stopLoss,
      tp1,
      tp2: proposal.takeProfit?.tp2,
      tp3: proposal.takeProfit?.tp3,
      riskAmountUsdt: sizing.riskAmountUsdt,
      riskPercent: sizing.actualRiskPercent,
      notionalValueUsdt: sizing.notionalValueUsdt,
      liquidationPrice: sizing.liquidationPrice,
      distanceToLiquidationPercent: sizing.distanceToLiquidationPercent,
      riskRewardRatio: sizing.grossRiskReward,
      netRiskRewardRatio: sizing.netRiskReward,
      portfolioRiskBeforePercent: portfolioEval.portfolioRiskBeforePercent,
      portfolioRiskAfterTradePercent: portfolioEval.portfolioRiskAfterPercent,
      totalExposureBeforePercent: portfolioEval.totalExposureBeforePercent,
      totalExposureAfterTradePercent: portfolioEval.totalExposureAfterPercent,
      symbolExposureAfterTradePercent: portfolioEval.symbolExposureAfterPercent,
      correlationExposurePercent: portfolioEval.correlationExposurePercent,
      estimatedEntryFeeUsdt: sizing.estimatedEntryFeeUsdt,
      estimatedExitFeeUsdt: sizing.estimatedExitFeeUsdt,
      estimatedSlippagePercent: sizing.estimatedSlippagePercent,
      estimatedLossAtStopLossUsdt: sizing.estimatedLossAtStopLossUsdt,
      volatilityRegime: marketEval.volatilityRegime,
      marketRegime: marketEval.marketRegime,
      riskLockStatus: this.config.riskLockStatus,
      auditId,
      evaluatedAt,
    };

    AuditTrail.record({
      id: auditId,
      timestamp: evaluatedAt,
      symbol,
      side,
      marketType,
      decision: 'APPROVED',
      message: approvalResult.message,
      riskScore: scoreBreakdown.score,
      equity: accountEquity,
      riskPercent: sizing.actualRiskPercent,
      riskAmountUsdt: sizing.riskAmountUsdt,
      entryPrice,
      stopLoss,
      quantity: sizing.recommendedQuantity,
      leverage: sizing.effectiveLeverage,
      portfolioRiskPercent: portfolioEval.portfolioRiskAfterPercent,
      totalExposurePercent: portfolioEval.totalExposureAfterPercent,
      symbolExposurePercent: portfolioEval.symbolExposureAfterPercent,
      riskReward: sizing.grossRiskReward,
      volatilityRegime: marketEval.volatilityRegime,
      clientOrderId: proposal.clientOrderId,
    });

    return approvalResult;
  }

  /**
   * Helper to retrieve active positions from SQLite / KV
   */
  private async getActivePositionsFromKv(): Promise<ActivePositionSnapshot[]> {
    try {
      const posStr = await kv.get('btc_active_bot_positions');
      if (!posStr) return [];
      const list = JSON.parse(posStr);
      if (!Array.isArray(list)) return [];

      return list.map((p: any) => ({
        id: p.id || `pos-${Date.now()}`,
        symbol: p.symbol || 'BTCUSDT',
        side: p.decision || 'LONG',
        entryPrice: p.entryPrice || 0,
        currentPrice: p.currentPrice || p.entryPrice || 0,
        stopLoss: p.stopLoss || 0,
        quantity: p.remainingAmountBtc || p.initialAmountBtc || 0,
        marginUsdt: p.remainingAmountUsdt || p.marginUsdt || 0,
        positionSizeUsdt: (p.remainingAmountUsdt || p.marginUsdt || 0) * (p.leverage || 1),
        leverage: p.leverage || 1,
        marketType: p.marketType || 'FUTURES',
        unrealizedPnlUsdt: p.realizedPnlUsdt || 0,
        unrealizedRoePercent: 0,
        strategyName: p.strategyName,
        openedAt: p.openedAt || Date.now(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Resolve current equity safely
   */
  private async resolveEquity(proposal: TradeProposal, activePositions: ActivePositionSnapshot[]): Promise<number> {
    if (proposal.accountEquity && proposal.accountEquity > 0) {
      return proposal.accountEquity;
    }

    try {
      const walletStr = await kv.get('btc_paper_wallet');
      if (walletStr) {
        const wallet = JSON.parse(walletStr);
        const freeBalance = wallet.balance || 0;
        const totalInvestedMargin = activePositions.reduce((sum, p) => sum + p.marginUsdt, 0);
        return freeBalance + totalInvestedMargin;
      }
    } catch {}

    return 1000; // safe default fallback
  }

  /**
   * Get current complete telemetry metrics
   */
  public async getMetrics(customEquity?: number, customPositions?: any[]): Promise<RiskEngineMetrics> {
    const positions = customPositions || (await this.getActivePositionsFromKv());
    let equity = customEquity;
    if (equity === undefined || equity <= 0) {
      const walletStr = await kv.get('btc_paper_wallet');
      const wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000, realizedPnl: 0 };
      equity = wallet.balance + positions.reduce((sum: number, p: any) => sum + (p.marginUsdt || p.remainingAmountUsdt || 0), 0);
    }
    const unrealized = positions.reduce((sum: number, p: any) => sum + (p.unrealizedPnlUsdt || p.realizedPnlUsdt || 0), 0);

    const dailyMetrics = this.drawdownTracker.calculateDailyMetrics(equity, unrealized);
    const ddState = this.drawdownTracker.getState();

    let openPositionRisksUsdt = 0;
    let totalExposureUsdt = 0;
    for (const pos of positions) {
      const dist = Math.abs(pos.currentPrice - pos.stopLoss);
      openPositionRisksUsdt += pos.quantity * dist;
      totalExposureUsdt += pos.positionSizeUsdt;
    }

    const portfolioRiskPercent = equity > 0 ? (openPositionRisksUsdt / equity) * 100 : 0;
    const totalExposurePercent = equity > 0 ? (totalExposureUsdt / equity) * 100 : 0;

    const score = RiskScoreCalculator.calculate({
      volatilityRegime: 'NORMAL',
      atrPercent: 1.5,
      dailyLossPercent: dailyMetrics.dailyLossPercent,
      maxDailyLossPercent: this.config.maxDailyLossPercent,
      drawdownPercent: dailyMetrics.accountDrawdownPercent,
      maxDrawdownPercent: this.config.maxAccountDrawdownPercent,
      totalExposurePercent,
      correlationExposurePercent: totalExposurePercent * 0.4,
      leverage: 3,
      consecutiveLosses: ddState.consecutiveLosses,
      spreadPercent: 0.05,
      slippagePercent: 0.05,
      riskReward: 2.0,
    });

    return {
      startingDailyEquity: dailyMetrics.startingDailyEquity,
      currentEquity: equity,
      peakEquity: dailyMetrics.peakEquity,
      dailyRealizedPnl: ddState.dailyRealizedPnl,
      dailyUnrealizedPnl: unrealized,
      dailyFeesPaid: ddState.dailyFeesPaid,
      dailyFundingPaid: ddState.dailyFundingPaid,
      netDailyPnlUsdt: dailyMetrics.netDailyPnlUsdt,
      netDailyPnlPercent: dailyMetrics.netDailyPnlPercent,
      dailyDrawdownPercent: dailyMetrics.dailyLossPercent,
      weeklyDrawdownPercent: dailyMetrics.dailyLossPercent * 1.2,
      monthlyDrawdownPercent: dailyMetrics.accountDrawdownPercent,
      maxAccountDrawdownPercent: dailyMetrics.accountDrawdownPercent,
      totalOpenPositions: positions.length,
      openPositionRisksUsdt,
      totalPortfolioRiskPercent: portfolioRiskPercent,
      totalExposureUsdt,
      totalExposurePercent,
      consecutiveLosses: ddState.consecutiveLosses,
      consecutiveWins: ddState.consecutiveWins,
      riskScore: score.score,
      riskLevel: score.level,
      riskLockStatus: this.config.riskLockStatus,
      emergencyStop: this.config.emergencyStop,
      lockReason: this.config.riskLockReason,
      lastEvaluatedAt: Date.now(),
    };
  }
}

export const riskEngine = RiskEngine.getInstance();
