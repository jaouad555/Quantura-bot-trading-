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
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showMoodBadge?: boolean;
  language?: Language;
  circuitBreakerTriggered?: boolean;
  onClick?: () => void;
  className?: string;
}

export type BotMood = 'HAPPY' | 'ANGRY' | 'SCANNING' | 'SLEEPING' | 'SURPRISED' | 'BULLISH' | 'BEARISH';

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
  language = 'fr',
  circuitBreakerTriggered = false,
  onClick,
  className = '',
}) => {
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  const [isBlinking, setIsBlinking] = useState(false);
  const [pokeReaction, setPokeReaction] = useState<boolean>(false);

  useEffect(() => {
    let timeoutId: any;
    const interval = setInterval(() => {
      setIsBlinking(true);
      timeoutId = setTimeout(() => setIsBlinking(false), 180);
    }, 4500);
    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const currentMood: BotMood = useMemo(() => {
    if (pokeReaction) return 'SURPRISED';
    if (!enabled) return 'SLEEPING';
    if (circuitBreakerTriggered) return 'ANGRY';

    const netPnl = floatingPnlUsdt !== 0 ? floatingPnlUsdt : (floatingPnlPercent !== 0 ? floatingPnlPercent : realizedPnlUsdt);

    if (activePositionsCount > 0) {
      if (netPnl > 0.05) return 'HAPPY';
      if (netPnl < -0.05) return 'ANGRY';
    }

    const upperSentiment = String(marketSentiment).toUpperCase();
    const upperDecision = String(signalDecision).toUpperCase();

    if (upperDecision === 'LONG' || upperSentiment === 'BULLISH' || upperSentiment === 'GREED' || upperSentiment === 'EXTREME_GREED') {
      if (confidence >= 65) return 'BULLISH';
    }

    if (upperDecision === 'SHORT' || upperSentiment === 'BEARISH' || upperSentiment === 'FEAR' || upperSentiment === 'EXTREME_FEAR') {
      if (confidence >= 65) return 'BEARISH';
    }

    if (netPnl > 0.05) return 'HAPPY';
    if (netPnl < -0.05) return 'ANGRY';

    return 'SCANNING';
  }, [enabled, circuitBreakerTriggered, floatingPnlUsdt, floatingPnlPercent, realizedPnlUsdt, pokeReaction, activePositionsCount, marketSentiment, signalDecision, confidence]);

  const handleAvatarClick = () => {
    setPokeReaction(true);
    setTimeout(() => setPokeReaction(false), 1200);
    if (onClick) onClick();
  };

  const sizeConfig = {
    sm: { box: 'w-10 h-10', badgeText: 'text-[9px]' },
    md: { box: 'w-12 h-12 sm:w-14 sm:h-14', badgeText: 'text-[10px]' },
    lg: { box: 'w-16 h-16 sm:w-20 sm:h-20', badgeText: 'text-xs' },
    xl: { box: 'w-24 h-24 sm:w-28 sm:h-28', badgeText: 'text-sm' },
  }[size];

  const moodStyles = {
    HAPPY: {
      border: 'border-emerald-500/50',
      bgGradient: 'from-emerald-950/60 to-slate-950',
      screenBg: '#022c22',
      ledColor: '#34d399',
      antennaColor: '#10b981',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      title: isArabic ? 'نشط ورابح' : isEn ? 'Profitable & Active' : 'En Profit & Actif',
      desc: isArabic ? `أرباح إيجابية (+${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)` : `Trades en gains (+${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)`,
    },
    BULLISH: {
      border: 'border-emerald-400/60',
      bgGradient: 'from-emerald-950/70 to-slate-950',
      screenBg: '#022c22',
      ledColor: '#4ade80',
      antennaColor: '#22c55e',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      title: isArabic ? 'اتجاه صاعد (Bullish)' : isEn ? 'Bullish Trend' : 'Tendance Haussière',
      desc: isArabic ? 'رصد اتجاه عام صاعد وتدفق شرائي' : 'Détection de tendance haussière & flux acheteur',
    },
    BEARISH: {
      border: 'border-amber-500/60',
      bgGradient: 'from-amber-950/60 to-slate-950',
      screenBg: '#271202',
      ledColor: '#fb923c',
      antennaColor: '#f97316',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      title: isArabic ? 'اتجاه هابط (Bearish)' : isEn ? 'Bearish Trend' : 'Tendance Baissière',
      desc: isArabic ? 'رصد اتجاه هابط وضغط بيعي' : 'Surveillance de tendance baissière & shorts',
    },
    ANGRY: {
      border: 'border-rose-500/60',
      bgGradient: 'from-rose-950/70 to-slate-950',
      screenBg: '#310413',
      ledColor: '#fb7185',
      antennaColor: '#f43f5e',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      title: isArabic ? 'تراجع تحت المراقبة' : isEn ? 'Drawdown Alert' : 'Alerte Drawdown',
      desc: isArabic ? `تراجع في الصفقات (-${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)` : `Drawdown en cours (-${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)`,
    },
    SCANNING: {
      border: 'border-cyan-500/60',
      bgGradient: 'from-cyan-950/60 to-slate-950',
      screenBg: '#041f2d',
      ledColor: '#38bdf8',
      antennaColor: '#06b6d4',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      title: isArabic ? 'مسح كمي نشط' : isEn ? 'AI Scanning' : 'Analyse Quant IA',
      desc: isArabic ? 'مراقبة المؤشرات وحساب الاحتماليات' : 'Calcul des probabilités de marché',
    },
    SLEEPING: {
      border: 'border-slate-700/60',
      bgGradient: 'from-slate-900 to-slate-950',
      screenBg: '#090d16',
      ledColor: '#64748b',
      antennaColor: '#64748b',
      badgeBg: 'bg-slate-800 text-slate-400 border-slate-700',
      title: isArabic ? 'في وضع السكون' : isEn ? 'Standby' : 'En Veille',
      desc: isArabic ? 'البوت متوقف عن التداول' : 'Bot en pause',
    },
    SURPRISED: {
      border: 'border-amber-400/70',
      bgGradient: 'from-amber-950/60 to-slate-950',
      screenBg: '#271202',
      ledColor: '#fbbf24',
      antennaColor: '#f59e0b',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      title: isArabic ? 'متفاعل بذكاء' : isEn ? 'Interactive' : 'Interactif',
      desc: isArabic ? 'استجابة سريعة للمس' : 'Réponse interactive',
    },
  }[currentMood];

  return (
    <div className={`inline-flex flex-col items-center select-none shrink-0 ${className}`}>
      {/* Interactive Avatar Frame with strict GPU boundary */}
      <button
        type="button"
        onClick={handleAvatarClick}
        title={`${moodStyles.title} - ${moodStyles.desc} (${isArabic ? 'انقر للتفاعل' : 'Cliquez pour interagir'})`}
        className={`relative ${sizeConfig.box} rounded-2xl border bg-gradient-to-b ${moodStyles.bgGradient} ${moodStyles.border} p-1.5 flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95 cursor-pointer overflow-hidden shadow-sm`}
        style={{ transform: 'translateZ(0)' }}
      >
        {/* Crisp vector robot avatar contained strictly within 100x100 */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full block"
          style={{ shapeRendering: 'geometricPrecision' }}
        >
          {/* Top Antenna */}
          <g>
            <line x1="50" y1="20" x2="50" y2="8" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="8" r="4" fill={moodStyles.antennaColor} />
            <circle cx="50" cy="8" r="1.5" fill="#ffffff" />
          </g>

          {/* Left & Right Ears */}
          <rect x="8" y="40" width="8" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <line x1="12" y1="46" x2="12" y2="56" stroke={moodStyles.ledColor} strokeWidth="2" strokeLinecap="round" />

          <rect x="84" y="40" width="8" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <line x1="88" y1="46" x2="88" y2="56" stroke={moodStyles.ledColor} strokeWidth="2" strokeLinecap="round" />

          {/* Head Chassis */}
          <rect x="18" y="22" width="64" height="60" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />

          {/* Forehead status dot */}
          <circle cx="50" cy="28" r="2" fill={moodStyles.ledColor} opacity="0.9" />

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

          {/* Robot Eyes by Mood */}
          {isBlinking ? (
            <g stroke={moodStyles.ledColor} strokeWidth="3" strokeLinecap="round">
              <line x1="34" y1="51" x2="44" y2="51" />
              <line x1="56" y1="51" x2="66" y2="51" />
            </g>
          ) : currentMood === 'SLEEPING' ? (
            <g stroke={moodStyles.ledColor} strokeWidth="2.5" strokeLinecap="round" opacity="0.5">
              <line x1="34" y1="51" x2="44" y2="51" />
              <line x1="56" y1="51" x2="66" y2="51" />
            </g>
          ) : currentMood === 'HAPPY' ? (
            <g stroke={moodStyles.ledColor} strokeWidth="3" strokeLinecap="round" fill="none">
              <path d="M 33 53 Q 39 44 45 53" />
              <path d="M 55 53 Q 61 44 67 53" />
              <circle cx="31" cy="57" r="1.5" fill="#34d399" opacity="0.6" stroke="none" />
              <circle cx="69" cy="57" r="1.5" fill="#34d399" opacity="0.6" stroke="none" />
            </g>
          ) : currentMood === 'BULLISH' ? (
            <g fill={moodStyles.ledColor}>
              <polygon points="39,43 45,53 33,53" />
              <polygon points="61,43 67,53 55,53" />
              <circle cx="39" cy="49" r="1.5" fill="#ffffff" />
              <circle cx="61" cy="49" r="1.5" fill="#ffffff" />
            </g>
          ) : currentMood === 'BEARISH' ? (
            <g fill={moodStyles.ledColor}>
              <polygon points="39,57 33,47 45,47" />
              <polygon points="61,57 55,47 67,47" />
              <circle cx="39" cy="51" r="1.5" fill="#ffffff" />
              <circle cx="61" cy="51" r="1.5" fill="#ffffff" />
            </g>
          ) : currentMood === 'ANGRY' ? (
            <g stroke={moodStyles.ledColor} strokeWidth="3" strokeLinecap="round" fill="none">
              <line x1="34" y1="46" x2="45" y2="54" />
              <line x1="66" y1="46" x2="55" y2="54" />
            </g>
          ) : currentMood === 'SURPRISED' ? (
            <g fill="none" stroke={moodStyles.ledColor} strokeWidth="2.5">
              <circle cx="39" cy="51" r="5" />
              <circle cx="39" cy="51" r="2" fill="#ffffff" stroke="none" />
              <circle cx="61" cy="51" r="5" />
              <circle cx="61" cy="51" r="2" fill="#ffffff" stroke="none" />
            </g>
          ) : (
            <g>
              <circle cx="39" cy="51" r="5" fill="#082f49" stroke={moodStyles.ledColor} strokeWidth="2" />
              <circle cx="39" cy="51" r="2.5" fill={moodStyles.ledColor} />
              <circle cx="39" cy="51" r="1" fill="#ffffff" />

              <circle cx="61" cy="51" r="5" fill="#082f49" stroke={moodStyles.ledColor} strokeWidth="2" />
              <circle cx="61" cy="51" r="2.5" fill={moodStyles.ledColor} />
              <circle cx="61" cy="51" r="1" fill="#ffffff" />
            </g>
          )}

          {/* Chin Grill */}
          <g stroke={moodStyles.ledColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
            <line x1="42" y1="74" x2="42" y2="76" />
            <line x1="47" y1="73" x2="47" y2="77" />
            <line x1="53" y1="73" x2="53" y2="77" />
            <line x1="58" y1="74" x2="58" y2="76" />
          </g>
        </svg>

        {/* Small Live LED Indicator */}
        <span
          className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-slate-900 ${
            enabled ? (currentMood === 'HAPPY' ? 'bg-emerald-400' : currentMood === 'ANGRY' ? 'bg-rose-500' : 'bg-cyan-400') : 'bg-slate-600'
          }`}
        />
      </button>

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
