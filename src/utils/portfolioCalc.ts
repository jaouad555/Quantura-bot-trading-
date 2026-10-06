import { 
  ActiveBotPosition, 
  PaperWallet, 
  BinanceAccountInfo, 
  MarketType, 
  TradingExecutionMode, 
  SpotHolding,
  DedicatedMarketWallet,
  MultiMarketPortfolio,
  CombinedPortfolioSummary
} from '../types';

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
 * Calculates a Dedicated Market Wallet (SPOT or FUTURES) with absolute accounting accuracy.
 * Follows exact financial balance formulas:
 * 1. Available/Free Balance (الرصيد المتبقي / المتاح)
 * 2. Invested Balance (الرصيد المستثمر)
 * 3. Profit & Loss (الأرباح والخسائر: محققة + عائمة)
 * 4. General / Total Balance (الرصيد العام = المتاح + المستثمر + الأرباح العائمة)
 */
export function calculateDedicatedMarketWallet(
  targetMarket: MarketType,
  allPositions?: ActiveBotPosition[] | null,
  allHistory?: any[] | null,
  paperWallet?: PaperWallet | null,
  executionMode: TradingExecutionMode = 'PAPER',
  binanceAccountInfo?: BinanceAccountInfo | null,
  liveTickerPrice?: number,
  selectedSymbol?: string,
  priceLookup?: Record<string, number>
): DedicatedMarketWallet {
  const isLive = executionMode === 'BINANCE_LIVE';
  const isTestnet = executionMode === 'BINANCE_TESTNET';
  const isExchange = isLive || isTestnet;
  const currentModeUpper = String(executionMode || 'PAPER').toUpperCase();

  // 1. Filter positions strictly for this market type and execution mode
  const marketPositions = (allPositions || []).filter(p => {
    if (!p) return false;
    const posMode = String(p.mode || 'PAPER').toUpperCase();
    const modeMatches = posMode === currentModeUpper || 
      (currentModeUpper === 'BINANCE_TESTNET' && (posMode === 'TESTNET' || posMode === 'BINANCE_TESTNET')) ||
      (currentModeUpper === 'PAPER' && (posMode === 'PAPER' || !p.mode));

    const posMarket = String(p.marketType || (p.leverage && p.leverage > 1 ? 'FUTURES' : 'SPOT')).toUpperCase();
    return modeMatches && posMarket === targetMarket;
  });

  // 2. Filter trade history strictly for this market type
  const marketHistory = (allHistory || []).filter(h => {
    if (!h) return false;
    const histMode = String(h.mode || 'PAPER').toUpperCase();
    const modeMatches = histMode === currentModeUpper || 
      (currentModeUpper === 'BINANCE_TESTNET' && (histMode === 'TESTNET' || histMode === 'BINANCE_TESTNET')) ||
      (currentModeUpper === 'PAPER' && (histMode === 'PAPER' || !h.mode));

    const histMarket = String(h.marketType || (h.leverage && h.leverage > 1 ? 'FUTURES' : 'SPOT')).toUpperCase();
    return modeMatches && histMarket === targetMarket;
  });

  // 3. Compute in-trade invested margin / cost
  const inTradeMargin = marketPositions.reduce((acc, p) => {
    const margin = typeof p.remainingAmountUsdt === 'number' && p.remainingAmountUsdt >= 0
      ? p.remainingAmountUsdt
      : (p.marginUsdt || p.initialAmountUsdt || 0);
    return acc + Math.max(0, margin);
  }, 0);

  // 4. Compute floating (unrealized) profit and loss
  const floatingPnl = marketPositions.reduce((acc, p) => {
    const isSelected = selectedSymbol && p.symbol.toLowerCase() === selectedSymbol.toLowerCase();
    const priceToUse = (isSelected && liveTickerPrice && liveTickerPrice > 0) 
      ? liveTickerPrice 
      : (priceLookup && priceLookup[p.symbol.toUpperCase()] ? priceLookup[p.symbol.toUpperCase()] : (p.currentPrice || p.entryPrice));
    return acc + calculatePositionUnrealizedPnl(p, priceToUse);
  }, 0);

  // 5. Compute realized profit and loss from history
  const historyRealizedPnl = marketHistory.reduce((acc, h) => {
    const val = Number(h.profitUsdt || h.pnlUsdt || 0);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  let freeBalance = 0;
  let totalEquity = 0;
  let realizedPnl = historyRealizedPnl;
  let baseDeposit = 1000;
  const holdings: Record<string, { qty: number; valueUsdt: number; avgCost: number; pnlUsdt: number }> = {};

  if (isExchange && binanceAccountInfo) {
    const rawFree = Number(binanceAccountInfo.freeUsdt) || 0;
    const rawTotalEquity = Number(binanceAccountInfo.totalUsdtEquity) || rawFree;
    freeBalance = Math.max(0, rawFree);

    if (targetMarket === 'FUTURES') {
      const apiInTradeMargin = Number(binanceAccountInfo.inTradeMargin) || 0;
      const effectiveMargin = apiInTradeMargin > 0 ? apiInTradeMargin : inTradeMargin;
      totalEquity = rawTotalEquity > 0 ? rawTotalEquity : Math.max(0, freeBalance + effectiveMargin + floatingPnl);
    } else {
      // Spot Binance Account
      let cryptoVal = 0;
      if (binanceAccountInfo.balances) {
        for (const bal of binanceAccountInfo.balances) {
          if (!['USDT', 'USDC', 'FDUSD', 'BUSD'].includes(bal.asset) && bal.total > 0) {
            const sym = `${bal.asset}USDT`;
            const matchingPos = marketPositions.find(p => p.symbol.toUpperCase() === sym);
            const price = (selectedSymbol && sym === selectedSymbol.toUpperCase() && liveTickerPrice && liveTickerPrice > 0)
              ? liveTickerPrice
              : (priceLookup && priceLookup[sym] ? priceLookup[sym] : (matchingPos ? (matchingPos.currentPrice || matchingPos.entryPrice) : 0));
            const val = bal.total * (price > 0 ? price : (matchingPos?.entryPrice || 100));
            cryptoVal += val;
            holdings[bal.asset] = {
              qty: bal.total,
              valueUsdt: Math.round(val * 100) / 100,
              avgCost: matchingPos?.entryPrice || 0,
              pnlUsdt: matchingPos ? calculatePositionUnrealizedPnl(matchingPos, price) : 0,
            };
          }
        }
      }
      const spotHoldingsValue = Math.max(cryptoVal, inTradeMargin);
      totalEquity = rawTotalEquity > 0 ? rawTotalEquity : (freeBalance + spotHoldingsValue);
    }
  } else {
    // PAPER SIMULATION
    // Check if paperWallet has dedicated sub-wallet or specific deposit
    const dedicatedSub = targetMarket === 'SPOT' 
      ? (paperWallet?.spotWallet as any) 
      : (paperWallet?.futuresWallet as any);

    if (dedicatedSub && typeof dedicatedSub.initialDeposit === 'number' && dedicatedSub.initialDeposit > 0) {
      baseDeposit = dedicatedSub.initialDeposit;
    } else if (typeof (paperWallet as any)?.initialDeposit === 'number' && (paperWallet as any).initialDeposit > 0) {
      baseDeposit = (paperWallet as any).initialDeposit;
    }

    if (dedicatedSub && typeof dedicatedSub.realizedPnl === 'number') {
      realizedPnl = dedicatedSub.realizedPnl;
    } else if (marketHistory.length > 0) {
      realizedPnl = historyRealizedPnl;
    } else if (paperWallet && paperWallet.marketType === targetMarket && typeof paperWallet.realizedPnl === 'number') {
      realizedPnl = paperWallet.realizedPnl;
    }

    // Mathematical Invariant:
    // Available Balance (الرصيد المتاح) = Base Deposit + Realized PnL - In-Trade Margin
    freeBalance = Math.max(0, Math.round((baseDeposit + realizedPnl - inTradeMargin) * 100) / 100);

    // General Balance / Total Equity (الرصيد العام) = Free Cash + In-Trade Margin + Floating PnL
    // which simplifies directly to: Base Deposit + Realized PnL + Floating PnL
    totalEquity = Math.max(0, Math.round((freeBalance + inTradeMargin + floatingPnl) * 100) / 100);
  }

  // Calculate trade performance stats
  const tradeCount = marketHistory.length;
  const winCount = marketHistory.filter(h => (Number(h.profitUsdt || h.pnlUsdt) || 0) > 0).length;
  const lossCount = marketHistory.filter(h => (Number(h.profitUsdt || h.pnlUsdt) || 0) < 0).length;
  const winRate = tradeCount > 0 ? Math.round((winCount / tradeCount) * 1000) / 10 : 0;
  const netPnl = Math.round((realizedPnl + floatingPnl) * 100) / 100;

  return {
    marketType: targetMarket,
    initialDeposit: Math.round(baseDeposit * 100) / 100,
    balance: Math.round(freeBalance * 100) / 100,
    inTradeMargin: Math.round(inTradeMargin * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    floatingPnl: Math.round(floatingPnl * 100) / 100,
    totalEquity: Math.round(totalEquity * 100) / 100,
    netPnl,
    tradeCount,
    winCount,
    lossCount,
    winRate,
    lastUpdated: Date.now(),
    holdings,
  };
}

/**
 * Calculates a complete Multi-Market Portfolio containing:
 * - Dedicated Spot Wallet
 * - Dedicated Futures Wallet
 * - Combined Global Portfolio Summary
 */
export function calculateMultiMarketPortfolio(
  allPositions?: ActiveBotPosition[] | null,
  allHistory?: any[] | null,
  paperWallet?: PaperWallet | null,
  executionMode: TradingExecutionMode = 'PAPER',
  binanceAccountInfo?: BinanceAccountInfo | null,
  activeMarketType: MarketType = 'FUTURES',
  liveTickerPrice?: number,
  selectedSymbol?: string,
  priceLookup?: Record<string, number>
): MultiMarketPortfolio {
  const spot = calculateDedicatedMarketWallet(
    'SPOT',
    allPositions,
    allHistory,
    paperWallet,
    executionMode,
    binanceAccountInfo,
    liveTickerPrice,
    selectedSymbol,
    priceLookup
  );

  const futures = calculateDedicatedMarketWallet(
    'FUTURES',
    allPositions,
    allHistory,
    paperWallet,
    executionMode,
    binanceAccountInfo,
    liveTickerPrice,
    selectedSymbol,
    priceLookup
  );

  const totalTrades = spot.tradeCount + futures.tradeCount;
  const winCount = spot.winCount + futures.winCount;
  const lossCount = spot.lossCount + futures.lossCount;
  const winRate = totalTrades > 0 ? Math.round((winCount / totalTrades) * 1000) / 10 : 0;

  const combined: CombinedPortfolioSummary = {
    totalEquity: Math.round((spot.totalEquity + futures.totalEquity) * 100) / 100,
    freeBalance: Math.round((spot.balance + futures.balance) * 100) / 100,
    investedMargin: Math.round((spot.inTradeMargin + futures.inTradeMargin) * 100) / 100,
    realizedPnl: Math.round((spot.realizedPnl + futures.realizedPnl) * 100) / 100,
    floatingPnl: Math.round((spot.floatingPnl + futures.floatingPnl) * 100) / 100,
    totalNetPnl: Math.round((spot.netPnl + futures.netPnl) * 100) / 100,
    totalTrades,
    winCount,
    lossCount,
    winRate,
  };

  return {
    spot,
    futures,
    combined,
    activeMarketType,
    executionMode,
    lastUpdated: Date.now(),
  };
}

/**
 * Backward-compatible portfolio metrics calculator
 * Directly delegates to the requested market's dedicated wallet calculation.
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
  const dedicated = calculateDedicatedMarketWallet(
    marketType,
    activeBotPositions,
    paperWallet?.history || [],
    paperWallet,
    executionMode,
    binanceAccountInfo,
    liveTickerPrice,
    selectedSymbol,
    priceLookup
  );

  const baselineCapital = Math.max(10, dedicated.totalEquity - dedicated.floatingPnl);
  const floatingPnlPercent = baselineCapital > 0 ? (dedicated.netPnl / baselineCapital) * 100 : 0;
  const marginLevelPercent = dedicated.inTradeMargin > 0 ? (dedicated.totalEquity / dedicated.inTradeMargin) * 100 : undefined;

  const holdingsSummary: Record<string, { qty: number; valueUsdt: number; avgCost: number; pnlUsdt: number; pnlPercent: number }> = {};
  if (dedicated.holdings) {
    for (const [k, v] of Object.entries(dedicated.holdings)) {
      holdingsSummary[k] = {
        qty: v.qty,
        valueUsdt: v.valueUsdt,
        avgCost: v.avgCost,
        pnlUsdt: v.pnlUsdt,
        pnlPercent: v.avgCost > 0 ? (v.pnlUsdt / (v.avgCost * v.qty)) * 100 : 0,
      };
    }
  }

  return {
    totalEquity: dedicated.totalEquity,
    totalPortfolioEquity: dedicated.totalEquity,
    freeCash: dedicated.balance,
    inTradeMargin: dedicated.inTradeMargin,
    spotHoldingsValue: marketType === 'SPOT' ? dedicated.inTradeMargin + dedicated.floatingPnl : 0,
    floatingPnl: dedicated.floatingPnl,
    realizedPnl: dedicated.realizedPnl,
    totalNetPnl: dedicated.netPnl,
    floatingPnlPercent: Math.round(floatingPnlPercent * 100) / 100,
    marginLevelPercent: marginLevelPercent !== undefined ? Math.round(marginLevelPercent * 10) / 10 : undefined,
    marketType,
    executionMode,
    holdingsSummary,
  };
}
