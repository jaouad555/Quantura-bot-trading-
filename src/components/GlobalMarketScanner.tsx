import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Radar,
  Activity,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Layers,
  BarChart2,
  Eye,
  Bot,
  Sparkles,
  CheckCircle2,
  Clock,
  Zap,
  Grid,
  Table as TableIcon,
  AlertTriangle,
  Flame,
  Maximize2,
  Volume2,
  ChevronDown,
  Check,
  Filter,
} from 'lucide-react';
import { Language, Timeframe } from '../types';
import { RESPECTED_TRADING_PAIRS, TradingPair, formatCoinPrice } from '../utils/tradingPairs';
import { SymbolState } from '../server/marketScanner';

interface GlobalMarketScannerProps {
  language: Language;
  onSelectPair: (pair: TradingPair) => void;
  onNavigateToTab: (tab: string) => void;
  selectedSymbol: string;
  botEnabled?: boolean;
}

export const GlobalMarketScanner: React.FC<GlobalMarketScannerProps> = ({
  language,
  onSelectPair,
  onNavigateToTab,
  selectedSymbol,
  botEnabled = false,
}) => {
  const isArabic = language === 'ar';

  const [scannerData, setScannerData] = useState<{
    status: string;
    lastGlobalScan: number;
    symbolStates: Record<string, SymbolState>;
    activeStrategiesCount: number;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [signalFilter, setSignalFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
  const [sortBy, setSortBy] = useState<'CHANGE' | 'VOLUME' | 'RSI' | 'CONFIDENCE' | 'SYMBOL'>('CHANGE');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [isScanningNow, setIsScanningNow] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now());
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1h');
  const [isSignalDropdownOpen, setIsSignalDropdownOpen] = useState(false);
  const signalDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (signalDropdownRef.current && !signalDropdownRef.current.contains(event.target as Node)) {
        setIsSignalDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch scanner status regularly
  const fetchScannerStatus = async () => {
    try {
      const res = await fetch('/api/scanner/status');
      if (res.ok) {
        const data = await res.json();
        setScannerData(data);
        setLastRefreshed(Date.now());
      }
    } catch (err) {
      console.warn('[SCANNER] Failed to fetch scanner status:', err);
    }
  };

  useEffect(() => {
    fetchScannerStatus();
    const interval = setInterval(fetchScannerStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // Trigger manual immediate scan
  const handleTriggerScanNow = async () => {
    if (isScanningNow) return;
    setIsScanningNow(true);
    try {
      await fetch('/api/scanner/scan-now', { method: 'POST' });
      await fetchScannerStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsScanningNow(false), 1200);
    }
  };

  // Merge known pairs with scanned state
  const pairsList = useMemo(() => {
    const states = scannerData?.symbolStates || {};

    return RESPECTED_TRADING_PAIRS.map((pair) => {
      const state = states[pair.symbol] || states[pair.symbol.toUpperCase()];
      
      const price = state?.price ?? (pair.symbol === 'BTCUSDT' ? 91000 : pair.symbol === 'ETHUSDT' ? 2600 : pair.symbol === 'SOLUSDT' ? 180 : 10);
      const change24h = state?.change24h ?? 0;
      const volume24h = state?.volume24h ?? 0;
      const high24h = state?.high24h ?? (price * 1.03);
      const low24h = state?.low24h ?? (price * 0.97);

      const rsi = state?.indicators?.rsi14 ?? state?.indicators?.rsi ?? 50;
      const macd = state?.indicators?.macd ?? { macd: 0, signal: 0, histogram: 0 };
      const atr = state?.indicators?.atr14 ?? state?.indicators?.atr ?? (price * 0.02);
      const adx = state?.indicators?.adx14 ?? state?.indicators?.adx ?? 22;
      const bollinger = state?.indicators?.bollingerBands ?? {
        upper: price * 1.04,
        middle: price,
        lower: price * 0.96,
        pb: 0.5,
        bandwidth: 0.08,
      };

      const ema20 = state?.indicators?.ema20 ?? (price * 0.99);
      const ema50 = state?.indicators?.ema50 ?? (price * 0.98);
      const ema200 = state?.indicators?.ema200 ?? (price * 0.95);

      const mtf = state?.mtfConfluence ?? {
        alignmentPercent: 65,
        bullishCount: 2,
        bearishCount: 1,
        dominantTrend: 'BULLISH',
      };

      const lastSignal = state?.lastSignal;
      const signalDirection = state?.signalDirection || (lastSignal?.includes('LONG') ? 'LONG' : lastSignal?.includes('SHORT') ? 'SHORT' : 'WAIT');
      const confidence = state?.confidence || 0;
      const strategyName = state?.strategyName || (lastSignal ? lastSignal.split(':')[0] : undefined);
      const lastAnalyzed = state?.lastAnalyzed || 0;

      return {
        pair,
        symbol: pair.symbol,
        price,
        change24h,
        volume24h,
        high24h,
        low24h,
        rsi,
        macd,
        atr,
        adx,
        bollinger,
        ema20,
        ema50,
        ema200,
        mtf,
        signalDirection,
        confidence,
        strategyName,
        lastAnalyzed,
        isSelected: selectedSymbol.toUpperCase() === pair.symbol.toUpperCase(),
      };
    });
  }, [scannerData, selectedSymbol]);

  // Summary Metrics calculations
  const summaryMetrics = useMemo(() => {
    let bullishCount = 0;
    let bearishCount = 0;
    let oversoldCount = 0;
    let overboughtCount = 0;
    let totalRsi = 0;

    let topGainer = pairsList[0];
    let topLoser = pairsList[0];

    pairsList.forEach((item) => {
      if (item.change24h > (topGainer?.change24h ?? -999)) topGainer = item;
      if (item.change24h < (topLoser?.change24h ?? 999)) topLoser = item;

      if (item.change24h >= 0 || item.signalDirection === 'LONG') bullishCount++;
      else bearishCount++;

      if (item.rsi <= 35) oversoldCount++;
      if (item.rsi >= 65) overboughtCount++;

      totalRsi += item.rsi;
    });

    const avgRsi = pairsList.length > 0 ? Math.round(totalRsi / pairsList.length) : 50;
    const bullishPercent = pairsList.length > 0 ? Math.round((bullishCount / pairsList.length) * 100) : 50;

    return {
      total: pairsList.length,
      bullishPercent,
      bearishPercent: 100 - bullishPercent,
      oversoldCount,
      overboughtCount,
      avgRsi,
      topGainer,
      topLoser,
    };
  }, [pairsList]);

  // Filter & Sort
  const filteredAndSortedPairs = useMemo(() => {
    let list = pairsList.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSym = item.symbol.toLowerCase().includes(q);
        const matchesName = item.pair.displayName.toLowerCase().includes(q);
        const matchesAr = item.pair.arabicName.toLowerCase().includes(q);
        if (!matchesSym && !matchesName && !matchesAr) return false;
      }

      // Category
      if (categoryFilter !== 'ALL' && item.pair.category !== categoryFilter) {
        return false;
      }

      // Signal Filter
      if (signalFilter === 'LONG' && item.signalDirection !== 'LONG') return false;
      if (signalFilter === 'SHORT' && item.signalDirection !== 'SHORT') return false;
      if (signalFilter === 'OVERSOLD' && item.rsi > 35) return false;
      if (signalFilter === 'OVERBOUGHT' && item.rsi < 65) return false;
      if (signalFilter === 'HIGH_ADX' && item.adx < 25) return false;

      return true;
    });

    list.sort((a, b) => {
      let valA: any = a.change24h;
      let valB: any = b.change24h;

      if (sortBy === 'CHANGE') {
        valA = a.change24h;
        valB = b.change24h;
      } else if (sortBy === 'VOLUME') {
        valA = a.volume24h;
        valB = b.volume24h;
      } else if (sortBy === 'RSI') {
        valA = a.rsi;
        valB = b.rsi;
      } else if (sortBy === 'CONFIDENCE') {
        valA = a.confidence;
        valB = b.confidence;
      } else if (sortBy === 'SYMBOL') {
        valA = a.symbol;
        valB = b.symbol;
        return sortOrder === 'ASC' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortOrder === 'ASC' ? valA - valB : valB - valA;
    });

    return list;
  }, [pairsList, searchQuery, categoryFilter, signalFilter, sortBy, sortOrder]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(col);
      setSortOrder('DESC');
    }
  };

  const handleSelectAndOpen = (pair: TradingPair, targetTab: 'chart' | 'signal' | 'autoBot') => {
    onSelectPair(pair);
    onNavigateToTab(targetTab);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Radar className={`w-6 h-6 ${isScanningNow ? 'animate-spin text-cyan-400' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {isArabic ? 'رادار ومسّاح السوق الشامل' : 'Global Market Scanner'}
                  </h1>
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE ENGINE
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  {isArabic
                    ? 'فحص ومسح خوارزمي لحظي لجميع أزواج التداول والسيولة والمؤشرات الفنية (RSI, MACD, Bollinger, ATR, ADX, MTF)'
                    : 'Real-time multi-pair algorithmic screening across crypto liquidity, momentum & technical indicators'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions & Status */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleTriggerScanNow}
              disabled={isScanningNow}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-lg cursor-pointer ${
                isScanningNow
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 cursor-wait'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-cyan-500/20 active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningNow ? 'animate-spin' : ''}`} />
              <span>{isArabic ? 'مسح فوري الآن' : 'Scan All Now'}</span>
            </button>

            <div className="bg-slate-900/80 border border-slate-800 px-3 py-2 rounded-xl flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {isArabic ? 'آخر تحديث: ' : 'Updated: '}
                <span className="text-slate-200 font-mono">
                  {new Date(lastRefreshed).toLocaleTimeString()}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Real-time KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mt-5">
          {/* Total Pairs */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">{isArabic ? 'الأزواج المراقبة' : 'Monitored Pairs'}</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-black text-white">{summaryMetrics.total}</span>
              <span className="text-[10px] text-cyan-400 font-bold">{isArabic ? 'زوج رئيسي' : 'Major Pairs'}</span>
            </div>
          </div>

          {/* Market Bias / Sentiment */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">{isArabic ? 'انحياز السوق (Bias)' : 'Market Sentiment'}</span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-sm font-black ${summaryMetrics.bullishPercent >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {summaryMetrics.bullishPercent}% {isArabic ? 'صاعد' : 'Bullish'}
              </span>
              <span className="text-[10px] text-slate-500">{summaryMetrics.bearishPercent}% Bear</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1 flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${summaryMetrics.bullishPercent}%` }} />
              <div className="bg-rose-500 h-full" style={{ width: `${summaryMetrics.bearishPercent}%` }} />
            </div>
          </div>

          {/* Top Gainer */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">{isArabic ? 'أعلى صعود 24h' : 'Top Gainer 24h'}</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold text-slate-200 truncate">{summaryMetrics.topGainer?.pair.baseAsset}</span>
              <span className="text-xs font-black text-emerald-400">
                +{summaryMetrics.topGainer?.change24h?.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Top Loser */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">{isArabic ? 'أعلى هبوط 24h' : 'Top Loser 24h'}</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold text-slate-200 truncate">{summaryMetrics.topLoser?.pair.baseAsset}</span>
              <span className="text-xs font-black text-rose-400">
                {summaryMetrics.topLoser?.change24h?.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Average RSI */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">{isArabic ? 'متوسط RSI السوق' : 'Avg Market RSI'}</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-lg font-black ${
                summaryMetrics.avgRsi > 65 ? 'text-amber-400' : summaryMetrics.avgRsi < 35 ? 'text-emerald-400' : 'text-slate-200'
              }`}>
                {summaryMetrics.avgRsi}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {summaryMetrics.oversoldCount > 0 && <span className="text-emerald-400">{summaryMetrics.oversoldCount} Oversold</span>}
              </span>
            </div>
          </div>

          {/* Active AI Strategies */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400">{isArabic ? 'استراتيجيات الفحص' : 'Active Strategies'}</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-black text-cyan-400">
                {scannerData?.activeStrategiesCount ?? 4}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                {botEnabled ? (isArabic ? 'تداول مفعل' : 'Auto Trade') : (isArabic ? 'رصد ومراقبة' : 'Monitor Only')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isArabic ? 'ابحث عن العملة (مثال: BTC, SOL, SUI)...' : 'Search symbol or name (e.g. BTC, SOL, XRP)...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters & View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Select */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              {(['ALL', 'MAJOR', 'LAYER1', 'DEFI', 'ORACLE_INFRA', 'MEME'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    categoryFilter === cat
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat === 'ALL'
                    ? (isArabic ? 'الكل' : 'All')
                    : cat === 'MAJOR'
                    ? (isArabic ? 'الرئيسية' : 'Major')
                    : cat === 'LAYER1'
                    ? 'L1'
                    : cat === 'DEFI'
                    ? 'DeFi'
                    : cat === 'ORACLE_INFRA'
                    ? 'Infra'
                    : 'Meme'}
                </button>
              ))}
            </div>

            {/* Custom In-App Signal Filter Menu (Prevents OS popups from escaping iframe) */}
            <div className="relative" ref={signalDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSignalDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-2 bg-slate-950 border ${
                  isSignalDropdownOpen ? 'border-cyan-400 ring-1 ring-cyan-400/40' : 'border-slate-800 hover:border-slate-700'
                } text-slate-200 text-xs rounded-xl px-3 py-1.5 font-bold transition shadow-sm cursor-pointer`}
              >
                {signalFilter === 'ALL' && <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                {signalFilter === 'LONG' && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                {signalFilter === 'SHORT' && <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                {signalFilter === 'OVERSOLD' && <TrendingDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {signalFilter === 'OVERBOUGHT' && <TrendingUp className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                {signalFilter === 'HIGH_ADX' && <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                <span>
                  {signalFilter === 'ALL'
                    ? (isArabic ? 'جميع الإشارات والمؤشرات' : 'All Signals')
                    : signalFilter === 'LONG'
                    ? (isArabic ? 'إشارات الشراء (LONG)' : 'LONG Signals')
                    : signalFilter === 'SHORT'
                    ? (isArabic ? 'إشارات البيع (SHORT)' : 'SHORT Signals')
                    : signalFilter === 'OVERSOLD'
                    ? (isArabic ? 'تشبع بيعي (RSI < 35)' : 'RSI Oversold')
                    : signalFilter === 'OVERBOUGHT'
                    ? (isArabic ? 'تشبع شرائي (RSI > 65)' : 'RSI Overbought')
                    : (isArabic ? 'ترند قوي (ADX > 25)' : 'Strong Trend')}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSignalDropdownOpen ? 'rotate-180 text-cyan-400' : ''}`} />
              </button>

              {isSignalDropdownOpen && (
                <div className={`absolute top-full mt-1.5 z-50 w-64 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl p-1.5 space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 ${isArabic ? 'right-0' : 'left-0'}`}>
                  {[
                    { id: 'ALL', labelAr: 'جميع الإشارات والمؤشرات', labelEn: 'All Signals & Indicators', icon: <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> },
                    { id: 'LONG', labelAr: 'إشارات الشراء فقط (LONG)', labelEn: 'LONG Signals Only', icon: <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> },
                    { id: 'SHORT', labelAr: 'إشارات البيع فقط (SHORT)', labelEn: 'SHORT Signals Only', icon: <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 shrink-0" /> },
                    { id: 'OVERSOLD', labelAr: 'تشبع بيعي (RSI < 35)', labelEn: 'RSI Oversold (<35)', icon: <TrendingDown className="w-3.5 h-3.5 text-amber-400 shrink-0" /> },
                    { id: 'OVERBOUGHT', labelAr: 'تشبع شرائي (RSI > 65)', labelEn: 'RSI Overbought (>65)', icon: <TrendingUp className="w-3.5 h-3.5 text-purple-400 shrink-0" /> },
                    { id: 'HIGH_ADX', labelAr: 'ترند قوي ملحوظ (ADX > 25)', labelEn: 'Strong Trend (ADX > 25)', icon: <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" /> },
                  ].map((opt) => {
                    const isCurrent = signalFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSignalFilter(opt.id);
                          setIsSignalDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                          isCurrent
                            ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {opt.icon}
                          <span>{isArabic ? opt.labelAr : opt.labelEn}</span>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'TABLE' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isArabic ? 'عرض الجدول المفصل' : 'Table View'}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('CARDS')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'CARDS' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isArabic ? 'عرض البطاقات والحرارة' : 'Cards / Heatmap View'}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Table or Cards View */}
      {viewMode === 'TABLE' ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800/80 select-none">
                <tr>
                  <th
                    onClick={() => toggleSort('SYMBOL')}
                    className="py-3 px-3.5 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>{isArabic ? 'الزوج / العملة' : 'Pair / Symbol'}</span>
                      {sortBy === 'SYMBOL' && <span>{sortOrder === 'ASC' ? '▲' : '▼'}</span>}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('CHANGE')}
                    className="py-3 px-3 cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      <span>{isArabic ? 'السعر والتغير' : 'Price & 24h'}</span>
                      {sortBy === 'CHANGE' && <span>{sortOrder === 'ASC' ? '▲' : '▼'}</span>}
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('RSI')}
                    className="py-3 px-3 cursor-pointer hover:text-white text-center"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>RSI (14)</span>
                      {sortBy === 'RSI' && <span>{sortOrder === 'ASC' ? '▲' : '▼'}</span>}
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">MACD (12, 26, 9)</th>
                  <th className="py-3 px-3 text-center">Bollinger Bands</th>
                  <th className="py-3 px-3 text-center">EMA Trend (20/50/200)</th>
                  <th className="py-3 px-3 text-center">ATR & Volatility</th>
                  <th className="py-3 px-3 text-center">ADX (14)</th>
                  <th className="py-3 px-3 text-center">MTF Confluence</th>
                  <th
                    onClick={() => toggleSort('CONFIDENCE')}
                    className="py-3 px-3.5 cursor-pointer hover:text-white text-center"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{isArabic ? 'إشارة الذكاء الاصطناعي' : 'Quant Signal'}</span>
                      {sortBy === 'CONFIDENCE' && <span>{sortOrder === 'ASC' ? '▲' : '▼'}</span>}
                    </div>
                  </th>
                  <th className="py-3 px-3.5 text-right">{isArabic ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {filteredAndSortedPairs.map((item) => {
                  const isLongSignal = item.signalDirection === 'LONG';
                  const isShortSignal = item.signalDirection === 'SHORT';
                  const isPositiveChange = item.change24h >= 0;

                  // RSI styling
                  const isOversold = item.rsi <= 32;
                  const isOverbought = item.rsi >= 68;

                  // MACD Bullish Crossover
                  const macdBullish = (item.macd?.histogram ?? 0) >= 0;

                  // Price vs EMA 200
                  const isAboveEma200 = item.price > item.ema200;

                  return (
                    <tr
                      key={item.symbol}
                      className={`transition hover:bg-slate-800/40 ${
                        item.isSelected ? 'bg-cyan-950/20 border-l-2 border-cyan-500' : ''
                      }`}
                    >
                      {/* Symbol & Name */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5 font-sans">
                          <div
                            className={`w-7 h-7 rounded-lg bg-gradient-to-br ${item.pair.iconBg} flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0`}
                          >
                            {item.pair.iconText}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-100">{item.pair.baseAsset}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                {item.pair.category}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">
                              {isArabic ? item.pair.arabicName : item.pair.displayName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Price & 24h Change */}
                      <td className="py-3 px-3 font-mono">
                        <div className="text-slate-100 font-bold">${formatCoinPrice(item.price, item.pair.symbol)}</div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold">
                          {isPositiveChange ? (
                            <span className="flex items-center text-emerald-400">
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                              +{item.change24h.toFixed(2)}%
                            </span>
                          ) : (
                            <span className="flex items-center text-rose-400">
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                              {item.change24h.toFixed(2)}%
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-normal">
                            Vol: ${(item.volume24h / 1_000_000).toFixed(1)}M
                          </span>
                        </div>
                      </td>

                      {/* RSI (14) */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isOversold
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : isOverbought
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {Math.round(item.rsi)}
                          </span>
                          <span className="text-[9px] text-slate-500 mt-0.5">
                            {isOversold ? 'Oversold' : isOverbought ? 'Overbought' : 'Neutral'}
                          </span>
                        </div>
                      </td>

                      {/* MACD */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`text-[11px] font-bold flex items-center gap-1 ${
                              macdBullish ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {macdBullish ? '▲ Bullish' : '▼ Bearish'}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            Hist: {(item.macd?.histogram ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </td>

                      {/* Bollinger Bands */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-[11px] text-slate-300 font-medium">
                            %B: {((item.bollinger?.pb ?? 0.5) * 100).toFixed(0)}%
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {(item.bollinger?.bandwidth ?? 0.05) < 0.04 ? (
                              <span className="inline-flex items-center gap-0.5 text-amber-400 font-bold">
                                <Zap className="w-2.5 h-2.5 text-amber-400" />
                                <span>Squeeze</span>
                              </span>
                            ) : (
                              'Normal'
                            )}
                          </span>
                        </div>
                      </td>

                      {/* EMA Trend */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isAboveEma200
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-rose-400 bg-rose-500/10'
                            }`}
                          >
                            {isAboveEma200 ? 'Above 200 EMA' : 'Below 200 EMA'}
                          </span>
                          <span className="text-[9px] text-slate-500 mt-0.5">
                            {item.ema20 > item.ema50 ? 'EMA 20 > 50' : 'EMA 20 < 50'}
                          </span>
                        </div>
                      </td>

                      {/* ATR & Volatility */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-[11px] text-slate-300 font-bold">
                            ${formatCoinPrice(item.atr, item.pair.symbol)}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {((item.atr / item.price) * 100).toFixed(1)}% Volatility
                          </span>
                        </div>
                      </td>

                      {/* ADX (14) */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`text-[11px] font-bold ${
                              item.adx >= 25 ? 'text-cyan-400' : 'text-slate-400'
                            }`}
                          >
                            {Math.round(item.adx)}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {item.adx >= 25 ? 'Strong Trend' : 'Ranging'}
                          </span>
                        </div>
                      </td>

                      {/* MTF Confluence */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-[11px] font-bold ${
                                item.mtf.dominantTrend === 'BULLISH'
                                  ? 'text-emerald-400'
                                  : item.mtf.dominantTrend === 'BEARISH'
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {item.mtf.alignmentPercent}%
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {item.mtf.dominantTrend === 'BULLISH' ? 'Bull' : 'Bear'}
                            </span>
                          </div>
                          <div className="w-12 bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full ${
                                item.mtf.dominantTrend === 'BULLISH' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                              style={{ width: `${item.mtf.alignmentPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Quant Signal */}
                      <td className="py-3 px-3.5 text-center font-sans">
                        {isLongSignal ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              LONG ({item.confidence}%)
                            </span>
                            {item.strategyName && (
                              <span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[90px]">
                                {item.strategyName}
                              </span>
                            )}
                          </div>
                        ) : isShortSignal ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40">
                              SHORT ({item.confidence}%)
                            </span>
                            {item.strategyName && (
                              <span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[90px]">
                                {item.strategyName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">WAIT / Neutral</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSelectAndOpen(item.pair, 'chart')}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                            title={isArabic ? 'فتح الشارت المباشر' : 'View Live Chart'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSelectAndOpen(item.pair, 'autoBot')}
                            className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 transition cursor-pointer"
                            title={isArabic ? 'تداول تلقائي عبر البوت' : 'Open in Auto Bot'}
                          >
                            <Bot className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards / Heatmap Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredAndSortedPairs.map((item) => {
            const isLongSignal = item.signalDirection === 'LONG';
            const isShortSignal = item.signalDirection === 'SHORT';
            const isPositiveChange = item.change24h >= 0;

            return (
              <div
                key={item.symbol}
                className={`bg-slate-900/80 border rounded-2xl p-4 transition-all duration-200 hover:border-slate-700 hover:shadow-lg flex flex-col justify-between ${
                  item.isSelected
                    ? 'border-cyan-500/60 ring-1 ring-cyan-500/40 bg-cyan-950/10'
                    : 'border-slate-800/80'
                }`}
              >
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.pair.iconBg} flex items-center justify-center text-white text-sm font-black shadow-md`}
                      >
                        {item.pair.iconText}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-100">{item.pair.baseAsset}</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
                            {item.pair.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-[150px]">
                          {isArabic ? item.pair.arabicName : item.pair.displayName}
                        </p>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-sm font-bold text-white">
                        ${formatCoinPrice(item.price, item.pair.symbol)}
                      </div>
                      <div
                        className={`text-[11px] font-bold flex items-center justify-end ${
                          isPositiveChange ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPositiveChange ? '+' : ''}
                        {item.change24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Indicator Gauges Matrix */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/60 text-center font-mono my-3">
                    {/* RSI */}
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase">RSI (14)</span>
                      <span
                        className={`text-xs font-bold ${
                          item.rsi <= 35
                            ? 'text-emerald-400'
                            : item.rsi >= 65
                            ? 'text-rose-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {Math.round(item.rsi)}
                      </span>
                    </div>

                    {/* MACD */}
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase">MACD</span>
                      <span
                        className={`text-xs font-bold ${
                          (item.macd?.histogram ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {(item.macd?.histogram ?? 0) >= 0 ? '▲ BULL' : '▼ BEAR'}
                      </span>
                    </div>

                    {/* ADX */}
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase">ADX Trend</span>
                      <span
                        className={`text-xs font-bold ${
                          item.adx >= 25 ? 'text-cyan-400' : 'text-slate-400'
                        }`}
                      >
                        {Math.round(item.adx)}
                      </span>
                    </div>
                  </div>

                  {/* MTF & Quant Signal Details */}
                  <div className="space-y-1.5 text-xs text-slate-400">
                    <div className="flex justify-between items-center text-[11px]">
                      <span>{isArabic ? 'محاذاة MTF:' : 'MTF Alignment:'}</span>
                      <span
                        className={`font-bold ${
                          item.mtf.dominantTrend === 'BULLISH' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.mtf.alignmentPercent}% ({item.mtf.dominantTrend})
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span>{isArabic ? 'إشارة البوت:' : 'Quant Signal:'}</span>
                      {isLongSignal ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                          <span>LONG ({item.confidence}%)</span>
                        </span>
                      ) : isShortSignal ? (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                          <ArrowDownRight className="w-3 h-3 text-rose-400" />
                          <span>SHORT ({item.confidence}%)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/40 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>WAIT</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => handleSelectAndOpen(item.pair, 'chart')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'الرسم البياني' : 'Live Chart'}</span>
                  </button>
                  <button
                    onClick={() => handleSelectAndOpen(item.pair, 'autoBot')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-slate-950 transition shadow-md shadow-cyan-500/20 cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'تداول بالبوت' : 'Bot Trade'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State if filter yields no pairs */}
      {filteredAndSortedPairs.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
          <Radar className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
          <h3 className="text-base font-bold text-slate-300">
            {isArabic ? 'لا توجد أزواج تطابق خيارات التصفية الحالية' : 'No pairs match the selected filters'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isArabic
              ? 'جرّب إعادة تعيين فلاتر البحث أو اختيار تصنيف آخر لإظهار العملات المتاحة.'
              : 'Try clearing your search query or adjusting your filters to see more pairs.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('ALL');
              setSignalFilter('ALL');
            }}
            className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            {isArabic ? 'إعادة ضبط الفلاتر' : 'Reset All Filters'}
          </button>
        </div>
      )}
    </div>
  );
};
