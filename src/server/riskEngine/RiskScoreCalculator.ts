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
    // 1. Volatility Score (0 - 15 pts)
    let volatilityScore = 5;
    if (params.volatilityRegime === 'LOW') volatilityScore = 3;
    else if (params.volatilityRegime === 'NORMAL') volatilityScore = 6;
    else if (params.volatilityRegime === 'HIGH') volatilityScore = 12;
    else if (params.volatilityRegime === 'EXTREME') volatilityScore = 15;

    // 2. Drawdown Score (0 - 20 pts)
    const ddRatio = params.maxDrawdownPercent > 0 ? params.drawdownPercent / params.maxDrawdownPercent : 0;
    const drawdownScore = Math.min(20, Math.round(ddRatio * 20));

    // 3. Daily Loss Score (0 - 20 pts)
    const dlRatio = params.maxDailyLossPercent > 0 ? params.dailyLossPercent / params.maxDailyLossPercent : 0;
    const dailyLossScore = Math.min(20, Math.round(dlRatio * 20));

    // 4. Exposure Score (0 - 15 pts)
    const exposureRatio = params.totalExposurePercent / 200.0;
    const exposureScore = Math.min(15, Math.round(exposureRatio * 15));

    // 5. Correlation Score (0 - 10 pts)
    const corrRatio = params.correlationExposurePercent / 35.0;
    const correlationScore = Math.min(10, Math.round(corrRatio * 10));

    // 6. Leverage Score (0 - 10 pts)
    const leverageScore = Math.min(10, Math.round((params.leverage / 10) * 10));

    // 7. Loss Streak Score (0 - 10 pts)
    const lossStreakScore = Math.min(10, params.consecutiveLosses * 2);

    // 8. Spread & Slippage (0 - 5 pts)
    const spreadSlippageScore = Math.min(5, Math.round(((params.spreadPercent + params.slippagePercent) / 0.5) * 5));

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
