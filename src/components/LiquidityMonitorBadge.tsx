import React, { useMemo } from 'react';
import { LiquidityHealthAssessment, Language } from '../types';
import {
  Waves,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
  Scale,
  DollarSign,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface LiquidityMonitorBadgeProps {
  assessment: LiquidityHealthAssessment | null;
  language: Language;
  onOpenDepthDetails?: () => void;
  compact?: boolean;
}

export const LiquidityMonitorBadge: React.FC<LiquidityMonitorBadgeProps> = ({
  assessment,
  language,
  onOpenDepthDetails,
  compact = false,
}) => {
  const isArabic = language === 'ar';

  if (!assessment) return null;

  const { status, slippageRisk, estimatedSlippagePercent, depthRatio, calculatedPositionUsdt, availableDepthUsdt, warnings } = assessment;

  const isWarning = status === 'INSUFFICIENT' || status === 'CRITICAL_ILLIQUID';
  const isModerate = status === 'MODERATE';

  const getStatusColor = () => {
    switch (status) {
      case 'CRITICAL_ILLIQUID':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
      case 'INSUFFICIENT':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MODERATE':
        return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
      case 'EXCELLENT':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    }
  };

  const getStatusLabel = () => {
    if (isArabic) {
      switch (status) {
        case 'CRITICAL_ILLIQUID':
          return 'سيولة حرجة (انزلاق خطير ⚠️)';
        case 'INSUFFICIENT':
          return 'عمق دفتر غير كافٍ ⚠️';
        case 'MODERATE':
          return 'سيولة متوسطة ⚡';
        case 'EXCELLENT':
          return 'سيولة ممتازة وعميقة ✓';
        default:
          return 'عمق دفتر ملائم ✓';
      }
    } else {
      switch (status) {
        case 'CRITICAL_ILLIQUID':
          return 'Liquidité Critique (Glissement Sévère ⚠️)';
        case 'INSUFFICIENT':
          return 'Profondeur Insuffisante ⚠️';
        case 'MODERATE':
          return 'Liquidité Modérée ⚡';
        case 'EXCELLENT':
          return 'Liquidité Optimale & Profonde ✓';
        default:
          return 'Profondeur Adéquate ✓';
      }
    }
  };

  if (compact) {
    return (
      <div
        onClick={onOpenDepthDetails}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono border cursor-pointer transition hover:opacity-90 ${getStatusColor()}`}
        title={`${isArabic ? 'مراقب السيولة والانزلاق' : 'Moniteur de Liquidité'}: ${assessment.suggestedAction}`}
      >
        <Waves className="w-3.5 h-3.5" />
        <span className="font-bold">{getStatusLabel()}</span>
        <span className="opacity-75">({estimatedSlippagePercent.toFixed(2)}% slip)</span>
      </div>
    );
  }

  return (
    <div className={`p-3.5 rounded-xl border ${getStatusColor()} backdrop-blur-sm transition-all duration-300`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isWarning ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Waves className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span className="text-xs font-bold font-mono tracking-wide uppercase">
            {isArabic ? 'مراقب السيولة والانزلاق السعري (Liquidity Monitor)' : 'Moniteur de Liquidité & Glissement L2'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-slate-950/60 border border-current/20">
            {getStatusLabel()}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span title={isArabic ? 'الانزلاق المتوقع' : 'Glissement estimé'}>
            <span className="text-slate-400 text-[10px] block">{isArabic ? 'الانزلاق المقدر' : 'Slippage'}</span>
            <strong className={isWarning ? 'text-rose-400 font-black' : isModerate ? 'text-amber-400' : 'text-emerald-400'}>
              ~{estimatedSlippagePercent.toFixed(2)}%
            </strong>
          </span>

          <span title={isArabic ? 'تغطية عمق الدفتر' : 'Couverture du carnet'}>
            <span className="text-slate-400 text-[10px] block">{isArabic ? 'تغطية الدفتر' : 'Couverture'}</span>
            <strong>{depthRatio.toFixed(1)}x</strong>
          </span>
        </div>
      </div>

      {/* Warnings & Suggestion */}
      {warnings.length > 0 && (
        <div className="mt-1 text-[11px] text-rose-300/95 space-y-0.5 bg-slate-950/40 p-2 rounded-lg border border-rose-500/20">
          {warnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <span className="text-rose-400 font-bold">•</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-current/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="text-slate-300">
          <span className="text-slate-400">{isArabic ? 'حجم الصفقة المحسوب:' : 'Taille calculée:'} </span>
          <span className="font-mono font-bold">${calculatedPositionUsdt} USDT</span>
          <span className="text-slate-500 mx-1.5">|</span>
          <span className="text-slate-400">{isArabic ? 'عمق الدفتر المتوفر:' : 'Profondeur L2:'} </span>
          <span className="font-mono font-bold">${availableDepthUsdt} USDT</span>
        </div>

        {onOpenDepthDetails && (
          <button
            onClick={onOpenDepthDetails}
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold text-xs underline underline-offset-2 transition"
          >
            <span>{isArabic ? 'عرض دفتر الأوامر الكامل' : 'Voir carnet L2'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
