export type RoeState = 'LOSS' | 'RECOVERY' | 'PROFIT' | 'PROTECTED' | 'LOCK_PROFIT';

export type TrailingStopMode = 'FIXED' | 'ATR_DYNAMIC';

export interface RoeEngineConfig {
  enabled: boolean;
  trailingActivationROE: number; // e.g. 1.5% Net ROE to arm trailing stop
  profitProtectionROE: number; // e.g. 3.0% Net ROE to guarantee min profit
  aggressiveProtectionROE: number; // e.g. 5.0% Net ROE to tighten trailing
  minimumProfitROE: number; // e.g. 0.5% Net ROE guaranteed floor once protected
  trailingMode: TrailingStopMode;
  trailingStopPercent: number; // e.g. 1.2% fixed distance
  atrTrailingMultiplier: number; // e.g. 1.5x ATR
  minimumTrailingPercent: number; // e.g. 0.8% floor for ATR mode
  maximumTrailingPercent: number; // e.g. 2.5% ceiling for ATR mode
  feeAwareBreakeven: boolean; // account for round-trip taker fees & slippage
  fundingAwareROE: boolean; // account for accrued/estimated funding costs
  takerFeeRate?: number; // default 0.0005 (0.05%)
  makerFeeRate?: number; // default 0.0002 (0.02%)
  estimatedSlippageRate?: number; // default 0.0002 (0.02%)
  conservativeFundingRate8h?: number; // default 0.0001 (0.01% per 8h)
}

export interface RoeMetrics {
  grossROE: number; // % (directional price movement * leverage)
  netROE: number; // % (net PnL / active margin * 100)
  priceChangePercent: number; // Directional price change %
  grossPnL: number; // USDT
  netPnL: number; // USDT
  estimatedFees: number; // USDT (entry + estimated exit)
  fundingCost: number; // USDT (estimated or real accrued funding)
  estimatedSlippage: number; // USDT
  peakROE: number; // % (highest net ROE achieved, never decreases)
  roeDrawdown: number; // % (peakROE - netROE)
  state: RoeState;
  previousState?: RoeState;
  stateChanged: boolean;
  isEstimated: boolean;
  breakevenPrice: number;
  protectedProfitUsdt: number;
  trailingStatus: 'INACTIVE' | 'ACTIVE' | 'LOCKED_PROFIT' | 'AGGRESSIVE';
  candidateStopLoss?: number;
  shouldUpdateStopLoss: boolean;
  stopLossUpdateReason?: string;
}

export interface PositionRoeInput {
  symbol: string;
  decision: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  marginUsdt: number; // Active isolated margin (e.g. remainingAmountUsdt)
  initialMarginUsdt?: number;
  realizedPnlUsdt?: number;
  currentStopLoss?: number;
  initialStopLoss?: number;
  peakROE?: number;
  peakPrice?: number;
  previousState?: RoeState;
  tp1Hit?: boolean;
  tp2Hit?: boolean;
  tp3Hit?: boolean;
  atr?: number;
  fundingRate8h?: number;
  openedAt?: number;
}
