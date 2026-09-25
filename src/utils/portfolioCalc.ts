import { ActiveBotPosition, PaperWallet } from '../types';

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
 * Calculates total portfolio equity:
 * Equity = Free Cash + In-Trade Margin + Floating (Unrealized) PnL
 */
export function calculatePortfolioMetrics(
  paperWallet?: PaperWallet | null,
  activeBotPositions?: ActiveBotPosition[] | null,
  liveTickerPrice?: number,
  selectedSymbol?: string
) {
  const freeCash = Math.max(0, paperWallet?.balance ?? 1000);
  const positions = activeBotPositions || [];

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

  const realizedPnl = paperWallet?.realizedPnl ?? 0;
  const totalEquity = Math.max(0, freeCash + inTradeMargin + floatingPnl);

  return {
    totalEquity: Math.round(totalEquity * 100) / 100,
    freeCash: Math.round(freeCash * 100) / 100,
    inTradeMargin: Math.round(inTradeMargin * 100) / 100,
    floatingPnl: Math.round(floatingPnl * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
  };
}

