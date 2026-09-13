import React, { useState, useEffect } from 'react';
import { AIAnalysisResult, Language, PaperWallet, BinanceApiConfig } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import {
  ShieldCheck,
  Calculator,
  Wallet,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Sparkles,
  Info,
  DollarSign,
  Layers,
  Percent,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Trash2,
} from 'lucide-react';

interface RiskCalculatorViewProps {
  currentPrice: number;
  activeSignal: AIAnalysisResult | null;
  language: Language;
  paperWallet: PaperWallet;
  onUpdatePaperWallet: (wallet: PaperWallet) => void;
  onOpenCustomBalanceModal?: () => void;
  onFullReset?: () => void;
  executionMode?: 'PAPER' | 'BINANCE_LIVE';
  binanceConfig?: BinanceApiConfig;
  selectedSymbol?: string;
}

export const RiskCalculatorView: React.FC<RiskCalculatorViewProps> = ({
  currentPrice,
  activeSignal,
  language,
  paperWallet,
  onUpdatePaperWallet,
  onOpenCustomBalanceModal,
  onFullReset,
  executionMode = 'PAPER',
  binanceConfig,
  selectedSymbol = 'BTCUSDT',
}) => {
  const t = translations[language]?.riskCalculator || translations.fr.riskCalculator;
  const isArabic = language === 'ar';
  const baseAsset = (selectedSymbol || 'BTCUSDT').replace('USDT', '');

  const formatCoinQty = (qty: number) => {
    if (qty >= 1000) return qty.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (qty >= 1) return qty.toFixed(2);
    if (qty >= 0.01) return qty.toFixed(4);
    return qty.toFixed(6);
  };

  // Calculator inputs
  const isLive = executionMode === 'BINANCE_LIVE';
  const effectiveBalance = isLive && binanceConfig?.accountInfo?.totalUsdtEquity !== undefined
    ? binanceConfig.accountInfo.totalUsdtEquity
    : paperWallet.balance || 0;

  const [capital, setCapital] = useState<number>(effectiveBalance || 1000);
  
  useEffect(() => {
    setCapital(effectiveBalance);
  }, [executionMode, effectiveBalance]);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [entryPrice, setEntryPrice] = useState<number>(
    activeSignal?.entryZone?.ideal || currentPrice || 95000
  );
  const [stopLossPrice, setStopLossPrice] = useState<number>(
    activeSignal?.stopLoss || (currentPrice ? currentPrice * 0.98 : 93100)
  );

  // Modal states
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [depositAmountInput, setDepositAmountInput] = useState('');

  // Update entry and SL when signal changes if user hasn't heavily modified
  useEffect(() => {
    if (activeSignal?.entryZone?.ideal && activeSignal.stopLoss) {
      setEntryPrice(activeSignal.entryZone.ideal);
      setStopLossPrice(activeSignal.stopLoss);
    } else if (currentPrice && currentPrice > 0 && entryPrice === 95000) {
      setEntryPrice(currentPrice);
      setStopLossPrice(Math.round(currentPrice * 0.98 * 100) / 100);
    }
  }, [activeSignal?.generatedAt]);

  // Position Sizing Calculations
  const riskAmount = (capital * riskPercent) / 100;
  const priceDistance = Math.abs(entryPrice - stopLossPrice);
  const stopLossPercent = entryPrice > 0 ? (priceDistance / entryPrice) * 100 : 2;
  const positionSizeBtc = priceDistance > 0 ? riskAmount / priceDistance : 0;
  const positionSizeUsdt = positionSizeBtc * entryPrice;
  const leverage = capital > 0 ? Math.max(1, Math.round((positionSizeUsdt / capital) * 10) / 10) : 1;

  // Potential returns
  const tp1Price = activeSignal?.targets?.tp1 || (entryPrice > stopLossPrice ? entryPrice * 1.025 : entryPrice * 0.975);
  const tp2Price = activeSignal?.targets?.tp2 || (entryPrice > stopLossPrice ? entryPrice * 1.05 : entryPrice * 0.95);
  const tp1GainPercent = entryPrice > 0 ? (Math.abs(tp1Price - entryPrice) / entryPrice) * 100 : 2.5;
  const tp2GainPercent = entryPrice > 0 ? (Math.abs(tp2Price - entryPrice) / entryPrice) * 100 : 5.0;
  const tp1GainUsdt = (positionSizeUsdt * tp1GainPercent) / 100;
  const tp2GainUsdt = (positionSizeUsdt * tp2GainPercent) / 100;
  const riskRewardRatio = stopLossPercent > 0 ? (tp1GainPercent / stopLossPercent).toFixed(2) : '1.50';

  // Live Position calculations
  const openPos = paperWallet.openPosition;
  let unrealizedPnlUsdt = 0;
  let unrealizedPnlPercent = 0;
  let inTradeMarginUsdt = 0;

  const isPositionSymbolSelected = !openPos || (openPos.symbol || selectedSymbol) === selectedSymbol;

  if (openPos) {
    inTradeMarginUsdt = openPos.amountBtc * openPos.entryPrice;
    if (currentPrice > 0 && isPositionSymbolSelected) {
      if (openPos.type === 'LONG') {
        unrealizedPnlUsdt = (currentPrice - openPos.entryPrice) * openPos.amountBtc;
        unrealizedPnlPercent = ((currentPrice - openPos.entryPrice) / openPos.entryPrice) * 100;
      } else {
        unrealizedPnlUsdt = (openPos.entryPrice - currentPrice) * openPos.amountBtc;
        unrealizedPnlPercent = ((openPos.entryPrice - currentPrice) / openPos.entryPrice) * 100;
      }
    }
  }

  // Determine display values based on mode
  const displayTotalEquity = isLive && binanceConfig?.accountInfo?.totalUsdtEquity !== undefined
    ? binanceConfig.accountInfo.totalUsdtEquity
    : paperWallet.balance + (openPos ? inTradeMarginUsdt + unrealizedPnlUsdt : 0);

  const displayAvailableBalance = isLive && binanceConfig?.accountInfo?.freeUsdt !== undefined
    ? binanceConfig.accountInfo.freeUsdt
    : paperWallet.balance;

  const displayRealizedPnl = isLive
    ? 0 // We don't have total realized PNL across the live account without trade history
    : paperWallet.realizedPnl;
    
  const displayTotalRoiPercent = isLive 
    ? 0
    : (paperWallet.balance > 0 
      ? ((paperWallet.realizedPnl + unrealizedPnlUsdt) / (paperWallet.balance + inTradeMarginUsdt)) * 100
      : 0);

  const displayInTradeMarginUsdt = isLive 
    ? (binanceConfig?.accountInfo?.totalUsdtEquity !== undefined && binanceConfig?.accountInfo?.freeUsdt !== undefined
        ? binanceConfig.accountInfo.totalUsdtEquity - binanceConfig.accountInfo.freeUsdt 
        : 0)
    : inTradeMarginUsdt;

  const displayUnrealizedPnlUsdt = isLive ? 0 : unrealizedPnlUsdt;
  const displayUnrealizedPnlPercent = isLive ? 0 : unrealizedPnlPercent;


  // Actions
  const handleOpenPaperTrade = (type: 'LONG' | 'SHORT') => {
    if (paperWallet.openPosition) return;
    const entry = currentPrice || entryPrice;
    const sl = stopLossPrice;
    const tp1 = activeSignal?.targets?.tp1 || (type === 'LONG' ? entry * 1.025 : entry * 0.975);
    const tp2 = activeSignal?.targets?.tp2 || (type === 'LONG' ? entry * 1.05 : entry * 0.95);
    const btcAmount = positionSizeBtc > 0 ? positionSizeBtc : 0.05;
    const requiredMargin = btcAmount * entry;

    // Check if available balance suffices
    if (paperWallet.balance < requiredMargin) {
      // adjust amount to fit available balance
      const adjustedBtc = (paperWallet.balance * 0.95) / entry;
      const updated: PaperWallet = {
        ...paperWallet,
        balance: paperWallet.balance - (adjustedBtc * entry),
        openPosition: {
          id: `paper_${Date.now()}`,
          symbol: selectedSymbol,
          type,
          entryPrice: entry,
          amountBtc: adjustedBtc,
          entryTime: Date.now(),
          stopLoss: sl,
          tp1,
          tp2,
        },
      };
      onUpdatePaperWallet(updated);
      return;
    }

    const updated: PaperWallet = {
      ...paperWallet,
      balance: paperWallet.balance - requiredMargin,
      openPosition: {
        id: `paper_${Date.now()}`,
        symbol: selectedSymbol,
        type,
        entryPrice: entry,
        amountBtc: btcAmount,
        entryTime: Date.now(),
        stopLoss: sl,
        tp1,
        tp2,
      },
    };
    onUpdatePaperWallet(updated);
  };

  const handleClosePaperTrade = () => {
    if (!paperWallet.openPosition || !isPositionSymbolSelected) return;
    const returnedCapital = inTradeMarginUsdt + unrealizedPnlUsdt;
    const newBalance = Math.max(0, Math.round((paperWallet.balance + returnedCapital) * 100) / 100);
    const newRealizedPnl = Math.round((paperWallet.realizedPnl + unrealizedPnlUsdt) * 100) / 100;

    const updated: PaperWallet = {
      balance: newBalance,
      realizedPnl: newRealizedPnl,
      openPosition: null,
      history: [
        {
          id: paperWallet.openPosition.id,
          symbol: paperWallet.openPosition.symbol || selectedSymbol,
          type: paperWallet.openPosition.type,
          entryPrice: paperWallet.openPosition.entryPrice,
          exitPrice: currentPrice || entryPrice,
          pnlUsdt: Math.round(unrealizedPnlUsdt * 100) / 100,
          pnlPercent: Math.round(unrealizedPnlPercent * 100) / 100,
          time: Date.now(),
        },
        ...paperWallet.history,
      ],
    };
    onUpdatePaperWallet(updated);
  };

  const handleDepositFunds = (amount: number) => {
    if (amount <= 0) return;
    const updated: PaperWallet = {
      ...paperWallet,
      balance: Math.round((paperWallet.balance + amount) * 100) / 100,
    };
    onUpdatePaperWallet(updated);
    setIsDepositModalOpen(false);
    setDepositAmountInput('');
  };

  const handleResetPaperWallet = async () => {
    if (onFullReset) {
      try {
        await onFullReset();
      } catch (e) {}
    }
    onUpdatePaperWallet({
      balance: 1000,
      realizedPnl: 0,
      openPosition: null,
      history: [],
    });
    setCapital(1000);
    setIsResetModalOpen(false);
  };

  const handleClearHistory = () => {
    onUpdatePaperWallet({
      ...paperWallet,
      history: [],
    });
  };

  return (
    <div className={`space-y-4 sm:space-y-5 pb-6 ${isArabic ? 'rtl' : 'ltr'}`}>
      {/* 1. Header & Paper Wallet Summary Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-brand-400 mb-0.5">
              <Wallet className="w-4 h-4" />
              <h2 className="font-bold text-base sm:text-lg text-white tracking-tight">
                {isLive ? (isArabic ? 'حساب Binance المباشر' : 'Portefeuille Binance Réel') : t.paperWalletTitle}
              </h2>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase bg-brand-500/10 text-brand-400 border border-brand-500/30 px-2 py-0.5 rounded-full">
                {isLive ? 'Binance Live Stream' : 'Paper Trading (Local)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 max-w-2xl">
              {isLive ? (isArabic ? 'أرصدتك الحقيقية المتزامنة مباشرة من منصة Binance.' : 'Vos soldes réels synchronisés en direct depuis Binance.') : t.paperWalletDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {!isLive && (
              <>
                {onOpenCustomBalanceModal && (
                  <button
                    onClick={onOpenCustomBalanceModal}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-[11px] rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'تخصيص الرصيد' : 'Solde Personnalisé'}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsDepositModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-[11px] rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.depositTitle}</span>
                </button>
                <button
                  onClick={() => setIsResetModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] rounded-lg border border-slate-700 transition active:scale-95 cursor-pointer"
                  title="Reset Wallet"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t.resetWallet}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Wallet Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-4 relative z-10 font-mono">
          {/* Total Net Equity */}
          <div className="col-span-2 sm:col-span-1 bg-slate-950 p-3 rounded-lg border border-brand-500/30">
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
              <span>{t.totalEquity}</span>
              <DollarSign className="w-3 h-3 text-brand-400" />
            </div>
            <div className="text-base sm:text-lg font-bold text-white tracking-tight">
              ${displayTotalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5 truncate">
              {openPos || (isLive && displayInTradeMarginUsdt > 0) ? `${displayAvailableBalance.toFixed(0)} cash + ${(displayInTradeMarginUsdt + displayUnrealizedPnlUsdt).toFixed(0)} in trade` : '100% Cash'}
            </span>
          </div>

          {/* Available Cash */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
              <span>{t.availableBalance}</span>
              <Layers className="w-3 h-3 text-blue-400" />
            </div>
            <div className="text-sm sm:text-base font-bold text-slate-200">
              ${displayAvailableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5">USDT Ready</span>
          </div>

          {/* In-Trade Margin */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
              <span>{t.inTradeMargin}</span>
              <ShieldCheck className="w-3 h-3 text-amber-400" />
            </div>
            <div className="text-sm sm:text-base font-bold text-amber-300">
              ${displayInTradeMarginUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5 truncate">
              {isLive ? 'Margin Locked' : (openPos ? `${formatCoinQty(openPos.amountBtc)} ${baseAsset}` : 'No active margin')}
            </span>
          </div>

          {/* Unrealized PnL */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
              <span>{t.unrealizedPnl}</span>
              {displayUnrealizedPnlUsdt >= 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-rose-400" />}
            </div>
            <div className={`text-sm sm:text-base font-bold ${displayUnrealizedPnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {displayUnrealizedPnlUsdt >= 0 ? '+' : ''}${displayUnrealizedPnlUsdt.toFixed(2)}
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5">
              {isLive ? (displayInTradeMarginUsdt > 0 ? 'Live tracked' : 'No floating PnL') : (openPos ? `${displayUnrealizedPnlPercent >= 0 ? '+' : ''}${displayUnrealizedPnlPercent.toFixed(2)}%` : '0.00% Floating')}
            </span>
          </div>

          {/* Realized PnL & Total ROI */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
              <span>{t.realizedPnl}</span>
              <Percent className="w-3 h-3 text-purple-400" />
            </div>
            <div className={`text-sm sm:text-base font-bold ${displayRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {displayRealizedPnl >= 0 ? '+' : ''}${displayRealizedPnl.toFixed(2)}
            </div>
            <span className="text-[9px] text-slate-500 block mt-0.5">
              {isLive ? 'Live View' : `ROI: ${displayTotalRoiPercent >= 0 ? '+' : ''}${displayTotalRoiPercent.toFixed(1)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Position Sizing & Risk Management Calculator */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-brand-400" />
            <h3 className="font-bold text-white text-sm sm:text-base">
              {t.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full w-fit">
            <ShieldCheck className="w-3 h-3" />
            <span>{t.goldenRule}</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          {t.subtitle}
        </p>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          {/* Account Capital */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <label>{t.accountCapital}</label>
              <button
                onClick={() => setCapital(Math.max(10, Math.round(displayAvailableBalance)))}
                className="text-[10px] text-brand-400 hover:text-brand-300 underline font-sans cursor-pointer"
              >
                {t.useWalletBalance}
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-slate-500 font-bold text-xs">$</span>
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(Math.max(10, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-md py-1.5 pl-6 pr-2 font-bold focus:outline-none focus:border-brand-400 text-xs"
              />
            </div>
            <div className="flex gap-1">
              {[5000, 10000, 25000, 50000].map((val) => (
                <button
                  key={val}
                  onClick={() => setCapital(val)}
                  className={`flex-1 py-0.5 text-[9px] rounded border transition cursor-pointer ${
                    capital === val
                      ? 'bg-brand-500/20 text-brand-400 border-brand-500/40 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  ${val / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* Risk Percent */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <label>{t.riskPercent}</label>
              <span className="text-[9px] text-slate-500 font-sans">Max Loss: ${riskAmount.toFixed(1)}</span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0.1"
                max="10"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Math.max(0.1, Math.min(10, Number(e.target.value))))}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-md py-1.5 px-2 font-bold focus:outline-none focus:border-brand-400 text-xs"
              />
              <span className="absolute right-2.5 top-1.5 text-slate-500 font-bold text-xs">%</span>
            </div>
            <div className="flex gap-1">
              {[0.5, 1.0, 1.5, 2.0].map((r) => (
                <button
                  key={r}
                  onClick={() => setRiskPercent(r)}
                  className={`flex-1 py-0.5 text-[9px] rounded border transition cursor-pointer ${
                    riskPercent === r
                      ? 'bg-brand-500/20 text-brand-400 border-brand-500/40 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>

          {/* Entry Price */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <label>{t.entryPrice}</label>
              {currentPrice > 0 && (
                <button
                  onClick={() => setEntryPrice(currentPrice)}
                  className="text-[10px] text-brand-400 hover:text-brand-300 underline font-sans cursor-pointer"
                >
                  {t.useLivePrice}
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-slate-500 font-bold text-xs">$</span>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-md py-1.5 pl-6 pr-2 font-bold focus:outline-none focus:border-brand-400 text-xs"
              />
            </div>
            {activeSignal?.entryZone?.ideal && (
              <button
                onClick={() => setEntryPrice(activeSignal.entryZone?.ideal || 0)}
                className="w-full py-0.5 text-[9px] rounded bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800 transition cursor-pointer truncate"
              >
                {t.useSignalEntry} (${formatCoinPrice(activeSignal.entryZone.ideal, selectedSymbol)})
              </button>
            )}
          </div>

          {/* Stop Loss Price */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <label>{t.stopLoss}</label>
              <span className="text-[10px] text-rose-400">-{stopLossPercent.toFixed(2)}%</span>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-slate-500 font-bold text-xs">$</span>
              <input
                type="number"
                step="any"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-rose-400 rounded-md py-1.5 pl-6 pr-2 font-bold focus:outline-none focus:border-rose-400 text-xs"
              />
            </div>
            {activeSignal?.stopLoss && (
              <button
                onClick={() => setStopLossPrice(activeSignal.stopLoss || 0)}
                className="w-full py-0.5 text-[9px] rounded bg-slate-900 text-rose-300 hover:bg-slate-800 border border-slate-800 transition cursor-pointer truncate"
              >
                {t.useSignalSl} (${formatCoinPrice(activeSignal.stopLoss, selectedSymbol)})
              </button>
            )}
          </div>
        </div>

        {/* Calculated Results Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono pt-1">
          {/* Max Risk USD */}
          <div className="bg-slate-950 p-3 rounded-lg border border-rose-500/30">
            <div className="flex items-center justify-between text-rose-400 text-[10px] uppercase font-bold mb-0.5">
              <span>{t.results.maxRiskAmount}</span>
              <ShieldCheck className="w-3 h-3" />
            </div>
            <div className="text-base sm:text-lg font-bold text-rose-300">
              ${riskAmount.toFixed(2)} USD
            </div>
            <span className="text-[9px] text-slate-400 block mt-0.5 truncate">
              {isArabic ? `أقصى خسارة عند الوقف (${riskPercent}%)` : `Strict loss at SL (${riskPercent}%)`}
            </span>
          </div>

          {/* Position Size USDT */}
          <div className="bg-slate-950 p-3 rounded-lg border border-blue-500/30">
            <div className="flex items-center justify-between text-blue-400 text-[10px] uppercase font-bold mb-0.5">
              <span>{t.results.positionSizeUsdt}</span>
              <DollarSign className="w-3 h-3" />
            </div>
            <div className="text-base sm:text-lg font-bold text-blue-300">
              ${positionSizeUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <span className="text-[9px] text-slate-400 block mt-0.5 truncate">
              {isArabic ? 'إجمالي القيمة السوقية للعقد' : 'Total market exposure'}
            </span>
          </div>

          {/* Position Size Coin */}
          <div className="bg-slate-950 p-3 rounded-lg border border-emerald-500/30">
            <div className="flex items-center justify-between text-emerald-400 text-[10px] uppercase font-bold mb-0.5">
              <span>{t.results.positionSizeBtc.replace('BTC', baseAsset)}</span>
              <Target className="w-3 h-3" />
            </div>
            <div className="text-base sm:text-lg font-bold text-emerald-300">
              {formatCoinQty(positionSizeBtc)} {baseAsset}
            </div>
            <span className="text-[9px] text-slate-400 block mt-0.5 truncate">
              {isArabic ? 'كمية العملة المحددة للأمر' : 'Exact coin quantity'}
            </span>
          </div>

          {/* Safe Leverage & R:R */}
          <div className="bg-slate-950 p-3 rounded-lg border border-indigo-500/30">
            <div className="flex items-center justify-between text-indigo-400 text-[10px] uppercase font-bold mb-0.5">
              <span>{t.results.recommendedLeverage}</span>
              <Sparkles className="w-3 h-3" />
            </div>
            <div className="text-base sm:text-lg font-bold text-indigo-300 flex items-center gap-1.5">
              <span>{leverage}x</span>
              <span className="text-[11px] font-normal text-slate-400">(R:R {riskRewardRatio})</span>
            </div>
            <span className="text-[9px] text-slate-400 block mt-0.5 truncate">
              {isArabic ? `مسافة الوقف: ${stopLossPercent.toFixed(2)}%` : `SL Distance: ${stopLossPercent.toFixed(2)}%`}
            </span>
          </div>
        </div>

        {/* Expected Gains Target Bar */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
              TP1
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">{t.results.potentialProfitTp1} (+{tp1GainPercent.toFixed(2)}%)</span>
              <span className="text-emerald-400 font-bold text-xs sm:text-sm">+${tp1GainUsdt.toFixed(2)} USDT</span>
            </div>
          </div>

          <div className="hidden sm:block w-px h-6 bg-slate-800" />

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
              TP2
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">{t.results.potentialProfitTp2} (+{tp2GainPercent.toFixed(2)}%)</span>
              <span className="text-emerald-400 font-bold text-xs sm:text-sm">+${tp2GainUsdt.toFixed(2)} USDT</span>
            </div>
          </div>

          <div className="hidden sm:block w-px h-6 bg-slate-800" />

          <div className="text-right">
            <span className="text-slate-500 block text-[9px]">{t.results.leverageNotice}</span>
          </div>
        </div>
      </div>

      {/* 3. Live Paper Trading Simulation Engine */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            <h3 className="font-bold text-white text-sm sm:text-base">
              {openPos ? t.activePosition : (isArabic ? 'محاكي تنفيذ الصفقات التجريبي' : 'Live Paper Execution Simulator')}
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {isArabic ? `سعر بينانس: $${formatCoinPrice(currentPrice, selectedSymbol)}` : `Binance Price: $${formatCoinPrice(currentPrice, selectedSymbol)}`}
          </span>
        </div>

        {/* Active Open Position Hero Card */}
        {openPos ? (
          <div className="bg-slate-950 p-3.5 sm:p-4 rounded-lg border border-brand-500/40 space-y-3 font-mono text-xs shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    openPos.type === 'LONG'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {openPos.type} ACTIVE
                </span>
                <div>
                  <span className="text-white font-bold text-xs sm:text-sm">{formatCoinQty(openPos.amountBtc)} {(openPos.symbol || selectedSymbol || 'BTCUSDT').replace('USDT', '')}</span>
                  <span className="text-slate-400 block text-[10px]">
                    {t.entry}: ${formatCoinPrice(openPos.entryPrice, openPos.symbol || selectedSymbol)} (${(openPos.amountBtc * openPos.entryPrice).toFixed(0)} USDT)
                  </span>
                </div>
              </div>

              {isPositionSymbolSelected ? (
                <button
                  onClick={handleClosePaperTrade}
                  className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t.closePosition} (${formatCoinPrice(currentPrice, openPos.symbol || selectedSymbol)})</span>
                </button>
              ) : (
                <div className="px-3 py-1.5 bg-slate-800 text-slate-400 font-bold rounded-lg text-[11px] flex items-center justify-center">
                  Switch to {(openPos.symbol || '').replace('USDT', '')} to Close
                </div>
              )}
            </div>

            {/* Position details grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">{t.currentPrice}</span>
                <span className="text-white font-bold text-xs sm:text-sm">${formatCoinPrice(currentPrice, openPos.symbol || selectedSymbol)}</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">{t.stopLoss}</span>
                <span className="text-rose-400 font-bold text-xs sm:text-sm">${formatCoinPrice(openPos.stopLoss, openPos.symbol || selectedSymbol)}</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">Target TP1</span>
                <span className="text-emerald-400 font-bold text-xs sm:text-sm">${formatCoinPrice(openPos.tp1, openPos.symbol || selectedSymbol)}</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px]">{t.liveGainLoss}</span>
                <span className={`font-bold text-xs sm:text-sm flex items-center gap-1 ${unrealizedPnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {unrealizedPnlUsdt >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {unrealizedPnlUsdt >= 0 ? '+' : ''}${unrealizedPnlUsdt.toFixed(2)} ({unrealizedPnlPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400">
              {t.noActivePosition}
            </p>
            {/* Compact 2-column action buttons for simulator */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              <button
                id="btn-paper-open-long"
                onClick={() => handleOpenPaperTrade('LONG')}
                className="py-2 sm:py-2.5 px-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-[11px] sm:text-xs rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-300/40"
              >
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono truncate">
                  {t.openLong} ({formatCoinQty(positionSizeBtc)} {baseAsset})
                </span>
              </button>

              <button
                id="btn-paper-open-short"
                onClick={() => handleOpenPaperTrade('SHORT')}
                className="py-2 sm:py-2.5 px-2.5 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-bold text-[11px] sm:text-xs rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-rose-400/40"
              >
                <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono truncate">
                  {t.openShort} ({formatCoinQty(positionSizeBtc)} {baseAsset})
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Closed Paper Trade History */}
      {!isLive && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" />
              <h3 className="font-bold text-white text-sm sm:text-base">
                {t.tradeHistoryTitle} ({paperWallet.history.length})
              </h3>
            </div>
            {Boolean(paperWallet?.history && paperWallet.history.length > 0) && (
              <button
                onClick={handleClearHistory}
                className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>{t.clearHistory}</span>
              </button>
            )}
          </div>

          {(!paperWallet?.history || paperWallet.history.length === 0) ? (
            <div className="text-center py-6 text-slate-500 text-xs font-mono">
              {t.noTradeHistory}
            </div>
          ) : (
            <div className="space-y-2 font-mono text-xs max-h-60 overflow-y-auto">
              {(paperWallet.history || []).slice(0, 10).map((record) => {
                const isProfit = record.pnlUsdt >= 0;
                const recSymbol = record.symbol || selectedSymbol || 'BTCUSDT';
                return (
                  <div
                    key={record.id}
                    className="flex flex-wrap items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 gap-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded flex items-center justify-center border font-bold ${
                          isProfit
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded font-bold text-[9px] bg-slate-800 text-brand-300 border border-slate-700/80">
                            {recSymbol}
                          </span>
                          <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                            record.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {record.type}
                          </span>
                          <span className="text-slate-200 font-bold text-[11px]">
                            ${formatCoinPrice(record.entryPrice, recSymbol)} → ${formatCoinPrice(record.exitPrice, recSymbol)}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 block mt-0.5">
                          {new Date(record.time).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`font-bold text-xs sm:text-sm ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}${record.pnlUsdt.toFixed(2)} ({isProfit ? '+' : ''}{record.pnlPercent.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Golden Guide & Rules */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-slate-200 font-bold text-xs sm:text-sm">
          <Info className="w-4 h-4 text-brand-400" />
          <span>{t.guideTitle}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] text-slate-400">
          {t.guideTips.map((tip: string, idx: number) => (
            <div key={idx} className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Top-Up / Deposit Paper Funds */}
      {isDepositModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDepositModalOpen(false);
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-xl p-3.5 shadow-2xl w-full max-w-xs space-y-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-brand-400" />
                <span>{t.depositTitle}</span>
              </h3>
              <button 
                onClick={() => setIsDepositModalOpen(false)} 
                className="text-slate-400 hover:text-white transition p-1 rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-slate-400">{t.depositAmount}</label>
              <input
                type="number"
                value={depositAmountInput}
                onChange={(e) => setDepositAmountInput(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-brand-500 text-white rounded-lg px-2.5 py-1.5 outline-none font-mono font-bold text-xs transition"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400">{t.quickDeposit}:</span>
              <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                {[1000, 5000, 10000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleDepositFunds(amt)}
                    className="py-1 bg-slate-800/90 hover:bg-slate-700 text-brand-400 font-bold rounded border border-slate-700/60 transition text-center active:scale-95 cursor-pointer"
                  >
                    +${amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setIsDepositModalOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg py-1.5 text-xs transition active:scale-95 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => handleDepositFunds(Number(depositAmountInput))}
                disabled={!depositAmountInput || Number(depositAmountInput) <= 0}
                className="flex-1 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg py-1.5 text-xs transition shadow-sm active:scale-95 cursor-pointer"
              >
                {t.confirmDeposit}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reset Paper Wallet */}
      {isResetModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsResetModalOpen(false);
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-xl p-3.5 shadow-2xl w-full max-w-xs space-y-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-xs flex items-center gap-1.5 text-rose-400">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.resetConfirmTitle}</span>
              </h3>
              <button 
                onClick={() => setIsResetModalOpen(false)} 
                className="text-slate-400 hover:text-white transition p-1 rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[10px] text-slate-300 leading-relaxed">
              {t.resetConfirmText}
            </p>

            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg py-1.5 text-xs transition active:scale-95 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleResetPaperWallet}
                className="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg py-1.5 text-xs transition shadow-sm active:scale-95 cursor-pointer"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
