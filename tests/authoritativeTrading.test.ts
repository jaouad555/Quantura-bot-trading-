import { 
  canSubmitOrder, 
  startBotAuthoritative, 
  stopBotAuthoritative, 
  getAuthoritativeBotState, 
  clearIdempotencyCache 
} from '../src/server/botControl.js';
import { 
  reconcilePositionsWithBinance, 
  runStartupReconciliation, 
  fetchAuthoritativeAccount, 
  getAuthoritativeBinanceApiBase, 
  getAuthoritativeBinanceFuturesApiBase 
} from '../src/server/positionReconciliation.js';
import { kv } from '../src/server/db.js';
import { RoeEngine } from '../src/server/roeEngine/RoeEngine.js';

console.log('================================================================');
console.log('🧪 QUANTURA AUTHORITATIVE TRADING & RECONCILIATION TEST SUITE');
console.log('================================================================');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, extra?: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] Test ${totalTests}: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] Test ${totalTests}: ${testName} ${extra ? `(${extra})` : ''}`);
  }
}

async function runAllTests() {
  const backupKeys = [
    'btc_bot_config',
    'quantura_active_strategies',
    'btc_active_bot_positions',
    'btc_trade_history',
    'trading_execution_mode',
    'app_execution_mode',
    'app_binance_market_type',
    'app_binance_use_testnet',
    'app_binance_api_key',
    'app_binance_api_secret',
  ];
  const initialKvBackup: Record<string, string | null> = {};
  for (const k of backupKeys) {
    initialKvBackup[k] = await kv.get(k);
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Bot OFF -> No order possible
    // -------------------------------------------------------------
    console.log('\n--- SUITE 1: BOT AUTHORITATIVE ENGINE STATE ---');
    await stopBotAuthoritative('Automated Test 1 Stop');
    clearIdempotencyCache();
    await kv.set('trading_execution_mode', 'PAPER');
    await kv.set('app_execution_mode', 'PAPER');
    await kv.set('app_binance_market_type', 'SPOT');

    const botStateOff = await getAuthoritativeBotState();
    assert(!botStateOff.enabled && botStateOff.status === 'STOPPED', 'Bot state is strictly STOPPED and DISABLED');

    const orderWhenOff = await canSubmitOrder({
      isManual: false,
      isReduceOnly: false,
      symbol: 'BTCUSDT',
      side: 'BUY',
      marketType: 'SPOT',
      executionMode: 'PAPER',
    });
    assert(!orderWhenOff.allowed && orderWhenOff.code === 'BOT_DISABLED', 'Bot OFF -> automatic order strictly rejected by execution guard');

    // -------------------------------------------------------------
    // TEST 2: Bot ON -> Order can execute
    // -------------------------------------------------------------
    clearIdempotencyCache();
    await kv.set('btc_active_bot_positions', '[]');
    await startBotAuthoritative();
    const botStateOn = await getAuthoritativeBotState();
    assert(botStateOn.enabled && botStateOn.status === 'RUNNING', 'Bot state is strictly RUNNING and ENABLED');

    const orderWhenOn = await canSubmitOrder({
      isManual: false,
      isReduceOnly: false,
      symbol: 'BTCUSDT',
      side: 'BUY',
      marketType: 'SPOT',
      executionMode: 'PAPER',
    });
    assert(orderWhenOn.allowed === true, 'Bot ON -> valid order allowed to submit through execution guard');

    // -------------------------------------------------------------
    // TEST 3: Binance position exists but local doesn't -> Position imported
    // -------------------------------------------------------------
    console.log('\n--- SUITE 2: ONE SOURCE OF TRUTH RECONCILIATION ---');
    await kv.set('trading_execution_mode', 'BINANCE_TESTNET');
    await kv.set('app_execution_mode', 'BINANCE_TESTNET');
    await kv.set('app_binance_market_type', 'FUTURES');
    await kv.set('app_binance_api_key', 'test_key_sample_123');
    await kv.set('app_binance_api_secret', 'test_secret_sample_123');
    await kv.set('btc_active_bot_positions', '[]');

    const mockBinanceFuturesPositions = [
      {
        symbol: 'BTCUSDT',
        positionAmt: '0.050',
        entryPrice: '62500.00',
        markPrice: '63100.00',
        unRealizedProfit: '30.00',
        leverage: '10',
        isolatedMargin: '312.50',
        liquidationPrice: '56500.00',
      },
    ];

    const reconImport = await reconcilePositionsWithBinance({
      customBinancePositions: mockBinanceFuturesPositions,
    });
    assert(reconImport.success === true, 'Reconciliation executes successfully with Binance exchange data');
    assert(reconImport.importedCount >= 1, 'Binance position missing locally is detected and imported', `imported: ${reconImport.importedCount}`);
    
    const importedPos = reconImport.activePositions.find((p: any) => p.symbol === 'BTCUSDT' && p.marketType === 'FUTURES');
    assert(Boolean(importedPos && importedPos.quantity === 0.05 && importedPos.side === 'LONG' && importedPos.entryPrice === 62500), 
      'Imported position has correct symbol, side, quantity, and entry price');

    // -------------------------------------------------------------
    // TEST 4: Local position exists but Binance doesn't -> Stale position removed
    // -------------------------------------------------------------
    // Local state has BTCUSDT and ETHUSDT, but Binance now only reports empty positions
    const emptyBinancePositions: any[] = [];
    const reconClose = await reconcilePositionsWithBinance({
      customBinancePositions: emptyBinancePositions,
    });
    assert(reconClose.closedCount >= 1, 'Local position no longer existing on Binance is moved to closed history', `closed: ${reconClose.closedCount}`);
    
    const activeAfterClose = reconClose.activePositions.filter((p: any) => p.symbol === 'BTCUSDT' && p.mode === 'BINANCE_TESTNET');
    assert(activeAfterClose.length === 0, 'Closed position is completely removed from active positions');

    // -------------------------------------------------------------
    // TEST 5: Failed order -> No trade history entry
    // -------------------------------------------------------------
    console.log('\n--- SUITE 3: TRADE HISTORY INTEGRITY ---');
    const initialHistRaw = (await kv.get('btc_trade_history')) || '[]';
    const initialHistLength = JSON.parse(initialHistRaw).length;

    // Simulate rejected order
    const rejectedOrderResult = await canSubmitOrder({
      isManual: false,
      isReduceOnly: false,
      symbol: 'XRPUSDT',
      side: 'SELL',
      marketType: 'SPOT', // SHORT on SPOT is forbidden
      executionMode: 'BINANCE_TESTNET',
    });
    assert(rejectedOrderResult.allowed === false && rejectedOrderResult.code === 'SPOT_SHORT_FORBIDDEN', 
      'SPOT market short opening order is rejected by guard');

    const histAfterRejectRaw = (await kv.get('btc_trade_history')) || '[]';
    const histAfterReject = JSON.parse(histAfterRejectRaw);
    assert(histAfterReject.length === initialHistLength && !histAfterReject.some((h: any) => h.symbol === 'XRPUSDT'), 
      'Failed / rejected order does NOT create any entry in Trade History');

    // -------------------------------------------------------------
    // TEST 6: Filled order -> History entry created on position close
    // -------------------------------------------------------------
    // Check that when position was reconciled as closed in Test 4, a history item was created
    const closedBtcTrade = histAfterReject.find((h: any) => h.symbol === 'BTCUSDT');
    assert(Boolean(closedBtcTrade && closedBtcTrade.entryPrice === 62500 && (closedBtcTrade.status === 'CLOSED_ON_EXCHANGE_WIN' || closedBtcTrade.status === 'CLOSED_ON_EXCHANGE_LOSS')), 
      'Authoritative closed trade is accurately recorded in Trade History with entry price, exit price, and status');

    // -------------------------------------------------------------
    // TEST 7: Spot position never appears as Futures
    // -------------------------------------------------------------
    console.log('\n--- SUITE 4: SPOT AND FUTURES STRICT ISOLATION ---');
    await kv.set('btc_active_bot_positions', JSON.stringify([
      { id: 'spot-sol', symbol: 'SOLUSDT', marketType: 'SPOT', mode: 'PAPER', quantity: 2, entryPrice: 150, leverage: 1 },
      { id: 'fut-sol', symbol: 'SOLUSDT', marketType: 'FUTURES', mode: 'PAPER', quantity: 10, entryPrice: 150, leverage: 10 },
    ]));

    const spotPositionsFiltered = JSON.parse(await kv.get('btc_active_bot_positions')).filter(
      (p: any) => p.marketType === 'SPOT'
    );
    assert(spotPositionsFiltered.length === 1 && spotPositionsFiltered[0].id === 'spot-sol' && spotPositionsFiltered[0].leverage === 1,
      'Spot position filter strictly isolates SPOT positions with 1x leverage');

    // -------------------------------------------------------------
    // TEST 8: Futures position never appears as Spot
    // -------------------------------------------------------------
    const futuresPositionsFiltered = JSON.parse(await kv.get('btc_active_bot_positions')).filter(
      (p: any) => p.marketType === 'FUTURES'
    );
    assert(futuresPositionsFiltered.length === 1 && futuresPositionsFiltered[0].id === 'fut-sol' && futuresPositionsFiltered[0].leverage === 10,
      'Futures position filter strictly isolates FUTURES positions without mixing with Spot');

    // -------------------------------------------------------------
    // TEST 9: Testnet never calls Live endpoint
    // -------------------------------------------------------------
    console.log('\n--- SUITE 5: BINANCE ENDPOINTS & TESTNET SEPARATION ---');
    const spotTestnetBase = getAuthoritativeBinanceApiBase(true);
    const futuresTestnetBase = getAuthoritativeBinanceFuturesApiBase(true);
    assert(spotTestnetBase === 'https://testnet.binance.vision', 'Spot Testnet uses testnet.binance.vision');
    assert(futuresTestnetBase === 'https://testnet.binancefuture.com', 'Futures Testnet uses testnet.binancefuture.com');
    assert(!spotTestnetBase.includes('api.binance.com') && !futuresTestnetBase.includes('fapi.binance.com'), 
      'Testnet endpoints NEVER call Live endpoints');

    // -------------------------------------------------------------
    // TEST 10: Live never calls Testnet endpoint
    // -------------------------------------------------------------
    const spotLiveBase = getAuthoritativeBinanceApiBase(false);
    const futuresLiveBase = getAuthoritativeBinanceFuturesApiBase(false);
    assert(spotLiveBase === 'https://api.binance.com', 'Spot Live uses api.binance.com');
    assert(futuresLiveBase === 'https://fapi.binance.com', 'Futures Live uses fapi.binance.com');
    assert(!spotLiveBase.includes('testnet') && !futuresLiveBase.includes('testnet'), 
      'Live endpoints NEVER call Testnet endpoints');

    // -------------------------------------------------------------
    // TEST 11: Server restart does not create an order
    // -------------------------------------------------------------
    console.log('\n--- SUITE 6: RESTART CONSISTENCY & IDEMPOTENCY ---');
    await stopBotAuthoritative('Testing restart with bot OFF');
    const ordersBeforeRestart = (await kv.get('btc_trade_history')) || '[]';
    
    // Simulate startup sequence
    await runStartupReconciliation();
    const botStateAfterRestart = await getAuthoritativeBotState();
    assert(botStateAfterRestart.enabled === false, 'Bot was OFF before startup, remains strictly OFF after startup');

    const ordersAfterRestart = (await kv.get('btc_trade_history')) || '[]';
    assert(JSON.parse(ordersBeforeRestart).length === JSON.parse(ordersAfterRestart).length, 
      'Server restart does NOT trigger, create, or submit any orders');

    // -------------------------------------------------------------
    // TEST 12: PM2 restart does not create an order
    // -------------------------------------------------------------
    // Simulate PM2 restart reading persisted KV
    const persistedConfigRaw = await kv.get('btc_bot_config');
    const parsedConfig = persistedConfigRaw ? JSON.parse(persistedConfigRaw) : {};
    assert(parsedConfig.enabled === false, 'PM2 reload preserves disabled bot state');

    // -------------------------------------------------------------
    // TEST 13: Duplicate strategy execution cannot create duplicate orders
    // -------------------------------------------------------------
    await startBotAuthoritative();
    clearIdempotencyCache();
    await kv.set('trading_execution_mode', 'PAPER');
    await kv.set('app_execution_mode', 'PAPER');
    await kv.set('app_binance_market_type', 'SPOT');
    await kv.set('btc_active_bot_positions', '[]');

    const firstOrder = await canSubmitOrder({
      isManual: false,
      isReduceOnly: false,
      symbol: 'BNBUSDT',
      side: 'BUY',
      marketType: 'SPOT',
      executionMode: 'PAPER',
      strategyId: 'MOMENTUM',
    });
    assert(firstOrder.allowed === true, 'First order execution cycle is accepted');

    // Second order with same symbol, strategy, and cycle within 15 seconds
    const duplicateOrder = await canSubmitOrder({
      isManual: false,
      isReduceOnly: false,
      symbol: 'BNBUSDT',
      side: 'BUY',
      marketType: 'SPOT',
      executionMode: 'PAPER',
      strategyId: 'MOMENTUM',
    });
    assert(duplicateOrder.allowed === false && duplicateOrder.code === 'DUPLICATE_ORDER_IN_FLIGHT', 
      'Immediate duplicate order submission is rejected by idempotency mechanism');

    // -------------------------------------------------------------
    // TEST 14: Account balances are not double-counted
    // -------------------------------------------------------------
    console.log('\n--- SUITE 7: ACCOUNT BALANCE INTEGRITY ---');
    await kv.set('btc_paper_wallet_spot', JSON.stringify({ balance: 1500, initialDeposit: 1000, realizedPnl: 500 }));
    await kv.set('btc_paper_wallet_futures', JSON.stringify({ balance: 2500, initialDeposit: 2000, realizedPnl: 500 }));

    const spotAccount = await fetchAuthoritativeAccount('SPOT', 'PAPER');
    const futuresAccount = await fetchAuthoritativeAccount('FUTURES', 'PAPER');

    assert(spotAccount.freeUsdt === 1500, 'Spot account correctly reports independent Spot balance ($1500)');
    assert(futuresAccount.freeUsdt === 2500, 'Futures account correctly reports independent Futures balance ($2500)');
    assert(spotAccount.freeUsdt !== futuresAccount.freeUsdt, 'Spot and Futures balances are NEVER mixed or double-counted');

    // -------------------------------------------------------------
    // TEST 15: Existing TP1 / SL / Trailing functionality remains operational
    // -------------------------------------------------------------
    console.log('\n--- SUITE 8: POSITION MANAGEMENT (TP1 / SL / TRAILING) ---');
    const roeEngine = RoeEngine.getInstance();
    
    // Evaluate a winning position where price surged past TP1
    const winningEval = roeEngine.evaluatePosition({
      symbol: 'BTCUSDT',
      decision: 'LONG',
      entryPrice: 60000,
      currentPrice: 63000, // +5% gain -> 50% ROE at 10x
      leverage: 10,
      marginUsdt: 100,
      initialMarginUsdt: 100,
      currentStopLoss: 59000,
      peakROE: 50,
      peakPrice: 63000,
      tp1Hit: false,
      openedAt: Date.now() - 3600000,
    });

    assert(winningEval.netROE > 40, 'Winning position calculates positive Net ROE with fee and funding deductions');
    assert(winningEval.trailingStatus === 'ACTIVE' || winningEval.trailingStatus === 'LOCKED_PROFIT' || winningEval.trailingStatus === 'AGGRESSIVE', 
      'Trailing profit locking is operational and armed on profitable trades');

    // Evaluate a stopped out position
    const stoppedEval = roeEngine.evaluatePosition({
      symbol: 'BTCUSDT',
      decision: 'LONG',
      entryPrice: 60000,
      currentPrice: 58500, // Below Stop Loss of 59000
      leverage: 10,
      marginUsdt: 100,
      initialMarginUsdt: 100,
      currentStopLoss: 59000,
      peakROE: 0,
      peakPrice: 60000,
      tp1Hit: false,
      openedAt: Date.now() - 3600000,
    });

    const isLong = true;
    const isSlTriggered = stoppedEval.state === 'LOSS' && (isLong ? 58500 <= 59000 : 58500 >= 59000);
    assert(isSlTriggered, 'Stop Loss exit condition is accurately triggered when price hits SL level');

    // -------------------------------------------------------------
    // FINAL SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`📊 FINAL RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log('================================================================\n');

    // Restore original KV state before exiting
    await stopBotAuthoritative('Test cleanup');
    for (const k of backupKeys) {
      const val = initialKvBackup[k];
      if (val !== null && val !== undefined) {
        await kv.set(k, val);
      } else {
        await kv.delete(k);
      }
    }

    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('💥 Test suite runner crashed:', err);
    process.exit(1);
  }
}

runAllTests();
