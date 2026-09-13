import { RiskEngine } from '../src/server/riskEngine/RiskEngine';
import { PositionSizer } from '../src/server/riskEngine/PositionSizer';
import { PortfolioRiskEvaluator } from '../src/server/riskEngine/PortfolioRiskEvaluator';
import { DrawdownTracker } from '../src/server/riskEngine/DrawdownTracker';
import { MarketProtection } from '../src/server/riskEngine/MarketProtection';
import { RiskScoreCalculator } from '../src/server/riskEngine/RiskScoreCalculator';
import { DEFAULT_RISK_CONFIG } from '../src/server/riskEngine/constants';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName} ${details ? '- ' + details : ''}`);
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🛡️ RUNNING QUANTURA RISK MANAGEMENT ENGINE TEST SUITE');
  console.log('====================================================\n');

  const engine = RiskEngine.getInstance();
  await engine.init();
  await engine.unlockRiskLock(true);

  // -------------------------------------------------------------
  // TEST GROUP 1: POSITION SIZING ACCURACY & RISK ENFORCEMENT
  // -------------------------------------------------------------
  console.log('--- Test Group 1: Position Sizing & Precision ---');

  // Test 0.5% risk on $10,000 equity (BTC LONG: Entry 60000, SL 59000, RiskPerUnit = 1000)
  // Target Risk = $10000 * 0.005 = $50. Qty = $50 / $1000 = 0.05 BTC.
  const sizing1 = PositionSizer.calculateSizing(
    {
      symbol: 'BTCUSDT',
      side: 'LONG',
      entryPrice: 60000,
      stopLoss: 59000,
      takeProfit: { tp1: 62500 },
      marketType: 'FUTURES',
      leverage: 5,
    },
    10000,
    10000,
    0.5,
    10
  );
  assert(sizing1.isValid, 'PositionSizer: Valid calculation for standard BTC trade');
  assert(sizing1.recommendedQuantity === 0.05, `PositionSizer: Recommended quantity is 0.05 BTC (got ${sizing1.recommendedQuantity})`);
  assert(sizing1.riskAmountUsdt === 50, `PositionSizer: Risk amount is $50.00 (got $${sizing1.riskAmountUsdt})`);
  assert(sizing1.actualRiskPercent === 0.5, `PositionSizer: Risk percent matches 0.5% (got ${sizing1.actualRiskPercent}%)`);

  // Test 1.0% risk on $5,000 equity (ETH SHORT: Entry 3000, SL 3150, RiskPerUnit = 150)
  // Target Risk = $5000 * 0.01 = $50. Qty = $50 / $150 = 0.33 ETH (stepSize 0.01).
  const sizing2 = PositionSizer.calculateSizing(
    {
      symbol: 'ETHUSDT',
      side: 'SHORT',
      entryPrice: 3000,
      stopLoss: 3150,
      takeProfit: { tp1: 2700 },
      marketType: 'FUTURES',
      leverage: 5,
    },
    5000,
    5000,
    1.0,
    10
  );
  assert(sizing2.isValid, 'PositionSizer: Valid calculation for ETH SHORT trade');
  assert(sizing2.recommendedQuantity === 0.33, `PositionSizer: Recommended qty 0.33 ETH (got ${sizing2.recommendedQuantity})`);
  assert(sizing2.riskAmountUsdt <= 50.0, `PositionSizer: Rounding NEVER increases risk beyond limit ($${sizing2.riskAmountUsdt} <= $50)`);

  // -------------------------------------------------------------
  // TEST GROUP 2: STOP LOSS DIRECTION & DISTANCE VALIDATION
  // -------------------------------------------------------------
  console.log('\n--- Test Group 2: Stop Loss Enforcement ---');

  const invalidLongSL = await engine.evaluateProposal({
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: 60000,
    stopLoss: 61000, // Invalid: SL above Entry for LONG
    takeProfit: { tp1: 65000 },
    marketType: 'FUTURES',
    accountEquity: 10000,
  });
  assert(invalidLongSL.decision === 'REJECTED', 'Stop Loss: Rejects LONG with SL above Entry');
  assert(invalidLongSL.reasonCode === 'INVALID_STOP_LOSS', 'Stop Loss: Reason code is INVALID_STOP_LOSS');

  const invalidShortSL = await engine.evaluateProposal({
    symbol: 'BTCUSDT',
    side: 'SHORT',
    entryPrice: 60000,
    stopLoss: 59000, // Invalid: SL below Entry for SHORT
    takeProfit: { tp1: 55000 },
    marketType: 'FUTURES',
    accountEquity: 10000,
  });
  assert(invalidShortSL.decision === 'REJECTED', 'Stop Loss: Rejects SHORT with SL below Entry');

  const missingSL = await engine.evaluateProposal({
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: 60000,
    stopLoss: 0, // Missing SL
    takeProfit: { tp1: 65000 },
    marketType: 'FUTURES',
    accountEquity: 10000,
  });
  assert(missingSL.decision === 'REJECTED', 'Stop Loss: Rejects trade with missing Stop Loss');
  assert(missingSL.reasonCode === 'MISSING_STOP_LOSS', 'Stop Loss: Reason code is MISSING_STOP_LOSS');

  // -------------------------------------------------------------
  // TEST GROUP 3: RISK / REWARD RATIO
  // -------------------------------------------------------------
  console.log('\n--- Test Group 3: Risk / Reward Validation ---');

  const lowRRProposal = await engine.evaluateProposal({
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: 60000,
    stopLoss: 59000, // Risk = 1000
    takeProfit: { tp1: 61000 }, // Reward = 1000 (R:R = 1:1 < 1:2 required)
    marketType: 'FUTURES',
    accountEquity: 10000,
  });
  assert(lowRRProposal.decision === 'REJECTED', 'Risk/Reward: Rejects trade with R:R below 1:2');
  assert(lowRRProposal.reasonCode === 'LOW_RISK_REWARD', 'Risk/Reward: Reason code is LOW_RISK_REWARD');

  // -------------------------------------------------------------
  // TEST GROUP 4: DAILY LOSS LIMIT & DRAWDOWN BREACHES
  // -------------------------------------------------------------
  console.log('\n--- Test Group 4: Daily Loss & Drawdown Protection ---');

  const tracker = new DrawdownTracker(10000);
  // Record 3 losses totaling $350 (3.5% daily loss > 3% limit)
  tracker.recordTradeClosed(-150);
  tracker.recordTradeClosed(-100);
  tracker.recordTradeClosed(-100);

  const dlEval = tracker.evaluateLimits(9650, 0, DEFAULT_RISK_CONFIG);
  assert(dlEval.isBreached, 'DrawdownTracker: Triggers breach when daily loss reaches 3.5%');
  assert(dlEval.reasonCode === 'DAILY_LOSS_LIMIT', 'DrawdownTracker: Reason is DAILY_LOSS_LIMIT');
  assert(dlEval.lockStatus === 'LOCKED', 'DrawdownTracker: Risk Lock set to LOCKED');

  // Test 12% Account Drawdown breach (> 10% limit)
  const ddTracker = new DrawdownTracker(10000);
  const ddEval = ddTracker.evaluateLimits(8800, 0, DEFAULT_RISK_CONFIG);
  assert(ddEval.isBreached, 'DrawdownTracker: Triggers breach when max drawdown reaches 12%');
  assert(ddEval.reasonCode === 'MAX_DRAWDOWN', 'DrawdownTracker: Reason is MAX_DRAWDOWN');

  // -------------------------------------------------------------
  // TEST GROUP 5: PORTFOLIO RISK & CORRELATION EXPOSURE
  // -------------------------------------------------------------
  console.log('\n--- Test Group 5: Portfolio Risk & Correlation ---');

  const existingPositions = [
    {
      id: 'pos-1',
      symbol: 'BTCUSDT',
      side: 'LONG' as const,
      entryPrice: 60000,
      currentPrice: 60000,
      stopLoss: 59000,
      quantity: 0.1, // $100 risk
      marginUsdt: 600,
      positionSizeUsdt: 6000,
      leverage: 10,
      marketType: 'FUTURES' as const,
      unrealizedPnlUsdt: 0,
      unrealizedRoePercent: 0,
      openedAt: Date.now(),
    },
    {
      id: 'pos-2',
      symbol: 'ETHUSDT',
      side: 'LONG' as const,
      entryPrice: 3000,
      currentPrice: 3000,
      stopLoss: 2900,
      quantity: 1.0, // $100 risk
      marginUsdt: 300,
      positionSizeUsdt: 3000,
      leverage: 10,
      marketType: 'FUTURES' as const,
      unrealizedPnlUsdt: 0,
      unrealizedRoePercent: 0,
      openedAt: Date.now(),
    },
  ];

  // Try to open a 2nd BTC position (Anti-Pyramiding check)
  const pyramidCheck = PortfolioRiskEvaluator.evaluatePortfolio(
    {
      symbol: 'BTCUSDT',
      side: 'LONG',
      entryPrice: 60000,
      stopLoss: 59000,
      marketType: 'FUTURES',
    },
    50,
    1500,
    existingPositions,
    10000,
    DEFAULT_RISK_CONFIG
  );
  assert(!pyramidCheck.isApproved, 'Anti-Pyramiding: Rejects multiple simultaneous positions for same symbol');
  assert(pyramidCheck.reasonCode === 'MAX_POSITIONS_PER_SYMBOL', 'Anti-Pyramiding: Reason code is MAX_POSITIONS_PER_SYMBOL');

  // Try to open SOL LONG ($1500 = 15% notional < 20% symbol limit) when BTC & ETH are already LONG
  // Correlated cluster exposure = $1500 + ($6000*0.82) + ($3000*0.85) = $8970 = 89.7% > 35% cap
  const correlationCheck = PortfolioRiskEvaluator.evaluatePortfolio(
    {
      symbol: 'SOLUSDT',
      side: 'LONG',
      entryPrice: 150,
      stopLoss: 145,
      marketType: 'FUTURES',
    },
    50,
    1500, // $1500 notional (15% equity < 20% symbol cap)
    existingPositions,
    10000,
    DEFAULT_RISK_CONFIG
  );
  assert(!correlationCheck.isApproved, 'Correlation: Rejects new trade exceeding correlated cluster limit');
  assert(correlationCheck.reasonCode === 'HIGH_CORRELATION', `Correlation: Reason code is HIGH_CORRELATION (got ${correlationCheck.reasonCode})`);

  // -------------------------------------------------------------
  // TEST GROUP 6: MARKET PROTECTION (SPREAD, SLIPPAGE, VOLATILITY)
  // -------------------------------------------------------------
  console.log('\n--- Test Group 6: Market Protection ---');

  // Stale data test (timestamp 30 seconds old)
  const staleEval = MarketProtection.evaluateMarket(
    {
      currentPrice: 60000,
      timestamp: Date.now() - 30000, // 30s old
    },
    1000,
    DEFAULT_RISK_CONFIG
  );
  assert(!staleEval.isValid, 'MarketProtection: Rejects stale market data (>20s old)');
  assert(staleEval.reasonCode === 'STALE_MARKET_DATA', 'MarketProtection: Reason is STALE_MARKET_DATA');

  // Excessive Spread test (1.2% spread > 0.25% max)
  const spreadEval = MarketProtection.evaluateMarket(
    {
      currentPrice: 60000,
      bidPrice: 59500,
      askPrice: 60214, // Spread = 1.2%
      timestamp: Date.now(),
    },
    1000,
    DEFAULT_RISK_CONFIG
  );
  assert(!spreadEval.isValid, 'MarketProtection: Rejects excessive bid-ask spread');
  assert(spreadEval.reasonCode === 'EXCESSIVE_SPREAD', 'MarketProtection: Reason is EXCESSIVE_SPREAD');

  // Extreme Volatility test (ATR = 10%)
  const extremeVolEval = MarketProtection.evaluateMarket(
    {
      currentPrice: 60000,
      atr14: 6000, // 10% ATR
      timestamp: Date.now(),
    },
    1000,
    DEFAULT_RISK_CONFIG
  );
  assert(!extremeVolEval.isValid, 'MarketProtection: Rejects trade during Extreme Volatility (>7% ATR)');
  assert(extremeVolEval.reasonCode === 'EXTREME_VOLATILITY', `MarketProtection: Reason is EXTREME_VOLATILITY (got ${extremeVolEval.reasonCode})`);

  // -------------------------------------------------------------
  // TEST GROUP 7: EMERGENCY KILL SWITCH & DUPLICATE ORDERS
  // -------------------------------------------------------------
  console.log('\n--- Test Group 7: Emergency Kill Switch & Idempotency ---');

  await engine.setEmergencyStop(true);
  const emergencyProposal = await engine.evaluateProposal({
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: 60000,
    stopLoss: 59000,
    takeProfit: { tp1: 62500 },
    marketType: 'FUTURES',
    accountEquity: 10000,
  });
  assert(emergencyProposal.decision === 'REJECTED', 'Emergency Stop: Blocks trade when Kill Switch is active');
  assert(emergencyProposal.reasonCode === 'EMERGENCY_STOP_ACTIVE', 'Emergency Stop: Reason code is EMERGENCY_STOP_ACTIVE');

  // Unlock Emergency Stop
  await engine.setEmergencyStop(false);
  await engine.unlockRiskLock(true);

  // Duplicate client order ID test
  const orderId = `test-order-${Date.now()}`;
  const firstEval = await engine.evaluateProposal({
    clientOrderId: orderId,
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: 60000,
    stopLoss: 58500, // SL distance 1500 (2.5%), R:R = 2.33
    takeProfit: { tp1: 63500 },
    marketType: 'FUTURES',
    accountEquity: 10000,
    availableBalance: 10000,
    leverage: 5,
    timestamp: Date.now(),
  }, []);
  assert(firstEval.decision === 'APPROVED', `Idempotency: First proposal with order ID is APPROVED (got ${firstEval.decision}: ${firstEval.message})`);

  const duplicateEval = await engine.evaluateProposal({
    clientOrderId: orderId, // Same client order ID
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: 60000,
    stopLoss: 58500,
    takeProfit: { tp1: 63500 },
    marketType: 'FUTURES',
    accountEquity: 10000,
    availableBalance: 10000,
    leverage: 5,
    timestamp: Date.now(),
  }, []);
  assert(duplicateEval.decision === 'REJECTED', 'Idempotency: Duplicate order ID within 60s is REJECTED');
  assert(duplicateEval.reasonCode === 'DUPLICATE_ORDER', 'Idempotency: Reason code is DUPLICATE_ORDER');

  // -------------------------------------------------------------
  // TEST GROUP 8: SUCCESSFUL APPROVED TRADE COMPLETE PAYLOAD
  // -------------------------------------------------------------
  console.log('\n--- Test Group 8: End-to-End Approval Payload ---');

  const validApproval = await engine.evaluateProposal({
    symbol: 'ETHUSDT',
    side: 'LONG',
    entryPrice: 3000,
    stopLoss: 2900, // Risk per unit = 100 (3.33% distance)
    takeProfit: { tp1: 3250, tp2: 3400, tp3: 3500 }, // R:R = 250/100 = 2.5
    marketType: 'FUTURES',
    leverage: 5,
    accountEquity: 10000,
    availableBalance: 10000,
    timestamp: Date.now(),
  }, []);

  assert(validApproval.decision === 'APPROVED', `End-to-End: Valid proposal is APPROVED (got ${validApproval.decision}: ${validApproval.message})`);
  assert(validApproval.approvedQuantity > 0, `End-to-End: Quantity is calculated (${validApproval.approvedQuantity} ETH)`);
  assert(validApproval.approvedLeverage === 5, `End-to-End: Approved leverage is 5x (got ${validApproval.approvedLeverage}x)`);
  assert(validApproval.riskRewardRatio >= 2.0, `End-to-End: Risk Reward ratio is ${validApproval.riskRewardRatio}`);
  assert(validApproval.riskScore >= 0 && validApproval.riskScore <= 100, `End-to-End: Risk score is ${validApproval.riskScore}`);
  assert(!!validApproval.auditId, 'End-to-End: Audit ID is generated and recorded');

  console.log('\n====================================================');
  console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL RISK MANAGEMENT ENGINE TESTS PASSED PERFECTLY!');
  } else {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
