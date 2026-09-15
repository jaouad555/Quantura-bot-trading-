import { ActiveBotPosition, PaperWallet } from '../types';

/**
 * Calculates the unrealized PnL (in USDT) for an active bot position.
 */
export function calculatePositionUnrealizedPnl(
  pos: ActiveBotPosition,
  livePrice?: number
): number {
  const p = (livePrice && livePrice > 0) ? livePrice : (pos.currentPrice || pos.entryPrice);
  if (!pos.entryPrice || !p) return 0;
  
  const isLong = pos.decision === 'LONG';
  const lev = pos.leverage || 1;
  const margin = pos.remainingAmountUsdt || pos.marginUsdt || pos.initialAmountUsdt || 0;
  const priceDiffPct = ((p - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1);
  return margin * priceDiffPct * lev;
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
  const freeCash = paperWallet?.balance ?? 1000;
  const positions = activeBotPositions || [];

  const inTradeMargin = positions.reduce(
    (acc, p) => acc + (p.remainingAmountUsdt || p.marginUsdt || p.initialAmountUsdt || 0),
    0
  );

  const floatingPnl = positions.reduce((acc, p) => {
    const isSelected = selectedSymbol && p.symbol.toLowerCase() === selectedSymbol.toLowerCase();
    const priceToUse = (isSelected && liveTickerPrice && liveTickerPrice > 0) ? liveTickerPrice : p.currentPrice;
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
