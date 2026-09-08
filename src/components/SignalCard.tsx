import React, { useState } from 'react';
import { AIAnalysisResult, Language, Timeframe, AutoBotConfig } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldAlert,
  Target,
  Copy,
  Check,
  Sparkles,
  AlertOctagon,
  Layers,
  BarChart,
  HelpCircle,
  Percent,
  CheckCircle2,
  Cpu,
  ArrowRight,
  Bell,
  BellRing,
  Bot,
} from 'lucide-react';

interface SignalCardProps {
  symbol?: string;
  signal: AIAnalysisResult | null;
  language: Language;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  botConfig?: AutoBotConfig;
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
  onUpdateBotConfig,
  onNotifyRecommendation,
  onOpenNotifications,
}) => {
  const [copied, setCopied] = useState(false);
  const [notified, setNotified] = useState(false);
  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  // Selected bot/execution market mode (SPOT vs FUTURES)
  const currentMarketType = botConfig?.marketType || 'FUTURES';
  const currentLeverage = botConfig?.leverage || (currentMarketType === 'FUTURES' ? 10 : 1);
  const currentMarginMode = botConfig?.marginMode || 'ISOLATED';

  if (!signal) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Initialisation du Terminal Quantitatif</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-4">
          Calcul des indicateurs mathématiques, détection du régime de marché et scoring de confluence en cours...
        </p>
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-brand-500/20 transition disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              <span>{t.terminal.analyzing}</span>
            </>
          ) : (
            <>
              <Cpu className="w-4 h-4" />
              <span>{t.terminal.runAnalysis}</span>
            </>
          )}
        </button>
      </div>
    );
  }

  const { decision, confidence, marketRegime, entryQuality, quantScore, entryZone, targets, stopLoss, riskRewardRatio, invalidation, scenarios } = signal;

  const getDecisionTheme = () => {
    switch (decision) {
      case 'LONG':
        return {
          badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          gradient: 'from-emerald-500/10 via-slate-900 to-slate-950',
          border: 'border-emerald-500/30',
          icon: <TrendingUp className="w-6 h-6 text-emerald-400" />,
          title: t.decisions.LONG,
        };
      case 'SHORT':
        return {
          badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          gradient: 'from-rose-500/10 via-slate-900 to-slate-950',
          border: 'border-rose-500/30',
          icon: <TrendingDown className="w-6 h-6 text-rose-400" />,
          title: t.decisions.SHORT,
        };
      case 'WAIT':
        return {
          badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          gradient: 'from-amber-500/10 via-slate-900 to-slate-950',
          border: 'border-amber-500/30',
          icon: <Clock className="w-6 h-6 text-amber-400" />,
          title: t.decisions.WAIT,
        };
      default:
        return {
          badge: 'bg-slate-800 text-slate-400 border-slate-700',
          gradient: 'from-slate-800/20 via-slate-900 to-slate-950',
          border: 'border-slate-800',
          icon: <HelpCircle className="w-6 h-6 text-slate-400" />,
          title: t.decisions.NO_TRADE,
        };
    }
  };

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case 'A':
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold">GRADE A ⭐</span>;
      case 'B':
        return <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-mono font-bold">GRADE B</span>;
      case 'C':
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">GRADE C ⚠️</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold">GRADE D ⛔</span>;
    }
  };

  const handleCopy = () => {
    const isLong = decision === 'LONG';
    const isShort = decision === 'SHORT';
    const isSpotMode = currentMarketType === 'SPOT';
    const isFuturesMode = currentMarketType === 'FUTURES';

    const ideal = entryZone ? entryZone.ideal : (signal.currentPrice || 0);
    const minEntry = entryZone ? entryZone.min : ideal;
    const maxEntry = entryZone ? entryZone.max : ideal;
    const tf = signal.recommendedTimeframe.toUpperCase();

    const marketHeader = isSpotMode ? 'SPOT' : `FUTURES (${currentLeverage}x)`;

    const text = isArabic
      ? `
🎯 إشارة ${symbol} (${tf}) [${marketHeader}]
• القرار : ${t.decisions[decision] || decision} (القوة: ${confidence}%)
• الدخول المثالي : ${entryZone ? `$${formatCoinPrice(entryZone.ideal, symbol)}` : 'N/A'} (النطاق: $${formatCoinPrice(entryZone?.min, symbol)} - $${formatCoinPrice(entryZone?.max, symbol)})
• الهدف 1 : ${targets ? `$${formatCoinPrice(targets.tp1, symbol)}` : 'N/A'}
• الهدف 2 : ${targets ? `$${formatCoinPrice(targets.tp2, symbol)}` : 'N/A'}
• الهدف 3 : ${targets ? `$${formatCoinPrice(targets.tp3, symbol)}` : 'N/A'}
• وقف الخسارة : ${stopLoss ? `$${formatCoinPrice(stopLoss, symbol)}` : 'N/A'}
• الإلغاء : ${invalidation.reason}
• نسبة R/R : ${riskRewardRatio ? `1:${riskRewardRatio}` : 'N/A'}
© 2026 jaouad abdechchafi — Binance AI Trading Terminal
`.trim()
      : `
🎯 SIGNAL ${symbol} (${tf}) [${marketHeader}]
• Décision : ${decision} (Force: ${confidence}%)
• Entrée Idéale : ${entryZone ? `$${formatCoinPrice(entryZone.ideal, symbol)}` : 'N/A'} (Zone: $${formatCoinPrice(entryZone?.min, symbol)} - $${formatCoinPrice(entryZone?.max, symbol)})
• TP1 : ${targets ? `$${formatCoinPrice(targets.tp1, symbol)}` : 'N/A'}
• TP2 : ${targets ? `$${formatCoinPrice(targets.tp2, symbol)}` : 'N/A'}
• TP3 : ${targets ? `$${formatCoinPrice(targets.tp3, symbol)}` : 'N/A'}
• Stop Loss : ${stopLoss ? `$${formatCoinPrice(stopLoss, symbol)}` : 'N/A'}
• Invalidation : ${invalidation.reason}
• Ratio R/R : ${riskRewardRatio ? `1:${riskRewardRatio}` : 'N/A'}
© 2026 jaouad abdechchafi — Binance AI Trading Terminal
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

  const theme = getDecisionTheme();

  return (
    <div className={`bg-gradient-to-b ${theme.gradient} border ${theme.border} rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* Top Bar: Regime, Grade, Confidence, Notification Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          {/* Market Regime Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 transform-gpu isolate border border-slate-800 text-xs font-mono text-slate-300">
            <Layers className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-slate-500">{t.terminal.marketRegime}:</span>
            <span className="font-bold text-white">{t.regimes[marketRegime] || marketRegime}</span>
          </div>

          {/* Entry Quality Grade */}
          {getGradeBadge(entryQuality.grade)}

          {/* Recommendation Notification Badge */}
          <button
            onClick={handleNotify}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono border transition ${
              notified
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
            }`}
            title={t.terminal.recommendationAlertTooltip}
          >
            {notified ? <BellRing className="w-3.5 h-3.5 text-emerald-400 animate-bounce" /> : <Bell className="w-3.5 h-3.5 text-indigo-400" />}
            <span className="font-bold">
              {notified
                ? (isArabic ? 'تم تفعيل التنبيه ✓' : 'Alerte Active ✓')
                : (isArabic ? 'إشعار التوصية 🔔' : 'Notification Signal 🔔')}
            </span>
          </button>
        </div>

        {/* Signal Strength Meter */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">{t.terminal.signalStrength}</span>
            <span className="text-sm font-mono font-black text-brand-400">{confidence}%</span>
          </div>
          <div className="w-24 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-700 ${
                confidence >= 75 ? 'bg-emerald-400' : confidence >= 60 ? 'bg-brand-400' : 'bg-amber-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(10, confidence))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Signal Display */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-2xl border ${theme.badge}`}>
            {theme.icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight`}>
                {theme.title}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {signal.tradeType.replace('_', ' ')}
              </span>

              {/* Market Execution Badge (SPOT vs FUTURES) */}
              {decision === 'LONG' && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>{isArabic ? '🟢 فوري SPOT (1x)' : '🟢 SPOT (1x)'}</span>
                  </span>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span>{isArabic ? '⚡ عقود FUTURES (3x-5x)' : '⚡ FUTURES (3x-5x)'}</span>
                  </span>
                </div>
              )}

              {decision === 'SHORT' && (
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                  <span>{isArabic ? '⚡ عقود آجلة فقط FUTURES SHORT (3x-5x)' : '⚡ FUTURES SHORT ONLY (3x-5x)'}</span>
                </span>
              )}

              {decision === 'WAIT' && (
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {isArabic ? 'مراقبة SPOT & FUTURES' : 'Observation SPOT & FUTURES'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl font-sans">
              {entryQuality.reason}
            </p>
          </div>
        </div>

        {/* Action Buttons with Notification & Mode Selector */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Quick Mode Toggle: SPOT vs FUTURES */}
          {onUpdateBotConfig && (
            <div className="flex items-center p-0.5 rounded-xl bg-slate-950 transform-gpu isolate border border-slate-800">
              <button
                type="button"
                onClick={() => onUpdateBotConfig({ marketType: 'SPOT', leverage: 1 })}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition flex items-center gap-1 ${
                  currentMarketType === 'SPOT'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isArabic ? 'تفعيل وضع التداول الفوري SPOT' : 'Activer le mode Spot'}
              >
                <span>🟢</span>
                <span>SPOT</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateBotConfig({ marketType: 'FUTURES' })}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition flex items-center gap-1 ${
                  currentMarketType === 'FUTURES'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isArabic ? `تفعيل وضع العقود الآجلة FUTURES (${currentLeverage}x)` : `Activer le mode Futures (${currentLeverage}x)`}
              >
                <span>⚡</span>
                <span>FUTURES {currentLeverage}x</span>
              </button>
            </div>
          )}

          {/* Notification Icon Button */}
          <button
            onClick={handleNotify}
            className={`flex-1 md:flex-initial px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm ${
              notified
                ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300 shadow-emerald-500/10'
                : 'bg-indigo-600/20 hover:bg-indigo-600/30 border-indigo-500/40 text-indigo-200'
            }`}
            title={t.terminal.recommendationAlertTooltip}
          >
            {notified ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isArabic ? 'تم تفعيل التنبيه' : 'Alerte Notifiée'}</span>
              </>
            ) : (
              <>
                <BellRing className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>{isArabic ? 'إشعار التوصية' : 'Alerte Signal'}</span>
              </>
            )}
          </button>

          <button
            onClick={handleCopy}
            className={`flex-1 md:flex-initial px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={
              isArabic
                ? `نسخ خطة التداول المخصصة لوضع (${currentMarketType === 'SPOT' ? 'SPOT 1x' : `FUTURES ${currentLeverage}x`})`
                : `Copier le plan adapté au mode (${currentMarketType === 'SPOT' ? 'SPOT 1x' : `FUTURES ${currentLeverage}x`})`
            }
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>
              {copied
                ? t.terminal.copied
                : isArabic
                ? `نسخ الخطة (${currentMarketType})`
                : `Copier Plan (${currentMarketType})`}
            </span>
          </button>

          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="flex-1 md:flex-initial px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/20 transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAnalyzing ? t.terminal.analyzing : t.terminal.runAnalysis}</span>
          </button>
        </div>
      </div>

      {/* Trade Execution Plan Grid (Entry, TP1, TP2, TP3, SL, R:R) */}
      {(decision === 'LONG' || decision === 'SHORT') && entryZone && targets && stopLoss && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
          {/* Entry Zone */}
          <div className="bg-slate-950 transform-gpu isolate border border-blue-500/30 rounded-xl p-3">
            <span className="text-[10px] font-mono text-blue-400 uppercase block font-semibold">
              {t.terminal.entryZone}
            </span>
            <div className="text-sm sm:text-base font-mono font-bold text-white mt-0.5">
              ${formatCoinPrice(entryZone.ideal, symbol)}
            </div>
            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
              ${formatCoinPrice(entryZone.min, symbol)} - ${formatCoinPrice(entryZone.max, symbol)}
            </span>
          </div>

          {/* TP1 */}
          <div className="bg-slate-950 transform-gpu isolate border border-emerald-500/30 rounded-xl p-3">
            <span className="text-[10px] font-mono text-emerald-400 uppercase block font-semibold">
              {t.terminal.takeProfit1}
            </span>
            <div className="text-sm sm:text-base font-mono font-bold text-emerald-400 mt-0.5">
              ${formatCoinPrice(targets.tp1, symbol)}
            </div>
            <span className="text-[10px] font-mono text-emerald-500/80 block mt-0.5">
              {decision === 'LONG' ? '+' : '-'}{Math.abs(Math.round(((targets.tp1 - entryZone.ideal) / entryZone.ideal) * 1000) / 10)}% (R:1.5)
            </span>
          </div>

          {/* TP2 */}
          <div className="bg-slate-950 transform-gpu isolate border border-emerald-500/30 rounded-xl p-3">
            <span className="text-[10px] font-mono text-emerald-400 uppercase block font-semibold">
              {t.terminal.takeProfit2}
            </span>
            <div className="text-sm sm:text-base font-mono font-bold text-emerald-300 mt-0.5">
              ${formatCoinPrice(targets.tp2, symbol)}
            </div>
            <span className="text-[10px] font-mono text-emerald-500/80 block mt-0.5">
              {decision === 'LONG' ? '+' : '-'}{Math.abs(Math.round(((targets.tp2 - entryZone.ideal) / entryZone.ideal) * 1000) / 10)}% (R:2.5)
            </span>
          </div>

          {/* TP3 */}
          <div className="bg-slate-950 transform-gpu isolate border border-emerald-500/30 rounded-xl p-3">
            <span className="text-[10px] font-mono text-emerald-400 uppercase block font-semibold">
              {t.terminal.takeProfit3}
            </span>
            <div className="text-sm sm:text-base font-mono font-bold text-emerald-200 mt-0.5">
              ${formatCoinPrice(targets.tp3, symbol)}
            </div>
            <span className="text-[10px] font-mono text-emerald-500/80 block mt-0.5">
              {decision === 'LONG' ? '+' : '-'}{Math.abs(Math.round(((targets.tp3 - entryZone.ideal) / entryZone.ideal) * 1000) / 10)}% (R:4.0)
            </span>
          </div>

          {/* Stop Loss */}
          <div className="bg-slate-950 transform-gpu isolate border border-rose-500/30 rounded-xl p-3">
            <span className="text-[10px] font-mono text-rose-400 uppercase block font-semibold">
              {t.terminal.stopLoss}
            </span>
            <div className="text-sm sm:text-base font-mono font-bold text-rose-400 mt-0.5">
              ${formatCoinPrice(stopLoss, symbol)}
            </div>
            <span className="text-[10px] font-mono text-rose-500/80 block mt-0.5">
              -{Math.abs(Math.round(((stopLoss - entryZone.ideal) / entryZone.ideal) * 1000) / 10)}% (Risque)
            </span>
          </div>

          {/* Risk/Reward Ratio */}
          <div className="bg-slate-950 transform-gpu isolate border border-indigo-500/30 rounded-xl p-3">
            <span className="text-[10px] font-mono text-indigo-400 uppercase block font-semibold">
              {t.terminal.riskRewardRatio}
            </span>
            <div className="text-sm sm:text-base font-mono font-bold text-indigo-300 mt-0.5">
              1:{riskRewardRatio || '2.5'}
            </div>
            <span className="text-[10px] font-mono text-indigo-400/80 block mt-0.5">
              Fenêtre: {signal.timing.expectedDuration}
            </span>
          </div>
        </div>
      )}

      {/* Invalidation Level Box */}
      <div className="bg-slate-950 transform-gpu isolate border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs">
        <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-amber-300 block uppercase tracking-wider text-[11px]">
            {t.terminal.invalidationTitle}
          </span>
          <p className="text-slate-300 font-sans leading-relaxed">
            {invalidation.reason}
          </p>
        </div>
      </div>

      {/* Forward Scenarios (Primary vs Alternative) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1">
          <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />
            {t.terminal.primaryScenario}
          </span>
          <p className="text-slate-300 font-sans leading-relaxed">
            {scenarios.primary}
          </p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            {t.terminal.alternativeScenario}
          </span>
          <p className="text-slate-400 font-sans leading-relaxed">
            {scenarios.alternative}
          </p>
        </div>
      </div>

      {/* Quantitative Scoring Breakdown */}
      {quantScore && quantScore.breakdown && (
        <div className="bg-slate-950 transform-gpu isolate border border-slate-800/90 rounded-xl p-3.5 space-y-2.5">
          <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
            {t.terminal.quantBreakdown}
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-[11px] font-mono">
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Tendance (20%)</span>
              <span className="text-slate-200 font-bold">{quantScore.breakdown.trend}%</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Structure (20%)</span>
              <span className="text-slate-200 font-bold">{quantScore.breakdown.marketStructure}%</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Momentum (15%)</span>
              <span className="text-slate-200 font-bold">{quantScore.breakdown.momentum}%</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Volume/VWAP (10%)</span>
              <span className="text-slate-200 font-bold">{quantScore.breakdown.volume}%</span>
            </div>
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Supports/Res. (10%)</span>
              <span className="text-slate-200 font-bold">{quantScore.breakdown.supportResistance}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Risk Warning */}
      <div className="text-[11px] font-sans text-slate-500 text-center pt-1 border-t border-slate-800/60">
        ⚠️ {t.terminal.riskWarning}
      </div>
    </div>
  );
};
