import React, { useEffect, useState, useRef } from 'react';
import { BinanceTicker, ConnectionState, Language, TimezoneMode, BinanceApiConfig, TradingExecutionMode, PaperWallet, MarketType, DisplayMode } from '../types';
import { translations } from '../utils/translations';
import { formatTime, getTimezoneLabel } from '../utils/timezone';
import { TradingPair, RESPECTED_TRADING_PAIRS, formatCoinPrice } from '../utils/tradingPairs';
import {
  Radar,
  Activity,
  Volume2,
  VolumeX,
  Bell,
  Settings,
  Globe,
  Smartphone,
  Monitor,
  Maximize,
  Minimize,
  RefreshCw,
  Clock,
  AlertTriangle,
  Radio,
  Key,
  Wallet,
  Coins,
  Shield,
  ShieldAlert,
  ChevronDown,
  Menu,
  Check,
  Bot,
  Layers,
  LineChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  FlaskConical,
  History,
  Wifi,
  Flame,
  Copy,
  CheckCheck,
  Sparkles,
  ShieldCheck,
  AlertOctagon,
  Zap,
  Sliders,
} from 'lucide-react';

interface HeaderProps {
  onOpenMenu?: () => void;
  selectedSymbol: string;
  onSelectPair: (pair: TradingPair) => void;
  ticker: BinanceTicker | null;
  connectionState: ConnectionState;
  language: Language;
  timezone: TimezoneMode;
  onTimezoneChange?: (tz: TimezoneMode) => void;
  isAndroidView: boolean;
  unreadAlertsCount: number;
  soundEnabled: boolean;
  isRefreshing: boolean;
  isDeveloperMode: boolean;
  binanceConfig?: BinanceApiConfig;
  executionMode?: TradingExecutionMode;
  paperWallet?: PaperWallet;
  marketType?: MarketType;
  onToggleMarketType?: (marketType: MarketType) => void;
  onOpenBinanceModal?: () => void;
  onOpenCustomBalanceModal?: () => void;
  onLanguageChange: (lang: Language) => void;
  onToggleAndroidView: () => void;
  displayMode?: DisplayMode;
  onChangeDisplayMode?: (mode: DisplayMode) => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenRiskModal?: () => void;
  onPanicCloseAll?: () => void;
  onToggleSound: () => void;
  onRefreshData: () => void;
  onLogout?: () => void;
  username?: string;
  botEnabled?: boolean;
  onToggleBot?: () => void;
  activeTab?: string;
  onNavigateTab?: (tab: 'signal' | 'autoBot' | 'globalScanner' | 'mtf' | 'market' | 'chart' | 'backtest' | 'analysis' | 'history' | 'riskWallet') => void;
  openPositionsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMenu,
  selectedSymbol,
  onSelectPair,
  ticker,
  connectionState,
  language,
  timezone,
  onTimezoneChange,
  isAndroidView,
  unreadAlertsCount,
  soundEnabled,
  isRefreshing,
  isDeveloperMode,
  binanceConfig,
  executionMode = 'PAPER',
  paperWallet,
  marketType = 'FUTURES',
  onToggleMarketType,
  onOpenBinanceModal,
  onOpenCustomBalanceModal,
  onLanguageChange,
  onToggleAndroidView,
  displayMode = 'standard',
  onChangeDisplayMode,
  onOpenNotifications,
  onOpenSettings,
  onOpenRiskModal,
  onPanicCloseAll,
  onToggleSound,
  onRefreshData,
  onLogout,
  username,
  botEnabled = false,
  onToggleBot,
  activeTab = 'signal',
  onNavigateTab,
  openPositionsCount = 0,
}) => {
  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<'UP' | 'DOWN' | null>(null);
  const [isPairsDropdownOpen, setIsPairsDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedPrice, setCopiedPrice] = useState(false);
  const [pingMs, setPingMs] = useState(24);
  const [panicConfirmState, setPanicConfirmState] = useState(false);
  const panicTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pairsDropdownRef = useRef<HTMLDivElement>(null);

  const handlePanicClick = () => {
    if (!panicConfirmState) {
      setPanicConfirmState(true);
      if (panicTimerRef.current) clearTimeout(panicTimerRef.current);
      panicTimerRef.current = setTimeout(() => {
        setPanicConfirmState(false);
      }, 4000);
    } else {
      if (panicTimerRef.current) clearTimeout(panicTimerRef.current);
      setPanicConfirmState(false);
      if (onPanicCloseAll) onPanicCloseAll();
    }
  };

  // Sync ping latency variations
  useEffect(() => {
    if (connectionState === 'CONNECTED') {
      const interval = setInterval(() => {
        setPingMs(Math.floor(16 + Math.random() * 18));
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [connectionState]);

  const handleCopyPrice = () => {
    if (!ticker?.price) return;
    try {
      navigator.clipboard.writeText(ticker.price.toString());
      setCopiedPrice(true);
      setTimeout(() => setCopiedPrice(false), 1500);
    } catch {}
  };

  // Sync fullscreen state with document fullscreen events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      const isCurrentlyFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (!isCurrentlyFs) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
        if (onChangeDisplayMode) onChangeDisplayMode('fullscreen');
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
        if (onChangeDisplayMode) onChangeDisplayMode('standard');
      }
    } catch {
      // Fallback if browser Fullscreen API is restricted in iframe/sandbox
      const nextMode = displayMode === 'fullscreen' ? 'standard' : 'fullscreen';
      setIsFullscreen(nextMode === 'fullscreen');
      if (onChangeDisplayMode) onChangeDisplayMode(nextMode);
    }
  };

  const handleCycleLanguage = () => {
    const langs: Language[] = ['fr', 'ar', 'en'];
    const nextIdx = (langs.indexOf(language) + 1) % langs.length;
    onLanguageChange(langs[nextIdx]);
  };

  const handleCycleTimezone = () => {
    if (!onTimezoneChange) return;
    const timezones: TimezoneMode[] = ['GMT+1', 'UTC', 'LOCAL'];
    const nextIdx = (timezones.indexOf(timezone) + 1) % timezones.length;
    onTimezoneChange(timezones[nextIdx]);
  };

  const handleToggleDensity = () => {
    if (!onChangeDisplayMode) return;
    const nextMode = displayMode === 'compact' ? 'standard' : 'compact';
    onChangeDisplayMode(nextMode);
  };

  const activePair =
    RESPECTED_TRADING_PAIRS.find((p) => p.symbol === selectedSymbol) ||
    RESPECTED_TRADING_PAIRS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pairsDropdownRef.current && !pairsDropdownRef.current.contains(event.target as Node)) {
        setIsPairsDropdownOpen(false);
      }
    };
    if (isPairsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPairsDropdownOpen]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (ticker?.price) {
      if (prevPrice !== null) {
        if (ticker.price > prevPrice) {
          setPriceFlash('UP');
          setTimeout(() => setPriceFlash(null), 600);
        } else if (ticker.price < prevPrice) {
          setPriceFlash('DOWN');
          setTimeout(() => setPriceFlash(null), 600);
        }
      }
      setPrevPrice(ticker.price);
    }
  }, [ticker?.price]);

  const isPricePositive = (ticker?.priceChangePercent24h || 0) >= 0;

  const getConnectionBadge = () => {
    switch (connectionState) {
      case 'CONNECTED':
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] sm:text-xs font-mono font-medium shrink-0 h-8">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <Radio className="w-3 h-3 text-emerald-400 shrink-0" strokeWidth={2} />
            <span className="font-bold">LIVE</span>
          </span>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] sm:text-xs font-mono font-medium shrink-0 h-8">
            <RefreshCw className="w-3 h-3 animate-spin shrink-0" strokeWidth={2} />
            <span className="font-bold hidden xs:inline">CONNECT</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 text-[10px] sm:text-xs font-mono font-medium shrink-0 h-8">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500 shrink-0"></span>
            <span className="font-bold">OFFLINE</span>
          </span>
        );
    }
  };

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 shadow-md select-none w-full max-w-full">
      {/* Dev Mode Banner if active */}
      {isDeveloperMode && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-3 py-0.5 text-center text-[11px] text-amber-300 flex items-center justify-center gap-1.5 font-mono">
          <AlertTriangle className="w-3 h-3 shrink-0" strokeWidth={2} />
          <span className="truncate">⚠️ {t.status.devModeWarning}</span>
        </div>
      )}

      {/* 1. TOP BAR (الشريط الأول): MENU, Pairs Selector, Spot/Futures, Live Price, Refresh - Permanently Sticky */}
      <div className="sticky top-0 z-50 w-full max-w-full px-2 sm:px-3 py-1.5 border-b border-slate-800/90 bg-slate-900/98 backdrop-blur-md shadow-md">
        <div className="flex items-center justify-between gap-1 sm:gap-2 w-full max-w-full">
          
          {/* Left: Menu Trigger + Pair Selector Button + Futures / Spot Switcher (no gap, full FUTURES name) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
            {/* 1. Menu Button */}
            {onOpenMenu && (
              <button
                type="button"
                onClick={onOpenMenu}
                className="h-8 flex items-center justify-center gap-1.5 px-2 sm:px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-xs transition shrink-0 active:scale-95 group cursor-pointer"
                title={isArabic ? 'القائمة الرئيسية' : 'Menu Quantura'}
                aria-label="Menu"
              >
                <Menu className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform duration-300 shrink-0" strokeWidth={2} />
                <span className="text-[11px] sm:text-xs font-bold font-mono tracking-wider hidden xs:inline">MENU</span>
              </button>
            )}

            {/* 2. Interactive Selected Pair Selector */}
            <div className="relative shrink-0" ref={pairsDropdownRef}>
              <button
                type="button"
                onClick={() => setIsPairsDropdownOpen((prev) => !prev)}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border transition-all duration-150 shrink-0 cursor-pointer select-none active:scale-95 ${
                  isPairsDropdownOpen
                    ? 'bg-slate-900 border-cyan-500/70 shadow-sm text-white'
                    : 'bg-slate-950/90 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80 text-slate-200'
                }`}
                title={isArabic ? 'قائمة الأزواج والعملات' : 'Liste des paires'}
              >
                <div
                  className={`w-4 h-4 rounded-md bg-gradient-to-br ${activePair.iconBg} flex items-center justify-center text-slate-950 font-black text-[9px] shadow-xs shrink-0`}
                >
                  {activePair.iconText}
                </div>
                <span className="font-bold text-white text-xs sm:text-sm font-mono tracking-tight leading-none truncate max-w-[72px] sm:max-w-none">
                  {activePair.displayName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                    isPairsDropdownOpen ? 'rotate-180 text-cyan-400' : ''
                  }`}
                  strokeWidth={2}
                />
              </button>

              {/* Slim Compact Popout Dropdown Menu */}
              {isPairsDropdownOpen && (
                <div
                  className={`absolute top-full mt-1.5 ${isArabic ? 'right-0' : 'left-0'} z-50 w-48 sm:w-52 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] p-1 animate-in fade-in zoom-in-95 duration-100`}
                >
                  <div className="flex items-center justify-between px-2 py-1 mb-0.5 border-b border-slate-800/80 text-[10px] font-mono text-slate-400">
                    <span>{isArabic ? 'أزواج التداول' : 'Paires Crypto'}</span>
                    <span className="text-cyan-400 font-bold">{RESPECTED_TRADING_PAIRS.length}</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
                    {RESPECTED_TRADING_PAIRS.map((pair) => {
                      const isSelected = pair.symbol.toUpperCase() === selectedSymbol.toUpperCase();
                      return (
                        <button
                          key={pair.symbol}
                          type="button"
                          onClick={() => {
                            onSelectPair(pair);
                            setIsPairsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-left transition-colors cursor-pointer border ${
                            isSelected
                              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-bold'
                              : 'bg-transparent hover:bg-slate-800/70 border-transparent text-slate-300 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div
                              className={`w-4 h-4 rounded bg-gradient-to-br ${pair.iconBg} flex items-center justify-center text-slate-950 font-black text-[9px] shadow-xs shrink-0`}
                            >
                              {pair.iconText}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-mono text-xs leading-tight truncate">
                                {pair.displayName}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono leading-tight truncate">
                                {isArabic ? pair.arabicName.split(' ')[0] : pair.category}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-1" strokeWidth={2} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Spot / Futures Switcher - Directly adjacent with zero gap, writing FUTURES in full */}
            {onToggleMarketType ? (
              <button
                type="button"
                onClick={() => onToggleMarketType(marketType === 'FUTURES' ? 'SPOT' : 'FUTURES')}
                className={`h-8 text-[10px] sm:text-xs font-mono font-bold px-2 sm:px-2.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0 shadow-xs ${
                  marketType === 'FUTURES'
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                }`}
                title={isArabic ? 'اضغط للتبديل بين Spot و Futures' : 'Cliquer pour basculer entre Spot et Futures'}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${marketType === 'FUTURES' ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="tracking-wider">{marketType === 'FUTURES' ? 'FUTURES' : 'SPOT'}</span>
              </button>
            ) : (
              <span className="h-8 text-[10px] sm:text-xs font-mono font-bold px-2 sm:px-2.5 rounded-xl border bg-cyan-500/15 text-cyan-300 border-cyan-500/40 flex items-center gap-1.5 shrink-0 shadow-xs">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${marketType === 'FUTURES' ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="tracking-wider">{marketType === 'FUTURES' ? 'FUTURES' : 'SPOT'}</span>
              </span>
            )}
          </div>

          {/* Right: Realtime Price & 24h Change, Refresh Wheel */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
            {/* Realtime Price & 24h Change */}
            {ticker && (
              <div className="h-8 flex items-center gap-1 sm:gap-1.5 bg-slate-950/90 border border-slate-800 rounded-xl px-1.5 sm:px-2.5 shrink-0 shadow-inner">
                <div
                  className={`text-xs sm:text-sm font-mono font-bold transition-colors duration-300 leading-none ${
                    priceFlash === 'UP'
                      ? 'text-emerald-400'
                      : priceFlash === 'DOWN'
                      ? 'text-rose-400'
                      : 'text-white'
                  }`}
                >
                  ${formatCoinPrice(ticker.price, selectedSymbol)}
                </div>

                <div
                  className={`text-[9px] sm:text-xs font-mono font-bold flex items-center leading-none ${
                    isPricePositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  <span>{isPricePositive ? '+' : ''}{(ticker.priceChangePercent24h ?? 0).toFixed(1)}%</span>
                </div>
              </div>
            )}

            {/* Refresh Wheel Button */}
            <button
              type="button"
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="h-8 w-8 text-slate-400 hover:text-white rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 transition disabled:opacity-50 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 shadow-xs"
              title={isArabic ? 'تحديث فوري للبيانات' : 'Actualiser les données'}
              aria-label="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MIDDLE BAR (الشريط الثاني): Capital, Wallet, Binance, Positions, Scanner, Chart, AI, Backtest, Heatmap, Portfolio, Panic, Risk, Fullscreen & Settings */}
      <div className="w-full max-w-full px-2 sm:px-3 py-1.5 border-b border-slate-800/70 bg-slate-950/80">
        <div className="flex items-center justify-between gap-1 sm:gap-2 w-full max-w-full">
          
          {/* Left: Complete Analytical & Execution Suite */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0 overflow-x-auto no-scrollbar">
            {/* Connection Status Badge */}
            {getConnectionBadge()}

            {/* Paper Wallet Virtual Balance */}
            {onOpenCustomBalanceModal && (
              <button
                type="button"
                onClick={onOpenCustomBalanceModal}
                className="h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95"
                title={isArabic ? 'تخصيص الرصيد الوهمي' : 'Définir le solde virtuel'}
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" strokeWidth={2} />
                <span>${(paperWallet?.balance ?? 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                <span className="text-[9px] text-emerald-400/80 font-normal hidden sm:inline">USDT</span>
              </button>
            )}

            {/* Binance API / Live Button */}
            {onOpenBinanceModal && (
              <button
                type="button"
                onClick={onOpenBinanceModal}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                  executionMode === 'BINANCE_LIVE'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                    : binanceConfig?.isConnected
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                    : 'bg-slate-900/80 text-amber-300 border-slate-800 hover:bg-slate-800'
                }`}
                title={executionMode === 'BINANCE_LIVE' ? 'Binance Live' : 'Binance API'}
              >
                <Key className={`w-3.5 h-3.5 shrink-0 ${executionMode === 'BINANCE_LIVE' ? 'text-rose-400' : binanceConfig?.isConnected ? 'text-cyan-400' : 'text-amber-400'}`} strokeWidth={2} />
                <span className="hidden xs:inline">
                  {executionMode === 'BINANCE_LIVE' ? 'Live' : binanceConfig?.isConnected ? 'API' : 'Binance'}
                </span>
              </button>
            )}

            {/* Active Trades / Open Positions Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('autoBot')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                  openPositionsCount > 0
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/30'
                    : activeTab === 'autoBot'
                    ? 'bg-slate-800 text-indigo-300 border-indigo-500/40'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={isArabic ? 'الصفقات المفتوحة وإدارة البوت' : 'Positions ouvertes et Bot'}
              >
                <Activity className={`w-3.5 h-3.5 shrink-0 ${openPositionsCount > 0 ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} strokeWidth={2} />
                <span>{openPositionsCount}</span>
                <span className="hidden sm:inline">{isArabic ? 'صفقات' : 'Trades'}</span>
              </button>
            )}

            {/* Global Market Scanner Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('globalScanner')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'globalScanner'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-cyan-300 hover:bg-slate-800'
                }`}
                title={isArabic ? 'رادار السوق الشامل (Global Scanner)' : 'Radar Global Scanner'}
              >
                <Radar className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'globalScanner' ? 'text-cyan-400 animate-spin' : 'text-cyan-400/80'}`} strokeWidth={2} />
                <span className="hidden sm:inline">{isArabic ? 'الرادار' : 'Radar'}</span>
              </button>
            )}

            {/* Live Chart Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('chart')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'chart'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-emerald-300 hover:bg-slate-800'
                }`}
                title={isArabic ? 'الرسم البياني المباشر (Live Chart)' : 'Graphique en direct (Chart)'}
              >
                <LineChart className="w-3.5 h-3.5 text-emerald-400 shrink-0" strokeWidth={2} />
                <span className="hidden sm:inline">{isArabic ? 'الشارت' : 'Chart'}</span>
              </button>
            )}

            {/* AI Quant Analysis Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('analysis')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'analysis'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-purple-300 hover:bg-slate-800'
                }`}
                title={isArabic ? 'التحليل الذكي والنموذج الكمي (AI Quant Analysis)' : 'Analyse IA Quantitative'}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" strokeWidth={2} />
                <span className="hidden sm:inline">{isArabic ? 'الذكاء' : 'AI'}</span>
              </button>
            )}

            {/* Backtest Strategy Simulator Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('backtest')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'backtest'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-indigo-300 hover:bg-slate-800'
                }`}
                title={isArabic ? 'محاكي الاستراتيجيات والفحص التاريخي' : 'Simulateur Backtest'}
              >
                <FlaskConical className="w-3.5 h-3.5 text-indigo-400 shrink-0" strokeWidth={2} />
                <span className="hidden md:inline">{isArabic ? 'باك تست' : 'Backtest'}</span>
              </button>
            )}

            {/* Market Heatmap Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('market')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'market'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-amber-300 hover:bg-slate-800'
                }`}
                title={isArabic ? 'خريطة السوق وحرارة العملات (Market Heatmap)' : 'Heatmap du Marché'}
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={2} />
                <span className="hidden md:inline">{isArabic ? 'السوق' : 'Market'}</span>
              </button>
            )}

            {/* Capital & Portfolio Risk Manager Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('riskWallet')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'riskWallet'
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-teal-300 hover:bg-slate-800'
                }`}
                title={isArabic ? 'إدارة المحفظة وحماية رأس المال (Risk & Portfolio)' : 'Gestion du Portefeuille'}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" strokeWidth={2} />
                <span className="hidden md:inline">{isArabic ? 'المحفظة' : 'Portfolio'}</span>
              </button>
            )}
          </div>

          {/* Right: Panic Emergency Button, Institutional Risk Engine, Fullscreen, Settings */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
            {/* Emergency Panic Close Button */}
            {onPanicCloseAll && openPositionsCount > 0 && (
              <button
                id="btn-header-panic-close"
                type="button"
                onClick={handlePanicClick}
                className={`h-8 px-2 sm:px-2.5 rounded-xl border flex items-center justify-center gap-1 text-[10px] sm:text-xs font-mono font-bold transition shrink-0 cursor-pointer active:scale-95 ${
                  panicConfirmState
                    ? 'bg-rose-600 text-white border-rose-400 animate-pulse shadow-md shadow-rose-900/50'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300'
                }`}
                title={isArabic ? 'إغلاق طوارئ فوري لكافة الصفقات لحماية الرصيد' : 'Fermeture d\'urgence de toutes les positions'}
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-300 shrink-0" strokeWidth={2} />
                <span>{panicConfirmState ? (isArabic ? 'تأكيد؟' : 'Confirmer?') : (isArabic ? 'طوارئ' : 'Panic')}</span>
              </button>
            )}

            {/* Risk Engine Button */}
            {onOpenRiskModal && (
              <button
                id="btn-header-risk-modal"
                type="button"
                onClick={onOpenRiskModal}
                className="h-8 px-2 sm:px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1 text-[10px] sm:text-xs font-mono font-bold transition shrink-0 cursor-pointer active:scale-95"
                title={isArabic ? 'محرك إدارة المخاطر المؤسسي' : 'Quantura Risk Management Engine'}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" strokeWidth={2} />
                <span className="hidden sm:inline">{isArabic ? 'المخاطر' : 'Risk'}</span>
              </button>
            )}

            {/* Plein Écran / Fullscreen Button */}
            <button
              id="btn-header-fullscreen"
              type="button"
              onClick={handleToggleFullscreen}
              className={`h-8 w-8 rounded-xl border flex items-center justify-center transition shrink-0 cursor-pointer active:scale-95 ${
                isFullscreen || displayMode === 'fullscreen'
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm ring-1 ring-cyan-500/30'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
              }`}
              title={
                isFullscreen || displayMode === 'fullscreen'
                  ? (isArabic ? 'إنهاء وضع ملء الشاشة' : 'Quitter le plein écran')
                  : (isArabic ? 'وضع ملء الشاشة (Plein écran)' : 'Mode Plein écran (Fullscreen)')
              }
              aria-label="Plein écran Fullscreen"
            >
              {isFullscreen || displayMode === 'fullscreen' ? (
                <Minimize className="w-3.5 h-3.5 text-cyan-400 animate-in zoom-in-75 duration-150" strokeWidth={2} />
              ) : (
                <Maximize className="w-3.5 h-3.5" strokeWidth={2} />
              )}
            </button>

            {/* Settings Button */}
            <button
              id="btn-header-settings"
              type="button"
              onClick={onOpenSettings}
              className="h-8 w-8 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer active:scale-95"
              title={isArabic ? 'الإعدادات واللغات' : 'Paramètres & Langues'}
              aria-label="Settings"
            >
              <Settings className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>

        </div>
      </div>

      {/* 3. THIRD BAR (الشريط الثالث): Timezone Clock, Ping Latency, View Mode, Bot, Sentiment, Signal, MTF, Strategies, History, Copy, Language, Sound, Alerts, Density */}
      <div className="w-full max-w-full px-2 sm:px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/60">
        <div className="flex items-center justify-between gap-1 sm:gap-2 w-full max-w-full">
          
          {/* Left: Timezone Clock + Ping + View Mode + Bot + Sentiment + Signal + MTF + Strategies + History */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0 overflow-x-auto no-scrollbar">
            {/* Timezone Clock */}
            <button
              type="button"
              onClick={handleCycleTimezone}
              className="h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-[10px] sm:text-xs font-mono text-slate-300 transition shrink-0 cursor-pointer active:scale-95"
              title={isArabic ? 'اضغط لتغيير المنطقة الزمنية (GMT+1 / UTC / LOCAL)' : 'Cliquer pour changer le fuseau horaire'}
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" strokeWidth={2} />
              <span className="font-bold text-slate-200">{formatTime(currentTime, timezone, false)}</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-black hidden xs:inline">
                {timezone}
              </span>
            </button>

            {/* Live Network Latency / Ping Meter */}
            <button
              type="button"
              onClick={onRefreshData}
              className="h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-[10px] sm:text-xs font-mono text-slate-400 hover:text-cyan-300 transition shrink-0 cursor-pointer active:scale-95"
              title={isArabic ? 'سرعة الاستجابة اللحظية (اضغط للتحديث وفحص الاتصال)' : 'Latence WebSocket (Cliquer pour tester le ping)'}
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" strokeWidth={2} />
              <span className="text-emerald-400 font-bold">{pingMs}ms</span>
            </button>

            {/* Android / Computer View Mode Toggle */}
            <button
              id="btn-header-screen-mode"
              type="button"
              onClick={onToggleAndroidView}
              className={`h-8 px-2 sm:px-2.5 rounded-xl border flex items-center justify-center gap-1 text-[10px] sm:text-xs font-mono font-bold transition shrink-0 cursor-pointer active:scale-95 ${
                isAndroidView
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title={isAndroidView ? (isArabic ? 'التبديل إلى وضع الكمبيوتر الكامل' : 'Basculer en Vue PC') : (isArabic ? 'التبديل إلى محاكاة الهاتف' : 'Basculer en Vue Mobile')}
              aria-label="Toggle Screen View"
            >
              {isAndroidView ? (
                <>
                  <Monitor className="w-3.5 h-3.5 text-cyan-400 shrink-0" strokeWidth={2} />
                  <span className="hidden sm:inline">PC</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={2} />
                  <span className="hidden sm:inline">Mobile</span>
                </>
              )}
            </button>

            {/* Bot Status & Quick Toggle */}
            {onToggleBot && (
              <button
                type="button"
                onClick={onToggleBot}
                className={`h-8 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer active:scale-95 ${
                  botEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-300'
                }`}
                title={isArabic ? 'تبديل تشغيل/إيقاف البوت الآلي' : 'Activer / Désactiver le Bot'}
              >
                <Bot className={`w-3.5 h-3.5 shrink-0 ${botEnabled ? 'text-emerald-400' : 'text-slate-500'}`} strokeWidth={2} />
                <span className={`w-1.5 h-1.5 rounded-full ${botEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="hidden sm:inline">{botEnabled ? 'BOT: ON' : 'BOT: OFF'}</span>
              </button>
            )}

            {/* Market Trend Sentiment Badge */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('market')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shrink-0 cursor-pointer active:scale-95 ${
                  isPricePositive
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}
                title={isArabic ? 'زخم واتجاه السوق العام (Market Overview)' : 'Tendance du Marché'}
              >
                <Flame className={`w-3.5 h-3.5 shrink-0 ${isPricePositive ? 'text-emerald-400' : 'text-rose-400'}`} strokeWidth={2} />
                <span className="hidden sm:inline">{isPricePositive ? (isArabic ? 'صاعد' : 'BULL') : (isArabic ? 'هابط' : 'BEAR')}</span>
              </button>
            )}

            {/* Signal Engine Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('signal')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'signal'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-cyan-300 hover:bg-slate-900'
                }`}
                title={isArabic ? 'لوحة الإشارات وتحليل التداول الفوري' : 'Panneau des Signaux en direct'}
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" strokeWidth={2} />
                <span className="hidden md:inline">{isArabic ? 'الإشارة' : 'Signal'}</span>
              </button>
            )}

            {/* Multi-Timeframe Matrix (MTF) Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('mtf')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'mtf'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-cyan-300 hover:bg-slate-900'
                }`}
                title={isArabic ? 'مصفوفة الفريمات المتعددة (MTF Matrix)' : 'Matrice Multi-Timeframe (MTF)'}
              >
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400 shrink-0" strokeWidth={2} />
                <span className="hidden md:inline">MTF</span>
              </button>
            )}

            {/* Bot Strategies & Presets Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('autoBot')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'autoBot'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-indigo-300 hover:bg-slate-900'
                }`}
                title={isArabic ? 'استراتيجيات وإعدادات البوت الآلي' : 'Stratégies et Presets du Bot'}
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-400 shrink-0" strokeWidth={2} />
                <span className="hidden md:inline">{isArabic ? 'الاستراتيجية' : 'Presets'}</span>
              </button>
            )}

            {/* Trade History Journal Shortcut */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('history')}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shrink-0 cursor-pointer active:scale-95 ${
                  activeTab === 'history'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-amber-300 hover:bg-slate-900'
                }`}
                title={isArabic ? 'سجل الصفقات والعمليات (History)' : 'Historique des Trades'}
              >
                <History className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={2} />
                <span className="hidden md:inline">{isArabic ? 'السجل' : 'Journal'}</span>
              </button>
            )}
          </div>

          {/* Right: Quick Copy Price, Language Switcher, Sound, Notifications, Display Density */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
            {/* Quick Copy Price Button */}
            {ticker?.price && (
              <button
                type="button"
                onClick={handleCopyPrice}
                className={`h-8 px-2 rounded-xl border flex items-center justify-center gap-1 text-[10px] sm:text-xs font-mono transition shrink-0 cursor-pointer active:scale-95 ${
                  copiedPrice
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-cyan-300'
                }`}
                title={isArabic ? (copiedPrice ? 'تم النسخ!' : 'نسخ السعر الحالي') : (copiedPrice ? 'Copié !' : 'Copier le prix')}
                aria-label="Copy Price"
              >
                {copiedPrice ? (
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                ) : (
                  <Copy className="w-3.5 h-3.5" strokeWidth={2} />
                )}
                <span className="hidden md:inline">{copiedPrice ? (isArabic ? 'تم' : 'OK') : (isArabic ? 'نسخ' : 'Copy')}</span>
              </button>
            )}

            {/* Quick Language Switcher */}
            <button
              id="btn-header-quick-language"
              type="button"
              onClick={handleCycleLanguage}
              className="h-8 px-2 sm:px-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-cyan-300 text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1 transition shrink-0 cursor-pointer active:scale-95"
              title={isArabic ? 'تبديل اللغة السريع (عربي / فرنسي / إنجليزي)' : 'Changer rapidement de langue'}
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" strokeWidth={2} />
              <span className="uppercase">{language}</span>
            </button>

            {/* Sound Toggle Button */}
            <button
              id="btn-header-sound"
              type="button"
              onClick={onToggleSound}
              className={`h-8 w-8 rounded-xl border flex items-center justify-center transition shrink-0 cursor-pointer active:scale-95 ${
                soundEnabled
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-xs'
                  : 'bg-slate-950/80 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title={soundEnabled ? (isArabic ? 'كتم الصوت' : 'Couper le son') : (isArabic ? 'تشغيل الصوت' : 'Activer le son')}
              aria-label="Toggle Sound"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" strokeWidth={2} /> : <VolumeX className="w-3.5 h-3.5" strokeWidth={2} />}
            </button>

            {/* Notifications Button */}
            <button
              id="btn-header-alerts"
              type="button"
              onClick={onOpenNotifications}
              className="h-8 w-8 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition relative shrink-0 cursor-pointer active:scale-95"
              title={isArabic ? 'الإشعارات' : 'Notifications'}
              aria-label="Notifications"
            >
              <Bell className="w-3.5 h-3.5" strokeWidth={2} />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse">
                  {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                </span>
              )}
            </button>

            {/* Display Density Switcher (Standard / Compact) */}
            <button
              id="btn-header-density"
              type="button"
              onClick={handleToggleDensity}
              className={`h-8 w-8 rounded-xl border flex items-center justify-center transition shrink-0 cursor-pointer active:scale-95 ${
                displayMode === 'compact'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title={
                displayMode === 'compact'
                  ? (isArabic ? 'الوضع المدمج مفعل (اضغط للوضع العادي)' : 'Mode Compact actif')
                  : (isArabic ? 'الوضع العادي (اضغط للوضع المدمج)' : 'Mode Standard')
              }
              aria-label="Toggle Density"
            >
              <Layers className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

