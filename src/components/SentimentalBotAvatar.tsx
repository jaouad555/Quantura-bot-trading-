import React, { useState, useEffect } from 'react';
import { Language } from '../types';

export interface SentimentalBotAvatarProps {
  enabled: boolean;
  floatingPnlUsdt?: number;
  floatingPnlPercent?: number;
  realizedPnlUsdt?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showMoodBadge?: boolean;
  language?: Language;
  circuitBreakerTriggered?: boolean;
  onClick?: () => void;
  className?: string;
}

export type BotMood = 'HAPPY' | 'ANGRY' | 'SCANNING' | 'SLEEPING' | 'SURPRISED';

export const SentimentalBotAvatar: React.FC<SentimentalBotAvatarProps> = ({
  enabled,
  floatingPnlUsdt = 0,
  floatingPnlPercent = 0,
  realizedPnlUsdt = 0,
  size = 'md',
  showMoodBadge = false,
  language = 'fr',
  circuitBreakerTriggered = false,
  onClick,
  className = '',
}) => {
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  // Periodic natural eye blinking
  const [isBlinking, setIsBlinking] = useState(false);
  const [pokeReaction, setPokeReaction] = useState<boolean>(false);

  // Natural blink loop (every 3.2s, lasts 180ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 200);
    }, 3400);
    return () => clearInterval(interval);
  }, []);

  // Determine current emotional state (Sentiment)
  const currentMood: BotMood = React.useMemo(() => {
    if (pokeReaction) return 'SURPRISED';
    if (!enabled) return 'SLEEPING';
    if (circuitBreakerTriggered) return 'ANGRY';

    // Consider either floating PnL (open positions) or overall session profit
    const netPnl = floatingPnlUsdt !== 0 ? floatingPnlUsdt : (floatingPnlPercent !== 0 ? floatingPnlPercent : realizedPnlUsdt);

    if (netPnl > 0.05) {
      return 'HAPPY';
    } else if (netPnl < -0.05) {
      return 'ANGRY';
    }
    return 'SCANNING';
  }, [enabled, circuitBreakerTriggered, floatingPnlUsdt, floatingPnlPercent, realizedPnlUsdt, pokeReaction]);

  const handleAvatarClick = () => {
    setPokeReaction(true);
    setTimeout(() => setPokeReaction(false), 1400);
    if (onClick) onClick();
  };

  // Dimensions based on size prop
  const sizeConfig = {
    sm: { box: 'w-10 h-10', svg: 40, antennaH: 8, badgeText: 'text-[9px]' },
    md: { box: 'w-14 h-14', svg: 56, antennaH: 10, badgeText: 'text-[10px]' },
    lg: { box: 'w-20 h-20', svg: 80, antennaH: 14, badgeText: 'text-xs' },
    xl: { box: 'w-28 h-28', svg: 112, antennaH: 18, badgeText: 'text-sm' },
  }[size];

  // Theme palettes and glow for each mood
  const moodStyles = {
    HAPPY: {
      border: 'border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.35)]',
      bgGradient: 'from-emerald-950/80 via-slate-900 to-slate-950',
      screenBg: '#064e3b',
      ledColor: '#34d399',
      ledGlow: '#10b981',
      antennaColor: '#10b981',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      title: isArabic ? 'نشط ورابح 🚀' : isEn ? 'Profitable & Hyped 🚀' : 'En Profit & Euphorique 🚀',
      desc: isArabic ? `أرباح إيجابية (+${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)` : `Trades en gains (+${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)`,
    },
    ANGRY: {
      border: 'border-rose-500/70 shadow-[0_0_22px_rgba(244,63,94,0.4)] animate-pulse',
      bgGradient: 'from-rose-950/90 via-slate-900 to-slate-950',
      screenBg: '#4c0519',
      ledColor: '#fb7185',
      ledGlow: '#f43f5e',
      antennaColor: '#f43f5e',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      title: isArabic ? 'غاضب تحت الضغط 😤' : isEn ? 'Drawdown & Furious 😤' : 'En Perte & Furieux 😤',
      desc: isArabic ? `تراجع في الصفقات (-${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)` : `Drawdown en cours (-${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)`,
    },
    SCANNING: {
      border: 'border-cyan-500/60 shadow-[0_0_18px_rgba(6,182,212,0.3)]',
      bgGradient: 'from-cyan-950/80 via-slate-900 to-slate-950',
      screenBg: '#083344',
      ledColor: '#38bdf8',
      ledGlow: '#06b6d4',
      antennaColor: '#06b6d4',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      title: isArabic ? 'مسح كمي نشط ⚡' : isEn ? 'AI Scanning ⚡' : 'Analyse Quant IA ⚡',
      desc: isArabic ? 'مراقبة المؤشرات وحساب الاحتماليات' : 'Calcul des probabilités de marché',
    },
    SLEEPING: {
      border: 'border-slate-700/60 shadow-none',
      bgGradient: 'from-slate-900 via-slate-950 to-slate-950',
      screenBg: '#0f172a',
      ledColor: '#64748b',
      ledGlow: '#475569',
      antennaColor: '#64748b',
      badgeBg: 'bg-slate-800 text-slate-400 border-slate-700',
      title: isArabic ? 'في وضع السكون 💤' : isEn ? 'Standby 💤' : 'En Veille 💤',
      desc: isArabic ? 'البوت متوقف عن التداول' : 'Bot en pause',
    },
    SURPRISED: {
      border: 'border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.4)]',
      bgGradient: 'from-amber-950/80 via-slate-900 to-slate-950',
      screenBg: '#451a03',
      ledColor: '#fbbf24',
      ledGlow: '#f59e0b',
      antennaColor: '#f59e0b',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      title: isArabic ? 'متفاعل بذكاء 💡' : isEn ? 'Surprised! 💡' : 'Interactif ! 💡',
      desc: isArabic ? 'استجابة سريعة للمس' : 'Réponse interactive',
    },
  }[currentMood];

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      {/* Interactive Avatar Frame */}
      <button
        type="button"
        onClick={handleAvatarClick}
        title={`${moodStyles.title} - ${moodStyles.desc} (${isArabic ? 'انقر للتفاعل' : 'Cliquez pour interagir'})`}
        className={`relative ${sizeConfig.box} rounded-2xl border-2 bg-gradient-to-b ${moodStyles.bgGradient} ${moodStyles.border} p-1.5 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group`}
      >
        {/* Floating Animated Sparks / ZZZ */}
        {currentMood === 'SLEEPING' && (
          <span className="absolute -top-3.5 -right-1 text-xs font-mono font-black text-indigo-400 animate-bounce">
            z<span className="text-[9px] text-slate-400">Z</span>
          </span>
        )}

        {currentMood === 'HAPPY' && (
          <span className="absolute -top-2.5 -right-1 text-xs animate-pulse">
            ✨
          </span>
        )}

        {currentMood === 'ANGRY' && (
          <span className="absolute -top-2.5 -right-1 text-xs animate-bounce">
            💢
          </span>
        )}

        {/* Vector SVG Robot Body & Screen */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-md overflow-visible"
        >
          <defs>
            {/* Filter for glowing neon screen elements */}
            <filter id={`glow-${currentMood}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <linearGradient id="robotHelmet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            <linearGradient id="antennaGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={moodStyles.antennaColor} />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>

          {/* Top Antenna */}
          <g>
            {/* Antenna Stick */}
            <line
              x1="50"
              y1="18"
              x2="50"
              y2="6"
              stroke="#64748b"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Antenna Orb with pulse */}
            <circle
              cx="50"
              cy="6"
              r="6"
              fill={moodStyles.antennaColor}
              className={enabled ? 'animate-pulse' : ''}
              filter={`url(#glow-${currentMood})`}
            />
            {/* Signal rings when scanning/happy */}
            {enabled && (currentMood === 'HAPPY' || currentMood === 'SCANNING') && (
              <circle
                cx="50"
                cy="6"
                r="10"
                fill="none"
                stroke={moodStyles.antennaColor}
                strokeWidth="1.5"
                opacity="0.6"
                className="animate-ping"
              />
            )}
          </g>

          {/* Robot Ears / Bolts */}
          <rect x="8" y="38" width="6" height="24" rx="3" fill="#475569" stroke="#1e293b" strokeWidth="2" />
          <rect x="86" y="38" width="6" height="24" rx="3" fill="#475569" stroke="#1e293b" strokeWidth="2" />

          {/* Robot Head Frame */}
          <rect
            x="14"
            y="18"
            width="72"
            height="68"
            rx="18"
            fill="url(#robotHelmet)"
            stroke={currentMood === 'ANGRY' ? '#f43f5e' : currentMood === 'HAPPY' ? '#10b981' : '#475569'}
            strokeWidth="2.5"
          />

          {/* Inner LED Visor Screen */}
          <rect
            x="20"
            y="26"
            width="60"
            height="50"
            rx="12"
            fill={moodStyles.screenBg}
            stroke="#0f172a"
            strokeWidth="2"
          />

          {/* Subtle Screen Scanline Texture */}
          <line x1="22" y1="36" x2="78" y2="36" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
          <line x1="22" y1="46" x2="78" y2="46" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
          <line x1="22" y1="56" x2="78" y2="56" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
          <line x1="22" y1="66" x2="78" y2="66" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />

          {/* ============================================================ */}
          {/* FACIAL EXPRESSIONS & EYES BASED ON SENTIMENT */}
          {/* ============================================================ */}

          {/* 1. HAPPY / PROFIT MOOD (＾▽＾) */}
          {currentMood === 'HAPPY' && (
            <g filter={`url(#glow-${currentMood})`}>
              {/* Left Happy Eye ^ */}
              {isBlinking ? (
                <line x1="30" y1="45" x2="42" y2="45" stroke={moodStyles.ledColor} strokeWidth="4" strokeLinecap="round" />
              ) : (
                <path
                  d="M 28 47 Q 36 35 44 47"
                  fill="none"
                  stroke={moodStyles.ledColor}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              )}

              {/* Right Happy Eye ^ */}
              {isBlinking ? (
                <line x1="58" y1="45" x2="70" y2="45" stroke={moodStyles.ledColor} strokeWidth="4" strokeLinecap="round" />
              ) : (
                <path
                  d="M 56 47 Q 64 35 72 47"
                  fill="none"
                  stroke={moodStyles.ledColor}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              )}

              {/* Cheerful Smiling Open Mouth */}
              <path
                d="M 36 57 Q 50 72 64 57"
                fill="none"
                stroke={moodStyles.ledColor}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Blush LEDs */}
              <circle cx="26" cy="54" r="2.5" fill="#34d399" opacity="0.8" />
              <circle cx="74" cy="54" r="2.5" fill="#34d399" opacity="0.8" />
            </g>
          )}

          {/* 2. ANGRY / LOSS MOOD (> < or 😠) */}
          {currentMood === 'ANGRY' && (
            <g filter={`url(#glow-${currentMood})`}>
              {/* Fierce Angry Brows & Eyes */}
              {isBlinking ? (
                <>
                  <line x1="28" y1="45" x2="44" y2="45" stroke={moodStyles.ledColor} strokeWidth="4" strokeLinecap="round" />
                  <line x1="56" y1="45" x2="72" y2="45" stroke={moodStyles.ledColor} strokeWidth="4" strokeLinecap="round" />
                </>
              ) : (
                <>
                  {/* Left Angry Eyebrow & Sharp Eye */}
                  <line x1="28" y1="38" x2="45" y2="44" stroke={moodStyles.ledColor} strokeWidth="4" strokeLinecap="round" />
                  <circle cx="37" cy="48" r="4.5" fill={moodStyles.ledColor} />

                  {/* Right Angry Eyebrow & Sharp Eye */}
                  <line x1="72" y1="38" x2="55" y2="44" stroke={moodStyles.ledColor} strokeWidth="4" strokeLinecap="round" />
                  <circle cx="63" cy="48" r="4.5" fill={moodStyles.ledColor} />
                </>
              )}

              {/* Angry Jagged Zig-zag Grimace Mouth */}
              <path
                d="M 32 64 L 40 59 L 50 65 L 60 59 L 68 64"
                fill="none"
                stroke={moodStyles.ledColor}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* 3. SCANNING / ANALYTICAL (◉ ◉ with laser beam sweep) */}
          {currentMood === 'SCANNING' && (
            <g filter={`url(#glow-${currentMood})`}>
              {isBlinking ? (
                <>
                  <line x1="28" y1="46" x2="44" y2="46" stroke={moodStyles.ledColor} strokeWidth="4" strokeLinecap="round" />
                  <line x1="56" y1="46" x2="72" y2="46" stroke={moodStyles.ledColor} strokeWidth="4" strokeLinecap="round" />
                </>
              ) : (
                <>
                  {/* Left Digital Eye */}
                  <circle cx="36" cy="46" r="7" fill="#0369a1" stroke={moodStyles.ledColor} strokeWidth="2.5" />
                  <circle cx="36" cy="46" r="3" fill="#ffffff" />

                  {/* Right Digital Eye */}
                  <circle cx="64" cy="46" r="7" fill="#0369a1" stroke={moodStyles.ledColor} strokeWidth="2.5" />
                  <circle cx="64" cy="46" r="3" fill="#ffffff" />
                </>
              )}

              {/* Confident AI Mouth Line / EQ Bars */}
              <line x1="38" y1="62" x2="62" y2="62" stroke={moodStyles.ledColor} strokeWidth="3" strokeLinecap="round" />
              <line x1="44" y1="66" x2="56" y2="66" stroke={moodStyles.ledColor} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            </g>
          )}

          {/* 4. SLEEPING / PAUSED (- - or z z) */}
          {currentMood === 'SLEEPING' && (
            <g>
              {/* Closed Sleep Eyes */}
              <line x1="28" y1="46" x2="44" y2="46" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
              <line x1="56" y1="46" x2="72" y2="46" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />

              {/* Small Rest Mouth */}
              <path
                d="M 44 60 Q 50 63 56 60"
                fill="none"
                stroke="#64748b"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* 5. SURPRISED / POKED (O O) */}
          {currentMood === 'SURPRISED' && (
            <g filter={`url(#glow-${currentMood})`}>
              {/* Wide Eyes */}
              <circle cx="36" cy="44" r="8" fill="#78350f" stroke={moodStyles.ledColor} strokeWidth="3" />
              <circle cx="36" cy="44" r="3.5" fill="#ffffff" />

              <circle cx="64" cy="44" r="8" fill="#78350f" stroke={moodStyles.ledColor} strokeWidth="3" />
              <circle cx="64" cy="44" r="3.5" fill="#ffffff" />

              {/* Open Surprised 'O' Mouth */}
              <circle cx="50" cy="62" r="5" fill="none" stroke={moodStyles.ledColor} strokeWidth="3" />
            </g>
          )}
        </svg>

        {/* Live Indicator Dot at bottom right of frame */}
        <span
          className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
            enabled ? (currentMood === 'HAPPY' ? 'bg-emerald-400' : currentMood === 'ANGRY' ? 'bg-rose-500' : 'bg-cyan-400') : 'bg-slate-600'
          } ${enabled ? 'animate-ping' : ''}`}
        />
      </button>

      {/* Optional Sentimental Status Mood Pill Badge */}
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
