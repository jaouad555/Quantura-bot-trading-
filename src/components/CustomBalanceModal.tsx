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
  RefreshCw
} from 'lucide-react';
import { Language, PaperWallet, ActiveBotPosition, MarketType, TradingExecutionMode, BinanceApiConfig } from '../types';
import { calculatePortfolioMetrics } from '../utils/portfolioCalc';

interface CustomBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  paperWallet: PaperWallet;
  marketType?: MarketType;
  executionMode?: TradingExecutionMode;
  binanceConfig?: BinanceApiConfig;
  onUpdateBalance: (newBalance: number, resetHistory?: boolean) => void;
  activeBotPositions?: ActiveBotPosition[];
  onOpenBinanceModal?: () => void;
  onToggleExecutionMode?: (mode: TradingExecutionMode) => void;
  onSyncBinancePositions?: () => Promise<void> | void;
}

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
}) => {
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  const [activeMarket, setActiveMarket] = useState<MarketType>(marketType);
  const [inputVal, setInputVal] = useState<string>(paperWallet.balance.toString());
  const [resetPnL, setResetPnL] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setActiveMarket(marketType);
      setInputVal(paperWallet.balance.toString());
      setResetPnL(false);
      setError(null);
    }
  }, [isOpen, paperWallet.balance, marketType]);

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

    onUpdateBalance(num, resetPnL);
    onClose();
  };

  if (!isOpen) return null;

  const isTestnetMode = executionMode === 'BINANCE_TESTNET';
  const isLiveMode = executionMode === 'BINANCE_LIVE';
  const isPaperMode = executionMode === 'PAPER';

  const metrics = calculatePortfolioMetrics(
    paperWallet, 
    activeBotPositions, 
    undefined, 
    undefined, 
    isLiveMode, 
    binanceConfig?.accountInfo || null, 
    activeMarket, 
    executionMode
  );

  const testnetFreeUsdt = binanceConfig?.accountInfo?.freeUsdt ?? 0;
  const testnetTotalEquity = binanceConfig?.accountInfo?.totalUsdtEquity ?? 0;

  const currentNum = parseFloat(inputVal) || 0;
  const inTradeMargin = metrics.inTradeMargin;
  const floatingPnl = metrics.floatingPnl;
  const totalEquity = metrics.totalEquity;

  const diff = currentNum - paperWallet.balance;
  const diffPercent = paperWallet.balance > 0 ? (diff / paperWallet.balance) * 100 : 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-200 ${
          isArabic ? 'rtl text-right' : 'ltr text-left'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Dynamically tailored to active mode */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isTestnetMode
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : isLiveMode
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}>
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-white text-xs sm:text-sm flex items-center gap-2">
                <span>
                  {isTestnetMode 
                    ? (isArabic ? 'تفاصيل محفظة Binance Testnet' : 'Binance Testnet Sandbox Wallet')
                    : isLiveMode
                    ? (isArabic ? 'تفاصيل محفظة Binance Live' : 'Binance Live Real Wallet')
                    : (isArabic ? 'تخصيص رصيد المحفظة التجريبية (Paper)' : 'Custom Paper Trading Wallet')}
                </span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold border uppercase ${
                  isTestnetMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : isLiveMode
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {executionMode}
                </span>
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: BINANCE TESTNET WALLET VIEW (NO CONFUSION WITH PAPER)             */}
        {/* ========================================================================= */}
        {isTestnetMode ? (
          <div className="p-4 space-y-4 font-mono text-xs">
            {/* Status notification banner */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2.5">
              <FlaskConical className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="font-sans text-[11px] leading-relaxed">
                <p className="font-bold text-amber-200">
                  {isArabic ? 'أنت الآن في وضع شبكة اختبار بايننس (Binance Testnet)' : 'You are currently in Binance Testnet Sandbox mode'}
                </p>
                <p className="text-amber-300/80 mt-0.5">
                  {isArabic 
                    ? 'هذا الرصيد مرتبط بحساب Testnet الرسمي في Binance ويتم جلبه مباشرة عبر API بدون استخدام أموالك الحقيقية.'
                    : 'This balance reflects your official Binance Testnet sandbox account fetched live via API.'}
                </p>
              </div>
            </div>

            {/* Testnet Balances Cards (4-way comprehensive balance metrics) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-sans">
                  {isArabic ? 'الرصيد المتاح (Free USDT):' : 'Available Free Cash:'}
                </span>
                <span className="text-base font-black text-amber-400 font-mono">
                  ${testnetFreeUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">Binance Testnet</span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-sans">
                  {isArabic ? 'في الصفقات (In Trades):' : 'In-Trade Margin:'}
                </span>
                <span className="text-base font-black text-cyan-400 font-mono">
                  ${inTradeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">
                  {(activeBotPositions || []).filter(p => (p.mode || 'PAPER') === 'BINANCE_TESTNET').length} {isArabic ? 'صفقات نشطة' : 'open trades'}
                </span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-sans">
                  {isArabic ? 'أرباح الصفقات (Floating PnL):' : 'Unrealized PnL:'}
                </span>
                <span className={`text-base font-black font-mono ${floatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {floatingPnl >= 0 ? '+' : ''}${floatingPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">Mark Price Live</span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-sans">
                  {isArabic ? 'إجمالي المحفظة (Equity):' : 'Total Equity:'}
                </span>
                <span className="text-base font-black text-white font-mono">
                  ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">{marketType} Account</span>
              </div>
            </div>

            {/* Network Details */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{isArabic ? 'الشبكة النشطة:' : 'Active Network:'}</span>
                <span className="text-amber-400 font-bold flex items-center gap-1 font-mono text-[10px]">
                  <Server className="w-3 h-3" />
                  <span>{marketType === 'FUTURES' ? 'testnet.binancefuture.com' : 'testnet.binance.vision'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{isArabic ? 'نوع السوق:' : 'Market Type:'}</span>
                <span className="text-cyan-400 font-bold">{marketType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{isArabic ? 'حالة الاتصال:' : 'Connection Status:'}</span>
                <span className={binanceConfig?.isConnected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {binanceConfig?.isConnected ? (isArabic ? '● متصل بنجاح' : '● Connected') : (isArabic ? '○ غير متصل' : '○ Standby')}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1 font-sans">
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
                  className="w-full py-2.5 px-4 rounded-xl font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition flex items-center justify-center gap-2 cursor-pointer text-xs active:scale-[0.99]"
                >
                  <RefreshCw className={`w-4 h-4 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>
                    {isSyncing 
                      ? (isArabic ? 'جارٍ المزامنة مع بايننس Testnet...' : 'Syncing with Binance Testnet...') 
                      : (isArabic ? 'مزامنة فورية للصفقات والأرصدة مع بايننس' : 'Instant Sync with Binance Testnet')}
                  </span>
                </button>
              )}

              {onOpenBinanceModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBinanceModal();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 text-xs"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isArabic ? 'فتح إعدادات وأرصدة Binance Testnet API' : 'Open Binance Testnet API Settings'}</span>
                </button>
              )}

              {onToggleExecutionMode && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleExecutionMode('PAPER');
                    onClose();
                  }}
                  className="w-full py-2 px-3 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isArabic ? 'التبديل إلى وضع المحاكاة الافتراضية (Paper Trading)' : 'Switch back to Simulated Paper Trading'}</span>
                </button>
              )}
            </div>
          </div>
        ) : isLiveMode ? (
          /* ========================================================================= */
          /* VIEW 2: BINANCE LIVE REAL WALLET VIEW                                     */
          /* ========================================================================= */
          <div className="p-4 space-y-4 font-mono text-xs">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2.5 font-sans">
              <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <p className="font-bold text-rose-200">
                  {isArabic ? 'أنت الآن في وضع التداول الحقيقي المباشر (Binance Live)' : 'You are in Binance Live Real Trading mode'}
                </p>
                <p className="text-rose-300/80 mt-0.5">
                  {isArabic 
                    ? 'الأرصدة المعروضة هي أموالك الفعلية الحقيقية في محفظة منصة Binance.'
                    : 'These balances reflect your genuine real-money Binance portfolio.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-sans">
                  {isArabic ? 'الرصيد المتاح (Free USDT):' : 'Available Free USDT:'}
                </span>
                <span className="text-base font-black text-emerald-400">
                  ${(binanceConfig?.accountInfo?.freeUsdt ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-sans">
                  {isArabic ? 'إجمالي الرصيد (Total Equity):' : 'Total USDT Equity:'}
                </span>
                <span className="text-base font-black text-white">
                  ${(binanceConfig?.accountInfo?.totalUsdtEquity ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {onOpenBinanceModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBinanceModal();
                }}
                className="w-full py-2.5 px-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs font-sans"
              >
                <Zap className="w-4 h-4" />
                <span>{isArabic ? 'إدارة إعدادات وربط Binance Live API' : 'Manage Binance Live API Settings'}</span>
              </button>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 3: SIMULATED PAPER WALLET CUSTOMIZATION (ONLY IN PAPER MODE)         */
          /* ========================================================================= */
          <form onSubmit={handleSubmit} className="p-3.5 space-y-3 overflow-y-auto no-scrollbar flex-1">
            {/* Market Type Selector (Futures vs Spot) */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setActiveMarket('FUTURES')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMarket === 'FUTURES'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>FUTURES USDT-M</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMarket('SPOT')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMarket === 'SPOT'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>SPOT MARKET</span>
              </button>
            </div>

            {/* Portfolio Equity Overview Card */}
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-cyan-500/30 font-mono space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-cyan-300 font-sans font-medium">
                  {isArabic ? `إجمالي قيمة محفظة ${activeMarket} (Total Equity):` : `Total ${activeMarket} Portfolio Equity:`}
                </span>
                <span className="text-sm font-bold text-cyan-300">
                  ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1.5 border-t border-slate-800/80">
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 block">{isArabic ? 'السيولة المتاحة (Free):' : 'Free Cash:'}</span>
                  <span className="text-emerald-300 font-bold">${metrics.freeCash.toFixed(2)}</span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 block">{activeMarket === 'FUTURES' ? (isArabic ? 'في صفقات الهامش:' : 'In Margin:') : (isArabic ? 'قيمة الأصول المشتراة:' : 'Spot Holdings:')}</span>
                  <span className="text-amber-300 font-bold">${activeMarket === 'FUTURES' ? inTradeMargin.toFixed(2) : metrics.spotHoldingsValue.toFixed(2)}</span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 block">{isArabic ? 'أرباح مفتوحة:' : 'Unrealized PnL:'}</span>
                  <span className={`font-bold ${floatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {floatingPnl >= 0 ? '+' : ''}${floatingPnl.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400 block">{isArabic ? 'الأرباح المحققة:' : 'Realized PnL:'}</span>
                  <span className={`font-bold ${(paperWallet.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(paperWallet.realizedPnl || 0) >= 0 ? '+' : ''}${(paperWallet.realizedPnl || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Current & Target Dynamic Preview */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 block">
                  {isArabic ? 'السيولة المتاحة الحالية:' : isEn ? 'Current Free Cash:' : 'Solde Libre Actuel :'}
                </span>
                <span className="text-slate-200 font-bold text-xs">
                  ${paperWallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {diff !== 0 && (
                <div className="text-right rtl:text-left">
                  <span className="text-[10px] text-slate-400 block">
                    {isArabic ? 'الفارق:' : isEn ? 'Difference:' : 'Écart :'}
                  </span>
                  <span className={`text-[11px] font-bold inline-flex items-center gap-0.5 ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {diff > 0 ? '+' : ''}${Math.abs(diff).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    <span className="text-[9px] opacity-80">({diff > 0 ? '+' : ''}{diffPercent.toFixed(0)}%)</span>
                  </span>
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                {isArabic ? `المبلغ الجديد لمحفظة ${activeMarket} (USDT):` : `New ${activeMarket} Balance (USDT):`}
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-2.5 rtl:pl-0 rtl:pr-2.5 flex items-center pointer-events-none text-slate-400 font-mono font-bold text-xs">
                  $
                </div>
                <input
                  type="number"
                  min="10"
                  max="10000000"
                  step="any"
                  value={inputVal}
                  onChange={(e) => {
                    setInputVal(e.target.value);
                    setError(null);
                  }}
                  className={`w-full bg-slate-950 border ${
                    error ? 'border-rose-500' : 'border-slate-800 focus:border-cyan-500'
                  } rounded-xl pl-7 pr-3 rtl:pl-3 rtl:pr-7 py-2 text-white font-mono text-sm focus:outline-hidden transition`}
                  placeholder="10000"
                />
              </div>

              {error && (
                <p className="text-rose-400 text-[10px] mt-1 font-medium">{error}</p>
              )}
            </div>

            {/* Quick Adjust Buttons */}
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">
                {isArabic ? 'تعديل سريع:' : isEn ? 'Quick Adjust:' : 'Ajustement Rapide :'}
              </span>
              <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => handleAdjust(-1000)}
                  className="py-1 bg-slate-800/90 hover:bg-slate-700 text-rose-400 hover:text-rose-300 rounded-lg border border-slate-700/60 transition font-bold active:scale-95 cursor-pointer text-center"
                >
                  -1,000$
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjust(-100)}
                  className="py-1 bg-slate-800/90 hover:bg-slate-700 text-rose-400 hover:text-rose-300 rounded-lg border border-slate-700/60 transition font-bold active:scale-95 cursor-pointer text-center"
                >
                  -100$
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjust(100)}
                  className="py-1 bg-slate-800/90 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded-lg border border-slate-700/60 transition font-bold active:scale-95 cursor-pointer text-center"
                >
                  +100$
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjust(1000)}
                  className="py-1 bg-slate-800/90 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded-lg border border-slate-700/60 transition font-bold active:scale-95 cursor-pointer text-center"
                >
                  +1,000$
                </button>
              </div>
            </div>

            {/* Presets - Compact grid */}
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">
                {isArabic ? 'مبالغ شائعة:' : isEn ? 'Presets:' : 'Montants Prédéfinis :'}
              </span>
              <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                {presets.map((preset) => {
                  const isSelected = parseFloat(inputVal) === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`py-1 rounded-lg border font-semibold transition active:scale-95 cursor-pointer text-center ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-xs'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      ${preset >= 1000 ? `${preset / 1000}k` : preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reset Options Checkbox */}
            <div className="pt-1.5 border-t border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetPnL}
                  onChange={(e) => setResetPnL(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 cursor-pointer accent-cyan-500"
                />
                <span className="text-[10px] text-slate-400 hover:text-slate-300 leading-tight">
                  {isArabic 
                    ? 'تصفير الأرباح والخسائر السابقة (بدء جلسة جديدة)' 
                    : isEn 
                    ? 'Reset realized P&L to 0 for a clean session' 
                    : 'Réinitialiser le P&L réalisé à 0'}
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition border border-slate-700/80 active:scale-95 cursor-pointer"
              >
                {isArabic ? 'إلغاء' : isEn ? 'Cancel' : 'Annuler'}
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isArabic ? 'تطبيق الرصيد' : isEn ? 'Apply' : 'Appliquer'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
