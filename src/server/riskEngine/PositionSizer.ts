import { SymbolTradingRules, TradeProposal, VolatilityRegime } from './types';
import { SYMBOL_RULES, DEFAULT_SYMBOL_RULE } from './constants';

export interface PositionSizingCalculation {
  recommendedQuantity: number;
  maxSafeQuantity: number;
  riskAmountUsdt: number;
  actualRiskPercent: number;
  notionalValueUsdt: number;
  marginRequiredUsdt: number;
  effectiveLeverage: number;
  liquidationPrice?: number;
  distanceToLiquidationPercent?: number;
  estimatedEntryFeeUsdt: number;
  estimatedExitFeeUsdt: number;
  totalEstimatedFeesUsdt: number;
  estimatedSlippagePercent: number;
  estimatedLossAtStopLossUsdt: number;
  grossRiskReward: number;
  netRiskReward: number;
  isValid: boolean;
  validationError?: string;
}

export class PositionSizer {
  /**
   * Round down quantity to stepSize precision so rounding NEVER increases risk
   */
  public static roundDownToStep(qty: number, stepSize: number): number {
    if (stepSize <= 0) return qty;
    const precision = Math.max(0, -Math.floor(Math.log10(stepSize)));
    const factor = Math.pow(10, precision);
    const stepped = Math.floor(Math.floor(qty * factor) / (stepSize * factor)) * (stepSize * factor) / factor;
    return Number(stepped.toFixed(precision));
  }

  /**
   * Round price to tickSize precision
   */
  public static roundToTick(price: number, tickSize: number): number {
    if (tickSize <= 0) return price;
    const precision = Math.max(0, -Math.floor(Math.log10(tickSize)));
    return Number((Math.round(price / tickSize) * tickSize).toFixed(precision));
  }

  /**
   * Calculate Institutional-Grade Position Sizing
   */
  public static calculateSizing(
    proposal: TradeProposal,
    accountEquity: number,
    availableBalance: number,
    configuredRiskPercent: number,
    maxAllowedLeverage: number,
    volatilityRegime: VolatilityRegime = 'NORMAL',
    consecutiveLossStreak: number = 0,
    maxSymbolExposurePercent: number = 100.0
  ): PositionSizingCalculation {
    const symbol = (proposal.symbol || 'BTCUSDT').toUpperCase();
    const rules: SymbolTradingRules = SYMBOL_RULES[symbol] || DEFAULT_SYMBOL_RULE;
    const isFutures = proposal.marketType === 'FUTURES';
    const isLong = proposal.side === 'LONG';
    const entryPrice = proposal.entryPrice;
    const stopLoss = proposal.stopLoss;

    // Fail-safe validation
    if (!accountEquity || accountEquity <= 0 || isNaN(accountEquity)) {
      return this.createInvalidResult('Invalid or missing account equity.');
    }
    if (!entryPrice || entryPrice <= 0 || isNaN(entryPrice)) {
      return this.createInvalidResult('Invalid entry price.');
    }
    if (!stopLoss || stopLoss <= 0 || isNaN(stopLoss)) {
      return this.createInvalidResult('Invalid or missing Stop Loss.');
    }

    // SL direction validation
    if (isLong && stopLoss >= entryPrice) {
      return this.createInvalidResult(`Stop Loss ($${stopLoss}) must be below Entry ($${entryPrice}) for LONG.`);
    }
    if (!isLong && stopLoss <= entryPrice) {
      return this.createInvalidResult(`Stop Loss ($${stopLoss}) must be above Entry ($${entryPrice}) for SHORT.`);
    }

    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    const riskDistancePercent = (riskPerUnit / entryPrice) * 100;

    if (riskDistancePercent < 0.1) {
      return this.createInvalidResult(`Stop Loss is too close (${riskDistancePercent.toFixed(2)}%). Minimum SL distance is 0.10%.`);
    }
    if (riskDistancePercent > 25.0) {
      return this.createInvalidResult(`Stop Loss distance is excessive (${riskDistancePercent.toFixed(2)}%). Maximum SL distance is 25.0%.`);
    }

    // 1. Determine effective risk percentage adjusted for volatility & streak
    let effectiveRiskPercent = Math.min(2.0, Math.max(0.1, configuredRiskPercent));
    
    // High Volatility -> reduce risk by 50%
    if (volatilityRegime === 'HIGH') {
      effectiveRiskPercent = effectiveRiskPercent * 0.5;
    } else if (volatilityRegime === 'EXTREME') {
      return this.createInvalidResult('Extreme volatility regime detected. Sizing aborted for capital protection.');
    }

    // 3+ consecutive losses -> reduce risk by 50%
    if (consecutiveLossStreak >= 3) {
      effectiveRiskPercent = effectiveRiskPercent * 0.5;
    }

    // 2. Exact Risk Amount in USDT
    const targetRiskAmountUsdt = accountEquity * (effectiveRiskPercent / 100);

    // 3. Raw Quantity calculation: Position Size = Risk Amount / Risk Per Unit
    const rawQuantityByRisk = targetRiskAmountUsdt / riskPerUnit;
    const maxSymbolNotional = accountEquity * (maxSymbolExposurePercent / 100);
    const maxQtyByExposure = maxSymbolNotional / entryPrice;
    const rawQuantity = Math.min(rawQuantityByRisk, maxQtyByExposure);

    // 4. Precision adjustment: Round DOWN to stepSize so rounding NEVER increases risk
    let recommendedQuantity = this.roundDownToStep(rawQuantity, rules.stepSize);

    // Verify rounding never increases risk amount beyond targetRiskAmountUsdt
    const actualRiskAmountUsdt = recommendedQuantity * riskPerUnit;
    if (actualRiskAmountUsdt > targetRiskAmountUsdt * 1.0001) {
      recommendedQuantity = this.roundDownToStep(recommendedQuantity - rules.stepSize, rules.stepSize);
    }

    // 5. Min/Max quantity checks
    if (recommendedQuantity < rules.minQty) {
      // If minimal coin step requires too much risk
      const minQtyRisk = rules.minQty * riskPerUnit;
      if (minQtyRisk > targetRiskAmountUsdt * 1.15) {
        return this.createInvalidResult(
          `Minimum order size (${rules.minQty} ${rules.baseAsset}) requires $${minQtyRisk.toFixed(2)} risk, exceeding allowed risk budget of $${targetRiskAmountUsdt.toFixed(2)}.`
        );
      }
      recommendedQuantity = rules.minQty;
    }

    // 6. Leverage and Margin calculation
    let requestedLeverage = isFutures ? Math.max(1, Math.min(maxAllowedLeverage, proposal.leverage || 1)) : 1;
    
    // Clamping leverage to prevent immediate liquidation before Stop Loss
    // SL distance + safety buffer
    const slDistRatio = riskPerUnit / entryPrice;
    const maxSafeTheoreticalLeverage = Math.floor(1 / (slDistRatio + 0.008));
    const effectiveLeverage = Math.max(1, Math.min(requestedLeverage, rules.maxLeverage, maxSafeTheoreticalLeverage));

    const notionalValueUsdt = recommendedQuantity * entryPrice;
    const marginRequiredUsdt = isFutures ? notionalValueUsdt / effectiveLeverage : notionalValueUsdt;

    // Check minNotional
    if (notionalValueUsdt < rules.minNotional) {
      return this.createInvalidResult(
        `Order notional value ($${notionalValueUsdt.toFixed(2)}) is below Binance minimum notional threshold of $${rules.minNotional}.`
      );
    }

    // Check available balance
    if (marginRequiredUsdt > availableBalance) {
      return this.createInvalidResult(
        `Insufficient available balance. Required margin: $${marginRequiredUsdt.toFixed(2)}, Available: $${availableBalance.toFixed(2)}.`
      );
    }

    // 7. Liquidation Price Calculation (Isolated Margin Futures)
    let liquidationPrice: number | undefined;
    let distanceToLiquidationPercent: number | undefined;

    if (isFutures && effectiveLeverage > 1) {
      const mmr = 0.005; // 0.5% Maintenance Margin Rate baseline
      if (isLong) {
        liquidationPrice = entryPrice * Math.max(0.0001, 1 - (1 / effectiveLeverage) + mmr);
        distanceToLiquidationPercent = ((entryPrice - liquidationPrice) / entryPrice) * 100;
        // Verify Stop Loss is tighter than Liquidation Price
        if (stopLoss <= liquidationPrice) {
          return this.createInvalidResult(
            `Stop Loss ($${stopLoss}) is below or at liquidation price ($${liquidationPrice.toFixed(2)}). Leverage (${effectiveLeverage}x) is dangerously high.`
          );
        }
      } else {
        liquidationPrice = entryPrice * (1 + (1 / effectiveLeverage) - mmr);
        distanceToLiquidationPercent = ((liquidationPrice - entryPrice) / entryPrice) * 100;
        if (stopLoss >= liquidationPrice) {
          return this.createInvalidResult(
            `Stop Loss ($${stopLoss}) is above or at liquidation price ($${liquidationPrice.toFixed(2)}). Leverage (${effectiveLeverage}x) is dangerously high.`
          );
        }
      }
    }

    // 8. Cost and Fee Estimation
    const takerFeeRate = rules.takerFeeRate;
    const estimatedEntryFeeUsdt = notionalValueUsdt * takerFeeRate;
    const estimatedExitFeeUsdt = notionalValueUsdt * takerFeeRate;
    const totalEstimatedFeesUsdt = estimatedEntryFeeUsdt + estimatedExitFeeUsdt;

    // Estimated Slippage (0.05% baseline to 0.2%)
    const estimatedSlippagePercent = Math.min(0.3, Math.max(0.02, (notionalValueUsdt / 100000) * 0.1));
    const estimatedSlippageCostUsdt = notionalValueUsdt * (estimatedSlippagePercent / 100);

    const estimatedLossAtStopLossUsdt = actualRiskAmountUsdt + totalEstimatedFeesUsdt + estimatedSlippageCostUsdt;

    // 9. Risk / Reward Calculation
    const targetPrice = proposal.takeProfit?.tp1 || (isLong ? entryPrice + (riskPerUnit * 2) : entryPrice - (riskPerUnit * 2));
    const grossRewardPerUnit = Math.abs(targetPrice - entryPrice);
    const grossRewardUsdt = recommendedQuantity * grossRewardPerUnit;
    const grossRiskReward = riskPerUnit > 0 ? grossRewardPerUnit / riskPerUnit : 0;

    const netRewardUsdt = grossRewardUsdt - totalEstimatedFeesUsdt - estimatedSlippageCostUsdt;
    const netLossUsdt = estimatedLossAtStopLossUsdt;
    const netRiskReward = netLossUsdt > 0 ? netRewardUsdt / netLossUsdt : 0;

    return {
      recommendedQuantity,
      maxSafeQuantity: recommendedQuantity,
      riskAmountUsdt: Number(actualRiskAmountUsdt.toFixed(2)),
      actualRiskPercent: Number(((actualRiskAmountUsdt / accountEquity) * 100).toFixed(3)),
      notionalValueUsdt: Number(notionalValueUsdt.toFixed(2)),
      marginRequiredUsdt: Number(marginRequiredUsdt.toFixed(2)),
      effectiveLeverage,
      liquidationPrice: liquidationPrice ? Number(liquidationPrice.toFixed(2)) : undefined,
      distanceToLiquidationPercent: distanceToLiquidationPercent ? Number(distanceToLiquidationPercent.toFixed(2)) : undefined,
      estimatedEntryFeeUsdt: Number(estimatedEntryFeeUsdt.toFixed(2)),
      estimatedExitFeeUsdt: Number(estimatedExitFeeUsdt.toFixed(2)),
      totalEstimatedFeesUsdt: Number(totalEstimatedFeesUsdt.toFixed(2)),
      estimatedSlippagePercent: Number(estimatedSlippagePercent.toFixed(3)),
      estimatedLossAtStopLossUsdt: Number(estimatedLossAtStopLossUsdt.toFixed(2)),
      grossRiskReward: Number(grossRiskReward.toFixed(2)),
      netRiskReward: Number(netRiskReward.toFixed(2)),
      isValid: true,
    };
  }

  private static createInvalidResult(error: string): PositionSizingCalculation {
    return {
      recommendedQuantity: 0,
      maxSafeQuantity: 0,
      riskAmountUsdt: 0,
      actualRiskPercent: 0,
      notionalValueUsdt: 0,
      marginRequiredUsdt: 0,
      effectiveLeverage: 1,
      estimatedEntryFeeUsdt: 0,
      estimatedExitFeeUsdt: 0,
      totalEstimatedFeesUsdt: 0,
      estimatedSlippagePercent: 0,
      estimatedLossAtStopLossUsdt: 0,
      grossRiskReward: 0,
      netRiskReward: 0,
      isValid: false,
      validationError: error,
    };
  }
}
