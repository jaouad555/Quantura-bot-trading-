import { TradeSignal, PositionState, PositionConfiguration } from './types';
import { RiskEngine } from './RiskEngine';

export class PositionManager {
  private riskEngine: RiskEngine;
  private isEmergencyStopActive: boolean = false;

  constructor(config: PositionConfiguration) {
    this.riskEngine = new RiskEngine(config);
  }

  public async processSignal(signal: TradeSignal, currentEquity: number, currentPortfolioRisk: number) {
    if (this.isEmergencyStopActive) {
      console.warn(`[PositionManager] REJECTED: Emergency Stop is active.`);
      return { success: false, reason: "EMERGENCY_STOP" };
    }

    const validation = this.riskEngine.validateSignal(signal, currentPortfolioRisk);
    if (!validation.valid) {
      console.warn(`[PositionManager] REJECTED: ${validation.reason}`);
      return { success: false, reason: validation.reason };
    }

    const size = this.riskEngine.calculatePositionSize(currentEquity, signal.entry, signal.stopLoss);
    
    // Process Execution (e.g. through BinanceExecutionAdapter or PaperExecutionAdapter)
    console.log(`[PositionManager] APPROVED: Position size calculated as ${size} for ${signal.symbol}`);
    
    return { success: true, size };
  }

  public activateEmergencyStop() {
    this.isEmergencyStopActive = true;
    console.error("🚨 [PositionManager] EMERGENCY STOP ACTIVATED. All new entries blocked.");
    // Cancel pending orders, close/protect open positions.
  }

  public resetEmergencyStop() {
    this.isEmergencyStopActive = false;
    console.log("✅ [PositionManager] Emergency Stop reset.");
  }
}
