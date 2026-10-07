import React, { useState, useEffect, memo, useMemo } from 'react';
import { Language } from '../types';

export interface SentimentalBotAvatarProps {
  enabled: boolean;
  floatingPnlUsdt?: number;
  floatingPnlPercent?: number;
  realizedPnlUsdt?: number;
  marketSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'FEAR' | 'GREED' | 'EXTREME_GREED' | 'EXTREME_FEAR' | string;
  marketRegime?: string;
  activePositionsCount?: number;
  signalDecision?: 'LONG' | 'SHORT' | 'WAIT' | 'NEUTRAL' | string;
  confidence?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showMoodBadge?: boolean;
  language?: Language;
  circuitBreakerTriggered?: boolean;
  onClick?: () => void;
  className?: string;
}

export type BotMood = 
  | 'SUPER_PROFIT' 
  | 'HAPPY' 
  | 'BULLISH' 
  | 'BEARISH' 
  | 'ANGRY' 
  | 'CIRCUIT_BREAKER' 
  | 'SCANNING' 
  | 'SLEEPING' 
  | 'SURPRISED';

const SentimentalBotAvatarComponent: React.FC<SentimentalBotAvatarProps> = ({
  enabled,
  floatingPnlUsdt = 0,
  floatingPnlPercent = 0,
  realizedPnlUsdt = 0,
  marketSentiment = 'NEUTRAL',
  activePositionsCount = 0,
  signalDecision,
  confidence = 50,
  size = 'md',
  showMoodBadge = false,
  language = 'ar',
  circuitBreakerTriggered = false,
  onClick,
  className = '',
}) => {
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  const [isBlinking, setIsBlinking] = useState(false);
  const [pokeReaction, setPokeReaction] = useState<boolean>(false);

  // Natural organic blinking interval
  useEffect(() => {
    let timeoutId: any;
    const interval = setInterval(() => {
      setIsBlinking(true);
      timeoutId = setTimeout(() => setIsBlinking(false), 160);
    }, 4200);
    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Multi-tier Harmonization Matrix: Bot Position Performance + Terminal Market Sentiment
  const currentMood: BotMood = useMemo(() => {
    if (pokeReaction) return 'SURPRISED';
    if (!enabled) return 'SLEEPING';
    if (circuitBreakerTriggered) return 'CIRCUIT_BREAKER';

    const netPnl = floatingPnlUsdt !== 0 ? floatingPnlUsdt : (floatingPnlPercent !== 0 ? floatingPnlPercent : realizedPnlUsdt);

    // 1. High-Priority: Bot Active Trades PnL Behavior
    if (activePositionsCount > 0) {
      if (netPnl >= 1.5 || floatingPnlPercent >= 1.2) {
        return 'SUPER_PROFIT';
      }
      if (netPnl > 0.05 || floatingPnlPercent > 0.05) {
        return 'HAPPY';
      }
      if (netPnl < -0.05 || floatingPnlPercent < -0.05) {
        return 'ANGRY'; // Defensive risk guard mode
      }
    }

    // 2. High Confluence: Terminal Market Momentum & AI Signal Direction
    const upperSentiment = String(marketSentiment || '').toUpperCase();
    const upperDecision = String(signalDecision || '').toUpperCase();

    if (
      upperDecision === 'LONG' || 
      upperSentiment === 'BULLISH' || 
      upperSentiment === 'GREED' || 
      upperSentiment === 'EXTREME_GREED'
    ) {
      if (confidence >= 55) return 'BULLISH';
    }

    if (
      upperDecision === 'SHORT' || 
      upperSentiment === 'BEARISH' || 
      upperSentiment === 'FEAR' || 
      upperSentiment === 'EXTREME_FEAR'
    ) {
      if (confidence >= 55) return 'BEARISH';
    }

    // 3. Fallback for closed/historical PnL or Equilibrium
    if (netPnl > 0.05) return 'HAPPY';
    if (netPnl < -0.05) return 'ANGRY';

    return 'SCANNING';
  }, [
    enabled, 
    circuitBreakerTriggered, 
    floatingPnlUsdt, 
    floatingPnlPercent, 
    realizedPnlUsdt, 
    pokeReaction, 
    activePositionsCount, 
    marketSentiment, 
    signalDecision, 
    confidence
  ]);

  const handleAvatarClick = () => {
    setPokeReaction(true);
    setTimeout(() => setPokeReaction(false), 1400);
    if (onClick) onClick();
  };

  const sizeConfig = {
    xs: { box: 'w-7 h-7 sm:w-8 sm:h-8 p-0.5', badgeText: 'text-[8px]' },
    sm: { box: 'w-9 h-9 sm:w-10 sm:h-10 p-0.5', badgeText: 'text-[9px]' },
    md: { box: 'w-12 h-12 sm:w-14 sm:h-14 p-1 sm:p-1.5', badgeText: 'text-[10px]' },
    lg: { box: 'w-16 h-16 sm:w-20 sm:h-20 p-1.5', badgeText: 'text-xs' },
    xl: { box: 'w-24 h-24 sm:w-28 sm:h-28 p-2', badgeText: 'text-sm' },
  }[size];

  // Visual Themes, HUD Colors & Deep Contextual Intelligence Descriptions
  const moodStyles = {
    SUPER_PROFIT: {
      border: 'border-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,0.35)]',
      bgGradient: 'from-emerald-900/80 via-slate-900 to-slate-950',
      screenBg: '#022c22',
      ledColor: '#34d399',
      antennaColor: '#fbbf24',
      badgeBg: 'bg-gradient-to-r from-emerald-500/25 to-amber-500/25 text-emerald-300 border-emerald-400/50 shadow-sm',
      title: isArabic ? '🚀 انتصار ساحق (Super Profit)' : isEn ? '🚀 Super Profit Confluence' : '🚀 Super Profit Confluence',
      desc: isArabic 
        ? `صفقات البوت في قمة الأرباح (+${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$) مع تأمين الأهداف!` 
        : `Bot hitting major gains (+${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)!`,
    },
    HAPPY: {
      border: 'border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
      bgGradient: 'from-emerald-950/70 via-slate-900 to-slate-950',
      screenBg: '#022c22',
      ledColor: '#34d399',
      antennaColor: '#10b981',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      title: isArabic ? '✨ أداء رابح (In Profit)' : isEn ? '✨ In Profit & Scaling' : '✨ En Profit & Scaled',
      desc: isArabic 
        ? `الصفقات تحقق أرباحاً إيجابية (+${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)` 
        : `Positive trade momentum (+${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)`,
    },
    BULLISH: {
      border: 'border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.25)]',
      bgGradient: 'from-cyan-950/70 via-slate-900 to-slate-950',
      screenBg: '#04222f',
      ledColor: '#38bdf8',
      antennaColor: '#06b6d4',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      title: isArabic ? '📈 تدفق شرائي صاعد (Bullish)' : isEn ? '📈 Bullish Flow Confluence' : '📈 Flux Haussier Bullish',
      desc: isArabic 
        ? 'تحليل المنصة: تدفق السيولة وزخم المؤشرات صاعد' 
        : 'Terminal confluence: Bullish orderbook & positive delta',
    },
    BEARISH: {
      border: 'border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.22)]',
      bgGradient: 'from-amber-950/60 via-slate-900 to-slate-950',
      screenBg: '#271402',
      ledColor: '#fb923c',
      antennaColor: '#f97316',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      title: isArabic ? '📉 ضغط بيعي هابط (Bearish)' : isEn ? '📉 Bearish Pressure Alert' : '📉 Pression Baissière Bearish',
      desc: isArabic 
        ? 'تحليل المنصة: ضغط تصريفي واستعداد لاقتناص الشورت' 
        : 'Terminal confluence: Distribution pressure & Short opportunities',
    },
    ANGRY: {
      border: 'border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.25)]',
      bgGradient: 'from-rose-950/70 via-slate-900 to-slate-950',
      screenBg: '#310413',
      ledColor: '#fb7185',
      antennaColor: '#f43f5e',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      title: isArabic ? '🛡️ درع الحماية (Risk Guard)' : isEn ? '🛡️ Capital Guard / Pullback' : '🛡️ Bouclier Risque / Drawdown',
      desc: isArabic 
        ? `تراجع محسوب (-${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$) تحت رقابة صارمة لوقف الخسارة` 
        : `Controlled drawdown (-${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$) under strict Stop Loss guard`,
    },
    CIRCUIT_BREAKER: {
      border: 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]',
      bgGradient: 'from-red-950/80 via-slate-900 to-slate-950',
      screenBg: '#3b0710',
      ledColor: '#ef4444',
      antennaColor: '#dc2626',
      badgeBg: 'bg-red-500/30 text-red-300 border-red-500/50 animate-pulse',
      title: isArabic ? '⛔ إيقاف وقائي (Circuit Breaker)' : isEn ? '⛔ Circuit Breaker Active' : '⛔ Coupe-Circuit Actif',
      desc: isArabic 
        ? 'تفعيل قاطع الدائرة الوقائي لحماية المحفظة من تقلبات السوق العنيفة' 
        : 'Emergency safety lock activated to protect capital',
    },
    SCANNING: {
      border: 'border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.2)]',
      bgGradient: 'from-cyan-950/50 via-slate-900 to-slate-950',
      screenBg: '#041f2d',
      ledColor: '#38bdf8',
      antennaColor: '#06b6d4',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      title: isArabic ? '⚡ مسح كمي ورصد (Scanning)' : isEn ? '⚡ Quantitative Scan' : '⚡ Analyse Quantitativé',
      desc: isArabic 
        ? 'رصد مستمر للسيولة، الدلتا، وحساب احتمالية الدخول' 
        : 'Continuous real-time orderbook & multi-timeframe analytics',
    },
    SLEEPING: {
      border: 'border-slate-800 shadow-none',
      bgGradient: 'from-slate-900 to-slate-950',
      screenBg: '#090d16',
      ledColor: '#64748b',
      antennaColor: '#475569',
      badgeBg: 'bg-slate-800 text-slate-400 border-slate-700',
      title: isArabic ? '💤 وضع السكون (Standby)' : isEn ? '💤 Bot Standby' : '💤 Bot en Veille',
      desc: isArabic ? 'البوت متوقف مؤقتاً في انتظار التفعيل' : 'Trading Bot is offline/paused',
    },
    SURPRISED: {
      border: 'border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.3)]',
      bgGradient: 'from-amber-950/60 via-slate-900 to-slate-950',
      screenBg: '#271202',
      ledColor: '#fbbf24',
      antennaColor: '#f59e0b',
      badgeBg: 'bg-amber-500/25 text-amber-300 border-amber-500/50',
      title: isArabic ? '🤖 ذكاء متفاعل (Interactive)' : isEn ? '🤖 AI Responsive' : '🤖 IA Réactive',
      desc: isArabic ? 'استجابة حية لتفاعل المستخدم مع محرك البوت' : 'Instant tactile feedback',
    },
  }[currentMood];

  return (
    <div className={`inline-flex flex-col items-center select-none shrink-0 ${className}`}>
      {/* Interactive Avatar Frame with strict GPU boundary and tactile micro-bounce */}
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={handleAvatarClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleAvatarClick();
          }
        }}
        title={`${moodStyles.title} • ${moodStyles.desc} (${isArabic ? 'انقر للتفاعل' : 'Click to interact'})`}
        className={`relative ${sizeConfig.box} rounded-2xl border bg-gradient-to-b ${moodStyles.bgGradient} ${moodStyles.border} flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer overflow-hidden shadow-sm group`}
        style={{ transform: 'translateZ(0)' }}
      >
        {/* Crisp vector robot avatar */}
        <svg
          viewBox="6 2 88 82"
          className="w-full h-full block"
          style={{ shapeRendering: 'geometricPrecision' }}
        >
          {/* Top Antenna & Signal Beacon */}
          <g>
            <line x1="50" y1="20" x2="50" y2="8" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="8" r="4.5" fill={moodStyles.antennaColor} />
            <circle cx="50" cy="8" r="1.8" fill="#ffffff" />
          </g>

          {/* Left & Right Acoustic Ears / Quantum Modules */}
          <rect x="8" y="40" width="8" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <line x1="12" y1="46" x2="12" y2="56" stroke={moodStyles.ledColor} strokeWidth="2" strokeLinecap="round" />

          <rect x="84" y="40" width="8" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <line x1="88" y1="46" x2="88" y2="56" stroke={moodStyles.ledColor} strokeWidth="2" strokeLinecap="round" />

          {/* Head Chassis */}
          <rect x="18" y="22" width="64" height="60" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />

          {/* Forehead status quantum core */}
          <circle cx="50" cy="28" r="2.2" fill={moodStyles.ledColor} opacity="0.9" />

          {/* Visor Screen */}
          <rect
            x="24"
            y="34"
            width="52"
            height="34"
            rx="10"
            fill={moodStyles.screenBg}
            stroke={moodStyles.antennaColor}
            strokeWidth="1.5"
          />

          {/* Visor Gloss Reflection */}
          <path d="M 28 38 Q 50 40 72 38" stroke="#ffffff" strokeWidth="1" opacity="0.25" strokeLinecap="round" fill="none" />

          {/* Dynamic Robot Eyes Synchronized with Market & Bot Behavior */}
          {isBlinking ? (
            <g stroke={moodStyles.ledColor} strokeWidth="3" strokeLinecap="round">
              <line x1="34" y1="51" x2="44" y2="51" />
              <line x1="56" y1="51" x2="66" y2="51" />
            </g>
          ) : currentMood === 'SLEEPING' ? (
            /* Sleeping Mood: Dim calm horizontal lines */
            <g stroke={moodStyles.ledColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.5">
              <line x1="34" y1="51" x2="44" y2="51" />
              <line x1="56" y1="51" x2="66" y2="51" />
            </g>
          ) : currentMood === 'SUPER_PROFIT' ? (
            /* Super Profit Mood: Sparkling Star Eyes (★ ★) */
            <g fill={moodStyles.ledColor}>
              {/* Left Star */}
              <polygon points="39,43 41,48 46,49 42,53 44,58 39,55 34,58 36,53 32,49 37,48" />
              {/* Right Star */}
              <polygon points="61,43 63,48 68,49 64,53 66,58 61,55 56,58 58,53 54,49 59,48" />
              <circle cx="39" cy="51" r="1.5" fill="#ffffff" />
              <circle cx="61" cy="51" r="1.5" fill="#ffffff" />
              {/* Golden Blushing Cheeks */}
              <circle cx="30" cy="57" r="2" fill="#fbbf24" opacity="0.8" />
              <circle cx="70" cy="57" r="2" fill="#fbbf24" opacity="0.8" />
            </g>
          ) : currentMood === 'HAPPY' ? (
            /* Happy / In-Profit Mood: Curved Smiling Arches (⌒ ⌒) */
            <g stroke={moodStyles.ledColor} strokeWidth="3" strokeLinecap="round" fill="none">
              <path d="M 33 53 Q 39 44 45 53" />
              <path d="M 55 53 Q 61 44 67 53" />
              <circle cx="31" cy="57" r="1.8" fill="#34d399" opacity="0.7" stroke="none" />
              <circle cx="69" cy="57" r="1.8" fill="#34d399" opacity="0.7" stroke="none" />
            </g>
          ) : currentMood === 'BULLISH' ? (
            /* Bullish / Upward Trend Mood: Laser Triangle Eyes (▲ ▲) */
            <g fill={moodStyles.ledColor}>
              <polygon points="39,43 46,54 32,54" />
              <polygon points="61,43 68,54 54,54" />
              <circle cx="39" cy="49" r="1.5" fill="#ffffff" />
              <circle cx="61" cy="49" r="1.5" fill="#ffffff" />
            </g>
          ) : currentMood === 'BEARISH' ? (
            /* Bearish / Downward Trend Mood: Downward Triangle Eyes (▼ ▼) */
            <g fill={moodStyles.ledColor}>
              <polygon points="39,57 32,46 46,46" />
              <polygon points="61,57 54,46 68,46" />
              <circle cx="39" cy="51" r="1.5" fill="#ffffff" />
              <circle cx="61" cy="51" r="1.5" fill="#ffffff" />
            </g>
          ) : currentMood === 'ANGRY' ? (
            /* Defensive Risk Guard Mood: Guarded Angled Brow Eyes (\ /) */
            <g stroke={moodStyles.ledColor} strokeWidth="3.2" strokeLinecap="round" fill="none">
              <line x1="33" y1="46" x2="45" y2="54" />
              <line x1="67" y1="46" x2="55" y2="54" />
              {/* Alert under-pupils */}
              <circle cx="39" cy="56" r="1.5" fill="#fb7185" stroke="none" />
              <circle cx="61" cy="56" r="1.5" fill="#fb7185" stroke="none" />
            </g>
          ) : currentMood === 'CIRCUIT_BREAKER' ? (
            /* Circuit Breaker Emergency Mode: Alert Brackets [ ! ] */
            <g stroke={moodStyles.ledColor} strokeWidth="2.5" strokeLinecap="round" fill="none">
              <path d="M 33 45 L 29 45 L 29 57 L 33 57" />
              <line x1="50" y1="44" x2="50" y2="52" strokeWidth="3" />
              <circle cx="50" cy="57" r="1.8" fill={moodStyles.ledColor} stroke="none" />
              <path d="M 67 45 L 71 45 L 71 57 L 67 57" />
            </g>
          ) : currentMood === 'SURPRISED' ? (
            /* Surprised / Poked Interactive Mood: Wide Dilated Eyes (◎ ◎) */
            <g fill="none" stroke={moodStyles.ledColor} strokeWidth="2.5">
              <circle cx="39" cy="51" r="5.5" />
              <circle cx="39" cy="51" r="2.2" fill="#ffffff" stroke="none" />
              <circle cx="61" cy="51" r="5.5" />
              <circle cx="61" cy="51" r="2.2" fill="#ffffff" stroke="none" />
            </g>
          ) : (
            /* Scanning / Equilibrium Mood: High-Tech Radar Target Reticle Eyes */
            <g>
              <circle cx="39" cy="51" r="5.5" fill="#082f49" stroke={moodStyles.ledColor} strokeWidth="2" />
              <circle cx="39" cy="51" r="2.5" fill={moodStyles.ledColor} />
              <circle cx="39" cy="51" r="1" fill="#ffffff" />

              <circle cx="61" cy="51" r="5.5" fill="#082f49" stroke={moodStyles.ledColor} strokeWidth="2" />
              <circle cx="61" cy="51" r="2.5" fill={moodStyles.ledColor} />
              <circle cx="61" cy="51" r="1" fill="#ffffff" />

              {/* Sub-scanning horizontal HUD tick line */}
              <line x1="47" y1="51" x2="53" y2="51" stroke={moodStyles.ledColor} strokeWidth="1.5" opacity="0.6" strokeDasharray="1 1" />
            </g>
          )}

          {/* Chin Grill / Micro Ventilation */}
          <g stroke={moodStyles.ledColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.65">
            <line x1="42" y1="74" x2="42" y2="76" />
            <line x1="47" y1="73" x2="47" y2="77" />
            <line x1="53" y1="73" x2="53" y2="77" />
            <line x1="58" y1="74" x2="58" y2="76" />
          </g>
        </svg>
      </div>

      {/* Mood Badge */}
      {showMoodBadge && (
        <div className="mt-1.5 flex flex-col items-center">
          <span className={`px-2 py-0.5 rounded-full ${sizeConfig.badgeText} font-black uppercase tracking-wider border font-mono ${moodStyles.badgeBg} transition-colors flex items-center gap-1`}>
            <span>{moodStyles.title}</span>
          </span>
        </div>
      )}
    </div>
  );
};

export const SentimentalBotAvatar = memo(SentimentalBotAvatarComponent);
