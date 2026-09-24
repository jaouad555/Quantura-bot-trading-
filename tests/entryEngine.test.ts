import { EntryQualityEngine } from '../src/utils/entryQualityEngine';
import { calculateQuantitativeScore, detectMarketRegime, generateQuantitativePlan } from '../src/utils/quantEngine';
import { TechnicalIndicators, Timeframe, MarketRegime } from '../src/types';

console.log('====================================================');
console.log('🧪 RUNNING QUANTURA ENTRY ENGINE COMPREHENSIVE TESTS');
console.log('====================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, extra?: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName} ${extra ? `(${extra})` : ''}`);
  }
}

// Base mock indicators
const createBaseIndicators = (price: number): TechnicalIndicators => ({
  ema20: price * 0.99,
  ema50: price * 0.975,
  ema100: price * 0.95,
  ema200: price * 0.92,
  sma200: price * 0.92,
  rsi14: 55,
  macd: { macdLine: price * 0.002, signalLine: price * 0.001, histogram: price * 0.001 },
  atr14: price * 0.015,
  bollingerBands: { upper: price * 1.03, middle: price, lower: price * 0.97, bandwidthPercent: 6.0 },
  adx14: 28,
  volume: 1500000,
  volumeAvg20: 1000000,
  vwap: price * 0.995,
  obv: 120000,
  marketStructure: {
    trend: 'UPTREND',
    swingHigh: price * 1.04,
    swingLow: price * 0.96,
    structure: 'HIGHER_HIGH',
    bos: 'BULLISH_BOS',
    choch: 'Neutre',
  },
  supportLevels: [price * 0.985, price * 0.96],
  resistanceLevels: [price * 1.035, price * 1.06],
  liquidityZones: { buySide: [price * 1.04], sellSide: [price * 0.96] },
});

// TEST 1: Valid LONG with Strong Confirmations
{
  const price = 60000;
  const indicators = createBaseIndicators(price);
  const quantScore = calculateQuantitativeScore('15m', price, indicators, null, null, null);
  const regime = detectMarketRegime(indicators, price);
  const result = EntryQualityEngine.evaluate({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    currentPrice: price,
    indicators,
    quantScore,
    marketRegime: regime,
    orderBook: { bidAskRatio: 1.3, bias: 'BUYERS_STRONG', bidTotal: 100, askTotal: 70, topBids: [], topAsks: [], imbalancePercent: 20, largeWalls: [] },
    derivatives: null,
    mtfConfluence: {
      bullishCount: 3,
      bearishCount: 0,
      neutralCount: 1,
      overallBias: 'BULLISH',
      alignmentPercent: 85,
      timeframes: {} as any,
    },
  });

  assert(result.decision === 'LONG', 'Test 1: Valid LONG decision reached with confirmations');
  assert(result.entryQuality.status === 'VALID', 'Test 1: Entry Quality status is VALID');
  assert(result.stopLoss < price, 'Test 1: Stop Loss is strictly below entry price');
  assert(result.targets.tp1 > price, 'Test 1: TP1 is strictly above entry price');
  assert(result.riskRewardRatio >= 1.35, 'Test 1: Risk Reward ratio is >= 1:1.35');
  assert(result.antiChasePassed === true, 'Test 1: Anti-Chase passed');
}

// TEST 2: Valid SHORT with Strong Confirmations
{
  const price = 60000;
  const indicators: TechnicalIndicators = {
    ...createBaseIndicators(price),
    ema20: price * 1.01,
    ema50: price * 1.025,
    ema100: price * 1.05,
    ema200: price * 1.08,
    sma200: price * 1.08,
    rsi14: 42,
    macd: { macdLine: -price * 0.002, signalLine: -price * 0.001, histogram: -price * 0.001 },
    marketStructure: {
      trend: 'DOWNTREND',
      swingHigh: price * 1.04,
      swingLow: price * 0.95,
      structure: 'LOWER_LOW',
      bos: 'BEARISH_BOS',
      choch: 'Neutre',
    },
    supportLevels: [price * 0.95, price * 0.92],
    resistanceLevels: [price * 1.015, price * 1.04],
  };

  const quantScore = calculateQuantitativeScore('15m', price, indicators, null, null, null);
  const regime = detectMarketRegime(indicators, price);
  const result = EntryQualityEngine.evaluate({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    currentPrice: price,
    indicators,
    quantScore,
    marketRegime: regime,
    orderBook: { bidAskRatio: 0.7, bias: 'SELLERS_STRONG', bidTotal: 70, askTotal: 100, topBids: [], topAsks: [], imbalancePercent: -20, largeWalls: [] },
    derivatives: null,
    mtfConfluence: {
      bullishCount: 0,
      bearishCount: 3,
      neutralCount: 1,
      overallBias: 'BEARISH',
      alignmentPercent: 85,
      timeframes: {} as any,
    },
  });

  assert(result.decision === 'SHORT', 'Test 2: Valid SHORT decision reached with confirmations');
  assert(result.entryQuality.status === 'VALID', 'Test 2: Entry Quality status is VALID for SHORT');
  assert(result.stopLoss > price, 'Test 2: Stop Loss is strictly above entry price for SHORT');
  assert(result.targets.tp1 < price, 'Test 2: TP1 is strictly below entry price for SHORT');
}

// TEST 3: Anti-Chase Protection on Overextended Pump
{
  const price = 60000;
  // Price has pumped far above EMA20 (> 2.5 * ATR) and RSI is overbought (78)
  const indicators: TechnicalIndicators = {
    ...createBaseIndicators(price),
    ema20: price - 3.0 * (price * 0.015), // EMA20 is 3 ATRs below price
    rsi14: 78, // Overbought
  };
  const quantScore = calculateQuantitativeScore('15m', price, indicators, null, null, null);
  const regime = detectMarketRegime(indicators, price);
  const result = EntryQualityEngine.evaluate({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    currentPrice: price,
    indicators,
    quantScore,
    marketRegime: regime,
    orderBook: null,
    derivatives: null,
    mtfConfluence: null,
  });

  assert(result.decision === 'WAIT', 'Test 3: Overextended LONG correctly blocked with WAIT decision');
  assert(result.antiChasePassed === false, 'Test 3: Anti-Chase correctly flagged as failed');
  assert(result.rejectionReason === 'PRICE_OVEREXTENDED_PUMP', 'Test 3: Rejection reason is PRICE_OVEREXTENDED_PUMP');
}

// TEST 4: Anti-Chase Protection on Overextended Dump
{
  const price = 60000;
  // Price has dumped far below EMA20 and RSI is 22 (Extreme Oversold)
  const indicators: TechnicalIndicators = {
    ...createBaseIndicators(price),
    ema20: price + 3.0 * (price * 0.015),
    ema50: price + 4.0 * (price * 0.015),
    ema200: price + 6.0 * (price * 0.015),
    rsi14: 22, // Extreme Oversold
    marketStructure: {
      trend: 'DOWNTREND',
      swingHigh: price * 1.05,
      swingLow: price * 0.98,
      structure: 'LOWER_LOW',
      bos: 'BEARISH_BOS',
      choch: 'Neutre',
    },
  };
  const quantScore = calculateQuantitativeScore('15m', price, indicators, null, null, null);
  const regime = detectMarketRegime(indicators, price);
  const result = EntryQualityEngine.evaluate({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    currentPrice: price,
    indicators,
    quantScore,
    marketRegime: regime,
    orderBook: null,
    derivatives: null,
    mtfConfluence: null,
  });

  assert(result.decision === 'WAIT', 'Test 4: Overextended SHORT correctly blocked with WAIT decision');
  assert(result.antiChasePassed === false, 'Test 4: Anti-Chase correctly flagged for dump');
  assert(result.rejectionReason === 'PRICE_OVEREXTENDED_DUMP', 'Test 4: Rejection reason is PRICE_OVEREXTENDED_DUMP');
}

// TEST 5: UNCERTAIN Market Regime
{
  const price = 60000;
  const indicators = createBaseIndicators(price);
  const quantScore = { bullishScore: 70, bearishScore: 40, neutralScore: 30, signalStrength: 70, breakdown: {} as any };
  const result = EntryQualityEngine.evaluate({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    currentPrice: price,
    indicators,
    quantScore,
    marketRegime: 'UNCERTAIN',
    orderBook: null,
    derivatives: null,
    mtfConfluence: null,
  });

  assert(result.decision === 'WAIT', 'Test 5: UNCERTAIN regime blocks trade with WAIT');
  assert(result.rejectionReason === 'MARKET_REGIME_UNCERTAIN', 'Test 5: Rejection reason is MARKET_REGIME_UNCERTAIN');
}

// TEST 6: Opposing MTF Confluence blocks trade
{
  const price = 60000;
  const indicators = createBaseIndicators(price);
  const quantScore = { bullishScore: 72, bearishScore: 45, neutralScore: 27, signalStrength: 72, breakdown: {} as any };
  const result = EntryQualityEngine.evaluate({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    currentPrice: price,
    indicators,
    quantScore,
    marketRegime: 'TRENDING_BULLISH',
    orderBook: null,
    derivatives: null,
    mtfConfluence: {
      bullishCount: 0,
      bearishCount: 4, // 4 higher timeframes are bearish!
      neutralCount: 0,
      overallBias: 'BEARISH',
      alignmentPercent: 90,
      timeframes: {} as any,
    },
  });

  assert(result.decision === 'WAIT', 'Test 6: Opposing MTF blocks LONG trade');
  assert(result.rejectionReason === 'MTF_CONFLUENCE_OPPOSING', 'Test 6: Rejection reason is MTF_CONFLUENCE_OPPOSING');
}

// TEST 7: generateQuantitativePlan integration test
{
  const price = 65000;
  const indicators = createBaseIndicators(price);
  const plan = generateQuantitativePlan('15m', price, indicators, null, null, null, false, 'BTCUSDT');

  assert(typeof plan.confidence === 'number', 'Test 7: Plan confidence is a number');
  assert(plan.entryQuality !== undefined, 'Test 7: Plan has entryQuality object');
  assert(plan.entryZone !== null, 'Test 7: Plan provides structured entryZone');
  assert(plan.targets !== null, 'Test 7: Plan provides targets');
  assert(plan.stopLoss !== null, 'Test 7: Plan provides stopLoss');
}

console.log('====================================================');
console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('====================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
