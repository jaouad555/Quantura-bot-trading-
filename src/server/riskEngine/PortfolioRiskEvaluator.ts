import { ActivePositionSnapshot, RiskEngineConfig, TradeProposal } from './types';
import { getCorrelation } from './constants';

export interface PortfolioRiskEvaluation {
  isApproved: boolean;
  reasonCode?: 'MAX_PORTFOLIO_RISK' | 'MAX_TOTAL_EXPOSURE' | 'MAX_SYMBOL_EXPOSURE' | 'MAX_OPEN_POSITIONS' | 'MAX_POSITIONS_PER_SYMBOL' | 'HIGH_CORRELATION' | 'STRATEGY_BUDGET_EXCEEDED';
  message?: string;
  totalOpenPositions: number;
  portfolioRiskBeforePercent: number;
  portfolioRiskAfterPercent: number;
  totalExposureBeforePercent: number;
  totalExposureAfterPercent: number;
  symbolExposureAfterPercent: number;
  correlationExposurePercent: number;
  maxCorrelationPair?: { symbol: string; correlation: number };
}

export class PortfolioRiskEvaluator {
  /**
   * Evaluate the complete portfolio risk state including existing positions + candidate trade
   */
  public static evaluatePortfolio(
    candidateProposal: TradeProposal,
    candidateRiskAmountUsdt: number,
    candidateNotionalUsdt: number,
    existingPositions: ActivePositionSnapshot[],
    accountEquity: number,
    config: RiskEngineConfig
  ): PortfolioRiskEvaluation {
    const symbol = candidateProposal.symbol.toUpperCase();
    const candidateSide = candidateProposal.side;
    const strategy = candidateProposal.strategyName || 'Custom';

    // 1. Max Open Positions Check
    if (existingPositions.length >= config.maxOpenPositions) {
      return {
        isApproved: false,
        reasonCode: 'MAX_OPEN_POSITIONS',
        message: `Maximum open positions limit reached (${existingPositions.length}/${config.maxOpenPositions}). Cannot open new position.`,
        totalOpenPositions: existingPositions.length,
        portfolioRiskBeforePercent: 0,
        portfolioRiskAfterPercent: 0,
        totalExposureBeforePercent: 0,
        totalExposureAfterPercent: 0,
        symbolExposureAfterPercent: 0,
        correlationExposurePercent: 0,
      };
    }

    // 2. Max Positions per Symbol Check (Strict Anti-Pyramiding / Single Position per Symbol)
    const existingSameSymbol = existingPositions.find(p => p.symbol.toUpperCase() === symbol);
    if (existingSameSymbol) {
      return {
        isApproved: false,
        reasonCode: 'MAX_POSITIONS_PER_SYMBOL',
        message: `Position for ${symbol} is already active (${existingSameSymbol.side} ${existingSameSymbol.leverage}x). Multiple positions per symbol are forbidden.`,
        totalOpenPositions: existingPositions.length,
        portfolioRiskBeforePercent: 0,
        portfolioRiskAfterPercent: 0,
        totalExposureBeforePercent: 0,
        totalExposureAfterPercent: 0,
        symbolExposureAfterPercent: 0,
        correlationExposurePercent: 0,
      };
    }

    // 3. Existing Portfolio Risk Calculation (Sum of all position risks)
    let existingRiskUsdt = 0;
    let existingExposureUsdt = 0;
    let existingSymbolExposureUsdt = 0;
    let strategyRiskUsdt = 0;

    for (const pos of existingPositions) {
      const distanceToSl = Math.abs(pos.currentPrice - pos.stopLoss);
      const posRisk = pos.quantity * distanceToSl;
      existingRiskUsdt += posRisk;

      existingExposureUsdt += pos.positionSizeUsdt;

      if (pos.symbol.toUpperCase() === symbol) {
        existingSymbolExposureUsdt += pos.positionSizeUsdt;
      }

      if (pos.strategyName === strategy) {
        strategyRiskUsdt += posRisk;
      }
    }

    const portfolioRiskBeforePercent = accountEquity > 0 ? (existingRiskUsdt / accountEquity) * 100 : 0;
    const totalExposureBeforePercent = accountEquity > 0 ? (existingExposureUsdt / accountEquity) * 100 : 0;

    // Projected state after trade
    const totalRiskAfterUsdt = existingRiskUsdt + candidateRiskAmountUsdt;
    const portfolioRiskAfterPercent = accountEquity > 0 ? (totalRiskAfterUsdt / accountEquity) * 100 : 0;

    const totalExposureAfterUsdt = existingExposureUsdt + candidateNotionalUsdt;
    const totalExposureAfterPercent = accountEquity > 0 ? (totalExposureAfterUsdt / accountEquity) * 100 : 0;

    const symbolExposureAfterUsdt = existingSymbolExposureUsdt + candidateNotionalUsdt;
    const symbolExposureAfterPercent = accountEquity > 0 ? (symbolExposureAfterUsdt / accountEquity) * 100 : 0;

    // 4. Maximum Portfolio Risk Cap Check
    if (portfolioRiskAfterPercent > config.maxPortfolioRiskPercent) {
      return {
        isApproved: false,
        reasonCode: 'MAX_PORTFOLIO_RISK',
        message: `Total portfolio risk with new trade (${portfolioRiskAfterPercent.toFixed(2)}%) would exceed the maximum portfolio risk limit (${config.maxPortfolioRiskPercent}%).`,
        totalOpenPositions: existingPositions.length,
        portfolioRiskBeforePercent,
        portfolioRiskAfterPercent,
        totalExposureBeforePercent,
        totalExposureAfterPercent,
        symbolExposureAfterPercent,
        correlationExposurePercent: 0,
      };
    }

    // 5. Total Exposure Cap Check
    if (totalExposureAfterPercent > config.maxTotalExposurePercent) {
      return {
        isApproved: false,
        reasonCode: 'MAX_TOTAL_EXPOSURE',
        message: `Total notional exposure (${totalExposureAfterPercent.toFixed(2)}%) would exceed the maximum allowed total exposure limit (${config.maxTotalExposurePercent}%).`,
        totalOpenPositions: existingPositions.length,
        portfolioRiskBeforePercent,
        portfolioRiskAfterPercent,
        totalExposureBeforePercent,
        totalExposureAfterPercent,
        symbolExposureAfterPercent,
        correlationExposurePercent: 0,
      };
    }

    // 6. Single Symbol Exposure Cap Check
    if (symbolExposureAfterPercent > config.maxSymbolExposurePercent) {
      return {
        isApproved: false,
        reasonCode: 'MAX_SYMBOL_EXPOSURE',
        message: `Exposure for ${symbol} (${symbolExposureAfterPercent.toFixed(2)}%) would exceed the maximum single-symbol limit (${config.maxSymbolExposurePercent}%).`,
        totalOpenPositions: existingPositions.length,
        portfolioRiskBeforePercent,
        portfolioRiskAfterPercent,
        totalExposureBeforePercent,
        totalExposureAfterPercent,
        symbolExposureAfterPercent,
        correlationExposurePercent: 0,
      };
    }

    // 7. Correlation Risk Evaluation
    // Sum exposure of open positions that are in the same direction and strongly correlated (r >= 0.75)
    let correlatedExposureUsdt = candidateNotionalUsdt;
    let maxCorrelation = 0;
    let mostCorrelatedSymbol = '';

    for (const pos of existingPositions) {
      const corr = getCorrelation(symbol, pos.symbol);
      if (corr > maxCorrelation) {
        maxCorrelation = corr;
        mostCorrelatedSymbol = pos.symbol;
      }

      // If positions are in the same direction (both LONG or both SHORT) and positively correlated
      if (pos.side === candidateSide && corr >= 0.75) {
        correlatedExposureUsdt += pos.positionSizeUsdt * corr;
      }
    }

    const correlationExposurePercent = accountEquity > 0 ? (correlatedExposureUsdt / accountEquity) * 100 : 0;

    if (correlationExposurePercent > config.maxCorrelationExposurePercent && existingPositions.length > 0) {
      return {
        isApproved: false,
        reasonCode: 'HIGH_CORRELATION',
        message: `High Correlation Risk: Directional exposure across correlated pairs (${symbol} & ${mostCorrelatedSymbol}, r=${maxCorrelation.toFixed(2)}) equals ${correlationExposurePercent.toFixed(1)}%, exceeding safe cluster limit of ${config.maxCorrelationExposurePercent}%.`,
        totalOpenPositions: existingPositions.length,
        portfolioRiskBeforePercent,
        portfolioRiskAfterPercent,
        totalExposureBeforePercent,
        totalExposureAfterPercent,
        symbolExposureAfterPercent,
        correlationExposurePercent,
        maxCorrelationPair: { symbol: mostCorrelatedSymbol, correlation: maxCorrelation },
      };
    }

    // 8. Strategy Risk Budget Check
    const strategyBudget = config.strategyRiskBudgets[strategy] || 1.5;
    const strategyRiskAfterPercent = accountEquity > 0 ? ((strategyRiskUsdt + candidateRiskAmountUsdt) / accountEquity) * 100 : 0;

    if (strategyRiskAfterPercent > strategyBudget) {
      return {
        isApproved: false,
        reasonCode: 'STRATEGY_BUDGET_EXCEEDED',
        message: `Strategy '${strategy}' risk budget exceeded (${strategyRiskAfterPercent.toFixed(2)}% > ${strategyBudget}%).`,
        totalOpenPositions: existingPositions.length,
        portfolioRiskBeforePercent,
        portfolioRiskAfterPercent,
        totalExposureBeforePercent,
        totalExposureAfterPercent,
        symbolExposureAfterPercent,
        correlationExposurePercent,
      };
    }

    return {
      isApproved: true,
      totalOpenPositions: existingPositions.length,
      portfolioRiskBeforePercent,
      portfolioRiskAfterPercent,
      totalExposureBeforePercent,
      totalExposureAfterPercent,
      symbolExposureAfterPercent,
      correlationExposurePercent,
      maxCorrelationPair: mostCorrelatedSymbol ? { symbol: mostCorrelatedSymbol, correlation: maxCorrelation } : undefined,
    };
  }
}
