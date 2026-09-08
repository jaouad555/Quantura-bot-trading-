import React, { useState, useMemo } from 'react';
import { TradeHistoryItem, PaperWallet, Language } from '../types';
import { translations } from '../utils/translations';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  CartesianGrid,
  Line,
  ComposedChart,
} from 'recharts';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Award,
  Filter,
  BarChart3,
  Percent,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Layers,
  Scale,
  ShieldCheck,
} from 'lucide-react';

interface DailyRealizedPnLChartProps {
  history: TradeHistoryItem[];
  paperWallet?: PaperWallet;
  language: Language;
  onSeedSampleData?: () => void;
}

interface DailyPnLItem {
  dateKey: string;
  dateLabel: string;
  fullDate: string;
  netPnlUsdt: number;
  netPnlPercent: number;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  breakevenCount: number;
  winRate: number;
  bestTradeUsdt: number;
  worstTradeUsdt: number;
  cumulativePnlUsdt: number;
  cumulativePnlPercent: number;
  fill: string;
  isPositive: boolean;
}

export const DailyRealizedPnLChart: React.FC<DailyRealizedPnLChartProps> = ({
  history,
  paperWallet,
  language,
  onSeedSampleData,
}) => {
  const t = translations[language] || translations.fr;
  const perf = t.performanceSummary || translations.fr.performanceSummary;
  const isArabic = language === 'ar';

  // Toggle state
  const [metricType, setMetricType] = useState<'USD' | 'PERCENT'>('USD');
  const [timeRange, setTimeRange] = useState<'7D' | '14D' | '30D' | 'ALL'>('ALL');
  const [chartMode, setChartMode] = useState<'BARS' | 'COMPOSED'>('BARS');

  // Consolidate trades into unified record list
  const consolidatedTrades = useMemo(() => {
    const list: Array<{
      id: string;
      timestamp: number;
      pnlPercent: number;
      pnlUsdt: number;
      symbol?: string;
      decision?: string;
    }> = [];

    // 1. Incorporate Paper Wallet Closed Records if available
    if (paperWallet?.history && paperWallet.history.length > 0) {
      paperWallet.history.forEach((rec) => {
        list.push({
          id: rec.id,
          timestamp: rec.time,
          pnlPercent: rec.pnlPercent,
          pnlUsdt: rec.pnlUsdt,
          symbol: rec.symbol || 'BTCUSDT',
          decision: rec.type,
        });
      });
    }

    // 2. Incorporate Signal History items
    if (history && history.length > 0) {
      history.forEach((item) => {
        // Only include closed / target hit trades
        if (
          item.status === 'TP1_HIT' ||
          item.status === 'TP2_HIT' ||
          item.status === 'TP3_HIT' ||
          item.status === 'SL_HIT' ||
          item.status === 'CLOSED'
        ) {
          // If already added via paperWallet, don't duplicate
          const exists = list.some((existing) => existing.id === item.id);
          if (!exists) {
            const nominalCapital = paperWallet?.balance ? paperWallet.balance * 0.1 : 1000;
            const computedUsdt = (nominalCapital * item.profitPercent) / 100;
            list.push({
              id: item.id,
              timestamp: item.timestamp,
              pnlPercent: item.profitPercent,
              pnlUsdt: computedUsdt,
              symbol: item.symbol || 'BTCUSDT',
              decision: item.decision,
            });
          }
        }
      });
    }

    return list.sort((a, b) => a.timestamp - b.timestamp);
  }, [history, paperWallet]);

  // Aggregate trades by Day
  const { dailyData, kpis } = useMemo(() => {
    if (consolidatedTrades.length === 0) {
      return {
        dailyData: [] as DailyPnLItem[],
        kpis: {
          totalDays: 0,
          greenDays: 0,
          redDays: 0,
          dailyWinRate: 0,
          totalRealizedUsdt: 0,
          totalRealizedPercent: 0,
          avgDailyUsdt: 0,
          avgDailyPercent: 0,
          bestDayUsdt: 0,
          worstDayUsdt: 0,
          bestDayDate: '',
          worstDayDate: '',
          dailyProfitFactor: 1,
          totalTrades: 0,
        },
      };
    }

    // Group by YYYY-MM-DD
    const dayMap = new Map<
      string,
      {
        timestamp: number;
        trades: typeof consolidatedTrades;
      }
    >();

    consolidatedTrades.forEach((trade) => {
      const d = new Date(trade.timestamp);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          timestamp: trade.timestamp,
          trades: [],
        });
      }
      dayMap.get(dateKey)!.trades.push(trade);
    });

    // Convert map to sorted daily items
    const sortedKeys = Array.from(dayMap.keys()).sort();

    let runningCumUsdt = 0;
    let runningCumPercent = 0;

    let fullList: DailyPnLItem[] = sortedKeys.map((key) => {
      const entry = dayMap.get(key)!;
      const d = new Date(entry.timestamp);

      // Localized short date: e.g. "Aug 12"
      const dateLabel = d.toLocaleDateString(language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
      const fullDate = d.toLocaleDateString(language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : 'en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      const dayTrades = entry.trades;
      const tradesCount = dayTrades.length;
      const wins = dayTrades.filter((t) => t.pnlPercent > 0.05);
      const losses = dayTrades.filter((t) => t.pnlPercent < -0.05);
      const be = dayTrades.filter((t) => Math.abs(t.pnlPercent) <= 0.05);

      const netPnlUsdt = Math.round(dayTrades.reduce((acc, curr) => acc + curr.pnlUsdt, 0) * 100) / 100;
      const netPnlPercent = Math.round(dayTrades.reduce((acc, curr) => acc + curr.pnlPercent, 0) * 100) / 100;

      runningCumUsdt = Math.round((runningCumUsdt + netPnlUsdt) * 100) / 100;
      runningCumPercent = Math.round((runningCumPercent + netPnlPercent) * 100) / 100;

      const pnlValuesUsdt = dayTrades.map((t) => t.pnlUsdt);
      const bestTradeUsdt = pnlValuesUsdt.length > 0 ? Math.max(...pnlValuesUsdt) : 0;
      const worstTradeUsdt = pnlValuesUsdt.length > 0 ? Math.min(...pnlValuesUsdt) : 0;

      const isPositive = netPnlUsdt >= 0;
      const fill = isPositive ? '#10b981' : '#f43f5e';

      return {
        dateKey: key,
        dateLabel,
        fullDate,
        netPnlUsdt,
        netPnlPercent,
        tradesCount,
        winsCount: wins.length,
        lossesCount: losses.length,
        breakevenCount: be.length,
        winRate: tradesCount > 0 ? (wins.length / tradesCount) * 100 : 0,
        bestTradeUsdt,
        worstTradeUsdt,
        cumulativePnlUsdt: runningCumUsdt,
        cumulativePnlPercent: runningCumPercent,
        fill,
        isPositive,
      };
    });

    // Filter by TimeRange if needed
    if (timeRange === '7D') {
      fullList = fullList.slice(-7);
    } else if (timeRange === '14D') {
      fullList = fullList.slice(-14);
    } else if (timeRange === '30D') {
      fullList = fullList.slice(-30);
    }

    // Compute KPI Aggregates
    const totalDays = fullList.length;
    const greenDays = fullList.filter((d) => d.netPnlUsdt > 0).length;
    const redDays = fullList.filter((d) => d.netPnlUsdt < 0).length;
    const dailyWinRate = totalDays > 0 ? (greenDays / totalDays) * 100 : 0;

    const totalRealizedUsdt = Math.round(fullList.reduce((acc, curr) => acc + curr.netPnlUsdt, 0) * 100) / 100;
    const totalRealizedPercent = Math.round(fullList.reduce((acc, curr) => acc + curr.netPnlPercent, 0) * 100) / 100;
    const avgDailyUsdt = totalDays > 0 ? Math.round((totalRealizedUsdt / totalDays) * 100) / 100 : 0;
    const avgDailyPercent = totalDays > 0 ? Math.round((totalRealizedPercent / totalDays) * 100) / 100 : 0;

    const dayPnlValues = fullList.map((d) => d.netPnlUsdt);
    const bestDayUsdt = dayPnlValues.length > 0 ? Math.max(...dayPnlValues) : 0;
    const worstDayUsdt = dayPnlValues.length > 0 ? Math.min(...dayPnlValues) : 0;

    const bestDayItem = fullList.find((d) => d.netPnlUsdt === bestDayUsdt);
    const worstDayItem = fullList.find((d) => d.netPnlUsdt === worstDayUsdt);

    const grossGains = fullList.filter((d) => d.netPnlUsdt > 0).reduce((acc, curr) => acc + curr.netPnlUsdt, 0);
    const grossLosses = Math.abs(
      fullList.filter((d) => d.netPnlUsdt < 0).reduce((acc, curr) => acc + curr.netPnlUsdt, 0)
    );
    const dailyProfitFactor = grossLosses > 0 ? grossGains / grossLosses : grossGains > 0 ? 99.9 : 1.0;
    const totalTrades = fullList.reduce((acc, curr) => acc + curr.tradesCount, 0);

    return {
      dailyData: fullList,
      kpis: {
        totalDays,
        greenDays,
        redDays,
        dailyWinRate,
        totalRealizedUsdt,
        totalRealizedPercent,
        avgDailyUsdt,
        avgDailyPercent,
        bestDayUsdt,
        worstDayUsdt,
        bestDayDate: bestDayItem ? bestDayItem.dateLabel : '',
        worstDayDate: worstDayItem ? worstDayItem.dateLabel : '',
        dailyProfitFactor,
        totalTrades,
      },
    };
  }, [consolidatedTrades, timeRange, language]);

  // Custom Interactive Tooltip
  const CustomDailyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: DailyPnLItem = payload[0].payload;
      const isProfit = data.netPnlUsdt >= 0;

      return (
        <div className="bg-slate-950 transform-gpu isolate border border-slate-700/90 p-3.5 rounded-2xl shadow-2xl text-xs font-mono space-y-2 min-w-[210px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Calendar className="w-3.5 h-3.5 text-brand-400" />
              <span>{data.fullDate}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                isProfit ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isProfit ? (isArabic ? 'يوم رابح 🟢' : 'Green Day') : (isArabic ? 'يوم خاسر 🔴' : 'Red Day')}
            </span>
          </div>

          {/* Daily Net Realized PnL */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">{perf.netDayPnl}:</span>
              <span className={`font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProfit ? '+' : ''}${data.netPnlUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({isProfit ? '+' : ''}{data.netPnlPercent.toFixed(2)}%)
              </span>
            </div>

            {/* Trades count breakdown */}
            <div className="flex justify-between items-center text-slate-400 text-[11px]">
              <span>{perf.dailyTradesCount}:</span>
              <span className="font-bold text-slate-200">
                {data.tradesCount} ({data.winsCount}W / {data.lossesCount}L)
              </span>
            </div>

            {/* Cumulative up to this day */}
            <div className="flex justify-between items-center text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
              <span>{perf.cumulativeDailyPnl}:</span>
              <span
                className={`font-bold ${
                  data.cumulativePnlUsdt >= 0 ? 'text-brand-400' : 'text-rose-400'
                }`}
              >
                {data.cumulativePnlUsdt >= 0 ? '+' : ''}${data.cumulativePnlUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shadow-sm">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base tracking-wide flex items-center gap-2">
                <span>{perf.dailyRealizedPnlTitle}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Daily Bar Chart
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {perf.dailyRealizedPnlSubtitle}
            </p>
          </div>
        </div>

        {/* Action Controls & Selectors */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* USD ($) vs Percent (%) Metric Toggle */}
          <div className="flex items-center gap-1 bg-slate-950 transform-gpu isolate p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setMetricType('USD')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
                metricType === 'USD'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-3 h-3" />
              <span>USD ($)</span>
            </button>
            <button
              onClick={() => setMetricType('PERCENT')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
                metricType === 'PERCENT'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Percent className="w-3 h-3" />
              <span>ROI (%)</span>
            </button>
          </div>

          {/* Timeframe Filter (7D, 14D, 30D, ALL) */}
          <div className="flex items-center gap-1 bg-slate-950 transform-gpu isolate p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            {(['7D', '14D', '30D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2 py-1 rounded-lg font-bold transition text-[10px] ${
                  timeRange === r
                    ? 'bg-brand-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r === '7D'
                  ? perf.last7Days
                  : r === '14D'
                  ? perf.last14Days
                  : r === '30D'
                  ? perf.last30Days
                  : perf.allTime}
              </button>
            ))}
          </div>

          {/* Chart Display Mode: Bars vs Composed */}
          <div className="flex items-center gap-1 bg-slate-950 transform-gpu isolate p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setChartMode('BARS')}
              className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
                chartMode === 'BARS'
                  ? 'bg-brand-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Daily Bar Chart"
            >
              {perf.dailyPnlBars}
            </button>
            <button
              onClick={() => setChartMode('COMPOSED')}
              className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
                chartMode === 'COMPOSED'
                  ? 'bg-brand-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Daily Bars + Cumulative Curve"
            >
              {perf.cumulativeDailyPnl}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Daily Performance Metrics KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono">
        {/* KPI 1: Profitable Days vs Losing Days */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>{perf.dailyWinRate}</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black text-emerald-400">
            {kpis.dailyWinRate.toFixed(1)}%
          </div>
          <span className="text-[10px] text-slate-400 block">
            {kpis.greenDays} {perf.greenDays} / {kpis.redDays} {perf.redDays}
          </span>
        </div>

        {/* KPI 2: Total Realized Net PnL */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>{perf.cumulativeDailyPnl}</span>
            <DollarSign className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <div
            className={`text-lg font-black ${
              kpis.totalRealizedUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {kpis.totalRealizedUsdt >= 0 ? '+' : ''}${kpis.totalRealizedUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-400 block">
            {kpis.totalRealizedPercent >= 0 ? '+' : ''}{kpis.totalRealizedPercent.toFixed(2)}% Net Return
          </span>
        </div>

        {/* KPI 3: Average Daily PnL */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>{perf.avgDailyPnl}</span>
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div
            className={`text-lg font-black ${
              kpis.avgDailyUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {kpis.avgDailyUsdt >= 0 ? '+' : ''}${kpis.avgDailyUsdt.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400 block">
            {kpis.avgDailyPercent >= 0 ? '+' : ''}{kpis.avgDailyPercent.toFixed(2)}% / {isArabic ? 'يوم' : 'day'}
          </span>
        </div>

        {/* KPI 4: Best Trading Day */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>{perf.bestDay}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black text-emerald-400">
            +${kpis.bestDayUsdt.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400 block">
            {kpis.bestDayDate || (isArabic ? 'لا توجد بيانات' : 'No record')}
          </span>
        </div>

        {/* KPI 5: Daily Profit Factor */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>{perf.profitFactor}</span>
            <Scale className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-black text-white">
            {kpis.dailyProfitFactor.toFixed(2)}x
          </div>
          <span className="text-[10px] text-slate-400 block">
            {kpis.totalDays} {isArabic ? 'أيام تداول نشطة' : 'Active Trading Days'}
          </span>
        </div>
      </div>

      {/* 3. Recharts Daily Bar Chart Canvas */}
      {dailyData.length === 0 ? (
        <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              {isArabic ? 'لا توجد بيانات صفقات يومية حتى الآن' : 'Aucune donnée journalière disponible'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {isArabic
                ? 'قم بتنفيذ صفقات على المحفظة التجريبية أو قم بتوليد عينة بيانات لعرض مخطط الأرباح اليومية Bar Chart.'
                : 'Exécutez des trades simulés ou générez un échantillon de données pour afficher le graphique journalier.'}
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
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <span>
                  {chartMode === 'BARS'
                    ? metricType === 'USD'
                      ? `${perf.dailyPnlBars} ($ USDT)`
                      : `${perf.dailyPnlBars} (%)`
                    : `${perf.dailyPnlBars} + ${perf.cumulativeDailyPnl}`}
                </span>
              </h4>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>{perf.greenDays}</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-400">
                <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span>{perf.redDays}</span>
              </div>
              {chartMode === 'COMPOSED' && (
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <div className="w-2 h-0.5 bg-cyan-400" />
                  <span>{perf.cumulativeDailyPnl}</span>
                </div>
              )}
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'BARS' ? (
                <BarChart
                  data={dailyData}
                  margin={{ top: 15, right: 15, left: metricType === 'USD' ? -5 : -15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
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
                    tickFormatter={(v) => (metricType === 'USD' ? `$${v}` : `${v}%`)}
                  />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                  <Bar
                    dataKey={metricType === 'USD' ? 'netPnlUsdt' : 'netPnlPercent'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  >
                    {dailyData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <ComposedChart
                  data={dailyData}
                  margin={{ top: 15, right: 15, left: metricType === 'USD' ? -5 : -15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#64748b"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    tickFormatter={(v) => (metricType === 'USD' ? `$${v}` : `${v}%`)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#06b6d4"
                    tick={{ fontSize: 10, fill: '#06b6d4' }}
                    tickLine={false}
                    axisLine={{ stroke: '#0891b2' }}
                    tickFormatter={(v) => (metricType === 'USD' ? `$${v}` : `${v}%`)}
                  />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <ReferenceLine yAxisId="left" y={0} stroke="#475569" strokeWidth={1.5} />
                  <Bar
                    yAxisId="left"
                    dataKey={metricType === 'USD' ? 'netPnlUsdt' : 'netPnlPercent'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={42}
                  >
                    {dailyData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey={metricType === 'USD' ? 'cumulativePnlUsdt' : 'cumulativePnlPercent'}
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#06b6d4', strokeWidth: 1, stroke: '#0f172a' }}
                    activeDot={{ r: 5, fill: '#22d3ee', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Bottom Bar Indicators */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono gap-2">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>
                {perf.bestDay}: +${kpis.bestDayUsdt.toFixed(2)} ({kpis.bestDayDate || '-'})
              </span>
            </span>
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>
                {perf.worstDay}: ${kpis.worstDayUsdt.toFixed(2)} ({kpis.worstDayDate || '-'})
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
