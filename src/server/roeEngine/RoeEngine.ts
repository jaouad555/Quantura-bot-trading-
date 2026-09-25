import { RoeEngineConfig, RoeMetrics, PositionRoeInput, RoeState } from './types';

export const DEFAULT_ROE_CONFIG: RoeEngineConfig = {
  enabled: true,
  trailingActivationROE: 1.5, // 1.5% Net ROE to arm trailing stop
  profitProtectionROE: 3.0, // 3.0% Net ROE to guarantee profit floor
  aggressiveProtectionROE: 5.0, // 5.0% Net ROE to tighten trailing
  minimumProfitROE: 0.5, // 0.5% Net ROE guaranteed floor once protected
  trailingMode: 'FIXED',
  trailingStopPercent: 1.2, // 1.2% trailing gap
  atrTrailingMultiplier: 1.5, // 1.5x ATR
  minimumTrailingPercent: 0.8,
  maximumTrailingPercent: 2.5,
  feeAwareBreakeven: true,
  fundingAwareROE: true,
  takerFeeRate: 0.0005, // 0.05% per side (Binance Futures taker default)
  makerFeeRate: 0.0002, // 0.02% per side
  estimatedSlippageRate: 0.0002, // 0.02% conservative slippage
  conservativeFundingRate8h: 0.0001, // 0.01% standard 8h funding baseline
};

export class RoeEngine {
  private static instance: RoeEngine | null = null;
  private config: RoeEngineConfig;

  constructor(customConfig?: Partial<RoeEngineConfig>) {
    this.config = { ...DEFAULT_ROE_CONFIG, ...customConfig };
  }

  public static getInstance(customConfig?: Partial<RoeEngineConfig>): RoeEngine {
    if (!RoeEngine.instance) {
      RoeEngine.instance = new RoeEngine(customConfig);
    } else if (customConfig) {
      RoeEngine.instance.updateConfig(customConfig);
    }
    return RoeEngine.instance;
  }

  public updateConfig(newConfig: Partial<RoeEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): RoeEngineConfig {
    return { ...this.config };
  }

  /**
   * Deterministically calculates Gross ROE, Net ROE, State Machine status,
   * Fee-aware Breakeven, and candidate Stop Loss with absolute non-loosening monotonicity.
   */
  public evaluatePosition(input: PositionRoeInput): RoeMetrics {
    // 1. Safe input validation & fallback against NaN/Infinity
    const entryPrice = Number(input.entryPrice);
    const currentPrice = Number(input.currentPrice);
    const marginUsdt = Number(input.marginUsdt);
    const rawLeverage = Number(input.leverage);
    const leverage = !isNaN(rawLeverage) && rawLeverage >= 1 ? rawLeverage : 1;

    const isInputInvalid =
      isNaN(entryPrice) ||
      entryPrice <= 0 ||
      isNaN(currentPrice) ||
      currentPrice <= 0 ||
      isNaN(marginUsdt) ||
      marginUsdt <= 0;

    if (isInputInvalid) {
      const fallbackRoe = 0;
      return {
        grossROE: fallbackRoe,
        netROE: fallbackRoe,
        priceChangePercent: 0,
        grossPnL: 0,
        netPnL: 0,
        estimatedFees: 0,
        fundingCost: 0,
        estimatedSlippage: 0,
        peakROE: input.peakROE || 0,
        roeDrawdown: 0,
        state: input.previousState || 'LOSS',
        stateChanged: false,
        isEstimated: true,
        breakevenPrice: entryPrice > 0 ? entryPrice : currentPrice,
        protectedProfitUsdt: 0,
        trailingStatus: 'INACTIVE',
        shouldUpdateStopLoss: false,
        stopLossUpdateReason: 'Invalid position inputs (safe fallback applied)',
      };
    }

    const isLong = input.decision === 'LONG';
    const positionSizeUsdt = marginUsdt * leverage;

    // 2. Directional Price Movement and Gross ROE
    // LONG:  ((currentPrice - entryPrice) / entryPrice) * 100
    // SHORT: ((entryPrice - currentPrice) / entryPrice) * 100
    const directionalPriceChangePercent = isLong
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100;

    const grossROE = directionalPriceChangePercent * leverage;
    const grossPnL = marginUsdt * (grossROE / 100);

    // 3. Fee, Slippage, and Funding Modeling
    const takerRate = this.config.takerFeeRate ?? 0.0005;
    const slippageRate = this.config.estimatedSlippageRate ?? 0.0002;

    // Entry Fee (Taker on initial leveraged size)
    const entryFee = positionSizeUsdt * takerRate;

    // Estimated Exit Fee (Taker on current estimated leveraged size)
    const currentNotional = positionSizeUsdt * (currentPrice / entryPrice);
    const exitFee = currentNotional * takerRate;
    const estimatedFees = entryFee + exitFee;

    // Estimated Slippage on exit
    const estimatedSlippage = positionSizeUsdt * slippageRate;

    // Estimated / Realized Funding Cost
    let fundingCost = 0;
    if (this.config.fundingAwareROE) {
      const fundingRate = typeof input.fundingRate8h === 'number' && !isNaN(input.fundingRate8h)
        ? input.fundingRate8h
        : (this.config.conservativeFundingRate8h ?? 0.0001);

      const openedAt = input.openedAt || Date.now();
      const hoursHeld = Math.max(0, (Date.now() - openedAt) / (1000 * 60 * 60));
      const fundingIntervals = hoursHeld / 8; // Binance funding interval is 8 hours

      // Longs pay when fundingRate > 0; Shorts pay when fundingRate < 0
      const fundingSign = isLong ? 1 : -1;
      fundingCost = positionSizeUsdt * (fundingRate / 100) * fundingIntervals * fundingSign;
    }

    // Net PnL and Net ROE
    let netPnL = grossPnL - estimatedFees - fundingCost - estimatedSlippage;

    // Clamp maximum loss to margin for isolated positions
    if (netPnL < -marginUsdt) {
      netPnL = -marginUsdt;
    }

    const netROE = (netPnL / marginUsdt) * 100;

    // 4. Peak ROE & ROE Drawdown (Peak ROE is monotonically non-decreasing)
    const previousPeak = typeof input.peakROE === 'number' && !isNaN(input.peakROE)
      ? input.peakROE
      : netROE;
    const peakROE = Math.max(previousPeak, netROE);
    const roeDrawdown = Math.max(0, peakROE - netROE);

    // 5. ROE State Machine Transitions
    let state: RoeState = 'LOSS';
    if (netROE < 0) {
      state = 'LOSS';
    } else if (netROE < this.config.trailingActivationROE) {
      state = 'RECOVERY';
    } else if (netROE < this.config.profitProtectionROE) {
      state = 'PROFIT';
    } else if (netROE < this.config.aggressiveProtectionROE) {
      state = 'PROTECTED';
    } else {
      state = 'LOCK_PROFIT';
    }

    const stateChanged = input.previousState !== undefined && input.previousState !== state;

    // 6. Fee-Aware Breakeven Price Calculation
    // Total round trip buffer: entry fee + exit fee + slippage
    const totalBufferRate = this.config.feeAwareBreakeven
      ? (takerRate * 2) + slippageRate
      : 0.0005;

    // Convert fee buffer to price change required to cover fees at current leverage
    const priceBufferForBreakeven = (totalBufferRate / leverage) * entryPrice;

    const breakevenPrice = isLong
      ? entryPrice + priceBufferForBreakeven
      : entryPrice - priceBufferForBreakeven;

    // 7. Trailing Stop & Profit Protection Candidate Stop Loss
    let trailingDistancePercent = this.config.trailingStopPercent;
    if (this.config.trailingMode === 'ATR_DYNAMIC' && input.atr && input.atr > 0) {
      const atrPercent = (input.atr / currentPrice) * 100;
      trailingDistancePercent = Math.max(
        this.config.minimumTrailingPercent,
        Math.min(this.config.maximumTrailingPercent, atrPercent * this.config.atrTrailingMultiplier)
      );
    }

    const currentPeakPrice = isLong
      ? Math.max(input.peakPrice || entryPrice, currentPrice)
      : Math.min(input.peakPrice || entryPrice, currentPrice);

    let candidateStopLoss: number | undefined = undefined;
    let trailingStatus: 'INACTIVE' | 'ACTIVE' | 'LOCKED_PROFIT' | 'AGGRESSIVE' = 'INACTIVE';
    let stopLossUpdateReason = '';

    if (input.tp1Hit || state === 'PROFIT' || state === 'PROTECTED' || state === 'LOCK_PROFIT') {
      trailingStatus = 'ACTIVE';

      // Base trailing distance from peak favorable price
      let trailSL = isLong
        ? currentPeakPrice * (1 - trailingDistancePercent / 100)
        : currentPeakPrice * (1 + trailingDistancePercent / 100);

      // Rule: Breakeven+ protection is enforced once TP1 is secured, or once deep in PROTECTED/LOCK_PROFIT territory (>= 3.0% Net ROE).
      // In the early PROFIT phase (1.5% - 3.0%), trailing stop tracks favorable movement without choking the position prematurely before TP1.
      if (input.tp1Hit || state === 'PROTECTED' || state === 'LOCK_PROFIT') {
        trailSL = isLong
          ? Math.max(trailSL, breakevenPrice)
          : Math.min(trailSL, breakevenPrice);
      }

      // If in PROTECTED state, guarantee minimum profit floor (e.g. +0.5% Net ROE)
      if (state === 'PROTECTED') {
        trailingStatus = 'LOCKED_PROFIT';
        const minProfitPriceDelta = (this.config.minimumProfitROE / 100 / leverage) * entryPrice;
        const minProfitFloor = isLong ? entryPrice + minProfitPriceDelta : entryPrice - minProfitPriceDelta;
        trailSL = isLong ? Math.max(trailSL, minProfitFloor) : Math.min(trailSL, minProfitFloor);
      }

      // If in LOCK_PROFIT state (e.g. Net ROE >= 5%), apply aggressive tighter trailing gap
      if (state === 'LOCK_PROFIT') {
        trailingStatus = 'AGGRESSIVE';
        const aggressiveDistance = trailingDistancePercent * 0.7; // 30% tighter trailing
        const aggressiveSL = isLong
          ? currentPeakPrice * (1 - aggressiveDistance / 100)
          : currentPeakPrice * (1 + aggressiveDistance / 100);
        
        const lockedProfitPriceDelta = (this.config.profitProtectionROE / 100 / leverage) * entryPrice;
        const lockedProfitFloor = isLong ? entryPrice + lockedProfitPriceDelta : entryPrice - lockedProfitPriceDelta;

        trailSL = isLong
          ? Math.max(aggressiveSL, lockedProfitFloor)
          : Math.min(aggressiveSL, lockedProfitFloor);
      }

      candidateStopLoss = trailSL;
    } else if (input.tp1Hit) {
      // In case state pulled back into recovery, but TP1 was already hit
      candidateStopLoss = breakevenPrice;
      trailingStatus = 'ACTIVE';
    }

    // 8. STRICT MONOTONICITY ENFORCEMENT (Crucial Rule: SL Never Loosens)
    let shouldUpdateStopLoss = false;
    const currentSL = input.currentStopLoss !== undefined && !isNaN(input.currentStopLoss)
      ? Math.round(input.currentStopLoss * 100) / 100
      : undefined;

    if (candidateStopLoss !== undefined && !isNaN(candidateStopLoss) && candidateStopLoss > 0) {
      candidateStopLoss = Math.round(candidateStopLoss * 100) / 100;

      if (currentSL === undefined || currentSL === null || isNaN(currentSL) || currentSL <= 0) {
        shouldUpdateStopLoss = true;
        stopLossUpdateReason = `Initial ROE Protection SL set at $${candidateStopLoss.toFixed(2)}`;
      } else if (isLong) {
        if (candidateStopLoss > currentSL) {
          shouldUpdateStopLoss = true;
          stopLossUpdateReason = `LONG SL ratcheted up from $${currentSL.toFixed(2)} to $${candidateStopLoss.toFixed(2)} (Locked ROE: +${netROE.toFixed(2)}%)`;
        } else {
          shouldUpdateStopLoss = false;
          stopLossUpdateReason = `Trailing update rejected: candidate SL ($${candidateStopLoss.toFixed(2)}) would loosen current SL ($${currentSL.toFixed(2)})`;
        }
      } else {
        // SHORT: Candidate SL must be strictly lower to tighten protection
        if (candidateStopLoss < currentSL) {
          shouldUpdateStopLoss = true;
          stopLossUpdateReason = `SHORT SL ratcheted down from $${currentSL.toFixed(2)} to $${candidateStopLoss.toFixed(2)} (Locked ROE: +${netROE.toFixed(2)}%)`;
        } else {
          shouldUpdateStopLoss = false;
          stopLossUpdateReason = `Trailing update rejected: candidate SL ($${candidateStopLoss.toFixed(2)}) would loosen current SL ($${currentSL.toFixed(2)})`;
        }
      }
    }

    // Protected profit in USDT if stopped out at current or candidate SL
    const effectiveSL = shouldUpdateStopLoss && candidateStopLoss ? candidateStopLoss : currentSL;
    let protectedProfitUsdt = 0;
    if (effectiveSL && effectiveSL > 0) {
      const exitPnlPct = isLong
        ? ((effectiveSL - entryPrice) / entryPrice) * leverage
        : ((entryPrice - effectiveSL) / entryPrice) * leverage;
      protectedProfitUsdt = Math.max(0, marginUsdt * (exitPnlPct / 100) - estimatedFees);
    }

    return {
      grossROE: Math.round(grossROE * 100) / 100,
      netROE: Math.round(netROE * 100) / 100,
      priceChangePercent: Math.round(directionalPriceChangePercent * 1000) / 1000,
      grossPnL: Math.round(grossPnL * 100) / 100,
      netPnL: Math.round(netPnL * 100) / 100,
      estimatedFees: Math.round(estimatedFees * 100) / 100,
      fundingCost: Math.round(fundingCost * 100) / 100,
      estimatedSlippage: Math.round(estimatedSlippage * 100) / 100,
      peakROE: Math.round(peakROE * 100) / 100,
      roeDrawdown: Math.round(roeDrawdown * 100) / 100,
      state,
      previousState: input.previousState,
      stateChanged,
      isEstimated: true,
      breakevenPrice: Math.round(breakevenPrice * 100) / 100,
      protectedProfitUsdt: Math.round(protectedProfitUsdt * 100) / 100,
      trailingStatus,
      candidateStopLoss: candidateStopLoss !== undefined ? Math.round(candidateStopLoss * 100) / 100 : undefined,
      shouldUpdateStopLoss,
      stopLossUpdateReason,
    };
  }

  /**
   * Generates formatted audit logs for the ROE Engine.
   */
  public logEvaluation(symbol: string, side: 'LONG' | 'SHORT', metrics: RoeMetrics, entryPrice: number, currentPrice: number, leverage: number): void {
    if (metrics.stateChanged) {
      console.log(`[ROE STATE] ${symbol} | ${metrics.previousState || 'INIT'} ➔ ${metrics.state} | Net ROE: ${metrics.netROE >= 0 ? '+' : ''}${metrics.netROE.toFixed(2)}% | Peak: +${metrics.peakROE.toFixed(2)}%`);
    }

    if (metrics.shouldUpdateStopLoss && metrics.candidateStopLoss) {
      console.log(`[ROE ENGINE] ${symbol} (${side}) | Stop Loss Ratcheted: $${metrics.candidateStopLoss.toFixed(2)} | Reason: ${metrics.stopLossUpdateReason}`);
    }
  }
}
