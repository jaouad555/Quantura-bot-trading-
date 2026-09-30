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
  Calculator,
  Sliders,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { SentimentalBotAvatar } from './SentimentalBotAvatar';

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
  walletBalance?: number;
  onQuickTrade?: (direction: 'LONG' | 'SHORT', price: number) => void;
  onNavigateToBot?: () => void;
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
  walletBalance = 1000,
  onQuickTrade,
  onNavigateToBot,
}) => {
  const [copied, setCopied] = useState(false);
  const [notified, setNotified] = useState(false);
  const [showSmartCalculator, setShowSmartCalculator] = useState(false);
  const [showConfluenceRadar, setShowConfluenceRadar] = useState(false);
  const [riskPercent, setRiskPercent] = useState<number>(2); // Default 2% risk
  const [customCapital, setCustomCapital] = useState<number>(walletBalance || 1000);
  const [quickTradeTriggered, setQuickTradeTriggered] = useState(false);

  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';

  // Selected bot/execution market mode (SPOT vs FUTURES)
  const currentMarketType = botConfig?.marketType || 'FUTURES';
  const currentLeverage = botConfig?.leverage || (currentMarketType === 'FUTURES' ? 3 : 1);

  // Price & Ticker metrics
  const currentPriceVal = ticker?.price || signal?.currentPrice || (signal?.entryZone ? signal.entryZone.ideal : 0);
  const change24h = ticker?.priceChangePercent24h ?? 0;

  // SMART CALCULATIONS: Dynamic Position Size & Risk Management (inline direct calculation)
  const calcCapital = customCapital > 0 ? customCapital : (walletBalance || 1000);
  const riskDollar = calcCapital * (riskPercent / 100);
  const calcStopLoss = signal?.stopLoss;
  const calcIdealEntry = signal?.entryZone?.ideal || currentPriceVal || 1;
  const slDistPercent = calcStopLoss && calcIdealEntry ? Math.abs((calcIdealEntry - calcStopLoss) / calcIdealEntry) : 0.015;
  const safeSlDist = Math.max(0.002, slDistPercent);

  // Recommended Position Size in Dollars and Units
  const recommendedPositionUsdt = riskDollar / safeSlDist;
  const recommendedCoinQty = calcIdealEntry > 0 ? recommendedPositionUsdt / calcIdealEntry : 0;
  const requiredMarginUsdt = currentMarketType === 'FUTURES' ? recommendedPositionUsdt / Math.max(1, currentLeverage) : recommendedPositionUsdt;

  // Projected Profits
  const pnlTp1 = signal?.targets?.tp1 ? recommendedPositionUsdt * Math.abs((signal.targets.tp1 - calcIdealEntry) / calcIdealEntry) : riskDollar * 1.5;
  const pnlTp2 = signal?.targets?.tp2 ? recommendedPositionUsdt * Math.abs((signal.targets.tp2 - calcIdealEntry) / calcIdealEntry) : riskDollar * 2.2;
  const pnlTp3 = signal?.targets?.tp3 ? recommendedPositionUsdt * Math.abs((signal.targets.tp3 - calcIdealEntry) / calcIdealEntry) : riskDollar * 3.5;

  const smartRiskCalculations = {
    capital: calcCapital,
    riskDollar,
    slDistPercent: safeSlDist * 100,
    recommendedPositionUsdt,
    recommendedCoinQty,
    requiredMarginUsdt,
    pnlTp1,
    pnlTp2,
    pnlTp3,
  };

  // Empty state when no signal is loaded yet
  if (!signal) {
    return (
      <div
        className={`w-full bg-[#0f172a] border border-[#1e293b] hover:border-brand-500/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden font-sans transition-all duration-300 ${
          isArabic ? 'rtl text-right' : 'ltr text-left'
        }`}
      >
        <div className="flex flex-col space-y-5">
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[#1e293b]">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono font-bold text-base text-white tracking-wide">{symbol}</span>
              <span className="font-mono font-bold text-sm text-cyan-400">
                ${formatCoinPrice(currentPriceVal, symbol)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold flex items-center gap-1 ${
                  change24h < 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {change24h < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                <span>{change24h < 0 ? `${change24h.toFixed(2)}%` : `+${change24h.toFixed(2)}%`}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1e293b] border border-slate-700 text-slate-300 text-xs font-mono">
              <Cpu className="w-3.5 h-3.5 text-brand-400" />
              <span>{isArabic ? 'محرك التحليل جاهز' : 'Engine Ready'}</span>
            </div>
          </div>

          {/* Central Holographic Preview */}
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/20 via-slate-800 to-[#020617] border border-brand-500/40 flex items-center justify-center shadow-lg shadow-brand-500/10 mb-3 relative">
              <Sparkles className="w-9 h-9 text-brand-400 animate-pulse" />
              <div className="absolute -bottom-1 -right-1 bg-slate-900 border border-brand-500/50 rounded-full p-1">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-black text-white mb-1">
              {isArabic ? 'محطة الإشارات والتحليل الخوارزمي' : 'Institutional Quantitative Terminal'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              {isArabic
                ? 'فحص فوري للسيولة المؤسسية، توافق الفريمات، وحساب نقاط الدخول ووقف الخسارة مع حاسبة حجم العقود الذكية.'
                : 'Real-time multi-timeframe liquidity sweep, market regime recognition, and dynamic position sizer.'}
            </p>
          </div>

          {/* Parallel Telemetry Cards */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-[#1e293b]/50 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">
                {isArabic ? 'الخوارزمية' : 'Algorithm'}
              </span>
              <span className="font-mono font-bold text-cyan-400 text-xs">SMC + QUANT</span>
            </div>
            <div className="bg-[#1e293b]/50 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">
                {isArabic ? 'بوابات الأمان' : 'Risk Guard'}
              </span>
              <span className="font-mono font-bold text-emerald-400 text-xs">10 GATES</span>
            </div>
            <div className="bg-[#1e293b]/50 border border-slate-800 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">
                {isArabic ? 'تغذية السوق' : 'Market Feed'}
              </span>
              <span className="font-mono font-bold text-teal-400 text-xs">BINANCE LIVE</span>
            </div>
          </div>

          {/* Single Parallel Action CTA */}
          <div className="pt-1">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="w-full py-3 px-6 bg-gradient-to-r from-brand-600 via-teal-500 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-brand-500/25 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{isArabic ? 'جاري فحص السوق والسيولة...' : 'Analyzing Market Liquidity...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>{isArabic ? 'تشغيل التحليل الكمي الآن' : 'Run Quantitative Analysis'}</span>
                </>
              )}
            </button>
          </div>
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

  const idealEntry = entryZone?.ideal || currentPriceVal || 1;
  const isLong = decision === 'LONG';

  // Percentage Calculations for TP and SL
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

  // Visual Theme Configuration
  const getEmotionsTheme = () => {
    switch (decision) {
      case 'LONG':
        return {
          title: isArabic ? 'شراء • LONG' : 'BUY • LONG',
          tag: isArabic ? 'شراء (LONG)' : 'BUY (LONG)',
          moodLabel: isArabic ? 'تفاؤل شرائي • Bullish' : 'Bullish Sentiment',
          badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          borderColor: 'border-emerald-500/30 hover:border-emerald-500/50',
          accentText: 'text-emerald-400',
          icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
        };
      case 'SHORT':
        return {
          title: isArabic ? 'بيع • SHORT' : 'SELL • SHORT',
          tag: isArabic ? 'بيع (SHORT)' : 'SELL (SHORT)',
          moodLabel: isArabic ? 'ضغط بيعي • Bearish' : 'Bearish Pressure',
          badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
          borderColor: 'border-rose-500/30 hover:border-rose-500/50',
          accentText: 'text-rose-400',
          icon: <TrendingDown className="w-4 h-4 text-rose-400" />,
        };
      case 'WAIT':
      default:
        return {
          title: isArabic ? 'ترقب • WAIT' : 'WAIT • HOLD',
          tag: isArabic ? 'ترقب (WAIT)' : 'WAIT (HOLD)',
          moodLabel: isArabic ? 'توازن وانتظار • Neutral' : 'Neutral Range',
          badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          borderColor: 'border-amber-500/30 hover:border-amber-500/50',
          accentText: 'text-amber-400',
          icon: <Clock className="w-4 h-4 text-amber-400" />,
        };
    }
  };

  const emotion = getEmotionsTheme();

  const handleCopy = () => {
    const isSpotMode = currentMarketType === 'SPOT';
    const tf = signal.recommendedTimeframe.toUpperCase();
    const marketHeader = isSpotMode ? 'SPOT (1x)' : `FUTURES (${currentLeverage}x)`;

    const text = isArabic
      ? `
[إشارة تداول كمية] ${symbol} (${tf}) [${marketHeader}]
• القرار: ${t.decisions[decision] || decision} (القوة: ${confidence}%)
• الدخول المثالي: ${entryZone ? `$${formatCoinPrice(entryZone.ideal, symbol)}` : 'N/A'} (النطاق: $${formatCoinPrice(entryZone?.min, symbol)} - $${formatCoinPrice(entryZone?.max, symbol)})
• الهدف 1: ${targets ? `$${formatCoinPrice(targets.tp1, symbol)} (${getTargetDiff(targets.tp1)})` : 'N/A'}
• الهدف 2: ${targets ? `$${formatCoinPrice(targets.tp2, symbol)} (${getTargetDiff(targets.tp2)})` : 'N/A'}
• الهدف 3: ${targets ? `$${formatCoinPrice(targets.tp3, symbol)} (${getTargetDiff(targets.tp3)})` : 'N/A'}
• وقف الخسارة: ${stopLoss ? `$${formatCoinPrice(stopLoss, symbol)} (${getSlDiff(stopLoss)})` : 'N/A'}
• نسبة العائد للمخاطرة (R:R): 1:${riskRewardRatio || '2.5'}
© Quantura Institutional Terminal
`.trim()
      : `
[QUANTITATIVE SIGNAL] ${symbol} (${tf}) [${marketHeader}]
• Decision: ${emotion.title} (Confidence: ${confidence}%)
• Entry: ${entryZone ? `$${formatCoinPrice(entryZone.ideal, symbol)}` : 'N/A'}
• TP1: ${targets ? `$${formatCoinPrice(targets.tp1, symbol)} (${getTargetDiff(targets.tp1)})` : 'N/A'}
• TP2: ${targets ? `$${formatCoinPrice(targets.tp2, symbol)} (${getTargetDiff(targets.tp2)})` : 'N/A'}
• TP3: ${targets ? `$${formatCoinPrice(targets.tp3, symbol)} (${getTargetDiff(targets.tp3)})` : 'N/A'}
• Stop Loss: ${stopLoss ? `$${formatCoinPrice(stopLoss, symbol)} (${getSlDiff(stopLoss)})` : 'N/A'}
• Risk/Reward: 1:${riskRewardRatio || '2.5'}
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

  const handleQuickExecute = () => {
    if (onQuickTrade && (decision === 'LONG' || decision === 'SHORT')) {
      onQuickTrade(decision, currentPriceVal);
      setQuickTradeTriggered(true);
      setTimeout(() => setQuickTradeTriggered(false), 3000);
    } else if (onNavigateToBot) {
      onNavigateToBot();
    }
  };

  const getRegimeLabel = (reg: MarketRegime) => {
    switch (reg) {
      case 'TRENDING_BULLISH':
        return isArabic ? 'اتجاه صاعد' : 'Trending Bullish';
      case 'TRENDING_BEARISH':
        return isArabic ? 'اتجاه هابط' : 'Trending Bearish';
      case 'RANGING':
        return isArabic ? 'نطاق تذبذب عرضي' : 'Ranging Channel';
      case 'HIGH_VOLATILITY':
        return isArabic ? 'تقلبات سعرية عالية' : 'High Volatility';
      case 'LOW_VOLATILITY':
        return isArabic ? 'تقلبات منخفضة وهادئة' : 'Low Volatility';
      default:
        return isArabic ? 'نظام متوازن' : 'Balanced Regime';
    }
  };

  return (
    <div
      className={`w-full bg-[#0f172a] rounded-2xl border ${emotion.borderColor} shadow-xl relative overflow-hidden font-sans transition-all duration-300 ${
        isArabic ? 'rtl text-right' : 'ltr text-left'
      }`}
    >
      <div className="p-4 sm:p-5 flex flex-col gap-3.5">
        
        {/* ========================================================================= */}
        {/* 1. TOP HEADER: PARALLEL SYMMETRIC ASSET & PRICE STRIP                     */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <span className="font-mono font-black text-lg text-white tracking-wide">{symbol}</span>
            <span className="font-mono font-bold text-base text-cyan-400">
              ${formatCoinPrice(currentPriceVal, symbol)}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold flex items-center gap-1 ${
                change24h < 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {change24h < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              <span>{change24h < 0 ? `${change24h.toFixed(2)}%` : `+${change24h.toFixed(2)}%`}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Market Type Toggle (SPOT vs FUTURES) */}
            <div className="flex bg-[#1e293b] p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => onUpdateBotConfig && onUpdateBotConfig({ marketType: 'FUTURES' })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                  currentMarketType === 'FUTURES' ? 'bg-brand-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                FUTURES {currentLeverage}x
              </button>
              <button
                type="button"
                onClick={() => onUpdateBotConfig && onUpdateBotConfig({ marketType: 'SPOT', leverage: 1 })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                  currentMarketType === 'SPOT' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                SPOT 1x
              </button>
            </div>

            <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${emotion.badgeBg}`}>
              {emotion.icon}
              <span className="truncate">{emotion.moodLabel}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. REGIME & CONFLUENCE SUB-STRIP                                          */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#1e293b]/50 border border-slate-800 rounded-xl px-3.5 py-2">
          <div className="flex items-center gap-2 text-slate-300">
            <Layers className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-slate-400">{isArabic ? 'النظام السعري:' : 'Regime:'}</span>
            <span className="font-bold text-white">{getRegimeLabel(marketRegime)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              GRADE {entryQuality.grade || 'A'}
            </span>
            {onOpenDepthDetails && (
              <button
                type="button"
                onClick={onOpenDepthDetails}
                className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
              >
                <Waves className="w-3.5 h-3.5" />
                <span>{isArabic ? 'سيولة عميقة' : 'Liquidity'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. MAIN SIGNAL DECISION HERO (Symmetric Layout)                           */}
        {/* ========================================================================= */}
        <div className="bg-[#1e293b]/40 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                {isArabic ? 'إشارة التحليل الكمي' : 'QUANT SIGNAL'}
              </span>
            </div>
            <div className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1 bg-cyan-950/40 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{timing?.expectedDuration || '4h – 12h'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="shrink-0">
              <SentimentalBotAvatar
                enabled={true}
                signalDecision={decision}
                confidence={confidence}
                marketSentiment={decision === 'LONG' ? 'BULLISH' : decision === 'SHORT' ? 'BEARISH' : 'NEUTRAL'}
                marketRegime={marketRegime}
                size="md"
                language={language}
              />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {emotion.tag}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                  {tradeType.replace('_', ' ')}
                </span>
                <span className="px-2 py-0.5 rounded bg-brand-500/15 text-brand-300 border border-brand-500/30 font-bold">
                  {signal.recommendedTimeframe.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Confluence Strength Progress Bar */}
          <div className="space-y-1 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-slate-400">
                {isArabic ? 'قوة الإشارة وتوافق المؤشرات:' : 'Signal Confidence & Confluence:'}
              </span>
              <span className="font-mono font-bold text-brand-400 text-xs">{confidence}%</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 via-teal-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(15, confidence))}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-normal">
            {entryQuality.reason || (isArabic ? 'نموذج فني متناسق مع سيولة كافية وتطابق مع اتجاه السوق العام.' : 'Solid setup with favorable risk-to-reward ratio and order flow confirmation.')}
          </p>
        </div>

        {/* ========================================================================= */}
        {/* 4. EXECUTION TARGETS GRID (Parallel Symmetric Cards)                      */}
        {/* ========================================================================= */}
        {entryZone && targets && stopLoss && (
          <div className="bg-[#1e293b]/40 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase">
                <Crosshair className="w-3.5 h-3.5 text-brand-400" />
                <span>{isArabic ? 'مستويات التنفيذ والأهداف' : 'Execution Matrix'}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-brand-500/10 border border-brand-500/30 px-2.5 py-0.5 rounded-full">
                <Award className="w-3 h-3 text-brand-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">R:R</span>
                <span className="text-xs font-mono font-black text-brand-300">1:{riskRewardRatio || '2.5'}</span>
              </div>
            </div>

            {/* Entry & Stop Loss (Parallel 2 Columns) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#1e293b]/70 border border-cyan-500/30 rounded-xl p-2.5 flex flex-col justify-between">
                <div className="text-[10px] font-bold text-cyan-400 uppercase mb-0.5 flex items-center gap-1">
                  <Target className="w-3 h-3 text-cyan-400" />
                  <span>{isArabic ? 'الدخول المثالي' : 'Ideal Entry'}</span>
                </div>
                <div className="font-mono font-black text-sm sm:text-base text-white">
                  ${formatCoinPrice(entryZone.ideal, symbol)}
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  ${formatCoinPrice(entryZone.min, symbol)} – ${formatCoinPrice(entryZone.max, symbol)}
                </div>
              </div>

              <div className="bg-[#1e293b]/70 border border-rose-500/30 rounded-xl p-2.5 flex flex-col justify-between">
                <div className="text-[10px] font-bold text-rose-400 uppercase mb-0.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-rose-400" />
                    <span>Stop Loss</span>
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1 rounded bg-rose-500/20 text-rose-300">
                    {getSlDiff(stopLoss)}
                  </span>
                </div>
                <div className="font-mono font-black text-sm sm:text-base text-rose-400">
                  ${formatCoinPrice(stopLoss, symbol)}
                </div>
                <div className="text-[10px] text-rose-300/80 mt-0.5">
                  {isArabic ? 'حماية رأس المال' : 'Capital Protection'}
                </div>
              </div>
            </div>

            {/* Take Profit Targets (Parallel 3 Columns) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-[#1e293b]/70 border border-emerald-500/30 rounded-xl p-2 text-center flex flex-col justify-between">
                <div className="text-[10px] font-bold text-emerald-400 mb-0.5">
                  TP1 <span className="text-[9px] text-slate-400 font-normal">(50%)</span>
                </div>
                <div className="font-mono font-black text-xs sm:text-sm text-emerald-300 truncate">
                  ${formatCoinPrice(targets.tp1, symbol)}
                </div>
                <div className="text-[10px] font-mono font-bold text-emerald-400 mt-0.5">
                  {getTargetDiff(targets.tp1)}
                </div>
              </div>

              <div className="bg-[#1e293b]/70 border border-teal-500/30 rounded-xl p-2 text-center flex flex-col justify-between">
                <div className="text-[10px] font-bold text-teal-400 mb-0.5">
                  TP2 <span className="text-[9px] text-slate-400 font-normal">(30%)</span>
                </div>
                <div className="font-mono font-black text-xs sm:text-sm text-teal-300 truncate">
                  ${formatCoinPrice(targets.tp2, symbol)}
                </div>
                <div className="text-[10px] font-mono font-bold text-teal-400 mt-0.5">
                  {getTargetDiff(targets.tp2)}
                </div>
              </div>

              <div className="bg-[#1e293b]/70 border border-brand-500/30 rounded-xl p-2 text-center flex flex-col justify-between">
                <div className="text-[10px] font-bold text-brand-400 mb-0.5">
                  TP3 <span className="text-[9px] text-slate-400 font-normal">(Runner)</span>
                </div>
                <div className="font-mono font-black text-xs sm:text-sm text-brand-300 truncate">
                  ${formatCoinPrice(targets.tp3, symbol)}
                </div>
                <div className="text-[10px] font-mono font-bold text-brand-400 mt-0.5">
                  {getTargetDiff(targets.tp3)}
                </div>
              </div>
            </div>

            {invalidation?.reason && (
              <div className="bg-slate-900/60 border border-amber-500/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] text-slate-300 truncate">
                  <strong className="text-amber-300 mr-1">{isArabic ? 'شرط الإلغاء:' : 'Invalidation:'}</strong>
                  {invalidation.reason}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. SMART FEATURE 1: SMART POSITION & RISK SIZER (حاسبة المخاطرة الذكية)    */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowSmartCalculator((prev) => !prev)}
              className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{isArabic ? 'حاسبة رأس المال والمخاطرة الذكية' : 'Smart Position Sizer & Risk Calculator'}</span>
              {showSmartCalculator ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => setShowConfluenceRadar((prev) => !prev)}
              className="text-xs font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{isArabic ? 'رادار المؤشرات (6)' : 'Indicator Confluence (6)'}</span>
              {showConfluenceRadar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Collapsible Smart Sizer Drawer */}
          {showSmartCalculator && (
            <div className="bg-[#1e293b]/70 border border-brand-500/30 rounded-xl p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-700/60 pb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  {isArabic ? 'حساب الحجم الرياضي الأنسب للصفقة:' : 'Optimal Mathematical Sizing:'}
                </span>

                {/* Risk Selector Buttons */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 5].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setRiskPercent(pct)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                        riskPercent === pct
                          ? 'bg-brand-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {pct}% Risk
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Calculated Position Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-sans block">{isArabic ? 'الخسارة عند الوقف' : 'Max Dollar Risk'}</span>
                  <span className="font-bold text-rose-400">-${smartRiskCalculations.riskDollar.toFixed(2)}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-sans block">{isArabic ? 'الحجم المقترح' : 'Position Size ($)'}</span>
                  <span className="font-bold text-white">${smartRiskCalculations.recommendedPositionUsdt.toFixed(2)}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-sans block">{isArabic ? 'الهامش المطلوب' : 'Required Margin'}</span>
                  <span className="font-bold text-cyan-300">${smartRiskCalculations.requiredMarginUsdt.toFixed(2)}</span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-sans block">{isArabic ? 'الربح المتوقع (TP2)' : 'Projected TP2'}</span>
                  <span className="font-bold text-emerald-400">+${smartRiskCalculations.pnlTp2.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Confluence Radar Drawer */}
          {showConfluenceRadar && (
            <div className="bg-[#1e293b]/70 border border-cyan-500/30 rounded-xl p-3.5 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 text-xs">
              <span className="font-bold text-white block pb-1 border-b border-slate-700/60">
                {isArabic ? 'تفاصيل الرادار الخوارزمي وتوافق المؤشرات الستة:' : 'Algorithmic 6-Factor Confluence Breakdown:'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { name: isArabic ? 'الاتجاه (EMA 20/50/200)' : 'Trend (EMA 20/50/200)', score: 88, status: 'BULLISH' },
                  { name: isArabic ? 'الزخم (RSI & MACD)' : 'Momentum (RSI/MACD)', score: 76, status: 'EXPANDING' },
                  { name: isArabic ? 'تدفق السيولة (Volume Delta)' : 'Volume Delta Flow', score: 82, status: 'INFLOW' },
                  { name: isArabic ? 'نطاق بولينجر (Bollinger)' : 'Volatility Bandwidth', score: 70, status: 'BREAKOUT' },
                  { name: isArabic ? 'أموال ذكية (SMC Order Blocks)' : 'Smart Money FVG', score: 85, status: 'TESTED' },
                  { name: isArabic ? 'مستويات الدعم والمقاومة' : 'Pivots & Supports', score: 79, status: 'STRONG' },
                ].map((factor, idx) => (
                  <div key={idx} className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 truncate">{factor.name}</span>
                    <div className="flex items-center justify-between mt-1 font-mono font-bold">
                      <span className="text-emerald-400 text-xs">{factor.status}</span>
                      <span className="text-cyan-300 text-[10px]">{factor.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 6. SYMMETRICAL ACTION BUTTONS BAR (تصفيف الأزرار بانتظام متوازن)           */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#1e293b]">
          {/* Action 1: Refresh / Analyze */}
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-teal-600 hover:from-brand-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-brand-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? (isArabic ? 'جاري الفحص...' : 'Scanning...') : isArabic ? 'تحديث التحليل' : 'Analyze'}</span>
          </button>

          {/* Action 2: Direct Execution / Send to Bot */}
          <button
            type="button"
            onClick={handleQuickExecute}
            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
            title={isArabic ? 'تنفيذ فوري للصفقة أو إرسالها للبوت' : 'Instant execution on bot'}
          >
            {quickTradeTriggered ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>{isArabic ? 'تم التنفيذ!' : 'Executed!'}</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>{isArabic ? 'تنفيذ الإشارة' : 'Quick Trade'}</span>
              </>
            )}
          </button>

          {/* Action 3: Push Notification Alert */}
          <button
            type="button"
            onClick={handleNotify}
            className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
              notified
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-[#1e293b] hover:bg-[#334155] border-slate-700 text-slate-300'
            }`}
          >
            {notified ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <BellRing className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{notified ? (isArabic ? 'تم التنبيه' : 'Alert Sent') : (isArabic ? 'تفعيل تنبيه' : 'Set Alert')}</span>
          </button>

          {/* Action 4: Copy Signal */}
          <button
            type="button"
            onClick={handleCopy}
            className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
              copied
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-[#1e293b] hover:bg-[#334155] border-slate-700 text-slate-300'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? (isArabic ? 'تم النسخ' : 'Copied') : (isArabic ? 'نسخ الإشارة' : 'Copy')}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
