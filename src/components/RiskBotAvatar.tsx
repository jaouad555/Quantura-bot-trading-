import React, { useState, useEffect, memo, useMemo } from 'react';
import { Language } from '../types';
import { ShieldCheck, Zap, Eye, AlertTriangle, Lock, TrendingUp } from 'lucide-react';

export type RiskBotEmotion = 
  | 'SHIELD_ZEN' 
  | 'QUANT_CALCULATING' 
  | 'VIGILANT_GUARD' 
  | 'HIGH_RISK_ALERT' 
  | 'CIRCUIT_BREAKER_LOCKDOWN' 
  | 'ANTI_MARTINGALE_SCALING';

export interface RiskBotAvatarProps {
  riskScore?: number; // 0 - 100
  status?: string; // 'NORMAL' | 'CAUTION' | 'RESTRICTED' | 'HALTED' | 'WARNING' | 'LOCKED' | 'EMERGENCY'
  emergencyStop?: boolean;
  circuitBreakerActive?: boolean;
  antiMartingaleActive?: boolean;
  dailyLossPercent?: number;
  drawdownPercent?: number;
  maxDrawdownLimit?: number;
  floatingPnlUsdt?: number;
  realizedPnlUsdt?: number;
  activePositionsCount?: number;
  marketSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showMoodBadge?: boolean;
  language?: Language;
  onClick?: () => void;
  className?: string;
}

export function computeRiskBotEmotion(params: {
  riskScore?: number;
  status?: string;
  emergencyStop?: boolean;
  circuitBreakerActive?: boolean;
  antiMartingaleActive?: boolean;
  dailyLossPercent?: number;
  drawdownPercent?: number;
  maxDrawdownLimit?: number;
  floatingPnlUsdt?: number;
  realizedPnlUsdt?: number;
  activePositionsCount?: number;
  marketSentiment?: string;
}): RiskBotEmotion {
  const upperStatus = String(params.status || 'NORMAL').toUpperCase();
  if (
    params.emergencyStop ||
    params.circuitBreakerActive ||
    upperStatus === 'HALTED' ||
    upperStatus === 'EMERGENCY' ||
    upperStatus === 'LOCKED' ||
    (params.riskScore ?? 0) >= 85
  ) {
    return 'CIRCUIT_BREAKER_LOCKDOWN';
  }
  if (
    upperStatus === 'RESTRICTED' ||
    (params.riskScore ?? 0) >= 70 ||
    (params.drawdownPercent ?? 0) >= (params.maxDrawdownLimit ?? 10) * 0.75
  ) {
    return 'HIGH_RISK_ALERT';
  }
  if (
    upperStatus === 'CAUTION' ||
    upperStatus === 'WARNING' ||
    (params.riskScore ?? 0) >= 45 ||
    (params.dailyLossPercent ?? 0) > 1.5 ||
    (params.floatingPnlUsdt ?? 0) < -0.05
  ) {
    return 'VIGILANT_GUARD';
  }
  if (
    (params.floatingPnlUsdt ?? 0) > 0.05 ||
    (params.antiMartingaleActive && ((params.activePositionsCount ?? 0) > 0 || (params.realizedPnlUsdt ?? 0) > 0.05))
  ) {
    return 'ANTI_MARTINGALE_SCALING';
  }
  if (
    (params.activePositionsCount ?? 0) > 0 ||
    (params.riskScore ?? 0) >= 15 ||
    String(params.marketSentiment).toUpperCase() === 'BULLISH'
  ) {
    return 'QUANT_CALCULATING';
  }
  if (String(params.marketSentiment).toUpperCase() === 'BEARISH') {
    return 'VIGILANT_GUARD';
  }
  return 'SHIELD_ZEN';
}

export type RiskEmotionIconName = 'ShieldCheck' | 'Zap' | 'Eye' | 'AlertTriangle' | 'Lock' | 'TrendingUp';

export function getRiskEmotionConfig(emotion: RiskBotEmotion, language: Language = 'ar') {
  const isArabic = language === 'ar';
  const isEn = language === 'en';
  const isFrench = language === 'fr';

  switch (emotion) {
    case 'SHIELD_ZEN':
      return {
        iconName: 'ShieldCheck' as RiskEmotionIconName,
        border: 'border-emerald-500/70 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
        bgGradient: 'from-emerald-950/80 via-slate-900 to-slate-950',
        screenBg: '#022c22',
        ledColor: '#34d399',
        beaconColor: '#10b981',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        btnBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
        title: isArabic ? 'درع الأمان التام' : isEn ? 'Capital Shielded' : 'Bouclier Sécurité Totale',
        shortLabel: isArabic ? 'آمن' : isFrench ? 'SAFE' : 'SAFE',
        fullLabel: isArabic ? 'درع الأمان' : isFrench ? 'Sécurisé' : 'Shielded',
        desc: isArabic ? 'المخاطر 0%، رأس المال محمي تماماً ومطابق لمعايير الأمان' : 'Zero drawdown, capital strictly protected',
      };
    case 'QUANT_CALCULATING':
      return {
        iconName: 'Zap' as RiskEmotionIconName,
        border: 'border-cyan-400/70 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
        bgGradient: 'from-cyan-950/80 via-slate-900 to-slate-950',
        screenBg: '#04222f',
        ledColor: '#38bdf8',
        beaconColor: '#06b6d4',
        badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        btnBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]',
        title: isArabic ? 'حساب المعايير والارتباط' : isEn ? 'Risk Bounds Matrix' : 'Matrice Risque & Corrélation',
        shortLabel: isArabic ? 'رصد' : isFrench ? 'GUARD' : 'GUARD',
        fullLabel: isArabic ? 'رصد المخاطر' : isFrench ? 'Analyse Risque' : 'Risk Bounds',
        desc: isArabic ? 'تحليل لحظي لنسبة كيلي، تقلبات السوق، وحجم العقود الأمثل' : 'Computing Kelly criterion & optimal position size',
      };
    case 'VIGILANT_GUARD':
      return {
        iconName: 'Eye' as RiskEmotionIconName,
        border: 'border-amber-500/70 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
        bgGradient: 'from-amber-950/80 via-slate-900 to-slate-950',
        screenBg: '#271402',
        ledColor: '#fbbf24',
        beaconColor: '#f59e0b',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        btnBg: 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
        title: isArabic ? 'يقظة دفاعية مشددة' : isEn ? 'Defensive Vigilance' : 'Vigilance Défensive',
        shortLabel: isArabic ? 'حذر' : isFrench ? 'VIGILANT' : 'VIGILANT',
        fullLabel: isArabic ? 'يقظة وحذر' : isFrench ? 'Vigilance' : 'Vigilant Guard',
        desc: isArabic ? 'مراقبة التراجع اليومي والتعرض مع تشديد شروط وقف الخسارة' : 'Guarding drawdown & tightening stop loss barriers',
      };
    case 'HIGH_RISK_ALERT':
      return {
        iconName: 'AlertTriangle' as RiskEmotionIconName,
        border: 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.4)]',
        bgGradient: 'from-orange-950/85 via-slate-900 to-slate-950',
        screenBg: '#2d0f04',
        ledColor: '#fb923c',
        beaconColor: '#f97316',
        badgeBg: 'bg-orange-500/25 text-orange-300 border-orange-500/50 animate-pulse',
        btnBg: 'bg-orange-500/20 text-orange-300 border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.3)] animate-pulse',
        title: isArabic ? 'تحذير: سقف المخاطرة' : isEn ? 'High Risk Warning' : 'Alerte Seuil de Risque',
        shortLabel: isArabic ? 'خطر' : isFrench ? 'ALERTE' : 'ALERT',
        fullLabel: isArabic ? 'تحذير مخاطرة' : isFrench ? 'Alerte Risque' : 'High Risk Alert',
        desc: isArabic ? 'اقتراب التراجع من الحد الأقصى! تجميد فتح الصفقات الجديدة' : 'Drawdown approaching upper threshold limits',
      };
    case 'CIRCUIT_BREAKER_LOCKDOWN':
      return {
        iconName: 'Lock' as RiskEmotionIconName,
        border: 'border-rose-500 shadow-[0_0_22px_rgba(244,63,94,0.5)]',
        bgGradient: 'from-rose-950/90 via-slate-900 to-slate-950',
        screenBg: '#350614',
        ledColor: '#fb7185',
        beaconColor: '#f43f5e',
        badgeBg: 'bg-rose-500/30 text-rose-300 border-rose-500/50 animate-pulse',
        btnBg: 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse',
        title: isArabic ? 'قاطع الدائرة وقفل الطوارئ' : isEn ? 'Circuit Breaker Lockdown' : "Coupe-Circuit d'Urgence",
        shortLabel: isArabic ? 'مقفل' : isFrench ? 'BLOQUÉ' : 'LOCKED',
        fullLabel: isArabic ? 'إيقاف وقائي' : isFrench ? 'Coupe-Circuit' : 'Circuit Breaker',
        desc: isArabic ? 'تفعيل الإيقاف الوقائي الفوري لحماية المحفظة ومنع أي نزيف' : 'Emergency safety lockdown active, trading halted',
      };
    case 'ANTI_MARTINGALE_SCALING':
      return {
        iconName: 'TrendingUp' as RiskEmotionIconName,
        border: 'border-emerald-400/80 shadow-[0_0_18px_rgba(52,211,153,0.35)]',
        bgGradient: 'from-emerald-900/80 via-slate-900 to-slate-950',
        screenBg: '#022c22',
        ledColor: '#34d399',
        beaconColor: '#fbbf24',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        btnBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(52,211,153,0.25)]',
        title: isArabic ? 'تدرج الأرباح والحماية' : isEn ? 'Anti-Martingale Scale' : 'Scaling Anti-Martingale',
        shortLabel: isArabic ? 'نمو' : isFrench ? 'SCALE' : 'SCALE',
        fullLabel: isArabic ? 'تدرج الأرباح' : isFrench ? 'Scaling Gains' : 'Profit Scaling',
        desc: isArabic ? 'نمو آمن وتأمين للأرباح مع حماية صارمة لرأس المال' : 'Scaling position sizing on consecutive profits safely',
      };
  }
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
  floatingPnlUsdt = 0,
  realizedPnlUsdt = 0,
  activePositionsCount = 0,
  marketSentiment = 'NEUTRAL',
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

  // Natural blinking interval enabled across all sizes including header buttons
  useEffect(() => {
    let timeoutId: any;
    const interval = setInterval(() => {
      setIsBlinking(true);
      timeoutId = setTimeout(() => setIsBlinking(false), 170);
    }, 4200);
    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Determine current emotion tailored specifically for Risk Engine & Live Portfolio State
  const currentEmotion: RiskBotEmotion = useMemo(() => {
    return computeRiskBotEmotion({
      riskScore,
      status,
      emergencyStop,
      circuitBreakerActive,
      antiMartingaleActive,
      dailyLossPercent,
      drawdownPercent,
      maxDrawdownLimit,
      floatingPnlUsdt,
      realizedPnlUsdt,
      activePositionsCount,
      marketSentiment,
    });
  }, [
    emergencyStop,
    circuitBreakerActive,
    status,
    riskScore,
    drawdownPercent,
    maxDrawdownLimit,
    dailyLossPercent,
    antiMartingaleActive,
    floatingPnlUsdt,
    realizedPnlUsdt,
    activePositionsCount,
    marketSentiment,
  ]);

  const handleAvatarClick = () => {
    setPokeReaction(true);
    setTimeout(() => setPokeReaction(false), 1200);
    if (onClick) onClick();
  };

  const sizeConfig = {
    xs: { box: 'w-7 h-7 sm:w-8 sm:h-8 p-0.5', badgeText: 'text-[8px]' },
    sm: { box: 'w-9 h-9 sm:w-10 sm:h-10 p-0.5', badgeText: 'text-[9px]' },
    md: { box: 'w-12 h-12 sm:w-14 sm:h-14 p-1 sm:p-1.5', badgeText: 'text-[10px]' },
    lg: { box: 'w-16 h-16 sm:w-20 sm:h-20 p-1.5', badgeText: 'text-xs' },
    xl: { box: 'w-24 h-24 sm:w-28 sm:h-28 p-2', badgeText: 'text-sm' },
  }[size];

  // Tailored Risk Engine themes, glow, visor background, beacon, and badges
  const emotionConfig = useMemo(() => {
    return getRiskEmotionConfig(currentEmotion, language);
  }, [currentEmotion, language]);

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
        className={`relative ${sizeConfig.box} rounded-2xl border bg-gradient-to-b ${emotionConfig.bgGradient} ${emotionConfig.border} flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer overflow-hidden shadow-sm group`}
        style={{ transform: 'translateZ(0)' }}
      >
        {/* Precise Vector Robot Chassis identical in size and scale to Terminal Bot Robot */}
        <svg
          viewBox="6 2 88 82"
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
              <circle cx="39" cy="51" r="2.2" fill="#ffffff" stroke="none" />
              <circle cx="61" cy="51" r="5.5" />
              <circle cx="61" cy="51" r="2.2" fill="#ffffff" stroke="none" />
            </g>
          ) : currentEmotion === 'CIRCUIT_BREAKER_LOCKDOWN' ? (
            /* Emergency Lockdown: Critical Danger Cross Eyes (✕ ✕) + Lockdown Jaw */
            <g stroke={emotionConfig.ledColor} strokeWidth="3" strokeLinecap="round">
              {/* Left X Eye */}
              <line x1="34" y1="46" x2="44" y2="56" />
              <line x1="44" y1="46" x2="34" y2="56" />
              {/* Right X Eye */}
              <line x1="56" y1="46" x2="66" y2="56" />
              <line x1="66" y1="46" x2="56" y2="56" />
              {/* Emergency Lock Visor Center Warning Bar */}
              <line x1="47" y1="60" x2="53" y2="60" stroke="#ffffff" strokeWidth="2" />
            </g>
          ) : currentEmotion === 'HIGH_RISK_ALERT' ? (
            /* High Risk Warning: Alert Exclamation Visor [ ! ] [ ! ] */
            <g stroke={emotionConfig.ledColor} strokeWidth="2.8" strokeLinecap="round" fill="none">
              <path d="M 33 45 L 29 45 L 29 57 L 33 57" />
              <line x1="50" y1="44" x2="50" y2="52" strokeWidth="3.2" />
              <circle cx="50" cy="57" r="2" fill={emotionConfig.ledColor} stroke="none" />
              <path d="M 67 45 L 71 45 L 71 57 L 67 57" />
            </g>
          ) : currentEmotion === 'VIGILANT_GUARD' ? (
            /* Vigilant Guard: Defensive Guard Angled Brow Eyes + Watchful Pupils */
            <g stroke={emotionConfig.ledColor} strokeWidth="3.2" strokeLinecap="round" fill="none">
              <line x1="33" y1="46" x2="45" y2="53" />
              <line x1="67" y1="46" x2="55" y2="53" />
              <circle cx="39" cy="56" r="2" fill={emotionConfig.ledColor} stroke="none" />
              <circle cx="61" cy="56" r="2" fill={emotionConfig.ledColor} stroke="none" />
            </g>
          ) : currentEmotion === 'ANTI_MARTINGALE_SCALING' ? (
            /* Anti-Martingale Growth: Sparkling Star Eyes (★ ★) & Golden Cheeks */
            <g fill={emotionConfig.ledColor}>
              <polygon points="39,43 41,48 46,49 42,53 44,58 39,55 34,58 36,53 32,49 37,48" />
              <polygon points="61,43 63,48 68,49 64,53 66,58 61,55 56,58 58,53 54,49 59,48" />
              <circle cx="39" cy="51" r="1.5" fill="#ffffff" />
              <circle cx="61" cy="51" r="1.5" fill="#ffffff" />
              <circle cx="30" cy="57" r="2" fill="#fbbf24" opacity="0.85" />
              <circle cx="70" cy="57" r="2" fill="#fbbf24" opacity="0.85" />
            </g>
          ) : currentEmotion === 'QUANT_CALCULATING' ? (
            /* Quant Calculating: High-Tech Radar Target Reticle Eyes */
            <g>
              <circle cx="39" cy="51" r="5.5" fill="#082f49" stroke={emotionConfig.ledColor} strokeWidth="2" />
              <circle cx="39" cy="51" r="2.5" fill={emotionConfig.ledColor} />
              <circle cx="39" cy="51" r="1" fill="#ffffff" />

              <circle cx="61" cy="51" r="5.5" fill="#082f49" stroke={emotionConfig.ledColor} strokeWidth="2" />
              <circle cx="61" cy="51" r="2.5" fill={emotionConfig.ledColor} />
              <circle cx="61" cy="51" r="1" fill="#ffffff" />

              <line x1="47" y1="51" x2="53" y2="51" stroke={emotionConfig.ledColor} strokeWidth="1.5" opacity="0.7" strokeDasharray="1 1" />
            </g>
          ) : (
            /* Shield Zen: Calm Smiling Arches (⌒ ⌒) + Capital Shielded Glow */
            <g stroke={emotionConfig.ledColor} strokeWidth="3.2" strokeLinecap="round" fill="none">
              <path d="M 33 53 Q 39 44 45 53" />
              <path d="M 55 53 Q 61 44 67 53" />
              <path d="M 44 60 Q 50 63 56 60" strokeWidth="2" opacity="0.9" />
              <circle cx="31" cy="57" r="1.8" fill="#34d399" opacity="0.8" stroke="none" />
              <circle cx="69" cy="57" r="1.8" fill="#34d399" opacity="0.8" stroke="none" />
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
      </div>

      {/* Optional Mood Badge */}
      {showMoodBadge && (
        <div className="mt-1.5 flex flex-col items-center">
          <span className={`px-2 py-0.5 rounded-full ${sizeConfig.badgeText} font-black uppercase tracking-wider border font-mono ${emotionConfig.badgeBg} transition-colors flex items-center gap-1.5`}>
            {emotionConfig.iconName === 'ShieldCheck' && <ShieldCheck className="w-3 h-3 shrink-0 text-emerald-400" />}
            {emotionConfig.iconName === 'Zap' && <Zap className="w-3 h-3 shrink-0 text-cyan-400" />}
            {emotionConfig.iconName === 'Eye' && <Eye className="w-3 h-3 shrink-0 text-amber-400" />}
            {emotionConfig.iconName === 'AlertTriangle' && <AlertTriangle className="w-3 h-3 shrink-0 text-orange-400 animate-pulse" />}
            {emotionConfig.iconName === 'Lock' && <Lock className="w-3 h-3 shrink-0 text-rose-400 animate-pulse" />}
            {emotionConfig.iconName === 'TrendingUp' && <TrendingUp className="w-3 h-3 shrink-0 text-emerald-400" />}
            <span>{emotionConfig.title}</span>
          </span>
        </div>
      )}
    </div>
  );
};

export const RiskBotAvatar = memo(RiskBotAvatarComponent);
