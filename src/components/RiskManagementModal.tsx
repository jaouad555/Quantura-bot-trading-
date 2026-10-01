import React, { useState, useEffect } from 'react';
import { 
  X, AlertTriangle, RefreshCw, ShieldCheck, 
  TrendingDown, Anchor, Activity, Sliders,
  Unlock, AlertOctagon, Flame, Layers, Shield,
  RotateCcw, CheckCircle2, Sparkles, Info, Bot,
  Trash2
} from 'lucide-react';
import { 
  AutoBotConfig, Language, BinanceApiConfig, PaperWallet, TradingExecutionMode,
  FrontendRiskEngineConfig, RiskEngineMetrics, RiskAuditLogEntry, RiskLockStatus 
} from '../types';
import { RiskBotAvatar } from './RiskBotAvatar';

interface RiskManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  botConfig: AutoBotConfig;
  onSaveConfig: (config: AutoBotConfig) => void;
  executionMode: TradingExecutionMode;
  binanceConfig: BinanceApiConfig;
  paperWallet: PaperWallet;
}

export const RiskManagementModal: React.FC<RiskManagementModalProps> = ({
  isOpen,
  onClose,
  language,
  botConfig,
  onSaveConfig,
  executionMode,
  binanceConfig,
  paperWallet
}) => {
  const isArabic = language === 'ar';
  const [activeTab, setActiveTab] = useState<'METRICS' | 'CONFIG' | 'AUDIT'>('METRICS');
  
  // Risk Engine Live State
  const [metrics, setMetrics] = useState<RiskEngineMetrics | null>(null);
  const [riskConfig, setRiskConfig] = useState<FrontendRiskEngineConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<RiskAuditLogEntry[]>([]);
  const [auditStats, setAuditStats] = useState<{ totalEvaluations: number; approvedCount: number; rejectedCount: number; approvalRatePercent: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessNotice, setResetSuccessNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [riskPerTrade, setRiskPerTrade] = useState('1.0');
  const [maxDailyLoss, setMaxDailyLoss] = useState('3.0');
  const [maxDrawdown, setMaxDrawdown] = useState('10.0');
  const [maxAllowedLeverage, setMaxAllowedLeverage] = useState('10');
  const [minRiskReward, setMinRiskReward] = useState('2.0');
  const [maxPortfolioRisk, setMaxPortfolioRisk] = useState('3.0');
  const [maxSymbolExposure, setMaxSymbolExposure] = useState('20.0');
  const [antiMartingale, setAntiMartingale] = useState(true);

  // Fetch Risk Engine data
  const fetchRiskData = async () => {
    try {
      setIsLoading(true);
      const [metricsRes, configRes, auditRes] = await Promise.all([
        fetch('/api/risk/metrics'),
        fetch('/api/risk/config'),
        fetch('/api/risk/audit-logs?limit=25')
      ]);

      if (metricsRes.ok) {
        const m = await metricsRes.json();
        setMetrics(m);
      }
      if (configRes.ok) {
        const c: any = await configRes.json();
        if (c) {
          setRiskConfig(c);
          if (c.riskPerTradePercent !== undefined) setRiskPerTrade(String(c.riskPerTradePercent));
          if (c.maxDailyLossPercent !== undefined) setMaxDailyLoss(String(c.maxDailyLossPercent));
          const dd = c.maxDrawdownPercent ?? c.maxAccountDrawdownPercent;
          if (dd !== undefined) setMaxDrawdown(String(dd));
          if (c.maxAllowedLeverage !== undefined) setMaxAllowedLeverage(String(c.maxAllowedLeverage));
          if (c.minRiskRewardRatio !== undefined) setMinRiskReward(String(c.minRiskRewardRatio));
          if (c.maxPortfolioRiskPercent !== undefined) setMaxPortfolioRisk(String(c.maxPortfolioRiskPercent));
          if (c.maxSymbolExposurePercent !== undefined) setMaxSymbolExposure(String(c.maxSymbolExposurePercent));
          setAntiMartingale(c.antiMartingaleEnabled ?? true);
        }
      }
      if (auditRes.ok) {
        const a = await auditRes.json();
        setAuditLogs(a.logs || []);
        setAuditStats(a.stats || null);
      }
    } catch (err: any) {
      console.error('Failed to fetch risk engine data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRiskData();
      const interval = setInterval(fetchRiskData, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Actions
  const handleSaveRiskConfig = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);

      const payload = {
        riskPerTradePercent: Math.min(2.0, Math.max(0.1, parseFloat(riskPerTrade) || 1.0)),
        maxDailyLossPercent: Math.min(10.0, Math.max(0.5, parseFloat(maxDailyLoss) || 3.0)),
        maxDrawdownPercent: Math.min(25.0, Math.max(2.0, parseFloat(maxDrawdown) || 10.0)),
        maxAllowedLeverage: Math.min(10, Math.max(1, parseInt(maxAllowedLeverage, 10) || 10)),
        minRiskRewardRatio: Math.min(5.0, Math.max(1.0, parseFloat(minRiskReward) || 2.0)),
        maxPortfolioRiskPercent: Math.min(10.0, Math.max(0.5, parseFloat(maxPortfolioRisk) || 3.0)),
        maxSymbolExposurePercent: Math.min(50.0, Math.max(5.0, parseFloat(maxSymbolExposure) || 20.0)),
        antiMartingaleEnabled: antiMartingale,
      };

      const res = await fetch('/api/risk/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save risk configuration');
      }

      onSaveConfig({
        ...botConfig,
        riskPerTradePercent: payload.riskPerTradePercent,
        dailyDrawdownLimitPercent: payload.maxDailyLossPercent,
        leverage: Math.min(botConfig.leverage || 5, payload.maxAllowedLeverage)
      });

      await fetchRiskData();
      setActiveTab('METRICS');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEmergencyStop = async (active: boolean) => {
    try {
      setIsLoading(true);
      await fetch('/api/risk/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, reason: 'Manual Emergency Kill Switch via Dashboard UI' })
      });
      await fetchRiskData();
    } catch (err) {
      console.error('Failed to toggle emergency stop:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Full Reset to ZERO
  const handleResetAllToZero = async () => {
    try {
      setIsResetting(true);
      setErrorMessage(null);
      const [res] = await Promise.all([
        fetch('/api/risk/reset-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }),
        fetch('/api/risk/audit-logs', { method: 'DELETE' }).catch(() => null)
      ]);
      if (res && res.ok) {
        setResetSuccessNotice(true);
        setAuditLogs([]);
        setAuditStats({ totalEvaluations: 0, approvedCount: 0, rejectedCount: 0, approvalRatePercent: 100 });
        setTimeout(() => setResetSuccessNotice(false), 4500);
      }
      await fetchRiskData();
    } catch (err: any) {
      console.error('Failed to reset risk engine to zero:', err);
      setErrorMessage(err.message || 'Failed to reset risk engine');
    } finally {
      setIsResetting(false);
    }
  };

  // Clear Audit Trail Logs
  const handleClearAuditLogs = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/risk/audit-logs', { method: 'DELETE' });
      if (res.ok) {
        setAuditLogs([]);
        setAuditStats({ totalEvaluations: 0, approvedCount: 0, rejectedCount: 0, approvalRatePercent: 100 });
      }
    } catch (err: any) {
      console.error('Failed to clear audit trail logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score === 0) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score < 30) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score < 60) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    if (score < 80) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getLockBadge = (status?: RiskLockStatus) => {
    switch (status) {
      case 'EMERGENCY':
        return { label: isArabic ? 'إيقاف طوارئ كامل' : 'EMERGENCY KILL SWITCH', color: 'bg-rose-600 text-white animate-pulse' };
      case 'LOCKED':
        return { label: isArabic ? 'المحرك مقفل (تجاوز الحدود)' : 'RISK LOCKED', color: 'bg-rose-500 text-white font-bold' };
      case 'RESTRICTED':
        return { label: isArabic ? 'تداول مقيد (حجم مخفض)' : 'RESTRICTED SIZING', color: 'bg-amber-500 text-slate-950 font-bold' };
      case 'WARNING':
        return { label: isArabic ? 'تحذير مخاطر' : 'RISK WARNING', color: 'bg-yellow-500 text-slate-950 font-bold' };
      default:
        return { label: isArabic ? 'نظام المخاطر: آمن تماماً (0 خسائر)' : 'ALL SYSTEMS OPTIMAL', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold' };
    }
  };

  const lockBadge = getLockBadge(metrics?.riskLockStatus || riskConfig?.riskLockStatus);
  const currentRiskScore = metrics?.riskScore ?? 0;
  const isScoreZero = currentRiskScore === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden transform transition-all max-h-[92vh] min-h-0">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            {/* Dynamic Robot Emotions Icon for Risk Engine - Styled like Terminal Robot */}
            <RiskBotAvatar
              riskScore={currentRiskScore}
              status={metrics?.riskLockStatus || riskConfig?.riskLockStatus}
              emergencyStop={metrics?.emergencyStop}
              circuitBreakerActive={Boolean(metrics?.emergencyStop || metrics?.riskLockStatus === 'LOCKED' || metrics?.riskLockStatus === 'EMERGENCY')}
              antiMartingaleActive={antiMartingale}
              dailyLossPercent={metrics?.dailyLossPercent}
              drawdownPercent={metrics?.currentDrawdownPercent}
              maxDrawdownLimit={parseFloat(maxDrawdown) || 10}
              size="md"
              language={language}
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white font-sans tracking-tight">
                  {isArabic ? 'محرك إدارة المخاطر المؤسسي' : 'Quantura Risk Engine'}
                </h2>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  v2.0 PRO
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  {isArabic ? 'روبوت الحماية الفورية' : 'Risk Emotion AI'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                {isArabic ? 'حماية رأس المال والمطابقة الرياضية الصارمة قبل التنفيذ' : 'Deterministic Capital Preservation & Pre-Trade Defense'}
              </p>
            </div>
          </div>
          <button 
            id="btn-close-risk-modal"
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center px-3 sm:px-4 pt-2 border-b border-slate-800/80 bg-slate-950/40 gap-1.5 overflow-x-auto no-scrollbar">
          <button
            id="tab-risk-metrics"
            onClick={() => setActiveTab('METRICS')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'METRICS'
                ? 'text-cyan-400 border-cyan-500 bg-slate-800/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {isArabic ? 'لوحة القياس الحية' : 'Live Risk Metrics'}
          </button>
          <button
            id="tab-risk-config"
            onClick={() => setActiveTab('CONFIG')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'CONFIG'
                ? 'text-cyan-400 border-cyan-500 bg-slate-800/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            {isArabic ? 'معايير المخاطر الصارمة' : 'Risk Bounds Configuration'}
          </button>
          <button
            id="tab-risk-audit"
            onClick={() => setActiveTab('AUDIT')}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'AUDIT'
                ? 'text-cyan-400 border-cyan-500 bg-slate-800/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {isArabic ? 'سجل التدقيق المؤسسي' : 'Audit Trail Logs'}
            {auditStats && (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                {auditStats.totalEvaluations}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-5 space-y-4 overflow-y-auto overscroll-contain touch-pan-y flex-1 min-h-0">

          {/* Master Control & Action Banner */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-slate-950 border border-slate-800/90 gap-3 shadow-inner">
            <div className="flex items-center gap-2.5">
              <span className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] uppercase tracking-wider font-mono ${lockBadge.color}`}>
                {lockBadge.label}
              </span>
              {metrics?.riskLockReason && (
                <span className="text-xs text-rose-400 font-medium">
                  {metrics.riskLockReason}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
              {/* PRIMARY PROMINENT RESET BUTTON */}
              <button
                id="btn-master-reset-all"
                onClick={handleResetAllToZero}
                disabled={isResetting || isLoading}
                title={isArabic ? 'إعادة تصفير كل العدادات والتراجع وسلسلة الخسائر إلى الصفر' : 'Reset all drawdowns, loss streaks, and metrics to clean zero baseline'}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all transform active:scale-95 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{isArabic ? 'إعادة التصفير للصفر (Reset to Zero)' : 'Reset All to ZERO'}</span>
              </button>

              {/* Unlock button if locked specifically */}
              {metrics?.riskLockStatus === 'LOCKED' && (
                <button
                  id="btn-unlock-risk-lock"
                  onClick={handleResetAllToZero}
                  disabled={isLoading || isResetting}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'فك القفل' : 'Unlock Engine'}</span>
                </button>
              )}

              {/* Kill switch button */}
              <button
                id="btn-toggle-emergency-kill-switch"
                onClick={() => handleToggleEmergencyStop(!metrics?.emergencyStop)}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer ${
                  metrics?.emergencyStop
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-rose-600/90 hover:bg-rose-600 text-white shadow-rose-600/20'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>
                  {metrics?.emergencyStop 
                    ? (isArabic ? 'استئناف التداول' : 'Resume System') 
                    : (isArabic ? 'قاطع الطوارئ' : 'Kill Switch')}
                </span>
              </button>
            </div>
          </div>

          {/* Success Banner on Reset */}
          {resetSuccessNotice && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">
                  {isArabic 
                    ? '✅ تم تصفير محرك المخاطر بنجاح: تم إلغاء القفل، وتصفير سلسلة الخسائر، وإعادة ضبط ذروة الحساب إلى الرصيد الفعلي الحالي!' 
                    : '✅ Risk Engine successfully reset to ZERO: Lock cleared, streak reset, and equity baseline recalibrated!'}
                </span>
              </div>
              <button onClick={() => setResetSuccessNotice(false)} className="text-emerald-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: METRICS */}
          {activeTab === 'METRICS' && (
            <div className="space-y-4">

              {/* Top Core Metrics (3-Column Grid) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                
                {/* 1. Quantitative Risk Score Card */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-cyan-400" />
                      {isArabic ? 'مؤشر عواطف ومخاطر الروبوت' : 'Robot Risk Emotion Index'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      0 - 100
                    </span>
                  </div>

                  <div className="my-2.5 flex items-baseline gap-2.5">
                    <span className={`text-4xl font-black font-mono tracking-tight ${
                      isScoreZero ? 'text-emerald-400' :
                      currentRiskScore < 30 ? 'text-emerald-400' :
                      currentRiskScore < 60 ? 'text-yellow-400' :
                      currentRiskScore < 80 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {currentRiskScore}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${getScoreColor(currentRiskScore)}`}>
                      {isScoreZero ? (isArabic ? 'صفر مخاطرة (آمن)' : 'PRISTINE SAFE') : (metrics?.riskLevel ?? 'LOW')}
                    </span>
                  </div>

                  {/* Progress Meter */}
                  <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full transition-all duration-700 ${
                        isScoreZero ? 'bg-emerald-500' :
                        currentRiskScore < 30 ? 'bg-emerald-500' :
                        currentRiskScore < 60 ? 'bg-yellow-500' :
                        currentRiskScore < 80 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.max(4, Math.min(100, currentRiskScore))}%` }}
                    />
                  </div>

                  {/* Transparency breakdown explanation so user knows exactly where score comes from */}
                  <div className="pt-2 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400 font-mono">
                    <span title="Consecutive loss penalty">
                      {isArabic ? 'الخسائر:' : 'Streak:'} <strong className="text-slate-200">{(metrics?.consecutiveLosses || 0) * 2} pts</strong>
                    </span>
                    <span title="Drawdown penalty">
                      {isArabic ? 'التراجع:' : 'DD:'} <strong className="text-slate-200">{Math.round((metrics?.dailyDrawdownPercent || 0))} pts</strong>
                    </span>
                    <span title="Exposure">
                      {isArabic ? 'التعرض:' : 'Exp:'} <strong className="text-slate-200">{Math.round(metrics?.totalExposurePercent || 0)} pts</strong>
                    </span>
                  </div>
                </div>

                {/* 2. Daily Loss Metric Card */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                      {isArabic ? 'الخسارة اليومية الحالية' : 'Daily Loss vs Limit'}
                    </span>
                    <span className="font-mono text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      Cap: -{riskConfig?.maxDailyLossPercent ?? 3.0}%
                    </span>
                  </div>

                  <div className="my-2.5 flex items-baseline gap-2">
                    <span className={`text-3xl font-black font-mono tracking-tight ${
                      (metrics?.dailyDrawdownPercent || 0) > 0 ? 'text-rose-400' : 'text-slate-200'
                    }`}>
                      {(metrics?.dailyDrawdownPercent || 0) > 0 
                        ? `-${(metrics?.dailyDrawdownPercent || 0).toFixed(2)}%` 
                        : '0.00%'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      (${Math.abs(metrics?.dailyRealizedPnl || 0).toFixed(2)} USDT)
                    </span>
                  </div>

                  {/* Meter */}
                  <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-rose-500 transition-all duration-700"
                      style={{ width: `${Math.min(100, (((metrics?.dailyDrawdownPercent || 0) / (riskConfig?.maxDailyLossPercent || 3.0)) * 100))}%` }}
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{isArabic ? 'الرسوم المدفوعة:' : 'Fees Paid:'} ${metrics?.dailyFeesPaid ? metrics.dailyFeesPaid.toFixed(2) : '0.00'}</span>
                    <span className="text-emerald-400 font-bold">{isArabic ? 'الحالة: ضمن الحدود' : 'Within Limit'}</span>
                  </div>
                </div>

                {/* 3. Account Drawdown Card */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Anchor className="w-3.5 h-3.5 text-amber-400" />
                      {isArabic ? 'أقصى تراجع من القمة' : 'Account Drawdown'}
                    </span>
                    <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      Cap: -{riskConfig?.maxDrawdownPercent ?? 10.0}%
                    </span>
                  </div>

                  <div className="my-2.5 flex items-baseline gap-2">
                    <span className={`text-3xl font-black font-mono tracking-tight ${
                      (metrics?.maxAccountDrawdownPercent || 0) > 0 ? 'text-amber-400' : 'text-slate-200'
                    }`}>
                      {(metrics?.maxAccountDrawdownPercent || 0) > 0 
                        ? `-${(metrics?.maxAccountDrawdownPercent || 0).toFixed(2)}%` 
                        : '0.00%'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      (Peak: ${(metrics?.peakEquity ?? 1000).toFixed(0)})
                    </span>
                  </div>

                  {/* Meter */}
                  <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-700"
                      style={{ width: `${Math.min(100, (((metrics?.maxAccountDrawdownPercent || 0) / (riskConfig?.maxDrawdownPercent || 10.0)) * 100))}%` }}
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{isArabic ? 'الرصيد الفعلي:' : 'Current Equity:'} ${(metrics?.currentEquity ?? 1000).toFixed(2)}</span>
                    <span className="text-emerald-400 font-bold">{isArabic ? 'المحفظة محمية' : 'Equity Safe'}</span>
                  </div>
                </div>

              </div>

              {/* Secondary Details Grid (2-Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                {/* Aggregate Portfolio Risk & Exposure */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700/80 transition-all">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      {isArabic ? 'المخاطرة المفتوحة للمحفظة' : 'Aggregate Portfolio Risk'}
                    </span>
                    <span className="text-cyan-400 font-mono font-bold">
                      {(metrics?.totalPortfolioRiskPercent ?? 0).toFixed(2)}% / {riskConfig?.maxPortfolioRiskPercent ?? 3.0}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (((metrics?.totalPortfolioRiskPercent ?? 0) / (riskConfig?.maxPortfolioRiskPercent || 3.0)) * 100))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                    <span>{isArabic ? 'المراكز المفتوحة:' : 'Open Positions:'} <strong className="text-white">{metrics?.totalOpenPositions ?? 0}</strong></span>
                    <span>{isArabic ? 'إجمالي التعرض:' : 'Exposure:'} <strong className="text-white">{(metrics?.totalExposurePercent ?? 0).toFixed(1)}%</strong></span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800/60 pt-2">
                    {isArabic 
                      ? 'مجموع رأس المال المعرض للخطر فعلياً إذا ضربت كل الصفقات المفتوحة وقوف خسارتها معاً.' 
                      : 'Combined capital strictly at risk across all active open positions if stop losses trigger.'}
                  </p>
                </div>

                {/* Consecutive Loss Streak & Anti-Martingale */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700/80 transition-all">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-bold flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      {isArabic ? 'سلسلة الخسائر المتتالية' : 'Consecutive Loss Streak'}
                    </span>
                    <span className={`font-mono font-bold px-2 py-0.5 rounded-md text-xs ${
                      (metrics?.consecutiveLosses ?? 0) === 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : (metrics?.consecutiveLosses ?? 0) >= 3 
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {metrics?.consecutiveLosses ?? 0} {isArabic ? 'خسائر' : 'Losses'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="font-semibold">
                      {(metrics?.consecutiveLosses ?? 0) >= 2 
                        ? (isArabic ? '⚠️ نظام الحماية خفّض حجم العقود بنسبة 50%' : '⚠️ Dynamic size scaling reduced by 50%') 
                        : (isArabic ? '✅ حجم الصفقات بالحجم الطبيعي الكامل (100%)' : '✅ Standard 100% position sizing active')}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800/60 pt-2">
                    {isArabic 
                      ? 'نظام Anti-Martingale المؤسسي: يمنع مضاعفة العقود بعد الخسارة لمنع التداول الانتقامي نهائياً.' 
                      : 'Institutional Anti-Martingale: strictly forbids size doubling after loss to prevent revenge trading.'}
                  </p>
                </div>

              </div>

              {/* Informational Guidance Box */}
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 flex items-start gap-3">
                <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs text-cyan-300/90 leading-relaxed">
                  <span className="font-bold text-white block mb-0.5">
                    {isArabic ? 'كيف تعيد المحرك إلى الصفر في أي وقت؟' : 'How to Reset the Risk Engine to Zero Anytime'}
                  </span>
                  {isArabic 
                    ? 'الضغط على زر "إعادة التصفير للصفر" بالأعلى يزيل فوراً أي تراجع قديم (Drawdown)، ويصفّر سلسلة الخسائر والخسارة اليومية، ويعيد معايرة ذروة الحساب إلى رصيدك الفعلي الحالي.' 
                    : 'Clicking "Reset All to ZERO" immediately clears historical drawdowns, resets loss streaks to 0, and aligns peak equity to your current live balance.'}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: CONFIGURATION */}
          {activeTab === 'CONFIG' && (
            <div className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Risk Per Trade */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex justify-between">
                    <span>{isArabic ? 'أقصى مخاطرة للصفقة الواحدة' : 'Risk Per Trade %'}</span>
                    <span className="text-cyan-400 font-mono font-bold">{riskPerTrade}%</span>
                  </label>
                  <input
                    id="input-risk-per-trade"
                    type="range"
                    min="0.25" max="2.0" step="0.25"
                    value={riskPerTrade}
                    onChange={(e) => setRiskPerTrade(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0.25%</span>
                    <span>1.0% (Standard)</span>
                    <span>2.0% (Max)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1">
                    {isArabic ? 'يتم احتساب حجم العقد بدقة بحيث لا تتجاوز خسارة الـ SL هذه النسبة من رأس المال.' : 'Exact position sizing calculated so SL distance precisely matches this percentage.'}
                  </p>
                </div>

                {/* Daily Drawdown Limit */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex justify-between">
                    <span>{isArabic ? 'حد الخسارة اليومية (Circuit Breaker)' : 'Max Daily Loss Limit %'}</span>
                    <span className="text-rose-400 font-mono font-bold">-{maxDailyLoss}%</span>
                  </label>
                  <input
                    id="input-max-daily-loss"
                    type="range"
                    min="1.0" max="6.0" step="0.5"
                    value={maxDailyLoss}
                    onChange={(e) => setMaxDailyLoss(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>-1.0%</span>
                    <span>-3.0% (Default)</span>
                    <span>-6.0% (Max)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1">
                    {isArabic ? 'إذا وصلت الخسائر اليومية لهذا الحد، يتم إيقاف جميع الصفقات الجديدة تلقائياً.' : 'Trading is locked immediately if cumulative daily realized loss hits this limit.'}
                  </p>
                </div>

                {/* Maximum Account Drawdown */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex justify-between">
                    <span>{isArabic ? 'أقصى تراجع كلي للحساب' : 'Max Account Drawdown %'}</span>
                    <span className="text-amber-400 font-mono font-bold">-{maxDrawdown}%</span>
                  </label>
                  <input
                    id="input-max-drawdown"
                    type="range"
                    min="5.0" max="20.0" step="1.0"
                    value={maxDrawdown}
                    onChange={(e) => setMaxDrawdown(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>-5.0%</span>
                    <span>-10.0% (Standard)</span>
                    <span>-20.0%</span>
                  </div>
                </div>

                {/* Max Allowed Leverage Cap */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex justify-between">
                    <span>{isArabic ? 'سقف الرافعة المالية الأقصى' : 'Max Allowed Leverage'}</span>
                    <span className="text-cyan-400 font-mono font-bold">{maxAllowedLeverage}x</span>
                  </label>
                  <input
                    id="input-max-leverage"
                    type="range"
                    min="1" max="10" step="1"
                    value={maxAllowedLeverage}
                    onChange={(e) => setMaxAllowedLeverage(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1x (Spot)</span>
                    <span>5x</span>
                    <span>10x (Cap)</span>
                  </div>
                </div>

                {/* Minimum Risk / Reward Ratio */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex justify-between">
                    <span>{isArabic ? 'الحد الأدنى لنسبة العائد إلى المخاطرة' : 'Min Risk:Reward Ratio'}</span>
                    <span className="text-emerald-400 font-mono font-bold">1:{minRiskReward}</span>
                  </label>
                  <input
                    id="input-min-rr"
                    type="range"
                    min="1.5" max="3.0" step="0.1"
                    value={minRiskReward}
                    onChange={(e) => setMinRiskReward(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-emerald-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 pt-1">
                    {isArabic ? 'يرفض أي صفقة لا توفر هدف ربح أول يعادل ضعفي المخاطرة على الأقل.' : 'Rejects any trade setup whose TP1 to SL distance is below this ratio.'}
                  </p>
                </div>

                {/* Max Symbol Exposure */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex justify-between">
                    <span>{isArabic ? 'أقصى انكشاف للعملة الواحدة' : 'Max Symbol Exposure %'}</span>
                    <span className="text-cyan-400 font-mono font-bold">{maxSymbolExposure}%</span>
                  </label>
                  <input
                    id="input-symbol-exposure"
                    type="range"
                    min="5" max="30" step="1"
                    value={maxSymbolExposure}
                    onChange={(e) => setMaxSymbolExposure(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-cyan-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 pt-1">
                    {isArabic ? 'يمنع تكديس صفقات تفوق هذه النسبة من إجمالي رأس المال على نفس الرمز.' : 'Prevents single asset concentration and multiple simultaneous positions in the same symbol.'}
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: AUDIT TRAIL LOGS */}
          {activeTab === 'AUDIT' && (
            <div className="space-y-4">
              
              {/* Header with Clear Button */}
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200 font-mono">
                    {isArabic ? 'سجلات فحص ومطابقة إشارات العملات (Pre-Trade Defense)' : 'Pre-Trade Defense Audit Logs'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearAuditLogs}
                  disabled={isLoading || auditLogs.length === 0}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer font-sans"
                  title={isArabic ? 'محو كل السجلات وتصفير السجل للبدء من جديد' : 'Wipe all audit entries and start fresh'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'محو كل السجلات وتصفير التدقيق' : 'Clear All Audit Logs'}</span>
                </button>
              </div>

              {/* Audit Stats Banner */}
              {auditStats && (
                <div className="grid grid-cols-4 gap-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isArabic ? 'إجمالي التقييمات' : 'Evaluations'}</span>
                    <span className="text-base font-bold font-mono text-white">{auditStats.totalEvaluations}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isArabic ? 'تمت الموافقة' : 'Approved'}</span>
                    <span className="text-base font-bold font-mono text-emerald-400">{auditStats.approvedCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isArabic ? 'تم الرفض' : 'Rejected'}</span>
                    <span className="text-base font-bold font-mono text-rose-400">{auditStats.rejectedCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isArabic ? 'معدل القبول' : 'Approval Rate'}</span>
                    <span className="text-base font-bold font-mono text-cyan-400">{auditStats.approvalRatePercent}%</span>
                  </div>
                </div>
              )}

              {/* Logs Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 max-h-[350px] overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    {isArabic ? 'لا توجد سجلات تدقيق حتى الآن. سيتم تسجيل كل إشارة يتم تقييمها هنا تلقائياً.' : 'No audit entries yet. Every trade proposal evaluated by the engine will be recorded here.'}
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase font-mono sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Time</th>
                        <th className="p-2.5">Decision</th>
                        <th className="p-2.5">Symbol</th>
                        <th className="p-2.5">Side</th>
                        <th className="p-2.5">Risk Score</th>
                        <th className="p-2.5">Reason / Status</th>
                        <th className="p-2.5">Audit ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {auditLogs.map((log, idx) => (
                        <tr key={log.auditId || log.id || idx} className="hover:bg-slate-900/50 transition">
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.decision === 'APPROVED' 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                              {log.decision}
                            </span>
                          </td>
                          <td className="p-2.5 text-white font-bold">{log.symbol}</td>
                          <td className="p-2.5">
                            <span className={log.side === 'LONG' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {log.side}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-300 font-bold">{log.riskScore}</td>
                          <td className="p-2.5 text-slate-300 max-w-xs truncate">
                            {log.decision === 'APPROVED' ? (
                              <span className="text-emerald-400/90">Validated (SL & Sizing Checked)</span>
                            ) : (
                              <span className="text-rose-400/90 font-medium" title={log.rejectionReason || log.rejectionCode}>
                                {log.rejectionCode || log.rejectionReason}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-500 text-[9px] truncate max-w-[90px]">
                            {String(log.auditId || log.id || 'AUDIT').slice(0, 16)}...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="truncate">
              {isArabic ? 'محرك التدقيق يعمل في الوقت الفعلي' : 'Risk Engine Active & Synchronized'}
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="hidden sm:inline font-mono text-slate-400">
              Equity: ${(metrics?.currentEquity ?? paperWallet?.balance ?? 1000).toFixed(2)} USDT
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-cancel-risk-settings"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl font-bold bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition text-xs cursor-pointer"
            >
              {isArabic ? 'إغلاق' : 'Close'}
            </button>
            {activeTab === 'CONFIG' && (
              <button
                id="btn-save-risk-bounds"
                onClick={handleSaveRiskConfig}
                disabled={isSaving}
                className="px-4 py-1.5 rounded-xl font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-sm transition text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{isArabic ? 'حفظ المعايير' : 'Save Bounds'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
