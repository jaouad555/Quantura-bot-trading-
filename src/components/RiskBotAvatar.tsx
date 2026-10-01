import React, { useState, useEffect, memo, useMemo } from 'react';
import { Language } from '../types';

export type RiskBotEmotion = 
  | 'SHIELD_ZEN' 
  | 'QUANT_CALCULATING' 
  | 'VIGILANT_GUARD' 
  | 'HIGH_RISK_ALERT' 
  | 'CIRCUIT_BREAKER_LOCKDOWN' 
  | 'ANTI_MARTINGALE_SCALING';

export interface RiskBotAvatarProps {
  riskScore?: number; // 0 - 100
  status?: string; // 'NORMAL' | 'CAUTION' | 'RESTRICTED' | 'HALTED'
  emergencyStop?: boolean;
  circuitBreakerActive?: boolean;
  antiMartingaleActive?: boolean;
  dailyLossPercent?: number;
  drawdownPercent?: number;
  maxDrawdownLimit?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showMoodBadge?: boolean;
  language?: Language;
  onClick?: () => void;
  className?: string;
}

const RiskBotAvatarComponent: React.FC<RiskBotAvatarProps> = ({
  riskScore = 0,
  status = 'NORMAL',
  emergencyStop = false,
  circuitBreakerActive = false,
  antiMartingaleActive = false,
  dailyLossPercent = 0,
  drawdownPercent = 0,
  maxDrawdownLimit = 10,
  size = 'md',
  showMoodBadge = false,
  language = 'ar',
  onClick,
  className = '',
}) => {
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  const [isBlinking, setIsBlinking] = useState(false);
  const [pokeReaction, setPokeReaction] = useState(false);

  // Natural blinking interval
  useEffect(() => {
    if (size === 'xs') return;
    let timeoutId: any;
    const interval = setInterval(() => {
      setIsBlinking(true);
      timeoutId = setTimeout(() => setIsBlinking(false), 170);
    }, 4500);
    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [size]);

  // Determine current emotion tailored specifically for Risk Engine
  const currentEmotion: RiskBotEmotion = useMemo(() => {
    if (emergencyStop || circuitBreakerActive || status === 'HALTED' || riskScore >= 85) {
      return 'CIRCUIT_BREAKER_LOCKDOWN';
    }
    if (status === 'RESTRICTED' || riskScore >= 70 || drawdownPercent >= maxDrawdownLimit * 0.75) {
      return 'HIGH_RISK_ALERT';
    }
    if (status === 'CAUTION' || riskScore >= 45 || dailyLossPercent > 1.5) {
      return 'VIGILANT_GUARD';
    }
    if (antiMartingaleActive && riskScore < 40) {
      return 'ANTI_MARTINGALE_SCALING';
    }
    if (riskScore >= 20) {
      return 'QUANT_CALCULATING';
    }
    return 'SHIELD_ZEN';
  }, [emergencyStop, circuitBreakerActive, status, riskScore, drawdownPercent, maxDrawdownLimit, dailyLossPercent, antiMartingaleActive]);

  const handleAvatarClick = () => {
    setPokeReaction(true);
    setTimeout(() => setPokeReaction(false), 1200);
    if (onClick) onClick();
  };

  const sizeConfig = {
    xs: { box: 'w-7 h-7 sm:w-8 sm:h-8', badgeText: 'text-[8px]' },
    sm: { box: 'w-9 h-9 sm:w-10 sm:h-10', badgeText: 'text-[9px]' },
    md: { box: 'w-11 h-11 sm:w-12 sm:h-12', badgeText: 'text-[10px]' },
    lg: { box: 'w-16 h-16 sm:w-20 sm:h-20', badgeText: 'text-xs' },
    xl: { box: 'w-24 h-24 sm:w-28 sm:h-28', badgeText: 'text-sm' },
  }[size];

  // Tailored Risk Engine themes, glow, visor background, beacon, and badges
  const emotionConfig = {
    SHIELD_ZEN: {
      border: 'border-emerald-500/60 shadow-[0_0_18px_rgba(16,185,129,0.3)]',
      bgGradient: 'from-emerald-950/70 via-slate-900 to-slate-950',
      screenBg: '#021810',
      ledColor: '#10b981',
      beaconColor: '#34d399',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      title: isArabic ? '🛡️ درع الأمان التام' : isEn ? '🛡️ Capital Shielded' : '🛡️ Bouclier Sécurité Totale',
      desc: isArabic ? 'المخاطر 0%، رأس المال محمي تماماً ومطابق لمعايير الأمان' : 'Zero drawdown, capital strictly protected',
    },
    QUANT_CALCULATING: {
      border: 'border-cyan-500/60 shadow-[0_0_18px_rgba(6,182,212,0.3)]',
      bgGradient: 'from-cyan-950/70 via-slate-900 to-slate-950',
      screenBg: '#041f2d',
      ledColor: '#06b6d4',
      beaconColor: '#38bdf8',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      title: isArabic ? '⚡ حساب المعايير والارتباط' : isEn ? '⚡ Risk Bounds Matrix' : '⚡ Matrice Risque & Corrélation',
      desc: isArabic ? 'تحليل لحظي لنسبة كيلي، تقلبات السوق، وحجم العقود الأمثل' : 'Computing Kelly criterion & optimal position size',
    },
    VIGILANT_GUARD: {
      border: 'border-amber-500/70 shadow-[0_0_18px_rgba(245,158,11,0.3)]',
      bgGradient: 'from-amber-950/70 via-slate-900 to-slate-950',
      screenBg: '#231404',
      ledColor: '#f59e0b',
      beaconColor: '#fbbf24',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      title: isArabic ? '👁️ يقظة دفاعية مشددة' : isEn ? '👁️ Defensive Vigilance' : '👁️ Vigilance Défensive',
      desc: isArabic ? 'مراقبة التراجع اليومي والتعرض مع تشديد شروط وقف الخسارة' : 'Guarding drawdown & tightening stop loss barriers',
    },
    HIGH_RISK_ALERT: {
      border: 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.4)]',
      bgGradient: 'from-orange-950/80 via-slate-900 to-slate-950',
      screenBg: '#2d0f04',
      ledColor: '#f97316',
      beaconColor: '#fb923c',
      badgeBg: 'bg-orange-500/25 text-orange-300 border-orange-500/50 animate-pulse',
      title: isArabic ? '⚠️ تحذير: سقف المخاطرة' : isEn ? '⚠️ High Risk Warning' : '⚠️ Alerte Seuil de Risque',
      desc: isArabic ? 'اقتراب التراجع من الحد الأقصى! تجميد فتح الصفقات الجديدة' : 'Drawdown approaching upper threshold limits',
    },
    CIRCUIT_BREAKER_LOCKDOWN: {
      border: 'border-rose-500 shadow-[0_0_22px_rgba(244,63,94,0.5)]',
      bgGradient: 'from-rose-950/90 via-slate-900 to-slate-950',
      screenBg: '#350614',
      ledColor: '#f43f5e',
      beaconColor: '#fda4af',
      badgeBg: 'bg-rose-500/30 text-rose-300 border-rose-500/50 animate-pulse',
      title: isArabic ? '⛔ قاطع الدائرة وقفل الطوارئ' : isEn ? '⛔ Circuit Breaker Lockdown' : '⛔ Coupe-Circuit d\'Urgence',
      desc: isArabic ? 'تفعيل الإيقاف الوقائي الفوري لحماية المحفظة ومنع أي نزيف' : 'Emergency safety lockdown active, trading halted',
    },
    ANTI_MARTINGALE_SCALING: {
      border: 'border-violet-500/70 shadow-[0_0_18px_rgba(139,92,246,0.35)]',
      bgGradient: 'from-violet-950/70 via-slate-900 to-slate-950',
      screenBg: '#1e0f38',
      ledColor: '#a78bfa',
      beaconColor: '#c4b5fd',
      badgeBg: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
      title: isArabic ? '🚀 تدرج الأرباح (Anti-Martingale)' : isEn ? '🚀 Anti-Martingale Scale' : '🚀 Scaling Anti-Martingale',
      desc: isArabic ? 'زيادة حجم العقود تدريجياً مع سلسلة الصفقات الرابحة فقط' : 'Scaling position sizing on consecutive profits safely',
    },
  }[currentEmotion];

  return (
    <div className={`inline-flex flex-col items-center select-none shrink-0 ${className}`}>
      {/* Interactive Avatar Frame with exact Terminal Robot cybernetic chassis */}
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
        title={`${emotionConfig.title} • ${emotionConfig.desc} (${isArabic ? 'روبوت محرك المخاطر' : 'Risk Engine AI'})`}
        className={`relative ${sizeConfig.box} rounded-2xl border bg-gradient-to-b ${emotionConfig.bgGradient} ${emotionConfig.border} p-1 sm:p-1.5 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer overflow-hidden shadow-sm group`}
        style={{ transform: 'translateZ(0)' }}
      >
        {/* Precise Vector Robot Chassis identical to Terminal Robot with Risk Engine Face */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full block"
          style={{ shapeRendering: 'geometricPrecision' }}
        >
          {/* Top Antenna & Signal Beacon */}
          <g>
            <line x1="50" y1="20" x2="50" y2="8" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="8" r="4.5" fill={emotionConfig.beaconColor} />
            <circle 
              cx="50" 
              cy="8" 
              r="1.8" 
              fill="#ffffff" 
              className={currentEmotion === 'CIRCUIT_BREAKER_LOCKDOWN' || currentEmotion === 'HIGH_RISK_ALERT' ? 'animate-ping' : ''} 
            />
          </g>

          {/* Left & Right Acoustic Ears / Quantum Modules */}
          <rect x="8" y="40" width="8" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <line x1="12" y1="46" x2="12" y2="56" stroke={emotionConfig.ledColor} strokeWidth="2" strokeLinecap="round" />

          <rect x="84" y="40" width="8" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <line x1="88" y1="46" x2="88" y2="56" stroke={emotionConfig.ledColor} strokeWidth="2" strokeLinecap="round" />

          {/* Head Chassis */}
          <rect x="18" y="22" width="64" height="60" rx="16" fill="#1e293b" stroke="#475569" strokeWidth="2" />

          {/* Forehead status quantum core - Risk Security Shield / Badge */}
          <circle cx="50" cy="28" r="2.4" fill={emotionConfig.ledColor} opacity="0.95" />

          {/* Visor Screen */}
          <rect
            x="24"
            y="34"
            width="52"
            height="34"
            rx="10"
            fill={emotionConfig.screenBg}
            stroke={emotionConfig.ledColor}
            strokeWidth="1.5"
          />

          {/* Visor Gloss Reflection */}
          <path d="M 28 38 Q 50 40 72 38" stroke="#ffffff" strokeWidth="1" opacity="0.25" strokeLinecap="round" fill="none" />

          {/* DYNAMIC RISK ENGINE EMOTIONAL FACES */}
          {isBlinking ? (
            /* Natural Blinking Horizontal Ticks */
            <g stroke={emotionConfig.ledColor} strokeWidth="3" strokeLinecap="round">
              <line x1="34" y1="51" x2="44" y2="51" />
              <line x1="56" y1="51" x2="66" y2="51" />
            </g>
          ) : pokeReaction ? (
            /* Tactile Poked Reaction: Wide Scanning Lenses */
            <g fill="none" stroke={emotionConfig.ledColor} strokeWidth="2.5">
              <circle cx="39" cy="51" r="5.5" />
              <circle cx="39" cy="51" r="2" fill="#ffffff" stroke="none" />
              <circle cx="61" cy="51" r="5.5" />
              <circle cx="61" cy="51" r="2" fill="#ffffff" stroke="none" />
            </g>
          ) : currentEmotion === 'CIRCUIT_BREAKER_LOCKDOWN' ? (
            /* Emergency Lockdown: Critical Danger Cross Eyes (✕ ✕) + Lockdown Jaw */
            <g stroke={emotionConfig.ledColor} strokeWidth="2.8" strokeLinecap="round">
              {/* Left X Eye */}
              <line x1="34" y1="46" x2="44" y2="56" />
              <line x1="44" y1="46" x2="34" y2="56" />
              {/* Right X Eye */}
              <line x1="56" y1="46" x2="66" y2="56" />
              <line x1="66" y1="46" x2="56" y2="56" />
              {/* Emergency Lock Visor Center Warning Bar */}
              <line x1="48" y1="60" x2="52" y2="60" stroke="#ffffff" strokeWidth="2" />
            </g>
          ) : currentEmotion === 'HIGH_RISK_ALERT' ? (
            /* High Risk Warning: Alert Exclamation Visor [ ! ] [ ! ] */
            <g stroke={emotionConfig.ledColor} strokeWidth="2.6" strokeLinecap="round" fill="none">
              {/* Left Bracket */}
              <path d="M 33 46 L 31 46 L 31 56 L 33 56" />
              <line x1="38" y1="46" x2="38" y2="52" strokeWidth="2.8" />
              <circle cx="38" cy="56" r="1.3" fill={emotionConfig.ledColor} stroke="none" />
              <path d="M 43 46 L 45 46 L 45 56 L 43 56" />

              {/* Right Bracket */}
              <path d="M 55 46 L 53 46 L 53 56 L 55 56" />
              <line x1="60" y1="46" x2="60" y2="52" strokeWidth="2.8" />
              <circle cx="60" cy="56" r="1.3" fill={emotionConfig.ledColor} stroke="none" />
              <path d="M 65 46 L 67 46 L 67 56 L 65 56" />
            </g>
          ) : currentEmotion === 'VIGILANT_GUARD' ? (
            /* Vigilant Guard: Watchful Diamond / Hexagonal Radar Eyes (◆ ◆) */
            <g fill={emotionConfig.ledColor}>
              {/* Left Diamond */}
              <polygon points="39,44 45,51 39,58 33,51" />
              <circle cx="39" cy="51" r="1.4" fill="#ffffff" />
              {/* Right Diamond */}
              <polygon points="61,44 67,51 61,58 55,51" />
              <circle cx="61" cy="51" r="1.4" fill="#ffffff" />
              {/* Focused Defense Mouth Line */}
              <line x1="46" y1="60" x2="54" y2="60" stroke={emotionConfig.ledColor} strokeWidth="1.8" strokeLinecap="round" />
            </g>
          ) : currentEmotion === 'ANTI_MARTINGALE_SCALING' ? (
            /* Anti-Martingale Growth: Escalating Chevrons (▲ ▲) with Cyan Glow */
            <g fill={emotionConfig.ledColor}>
              {/* Left Upward Chevron */}
              <polygon points="39,43 46,53 32,53" />
              <circle cx="39" cy="49" r="1.4" fill="#ffffff" />
              {/* Right Upward Chevron */}
              <polygon points="61,43 68,53 54,53" />
              <circle cx="61" cy="49" r="1.4" fill="#ffffff" />
              {/* Success Cheeks */}
              <circle cx="30" cy="57" r="1.6" fill="#c4b5fd" opacity="0.8" />
              <circle cx="70" cy="57" r="1.6" fill="#c4b5fd" opacity="0.8" />
            </g>
          ) : currentEmotion === 'QUANT_CALCULATING' ? (
            /* Quant Calculating: Digital Matrix Reticle [•] [•] with HUD Scan */
            <g>
              {/* Left Eye Reticle */}
              <circle cx="39" cy="51" r="5" fill="#04222f" stroke={emotionConfig.ledColor} strokeWidth="1.8" />
              <circle cx="39" cy="51" r="2.2" fill={emotionConfig.ledColor} />
              <circle cx="39" cy="51" r="0.8" fill="#ffffff" />

              {/* Right Eye Reticle */}
              <circle cx="61" cy="51" r="5" fill="#04222f" stroke={emotionConfig.ledColor} strokeWidth="1.8" />
              <circle cx="61" cy="51" r="2.2" fill={emotionConfig.ledColor} />
              <circle cx="61" cy="51" r="0.8" fill="#ffffff" />

              {/* HUD Axis crosslines */}
              <line x1="47" y1="51" x2="53" y2="51" stroke={emotionConfig.ledColor} strokeWidth="1.4" opacity="0.7" strokeDasharray="1 1" />
            </g>
          ) : (
            /* Shield Zen: Calm Smiling Eyes (⌒ ⌒) + Capital Shielded Glow */
            <g stroke={emotionConfig.ledColor} strokeWidth="2.8" strokeLinecap="round" fill="none">
              <path d="M 33 53 Q 39 45 45 53" />
              <path d="M 55 53 Q 61 45 67 53" />
              {/* Protective Shield Arc underneath */}
              <path d="M 44 60 Q 50 63 56 60" strokeWidth="1.6" opacity="0.8" />
              {/* Peaceful Emerald Cheeks */}
              <circle cx="30" cy="56" r="1.6" fill="#34d399" opacity="0.7" stroke="none" />
              <circle cx="70" cy="56" r="1.6" fill="#34d399" opacity="0.7" stroke="none" />
            </g>
          )}

          {/* Chin Grill / Micro Ventilation */}
          <g stroke={emotionConfig.ledColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.65">
            <line x1="42" y1="74" x2="42" y2="76" />
            <line x1="47" y1="73" x2="47" y2="77" />
            <line x1="53" y1="73" x2="53" y2="77" />
            <line x1="58" y1="74" x2="58" y2="76" />
          </g>
        </svg>

        {/* Pulsing Status Ping Badge on bottom-right corner */}
        <span 
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
            currentEmotion === 'CIRCUIT_BREAKER_LOCKDOWN' 
              ? 'bg-rose-500 animate-ping' 
              : currentEmotion === 'HIGH_RISK_ALERT'
              ? 'bg-orange-500 animate-pulse'
              : currentEmotion === 'VIGILANT_GUARD'
              ? 'bg-amber-400'
              : currentEmotion === 'QUANT_CALCULATING'
              ? 'bg-cyan-400'
              : 'bg-emerald-400'
          }`} 
        />
      </div>

      {/* Optional Mood Badge */}
      {showMoodBadge && (
        <div className="mt-1.5 flex flex-col items-center">
          <span className={`px-2 py-0.5 rounded-full ${sizeConfig.badgeText} font-black uppercase tracking-wider border font-mono ${emotionConfig.badgeBg} transition-colors flex items-center gap-1`}>
            <span>{emotionConfig.title}</span>
          </span>
        </div>
      )}
    </div>
  );
};

export const RiskBotAvatar = memo(RiskBotAvatarComponent);
