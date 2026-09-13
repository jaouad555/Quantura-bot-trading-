export type RiskDecision = 'APPROVED' | 'REJECTED';

export type RiskLockStatus = 'NORMAL' | 'WARNING' | 'RESTRICTED' | 'LOCKED' | 'EMERGENCY';

export type RiskScoreLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

export type VolatilityRegime = 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';

export type MarketRegime = 'TRENDING' | 'RANGING' | 'LOW_VOLATILITY' | 'HIGH_VOLATILITY' | 'UNCERTAIN';

export type RejectionCode =
  | 'DAILY_LOSS_LIMIT'
  | 'MAX_DRAWDOWN'
  | 'MAX_PORTFOLIO_RISK'
  | 'MAX_TOTAL_EXPOSURE'
  | 'MAX_SYMBOL_EXPOSURE'
  | 'MAX_OPEN_POSITIONS'
  | 'MAX_POSITIONS_PER_SYMBOL'
  | 'HIGH_CORRELATION'
  | 'HIGH_VOLATILITY'
  | 'EXTREME_VOLATILITY'
  | 'EXCESSIVE_SPREAD'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'EXCESSIVE_SLIPPAGE'
  | 'INVALID_STOP_LOSS'
  | 'MISSING_STOP_LOSS'
  | 'INVALID_TAKE_PROFIT'
  | 'LOW_RISK_REWARD'
  | 'EXCESSIVE_LEVERAGE'
  | 'LIQUIDATION_RISK'
  | 'STALE_MARKET_DATA'
  | 'INVALID_PRICE'
  | 'BINANCE_API_ERROR'
  | 'UNKNOWN_POSITION_STATE'
  | 'DUPLICATE_ORDER'
  | 'RISK_LOCK_ACTIVE'
  | 'EMERGENCY_STOP_ACTIVE'
  | 'LOSS_STREAK_PAUSE'
  | 'ANTI_MARTINGALE_VIOLATION'
  | 'UNCERTAIN_MARKET_REGIME'
  | 'STRATEGY_BUDGET_EXCEEDED'
  | 'INSUFFICIENT_EQUITY'
  | 'INSUFFICIENT_MARGIN'
  | 'ORDER_SIZE_TOO_SMALL'
  | 'ORDER_SIZE_TOO_LARGE'
  | 'RISK_ENGINE_ERROR';

export interface SymbolTradingRules {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  tickSize: number;
  stepSize: number;
  minQty: number;
  maxQty: number;
  minNotional: number;
  maxLeverage: number;
  takerFeeRate: number; // e.g. 0.0004 (0.04% for futures, 0.1% for spot)
  makerFeeRate: number;
  estimatedFundingRate?: number; // e.g. 0.0001 (0.01% per 8h)
}

export interface RiskEngineConfig {
  // Core risk parameters
  riskPerTradePercent: number; // Default: 0.5% (allowed: 0.25%, 0.5%, 1.0%, 1.5%, 2.0%)
  maxDailyLossPercent: number; // Default: 3.0%
  maxAccountDrawdownPercent: number; // Default: 10.0%
  maxPortfolioRiskPercent: number; // Default: 3.0%
  maxTotalExposurePercent: number; // Default: 200.0% for futures, 100% for spot
  maxSymbolExposurePercent: number; // Default: 20.0%
  maxCorrelationExposurePercent: number; // Default: 35.0%
  maxOpenPositions: number; // Default: 5
  maxPositionsPerSymbol: number; // Default: 1 (anti-pyramiding)
  maxAllowedLeverage: number; // Default: 10 (conservative: 3, moderate: 5, aggressive: 10)
  minRiskRewardRatio: number; // Default: 2.0 (1:2)
  maxSlippagePercent: number; // Default: 0.5%
  maxSpreadPercent: number; // Default: 0.25%
  min24hVolumeUsdt: number; // Default: 5,000,000 USDT
  
  // Streak & Behavioral
  consecutiveLossStreakReduce50: number; // Default: 3
  consecutiveLossStreakPause: number; // Default: 5
  consecutiveLossStreakLock: number; // Default: 10
  
  // Strategy risk budgets (Strategy Name -> Max Portfolio Risk %)
  strategyRiskBudgets: Record<string, number>;
  
  // Lock & Safety
  emergencyStop: boolean;
  riskLockStatus: RiskLockStatus;
  riskLockReason?: string;
  riskLockTimestamp?: number;
}

export interface OrderBookDepth {
  topBids: Array<{ price: number; amount: number }>;
  topAsks: Array<{ price: number; amount: number }>;
}

export interface MarketProtectionInput {
  currentPrice: number;
  timestamp: number;
  bidPrice?: number;
  askPrice?: number;
  volume24hUsdt?: number;
  atr14?: number;
  historicalVolatility?: number;
  orderBook?: OrderBookDepth;
  marketRegime?: MarketRegime;
}

export interface TradeProposal {
  clientOrderId?: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit?: {
    tp1: number;
    tp2?: number;
    tp3?: number;
  };
  marketType: 'SPOT' | 'FUTURES';
  leverage?: number;
  marginMode?: 'ISOLATED' | 'CROSS';
  timeframe?: string;
  strategyName?: string;
  signalConfidence?: number;
  requestedMarginUsdt?: number;
  requestedQuantity?: number;
  timestamp?: number;
  
  // Real-time market context provided for validation
  marketData?: MarketProtectionInput;
  
  // Account snapshot
  accountEquity?: number;
  availableBalance?: number;
  isPaper?: boolean;
}

export interface ActivePositionSnapshot {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  quantity: number; // Base asset quantity
  marginUsdt: number;
  positionSizeUsdt: number; // Notional value
  leverage: number;
  marketType: 'SPOT' | 'FUTURES';
  unrealizedPnlUsdt: number;
  unrealizedRoePercent: number;
  strategyName?: string;
  openedAt: number;
}

export interface RiskEvaluationResult {
  decision: RiskDecision;
  reasonCode?: RejectionCode;
  message: string;
  riskScore: number; // 0 - 100
  riskLevel: RiskScoreLevel;
  
  // Approved execution parameters (Authoritative backend calculation)
  symbol: string;
  side: 'LONG' | 'SHORT';
  marketType: 'SPOT' | 'FUTURES';
  approvedQuantity: number;
  approvedMarginUsdt: number;
  approvedLeverage: number;
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2?: number;
  tp3?: number;
  
  // Sizing & Risk Details
  riskAmountUsdt: number;
  riskPercent: number;
  notionalValueUsdt: number;
  liquidationPrice?: number;
  distanceToLiquidationPercent?: number;
  riskRewardRatio: number;
  netRiskRewardRatio: number;
  
  // Portfolio State Projections
  portfolioRiskBeforePercent: number;
  portfolioRiskAfterTradePercent: number;
  totalExposureBeforePercent: number;
  totalExposureAfterTradePercent: number;
  symbolExposureAfterTradePercent: number;
  correlationExposurePercent: number;
  
  // Friction & Costs
  estimatedEntryFeeUsdt: number;
  estimatedExitFeeUsdt: number;
  estimatedSlippagePercent: number;
  estimatedLossAtStopLossUsdt: number;
  
  // Regimes & Safety
  volatilityRegime: VolatilityRegime;
  marketRegime: MarketRegime;
  riskLockStatus: RiskLockStatus;
  auditId: string;
  evaluatedAt: number;
}

export interface RiskEngineMetrics {
  startingDailyEquity: number;
  currentEquity: number;
  peakEquity: number;
  dailyRealizedPnl: number;
  dailyUnrealizedPnl: number;
  dailyFeesPaid: number;
  dailyFundingPaid: number;
  netDailyPnlUsdt: number;
  netDailyPnlPercent: number;
  
  // Drawdowns
  dailyDrawdownPercent: number;
  weeklyDrawdownPercent: number;
  monthlyDrawdownPercent: number;
  maxAccountDrawdownPercent: number;
  
  // Portfolio Risk
  totalOpenPositions: number;
  openPositionRisksUsdt: number;
  totalPortfolioRiskPercent: number;
  totalExposureUsdt: number;
  totalExposurePercent: number;
  
  // Streaks & Stats
  consecutiveLosses: number;
  consecutiveWins: number;
  
  // Engine State
  riskScore: number;
  riskLevel: RiskScoreLevel;
  riskLockStatus: RiskLockStatus;
  emergencyStop: boolean;
  lockReason?: string;
  lastEvaluatedAt: number;
}

export interface RiskAuditEntry {
  id: string;
  timestamp: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  marketType: 'SPOT' | 'FUTURES';
  decision: RiskDecision;
  reasonCode?: RejectionCode;
  message: string;
  riskScore: number;
  equity: number;
  riskPercent: number;
  riskAmountUsdt: number;
  entryPrice: number;
  stopLoss: number;
  quantity: number;
  leverage: number;
  portfolioRiskPercent: number;
  totalExposurePercent: number;
  symbolExposurePercent: number;
  riskReward: number;
  volatilityRegime: VolatilityRegime;
  clientOrderId?: string;
}
