import React, { useState, useEffect } from 'react';
import { 
  X, ShieldAlert, AlertTriangle, RefreshCw, CheckCircle2, ShieldCheck, 
  TrendingDown, TrendingUp, Anchor, Activity, Sliders, DollarSign,
  Lock, Unlock, AlertOctagon, Flame, Eye, Layers, Shield
} from 'lucide-react';
import { 
  AutoBotConfig, Language, BinanceApiConfig, PaperWallet, TradingExecutionMode,
  FrontendRiskEngineConfig, RiskEngineMetrics, RiskAuditLogEntry, RiskLevel, RiskLockStatus 
} from '../types';

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

      // Also update local bot config if applicable
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
        body: JSON.stringify({ active, reason: 'User Manual Emergency Kill Switch via Dashboard UI' })
      });
      await fetchRiskData();
    } catch (err) {
      console.error('Failed to toggle emergency stop:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockRisk = async () => {
    try {
      setIsLoading(true);
      await fetch('/api/risk/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualAdminOverride: true })
      });
      await fetchRiskData();
    } catch (err) {
      console.error('Failed to unlock risk lock:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
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
        return { label: isArabic ? 'نظام المخاطر: آمن' : 'ALL SYSTEMS OPTIMAL', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
    }
  };

  const lockBadge = getLockBadge(metrics?.riskLockStatus || riskConfig?.riskLockStatus);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden transform transition-all max-h-[92vh] min-h-0">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border shadow-inner ${
              metrics?.emergencyStop || metrics?.riskLockStatus === 'LOCKED' 
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse' 
                : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
            }`}>
              {metrics?.emergencyStop ? <AlertOctagon className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white font-sans tracking-tight">
                  {isArabic ? 'محرك إدارة المخاطر المؤسسي' : 'Quantura Risk Engine'}
                </h2>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v2.0 PRO
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                {isArabic ? 'حماية رأس المال والمطابقة الرياضية الصارمة' : 'Deterministic Capital Preservation & Pre-Trade Defense'}
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
            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'METRICS'
                ? 'text-indigo-400 border-indigo-500 bg-slate-800/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {isArabic ? 'لوحة القياس الحية' : 'Live Risk Metrics'}
          </button>
          <button
            id="tab-risk-config"
            onClick={() => setActiveTab('CONFIG')}
            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'CONFIG'
                ? 'text-indigo-400 border-indigo-500 bg-slate-800/60'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            {isArabic ? 'معايير المخاطر الصارمة' : 'Risk Bounds Configuration'}
          </button>
          <button
            id="tab-risk-audit"
            onClick={() => setActiveTab('AUDIT')}
            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'AUDIT'
                ? 'text-indigo-400 border-indigo-500 bg-slate-800/60'
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

          {/* System Lock / Emergency Stop Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-3.5 rounded-xl bg-slate-950 border border-slate-800 gap-2.5">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-wider font-mono ${lockBadge.color}`}>
                {lockBadge.label}
              </span>
              {metrics?.riskLockReason && (
                <span className="text-[11px] text-rose-400 font-medium">
                  {metrics.riskLockReason}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {metrics?.riskLockStatus === 'LOCKED' && (
                <button
                  id="btn-unlock-risk-lock"
                  onClick={handleUnlockRisk}
                  disabled={isLoading}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <Unlock className="w-3 h-3" />
                  {isArabic ? 'إلغاء القفل اليدوي' : 'Reset Risk Lock'}
                </button>
              )}
              <button
                id="btn-toggle-emergency-kill-switch"
                onClick={() => handleToggleEmergencyStop(!metrics?.emergencyStop)}
                disabled={isLoading}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition cursor-pointer ${
                  metrics?.emergencyStop
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20 animate-pulse'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                {metrics?.emergencyStop 
                  ? (isArabic ? 'استئناف التداول' : 'Resume System') 
                  : (isArabic ? 'قاطع الطوارئ الشامل' : 'EMERGENCY KILL SWITCH')}
              </button>
            </div>
          </div>

          {/* TAB 1: METRICS */}
          {activeTab === 'METRICS' && (
            <div className="space-y-5">
              {/* Top High-Level Gauges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Quantitative Risk Score */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                      {isArabic ? 'مؤشر المخاطر التراكمي' : 'Quantitative Risk Score'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">0-100</span>
                  </span>
                  <div className="my-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-white">
                      {metrics?.riskScore ?? 15}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase ${getScoreColor(metrics?.riskScore ?? 15)}`}>
                      {metrics?.riskLevel ?? 'LOW'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        (metrics?.riskScore ?? 15) < 30 ? 'bg-emerald-500' :
                        (metrics?.riskScore ?? 15) < 60 ? 'bg-yellow-500' :
                        (metrics?.riskScore ?? 15) < 80 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, metrics?.riskScore ?? 15)}%` }}
                    />
                  </div>
                </div>

                {/* Daily Loss Metric */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                      {isArabic ? 'الخسارة اليومية الحالية' : 'Daily Loss vs Limit'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">Cap: -{metrics?.maxDailyLossPercent ?? 3.0}%</span>
                  </span>
                  <div className="my-2 flex items-baseline gap-1.5">
                    <span className={`text-2xl font-black font-mono ${
                      (metrics?.dailyLossPercent || 0) > 0 ? 'text-rose-400' : 'text-slate-200'
                    }`}>
                      {(metrics?.dailyLossPercent || 0) > 0 ? `-${metrics?.dailyLossPercent.toFixed(2)}%` : '0.00%'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      (${metrics?.dailyLossUsdt ? metrics.dailyLossUsdt.toFixed(2) : '0.00'} USDT)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (((metrics?.dailyLossPercent || 0) / (metrics?.maxDailyLossPercent || 3.0)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Max Peak-to-Trough Drawdown */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Anchor className="w-3.5 h-3.5 text-amber-400" />
                      {isArabic ? 'أقصى تراجع من القمة' : 'Account Drawdown'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">Cap: -{metrics?.maxDrawdownPercent ?? 10.0}%</span>
                  </span>
                  <div className="my-2 flex items-baseline gap-1.5">
                    <span className={`text-2xl font-black font-mono ${
                      (metrics?.currentDrawdownPercent || 0) > 0 ? 'text-amber-400' : 'text-slate-200'
                    }`}>
                      {(metrics?.currentDrawdownPercent || 0) > 0 ? `-${metrics?.currentDrawdownPercent.toFixed(2)}%` : '0.00%'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      (Peak: ${(metrics?.peakEquity ?? 10000).toFixed(0)})
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (((metrics?.currentDrawdownPercent || 0) / (metrics?.maxDrawdownPercent || 10.0)) * 100))}%` }}
                    />
                  </div>
                </div>

              </div>

              {/* Exposure & Risk Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Total Portfolio Risk */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold">
                      {isArabic ? 'إجمالي المخاطرة المفتوحة للمحفظة' : 'Aggregate Portfolio Risk'}
                    </span>
                    <span className="text-indigo-400 font-mono font-bold">
                      {(metrics?.currentPortfolioRiskPercent ?? 0).toFixed(2)}% / {metrics?.maxPortfolioRiskPercent ?? 3.0}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (((metrics?.currentPortfolioRiskPercent ?? 0) / (metrics?.maxPortfolioRiskPercent ?? 3.0)) * 100))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isArabic 
                      ? 'مجموع المخاطرة الفعلية لكل الصفقات المفتوحة معاً إذا ضُربت جميع وقوف الخسارة.' 
                      : 'Combined capital at risk across all active open positions if stop losses trigger.'}
                  </p>
                </div>

                {/* Consecutive Losses & Anti-Martingale Status */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold">
                      {isArabic ? 'سلسلة الخسائر المتتالية' : 'Consecutive Loss Streak'}
                    </span>
                    <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                      (metrics?.consecutiveLosses ?? 0) >= 3 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {metrics?.consecutiveLosses ?? 0} {isArabic ? 'صفقات' : 'Losses'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Flame className={`w-4 h-4 ${metrics?.consecutiveLosses ? 'text-amber-400' : 'text-slate-600'}`} />
                    <span>
                      {(metrics?.consecutiveLosses ?? 0) >= 2 
                        ? (isArabic ? 'تخفيض حجم العقود تلقائياً لحماية الحساب' : 'Dynamic size scaling reduced by 50%') 
                        : (isArabic ? 'حجم الصفقات بالحجم الاسمي الكامل' : 'Standard 100% position sizing active')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isArabic ? 'يمنع محرك المخاطر مضاعفة الحجم بعد الخسارة بشكل قاطع (Anti-Martingale Enforced).' : 'Strict anti-martingale protection prevents revenge trading and size increases.'}
                  </p>
                </div>

              </div>

              {/* Core Principles Guarantee */}
              <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-300/90 leading-relaxed">
                  <span className="font-bold text-white block mb-0.5">
                    {isArabic ? 'مبدأ كوانتورا الصارم لحماية رأس المال' : 'Institutional Risk Engine Authority'}
                  </span>
                  {isArabic 
                    ? 'الذكاء الاصطناعي والاستراتيجيات لا تنفذ أي صفقة مباشرة. محرك المخاطر هو السلطة النهائية المستقلة للتحقق من وقف الخسارة، السبريد، الارتباط، وحدود التراجع قبل إرسال أي أمر إلى بينانس.' 
                    : 'AI and trading strategies never execute trades directly. The Risk Management Engine is the final deterministic authority that validates Stop Loss, Slippage, Spread, Correlation, and Drawdown bounds before any order reaches Binance.'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURATION */}
          {activeTab === 'CONFIG' && (
            <div className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* Risk Per Trade */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex justify-between">
                    <span>{isArabic ? 'أقصى مخاطرة للصفقة الواحدة' : 'Risk Per Trade %'}</span>
                    <span className="text-indigo-400 font-mono font-bold">{riskPerTrade}%</span>
                  </label>
                  <input
                    id="input-risk-per-trade"
                    type="range"
                    min="0.25" max="2.0" step="0.25"
                    value={riskPerTrade}
                    onChange={(e) => setRiskPerTrade(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0.25% (Conservative)</span>
                    <span>1.0% (Standard)</span>
                    <span>2.0% (Max Allowed)</span>
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
                    <span className="text-indigo-400 font-mono font-bold">{maxAllowedLeverage}x</span>
                  </label>
                  <input
                    id="input-max-leverage"
                    type="range"
                    min="1" max="10" step="1"
                    value={maxAllowedLeverage}
                    onChange={(e) => setMaxAllowedLeverage(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1x (Spot / No Lev)</span>
                    <span>5x</span>
                    <span>10x (Institutional Cap)</span>
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
                    {isArabic ? 'يتم رفض أي صفقة لا توفر هدف ربح أول يعادل ضعفي المخاطرة على الأقل.' : 'Rejects any trade setup whose TP1 to SL distance is below this ratio.'}
                  </p>
                </div>

                {/* Max Symbol Exposure */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex justify-between">
                    <span>{isArabic ? 'أقصى انكشاف للعملة الواحدة' : 'Max Symbol Exposure %'}</span>
                    <span className="text-indigo-400 font-mono font-bold">{maxSymbolExposure}%</span>
                  </label>
                  <input
                    id="input-symbol-exposure"
                    type="range"
                    min="5" max="30" step="1"
                    value={maxSymbolExposure}
                    onChange={(e) => setMaxSymbolExposure(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-indigo-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 pt-1">
                    {isArabic ? 'يمنع تكديس صفقات أو عقود تفوق هذه النسبة من إجمالي رأس المال على نفس الرمز.' : 'Prevents single asset concentration and multiple simultaneous positions in the same symbol.'}
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: AUDIT TRAIL LOGS */}
          {activeTab === 'AUDIT' && (
            <div className="space-y-4">
              
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
                    <span className="text-base font-bold font-mono text-indigo-400">{auditStats.approvalRatePercent}%</span>
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
            <span className="truncate">{isArabic ? 'محرك التدقيق يعمل في الوقت الفعلي' : 'Risk Engine Active & Synchronized'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-cancel-risk-settings"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg font-bold bg-slate-800/80 text-slate-300 hover:bg-slate-700 transition text-[11px] sm:text-xs cursor-pointer"
            >
              {isArabic ? 'إغلاق' : 'Close'}
            </button>
            {activeTab === 'CONFIG' && (
              <button
                id="btn-save-risk-bounds"
                onClick={handleSaveRiskConfig}
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded-lg font-bold bg-indigo-500 hover:bg-indigo-400 text-white shadow-sm transition text-[11px] sm:text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                <span>{isArabic ? 'حفظ الحدود الإلزامية' : 'Save Institutional Bounds'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
