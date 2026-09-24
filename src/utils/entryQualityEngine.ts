import {
  DecisionType,
  BiasType,
  MarketRegime,
  TechnicalIndicators,
  OrderBookSummary,
  DerivativesData,
  MTFConfluenceData,
  QuantitativeScore,
  EntryQuality,
  EntryQualityStatus,
  EntryTypeCategory,
  Timeframe,
} from '../types';

export interface EntryValidationInput {
  symbol: string;
  timeframe: Timeframe;
  currentPrice: number;
  indicators: TechnicalIndicators;
  quantScore: QuantitativeScore;
  marketRegime: MarketRegime;
  orderBook: OrderBookSummary | null;
  derivatives: DerivativesData | null;
  mtfConfluence: MTFConfluenceData | null;
  isClosedCandle?: boolean;
}

export interface EntryValidationResult {
  decision: DecisionType;
  bias: BiasType;
  entryQuality: EntryQuality;
  entryType: EntryTypeCategory;
  entryZone: {
    min: number;
    max: number;
    ideal: number;
  };
  stopLoss: number;
  targets: {
    tp1: number;
    tp2: number;
    tp3: number;
  };
  riskRewardRatio: number;
  rejectionReason?: string;
  waitReason?: string;
  antiChasePassed: boolean;
  distanceFromIdealPct: number;
  detailedAuditLog: string;
}

/**
 * Helper to round price according to magnitude
 */
export function roundPrice(val: number): number {
  if (val >= 1000) return Math.round(val * 100) / 100;
  if (val >= 50) return Math.round(val * 100) / 100;
  if (val >= 1) return Math.round(val * 1000) / 1000;
  if (val >= 0.01) return Math.round(val * 10000) / 10000;
  if (val >= 0.0001) return Math.round(val * 1000000) / 1000000;
  return Math.round(val * 100000000) / 100000000;
}

/**
 * EntryQualityEngine: Professional Multi-Gate Quantitative Confirmation Pipeline
 * Evaluates whether a proposed directional trade meets all structural, momentum, volume,
 * anti-chase, entry zone, and risk/reward constraints before authorizing an entry.
 */
export class EntryQualityEngine {
  /**
   * Main entry point to evaluate entry quality and determine final execution decision
   */
  public static evaluate(input: EntryValidationInput): EntryValidationResult {
    const {
      symbol,
      timeframe,
      currentPrice,
      indicators,
      quantScore,
      marketRegime,
      orderBook,
      derivatives,
      mtfConfluence,
    } = input;

    const atr = Math.max(indicators?.atr14 || currentPrice * 0.01, currentPrice * 0.004);
    const rsi = indicators?.rsi14 || 50;
    const ema20 = indicators?.ema20 || currentPrice;
    const ema50 = indicators?.ema50 || currentPrice;
    const ema200 = indicators?.ema200 || currentPrice;
    const vwap = indicators?.vwap || currentPrice;
    const ms = indicators?.marketStructure || {
      trend: 'NEUTRAL',
      structure: 'RANGE',
      bos: 'Neutre',
      choch: 'Neutre',
      swingHigh: currentPrice,
      swingLow: currentPrice,
    };

    const { bullishScore, bearishScore, signalStrength } = quantScore;

    // Initial preliminary hypothesis based on score
    let preliminarySide: 'LONG' | 'SHORT' | 'NONE' = 'NONE';
    if (bullishScore >= 64 && bullishScore > bearishScore + 16) {
      preliminarySide = 'LONG';
    } else if (bearishScore >= 64 && bearishScore > bullishScore + 16) {
      preliminarySide = 'SHORT';
    }

    // Default Fallback Values
    const defaultIdeal = roundPrice(currentPrice);
    let entryType: EntryTypeCategory = 'MARKET_ENTRY';
    let entryZone = {
      min: roundPrice(currentPrice - 0.25 * atr),
      max: roundPrice(currentPrice + 0.25 * atr),
      ideal: defaultIdeal,
    };
    let stopLoss = roundPrice(currentPrice * 0.985);
    let targets = {
      tp1: roundPrice(currentPrice * 1.02),
      tp2: roundPrice(currentPrice * 1.035),
      tp3: roundPrice(currentPrice * 1.055),
    };
    let riskRewardRatio = 1.5;
    let antiChasePassed = true;
    let distanceFromIdealPct = 0;

    // If score does not favor any direction, immediately return NO_TRADE / WAIT
    if (preliminarySide === 'NONE') {
      const waitReason = bullishScore >= 52 || bearishScore >= 52
        ? 'Indecisive quantitative score: insufficient directional consensus'
        : 'Market compression: no clear statistical edge';

      const entryQuality: EntryQuality = {
        status: 'WAIT',
        grade: 'D',
        score: signalStrength,
        entryType: 'MARKET_ENTRY',
        rejectionReason: 'INSUFFICIENT_QUANT_SCORE',
        reason: waitReason,
        antiChasePassed: true,
        distanceFromIdealPct: 0,
      };

      const auditLog = this.formatAuditLog({
        symbol,
        timeframe,
        currentPrice,
        signal: 'WAIT',
        bullishScore,
        bearishScore,
        marketRegime,
        trend: ms.trend,
        structure: ms.structure,
        mtf: 'NEUTRAL',
        volume: 'NEUTRAL',
        momentum: `RSI ${rsi.toFixed(1)}`,
        entryZone: `N/A`,
        distanceFromEntry: '0.00%',
        atr,
        sl: 0,
        tp1: 0,
        tp2: 0,
        tp3: 0,
        rr: 0,
        entryQuality: 'WAIT',
        rejectionReason: 'INSUFFICIENT_QUANT_SCORE',
        decision: 'WAIT',
      });

      return {
        decision: 'WAIT',
        bias: bullishScore > bearishScore ? 'BULLISH' : bearishScore > bullishScore ? 'BEARISH' : 'NEUTRAL',
        entryQuality,
        entryType: 'MARKET_ENTRY',
        entryZone,
        stopLoss,
        targets,
        riskRewardRatio: 0,
        waitReason,
        rejectionReason: 'INSUFFICIENT_QUANT_SCORE',
        antiChasePassed: true,
        distanceFromIdealPct: 0,
        detailedAuditLog: auditLog,
      };
    }

    // =========================================================================
    // GATE 1: MARKET REGIME CHECK
    // =========================================================================
    if (marketRegime === 'UNCERTAIN') {
      return this.buildRejectedResult({
        symbol,
        timeframe,
        currentPrice,
        preliminarySide,
        bullishScore,
        bearishScore,
        marketRegime,
        ms,
        rsi,
        atr,
        rejectionReason: 'MARKET_REGIME_UNCERTAIN',
        waitReason: 'Market regime is UNCERTAIN (conflicting volatility/trend signals). Awaiting structural clarity.',
      });
    }

    if (marketRegime === 'HIGH_VOLATILITY' && signalStrength < 78) {
      return this.buildRejectedResult({
        symbol,
        timeframe,
        currentPrice,
        preliminarySide,
        bullishScore,
        bearishScore,
        marketRegime,
        ms,
        rsi,
        atr,
        rejectionReason: 'HIGH_VOLATILITY_CHOP_RISK',
        waitReason: 'High volatility regime detected. Requires higher confluence (signal strength >= 78) to prevent slippage.',
      });
    }

    // =========================================================================
    // GATE 2: TREND & MARKET STRUCTURE CONFLUENCE
    // =========================================================================
    const isEmaBullish = currentPrice >= ema20 && ema20 >= ema50;
    const isEmaBearish = currentPrice <= ema20 && ema20 <= ema50;
    const isMacroBull = currentPrice >= ema200;
    const isMacroBear = currentPrice <= ema200;

    if (preliminarySide === 'LONG') {
      // Reject LONG if trend and structure are strongly bearish
      if (ms.trend === 'DOWNTREND' && ms.structure === 'LOWER_LOW' && !isMacroBull) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'COUNTER_TREND_DOWNTREND',
          waitReason: 'LONG rejected: Market structure is in active DOWNTREND with Lower Lows below EMA200.',
        });
      }
    } else {
      // Reject SHORT if trend and structure are strongly bullish
      if (ms.trend === 'UPTREND' && ms.structure === 'HIGHER_HIGH' && !isMacroBear) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'COUNTER_TREND_UPTREND',
          waitReason: 'SHORT rejected: Market structure is in active UPTREND with Higher Highs above EMA200.',
        });
      }
    }

    // =========================================================================
    // GATE 3: ANTI-CHASE & OVEREXTENSION PROTECTION
    // =========================================================================
    const distFromEma20 = Math.abs(currentPrice - ema20);
    const distFromVwap = Math.abs(currentPrice - vwap);
    const maxAllowedExtensionAtr = marketRegime === 'HIGH_VOLATILITY' ? 2.0 : 1.6;

    if (preliminarySide === 'LONG') {
      // Anti-Chase for LONG:
      // 1. Price is excessively extended above EMA20 (> 1.6 * ATR)
      // 2. RSI is overbought (> 72)
      // 3. Price is extended far above VWAP
      const isOverExtendedEma = distFromEma20 > maxAllowedExtensionAtr * atr && currentPrice > ema20;
      const isRsiOverbought = rsi > 72;
      const isVwapOverextended = distFromVwap > 2.2 * atr && currentPrice > vwap;

      if (isOverExtendedEma || isRsiOverbought || isVwapOverextended) {
        antiChasePassed = false;
        const reason = isRsiOverbought
          ? `Anti-Chase Triggered: RSI (${rsi.toFixed(1)}) is overbought. Wait for cooldown/pullback.`
          : `Anti-Chase Triggered: Price is overextended (+${(distFromEma20 / atr).toFixed(1)}x ATR above EMA20). Avoid buying the top.`;

        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'PRICE_OVEREXTENDED_PUMP',
          waitReason: reason,
          antiChasePassed: false,
        });
      }
    } else {
      // Anti-Chase for SHORT:
      // 1. Price is excessively extended below EMA20 (> 1.6 * ATR)
      // 2. RSI is oversold (< 28)
      // 3. Price is extended far below VWAP
      const isOverExtendedEma = distFromEma20 > maxAllowedExtensionAtr * atr && currentPrice < ema20;
      const isRsiOversold = rsi < 28;
      const isVwapOverextended = distFromVwap > 2.2 * atr && currentPrice < vwap;

      if (isOverExtendedEma || isRsiOversold || isVwapOverextended) {
        antiChasePassed = false;
        const reason = isRsiOversold
          ? `Anti-Chase Triggered: RSI (${rsi.toFixed(1)}) is oversold. Wait for bounce before shorting.`
          : `Anti-Chase Triggered: Price is overextended (-${(distFromEma20 / atr).toFixed(1)}x ATR below EMA20). Avoid shorting the bottom.`;

        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'PRICE_OVEREXTENDED_DUMP',
          waitReason: reason,
          antiChasePassed: false,
        });
      }
    }

    // =========================================================================
    // GATE 4: VOLUME & MOMENTUM CONFIRMATION
    // =========================================================================
    const vol = indicators.volume || 0;
    const volAvg = indicators.volumeAvg20 || 0;
    const macdHist = indicators?.macd?.histogram || 0;
    const hasVolumeSupport = volAvg > 0 ? (vol >= volAvg * 0.75 || vol >= volAvg) : true;

    if (preliminarySide === 'LONG') {
      // Avoid LONG if MACD histogram is deeply negative and expanding downwards
      if (macdHist < -0.004 * currentPrice && rsi < 45) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'BEARISH_MOMENTUM_EXPANSION',
          waitReason: 'LONG rejected: MACD downward momentum expanding with weakening RSI.',
        });
      }
    } else {
      // Avoid SHORT if MACD histogram is strongly positive and expanding upwards
      if (macdHist > 0.004 * currentPrice && rsi > 55) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'BULLISH_MOMENTUM_EXPANSION',
          waitReason: 'SHORT rejected: MACD bullish momentum expanding with rising RSI.',
        });
      }
    }

    // =========================================================================
    // GATE 5: MULTI-TIMEFRAME (MTF) CONFLUENCE
    // =========================================================================
    if (mtfConfluence) {
      if (preliminarySide === 'LONG' && mtfConfluence.bearishCount > mtfConfluence.bullishCount + 1) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'MTF_CONFLUENCE_OPPOSING',
          waitReason: `LONG rejected: Higher timeframes are predominantly BEARISH (${mtfConfluence.bearishCount} vs ${mtfConfluence.bullishCount}).`,
        });
      }
      if (preliminarySide === 'SHORT' && mtfConfluence.bullishCount > mtfConfluence.bearishCount + 1) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'MTF_CONFLUENCE_OPPOSING',
          waitReason: `SHORT rejected: Higher timeframes are predominantly BULLISH (${mtfConfluence.bullishCount} vs ${mtfConfluence.bearishCount}).`,
        });
      }
    }

    // =========================================================================
    // GATE 6: ORDER BOOK & DERIVATIVES WARNINGS
    // =========================================================================
    if (orderBook) {
      if (preliminarySide === 'LONG' && orderBook.bias === 'SELLERS_STRONG' && orderBook.bidAskRatio < 0.65) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'ORDERBOOK_HEAVY_SELL_WALL',
          waitReason: 'LONG rejected: Heavy sell wall and institutional ask imbalance on order book.',
        });
      }
      if (preliminarySide === 'SHORT' && orderBook.bias === 'BUYERS_STRONG' && orderBook.bidAskRatio > 1.5) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'ORDERBOOK_HEAVY_BUY_WALL',
          waitReason: 'SHORT rejected: Heavy buyer support wall and bid imbalance on order book.',
        });
      }
    }

    if (derivatives && derivatives.isAvailable) {
      // Excessive positive funding rate (> 0.05%) means long crowd is over-leveraged
      if (preliminarySide === 'LONG' && derivatives.fundingRate !== null && derivatives.fundingRate > 0.05) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'DERIVATIVES_OVERHEATED_FUNDING',
          waitReason: `LONG rejected: Excessive positive funding rate (${(derivatives.fundingRate * 100).toFixed(2)}%) indicates high long liquidation risk.`,
        });
      }
    }

    // =========================================================================
    // GATE 7: DYNAMIC ENTRY ZONE & ENTRY TYPE DISCRIMINATION
    // =========================================================================
    let nearestSupport = (indicators.supportLevels && indicators.supportLevels[0]) || currentPrice * 0.98;
    let nearestResistance = (indicators.resistanceLevels && indicators.resistanceLevels[0]) || currentPrice * 1.02;

    if (indicators.fibonacci) {
      const fibs = Object.values(indicators.fibonacci).sort((a, b) => a - b);
      const below = fibs.filter(f => f < currentPrice);
      const above = fibs.filter(f => f > currentPrice);
      if (below.length > 0) nearestSupport = Math.max(nearestSupport, below[below.length - 1]);
      if (above.length > 0) nearestResistance = Math.min(nearestResistance, above[0]);
    }

    if (preliminarySide === 'LONG') {
      // Determine Entry Strategy:
      // 1. Pullback Entry: Price near EMA20 or nearest support
      // 2. Retest Entry: Price near recently broken resistance
      // 3. Breakout Entry: Strong volume breaking resistance
      // 4. Market Entry: Price within tight threshold
      let idealEntry = currentPrice;
      const isNearEma20 = Math.abs(currentPrice - ema20) <= 0.45 * atr;
      const isNearSupport = Math.abs(currentPrice - nearestSupport) <= 0.5 * atr;
      const isBreakout = currentPrice > nearestResistance * 0.998 && hasVolumeSupport;

      if (isNearSupport && currentPrice >= nearestSupport) {
        entryType = 'PULLBACK_ENTRY';
        idealEntry = roundPrice((nearestSupport + currentPrice) / 2);
      } else if (isNearEma20) {
        entryType = 'PULLBACK_ENTRY';
        idealEntry = roundPrice((ema20 + currentPrice) / 2);
      } else if (isBreakout && marketRegime === 'TRENDING_BULLISH') {
        entryType = 'BREAKOUT_ENTRY';
        idealEntry = roundPrice(currentPrice);
      } else {
        entryType = 'MARKET_ENTRY';
        idealEntry = roundPrice(currentPrice);
      }

      const minEntry = roundPrice(idealEntry - 0.35 * atr);
      const maxEntry = roundPrice(idealEntry + 0.25 * atr);
      entryZone = { min: minEntry, max: maxEntry, ideal: idealEntry };

      // Distance from ideal entry check: Don't execute if price has moved beyond maxEntry
      if (currentPrice > maxEntry + 0.1 * atr) {
        distanceFromIdealPct = ((currentPrice - idealEntry) / idealEntry) * 100;
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'PRICE_FAR_FROM_ENTRY_ZONE',
          waitReason: `Price ($${currentPrice}) has drifted above the optimal entry zone ($${minEntry} - $${maxEntry}). Wait for a pullback to $${idealEntry}.`,
          entryZone,
          distanceFromIdealPct,
        });
      }

      // =========================================================================
      // GATE 8: STOP LOSS & DYNAMIC TP1 / RISK-TO-REWARD (R:R)
      // =========================================================================
      // Structural SL: Under recent swing low or EMA50 bounded to optimal ATR range
      const rawSlDistance = Math.min(2.5 * atr, Math.max(1.3 * atr, idealEntry * 0.006));
      let calculatedSL = idealEntry - rawSlDistance;
      if (ms.swingLow && ms.swingLow < idealEntry && (idealEntry - ms.swingLow) >= 1.0 * atr && (idealEntry - ms.swingLow) <= 2.2 * atr) {
        calculatedSL = ms.swingLow - 0.2 * atr;
      }
      calculatedSL = roundPrice(calculatedSL);
      if (calculatedSL >= idealEntry) {
        calculatedSL = roundPrice(idealEntry * 0.985);
      }
      stopLoss = calculatedSL;

      const risk = idealEntry - stopLoss;

      // Realistic Dynamic TP1 placement:
      // Place TP1 at least 1.5x risk, ensuring realistic distance and clear path
      let targetTp1 = idealEntry + risk * 1.6;
      if (nearestResistance > idealEntry + 1.2 * atr) {
        if (nearestResistance < targetTp1) {
          targetTp1 = Math.max(idealEntry + risk * 1.35, nearestResistance - 0.15 * atr);
        }
      }
      targetTp1 = roundPrice(Math.max(targetTp1, idealEntry + 1.2 * atr));
      let targetTp2 = roundPrice(idealEntry + risk * 2.6);
      let targetTp3 = roundPrice(idealEntry + risk * 4.2);

      if (targetTp2 <= targetTp1) targetTp2 = roundPrice(targetTp1 + risk * 1.0);
      if (targetTp3 <= targetTp2) targetTp3 = roundPrice(targetTp2 + risk * 1.5);

      targets = { tp1: targetTp1, tp2: targetTp2, tp3: targetTp3 };
      riskRewardRatio = Math.round(((targetTp1 - idealEntry) / risk) * 100) / 100;

      if (riskRewardRatio < 1.30) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'INSUFFICIENT_RR_RATIO',
          waitReason: `Risk/Reward ratio (1:${riskRewardRatio}) is below minimum required 1:1.30. Nearest resistance is too tight.`,
          entryZone,
          stopLoss,
          targets,
          riskRewardRatio,
        });
      }
    } else {
      // SHORT SIDE
      let idealEntry = currentPrice;
      const isNearEma20 = Math.abs(currentPrice - ema20) <= 0.45 * atr;
      const isNearResistance = Math.abs(currentPrice - nearestResistance) <= 0.5 * atr;
      const isBreakdown = currentPrice < nearestSupport * 1.002 && hasVolumeSupport;

      if (isNearResistance && currentPrice <= nearestResistance) {
        entryType = 'PULLBACK_ENTRY';
        idealEntry = roundPrice((nearestResistance + currentPrice) / 2);
      } else if (isNearEma20) {
        entryType = 'PULLBACK_ENTRY';
        idealEntry = roundPrice((ema20 + currentPrice) / 2);
      } else if (isBreakdown && marketRegime === 'TRENDING_BEARISH') {
        entryType = 'BREAKOUT_ENTRY';
        idealEntry = roundPrice(currentPrice);
      } else {
        entryType = 'MARKET_ENTRY';
        idealEntry = roundPrice(currentPrice);
      }

      const minEntry = roundPrice(idealEntry - 0.25 * atr);
      const maxEntry = roundPrice(idealEntry + 0.35 * atr);
      entryZone = { min: minEntry, max: maxEntry, ideal: idealEntry };

      // Distance check: Don't short if price has already plummeted below minEntry
      if (currentPrice < minEntry - 0.1 * atr) {
        distanceFromIdealPct = ((idealEntry - currentPrice) / idealEntry) * 100;
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'PRICE_FAR_FROM_ENTRY_ZONE',
          waitReason: `Price ($${currentPrice}) has dropped below optimal entry zone ($${minEntry} - $${maxEntry}). Wait for a pullback to $${idealEntry}.`,
          entryZone,
          distanceFromIdealPct,
        });
      }

      // SL: Above recent swing high or EMA50 with ATR buffer
      const rawSlDistance = Math.min(2.5 * atr, Math.max(1.3 * atr, idealEntry * 0.006));
      let calculatedSL = idealEntry + rawSlDistance;
      if (ms.swingHigh && ms.swingHigh > idealEntry && (ms.swingHigh - idealEntry) >= 1.0 * atr && (ms.swingHigh - idealEntry) <= 2.2 * atr) {
        calculatedSL = ms.swingHigh + 0.2 * atr;
      }
      calculatedSL = roundPrice(calculatedSL);
      if (calculatedSL <= idealEntry) {
        calculatedSL = roundPrice(idealEntry * 1.015);
      }
      stopLoss = calculatedSL;

      const risk = stopLoss - idealEntry;

      // Realistic Dynamic TP1 placement for SHORT:
      let targetTp1 = idealEntry - risk * 1.6;
      if (nearestSupport < idealEntry - 1.2 * atr) {
        if (nearestSupport > targetTp1) {
          targetTp1 = Math.min(idealEntry - risk * 1.35, nearestSupport + 0.15 * atr);
        }
      }
      targetTp1 = roundPrice(Math.min(targetTp1, idealEntry - 1.2 * atr));
      let targetTp2 = roundPrice(idealEntry - risk * 2.6);
      let targetTp3 = roundPrice(idealEntry - risk * 4.2);

      if (targetTp2 >= targetTp1) targetTp2 = roundPrice(targetTp1 - risk * 1.0);
      if (targetTp3 >= targetTp2) targetTp3 = roundPrice(Math.max(idealEntry * 0.05, targetTp2 - risk * 1.5));

      targets = { tp1: targetTp1, tp2: targetTp2, tp3: targetTp3 };
      riskRewardRatio = Math.round(((idealEntry - targetTp1) / risk) * 100) / 100;

      if (riskRewardRatio < 1.30) {
        return this.buildRejectedResult({
          symbol,
          timeframe,
          currentPrice,
          preliminarySide,
          bullishScore,
          bearishScore,
          marketRegime,
          ms,
          rsi,
          atr,
          rejectionReason: 'INSUFFICIENT_RR_RATIO',
          waitReason: `Risk/Reward ratio (1:${riskRewardRatio}) is below minimum required 1:1.30. Nearest support is too tight.`,
          entryZone,
          stopLoss,
          targets,
          riskRewardRatio,
        });
      }
    }

    // =========================================================================
    // ALL GATES PASSED: CONSTRUCT VALID TRADE RESULT
    // =========================================================================
    let grade: 'A' | 'B' | 'C' | 'D' = 'B';
    if (signalStrength >= 78 && riskRewardRatio >= 1.8 && marketRegime.startsWith('TRENDING')) {
      grade = 'A';
    } else if (signalStrength >= 68 && riskRewardRatio >= 1.5) {
      grade = 'B';
    } else {
      grade = 'C';
    }

    const entryQuality: EntryQuality = {
      status: 'VALID',
      grade,
      score: signalStrength,
      entryType,
      reason: `Institutional High-Probability Setup (${entryType}): Trend ${ms.trend}, Structure ${ms.structure}, R:R 1:${riskRewardRatio}. Anti-chase confirmed.`,
      antiChasePassed: true,
      distanceFromIdealPct: 0,
    };

    const finalDecision: DecisionType = preliminarySide === 'LONG' ? 'LONG' : 'SHORT';
    const finalBias: BiasType = preliminarySide === 'LONG' ? 'BULLISH' : 'BEARISH';

    const auditLog = this.formatAuditLog({
      symbol,
      timeframe,
      currentPrice,
      signal: finalDecision,
      bullishScore,
      bearishScore,
      marketRegime,
      trend: ms.trend,
      structure: ms.structure,
      mtf: mtfConfluence ? `${mtfConfluence.bullishCount}B / ${mtfConfluence.bearishCount}S` : 'CONFIRMED',
      volume: hasVolumeSupport ? 'CONFIRMED' : 'NORMAL',
      momentum: `RSI ${rsi.toFixed(1)} | MACD ${macdHist.toFixed(2)}`,
      entryZone: `$${entryZone.min} - $${entryZone.max} (Ideal: $${entryZone.ideal})`,
      distanceFromEntry: '0.00%',
      atr,
      sl: stopLoss,
      tp1: targets.tp1,
      tp2: targets.tp2,
      tp3: targets.tp3,
      rr: riskRewardRatio,
      entryQuality: 'VALID',
      decision: finalDecision,
    });

    return {
      decision: finalDecision,
      bias: finalBias,
      entryQuality,
      entryType,
      entryZone,
      stopLoss,
      targets,
      riskRewardRatio,
      antiChasePassed: true,
      distanceFromIdealPct: 0,
      detailedAuditLog: auditLog,
    };
  }

  /**
   * Helper to construct rejected/WAIT results with descriptive reason and structured logging
   */
  private static buildRejectedResult(params: {
    symbol: string;
    timeframe: Timeframe;
    currentPrice: number;
    preliminarySide: 'LONG' | 'SHORT';
    bullishScore: number;
    bearishScore: number;
    marketRegime: MarketRegime;
    ms: any;
    rsi: number;
    atr: number;
    rejectionReason: string;
    waitReason: string;
    antiChasePassed?: boolean;
    entryZone?: { min: number; max: number; ideal: number };
    stopLoss?: number;
    targets?: { tp1: number; tp2: number; tp3: number };
    riskRewardRatio?: number;
    distanceFromIdealPct?: number;
  }): EntryValidationResult {
    const {
      symbol,
      timeframe,
      currentPrice,
      preliminarySide,
      bullishScore,
      bearishScore,
      marketRegime,
      ms,
      rsi,
      atr,
      rejectionReason,
      waitReason,
      antiChasePassed = true,
      entryZone = {
        min: roundPrice(currentPrice - 0.25 * atr),
        max: roundPrice(currentPrice + 0.25 * atr),
        ideal: roundPrice(currentPrice),
      },
      stopLoss = roundPrice(preliminarySide === 'LONG' ? currentPrice * 0.985 : currentPrice * 1.015),
      targets = {
        tp1: roundPrice(preliminarySide === 'LONG' ? currentPrice * 1.02 : currentPrice * 0.98),
        tp2: roundPrice(preliminarySide === 'LONG' ? currentPrice * 1.035 : currentPrice * 0.965),
        tp3: roundPrice(preliminarySide === 'LONG' ? currentPrice * 1.055 : currentPrice * 0.945),
      },
      riskRewardRatio = 1.2,
      distanceFromIdealPct = 0,
    } = params;

    const entryQuality: EntryQuality = {
      status: 'WAIT',
      grade: 'C',
      score: Math.max(bullishScore, bearishScore),
      entryType: 'MARKET_ENTRY',
      rejectionReason,
      reason: waitReason,
      antiChasePassed,
      distanceFromIdealPct,
    };

    const auditLog = this.formatAuditLog({
      symbol,
      timeframe,
      currentPrice,
      signal: preliminarySide,
      bullishScore,
      bearishScore,
      marketRegime,
      trend: ms.trend || 'NEUTRAL',
      structure: ms.structure || 'RANGE',
      mtf: 'EVALUATED',
      volume: 'NORMAL',
      momentum: `RSI ${rsi.toFixed(1)}`,
      entryZone: `$${entryZone.min} - $${entryZone.max} (Ideal: $${entryZone.ideal})`,
      distanceFromEntry: `${distanceFromIdealPct.toFixed(2)}%`,
      atr,
      sl: stopLoss,
      tp1: targets.tp1,
      tp2: targets.tp2,
      tp3: targets.tp3,
      rr: riskRewardRatio,
      entryQuality: 'WAIT',
      rejectionReason,
      decision: 'WAIT',
    });

    return {
      decision: 'WAIT',
      bias: preliminarySide === 'LONG' ? 'BULLISH' : 'BEARISH',
      entryQuality,
      entryType: 'MARKET_ENTRY',
      entryZone,
      stopLoss,
      targets,
      riskRewardRatio,
      rejectionReason,
      waitReason,
      antiChasePassed,
      distanceFromIdealPct,
      detailedAuditLog: auditLog,
    };
  }

  /**
   * Helper to format structured institutional entry logs
   */
  private static formatAuditLog(p: {
    symbol: string;
    timeframe: string;
    currentPrice: number;
    signal: string;
    bullishScore: number;
    bearishScore: number;
    marketRegime: string;
    trend: string;
    structure: string;
    mtf: string;
    volume: string;
    momentum: string;
    entryZone: string;
    distanceFromEntry: string;
    atr: number;
    sl: number;
    tp1: number;
    tp2: number;
    tp3: number;
    rr: number;
    entryQuality: string;
    rejectionReason?: string;
    decision: string;
  }): string {
    return [
      `[ENTRY ENGINE] -----------------------------------------`,
      `SYMBOL: ${p.symbol} | TIMEFRAME: ${p.timeframe} | PRICE: $${p.currentPrice}`,
      `SIGNAL: ${p.signal} | BULLISH SCORE: ${p.bullishScore} | BEARISH SCORE: ${p.bearishScore}`,
      `REGIME: ${p.marketRegime} | TREND: ${p.trend} | STRUCTURE: ${p.structure}`,
      `MTF: ${p.mtf} | VOLUME: ${p.volume} | MOMENTUM: ${p.momentum}`,
      `ENTRY ZONE: ${p.entryZone} | DISTANCE: ${p.distanceFromEntry}`,
      `ATR: $${roundPrice(p.atr)} | SL: $${p.sl} | TP1: $${p.tp1} | TP2: $${p.tp2} | TP3: $${p.tp3} | RR: 1:${p.rr}`,
      `ENTRY QUALITY: ${p.entryQuality} ${p.rejectionReason ? `| REASON: ${p.rejectionReason}` : ''}`,
      `FINAL DECISION: ${p.decision}`,
      `---------------------------------------------------------`,
    ].join('\n');
  }
}
