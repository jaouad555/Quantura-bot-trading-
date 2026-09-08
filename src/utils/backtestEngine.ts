import {
  KlineCandle,
  Timeframe,
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  EquityDataPoint,
  MultiCoinBacktestResult,
  TechnicalIndicators,
} from '../types';
import { calculateEMA, calculateSMA } from './indicators';
import { calculateQuantitativeScore } from './quantEngine';

/**
 * Default Backtest configuration values
 */
export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  timeframe: '1h',
  months: 6,
  candleLimit: 1000,
  initialBalance: 1000,
  leverage: 1, // Spot (1x) or Futures (2x, 3x, 5x, 10x)
  tradeAllocationPercent: 20, // 20% margin per trade
  riskRewardTarget: 2.0,
  minSignalStrength: 65,
  slAtrMultiplier: 1.5,
  marketType: 'SPOT',
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
        bos: 'NONE',
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
    leverage = 1,
    tradeAllocationPercent = 20,
    marketType = 'SPOT',
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
      trades: [] as BacktestTrade[],
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
      const { high, low, close, open, time } = nextCandle;
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
            // Stop Loss triggered (Could be Breakeven SL, Trailing SL, or Initial SL)
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
          // Check TP1
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

            // Move SL to Breakeven
            activeSL = Math.min(activeSL, activeEntryPrice);
          }

          // Check TP2
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

            // Lock in TP1 price as trailing ceiling
            activeSL = Math.min(activeSL, activeTP1);
          }

          // Check TP3
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
            // Short Stop Loss hit
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

      let totalEquity = currentBalance;
      if (inTrade && activeTrade) {
        const isLong = activeType === 'LONG';
        const priceDiffPct = ((close - activeEntryPrice) / activeEntryPrice) * (isLong ? 1 : -1) * 100;
        const floatingPnl = activeTrade.remainingMargin * (priceDiffPct * effectiveLeverage / 100);
        totalEquity = currentBalance + activeTrade.remainingMargin + activeTrade.realizedPnlUsdt + floatingPnl;
      }

      // Equity Curve Data Point recording
      if (i % 2 === 0 || !inTrade) { // Record every other candle or on trade exit to avoid huge arrays but keep curve smooth
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

      // Drawdown tracking (based on total equity)
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
          const score = calculateQuantitativeScore(timeframe, currentCandle.close, inds, null, null, null);
          const atrVal = Math.max(inds.atr14, currentCandle.close * 0.005);
          const riskDist = atrVal * slAtrMultiplier;
          const allocPct = Math.min(100, Math.max(5, tradeAllocationPercent));
          const allocatedMargin = currentBalance * (allocPct / 100);
          const entryFee = (allocatedMargin * effectiveLeverage) * combinedFeeRate;

          if (score.bullishScore >= minSignalStrength && score.bullishScore > score.bearishScore + 10) {
            // Open LONG
            inTrade = true;
            activeType = 'LONG';
            activeEntryPrice = currentCandle.close;
            activeSL = Math.max(0.000001, activeEntryPrice - riskDist);
            activeTP1 = activeEntryPrice + riskDist * 1.2;
            activeTP2 = activeEntryPrice + riskDist * riskRewardTarget;
            activeTP3 = activeEntryPrice + riskDist * (riskRewardTarget * 1.75);
            activeLiquidationPrice = isFutures ? activeEntryPrice * (1 - (1 / effectiveLeverage) * 0.95) : 0;

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
            };
          } else if (isFutures && score.bearishScore >= minSignalStrength && score.bearishScore > score.bullishScore + 10) {
            // Open SHORT (Futures only)
            inTrade = true;
            activeType = 'SHORT';
            activeEntryPrice = currentCandle.close;
            activeSL = activeEntryPrice + riskDist;
            activeTP1 = Math.max(0.000001, activeEntryPrice - riskDist * 1.2);
            activeTP2 = Math.max(0.000001, activeEntryPrice - riskDist * riskRewardTarget);
            activeTP3 = Math.max(0.000001, activeEntryPrice - riskDist * (riskRewardTarget * 1.75));
            activeLiquidationPrice = activeEntryPrice * (1 + (1 / effectiveLeverage) * 0.95);

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

  const finalBalance = Math.round(currentBalance * 100) / 100;
  const netProfitUsdt = Math.round((finalBalance - initialBalance) * 100) / 100;
  const netReturnPercent = Math.round(finalBotReturnPct * 100) / 100;

  return {
    symbol,
    config,
    equityCurve,
    initialBalance,
    finalBalance,
    netProfitUsdt,
    netReturnPercent,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
    maxDrawdownUsdt: Math.round(maxDrawdownUsdt * 100) / 100,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    lossRate,
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
 * Runs a simultaneous multi-currency backtest across all given symbols and aggregates portfolio stats
 */
export function runMultiCoinBacktest(
  coinKlinesMap: Record<string, KlineCandle[]>,
  config: BacktestConfig
): MultiCoinBacktestResult {
  const symbols = Object.keys(coinKlinesMap);
  const resultsByCoin: Record<string, BacktestResult> = {};

  // 1. Generate isolated trades for every coin
  symbols.forEach((sym) => {
    const klines = coinKlinesMap[sym] || [];
    resultsByCoin[sym] = runHistoricalBacktest(klines, config, sym);
  });

  // 2. Pool and sort all potential trades chronologically by entryTime
  const allPotentialTrades: BacktestTrade[] = [];
  symbols.forEach((sym) => {
    allPotentialTrades.push(...resultsByCoin[sym].trades);
  });

  type PortfolioEvent = { time: number; type: 'ENTRY' | 'EXIT'; trade: BacktestTrade };
  const events: PortfolioEvent[] = [];
  allPotentialTrades.forEach(t => {
    events.push({ time: t.entryTime, type: 'ENTRY', trade: t });
    events.push({ time: t.exitTime, type: 'EXIT', trade: t });
  });

  // Sort events. If same time, process EXITS first to free up slots before new ENTRYS
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    if (a.type === 'EXIT' && b.type === 'ENTRY') return -1;
    if (a.type === 'ENTRY' && b.type === 'EXIT') return 1;
    return 0;
  });

  // 3. Global Portfolio Simulation (Max 5 concurrent trades)
  const MAX_CONCURRENT_TRADES = 5;
  let currentPortfolioBalance = config.initialBalance;
  const activeTrades = new Set<string>();
  const activeTradeAllocations = new Map<string, number>();
  const executedTradesByCoin: Record<string, BacktestTrade[]> = {};
  symbols.forEach(s => { executedTradesByCoin[s] = []; });

  let totalTrades = 0;
  let totalWinningTrades = 0;
  let totalLosingTrades = 0;
  let maxPortfolioDrawdownPercent = 0;
  let peakPortfolioBalance = currentPortfolioBalance;

  const rawPortfolioCurve: EquityDataPoint[] = [];

  // Build Buy/Hold reference: an equal-weighted basket at start
  const sampleSymbol = symbols[0] || 'BTCUSDT';
  const baseTimeline = resultsByCoin[sampleSymbol]?.equityCurve || [];
  let baseTimelineIdx = 0;

  events.forEach(event => {
    if (event.type === 'ENTRY') {
      if (activeTrades.size < MAX_CONCURRENT_TRADES) {
        // Enforce max 1 active trade per symbol (single coin backtest already does this naturally)
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
        
        // pnlPercent is Return on Equity of the margin
        const tradePnlUsdt = allocationUsdt * (event.trade.pnlPercent / 100);
        
        currentPortfolioBalance += Math.max(0, allocationUsdt + tradePnlUsdt);
        
        // Track max drawdown on portfolio
        if (currentPortfolioBalance > peakPortfolioBalance) {
          peakPortfolioBalance = currentPortfolioBalance;
        } else {
          const dd = ((peakPortfolioBalance - currentPortfolioBalance) / peakPortfolioBalance) * 100;
          if (dd > maxPortfolioDrawdownPercent) maxPortfolioDrawdownPercent = dd;
        }

        // Clone and adjust trade for global stats
        const scale = currentPortfolioBalance / config.initialBalance;
        const executedTrade = { ...event.trade };
        executedTrade.pnlUsdt = Math.round(tradePnlUsdt * 100) / 100;
        executedTrade.balanceAfter = Math.round(currentPortfolioBalance * 100) / 100;
        executedTrade.feeUsdt = Math.round((event.trade.feeUsdt * scale) * 100) / 100;
        executedTradesByCoin[event.trade.symbol].push(executedTrade);
        
        totalTrades++;
        if (event.trade.pnlPercent > 0) totalWinningTrades++;
        else totalLosingTrades++;
        
        // Sample timeline for equity curve
        while (baseTimelineIdx < baseTimeline.length - 1 && baseTimeline[baseTimelineIdx].timestamp < event.time) {
          baseTimelineIdx++;
        }
        
        let sumBuyHoldEquity = 0;
        symbols.forEach(sym => {
           const curve = resultsByCoin[sym]?.equityCurve || [];
           const pt = curve[Math.min(baseTimelineIdx, curve.length - 1)] || curve[0];
           // original buyHoldEquityUsdt assumed full initialBalance per coin. 
           // Divide by symbols.length for an equal-weighted basket of the global initialBalance.
           sumBuyHoldEquity += pt ? (pt.buyHoldEquityUsdt / symbols.length) : (config.initialBalance / symbols.length);
        });

        rawPortfolioCurve.push({
           timestamp: event.time,
           botEquityUsdt: Math.round(currentPortfolioBalance * 100) / 100,
           botReturn: Math.round(((currentPortfolioBalance - config.initialBalance) / config.initialBalance) * 10000) / 100,
           buyHoldEquityUsdt: Math.round(sumBuyHoldEquity * 100) / 100,
           buyHoldReturn: Math.round(((sumBuyHoldEquity - config.initialBalance) / config.initialBalance) * 10000) / 100,
        });
      }
    }
  });

  const totalNetProfitUsdt = Math.round((currentPortfolioBalance - config.initialBalance) * 100) / 100;
  const totalNetReturnPercent = config.initialBalance > 0 
      ? Math.round(((currentPortfolioBalance - config.initialBalance) / config.initialBalance) * 10000) / 100 
      : 0;
  const overallWinRate = totalTrades > 0 ? Math.round((totalWinningTrades / totalTrades) * 1000) / 10 : 0;

  // 4. Rank coins based on their executed trades in the global portfolio
  const coinsRanked = symbols.map(sym => {
     const trades = executedTradesByCoin[sym];
     const tradesCount = trades.length;
     const wins = trades.filter(t => t.pnlPercent > 0).length;
     const winRate = tradesCount > 0 ? (wins / tradesCount) * 100 : 0;
     const netProfitUsdt = trades.reduce((sum, t) => sum + t.pnlUsdt, 0);
     
     // netReturnPercent here is contribution to global portfolio ROI % 
     const netReturnPercent = config.initialBalance > 0 ? (netProfitUsdt / config.initialBalance) * 100 : 0;

     let grossProfit = 0;
     let grossLoss = 0;
     trades.forEach(t => {
       if (t.pnlUsdt >= 0) grossProfit += t.pnlUsdt;
       else grossLoss += Math.abs(t.pnlUsdt);
     });
     const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.9 : 0);

     const coinShare = symbols.length > 0 ? config.initialBalance / symbols.length : config.initialBalance;
     const coinFinalBalance = Math.max(0, coinShare + netProfitUsdt);

     // Max drawdown for a specific coin in a shared wallet is complex, so we approximate
     return {
       symbol: sym,
       winRate: Math.round(winRate * 10) / 10,
       totalTrades: tradesCount,
       netReturnPercent: Math.round(netReturnPercent * 100) / 100, 
       netProfitUsdt: Math.round(netProfitUsdt * 100) / 100,
       finalBalance: Math.round(coinFinalBalance * 100) / 100, 
       profitFactor: Math.round(profitFactor * 100) / 100,
       maxDrawdownPercent: 0, 
     };
  }).sort((a, b) => b.netReturnPercent - a.netReturnPercent);

  const bestCoin = coinsRanked[0] || { symbol: 'N/A', netReturnPercent: 0, netProfitUsdt: 0 };
  const worstCoin = coinsRanked[coinsRanked.length - 1] || { symbol: 'N/A', netReturnPercent: 0, netProfitUsdt: 0 };

  let portfolioEquityCurve = downsampleEquityCurve(rawPortfolioCurve, 100);
  if (portfolioEquityCurve.length === 0) {
     portfolioEquityCurve = [{
         timestamp: Date.now(),
         botEquityUsdt: config.initialBalance,
         botReturn: 0,
         buyHoldEquityUsdt: config.initialBalance,
         buyHoldReturn: 0
     }];
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
