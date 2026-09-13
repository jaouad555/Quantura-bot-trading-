import { MarketProtectionInput, RejectionCode, RiskEngineConfig, VolatilityRegime, MarketRegime } from './types';

export interface MarketProtectionEvaluation {
  isValid: boolean;
  reasonCode?: RejectionCode;
  message?: string;
  spreadPercent: number;
  estimatedSlippagePercent: number;
  volatilityRegime: VolatilityRegime;
  marketRegime: MarketRegime;
  atrPercent: number;
}

export class MarketProtection {
  /**
   * Validate market data freshness, price validity, spread, liquidity, slippage, and volatility
   */
  public static evaluateMarket(
    input: MarketProtectionInput | undefined,
    notionalValueUsdt: number,
    config: RiskEngineConfig
  ): MarketProtectionEvaluation {
    // 1. Fail-safe: Check if market data exists
    if (!input || !input.currentPrice || isNaN(input.currentPrice) || input.currentPrice <= 0 || !isFinite(input.currentPrice)) {
      return {
        isValid: false,
        reasonCode: 'INVALID_PRICE',
        message: 'Invalid or missing current market price.',
        spreadPercent: 0,
        estimatedSlippagePercent: 0,
        volatilityRegime: 'NORMAL',
        marketRegime: 'UNCERTAIN',
        atrPercent: 0,
      };
    }

    // 2. Freshness check (within 15 seconds)
    const now = Date.now();
    if (input.timestamp && Math.abs(now - input.timestamp) > 20000) {
      const ageSeconds = Math.round(Math.abs(now - input.timestamp) / 1000);
      return {
        isValid: false,
        reasonCode: 'STALE_MARKET_DATA',
        message: `Market data is stale (${ageSeconds}s old > 20s limit). Cannot execute on outdated quotes.`,
        spreadPercent: 0,
        estimatedSlippagePercent: 0,
        volatilityRegime: 'NORMAL',
        marketRegime: 'UNCERTAIN',
        atrPercent: 0,
      };
    }

    // 3. Spread Protection
    let spreadPercent = 0.05; // default benchmark
    if (input.bidPrice && input.askPrice && input.bidPrice > 0 && input.askPrice > 0) {
      spreadPercent = ((input.askPrice - input.bidPrice) / input.bidPrice) * 100;
      if (spreadPercent > config.maxSpreadPercent) {
        return {
          isValid: false,
          reasonCode: 'EXCESSIVE_SPREAD',
          message: `Bid-Ask spread is excessive (${spreadPercent.toFixed(3)}% > limit ${config.maxSpreadPercent}%). Trading blocked to protect against illiquidity.`,
          spreadPercent,
          estimatedSlippagePercent: 0,
          volatilityRegime: 'NORMAL',
          marketRegime: 'UNCERTAIN',
          atrPercent: 0,
        };
      }
    }

    // 4. Liquidity & 24h Volume Protection
    if (input.volume24hUsdt && input.volume24hUsdt < config.min24hVolumeUsdt) {
      return {
        isValid: false,
        reasonCode: 'INSUFFICIENT_LIQUIDITY',
        message: `24h volume ($${(input.volume24hUsdt / 1e6).toFixed(2)}M) is below minimum threshold of $${(config.min24hVolumeUsdt / 1e6).toFixed(2)}M.`,
        spreadPercent,
        estimatedSlippagePercent: 0,
        volatilityRegime: 'NORMAL',
        marketRegime: 'UNCERTAIN',
        atrPercent: 0,
      };
    }

    // 5. Volatility Classification
    let atrPercent = 1.5;
    if (input.atr14 && input.currentPrice > 0) {
      atrPercent = (input.atr14 / input.currentPrice) * 100;
    } else if (input.historicalVolatility) {
      atrPercent = input.historicalVolatility;
    }

    let volatilityRegime: VolatilityRegime = 'NORMAL';
    if (atrPercent < 0.8) {
      volatilityRegime = 'LOW';
    } else if (atrPercent <= 3.5) {
      volatilityRegime = 'NORMAL';
    } else if (atrPercent <= 7.0) {
      volatilityRegime = 'HIGH';
    } else {
      volatilityRegime = 'EXTREME';
    }

    if (volatilityRegime === 'EXTREME') {
      return {
        isValid: false,
        reasonCode: 'EXTREME_VOLATILITY',
        message: `Extreme market volatility detected (ATR: ${atrPercent.toFixed(2)}%). All trading is temporarily halted for capital preservation.`,
        spreadPercent,
        estimatedSlippagePercent: 0,
        volatilityRegime,
        marketRegime: input.marketRegime || 'HIGH_VOLATILITY',
        atrPercent,
      };
    }

    // 6. Slippage Calculation & Protection
    let estimatedSlippagePercent = 0.05;
    if (input.orderBook && input.orderBook.topBids.length > 0 && input.orderBook.topAsks.length > 0) {
      const bestBid = input.orderBook.topBids[0].price;
      const bestAsk = input.orderBook.topAsks[0].price;
      const bookSpread = ((bestAsk - bestBid) / bestBid) * 100;
      // Volume impact estimation
      const topAskVolume = input.orderBook.topAsks.reduce((sum, item) => sum + (item.price * item.amount), 0);
      const impactRatio = topAskVolume > 0 ? notionalValueUsdt / topAskVolume : 0.01;
      estimatedSlippagePercent = Math.max(0.02, bookSpread * (1 + impactRatio * 0.5));
    } else if (input.atr14) {
      // ATR proxy
      const atrRatio = (input.atr14 / input.currentPrice) * 100;
      estimatedSlippagePercent = Math.min(1.0, Math.max(0.03, atrRatio * 0.12));
    }

    if (estimatedSlippagePercent > config.maxSlippagePercent) {
      return {
        isValid: false,
        reasonCode: 'EXCESSIVE_SLIPPAGE',
        message: `Estimated market slippage (${estimatedSlippagePercent.toFixed(3)}%) exceeds configured maximum allowed (${config.maxSlippagePercent}%).`,
        spreadPercent,
        estimatedSlippagePercent,
        volatilityRegime,
        marketRegime: 'UNCERTAIN',
        atrPercent,
      };
    }

    // 7. Market Regime Check
    const marketRegime: MarketRegime = input.marketRegime || 'TRENDING';
    if (marketRegime === 'UNCERTAIN') {
      return {
        isValid: false,
        reasonCode: 'UNCERTAIN_MARKET_REGIME',
        message: 'Market regime is currently UNCERTAIN. Trading suspended until a clear trend or range structure develops.',
        spreadPercent,
        estimatedSlippagePercent,
        volatilityRegime,
        marketRegime,
        atrPercent,
      };
    }

    return {
      isValid: true,
      spreadPercent: Number(spreadPercent.toFixed(3)),
      estimatedSlippagePercent: Number(estimatedSlippagePercent.toFixed(3)),
      volatilityRegime,
      marketRegime,
      atrPercent: Number(atrPercent.toFixed(2)),
    };
  }
}
