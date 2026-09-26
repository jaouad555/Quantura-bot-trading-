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

    // 0. Defensive Sanitization: Filter out malformed positions and normalize numeric fields
    const validPositions: ActivePositionSnapshot[] = [];
    for (const rawPos of (existingPositions || [])) {
      if (!rawPos || typeof rawPos !== 'object') continue;
      const posSymbol = (rawPos.symbol || '').toUpperCase();
      const posSide = (rawPos.side || (rawPos as any).decision);
      const quantity = Number(rawPos.quantity || (rawPos as any).remainingAmountBtc || 0);
      const currentPrice = Number(rawPos.currentPrice || rawPos.entryPrice || 0);
      const stopLoss = Number(rawPos.stopLoss || 0);
      const entryPrice = Number(rawPos.entryPrice || currentPrice || 0);
      const leverage = Number(rawPos.leverage || 1);
      const positionSizeUsdt = Number(rawPos.positionSizeUsdt || (rawPos.marginUsdt ? rawPos.marginUsdt * leverage : 0));

      if (
        !posSymbol ||
        (posSide !== 'LONG' && posSide !== 'SHORT') ||
        !Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isFinite(currentPrice) || currentPrice <= 0 ||
        !Number.isFinite(stopLoss) || stopLoss <= 0 ||
        !Number.isFinite(positionSizeUsdt) || positionSizeUsdt <= 0
      ) {
        console.warn(`[PORTFOLIO EVALUATOR WARN] Skipping malformed position in risk calculation:`, rawPos);
        continue;
      }

      validPositions.push({
        ...rawPos,
        symbol: posSymbol,
        side: posSide,
        quantity,
        currentPrice,
        stopLoss,
        entryPrice,
        leverage,
        positionSizeUsdt,
        marginUsdt: Number(rawPos.marginUsdt || (positionSizeUsdt / leverage)),
        unrealizedPnlUsdt: Number(rawPos.unrealizedPnlUsdt || 0),
        unrealizedRoePercent: Number(rawPos.unrealizedRoePercent || 0),
        marketType: rawPos.marketType || 'FUTURES',
        openedAt: Number(rawPos.openedAt || Date.now()),
      });
    }

    // 1. Max Open Positions Check
    if (validPositions.length >= config.maxOpenPositions) {
      return {
        isApproved: false,
        reasonCode: 'MAX_OPEN_POSITIONS',
        message: `Maximum open positions limit reached (${validPositions.length}/${config.maxOpenPositions}). Cannot open new position.`,
        totalOpenPositions: validPositions.length,
        portfolioRiskBeforePercent: 0,
        portfolioRiskAfterPercent: 0,
        totalExposureBeforePercent: 0,
        totalExposureAfterPercent: 0,
        symbolExposureAfterPercent: 0,
        correlationExposurePercent: 0,
      };
    }

    // 2. Max Positions per Symbol Check (Strict Anti-Pyramiding / Single Position per Symbol)
    const existingSameSymbol = validPositions.find(p => p.symbol.toUpperCase() === symbol);
    if (existingSameSymbol) {
      return {
        isApproved: false,
        reasonCode: 'MAX_POSITIONS_PER_SYMBOL',
        message: `Position for ${symbol} is already active (${existingSameSymbol.side} ${existingSameSymbol.leverage}x). Multiple positions per symbol are forbidden.`,
        totalOpenPositions: validPositions.length,
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

    for (const pos of validPositions) {
      const distanceToSl = Math.abs(pos.currentPrice - pos.stopLoss);
      const posRisk = Number.isFinite(pos.quantity * distanceToSl) ? pos.quantity * distanceToSl : 0;
      existingRiskUsdt += posRisk;

      const posExp = Number.isFinite(pos.positionSizeUsdt) ? pos.positionSizeUsdt : 0;
      existingExposureUsdt += posExp;

      if (pos.symbol.toUpperCase() === symbol) {
        existingSymbolExposureUsdt += posExp;
      }

      if (pos.strategyName === strategy) {
        strategyRiskUsdt += posRisk;
      }
    }

    const safeEquity = Number.isFinite(accountEquity) && accountEquity > 0 ? accountEquity : 1000;
    const portfolioRiskBeforePercent = (existingRiskUsdt / safeEquity) * 100;
    const totalExposureBeforePercent = (existingExposureUsdt / safeEquity) * 100;

    // Projected state after trade
    const safeCandidateRisk = Number.isFinite(candidateRiskAmountUsdt) ? candidateRiskAmountUsdt : 0;
    const safeCandidateNotional = Number.isFinite(candidateNotionalUsdt) ? candidateNotionalUsdt : 0;

    const totalRiskAfterUsdt = existingRiskUsdt + safeCandidateRisk;
    const portfolioRiskAfterPercent = (totalRiskAfterUsdt / safeEquity) * 100;

    const totalExposureAfterUsdt = existingExposureUsdt + safeCandidateNotional;
    const totalExposureAfterPercent = (totalExposureAfterUsdt / safeEquity) * 100;

    const symbolExposureAfterUsdt = existingSymbolExposureUsdt + safeCandidateNotional;
    const symbolExposureAfterPercent = (symbolExposureAfterUsdt / safeEquity) * 100;

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

    for (const pos of validPositions) {
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

    const correlationExposurePercent = safeEquity > 0 ? (correlatedExposureUsdt / safeEquity) * 100 : 0;

    if (correlationExposurePercent > config.maxCorrelationExposurePercent && validPositions.length > 0) {
      return {
        isApproved: false,
        reasonCode: 'HIGH_CORRELATION',
        message: `High Correlation Risk: Directional exposure across correlated pairs (${symbol} & ${mostCorrelatedSymbol}, r=${maxCorrelation.toFixed(2)}) equals ${correlationExposurePercent.toFixed(1)}%, exceeding safe cluster limit of ${config.maxCorrelationExposurePercent}%.`,
        totalOpenPositions: validPositions.length,
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
    const strategyRiskAfterPercent = safeEquity > 0 ? ((strategyRiskUsdt + safeCandidateRisk) / safeEquity) * 100 : 0;

    if (strategyRiskAfterPercent > strategyBudget) {
      return {
        isApproved: false,
        reasonCode: 'STRATEGY_BUDGET_EXCEEDED',
        message: `Strategy '${strategy}' risk budget exceeded (${strategyRiskAfterPercent.toFixed(2)}% > ${strategyBudget}%).`,
        totalOpenPositions: validPositions.length,
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
      totalOpenPositions: validPositions.length,
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
