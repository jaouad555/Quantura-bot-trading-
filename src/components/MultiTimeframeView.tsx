import React, { useState, useMemo } from 'react';
import { MarketDataResponse, Language, Timeframe, KlineCandle } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import {
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
  Compass,
  TrendingUp,
  TrendingDown,
  Gauge,
  Zap,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Grid,
  Table as TableIcon,
  Sparkles,
  ChevronRight,
  BarChart2,
  Clock,
  HelpCircle,
} from 'lucide-react';

interface MultiTimeframeViewProps {
  marketData: MarketDataResponse | null;
  language: Language;
  onSelectTimeframe: (tf: Timeframe) => void;
}

type ViewMode = 'cards' | 'matrix' | 'micro' | 'macro';

// Mini Candlestick Sparkline Component
const MiniCandleSparkline: React.FC<{
  klines?: KlineCandle[];
  symbol?: string;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}> = ({ klines, symbol = 'BTCUSDT', bias }) => {
  if (!klines || klines.length < 5) {
    return (
      <div className="h-16 w-full flex items-center justify-center text-[10px] text-slate-600 font-mono bg-slate-950/50 rounded-lg">
        Pas de données récentes
      </div>
    );
  }

  // Slice recent 16 candles
  const slice = klines.slice(-16);
  let min = Infinity;
  let max = -Infinity;
  slice.forEach((c) => {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  });

  const range = max - min || 1;
  const height = 56;
  const width = 240;
  const candleWidth = Math.max(4, Math.floor(width / slice.length) - 3);

  return (
    <div className="w-full bg-slate-950/80 p-2 rounded-xl border border-slate-800/80">
      <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
        <span>Low: ${formatCoinPrice(min, symbol)}</span>
        <span className={bias === 'BULLISH' ? 'text-emerald-400 font-bold' : bias === 'BEARISH' ? 'text-rose-400 font-bold' : 'text-slate-400'}>
          {slice[slice.length - 1].close >= slice[0].open ? '▲ +' : '▼ '}
          {(((slice[slice.length - 1].close - slice[0].open) / (slice[0].open || 1)) * 100).toFixed(2)}%
        </span>
        <span>High: ${formatCoinPrice(max, symbol)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12 overflow-visible">
        {slice.map((c, i) => {
          const x = i * (width / slice.length) + (width / slice.length) / 2;
          const openY = height - ((c.open - min) / range) * (height - 8) - 4;
          const closeY = height - ((c.close - min) / range) * (height - 8) - 4;
          const highY = height - ((c.high - min) / range) * (height - 8) - 4;
          const lowY = height - ((c.low - min) / range) * (height - 8) - 4;

          const isBull = c.close >= c.open;
          const candleColor = isBull ? '#10b981' : '#f43f5e';
          const topBody = Math.min(openY, closeY);
          const bodyHeight = Math.max(2, Math.abs(closeY - openY));

          return (
            <g key={i}>
              {/* Wick */}
              <line
                x1={x}
                y1={highY}
                x2={x}
                y2={lowY}
                stroke={candleColor}
                strokeWidth={1}
                opacity={0.8}
              />
              {/* Body */}
              <rect
                x={x - candleWidth / 2}
                y={topBody}
                width={candleWidth}
                height={bodyHeight}
                fill={candleColor}
                rx={1}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const MultiTimeframeView: React.FC<MultiTimeframeViewProps> = ({
  marketData,
  language,
  onSelectTimeframe,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [selectedTfModal, setSelectedTfModal] = useState<Timeframe | null>(null);

  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  const timeframes: {
    tf: Timeframe;
    name: string;
    desc: string;
    tier: 'micro' | 'intraday' | 'macro';
    targetTime: string;
  }[] = useMemo(
    () => [
      {
        tf: '5m',
        name: isArabic ? '5 دقائق' : isEn ? '5 Minutes' : '5 Minutes',
        desc: isArabic ? 'سكالبينج فائق السرعة وتوقيت الدخول' : isEn ? 'Ultra-Fast Scalping & Entry Timing' : 'Scalping Ultra-Rapide & Timing',
        tier: 'micro',
        targetTime: isArabic ? '10-30 دقيقة' : '10-30 mins',
      },
      {
        tf: '15m',
        name: isArabic ? '15 دقيقة' : isEn ? '15 Minutes' : '15 Minutes',
        desc: isArabic ? 'زخم الشموع وتأكيد حركة الكسر' : isEn ? 'Fast Momentum & Breakout Confirmation' : 'Momentum & Confirmation de Breakout',
        tier: 'micro',
        targetTime: isArabic ? '30-90 دقيقة' : '30-90 mins',
      },
      {
        tf: '30m',
        name: isArabic ? '30 دقيقة' : isEn ? '30 Minutes' : '30 Minutes',
        desc: isArabic ? 'هيكل السوق قصير المدى والدعم اللحظي' : isEn ? 'Short-term Market Structure & Support' : 'Structure Court Terme & Niveaux',
        tier: 'micro',
        targetTime: isArabic ? '1-3 ساعات' : '1-3 hours',
      },
      {
        tf: '1h',
        name: isArabic ? '1 ساعة' : isEn ? '1 Hour' : '1 Heure',
        desc: isArabic ? 'الاتجاه اليومي وموجات السيولة المؤسساتية' : isEn ? 'Intraday Trend & Institutional Waves' : 'Tendance Intraday & Flux Majeurs',
        tier: 'intraday',
        targetTime: isArabic ? '4-12 ساعة' : '4-12 hours',
      },
      {
        tf: '4h',
        name: isArabic ? '4 ساعات' : isEn ? '4 Hours' : '4 Heures',
        desc: isArabic ? 'هيكل سوينغ رئيسي وتأكيد الاتجاه' : isEn ? 'Major Swing Structure & Trend Anchor' : 'Structure Swing Majeure & Pivots',
        tier: 'intraday',
        targetTime: isArabic ? '1-3 أيام' : '1-3 days',
      },
      {
        tf: '1d',
        name: isArabic ? '1 يوم' : isEn ? '1 Day' : '1 Jour',
        desc: isArabic ? 'الاتجاه العام متوسط المدى ودورات السوق' : isEn ? 'Macro Medium-Term Trend & Cycles' : 'Tendance Moyen Terme & Niveaux Clés',
        tier: 'macro',
        targetTime: isArabic ? '1-2 أسبوع' : '1-2 weeks',
      },
      {
        tf: '1w',
        name: isArabic ? '1 أسبوع' : isEn ? '1 Week' : '1 Semaine',
        desc: isArabic ? 'الدورة الكبرى والاتجاه العام للسوق' : isEn ? 'Macro Cycle & Supertrend Direction' : 'Cycle Macro & Tendance Fondamentale',
        tier: 'macro',
        targetTime: isArabic ? 'عدة أسابيع' : 'Multi-weeks',
      },
    ],
    [isArabic, isEn]
  );

  if (!marketData || !marketData.mtfConfluence) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-4">
        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 animate-pulse">
          <Layers className="w-10 h-10" />
        </div>
        <div>
          <h4 className="text-lg font-bold text-white mb-1">
            {isArabic ? 'جاري فحص وتجميع بيانات الأطر الزمنية...' : 'Synchronisation de la Matrice MTF...'}
          </h4>
          <p className="text-xs text-slate-500 max-w-md">
            {isArabic
              ? 'يتم فحص المؤشرات الفنية والسيولة اللحظية عبر 7 أطر زمنية من 5 دقائق إلى أسبوع كامل لتأكيد التوافق المؤسساتي.'
              : 'Évaluation en temps réel des indicateurs et de la structure de marché sur 7 timeframes.'}
          </p>
        </div>
      </div>
    );
  }

  const { mtfConfluence, allTimeframes, ticker } = marketData;
  const { bullishCount, bearishCount, neutralCount, alignmentPercent, overallBias } = mtfConfluence;
  const currentSymbol = ticker?.symbol || 'BTCUSDT';
  const currentPrice = ticker?.price || 0;

  // Tier Confluence Breakdown (Micro: 5m, 15m, 30m | Intraday: 1h, 4h | Macro: 1d, 1w)
  const tierStats = useMemo(() => {
    const getTierBias = (tfs: Timeframe[]) => {
      let b = 0,
        r = 0,
        n = 0;
      tfs.forEach((tf) => {
        const item = mtfConfluence.timeframes[tf];
        if (item?.bias === 'BULLISH') b++;
        else if (item?.bias === 'BEARISH') r++;
        else n++;
      });
      if (b > r && b >= 2) return 'BULLISH';
      if (r > b && r >= 2) return 'BEARISH';
      if (b === tfs.length) return 'STRONG_BULLISH';
      if (r === tfs.length) return 'STRONG_BEARISH';
      return 'NEUTRAL';
    };

    return {
      micro: getTierBias(['5m', '15m', '30m']),
      intraday: getTierBias(['1h', '4h']),
      macro: getTierBias(['1d', '1w']),
    };
  }, [mtfConfluence]);

  // Dynamic AI MTF Strategic Insight
  const strategicAdvice = useMemo(() => {
    if (bullishCount >= 6) {
      return {
        title: isArabic ? 'توافق صعودي شامل وقوي جداً (High Confluence Long)' : 'Forte Confluence Haussière (Score 6+/7)',
        desc: isArabic
          ? 'تطابق إيجابي كامل بين الإطارات الصغيرة والكبيرة. احتمالية استمرار الصعود مرتفعة. ينصح بالبحث عن صفقات شراء مع الارتداد من الدعوم.'
          : 'Alignement parfait des timeframes courts et longs. Forte probabilité de continuation haussière.',
        type: 'BULLISH',
      };
    }
    if (bearishCount >= 6) {
      return {
        title: isArabic ? 'توافق هبوطي كاسح (High Confluence Short)' : 'Forte Confluence Baissière (Score 6+/7)',
        desc: isArabic
          ? 'ضغط بيعي مهيمن عبر أغلب الأطر الزمنية. تجنب الشراء المعاكس، والتركيز على البيع عند اختبار المقاومات.'
          : 'Pression vendeuse dominante sur la majorité des unités de temps. Privilégier les shorts sur rebond.',
        type: 'BEARISH',
      };
    }
    if (tierStats.micro === 'BEARISH' && (tierStats.intraday === 'BULLISH' || tierStats.macro === 'BULLISH')) {
      return {
        title: isArabic ? 'فرصة ارتداد شرائي (Dip Buy in Bullish Trend)' : 'Opportunité de Rebond (Pullback Court Terme)',
        desc: isArabic
          ? 'تصحيح هابط لحظي على 5د/15د داخل اتجاه صاعد قوي على 4س/1يوم. فرصة ممتازة للبحث عن نقطة دخول شرائية عند تشبع البيع.'
          : 'Correction court terme dans une tendance de fond haussière. Excellente configuration pour achat sur repli.',
        type: 'PULLBACK_BUY',
      };
    }
    if (tierStats.micro === 'BULLISH' && (tierStats.intraday === 'BEARISH' || tierStats.macro === 'BEARISH')) {
      return {
        title: isArabic ? 'ارتداد تصحيحي هابط (Dead-Cat Relief Bounce)' : 'Rebond Technique en Tendance Baissière',
        desc: isArabic
          ? 'ارتداد صاعد مؤقت على الأطر الصغيرة داخل اتجاه هابط رئيسي. الحذر من الفخاخ الصعودية ومراقبة مقاومات 1س و 4س.'
          : 'Rebond technique temporaire dans une tendance majeure baissière. Attention aux faux départs haussiers.',
        type: 'RELIEF_BOUNCE',
      };
    }
    return {
      title: isArabic ? 'سوق متذبذب / تباين في الإطارات (Mixed Range Market)' : 'Marché en Range / Conflit d\'Unités de Temps',
      desc: isArabic
        ? 'تضارب بين الإطارات الزمنية يشير إلى مرحلة تجميع أو تذبذب نطاقي. ينصح بتخفيف حجم العقود وتداول المستويات المحددة فقط.'
        : 'Divergence entre court et moyen terme. Privilégier le scalping sur bornes de range ou attendre une cassure.',
      type: 'NEUTRAL',
    };
  }, [bullishCount, bearishCount, tierStats, isArabic]);

  const getBiasBadge = (bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL', size: 'sm' | 'md' = 'sm') => {
    if (bias === 'BULLISH') {
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono font-bold rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${
            size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2 py-0.5 text-[11px]'
          }`}
        >
          <ArrowUpRight className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} />
          {isArabic ? 'صاعد (Bull)' : 'HAUSSIER'}
        </span>
      );
    }
    if (bias === 'BEARISH') {
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono font-bold rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 ${
            size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2 py-0.5 text-[11px]'
          }`}
        >
          <ArrowDownRight className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} />
          {isArabic ? 'هابط (Bear)' : 'BAISSIER'}
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono font-bold rounded-xl bg-slate-800/90 text-slate-300 border border-slate-700/80 ${
          size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2 py-0.5 text-[11px]'
        }`}
      >
        <Minus className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} />
        {isArabic ? 'محايد' : 'NEUTRE'}
      </span>
    );
  };

  // Filter timeframes based on active viewMode tab
  const filteredTimeframes = useMemo(() => {
    if (viewMode === 'micro') return timeframes.filter((t) => t.tier === 'micro');
    if (viewMode === 'macro') return timeframes.filter((t) => t.tier === 'intraday' || t.tier === 'macro');
    return timeframes;
  }, [viewMode, timeframes]);

  return (
    <div className={`space-y-4 sm:space-y-6 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* 1. TOP STRATEGIC CONFLUENCE DASHBOARD (HUD) */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5">
        {/* Header Title & Current Pair */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-500/10">
              <Compass className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-black text-white text-base sm:text-xl tracking-tight">
                  {isArabic ? 'رادار التوافق متعدد الأطر الزمنية (MTF Confluence Matrix)' : 'Matrice de Confluence Multi-Timeframes (MTF)'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono font-bold text-xs">
                  {currentSymbol} • ${formatCoinPrice(currentPrice, currentSymbol)}
                </span>
                {getBiasBadge(overallBias, 'md')}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isArabic
                  ? 'تحليل فني مؤسساتي متزامن عبر 7 أطر زمنية للكشف عن التوافق والزخم وتجنب الصفقات المعاكسة للاتجاه.'
                  : 'Analyse dynamique de 5m à 1W pour confirmer l\'alignement institutionnel et filtrer le bruit de marché.'}
              </p>
            </div>
          </div>

          {/* Alignment Power Gauge Bar */}
          <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 text-xs font-mono w-full lg:w-auto lg:min-w-[280px] shadow-inner">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-bold">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                {isArabic ? 'قوة التوافق الإجمالي' : 'Confluence Globale'}
              </span>
              <span className="font-black text-sm text-cyan-400">{alignmentPercent}%</span>
            </div>
            <div className="w-full bg-slate-800/80 h-3 rounded-full overflow-hidden flex shadow-inner">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                style={{ width: `${(bullishCount / 7) * 100}%` }}
                title={`${bullishCount} Bullish`}
              />
              <div
                className="bg-slate-600 h-full transition-all duration-500"
                style={{ width: `${(neutralCount / 7) * 100}%` }}
                title={`${neutralCount} Neutral`}
              />
              <div
                className="bg-gradient-to-r from-rose-500 to-red-600 h-full transition-all duration-500"
                style={{ width: `${(bearishCount / 7) * 100}%` }}
                title={`${bearishCount} Bearish`}
              />
            </div>
            <div className="flex justify-between text-[11px] font-bold mt-1.5">
              <span className="text-emerald-400 flex items-center gap-0.5">
                ▲ {bullishCount} {isArabic ? 'صاعد' : 'Bull'}
              </span>
              <span className="text-slate-400 flex items-center gap-0.5">
                • {neutralCount} {isArabic ? 'محايد' : 'Neutre'}
              </span>
              <span className="text-rose-400 flex items-center gap-0.5">
                ▼ {bearishCount} {isArabic ? 'هابط' : 'Bear'}
              </span>
            </div>
          </div>
        </div>

        {/* Tier Group Breakdown (Micro vs Intraday vs Macro) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Micro Tier */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">
                  {isArabic ? 'الأطر الصغيرة (Micro Scalp)' : 'Court Terme (Scalping)'}
                </span>
                <span className="text-xs font-mono font-bold text-white">5m • 15m • 30m</span>
              </div>
            </div>
            {getBiasBadge(tierStats.micro as any)}
          </div>

          {/* Intraday Tier */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">
                  {isArabic ? 'الأطر اليومية (Intraday Wave)' : 'Intraday (Tendance du jour)'}
                </span>
                <span className="text-xs font-mono font-bold text-white">1H • 4H</span>
              </div>
            </div>
            {getBiasBadge(tierStats.intraday as any)}
          </div>

          {/* Macro Tier */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">
                  {isArabic ? 'الأطر الكبرى (Macro Cycle)' : 'Moyen / Long Terme'}
                </span>
                <span className="text-xs font-mono font-bold text-white">1D • 1W</span>
              </div>
            </div>
            {getBiasBadge(tierStats.macro as any)}
          </div>
        </div>

        {/* AI Strategic Confluence Verdict Banner */}
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
            strategicAdvice.type === 'BULLISH'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : strategicAdvice.type === 'BEARISH'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : strategicAdvice.type === 'PULLBACK_BUY'
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
              : strategicAdvice.type === 'RELIEF_BOUNCE'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-slate-800/50 border-slate-700/60 text-slate-300'
          }`}
        >
          <div className="p-2 rounded-xl bg-slate-950/80 border border-current shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-current" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white mb-0.5">{strategicAdvice.title}</h4>
            <p className="text-xs leading-relaxed opacity-90">{strategicAdvice.desc}</p>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION & VIEW MODE SWITCHER */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 p-2.5 rounded-2xl border border-slate-800/80">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            id="btn-mtf-view-all"
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 text-xs font-bold font-mono rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              viewMode === 'cards'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            {isArabic ? 'جميع الأطر (7 Timeframes)' : 'Tous les Timeframes (7)'}
          </button>

          <button
            id="btn-mtf-view-micro"
            onClick={() => setViewMode('micro')}
            className={`px-3 py-1.5 text-xs font-bold font-mono rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              viewMode === 'micro'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            {isArabic ? 'السكالبينج السريع (5m - 30m)' : 'Scalp & Micro (5m-30m)'}
          </button>

          <button
            id="btn-mtf-view-macro"
            onClick={() => setViewMode('macro')}
            className={`px-3 py-1.5 text-xs font-bold font-mono rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              viewMode === 'macro'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            {isArabic ? 'السوينغ والماكرو (1h - 1w)' : 'Swing & Macro (1h-1W)'}
          </button>

          <button
            id="btn-mtf-view-matrix"
            onClick={() => setViewMode('matrix')}
            className={`px-3 py-1.5 text-xs font-bold font-mono rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              viewMode === 'matrix'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5 text-cyan-400" />
            {isArabic ? 'جدول المقارنة اللحظي (Heatmap Matrix)' : 'Tableau Comparatif (Heatmap)'}
          </button>
        </div>

        <div className="text-xs font-mono text-slate-400 hidden sm:flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Binance Futures WebSocket Live</span>
        </div>
      </div>

      {/* 3. MODE A: HIGH-DENSITY HEATMAP MATRIX TABLE */}
      {viewMode === 'matrix' ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 text-xs font-bold">{isArabic ? 'الإطار الزمني' : 'Timeframe'}</th>
                <th className="pb-3 text-xs font-bold text-center">{isArabic ? 'الاتجاه والإنحياز' : 'Biais MTF'}</th>
                <th className="pb-3 text-xs font-bold text-center">{isArabic ? 'هيكل السوق' : 'Structure'}</th>
                <th className="pb-3 text-xs font-bold text-center">{isArabic ? 'RSI (14)' : 'RSI (14)'}</th>
                <th className="pb-3 text-xs font-bold text-center">{isArabic ? 'حالة EMA (20/50/200)' : 'EMAs Trend'}</th>
                <th className="pb-3 text-xs font-bold text-center">{isArabic ? 'مؤشر MACD' : 'MACD'}</th>
                <th className="pb-3 text-xs font-bold text-center">{isArabic ? 'Stochastic' : 'Stoch (K/D)'}</th>
                <th className="pb-3 text-xs font-bold text-right">{isArabic ? 'الانتقال للشارت' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {timeframes.map(({ tf, name, desc }) => {
                const tfData = mtfConfluence.timeframes[tf];
                const fullData = allTimeframes ? allTimeframes[tf] : null;
                const inds = fullData?.indicators;
                const isBull = tfData?.bias === 'BULLISH';
                const isBear = tfData?.bias === 'BEARISH';

                return (
                  <tr key={tf} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-lg bg-slate-800 text-white font-black font-mono">
                          {tf.toUpperCase()}
                        </span>
                        <div>
                          <span className="font-bold text-slate-200 block text-xs">{name}</span>
                          <span className="text-[10px] text-slate-500">{desc}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-2 text-center">
                      {tfData ? getBiasBadge(tfData.bias) : <span className="text-slate-600">--</span>}
                    </td>

                    <td className="py-3.5 px-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          inds?.marketStructure?.trend?.includes('BULL')
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : inds?.marketStructure?.trend?.includes('BEAR')
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {inds?.marketStructure?.trend || tfData?.trend || 'NEUTRAL'}
                      </span>
                    </td>

                    <td className="py-3.5 px-2 text-center">
                      {inds ? (
                        <span
                          className={`font-bold ${
                            inds.rsi14 >= 70
                              ? 'text-rose-400'
                              : inds.rsi14 <= 30
                              ? 'text-emerald-400'
                              : 'text-cyan-300'
                          }`}
                        >
                          {inds.rsi14}{' '}
                          <span className="text-[10px] text-slate-500">
                            {inds.rsi14 >= 70 ? 'OB' : inds.rsi14 <= 30 ? 'OS' : ''}
                          </span>
                        </span>
                      ) : (
                        tfData?.rsi || '--'
                      )}
                    </td>

                    <td className="py-3.5 px-2 text-center">
                      {inds ? (
                        <div className="flex items-center justify-center gap-1.5 text-[11px]">
                          <span
                            className={
                              currentPrice > inds.ema20 ? 'text-emerald-400 font-bold' : 'text-rose-400'
                            }
                            title="Prix vs EMA 20"
                          >
                            20{currentPrice > inds.ema20 ? '↑' : '↓'}
                          </span>
                          <span className="text-slate-600">|</span>
                          <span
                            className={
                              currentPrice > inds.ema50 ? 'text-emerald-400 font-bold' : 'text-rose-400'
                            }
                            title="Prix vs EMA 50"
                          >
                            50{currentPrice > inds.ema50 ? '↑' : '↓'}
                          </span>
                          <span className="text-slate-600">|</span>
                          <span
                            className={
                              currentPrice > inds.ema200 ? 'text-purple-400 font-bold' : 'text-slate-500'
                            }
                            title="Prix vs EMA 200"
                          >
                            200{currentPrice > inds.ema200 ? '↑' : '↓'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">{tfData?.emaTrend || '--'}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-2 text-center">
                      {inds ? (
                        <span
                          className={`font-bold ${
                            inds.macd?.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {inds.macd?.histogram >= 0 ? '+' : ''}
                          {Number(inds.macd?.histogram || 0).toFixed(2)}
                        </span>
                      ) : (
                        '--'
                      )}
                    </td>

                    <td className="py-3.5 px-2 text-center">
                      {inds?.stoch ? (
                        <span className="text-slate-300">
                          {Math.round(inds.stoch.k)} / {Math.round(inds.stoch.d)}
                        </span>
                      ) : (
                        '--'
                      )}
                    </td>

                    <td className="py-3.5 pl-2 text-right">
                      <button
                        onClick={() => onSelectTimeframe(tf)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/40 text-xs font-bold transition flex items-center gap-1 ml-auto cursor-pointer active:scale-95"
                      >
                        <Activity className="w-3 h-3 text-cyan-400" />
                        <span>{tf.toUpperCase()}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* 4. MODE B: RICH INTERACTIVE TIMEFRAME CARDS WITH MINI-CANDLESTICK SPARKLINE */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredTimeframes.map(({ tf, name, desc, tier, targetTime }) => {
            const tfData = mtfConfluence.timeframes[tf];
            const fullData = allTimeframes ? allTimeframes[tf] : null;
            const inds = fullData?.indicators;
            const klines = fullData?.klines;
            const isBull = tfData?.bias === 'BULLISH';
            const isBear = tfData?.bias === 'BEARISH';

            return (
              <div
                key={tf}
                className={`bg-slate-900/90 border rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] ${
                  isBull
                    ? 'border-slate-800 hover:border-emerald-500/40'
                    : isBear
                    ? 'border-slate-800 hover:border-rose-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Card Header: TF Badge, Bias & Target Horizon */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`px-3 py-1.5 rounded-xl font-black font-mono text-sm tracking-tight ${
                          tier === 'micro'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : tier === 'intraday'
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {tf.toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm leading-tight">{name}</h4>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-slate-500" />
                          {targetTime}
                        </span>
                      </div>
                    </div>
                    {tfData && getBiasBadge(tfData.bias)}
                  </div>

                  <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">{desc}</p>

                  {/* Visual Candlestick Sparkline */}
                  <MiniCandleSparkline
                    klines={klines}
                    symbol={currentSymbol}
                    bias={tfData?.bias || 'NEUTRAL'}
                  />
                </div>

                {/* Technical Indicators Matrix Grid */}
                {inds ? (
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
                    {/* Structure */}
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-slate-500 block text-[10px]">
                        {isArabic ? 'هيكل السوق' : 'Structure'}
                      </span>
                      <span
                        className={`font-bold ${
                          inds.marketStructure.trend.includes('BULL')
                            ? 'text-emerald-400'
                            : inds.marketStructure.trend.includes('BEAR')
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {inds.marketStructure.trend}
                      </span>
                    </div>

                    {/* RSI (14) */}
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>RSI (14)</span>
                        <span
                          className={`font-bold ${
                            inds.rsi14 >= 70
                              ? 'text-rose-400'
                              : inds.rsi14 <= 30
                              ? 'text-emerald-400'
                              : 'text-cyan-300'
                          }`}
                        >
                          {inds.rsi14 >= 70 ? 'Overbought' : inds.rsi14 <= 30 ? 'Oversold' : 'Mid'}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          inds.rsi14 >= 70
                            ? 'text-rose-400'
                            : inds.rsi14 <= 30
                            ? 'text-emerald-400'
                            : 'text-white'
                        }`}
                      >
                        {inds.rsi14}
                      </span>
                    </div>

                    {/* EMA Confluence Checklist */}
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60 col-span-2">
                      <span className="text-slate-500 block text-[10px] mb-1">
                        {isArabic ? 'موقع السعر بالنسبة للمتوسطات' : 'Alignement EMAs (20 / 50 / 200)'}
                      </span>
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`flex items-center gap-1 font-bold ${
                            currentPrice > inds.ema20 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {currentPrice > inds.ema20 ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          EMA 20
                        </span>
                        <span
                          className={`flex items-center gap-1 font-bold ${
                            currentPrice > inds.ema50 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {currentPrice > inds.ema50 ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          EMA 50
                        </span>
                        <span
                          className={`flex items-center gap-1 font-bold ${
                            currentPrice > inds.ema200 ? 'text-purple-400' : 'text-slate-500'
                          }`}
                        >
                          {currentPrice > inds.ema200 ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          EMA 200
                        </span>
                      </div>
                    </div>

                    {/* MACD Histogram */}
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-slate-500 block text-[10px]">MACD Momentum</span>
                      <span
                        className={`font-bold ${
                          inds.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {inds.macd.histogram >= 0 ? '▲ +' : '▼ '}
                        {Number(inds.macd.histogram).toFixed(2)}
                      </span>
                    </div>

                    {/* Stochastic Oscillator */}
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-slate-500 block text-[10px]">Stoch (K / D)</span>
                      <span className="text-slate-200 font-bold">
                        {inds.stoch ? `${Math.round(inds.stoch.k)} / ${Math.round(inds.stoch.d)}` : '--'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-6 text-center font-mono bg-slate-950/60 rounded-2xl">
                    {isArabic ? 'جاري تحميل مؤشرات الإطار الزمني...' : 'Chargement des indicateurs...'}
                  </div>
                )}

                {/* Direct Action Button: Open Timeframe in Main Chart */}
                <button
                  id={`btn-open-chart-${tf}`}
                  onClick={() => onSelectTimeframe(tf)}
                  className="w-full py-2.5 px-4 bg-slate-800/90 hover:bg-gradient-to-r hover:from-cyan-500 hover:to-blue-600 hover:text-slate-950 text-slate-200 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2 border border-slate-700/80 hover:border-transparent cursor-pointer active:scale-95 shadow-md"
                >
                  <Activity className="w-4 h-4 text-cyan-400 group-hover:text-slate-950" />
                  <span>
                    {isArabic ? `عرض وتحليل شارت ${tf.toUpperCase()} بالكامل` : `Afficher Graphique ${tf.toUpperCase()}`}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. MULTI-TIMEFRAME PRO TRADING RULES & CONFLUENCE CHEAT SHEET */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 text-white font-bold text-sm sm:text-base">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <h4>
            {isArabic
              ? 'قواعد المتداول المحترف في استخدام التوافق متعدد الأطر (MTF Rules)'
              : 'Règles Institutionnelles du Trading Multi-Timeframes (MTF)'}
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs leading-relaxed text-slate-300">
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
            <span className="text-amber-400 font-bold block flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> 1. قاعدة الاتجاه الأكبر (Macro Filter)
            </span>
            <p className="text-slate-400 text-[11px]">
              {isArabic
                ? 'لا تتداول أبداً عكس اتجاه إطار الـ 4 ساعات واليومي. إذا كان 4H صاعداً، ابحث فقط عن فرص الشراء حتى لو ظهر هبوط على 5 دقائق.'
                : 'Ne tradez jamais contre la tendance 4H/1D. Si 4H est haussier, privilégiez les achats sur replis.'}
            </p>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
            <span className="text-cyan-400 font-bold block flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> 2. دقة نقطة الدخول (Precision Scalp)
            </span>
            <p className="text-slate-400 text-[11px]">
              {isArabic
                ? 'استخدم أطر 5د و 15د لتحديد نقطة الدخول بدقة مع أصغر وقف خسارة ممكن بمجرد انتهاء التصحيح.'
                : 'Utilisez 5m et 15m pour synchroniser l\'entrée optimale et minimiser la taille du Stop Loss.'}
            </p>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
            <span className="text-purple-400 font-bold block flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5" /> 3. حد الأمان للتوافق (70%+ Rule)
            </span>
            <p className="text-slate-400 text-[11px]">
              {isArabic
                ? 'أفضل الصفقات تحدث عندما تتجاوز قوة التوافق 70% (5 أطر أو أكثر في نفس الاتجاه). عندما تقل عن 50%، التزم بالحذر لأن السوق في نطاق تذبذب.'
                : 'Les setups haute probabilité apparaissent quand l\'alignement dépasse 70%. En dessous de 50%, restez prudent.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
