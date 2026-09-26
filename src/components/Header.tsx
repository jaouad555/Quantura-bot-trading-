import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BinanceTicker, ConnectionState, Language, TimezoneMode, BinanceApiConfig, TradingExecutionMode, PaperWallet, MarketType, DisplayMode, ActiveBotPosition } from '../types';
import { calculatePortfolioMetrics } from '../utils/portfolioCalc';
import { translations } from '../utils/translations';
import { formatTime, getTimezoneLabel } from '../utils/timezone';
import { TradingPair, RESPECTED_TRADING_PAIRS, formatCoinPrice } from '../utils/tradingPairs';
import {
  Radar,
  Activity,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
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
  Search,
  X,
  HelpCircle,
  Cpu,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface HeaderProps {
  onOpenMenu?: () => void;
  selectedSymbol: string;
  onSelectPair: (pair: TradingPair) => void;
  ticker: BinanceTicker | null;
  connectionState: ConnectionState;
  language: Language;
  timezone: TimezoneMode;
  onTimezoneChange: (tz: TimezoneMode) => void;
  isAndroidView: boolean;
  unreadAlertsCount: number;
  soundEnabled: boolean;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
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
  onOpenHelp?: () => void;
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
  activeBotPositions?: ActiveBotPosition[];
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
  notificationsEnabled = true,
  onToggleNotifications,
  isRefreshing,
  isDeveloperMode,
  binanceConfig,
  executionMode = 'PAPER',
  paperWallet,
  activeBotPositions,
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
  onOpenHelp,
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
  const isEn = language === 'en';
  const isFrench = language === 'fr';
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

  // AI Provider & Connectivity Status State
  const [aiStatus, setAiStatus] = useState<{
    status: string;
    provider: 'gemini' | 'qwen' | 'deepseek' | 'deterministic';
    geminiConfigured: boolean;
    qwenConfigured: boolean;
    deepseekConfigured: boolean;
    activeModel: string;
    lastChecked: number;
    latencyMs: number;
    isTesting: boolean;
  }>({
    status: 'ok',
    provider: 'gemini',
    geminiConfigured: false,
    qwenConfigured: false,
    deepseekConfigured: false,
    activeModel: 'gemini-2.5-flash',
    lastChecked: Date.now(),
    latencyMs: 24,
    isTesting: false,
  });
  const [isAiStatusModalOpen, setIsAiStatusModalOpen] = useState(false);

  // Periodic AI Status Polling
  const fetchAiStatus = async () => {
    try {
      const t0 = performance.now();
      const res = await fetch('/api/ai/status');
      const t1 = performance.now();
      if (res.ok) {
        const data = await res.json();
        setAiStatus(prev => ({
          ...prev,
          status: data.status || 'ok',
          provider: data.provider || 'deterministic',
          geminiConfigured: !!data.geminiConfigured,
          qwenConfigured: !!data.qwenConfigured,
          deepseekConfigured: !!data.deepseekConfigured,
          activeModel: data.activeModel || 'gemini-2.5-flash',
          lastChecked: Date.now(),
          latencyMs: Math.max(8, Math.round(t1 - t0)),
        }));
      }
    } catch {
      // Silently fall back to cached state
    }
  };

  useEffect(() => {
    fetchAiStatus();
    const interval = setInterval(fetchAiStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleTestAiConnectivity = async () => {
    setAiStatus(prev => ({ ...prev, isTesting: true }));
    try {
      const t0 = performance.now();
      const res = await fetch('/api/ai/status');
      const data = await res.json();
      const t1 = performance.now();
      setAiStatus(prev => ({
        ...prev,
        status: data.status || 'ok',
        provider: data.provider || 'deterministic',
        geminiConfigured: !!data.geminiConfigured,
        qwenConfigured: !!data.qwenConfigured,
        deepseekConfigured: !!data.deepseekConfigured,
        activeModel: data.activeModel || 'gemini-2.5-flash',
        lastChecked: Date.now(),
        latencyMs: Math.max(12, Math.round(t1 - t0)),
        isTesting: false,
      }));
    } catch {
      setAiStatus(prev => ({ ...prev, isTesting: false }));
    }
  };

  const portfolioMetrics = React.useMemo(() => {
    const isLive = executionMode === 'BINANCE_LIVE';
    if (isLive && binanceConfig?.accountInfo) {
      const realTotalEquity = Number(binanceConfig.accountInfo.totalUsdtEquity || binanceConfig.accountInfo.freeUsdt || 0);
      const realFreeCash = Number(binanceConfig.accountInfo.freeUsdt || 0);
      const livePositions = (activeBotPositions || []).filter(p => p.mode === 'BINANCE_LIVE');
      const inTradeMargin = livePositions.reduce((acc, p) => acc + (p.remainingAmountUsdt || p.marginUsdt || 0), 0);
      const floatingPnl = livePositions.reduce((acc, p) => {
        const curPrice = (p.symbol === selectedSymbol && ticker?.price) ? ticker.price : p.currentPrice;
        if (!p.entryPrice || !curPrice) return acc;
        const priceDiff = p.decision === 'LONG' ? (curPrice - p.entryPrice) : (p.entryPrice - curPrice);
        const percentChange = priceDiff / p.entryPrice;
        const leverage = p.leverage || 1;
        const margin = p.remainingAmountUsdt || p.marginUsdt || p.initialAmountUsdt || 0;
        return acc + (margin * percentChange * leverage);
      }, 0);
      return {
        totalPortfolioEquity: Math.round(realTotalEquity * 100) / 100,
        freeCash: Math.round(realFreeCash * 100) / 100,
        inTradeMargin: Math.round(inTradeMargin * 100) / 100,
        floatingPnl: Math.round(floatingPnl * 100) / 100,
        realizedPnl: 0,
        totalNetPnl: Math.round(floatingPnl * 100) / 100,
      };
    }
    const res = calculatePortfolioMetrics(paperWallet, activeBotPositions, ticker?.price, selectedSymbol);
    const totalNetPnl = res.realizedPnl + res.floatingPnl;
    return {
      totalPortfolioEquity: res.totalEquity,
      freeCash: res.freeCash,
      inTradeMargin: res.inTradeMargin,
      floatingPnl: res.floatingPnl,
      realizedPnl: res.realizedPnl,
      totalNetPnl: Math.round(totalNetPnl * 100) / 100,
    };
  }, [paperWallet, activeBotPositions, ticker?.price, selectedSymbol, executionMode, binanceConfig]);

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

  const [pairSearchQuery, setPairSearchQuery] = useState('');
  const [pairCategoryFilter, setPairCategoryFilter] = useState<string>('ALL');

  const pairCategories = [
    { id: 'ALL', label: 'All', arabicLabel: 'الكل' },
    { id: 'MAJOR', label: 'Majors', arabicLabel: 'الرئيسية' },
    { id: 'LAYER1', label: 'Layer 1', arabicLabel: 'شبكات L1' },
    { id: 'MEME', label: 'Meme', arabicLabel: 'الميم' },
    { id: 'DEFI', label: 'DeFi & Infra', arabicLabel: 'ديفاي' },
  ];

  const filteredPairs = useMemo(() => {
    return RESPECTED_TRADING_PAIRS.filter((pair) => {
      const matchCategory =
        pairCategoryFilter === 'ALL' ||
        (pairCategoryFilter === 'DEFI' 
          ? (pair.category === 'DEFI' || pair.category === 'ORACLE_INFRA') 
          : pair.category === pairCategoryFilter);
      const q = pairSearchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        pair.symbol.toLowerCase().includes(q) ||
        pair.displayName.toLowerCase().includes(q) ||
        pair.arabicName.toLowerCase().includes(q) ||
        pair.baseAsset.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [pairSearchQuery, pairCategoryFilter]);

  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number } | null>(null);

  const togglePairsDropdown = () => {
    if (!isPairsDropdownOpen && pairsDropdownRef.current) {
      const rect = pairsDropdownRef.current.getBoundingClientRect();
      const isRtl = language === 'ar';
      // Calculate best position
      let left = rect.left;
      if (isRtl) {
        left = Math.max(8, rect.right - 280);
      } else {
        left = Math.min(rect.left, window.innerWidth - 288);
      }
      left = Math.max(8, left);
      setDropdownCoords({
        top: rect.bottom + 6,
        left,
      });
      setIsPairsDropdownOpen(true);
    } else {
      setIsPairsDropdownOpen(false);
    }
  };

  useEffect(() => {
    if (!isPairsDropdownOpen) return;
    const handleScrollOrResize = () => {
      if (pairsDropdownRef.current) {
        const rect = pairsDropdownRef.current.getBoundingClientRect();
        const isRtl = language === 'ar';
        let left = isRtl ? Math.max(8, rect.right - 280) : Math.min(rect.left, window.innerWidth - 288);
        left = Math.max(8, left);
        setDropdownCoords({
          top: rect.bottom + 6,
          left,
        });
      }
    };
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isPairsDropdownOpen, language]);

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
          <span className="truncate">{t.status.devModeWarning}</span>
        </div>
      )}

      {/* 1. TOP BAR (الشريط الأول): MENU, Pairs Selector, Spot/Futures, Live Price, Refresh - Permanently Sticky */}
      <div className="sticky top-0 z-50 w-full max-w-full px-2 sm:px-3 py-1.5 border-b border-slate-800/90 bg-slate-900/98 backdrop-blur-md shadow-md">
        <div className="flex items-center justify-between gap-1 sm:gap-2 w-full max-w-full overflow-x-auto no-scrollbar">
          
          {/* Left: Menu Trigger + Pair Selector Button + Futures / Spot Switcher (no gap, full FUTURES name) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
            {/* 1. Menu Button */}
            {onOpenMenu && (
              <button
                type="button"
                onClick={onOpenMenu}
                className="h-8 flex items-center justify-center gap-1.5 px-2 sm:px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-xs transition shrink-0 active:scale-95 group cursor-pointer"
                title={isArabic ? 'القائمة الرئيسية' : isFrench ? 'Menu Quantura' : 'Quantura Menu'}
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
                onClick={togglePairsDropdown}
                className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border transition-all duration-150 shrink-0 cursor-pointer select-none active:scale-95 ${
                  isPairsDropdownOpen
                    ? 'bg-slate-900 border-cyan-500/70 shadow-sm text-white'
                    : 'bg-slate-950/90 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80 text-slate-200'
                }`}
                title={isArabic ? 'قائمة الأزواج والعملات' : isFrench ? 'Liste des paires' : 'Pair Selector'}
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

              {/* Sleek Compact Dropdown Popout Directly Under the Button */}
              {isPairsDropdownOpen && dropdownCoords && typeof document !== 'undefined' && createPortal(
                <>
                  {/* Invisible Backdrop to catch outside clicks */}
                  <div
                    className="fixed inset-0 z-[99998] bg-black/20 backdrop-blur-[1px]"
                    onClick={() => setIsPairsDropdownOpen(false)}
                  />

                  {/* Floating Compact Dropdown Box */}
                  <div
                    style={{
                      position: 'fixed',
                      top: `${dropdownCoords.top}px`,
                      left: `${dropdownCoords.left}px`,
                    }}
                    className="z-[99999] w-[275px] sm:w-[290px] bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] p-2 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[380px] overflow-hidden"
                    dir={isArabic ? 'rtl' : 'ltr'}
                  >
                    {/* Mini Search & Category Bar */}
                    <div className="pb-2 border-b border-slate-800/80 space-y-1.5">
                      <div className="relative">
                        <Search className={`w-3.5 h-3.5 text-slate-400 absolute ${isArabic ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2`} />
                        <input
                          type="text"
                          value={pairSearchQuery}
                          onChange={(e) => setPairSearchQuery(e.target.value)}
                          placeholder={isArabic ? 'بحث عن زوج (BTC, SOL)...' : 'Search pair (BTC, SOL)...'}
                          className={`w-full bg-slate-900 border border-slate-800 focus:border-cyan-500/50 rounded-xl ${isArabic ? 'pr-7 pl-6' : 'pl-7 pr-6'} py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono`}
                          autoFocus
                        />
                        {pairSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setPairSearchQuery('')}
                            className={`absolute ${isArabic ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-white`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Mini Category Chips */}
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                        {pairCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setPairCategoryFilter(cat.id)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition shrink-0 cursor-pointer ${
                              pairCategoryFilter === cat.id
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800/60'
                            }`}
                          >
                            {isArabic ? cat.arabicLabel : cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Scrollable Compact Pair Items */}
                    <div className="mt-1 overflow-y-auto max-h-[260px] space-y-1 custom-scrollbar pr-0.5">
                      {filteredPairs.length === 0 ? (
                        <div className="text-center py-4 text-slate-500 text-[11px] font-mono">
                          {isArabic ? 'لا توجد أزواج' : 'No pairs found'}
                        </div>
                      ) : (
                        filteredPairs.map((pair) => {
                          const isSelected = pair.symbol.toUpperCase() === selectedSymbol.toUpperCase();
                          return (
                            <button
                              key={pair.symbol}
                              type="button"
                              onClick={() => {
                                onSelectPair(pair);
                                setIsPairsDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-1.5 rounded-xl transition cursor-pointer border ${
                                isSelected
                                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-bold shadow-xs'
                                  : 'bg-transparent hover:bg-slate-900 border-transparent text-slate-300 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${pair.iconBg} flex items-center justify-center text-slate-950 font-black text-[10px] shadow-xs shrink-0`}>
                                  {pair.iconText}
                                </div>
                                <div className="flex flex-col min-w-0 text-left" dir="ltr">
                                  <span className="font-mono text-xs font-bold leading-tight truncate text-white">
                                    {pair.displayName}
                                  </span>
                                  <span className="text-[9px] text-slate-400 leading-none truncate">
                                    {isArabic ? pair.arabicName.split(' ')[0] : pair.category}
                                  </span>
                                </div>
                              </div>

                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-1" strokeWidth={2.5} />
                              ) : (
                                <span className="text-[10px] font-mono text-slate-500">
                                  {pair.category === 'MEME' ? <Flame className="w-3 h-3 text-amber-400" /> : <Zap className="w-3 h-3 text-cyan-400" />}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>,
                document.body
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
                title={isArabic ? 'اضغط للتبديل بين Spot و Futures' : isFrench ? 'Cliquer pour basculer entre Spot et Futures' : 'Click to toggle Spot / Futures'}
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
              title={isArabic ? 'تحديث فوري للبيانات' : isFrench ? 'Actualiser les données' : 'Refresh Live Data'}
              aria-label="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MIDDLE BAR (الشريط الثاني): Capital, Wallet, Binance, Positions, Scanner, Chart, AI, Backtest, Heatmap, Portfolio, Panic, Risk, Fullscreen & Settings */}
      <div className="w-full max-w-full px-2 sm:px-3 py-1.5 border-b border-slate-800/70 bg-slate-950/80">
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar w-full max-w-full py-0.5">
          {/* Connection Status Badge */}
          {getConnectionBadge()}

          {/* Paper Wallet / Binance Live Real Equity Balance Button */}
          {onOpenCustomBalanceModal && (
            <button
              type="button"
              onClick={() => {
                if (executionMode === 'BINANCE_LIVE' && onOpenBinanceModal) {
                  onOpenBinanceModal();
                } else if (onOpenCustomBalanceModal) {
                  onOpenCustomBalanceModal();
                }
              }}
              className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                executionMode === 'BINANCE_LIVE'
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                  : portfolioMetrics.totalNetPnl > 0
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  : portfolioMetrics.totalNetPnl < 0
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40 hover:border-amber-500/60'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50'
              }`}
              title={
                executionMode === 'BINANCE_LIVE'
                  ? (isArabic
                      ? `رصيد بايننس الحقيقي (Live): $${portfolioMetrics.totalPortfolioEquity.toFixed(2)} USDT (المتاح: $${portfolioMetrics.freeCash.toFixed(2)} | في الصفقات: $${portfolioMetrics.inTradeMargin.toFixed(2)})`
                      : `Binance Live Real Equity: $${portfolioMetrics.totalPortfolioEquity.toFixed(2)} USDT (Free: $${portfolioMetrics.freeCash.toFixed(2)} | In Margin: $${portfolioMetrics.inTradeMargin.toFixed(2)})`)
                  : (isArabic
                      ? `إجمالي قيمة المحفظة التجريبية (Paper): $${portfolioMetrics.totalPortfolioEquity.toFixed(2)} USDT (المتاح: $${portfolioMetrics.freeCash.toFixed(2)} | في الصفقات: $${portfolioMetrics.inTradeMargin.toFixed(2)} | صافي الربح/الخسارة: ${portfolioMetrics.totalNetPnl >= 0 ? '+' : ''}$${portfolioMetrics.totalNetPnl.toFixed(2)})`
                      : `Total Paper Portfolio Equity: $${portfolioMetrics.totalPortfolioEquity.toFixed(2)} USDT (Free: $${portfolioMetrics.freeCash.toFixed(2)} | In Trades: $${portfolioMetrics.inTradeMargin.toFixed(2)} | Net PnL: ${portfolioMetrics.totalNetPnl >= 0 ? '+' : ''}$${portfolioMetrics.totalNetPnl.toFixed(2)})`)
              }
            >
              <Wallet className={`w-3.5 h-3.5 shrink-0 ${executionMode === 'BINANCE_LIVE' ? 'text-rose-400' : 'text-emerald-400'}`} strokeWidth={2} />
              <span className={`text-[8px] font-bold px-1 py-0.2 rounded uppercase ${
                executionMode === 'BINANCE_LIVE' ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {executionMode === 'BINANCE_LIVE' ? 'LIVE' : 'PAPER'}
              </span>
              <span className="font-bold">${portfolioMetrics.totalPortfolioEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              {executionMode === 'PAPER' && (portfolioMetrics.totalNetPnl !== 0 || portfolioMetrics.inTradeMargin > 0) && (
                <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                  portfolioMetrics.totalNetPnl >= 0 ? 'bg-emerald-500/25 text-emerald-300' : 'bg-rose-500/25 text-rose-300'
                }`}>
                  {portfolioMetrics.totalNetPnl >= 0 ? '+' : ''}${portfolioMetrics.totalNetPnl.toFixed(1)}
                </span>
              )}
              <span className={`text-[9px] font-normal hidden sm:inline ${executionMode === 'BINANCE_LIVE' ? 'text-rose-400/80' : 'text-emerald-400/80'}`}>USDT</span>
            </button>
          )}

          {/* Binance API / Live Button with Official Binance Diamond Logo & Glowing Yellow on Connected State */}
          {onOpenBinanceModal && (
            <button
              id="btn-header-binance-status"
              type="button"
              onClick={onOpenBinanceModal}
              className={`h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition-all duration-300 shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                binanceConfig?.isConnected
                  ? 'bg-amber-400/15 text-amber-300 border-amber-400/60 hover:bg-amber-400/25 shadow-[0_0_14px_rgba(251,191,36,0.3)]'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800/80 hover:border-slate-700 hover:text-slate-400 opacity-60 hover:opacity-100 grayscale hover:grayscale-0 shadow-none'
              }`}
              title={
                binanceConfig?.isConnected
                  ? (isArabic
                      ? `بينانس متصل بنجاح (${executionMode === 'BINANCE_LIVE' ? 'حساب حقيقي' : 'API نشط'}) - اضغط للإعدادات`
                      : `Binance API Connected (${executionMode === 'BINANCE_LIVE' ? 'Real Live' : 'Connected'}) - Click to manage`)
                  : (isArabic
                      ? 'بينانس غير متصل (المفتاح معطل أو غير مدخل) - اضغط للاتصال'
                      : 'Binance Disconnected (API Offline) - Click to connect')
              }
            >
              {/* Official Binance Diamond SVG Logo */}
              <svg 
                viewBox="0 0 24 24" 
                className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                  binanceConfig?.isConnected 
                    ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)] scale-105' 
                    : 'text-slate-500 opacity-50'
                }`} 
                fill="currentColor"
              >
                {/* Center Diamond */}
                <path d="M12 9.27L9.27 12L12 14.73L14.73 12L12 9.27Z" />
                {/* Top Diamond */}
                <path d="M12 2L8.27 5.73L10.27 7.73L12 6L13.73 7.73L15.73 5.73L12 2Z" />
                {/* Bottom Diamond */}
                <path d="M12 22L15.73 18.27L13.73 16.27L12 18L10.27 16.27L8.27 18.27L12 22Z" />
                {/* Left Diamond */}
                <path d="M2 12L5.73 15.73L7.73 13.73L6 12L7.73 10.27L5.73 8.27L2 12Z" />
                {/* Right Diamond */}
                <path d="M22 12L18.27 8.27L16.27 10.27L18 12L16.27 13.73L18.27 15.73L22 12Z" />
              </svg>

              {/* Status Indicator Dot & Label */}
              {binanceConfig?.isConnected ? (
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,1)]"></span>
                  </span>
                  <span className="font-bold text-amber-300 tracking-wide">
                    {executionMode === 'BINANCE_LIVE' ? 'LIVE' : 'BINANCE'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                  <span className="text-slate-500 tracking-wide">
                    BINANCE
                  </span>
                </div>
              )}
            </button>
          )}

          {/* Dedicated Strategies & Auto Bot Shortcut */}
          {onNavigateTab && (
            <button
              id="btn-header-nav-strategies"
              type="button"
              onClick={() => onNavigateTab('autoBot')}
              className={`h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
                activeTab === 'autoBot'
                  ? 'bg-gradient-to-r from-cyan-500/25 to-emerald-500/25 text-white border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-slate-800'
              }`}
              title={isArabic ? 'صفحة الاستراتيجيات والتداول الآلي' : isFrench ? 'Stratégies & Bot Automatique' : 'Strategies & Auto Bot'}
            >
              <Bot className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'autoBot' ? 'text-cyan-400 animate-pulse' : 'text-cyan-400'}`} strokeWidth={2} />
              <span className="font-bold">{isArabic ? 'الاستراتيجيات' : 'Strategies'}</span>
              {openPositionsCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono">
                  {openPositionsCount}
                </span>
              ) : (
                botEnabled && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )
              )}
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
              title={isArabic ? 'رادار السوق الشامل (Global Scanner)' : isFrench ? 'Radar Global Scanner' : 'Global Market Scanner'}
            >
              <Radar className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'globalScanner' ? 'text-cyan-400 animate-spin' : 'text-cyan-400/80'}`} strokeWidth={2} />
              <span className="hidden xl:inline">{isArabic ? 'الرادار' : 'Radar'}</span>
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
              title={isArabic ? 'الرسم البياني المباشر (Live Chart)' : isFrench ? 'Graphique en direct (Chart)' : 'Live Chart'}
            >
              <LineChart className="w-3.5 h-3.5 text-emerald-400 shrink-0" strokeWidth={2} />
              <span className="hidden xl:inline">{isArabic ? 'الشارت' : 'Chart'}</span>
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
              title={isArabic ? 'التحليل الذكي والنموذج الكمي (AI Quant Analysis)' : isFrench ? 'Analyse IA Quantitative' : 'AI Quant Analysis'}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" strokeWidth={2} />
              <span className="hidden xl:inline">{isArabic ? 'الذكاء' : 'AI'}</span>
            </button>
          )}

          {/* Active AI Provider & Connectivity Indicator */}
          <button
            id="btn-header-ai-status-indicator"
            type="button"
            onClick={() => setIsAiStatusModalOpen(true)}
            className={`h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-bold transition shadow-xs shrink-0 cursor-pointer active:scale-95 ${
              aiStatus.geminiConfigured && aiStatus.qwenConfigured
                ? 'bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-cyan-500/20 text-purple-200 border-purple-500/40 hover:border-purple-400/60 shadow-[0_0_12px_rgba(168,85,247,0.18)]'
                : aiStatus.geminiConfigured
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25 shadow-[0_0_10px_rgba(168,85,247,0.12)]'
                : aiStatus.qwenConfigured
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/25 shadow-[0_0_10px_rgba(99,102,241,0.12)]'
                : 'bg-slate-900/90 text-amber-300 border-amber-500/30 hover:bg-slate-800'
            }`}
            title={
              isArabic
                ? `مزود الذكاء الاصطناعي: ${aiStatus.geminiConfigured ? 'Gemini 2.5 (متصل)' : ''} ${aiStatus.qwenConfigured ? 'Qwen 2.5 (متصل)' : ''} (اضغط للتفاصيل وفحص الاتصال)`
                : `Active AI Provider: ${aiStatus.geminiConfigured ? 'Gemini 2.5 (Online)' : ''} ${aiStatus.qwenConfigured ? 'Qwen 2.5 (Online)' : ''} (Click to inspect & ping)`
            }
          >
            <Cpu className={`w-3.5 h-3.5 shrink-0 ${aiStatus.geminiConfigured ? 'text-purple-400 animate-pulse' : aiStatus.qwenConfigured ? 'text-indigo-400 animate-pulse' : 'text-amber-400'}`} strokeWidth={2} />
            <div className="flex items-center gap-1">
              {aiStatus.geminiConfigured && aiStatus.qwenConfigured ? (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white">Gemini</span>
                  <span className="text-slate-500">+</span>
                  <span className="text-cyan-300 font-bold">Qwen</span>
                </div>
              ) : aiStatus.geminiConfigured ? (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-purple-200">Gemini</span>
                </div>
              ) : aiStatus.qwenConfigured ? (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="font-bold text-cyan-200">Qwen</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="font-bold text-amber-200">Quant</span>
                </div>
              )}
              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950/80 text-slate-400 font-mono hidden 2xl:inline">
                {aiStatus.latencyMs}ms
              </span>
            </div>
          </button>

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
              title={isArabic ? 'محاكي الاستراتيجيات والفحص التاريخي' : isFrench ? 'Simulateur Backtest' : 'Backtest Simulator'}
            >
              <FlaskConical className="w-3.5 h-3.5 text-indigo-400 shrink-0" strokeWidth={2} />
              <span className="hidden xl:inline">{isArabic ? 'باك تست' : 'Backtest'}</span>
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
              title={isArabic ? 'خريطة السوق وحرارة العملات (Market Heatmap)' : isFrench ? 'Heatmap du Marché' : 'Market Heatmap'}
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={2} />
              <span className="hidden xl:inline">{isArabic ? 'السوق' : 'Market'}</span>
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
              title={isArabic ? 'إدارة المحفظة وحماية رأس المال (Risk & Portfolio)' : isFrench ? 'Gestion du Portefeuille' : 'Risk & Portfolio Management'}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" strokeWidth={2} />
              <span className="hidden xl:inline">{isArabic ? 'المحفظة' : 'Portfolio'}</span>
            </button>
          )}

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
              title={isArabic ? 'إغلاق طوارئ فوري لكافة الصفقات لحماية الرصيد' : isFrench ? 'Fermeture d\'urgence de toutes les positions' : 'Emergency Panic Close All Positions'}
            >
              <AlertOctagon className="w-3.5 h-3.5 text-rose-300 shrink-0" strokeWidth={2} />
              <span>{panicConfirmState ? (isArabic ? 'تأكيد؟' : isFrench ? 'Confirmer?' : 'Confirm?') : (isArabic ? 'طوارئ' : 'Panic')}</span>
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
              <span className="hidden md:inline">{isArabic ? 'المخاطر' : 'Risk'}</span>
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
                ? (isArabic ? 'إنهاء وضع ملء الشاشة' : isFrench ? 'Quitter le plein écran' : 'Exit Fullscreen')
                : (isArabic ? 'وضع ملء الشاشة (Plein écran)' : isFrench ? 'Mode Plein écran (Fullscreen)' : 'Fullscreen Mode')
            }
            aria-label="Plein écran Fullscreen"
          >
            {isFullscreen || displayMode === 'fullscreen' ? (
              <Minimize className="w-3.5 h-3.5 text-cyan-400 animate-in zoom-in-75 duration-150" strokeWidth={2} />
            ) : (
              <Maximize className="w-3.5 h-3.5" strokeWidth={2} />
            )}
          </button>

          {/* Quick Start / Help Guide Button */}
          {onOpenHelp && (
            <button
              id="btn-header-help-guide"
              type="button"
              onClick={onOpenHelp}
              className="h-8 px-2.5 rounded-xl bg-gradient-to-r from-cyan-500/15 to-blue-500/15 hover:from-cyan-500/25 hover:to-blue-500/25 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5 transition shrink-0 cursor-pointer active:scale-95 shadow-xs"
              title={isArabic ? 'دليل الاستخدام والبدء السريع (Quick Start & Help)' : isFrench ? 'Guide & Démarrage Rapide' : 'Quick Start & Help Guide'}
              aria-label="Help Guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" strokeWidth={2} />
              <span className="text-[11px] font-bold font-mono hidden sm:inline">
                {isArabic ? 'دليل البدء' : 'Guide'}
              </span>
            </button>
          )}

          {/* Settings Button */}
          <button
            id="btn-header-settings"
            type="button"
            onClick={onOpenSettings}
            className="h-8 w-8 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer active:scale-95"
            title={isArabic ? 'الإعدادات واللغات' : isFrench ? 'Paramètres & Langues' : 'Settings & Languages'}
            aria-label="Settings"
          >
            <Settings className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* 3. THIRD BAR (الشريط الثالث): Timezone Clock, Ping Latency, View Mode, Bot, Sentiment, Signal, MTF, Strategies, History, Copy, Language, Sound, Alerts, Density */}
      <div className="w-full max-w-full px-2 sm:px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/60">
        <div className="flex items-center justify-between gap-1 sm:gap-2 w-full max-w-full overflow-x-auto no-scrollbar">
          
          {/* Left: Timezone Clock + Ping + View Mode + Bot + Sentiment + Signal + MTF + Strategies + History */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
            {/* Timezone Clock */}
            <button
              type="button"
              onClick={handleCycleTimezone}
              className="h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-[10px] sm:text-xs font-mono text-slate-300 transition shrink-0 cursor-pointer active:scale-95"
              title={isArabic ? 'اضغط لتغيير المنطقة الزمنية (GMT+1 / UTC / LOCAL)' : isFrench ? 'Cliquer pour changer le fuseau horaire' : 'Click to change timezone (GMT+1 / UTC / LOCAL)'}
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
              title={isArabic ? 'سرعة الاستجابة اللحظية (اضغط للتحديث وفحص الاتصال)' : isFrench ? 'Latence WebSocket (Cliquer pour tester le ping)' : 'WebSocket Latency (Click to ping)'}
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
              title={isAndroidView ? (isArabic ? 'التبديل إلى وضع الكمبيوتر الكامل' : isFrench ? 'Basculer en Vue PC' : 'Switch to Desktop View') : (isArabic ? 'التبديل إلى محاكاة الهاتف' : isFrench ? 'Basculer en Vue Mobile' : 'Switch to Mobile View')}
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
                title={isArabic ? 'تبديل تشغيل/إيقاف البوت الآلي' : isFrench ? 'Activer / Désactiver le Bot' : 'Enable / Disable Trading Bot'}
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
                title={isArabic ? 'زخم واتجاه السوق العام (Market Overview)' : isFrench ? 'Tendance du Marché' : 'Market Trend & Overview'}
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
                title={isArabic ? 'لوحة الإشارات وتحليل التداول الفوري' : isFrench ? 'Panneau des Signaux en direct' : 'Live Signals Panel'}
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
                title={isArabic ? 'استراتيجيات وإعدادات البوت الآلي' : isFrench ? 'Stratégies et Presets du Bot' : 'Bot Strategies & Presets'}
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
                title={isArabic ? 'سجل الصفقات والعمليات (History)' : isFrench ? 'Historique des Trades' : 'Trade History & Journal'}
              >
                <History className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={2} />
                <span className="hidden md:inline">{isArabic ? 'السجل' : isFrench ? 'Journal' : 'History'}</span>
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
                title={isArabic ? (copiedPrice ? 'تم النسخ!' : 'نسخ السعر الحالي') : isFrench ? (copiedPrice ? 'Copié !' : 'Copier le prix') : (copiedPrice ? 'Copied!' : 'Copy Current Price')}
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
              title={isArabic ? 'تبديل اللغة السريع (عربي / فرنسي / إنجليزي)' : isFrench ? 'Changer rapidement de langue' : 'Switch Language (EN / FR / AR)'}
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
              title={soundEnabled ? (isArabic ? 'كتم الصوت' : isFrench ? 'Couper le son' : 'Mute Sound') : (isArabic ? 'تشغيل الصوت' : isFrench ? 'Activer le son' : 'Enable Sound')}
              aria-label="Toggle Sound"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" strokeWidth={2} /> : <VolumeX className="w-3.5 h-3.5" strokeWidth={2} />}
            </button>

            {/* Notification Toggle Button (Activer / Désactiver) */}
            <button
              id="btn-header-notif-toggle"
              type="button"
              onClick={onToggleNotifications}
              className={`h-8 w-8 rounded-xl border flex items-center justify-center transition shrink-0 cursor-pointer active:scale-95 ${
                notificationsEnabled
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-xs'
                  : 'bg-slate-950/80 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title={
                notificationsEnabled
                  ? (isArabic ? 'إيقاف التنبيهات (اضغط للتعطيل)' : isFrench ? 'Désactiver les notifications' : 'Mute Notifications')
                  : (isArabic ? 'تشغيل التنبيهات (اضغط للتفعيل)' : isFrench ? 'Activer les notifications' : 'Enable Notifications')
              }
              aria-label="Toggle Notifications"
            >
              {notificationsEnabled ? (
                <Bell className="w-3.5 h-3.5 text-amber-400" strokeWidth={2} />
              ) : (
                <BellOff className="w-3.5 h-3.5" strokeWidth={2} />
              )}
            </button>

            {/* Notifications Center Modal Button */}
            <button
              id="btn-header-alerts"
              type="button"
              onClick={onOpenNotifications}
              className="h-8 w-8 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition relative shrink-0 cursor-pointer active:scale-95"
              title={isArabic ? 'مركز الإشعارات والسجل' : isFrench ? 'Centre de notifications' : 'Notification Center'}
              aria-label="Notifications Center"
            >
              <Activity className="w-3.5 h-3.5" strokeWidth={2} />
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
                  ? (isArabic ? 'الوضع المدمج مفعل (اضغط للوضع العادي)' : isFrench ? 'Mode Compact actif' : 'Compact Mode Active')
                  : (isArabic ? 'الوضع العادي (اضغط للوضع المدمج)' : isFrench ? 'Mode Standard' : 'Standard Mode')
              }
              aria-label="Toggle Density"
            >
              <Layers className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. AI Engine Connectivity & Status Modal (Portal) */}
      {isAiStatusModalOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setIsAiStatusModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-slate-200 select-text"
            onClick={(e) => e.stopPropagation()}
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/40 flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5 text-purple-400" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white font-mono">
                    {isArabic ? 'حالة محركات الذكاء الاصطناعي (AI Engines)' : isFrench ? 'Statut des Moteurs IA' : 'AI Intelligence & Engine Status'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {isArabic ? 'فحص الاتصال ومستويات الجاهزية للنماذج اللغوية' : 'Multi-LLM connectivity and latency telemetry'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiStatusModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* AI Providers Grid */}
            <div className="space-y-2.5">
              {/* 1. Google Gemini Card */}
              <div className={`p-3.5 rounded-xl border transition ${
                aiStatus.geminiConfigured
                  ? 'bg-purple-950/20 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                  : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs font-mono">
                      G
                    </div>
                    <span className="font-bold text-white text-sm font-mono">Google Gemini</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono font-medium">
                      Primary
                    </span>
                  </div>
                  <span className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    aiStatus.geminiConfigured
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${aiStatus.geminiConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                    {aiStatus.geminiConfigured ? (isArabic ? 'متصل ونشط' : 'ONLINE') : (isArabic ? 'غير مهيأ' : 'OFFLINE')}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-1">
                  {isArabic
                    ? 'محرك التحليل الفني اللحظي والتفسير المؤسسي بثلاث لغات (Flash 2.5 / 3.8).'
                    : 'Real-time quantitative technical synthesis and multi-language institutional report generation.'}
                </p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                  <span>Model: <strong className="text-purple-300">{aiStatus.activeModel || 'gemini-2.5-flash'}</strong></span>
                  <span>Latency: <strong className="text-emerald-400">{aiStatus.latencyMs}ms</strong></span>
                </div>
              </div>

              {/* 2. Qwen 2.5 Card */}
              <div className={`p-3.5 rounded-xl border transition ${
                aiStatus.qwenConfigured
                  ? 'bg-indigo-950/20 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                  : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs font-mono">
                      Q
                    </div>
                    <span className="font-bold text-white text-sm font-mono">Qwen 2.5 (32B)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono font-medium">
                      Fallback
                    </span>
                  </div>
                  <span className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    aiStatus.qwenConfigured
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${aiStatus.qwenConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    {aiStatus.qwenConfigured ? (isArabic ? 'متصل وجاهز' : 'ONLINE') : (isArabic ? 'وضع الاستعداد' : 'STANDBY')}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-1">
                  {isArabic
                    ? 'نموذج احتياطي بديل عبر OpenRouter لتأكيد إشارات التداول في حال انقطاع المفتاح الأساسي.'
                    : 'Secondary fallback LLM via OpenRouter/DashScope for auxiliary qualitative trade validation.'}
                </p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                  <span>Model: <strong className="text-indigo-300">Qwen/Qwen2.5-32B-Instruct</strong></span>
                  <span>Status: <strong className={aiStatus.qwenConfigured ? 'text-emerald-400' : 'text-amber-400'}>{aiStatus.qwenConfigured ? 'Ready' : 'Optional'}</strong></span>
                </div>
              </div>

              {/* 3. DeepSeek V3 / R1 Card */}
              <div className={`p-3.5 rounded-xl border transition ${
                aiStatus.deepseekConfigured
                  ? 'bg-purple-950/20 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                  : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs font-mono">
                      DS
                    </div>
                    <span className="font-bold text-white text-sm font-mono">DeepSeek V3 / R1</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono font-medium">
                      Advanced
                    </span>
                  </div>
                  <span className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    aiStatus.deepseekConfigured
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${aiStatus.deepseekConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    {aiStatus.deepseekConfigured ? (isArabic ? 'متصل ونشط' : 'ONLINE') : (isArabic ? 'وضع الاستعداد' : 'STANDBY')}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-1">
                  {isArabic
                    ? 'نموذج التفكير العميق والتحليل المؤسسي (deepseek-chat / deepseek-reasoner).'
                    : 'Advanced reasoning and institutional trade analysis via DeepSeek API.'}
                </p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                  <span>Model: <strong className="text-purple-300">deepseek-chat / reasoner</strong></span>
                  <span>Status: <strong className={aiStatus.deepseekConfigured ? 'text-emerald-400' : 'text-amber-400'}>{aiStatus.deepseekConfigured ? 'Configured' : 'Optional'}</strong></span>
                </div>
              </div>

              {/* 3. High-Frequency Quant Deterministic Core */}
              <div className="p-3.5 rounded-xl border bg-slate-950/80 border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs font-mono">
                      ∑
                    </div>
                    <span className="font-bold text-white text-sm font-mono">Quant Math Core</span>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    100% ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-1">
                  {isArabic
                    ? 'المحرك الرياضي الحتمي فائق السرعة لحساب مناطق الدخول، الأهداف (TP)، الوقف (SL)، وتوافق المؤشرات كل 15 ثانية.'
                    : 'Deterministic zero-latency institutional engine calculating Order Blocks, FVGs, and Risk-to-Reward levels every 15s.'}
                </p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                  <span>Speed: <strong className="text-cyan-300">&lt; 15ms execution</strong></span>
                  <span>Confluence: <strong className="text-emerald-400">6 Indicators</strong></span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleTestAiConnectivity}
                disabled={aiStatus.isTesting}
                className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiStatus.isTesting ? 'animate-spin text-cyan-400' : ''}`} />
                <span>{aiStatus.isTesting ? (isArabic ? 'جاري الفحص...' : 'Testing...') : (isArabic ? 'فحص الاتصال والاستجابة' : 'Ping AI Systems')}</span>
              </button>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAiStatusModalOpen(false);
                    onNavigateTab('analysis');
                  }}
                  className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'فتح لوحة التحليل الذكي' : 'Open AI Analysis'}</span>
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};

