export enum PositionState {
  PENDING = 'PENDING',
  OPENING = 'OPENING',
  OPEN = 'OPEN',
  PARTIALLY_CLOSED = 'PARTIALLY_CLOSED',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR',
  PROTECTED = 'PROTECTED',
  EMERGENCY_EXIT = 'EMERGENCY_EXIT'
}

export interface TradeSignal {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  timeframe: string;
  strategy: string;
  signalId: string;
}

export interface PositionConfiguration {
  maxSimultaneousPositions: number;
  maxPositionsPerSymbol: number;
  maxLongPositions: number;
  maxShortPositions: number;
  maxTotalExposure: number;
  maxSymbolExposure: number;
  maxCorrelatedExposure: number;
  riskPerTradePercent: number; // e.g. 0.01 for 1%
  maxPortfolioRiskPercent: number;
  maxDailyLossPercent: number;
}
