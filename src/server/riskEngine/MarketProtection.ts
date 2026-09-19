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

    // 6. Slippage & Liquidity Depth Calculation & Protection
    let estimatedSlippagePercent = 0.05;
    let depthCoverageRatio = 5.0;

    if (input.orderBook && input.orderBook.topBids.length > 0 && input.orderBook.topAsks.length > 0) {
      const bestBid = input.orderBook.topBids[0].price;
      const bestAsk = input.orderBook.topAsks[0].price;
      const bookSpread = bestBid > 0 ? ((bestAsk - bestBid) / bestBid) * 100 : 0.05;

      // Calculate total available liquidity depth in top of book
      const topAskVolume = input.orderBook.topAsks.reduce((sum, item) => sum + (item.price * item.amount), 0);
      const topBidVolume = input.orderBook.topBids.reduce((sum, item) => sum + (item.price * item.amount), 0);
      const availableDepthUsdt = topAskVolume > 0 ? topAskVolume : topBidVolume;

      depthCoverageRatio = notionalValueUsdt > 0 && availableDepthUsdt > 0
        ? availableDepthUsdt / notionalValueUsdt
        : 5.0;

      // Realistic order book fill simulation (walk the book)
      let remainingUsdt = notionalValueUsdt;
      let filledUsdt = 0;
      let weightedPriceSum = 0;
      const levels = input.orderBook.topAsks;

      for (const lvl of levels) {
        const lvlUsd = lvl.price * lvl.amount;
        if (remainingUsdt <= lvlUsd) {
          weightedPriceSum += remainingUsdt;
          filledUsdt += remainingUsdt;
          remainingUsdt = 0;
          break;
        } else {
          weightedPriceSum += lvlUsd;
          filledUsdt += lvlUsd;
          remainingUsdt -= lvlUsd;
        }
      }

      let simulatedBookSlippage = 0.04;
      if (filledUsdt > 0) {
        const avgExecPrice = weightedPriceSum / (filledUsdt / input.currentPrice);
        simulatedBookSlippage = Math.abs((avgExecPrice - input.currentPrice) / input.currentPrice) * 100;
      }

      // If the order size exceeds the entire visible order book depth
      if (remainingUsdt > 0) {
        const unmetRatio = remainingUsdt / Math.max(1, notionalValueUsdt);
        simulatedBookSlippage += unmetRatio * 1.5; // Heavy slippage penalty for clearing book
      }

      estimatedSlippagePercent = Math.max(0.02, simulatedBookSlippage + (bookSpread * 0.5));

      // Liquidity Depth Check: Reject if available depth cannot sustain position size (coverage < 0.6x)
      if (depthCoverageRatio < 0.60 || remainingUsdt > 0) {
        return {
          isValid: false,
          reasonCode: 'INSUFFICIENT_LIQUIDITY',
          message: `Order book depth ($${availableDepthUsdt.toFixed(0)} USDT) is insufficient to sustain requested position size ($${notionalValueUsdt.toFixed(0)} USDT). Coverage: ${depthCoverageRatio.toFixed(2)}x. Trade blocked to prevent severe slippage.`,
          spreadPercent,
          estimatedSlippagePercent,
          volatilityRegime,
          marketRegime: input.marketRegime || 'TRENDING',
          atrPercent,
        };
      }
    } else if (input.atr14) {
      // ATR proxy
      const atrRatio = (input.atr14 / input.currentPrice) * 100;
      estimatedSlippagePercent = Math.min(1.0, Math.max(0.03, atrRatio * 0.12));
    }

    if (estimatedSlippagePercent > config.maxSlippagePercent) {
      return {
        isValid: false,
        reasonCode: 'EXCESSIVE_SLIPPAGE',
        message: `Estimated market slippage (${estimatedSlippagePercent.toFixed(3)}%) exceeds configured maximum allowed (${config.maxSlippagePercent}%). Insufficient order book depth for execution.`,
        spreadPercent,
        estimatedSlippagePercent,
        volatilityRegime,
        marketRegime: input.marketRegime || 'UNCERTAIN',
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
