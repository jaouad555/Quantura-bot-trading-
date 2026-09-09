import {
  DecisionType,
  BiasType,
  MarketRegime,
  TradeType,
  RiskLevel,
  Timeframe,
  TechnicalIndicators,
  OrderBookSummary,
  DerivativesData,
  MTFConfluenceData,
  QuantitativeScore,
  EntryQuality,
  AIAnalysisResult,
  KlineCandle,
} from '../types';
import { formatCoinPrice } from './tradingPairs';

/**
 * Detect Market Regime deterministically based on indicators and volatility
 */
export function detectMarketRegime(
  indicators: TechnicalIndicators,
  currentPrice: number
): MarketRegime {
  const atrRatio = currentPrice > 0 ? ((indicators?.atr14 || 0) / currentPrice) * 100 : 1;
  const bw = indicators?.bollingerBands?.bandwidthPercent || 0;
  const adx = indicators?.adx14 || 0;
  const trend = indicators?.marketStructure?.trend || 'NEUTRAL';
  const ema20 = indicators?.ema20 || currentPrice;
  const ema50 = indicators?.ema50 || currentPrice;
  const ema200 = indicators?.ema200 || currentPrice;
  const isEmaBullish =
    currentPrice > ema20 &&
    ema20 > ema50 &&
    ema50 > ema200;
  const isEmaBearish =
    currentPrice < ema20 &&
    ema20 < ema50 &&
    ema50 < ema200;

  if (atrRatio > 2.2 || bw > 6.5) {
    return 'HIGH_VOLATILITY';
  }
  if (atrRatio < 0.6 && bw < 1.8 && adx < 18) {
    return 'LOW_VOLATILITY';
  }
  if (adx >= 24 && isEmaBullish && trend === 'UPTREND') {
    return 'TRENDING_BULLISH';
  }
  if (adx >= 24 && isEmaBearish && trend === 'DOWNTREND') {
    return 'TRENDING_BEARISH';
  }
  if (adx < 20 || indicators?.marketStructure?.structure === 'RANGE') {
    return 'RANGING';
  }

  return 'UNCERTAIN';
}

export interface OptimalTimeframeResult {
  timeframe: Timeframe;
  reasonAr: string;
  reasonEn: string;
  regime: MarketRegime;
}

/**
 * Dynamically determines the most optimal trading timeframe for the current market state
 */
export function determineOptimalBotTimeframe(
  indicators: TechnicalIndicators,
  currentPrice: number
): OptimalTimeframeResult {
  const regime = detectMarketRegime(indicators, currentPrice);
  const atrRatio = currentPrice > 0 ? ((indicators?.atr14 || 0) / currentPrice) * 100 : 1;
  const bw = indicators?.bollingerBands?.bandwidthPercent || 0;
  const adx = indicators?.adx14 || 0;

  if (regime === 'HIGH_VOLATILITY' || atrRatio > 2.8 || bw > 7.0) {
    return {
      timeframe: '15m',
      reasonAr: 'تقلبات سريعة وزخم مرتفع - فريم سريع 15m لاقتناص الفرص السريعة',
      reasonEn: 'High Volatility & Rapid Momentum - Adaptive 15m Fast Frame',
      regime,
    };
  }

  if (regime === 'TRENDING_BULLISH' || regime === 'TRENDING_BEARISH' || adx >= 25) {
    return {
      timeframe: '1h',
      reasonAr: 'اتجاه واضح وزخم قياسي - فريم 1H المتوازن للمضاعفة والمتابعة',
      reasonEn: 'Strong Directional Trend - Institutional 1H Compounding Frame',
      regime,
    };
  }

  if (regime === 'RANGING' || regime === 'LOW_VOLATILITY' || atrRatio < 0.8) {
    return {
      timeframe: '4h',
      reasonAr: 'تذبذب أفقي / حركة عرضية - فريم 4H لتفادي الضوضاء والإشارات الكاذبة',
      reasonEn: 'Ranging / Low Volatility - 4H Frame to Filter Chop & Noise',
      regime,
    };
  }

  return {
    timeframe: '1h',
    reasonAr: 'ظروف سوق قياسية - فريم 1H النموذجي',
    reasonEn: 'Balanced Market Conditions - Standard 1H Frame',
    regime,
  };
}

/**
 * Calculate quantitative multi-factor score
 */
export function calculateQuantitativeScore(
  timeframe: Timeframe,
  currentPrice: number,
  indicators: TechnicalIndicators,
  orderBook: OrderBookSummary | null,
  derivatives: DerivativesData | null,
  mtfConfluence: MTFConfluenceData | null
): QuantitativeScore {
  // 1. Trend Factor (Weight: 20%)
  let trendBull = 50;
  let trendBear = 50;
  const { ema20, ema50, ema100, ema200, sma200 } = indicators;

  let emaBullCount = 0;
  if (currentPrice > ema20) emaBullCount++;
  if (ema20 > ema50) emaBullCount++;
  if (ema50 > ema100) emaBullCount++;
  if (ema100 > ema200) emaBullCount++;
  if (currentPrice > sma200) emaBullCount++;

  trendBull = (emaBullCount / 5) * 100;
  trendBear = 100 - trendBull;

  // 2. Market Structure Factor (Weight: 20%)
  let structBull = 50;
  let structBear = 50;
  const ms = indicators?.marketStructure || {
    trend: 'NEUTRAL',
    structure: 'RANGE',
    bos: 'Neutre',
    choch: 'Neutre',
    swingHigh: currentPrice,
    swingLow: currentPrice,
  };
  if (ms.trend === 'UPTREND') {
    structBull = ms.structure === 'HIGHER_HIGH' ? 90 : 75;
    structBear = 100 - structBull;
  } else if (ms.trend === 'DOWNTREND') {
    structBear = ms.structure === 'LOWER_LOW' ? 90 : 75;
    structBull = 100 - structBear;
  } else {
    structBull = 50;
    structBear = 50;
  }

  // 3. Momentum Factor (Weight: 15%)
  let momBull = 50;
  let momBear = 50;
  const { rsi14, macd } = indicators;

  let rsiBull = 50;
  if (rsi14 >= 50 && rsi14 <= 68) rsiBull = 80;
  else if (rsi14 > 68 && rsi14 <= 78) rsiBull = 65; // Strong but getting warm
  else if (rsi14 > 78) rsiBull = 30; // Overbought
  else if (rsi14 < 50 && rsi14 >= 35) rsiBull = 35;
  else if (rsi14 < 35 && rsi14 >= 25) rsiBull = 45; // Oversold potential bounce
  else if (rsi14 < 25) rsiBull = 55; // Extreme oversold

  let macdBull = 50;
  if (macd.macdLine > macd.signalLine && macd.histogram > 0) macdBull = 85;
  else if (macd.macdLine > macd.signalLine && macd.histogram <= 0) macdBull = 60;
  else if (macd.macdLine < macd.signalLine && macd.histogram < 0) macdBull = 15;
  else macdBull = 40;

  momBull = Math.round(rsiBull * 0.5 + macdBull * 0.5);
  momBear = 100 - momBull;

  // 4. Volume & Flow Factor (Weight: 10%)
  let volBull = 50;
  let volBear = 50;
  const isVolHigh = (indicators.volume || 0) > (indicators.volumeAvg20 || 0);
  const isAboveVwap = currentPrice >= (indicators.vwap || currentPrice);
  if (isAboveVwap && isVolHigh) {
    volBull = 80;
  } else if (!isAboveVwap && isVolHigh) {
    volBull = 25;
  } else if (isAboveVwap && !isVolHigh) {
    volBull = 60;
  } else {
    volBull = 40;
  }
  volBear = 100 - volBull;

  // 5. Volatility & Trend Quality Factor (Weight: 10%)
  let volaBull = 50;
  let volaBear = 50;
  if ((indicators.adx14 || 0) >= 25) {
    volaBull = trendBull >= 50 ? 80 : 30;
    volaBear = 100 - volaBull;
  } else {
    volaBull = 50;
    volaBear = 50;
  }

  // 6. Support / Resistance Proximity (Weight: 10%)
  let srBull = 50;
  let srBear = 50;
  const nearestSupport = (indicators.supportLevels && indicators.supportLevels[0]) || currentPrice * 0.98;
  const nearestResistance = (indicators.resistanceLevels && indicators.resistanceLevels[0]) || currentPrice * 1.02;
  const distToSup = Math.abs(currentPrice - nearestSupport);
  const distToRes = Math.abs(nearestResistance - currentPrice);

  if (distToSup + distToRes > 0) {
    // Closer to support = better for long risk/reward
    const supRatio = distToRes / (distToSup + distToRes);
    srBull = Math.min(90, Math.max(10, Math.round(supRatio * 100)));
    srBear = 100 - srBull;
  }

  // 7. MTF Confluence Factor (Weight: 5%)
  let mtfBull = 50;
  let mtfBear = 50;
  if (mtfConfluence) {
    const total = (mtfConfluence.bullishCount + mtfConfluence.bearishCount + mtfConfluence.neutralCount) || 1;
    mtfBull = Math.round((mtfConfluence.bullishCount / total) * 100);
    mtfBear = Math.round((mtfConfluence.bearishCount / total) * 100);
  }

  // 8. Order Book Depth Factor (Weight: 5%)
  let obBull = 50;
  let obBear = 50;
  if (orderBook) {
    if (orderBook.bias === 'BUYERS_STRONG') obBull = 80;
    else if (orderBook.bias === 'SELLERS_STRONG') obBull = 20;
    else obBull = 50;
    obBear = 100 - obBull;
  }

  // 9. Derivatives Factor (Weight: 5%)
  let derivBull = 50;
  let derivBear = 50;
  if (derivatives && derivatives.isAvailable) {
    if (derivatives.takerLongShortRatio !== null) {
      if (derivatives.takerLongShortRatio > 1.15) derivBull += 15;
      else if (derivatives.takerLongShortRatio < 0.85) derivBull -= 15;
    }
    if (derivatives.fundingRate !== null) {
      // Very high funding rate (> 0.05%) indicates overheated longs
      if (derivatives.fundingRate > 0.04) derivBull -= 20;
      else if (derivatives.fundingRate < -0.01) derivBull += 20;
    }
    derivBull = Math.min(90, Math.max(10, derivBull));
    derivBear = 100 - derivBull;
  }

  // Weighted Composition
  const bullishScore = Math.round(
    trendBull * 0.20 +
    structBull * 0.20 +
    momBull * 0.15 +
    volBull * 0.10 +
    volaBull * 0.10 +
    srBull * 0.10 +
    mtfBull * 0.05 +
    obBull * 0.05 +
    derivBull * 0.05
  );

  const bearishScore = Math.round(
    trendBear * 0.20 +
    structBear * 0.20 +
    momBear * 0.15 +
    volBear * 0.10 +
    volaBear * 0.10 +
    srBear * 0.10 +
    mtfBear * 0.05 +
    obBear * 0.05 +
    derivBear * 0.05
  );

  const neutralScore = Math.max(0, 100 - Math.abs(bullishScore - bearishScore));
  const signalStrength = Math.max(bullishScore, bearishScore);

  return {
    bullishScore,
    bearishScore,
    neutralScore,
    signalStrength,
    breakdown: {
      trend: trendBull,
      marketStructure: structBull,
      momentum: momBull,
      volume: volBull,
      volatility: volaBull,
      supportResistance: srBull,
      mtfConfluence: mtfBull,
      orderBook: obBull,
      derivatives: derivBull,
    },
  };
}

/**
 * Generate Complete Deterministic Quantitative Trade Plan
 */
export function generateQuantitativePlan(
  timeframe: Timeframe,
  currentPrice: number,
  indicators: TechnicalIndicators,
  orderBook: OrderBookSummary | null,
  derivatives: DerivativesData | null,
  mtfConfluence: MTFConfluenceData | null,
  isDeveloperMode = false,
  symbol = 'BTCUSDT'
): AIAnalysisResult {
  const normSymbol = (symbol || 'BTCUSDT').toUpperCase();
  const pairLabel = normSymbol.includes('/') ? normSymbol : `${normSymbol.replace('USDT', '')}/USDT`;
  const marketRegime = detectMarketRegime(indicators, currentPrice);
  const quantScore = calculateQuantitativeScore(
    timeframe,
    currentPrice,
    indicators,
    orderBook,
    derivatives,
    mtfConfluence
  );

  const { bullishScore, bearishScore, signalStrength } = quantScore;
  const atr = Math.max(indicators?.atr14 || 0, currentPrice * 0.005);
  const ms = indicators?.marketStructure || {
    trend: 'NEUTRAL',
    structure: 'RANGE',
    bos: 'Neutre',
    choch: 'Neutre',
    swingHigh: currentPrice,
    swingLow: currentPrice,
  };

  let decision: DecisionType = 'WAIT';
  let bias: BiasType = 'NEUTRAL';

  // Rule: Clear statistical threshold without fake certainty
  if (bullishScore >= 65 && bullishScore > bearishScore + 18) {
    decision = 'LONG';
    bias = 'BULLISH';
  } else if (bearishScore >= 65 && bearishScore > bullishScore + 18) {
    decision = 'SHORT';
    bias = 'BEARISH';
  } else if (bullishScore >= 55) {
    bias = 'BULLISH';
    decision = 'WAIT';
  } else if (bearishScore >= 55) {
    bias = 'BEARISH';
    decision = 'WAIT';
  } else {
    bias = 'NEUTRAL';
    decision = 'NO_TRADE';
  }

  // Filter against adverse market regimes
  if (marketRegime === 'HIGH_VOLATILITY' && signalStrength < 78) {
    decision = 'WAIT';
  }

  let tradeType: TradeType = 'SHORT_TRADE';
  let expectedDuration = '2h - 8h';
  let entryWindow = '15 - 45 min';
  let optimalExitTime = 'Clôture sous EMA 20 ou atteinte TP2';

  if (timeframe === '5m') {
    tradeType = 'FAST_TRADE';
    expectedDuration = '10m - 45m';
    entryWindow = '2 - 8 min';
    optimalExitTime = 'Sortie rapide sur TP1 ou retournement RSI 5m';
  } else if (timeframe === '15m') {
    tradeType = 'FAST_TRADE';
    expectedDuration = '30m - 2h';
    entryWindow = '5 - 15 min';
    optimalExitTime = 'Sortie rapide sur TP1 ou retournement RSI 15m';
  } else if (timeframe === '30m') {
    tradeType = 'SHORT_TRADE';
    expectedDuration = '1h - 4h';
    entryWindow = '10 - 30 min';
    optimalExitTime = 'Prise de profit TP1/TP2 sur pivot 30m';
  } else if (timeframe === '1h') {
    tradeType = 'SHORT_TRADE';
    expectedDuration = '4h - 12h';
    entryWindow = '15 - 60 min';
    optimalExitTime = 'Prise de profit partielle sur TP1, trail stop vers Breakeven';
  } else if (timeframe === '4h') {
    tradeType = 'SWING_TRADE';
    expectedDuration = '1j - 3j';
    entryWindow = '1h - 4h';
    optimalExitTime = 'Trailing stop sous EMA 50 4h';
  } else {
    tradeType = 'POSITION_TRADE';
    expectedDuration = '3j - 2 sem';
    entryWindow = '4h - 24h';
    optimalExitTime = 'Objectif macro swing ou divergence baissière journalière';
  }

  // Dynamic price rounding helper according to price magnitude
  const roundPrice = (val: number): number => {
    if (val >= 1000) return Math.round(val * 100) / 100;
    if (val >= 50) return Math.round(val * 100) / 100;
    if (val >= 1) return Math.round(val * 1000) / 1000;
    if (val >= 0.01) return Math.round(val * 10000) / 10000;
    if (val >= 0.0001) return Math.round(val * 1000000) / 1000000;
    return Math.round(val * 100000000) / 100000000;
  };

  // Calculate Entry, Stop Loss & Targets
  let entryZone = null;
  let targets = null;
  let stopLoss = null;
  let riskRewardRatio = null;
  let invalidationReason = '';
  let longInvalidBelow: number | undefined;
  let shortInvalidAbove: number | undefined;

  if (decision === 'LONG') {
    const ideal = roundPrice(currentPrice);
    const minEntry = roundPrice(ideal - 0.4 * atr);
    const maxEntry = roundPrice(ideal + 0.25 * atr);
    entryZone = { min: minEntry, max: maxEntry, ideal };

    // SL: Under recent swing low or 1.5 * ATR
    const slDist = Math.max(1.8 * atr, ideal * 0.005);
    let rawSL = ideal - slDist;
    if (ms.swingLow && ms.swingLow < ideal && (ideal - ms.swingLow) <= 3.5 * atr) {
      rawSL = Math.min(rawSL, ms.swingLow - 0.2 * atr);
    }
    stopLoss = roundPrice(rawSL);
    longInvalidBelow = stopLoss;
    invalidationReason = `Scénario LONG invalidé en cas de clôture ${timeframe} sous $${formatCoinPrice(stopLoss, symbol)} ou cassure du support structurel.`;

    const risk = Math.max(0.00001, ideal - stopLoss);
    const tp1 = roundPrice(ideal + risk * 1.5);
    const tp2 = roundPrice(ideal + risk * 2.5);
    const tp3 = roundPrice(ideal + risk * 4.0);
    targets = { tp1, tp2, tp3 };

    riskRewardRatio = Math.round(((tp1 - ideal) / risk) * 100) / 100;
  } else if (decision === 'SHORT') {
    const ideal = roundPrice(currentPrice);
    const minEntry = roundPrice(ideal - 0.25 * atr);
    const maxEntry = roundPrice(ideal + 0.4 * atr);
    entryZone = { min: minEntry, max: maxEntry, ideal };

    const slDist = Math.max(1.8 * atr, ideal * 0.005);
    let rawSL = ideal + slDist;
    if (ms.swingHigh && ms.swingHigh > ideal && (ms.swingHigh - ideal) <= 3.5 * atr) {
      rawSL = Math.max(rawSL, ms.swingHigh + 0.2 * atr);
    }
    stopLoss = roundPrice(rawSL);
    shortInvalidAbove = stopLoss;
    invalidationReason = `Scénario SHORT invalidé en cas de clôture ${timeframe} au-dessus de $${formatCoinPrice(stopLoss, symbol)} ou rejet des vendeurs.`;

    const risk = Math.max(0.00001, stopLoss - ideal);
    const tp1 = roundPrice(ideal - risk * 1.5);
    const tp2 = roundPrice(ideal - risk * 2.5);
    const tp3 = roundPrice(ideal - risk * 4.0);
    targets = { tp1, tp2, tp3 };

    riskRewardRatio = Math.round(((ideal - tp1) / risk) * 100) / 100;
  } else {
    // WAIT or NO_TRADE
    longInvalidBelow = roundPrice((indicators.supportLevels && indicators.supportLevels[0]) || currentPrice * 0.98);
    shortInvalidAbove = roundPrice((indicators.resistanceLevels && indicators.resistanceLevels[0]) || currentPrice * 1.02);
    invalidationReason = `Marché en phase de consolidation / incertitude. Attendre une confirmation au-dessus de $${formatCoinPrice(shortInvalidAbove, symbol)} ou sous $${formatCoinPrice(longInvalidBelow, symbol)}.`;
  }

  // Calculate Entry Quality
  let grade: 'A' | 'B' | 'C' | 'D' = 'C';
  let qualityScore = quantScore.signalStrength;
  let qualityReason = '';

  if (decision === 'LONG' || decision === 'SHORT') {
    if (signalStrength >= 80 && (riskRewardRatio || 0) >= 1.8) {
      grade = 'A';
      qualityReason = 'Configuration haute probabilité avec forte confluence technique et ratio R:R supérieur à 1:1.8.';
    } else if (signalStrength >= 68 && (riskRewardRatio || 0) >= 1.5) {
      grade = 'B';
      qualityReason = 'Configuration solide avec bon ratio R:R, valider le volume lors de la prise de position.';
    } else {
      grade = 'C';
      qualityReason = 'Configuration modérée, risque accru de volatilité. Réduire la taille de position.';
    }
  } else {
    grade = 'D';
    qualityReason = 'Signal insuffisant ou marché en compression. Préserver son capital et patienter.';
  }

  const entryQuality: EntryQuality = {
    grade,
    score: qualityScore,
    reason: qualityReason,
  };

  // Primary & Alternative Scenarios
  let primaryScenario = '';
  let alternativeScenario = '';

  if (decision === 'LONG') {
    primaryScenario = `Rebond technique depuis la zone $${formatCoinPrice(entryZone?.min, symbol)}-$${formatCoinPrice(entryZone?.max, symbol)} avec accélération haussière vers TP1 ($${formatCoinPrice(targets?.tp1, symbol)}) puis TP2 ($${formatCoinPrice(targets?.tp2, symbol)}).`;
    alternativeScenario = `Cassure sous le Stop Loss ($${formatCoinPrice(stopLoss, symbol)}) entraînant un retest du support majeur $${formatCoinPrice(indicators.supportLevels?.[1], symbol) || 'inférieur'}.`;
  } else if (decision === 'SHORT') {
    primaryScenario = `Rejet sous la résistance avec pression vendeuse vers TP1 ($${formatCoinPrice(targets?.tp1, symbol)}) puis TP2 ($${formatCoinPrice(targets?.tp2, symbol)}).`;
    alternativeScenario = `Reprise acheteuse au-dessus de $${formatCoinPrice(stopLoss, symbol)} déclenchant une liquidation des shorts vers $${formatCoinPrice(indicators.resistanceLevels?.[1], symbol) || 'supérieur'}.`;
  } else {
    primaryScenario = `Consolidation latérale entre le support $${formatCoinPrice(longInvalidBelow, symbol)} et la résistance $${formatCoinPrice(shortInvalidAbove, symbol)}.`;
    alternativeScenario = `Sortie violente de range nécessitant une réévaluation immédiate du flux d'ordres.`;
  }

  const msTrend = ms.trend || 'NEUTRAL';
  const msStructure = ms.structure || 'RANGE';
  const msBos = ms.bos || 'N/A';

  // Key factors
  const keyFactors: string[] = [];
  keyFactors.push(`Régime de Marché : ${marketRegime.replace('_', ' ')}`);
  keyFactors.push(`Structure : ${msTrend} (${msStructure})`);
  keyFactors.push(`RSI(14) : ${indicators?.rsi14 || 50} | MACD Hist : ${indicators?.macd?.histogram || 0}`);
  keyFactors.push(`EMA 20/50/200 : ${currentPrice > (indicators?.ema200 || currentPrice) ? 'Au-dessus de EMA200 (Macro Bull)' : 'Sous EMA200 (Macro Bear)'}`);
  if (orderBook) {
    keyFactors.push(`Carnet d'ordres : ${orderBook.bias === 'BUYERS_STRONG' ? 'Pression acheteuse (+)' : orderBook.bias === 'SELLERS_STRONG' ? 'Pression vendeuse (-)' : 'Équilibré'}`);
  }

  const riskLevel: RiskLevel =
    marketRegime === 'HIGH_VOLATILITY' || grade === 'C' ? 'HIGH' : grade === 'A' ? 'LOW' : 'MEDIUM';

  const technicalReason = `${decision} ${pairLabel} (${timeframe}) basé sur Score Quantitatif ${quantScore.signalStrength}/100. Structure: ${msTrend}, Régime: ${marketRegime}.`;
  const riskWarning = 'Le trading de cryptomonnaies comporte un risque élevé. Respectez un risque maximal de 1% à 2% par trade.';

  const detailedAnalysis = {
    fr: `📊 **RAPPORT QUANTITATIF ${pairLabel} (${timeframe.toUpperCase()})**
• **Décision** : ${decision} (Force du Signal : ${quantScore.signalStrength}%)
• **Régime de Marché** : ${marketRegime}
• **Structure de Marché** : ${msTrend} - ${msBos}
• **Moyennes Mobiles** : EMA20 ($${formatCoinPrice(indicators?.ema20 || currentPrice, symbol)}), EMA50 ($${formatCoinPrice(indicators?.ema50 || currentPrice, symbol)}), EMA200 ($${formatCoinPrice(indicators?.ema200 || currentPrice, symbol)})
• **Momentum** : RSI14 à ${indicators?.rsi14 || 50}, MACD Histogram à ${indicators?.macd?.histogram || 0}
• **Carnet & Flux** : ${orderBook ? `Ratio Bids/Asks : ${orderBook.bidAskRatio} (${orderBook.bias})` : 'Données spot Binance'}
• **Plan de Trade** :
  - Entrée Idéale : ${entryZone ? `$${formatCoinPrice(entryZone.ideal, symbol)}` : 'N/A'}
  - Stop Loss : ${stopLoss ? `$${formatCoinPrice(stopLoss, symbol)}` : 'N/A'}
  - Objectifs : ${targets ? `TP1 $${formatCoinPrice(targets.tp1, symbol)} | TP2 $${formatCoinPrice(targets.tp2, symbol)} | TP3 $${formatCoinPrice(targets.tp3, symbol)}` : 'N/A'}
  - Ratio Risque/Rendement : ${riskRewardRatio ? `1:${riskRewardRatio}` : 'N/A'}`,

    ar: `📊 **تقرير التحليل الكمي والفني لزوج ${pairLabel} (${timeframe.toUpperCase()})**
• **القرار** : ${decision === 'LONG' ? 'شراء (LONG)' : decision === 'SHORT' ? 'بيع (SHORT)' : 'انتظار (WAIT)'} (قوة الإشارة: ${quantScore.signalStrength}%)
• **حالة السوق** : ${marketRegime}
• **هيكل السوق** : ${msTrend} (${msStructure})
• **المؤشرات الفنية** : RSI14 (${indicators?.rsi14 || 50}) | MACD (${indicators?.macd?.histogram || 0}) | EMA200 ($${formatCoinPrice(indicators?.ema200 || currentPrice, symbol)})
• **خطة التداول** :
  - سعر الدخول المثالي : ${entryZone ? `$${formatCoinPrice(entryZone.ideal, symbol)}` : 'غير متاح'}
  - وقف الخسارة (SL) : ${stopLoss ? `$${formatCoinPrice(stopLoss, symbol)}` : 'غير متاح'}
  - الأهداف الربحية : ${targets ? `TP1: $${formatCoinPrice(targets.tp1, symbol)} | TP2: $${formatCoinPrice(targets.tp2, symbol)}` : 'غير متاح'}
  - نسبة المخاطرة/المكسب : ${riskRewardRatio ? `1:${riskRewardRatio}` : 'غير متاح'}`,

    en: `📊 **QUANTITATIVE ${pairLabel} REPORT (${timeframe.toUpperCase()})**
• **Decision**: ${decision} (Signal Strength: ${quantScore.signalStrength}%)
• **Market Regime**: ${marketRegime}
• **Market Structure**: ${msTrend} (${msStructure})
• **Indicators**: RSI14 (${indicators?.rsi14 || 50}), MACD Hist (${indicators?.macd?.histogram || 0}), EMA200 ($${formatCoinPrice(indicators?.ema200 || currentPrice, symbol)})
• **Trade Execution Plan**:
  - Ideal Entry: ${entryZone ? `$${formatCoinPrice(entryZone.ideal, symbol)}` : 'N/A'}
  - Stop Loss: ${stopLoss ? `$${formatCoinPrice(stopLoss, symbol)}` : 'N/A'}
  - Targets: ${targets ? `TP1 $${formatCoinPrice(targets.tp1, symbol)}, TP2 $${formatCoinPrice(targets.tp2, symbol)}` : 'N/A'}
  - Risk/Reward: ${riskRewardRatio ? `1:${riskRewardRatio}` : 'N/A'}`,
  };

  return {
    timestamp: Date.now(),
    decision,
    bias,
    tradeType,
    confidence: quantScore.signalStrength,
    marketRegime,
    entryQuality,
    quantScore,
    currentPrice,
    entryZone,
    targets,
    stopLoss,
    riskRewardRatio,
    invalidation: {
      longInvalidBelow,
      shortInvalidAbove,
      reason: invalidationReason,
    },
    scenarios: {
      primary: primaryScenario,
      alternative: alternativeScenario,
    },
    recommendedTimeframe: timeframe,
    timing: {
      entryWindow,
      expectedDuration,
      optimalExitTime,
    },
    riskLevel,
    keyFactors,
    technicalReason,
    riskWarning,
    detailedAnalysis,
    generatedAt: Date.now(),
    isDeveloperMode,
    dataSource: isDeveloperMode ? 'DEVELOPER_TEST_MODE' : 'BINANCE_PRODUCTION_QUANT_ENGINE',
  };
}
