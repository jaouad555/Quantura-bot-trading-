import { TradeSignal, PositionConfiguration } from './types';

export class RiskEngine {
  private config: PositionConfiguration;

  constructor(config: PositionConfiguration) {
    this.config = config;
  }

  public validateSignal(signal: TradeSignal, currentPortfolioRisk: number): { valid: boolean; reason?: string } {
    if (signal.confidence < 60) {
      return { valid: false, reason: "Confidence too low." };
    }

    if (currentPortfolioRisk + this.config.riskPerTradePercent > this.config.maxPortfolioRiskPercent) {
      return { valid: false, reason: "Max portfolio risk exceeded." };
    }

    // Additional validations logic here
    return { valid: true };
  }

  public calculatePositionSize(accountEquity: number, entryPrice: number, stopLoss: number): number {
    const riskAmount = accountEquity * this.config.riskPerTradePercent;
    const distanceToSl = Math.abs(entryPrice - stopLoss);
    
    if (distanceToSl === 0) return 0;
    
    // Position Size = Risk Amount / Stop Loss Distance
    return riskAmount / distanceToSl;
  }
}
