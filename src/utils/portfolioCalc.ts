import { ActiveBotPosition, PaperWallet, BinanceAccountInfo } from '../types';

/**
 * Calculates the unrealized PnL (in USDT) for an active bot position.
 */
export function calculatePositionUnrealizedPnl(
  pos: ActiveBotPosition,
  livePrice?: number
): number {
  const p = (livePrice && livePrice > 0) ? livePrice : (pos.currentPrice || pos.entryPrice);
  if (!pos.entryPrice || !p || isNaN(p) || isNaN(pos.entryPrice)) return 0;
  
  const isLong = pos.decision === 'LONG';
  const lev = Math.max(1, pos.leverage || 1);
  const margin = typeof pos.remainingAmountUsdt === 'number' && pos.remainingAmountUsdt >= 0
    ? pos.remainingAmountUsdt
    : (pos.marginUsdt || pos.initialAmountUsdt || 0);
    
  if (margin <= 0) return 0;

  // If using authoritative currentPrice and pos.unrealizedPnlUsdt is present, use server value
  if ((!livePrice || livePrice === pos.currentPrice) && typeof pos.unrealizedPnlUsdt === 'number' && !isNaN(pos.unrealizedPnlUsdt)) {
    return pos.unrealizedPnlUsdt;
  }
  
  const priceDiffPct = ((p - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1);
  const grossPnl = margin * priceDiffPct * lev;

  // Conservative fee deduction (0.05% entry + 0.05% exit on notional)
  const positionNotional = margin * lev;
  const estimatedFees = positionNotional * 0.001;
  const netPnl = grossPnl - estimatedFees;
  
  // Guard against loss exceeding 100% of isolated margin
  if (netPnl < -margin) {
    return -margin;
  }
  
  return netPnl;
}

/**
 * Calculates total portfolio equity and detailed sub-metrics:
 * Supports both PAPER simulation and BINANCE LIVE / TESTNET mode seamlessly.
 *
 * In Futures:
 * Total Equity = Free Cash (Available Balance) + In-Trade Margins + Floating Unrealized PnL
 * (Or Binance totalMarginBalance + live tick difference)
 */
export function calculatePortfolioMetrics(
  paperWallet?: PaperWallet | null,
  activeBotPositions?: ActiveBotPosition[] | null,
  liveTickerPrice?: number,
  selectedSymbol?: string,
  isLiveMode?: boolean,
  binanceAccountInfo?: BinanceAccountInfo | null
) {
  const isLive = Boolean(isLiveMode);
  const positions = (activeBotPositions || []).filter(p => 
    isLive ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER')
  );

  const inTradeMargin = positions.reduce((acc, p) => {
    const margin = typeof p.remainingAmountUsdt === 'number' && p.remainingAmountUsdt >= 0
      ? p.remainingAmountUsdt
      : (p.marginUsdt || p.initialAmountUsdt || 0);
    return acc + Math.max(0, margin);
  }, 0);

  const floatingPnl = positions.reduce((acc, p) => {
    const isSelected = selectedSymbol && p.symbol.toLowerCase() === selectedSymbol.toLowerCase();
    const priceToUse = (isSelected && liveTickerPrice && liveTickerPrice > 0) ? liveTickerPrice : (p.currentPrice || p.entryPrice);
    return acc + calculatePositionUnrealizedPnl(p, priceToUse);
  }, 0);

  let freeCash = 0;
  let realizedPnl = 0;
  let totalEquity = 0;

  if (isLive && binanceAccountInfo) {
    const rawFree = Number(binanceAccountInfo.freeUsdt) || 0;
    const rawTotalEquity = Number(binanceAccountInfo.totalUsdtEquity) || rawFree;
    
    freeCash = Math.max(0, rawFree);
    realizedPnl = 0;

    // In Binance Futures, totalMarginBalance from API already includes the API-snapshot floating PnL.
    // We add the difference with real-time UI floating PnL for ultra-smooth responsiveness!
    if (rawTotalEquity > 0) {
      const apiUnrealized = Number(binanceAccountInfo.unrealizedProfit) || 0;
      const livePnlDelta = floatingPnl - apiUnrealized;
      totalEquity = Math.max(0, rawTotalEquity + livePnlDelta);
    } else {
      totalEquity = Math.max(0, freeCash + inTradeMargin + floatingPnl);
    }
  } else {
    // Paper trading mode
    freeCash = Math.max(0, paperWallet?.balance ?? 1000);
    realizedPnl = paperWallet?.realizedPnl ?? 0;
    totalEquity = Math.max(0, freeCash + inTradeMargin + floatingPnl);
  }

  // Base capital estimation for percentage calculations
  const baselineCapital = isLive 
    ? Math.max(10, totalEquity - floatingPnl) 
    : Math.max(10, freeCash + inTradeMargin - realizedPnl);

  const netPnlCombined = floatingPnl + realizedPnl;
  const floatingPnlPercent = baselineCapital > 0 ? (netPnlCombined / baselineCapital) * 100 : 0;

  return {
    totalEquity: Math.round(totalEquity * 100) / 100,
    freeCash: Math.round(freeCash * 100) / 100,
    inTradeMargin: Math.round(inTradeMargin * 100) / 100,
    floatingPnl: Math.round(floatingPnl * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    floatingPnlPercent: Math.round(floatingPnlPercent * 100) / 100,
  };
}


