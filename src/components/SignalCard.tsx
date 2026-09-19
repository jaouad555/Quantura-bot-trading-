import React, { useState } from 'react';
import {
  AIAnalysisResult,
  Language,
  AutoBotConfig,
  LiquidityHealthAssessment,
  MarketDataResponse,
  BinanceTicker,
  MTFConfluenceData,
  MarketRegime,
} from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldAlert,
  Copy,
  Check,
  Sparkles,
  AlertOctagon,
  Layers,
  Waves,
  Zap,
  RefreshCw,
  BellRing,
  Cpu,
  Target,
  Crosshair,
  Award,
  Flame,
  HeartHandshake,
  Smile,
  Frown,
} from 'lucide-react';

interface SignalCardProps {
  symbol?: string;
  signal: AIAnalysisResult | null;
  language: Language;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  botConfig?: AutoBotConfig;
  marketData?: MarketDataResponse | null;
  ticker?: BinanceTicker | null;
  mtfData?: MTFConfluenceData | null;
  liquidityAssessment?: LiquidityHealthAssessment | null;
  onOpenDepthDetails?: () => void;
  onUpdateBotConfig?: (partial: Partial<AutoBotConfig>) => void;
  onNotifyRecommendation?: (plan: AIAnalysisResult) => void;
  onOpenNotifications?: () => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  symbol = 'BTCUSDT',
  signal,
  language,
  onAnalyze,
  isAnalyzing,
  botConfig,
  marketData,
  ticker,
  mtfData,
  liquidityAssessment,
  onOpenDepthDetails,
  onUpdateBotConfig,
  onNotifyRecommendation,
  onOpenNotifications,
}) => {
  const [copied, setCopied] = useState(false);
  const [notified, setNotified] = useState(false);

  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';

  // Selected bot/execution market mode (SPOT vs FUTURES)
  const currentMarketType = botConfig?.marketType || 'FUTURES';
  const currentLeverage = botConfig?.leverage || (currentMarketType === 'FUTURES' ? 3 : 1);

  // Price & Ticker metrics
  const currentPriceVal = ticker?.price || signal?.currentPrice || (signal?.entryZone ? signal.entryZone.ideal : 0);
  const change24h = ticker?.priceChangePercent24h ?? 0;

  // Render initialization state when no signal is loaded yet
  if (!signal) {
    return (
      <div
        className={`w-full bg-[#0d1424] border border-slate-800/90 rounded-2xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md relative overflow-hidden font-sans ${
          isArabic ? 'rtl text-right' : 'ltr text-left'
        }`}
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-emotion-aura" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Animated Icon Ring */}
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_24px_rgba(6,182,212,0.2)]">
              {isAnalyzing ? (
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
              ) : (
                <Cpu className="w-8 h-8 text-cyan-400 animate-pulse" />
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg sm:text-xl font-bold text-slate-100 mb-2 tracking-tight">
            {isArabic ? 'تهيئة محطة التحليل الكمي' : 'Initialisation du Terminal Quantitatif'}
          </h3>

          {/* Subtitle */}
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed font-normal">
            {isArabic
              ? 'يقوم المحرك الذكي بحساب المؤشرات الفنية، فحص تدفق السيولة في الوقت الحقيقي وتحديد مناطق الدخول والأهداف.'
              : 'Calcul des indicateurs mathématiques, détection du régime de marché et scoring de confluence en cours...'}
          </p>

          {/* Live Analysis Progress Bar */}
          <div className="w-full max-w-xs bg-slate-900/90 h-2 rounded-full overflow-hidden border border-slate-800 mb-6 p-0.5">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 animate-pulse w-3/4 shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
          </div>

          {/* Action CTA Button */}
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] disabled:opacity-50 inline-flex items-center justify-center gap-2.5 cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>{isArabic ? 'جاري التحليل والحساب...' : 'Calcul en cours...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>{isArabic ? 'تشغيل التحليل الكمي الآن' : 'Lancer l\'Analyse Quantitative'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const {
    decision,
    confidence,
    marketRegime,
    entryQuality,
    entryZone,
    targets,
    stopLoss,
    riskRewardRatio,
    invalidation,
    tradeType,
    timing,
  } = signal;

  // Percentage Calculations for TP and SL relative to Ideal Entry
  const idealEntry = entryZone?.ideal || currentPriceVal || 1;
  const isLong = decision === 'LONG';

  const getTargetDiff = (targetPrice?: number) => {
    if (!targetPrice || !idealEntry) return '';
    const diff = isLong
      ? ((targetPrice - idealEntry) / idealEntry) * 100
      : ((idealEntry - targetPrice) / idealEntry) * 100;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}%`;
  };

  const getSlDiff = (slPrice?: number) => {
    if (!slPrice || !idealEntry) return '';
    const diff = isLong
      ? ((slPrice - idealEntry) / idealEntry) * 100
      : ((idealEntry - slPrice) / idealEntry) * 100;
    return `${diff.toFixed(2)}%`;
  };

  // Emotions Theme Configuration (Dynamic Moods & Auras)
  const getEmotionsTheme = () => {
    switch (decision) {
      case 'LONG':
        return {
          title: isArabic ? 'شراء • LONG' : 'ACHAT • LONG',
          tag: isArabic ? 'شراء (LONG 🟢)' : 'ACHAT (LONG 🟢)',
          moodLabel: isArabic ? 'مشاعر السوق: تفاؤل وإقبال (Greed)' : 'Sentiment: Euphorie & Greed',
          moodBadgeBg: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300',
          moodIcon: <Flame className="w-3.5 h-3.5 text-emerald-400" />,
          glowColor: 'rgba(16, 185, 129, 0.22)',
          cardBorder: 'border-emerald-500/30 hover:border-emerald-500/50',
          bgRadial: 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(6, 182, 212, 0.18), rgba(16, 185, 129, 0.14), rgba(13, 20, 36, 0.95))',
          auras: [
            'bg-emerald-500/15 top-[-10%] right-[-5%] w-72 h-72 blur-3xl',
            'bg-cyan-500/12 bottom-[-10%] left-[-5%] w-80 h-80 blur-3xl',
          ],
          icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
          accentText: 'text-emerald-400',
        };
      case 'SHORT':
        return {
          title: isArabic ? 'بيع • SHORT' : 'VENTE • SHORT',
          tag: isArabic ? 'بيع (SHORT 🔴)' : 'VENTE (SHORT 🔴)',
          moodLabel: isArabic ? 'مشاعر السوق: حذر وخوف (Fear)' : 'Sentiment: Pression Vendeuse (Fear)',
          moodBadgeBg: 'bg-rose-500/15 border-rose-500/35 text-rose-300',
          moodIcon: <Frown className="w-3.5 h-3.5 text-rose-400" />,
          glowColor: 'rgba(244, 63, 94, 0.22)',
          cardBorder: 'border-rose-500/30 hover:border-rose-500/50',
          bgRadial: 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(244, 63, 94, 0.16), rgba(168, 85, 247, 0.12), rgba(13, 20, 36, 0.95))',
          auras: [
            'bg-rose-500/15 top-[-10%] right-[-5%] w-72 h-72 blur-3xl',
            'bg-purple-500/12 bottom-[-10%] left-[-5%] w-80 h-80 blur-3xl',
          ],
          icon: <TrendingDown className="w-5 h-5 text-rose-400" />,
          accentText: 'text-rose-400',
        };
      case 'WAIT':
      default:
        return {
          title: isArabic ? 'ترقب • WAIT' : 'ATTENTE • WAIT',
          tag: isArabic ? 'ترقب (WAIT 🟡)' : 'ATTENTE (WAIT 🟡)',
          moodLabel: isArabic ? 'مشاعر السوق: توازن وترقب (Neutral)' : 'Sentiment: Phase d\'Attente (Neutral)',
          moodBadgeBg: 'bg-amber-500/15 border-amber-500/35 text-amber-300',
          moodIcon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
          glowColor: 'rgba(245, 158, 11, 0.18)',
          cardBorder: 'border-amber-500/30 hover:border-amber-500/50',
          bgRadial: 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(245, 158, 11, 0.14), rgba(59, 130, 246, 0.10), rgba(13, 20, 36, 0.95))',
          auras: [
            'bg-amber-500/12 top-[-10%] right-[-5%] w-72 h-72 blur-3xl',
            'bg-blue-500/10 bottom-[-10%] left-[-5%] w-80 h-80 blur-3xl',
          ],
          icon: <Clock className="w-5 h-5 text-amber-400" />,
          accentText: 'text-amber-400',
        };
    }
  };

  const emotion = getEmotionsTheme();

  // Liquidity & Slippage
  const slippageValue = liquidityAssessment?.estimatedSlippagePercent ?? 0.01;
  const isOptimalLiquidity =
    liquidityAssessment?.status === 'EXCELLENT' ||
    liquidityAssessment?.status === 'SUFFICIENT' ||
    !liquidityAssessment;

  const handleCopy = () => {
    const isSpotMode = currentMarketType === 'SPOT';
    const tf = signal.recommendedTimeframe.toUpperCase();
    const marketHeader = isSpotMode ? 'SPOT (1x)' : `FUTURES (${currentLeverage}x)`;

    const text = isArabic
      ? `
🎯 إشارة تداول ${symbol} (${tf}) [${marketHeader}]
• القرار : ${t.decisions[decision] || decision} (القوة: ${confidence}%)
• الدخول المثالي : ${entryZone ? `$${formatCoinPrice(entryZone.ideal, symbol)}` : 'N/A'} (النطاق: $${formatCoinPrice(entryZone?.min, symbol)} - $${formatCoinPrice(entryZone?.max, symbol)})
• الهدف 1 : ${targets ? `$${formatCoinPrice(targets.tp1, symbol)} (${getTargetDiff(targets.tp1)})` : 'N/A'}
• الهدف 2 : ${targets ? `$${formatCoinPrice(targets.tp2, symbol)} (${getTargetDiff(targets.tp2)})` : 'N/A'}
• الهدف 3 : ${targets ? `$${formatCoinPrice(targets.tp3, symbol)} (${getTargetDiff(targets.tp3)})` : 'N/A'}
• وقف الخسارة : ${stopLoss ? `$${formatCoinPrice(stopLoss, symbol)} (${getSlDiff(stopLoss)})` : 'N/A'}
• نسبة العائد للمخاطرة (R:R) : 1:${riskRewardRatio || '2.5'}
© Quantura Institutional Terminal
`.trim()
      : `
🎯 SIGNAL QUANTITATIF ${symbol} (${tf}) [${marketHeader}]
• Décision : ${emotion.title} (Force: ${confidence}%)
• Entrée Idéale : ${entryZone ? `$${formatCoinPrice(entryZone.ideal, symbol)}` : 'N/A'} (Zone: $${formatCoinPrice(entryZone?.min, symbol)} - $${formatCoinPrice(entryZone?.max, symbol)})
• TP1 : ${targets ? `$${formatCoinPrice(targets.tp1, symbol)} (${getTargetDiff(targets.tp1)})` : 'N/A'}
• TP2 : ${targets ? `$${formatCoinPrice(targets.tp2, symbol)} (${getTargetDiff(targets.tp2)})` : 'N/A'}
• TP3 : ${targets ? `$${formatCoinPrice(targets.tp3, symbol)} (${getTargetDiff(targets.tp3)})` : 'N/A'}
• Stop Loss : ${stopLoss ? `$${formatCoinPrice(stopLoss, symbol)} (${getSlDiff(stopLoss)})` : 'N/A'}
• Ratio R/R : 1:${riskRewardRatio || '2.5'}
• Invalidation : ${invalidation.reason}
© Quantura Institutional Terminal
`.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNotify = () => {
    setNotified(true);
    if (onNotifyRecommendation) {
      onNotifyRecommendation(signal);
    }
    setTimeout(() => setNotified(false), 3000);
  };

  const getRegimeLabel = (reg: MarketRegime) => {
    switch (reg) {
      case 'TRENDING_BULLISH':
        return isArabic ? 'اتجاه صاعد (Haussier)' : 'Tendance Haussière';
      case 'TRENDING_BEARISH':
        return isArabic ? 'اتجاه هابط (Baissier)' : 'Tendance Baissière';
      case 'RANGING':
        return isArabic ? 'نطاق تذبذب عرضي (Range)' : 'Marché en Range';
      case 'HIGH_VOLATILITY':
        return isArabic ? 'تقلبات سعرية عالية' : 'Forte Volatilité';
      case 'LOW_VOLATILITY':
        return isArabic ? 'تقلبات منخفضة وهادئة' : 'Faible Volatilité';
      case 'UNCERTAIN':
      default:
        return isArabic ? 'نظام غير مؤكد' : 'Régime Incertain';
    }
  };

  return (
    <div
      className={`w-full max-w-xl mx-auto rounded-2xl border ${emotion.cardBorder} shadow-2xl relative overflow-hidden font-sans transition-all duration-300 ${
        isArabic ? 'rtl text-right' : 'ltr text-left'
      }`}
      style={{
        background: emotion.bgRadial,
        boxShadow: `0 8px 32px 0 ${emotion.glowColor}`,
      }}
    >
      {/* 🎭 DYNAMIC BACKGROUND EMOTIONS AURA LAYERS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Pulsing Luminous Emotion Orbs */}
        {emotion.auras.map((auraClass, idx) => (
          <div
            key={idx}
            className={`absolute rounded-full pointer-events-none animate-emotion-aura ${auraClass}`}
          />
        ))}

        {/* Floating Ambient Mood Particles / Grid Shimmer */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 pointer-events-none" />
      </div>

      {/* 🌟 UNIFIED CARD CONTENT (All-in-one Single Container) */}
      <div className="relative z-10 p-4 sm:p-5 space-y-3.5">
        
        {/* 1. TOP HEADER: Pair + Live Price + 24h Change + Emotion/Sentiment Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          {/* Pair & Price */}
          <div className="flex items-center gap-2.5">
            <span className="font-extrabold text-base sm:text-lg text-white tracking-wide">
              {symbol}
            </span>
            <span className="font-mono font-bold text-sm sm:text-base text-cyan-400">
              ${formatCoinPrice(currentPriceVal, symbol)}
            </span>
            <div
              className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 ${
                change24h < 0
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {change24h < 0 ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5" />
              )}
              <span>
                {change24h < 0 ? `${change24h.toFixed(2)}%` : `+${change24h.toFixed(2)}%`}
              </span>
            </div>
          </div>

          {/* Dynamic Emotion Badge */}
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border shadow-sm ${emotion.moodBadgeBg}`}>
            {emotion.moodIcon}
            <span className="truncate">{emotion.moodLabel}</span>
          </div>
        </div>

        {/* 2. REGIME & QUALITY INFO STRIP (Seamless Inline Badges) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-950/60 border border-slate-800/80 rounded-xl px-3 py-2">
          {/* Market Regime */}
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">{isArabic ? 'النظام:' : 'Régime:'}</span>
            <span className="font-semibold text-slate-200">{getRegimeLabel(marketRegime)}</span>
          </div>

          {/* Grade & Liquidity */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              GRADE {entryQuality.grade || 'B'}
            </span>
            <button
              type="button"
              onClick={onOpenDepthDetails}
              className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
            >
              <Waves className="w-3.5 h-3.5" />
              <span>{isOptimalLiquidity ? (isArabic ? 'سيولة عميقة' : 'Liquidité Optimale') : 'Liquidité'}</span>
              <span className="text-slate-500 font-mono text-[10px]">({slippageValue.toFixed(2)}%)</span>
            </button>
          </div>
        </div>

        {/* 3. MAIN SIGNAL HERO (Decision + Duration + Execution Tags + Strength Bar) */}
        <div className="bg-slate-950/75 border border-slate-800/90 rounded-xl p-3.5 sm:p-4 space-y-3 shadow-inner">
          {/* Header of Signal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isArabic ? 'إشارة التحليل الكمي' : 'SIGNAL QUANTITATIF'}
              </span>
            </div>
            <div className="text-xs font-mono font-semibold text-cyan-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{timing?.expectedDuration || '4h – 12h'}</span>
            </div>
          </div>

          {/* Main Decision Title & Badges */}
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border bg-slate-900/90 ${emotion.moodBadgeBg} shadow-sm shrink-0`}>
              {emotion.icon}
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {emotion.tag}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {tradeType.replace('_', ' ')}
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>SPOT (1x)</span>
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>FUTURES ({currentLeverage}x)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Signal Confluence Progress Bar */}
          <div className="space-y-1 pt-1 border-t border-slate-900">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-slate-400">
                {isArabic ? 'قوة الإشارة وتوافق المؤشرات:' : 'Force du Signal & Confluence:'}
              </span>
              <span className="font-mono font-bold text-cyan-400 text-xs">{confidence}%</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(15, confidence))}%` }}
              />
            </div>
          </div>

          {/* Analysis Note */}
          <p className="text-xs text-slate-300 leading-relaxed font-normal">
            {entryQuality.reason ||
              'Configuration solide avec bon ratio R:R, valider le volume lors de la prise de position.'}
          </p>
        </div>

        {/* 4. COMPACT EXECUTION GRID (Entry, TP1/2/3, SL & Prominent Risk/Reward Ratio) */}
        {entryZone && targets && stopLoss && (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
            {/* R:R Header Badge */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/70">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isArabic ? 'مستويات الأهداف والتنفيذ' : 'Niveaux d\'Exécution'}</span>
              </div>
              
              {/* Prominent R:R Ratio Badge */}
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-emerald-500/20 border border-cyan-500/40 px-2.5 py-0.5 rounded-full">
                <Award className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {isArabic ? 'العائد/المخاطرة' : 'Ratio R/R'}
                </span>
                <span className="text-xs font-mono font-black text-cyan-300">
                  1:{riskRewardRatio || '2.5'}
                </span>
              </div>
            </div>

            {/* Entry & Stop Loss Columns */}
            <div className="grid grid-cols-2 gap-2">
              {/* Entry */}
              <div className="bg-[#0b121e] border border-cyan-500/30 rounded-lg p-2.5">
                <div className="text-[10px] font-bold text-cyan-400 uppercase mb-0.5 flex items-center gap-1">
                  <Target className="w-3 h-3 text-cyan-400" />
                  <span>{isArabic ? 'نقطة الدخول' : 'Entrée Idéale'}</span>
                </div>
                <div className="font-mono font-bold text-sm sm:text-base text-white">
                  ${formatCoinPrice(entryZone.ideal, symbol)}
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  ${formatCoinPrice(entryZone.min, symbol)} – ${formatCoinPrice(entryZone.max, symbol)}
                </div>
              </div>

              {/* Stop Loss */}
              <div className="bg-[#0b121e] border border-rose-500/30 rounded-lg p-2.5">
                <div className="text-[10px] font-bold text-rose-400 uppercase mb-0.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-rose-400" />
                    <span>Stop Loss</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1 rounded bg-rose-500/20 text-rose-300">
                    {getSlDiff(stopLoss)}
                  </span>
                </div>
                <div className="font-mono font-bold text-sm sm:text-base text-rose-400">
                  ${formatCoinPrice(stopLoss, symbol)}
                </div>
                <div className="text-[10px] text-rose-300/80 mt-0.5 truncate">
                  {isArabic ? 'خروج فوري عند الكسر' : 'Protection Capital'}
                </div>
              </div>
            </div>

            {/* Take Profit 3-Column Grid */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <div className="bg-[#0b121e] border border-emerald-500/30 rounded-lg p-2 text-center">
                <div className="text-[10px] font-bold text-emerald-400 mb-0.5">
                  TP1 <span className="text-[9px] text-slate-400">(50%)</span>
                </div>
                <div className="font-mono font-bold text-xs text-emerald-300 truncate">
                  ${formatCoinPrice(targets.tp1, symbol)}
                </div>
                <div className="text-[10px] font-mono font-semibold text-emerald-400">
                  {getTargetDiff(targets.tp1)}
                </div>
              </div>

              <div className="bg-[#0b121e] border border-emerald-500/30 rounded-lg p-2 text-center">
                <div className="text-[10px] font-bold text-emerald-400 mb-0.5">
                  TP2 <span className="text-[9px] text-slate-400">(30%)</span>
                </div>
                <div className="font-mono font-bold text-xs text-emerald-200 truncate">
                  ${formatCoinPrice(targets.tp2, symbol)}
                </div>
                <div className="text-[10px] font-mono font-semibold text-emerald-400">
                  {getTargetDiff(targets.tp2)}
                </div>
              </div>

              <div className="bg-[#0b121e] border border-emerald-500/30 rounded-lg p-2 text-center">
                <div className="text-[10px] font-bold text-emerald-400 mb-0.5">
                  TP3 <span className="text-[9px] text-slate-400">(Run)</span>
                </div>
                <div className="font-mono font-bold text-xs text-emerald-100 truncate">
                  ${formatCoinPrice(targets.tp3, symbol)}
                </div>
                <div className="text-[10px] font-mono font-semibold text-emerald-400">
                  {getTargetDiff(targets.tp3)}
                </div>
              </div>
            </div>

            {/* Invalidation Alert */}
            {invalidation?.reason && (
              <div className="bg-slate-900/60 border border-amber-500/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] text-slate-300 truncate">
                  <strong className="text-amber-300 mr-1">{isArabic ? 'الإلغاء:' : 'Invalidation:'}</strong>
                  {invalidation.reason}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 5. TACTICAL EXECUTION SELECTOR (SPOT vs FUTURES) */}
        <div className="grid grid-cols-2 gap-2">
          {/* SPOT Button */}
          <button
            type="button"
            onClick={() => onUpdateBotConfig && onUpdateBotConfig({ marketType: 'SPOT', leverage: 1 })}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              currentMarketType === 'SPOT'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>SPOT</span>
            <span className="text-[11px] font-mono opacity-80">1×</span>
          </button>

          {/* FUTURES Button */}
          <button
            type="button"
            onClick={() => onUpdateBotConfig && onUpdateBotConfig({ marketType: 'FUTURES' })}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              currentMarketType === 'FUTURES'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>FUTURES</span>
            <span className="text-[11px] font-mono opacity-80">{currentLeverage}×</span>
          </button>
        </div>

        {/* 6. ACTION BUTTONS & CTA (Notify, Copy, Refresh) */}
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <div className="grid grid-cols-2 gap-2">
            {/* Notification Button */}
            <button
              onClick={handleNotify}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${
                notified
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 hover:border-cyan-500/40 text-cyan-200'
              }`}
            >
              {notified ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{isArabic ? 'تم التنبيه ✓' : 'Alerte Active ✓'}</span>
                </>
              ) : (
                <>
                  <BellRing className="w-4 h-4 text-cyan-400" />
                  <span>{isArabic ? 'تنبيه 🔔' : 'Notification 🔔'}</span>
                </>
              )}
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950/80 hover:bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
              }`}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>
                {copied
                  ? t.terminal.copied
                  : isArabic
                  ? `نسخ (${currentMarketType})`
                  : `Copier (${currentMarketType})`}
              </span>
            </button>
          </div>

          {/* Primary Refresh CTA */}
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 active:scale-[0.99] text-slate-950 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50 cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>{isArabic ? 'جاري التحليل والحساب...' : 'Calcul en cours...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>{isArabic ? 'تحديث التحليل الكمي / الذكاء الاصطناعي' : 'Actualiser Analyse Quant/IA'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
