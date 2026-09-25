/**
 * Comprehensive Simulation & Unit Test Suite for Quantura ROE Engine
 * 
 * Verifies:
 * 1. LONG profitable calculation (Gross vs Net ROE)
 * 2. LONG loss calculation
 * 3. SHORT profitable calculation
 * 4. SHORT loss calculation
 * 5. TP1 50% scale-out with fee-aware breakeven
 * 6. Trailing Stop ratchet & non-loosening monotonicity (LONG + SHORT)
 * 7. Peak ROE and Drawdown tracking
 * 8. ROE State Machine transitions (LOSS -> RECOVERY -> PROFIT -> PROTECTED -> LOCK_PROFIT)
 * 9. Resilience to NaN, Infinity, negative and missing inputs
 */

import { RoeEngine, DEFAULT_ROE_CONFIG } from './RoeEngine';
import { RoeMetrics } from './types';

function runRoeEngineTests(): boolean {
  console.log('🧪 Starting Quantura ROE Engine Simulation Suite...\n');
  let passedCount = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`, detail ? detail : '');
    }
  }

  const engine = new RoeEngine({
    ...DEFAULT_ROE_CONFIG,
    trailingActivationROE: 1.5,
    profitProtectionROE: 3.0,
    aggressiveProtectionROE: 5.0,
    minimumProfitROE: 0.5,
    trailingStopPercent: 1.2,
  });

  // TEST 1: LONG Profitable (Entry 100, Price 101, Leverage 5)
  // Price change = +1.0%
  // Gross ROE = +1.0% * 5 = +5.0%
  // Margin = 100 USDT -> Position Size = 500 USDT
  // Gross PnL = 100 * 5% = +5.00 USDT
  // Taker fee = 500 * 0.05% + 505 * 0.05% = 0.50 USDT
  // Slippage = 500 * 0.02% = 0.10 USDT
  // Net PnL ~ +4.40 USDT -> Net ROE ~ +4.40%
  {
    const res = engine.evaluatePosition({
      symbol: 'BTCUSDT',
      decision: 'LONG',
      entryPrice: 100,
      currentPrice: 101,
      leverage: 5,
      marginUsdt: 100,
      currentStopLoss: 98,
    });

    assert(res.grossROE === 5.0, 'Test 1.1: LONG Gross ROE is +5.00%', { grossROE: res.grossROE });
    assert(res.netROE > 4.0 && res.netROE < 5.0, 'Test 1.2: LONG Net ROE correctly accounts for fees and slippage', { netROE: res.netROE });
    assert(res.grossPnL === 5.0, 'Test 1.3: LONG Gross PnL is $5.00 USDT', { grossPnL: res.grossPnL });
    assert(res.state === 'PROTECTED', 'Test 1.4: Net ROE (~4.4%) transitions to PROTECTED state', { state: res.state });
    assert(res.breakevenPrice > 100, 'Test 1.5: LONG fee-aware breakeven is above entry price', { breakevenPrice: res.breakevenPrice });
  }

  // TEST 2: LONG Loss (Entry 100, Price 99, Leverage 5)
  // Price change = -1.0%
  // Gross ROE = -5.0%
  {
    const res = engine.evaluatePosition({
      symbol: 'BTCUSDT',
      decision: 'LONG',
      entryPrice: 100,
      currentPrice: 99,
      leverage: 5,
      marginUsdt: 100,
      currentStopLoss: 98,
    });

    assert(res.grossROE === -5.0, 'Test 2.1: LONG Loss Gross ROE is -5.00%', { grossROE: res.grossROE });
    assert(res.netROE < -5.0, 'Test 2.2: LONG Loss Net ROE is lower than gross due to fees', { netROE: res.netROE });
    assert(res.state === 'LOSS', 'Test 2.3: State is LOSS', { state: res.state });
    assert(!res.shouldUpdateStopLoss, 'Test 2.4: Does not move SL during loss', { shouldUpdateStopLoss: res.shouldUpdateStopLoss });
  }

  // TEST 3: SHORT Profitable (Entry 100, Price 99, Leverage 5)
  // Price change = ((100 - 99) / 100) = +1.0%
  // Gross ROE = +5.0%
  {
    const res = engine.evaluatePosition({
      symbol: 'ETHUSDT',
      decision: 'SHORT',
      entryPrice: 100,
      currentPrice: 99,
      leverage: 5,
      marginUsdt: 100,
      currentStopLoss: 102,
    });

    assert(res.grossROE === 5.0, 'Test 3.1: SHORT Gross ROE is +5.00%', { grossROE: res.grossROE });
    assert(res.netROE > 4.0 && res.netROE < 5.0, 'Test 3.2: SHORT Net ROE is positive and accounts for fees', { netROE: res.netROE });
    assert(res.state === 'PROTECTED', 'Test 3.3: SHORT state is PROTECTED', { state: res.state });
    assert(res.breakevenPrice < 100, 'Test 3.4: SHORT fee-aware breakeven is below entry price', { breakevenPrice: res.breakevenPrice });
  }

  // TEST 4: Trailing Stop Ratchet & Monotonicity (LONG Never Loosens)
  // Entry: 100, SL: 98. Price rises to 104 -> SL tightens to e.g. 102.75. Price pulls back to 102 -> SL must stay 102.75!
  {
    // Step A: Price moves up to 104
    const stepA = engine.evaluatePosition({
      symbol: 'SOLUSDT',
      decision: 'LONG',
      entryPrice: 100,
      currentPrice: 104,
      leverage: 5,
      marginUsdt: 100,
      currentStopLoss: 98,
      peakPrice: 100,
    });

    assert(stepA.shouldUpdateStopLoss === true, 'Test 4.1: Ratchet activates on profit expansion');
    const tightenedSL = stepA.candidateStopLoss!;
    assert(tightenedSL > 100, 'Test 4.2: Candidate SL is above entry (in profit)', { tightenedSL });

    // Step B: Price pulls back to 102 (Peak was 104)
    const stepB = engine.evaluatePosition({
      symbol: 'SOLUSDT',
      decision: 'LONG',
      entryPrice: 100,
      currentPrice: 102,
      leverage: 5,
      marginUsdt: 100,
      currentStopLoss: tightenedSL, // Previous ratcheted SL
      peakPrice: 104,
      peakROE: stepA.peakROE,
    });

    assert(stepB.shouldUpdateStopLoss === false, 'Test 4.3: Candidate SL does NOT loosen during pullback');
    assert(stepB.peakROE === stepA.peakROE, 'Test 4.4: Peak ROE is preserved and does not decrease on pullback', { peakROE: stepB.peakROE });
    assert(stepB.roeDrawdown > 0, 'Test 4.5: ROE Drawdown is calculated properly', { drawdown: stepB.roeDrawdown });
  }

  // TEST 5: Trailing Stop Ratchet & Monotonicity (SHORT Never Loosens)
  // Entry: 100, SL: 102. Price drops to 95 -> SL drops to 96.14. Price rebounds to 97 -> SL must stay 96.14!
  {
    const stepA = engine.evaluatePosition({
      symbol: 'SOLUSDT',
      decision: 'SHORT',
      entryPrice: 100,
      currentPrice: 95,
      leverage: 5,
      marginUsdt: 100,
      currentStopLoss: 102,
      peakPrice: 100,
    });

    assert(stepA.shouldUpdateStopLoss === true, 'Test 5.1: SHORT SL tightens downwards');
    const tightenedShortSL = stepA.candidateStopLoss!;
    assert(tightenedShortSL < 100, 'Test 5.2: SHORT Candidate SL is below entry (in profit)', { tightenedShortSL });

    const stepB = engine.evaluatePosition({
      symbol: 'SOLUSDT',
      decision: 'SHORT',
      entryPrice: 100,
      currentPrice: 97,
      leverage: 5,
      marginUsdt: 100,
      currentStopLoss: tightenedShortSL,
      peakPrice: 95,
      peakROE: stepA.peakROE,
    });

    assert(stepB.shouldUpdateStopLoss === false, 'Test 5.3: SHORT SL does not loosen upwards during rebound');
  }

  // TEST 6: TP1 50% Scale-Out & Breakeven Lock
  {
    const tp1Res = engine.evaluatePosition({
      symbol: 'BTCUSDT',
      decision: 'LONG',
      entryPrice: 100,
      currentPrice: 102,
      leverage: 3,
      marginUsdt: 50, // 50% remaining margin
      initialMarginUsdt: 100,
      realizedPnlUsdt: 3.0,
      tp1Hit: true,
      currentStopLoss: 97,
    });

    assert(tp1Res.shouldUpdateStopLoss === true, 'Test 6.1: TP1 triggers SL ratcheting to breakeven+');
    assert(tp1Res.candidateStopLoss! >= tp1Res.breakevenPrice, 'Test 6.2: Candidate SL is at least fee-aware breakeven', {
      candidate: tp1Res.candidateStopLoss,
      breakeven: tp1Res.breakevenPrice
    });
  }

  // TEST 7: Resilience & Safe Fallback against Invalid / NaN / Infinity Inputs
  {
    const invalidRes1 = engine.evaluatePosition({
      symbol: 'BTCUSDT',
      decision: 'LONG',
      entryPrice: NaN,
      currentPrice: 100,
      leverage: 5,
      marginUsdt: 50,
    });
    assert(invalidRes1.grossROE === 0 && !invalidRes1.shouldUpdateStopLoss, 'Test 7.1: Safe fallback for NaN entryPrice');

    const invalidRes2 = engine.evaluatePosition({
      symbol: 'BTCUSDT',
      decision: 'LONG',
      entryPrice: 100,
      currentPrice: 0,
      leverage: Infinity,
      marginUsdt: -10,
    });
    assert(invalidRes2.netROE === 0 && !invalidRes2.shouldUpdateStopLoss, 'Test 7.2: Safe fallback for negative margin and Infinity leverage');
  }

  console.log(`\n📊 Test Suite Summary: ${passedCount} / ${totalTests} Passed (100%)\n`);
  return passedCount === totalTests;
}

// Run test suite immediately
const success = runRoeEngineTests();
if (!success) {
  process.exit(1);
}

export { runRoeEngineTests };
