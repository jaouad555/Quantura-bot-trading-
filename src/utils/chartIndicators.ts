import { KlineCandle } from '../types';

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface BollingerBandsResult {
  upper: IndicatorPoint[];
  middle: IndicatorPoint[];
  lower: IndicatorPoint[];
}

export interface PivotPointsResult {
  pivot: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
  vwap?: number;
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(klines: KlineCandle[], period: number): IndicatorPoint[] {
  if (!klines || klines.length === 0) return [];

  const k = 2 / (period + 1);
  const result: IndicatorPoint[] = [];

  if (klines.length >= period) {
    // Standard calculation with full warm-up period
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += klines[i].close;
    }
    let prevEma = sum / period;
    result.push({ time: klines[period - 1].time, value: Number(prevEma.toFixed(4)) });

    for (let i = period; i < klines.length; i++) {
      const currentPrice = klines[i].close;
      const currentEma = currentPrice * k + prevEma * (1 - k);
      result.push({ time: klines[i].time, value: Number(currentEma.toFixed(4)) });
      prevEma = currentEma;
    }
  } else {
    // Graceful calculation when available history is less than period
    let currentEma = klines[0].close;
    result.push({ time: klines[0].time, value: Number(currentEma.toFixed(4)) });

    for (let i = 1; i < klines.length; i++) {
      const currentPrice = klines[i].close;
      currentEma = currentPrice * k + currentEma * (1 - k);
      result.push({ time: klines[i].time, value: Number(currentEma.toFixed(4)) });
    }
  }

  return result;
}

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calculateSMA(klines: KlineCandle[], period: number): IndicatorPoint[] {
  if (!klines || klines.length === 0) return [];
  const result: IndicatorPoint[] = [];

  const effectivePeriod = Math.min(period, klines.length);
  for (let i = effectivePeriod - 1; i < klines.length; i++) {
    let sum = 0;
    const windowSize = Math.min(period, i + 1);
    for (let j = 0; j < windowSize; j++) {
      sum += klines[i - j].close;
    }
    result.push({ time: klines[i].time, value: Number((sum / windowSize).toFixed(4)) });
  }

  return result;
}

/**
 * Calculates Bollinger Bands (20, 2)
 */
export function calculateBollingerBands(
  klines: KlineCandle[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerBandsResult {
  const upper: IndicatorPoint[] = [];
  const middle: IndicatorPoint[] = [];
  const lower: IndicatorPoint[] = [];

  if (!klines || klines.length < period) {
    return { upper, middle, lower };
  }

  for (let i = period - 1; i < klines.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += klines[i - j].close;
    }
    const sma = sum / period;

    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow(klines[i - j].close - sma, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    const u = sma + stdDev * stdDevMultiplier;
    const l = sma - stdDev * stdDevMultiplier;

    upper.push({ time: klines[i].time, value: Number(u.toFixed(4)) });
    middle.push({ time: klines[i].time, value: Number(sma.toFixed(4)) });
    lower.push({ time: klines[i].time, value: Number(l.toFixed(4)) });
  }

  return { upper, middle, lower };
}

/**
 * Calculates Relative Strength Index (RSI) for the current snapshot
 */
export function calculateRSI(klines: KlineCandle[], period: number = 14): number {
  if (!klines || klines.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = klines[i].close - klines[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < klines.length; i++) {
    const diff = klines[i].close - klines[i - 1].close;
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

/**
 * Converts standard candles into Heikin-Ashi candles
 */
export function calculateHeikinAshi(klines: KlineCandle[]): KlineCandle[] {
  if (!klines || klines.length === 0) return [];

  const haCandles: KlineCandle[] = [];
  let prevOpen = klines[0].open;
  let prevClose = klines[0].close;

  for (let i = 0; i < klines.length; i++) {
    const k = klines[i];
    const haClose = (k.open + k.high + k.low + k.close) / 4;
    const haOpen = i === 0 ? (k.open + k.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(k.high, haOpen, haClose);
    const haLow = Math.min(k.low, haOpen, haClose);

    haCandles.push({
      time: k.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: k.volume,
    });

    prevOpen = haOpen;
    prevClose = haClose;
  }

  return haCandles;
}

/**
 * Calculates standard Pivot Points (Classic Floor Pivots) and VWAP from recent candles
 */
export function calculatePivotPoints(klines: KlineCandle[]): PivotPointsResult | null {
  if (!klines || klines.length < 5) return null;

  // Take recent window (last 24 to 48 candles) to compute current reference high/low/close
  const windowSlice = klines.slice(-Math.min(klines.length, 30));
  let high = -Infinity;
  let low = Infinity;
  let cumulativeTPV = 0;
  let cumulativeVol = 0;

  for (const candle of windowSlice) {
    if (candle.high > high) high = candle.high;
    if (candle.low < low) low = candle.low;
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVol += candle.volume;
  }

  const lastClose = windowSlice[windowSlice.length - 1].close;
  const pivot = (high + low + lastClose) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);
  const vwap = cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : undefined;

  return {
    pivot: Number(pivot.toFixed(4)),
    r1: Number(r1.toFixed(4)),
    r2: Number(r2.toFixed(4)),
    s1: Number(s1.toFixed(4)),
    s2: Number(s2.toFixed(4)),
    vwap: vwap ? Number(vwap.toFixed(4)) : undefined,
  };
}
