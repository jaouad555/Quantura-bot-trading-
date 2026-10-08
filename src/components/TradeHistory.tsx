import React, { useState, useMemo } from 'react';
import { TradeHistoryItem, PaperWallet, Language, TradingExecutionMode } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  LineChart,
  Line,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import {
  Award,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  Trash2,
  Search,
  History,
  Sparkles,
  Activity,
  BarChart3,
  PieChart as PieIcon,
  Calendar,
  Scale,
  Flame,
  Download,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Trophy,
  Target,
  Zap,
  Coins,
  X,
} from 'lucide-react';

interface TradeHistoryProps {
  history: TradeHistoryItem[];
  paperWallet?: PaperWallet;
  language: Language;
  currentPrice?: number;
  onClearHistory?: () => void;
  onDeleteTrade?: (id: string) => void;
  onCloseActivePosition?: (posId: string) => void;
  onSeedSampleData?: () => void;
  onFullReset?: () => void;
  executionMode?: TradingExecutionMode;
}

type AnalyticsTab = 'EQUITY_CURVE' | 'DAILY_PNL' | 'DISTRIBUTION' | 'ATTRIBUTION';
type TimePeriodFilter = 'ALL' | '24H' | '7D' | '30D';
type MarketFilter = 'ALL' | 'SPOT' | 'FUTURES';

export const TradeHistory: React.FC<TradeHistoryProps> = ({
  history,
  paperWallet,
  language,
  currentPrice,
  onClearHistory,
  onDeleteTrade,
  onCloseActivePosition,
  onSeedSampleData,
  onFullReset,
  executionMode = 'PAPER',
}) => {
  const t = translations[language] || translations.fr;
  const perf = t.performanceSummary || translations.fr.performanceSummary;
  const isArabic = language === 'ar';
  const isEn = language === 'en';
  const isLiveMode = executionMode === 'BINANCE_LIVE';

  // Unified Smart Filters (controls KPIs + Charts + Table simultaneously)
  const [selectedPair, setSelectedPair] = useState<string>('ALL');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('ALL');
  const [filterDecision, setFilterDecision] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'WIN' | 'LOSS'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<TimePeriodFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Analytics View State
  const [activeChartTab, setActiveChartTab] = useState<AnalyticsTab>('EQUITY_CURVE');
  const [metricUnit, setMetricUnit] = useState<'PERCENT' | 'USDT'>('PERCENT');
  const [showChartsPanel, setShowChartsPanel] = useState<boolean>(true);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // 1. SMART DEDUPLICATION & NORMALIZATION ENGINE
  const deduplicatedHistory = useMemo(() => {
    const seenIds = new Set<string>();
    const seenSignatures = new Set<string>();
    const result: Array<
      TradeHistoryItem & {
        computedPnlPercent: number;
        computedPnlUsdt: number;
        effectiveMarket: 'SPOT' | 'FUTURES';
        effectiveLeverage: number;
      }
    > = [];

    const nominalTradeMargin = paperWallet?.balance ? Math.max(25, paperWallet.balance * 0.1) : 100;

    // Sort so ACTIVE positions come first, then newest closed trades
    const sortedInput = [...(history || [])].sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    for (const item of sortedInput) {
      if (!item) continue;
      const rawId = item.id || `${item.symbol}-${item.timestamp}-${item.decision}`;
      // Signature prevents duplicate rows from partial/final sync echoes within a 3-second window
      const timeBucket = Math.floor((item.timestamp || 0) / 3000);
      const signature = `${item.symbol}_${item.decision}_${item.status}_${Math.round((item.entryPrice || 0) * 10000)}_${timeBucket}`;

      if (seenIds.has(rawId) || (item.status !== 'ACTIVE' && seenSignatures.has(signature))) {
        continue;
      }
      seenIds.add(rawId);
      seenSignatures.add(signature);

      const effectiveLeverage =
        item.marketType === 'SPOT' ? 1 : item.leverage && item.leverage > 1 ? item.leverage : 1;
      const effectiveMarket: 'SPOT' | 'FUTURES' =
        item.marketType || (effectiveLeverage > 1 ? 'FUTURES' : 'SPOT');

      let computedPnlPercent = Number(item.profitPercent) || 0;
      if (item.status === 'ACTIVE') {
        const liveP = item.currentPrice || currentPrice || item.entryPrice;
        if (item.entryPrice > 0 && liveP > 0 && Math.abs(computedPnlPercent) < 0.0001) {
          const isLong = item.decision === 'LONG';
          const rawDelta = ((isLong ? liveP - item.entryPrice : item.entryPrice - liveP) / item.entryPrice) * 100;
          computedPnlPercent = rawDelta * effectiveLeverage;
        }
      }

      const rawUsdt =
        typeof item.profitUsdt === 'number'
          ? item.profitUsdt
          : typeof item.pnlUsdt === 'number'
          ? item.pnlUsdt
          : (nominalTradeMargin * computedPnlPercent) / 100;

      result.push({
        ...item,
        id: rawId,
        computedPnlPercent: Math.round(computedPnlPercent * 100) / 100,
        computedPnlUsdt: Math.round(rawUsdt * 100) / 100,
        effectiveMarket,
        effectiveLeverage,
      });
    }

    return result;
  }, [history, currentPrice, paperWallet?.balance]);

  // Available symbols with per-pair mini stats for the smart pair bar
  const pairSummaryList = useMemo(() => {
    const map = new Map<string, { count: number; netPct: number; netUsdt: number; wins: number; closed: number }>();
    deduplicatedHistory.forEach((item) => {
      const sym = item.symbol || 'BTCUSDT';
      if (!map.has(sym)) {
        map.set(sym, { count: 0, netPct: 0, netUsdt: 0, wins: 0, closed: 0 });
      }
      const entry = map.get(sym)!;
      entry.count += 1;
      if (item.status !== 'ACTIVE') {
        entry.closed += 1;
        entry.netPct += item.computedPnlPercent;
        entry.netUsdt += item.computedPnlUsdt;
        if (item.computedPnlPercent > 0.05) entry.wins += 1;
      }
    });
    return Array.from(map.entries())
      .map(([symbol, data]) => ({
        symbol,
        ...data,
        winRate: data.closed > 0 ? (data.wins / data.closed) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [deduplicatedHistory]);

  // 2. UNIFIED FILTERED DATASET (Applies to KPIs, Charts, AND Table)
  const filteredItems = useMemo(() => {
    const now = Date.now();
    const cutoffMs =
      periodFilter === '24H'
        ? now - 24 * 3600 * 1000
        : periodFilter === '7D'
        ? now - 7 * 24 * 3600 * 1000
        : periodFilter === '30D'
        ? now - 30 * 24 * 3600 * 1000
        : 0;

    return deduplicatedHistory.filter((item) => {
      if (selectedPair !== 'ALL' && item.symbol !== selectedPair) return false;
      if (marketFilter !== 'ALL' && item.effectiveMarket !== marketFilter) return false;
      if (filterDecision !== 'ALL' && item.decision !== filterDecision) return false;
      if (cutoffMs > 0 && item.timestamp < cutoffMs) return false;

      if (filterStatus === 'ACTIVE' && item.status !== 'ACTIVE') return false;
      if (filterStatus === 'WIN' && (item.status === 'ACTIVE' || item.computedPnlPercent <= 0.05)) return false;
      if (filterStatus === 'LOSS' && (item.status === 'ACTIVE' || item.computedPnlPercent >= -0.05)) return false;

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const inSym = (item.symbol || '').toLowerCase().includes(q);
        const inStrat = (item.strategyName || '').toLowerCase().includes(q);
        const inReason = (item.reason || '').toLowerCase().includes(q);
        if (!inSym && !inStrat && !inReason) return false;
      }

      return true;
    });
  }, [deduplicatedHistory, selectedPair, marketFilter, filterDecision, filterStatus, periodFilter, searchTerm]);

  // 3. UNIFIED QUANTITATIVE ANALYTICS & CHART DATA
  const analytics = useMemo(() => {
    const activeList = filteredItems.filter((t) => t.status === 'ACTIVE');
    const closedList = filteredItems.filter((t) => t.status !== 'ACTIVE');

    const winningTrades = closedList.filter((t) => t.computedPnlPercent > 0.05);
    const losingTrades = closedList.filter((t) => t.computedPnlPercent < -0.05);
    const breakevenTrades = closedList.filter((t) => Math.abs(t.computedPnlPercent) <= 0.05);

    const winCount = winningTrades.length;
    const lossCount = losingTrades.length;
    const breakevenCount = breakevenTrades.length;
    const closedCount = closedList.length;

    const winRate = closedCount > 0 ? (winCount / closedCount) * 100 : 0;
    const lossRate = closedCount > 0 ? (lossCount / closedCount) * 100 : 0;

    const grossWinPct = winningTrades.reduce((acc, c) => acc + c.computedPnlPercent, 0);
    const grossLossPct = losingTrades.reduce((acc, c) => acc + Math.abs(c.computedPnlPercent), 0);
    const netRoiPct = closedList.reduce((acc, c) => acc + c.computedPnlPercent, 0);

    const grossWinUsdt = winningTrades.reduce((acc, c) => acc + Math.max(0, c.computedPnlUsdt), 0);
    const grossLossUsdt = losingTrades.reduce((acc, c) => acc + Math.abs(Math.min(0, c.computedPnlUsdt)), 0);
    const netRealizedUsdt = closedList.reduce((acc, c) => acc + c.computedPnlUsdt, 0);
    const floatingActiveUsdt = activeList.reduce((acc, c) => acc + c.computedPnlUsdt, 0);

    const avgWinPct = winCount > 0 ? grossWinPct / winCount : 0;
    const avgLossPct = lossCount > 0 ? grossLossPct / lossCount : 0;
    const payoffRatio = avgLossPct > 0 ? avgWinPct / avgLossPct : avgWinPct > 0 ? 10 : 1;
    const profitFactor = grossLossPct > 0 ? grossWinPct / grossLossPct : grossWinPct > 0 ? 99.9 : 1.0;

    const expectancyPct = (winRate / 100) * avgWinPct - (lossRate / 100) * avgLossPct;

    const allPctValues = closedList.map((t) => t.computedPnlPercent);
    const bestTradePct = allPctValues.length > 0 ? Math.max(...allPctValues) : 0;
    const worstTradePct = allPctValues.length > 0 ? Math.min(...allPctValues) : 0;

    // Chronological ascending list for curves & streaks
    const chronological = [...closedList].sort((a, b) => a.timestamp - b.timestamp);

    let maxWinStreak = 0;
    let curWinStreak = 0;
    let runningCumPct = 0;
    let runningCumUsdt = 0;
    let peakPct = 0;
    let maxDrawdownPct = 0;

    const equityCurveData = chronological.map((trade, idx) => {
      if (trade.computedPnlPercent > 0.05) {
        curWinStreak += 1;
        if (curWinStreak > maxWinStreak) maxWinStreak = curWinStreak;
      } else if (trade.computedPnlPercent < -0.05) {
        curWinStreak = 0;
      }

      runningCumPct = Math.round((runningCumPct + trade.computedPnlPercent) * 100) / 100;
      runningCumUsdt = Math.round((runningCumUsdt + trade.computedPnlUsdt) * 100) / 100;

      if (runningCumPct > peakPct) peakPct = runningCumPct;
      const dd = peakPct - runningCumPct;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;

      const d = new Date(trade.timestamp);
      const timeLabel = `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;

      return {
        tradeIndex: `#${idx + 1}`,
        symbol: trade.symbol || 'BTCUSDT',
        decision: trade.decision,
        pnlPct: trade.computedPnlPercent,
        pnlUsdt: trade.computedPnlUsdt,
        cumulativePct: runningCumPct,
        cumulativeUsdt: runningCumUsdt,
        timeLabel,
        fill: trade.computedPnlPercent >= 0 ? '#10b981' : '#f43f5e',
      };
    });

    // Daily Aggregation (Replaces the separate DailyRealizedPnLChart duplicate component)
    const dayMap = new Map<
      string,
      { timestamp: number; netPct: number; netUsdt: number; count: number; wins: number; losses: number }
    >();
    chronological.forEach((trade) => {
      const d = new Date(trade.timestamp);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
        2,
        '0'
      )}`;
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { timestamp: trade.timestamp, netPct: 0, netUsdt: 0, count: 0, wins: 0, losses: 0 });
      }
      const entry = dayMap.get(dayKey)!;
      entry.netPct = Math.round((entry.netPct + trade.computedPnlPercent) * 100) / 100;
      entry.netUsdt = Math.round((entry.netUsdt + trade.computedPnlUsdt) * 100) / 100;
      entry.count += 1;
      if (trade.computedPnlPercent > 0.05) entry.wins += 1;
      else if (trade.computedPnlPercent < -0.05) entry.losses += 1;
    });

    const dailyPnlData = Array.from(dayMap.keys())
      .sort()
      .map((key) => {
        const item = dayMap.get(key)!;
        const d = new Date(item.timestamp);
        const label = d.toLocaleDateString(isArabic ? 'ar-EG' : isEn ? 'en-US' : 'fr-FR', {
          month: 'short',
          day: 'numeric',
        });
        return {
          dateKey: key,
          name: label,
          pnlPct: item.netPct,
          pnlUsdt: item.netUsdt,
          count: item.count,
          wins: item.wins,
          losses: item.losses,
          fill: item.netPct >= 0 ? '#10b981' : '#f43f5e',
        };
      });

    const greenDays = dailyPnlData.filter((d) => d.pnlPct > 0).length;
    const redDays = dailyPnlData.filter((d) => d.pnlPct < 0).length;

    // Strategy Attribution Matrix
    const stratMap = new Map<
      string,
      { name: string; count: number; wins: number; netPct: number; netUsdt: number }
    >();
    closedList.forEach((trade) => {
      const sName = trade.strategyName || (isArabic ? 'إشارة الذكاء الكمي' : 'Quant AI Signal');
      if (!stratMap.has(sName)) {
        stratMap.set(sName, { name: sName, count: 0, wins: 0, netPct: 0, netUsdt: 0 });
      }
      const st = stratMap.get(sName)!;
      st.count += 1;
      st.netPct = Math.round((st.netPct + trade.computedPnlPercent) * 100) / 100;
      st.netUsdt = Math.round((st.netUsdt + trade.computedPnlUsdt) * 100) / 100;
      if (trade.computedPnlPercent > 0.05) st.wins += 1;
    });

    const strategyAttribution = Array.from(stratMap.values())
      .map((s) => ({
        ...s,
        winRate: s.count > 0 ? (s.wins / s.count) * 100 : 0,
      }))
      .sort((a, b) => b.netPct - a.netPct);

    // Pie distribution
    const pieData = [
      {
        name: isArabic ? 'صفقات رابحة (Wins)' : isEn ? 'Winning Trades' : 'Trades Gagnants',
        value: winCount,
        color: '#10b981',
        percent: winRate,
      },
      {
        name: isArabic ? 'صفقات خاسرة (Losses)' : isEn ? 'Losing Trades' : 'Trades Perdants',
        value: lossCount,
        color: '#f43f5e',
        percent: lossRate,
      },
      ...(breakevenCount > 0
        ? [
            {
              name: isArabic ? 'تعادل (Breakeven)' : 'Breakeven',
              value: breakevenCount,
              color: '#64748b',
              percent: closedCount > 0 ? (breakevenCount / closedCount) * 100 : 0,
            },
          ]
        : []),
    ];

    return {
      activeCount: activeList.length,
      closedCount,
      winCount,
      lossCount,
      breakevenCount,
      winRate,
      lossRate,
      netRoiPct,
      netRealizedUsdt,
      floatingActiveUsdt,
       grossWinUsdt,
      grossLossUsdt,
      avgWinPct,
      avgLossPct,
      payoffRatio,
      profitFactor,
      expectancyPct,
      bestTradePct,
      worstTradePct,
      maxWinStreak,
      maxDrawdownPct,
      equityCurveData,
      dailyPnlData,
      greenDays,
      redDays,
      strategyAttribution,
      pieData,
    };
  }, [filteredItems, isArabic, isEn]);

  // CSV Export Handler
  const handleExportCsv = () => {
    if (filteredItems.length === 0) return;
    const headers = [
      'Date',
      'Symbol',
      'Market',
      'Leverage',
      'Side',
      'EntryPrice',
      'ExitOrCurrentPrice',
      'TP1',
      'TP2',
      'StopLoss',
      'Status',
      'PnL_Percent',
      'PnL_USDT',
      'Strategy',
      'Reason',
    ];
    const rows = filteredItems.map((item) => [
      new Date(item.timestamp).toISOString(),
      item.symbol,
      item.effectiveMarket,
      `${item.effectiveLeverage}x`,
      item.decision,
      item.entryPrice,
      item.exitPrice || item.currentPrice || item.entryPrice,
      item.tp1,
      item.tp2 || '',
      item.stopLoss,
      item.status,
      item.computedPnlPercent.toFixed(2),
      item.computedPnlUsdt.toFixed(2),
      `"${(item.strategyName || '').replace(/"/g, '""')}"`,
      `"${(item.reason || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `quantura_signals_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters =
    selectedPair !== 'ALL' ||
    marketFilter !== 'ALL' ||
    filterDecision !== 'ALL' ||
    filterStatus !== 'ALL' ||
    periodFilter !== 'ALL' ||
    searchTerm.trim() !== '';

  const resetAllFilters = () => {
    setSelectedPair('ALL');
    setMarketFilter('ALL');
    setFilterDecision('ALL');
    setFilterStatus('ALL');
    setPeriodFilter('ALL');
    setSearchTerm('');
  };

  return (
    <div className={`space-y-5 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* =====================================================================
          1. UNIFIED COMMAND HEADER & GLOBAL SMART FILTER BAR
         ===================================================================== */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shadow-sm">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-white text-base tracking-tight">
                  {isArabic
                    ? 'السجل الذكي للإشارات وتحليل الأداء'
                    : isEn
                    ? 'Smart Signal History & Performance Hub'
                    : 'Historique Intelligent des Signaux & Performance'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {filteredItems.length} / {deduplicatedHistory.length}{' '}
                  {isArabic ? 'إشارة' : isEn ? 'Signals' : 'Signaux'}
                </span>
                {analytics.activeCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {analytics.activeCount} {isArabic ? 'نشطة' : isEn ? 'Active' : 'En cours'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isArabic
                  ? 'مركز موحد لتتبع الإشارات، الأرباح المحققة، منحنى السيولة، وأداء الاستراتيجيات بدون أي تكرار'
                  : isEn
                  ? 'Unified command center for signal audit, realized P&L, equity curve, and strategy attribution'
                  : 'Centre unifié d\'audit des signaux, P&L réalisé, courbe d\'équité et attribution par stratégie sans doublons.'}
              </p>
            </div>
          </div>

          {/* Global Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Unit Switcher (% vs USDT) */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setMetricUnit('PERCENT')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  metricUnit === 'PERCENT'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                % ROI
              </button>
              <button
                type="button"
                onClick={() => setMetricUnit('USDT')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  metricUnit === 'USDT'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                $ USDT
              </button>
            </div>

            {/* Toggle Charts Visibility */}
            <button
              type="button"
              onClick={() => setShowChartsPanel(!showChartsPanel)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition cursor-pointer"
              title={isArabic ? 'إظهار/إخفاء الرسوم البيانية' : 'Afficher/Masquer les graphiques'}
            >
              {showChartsPanel ? <EyeOff className="w-3.5 h-3.5 text-cyan-400" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
              <span className="hidden sm:inline">
                {showChartsPanel
                  ? isArabic
                    ? 'إخفاء الرسوم'
                    : 'Masquer Graphiques'
                  : isArabic
                  ? 'إظهار الرسوم'
                  : 'Afficher Graphiques'}
              </span>
            </button>

            {/* Export CSV */}
            {filteredItems.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition cursor-pointer"
                title={isArabic ? 'تصدير السجل بصيغة CSV' : 'Exporter en CSV'}
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            )}

            {/* Seed Sample Data if Empty */}
            {deduplicatedHistory.length === 0 && onSeedSampleData && (
              <button
                type="button"
                onClick={onSeedSampleData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 text-cyan-300 hover:text-white rounded-xl border border-cyan-500/30 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>{perf.loadSample}</span>
              </button>
            )}

            {/* Clear Closed History */}
            {onClearHistory && deduplicatedHistory.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-xl border border-slate-700 hover:border-rose-500/30 transition cursor-pointer"
                title={isArabic ? 'مسح سجل الصفقات المغلقة' : 'Effacer l\'historique'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isArabic ? 'مسح السجل' : 'Effacer'}</span>
              </button>
            )}

            {/* Full Reset */}
            {onFullReset && (
              <button
                type="button"
                onClick={onFullReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-rose-600/30 text-slate-300 hover:text-rose-200 rounded-xl border border-slate-700 hover:border-rose-500/40 transition cursor-pointer"
                title={
                  isArabic
                    ? 'إعادة ضبط شاملة (1000$) مع حفظ مفاتيح API'
                    : 'Réinitialisation complète ($1,000)'
                }
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isArabic ? 'ضبط المصنع (1000$)' : 'Reset ($1,000)'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Unified Multi-Dimensional Filter Controls */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
          {/* Left: Pair Quick Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 xl:pb-0">
            <button
              type="button"
              onClick={() => setSelectedPair('ALL')}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                selectedPair === 'ALL'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{isArabic ? 'كل الأزواج' : isEn ? 'All Pairs' : 'Toutes Paires'}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded ${
                  selectedPair === 'ALL' ? 'bg-black/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {deduplicatedHistory.length}
              </span>
            </button>

            {pairSummaryList.map((p) => {
              const isSelected = selectedPair === p.symbol;
              return (
                <button
                  key={p.symbol}
                  type="button"
                  onClick={() => setSelectedPair(isSelected ? 'ALL' : p.symbol)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/20'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{p.symbol.replace('USDT', '')}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded ${
                      isSelected
                        ? 'bg-black/20 text-slate-950 font-black'
                        : p.netPct > 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : p.netPct < 0
                        ? 'bg-rose-500/15 text-rose-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Market, Side, Status, Period & Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative flex-1 sm:flex-initial min-w-[150px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isArabic ? 'بحث بالعملة أو الاستراتيجية...' : 'Symbole, stratégie...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-full sm:w-44 font-mono"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Market Filter (Spot vs Futures) */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-[11px] font-mono">
              {(['ALL', 'SPOT', 'FUTURES'] as MarketFilter[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMarketFilter(m)}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    marketFilter === m
                      ? m === 'SPOT'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : m === 'FUTURES'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m === 'ALL' ? (isArabic ? 'الكل' : 'Tous') : m === 'SPOT' ? '🪙 Spot' : '⚡ Fut'}
                </button>
              ))}
            </div>

            {/* Side Filter (LONG / SHORT) */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-[11px] font-mono">
              {(['ALL', 'LONG', 'SHORT'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setFilterDecision(dir)}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    filterDecision === dir
                      ? dir === 'LONG'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : dir === 'SHORT'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {dir}
                </button>
              ))}
            </div>

            {/* Outcome / Status Filter */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-[11px] font-mono">
              {(
                [
                  { id: 'ALL', label: isArabic ? 'الكل' : 'Tous', activeClass: 'bg-slate-800 text-white' },
                  { id: 'ACTIVE', label: isArabic ? 'جارية' : 'En cours', activeClass: 'bg-cyan-500/20 text-cyan-400' },
                  { id: 'WIN', label: isArabic ? 'رابحة' : 'Gains', activeClass: 'bg-emerald-500/20 text-emerald-400' },
                  { id: 'LOSS', label: isArabic ? 'خاسرة' : 'Pertes', activeClass: 'bg-rose-500/20 text-rose-400' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setFilterStatus(st.id)}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    filterStatus === st.id ? st.activeClass : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Period Filter */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-[11px] font-mono">
              {(['ALL', '24H', '7D', '30D'] as TimePeriodFilter[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodFilter(p)}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    periodFilter === p ? 'bg-slate-800 text-cyan-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p === 'ALL' ? (isArabic ? 'كل الوقت' : 'Tout') : p}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-mono font-bold transition cursor-pointer"
              >
                {isArabic ? 'إلغاء الفلاتر ✕' : 'Reset Filtres ✕'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. UNIFIED 4-CARD SMART KPI STRIP (ZERO DUPLICATION)
         ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Net Realized P&L & Cumulative ROI */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden hover:border-slate-700 transition shadow-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span>{isArabic ? 'صافي الربح المحقق والعائد' : 'P&L Net Réalisé & ROI'}</span>
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                analytics.netRoiPct >= 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {analytics.netRoiPct >= 0 ? '+' : ''}
              {analytics.netRoiPct.toFixed(2)}% ROI
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black font-mono ${
                analytics.netRealizedUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {analytics.netRealizedUsdt >= 0 ? '+' : ''}$
              {analytics.netRealizedUsdt.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-xs text-slate-400 font-mono">USDT</span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>
              {isArabic ? 'أفضل صفقة:' : 'Meilleur Trade:'}{' '}
              <strong className="text-emerald-400">+{analytics.bestTradePct.toFixed(2)}%</strong>
            </span>
            {analytics.activeCount > 0 && (
              <span className={analytics.floatingActiveUsdt >= 0 ? 'text-cyan-400' : 'text-rose-400'}>
                Live: {analytics.floatingActiveUsdt >= 0 ? '+' : ''}${analytics.floatingActiveUsdt.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: Win Rate & Distribution Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden hover:border-slate-700 transition shadow-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Award className={`w-4 h-4 ${analytics.winRate >= 50 ? 'text-emerald-400' : analytics.winRate >= 40 ? 'text-amber-400' : 'text-rose-400'}`} />
              <span>{isArabic ? 'نسبة الصفقات الرابحة (Win Rate)' : 'Taux de Trades Gagnants (Win Rate)'}</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
              {analytics.winCount}W / {analytics.lossCount}L
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${analytics.winRate >= 50 ? 'text-emerald-400' : analytics.winRate >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
              {analytics.winRate.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({analytics.closedCount} {isArabic ? 'مغلقة' : 'clôturés'})
            </span>
          </div>
          {/* Visual Win/Loss Progress Bar */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${analytics.closedCount > 0 ? analytics.winRate : 50}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${analytics.closedCount > 0 ? analytics.lossRate : 50}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span className="text-emerald-400">
                {analytics.greenDays} {isArabic ? 'أيام رابحة' : 'Jours Verts'}
              </span>
              <span className="text-rose-400">
                {analytics.redDays} {isArabic ? 'أيام خاسرة' : 'Jours Rouges'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Profit Factor & Mathematical Expectancy */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden hover:border-slate-700 transition shadow-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-purple-400" />
              <span>{isArabic ? 'معامل الربح والتوقع الرياضي' : 'Profit Factor & Espérance'}</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
              Payoff: {analytics.payoffRatio.toFixed(2)}x
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black font-mono ${
                analytics.profitFactor >= 1.2 ? 'text-emerald-400' : analytics.profitFactor >= 1 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {analytics.profitFactor.toFixed(2)}x
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Exp: {analytics.expectancyPct >= 0 ? '+' : ''}
              {analytics.expectancyPct.toFixed(2)}%
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="text-emerald-400">Avg W: +{analytics.avgWinPct.toFixed(2)}%</span>
            <span className="text-rose-400">Avg L: -{analytics.avgLossPct.toFixed(2)}%</span>
          </div>
        </div>

        {/* KPI 4: Drawdown, Streak & Smart Quant Diagnostic */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 relative overflow-hidden hover:border-slate-700 transition shadow-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>{isArabic ? 'أقصى تراجع والتشخيص الذكي' : 'Drawdown & Diagnostic IA'}</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Streak: {analytics.maxWinStreak}W
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-400">
              -{analytics.maxDrawdownPct.toFixed(2)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">Max DD</span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">{isArabic ? 'التقييم:' : 'Statut:'}</span>
            <span
              className={`font-bold ${
                analytics.profitFactor >= 1.5 && analytics.winRate >= 55
                  ? 'text-emerald-400'
                  : analytics.closedCount === 0
                  ? 'text-slate-400'
                  : 'text-amber-400'
              }`}
            >
              {analytics.closedCount === 0
                ? isArabic
                  ? 'بانتظار إغلاق الصفقات'
                  : 'En attente de clôtures'
                : analytics.profitFactor >= 1.5 && analytics.winRate >= 55
                ? isArabic
                  ? '🟢 أداء كمي ممتاز'
                  : '🟢 Edge Quantitatif Fort'
                : isArabic
                ? '🟡 أداء متوازن'
                : '🟡 Risque Modéré'}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. UNIFIED VISUAL ANALYTICS HUB (TABBED — NO STACKED DUPLICATE CHARTS)
         ===================================================================== */}
      {showChartsPanel && analytics.closedCount > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            {/* Segmented Tab Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveChartTab('EQUITY_CURVE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeChartTab === 'EQUITY_CURVE'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{isArabic ? 'منحنى النمو التراكمي' : 'Courbe d\'Équité & ROI'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('DAILY_PNL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeChartTab === 'DAILY_PNL'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{isArabic ? 'الأرباح اليومية المحققة' : 'P&L Journalier'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('DISTRIBUTION')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeChartTab === 'DISTRIBUTION'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PieIcon className="w-3.5 h-3.5" />
                <span>{isArabic ? 'توزيع الصفقات والنسب' : 'Distribution & Ratios'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveChartTab('ATTRIBUTION')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeChartTab === 'ATTRIBUTION'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>{isArabic ? 'أداء العملات والاستراتيجيات' : 'Top Paires & Stratégies'}</span>
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
              <span>
                {isArabic ? 'إجمالي الأرباح:' : 'Gain Brut:'}{' '}
                <strong className="text-emerald-400">+${analytics.grossWinUsdt.toFixed(2)}</strong>
              </span>
              <span>
                {isArabic ? 'إجمالي الخسائر:' : 'Perte Brute:'}{' '}
                <strong className="text-rose-400">-${analytics.grossLossUsdt.toFixed(2)}</strong>
              </span>
            </div>
          </div>

          {/* TAB 1: EQUITY CURVE */}
          {activeChartTab === 'EQUITY_CURVE' && (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.equityCurveData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="smartEquityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="tradeIndex"
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    tickFormatter={(v) => (metricUnit === 'USDT' ? `$${v}` : `${v}%`)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs font-mono space-y-1">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
                            <span className="font-bold text-white">
                              {d.tradeIndex} • {d.symbol}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                d.decision === 'LONG'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {d.decision}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Trade P&L:</span>
                            <span className={d.pnlPct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {d.pnlPct >= 0 ? '+' : ''}
                              {d.pnlPct}% ({d.pnlUsdt >= 0 ? '+' : ''}${d.pnlUsdt})
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Cumulé:</span>
                            <span className="text-cyan-400 font-bold">
                              {d.cumulativePct >= 0 ? '+' : ''}
                              {d.cumulativePct}% (${d.cumulativeUsdt})
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 pt-0.5">{d.timeLabel}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey={metricUnit === 'USDT' ? 'cumulativeUsdt' : 'cumulativePct'}
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#smartEquityGrad)"
                    dot={{ r: 3, fill: '#06b6d4', strokeWidth: 1, stroke: '#0f172a' }}
                    activeDot={{ r: 5, fill: '#22d3ee', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* TAB 2: DAILY REALIZED PNL (Replaces separate duplicate DailyRealizedPnLChart) */}
          {activeChartTab === 'DAILY_PNL' && (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.dailyPnlData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    tickFormatter={(v) => (metricUnit === 'USDT' ? `$${v}` : `${v}%`)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs font-mono space-y-1">
                          <div className="font-bold text-white border-b border-slate-800 pb-1">{d.name}</div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Net Jour:</span>
                            <span className={d.pnlPct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {d.pnlPct >= 0 ? '+' : ''}
                              {d.pnlPct}% ({d.pnlUsdt >= 0 ? '+' : ''}${d.pnlUsdt})
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Trades: {d.count} ({d.wins}W / {d.losses}L)
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                  <Bar
                    dataKey={metricUnit === 'USDT' ? 'pnlUsdt' : 'pnlPct'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={44}
                  >
                    {analytics.dailyPnlData.map((entry, index) => (
                      <Cell key={`day-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* TAB 3: DISTRIBUTION & WIN/LOSS DONUT */}
          {activeChartTab === 'DISTRIBUTION' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-56 w-full relative flex items-center justify-center bg-slate-950/50 rounded-xl border border-slate-800/80 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {analytics.pieData.map((entry, index) => (
                        <Cell key={`pie-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black font-mono text-white">{analytics.winRate.toFixed(0)}%</span>
                  <span className="text-[10px] text-emerald-400 font-mono uppercase">Win Rate</span>
                </div>
              </div>

              <div className="h-56 w-full bg-slate-950/50 rounded-xl border border-slate-800/80 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.equityCurveData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="tradeIndex" stroke="#64748b" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      tickFormatter={(v) => (metricUnit === 'USDT' ? `$${v}` : `${v}%`)}
                    />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Bar dataKey={metricUnit === 'USDT' ? 'pnlUsdt' : 'pnlPct'} radius={[3, 3, 0, 0]}>
                      {analytics.equityCurveData.map((entry, idx) => (
                        <Cell key={`tbar-${idx}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TAB 4: SMART ATTRIBUTION MATRIX (Pairs & Strategies Leaderboard) */}
          {activeChartTab === 'ATTRIBUTION' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Pairs */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <h4 className="text-xs font-bold text-cyan-300 font-mono uppercase flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'أداء الأزواج المتداولة' : 'Performance par Paire'}</span>
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {pairSummaryList.map((p) => (
                    <div
                      key={p.symbol}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{p.symbol}</span>
                        <span className="text-[10px] text-slate-400">({p.count} trades)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-300">{p.winRate.toFixed(0)}% WR</span>
                        <span className={`font-bold ${p.netPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {p.netPct >= 0 ? '+' : ''}
                          {p.netPct.toFixed(2)}% ({p.netUsdt >= 0 ? '+' : ''}${p.netUsdt.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Strategies */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <h4 className="text-xs font-bold text-purple-300 font-mono uppercase flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'أداء الاستراتيجيات الخوارزمية' : 'Performance par Stratégie'}</span>
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {analytics.strategyAttribution.map((st) => (
                    <div
                      key={st.name}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[180px]">
                        <span className="font-bold text-white truncate" title={st.name}>
                          {st.name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">({st.count})</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-slate-300">{st.winRate.toFixed(0)}% WR</span>
                        <span className={`font-bold ${st.netPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {st.netPct >= 0 ? '+' : ''}
                          {st.netPct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. SMART SIGNAL & TRADE JOURNAL TABLE (WITH EXPANDABLE AUDIT ROW)
         ===================================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-cyan-400 border border-slate-700 flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">
                {deduplicatedHistory.length === 0
                  ? isArabic
                    ? 'لا توجد إشارات أو صفقات مسجلة حتى الآن'
                    : 'Aucun signal ou trade enregistré pour le moment'
                  : isArabic
                  ? 'لا توجد إشارات مطابقة للفلاتر المحددة'
                  : 'Aucun signal ne correspond aux filtres sélectionnés'}
              </p>
              <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
                {deduplicatedHistory.length === 0
                  ? isArabic
                    ? 'شغّل البوت الآلي أو افتح صفقة جديدة أو قم بتوليد عينة إشارات لتجربة التحليل الذكي.'
                    : 'Activez le bot automatique, exécutez un ordre ou chargez un échantillon pour démarrer.'
                  : isArabic
                  ? 'جرّب إعادة ضبط الفلاتر لعرض كافة الإشارات المسجلة.'
                  : 'Réinitialisez les filtres ci-dessus pour afficher tous les signaux.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  {isArabic ? 'إعادة ضبط الفلاتر' : 'Réinitialiser les filtres'}
                </button>
              )}
              {deduplicatedHistory.length === 0 && onSeedSampleData && (
                <button
                  type="button"
                  onClick={onSeedSampleData}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{perf.loadSample}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="pb-3 pl-2">{isArabic ? 'التوقيت' : 'Date / Heure'}</th>
                  <th className="pb-3">{isArabic ? 'الزوج والسوق' : 'Paire & Marché'}</th>
                  <th className="pb-3">{isArabic ? 'الإشارة والثقة' : 'Signal & Conf.'}</th>
                  <th className="pb-3">{isArabic ? 'الدخول ← الخروج/الحالي' : 'Entrée → Sortie'}</th>
                  <th className="pb-3">{isArabic ? 'الأهداف والوقف' : 'Cibles (SL / TP)'}</th>
                  <th className="pb-3">{isArabic ? 'الحالة' : 'Statut'}</th>
                  <th className="pb-3 text-center">{isArabic ? 'المسار' : 'Courbe'}</th>
                  <th className="pb-3 text-right pr-2">{isArabic ? 'صافي الربح (% / $)' : 'P&L Net (% / $)'}</th>
                  <th className="pb-3 text-center w-16">{isArabic ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <AnimatePresence initial={false}>
                  {filteredItems.map((item) => {
                    const isExpanded = expandedRowId === item.id;
                    const exitOrCurrent = item.exitPrice || item.currentPrice || item.entryPrice;
                    const isPositive = item.computedPnlPercent >= 0;

                    return [
                      <motion.tr
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                        className={`hover:bg-slate-800/50 transition cursor-pointer group ${
                          isExpanded ? 'bg-slate-800/40' : ''
                        }`}
                      >
                        {/* 1. Timestamp */}
                        <td className="py-3 pl-2 text-slate-400">
                          <div className="text-white font-semibold">
                            {new Date(item.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(item.timestamp).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </td>

                        {/* 2. Symbol, Market Badge & Strategy */}
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              {item.symbol || 'BTCUSDT'}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                item.effectiveMarket === 'SPOT'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                              }`}
                            >
                              {item.effectiveMarket === 'SPOT' ? '🪙 SPOT' : `⚡ FUT ${item.effectiveLeverage}x`}
                            </span>
                          </div>
                          {item.strategyName && (
                            <div
                              className="text-[10px] text-slate-400 mt-1 max-w-[160px] truncate"
                              title={item.strategyName}
                            >
                              {item.strategyName}
                            </div>
                          )}
                        </td>

                        {/* 3. Signal Direction & Confidence */}
                        <td className="py-3">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1 ${
                                item.decision === 'LONG'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {item.decision === 'LONG' ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {item.decision}
                            </span>
                            {item.confidence > 0 && (
                              <span className="text-[10px] text-slate-400">
                                Conf: <strong className="text-slate-200">{item.confidence}%</strong>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Entry -> Exit/Current Price */}
                        <td className="py-3">
                          <div className="text-slate-200 font-semibold">
                            ${formatCoinPrice(item.entryPrice, item.symbol)}
                          </div>
                          {exitOrCurrent !== item.entryPrice && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>→</span>
                              <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                                ${formatCoinPrice(exitOrCurrent, item.symbol)}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 5. Targets & Stop Loss */}
                        <td className="py-3 text-[10px]">
                          <div className="text-emerald-400">
                            TP1: ${formatCoinPrice(item.tp1, item.symbol)}
                            {item.tp2 ? ` | TP2: $${formatCoinPrice(item.tp2, item.symbol)}` : ''}
                          </div>
                          <div className="text-rose-400/80">SL: ${formatCoinPrice(item.stopLoss, item.symbol)}</div>
                        </td>

                        {/* 6. Status Badge */}
                        <td className="py-3">
                          {item.status === 'ACTIVE' ? (
                            <span className="text-cyan-400 font-bold inline-flex items-center gap-1.5 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                              <span>{isArabic ? 'صفقة جارية' : 'En Cours'}</span>
                            </span>
                          ) : item.status === 'PROFIT_TP1' || item.status === 'TP1_HIT' ? (
                            <span className="text-emerald-400 font-bold inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5" /> TP1 Hit
                            </span>
                          ) : item.status === 'PROFIT_TP2' || item.status === 'TP2_HIT' ? (
                            <span className="text-emerald-400 font-bold inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5" /> TP2 Hit
                            </span>
                          ) : item.status === 'TP3_HIT' ? (
                            <span className="text-emerald-300 font-bold inline-flex items-center gap-1 bg-emerald-500/15 px-2 py-0.5 rounded-lg border border-emerald-400/40">
                              <CheckCircle2 className="w-3.5 h-3.5" /> TP3 Max
                            </span>
                          ) : item.status === 'STOPPED_OUT' || item.status === 'SL_HIT' ? (
                            <span className="text-rose-400 font-bold inline-flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/30">
                              <ShieldAlert className="w-3.5 h-3.5" /> Stop Loss
                            </span>
                          ) : (
                            <span className="text-amber-300 font-bold inline-flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                              {isArabic ? 'إغلاق يدوي' : 'Sortie Manuelle'}
                            </span>
                          )}
                        </td>

                        {/* 7. Mini Trajectory Sparkline */}
                        <td className="py-3 text-center">
                          {item.pnlHistory && item.pnlHistory.length > 1 ? (
                            <div className="inline-block" style={{ width: 60, height: 24 }}>
                              <LineChart
                                width={60}
                                height={24}
                                data={item.pnlHistory.map((val, i) => ({ val, i }))}
                              >
                                <YAxis domain={['dataMin', 'dataMax']} hide />
                                <Line
                                  type="monotone"
                                  dataKey="val"
                                  stroke={item.pnlHistory[item.pnlHistory.length - 1] >= 0 ? '#34d399' : '#fb7185'}
                                  strokeWidth={1.5}
                                  dot={false}
                                  isAnimationActive={false}
                                />
                              </LineChart>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600">—</span>
                          )}
                        </td>

                        {/* 8. Unified Net P&L (% ROE + $ USDT) */}
                        <td className="py-3 text-right pr-2">
                          <div className={`text-sm font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? '+' : ''}
                            {item.computedPnlPercent.toFixed(2)}%
                          </div>
                          <div className={`text-[10px] ${isPositive ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                            {item.computedPnlUsdt >= 0 ? '+' : ''}${item.computedPnlUsdt.toFixed(2)} USDT
                          </div>
                        </td>

                        {/* 9. Actions */}
                        <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {item.status === 'ACTIVE' && onCloseActivePosition && (
                              <button
                                type="button"
                                onClick={() => onCloseActivePosition(item.id)}
                                className="px-2 py-1 text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg transition cursor-pointer"
                                title={isArabic ? 'إغلاق الصفقة فوراً' : 'Clôturer la position'}
                              >
                                {isArabic ? 'إغلاق' : 'Fermer'}
                              </button>
                            )}
                            {onDeleteTrade && item.status !== 'ACTIVE' && (
                              <button
                                type="button"
                                onClick={() => onDeleteTrade(item.id)}
                                className="p-1.5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                                title={isArabic ? 'حذف هذا السجل' : 'Supprimer'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                              className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                              title={isArabic ? 'تفاصيل الإشارة' : 'Détails du signal'}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </motion.tr>,

                      /* Expandable Signal Audit Drawer */
                      isExpanded ? (
                        <motion.tr
                          key={`${item.id}-audit`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12 }}
                          className="bg-slate-950/90 border-b border-slate-800/80"
                        >
                          <td colSpan={9} className="p-3.5 text-xs font-mono">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1 whitespace-normal">
                                <div className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5">
                                  <Target className="w-3.5 h-3.5" />
                                  <span>
                                    {isArabic
                                      ? 'التحليل والسبب الخوارزمي للإشارة:'
                                      : 'Audit Algorithmique & Raison du Signal :'}
                                  </span>
                                </div>
                                <p className="text-slate-300 text-xs leading-relaxed">
                                  {item.reason ||
                                    (isArabic
                                      ? 'إشارة تداول كمية متوافقة مع زخم السوق وإدارة المخاطر الآلية.'
                                      : 'Signal quantitatif exécuté selon la confluence technique et gestion du risque.')}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 shrink-0 text-[11px]">
                                {item.tp3 && (
                                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-300">
                                    TP3: ${formatCoinPrice(item.tp3, item.symbol)}
                                  </span>
                                )}
                                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                                  Timeframe: {item.timeframe || '1h'}
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                                  ID: {item.id.slice(0, 14)}
                                </span>
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      ) : null,
                    ];
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
