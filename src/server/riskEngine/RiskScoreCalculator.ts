import { RiskScoreLevel, VolatilityRegime } from './types';

export interface RiskScoreBreakdown {
  score: number;
  level: RiskScoreLevel;
  components: {
    volatilityScore: number;
    drawdownScore: number;
    dailyLossScore: number;
    exposureScore: number;
    correlationScore: number;
    leverageScore: number;
    lossStreakScore: number;
    spreadSlippageScore: number;
  };
}

export class RiskScoreCalculator {
  /**
   * Calculate institutional 0-100 Quantura Risk Score
   */
  public static calculate(params: {
    volatilityRegime: VolatilityRegime;
    atrPercent: number;
    dailyLossPercent: number;
    maxDailyLossPercent: number;
    drawdownPercent: number;
    maxDrawdownPercent: number;
    totalExposurePercent: number;
    correlationExposurePercent: number;
    leverage: number;
    consecutiveLosses: number;
    spreadPercent: number;
    slippagePercent: number;
    riskReward: number;
  }): RiskScoreBreakdown {
    // If portfolio has zero open positions, zero losses, zero drawdown: clean baseline is strictly 0
    if (params.totalExposurePercent <= 0 && (params.consecutiveLosses || 0) <= 0 && (params.drawdownPercent || 0) <= 0 && (params.dailyLossPercent || 0) <= 0) {
      return {
        score: 0,
        level: 'LOW',
        components: {
          volatilityScore: 0,
          drawdownScore: 0,
          dailyLossScore: 0,
          exposureScore: 0,
          correlationScore: 0,
          leverageScore: 0,
          lossStreakScore: 0,
          spreadSlippageScore: 0,
        },
      };
    }

    // 1. Volatility Score (0 - 15 pts) - only applicable if capital is exposed to the market
    let volatilityScore = 0;
    if (params.totalExposurePercent > 0) {
      if (params.volatilityRegime === 'LOW') volatilityScore = 3;
      else if (params.volatilityRegime === 'NORMAL') volatilityScore = 6;
      else if (params.volatilityRegime === 'HIGH') volatilityScore = 12;
      else if (params.volatilityRegime === 'EXTREME') volatilityScore = 15;
      else volatilityScore = 5;
    }

    // 2. Drawdown Score (0 - 20 pts)
    const ddRatio = params.maxDrawdownPercent > 0 ? (params.drawdownPercent || 0) / params.maxDrawdownPercent : 0;
    const drawdownScore = Math.min(20, Math.round(ddRatio * 20));

    // 3. Daily Loss Score (0 - 20 pts)
    const dlRatio = params.maxDailyLossPercent > 0 ? (params.dailyLossPercent || 0) / params.maxDailyLossPercent : 0;
    const dailyLossScore = Math.min(20, Math.round(dlRatio * 20));

    // 4. Exposure Score (0 - 15 pts)
    const exposureRatio = (params.totalExposurePercent || 0) / 200.0;
    const exposureScore = Math.min(15, Math.round(exposureRatio * 15));

    // 5. Correlation Score (0 - 10 pts)
    const corrRatio = (params.correlationExposurePercent || 0) / 35.0;
    const correlationScore = Math.min(10, Math.round(corrRatio * 10));

    // 6. Leverage Score (0 - 10 pts) - only if positions are active
    const leverageScore = params.totalExposurePercent > 0 ? Math.min(10, Math.round(((params.leverage || 1) / 10) * 10)) : 0;

    // 7. Loss Streak Score (0 - 10 pts)
    const lossStreakScore = Math.min(10, (params.consecutiveLosses || 0) * 2);

    // 8. Spread & Slippage (0 - 5 pts) - only if active positions
    const spreadSlippageScore = params.totalExposurePercent > 0 ? Math.min(5, Math.round((((params.spreadPercent || 0) + (params.slippagePercent || 0)) / 0.5) * 5)) : 0;

    const rawScore = volatilityScore + drawdownScore + dailyLossScore + exposureScore + correlationScore + leverageScore + lossStreakScore + spreadSlippageScore;
    const score = Math.min(100, Math.max(0, rawScore));

    let level: RiskScoreLevel = 'LOW';
    if (score >= 76) level = 'EXTREME';
    else if (score >= 51) level = 'HIGH';
    else if (score >= 26) level = 'MODERATE';
    else level = 'LOW';

    return {
      score,
      level,
      components: {
        volatilityScore,
        drawdownScore,
        dailyLossScore,
        exposureScore,
        correlationScore,
        leverageScore,
        lossStreakScore,
        spreadSlippageScore,
      },
    };
  }
}
