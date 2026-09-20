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
        className={`w-full max-w-xl mx-auto bg-slate-900/35 backdrop-blur-xl border border-slate-700/50 hover:border-cyan-500/40 rounded-2xl p-5 sm:p-7 shadow-2xl relative overflow-hidden font-sans transition-all duration-500 group ${
          isArabic ? 'rtl text-right' : 'ltr text-left'
        }`}
        style={{
          boxShadow: '0 12px 40px 0 rgba(6, 182, 212, 0.10)',
        }}
      >
        {/* 🎭 DYNAMIC BACKGROUND EMOTIONS AURA LAYERS */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-15%] left-[20%] w-72 h-72 bg-cyan-500/12 rounded-full blur-3xl animate-emotion-aura" />
          <div className="absolute bottom-[-15%] right-[15%] w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-emotion-aura" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] opacity-25" />
        </div>

        {/* 🌟 SUBTLE TOP BEVEL HIGHLIGHT */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col space-y-5">
          
          {/* 1. TOP HEADER: Pair + Live Price + 24h Change + Robot Mood Capsule */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-800/70">
            {/* Pair & Price */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute"></span>
              </div>
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

            {/* Elegant Robot Emotion Badge */}
            <div className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="truncate">
                {isArabic ? 'مشاعر الروبوت: متفائل ونشط' : 'Bot Mood: Active & Hyped'}
              </span>
            </div>
          </div>

          {/* 2. CENTERPIECE: QUANTUM NEURAL AI INTELLIGENCE CORE */}
          <div className="flex flex-col items-center text-center py-2">
            
            {/* Holographic Glowing Quantum AI Core Avatar */}
            <div className="relative mb-4 group/avatar">
              {/* Outer Orbit Glow */}
              <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-cyan-500/25 via-teal-500/20 to-emerald-500/25 blur-xl group-hover/avatar:opacity-100 opacity-75 transition duration-500 animate-pulse" />
              
              {/* Main Avatar Circular Frame */}
              <div className="relative w-22 h-22 sm:w-26 sm:h-26 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-950 to-[#020617] border border-cyan-500/40 flex items-center justify-center shadow-2xl backdrop-blur-md p-2">
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg overflow-visible">
                  <defs>
                    <filter id="coreGlowTerminal" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <radialGradient id="singularityGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="35%" stopColor="#06b6d4" />
                      <stop offset="70%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Corner HUD Reticle Brackets */}
                  <g stroke="#06b6d4" strokeWidth="1.2" opacity="0.6" fill="none">
                    <path d="M 6 18 L 6 6 L 18 6" />
                    <path d="M 94 18 L 94 6 L 82 6" />
                    <path d="M 6 82 L 6 94 L 18 94" />
                    <path d="M 94 82 L 94 94 L 82 94" />
                  </g>

                  {/* Outer Gyro Ring with Calibrated Marks */}
                  <circle cx="50" cy="50" r="43" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="2 6" opacity="0.6" />
                  <line x1="50" y1="5" x2="50" y2="9" stroke="#38bdf8" strokeWidth="1.8" />
                  <line x1="50" y1="91" x2="50" y2="95" stroke="#38bdf8" strokeWidth="1.8" />
                  <line x1="5" y1="50" x2="9" y2="50" stroke="#38bdf8" strokeWidth="1.8" />
                  <line x1="91" y1="50" x2="95" y2="50" stroke="#38bdf8" strokeWidth="1.8" />

                  {/* Counter-Rotating Dashed Quantum Orbit */}
                  <circle
                    cx="50"
                    cy="50"
                    r="37"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    strokeDasharray="9 5 3 5"
                    className="origin-center animate-[spin_10s_linear_infinite]"
                    opacity="0.8"
                  />

                  {/* Inner Optical Reticle */}
                  <circle cx="50" cy="50" r="26" fill="#030712" stroke="#1e293b" strokeWidth="1.5" />

                  {/* Synaptic Neural Lattice & Nodes */}
                  <g stroke="#38bdf8" strokeWidth="1" opacity="0.5">
                    <line x1="50" y1="26" x2="71" y2="38" />
                    <line x1="71" y1="38" x2="71" y2="62" />
                    <line x1="71" y1="62" x2="50" y2="74" />
                    <line x1="50" y1="74" x2="29" y2="62" />
                    <line x1="29" y1="62" x2="29" y2="38" />
                    <line x1="29" y1="38" x2="50" y2="26" />
                    {/* Radial Connectors */}
                    <line x1="50" y1="26" x2="50" y2="50" strokeDasharray="2 2" />
                    <line x1="71" y1="38" x2="50" y2="50" strokeDasharray="2 2" />
                    <line x1="71" y1="62" x2="50" y2="50" strokeDasharray="2 2" />
                    <line x1="50" y1="74" x2="50" y2="50" strokeDasharray="2 2" />
                    <line x1="29" y1="62" x2="50" y2="50" strokeDasharray="2 2" />
                    <line x1="29" y1="38" x2="50" y2="50" strokeDasharray="2 2" />
                  </g>

                  {/* Synaptic Nodes */}
                  <circle cx="50" cy="26" r="2" fill="#34d399" />
                  <circle cx="71" cy="38" r="2" fill="#38bdf8" />
                  <circle cx="71" cy="62" r="2" fill="#34d399" />
                  <circle cx="50" cy="74" r="2" fill="#38bdf8" />
                  <circle cx="29" cy="62" r="2" fill="#34d399" />
                  <circle cx="29" cy="38" r="2" fill="#38bdf8" />

                  {/* Central Radiant AI Singularity Aperture */}
                  <circle cx="50" cy="50" r="16" fill="url(#singularityGrad)" filter="url(#coreGlowTerminal)" />
                  <circle cx="50" cy="50" r="12" fill="none" stroke="#34d399" strokeWidth="1.5" opacity="0.9" />

                  {/* Dynamic Radar Sweep Arc */}
                  <path
                    d="M 50 50 L 63 39 A 16 16 0 0 1 66 50 Z"
                    fill="#38bdf8"
                    opacity="0.35"
                    className="origin-center animate-[spin_3s_linear_infinite]"
                  />

                  {/* Laser Singularity Core */}
                  <circle cx="50" cy="50" r="4.5" fill="#34d399" className="animate-pulse" />
                  <circle cx="50" cy="50" r="2" fill="#ffffff" />

                  {/* High-Tech Core Micro Badge */}
                  <text
                    x="50"
                    y="84"
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="6"
                    fontFamily="monospace"
                    fontWeight="bold"
                    letterSpacing="1"
                    opacity="0.9"
                  >
                    QUANT·AI
                  </text>
                </svg>

                {/* Status Indicator */}
                <div className="absolute -bottom-1 -right-1 bg-slate-950 border border-cyan-500/50 rounded-full p-1 shadow-md">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Title & Description */}
            <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 tracking-tight flex items-center justify-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span>{isArabic ? 'محطة التحليل الكمي الذكي' : 'Terminal Quantitatif Institutionnel'}</span>
            </h3>

            <p className="text-xs sm:text-sm text-slate-300/90 max-w-md mx-auto leading-relaxed font-normal">
              {isArabic
                ? 'نظام ذكي متقدم لرصد السيولة المؤسسية، فحص الفرايمات، وتوليد إشارات الدخول والوقف تلقائياً وفق أدق المعايير.'
                : 'Scannage multi-timeframes, cartographie de la liquidité et calcul prédictif des probabilités de gain.'}
            </p>
          </div>

          {/* 3. MODERN TELEMETRY MICRO-CAPSULES (3 Balanced Pills) */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5 flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
                {isArabic ? 'محرك التحليل' : 'Moteur IA'}
              </span>
              <span className="font-mono font-bold text-cyan-400 text-xs">
                SMC + QUANT
              </span>
            </div>

            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5 flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
                {isArabic ? 'حماية المخاطر' : 'Risk Guard'}
              </span>
              <span className="font-mono font-bold text-emerald-400 text-xs">
                10 GATES ARMED
              </span>
            </div>

            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5 flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
                {isArabic ? 'تغذية السوق' : 'Flux Marché'}
              </span>
              <span className="font-mono font-bold text-teal-400 text-xs">
                BINANCE LIVE
              </span>
            </div>
          </div>

          {/* 4. MODERN ACTION CTA BUTTON */}
          <div className="pt-1">
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-[0_4px_20px_rgba(6,182,212,0.25)] hover:shadow-[0_6px_28px_rgba(6,182,212,0.35)] transition-all active:scale-[0.99] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer border-t border-white/30"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span className="font-extrabold">{isArabic ? 'جاري التحليل واستخراج الإشارة...' : 'Calcul de l\'opportunité en cours...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span className="font-extrabold">{isArabic ? 'تشغيل التحليل الكمي الآن' : 'Lancer l\'Analyse Quantitative'}</span>
                </>
              )}
            </button>
            <div className="text-center mt-2 flex items-center justify-center gap-1.5">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span className="text-[11px] text-slate-400">
                {isArabic ? 'جاهز لحساب نقاط الدخول ووقف الخسارة ونسبة العائد للمخاطرة' : 'Prêt à calculer les niveaux optimaux de TP, SL et Ratio R/R'}
              </span>
            </div>
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
          tag: isArabic ? 'شراء (LONG)' : 'ACHAT (LONG)',
          moodLabel: isArabic ? 'مشاعر السوق: تفاؤل وإقبال (Greed)' : 'Sentiment: Euphorie & Greed',
          moodBadgeBg: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300',
          moodIcon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
          glowColor: 'rgba(16, 185, 129, 0.22)',
          cardBorder: 'border-emerald-500/30 hover:border-emerald-500/50',
          bgRadial: 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(6, 182, 212, 0.16), rgba(16, 185, 129, 0.12), rgba(13, 20, 36, 0.40))',
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
          tag: isArabic ? 'بيع (SHORT)' : 'VENTE (SHORT)',
          moodLabel: isArabic ? 'مشاعر السوق: حذر وخوف (Fear)' : 'Sentiment: Pression Vendeuse (Fear)',
          moodBadgeBg: 'bg-rose-500/15 border-rose-500/35 text-rose-300',
          moodIcon: <TrendingDown className="w-3.5 h-3.5 text-rose-400" />,
          glowColor: 'rgba(244, 63, 94, 0.22)',
          cardBorder: 'border-rose-500/30 hover:border-rose-500/50',
          bgRadial: 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(244, 63, 94, 0.14), rgba(168, 85, 247, 0.10), rgba(13, 20, 36, 0.40))',
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
          tag: isArabic ? 'ترقب (WAIT)' : 'ATTENTE (WAIT)',
          moodLabel: isArabic ? 'مشاعر السوق: توازن وترقب (Neutral)' : 'Sentiment: Phase d\'Attente (Neutral)',
          moodBadgeBg: 'bg-amber-500/15 border-amber-500/35 text-amber-300',
          moodIcon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
          glowColor: 'rgba(245, 158, 11, 0.18)',
          cardBorder: 'border-amber-500/30 hover:border-amber-500/50',
          bgRadial: 'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(245, 158, 11, 0.12), rgba(59, 130, 246, 0.08), rgba(13, 20, 36, 0.40))',
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
[إشارة تداول كمية] ${symbol} (${tf}) [${marketHeader}]
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
[SIGNAL QUANTITATIF] ${symbol} (${tf}) [${marketHeader}]
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
      className={`w-full max-w-xl mx-auto rounded-2xl border ${emotion.cardBorder} bg-slate-900/35 backdrop-blur-xl shadow-2xl relative overflow-hidden font-sans transition-all duration-300 ${
        isArabic ? 'rtl text-right' : 'ltr text-left'
      }`}
      style={{
        boxShadow: `0 8px 32px 0 ${emotion.glowColor}`,
      }}
    >
      {/* 🌟 SUBTLE TOP BEVEL HIGHLIGHT */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

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
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
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
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border shadow-sm backdrop-blur-md ${emotion.moodBadgeBg}`}>
            {emotion.moodIcon}
            <span className="truncate">{emotion.moodLabel}</span>
          </div>
        </div>

        {/* 2. REGIME & QUALITY INFO STRIP (Translucent Micro Glass Bar) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-950/35 backdrop-blur-md border border-white/[0.06] rounded-xl px-3.5 py-2">
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

        {/* 3. MAIN SIGNAL HERO (Sentimental Robot + Decision + Confluence Bar) */}
        <div className="bg-slate-950/35 backdrop-blur-md border border-white/[0.08] rounded-xl p-3.5 sm:p-4 space-y-3 shadow-inner">
          {/* Header of Signal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isArabic ? 'إشارة التحليل الكمي' : 'SIGNAL QUANTITATIF'}
              </span>
            </div>
            <div className="text-xs font-mono font-semibold text-cyan-300 flex items-center gap-1 bg-cyan-950/40 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{timing?.expectedDuration || '4h – 12h'}</span>
            </div>
          </div>

          {/* Main Decision Title & Sentimental Robot Avatar */}
          <div className="flex items-center gap-3.5">
            {/* Sentimental Robot Visor Core */}
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

            {/* Decision & Action Tags */}
            <div className="space-y-1.5 min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {emotion.tag}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60">
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
          <div className="space-y-1 pt-1 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-slate-400">
                {isArabic ? 'قوة الإشارة وتوافق المؤشرات:' : 'Force du Signal & Confluence:'}
              </span>
              <span className="font-mono font-bold text-cyan-400 text-xs">{confidence}%</span>
            </div>
            <div className="w-full bg-slate-900/80 h-2 rounded-full overflow-hidden border border-white/[0.06] p-[1px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-700 relative"
                style={{ width: `${Math.min(100, Math.max(15, confidence))}%` }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 rounded-full animate-pulse" />
              </div>
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
          <div className="bg-slate-950/35 backdrop-blur-md border border-white/[0.08] rounded-xl p-3.5 space-y-2.5">
            {/* R:R Header Badge */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
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
              <div className="bg-slate-900/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-2.5">
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
              <div className="bg-slate-900/50 backdrop-blur-sm border border-rose-500/30 rounded-lg p-2.5">
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
              <div className="bg-slate-900/50 backdrop-blur-sm border border-emerald-500/30 rounded-lg p-2 text-center">
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

              <div className="bg-slate-900/50 backdrop-blur-sm border border-emerald-500/30 rounded-lg p-2 text-center">
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

              <div className="bg-slate-900/50 backdrop-blur-sm border border-emerald-500/30 rounded-lg p-2 text-center">
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
              <div className="bg-slate-900/40 border border-amber-500/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs">
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
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer backdrop-blur-md ${
              currentMarketType === 'SPOT'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 border border-white/[0.08] hover:border-emerald-500/30'
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
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer backdrop-blur-md ${
              currentMarketType === 'FUTURES'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 border border-white/[0.08] hover:border-cyan-500/30'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>FUTURES</span>
            <span className="text-[11px] font-mono opacity-80">{currentLeverage}×</span>
          </button>
        </div>

        {/* 6. ACTION BUTTONS & CTA (Notify, Copy, Refresh) */}
        <div className="space-y-2 pt-1 border-t border-white/[0.08]">
          <div className="grid grid-cols-2 gap-2">
            {/* Notification Button */}
            <button
              onClick={handleNotify}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm backdrop-blur-md ${
                notified
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950/50 hover:bg-slate-900/80 border-white/[0.08] hover:border-cyan-500/40 text-cyan-200'
              }`}
            >
              {notified ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{isArabic ? 'تم التنبيه' : 'Alerte Active'}</span>
                </>
              ) : (
                <>
                  <BellRing className="w-4 h-4 text-cyan-400" />
                  <span>{isArabic ? 'تفعيل تنبيه' : 'Notification'}</span>
                </>
              )}
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm backdrop-blur-md ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950/50 hover:bg-slate-900/80 text-slate-200 border-white/[0.08] hover:border-slate-600'
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
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 active:scale-[0.99] text-slate-950 text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(6,182,212,0.25)] hover:shadow-[0_6px_32px_rgba(6,182,212,0.35)] transition disabled:opacity-50 cursor-pointer border-t border-white/30"
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
