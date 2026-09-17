import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TradeHistoryItem, Language } from '../types';
import { translations } from '../utils/translations';
import {
  Award,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  PieChart as PieIcon,
  Percent,
  Scale,
  Zap,
  Flame,
  ShieldAlert,
  Sparkles,
  Filter,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Search,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';

interface TradingPerformanceSummaryProps {
  history: TradeHistoryItem[];
  language: Language;
  currentPrice?: number;
  onSeedSampleData?: () => void;
}

export const TradingPerformanceSummary: React.FC<TradingPerformanceSummaryProps> = ({
  history,
  language,
  currentPrice,
  onSeedSampleData,
}) => {
  const t = translations[language] || translations.fr;
  const perf = t.performanceSummary || translations.fr.performanceSummary;
  const isArabic = language === 'ar';

  // Pair filter state
  const [selectedPairFilter, setSelectedPairFilter] = useState<string>('ALL');
  // Visual chart tab: 'ROI_GROWTH' | 'WIN_LOSS_PIE' | 'PNL_BARS' | 'DAILY_PNL' | 'ALL_GRID'
  const [activeChartTab, setActiveChartTab] = useState<'ROI_GROWTH' | 'WIN_LOSS_PIE' | 'PNL_BARS' | 'DAILY_PNL' | 'ALL_GRID'>('ALL_GRID');

  // Pair selector scrolling & dropdown states
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPairDropdownOpen, setIsPairDropdownOpen] = useState(false);
  const [pairSearchQuery, setPairSearchQuery] = useState('');
  const pairDropdownRef = useRef<HTMLDivElement>(null);

  // Close pair dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pairDropdownRef.current && !pairDropdownRef.current.contains(e.target as Node)) {
        setIsPairDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -160, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 160, behavior: 'smooth' });
    }
  };

  const handleSelectPair = (sym: string) => {
    setSelectedPairFilter(sym);
    setIsPairDropdownOpen(false);
  };

  // Filter history if specific pair selected
  const filteredHistory = useMemo(() => {
    if (selectedPairFilter === 'ALL') return history;
    return history.filter((item) => item.symbol === selectedPairFilter);
  }, [history, selectedPairFilter]);

  // Performance calculations
  const stats = useMemo(() => {
    // Only include closed trades for performance stats
    const closedList = filteredHistory.filter(t => t.status !== 'ACTIVE');
    const totalTrades = closedList.length;

    // Filter winning, losing and breakeven trades
    const winningTrades = closedList.filter((t) => t.profitPercent > 0.05);
    const losingTrades = closedList.filter((t) => t.profitPercent < -0.05);
    const breakevenTrades = closedList.filter((t) => Math.abs(t.profitPercent) <= 0.05);

    const winCount = winningTrades.length;
    const lossCount = losingTrades.length;
    const breakevenCount = breakevenTrades.length;
    const closedCount = winCount + lossCount + breakevenCount;

    const winRate = closedCount > 0 ? (winCount / closedCount) * 100 : 0;
    const lossRate = closedCount > 0 ? (lossCount / closedCount) * 100 : 0;

    const totalWinPnl = winningTrades.reduce((acc, curr) => acc + curr.profitPercent, 0);
    const totalLossPnl = losingTrades.reduce((acc, curr) => acc + Math.abs(curr.profitPercent), 0);
    const totalRoi = closedList.reduce((acc, curr) => acc + curr.profitPercent, 0);

    const avgWin = winCount > 0 ? totalWinPnl / winCount : 0;
    const avgLoss = lossCount > 0 ? totalLossPnl / lossCount : 0;
    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 10 : 1;
    const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? 99.9 : 1.0;

    // Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
    const winProb = winRate / 100;
    const lossProb = lossRate / 100;
    const expectancy = winProb * avgWin - lossProb * avgLoss;

    // Best & Worst trade
    const allPnlValues = closedList.map((t) => t.profitPercent);
    const bestTrade = allPnlValues.length > 0 ? Math.max(...allPnlValues) : 0;
    const worstTrade = allPnlValues.length > 0 ? Math.min(...allPnlValues) : 0;

    // Max consecutive winning & losing streaks
    let maxWinStreak = 0;
    let currentWinStreak = 0;
    let maxLossStreak = 0;
    let currentLossStreak = 0;

    // Sort ascending by timestamp for timeline curve
    const chronologicalList = [...closedList].sort((a, b) => a.timestamp - b.timestamp);

    chronologicalList.forEach((trade) => {
      if (trade.profitPercent > 0.05) {
        currentWinStreak += 1;
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      } else if (trade.profitPercent < -0.05) {
        currentLossStreak += 1;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      } else {
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
    });

    // Generate Recharts series data
    let runningCumulativeRoi = 0;
    let peakRoi = 0;
    let maxDrawdown = 0;

    const cumulativeGrowthData = chronologicalList.map((trade, idx) => {
      runningCumulativeRoi += trade.profitPercent;
      if (runningCumulativeRoi > peakRoi) {
        peakRoi = runningCumulativeRoi;
      }
      const dd = peakRoi - runningCumulativeRoi;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }

      const tradeDate = new Date(trade.timestamp);
      const timeLabel = tradeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dayLabel = tradeDate.toLocaleDateString([], { month: 'numeric', day: 'numeric' });

      return {
        tradeIndex: `#${idx + 1}`,
        tradeNumber: idx + 1,
        id: trade.id,
        symbol: trade.symbol || 'BTCUSDT',
        decision: trade.decision,
        pnl: Number(trade.profitPercent.toFixed(2)),
        cumulativeRoi: Number(runningCumulativeRoi.toFixed(2)),
        timeLabel: `${dayLabel} ${timeLabel}`,
        status: trade.status,
      };
    });

    // Pie chart distribution data
    const pieDistributionData = [
      {
        name: isArabic ? 'صفقات رابحة (Wins)' : 'Gains (Wins)',
        value: winCount,
        color: '#10b981', // emerald-500
        percent: winRate,
      },
      {
        name: isArabic ? 'صفقات خاسرة (Losses)' : 'Pertes (Losses)',
        value: lossCount,
        color: '#f43f5e', // rose-500
        percent: lossRate,
      },
      ...(breakevenCount > 0
        ? [
            {
              name: isArabic ? 'نقطة التعادل (Breakeven)' : 'Breakeven',
              value: breakevenCount,
              color: '#64748b', // slate-500
              percent: (breakevenCount / closedCount) * 100,
            },
          ]
        : []),
    ];

    // Bar chart distribution data
    const perTradeBarData = chronologicalList.map((trade, idx) => {
      return {
        name: `T#${idx + 1}`,
        symbol: trade.symbol || 'BTCUSDT',
        pnl: Number(trade.profitPercent.toFixed(2)),
        decision: trade.decision,
        fill: trade.profitPercent >= 0 ? '#10b981' : '#f43f5e',
      };
    });

    // Daily Realized PnL Aggregation
    const dayMap = new Map<string, { timestamp: number; netPnl: number; count: number; wins: number; losses: number }>();
    chronologicalList.forEach((trade) => {
      const d = new Date(trade.timestamp);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { timestamp: trade.timestamp, netPnl: 0, count: 0, wins: 0, losses: 0 });
      }
      const dayItem = dayMap.get(dayKey)!;
      dayItem.netPnl += trade.profitPercent;
      dayItem.count += 1;
      if (trade.profitPercent > 0.05) dayItem.wins += 1;
      else if (trade.profitPercent < -0.05) dayItem.losses += 1;
    });

    const dailyPnlBarData = Array.from(dayMap.keys()).sort().map((key) => {
      const item = dayMap.get(key)!;
      const d = new Date(item.timestamp);
      const label = d.toLocaleDateString(isArabic ? 'ar-EG' : 'fr-FR', { month: 'short', day: 'numeric' });
      return {
        dateKey: key,
        name: label,
        pnl: Number(item.netPnl.toFixed(2)),
        count: item.count,
        wins: item.wins,
        losses: item.losses,
        fill: item.netPnl >= 0 ? '#10b981' : '#f43f5e',
      };
    });

    return {
      totalTrades,
      winCount,
      lossCount,
      breakevenCount,
      closedCount,
      winRate,
      lossRate,
      totalRoi,
      avgWin,
      avgLoss,
      payoffRatio,
      profitFactor,
      expectancy,
      bestTrade,
      worstTrade,
      maxWinStreak,
      maxLossStreak,
      maxDrawdown,
      cumulativeGrowthData,
      pieDistributionData,
      perTradeBarData,
      dailyPnlBarData,
    };
  }, [filteredHistory, isArabic]);

  // Unique symbols present in history
  const availableSymbols = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => {
      if (h.symbol) set.add(h.symbol);
    });
    return Array.from(set);
  }, [history]);

  // Statistics per symbol
  const symbolStatsMap = useMemo(() => {
    const map: Record<string, { count: number; wins: number; winRate: number; totalPnl: number }> = {};
    history.forEach((h) => {
      const sym = h.symbol || 'BTCUSDT';
      if (!map[sym]) {
        map[sym] = { count: 0, wins: 0, winRate: 0, totalPnl: 0 };
      }
      map[sym].count += 1;
      map[sym].totalPnl += h.profitPercent || 0;
      if (h.profitPercent > 0.05) {
        map[sym].wins += 1;
      }
    });
    Object.keys(map).forEach((sym) => {
      map[sym].winRate = map[sym].count > 0 ? (map[sym].wins / map[sym].count) * 100 : 0;
    });
    return map;
  }, [history]);

  // Filtered symbols for search in dropdown
  const filteredAvailableSymbols = useMemo(() => {
    if (!pairSearchQuery.trim()) return availableSymbols;
    return availableSymbols.filter((sym) =>
      sym.toLowerCase().includes(pairSearchQuery.toLowerCase())
    );
  }, [availableSymbols, pairSearchQuery]);

  // Custom Tooltip for Cumulative Area Chart
  const CustomAreaTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs font-mono space-y-1.5 min-w-[170px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-brand-400 text-[10px]">
                {data.tradeIndex}
              </span>
              <span>{data.symbol}</span>
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                data.decision === 'LONG'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {data.decision}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">{isArabic ? 'ربح/خسارة الصفقة:' : 'P&L Trade:'}</span>
            <span
              className={`font-bold ${
                data.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {data.pnl >= 0 ? '+' : ''}
              {data.pnl}%
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">{isArabic ? 'العائد التراكمي:' : 'ROI Cumulé:'}</span>
            <span
              className={`font-bold ${
                data.cumulativeRoi >= 0 ? 'text-brand-400' : 'text-rose-400'
              }`}
            >
              {data.cumulativeRoi >= 0 ? '+' : ''}
              {data.cumulativeRoi}%
            </span>
          </div>

          {data.timeLabel && (
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
              {data.timeLabel}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Win/Loss Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-slate-950 border border-slate-700/80 p-2.5 rounded-xl shadow-2xl text-xs font-mono">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: data.payload.color }}
            />
            <span className="font-bold text-white">{data.name}</span>
          </div>
          <div className="mt-1 flex justify-between gap-4 text-slate-300">
            <span className="text-slate-400">{isArabic ? 'العدد:' : 'Nombre:'}</span>
            <span className="font-bold text-white">{data.value} صفقات</span>
          </div>
          <div className="flex justify-between gap-4 text-slate-300">
            <span className="text-slate-400">{isArabic ? 'النسبة:' : 'Pourcentage:'}</span>
            <span className="font-bold" style={{ color: data.payload.color }}>
              {data.payload.percent.toFixed(1)}%
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-slate-700/80 p-2.5 rounded-xl shadow-2xl text-xs font-mono space-y-1">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
            <span className="font-bold text-white">{data.name} ({data.symbol})</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                data.decision === 'LONG'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {data.decision}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4 text-slate-300 pt-0.5">
            <span className="text-slate-400">{isArabic ? 'النتيجة:' : 'Résultat:'}</span>
            <span
              className={`font-bold ${
                data.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {data.pnl >= 0 ? '+' : ''}
              {data.pnl}%
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Daily Realized PnL Bar Chart
  const CustomDailyBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-slate-700/80 p-2.5 rounded-xl shadow-2xl text-xs font-mono space-y-1">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-400" />
              {data.name}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                data.pnl >= 0
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {data.pnl >= 0 ? (isArabic ? 'يوم رابح 🟢' : 'Green Day') : (isArabic ? 'يوم خاسر 🔴' : 'Red Day')}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4 text-slate-300 pt-0.5">
            <span className="text-slate-400">{perf.netDayPnl}:</span>
            <span
              className={`font-bold ${
                data.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {data.pnl >= 0 ? '+' : ''}
              {data.pnl}%
            </span>
          </div>
          <div className="flex justify-between items-center gap-4 text-slate-400 text-[10px]">
            <span>{perf.dailyTradesCount}:</span>
            <span className="text-slate-200">
              {data.count} ({data.wins}W / {data.losses}L)
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`space-y-4 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* Top Header & Pair Filters */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-400 shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base tracking-wide flex items-center gap-2">
                  <span>{perf.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    Recharts Live
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {perf.subtitle}
              </p>
            </div>
          </div>

          {/* Quick Actions & Live sample */}
          <div className="flex items-center gap-2">
            {history.length === 0 && onSeedSampleData && (
              <button
                onClick={onSeedSampleData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-brand-500/20 to-emerald-500/20 hover:from-brand-500/30 hover:to-emerald-500/30 text-brand-300 hover:text-white rounded-xl border border-brand-500/30 transition shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>{perf.loadSample}</span>
              </button>
            )}
          </div>
        </div>

        {/* Enhanced Smooth Horizontal Scrollable Coin Bar & Dropdown */}
        {availableSymbols.length > 1 && (
          <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-2 space-y-2">
            <div className="flex items-center justify-between gap-2 px-1 text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-brand-400" />
                <span>{isArabic ? 'تصفية حسب العملة :' : 'Filtrer par paire :'}</span>
                <span className="text-[10px] font-mono text-slate-300 bg-slate-800 px-1.5 py-0.2 rounded">
                  {availableSymbols.length} {isArabic ? 'عملات' : 'paires'}
                </span>
              </span>

              {/* In-App Pair Dropdown Trigger */}
              <div className="relative" ref={pairDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsPairDropdownOpen(!isPairDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg transition"
                >
                  <span className="font-mono text-brand-400">
                    {selectedPairFilter === 'ALL'
                      ? (isArabic ? 'الكل' : 'Toutes')
                      : selectedPairFilter.replace('USDT', '')}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isPairDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Modal inside App */}
                {isPairDropdownOpen && (
                  <div className={`absolute top-full mt-1.5 ${isArabic ? 'left-0' : 'right-0'} z-50 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 space-y-2 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150`}>
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={pairSearchQuery}
                        onChange={(e) => setPairSearchQuery(e.target.value)}
                        placeholder={isArabic ? 'بحث عن عملة...' : 'Rechercher une paire...'}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
                        autoFocus
                      />
                    </div>

                    {/* Pair List */}
                    <div className="max-h-56 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
                      <button
                        type="button"
                        onClick={() => handleSelectPair('ALL')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                          selectedPairFilter === 'ALL'
                            ? 'bg-brand-500 text-slate-950 font-bold'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          <span>{perf.filterAll}</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20">
                          {history.length} trades
                        </span>
                      </button>

                      {filteredAvailableSymbols.map((sym) => {
                        const sStat = symbolStatsMap[sym];
                        return (
                          <button
                            key={sym}
                            type="button"
                            onClick={() => handleSelectPair(sym)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                              selectedPairFilter === sym
                                ? 'bg-brand-500 text-slate-950 font-bold'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {selectedPairFilter === sym && <Check className="w-3.5 h-3.5" />}
                              <span className="font-bold">{sym.replace('USDT', '')}</span>
                              <span className="text-[10px] text-slate-400">/USDT</span>
                            </span>
                            {sStat && (
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className={`font-bold ${sStat.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {sStat.totalPnl >= 0 ? '+' : ''}{sStat.totalPnl.toFixed(1)}%
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                  {sStat.count}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable Buttons Bar with Navigation Chevrons */}
            <div className="flex items-center gap-1 min-w-0">
              {/* Left Scroll Arrow */}
              <button
                type="button"
                onClick={handleScrollLeft}
                title={isArabic ? 'تمرير لليسار' : 'Défiler vers la gauche'}
                className="shrink-0 p-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Horizontal Scroll Track */}
              <div
                ref={scrollContainerRef}
                className="flex items-center gap-1.5 overflow-x-auto scroll-smooth py-1 px-1 scrollbar-thin scrollbar-thumb-slate-700 active:cursor-grabbing select-none min-w-0 flex-1 touch-pan-x"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {/* ALL Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    setSelectedPairFilter('ALL');
                    (e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition text-xs whitespace-nowrap ${
                    selectedPairFilter === 'ALL'
                      ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{perf.filterAll}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${selectedPairFilter === 'ALL' ? 'bg-black/20 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                    {history.length}
                  </span>
                </button>

                {/* Individual Pair Buttons */}
                {availableSymbols.map((sym) => {
                  const sStat = symbolStatsMap[sym];
                  const isSelected = selectedPairFilter === sym;
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={(e) => {
                        setSelectedPairFilter(sym);
                        (e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                      }}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold transition text-xs whitespace-nowrap ${
                        isSelected
                          ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                          : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <span>{sym.replace('USDT', '')}</span>
                      {sStat && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-sans ${
                          isSelected
                            ? 'bg-black/20 text-slate-950 font-bold'
                            : sStat.totalPnl >= 0
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {sStat.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right Scroll Arrow */}
              <button
                type="button"
                onClick={handleScrollRight}
                title={isArabic ? 'تمرير لليمين' : 'Défiler vers la droite'}
                className="shrink-0 p-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 4 Hero KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Win / Loss Ratio */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                <span>{perf.winLossRatio}</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {stats.winCount}W / {stats.lossCount}L
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-emerald-400">
                {stats.winRate.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {perf.winRate}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>{perf.profitFactor}:</span>
              <span className="font-mono font-bold text-white">
                {stats.profitFactor.toFixed(2)}x
              </span>
            </div>
          </div>

          {/* Card 2: Average Profit / Loss */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-brand-400" />
                <span>{perf.avgProfitLoss}</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                Payoff: {stats.payoffRatio.toFixed(2)}x
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-white flex items-center">
                <span className="text-emerald-400">+{stats.avgWin.toFixed(2)}%</span>
                <span className="text-slate-500 mx-1">/</span>
                <span className="text-rose-400">-{stats.avgLoss.toFixed(2)}%</span>
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>{perf.expectancy}:</span>
              <span
                className={`font-mono font-bold ${
                  stats.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {stats.expectancy >= 0 ? '+' : ''}
                {stats.expectancy.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Card 3: Total Cumulative ROI */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>{perf.totalRoi}</span>
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  stats.totalRoi >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {stats.totalTrades} {isArabic ? 'صفقة' : 'Trades'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-black font-mono ${
                  stats.totalRoi >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {stats.totalRoi >= 0 ? '+' : ''}
                {stats.totalRoi.toFixed(2)}%
              </span>
              <span className="text-xs text-slate-400 font-mono">Net ROI</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>{perf.bestTrade}:</span>
              <span className="font-mono font-bold text-emerald-400">
                +{stats.bestTrade.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Card 4: Consecutive Streaks & Quality */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden group hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>{perf.consecutiveWins}</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Streak: {stats.maxWinStreak} 🔥
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-amber-400">
                {stats.maxWinStreak} <span className="text-sm text-slate-400 font-sans">{isArabic ? 'انتصارات متتالية' : 'Wins'}</span>
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>{perf.worstTrade}:</span>
              <span className="font-mono font-bold text-rose-400">
                {stats.worstTrade.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Chart Tab Navigation */}
        <div className="pt-2 border-t border-slate-800/80 w-full">
          <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent py-1 touch-pan-x">
            <div className="inline-flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs min-w-max">
              <button
                onClick={() => setActiveChartTab('ALL_GRID')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap shrink-0 ${
                  activeChartTab === 'ALL_GRID'
                    ? 'bg-brand-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isArabic ? 'عرض شامل لكافة الرسوم' : 'Vue Synthétique'}</span>
              </button>

              <button
                onClick={() => setActiveChartTab('ROI_GROWTH')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap shrink-0 ${
                  activeChartTab === 'ROI_GROWTH'
                    ? 'bg-brand-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{perf.roiGrowth}</span>
              </button>

              <button
                onClick={() => setActiveChartTab('WIN_LOSS_PIE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap shrink-0 ${
                  activeChartTab === 'WIN_LOSS_PIE'
                    ? 'bg-brand-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <PieIcon className="w-3.5 h-3.5" />
                <span>{perf.winLossPie}</span>
              </button>

              <button
                onClick={() => setActiveChartTab('PNL_BARS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap shrink-0 ${
                  activeChartTab === 'PNL_BARS'
                    ? 'bg-brand-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{perf.pnlPerTrade}</span>
              </button>

              <button
                onClick={() => setActiveChartTab('DAILY_PNL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap shrink-0 ${
                  activeChartTab === 'DAILY_PNL'
                    ? 'bg-brand-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{perf.dailyPnlBars}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Visual Charts Container */}
        {stats.totalTrades === 0 ? (
          <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center mx-auto">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {isArabic ? 'لا توجد صفقات حالياً لحساب الأداء' : 'Aucune donnée de performance'}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {isArabic
                  ? 'قم بتنفيذ صفقات يدوية أو تشغيل البوت الآلي أو الضغط على الزر أدناه لتوليد عينة صفقات واقعية لرؤية الرسوم البيانية التفاعلية.'
                  : 'Exécutez des trades ou chargez un échantillon pour visualiser immédiatement les graphiques Recharts.'}
              </p>
            </div>
            {onSeedSampleData && (
              <button
                onClick={onSeedSampleData}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-brand-500 hover:bg-brand-400 text-slate-950 rounded-xl shadow-lg shadow-brand-500/20 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>{perf.loadSample}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. MAIN ROI GROWTH CHART */}
            {(activeChartTab === 'ALL_GRID' || activeChartTab === 'ROI_GROWTH') && (
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                      <span>{perf.roiGrowth}</span>
                    </h4>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-300">
                    {isArabic ? 'العائد النهائي:' : 'Rendement Total:'}{' '}
                    <span
                      className={
                        stats.totalRoi >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      {stats.totalRoi >= 0 ? '+' : ''}
                      {stats.totalRoi.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.cumulativeGrowthData}
                      margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="tradeIndex"
                        stroke="#64748b"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickLine={false}
                        axisLine={{ stroke: '#334155' }}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickLine={false}
                        axisLine={{ stroke: '#334155' }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip content={<CustomAreaTooltip />} />
                      <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                      <Area
                        type="monotone"
                        dataKey="cumulativeRoi"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#roiGradient)"
                        dot={{ r: 3, fill: '#10b981', strokeWidth: 1, stroke: '#0f172a' }}
                        activeDot={{ r: 5, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 2. DUAL ROW: WIN/LOSS PIE + PER-TRADE BAR CHART */}
            {(activeChartTab === 'ALL_GRID' ||
              activeChartTab === 'WIN_LOSS_PIE' ||
              activeChartTab === 'PNL_BARS') && (
              <div
                className={`grid grid-cols-1 ${
                  activeChartTab === 'ALL_GRID' ? 'lg:grid-cols-2' : 'grid-cols-1'
                } gap-4`}
              >
                {/* WIN/LOSS PIE CHART */}
                {(activeChartTab === 'ALL_GRID' || activeChartTab === 'WIN_LOSS_PIE') && (
                  <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PieIcon className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                          {perf.winLossPie}
                        </h4>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        Win Rate: {stats.winRate.toFixed(1)}%
                      </span>
                    </div>

                    <div className="h-56 w-full relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.pieDistributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {stats.pieDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Center Info in Donut */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-black font-mono text-white">
                          {stats.winRate.toFixed(0)}%
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                          {isArabic ? 'نسبة الربح' : 'Win Rate'}
                        </span>
                      </div>
                    </div>

                    {/* Custom Legend items */}
                    <div className="flex items-center justify-around pt-2 border-t border-slate-800/80 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-slate-300">
                          {isArabic ? 'رابحة:' : 'Wins:'} {stats.winCount} ({stats.winRate.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="text-slate-300">
                          {isArabic ? 'خاسرة:' : 'Losses:'} {stats.lossCount} ({stats.lossRate.toFixed(1)}%)
                        </span>
                      </div>
                      {stats.breakevenCount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                          <span className="text-slate-300">
                            BE: {stats.breakevenCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PER-TRADE P&L DISTRIBUTION BARS */}
                {(activeChartTab === 'ALL_GRID' || activeChartTab === 'PNL_BARS') && (
                  <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                          {perf.pnlPerTrade}
                        </h4>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        Avg: <span className="text-emerald-400">+{stats.avgWin.toFixed(1)}%</span> / <span className="text-rose-400">-{stats.avgLoss.toFixed(1)}%</span>
                      </span>
                    </div>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={stats.perTradeBarData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke="#64748b"
                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                            tickLine={false}
                            axisLine={{ stroke: '#334155' }}
                          />
                          <YAxis
                            stroke="#64748b"
                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                            tickLine={false}
                            axisLine={{ stroke: '#334155' }}
                            tickFormatter={(v) => `${v}%`}
                          />
                          <Tooltip content={<CustomBarTooltip />} />
                          <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                          <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                            {stats.perTradeBarData.map((entry, index) => (
                              <Cell key={`bar-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                      <span className="text-emerald-400 font-semibold">
                        ▲ {isArabic ? 'أعلى ربح:' : 'Max Win:'} +{stats.bestTrade.toFixed(2)}%
                      </span>
                      <span className="text-rose-400 font-semibold">
                        ▼ {isArabic ? 'أكبر خسارة:' : 'Max Loss:'} {stats.worstTrade.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. DAILY REALIZED PNL PERFORMANCE BAR CHART */}
            {activeChartTab === 'DAILY_PNL' && (
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      {perf.dailyRealizedPnlTitle}
                    </h4>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    {stats.dailyPnlBarData.length} {isArabic ? 'أيام تداول' : 'Trading Days'}
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.dailyPnlBarData}
                      margin={{ top: 10, right: 15, left: -15, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickLine={false}
                        axisLine={{ stroke: '#334155' }}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickLine={false}
                        axisLine={{ stroke: '#334155' }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip content={<CustomDailyBarTooltip />} />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        {stats.dailyPnlBarData.map((entry, index) => (
                          <Cell key={`daily-bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                  <span className="text-emerald-400 font-semibold">
                    ● {perf.greenDays}: {stats.dailyPnlBarData.filter((d) => d.pnl > 0).length}
                  </span>
                  <span className="text-rose-400 font-semibold">
                    ● {perf.redDays}: {stats.dailyPnlBarData.filter((d) => d.pnl < 0).length}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
