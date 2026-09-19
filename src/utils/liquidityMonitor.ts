import { OrderBookSummary, BinanceTicker, AIAnalysisResult, LiquidityHealthAssessment, AutoBotConfig } from '../types';

export interface LiquidityMonitorInput {
  symbol: string;
  orderBook: OrderBookSummary | null;
  ticker: BinanceTicker | null;
  activeSignal: AIAnalysisResult | null;
  botConfig?: AutoBotConfig;
  accountEquity?: number;
  userPositionSizeUsdt?: number;
}

/**
 * Liquidity Monitor Utility
 * Cross-references Order Book L2 Depth with 24h & hourly trade volume
 * to evaluate if the pair's market depth can sustain the calculated position size
 * without triggering severe execution slippage.
 */
export class LiquidityMonitor {
  /**
   * Evaluates liquidity depth and slippage impact
   */
  public static evaluateLiquidity(input: LiquidityMonitorInput): LiquidityHealthAssessment {
    const {
      symbol,
      orderBook,
      ticker,
      activeSignal,
      botConfig,
      accountEquity = 1000,
      userPositionSizeUsdt,
    } = input;

    const currentPrice = ticker?.price || activeSignal?.currentPrice || 1;
    const volume24hUsdt = ticker?.quoteVolume24h || (ticker?.volume24h ? ticker.volume24h * currentPrice : 5000000);
    const hourlyVolumeUsdt = volume24hUsdt / 24;

    // 1. Calculate Target Position Size (USDT)
    let calculatedPositionUsdt = 0;
    if (userPositionSizeUsdt && userPositionSizeUsdt > 0) {
      calculatedPositionUsdt = userPositionSizeUsdt;
    } else {
      const leverage = botConfig?.leverage || (botConfig?.marketType === 'FUTURES' ? 3 : 1);
      const allocationPercent = botConfig?.tradeAllocationPercent || 25;
      const marginUsdt = accountEquity * (allocationPercent / 100);
      calculatedPositionUsdt = marginUsdt * leverage;
    }

    if (calculatedPositionUsdt <= 0) {
      calculatedPositionUsdt = 250; // default benchmark
    }

    const calculatedQuantity = calculatedPositionUsdt / currentPrice;

    // 2. Evaluate Order Book Depth
    const isLong = activeSignal ? activeSignal.decision === 'LONG' : true;
    const bids = orderBook?.topBids || [];
    const asks = orderBook?.topAsks || [];

    // If BUY (Long), we consume Ask liquidity. If SELL (Short), we consume Bid liquidity.
    const relevantLevels = isLong ? asks : bids;
    const availableDepthUsdt = relevantLevels.reduce((sum, lvl) => sum + (lvl.price * lvl.qty), 0);

    // 3. Bid-Ask Spread Calculation
    let spreadPercent = 0.05;
    if (bids.length > 0 && asks.length > 0) {
      const bestBid = bids[0].price;
      const bestAsk = asks[0].price;
      if (bestBid > 0 && bestAsk > bestBid) {
        spreadPercent = ((bestAsk - bestBid) / bestBid) * 100;
      }
    }

    // 4. Walk the Book to Simulate Real Execution Slippage
    let simulatedSlippagePercent = 0.04;
    let filledUsdt = 0;
    let weightedFilledCost = 0;
    let remainingUsdt = calculatedPositionUsdt;

    if (relevantLevels.length > 0) {
      for (const level of relevantLevels) {
        const levelUsd = level.price * level.qty;
        if (remainingUsdt <= levelUsd) {
          const qtyFilled = remainingUsdt / level.price;
          weightedFilledCost += remainingUsdt;
          filledUsdt += remainingUsdt;
          remainingUsdt = 0;
          break;
        } else {
          weightedFilledCost += levelUsd;
          filledUsdt += levelUsd;
          remainingUsdt -= levelUsd;
        }
      }

      if (filledUsdt > 0) {
        const avgExecPrice = (weightedFilledCost / (filledUsdt / currentPrice));
        simulatedSlippagePercent = Math.abs((avgExecPrice - currentPrice) / currentPrice) * 100;
      }

      // If position size exhausts the entire top order book
      if (remainingUsdt > 0) {
        const unmetRatio = remainingUsdt / calculatedPositionUsdt;
        simulatedSlippagePercent += unmetRatio * 1.5; // Heavy slippage penalty for clearing book
      }
    } else {
      // Conservative estimate based on 24h volume
      const marketImpact = (calculatedPositionUsdt / Math.max(10000, hourlyVolumeUsdt)) * 10;
      simulatedSlippagePercent = Math.min(3.0, 0.05 + marketImpact);
    }

    // Include spread in total expected slippage cost
    const totalExpectedSlippage = Math.max(0.01, Math.round((simulatedSlippagePercent + (spreadPercent * 0.5)) * 1000) / 1000);

    // 5. Ratios
    const depthRatio = availableDepthUsdt > 0 ? availableDepthUsdt / calculatedPositionUsdt : 1.0;
    const volumeRatio = hourlyVolumeUsdt > 0 ? (calculatedPositionUsdt / hourlyVolumeUsdt) * 100 : 0.1;

    // 6. Thresholds & Status Assessment
    // Safe standard: Available L2 Depth should ideally be at least 3.0x - 5.0x the order size,
    // and estimated slippage must not exceed 0.25% - 0.50%.
    const warnings: string[] = [];
    let status: LiquidityHealthAssessment['status'] = 'EXCELLENT';
    let slippageRisk: LiquidityHealthAssessment['slippageRisk'] = 'LOW';
    let suggestedAction = 'Depth is robust. Position size can be filled with minimal slippage.';

    // Safe recommended max size based on 30% of immediately available L2 book depth
    const recommendedMaxSizeUsdt = Math.max(20, Math.round(availableDepthUsdt * 0.35));

    if (totalExpectedSlippage >= 1.2 || depthRatio < 0.6 || remainingUsdt > 0) {
      status = 'CRITICAL_ILLIQUID';
      slippageRisk = 'EXTREME';
      warnings.push(`Extreme market slippage warning: Order will eat past L2 depth ($${availableDepthUsdt.toFixed(0)} available vs $${calculatedPositionUsdt.toFixed(0)} requested).`);
      warnings.push(`Simulated slippage is ${totalExpectedSlippage.toFixed(2)}%, threatening entry zone and stop-loss bounds.`);
      suggestedAction = `Reduce position size to max $${recommendedMaxSizeUsdt} USDT or split order via TWAP/limit orders to avoid severe market impact.`;
    } else if (totalExpectedSlippage >= 0.45 || depthRatio < 1.5) {
      status = 'INSUFFICIENT';
      slippageRisk = 'HIGH';
      warnings.push(`Order book depth is thin (${depthRatio.toFixed(1)}x coverage). Expected slippage is ${totalExpectedSlippage.toFixed(2)}%.`);
      suggestedAction = `Cap position size to $${recommendedMaxSizeUsdt} USDT or lower leverage to mitigate execution drag.`;
    } else if (totalExpectedSlippage >= 0.20 || depthRatio < 3.0 || spreadPercent > 0.12) {
      status = 'MODERATE';
      slippageRisk = 'MEDIUM';
      warnings.push(`Moderate liquidity: Depth coverage is ${depthRatio.toFixed(1)}x, spread is ${(spreadPercent * 100).toFixed(0)} bps.`);
      suggestedAction = `Acceptable for trading, but monitor fill price against ideal entry.`;
    } else if (depthRatio >= 5.0 && totalExpectedSlippage <= 0.08) {
      status = 'EXCELLENT';
      slippageRisk = 'LOW';
      suggestedAction = `Deep institutional liquidity with tight ${(spreadPercent * 100).toFixed(0)} bps spread. Ideal for immediate execution.`;
    } else {
      status = 'SUFFICIENT';
      slippageRisk = 'LOW';
      suggestedAction = `Normal liquidity conditions. Slippage expected below ${totalExpectedSlippage.toFixed(2)}%.`;
    }

    if (spreadPercent > 0.25) {
      warnings.push(`Wide bid-ask spread: ${spreadPercent.toFixed(3)}% between top of book.`);
    }

    if (volumeRatio > 5.0) {
      warnings.push(`Position size represents ${volumeRatio.toFixed(1)}% of total hourly trading volume.`);
    }

    return {
      symbol: symbol.toUpperCase(),
      timestamp: Date.now(),
      currentPrice,
      calculatedPositionUsdt: Math.round(calculatedPositionUsdt),
      calculatedQuantity: Number(calculatedQuantity.toFixed(4)),
      availableDepthUsdt: Math.round(availableDepthUsdt),
      depthRatio: Number(depthRatio.toFixed(2)),
      estimatedSlippagePercent: totalExpectedSlippage,
      spreadPercent: Number(spreadPercent.toFixed(3)),
      tradeVolume24hUsdt: Math.round(volume24hUsdt),
      volumeRatio: Number(volumeRatio.toFixed(2)),
      status,
      slippageRisk,
      recommendedMaxSizeUsdt,
      warnings,
      suggestedAction,
    };
  }
}
