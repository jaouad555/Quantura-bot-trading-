import {
  ActivePositionSnapshot,
  RejectionCode,
  RiskDecision,
  RiskEngineConfig,
  RiskEngineMetrics,
  RiskEvaluationResult,
  RiskLockStatus,
  TradeProposal,
  RiskScopeKey,
  buildRiskScopeKey,
} from './types';
import { DEFAULT_RISK_CONFIG } from './constants';
import { PositionSizer } from './PositionSizer';
import { DrawdownTracker, DrawdownState } from './DrawdownTracker';
import { PortfolioRiskEvaluator } from './PortfolioRiskEvaluator';
import { MarketProtection } from './MarketProtection';
import { RiskScoreCalculator } from './RiskScoreCalculator';
import { AuditTrail } from './AuditTrail';
import { kv } from '../db';

const ALL_RISK_SCOPES: Array<{
  executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE';
  marketType: 'SPOT' | 'FUTURES';
}> = [
  { executionMode: 'PAPER', marketType: 'SPOT' },
  { executionMode: 'PAPER', marketType: 'FUTURES' },
  { executionMode: 'BINANCE_TESTNET', marketType: 'SPOT' },
  { executionMode: 'BINANCE_TESTNET', marketType: 'FUTURES' },
  { executionMode: 'BINANCE_LIVE', marketType: 'SPOT' },
  { executionMode: 'BINANCE_LIVE', marketType: 'FUTURES' },
];

export class RiskEngine {
  private static instance: RiskEngine;
  private configs: Map<RiskScopeKey, RiskEngineConfig> = new Map();
  private drawdownTrackers: Map<RiskScopeKey, DrawdownTracker> = new Map();
  private recentOrderIds: Map<string, number> = new Map();
  private isInitialized = false;

  private constructor() {
    for (const s of ALL_RISK_SCOPES) {
      const scopeKey = buildRiskScopeKey(s.executionMode, s.marketType);
      this.configs.set(scopeKey, {
        ...DEFAULT_RISK_CONFIG,
        executionMode: s.executionMode,
        marketType: s.marketType,
        scopeKey,
        maxAllowedLeverage: s.marketType === 'SPOT' ? 1 : DEFAULT_RISK_CONFIG.maxAllowedLeverage,
        maxTotalExposurePercent: s.marketType === 'SPOT' ? 100.0 : DEFAULT_RISK_CONFIG.maxTotalExposurePercent,
      });
      this.drawdownTrackers.set(scopeKey, new DrawdownTracker(1000));
    }
  }

  public static getInstance(): RiskEngine {
    if (!RiskEngine.instance) {
      RiskEngine.instance = new RiskEngine();
      RiskEngine.instance.init();
    }
    return RiskEngine.instance;
  }

  public resolveScopeKey(executionMode?: string, marketType?: string): RiskScopeKey {
    return buildRiskScopeKey(executionMode, marketType);
  }

  private getScopeConfigInternal(scopeKey: RiskScopeKey): RiskEngineConfig {
    let cfg = this.configs.get(scopeKey);
    if (!cfg) {
      const isSpot = scopeKey.endsWith('_SPOT');
      const mode = scopeKey.startsWith('BINANCE_LIVE')
        ? 'BINANCE_LIVE'
        : scopeKey.startsWith('BINANCE_TESTNET')
        ? 'BINANCE_TESTNET'
        : 'PAPER';
      cfg = {
        ...DEFAULT_RISK_CONFIG,
        executionMode: mode,
        marketType: isSpot ? 'SPOT' : 'FUTURES',
        scopeKey,
        maxAllowedLeverage: isSpot ? 1 : DEFAULT_RISK_CONFIG.maxAllowedLeverage,
      };
      this.configs.set(scopeKey, cfg);
    }
    return cfg;
  }

  private getScopeTrackerInternal(scopeKey: RiskScopeKey): DrawdownTracker {
    let tracker = this.drawdownTrackers.get(scopeKey);
    if (!tracker) {
      tracker = new DrawdownTracker(1000);
      this.drawdownTrackers.set(scopeKey, tracker);
    }
    return tracker;
  }

  public async init() {
    if (this.isInitialized) return;
    AuditTrail.init();

    // Load persisted configs and drawdown trackers per isolated scope from KV store
    try {
      const legacyConfigStr = await kv.get('quantura_risk_config');
      const legacyConfig = legacyConfigStr ? JSON.parse(legacyConfigStr) : null;

      for (const s of ALL_RISK_SCOPES) {
        const scopeKey = buildRiskScopeKey(s.executionMode, s.marketType);
        const scopedConfigStr = await kv.get(`quantura_risk_config_${scopeKey}`);
        if (scopedConfigStr) {
          const saved = JSON.parse(scopedConfigStr);
          this.configs.set(scopeKey, {
            ...DEFAULT_RISK_CONFIG,
            ...saved,
            executionMode: s.executionMode,
            marketType: s.marketType,
            scopeKey,
          });
        } else if (legacyConfig) {
          // Migrate base thresholds without carrying over global locks across markets
          this.configs.set(scopeKey, {
            ...DEFAULT_RISK_CONFIG,
            ...legacyConfig,
            emergencyStop: false,
            riskLockStatus: 'NORMAL',
            riskLockReason: undefined,
            executionMode: s.executionMode,
            marketType: s.marketType,
            scopeKey,
            maxAllowedLeverage: s.marketType === 'SPOT' ? 1 : (legacyConfig.maxAllowedLeverage || DEFAULT_RISK_CONFIG.maxAllowedLeverage),
          });
        }

        const scopedTrackerStr = await kv.get(`quantura_risk_drawdown_state_${scopeKey}`);
        if (scopedTrackerStr) {
          const savedTracker = JSON.parse(scopedTrackerStr);
          this.getScopeTrackerInternal(scopeKey).setState(savedTracker);
        }
      }
    } catch (err) {
      console.error('[RISK ENGINE] Error loading persisted risk state:', err);
    }
    this.isInitialized = true;
  }

  public getConfig(executionMode?: string, marketType?: string): RiskEngineConfig {
    const scopeKey = this.resolveScopeKey(executionMode, marketType);
    return { ...this.getScopeConfigInternal(scopeKey) };
  }

  public async updateConfig(
    partial: Partial<RiskEngineConfig>,
    executionMode?: string,
    marketType?: string
  ): Promise<RiskEngineConfig> {
    const effMode = executionMode || partial.executionMode || 'PAPER';
    const effMarket = marketType || partial.marketType || 'FUTURES';
    const scopeKey = this.resolveScopeKey(effMode, effMarket);
    const currentConfig = this.getScopeConfigInternal(scopeKey);

    // Hard constraints on user configurable bounds
    if (partial.riskPerTradePercent !== undefined) {
      partial.riskPerTradePercent = Math.min(2.0, Math.max(0.1, Number(partial.riskPerTradePercent)));
    }
    if (partial.maxDailyLossPercent !== undefined) {
      partial.maxDailyLossPercent = Math.min(10.0, Math.max(1.0, Number(partial.maxDailyLossPercent)));
    }
    if (partial.maxAccountDrawdownPercent !== undefined) {
      partial.maxAccountDrawdownPercent = Math.min(25.0, Math.max(2.0, Number(partial.maxAccountDrawdownPercent)));
    }
    if (partial.maxAllowedLeverage !== undefined) {
      partial.maxAllowedLeverage =
        String(effMarket).toUpperCase() === 'SPOT'
          ? 1
          : Math.min(20, Math.max(1, Math.floor(Number(partial.maxAllowedLeverage))));
    }

    const updated: RiskEngineConfig = {
      ...currentConfig,
      ...partial,
      executionMode: effMode as any,
      marketType: String(effMarket).toUpperCase() === 'FUTURES' ? 'FUTURES' : 'SPOT',
      scopeKey,
    };

    this.configs.set(scopeKey, updated);
    await kv.set(`quantura_risk_config_${scopeKey}`, JSON.stringify(updated));
    return { ...updated };
  }

  public async setEmergencyStop(
    enabled: boolean,
    reason?: string,
    executionMode?: string,
    marketType?: string
  ): Promise<RiskEngineConfig> {
    const scopeKey = this.resolveScopeKey(executionMode, marketType);
    const cfg = this.getScopeConfigInternal(scopeKey);
    cfg.emergencyStop = enabled;
    if (enabled) {
      cfg.riskLockStatus = 'EMERGENCY';
      cfg.riskLockReason = reason || `EMERGENCY KILL SWITCH ACTIVATED (${scopeKey})`;
      cfg.riskLockTimestamp = Date.now();
    } else if (cfg.riskLockStatus === 'EMERGENCY') {
      cfg.riskLockStatus = 'NORMAL';
      cfg.riskLockReason = undefined;
    }
    this.configs.set(scopeKey, cfg);
    await kv.set(`quantura_risk_config_${scopeKey}`, JSON.stringify(cfg));
    return { ...cfg };
  }

  public async unlockRiskLock(
    adminConfirmation: boolean = true,
    customEquity?: number,
    executionMode?: string,
    marketType?: string
  ): Promise<RiskEngineConfig> {
    const scopeKey = this.resolveScopeKey(executionMode, marketType);
    const cfg = this.getScopeConfigInternal(scopeKey);
    const tracker = this.getScopeTrackerInternal(scopeKey);

    if (adminConfirmation) {
      cfg.riskLockStatus = 'NORMAL';
      cfg.riskLockReason = undefined;
      cfg.riskLockTimestamp = undefined;
      cfg.emergencyStop = false;
      this.configs.set(scopeKey, cfg);
      await kv.set(`quantura_risk_config_${scopeKey}`, JSON.stringify(cfg));

      // Resolve current equity baseline for this specific market scope so drawdown resets strictly to 0.00%
      let baselineEquity = customEquity;
      if (!baselineEquity || baselineEquity <= 0) {
        try {
          const isSpot = scopeKey.endsWith('_SPOT');
          const walletKey = isSpot ? 'btc_paper_wallet_spot' : 'btc_paper_wallet_futures';
          const walletStr = (await kv.get(walletKey)) || (await kv.get('btc_paper_wallet'));
          if (walletStr) {
            const parsed = JSON.parse(walletStr);
            const eq = parsed.totalEquity || parsed.balance;
            if (typeof eq === 'number' && eq > 0) {
              baselineEquity = eq;
            }
          }
        } catch {}
      }
      if (!baselineEquity || baselineEquity <= 0) {
        baselineEquity = 1000;
      }

      // Reset drawdown state ONLY for this isolated scope to clean zero baseline
      tracker.setState({
        startingDailyEquity: baselineEquity,
        lastDailyResetTimestamp: Date.now(),
        peakEquity: baselineEquity,
        dailyRealizedPnl: 0,
        dailyFeesPaid: 0,
        dailyFundingPaid: 0,
        consecutiveLosses: 0,
        consecutiveWins: 0,
        lastClosedTradePnl: 0,
        lastClosedTradeSizeUsdt: 0,
        lastClosedTradeLeverage: 1,
      });
      await kv.set(`quantura_risk_drawdown_state_${scopeKey}`, JSON.stringify(tracker.getState()));

      // Also reset market-scoped circuit breaker in btc_bot_config if present
      try {
        const botConfigStr = await kv.get('btc_bot_config');
        if (botConfigStr) {
          const parsed = JSON.parse(botConfigStr);
          parsed.circuitBreakerTripped = false;
          parsed.circuitBreakerTrippedAt = undefined;
          if (parsed.circuitBreakerByScope && typeof parsed.circuitBreakerByScope === 'object') {
            delete parsed.circuitBreakerByScope[scopeKey];
          }
          await kv.set('btc_bot_config', JSON.stringify(parsed));
        }
      } catch (e) {}
    }
    return { ...cfg };
  }

  public async resetAllToZero(
    customEquity?: number,
    executionMode?: string,
    marketType?: string
  ): Promise<{ config: RiskEngineConfig; drawdownState: DrawdownState; scopeKey: RiskScopeKey }> {
    const scopeKey = this.resolveScopeKey(executionMode, marketType);
    const config = await this.unlockRiskLock(true, customEquity, executionMode, marketType);
    const tracker = this.getScopeTrackerInternal(scopeKey);
    return {
      config,
      drawdownState: tracker.getState(),
      scopeKey,
    };
  }

  public async resetEveryScopeToZero(defaultEquity: number = 1000): Promise<void> {
    for (const s of ALL_RISK_SCOPES) {
      await this.unlockRiskLock(true, defaultEquity, s.executionMode, s.marketType);
    }
  }

  public recordTradeClosed(
    pnlUsdt: number,
    feeUsdt: number = 0,
    metadata?: {
      symbol?: string;
      strategyName?: string;
      durationMs?: number;
      sizeUsdt?: number;
      leverage?: number;
      executionMode?: string;
      marketType?: string;
    }
  ) {
    const scopeKey = this.resolveScopeKey(metadata?.executionMode, metadata?.marketType);
    const tracker = this.getScopeTrackerInternal(scopeKey);
    tracker.recordTradeClosed(pnlUsdt, feeUsdt, metadata?.sizeUsdt || 0, metadata?.leverage || 1);
    const updatedState = tracker.getState();
    // Persist isolated tracker state
    kv.set(`quantura_risk_drawdown_state_${scopeKey}`, JSON.stringify(updatedState)).catch(err => {
      console.error(`[RISK ENGINE] Error persisting drawdown tracker state for ${scopeKey}:`, err);
    });
    return updatedState;
  }

  /**
   * Evaluate a proposed trade before execution.
   * Institutional Gatekeeper: AI / Strategy -> Trade Proposal -> RiskEngine (Isolated Scope) -> Approved/Rejected.
   */
  public async evaluateProposal(
    proposal: TradeProposal,
    activePositionsSnapshot?: ActivePositionSnapshot[]
  ): Promise<RiskEvaluationResult> {
    const evaluatedAt = Date.now();
    const auditId = `risk-audit-${evaluatedAt}-${Math.random().toString(36).substring(2, 7)}`;
    const symbol = (proposal.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const side = proposal.side || 'LONG';
    const marketType: 'SPOT' | 'FUTURES' =
      String(proposal.marketType || 'FUTURES').toUpperCase() === 'SPOT' ? 'SPOT' : 'FUTURES';
    const executionMode: 'PAPER' | 'BINANCE_TESTNET' | 'BINANCE_LIVE' =
      proposal.executionMode === 'BINANCE_LIVE'
        ? 'BINANCE_LIVE'
        : proposal.executionMode === 'BINANCE_TESTNET'
        ? 'BINANCE_TESTNET'
        : proposal.isPaper === false
        ? 'BINANCE_LIVE'
        : 'PAPER';
    const scopeKey = this.resolveScopeKey(executionMode, marketType);
    const scopeConfig = this.getScopeConfigInternal(scopeKey);
    const scopeTracker = this.getScopeTrackerInternal(scopeKey);

    const entryPrice = proposal.entryPrice;
    const stopLoss = proposal.stopLoss;

    // Retrieve active positions and strictly isolate to ONLY positions in the exact same executionMode and marketType!
    let allPositions = activePositionsSnapshot;
    if (!allPositions) {
      allPositions = await this.getActivePositionsFromKv();
    }
    const activePositions = (allPositions || []).filter(p => {
      const pMode = (p as any).mode || 'PAPER';
      const pMarket = String(p.marketType || (p.leverage && p.leverage > 1 ? 'FUTURES' : 'SPOT')).toUpperCase();
      return pMode === executionMode && pMarket === marketType;
    });

    // Resolve Account Equity & Available Balance strictly for this isolated scope
    const accountEquity = await this.resolveEquity(
      { ...proposal, executionMode, marketType },
      activePositions
    );
    const availableBalance =
      proposal.availableBalance !== undefined && proposal.availableBalance >= 0
        ? proposal.availableBalance
        : accountEquity;

    // Helper to generate rejection response and persist in isolated audit trail
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
        executionMode,
        scopeKey,
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
        riskLockStatus: scopeConfig.riskLockStatus,
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
        executionMode,
        scopeKey,
        decision: 'REJECTED',
        reasonCode,
        message,
        riskScore,
        equity: accountEquity,
        riskPercent: scopeConfig.riskPerTradePercent,
        riskAmountUsdt: 0,
        entryPrice: entryPrice || 0,
        stopLoss: stopLoss || 0,
        quantity: 0,
        leverage: marketType === 'SPOT' ? 1 : (proposal.leverage || 1),
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
    if (executionMode !== 'PAPER' && (accountEquity <= 0 || availableBalance <= 0)) {
      return reject(
        'INSUFFICIENT_EQUITY',
        `${executionMode} (${marketType}) Trading rejected: Account balance/equity is unavailable or zero. Safety protocol engaged.`
      );
    }
    if (accountEquity <= 0 || isNaN(accountEquity)) {
      return reject('INSUFFICIENT_EQUITY', `Account equity for ${scopeKey} could not be determined. Fail-safe triggered.`);
    }

    // -------------------------------------------------------------
    // 2. IDEMPOTENCY & DUPLICATE ORDER PROTECTION
    // -------------------------------------------------------------
    if (proposal.clientOrderId) {
      const scopedOrderId = `${scopeKey}_${proposal.clientOrderId}`;
      const lastSeen = this.recentOrderIds.get(scopedOrderId);
      if (lastSeen && Date.now() - lastSeen < 60000) {
        return reject('DUPLICATE_ORDER', `Duplicate order detected with ID ${proposal.clientOrderId} in ${scopeKey}. Execution prevented.`);
      }
      this.recentOrderIds.set(scopedOrderId, Date.now());
      if (this.recentOrderIds.size > 500) {
        const threshold = Date.now() - 120000;
        for (const [id, time] of this.recentOrderIds.entries()) {
          if (time < threshold) this.recentOrderIds.delete(id);
        }
      }
    }

    // -------------------------------------------------------------
    // 3. ISOLATED EMERGENCY STOP & RISK LOCK SYSTEM (Scoped to Market & Mode)
    // -------------------------------------------------------------
    if (scopeConfig.emergencyStop) {
      return reject(
        'EMERGENCY_STOP_ACTIVE',
        `Emergency Stop is active for ${marketType} (${executionMode}). New trade executions in this market are blocked.`,
        100,
        'EXTREME'
      );
    }
    if (scopeConfig.riskLockStatus === 'LOCKED' || scopeConfig.riskLockStatus === 'EMERGENCY') {
      return reject(
        'RISK_LOCK_ACTIVE',
        `Risk Lock is ACTIVE for ${marketType} (${executionMode}): ${scopeConfig.riskLockReason || 'Market Lock'}. Manual reset required.`,
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

    const tp1 = proposal.takeProfit?.tp1 || (side === 'LONG' ? entryPrice + slDistance * 2 : entryPrice - slDistance * 2);
    if (side === 'LONG' && tp1 <= entryPrice) {
      return reject('INVALID_TAKE_PROFIT', `LONG Take Profit ($${tp1}) must be above Entry ($${entryPrice}).`);
    }
    if (side === 'SHORT' && tp1 >= entryPrice) {
      return reject('INVALID_TAKE_PROFIT', `SHORT Take Profit ($${tp1}) must be below Entry ($${entryPrice}).`);
    }

    const rewardDistance = Math.abs(tp1 - entryPrice);
    const riskRewardRatio = slDistance > 0 ? rewardDistance / slDistance : 0;
    if (riskRewardRatio < scopeConfig.minRiskRewardRatio - 0.05) {
      return reject(
        'LOW_RISK_REWARD',
        `Risk/Reward ratio (${riskRewardRatio.toFixed(2)}) is below required minimum of 1:${scopeConfig.minRiskRewardRatio} for ${marketType}.`
      );
    }

    // -------------------------------------------------------------
    // 5. ISOLATED DRAWDOWN & DAILY LOSS LIMIT CHECKS (Scoped to Market & Mode)
    // -------------------------------------------------------------
    const totalUnrealizedPnl = activePositions.reduce((sum, p) => sum + (p.unrealizedPnlUsdt || 0), 0);
    const drawdownEvaluation = scopeTracker.evaluateLimits(accountEquity, totalUnrealizedPnl, scopeConfig);
    if (drawdownEvaluation.isBreached) {
      scopeConfig.riskLockStatus = drawdownEvaluation.lockStatus;
      scopeConfig.riskLockReason = `[${marketType} - ${executionMode}] ${drawdownEvaluation.message}`;
      scopeConfig.riskLockTimestamp = Date.now();
      this.configs.set(scopeKey, scopeConfig);
      await kv.set(`quantura_risk_config_${scopeKey}`, JSON.stringify(scopeConfig));
      return reject(drawdownEvaluation.reasonCode!, scopeConfig.riskLockReason!, 95, 'EXTREME');
    }

    // Anti-Martingale / Anti-Revenge within this isolated market scope
    const proposedLev = marketType === 'SPOT' ? 1 : (proposal.leverage || 1);
    const antiMartingale = scopeTracker.checkAntiMartingale(
      scopeConfig.riskPerTradePercent,
      proposedLev,
      scopeConfig.riskPerTradePercent
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
    const rawEstimatedNotional =
      proposal.quantity && proposal.quantity > 0
        ? proposal.quantity * entryPrice
        : marketType === 'SPOT'
        ? Math.min(accountEquity * 0.25, availableBalance)
        : Math.min(accountEquity * 0.25 * proposedLev, availableBalance * proposedLev);
    const estimatedNotional = Math.max(10, rawEstimatedNotional);
    const marketEval = MarketProtection.evaluateMarket(marketInput, estimatedNotional, scopeConfig);
    if (!marketEval.isValid) {
      return reject(marketEval.reasonCode!, marketEval.message!, 80, 'HIGH', {
        volatilityRegime: marketEval.volatilityRegime,
        marketRegime: marketEval.marketRegime,
      });
    }

    // -------------------------------------------------------------
    // 7. POSITION SIZING & LEVERAGE VALIDATION
    // -------------------------------------------------------------
    const drawdownState = scopeTracker.getState();
    const sizing = PositionSizer.calculateSizing(
      { ...proposal, marketType, executionMode, leverage: proposedLev },
      accountEquity,
      availableBalance,
      scopeConfig.riskPerTradePercent,
      marketType === 'SPOT' ? 1 : scopeConfig.maxAllowedLeverage,
      marketEval.volatilityRegime,
      drawdownState.consecutiveLosses,
      scopeConfig.maxSymbolExposurePercent
    );

    if (!sizing.isValid) {
      return reject('ORDER_SIZE_TOO_SMALL', sizing.validationError || 'Position sizing calculation failed.', 70, 'HIGH');
    }

    if (sizing.netRiskReward < 1.3) {
      return reject(
        'LOW_RISK_REWARD',
        `Net Risk/Reward after fees and estimated slippage (${sizing.netRiskReward.toFixed(2)}) is insufficient. Minimum net R:R is 1.3.`
      );
    }

    // -------------------------------------------------------------
    // 8. PORTFOLIO RISK, EXPOSURE & CORRELATION EVALUATION (Strictly Scoped)
    // -------------------------------------------------------------
    const portfolioEval = PortfolioRiskEvaluator.evaluatePortfolio(
      { ...proposal, marketType, executionMode, leverage: proposedLev },
      sizing.riskAmountUsdt,
      sizing.notionalValueUsdt,
      activePositions,
      accountEquity,
      scopeConfig
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
      maxDailyLossPercent: scopeConfig.maxDailyLossPercent,
      drawdownPercent: drawdownEvaluation.accountDrawdownPercent,
      maxDrawdownPercent: scopeConfig.maxAccountDrawdownPercent,
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
      message: `Trade proposal passed all quantitative risk, balance, exposure, and correlation validations for ${marketType} (${executionMode}).`,
      riskScore: scoreBreakdown.score,
      riskLevel: scoreBreakdown.level,
      symbol,
      side,
      marketType,
      executionMode,
      scopeKey,
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
      riskLockStatus: scopeConfig.riskLockStatus,
      auditId,
      evaluatedAt,
    };

    AuditTrail.record({
      id: auditId,
      timestamp: evaluatedAt,
      symbol,
      side,
      marketType,
      executionMode,
      scopeKey,
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
   * Helper to retrieve active positions from KV, preserving mode and marketType
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
        side: p.decision || p.side || 'LONG',
        entryPrice: p.entryPrice || 0,
        currentPrice: p.currentPrice || p.entryPrice || 0,
        stopLoss: p.stopLoss || 0,
        quantity: p.remainingAmountBtc || p.initialAmountBtc || p.quantity || 0,
        marginUsdt: p.remainingAmountUsdt || p.marginUsdt || p.initialAmountUsdt || 0,
        positionSizeUsdt: (p.remainingAmountUsdt || p.marginUsdt || 0) * (p.leverage || 1),
        leverage: p.marketType === 'SPOT' ? 1 : (p.leverage || 1),
        marketType: p.marketType || (p.leverage && p.leverage > 1 ? 'FUTURES' : 'SPOT'),
        mode: p.mode || 'PAPER',
        unrealizedPnlUsdt: p.unrealizedPnlUsdt ?? p.realizedPnlUsdt ?? 0,
        unrealizedRoePercent: p.roePercent ?? 0,
        strategyName: p.strategyName,
        openedAt: p.openedAt || Date.now(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Resolve current equity safely for the specific marketType and executionMode
   */
  private async resolveEquity(proposal: TradeProposal, scopedPositions: ActivePositionSnapshot[]): Promise<number> {
    if (proposal.accountEquity && proposal.accountEquity > 0) {
      return proposal.accountEquity;
    }

    // CRITICAL INVARIANT: In LIVE/TESTNET mode (isPaper === false), NEVER use virtual paper wallet or default constants!
    if (proposal.isPaper === false || (proposal.executionMode && proposal.executionMode !== 'PAPER')) {
      return 0; // Return 0 to trigger structured rejection in evaluateProposal
    }

    // PAPER mode: read dedicated market wallet (btc_paper_wallet_spot vs btc_paper_wallet_futures)
    try {
      const isSpot = String(proposal.marketType || '').toUpperCase() === 'SPOT';
      const walletKey = isSpot ? 'btc_paper_wallet_spot' : 'btc_paper_wallet_futures';
      const walletStr = (await kv.get(walletKey)) || (await kv.get('btc_paper_wallet'));
      if (walletStr) {
        const wallet = JSON.parse(walletStr);
        if (typeof wallet.totalEquity === 'number' && wallet.totalEquity > 0) {
          return wallet.totalEquity;
        }
        const freeBalance = typeof wallet.balance === 'number' ? wallet.balance : 1000;
        const totalInvestedMargin = scopedPositions.reduce((sum, p) => sum + (p.marginUsdt || 0), 0);
        return Math.max(0, freeBalance + totalInvestedMargin);
      }
    } catch {}

    return 1000; // safe default fallback only for PAPER mode
  }

  /**
   * Get current complete telemetry metrics strictly isolated by executionMode and marketType
   */
  public async getMetrics(
    customEquity?: number,
    customPositions?: any[],
    executionMode: string = 'PAPER',
    marketType: string = 'FUTURES'
  ): Promise<RiskEngineMetrics> {
    const normMode =
      executionMode === 'BINANCE_LIVE'
        ? 'BINANCE_LIVE'
        : executionMode === 'BINANCE_TESTNET'
        ? 'BINANCE_TESTNET'
        : 'PAPER';
    const normMarket: 'SPOT' | 'FUTURES' =
      String(marketType || 'FUTURES').toUpperCase() === 'SPOT' ? 'SPOT' : 'FUTURES';
    const scopeKey = this.resolveScopeKey(normMode, normMarket);
    const scopeConfig = this.getScopeConfigInternal(scopeKey);
    const scopeTracker = this.getScopeTrackerInternal(scopeKey);

    const allPositions = customPositions || (await this.getActivePositionsFromKv());
    // Strictly filter positions by executionMode AND marketType
    const positions = (allPositions || []).filter((p: any) => {
      const pMode = p.mode || 'PAPER';
      const pMarket = String(p.marketType || (p.leverage && p.leverage > 1 ? 'FUTURES' : 'SPOT')).toUpperCase();
      return pMode === normMode && pMarket === normMarket;
    });

    let equity = customEquity;
    if (equity === undefined || equity <= 0) {
      const walletKey = normMarket === 'SPOT' ? 'btc_paper_wallet_spot' : 'btc_paper_wallet_futures';
      const walletStr = (await kv.get(walletKey)) || (await kv.get('btc_paper_wallet'));
      const wallet = walletStr ? JSON.parse(walletStr) : { balance: 1000, realizedPnl: 0 };
      equity =
        wallet.totalEquity ||
        wallet.balance + positions.reduce((sum: number, p: any) => sum + (p.marginUsdt || p.remainingAmountUsdt || 0), 0);
    }
    const unrealized = positions.reduce((sum: number, p: any) => sum + (p.unrealizedPnlUsdt || 0), 0);

    const dailyMetrics = scopeTracker.calculateDailyMetrics(equity, unrealized);
    const ddState = scopeTracker.getState();

    let openPositionRisksUsdt = 0;
    let totalExposureUsdt = 0;
    for (const pos of positions) {
      const qty = Number(pos.quantity || pos.remainingAmountBtc || pos.initialAmountBtc || 0);
      const currP = Number(pos.currentPrice || pos.entryPrice || 0);
      const sl = Number(pos.stopLoss || 0);
      const dist = sl > 0 ? Math.abs(currP - sl) : currP * 0.02;
      openPositionRisksUsdt += qty * dist;
      const lev = normMarket === 'SPOT' ? 1 : Number(pos.leverage || 1);
      const posSize = Number(pos.positionSizeUsdt || (pos.marginUsdt || pos.remainingAmountUsdt || 0) * lev);
      totalExposureUsdt += posSize;
    }

    const portfolioRiskPercent = equity > 0 ? (openPositionRisksUsdt / equity) * 100 : 0;
    const totalExposurePercent = equity > 0 ? (totalExposureUsdt / equity) * 100 : 0;

    const score = RiskScoreCalculator.calculate({
      volatilityRegime: 'NORMAL',
      atrPercent: 1.5,
      dailyLossPercent: dailyMetrics.dailyLossPercent,
      maxDailyLossPercent: scopeConfig.maxDailyLossPercent,
      drawdownPercent: dailyMetrics.accountDrawdownPercent,
      maxDrawdownPercent: scopeConfig.maxAccountDrawdownPercent,
      totalExposurePercent,
      correlationExposurePercent: totalExposurePercent * 0.4,
      leverage: normMarket === 'SPOT' ? 1 : 3,
      consecutiveLosses: ddState.consecutiveLosses,
      spreadPercent: 0.05,
      slippagePercent: 0.05,
      riskReward: 2.0,
    });

    return {
      executionMode: normMode,
      marketType: normMarket,
      scopeKey,
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
      riskLockStatus: scopeConfig.riskLockStatus,
      emergencyStop: scopeConfig.emergencyStop,
      lockReason: scopeConfig.riskLockReason,
      lastEvaluatedAt: Date.now(),
    };
  }
}

export const riskEngine = RiskEngine.getInstance();

