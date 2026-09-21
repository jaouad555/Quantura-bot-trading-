export const APP_VERSION = '2.5.0';
export const APP_VERSION_TAG = 'v2.5.0';

export type DecisionType = 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';
export type BiasType = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'MODERATE' | 'HIGH' | 'EXTREME';
export type Timeframe = '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
export type BotTimeframe = 'AUTO' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
export type MarketType = 'SPOT' | 'FUTURES';
export type Language = 'fr' | 'ar' | 'en';
export type TimezoneMode = 'GMT+1' | 'UTC' | 'LOCAL';
export type ConnectionState = 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE' | 'ERROR';
export type DisplayMode = 'auto' | 'standard' | 'compact' | 'fullscreen';

export type MarketRegime =
  | 'TRENDING_BULLISH'
  | 'TRENDING_BEARISH'
  | 'RANGING'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'UNCERTAIN';

export type TradeType = 'FAST_TRADE' | 'SHORT_TRADE' | 'SWING_TRADE' | 'POSITION_TRADE';
export type OrderBookBias = 'BUYERS_STRONG' | 'SELLERS_STRONG' | 'BALANCED';

export interface KlineCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BinanceTicker {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  updatedAt: number;
}

export interface OrderBookSummary {
  bidTotal: number;
  askTotal: number;
  bidAskRatio: number; // > 1 means buying pressure
  topBids: { price: number; qty: number }[];
  topAsks: { price: number; qty: number }[];
  imbalancePercent: number; // e.g. +25% buyers or -15% sellers
  bias: OrderBookBias;
  largeWalls: { price: number; type: 'BID' | 'ASK'; volume: number }[];
}

export interface MarketStructure {
  trend: 'UPTREND' | 'DOWNTREND' | 'RANGING';
  swingHigh: number;
  swingLow: number;
  structure: 'HIGHER_HIGH' | 'HIGHER_LOW' | 'LOWER_HIGH' | 'LOWER_LOW' | 'RANGE';
  bos: string; // Break of Structure level / description
  choch: string; // Change of Character level / description
}

export interface TechnicalIndicators {
  // Moving averages
  ema20: number;
  ema50: number;
  ema100: number;
  ema200: number;
  sma200: number;

  // Momentum
  rsi14: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  stochRsi?: {
    k: number;
    d: number;
  };

  // Volatility
  atr14: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidthPercent: number;
  };

  // Trend strength
  adx14: number;

  // Advanced Oscillators & Overlays
  stoch?: {
    k: number;
    d: number;
  };
  ichimoku?: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
  };
  fibonacci?: {
    level0: number;
    level236: number;
    level382: number;
    level500: number;
    level618: number;
    level786: number;
    level100: number;
  };

  // Volume & price levels
  volume: number;
  volumeAvg20: number;
  vwap: number;
  obv: number;

  // Structure & Pivots
  marketStructure: MarketStructure;
  supportLevels: number[];
  resistanceLevels: number[];
  liquidityZones: {
    buySide: number[];
    sellSide: number[];
  };
}

export interface DerivativesData {
  openInterest: number | null; // USD
  fundingRate: number | null; // % per 8h
  takerLongShortRatio: number | null;
  futuresVolume24h: number | null;
  isAvailable: boolean;
  source: string;
  lastUpdated: number;
}

export interface QuantitativeScore {
  bullishScore: number; // 0-100
  bearishScore: number; // 0-100
  neutralScore: number; // 0-100
  signalStrength: number; // 0-100 (Confidence)
  breakdown: {
    trend: number; // weight 20%
    marketStructure: number; // weight 20%
    momentum: number; // weight 15%
    volume: number; // weight 10%
    volatility: number; // weight 10%
    supportResistance: number; // weight 10%
    mtfConfluence: number; // weight 5%
    orderBook: number; // weight 5%
    derivatives: number; // weight 5%
  };
}

export interface EntryQuality {
  grade: 'A' | 'B' | 'C' | 'D';
  score: number; // 0-100
  reason: string;
}

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  klines: KlineCandle[];
  indicators: TechnicalIndicators;
  regime: MarketRegime;
  bias: BiasType;
}

export interface MTFConfluenceData {
  timeframes: Record<Timeframe, {
    bias: BiasType;
    trend: string;
    rsi: number;
    emaTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }>;
  overallBias: BiasType;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  alignmentPercent: number;
}

export interface AIAnalysisResult {
  symbol?: string;
  timestamp?: number; // Added to prevent immediate execution of stale signals
  decision: DecisionType;
  bias: BiasType;
  tradeType: TradeType;
  confidence: number; // Signal strength 0-100 (NOT statistical certainty)
  marketRegime: MarketRegime;
  entryQuality: EntryQuality;
  quantScore: QuantitativeScore;

  currentPrice: number;
  entryZone: {
    min: number;
    max: number;
    ideal: number;
  } | null;

  targets: {
    tp1: number;
    tp2: number;
    tp3: number;
  } | null;

  stopLoss: number | null;
  riskRewardRatio: number | null;

  invalidation: {
    longInvalidBelow?: number;
    shortInvalidAbove?: number;
    reason: string;
  };

  scenarios: {
    primary: string;
    alternative: string;
  };

  recommendedTimeframe: Timeframe;
  timing: {
    entryWindow: string;
    expectedDuration: string;
    optimalExitTime: string;
  };

  riskLevel: RiskLevel;
  keyFactors: string[];
  technicalReason: string;
  riskWarning: string;

  detailedAnalysis: {
    fr: string;
    ar: string;
    en: string;
  };

  generatedAt: number;
  isDeveloperMode: boolean;
  dataSource: string;
}

export interface MarketDataResponse {
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  errorMessage?: string;
  ticker: BinanceTicker | null;
  timeframe: Timeframe;
  klines: KlineCandle[];
  indicators: TechnicalIndicators | null;
  orderBook: OrderBookSummary | null;
  derivatives: DerivativesData | null;
  marketRegime: MarketRegime;
  mtfConfluence: MTFConfluenceData | null;
  allTimeframes?: Record<Timeframe, { klines: KlineCandle[]; indicators: TechnicalIndicators }>;
  updatedAt: number;
  isDeveloperMode: boolean;
}

export type SignalLifecycleStatus =
  | 'PENDING'
  | 'ENTRY_HIT'
  | 'TP1_HIT'
  | 'TP2_HIT'
  | 'TP3_HIT'
  | 'SL_HIT'
  | 'EXPIRED'
  | 'INVALIDATED'
  | 'MANUAL_EXIT';

export interface TradeHistoryItem {
  id: string;
  timestamp: number;
  symbol: string;
  decision: DecisionType;
  timeframe: Timeframe;
  entryPrice: number;
  currentPrice?: number;
  exitPrice?: number;
  tp1: number;
  tp2?: number;
  tp3?: number;
  stopLoss: number;
  status: SignalLifecycleStatus | 'ACTIVE' | 'CLOSED' | 'PROFIT_TP1' | 'PROFIT_TP2' | 'STOPPED_OUT';
  profitPercent: number;
  profitUsdt?: number;
  strategyName?: string;
  confidence: number;
  riskRewardRatio?: number;
  pnlHistory?: number[];
  entryZoneMin?: number;
  entryZoneMax?: number;
  reason?: string;
}

export interface LiquidityHealthAssessment {
  symbol: string;
  timestamp: number;
  currentPrice: number;
  calculatedPositionUsdt: number;
  calculatedQuantity: number;
  availableDepthUsdt: number;
  depthRatio: number; // availableDepthUsdt / calculatedPositionUsdt
  estimatedSlippagePercent: number;
  spreadPercent: number;
  tradeVolume24hUsdt: number;
  volumeRatio: number; // calculatedPositionUsdt / (volume24hUsdt / 24)
  status: 'EXCELLENT' | 'SUFFICIENT' | 'MODERATE' | 'INSUFFICIENT' | 'CRITICAL_ILLIQUID';
  slippageRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  recommendedMaxSizeUsdt: number;
  warnings: string[];
  suggestedAction: string;
}

export interface PushAlert {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  type: 'SIGNAL' | 'PRICE' | 'TARGET_HIT' | 'STOP_LOSS_HIT' | 'SYSTEM' | 'REGIME_CHANGE' | 'LIQUIDITY_WARNING';
  decision?: DecisionType;
  symbol?: string;
  price?: number;
  read: boolean;
}

export interface AlertSettings {
  pushEnabled: boolean;
  soundEnabled: boolean;
  minConfidence: number; // e.g. 75%
  notifyLong: boolean;
  notifyShort: boolean;
  notifyTpSl: boolean;
  notifyRegimeChange: boolean;
}

export type BacktestStrategyId =
  | 'MOMENTUM'
  | 'SCALPER'
  | 'SWING'
  | 'BREAKOUT'
  | 'MEAN_REVERSION'
  | 'INSTITUTIONAL_SMC'
  | 'ALL_STRATEGIES';

export interface BacktestConfig {
  timeframe: Timeframe;
  months: number; // 1 to 24 months
  candleLimit: number;
  initialBalance: number; // e.g. 1000 USDT
  leverage: number; // 1 to 10
  tradeAllocationPercent: number; // e.g. 20%
  riskRewardTarget: number; // e.g. 2.0
  minSignalStrength: number; // e.g. 65
  slAtrMultiplier: number; // e.g. 1.5
  marketType?: 'SPOT' | 'FUTURES';
  strategyId?: BacktestStrategyId;
  strategyPreset?: 'FUTURES_MOMENTUM_TREND' | 'CONSERVATIVE_PULLBACK' | 'AGGRESSIVE_BREAKOUT' | 'SCALPING_FAST' | 'CUSTOM';
  trailingStopEnabled?: boolean;
  trailingStopPercent?: number; // e.g. 1.2%
  trailingActivationProfitPercent?: number; // e.g. 1.5%
  tp1Ratio?: number; // % of position to close at TP1 (e.g. 0.5 = 50%)
  tp2Ratio?: number; // % of position to close at TP2 (e.g. 0.25 = 25%)
  feeRatePercent?: number; // e.g. 0.05%
  slippagePercent?: number; // e.g. 0.02%
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  strategyId?: BacktestStrategyId;
  strategyName?: string;
  entryTime: number;
  exitTime: number;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  result: 'TP1_WIN' | 'TP2_WIN' | 'TP3_WIN' | 'TRAILING_SL_WIN' | 'BREAKEVEN_SL' | 'SL_LOSS' | 'LIQUIDATED';
  pnlPercent: number;
  pnlUsdt: number;
  balanceAfter: number;
  rMultiple: number;
  exitReason?: string;
  feeUsdt?: number;
  durationCandles?: number;
}

export interface EquityDataPoint {
  timestamp: number;
  botReturn: number;
  botEquityUsdt?: number;
  buyHoldReturn: number;
  buyHoldEquityUsdt?: number;
}

export interface BacktestResult {
  symbol: string;
  config: BacktestConfig;
  equityCurve: EquityDataPoint[];
  initialBalance: number;
  finalBalance: number;
  netProfitUsdt: number;
  netReturnPercent: number;
  maxDrawdownPercent: number;
  maxDrawdownUsdt: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // %
  lossRate: number; // %
  profitFactor: number;
  averageRR: number;
  expectancy: number;
  avgWinUsdt: number;
  avgLossUsdt: number;
  tp1Rate: number;
  tp2Rate: number;
  tp3Rate: number;
  slRate: number;
  trades: BacktestTrade[];
  sharpeRatio?: number;
  sortinoRatio?: number;
  totalFeesUsdt?: number;
}

export interface MultiCoinBacktestResult {
  config: BacktestConfig;
  resultsByCoin: Record<string, BacktestResult>;
  portfolioEquityCurve: EquityDataPoint[];
  totalInitialBalance: number;
  totalFinalBalance: number;
  totalNetProfitUsdt: number;
  totalNetReturnPercent: number;
  totalTrades: number;
  totalWinningTrades: number;
  totalLosingTrades: number;
  overallWinRate: number;
  bestPerformingCoin: { symbol: string; roi: number; profitUsdt: number };
  worstPerformingCoin: { symbol: string; roi: number; profitUsdt: number };
  coinsRanked: {
    symbol: string;
    winRate: number;
    totalTrades: number;
    netReturnPercent: number;
    netProfitUsdt: number;
    finalBalance: number;
    profitFactor: number;
    maxDrawdownPercent: number;
  }[];
}

export interface AutoBotConfig {
  enabled: boolean;
  enabledAt?: number;
  timeframe?: BotTimeframe; // 'AUTO' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'
  tradeAllocationPercent: number; // e.g. 20% of wallet balance per trade
  minConfidence: number; // e.g. 75%
  mode: 'SCALE_OUT_REBUY' | 'FULL_RUNNER'; // SCALE_OUT_REBUY = take 50% profit at TP1, move SL to breakeven, rebuy on pullback or hold runner to TP2/TP3
  autoCompound: boolean;
  maxOpenTrades: number;
  // Professional Quantitative Engineer Features:
  marketType?: 'SPOT' | 'FUTURES'; // Spot vs USDT-M Futures
  leverage?: number; // 1x to 50x (e.g. 10x)
  marginMode?: 'ISOLATED' | 'CROSS'; // Margin mode
  trailingStopEnabled?: boolean;
  trailingStopPercent?: number; // e.g. 1.2%
  trailingActivationProfitPercent?: number; // e.g. +1.5% profit before trailing activates
  maxSlippageSpreadPercent?: number; // Slippage & Spread protection limit
  trailingTakeProfitEnabled?: boolean; // Trailing Take Profit (TTP)
  trailingTakeProfitDeviationPercent?: number; // TTP deviation % before execution
  dailyDrawdownLimitPercent?: number; // Circuit breaker e.g. 5% max daily loss
  circuitBreakerTripped?: boolean;
  circuitBreakerTrippedAt?: number;
  circuitBreakerResetAt?: number;
  sizingMode?: 'FIXED_PERCENT' | 'RISK_BASED'; // Fixed % vs Fixed $ risk per SL distance
  riskPerTradePercent?: number; // e.g. 1.5% - 2% risk of equity per trade
  cooldownMinutes?: number; // Minimum wait after closing before re-entering same symbol
  allowedSymbols?: string[]; // Whitelist of symbols to monitor and trade
  multiPairScanning?: boolean; // Autonomous scanning across top watchlist symbols
  autoAdaptiveStrategy?: boolean; // AI reads market regime in real-time and auto-matches optimal strategy
  activePresets?: ('MOMENTUM' | 'SCALPER' | 'SWING' | 'BREAKOUT' | 'MEAN_REVERSION' | 'INSTITUTIONAL_SMC')[]; // Currently selected presets in UI
}

export interface ActiveBotPosition {
  id: string;
  symbol: string;
  decision: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  initialAmountUsdt: number; // Margin deposited (USDT)
  remainingAmountUsdt: number; // Remaining margin (USDT)
  initialAmountBtc: number; // Contracts / Base crypto amount
  remainingAmountBtc: number;
  tp1: number;
  tp2: number;
  tp3: number;
  stopLoss: number;
  initialStopLoss: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  rebuysCount: number;
  openedAt: number;
  lastAction: string;
  strategyName?: string;
  strategyId?: string;
  strategyStatus?: 'ACTIVE' | 'INACTIVE';
  realizedPnlUsdt: number;
  pnlHistory: number[];
  mode?: 'PAPER' | 'BINANCE_LIVE';
  // Futures / Leverage Mechanics
  marketType?: 'SPOT' | 'FUTURES';
  leverage?: number; // e.g. 10x
  marginMode?: 'ISOLATED' | 'CROSS';
  marginUsdt?: number; // Initial/Current active margin
  positionSizeUsdt?: number; // Total leveraged notional value (Margin * Leverage)
  liquidationPrice?: number; // Bankruptcy / Liquidation price
  // Trailing stop tracking
  peakPrice?: number;
  isTrailingActive?: boolean;
  trailingStopPrice?: number;
  isTtpActive?: boolean;
  ttpPeakPrice?: number;
  ttpTargetType?: 'TP1' | 'TP2' | 'TP3';
}

export interface AutoTradeLog {
  id: string;
  timestamp: number;
  type: 'AUTO_BUY' | 'AUTO_SELL_TP1' | 'AUTO_SELL_TP2' | 'AUTO_SELL_TP3' | 'AUTO_REBUY' | 'AUTO_SL' | 'AUTO_TRAILING_SL' | 'AUTO_LIQUIDATION' | 'CIRCUIT_BREAKER' | 'PANIC_CLOSE_ALL' | 'TRADE_BLOCKED' | 'STRATEGY_AUDIT' | 'ENTRY';
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  amountUsdt: number;
  marginUsdt?: number;
  pnlUsdt?: number;
  pnlPercent?: number;
  reason: string;
  mode?: 'PAPER' | 'BINANCE_LIVE';
  marketType?: 'SPOT' | 'FUTURES';
  leverage?: number;
  strategyId?: string;
  strategyName?: string;
}

export interface PaperTradePosition {
  id: string;
  symbol?: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  amountBtc: number;
  entryTime: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
}

export interface PaperTradeClosedRecord {
  id: string;
  symbol?: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  pnlUsdt: number;
  pnlPercent: number;
  time: number;
}

export interface PaperWallet {
  balance: number;
  realizedPnl: number;
  openPosition: PaperTradePosition | null;
  history: PaperTradeClosedRecord[];
}

export type TradingExecutionMode = 'PAPER' | 'BINANCE_LIVE';

export interface BinanceAccountBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  estimatedUsdtValue?: number;
}

export interface BinanceAccountInfo {
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  accountType: string;
  makerCommission: number;
  takerCommission: number;
  updateTime: number;
  balances: BinanceAccountBalance[];
  totalUsdtEquity: number;
  freeUsdt: number;
}

export interface BinanceApiConfig {
  apiKey: string;
  apiSecret: string;
  useTestnet: boolean;
  marketType?: 'SPOT' | 'FUTURES';
  isLiveModeEnabled: boolean;
  isConnected: boolean;
  lastConnectedAt?: number;
  latencyMs?: number;
  accountInfo?: BinanceAccountInfo | null;
  autoTradingEnabled: boolean;
}

export interface BinanceOrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  marketType?: 'SPOT' | 'FUTURES';
  quantity?: number;
  quoteOrderQty?: number;
  price?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface BinanceOrderResponse {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  timeInForce: string;
  type: string;
  side: 'BUY' | 'SELL';
  fills?: {
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
    tradeId: number;
  }[];
}

export interface BinanceOpenOrder {
  symbol: string;
  orderId: number;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  type: string;
  side: 'BUY' | 'SELL';
  time: number;
}

// =====================================================
// QUANTURA RISK MANAGEMENT ENGINE TYPES
// =====================================================

export type RiskLockStatus = 'NORMAL' | 'WARNING' | 'RESTRICTED' | 'LOCKED' | 'EMERGENCY';
export type VolatilityRegime = 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';

export type RejectionCode =
  | 'RISK_LOCK_ACTIVE'
  | 'EMERGENCY_STOP_ACTIVE'
  | 'DAILY_LOSS_LIMIT'
  | 'MAX_DRAWDOWN'
  | 'CONSECUTIVE_LOSS_STREAK'
  | 'EXCESSIVE_RISK_PER_TRADE'
  | 'EXCESSIVE_PORTFOLIO_RISK'
  | 'MAX_LEVERAGE_EXCEEDED'
  | 'MAX_SYMBOL_EXPOSURE_EXCEEDED'
  | 'MAX_TOTAL_EXPOSURE_EXCEEDED'
  | 'MAX_OPEN_POSITIONS'
  | 'MAX_POSITIONS_PER_SYMBOL'
  | 'HIGH_CORRELATION'
  | 'INSUFFICIENT_EQUITY'
  | 'INSUFFICIENT_MARGIN'
  | 'MISSING_STOP_LOSS'
  | 'INVALID_STOP_LOSS'
  | 'STOP_LOSS_TOO_TIGHT'
  | 'STOP_LOSS_TOO_WIDE'
  | 'LOW_RISK_REWARD'
  | 'ANTI_MARTINGALE_VIOLATION'
  | 'EXCESSIVE_SPREAD'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'EXCESSIVE_SLIPPAGE'
  | 'EXTREME_VOLATILITY'
  | 'UNCERTAIN_MARKET_REGIME'
  | 'INVALID_PRICE'
  | 'STALE_MARKET_DATA'
  | 'ORDER_SIZE_TOO_SMALL'
  | 'ORDER_SIZE_TOO_LARGE'
  | 'DUPLICATE_ORDER'
  | 'SYSTEM_ERROR';

export interface FrontendRiskEngineConfig {
  riskPerTradePercent: number;
  maxDailyLossPercent: number;
  maxDrawdownPercent: number;
  maxOpenPositions: number;
  maxAllowedLeverage: number;
  minRiskRewardRatio: number;
  maxPortfolioRiskPercent: number;
  maxSymbolExposurePercent: number;
  maxTotalExposurePercent: number;
  maxCorrelatedClusterExposurePercent: number;
  antiMartingaleEnabled: boolean;
  emergencyStop: boolean;
  riskLockStatus: RiskLockStatus;
  riskLockReason?: string;
  riskLockTimestamp?: number;
}

export interface RiskEngineMetrics {
  currentEquity: number;
  peakEquity: number;
  dailyLossUsdt: number;
  dailyLossPercent: number;
  maxDailyLossPercent: number;
  currentDrawdownUsdt: number;
  currentDrawdownPercent: number;
  maxDrawdownPercent: number;
  consecutiveLosses: number;
  currentPortfolioRiskPercent: number;
  maxPortfolioRiskPercent: number;
  totalExposureUsdt: number;
  totalExposurePercent: number;
  openPositionsCount: number;
  riskScore: number;
  riskLevel: RiskLevel;
  riskLockStatus: RiskLockStatus;
  riskLockReason?: string;
  emergencyStop: boolean;
}

export interface RiskEvaluationResult {
  decision: 'APPROVED' | 'REJECTED';
  reasonCode?: RejectionCode;
  message: string;
  riskScore: number;
  riskLevel: RiskLevel;
  approvedQuantity: number;
  approvedMarginUsdt: number;
  approvedLeverage: number;
  approvedStopLoss: number;
  effectiveRiskAmountUsdt: number;
  effectiveRiskPercent: number;
  riskRewardRatio: number;
  estimatedSlippagePercent: number;
  spreadPercent: number;
  volatilityRegime: VolatilityRegime;
  marketRegime: MarketRegime;
  auditId?: string;
}

export interface RiskAuditLogEntry {
  auditId: string;
  id?: string;
  timestamp: number;
  decision: 'APPROVED' | 'REJECTED';
  symbol: string;
  side: 'LONG' | 'SHORT';
  marketType: 'SPOT' | 'FUTURES';
  strategyName?: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit1?: number;
  takeProfit2?: number;
  takeProfit3?: number;
  requestedQuantity?: number;
  approvedQuantity?: number;
  requestedLeverage?: number;
  approvedLeverage?: number;
  riskAmountUsdt: number;
  riskPercent: number;
  riskRewardRatio: number;
  portfolioRiskPercent: number;
  riskScore: number;
  riskLevel: RiskLevel;
  rejectionCode?: RejectionCode;
  rejectionReason?: string;
  accountEquity: number;
  availableBalance: number;
  drawdownPercent: number;
  dailyLossPercent: number;
  volatilityRegime?: VolatilityRegime;
}export interface AIStatusInfo {
  status: string;
  provider: 'gemini' | 'qwen' | 'deterministic';
  geminiConfigured: boolean;
  qwenConfigured: boolean;
  activeModel: string;
}

