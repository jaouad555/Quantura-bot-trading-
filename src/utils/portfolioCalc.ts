import { ActiveBotPosition, PaperWallet, BinanceAccountInfo, MarketType, TradingExecutionMode, SpotHolding } from '../types';

/**
 * Calculates the accurate unrealized PnL (in USDT) for an active bot position (Futures or Spot).
 */
export function calculatePositionUnrealizedPnl(
  pos: ActiveBotPosition,
  livePrice?: number
): number {
  const p = (livePrice && livePrice > 0) ? livePrice : (pos.currentPrice || pos.entryPrice);
  if (!pos.entryPrice || !p || isNaN(p) || isNaN(pos.entryPrice)) return 0;
  
  const isLong = pos.decision === 'LONG';
  const isFutures = pos.marketType === 'FUTURES';
  const lev = isFutures ? Math.max(1, pos.leverage || 1) : 1;
  const margin = typeof pos.remainingAmountUsdt === 'number' && pos.remainingAmountUsdt >= 0
    ? pos.remainingAmountUsdt
    : (pos.marginUsdt || pos.initialAmountUsdt || 0);
    
  if (margin <= 0) return 0;

  // If using authoritative currentPrice and pos.unrealizedPnlUsdt is present from server ROE engine
  if ((!livePrice || livePrice === pos.currentPrice) && typeof pos.unrealizedPnlUsdt === 'number' && !isNaN(pos.unrealizedPnlUsdt)) {
    return pos.unrealizedPnlUsdt;
  }
  
  const priceDiffPct = ((p - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1);
  const grossPnl = margin * priceDiffPct * lev;

  // Realistic exchange fee deduction (0.04% maker / 0.05% taker on notional)
  const positionNotional = margin * lev;
  const estimatedFees = positionNotional * 0.0008; // 0.08% roundtrip
  const netPnl = grossPnl - estimatedFees;
  
  // Guard against loss exceeding 100% of isolated margin in Futures
  if (isFutures && netPnl < -margin) {
    return -margin;
  }
  
  return netPnl;
}

/**
 * Computes Liquidation Price for Futures Positions
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  decision: 'LONG' | 'SHORT',
  leverage: number,
  maintenanceMarginRate: number = 0.005
): number {
  const lev = Math.max(1, leverage);
  if (lev <= 1) return 0; // Spot / 1x has no liquidation
  if (decision === 'LONG') {
    return entryPrice * Math.max(0.0001, 1 - (1 / lev) + maintenanceMarginRate);
  } else {
    return entryPrice * (1 + (1 / lev) - maintenanceMarginRate);
  }
}

export interface PortfolioMetricsResult {
  totalEquity: number;
  freeCash: number;
  inTradeMargin: number;
  spotHoldingsValue: number;
  floatingPnl: number;
  realizedPnl: number;
  totalNetPnl: number;
  floatingPnlPercent: number;
  marginLevelPercent?: number;
  totalPortfolioEquity: number;
  marketType: MarketType;
  executionMode: TradingExecutionMode;
  holdingsSummary: Record<string, { qty: number; valueUsdt: number; avgCost: number; pnlUsdt: number; pnlPercent: number }>;
}

/**
 * Comprehensive Quantitative Portfolio Calculator
 * Strictly separates:
 * 1. Execution Modes: PAPER vs BINANCE_TESTNET vs BINANCE_LIVE
 * 2. Market Types: SPOT vs FUTURES
 */
export function calculatePortfolioMetrics(
  paperWallet?: PaperWallet | null,
  activeBotPositions?: ActiveBotPosition[] | null,
  liveTickerPrice?: number,
  selectedSymbol?: string,
  isLiveMode?: boolean,
  binanceAccountInfo?: BinanceAccountInfo | null,
  marketType: MarketType = 'FUTURES',
  executionMode: TradingExecutionMode = 'PAPER',
  priceLookup?: Record<string, number>
): PortfolioMetricsResult {
  const isLive = executionMode === 'BINANCE_LIVE';
  const isTestnet = executionMode === 'BINANCE_TESTNET';
  const isExchange = isLive || isTestnet;

  // Filter positions by matching execution mode & market type
  const positions = (activeBotPositions || []).filter(p => {
    const posMode = p.mode || 'PAPER';
    const posMarket = p.marketType || 'FUTURES';
    return posMode === executionMode && posMarket === marketType;
  });

  const inTradeMargin = positions.reduce((acc, p) => {
    const margin = typeof p.remainingAmountUsdt === 'number' && p.remainingAmountUsdt >= 0
      ? p.remainingAmountUsdt
      : (p.marginUsdt || p.initialAmountUsdt || 0);
    return acc + Math.max(0, margin);
  }, 0);

  const floatingPnl = positions.reduce((acc, p) => {
    const isSelected = selectedSymbol && p.symbol.toLowerCase() === selectedSymbol.toLowerCase();
    const priceToUse = (isSelected && liveTickerPrice && liveTickerPrice > 0) 
      ? liveTickerPrice 
      : (priceLookup && priceLookup[p.symbol.toUpperCase()] ? priceLookup[p.symbol.toUpperCase()] : (p.currentPrice || p.entryPrice));
    return acc + calculatePositionUnrealizedPnl(p, priceToUse);
  }, 0);

  let freeCash = 0;
  let realizedPnl = 0;
  let totalEquity = 0;
  let effectiveInTradeMargin = inTradeMargin;
  let effectiveFloatingPnl = floatingPnl;
  let spotHoldingsValue = 0;
  const holdingsSummary: Record<string, { qty: number; valueUsdt: number; avgCost: number; pnlUsdt: number; pnlPercent: number }> = {};

  if (isExchange && binanceAccountInfo) {
    const rawFree = Number(binanceAccountInfo.freeUsdt) || 0;
    const rawTotalEquity = Number(binanceAccountInfo.totalUsdtEquity) || rawFree;
    freeCash = Math.max(0, rawFree);

    if (marketType === 'FUTURES') {
      const apiInTradeMargin = Number(binanceAccountInfo.inTradeMargin) || 0;
      const apiUnrealized = Number(binanceAccountInfo.unrealizedProfit) || 0;

      // In real Binance Futures (Testnet & Live):
      // 1. inTradeMargin is authoritatively reported by Binance totalInitialMargin
      effectiveInTradeMargin = apiInTradeMargin > 0 ? apiInTradeMargin : inTradeMargin;
      // 2. floatingPnl is authoritatively reported by Binance totalUnrealizedProfit
      effectiveFloatingPnl = apiUnrealized !== 0 ? apiUnrealized : floatingPnl;
      // 3. totalEquity is the true total margin balance on Binance (Wallet Balance + Floating PnL)
      totalEquity = rawTotalEquity > 0 ? rawTotalEquity : Math.max(0, freeCash + effectiveInTradeMargin + effectiveFloatingPnl);
    } else {
      // SPOT Live / Testnet: Calculate coin balances
      let cryptoVal = 0;
      if (binanceAccountInfo.balances) {
        for (const bal of binanceAccountInfo.balances) {
          if (!['USDT', 'USDC', 'FDUSD', 'BUSD'].includes(bal.asset) && bal.total > 0) {
            const sym = `${bal.asset}USDT`;
            const price = (selectedSymbol && sym === selectedSymbol.toUpperCase() && liveTickerPrice)
              ? liveTickerPrice
              : (priceLookup && priceLookup[sym] ? priceLookup[sym] : 0);
            const val = bal.total * (price > 0 ? price : 0);
            cryptoVal += val;
            holdingsSummary[bal.asset] = {
              qty: bal.total,
              valueUsdt: Math.round(val * 100) / 100,
              avgCost: 0,
              pnlUsdt: 0,
              pnlPercent: 0,
            };
          }
        }
      }
      spotHoldingsValue = cryptoVal;
      totalEquity = Math.max(0, freeCash + spotHoldingsValue);
    }
  } else {
    // PAPER Simulation / Sandbox
    realizedPnl = paperWallet?.realizedPnl ?? 0;
    const baseDeposit = (paperWallet as any)?.initialDeposit || 1000;
    const totalCapital = baseDeposit + realizedPnl;

    // Margin is strictly deducted from available cash whenever positions are open
    freeCash = Math.max(0, Math.round((totalCapital - inTradeMargin) * 100) / 100);
    effectiveInTradeMargin = inTradeMargin;
    effectiveFloatingPnl = floatingPnl;
    
    if (marketType === 'SPOT') {
      spotHoldingsValue = Math.max(0, inTradeMargin + effectiveFloatingPnl);
      totalEquity = Math.max(0, Math.round((freeCash + spotHoldingsValue) * 100) / 100);
    } else {
      totalEquity = Math.max(0, Math.round((freeCash + inTradeMargin + effectiveFloatingPnl) * 100) / 100);
    }
  }

  const netPnlCombined = effectiveFloatingPnl + realizedPnl;
  const baselineCapital = isExchange 
    ? Math.max(10, totalEquity - effectiveFloatingPnl) 
    : Math.max(10, freeCash + inTradeMargin + spotHoldingsValue - netPnlCombined);

  const floatingPnlPercent = baselineCapital > 0 ? (netPnlCombined / baselineCapital) * 100 : 0;
  const marginLevelPercent = effectiveInTradeMargin > 0 ? (totalEquity / effectiveInTradeMargin) * 100 : undefined;

  return {
    totalEquity: Math.round(totalEquity * 100) / 100,
    totalPortfolioEquity: Math.round(totalEquity * 100) / 100,
    freeCash: Math.round(freeCash * 100) / 100,
    inTradeMargin: Math.round(effectiveInTradeMargin * 100) / 100,
    spotHoldingsValue: Math.round(spotHoldingsValue * 100) / 100,
    floatingPnl: Math.round(effectiveFloatingPnl * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    totalNetPnl: Math.round(netPnlCombined * 100) / 100,
    floatingPnlPercent: Math.round(floatingPnlPercent * 100) / 100,
    marginLevelPercent: marginLevelPercent !== undefined ? Math.round(marginLevelPercent * 10) / 10 : undefined,
    marketType,
    executionMode,
    holdingsSummary,
  };
}
