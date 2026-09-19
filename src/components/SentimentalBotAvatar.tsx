import React, { useState, useEffect } from 'react';
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

export const SentimentalBotAvatar: React.FC<SentimentalBotAvatarProps> = ({
  enabled,
  floatingPnlUsdt = 0,
  floatingPnlPercent = 0,
  realizedPnlUsdt = 0,
  marketSentiment = 'NEUTRAL',
  marketRegime,
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

  // Periodic natural eye blinking
  const [isBlinking, setIsBlinking] = useState(false);
  const [pokeReaction, setPokeReaction] = useState<boolean>(false);

  // Natural smart robot blink loop (every 3.6s, lasts 180ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    }, 3600);
    return () => clearInterval(interval);
  }, []);

  // Determine current emotional state (Sentiment & PnL & Market condition)
  const currentMood: BotMood = React.useMemo(() => {
    if (pokeReaction) return 'SURPRISED';
    if (!enabled) return 'SLEEPING';
    if (circuitBreakerTriggered) return 'ANGRY';

    // 1. If active positions exist with positive or negative floating PnL
    const netPnl = floatingPnlUsdt !== 0 ? floatingPnlUsdt : (floatingPnlPercent !== 0 ? floatingPnlPercent : realizedPnlUsdt);

    if (activePositionsCount > 0) {
      if (netPnl > 0.05) return 'HAPPY';
      if (netPnl < -0.05) return 'ANGRY';
    }

    // 2. Market Sentiment & Active Signals reflection
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
    setTimeout(() => setPokeReaction(false), 1400);
    if (onClick) onClick();
  };

  // Dimensions based on size prop
  const sizeConfig = {
    sm: { box: 'w-10 h-10', badgeText: 'text-[9px]' },
    md: { box: 'w-14 h-14', badgeText: 'text-[10px]' },
    lg: { box: 'w-20 h-20', badgeText: 'text-xs' },
    xl: { box: 'w-28 h-28', badgeText: 'text-sm' },
  }[size];

  // Theme palettes and glow for each mood
  const moodStyles = {
    HAPPY: {
      border: 'border-emerald-500/60 shadow-[0_0_24px_rgba(16,185,129,0.4)]',
      bgGradient: 'from-emerald-950/80 via-slate-900 to-slate-950',
      screenBg: '#022c22',
      ledColor: '#34d399',
      ledGlow: '#10b981',
      antennaColor: '#10b981',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      title: isArabic ? 'نشط ورابح 🚀' : isEn ? 'Profitable & Hyped 🚀' : 'En Profit & Euphorique 🚀',
      desc: isArabic ? `أرباح إيجابية (+${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)` : `Trades en gains (+${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)`,
    },
    BULLISH: {
      border: 'border-emerald-400/70 shadow-[0_0_24px_rgba(52,211,153,0.45)]',
      bgGradient: 'from-emerald-950/90 via-teal-950/40 to-slate-950',
      screenBg: '#022c22',
      ledColor: '#4ade80',
      ledGlow: '#22c55e',
      antennaColor: '#22c55e',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      title: isArabic ? 'زخم صاعد قوي 🐂' : isEn ? 'Bullish Momentum 🐂' : 'Momentum Haussier 🐂',
      desc: isArabic ? 'رصد اتجاه صاعد وفرص شراء' : 'Détection de flux acheteur',
    },
    BEARISH: {
      border: 'border-amber-500/70 shadow-[0_0_24px_rgba(245,158,11,0.4)]',
      bgGradient: 'from-amber-950/80 via-slate-900 to-slate-950',
      screenBg: '#271202',
      ledColor: '#fb923c',
      ledGlow: '#f97316',
      antennaColor: '#f97316',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      title: isArabic ? 'ضغط بيعي / هبوط 🐻' : isEn ? 'Bearish Market 🐻' : 'Pression Vendeuse 🐻',
      desc: isArabic ? 'حذر ومراقبة مستويات الدعم والبيع' : 'Surveillance des supports & shorts',
    },
    ANGRY: {
      border: 'border-rose-500/80 shadow-[0_0_26px_rgba(244,63,94,0.45)] animate-pulse',
      bgGradient: 'from-rose-950/90 via-slate-900 to-slate-950',
      screenBg: '#310413',
      ledColor: '#fb7185',
      ledGlow: '#f43f5e',
      antennaColor: '#f43f5e',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      title: isArabic ? 'غاضب تحت الضغط 😤' : isEn ? 'Drawdown & Furious 😤' : 'En Perte & Furieux 😤',
      desc: isArabic ? `تراجع في الصفقات (-${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)` : `Drawdown en cours (-${Math.abs(floatingPnlUsdt || floatingPnlPercent).toFixed(2)}$)`,
    },
    SCANNING: {
      border: 'border-cyan-500/70 shadow-[0_0_24px_rgba(6,182,212,0.4)]',
      bgGradient: 'from-cyan-950/80 via-slate-900 to-slate-950',
      screenBg: '#041f2d',
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
      screenBg: '#090d16',
      ledColor: '#64748b',
      ledGlow: '#475569',
      antennaColor: '#64748b',
      badgeBg: 'bg-slate-800 text-slate-400 border-slate-700',
      title: isArabic ? 'في وضع السكون 💤' : isEn ? 'Standby 💤' : 'En Veille 💤',
      desc: isArabic ? 'البوت متوقف عن التداول' : 'Bot en pause',
    },
    SURPRISED: {
      border: 'border-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.45)]',
      bgGradient: 'from-amber-950/80 via-slate-900 to-slate-950',
      screenBg: '#271202',
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
        className={`relative ${sizeConfig.box} rounded-2xl border bg-gradient-to-b ${moodStyles.bgGradient} ${moodStyles.border} p-1 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group`}
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

        {/* ULTRA-SMART MECHA AI ROBOT HEAD SVG */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-md overflow-visible"
        >
          <defs>
            {/* Filter for glowing neon neural optics */}
            <filter id={`robotGlow-${currentMood}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Futuristic Metallic Chassis Gradients */}
            <linearGradient id="robotHelmetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="40%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            <linearGradient id="robotEarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            <linearGradient id="robotVisorGlass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={moodStyles.screenBg} />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>

          {/* 1. TOP NEURAL SENSOR / QUANTUM ANTENNA */}
          <g>
            {/* Antenna Pole */}
            <line x1="50" y1="14" x2="50" y2="4" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
            {/* Antenna Base Cap */}
            <rect x="46" y="12" width="8" height="3" rx="1.5" fill="#475569" />
            
            {/* Pulsing Neural Beacon Orb */}
            <circle
              cx="50"
              cy="4"
              r="3.5"
              fill={moodStyles.antennaColor}
              filter={`url(#robotGlow-${currentMood})`}
              className={enabled && currentMood !== 'SLEEPING' ? 'animate-pulse' : ''}
            />
            <circle cx="50" cy="4" r="1.5" fill="#ffffff" />
            
            {/* Wireless Neural Waves */}
            {enabled && currentMood !== 'SLEEPING' && (
              <g stroke={moodStyles.antennaColor} strokeWidth="1" fill="none" opacity="0.6">
                <path d="M 43 2 A 9 9 0 0 1 57 2" strokeLinecap="round" />
                <path d="M 39 -1 A 14 14 0 0 1 61 -1" strokeLinecap="round" opacity="0.35" />
              </g>
            )}
          </g>

          {/* 2. SIDE MECHA AUDIO/TELEMETRY EAR MODULES */}
          {/* Left Ear */}
          <g>
            <rect x="10" y="38" width="7" height="24" rx="3.5" fill="url(#robotEarGrad)" stroke="#475569" strokeWidth="1" />
            {/* LED Status Bars on Ear */}
            <line x1="13.5" y1="43" x2="13.5" y2="47" stroke={moodStyles.ledColor} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="13.5" y1="50" x2="13.5" y2="54" stroke={moodStyles.ledColor} strokeWidth="1.5" strokeLinecap="round" opacity={enabled ? '1' : '0.4'} />
            <line x1="13.5" y1="57" x2="13.5" y2="57.5" stroke={moodStyles.ledColor} strokeWidth="1.5" strokeLinecap="round" opacity={enabled ? '0.7' : '0.2'} />
          </g>
          {/* Right Ear */}
          <g>
            <rect x="83" y="38" width="7" height="24" rx="3.5" fill="url(#robotEarGrad)" stroke="#475569" strokeWidth="1" />
            {/* LED Status Bars on Ear */}
            <line x1="86.5" y1="43" x2="86.5" y2="47" stroke={moodStyles.ledColor} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="86.5" y1="50" x2="86.5" y2="54" stroke={moodStyles.ledColor} strokeWidth="1.5" strokeLinecap="round" opacity={enabled ? '1' : '0.4'} />
            <line x1="86.5" y1="57" x2="86.5" y2="57.5" stroke={moodStyles.ledColor} strokeWidth="1.5" strokeLinecap="round" opacity={enabled ? '0.7' : '0.2'} />
          </g>

          {/* 3. MAIN ROBOT HEAD HELMET (Sleek Cybernetic Chassis) */}
          <path
            d="M 24 22 
               C 32 16, 68 16, 76 22 
               C 85 29, 85 70, 76 79 
               C 68 85, 32 85, 24 79 
               C 15 70, 15 29, 24 22 Z"
            fill="url(#robotHelmetGrad)"
            stroke="#475569"
            strokeWidth="1.5"
          />

          {/* Forehead Armor Plate Seam Line */}
          <path d="M 28 28 Q 50 32 72 28" stroke="#334155" strokeWidth="1.2" fill="none" />
          
          {/* Forehead Micro Processor Badge / Status Indicator */}
          <g>
            <rect x="42" y="20" width="16" height="5" rx="2" fill="#0f172a" stroke={moodStyles.ledColor} strokeWidth="0.8" opacity="0.8" />
            <circle cx="45" cy="22.5" r="1" fill={moodStyles.ledColor} />
            <circle cx="50" cy="22.5" r="1" fill={moodStyles.ledColor} opacity="0.6" />
            <circle cx="55" cy="22.5" r="1" fill={moodStyles.ledColor} opacity="0.4" />
          </g>

          {/* 4. SMART CYBER VISOR (Panoramic Display Screen) */}
          <rect
            x="22"
            y="32"
            width="56"
            height="34"
            rx="12"
            fill="url(#robotVisorGlass)"
            stroke={moodStyles.ledGlow}
            strokeWidth="1.4"
            strokeOpacity={enabled ? '0.75' : '0.3'}
          />

          {/* Visor Anti-Glare Gloss Arc Highlight */}
          <path
            d="M 26 36 Q 50 38 74 36"
            stroke="#ffffff"
            strokeWidth="1.2"
            opacity="0.25"
            strokeLinecap="round"
            fill="none"
          />

          {/* Digital HUD Grid inside Visor */}
          <g stroke={moodStyles.ledColor} strokeWidth="0.5" opacity="0.12" fill="none">
            <line x1="24" y1="49" x2="76" y2="49" />
            <line x1="38" y1="34" x2="38" y2="64" />
            <line x1="62" y1="34" x2="62" y2="64" />
          </g>

          {/* 5. DYNAMIC EXPRESSIVE ROBOT EYES & VISOR HOLOGRAPH */}
          {isBlinking ? (
            /* Natural Robot Blink: Sleek horizontal LED slits */
            <g stroke={moodStyles.ledColor} strokeWidth="2.5" strokeLinecap="round" filter={`url(#robotGlow-${currentMood})`}>
              <line x1="32" y1="49" x2="44" y2="49" />
              <line x1="56" y1="49" x2="68" y2="49" />
            </g>
          ) : currentMood === 'SLEEPING' ? (
            /* Standby State: Relaxed Dormant LED Lines */
            <g stroke={moodStyles.ledColor} strokeWidth="2" strokeLinecap="round" opacity="0.6">
              <line x1="33" y1="49" x2="43" y2="49" />
              <line x1="57" y1="49" x2="67" y2="49" />
            </g>
          ) : currentMood === 'HAPPY' ? (
            /* Happy State: Glowing Curved Chevrons (^ ^) with Sparkle */
            <g stroke={moodStyles.ledColor} strokeWidth="3" strokeLinecap="round" fill="none" filter={`url(#robotGlow-${currentMood})`}>
              {/* Left Eye Happy Arch */}
              <path d="M 32 52 Q 38 43 44 52" />
              {/* Right Eye Happy Arch */}
              <path d="M 56 52 Q 62 43 68 52" />
              {/* Joyful Cheek Blushes */}
              <circle cx="28" cy="56" r="2" fill="#34d399" opacity="0.5" stroke="none" />
              <circle cx="72" cy="56" r="2" fill="#34d399" opacity="0.5" stroke="none" />
            </g>
          ) : currentMood === 'BULLISH' ? (
            /* Bullish State: Confident Angular Eyes with Upward Tactical Momentum (▲ ▲) */
            <g filter={`url(#robotGlow-${currentMood})`}>
              {/* Left Eye: Ascending Arrow Shape */}
              <polygon points="38,42 45,53 39,53 39,57 37,57 37,53 31,53" fill={moodStyles.ledColor} />
              {/* Right Eye: Ascending Arrow Shape */}
              <polygon points="62,42 69,53 63,53 63,57 61,57 61,53 55,53" fill={moodStyles.ledColor} />
              {/* Eye Core Lights */}
              <circle cx="38" cy="48" r="1.5" fill="#ffffff" />
              <circle cx="62" cy="48" r="1.5" fill="#ffffff" />
            </g>
          ) : currentMood === 'BEARISH' ? (
            /* Bearish State: Strategic Focused Eyes with Downward Scanning Triangles (▼ ▼) */
            <g filter={`url(#robotGlow-${currentMood})`}>
              {/* Left Eye: Downward Arrow */}
              <polygon points="38,58 31,47 37,47 37,43 39,43 39,47 45,47" fill={moodStyles.ledColor} />
              {/* Right Eye: Downward Arrow */}
              <polygon points="62,58 55,47 61,47 61,43 63,43 63,47 69,47" fill={moodStyles.ledColor} />
              {/* Eye Core Lights */}
              <circle cx="38" cy="52" r="1.5" fill="#ffffff" />
              <circle cx="62" cy="52" r="1.5" fill="#ffffff" />
            </g>
          ) : currentMood === 'ANGRY' ? (
            /* Angry/Alert State: Intense Diagonal Combat Eyes (> <) */
            <g stroke={moodStyles.ledColor} strokeWidth="3" strokeLinecap="round" fill="none" filter={`url(#robotGlow-${currentMood})`}>
              {/* Left Eye: Sharp Angled Downward */}
              <line x1="32" y1="44" x2="45" y2="52" />
              {/* Right Eye: Sharp Angled Downward */}
              <line x1="68" y1="44" x2="55" y2="52" />
              <circle cx="38" cy="50" r="2" fill="#ffffff" stroke="none" />
              <circle cx="62" cy="50" r="2" fill="#ffffff" stroke="none" />
            </g>
          ) : currentMood === 'SURPRISED' ? (
            /* Surprised State: Wide Circular Sensor Apertures (◉ ◉) */
            <g filter={`url(#robotGlow-${currentMood})`}>
              <circle cx="38" cy="49" r="6" fill="none" stroke={moodStyles.ledColor} strokeWidth="2.5" />
              <circle cx="38" cy="49" r="2.5" fill="#ffffff" />
              <circle cx="62" cy="49" r="6" fill="none" stroke={moodStyles.ledColor} strokeWidth="2.5" />
              <circle cx="62" cy="49" r="2.5" fill="#ffffff" />
            </g>
          ) : (
            /* Default State: High-Tech Cyber Robotic AI Eyes with Scanning Crosshairs */
            <g filter={`url(#robotGlow-${currentMood})`}>
              {/* Left Eye Aperture Ring & Pupil */}
              <circle cx="38" cy="49" r="5.5" fill="#082f49" stroke={moodStyles.ledColor} strokeWidth="2" />
              <circle cx="38" cy="49" r="2.5" fill={moodStyles.ledColor} className={enabled ? 'animate-pulse' : ''} />
              <circle cx="38" cy="49" r="1" fill="#ffffff" />

              {/* Right Eye Aperture Ring & Pupil */}
              <circle cx="62" cy="49" r="5.5" fill="#082f49" stroke={moodStyles.ledColor} strokeWidth="2" />
              <circle cx="62" cy="49" r="2.5" fill={moodStyles.ledColor} className={enabled ? 'animate-pulse' : ''} />
              <circle cx="62" cy="49" r="1" fill="#ffffff" />

              {/* Central Micro Neural Bridge */}
              <line x1="44" y1="49" x2="56" y2="49" stroke={moodStyles.ledColor} strokeWidth="1" strokeDasharray="1.5 1.5" opacity="0.7" />

              {/* Rotating Radar Sweep Beam inside Visor */}
              {enabled && (
                <circle cx="50" cy="49" r="14" fill="none" stroke={moodStyles.ledColor} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4" />
              )}
            </g>
          )}

          {/* 6. CHIN AUDIO VOCODER / DATA GRILL */}
          <g fill="#0f172a" stroke="#334155" strokeWidth="0.8">
            <rect x="36" y="70" width="28" height="7" rx="3.5" />
            {/* Audio Vent Slots */}
            <line x1="41" y1="72" x2="41" y2="75" stroke={moodStyles.ledColor} strokeWidth="1.2" strokeLinecap="round" opacity={enabled ? '0.9' : '0.3'} />
            <line x1="46" y1="71.5" x2="46" y2="75.5" stroke={moodStyles.ledColor} strokeWidth="1.2" strokeLinecap="round" opacity={enabled ? '1' : '0.4'} />
            <line x1="50" y1="71" x2="50" y2="76" stroke={moodStyles.ledColor} strokeWidth="1.5" strokeLinecap="round" opacity={enabled ? '1' : '0.5'} />
            <line x1="54" y1="71.5" x2="54" y2="75.5" stroke={moodStyles.ledColor} strokeWidth="1.2" strokeLinecap="round" opacity={enabled ? '1' : '0.4'} />
            <line x1="59" y1="72" x2="59" y2="75" stroke={moodStyles.ledColor} strokeWidth="1.2" strokeLinecap="round" opacity={enabled ? '0.9' : '0.3'} />
          </g>

          {/* Corner Screws/Rivets on Helmet for Mecha Realism */}
          <circle cx="27" cy="25" r="1" fill="#64748b" />
          <circle cx="73" cy="25" r="1" fill="#64748b" />
          <circle cx="27" cy="75" r="1" fill="#64748b" />
          <circle cx="73" cy="75" r="1" fill="#64748b" />
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
