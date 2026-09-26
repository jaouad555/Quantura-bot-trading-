import * as fs from 'fs';
import * as path from 'path';
import { kv } from '../src/server/db';
import { isValidPersistedPosition, PersistedPosition } from '../src/server/riskEngine/types';

/**
 * Migration script to clean up malformed positions in 'btc_active_bot_positions'
 * Drops any entries missing critical fields (side, quantity, entryPrice, stopLoss, currentPrice, leverage).
 */
async function migratePositions() {
  console.log('=====================================================');
  console.log('  QUANTURA BOT: POSITIONS DATA CLEANUP & MIGRATION   ');
  console.log('=====================================================\n');

  try {
    const rawData = await kv.get('btc_active_bot_positions');
    if (!rawData) {
      console.log('ℹ️ No active positions found under "btc_active_bot_positions" key. Nothing to migrate.');
      return;
    }

    let parsed: any[];
    try {
      parsed = JSON.parse(rawData);
    } catch (e: any) {
      console.error('❌ Failed to parse "btc_active_bot_positions" JSON:', e.message);
      console.log('Resetting corrupted key to empty array []...');
      await kv.set('btc_active_bot_positions', '[]');
      return;
    }

    if (!Array.isArray(parsed)) {
      console.warn('⚠️ "btc_active_bot_positions" is not an array. Resetting to [].');
      await kv.set('btc_active_bot_positions', '[]');
      return;
    }

    console.log(`🔍 Total raw positions retrieved from KV store: ${parsed.length}\n`);

    const validPositions: PersistedPosition[] = [];
    const droppedPositions: any[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const pos = parsed[i];
      if (isValidPersistedPosition(pos)) {
        // Normalize schema
        const normalized: PersistedPosition = {
          id: pos.id || `pos-${Date.now()}-${i}`,
          symbol: String(pos.symbol).toUpperCase(),
          side: (pos.side || pos.decision) as 'LONG' | 'SHORT',
          decision: (pos.side || pos.decision) as 'LONG' | 'SHORT',
          entryPrice: Number(pos.entryPrice),
          currentPrice: Number(pos.currentPrice || pos.entryPrice),
          stopLoss: Number(pos.stopLoss),
          quantity: Number(pos.quantity || pos.remainingAmountBtc),
          initialAmountUsdt: Number(pos.initialAmountUsdt || pos.marginUsdt || 10),
          remainingAmountUsdt: Number(pos.remainingAmountUsdt || pos.marginUsdt || 10),
          marginUsdt: Number(pos.marginUsdt || pos.initialAmountUsdt || 10),
          positionSizeUsdt: Number(pos.positionSizeUsdt || (pos.marginUsdt * (pos.leverage || 1))),
          leverage: Number(pos.leverage || 1),
          marketType: pos.marketType || 'FUTURES',
          strategyName: pos.strategyName || 'Quantitative Bot',
          openedAt: Number(pos.openedAt || Date.now()),
          tp1: pos.tp1 ? Number(pos.tp1) : undefined,
          tp2: pos.tp2 ? Number(pos.tp2) : undefined,
          tp3: pos.tp3 ? Number(pos.tp3) : undefined,
          realizedPnlUsdt: Number(pos.realizedPnlUsdt || 0),
          unrealizedPnlUsdt: Number(pos.unrealizedPnlUsdt || 0),
          roePercent: Number(pos.roePercent || 0),
          mode: pos.mode || 'PAPER',
        };
        validPositions.push(normalized);
      } else {
        droppedPositions.push(pos);
        console.warn(`🗑️  [DROPPED] Position #${i + 1} (${pos?.symbol || 'UNKNOWN'}): Missing critical fields.`);
        console.warn(`   Malformed object:`, JSON.stringify(pos));
      }
    }

    // Persist cleaned array back to KV store
    await kv.set('btc_active_bot_positions', JSON.stringify(validPositions));

    console.log('\n=====================================================');
    console.log('               MIGRATION SUMMARY                    ');
    console.log('=====================================================');
    console.log(`✅ Kept (Valid):    ${validPositions.length}`);
    console.log(`🗑️  Dropped (Broken): ${droppedPositions.length}`);
    console.log(`💾 KV Store updated with sanitized records.`);
    console.log('=====================================================\n');

  } catch (error: any) {
    console.error('❌ Migration failed with error:', error);
    process.exit(1);
  }
}

migratePositions().then(() => {
  console.log('🎉 Migration script completed successfully.');
  process.exit(0);
});
