import { RiskEngineConfig, SymbolTradingRules } from './types';

export const DEFAULT_RISK_CONFIG: RiskEngineConfig = {
  riskPerTradePercent: 0.5, // 0.5% default as specified
  maxDailyLossPercent: 3.0, // 3% hard daily loss limit
  maxAccountDrawdownPercent: 10.0, // 10% maximum account drawdown
  maxPortfolioRiskPercent: 3.0, // 3% maximum portfolio risk across all positions
  maxTotalExposurePercent: 200.0, // 200% notional exposure cap for futures, 100% for spot
  maxSymbolExposurePercent: 20.0, // 20% single symbol exposure cap
  maxCorrelationExposurePercent: 35.0, // 35% correlated cluster exposure cap
  maxOpenPositions: 5, // Maximum 5 simultaneous open positions
  maxPositionsPerSymbol: 1, // Single position per symbol (strict anti-pyramiding)
  maxAllowedLeverage: 10, // Max 10x leverage for futures
  minRiskRewardRatio: 2.0, // Minimum 1:2 Risk/Reward ratio
  maxSlippagePercent: 0.5, // Max 0.5% expected slippage
  maxSpreadPercent: 0.25, // Max 0.25% bid-ask spread
  min24hVolumeUsdt: 5000000, // Minimum $5M 24h volume
  
  consecutiveLossStreakReduce50: 3, // 3 consecutive losses: reduce risk by 50%
  consecutiveLossStreakPause: 5, // 5 consecutive losses: pause new trades
  consecutiveLossStreakLock: 10, // 10 consecutive losses: activate hard risk lock
  
  strategyRiskBudgets: {
    'Scalper': 1.0,
    'Momentum': 1.5,
    'Swing': 1.5,
    'Breakout': 1.0,
    'Mean Reversion': 0.5,
    'Custom': 1.0,
  },
  
  emergencyStop: false,
  riskLockStatus: 'NORMAL',
};

export const SYMBOL_RULES: Record<string, SymbolTradingRules> = {
  BTCUSDT: {
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    tickSize: 0.1,
    stepSize: 0.001,
    minQty: 0.001,
    maxQty: 1000,
    minNotional: 5,
    maxLeverage: 10, // Institutional cap
    takerFeeRate: 0.0005, // 0.05%
    makerFeeRate: 0.0002,
    estimatedFundingRate: 0.0001,
  },
  ETHUSDT: {
    symbol: 'ETHUSDT',
    baseAsset: 'ETH',
    quoteAsset: 'USDT',
    tickSize: 0.01,
    stepSize: 0.01,
    minQty: 0.01,
    maxQty: 5000,
    minNotional: 5,
    maxLeverage: 10,
    takerFeeRate: 0.0005,
    makerFeeRate: 0.0002,
    estimatedFundingRate: 0.0001,
  },
  SOLUSDT: {
    symbol: 'SOLUSDT',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    tickSize: 0.01,
    stepSize: 0.1,
    minQty: 0.1,
    maxQty: 20000,
    minNotional: 5,
    maxLeverage: 10,
    takerFeeRate: 0.0005,
    makerFeeRate: 0.0002,
    estimatedFundingRate: 0.00015,
  },
  BNBUSDT: {
    symbol: 'BNBUSDT',
    baseAsset: 'BNB',
    quoteAsset: 'USDT',
    tickSize: 0.01,
    stepSize: 0.01,
    minQty: 0.01,
    maxQty: 10000,
    minNotional: 5,
    maxLeverage: 10,
    takerFeeRate: 0.0005,
    makerFeeRate: 0.0002,
  },
  XRPUSDT: {
    symbol: 'XRPUSDT',
    baseAsset: 'XRP',
    quoteAsset: 'USDT',
    tickSize: 0.0001,
    stepSize: 1,
    minQty: 1,
    maxQty: 1000000,
    minNotional: 5,
    maxLeverage: 10,
    takerFeeRate: 0.0005,
    makerFeeRate: 0.0002,
  },
  AVAXUSDT: {
    symbol: 'AVAXUSDT',
    baseAsset: 'AVAX',
    quoteAsset: 'USDT',
    tickSize: 0.01,
    stepSize: 0.1,
    minQty: 0.1,
    maxQty: 50000,
    minNotional: 5,
    maxLeverage: 10,
    takerFeeRate: 0.0005,
    makerFeeRate: 0.0002,
  },
  LINKUSDT: {
    symbol: 'LINKUSDT',
    baseAsset: 'LINK',
    quoteAsset: 'USDT',
    tickSize: 0.001,
    stepSize: 0.1,
    minQty: 0.1,
    maxQty: 50000,
    minNotional: 5,
    maxLeverage: 10,
    takerFeeRate: 0.0005,
    makerFeeRate: 0.0002,
  },
  NEARUSDT: {
    symbol: 'NEARUSDT',
    baseAsset: 'NEAR',
    quoteAsset: 'USDT',
    tickSize: 0.001,
    stepSize: 0.1,
    minQty: 0.1,
    maxQty: 100000,
    minNotional: 5,
    maxLeverage: 10,
    takerFeeRate: 0.0005,
    makerFeeRate: 0.0002,
  },
  SUIUSDT: {
    symbol: 'SUIUSDT',
    baseAsset: 'SUI',
    quoteAsset: 'USDT',
    tickSize: 0.0001,
    stepSize: 1,
    minQty: 1,
    maxQty: 100000,
    minNotional: 5,
    maxLeverage: 10,
    takerFeeRate: 0.0005,
    makerFeeRate: 0.0002,
  },
  DOGEUSDT: {
    symbol: 'DOGEUSDT',
    baseAsset: 'DOGE',
    quoteAsset: 'USDT',
    tickSize: 0.00001,
    stepSize: 1,
    minQty: 1,
    maxQty: 5000000,
    minNotional: 5,
    maxLeverage: 10,
    takerFeeRate: 0.0005,
    makerFeeRate: 0.0002,
  },
};

export const DEFAULT_SYMBOL_RULE: SymbolTradingRules = {
  symbol: 'GENERIC',
  baseAsset: 'COIN',
  quoteAsset: 'USDT',
  tickSize: 0.0001,
  stepSize: 0.1,
  minQty: 0.1,
  maxQty: 100000,
  minNotional: 5,
  maxLeverage: 10,
  takerFeeRate: 0.0005,
  makerFeeRate: 0.0002,
  estimatedFundingRate: 0.0001,
};

/**
 * Empirical Crypto Asset Correlation Matrix
 * Values between -1.0 and +1.0
 */
export const ASSET_CORRELATION_MATRIX: Record<string, Record<string, number>> = {
  BTCUSDT: {
    BTCUSDT: 1.0,
    ETHUSDT: 0.88,
    SOLUSDT: 0.82,
    BNBUSDT: 0.78,
    AVAXUSDT: 0.80,
    LINKUSDT: 0.79,
    NEARUSDT: 0.77,
    SUIUSDT: 0.74,
    XRPUSDT: 0.65,
    DOGEUSDT: 0.70,
  },
  ETHUSDT: {
    BTCUSDT: 0.88,
    ETHUSDT: 1.0,
    SOLUSDT: 0.85,
    BNBUSDT: 0.80,
    AVAXUSDT: 0.83,
    LINKUSDT: 0.84,
    NEARUSDT: 0.81,
    SUIUSDT: 0.76,
    XRPUSDT: 0.68,
    DOGEUSDT: 0.72,
  },
  SOLUSDT: {
    BTCUSDT: 0.82,
    ETHUSDT: 0.85,
    SOLUSDT: 1.0,
    BNBUSDT: 0.75,
    AVAXUSDT: 0.86,
    LINKUSDT: 0.80,
    NEARUSDT: 0.84,
    SUIUSDT: 0.82,
    XRPUSDT: 0.62,
    DOGEUSDT: 0.75,
  },
  BNBUSDT: {
    BTCUSDT: 0.78,
    ETHUSDT: 0.80,
    SOLUSDT: 0.75,
    BNBUSDT: 1.0,
    AVAXUSDT: 0.74,
    LINKUSDT: 0.75,
    NEARUSDT: 0.72,
    SUIUSDT: 0.70,
    XRPUSDT: 0.60,
    DOGEUSDT: 0.65,
  },
  AVAXUSDT: {
    BTCUSDT: 0.80,
    ETHUSDT: 0.83,
    SOLUSDT: 0.86,
    BNBUSDT: 0.74,
    AVAXUSDT: 1.0,
    LINKUSDT: 0.82,
    NEARUSDT: 0.85,
    SUIUSDT: 0.80,
    XRPUSDT: 0.64,
    DOGEUSDT: 0.73,
  },
  LINKUSDT: {
    BTCUSDT: 0.79,
    ETHUSDT: 0.84,
    SOLUSDT: 0.80,
    BNBUSDT: 0.75,
    AVAXUSDT: 0.82,
    LINKUSDT: 1.0,
    NEARUSDT: 0.78,
    SUIUSDT: 0.73,
    XRPUSDT: 0.65,
    DOGEUSDT: 0.68,
  },
};

export const getCorrelation = (sym1: string, sym2: string): number => {
  const s1 = sym1.toUpperCase();
  const s2 = sym2.toUpperCase();
  if (s1 === s2) return 1.0;
  if (ASSET_CORRELATION_MATRIX[s1] && ASSET_CORRELATION_MATRIX[s1][s2] !== undefined) {
    return ASSET_CORRELATION_MATRIX[s1][s2];
  }
  if (ASSET_CORRELATION_MATRIX[s2] && ASSET_CORRELATION_MATRIX[s2][s1] !== undefined) {
    return ASSET_CORRELATION_MATRIX[s2][s1];
  }
  // Baseline crypto correlation default
  return 0.70;
};
