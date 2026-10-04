import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  X, 
  Check, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  Zap,
  Coins,
  Radio,
  FlaskConical,
  Flame,
  ShieldCheck,
  Server,
  ExternalLink,
  RefreshCw,
  Layers,
  PieChart,
  RotateCcw,
  Sparkles,
  Percent,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { 
  Language, 
  PaperWallet, 
  ActiveBotPosition, 
  MarketType, 
  TradingExecutionMode, 
  BinanceApiConfig,
  DedicatedMarketWallet,
  MultiMarketPortfolio,
  CombinedPortfolioSummary
} from '../types';
import { calculateDedicatedMarketWallet, calculateMultiMarketPortfolio } from '../utils/portfolioCalc';

interface CustomBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  paperWallet: PaperWallet;
  marketType?: MarketType;
  executionMode?: TradingExecutionMode;
  binanceConfig?: BinanceApiConfig;
  onUpdateBalance: (newBalance: number, resetHistory?: boolean, targetMarket?: MarketType | 'ALL') => void;
  activeBotPositions?: ActiveBotPosition[];
  onOpenBinanceModal?: () => void;
  onToggleExecutionMode?: (mode: TradingExecutionMode) => void;
  onSyncBinancePositions?: () => Promise<void> | void;
  spotWallet?: DedicatedMarketWallet | null;
  futuresWallet?: DedicatedMarketWallet | null;
  onToggleMarketType?: (marketType: MarketType) => void;
}

type ModalViewTab = 'FUTURES' | 'SPOT' | 'COMBINED';

export const CustomBalanceModal: React.FC<CustomBalanceModalProps> = ({
  isOpen,
  onClose,
  language,
  paperWallet,
  marketType = 'FUTURES',
  executionMode = 'PAPER',
  binanceConfig,
  onUpdateBalance,
  activeBotPositions,
  onOpenBinanceModal,
  onToggleExecutionMode,
  onSyncBinancePositions,
  spotWallet: propSpotWallet,
  futuresWallet: propFuturesWallet,
  onToggleMarketType,
}) => {
  const isArabic = language === 'ar';
  const isEn = language === 'en';
  const isFr = language === 'fr';

  const [activeTab, setActiveTab] = useState<ModalViewTab>(marketType === 'SPOT' ? 'SPOT' : 'FUTURES');
  const [inputVal, setInputVal] = useState<string>('1000');
  const [resetPnL, setResetPnL] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Compute live multi-market portfolio
  const multiPortfolio: MultiMarketPortfolio = React.useMemo(() => {
    return calculateMultiMarketPortfolio(
      activeBotPositions,
      paperWallet?.history || [],
      paperWallet,
      executionMode,
      binanceConfig?.accountInfo,
      activeTab === 'SPOT' ? 'SPOT' : 'FUTURES'
    );
  }, [activeBotPositions, paperWallet, executionMode, binanceConfig, activeTab]);

  const activeWalletMetrics = activeTab === 'SPOT' ? multiPortfolio.spot : multiPortfolio.futures;

  // Sync state when opening or switching tabs
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'SPOT') {
        const val = multiPortfolio.spot.initialDeposit || 1000;
        setInputVal(val.toString());
      } else if (activeTab === 'FUTURES') {
        const val = multiPortfolio.futures.initialDeposit || 1000;
        setInputVal(val.toString());
      } else {
        const val = (multiPortfolio.combined.totalEquity || 2000);
        setInputVal(val.toString());
      }
      setResetPnL(false);
      setError(null);
    }
  }, [isOpen, activeTab, multiPortfolio.spot.initialDeposit, multiPortfolio.futures.initialDeposit]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const presets = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

  const handleApplyPreset = (val: number) => {
    setInputVal(val.toString());
    setError(null);
  };

  const handleAdjust = (delta: number) => {
    const current = parseFloat(inputVal) || 0;
    const next = Math.max(10, current + delta);
    setInputVal(next.toString());
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(inputVal);
    if (isNaN(num) || num < 10) {
      setError(
        isArabic 
          ? 'يرجى إدخال رصيد صحيح (10 USDT على الأقل)' 
          : isEn 
          ? 'Please enter a valid balance (min 10 USDT)' 
          : 'Veuillez saisir un solde valide (min 10 USDT)'
      );
      return;
    }

    const target = activeTab === 'COMBINED' ? 'ALL' : activeTab;
    onUpdateBalance(num, resetPnL, target);

    setSuccessToast(
      isArabic
        ? `تم تحديث محفظة ${activeTab === 'SPOT' ? 'السبوت' : activeTab === 'FUTURES' ? 'العقود الآجلة' : 'كلا السوقين'} بنجاح!`
        : `Wallet updated successfully!`
    );

    setTimeout(() => {
      setSuccessToast(null);
      onClose();
    }, 800);
  };

  const handleSelectTab = (tab: ModalViewTab) => {
    setActiveTab(tab);
    setError(null);
    if (tab !== 'COMBINED' && onToggleMarketType) {
      onToggleMarketType(tab);
    }
  };

  if (!isOpen) return null;

  const isTestnetMode = executionMode === 'BINANCE_TESTNET';
  const isLiveMode = executionMode === 'BINANCE_LIVE';
  const isPaperMode = executionMode === 'PAPER';

  const spot = multiPortfolio.spot;
  const futures = multiPortfolio.futures;
  const combined = multiPortfolio.combined;

  // Percentage allocation
  const totalEquities = (spot.totalEquity + futures.totalEquity) || 1;
  const spotSharePct = Math.round((spot.totalEquity / totalEquities) * 100);
  const futuresSharePct = 100 - spotSharePct;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all duration-200 ${
          isArabic ? 'rtl text-right' : 'ltr text-left'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Mode & Title */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              isTestnetMode
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : isLiveMode
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-sm sm:text-base flex items-center gap-2">
                <span>
                  {isArabic ? 'مركز إدارة المحافظ والأسواق (Portfolio Hub)' : 'Dedicated Multi-Market Portfolio Hub'}
                </span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold border uppercase ${
                  isTestnetMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : isLiveMode
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {executionMode}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isArabic 
                  ? 'محفظة مخصصة ومستقلة لكل نوع سوق مع ضبط شامل للأرصدة والأرباح والخسائر' 
                  : 'Isolated portfolio per market type with precise accounting reconciliation'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Way Market Selector Tabs (FUTURES vs SPOT vs COMBINED) */}
        <div className="px-5 pt-3.5 pb-2 bg-slate-950/50 border-b border-slate-800/80">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            {/* Tab 1: FUTURES */}
            <button
              type="button"
              onClick={() => handleSelectTab('FUTURES')}
              className={`py-2 px-3 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'FUTURES'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>{isArabic ? 'العقود الآجلة (Futures)' : 'USDT-M Futures'}</span>
            </button>

            {/* Tab 2: SPOT */}
            <button
              type="button"
              onClick={() => handleSelectTab('SPOT')}
              className={`py-2 px-3 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'SPOT'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Coins className="w-4 h-4 text-emerald-400" />
              <span>{isArabic ? 'السوق الفوري (Spot)' : 'Spot Market'}</span>
            </button>

            {/* Tab 3: COMBINED OVERVIEW */}
            <button
              type="button"
              onClick={() => handleSelectTab('COMBINED')}
              className={`py-2 px-3 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'COMBINED'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieChart className="w-4 h-4 text-purple-400" />
              <span>{isArabic ? 'المحفظة الشاملة' : 'Combined'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto no-scrollbar flex-1">
          {successToast && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1 & 2: DEDICATED MARKET VIEW (FUTURES OR SPOT)                        */}
          {/* ========================================================================= */}
          {activeTab !== 'COMBINED' ? (
            <div className="space-y-4">
              {/* Market Badge Banner */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                activeTab === 'FUTURES'
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}>
                <div className="flex items-center gap-2">
                  {activeTab === 'FUTURES' ? <Zap className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
                  <span className="font-bold">
                    {activeTab === 'FUTURES' 
                      ? (isArabic ? 'محفظة العقود الآجلة المستقلة (USDT-M Futures)' : 'Isolated USDT-M Futures Portfolio')
                      : (isArabic ? 'محفظة السوق الفوري المستقلة (Spot Market)' : 'Isolated Spot Market Portfolio')}
                  </span>
                </div>
                <span className="font-mono text-[11px] opacity-80">
                  {activeTab === 'FUTURES' 
                    ? (isArabic ? 'رافعة مالية وعقود Long/Short' : 'Leveraged Long/Short')
                    : (isArabic ? 'شراء أصول فورية 1x (Long Only)' : 'Spot Cash 1x Long Only')}
                </span>
              </div>

              {/* Comprehensive 4-Card Balance Accounting Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Available / Free Balance */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                  <span className="text-[10px] text-slate-400 block font-sans">
                    {activeTab === 'FUTURES' 
                      ? (isArabic ? 'الهامش الحر المتاح:' : 'Free Margin:') 
                      : (isArabic ? 'الرصيد الكاش المتاح:' : 'Free Cash:')}
                  </span>
                  <span className="text-base font-black text-emerald-400 font-mono block mt-0.5">
                    ${activeWalletMetrics.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-1 font-mono">
                    {isArabic ? 'جاهز لصفقات جديدة' : 'Available for trades'}
                  </span>
                </div>

                {/* 2. Invested Balance / In Trades */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                  <span className="text-[10px] text-slate-400 block font-sans">
                    {activeTab === 'FUTURES' 
                      ? (isArabic ? 'الهامش المستثمر:' : 'In-Trade Margin:') 
                      : (isArabic ? 'قيمة الأصول المستثمرة:' : 'Spot Invested:')}
                  </span>
                  <span className="text-base font-black text-amber-400 font-mono block mt-0.5">
                    ${activeWalletMetrics.inTradeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-1 font-mono">
                    {activeTab === 'FUTURES' ? (isArabic ? 'محجوز في عقود نشطة' : 'Locked in margin') : (isArabic ? 'قيمة شراء العملات' : 'Cost of crypto held')}
                  </span>
                </div>

                {/* 3. Profits & Losses (Realized & Floating) */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                  <span className="text-[10px] text-slate-400 block font-sans">
                    {isArabic ? 'الأرباح والخسائر:' : 'Net P&L:'}
                  </span>
                  <span className={`text-base font-black font-mono block mt-0.5 ${
                    activeWalletMetrics.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {activeWalletMetrics.netPnl >= 0 ? '+' : ''}${activeWalletMetrics.netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mt-1 font-mono">
                    <span>{isArabic ? 'عائم:' : 'Float:'} <b className={activeWalletMetrics.floatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{activeWalletMetrics.floatingPnl >= 0 ? '+' : ''}${activeWalletMetrics.floatingPnl.toFixed(1)}</b></span>
                  </div>
                </div>

                {/* 4. General / Total Balance (Total Equity) */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl ring-1 ring-cyan-500/20">
                  <span className="text-[10px] text-cyan-300 block font-sans font-bold">
                    {isArabic ? 'الرصيد العام (Total Equity):' : 'Total Equity:'}
                  </span>
                  <span className="text-base font-black text-white font-mono block mt-0.5">
                    ${activeWalletMetrics.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-1 font-mono">
                    {isArabic ? 'المتاح + المستثمر + العائم' : 'Free + Margin + Float'}
                  </span>
                </div>
              </div>

              {/* Spot Holdings Sub-panel (Only for SPOT when crypto assets exist) */}
              {activeTab === 'SPOT' && activeWalletMetrics.holdings && Object.keys(activeWalletMetrics.holdings).length > 0 && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isArabic ? 'تفاصيل أصول السبوت المشتراة:' : 'Spot Asset Holdings Details:'}</span>
                  </span>
                  <div className="space-y-1.5">
                    {Object.entries(activeWalletMetrics.holdings).map(([asset, item]) => (
                      <div key={asset} className="flex items-center justify-between text-xs font-mono p-2 bg-slate-900 rounded-xl">
                        <span className="font-bold text-white">{asset}</span>
                        <span className="text-slate-400">{item.qty} {asset}</span>
                        <span className="font-bold text-amber-300">${item.valueUsdt.toFixed(2)} USDT</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Paper Customization Form (Only in Paper Mode) */}
              {isPaperMode ? (
                <form onSubmit={handleSubmit} className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-brand-400" />
                      <span>
                        {isArabic 
                          ? `تخصيص رصيد الإيداع الأولي لمحفظة ${activeTab === 'FUTURES' ? 'العقود الآجلة' : 'السبوت'}:`
                          : `Configure Base Capital for ${activeTab === 'FUTURES' ? 'Futures' : 'Spot'} Wallet:`}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {isArabic ? `الحالي: $${activeWalletMetrics.initialDeposit}` : `Current: $${activeWalletMetrics.initialDeposit}`}
                    </span>
                  </div>

                  {/* Input field */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="10"
                      value={inputVal}
                      onChange={(e) => {
                        setInputVal(e.target.value);
                        setError(null);
                      }}
                      className="w-full bg-slate-900 border border-slate-700/80 focus:border-cyan-500 rounded-xl py-2.5 pl-9 pr-16 text-white font-mono font-bold text-sm focus:outline-none transition shadow-inner"
                      placeholder="1000"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-xs font-mono font-bold text-slate-400">USDT</span>
                    </div>
                  </div>

                  {/* Quick delta modifiers */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAdjust(-500)}
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-800 transition cursor-pointer"
                    >
                      -500
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjust(-100)}
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-800 transition cursor-pointer"
                    >
                      -100
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjust(100)}
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-emerald-300 border border-slate-800 transition cursor-pointer"
                    >
                      +100
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjust(500)}
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-emerald-300 border border-slate-800 transition cursor-pointer"
                    >
                      +500
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjust(1000)}
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-emerald-300 border border-slate-800 transition cursor-pointer"
                    >
                      +1,000
                    </button>
                  </div>

                  {/* Presets */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {presets.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        className={`py-1.5 rounded-lg text-xs font-mono font-bold transition border cursor-pointer ${
                          inputVal === p.toString()
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border-slate-800'
                        }`}
                      >
                        ${p.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  {/* Reset History checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="resetPnlCheckbox"
                      checked={resetPnL}
                      onChange={(e) => setResetPnL(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="resetPnlCheckbox" className="text-xs text-slate-300 cursor-pointer select-none">
                      {isArabic 
                        ? `تصفير سجل الصفقات والأرباح المحققة لمحفظة ${activeTab === 'FUTURES' ? 'العقود الآجلة' : 'السبوت'} فقط`
                        : `Reset trade history and realized P&L for this ${activeTab} wallet`}
                    </label>
                  </div>

                  {error && (
                    <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs shadow-cyan-500/20"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {isArabic 
                        ? `حفظ وتحديث محفظة ${activeTab === 'FUTURES' ? 'العقود الآجلة' : 'السبوت'}`
                        : `Save and Apply ${activeTab} Wallet Balance`}
                    </span>
                  </button>
                </form>
              ) : (
                /* Exchange Mode details banner */
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{isArabic ? 'حالة حساب بايننس الرسمي:' : 'Binance Exchange Status:'}</span>
                    <span className={binanceConfig?.isConnected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {binanceConfig?.isConnected ? '● Connected' : '○ Standby'}
                    </span>
                  </div>
                  {onSyncBinancePositions && (
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={async () => {
                        setIsSyncing(true);
                        try {
                          await onSyncBinancePositions();
                        } finally {
                          setIsSyncing(false);
                        }
                      }}
                      className="w-full py-2 px-3 rounded-xl font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition flex items-center justify-center gap-2 text-xs cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isArabic ? 'مزامنة فورية للأرصدة مع بايننس' : 'Instant Sync with Binance'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* TAB 3: COMBINED GLOBAL PORTFOLIO (SPOT + FUTURES)                         */
            /* ========================================================================= */
            <div className="space-y-4">
              {/* Global Total Balance Spotlight Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-950 to-slate-900 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-200">
                      {isArabic ? 'الرصيد العام المشترك لكافة المحافظ (Global Equity)' : 'Global Multi-Market Combined Equity'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300 font-bold bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                    SPOT + FUTURES
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                    ${combined.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-xs font-mono font-bold ${
                    combined.totalNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {combined.totalNetPnl >= 0 ? '+' : ''}${combined.totalNetPnl.toFixed(2)} Net PnL
                  </span>
                </div>

                {/* Capital Allocation Visual Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-cyan-300 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      <span>Futures: ${futures.totalEquity.toFixed(0)} ({futuresSharePct}%)</span>
                    </span>
                    <span className="text-emerald-300 flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      <span>Spot: ${spot.totalEquity.toFixed(0)} ({spotSharePct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden flex border border-slate-800">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300" 
                      style={{ width: `${futuresSharePct}%` }} 
                    />
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300" 
                      style={{ width: `${spotSharePct}%` }} 
                    />
                  </div>
                </div>
              </div>

              {/* Side-by-Side Comparison: Spot vs Futures */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Spot Card */}
                <div className="p-3.5 bg-slate-950 border border-emerald-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-400" />
                      <span>{isArabic ? 'محفظة السبوت (Spot)' : 'Spot Portfolio'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('SPOT')}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                    >
                      {isArabic ? 'إدارة' : 'Manage'}
                    </button>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>{isArabic ? 'الرصيد المتاح:' : 'Free Cash:'}</span>
                      <span className="text-white font-bold">${spot.balance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>{isArabic ? 'الرصيد المستثمر:' : 'In Trades:'}</span>
                      <span className="text-amber-400 font-bold">${spot.inTradeMargin.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>{isArabic ? 'صافي الربح/الخسارة:' : 'Net P&L:'}</span>
                      <span className={spot.netPnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {spot.netPnl >= 0 ? '+' : ''}${spot.netPnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1 text-slate-300">
                      <span className="font-bold">{isArabic ? 'إجمالي السبوت:' : 'Spot Equity:'}</span>
                      <span className="text-white font-black">${spot.totalEquity.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Futures Card */}
                <div className="p-3.5 bg-slate-950 border border-cyan-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>{isArabic ? 'محفظة العقود (Futures)' : 'Futures Portfolio'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('FUTURES')}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
                    >
                      {isArabic ? 'إدارة' : 'Manage'}
                    </button>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>{isArabic ? 'الهامش المتاح:' : 'Free Margin:'}</span>
                      <span className="text-white font-bold">${futures.balance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>{isArabic ? 'الهامش المحجوز:' : 'In Margin:'}</span>
                      <span className="text-amber-400 font-bold">${futures.inTradeMargin.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>{isArabic ? 'صافي الربح/الخسارة:' : 'Net P&L:'}</span>
                      <span className={futures.netPnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {futures.netPnl >= 0 ? '+' : ''}${futures.netPnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1 text-slate-300">
                      <span className="font-bold">{isArabic ? 'إجمالي العقود:' : 'Futures Equity:'}</span>
                      <span className="text-white font-black">${futures.totalEquity.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Combined Global Reset Action (In Paper Mode) */}
              {isPaperMode && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-bold text-white block">
                      {isArabic ? 'إعادة ضبط شاملة لكلا المحفظتين' : 'Full Reset for Both Wallets'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {isArabic ? 'تصفير كافة الصفقات وتعيين 1,000 USDT لكل محفظة' : 'Reset history and set $1,000 to Spot and Futures'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateBalance(1000, true, 'ALL');
                      setSuccessToast(isArabic ? 'تمت إعادة ضبط كافة المحافظ بنجاح!' : 'Both portfolios reset successfully!');
                      setTimeout(() => {
                        setSuccessToast(null);
                        onClose();
                      }, 800);
                    }}
                    className="py-2 px-3 rounded-xl font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 transition text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'إعادة ضبط شاملة' : 'Full Reset'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation / Help */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px]">
              {isArabic ? 'حسابات كمية دقيقة ومطابقة لمعايير بايننس' : 'Precise quantitative accounting matching Binance specs'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer text-xs"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
