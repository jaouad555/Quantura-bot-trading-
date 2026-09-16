import {
  KlineCandle,
  Timeframe,
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  EquityDataPoint,
  MultiCoinBacktestResult,
  TechnicalIndicators,
  BacktestStrategyId,
} from '../types';
import { calculateEMA, calculateSMA } from './indicators';

export interface BacktestStrategyInfo {
  id: BacktestStrategyId;
  name: string;
  nameAr: string;
  shortDesc: string;
  shortDescAr: string;
  defaultTimeframe: Timeframe;
  defaultLeverage: number;
  defaultSlAtr: number;
  defaultRiskReward: number;
  badge: string;
  color: string;
}

export const BACKTEST_STRATEGIES: BacktestStrategyInfo[] = [
  {
    id: 'MOMENTUM',
    name: 'Momentum Trend Pro',
    nameAr: 'زخم الاتجاه الخوارزمي (Momentum Trend Pro)',
    shortDesc: 'EMA 20/50 alignment + ADX > 20 + MACD expansion',
    shortDescAr: 'رافعة 3x • فريم 1H • تأكيد الزخم ADX/RSI • وقف متحرك 1.2%',
    defaultTimeframe: '1h',
    defaultLeverage: 3,
    defaultSlAtr: 1.5,
    defaultRiskReward: 2.0,
    badge: 'MOMENTUM',
    color: '#06b6d4', // cyan-500
  },
  {
    id: 'SCALPER',
    name: 'High-Freq Scalper',
    nameAr: 'سكالبينج عالي التردد (High-Freq Scalper)',
    shortDesc: 'Oversold/Overbought Stoch + RSI bounce at Bollinger bands',
    shortDescAr: 'رافعة 5x • فريم 15m • صفقات خاطفة مع وقف خسارة ضيق وسريع',
    defaultTimeframe: '15m',
    defaultLeverage: 5,
    defaultSlAtr: 1.0,
    defaultRiskReward: 1.6,
    badge: 'SCALPER',
    color: '#f59e0b', // amber-500
  },
  {
    id: 'BREAKOUT',
    name: 'Breakout Sniper',
    nameAr: 'قناص الاختراقات السعرية (Breakout Sniper)',
    shortDesc: 'Bollinger bandwidth squeeze expansion + volume surge',
    shortDescAr: 'رافعة 4x • فريم 30m • انفجار سعري عند كسر المقاومات بحجم تداول عالي',
    defaultTimeframe: '30m',
    defaultLeverage: 4,
    defaultSlAtr: 1.2,
    defaultRiskReward: 2.2,
    badge: 'BREAKOUT',
    color: '#8b5cf6', // purple-500
  },
  {
    id: 'MEAN_REVERSION',
    name: 'Mean Reversion Pro',
    nameAr: 'ارتداد القمم والقيعان (Mean Reversion Pro)',
    shortDesc: 'Counter-trend statistical return to EMA20 / BB Mean',
    shortDescAr: 'رافعة 3x • فريم 15m • ارتداد ذروة الشراء والبيع RSI وبولينجر باند',
    defaultTimeframe: '15m',
    defaultLeverage: 3,
    defaultSlAtr: 1.2,
    defaultRiskReward: 1.8,
    badge: 'REVERSION',
    color: '#ec4899', // pink-500
  },
  {
    id: 'INSTITUTIONAL_SMC',
    name: 'Smart Money SMC',
    nameAr: 'صانع السوق المؤسسي (Smart Money SMC)',
    shortDesc: 'Market structure (BOS / CHoCH) + Liquidity sweeps & Order Blocks',
    shortDescAr: 'رافعة 2x • فريم 1H • تتبع صانع السوق وكتل الأوامر Order Blocks وFVG',
    defaultTimeframe: '1h',
    defaultLeverage: 2,
    defaultSlAtr: 1.4,
    defaultRiskReward: 2.4,
    badge: 'SMART MONEY',
    color: '#14b8a6', // teal-500
  },
  {
    id: 'SWING',
    name: 'Conservative Swing',
    nameAr: 'سوينغ محافظ ومستقر (Conservative Swing)',
    shortDesc: 'Multi-day HTF trend alignment (Price > EMA50 > EMA200) with low DD',
    shortDescAr: 'رافعة 2x • فريم 4H • صفقات متأرجحة بأقل نسبة تراجع ووقف متحرك 1.8%',
    defaultTimeframe: '4h',
    defaultLeverage: 2,
    defaultSlAtr: 2.0,
    defaultRiskReward: 2.5,
    badge: 'SAFE SWING',
    color: '#10b981', // emerald-500
  },
  {
    id: 'ALL_STRATEGIES',
    name: 'Multi-Strategy Ensemble',
    nameAr: 'محفظة الاستراتيجيات الشاملة (All Strategies Ensemble)',
    shortDesc: 'Dynamic ensemble evaluating all 6 strategies with confidence weighting',
    shortDescAr: 'محفظة ذكية متكاملة تجمع وتفاضل بين كافة الاستراتيجيات الست لاختيار أفضل الفرص',
    defaultTimeframe: '1h',
    defaultLeverage: 3,
    defaultSlAtr: 1.5,
    defaultRiskReward: 2.0,
    badge: 'ENSEMBLE',
    color: '#6366f1', // indigo-500
  },
];

export interface StrategyComparisonItem {
  strategyId: BacktestStrategyId;
  strategyName: string;
  strategyNameAr: string;
  badge: string;
  color: string;
  netProfitUsdt: number;
  netReturnPercent: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  expectancy: number;
  isBest?: boolean;
}

/**
 * Default Backtest configuration values
 */
export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  timeframe: '1h',
  months: 6,
  candleLimit: 1000,
  initialBalance: 1000,
  leverage: 3, // Futures 3x
  tradeAllocationPercent: 20, // 20% margin per trade
  riskRewardTarget: 2.0,
  minSignalStrength: 65,
  slAtrMultiplier: 1.5,
  marketType: 'FUTURES',
  strategyId: 'ALL_STRATEGIES',
  trailingStopEnabled: true,
  trailingStopPercent: 1.2,
  trailingActivationProfitPercent: 1.5,
  feeRatePercent: 0.05,
  slippagePercent: 0.02,
};

/**
 * Pre-computes all indicator series in linear O(N) time for instant O(1) lookups during simulation
 */
function precalculateVectorizedIndicators(klines: KlineCandle[]): TechnicalIndicators[] {
  const len = klines.length;
  if (len === 0) return [];

  const closes = klines.map((k) => k.close);
  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);

  // EMAs & SMAs in O(N)
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema100 = calculateEMA(closes, 100);
  const ema200 = calculateEMA(closes, 200);
  const sma200 = calculateSMA(closes, 200);

  // MACD (12, 26, 9) in O(N)
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - (ema26[i] || 0));
  const signalLine = calculateEMA(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - (signalLine[i] || 0));

  // RSI 14 in O(N) using Wilder's smoothing
  const rsi: number[] = new Array(len).fill(50);
  if (len > 14) {
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= 14; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    let avgGain = gains / 14;
    let avgLoss = losses / 14;
    rsi[14] = avgLoss === 0 ? 100 : Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;

    for (let i = 15; i < len; i++) {
      const diff = closes[i] - closes[i - 1];
      const g = diff >= 0 ? diff : 0;
      const l = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * 13 + g) / 14;
      avgLoss = (avgLoss * 13 + l) / 14;
      if (avgLoss === 0) {
        rsi[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi[i] = Math.round((100 - 100 / (1 + rs)) * 100) / 100;
      }
    }
  }

  // ATR 14 in O(N)
  const atr: number[] = new Array(len).fill(closes[0] * 0.01);
  if (len > 1) {
    const trs: number[] = [highs[0] - lows[0]];
    for (let i = 1; i < len; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
    }

    const initPeriod = Math.min(14, len);
    let smoothedAtr = trs.slice(0, initPeriod).reduce((a, b) => a + b, 0) / initPeriod;
    atr[initPeriod - 1] = smoothedAtr;

    for (let i = initPeriod; i < len; i++) {
      smoothedAtr = (smoothedAtr * 13 + trs[i]) / 14;
      atr[i] = smoothedAtr;
    }
  }

  // Bollinger Bands (20, 2) in O(N)
  const bbUpper: number[] = new Array(len);
  const bbMiddle: number[] = new Array(len);
  const bbLower: number[] = new Array(len);
  const bbBw: number[] = new Array(len);

  for (let i = 0; i < len; i++) {
    if (i < 19) {
      const c = closes[i];
      bbUpper[i] = c * 1.02;
      bbMiddle[i] = c;
      bbLower[i] = c * 0.98;
      bbBw[i] = 4.0;
    } else {
      let sum = 0;
      for (let j = 0; j < 20; j++) sum += closes[i - j];
      const mid = sum / 20;
      let varSum = 0;
      for (let j = 0; j < 20; j++) varSum += Math.pow(closes[i - j] - mid, 2);
      const std = Math.sqrt(varSum / 20);
      const up = mid + 2 * std;
      const low = mid - 2 * std;
      bbUpper[i] = up;
      bbMiddle[i] = mid;
      bbLower[i] = low;
      bbBw[i] = mid > 0 ? ((up - low) / mid) * 100 : 0;
    }
  }

  // ADX 14 in O(N) using true directional movement index
  const adx: number[] = new Array(len).fill(25);
  if (len > 28) {
    const plusDMs: number[] = new Array(len).fill(0);
    const minusDMs: number[] = new Array(len).fill(0);
    const trs: number[] = new Array(len).fill(0);
    trs[0] = highs[0] - lows[0];

    for (let i = 1; i < len; i++) {
      const hDiff = highs[i] - highs[i - 1];
      const lDiff = lows[i - 1] - lows[i];
      plusDMs[i] = hDiff > lDiff && hDiff > 0 ? hDiff : 0;
      minusDMs[i] = lDiff > hDiff && lDiff > 0 ? lDiff : 0;
      trs[i] = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
    }

    let smoothTR = 0;
    let smoothPlusDM = 0;
    let smoothMinusDM = 0;
    for (let i = 1; i <= 14; i++) {
      smoothTR += trs[i];
      smoothPlusDM += plusDMs[i];
      smoothMinusDM += minusDMs[i];
    }

    const dx: number[] = new Array(len).fill(25);
    for (let i = 14; i < len; i++) {
      if (i > 14) {
        smoothTR = smoothTR - smoothTR / 14 + trs[i];
        smoothPlusDM = smoothPlusDM - smoothPlusDM / 14 + plusDMs[i];
        smoothMinusDM = smoothMinusDM - smoothMinusDM / 14 + minusDMs[i];
      }
      const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
      const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
      const diSum = plusDI + minusDI;
      dx[i] = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    }

    let adxSum = 0;
    for (let i = 14; i < 28; i++) {
      adxSum += dx[i];
    }
    let currentAdx = adxSum / 14;
    adx[27] = Math.round(currentAdx * 100) / 100;

    for (let i = 28; i < len; i++) {
      currentAdx = (currentAdx * 13 + dx[i]) / 14;
      adx[i] = Math.round(currentAdx * 100) / 100;
    }
  }

  // Stochastic (14, 3, 3) in O(N)
  const stochK: number[] = new Array(len).fill(50);
  const stochD: number[] = new Array(len).fill(50);
  for (let i = 0; i < len; i++) {
    if (i >= 13) {
      let minLow = lows[i];
      let maxHigh = highs[i];
      for (let j = 0; j < 14; j++) {
        if (lows[i - j] < minLow) minLow = lows[i - j];
        if (highs[i - j] > maxHigh) maxHigh = highs[i - j];
      }
      const range = maxHigh - minLow;
      stochK[i] = range > 0 ? Math.round((((closes[i] - minLow) / range) * 100) * 10) / 10 : 50;
    }
    if (i >= 15) {
      stochD[i] = Math.round(((stochK[i] + stochK[i - 1] + stochK[i - 2]) / 3) * 10) / 10;
    } else {
      stochD[i] = stochK[i];
    }
  }

  // Rolling 20-period volume average in O(N)
  const volumeAvg20: number[] = new Array(len);
  let volSum = 0;
  for (let i = 0; i < len; i++) {
    volSum += klines[i].volume;
    if (i >= 20) volSum -= klines[i - 20].volume;
    volumeAvg20[i] = volSum / Math.min(i + 1, 20);
  }

  // VWAP in O(N)
  const vwap: number[] = new Array(len);
  let cumTPV = 0;
  let cumVol = 0;
  for (let i = 0; i < len; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * klines[i].volume;
    cumVol += klines[i].volume;
    vwap[i] = cumVol > 0 ? cumTPV / cumVol : closes[i];
  }

  // Vector of TechnicalIndicators at index i
  const vector: TechnicalIndicators[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const c = closes[i];
    const lookback = Math.max(0, i - 20);
    let minLow = lows[i];
    let maxHigh = highs[i];
    for (let k = lookback; k <= i; k++) {
      if (lows[k] < minLow) minLow = lows[k];
      if (highs[k] > maxHigh) maxHigh = highs[k];
    }

    const e20 = ema20[i] || c;
    const e50 = ema50[i] || c;
    const e200 = ema200[i] || c;
    const isUptrend = e20 > e50 && c > e50;
    const isDowntrend = e20 < e50 && c < e50;
    const trend = isUptrend ? 'UPTREND' : isDowntrend ? 'DOWNTREND' : 'RANGING';
    const isHigher = i > 0 && highs[i] > highs[i - 1] && lows[i] > lows[i - 1];
    const isLower = i > 0 && lows[i] < lows[i - 1] && highs[i] < highs[i - 1];
    const structure = isHigher ? 'HIGHER_HIGH' : isLower ? 'LOWER_LOW' : 'RANGE';

    vector[i] = {
      ema20: e20,
      ema50: e50,
      ema100: ema100[i] || c,
      ema200: e200,
      sma200: sma200[i] || c,
      rsi14: rsi[i] || 50,
      stoch: {
        k: stochK[i],
        d: stochD[i],
      },
      macd: {
        macdLine: Math.round((macdLine[i] || 0) * 100) / 100,
        signalLine: Math.round((signalLine[i] || 0) * 100) / 100,
        histogram: Math.round((histogram[i] || 0) * 100) / 100,
      },
      bollingerBands: {
        upper: Math.round((bbUpper[i] || c * 1.02) * 100) / 100,
        middle: Math.round((bbMiddle[i] || c) * 100) / 100,
        lower: Math.round((bbLower[i] || c * 0.98) * 100) / 100,
        bandwidthPercent: Math.round((bbBw[i] || 4) * 100) / 100,
      },
      atr14: Math.max(0.000001, atr[i] || c * 0.01),
      adx14: adx[i] || 25,
      volume: klines[i].volume,
      volumeAvg20: volumeAvg20[i] || klines[i].volume,
      vwap: vwap[i] || c,
      obv: 0,
      supportLevels: [Math.round(minLow * 100) / 100],
      resistanceLevels: [Math.round(maxHigh * 100) / 100],
      liquidityZones: {
        buySide: [Math.round(minLow * 0.99 * 100) / 100],
        sellSide: [Math.round(maxHigh * 1.01 * 100) / 100],
      },
      marketStructure: {
        trend,
        structure,
        swingHigh: maxHigh,
        swingLow: minLow,
        bos: isHigher ? 'BULLISH_BOS' : isLower ? 'BEARISH_BOS' : 'NONE',
        choch: 'NONE',
      },
    };
  }

  return vector;
}

/**
 * Downsample equity curve to a maximum number of points for silky smooth UI rendering
 */
function downsampleEquityCurve(points: EquityDataPoint[], maxPoints = 120): EquityDataPoint[] {
  if (points.length <= maxPoints) return points;
  const result: EquityDataPoint[] = [];
  const step = (points.length - 1) / (maxPoints - 1);

  result.push(points[0]);
  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.round(i * step);
    if (points[idx]) {
      result.push(points[idx]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

interface EvaluatedSignal {
  decision: 'LONG' | 'SHORT' | 'WAIT';
  confidence: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  reason: string;
  strategyId: BacktestStrategyId;
  strategyName: string;
}

/**
 * Strategy-specific signal evaluation for the 6 core strategies
 */
function evaluateSingleStrategy(
  targetStrategyId: BacktestStrategyId,
  currentPrice: number,
  inds: TechnicalIndicators,
  riskRewardTarget: number,
  slAtrMultiplier: number,
  isFutures: boolean
): EvaluatedSignal | null {
  const atr = Math.max(inds.atr14, currentPrice * 0.005);
  const rsi = inds.rsi14 || 50;
  const ema20 = inds.ema20 || currentPrice;
  const ema50 = inds.ema50 || currentPrice;
  const ema200 = inds.ema200 || currentPrice;
  const adx = inds.adx14 || 20;
  const bb = inds.bollingerBands;
  const stoch = inds.stoch || { k: 50, d: 50 };
  const ms = inds.marketStructure;

  switch (targetStrategyId) {
    case 'MOMENTUM': {
      // Trend following: EMA 20/50 alignment, ADX > 18, RSI 48-72 / 28-52
      const isBullish = currentPrice > ema20 && ema20 > ema50 && adx >= 18;
      const isBearish = currentPrice < ema20 && ema20 < ema50 && adx >= 18;

      if (isBullish && rsi >= 48 && rsi <= 72) {
        const rawSl = Math.min(ema50, currentPrice - atr * slAtrMultiplier);
        const stopLoss = rawSl < currentPrice ? rawSl : currentPrice - Math.max(atr * slAtrMultiplier, currentPrice * 0.008);
        const risk = currentPrice - stopLoss;
        return {
          decision: 'LONG',
          confidence: Math.min(94, Math.round(66 + (adx - 18) * 1.2 + (rsi - 50) * 0.4)),
          stopLoss,
          tp1: currentPrice + risk * 1.2,
          tp2: currentPrice + risk * riskRewardTarget,
          tp3: currentPrice + risk * (riskRewardTarget * 1.75),
          reason: 'Momentum Trend: EMA alignment (20>50) with strong ADX & bullish RSI',
          strategyId: 'MOMENTUM',
          strategyName: 'Momentum Grid',
        };
      } else if (isFutures && isBearish && rsi <= 52 && rsi >= 28) {
        const rawSl = Math.max(ema50, currentPrice + atr * slAtrMultiplier);
        const stopLoss = rawSl > currentPrice ? rawSl : currentPrice + Math.max(atr * slAtrMultiplier, currentPrice * 0.008);
        const risk = stopLoss - currentPrice;
        return {
          decision: 'SHORT',
          confidence: Math.min(94, Math.round(66 + (adx - 18) * 1.2 + (50 - rsi) * 0.4)),
          stopLoss,
          tp1: currentPrice - risk * 1.2,
          tp2: currentPrice - risk * riskRewardTarget,
          tp3: Math.max(currentPrice * 0.05, currentPrice - risk * (riskRewardTarget * 1.75)),
          reason: 'Momentum Trend: Bearish EMA alignment (20<50) with high ADX',
          strategyId: 'MOMENTUM',
          strategyName: 'Momentum Grid',
        };
      }
      break;
    }

    case 'SCALPER': {
      // HFT Micro Scalper: Stoch < 25 / > 75 with RSI confirmation near Bollinger bands
      const isOversold = (stoch.k < 28 && stoch.k > stoch.d && rsi <= 46) || (rsi <= 35 && currentPrice <= bb.lower * 1.006);
      const isOverbought = (stoch.k > 72 && stoch.k < stoch.d && rsi >= 54) || (rsi >= 65 && currentPrice >= bb.upper * 0.994);

      if (isOversold) {
        const risk = Math.max(atr * 0.85 * (slAtrMultiplier / 1.5), currentPrice * 0.006);
        const stopLoss = currentPrice - risk;
        return {
          decision: 'LONG',
          confidence: Math.min(92, Math.round(70 + (30 - stoch.k) * 0.7)),
          stopLoss,
          tp1: currentPrice + risk * 1.2,
          tp2: currentPrice + risk * Math.max(1.5, riskRewardTarget * 0.85),
          tp3: currentPrice + risk * (riskRewardTarget * 1.5),
          reason: 'HFT Scalper: Oversold oscillator bounce (Stoch & RSI) near Lower BB',
          strategyId: 'SCALPER',
          strategyName: 'HFT Scalper',
        };
      } else if (isFutures && isOverbought) {
        const risk = Math.max(atr * 0.85 * (slAtrMultiplier / 1.5), currentPrice * 0.006);
        const stopLoss = currentPrice + risk;
        return {
          decision: 'SHORT',
          confidence: Math.min(92, Math.round(70 + (stoch.k - 70) * 0.7)),
          stopLoss,
          tp1: currentPrice - risk * 1.2,
          tp2: currentPrice - risk * Math.max(1.5, riskRewardTarget * 0.85),
          tp3: Math.max(currentPrice * 0.05, currentPrice - risk * (riskRewardTarget * 1.5)),
          reason: 'HFT Scalper: Overbought oscillator rejection near Upper BB',
          strategyId: 'SCALPER',
          strategyName: 'HFT Scalper',
        };
      }
      break;
    }

    case 'SWING': {
      // Conservative Swing: Price > EMA50 > EMA200 with wider stops & high reward
      const isSwingBullish = currentPrice > ema50 && ema50 > ema200 && adx >= 18 && rsi >= 45 && rsi <= 68;
      const isSwingBearish = currentPrice < ema50 && ema50 < ema200 && adx >= 18 && rsi >= 32 && rsi <= 55;

      if (isSwingBullish) {
        const rawSl = Math.min(ema200, currentPrice - atr * 2.0 * (slAtrMultiplier / 1.5));
        const stopLoss = rawSl < currentPrice ? rawSl : currentPrice - Math.max(atr * 2.0, currentPrice * 0.015);
        const risk = currentPrice - stopLoss;
        return {
          decision: 'LONG',
          confidence: 86,
          stopLoss,
          tp1: currentPrice + risk * 1.5,
          tp2: currentPrice + risk * Math.max(2.5, riskRewardTarget * 1.25),
          tp3: currentPrice + risk * (riskRewardTarget * 2.2),
          reason: 'Conservative Swing: HTF trend alignment (Price > EMA50 > EMA200)',
          strategyId: 'SWING',
          strategyName: 'Swing Trend',
        };
      } else if (isFutures && isSwingBearish) {
        const rawSl = Math.max(ema200, currentPrice + atr * 2.0 * (slAtrMultiplier / 1.5));
        const stopLoss = rawSl > currentPrice ? rawSl : currentPrice + Math.max(atr * 2.0, currentPrice * 0.015);
        const risk = stopLoss - currentPrice;
        return {
          decision: 'SHORT',
          confidence: 86,
          stopLoss,
          tp1: currentPrice - risk * 1.5,
          tp2: currentPrice - risk * Math.max(2.5, riskRewardTarget * 1.25),
          tp3: Math.max(currentPrice * 0.05, currentPrice - risk * (riskRewardTarget * 2.2)),
          reason: 'Conservative Swing: Bearish HTF alignment (Price < EMA50 < EMA200)',
          strategyId: 'SWING',
          strategyName: 'Swing Trend',
        };
      }
      break;
    }

    case 'BREAKOUT': {
      // Volatility Breakout: Bollinger bandwidth expansion > 2.8% piercing envelope
      const isBandwidthExpanding = bb.bandwidthPercent > 2.8;
      if (isBandwidthExpanding && currentPrice >= bb.upper && rsi >= 56) {
        const rawSl = Math.min(bb.middle, currentPrice - atr * 1.2 * (slAtrMultiplier / 1.5));
        const stopLoss = rawSl < currentPrice ? rawSl : currentPrice - Math.max(atr * 1.2, currentPrice * 0.008);
        const risk = currentPrice - stopLoss;
        return {
          decision: 'LONG',
          confidence: Math.min(94, Math.round(72 + bb.bandwidthPercent * 1.8)),
          stopLoss,
          tp1: currentPrice + risk * 1.4,
          tp2: currentPrice + risk * (riskRewardTarget * 1.2),
          tp3: currentPrice + risk * (riskRewardTarget * 2.0),
          reason: `Volatility Breakout: BB bandwidth (${bb.bandwidthPercent.toFixed(1)}%) expansion piercing upper band`,
          strategyId: 'BREAKOUT',
          strategyName: 'Volatility Breakout',
        };
      } else if (isFutures && isBandwidthExpanding && currentPrice <= bb.lower && rsi <= 44) {
        const rawSl = Math.max(bb.middle, currentPrice + atr * 1.2 * (slAtrMultiplier / 1.5));
        const stopLoss = rawSl > currentPrice ? rawSl : currentPrice + Math.max(atr * 1.2, currentPrice * 0.008);
        const risk = stopLoss - currentPrice;
        return {
          decision: 'SHORT',
          confidence: Math.min(94, Math.round(72 + bb.bandwidthPercent * 1.8)),
          stopLoss,
          tp1: currentPrice - risk * 1.4,
          tp2: currentPrice - risk * (riskRewardTarget * 1.2),
          tp3: Math.max(currentPrice * 0.05, currentPrice - risk * (riskRewardTarget * 2.0)),
          reason: `Volatility Breakout: BB bandwidth (${bb.bandwidthPercent.toFixed(1)}%) downward expansion piercing lower band`,
          strategyId: 'BREAKOUT',
          strategyName: 'Volatility Breakout',
        };
      }
      break;
    }

    case 'MEAN_REVERSION': {
      // Mean Reversion: Statistical extreme reversal towards EMA20 / BB Middle
      if (currentPrice <= bb.lower || (rsi < 30 && currentPrice < ema20)) {
        const risk = Math.max(atr * 1.1 * (slAtrMultiplier / 1.5), currentPrice * 0.007);
        const stopLoss = currentPrice - risk;
        const tp1 = Math.max(currentPrice + risk * 1.2, ema20 > currentPrice ? ema20 : currentPrice + risk * 1.2);
        const tp2 = Math.max(tp1 + risk * 0.8, bb.middle > tp1 ? bb.middle : tp1 + risk * 0.8);
        const tp3 = Math.max(tp2 + risk * 1.0, bb.upper > tp2 ? bb.upper : tp2 + risk * 1.0);
        return {
          decision: 'LONG',
          confidence: Math.min(90, Math.round(68 + (30 - rsi) * 0.9)),
          stopLoss,
          tp1,
          tp2,
          tp3,
          reason: `Mean Reversion: Extreme deviation below Lower BB / RSI ${rsi.toFixed(1)} targeting EMA20`,
          strategyId: 'MEAN_REVERSION',
          strategyName: 'Mean Reversion',
        };
      } else if (isFutures && (currentPrice >= bb.upper || (rsi > 70 && currentPrice > ema20))) {
        const risk = Math.max(atr * 1.1 * (slAtrMultiplier / 1.5), currentPrice * 0.007);
        const stopLoss = currentPrice + risk;
        const tp1 = Math.min(currentPrice - risk * 1.2, ema20 < currentPrice ? ema20 : currentPrice - risk * 1.2);
        const tp2 = Math.min(tp1 - risk * 0.8, bb.middle < tp1 ? bb.middle : tp1 - risk * 0.8);
        const tp3 = Math.max(currentPrice * 0.05, Math.min(tp2 - risk * 1.0, bb.lower < tp2 ? bb.lower : tp2 - risk * 1.0));
        return {
          decision: 'SHORT',
          confidence: Math.min(90, Math.round(68 + (rsi - 70) * 0.9)),
          stopLoss,
          tp1,
          tp2,
          tp3,
          reason: `Mean Reversion: Extreme deviation above Upper BB / RSI ${rsi.toFixed(1)} targeting EMA20`,
          strategyId: 'MEAN_REVERSION',
          strategyName: 'Mean Reversion',
        };
      }
      break;
    }

    case 'INSTITUTIONAL_SMC': {
      // Institutional SMC: Market structure (BOS / CHoCH) + Liquidity sweeps
      const isSmcBullish = (ms.trend === 'UPTREND' || ms.structure === 'HIGHER_HIGH' || ms.bos === 'BULLISH_BOS') && currentPrice > ema50 && rsi >= 46;
      const isSmcBearish = (ms.trend === 'DOWNTREND' || ms.structure === 'LOWER_LOW' || ms.bos === 'BEARISH_BOS') && currentPrice < ema50 && rsi <= 54;

      if (isSmcBullish) {
        const risk = Math.max(atr * 1.35 * (slAtrMultiplier / 1.5), currentPrice * 0.01);
        const stopLoss = currentPrice - risk;
        return {
          decision: 'LONG',
          confidence: 84,
          stopLoss,
          tp1: currentPrice + risk * 1.6,
          tp2: currentPrice + risk * Math.max(2.4, riskRewardTarget * 1.2),
          tp3: currentPrice + risk * (riskRewardTarget * 2.0),
          reason: 'Institutional SMC: Bullish structure break (BOS) with discount liquidity pool mitigation',
          strategyId: 'INSTITUTIONAL_SMC',
          strategyName: 'Institutional SMC',
        };
      } else if (isFutures && isSmcBearish) {
        const risk = Math.max(atr * 1.35 * (slAtrMultiplier / 1.5), currentPrice * 0.01);
        const stopLoss = currentPrice + risk;
        return {
          decision: 'SHORT',
          confidence: 84,
          stopLoss,
          tp1: currentPrice - risk * 1.6,
          tp2: currentPrice - risk * Math.max(2.4, riskRewardTarget * 1.2),
          tp3: Math.max(currentPrice * 0.05, currentPrice - risk * (riskRewardTarget * 2.0)),
          reason: 'Institutional SMC: Bearish structure break (BOS) with premium liquidity mitigation',
          strategyId: 'INSTITUTIONAL_SMC',
          strategyName: 'Institutional SMC',
        };
      }
      break;
    }

    default:
      return null;
  }

  return null;
}

/**
 * Evaluates entry signal for selected strategy or multi-strategy ensemble
 */
function evaluateStrategyEntrySignal(
  strategyId: BacktestStrategyId = 'ALL_STRATEGIES',
  currentPrice: number,
  inds: TechnicalIndicators,
  minSignalStrength: number,
  riskRewardTarget: number,
  slAtrMultiplier: number,
  isFutures: boolean
): EvaluatedSignal | null {
  if (strategyId !== 'ALL_STRATEGIES') {
    const single = evaluateSingleStrategy(strategyId, currentPrice, inds, riskRewardTarget, slAtrMultiplier, isFutures);
    if (single && single.confidence >= minSignalStrength) {
      return single;
    }
    return null;
  }

  // ALL_STRATEGIES Ensemble: evaluate all 6 and select the highest confidence signal
  const activeIds: BacktestStrategyId[] = [
    'MOMENTUM',
    'SCALPER',
    'SWING',
    'BREAKOUT',
    'MEAN_REVERSION',
    'INSTITUTIONAL_SMC',
  ];

  let bestSignal: EvaluatedSignal | null = null;
  let highestConfidence = 0;

  for (const id of activeIds) {
    const sig = evaluateSingleStrategy(id, currentPrice, inds, riskRewardTarget, slAtrMultiplier, isFutures);
    if (sig && sig.confidence >= minSignalStrength && sig.confidence > highestConfidence) {
      highestConfidence = sig.confidence;
      bestSignal = sig;
    }
  }

  return bestSignal;
}

/**
 * Executes a deterministic historical backtest on actual Binance candles with capital & leverage modeling
 */
export function runHistoricalBacktest(
  klines: KlineCandle[],
  config: BacktestConfig = DEFAULT_BACKTEST_CONFIG,
  symbol: string = 'BTCUSDT'
): BacktestResult {
  const {
    timeframe = '1h',
    candleLimit = 1000,
    riskRewardTarget = 2.0,
    minSignalStrength = 65,
    slAtrMultiplier = 1.5,
    initialBalance = 1000,
    leverage = 3,
    tradeAllocationPercent = 20,
    marketType = 'FUTURES',
    strategyId = 'ALL_STRATEGIES',
    trailingStopEnabled = true,
    trailingStopPercent = 1.2,
    trailingActivationProfitPercent = 1.5,
    feeRatePercent = 0.05,
    slippagePercent = 0.02,
  } = config;

  const isFutures = marketType === 'FUTURES';
  const effectiveLeverage = isFutures ? Math.max(1, Math.min(50, leverage)) : 1;
  const combinedFeeRate = ((feeRatePercent || 0.05) + (slippagePercent || 0.02)) / 100;

  const slice = klines.slice(-Math.min(klines.length, candleLimit));
  if (slice.length < 35) {
    return {
      symbol,
      config,
      initialBalance,
      finalBalance: initialBalance,
      netProfitUsdt: 0,
      netReturnPercent: 0,
      maxDrawdownPercent: 0,
      maxDrawdownUsdt: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      lossRate: 0,
      profitFactor: 0,
      averageRR: riskRewardTarget,
      expectancy: 0,
      avgWinUsdt: 0,
      avgLossUsdt: 0,
      tp1Rate: 0,
      tp2Rate: 0,
      tp3Rate: 0,
      slRate: 0,
      trades: [],
      equityCurve: [],
      sharpeRatio: 0,
      sortinoRatio: 0,
      totalFeesUsdt: 0,
    };
  }

  // Pre-calculate vectorized indicators in linear O(N) time
  const indicatorsVector = precalculateVectorizedIndicators(slice);

  const trades: BacktestTrade[] = [];
  let inTrade = false;
  let activeTrade: {
    entryTime: number;
    entryCandleIndex: number;
    tp1Reached: boolean;
    tp2Reached: boolean;
    initialMargin: number;
    remainingMargin: number;
    realizedPnlUsdt: number;
    peakPrice: number;
    isTrailingActive: boolean;
    totalFeeUsdt: number;
    strategyId?: BacktestStrategyId;
    strategyName?: string;
  } | null = null;

  let activeType: 'LONG' | 'SHORT' = 'LONG';
  let activeEntryPrice = 0;
  let activeSL = 0;
  let activeTP1 = 0;
  let activeTP2 = 0;
  let activeTP3 = 0;
  let activeLiquidationPrice = 0;

  let currentBalance = Math.max(10, initialBalance);
  let peakBalance = currentBalance;
  let maxDrawdownUsdt = 0;
  let maxDrawdownPercent = 0;

  let totalGrossProfitUsdt = 0;
  let totalGrossLossUsdt = 0;
  let totalFeesAccumulated = 0;

  let tp1Hits = 0;
  let tp2Hits = 0;
  let tp3Hits = 0;
  let slHits = 0;

  const rawEquityCurve: EquityDataPoint[] = [];
  const initialCandle = slice[30] || slice[0];
  const initialClose = initialCandle.close;

  rawEquityCurve.push({
    timestamp: initialCandle.time * 1000,
    botReturn: 0,
    botEquityUsdt: currentBalance,
    buyHoldReturn: 0,
    buyHoldEquityUsdt: initialBalance,
  });

  // Step through candles starting after initial indicator warm-up (30 candles)
  for (let i = 30; i < slice.length - 1; i++) {
    const currentCandle = slice[i];
    const nextCandle = slice[i + 1];

    if (inTrade && activeTrade) {
      const { high, low, close, time } = nextCandle;
      const isLong = activeType === 'LONG';

      // 1. Trailing Stop Loss Updates on Intra-bar Extremes
      if (trailingStopEnabled) {
        const trailGap = (trailingStopPercent || 1.2) / 100;
        const activationPct = trailingActivationProfitPercent || 1.5;

        if (isLong) {
          const barPeak = Math.max(activeTrade.peakPrice, high);
          activeTrade.peakPrice = barPeak;
          const currentGainPct = ((barPeak - activeEntryPrice) / activeEntryPrice) * 100;

          if (currentGainPct >= activationPct || activeTrade.tp1Reached) {
            const trailingSl = barPeak * (1 - trailGap);
            if (trailingSl > activeSL) {
              activeSL = trailingSl;
              activeTrade.isTrailingActive = true;
            }
          }
        } else {
          const barTrough = Math.min(activeTrade.peakPrice, low);
          activeTrade.peakPrice = barTrough;
          const currentGainPct = ((activeEntryPrice - barTrough) / activeEntryPrice) * 100;

          if (currentGainPct >= activationPct || activeTrade.tp1Reached) {
            const trailingSl = barTrough * (1 + trailGap);
            if (trailingSl < activeSL) {
              activeSL = trailingSl;
              activeTrade.isTrailingActive = true;
            }
          }
        }
      }

      // 2. Check Liquidation First (Futures only)
      let liquidated = false;
      if (isFutures && activeLiquidationPrice > 0) {
        if ((isLong && low <= activeLiquidationPrice) || (!isLong && high >= activeLiquidationPrice)) {
          liquidated = true;
          const lostMargin = activeTrade.remainingMargin;
          const exitFee = (lostMargin * effectiveLeverage) * combinedFeeRate;
          const finalTradePnl = activeTrade.realizedPnlUsdt - lostMargin - exitFee;
          activeTrade.totalFeeUsdt += exitFee;
          totalFeesAccumulated += activeTrade.totalFeeUsdt;

          currentBalance = Math.max(0, currentBalance - exitFee);
          totalGrossLossUsdt += Math.abs(finalTradePnl);
          slHits++;

          const roePercent = ((finalTradePnl) / activeTrade.initialMargin) * 100;
          trades.push({
            id: `bt-${symbol}-${trades.length + 1}`,
            symbol,
            strategyId: activeTrade.strategyId,
            strategyName: activeTrade.strategyName,
            entryTime: activeTrade.entryTime,
            exitTime: time,
            type: activeType,
            entryPrice: activeEntryPrice,
            exitPrice: activeLiquidationPrice,
            stopLoss: activeSL,
            tp1: activeTP1,
            tp2: activeTP2,
            tp3: activeTP3,
            result: 'LIQUIDATED',
            exitReason: 'Futures Liquidation hit (-100% margin)',
            pnlPercent: Math.round(roePercent * 100) / 100,
            pnlUsdt: Math.round(finalTradePnl * 100) / 100,
            balanceAfter: Math.round(currentBalance * 100) / 100,
            rMultiple: -1.0,
            feeUsdt: Math.round(activeTrade.totalFeeUsdt * 100) / 100,
            durationCandles: i - activeTrade.entryCandleIndex + 1,
          });

          inTrade = false;
          activeTrade = null;
        }
      }

      if (!liquidated && inTrade && activeTrade) {
        // Multi-stage Partial Take Profit Execution
        if (isLong) {
          // Check TP1
          if (!activeTrade.tp1Reached && high >= activeTP1) {
            activeTrade.tp1Reached = true;
            tp1Hits++;
            const marginPortion = activeTrade.initialMargin * 0.5;
            const priceGainPct = ((activeTP1 - activeEntryPrice) / activeEntryPrice) * 100;
            const gainUsdt = marginPortion * (priceGainPct * effectiveLeverage / 100);
            const exitFee = (marginPortion * effectiveLeverage) * combinedFeeRate;
            const netPartialGain = gainUsdt - exitFee;

            activeTrade.realizedPnlUsdt += netPartialGain;
            activeTrade.remainingMargin -= marginPortion;
            activeTrade.totalFeeUsdt += exitFee;
            currentBalance += marginPortion + netPartialGain;

            // Move SL to Breakeven (entry price) to protect remaining 50%
            activeSL = Math.max(activeSL, activeEntryPrice);
          }

          // Check TP2 (50% of remaining = 25% of initial)
          if (activeTrade.tp1Reached && !activeTrade.tp2Reached && high >= activeTP2) {
            activeTrade.tp2Reached = true;
            tp2Hits++;
            const marginPortion = activeTrade.initialMargin * 0.25;
            const priceGainPct = ((activeTP2 - activeEntryPrice) / activeEntryPrice) * 100;
            const gainUsdt = marginPortion * (priceGainPct * effectiveLeverage / 100);
            const exitFee = (marginPortion * effectiveLeverage) * combinedFeeRate;
            const netPartialGain = gainUsdt - exitFee;

            activeTrade.realizedPnlUsdt += netPartialGain;
            activeTrade.remainingMargin -= marginPortion;
            activeTrade.totalFeeUsdt += exitFee;
            currentBalance += marginPortion + netPartialGain;

            // Lock in TP1 price as trailing floor
            activeSL = Math.max(activeSL, activeTP1);
          }

          // Check TP3 (Final remaining 25%)
          if (high >= activeTP3) {
            tp3Hits++;
            const marginPortion = activeTrade.remainingMargin;
            const priceGainPct = ((activeTP3 - activeEntryPrice) / activeEntryPrice) * 100;
            const gainUsdt = marginPortion * (priceGainPct * effectiveLeverage / 100);
            const exitFee = (marginPortion * effectiveLeverage) * combinedFeeRate;
            const netFinalGain = gainUsdt - exitFee;

            activeTrade.realizedPnlUsdt += netFinalGain;
            activeTrade.totalFeeUsdt += exitFee;
            currentBalance += marginPortion + netFinalGain;
            totalFeesAccumulated += activeTrade.totalFeeUsdt;

            const totalTradePnl = activeTrade.realizedPnlUsdt;
            if (totalTradePnl >= 0) totalGrossProfitUsdt += totalTradePnl;
            else totalGrossLossUsdt += Math.abs(totalTradePnl);

            const roePercent = (totalTradePnl / activeTrade.initialMargin) * 100;

            trades.push({
              id: `bt-${symbol}-${trades.length + 1}`,
              symbol,
              strategyId: activeTrade.strategyId,
              strategyName: activeTrade.strategyName,
              entryTime: activeTrade.entryTime,
              exitTime: time,
              type: 'LONG',
              entryPrice: activeEntryPrice,
              exitPrice: activeTP3,
              stopLoss: activeSL,
              tp1: activeTP1,
              tp2: activeTP2,
              tp3: activeTP3,
              result: 'TP3_WIN',
              exitReason: 'Full TP3 Target Hit (Scale-out Complete)',
              pnlPercent: Math.round(roePercent * 100) / 100,
              pnlUsdt: Math.round(totalTradePnl * 100) / 100,
              balanceAfter: Math.round(currentBalance * 100) / 100,
              rMultiple: Math.round((riskRewardTarget * 1.5) * 100) / 100,
              feeUsdt: Math.round(activeTrade.totalFeeUsdt * 100) / 100,
              durationCandles: i - activeTrade.entryCandleIndex + 1,
            });

            inTrade = false;
            activeTrade = null;
          } else if (low <= activeSL) {
            // Stop Loss triggered
            slHits++;
            const marginPortion = activeTrade.remainingMargin;
            const priceDiffPct = ((activeSL - activeEntryPrice) / activeEntryPrice) * 100;
            const pnlUsdt = marginPortion * (priceDiffPct * effectiveLeverage / 100);
            const exitFee = (marginPortion * effectiveLeverage) * combinedFeeRate;
            const netRemainingPnl = pnlUsdt - exitFee;

            const returnedAmount = Math.max(0, marginPortion + netRemainingPnl);
            const actualRealizedPnl = returnedAmount - marginPortion;

            activeTrade.realizedPnlUsdt += actualRealizedPnl;
            activeTrade.totalFeeUsdt += exitFee;
            currentBalance += returnedAmount;
            totalFeesAccumulated += activeTrade.totalFeeUsdt;

            const totalTradePnl = activeTrade.realizedPnlUsdt;
            if (totalTradePnl >= 0) totalGrossProfitUsdt += totalTradePnl;
            else totalGrossLossUsdt += Math.abs(totalTradePnl);

            const roePercent = (totalTradePnl / activeTrade.initialMargin) * 100;
            let resType: BacktestTrade['result'] = 'SL_LOSS';
            let exitReason = 'Initial Stop Loss Hit';

            if (totalTradePnl > 0) {
              if (activeTrade.isTrailingActive) {
                resType = 'TRAILING_SL_WIN';
                exitReason = 'Trailing Stop Hit - Accrued Profits Locked';
              } else if (activeTrade.tp1Reached) {
                resType = 'TP1_WIN';
                exitReason = 'TP1 Profit Secured + Breakeven Exit on Remainder';
              }
            } else if (activeTrade.tp1Reached) {
              resType = 'BREAKEVEN_SL';
              exitReason = 'Breakeven Stop Hit after TP1';
            }

            trades.push({
              id: `bt-${symbol}-${trades.length + 1}`,
              symbol,
              strategyId: activeTrade.strategyId,
              strategyName: activeTrade.strategyName,
              entryTime: activeTrade.entryTime,
              exitTime: time,
              type: 'LONG',
              entryPrice: activeEntryPrice,
              exitPrice: activeSL,
              stopLoss: activeSL,
              tp1: activeTP1,
              tp2: activeTP2,
              tp3: activeTP3,
              result: resType,
              exitReason,
              pnlPercent: Math.round(roePercent * 100) / 100,
              pnlUsdt: Math.round(totalTradePnl * 100) / 100,
              balanceAfter: Math.round(currentBalance * 100) / 100,
              rMultiple: totalTradePnl >= 0 ? 1.0 : -1.0,
              feeUsdt: Math.round(activeTrade.totalFeeUsdt * 100) / 100,
              durationCandles: i - activeTrade.entryCandleIndex + 1,
            });

            inTrade = false;
            activeTrade = null;
          }
        } else if (isFutures) {
          // SHORT Position Scale-Out Execution
          if (!activeTrade.tp1Reached && low <= activeTP1) {
            activeTrade.tp1Reached = true;
            tp1Hits++;
            const marginPortion = activeTrade.initialMargin * 0.5;
            const priceGainPct = ((activeEntryPrice - activeTP1) / activeEntryPrice) * 100;
            const gainUsdt = marginPortion * (priceGainPct * effectiveLeverage / 100);
            const exitFee = (marginPortion * effectiveLeverage) * combinedFeeRate;
            const netPartialGain = gainUsdt - exitFee;

            activeTrade.realizedPnlUsdt += netPartialGain;
            activeTrade.remainingMargin -= marginPortion;
            activeTrade.totalFeeUsdt += exitFee;
            currentBalance += marginPortion + netPartialGain;

            activeSL = Math.min(activeSL, activeEntryPrice);
          }

          if (activeTrade.tp1Reached && !activeTrade.tp2Reached && low <= activeTP2) {
            activeTrade.tp2Reached = true;
            tp2Hits++;
            const marginPortion = activeTrade.initialMargin * 0.25;
            const priceGainPct = ((activeEntryPrice - activeTP2) / activeEntryPrice) * 100;
            const gainUsdt = marginPortion * (priceGainPct * effectiveLeverage / 100);
            const exitFee = (marginPortion * effectiveLeverage) * combinedFeeRate;
            const netPartialGain = gainUsdt - exitFee;

            activeTrade.realizedPnlUsdt += netPartialGain;
            activeTrade.remainingMargin -= marginPortion;
            activeTrade.totalFeeUsdt += exitFee;
            currentBalance += marginPortion + netPartialGain;

            activeSL = Math.min(activeSL, activeTP1);
          }

          if (low <= activeTP3) {
            tp3Hits++;
            const marginPortion = activeTrade.remainingMargin;
            const priceGainPct = ((activeEntryPrice - activeTP3) / activeEntryPrice) * 100;
            const gainUsdt = marginPortion * (priceGainPct * effectiveLeverage / 100);
            const exitFee = (marginPortion * effectiveLeverage) * combinedFeeRate;
            const netFinalGain = gainUsdt - exitFee;

            activeTrade.realizedPnlUsdt += netFinalGain;
            activeTrade.totalFeeUsdt += exitFee;
            currentBalance += marginPortion + netFinalGain;
            totalFeesAccumulated += activeTrade.totalFeeUsdt;

            const totalTradePnl = activeTrade.realizedPnlUsdt;
            if (totalTradePnl >= 0) totalGrossProfitUsdt += totalTradePnl;
            else totalGrossLossUsdt += Math.abs(totalTradePnl);

            const roePercent = (totalTradePnl / activeTrade.initialMargin) * 100;

            trades.push({
              id: `bt-${symbol}-${trades.length + 1}`,
              symbol,
              strategyId: activeTrade.strategyId,
              strategyName: activeTrade.strategyName,
              entryTime: activeTrade.entryTime,
              exitTime: time,
              type: 'SHORT',
              entryPrice: activeEntryPrice,
              exitPrice: activeTP3,
              stopLoss: activeSL,
              tp1: activeTP1,
              tp2: activeTP2,
              tp3: activeTP3,
              result: 'TP3_WIN',
              exitReason: 'Full TP3 Short Target Hit',
              pnlPercent: Math.round(roePercent * 100) / 100,
              pnlUsdt: Math.round(totalTradePnl * 100) / 100,
              balanceAfter: Math.round(currentBalance * 100) / 100,
              rMultiple: Math.round((riskRewardTarget * 1.5) * 100) / 100,
              feeUsdt: Math.round(activeTrade.totalFeeUsdt * 100) / 100,
              durationCandles: i - activeTrade.entryCandleIndex + 1,
            });

            inTrade = false;
            activeTrade = null;
          } else if (high >= activeSL) {
            slHits++;
            const marginPortion = activeTrade.remainingMargin;
            const priceDiffPct = ((activeEntryPrice - activeSL) / activeEntryPrice) * 100;
            const pnlUsdt = marginPortion * (priceDiffPct * effectiveLeverage / 100);
            const exitFee = (marginPortion * effectiveLeverage) * combinedFeeRate;
            const netRemainingPnl = pnlUsdt - exitFee;

            const returnedAmount = Math.max(0, marginPortion + netRemainingPnl);
            const actualRealizedPnl = returnedAmount - marginPortion;

            activeTrade.realizedPnlUsdt += actualRealizedPnl;
            activeTrade.totalFeeUsdt += exitFee;
            currentBalance += returnedAmount;
            totalFeesAccumulated += activeTrade.totalFeeUsdt;

            const totalTradePnl = activeTrade.realizedPnlUsdt;
            if (totalTradePnl >= 0) totalGrossProfitUsdt += totalTradePnl;
            else totalGrossLossUsdt += Math.abs(totalTradePnl);

            const roePercent = (totalTradePnl / activeTrade.initialMargin) * 100;
            let resType: BacktestTrade['result'] = 'SL_LOSS';
            let exitReason = 'Initial Short Stop Loss Hit';

            if (totalTradePnl > 0) {
              if (activeTrade.isTrailingActive) {
                resType = 'TRAILING_SL_WIN';
                exitReason = 'Trailing Stop Hit - Accrued Profits Locked';
              } else if (activeTrade.tp1Reached) {
                resType = 'TP1_WIN';
                exitReason = 'TP1 Profit Secured + Breakeven Exit on Remainder';
              }
            } else if (activeTrade.tp1Reached) {
              resType = 'BREAKEVEN_SL';
              exitReason = 'Breakeven Stop Hit after TP1';
            }

            trades.push({
              id: `bt-${symbol}-${trades.length + 1}`,
              symbol,
              strategyId: activeTrade.strategyId,
              strategyName: activeTrade.strategyName,
              entryTime: activeTrade.entryTime,
              exitTime: time,
              type: 'SHORT',
              entryPrice: activeEntryPrice,
              exitPrice: activeSL,
              stopLoss: activeSL,
              tp1: activeTP1,
              tp2: activeTP2,
              tp3: activeTP3,
              result: resType,
              exitReason,
              pnlPercent: Math.round(roePercent * 100) / 100,
              pnlUsdt: Math.round(totalTradePnl * 100) / 100,
              balanceAfter: Math.round(currentBalance * 100) / 100,
              rMultiple: totalTradePnl >= 0 ? 1.0 : -1.0,
              feeUsdt: Math.round(activeTrade.totalFeeUsdt * 100) / 100,
              durationCandles: i - activeTrade.entryCandleIndex + 1,
            });

            inTrade = false;
            activeTrade = null;
          }
        }
      }
    }

    // Dynamic Mark-to-Market Total Portfolio Value calculation
    {
      const { close, time } = nextCandle;
      const isLong = activeType === 'LONG';
      let totalEquity = currentBalance;

      if (inTrade && activeTrade) {
        const priceDiffPct = ((close - activeEntryPrice) / activeEntryPrice) * (isLong ? 1 : -1) * 100;
        const floatingPnl = activeTrade.remainingMargin * (priceDiffPct * effectiveLeverage / 100);
        totalEquity = currentBalance + activeTrade.remainingMargin + activeTrade.realizedPnlUsdt + floatingPnl;
      }

      // Equity Curve Data Point recording
      if (i % 2 === 0 || !inTrade) {
        const botReturnPct = ((totalEquity - initialBalance) / initialBalance) * 100;
        const buyHoldReturnPct = ((close - initialClose) / initialClose) * 100;
        rawEquityCurve.push({
          timestamp: time * 1000,
          botReturn: Math.round(botReturnPct * 100) / 100,
          botEquityUsdt: Math.round(totalEquity * 100) / 100,
          buyHoldReturn: Math.round(buyHoldReturnPct * 100) / 100,
          buyHoldEquityUsdt: Math.round((initialBalance * (1 + buyHoldReturnPct / 100)) * 100) / 100,
        });
      }

      // Drawdown tracking
      if (totalEquity > peakBalance) {
        peakBalance = totalEquity;
      }
      const ddUsdt = peakBalance - totalEquity;
      const ddPct = peakBalance > 0 ? (ddUsdt / peakBalance) * 100 : 0;
      if (ddUsdt > maxDrawdownUsdt) maxDrawdownUsdt = ddUsdt;
      if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;
    }

    // Fast O(1) evaluate entry if not in trade
    if (!inTrade && currentBalance > 5) {
      try {
        const inds = indicatorsVector[i];
        if (inds) {
          const sig = evaluateStrategyEntrySignal(
            strategyId,
            currentCandle.close,
            inds,
            minSignalStrength,
            riskRewardTarget,
            slAtrMultiplier,
            isFutures
          );

          if (sig && (sig.decision === 'LONG' || (isFutures && sig.decision === 'SHORT'))) {
            const allocPct = Math.min(100, Math.max(5, tradeAllocationPercent));
            const allocatedMargin = currentBalance * (allocPct / 100);
            const entryFee = (allocatedMargin * effectiveLeverage) * combinedFeeRate;

            inTrade = true;
            activeType = sig.decision;
            activeEntryPrice = currentCandle.close;
            activeSL = sig.stopLoss;
            activeTP1 = sig.tp1;
            activeTP2 = sig.tp2;
            activeTP3 = sig.tp3;
            activeLiquidationPrice = isFutures
              ? (sig.decision === 'LONG'
                  ? activeEntryPrice * (1 - (1 / effectiveLeverage) * 0.95)
                  : activeEntryPrice * (1 + (1 / effectiveLeverage) * 0.95))
              : 0;

            currentBalance -= allocatedMargin;
            currentBalance -= entryFee;

            activeTrade = {
              entryTime: currentCandle.time,
              entryCandleIndex: i,
              tp1Reached: false,
              tp2Reached: false,
              initialMargin: allocatedMargin,
              remainingMargin: allocatedMargin,
              realizedPnlUsdt: -entryFee,
              peakPrice: activeEntryPrice,
              isTrailingActive: false,
              totalFeeUsdt: entryFee,
              strategyId: sig.strategyId,
              strategyName: sig.strategyName,
            };
          }
        }
      } catch (err) {
        // Skip malformed candle
      }
    }
  }

  const lastCandle = slice[slice.length - 1];
  const finalBotReturnPct = ((currentBalance - initialBalance) / initialBalance) * 100;
  const finalBuyHoldReturnPct = ((lastCandle.close - initialClose) / initialClose) * 100;

  rawEquityCurve.push({
    timestamp: lastCandle.time * 1000,
    botReturn: Math.round(finalBotReturnPct * 100) / 100,
    botEquityUsdt: Math.round(currentBalance * 100) / 100,
    buyHoldReturn: Math.round(finalBuyHoldReturnPct * 100) / 100,
    buyHoldEquityUsdt: Math.round((initialBalance * (1 + finalBuyHoldReturnPct / 100)) * 100) / 100,
  });

  const equityCurve = downsampleEquityCurve(rawEquityCurve, 100);

  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => t.pnlPercent > 0).length;
  const losingTrades = trades.filter((t) => t.pnlPercent <= 0).length;
  const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 1000) / 10 : 0;
  const lossRate = totalTrades > 0 ? Math.round((losingTrades / totalTrades) * 1000) / 10 : 0;

  const profitFactor =
    totalGrossLossUsdt > 0
      ? Math.round((totalGrossProfitUsdt / totalGrossLossUsdt) * 100) / 100
      : totalGrossProfitUsdt > 0
      ? 99.9
      : 0;

  const avgWinUsdt = winningTrades > 0 ? totalGrossProfitUsdt / winningTrades : 0;
  const avgLossUsdt = losingTrades > 0 ? totalGrossLossUsdt / losingTrades : 0;
  const winPctDecimal = winRate / 100;
  const lossPctDecimal = lossRate / 100;
  const expectancy =
    Math.round((winPctDecimal * avgWinUsdt - lossPctDecimal * avgLossUsdt) * 100) / 100;

  // Calculate Sharpe & Sortino Ratios
  let sharpeRatio = 0;
  let sortinoRatio = 0;
  if (trades.length >= 3) {
    const returns = trades.map((t) => t.pnlPercent);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    const downsideDiffs = returns.filter((r) => r < 0).map((r) => Math.pow(r, 2));
    const downsideVariance = downsideDiffs.length > 0 ? downsideDiffs.reduce((a, b) => a + b, 0) / downsideDiffs.length : 0;
    const downsideDev = Math.sqrt(downsideVariance);

    if (stdDev > 0) sharpeRatio = Math.round((meanReturn / stdDev) * Math.sqrt(Math.min(50, trades.length)) * 10) / 10;
    if (downsideDev > 0) sortinoRatio = Math.round((meanReturn / downsideDev) * Math.sqrt(Math.min(50, trades.length)) * 10) / 10;
  }

  const netProfitUsdt = Math.round((currentBalance - initialBalance) * 100) / 100;
  const netReturnPercent = Math.round(finalBotReturnPct * 100) / 100;

  return {
    symbol,
    config,
    initialBalance,
    finalBalance: Math.round(currentBalance * 100) / 100,
    netProfitUsdt,
    netReturnPercent,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
    maxDrawdownUsdt: Math.round(maxDrawdownUsdt * 100) / 100,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    lossRate,
    equityCurve,
    profitFactor,
    averageRR: riskRewardTarget,
    expectancy,
    avgWinUsdt: Math.round(avgWinUsdt * 100) / 100,
    avgLossUsdt: Math.round(avgLossUsdt * 100) / 100,
    tp1Rate: totalTrades > 0 ? Math.round((tp1Hits / totalTrades) * 1000) / 10 : 0,
    tp2Rate: totalTrades > 0 ? Math.round((tp2Hits / totalTrades) * 1000) / 10 : 0,
    tp3Rate: totalTrades > 0 ? Math.round((tp3Hits / totalTrades) * 1000) / 10 : 0,
    slRate: totalTrades > 0 ? Math.round((slHits / totalTrades) * 1000) / 10 : 0,
    trades: trades.reverse(), // most recent first
    sharpeRatio,
    sortinoRatio,
    totalFeesUsdt: Math.round(totalFeesAccumulated * 100) / 100,
  };
}

/**
 * Runs comparative backtest for all 6 individual strategies + ensemble side-by-side
 */
export function runComparativeStrategyBacktest(
  klines: KlineCandle[],
  baseConfig: BacktestConfig,
  symbol = 'BTCUSDT'
): StrategyComparisonItem[] {
  const allIds: BacktestStrategyId[] = [
    'ALL_STRATEGIES',
    'MOMENTUM',
    'SCALPER',
    'SWING',
    'BREAKOUT',
    'MEAN_REVERSION',
    'INSTITUTIONAL_SMC',
  ];

  const results: StrategyComparisonItem[] = [];

  allIds.forEach((id) => {
    const stratInfo = BACKTEST_STRATEGIES.find((s) => s.id === id);
    const specificConfig: BacktestConfig = {
      ...baseConfig,
      strategyId: id,
    };

    const res = runHistoricalBacktest(klines, specificConfig, symbol);
    results.push({
      strategyId: id,
      strategyName: stratInfo?.name || id,
      strategyNameAr: stratInfo?.nameAr || id,
      badge: stratInfo?.badge || 'Strategy',
      color: stratInfo?.color || '#0ea5e9',
      netProfitUsdt: res.netProfitUsdt,
      netReturnPercent: res.netReturnPercent,
      winRate: res.winRate,
      totalTrades: res.totalTrades,
      winningTrades: res.winningTrades,
      losingTrades: res.losingTrades,
      profitFactor: res.profitFactor,
      maxDrawdownPercent: res.maxDrawdownPercent,
      sharpeRatio: res.sharpeRatio || 0,
      expectancy: res.expectancy,
    });
  });

  // Find best performing strategy by Net Profit
  let maxProfit = -Infinity;
  let bestIdx = -1;
  results.forEach((r, idx) => {
    if (r.netProfitUsdt > maxProfit) {
      maxProfit = r.netProfitUsdt;
      bestIdx = idx;
    }
  });

  if (bestIdx >= 0) {
    results[bestIdx].isBest = true;
  }

  return results;
}

/**
 * Runs a simultaneous multi-currency backtest across all given symbols and aggregates portfolio stats
 */
export function runMultiCoinBacktest(
  coinKlinesMap: Record<string, KlineCandle[]>,
  config: BacktestConfig
): MultiCoinBacktestResult {
  const symbols = Object.keys(coinKlinesMap);
  const resultsByCoin: Record<string, BacktestResult> = {};

  symbols.forEach((sym) => {
    const klines = coinKlinesMap[sym] || [];
    resultsByCoin[sym] = runHistoricalBacktest(klines, config, sym);
  });

  const allPotentialTrades: BacktestTrade[] = [];
  symbols.forEach((sym) => {
    allPotentialTrades.push(...resultsByCoin[sym].trades);
  });

  type PortfolioEvent = { time: number; type: 'ENTRY' | 'EXIT'; trade: BacktestTrade };
  const events: PortfolioEvent[] = [];
  allPotentialTrades.forEach((t) => {
    events.push({ time: t.entryTime, type: 'ENTRY', trade: t });
    events.push({ time: t.exitTime, type: 'EXIT', trade: t });
  });

  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    if (a.type === 'EXIT' && b.type === 'ENTRY') return -1;
    if (a.type === 'ENTRY' && b.type === 'EXIT') return 1;
    return 0;
  });

  const MAX_CONCURRENT_TRADES = 5;
  let currentPortfolioBalance = config.initialBalance;
  const activeTrades = new Set<string>();
  const activeTradeAllocations = new Map<string, number>();
  const executedTradesByCoin: Record<string, BacktestTrade[]> = {};
  symbols.forEach((s) => {
    executedTradesByCoin[s] = [];
  });

  let totalTrades = 0;
  let totalWinningTrades = 0;
  let totalLosingTrades = 0;
  let maxPortfolioDrawdownPercent = 0;
  let peakPortfolioBalance = currentPortfolioBalance;

  const rawPortfolioCurve: EquityDataPoint[] = [];
  const sampleSymbol = symbols[0] || 'BTCUSDT';
  const baseTimeline = resultsByCoin[sampleSymbol]?.equityCurve || [];
  let baseTimelineIdx = 0;

  events.forEach((event) => {
    if (event.type === 'ENTRY') {
      if (activeTrades.size < MAX_CONCURRENT_TRADES) {
        activeTrades.add(event.trade.id);
        const allocPct = Math.min(100, Math.max(5, config.tradeAllocationPercent || 20));
        const allocationUsdt = currentPortfolioBalance * (allocPct / 100);
        currentPortfolioBalance = Math.max(0, currentPortfolioBalance - allocationUsdt);
        activeTradeAllocations.set(event.trade.id, allocationUsdt);
      }
    } else if (event.type === 'EXIT') {
      if (activeTrades.has(event.trade.id)) {
        activeTrades.delete(event.trade.id);
        const allocationUsdt = activeTradeAllocations.get(event.trade.id) || 0;
        activeTradeAllocations.delete(event.trade.id);

        const tradePnlUsdt = allocationUsdt * (event.trade.pnlPercent / 100);
        currentPortfolioBalance += Math.max(0, allocationUsdt + tradePnlUsdt);

        if (currentPortfolioBalance > peakPortfolioBalance) {
          peakPortfolioBalance = currentPortfolioBalance;
        } else {
          const dd = ((peakPortfolioBalance - currentPortfolioBalance) / peakPortfolioBalance) * 100;
          if (dd > maxPortfolioDrawdownPercent) maxPortfolioDrawdownPercent = dd;
        }

        const scale = currentPortfolioBalance / config.initialBalance;
        const executedTrade = { ...event.trade };
        executedTrade.pnlUsdt = Math.round(tradePnlUsdt * 100) / 100;
        executedTrade.balanceAfter = Math.round(currentPortfolioBalance * 100) / 100;
        executedTrade.feeUsdt = Math.round((event.trade.feeUsdt || 0) * scale * 100) / 100;
        executedTradesByCoin[event.trade.symbol]?.push(executedTrade);

        totalTrades++;
        if (event.trade.pnlPercent > 0) totalWinningTrades++;
        else totalLosingTrades++;

        while (
          baseTimelineIdx < baseTimeline.length - 1 &&
          baseTimeline[baseTimelineIdx].timestamp < event.time
        ) {
          baseTimelineIdx++;
        }

        let sumBuyHoldEquity = 0;
        symbols.forEach((sym) => {
          const curve = resultsByCoin[sym]?.equityCurve || [];
          const pt = curve[Math.min(baseTimelineIdx, curve.length - 1)] || curve[0];
          sumBuyHoldEquity += pt
            ? pt.buyHoldEquityUsdt || config.initialBalance / symbols.length
            : config.initialBalance / symbols.length;
        });

        const botRetPct = ((currentPortfolioBalance - config.initialBalance) / config.initialBalance) * 100;
        const bhRetPct = ((sumBuyHoldEquity - config.initialBalance) / config.initialBalance) * 100;

        rawPortfolioCurve.push({
          timestamp: event.time * 1000,
          botEquityUsdt: Math.round(currentPortfolioBalance * 100) / 100,
          botReturn: Math.round(botRetPct * 100) / 100,
          buyHoldEquityUsdt: Math.round(sumBuyHoldEquity * 100) / 100,
          buyHoldReturn: Math.round(bhRetPct * 100) / 100,
        });
      }
    }
  });

  const totalNetProfitUsdt = Math.round((currentPortfolioBalance - config.initialBalance) * 100) / 100;
  const totalNetReturnPercent = Math.round(((currentPortfolioBalance - config.initialBalance) / config.initialBalance) * 10000) / 100;
  const overallWinRate = totalTrades > 0 ? Math.round((totalWinningTrades / totalTrades) * 1000) / 10 : 0;

  const coinsRanked = symbols
    .map((sym) => {
      const res = resultsByCoin[sym];
      return {
        symbol: sym,
        winRate: res.winRate,
        totalTrades: res.totalTrades,
        netReturnPercent: res.netReturnPercent,
        netProfitUsdt: res.netProfitUsdt,
        finalBalance: res.finalBalance,
        profitFactor: res.profitFactor,
        maxDrawdownPercent: res.maxDrawdownPercent,
      };
    })
    .sort((a, b) => b.netReturnPercent - a.netReturnPercent);

  const bestCoin = coinsRanked[0] || { symbol: 'N/A', netReturnPercent: 0, netProfitUsdt: 0 };
  const worstCoin = coinsRanked[coinsRanked.length - 1] || { symbol: 'N/A', netReturnPercent: 0, netProfitUsdt: 0 };

  let portfolioEquityCurve = downsampleEquityCurve(rawPortfolioCurve, 100);
  if (portfolioEquityCurve.length === 0) {
    portfolioEquityCurve = [
      {
        timestamp: Date.now(),
        botEquityUsdt: config.initialBalance,
        botReturn: 0,
        buyHoldEquityUsdt: config.initialBalance,
        buyHoldReturn: 0,
      },
    ];
  }

  return {
    config,
    resultsByCoin,
    portfolioEquityCurve,
    totalInitialBalance: config.initialBalance,
    totalFinalBalance: Math.round(currentPortfolioBalance * 100) / 100,
    totalNetProfitUsdt,
    totalNetReturnPercent,
    totalTrades,
    totalWinningTrades,
    totalLosingTrades,
    overallWinRate,
    bestPerformingCoin: {
      symbol: bestCoin.symbol,
      roi: bestCoin.netReturnPercent,
      profitUsdt: bestCoin.netProfitUsdt,
    },
    worstPerformingCoin: {
      symbol: worstCoin.symbol,
      roi: worstCoin.netReturnPercent,
      profitUsdt: worstCoin.netProfitUsdt,
    },
    coinsRanked,
  };
}

export function generateFallbackKlines(
  symbol = 'BTCUSDT',
  timeframe: Timeframe = '1h',
  months = 6
): KlineCandle[] {
  const normSymbol = symbol.toUpperCase();
  const klines: KlineCandle[] = [];
  const nowTs = Math.floor(Date.now() / 1000);
  let tfSeconds = 3600;
  if (timeframe === '5m') tfSeconds = 5 * 60;
  else if (timeframe === '15m') tfSeconds = 15 * 60;
  else if (timeframe === '30m') tfSeconds = 30 * 60;
  else if (timeframe === '1h') tfSeconds = 3600;
  else if (timeframe === '4h') tfSeconds = 4 * 3600;
  else if (timeframe === '1d') tfSeconds = 24 * 3600;
  else if (timeframe === '1w') tfSeconds = 7 * 24 * 3600;

  const validMonths = Math.min(24, Math.max(1, months));
  const numCandles = Math.min(1000, Math.ceil((validMonths * 30 * 24 * 3600) / tfSeconds));

  let basePrice = 65000;
  if (normSymbol.includes('ETH')) basePrice = 3400;
  else if (normSymbol.includes('SOL')) basePrice = 180;
  else if (normSymbol.includes('BNB')) basePrice = 580;
  else if (normSymbol.includes('XRP')) basePrice = 0.60;
  else if (normSymbol.includes('DOGE')) basePrice = 0.14;
  else if (normSymbol.includes('ADA')) basePrice = 0.45;
  else if (normSymbol.includes('AVAX')) basePrice = 30;
  else if (normSymbol.includes('LINK')) basePrice = 15;
  else if (normSymbol.includes('SUI')) basePrice = 2.2;
  else if (normSymbol.includes('NEAR')) basePrice = 5.5;
  else if (normSymbol.includes('SHIB')) basePrice = 0.00002;
  else if (normSymbol.includes('PEPE')) basePrice = 0.000008;
  else if (normSymbol.includes('BONK')) basePrice = 0.000025;
  else if (normSymbol.includes('WIF')) basePrice = 3.5;
  else if (normSymbol.includes('JUP')) basePrice = 1.1;
  else if (normSymbol.includes('FLOKI')) basePrice = 0.0002;
  else if (normSymbol.includes('DOT')) basePrice = 7.0;
  else if (normSymbol.includes('MATIC')) basePrice = 0.7;

  let currentPrice = basePrice * (0.88 + Math.random() * 0.24);

  for (let i = numCandles - 1; i >= 0; i--) {
    const time = nowTs - (i * tfSeconds);
    const open = currentPrice;
    const volatility = currentPrice * 0.007;
    const change = (Math.random() - 0.492) * volatility;
    const close = Math.max(0.00000001, open + change);
    const high = Math.max(open, close) + Math.random() * volatility * 0.6;
    const low = Math.max(0.00000001, Math.min(open, close) - Math.random() * volatility * 0.6);
    const volume = Math.random() * 8000 + 400;

    klines.push({
      time,
      open: Number(open.toPrecision(8)),
      high: Number(high.toPrecision(8)),
      low: Number(low.toPrecision(8)),
      close: Number(close.toPrecision(8)),
      volume: Math.round(volume * 100) / 100,
    });
    currentPrice = close;
  }

  return klines;
}
