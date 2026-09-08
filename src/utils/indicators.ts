import { KlineCandle, TechnicalIndicators, MarketStructure } from '../types';

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const emaValues: number[] = new Array(data.length);

  // Initialize first EMA with SMA
  const initialPeriod = Math.min(period, data.length);
  let sum = 0;
  for (let i = 0; i < initialPeriod; i++) {
    sum += data[i];
  }
  let currentEma = sum / initialPeriod;
  for (let i = 0; i < initialPeriod; i++) {
    emaValues[i] = currentEma;
  }

  for (let i = initialPeriod; i < data.length; i++) {
    currentEma = data[i] * k + currentEma * (1 - k);
    emaValues[i] = currentEma;
  }

  return emaValues;
}

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): number[] {
  const smaValues: number[] = new Array(data.length);
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      const sub = data.slice(0, i + 1);
      smaValues[i] = sub.reduce((a, b) => a + b, 0) / sub.length;
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      smaValues[i] = sum / period;
    }
  }
  return smaValues;
}

/**
 * Calculates RSI (14 period)
 */
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  // First period
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smooth using Wilder's technique
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

/**
 * Calculates MACD (12, 26, 9)
 */
export function calculateMACD(closes: number[]) {
  if (closes.length < 26) {
    return { macdLine: 0, signalLine: 0, histogram: 0 };
  }

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLineSeries = ema12.map((val, idx) => val - ema26[idx]);
  const signalLineSeries = calculateEMA(macdLineSeries, 9);

  const lastIdx = closes.length - 1;
  const macdLine = Math.round(macdLineSeries[lastIdx] * 100) / 100;
  const signalLine = Math.round(signalLineSeries[lastIdx] * 100) / 100;
  const histogram = Math.round((macdLine - signalLine) * 100) / 100;

  return { macdLine, signalLine, histogram };
}

/**
 * Calculates ATR (14 period)
 */
export function calculateATR(klines: KlineCandle[], period = 14): number {
  if (klines.length < 2) return (klines[0]?.high || 90000) * 0.01;

  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high;
    const l = klines[i].low;
    const prevC = klines[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trs.push(tr);
  }

  const startPeriod = Math.min(period, trs.length);
  let atr = trs.slice(0, startPeriod).reduce((a, b) => a + b, 0) / startPeriod;

  for (let i = startPeriod; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }

  return Math.round(atr * 100) / 100;
}

/**
 * Calculates ADX (14 period) - Trend Strength
 */
export function calculateADX(klines: KlineCandle[], period = 14): number {
  if (klines.length < period * 2) return 25;

  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < klines.length; i++) {
    const curr = klines[i];
    const prev = klines[i - 1];

    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trs.push(tr);

    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;

    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Smooth TR, +DM, -DM
  let smoothedTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxList: number[] = [];

  for (let i = period; i < trs.length; i++) {
    smoothedTR = smoothedTR - smoothedTR / period + trs[i];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMs[i];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMs[i];

    const plusDI = (smoothedPlusDM / (smoothedTR || 1)) * 100;
    const minusDI = (smoothedMinusDM / (smoothedTR || 1)) * 100;
    const diSum = plusDI + minusDI;
    const dx = diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100;
    dxList.push(dx);
  }

  if (dxList.length === 0) return 25;
  const adx = dxList.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, dxList.length);
  return Math.round(adx * 10) / 10;
}

/**
 * Calculates Bollinger Bands (20, 2)
 */
export function calculateBollingerBands(closes: number[], period = 20, multiplier = 2) {
  if (closes.length < period) {
    const last = closes[closes.length - 1] || 90000;
    return {
      upper: Math.round(last * 1.02 * 100) / 100,
      middle: Math.round(last * 100) / 100,
      lower: Math.round(last * 0.98 * 100) / 100,
      bandwidthPercent: 4.0,
    };
  }

  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;
  const bandwidthPercent = middle > 0 ? ((upper - lower) / middle) * 100 : 0;

  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    bandwidthPercent: Math.round(bandwidthPercent * 100) / 100,
  };
}

/**
 * Calculates VWAP and On-Balance Volume (OBV)
 */
export function calculateVolumeMetrics(klines: KlineCandle[]) {
  if (klines.length === 0) return { vwap: 0, obv: 0, volumeAvg20: 0 };

  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let obv = 0;

  for (let i = 0; i < klines.length; i++) {
    const k = klines[i];
    const typicalPrice = (k.high + k.low + k.close) / 3;
    cumulativeTPV += typicalPrice * k.volume;
    cumulativeVolume += k.volume;

    if (i > 0) {
      if (k.close > klines[i - 1].close) obv += k.volume;
      else if (k.close < klines[i - 1].close) obv -= k.volume;
    }
  }

  const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : klines[klines.length - 1].close;

  const last20Vols = klines.slice(-20).map((k) => k.volume);
  const volumeAvg20 = last20Vols.reduce((a, b) => a + b, 0) / (last20Vols.length || 1);

  return {
    vwap: Math.round(vwap * 100) / 100,
    obv: Math.round(obv * 100) / 100,
    volumeAvg20: Math.round(volumeAvg20 * 100) / 100,
  };
}

/**
 * Calculates Market Structure (Swing Points, HH, HL, LH, LL, BOS, CHoCH)
 */
export function calculateMarketStructure(klines: KlineCandle[]): MarketStructure {
  if (klines.length < 20) {
    const last = klines[klines.length - 1]?.close || 95000;
    return {
      trend: 'RANGING',
      swingHigh: last * 1.01,
      swingLow: last * 0.99,
      structure: 'RANGE',
      bos: 'Aucun BOS détecté',
      choch: 'Aucun CHoCH détecté',
    };
  }

  // Pivot points (left 3, right 3)
  const pivotHighs: { index: number; price: number }[] = [];
  const pivotLows: { index: number; price: number }[] = [];

  for (let i = 3; i < klines.length - 3; i++) {
    const high = klines[i].high;
    const isPivotHigh =
      high > klines[i - 1].high &&
      high > klines[i - 2].high &&
      high > klines[i - 3].high &&
      high >= klines[i + 1].high &&
      high >= klines[i + 2].high &&
      high >= klines[i + 3].high;

    if (isPivotHigh) {
      pivotHighs.push({ index: i, price: high });
    }

    const low = klines[i].low;
    const isPivotLow =
      low < klines[i - 1].low &&
      low < klines[i - 2].low &&
      low < klines[i - 3].low &&
      low <= klines[i + 1].low &&
      low <= klines[i + 2].low &&
      low <= klines[i + 3].low;

    if (isPivotLow) {
      pivotLows.push({ index: i, price: low });
    }
  }

  const lastClose = klines[klines.length - 1].close;
  const recentHighs = pivotHighs.slice(-3).map((p) => p.price);
  const recentLows = pivotLows.slice(-3).map((p) => p.price);

  const swingHigh = recentHighs.length > 0 ? recentHighs[recentHighs.length - 1] : Math.max(...klines.slice(-20).map((k) => k.high));
  const swingLow = recentLows.length > 0 ? recentLows[recentLows.length - 1] : Math.min(...klines.slice(-20).map((k) => k.low));

  let structure: 'HIGHER_HIGH' | 'HIGHER_LOW' | 'LOWER_HIGH' | 'LOWER_LOW' | 'RANGE' = 'RANGE';
  let trend: 'UPTREND' | 'DOWNTREND' | 'RANGING' = 'RANGING';

  if (recentHighs.length >= 2 && recentLows.length >= 2) {
    const h2 = recentHighs[recentHighs.length - 1];
    const h1 = recentHighs[recentHighs.length - 2];
    const l2 = recentLows[recentLows.length - 1];
    const l1 = recentLows[recentLows.length - 2];

    if (h2 > h1 && l2 > l1) {
      structure = 'HIGHER_HIGH';
      trend = 'UPTREND';
    } else if (h2 < h1 && l2 < l1) {
      structure = 'LOWER_LOW';
      trend = 'DOWNTREND';
    } else if (h2 > h1) {
      structure = 'HIGHER_HIGH';
      trend = 'UPTREND';
    } else if (l2 < l1) {
      structure = 'LOWER_LOW';
      trend = 'DOWNTREND';
    }
  } else {
    // Fallback comparison over last 20 candles
    const firstHalfHigh = Math.max(...klines.slice(-20, -10).map((k) => k.high));
    const secondHalfHigh = Math.max(...klines.slice(-10).map((k) => k.high));
    const firstHalfLow = Math.min(...klines.slice(-20, -10).map((k) => k.low));
    const secondHalfLow = Math.min(...klines.slice(-10).map((k) => k.low));

    if (secondHalfHigh > firstHalfHigh && secondHalfLow >= firstHalfLow) {
      structure = 'HIGHER_HIGH';
      trend = 'UPTREND';
    } else if (secondHalfLow < firstHalfLow && secondHalfHigh <= firstHalfHigh) {
      structure = 'LOWER_LOW';
      trend = 'DOWNTREND';
    }
  }

  let bos = 'Aucun';
  let choch = 'Aucun';

  if (trend === 'UPTREND') {
    bos = `BOS Haussier au-dessus de $${Math.round(swingHigh)}`;
    choch = `CHoCH Baissier sous $${Math.round(swingLow)}`;
  } else if (trend === 'DOWNTREND') {
    bos = `BOS Baissier sous $${Math.round(swingLow)}`;
    choch = `CHoCH Haussier au-dessus de $${Math.round(swingHigh)}`;
  } else {
    bos = `Cassure de range au-dessus de $${Math.round(swingHigh)}`;
    choch = `Cassure de range sous $${Math.round(swingLow)}`;
  }

  return {
    trend,
    swingHigh: Math.round(swingHigh * 100) / 100,
    swingLow: Math.round(swingLow * 100) / 100,
    structure,
    bos,
    choch,
  };
}

/**
 * Calculates Support and Resistance levels from pivot points & price clusters
 */
export function calculateSupportResistance(klines: KlineCandle[], currentPrice: number) {
  if (klines.length < 15) {
    return {
      supportLevels: [Math.round(currentPrice * 0.985), Math.round(currentPrice * 0.97)],
      resistanceLevels: [Math.round(currentPrice * 1.015), Math.round(currentPrice * 1.03)],
      liquidityZones: {
        buySide: [Math.round(currentPrice * 1.02)],
        sellSide: [Math.round(currentPrice * 0.98)],
      },
    };
  }

  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);

  // Group into potential levels (within 0.3% cluster)
  const candidateHighs = highs.filter((h) => h > currentPrice).sort((a, b) => a - b);
  const candidateLows = lows.filter((l) => l < currentPrice).sort((a, b) => b - a);

  const resistanceLevels: number[] = [];
  candidateHighs.forEach((h) => {
    if (!resistanceLevels.some((r) => Math.abs(r - h) / r < 0.005)) {
      resistanceLevels.push(Math.round(h));
    }
  });

  const supportLevels: number[] = [];
  candidateLows.forEach((l) => {
    if (!supportLevels.some((s) => Math.abs(s - l) / s < 0.005)) {
      supportLevels.push(Math.round(l));
    }
  });

  if (resistanceLevels.length === 0) resistanceLevels.push(Math.round(currentPrice * 1.015));
  if (resistanceLevels.length === 1) resistanceLevels.push(Math.round(currentPrice * 1.03));
  if (supportLevels.length === 0) supportLevels.push(Math.round(currentPrice * 0.985));
  if (supportLevels.length === 1) supportLevels.push(Math.round(currentPrice * 0.97));

  const buySide = [
    Math.round(Math.max(...highs.slice(-30))),
    Math.round(Math.max(...highs.slice(-60, -30)) || currentPrice * 1.025),
  ].filter((v) => v > currentPrice);

  const sellSide = [
    Math.round(Math.min(...lows.slice(-30))),
    Math.round(Math.min(...lows.slice(-60, -30)) || currentPrice * 0.975),
  ].filter((v) => v < currentPrice);

  return {
    supportLevels: supportLevels.slice(0, 4),
    resistanceLevels: resistanceLevels.slice(0, 4),
    liquidityZones: {
      buySide: buySide.length > 0 ? buySide : [Math.round(currentPrice * 1.02)],
      sellSide: sellSide.length > 0 ? sellSide : [Math.round(currentPrice * 0.98)],
    },
  };
}

/**
 * Calculates Full Technical Indicators for a timeframe series
 */
export function calculateTechnicalIndicators(klines: KlineCandle[]): TechnicalIndicators {
  if (!klines || klines.length === 0) {
    throw new Error('Cannot calculate technical indicators on empty candles');
  }

  const closes = klines.map((k) => k.close);
  const lastClose = closes[closes.length - 1];

  const ema20Series = calculateEMA(closes, 20);
  const ema50Series = calculateEMA(closes, 50);
  const ema100Series = calculateEMA(closes, 100);
  const ema200Series = calculateEMA(closes, 200);
  const sma200Series = calculateSMA(closes, 200);

  const ema20 = Math.round(ema20Series[ema20Series.length - 1] * 100) / 100;
  const ema50 = Math.round(ema50Series[ema50Series.length - 1] * 100) / 100;
  const ema100 = Math.round(ema100Series[ema100Series.length - 1] * 100) / 100;
  const ema200 = Math.round(ema200Series[ema200Series.length - 1] * 100) / 100;
  const sma200 = Math.round(sma200Series[sma200Series.length - 1] * 100) / 100;

  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const atr14 = calculateATR(klines, 14);
  const adx14 = calculateADX(klines, 14);
  const bollingerBands = calculateBollingerBands(closes, 20, 2);
  const { vwap, obv, volumeAvg20 } = calculateVolumeMetrics(klines);
  const marketStructure = calculateMarketStructure(klines);
  const { supportLevels, resistanceLevels, liquidityZones } = calculateSupportResistance(klines, lastClose);

  return {
    ema20,
    ema50,
    ema100,
    ema200,
    sma200,
    rsi14,
    macd,
    atr14,
    adx14,
    bollingerBands,
    volume: klines[klines.length - 1].volume,
    volumeAvg20,
    vwap,
    obv,
    marketStructure,
    supportLevels,
    resistanceLevels,
    liquidityZones,
  };
}
