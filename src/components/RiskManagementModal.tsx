import React, { useState } from 'react';
import { 
  X, ShieldAlert, AlertTriangle, RefreshCw, CheckCircle2, ShieldCheck, 
  TrendingDown, TrendingUp, Anchor, Activity, Sliders, DollarSign
} from 'lucide-react';
import { AutoBotConfig, Language, AutoTradeLog, BinanceApiConfig, PaperWallet, TradingExecutionMode } from '../types';

interface RiskManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  botConfig: AutoBotConfig;
  onSaveConfig: (config: AutoBotConfig) => void;
  logs: AutoTradeLog[];
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
  logs,
  executionMode,
  binanceConfig,
  paperWallet
}) => {
  if (!isOpen) return null;

  const isArabic = language === 'ar';

  const [drawdownLimit, setDrawdownLimit] = useState((botConfig.dailyDrawdownLimitPercent || 5.0).toString());
  const [maxOpenTrades, setMaxOpenTrades] = useState((botConfig.maxOpenTrades || 3).toString());
  const [sizingMode, setSizingMode] = useState<'FIXED_PERCENT' | 'RISK_BASED'>(botConfig.sizingMode || 'FIXED_PERCENT');
  const [riskPerTrade, setRiskPerTrade] = useState((botConfig.riskPerTradePercent || 1.0).toString());
  const [tradeAllocation, setTradeAllocation] = useState((botConfig.tradeAllocationPercent || 20).toString());
  const [maxSlippage, setMaxSlippage] = useState((botConfig.maxSlippageSpreadPercent || 0.5).toString());
  const [ttpEnabled, setTtpEnabled] = useState(botConfig.trailingTakeProfitEnabled ?? false);
  const [ttpDeviation, setTtpDeviation] = useState((botConfig.trailingTakeProfitDeviationPercent || 0.4).toString());

  // Calculate current daily drawdown
  const startOfTodayUtc = new Date().setUTCHours(0, 0, 0, 0);
  const baselineTime = Math.max(startOfTodayUtc, botConfig.circuitBreakerResetAt || 0);
  const todayLogs = logs.filter(l => l.timestamp >= baselineTime && (executionMode === 'BINANCE_LIVE' ? l.mode === 'BINANCE_LIVE' : (!l.mode || l.mode === 'PAPER')));
  
  const todayRealizedLoss = todayLogs.reduce((acc, l) => acc + (l.pnlUsdt || 0), 0);
  const isLoss = todayRealizedLoss < 0;

  const handleSave = () => {
    onSaveConfig({
      ...botConfig,
      dailyDrawdownLimitPercent: Math.max(1.0, Math.min(50.0, Number(drawdownLimit) || 5.0)),
      maxOpenTrades: Math.max(1, Math.min(20, Number(maxOpenTrades) || 3)),
      sizingMode,
      riskPerTradePercent: Math.max(0.1, Math.min(10.0, Number(riskPerTrade) || 1.0)),
      tradeAllocationPercent: Math.max(1, Math.min(100, Number(tradeAllocation) || 20)),
      maxSlippageSpreadPercent: Math.max(0.1, Math.min(5.0, Number(maxSlippage) || 0.5)),
      trailingTakeProfitEnabled: ttpEnabled,
      trailingTakeProfitDeviationPercent: Math.max(0.1, Math.min(5.0, Number(ttpDeviation) || 0.4))
    });
    onClose();
  };

  const handleResetCircuitBreaker = () => {
    onSaveConfig({
      ...botConfig,
      enabled: false, // Ensure bot stays paused for safety, but clear the breaker
      circuitBreakerTripped: false,
      circuitBreakerResetAt: Date.now(),
      circuitBreakerTrippedAt: undefined
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 border border-slate-700/60 rounded-3xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden transform transition-all max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-inner ${botConfig.circuitBreakerTripped ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'}`}>
              {botConfig.circuitBreakerTripped ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-white font-sans tracking-tight flex items-center gap-2">
                {isArabic ? 'محرك إدارة المخاطر' : 'Risk Management Engine'}
              </h2>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                {isArabic ? 'حماية رأس المال المؤسسية' : 'Institutional Capital Protection'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto">
          
          {/* Circuit Breaker Status Banner */}
          {botConfig.circuitBreakerTripped ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <h3 className="font-bold text-rose-300 text-sm">
                    {isArabic ? 'قاطع الدائرة مفعل (تم الإيقاف)' : 'Circuit Breaker Tripped (Halted)'}
                  </h3>
                  <p className="text-xs text-rose-400/80 mt-1">
                    {isArabic 
                      ? 'تم تجاوز الحد الأقصى للخسارة اليومية. البوت متوقف حالياً لحماية رأس المال.' 
                      : 'Max daily drawdown exceeded. Trading bot is currently halted.'}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleResetCircuitBreaker}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl whitespace-nowrap shadow-lg shadow-rose-500/20 transition-all shrink-0"
              >
                {isArabic ? 'إعادة ضبط القاطع' : 'Reset Breaker'}
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-bold text-emerald-300 text-sm">
                  {isArabic ? 'حالة المخاطر: آمنة' : 'Risk Status: Safe'}
                </h3>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  {isArabic ? 'قاطع الدائرة غير مفعل حالياً.' : 'Circuit breaker is currently inactive.'}
                </p>
              </div>
            </div>
          )}

          {/* Daily Drawdown Metric */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-2">
                <Activity className="w-3.5 h-3.5" />
                {isArabic ? 'الخسارة/الربح اليومي المحقق' : 'Today Realized PnL'}
              </span>
              <span className={`text-lg font-black font-mono ${isLoss ? 'text-rose-400' : (todayRealizedLoss > 0 ? 'text-emerald-400' : 'text-slate-200')}`}>
                ${isLoss ? '-' : ''}${Math.abs(todayRealizedLoss).toFixed(2)} USDT
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-2">
                <Anchor className="w-3.5 h-3.5" />
                {isArabic ? 'حد قاطع الدائرة' : 'Circuit Breaker Limit'}
              </span>
              <span className="text-lg font-black font-mono text-white">
                -{drawdownLimit}%
              </span>
            </div>
          </div>

          <div className="border-t border-slate-800 my-2"></div>

          {/* Settings Grid */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              {isArabic ? 'إعدادات إدارة المخاطر' : 'Risk Settings Configuration'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Drawdown Limit */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex justify-between">
                  <span>{isArabic ? 'أقصى تراجع يومي (Circuit Breaker)' : 'Max Daily Drawdown %'}</span>
                  <span className="text-indigo-400">{drawdownLimit}%</span>
                </label>
                <input
                  type="range"
                  min="1" max="25" step="0.5"
                  value={drawdownLimit}
                  onChange={(e) => setDrawdownLimit(e.target.value)}
                  className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-indigo-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  {isArabic ? 'إيقاف التداول عند الوصول لهذه الخسارة اليومية' : 'Halt trading when daily loss reaches this limit'}
                </p>
              </div>

              {/* Max Open Trades */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 flex justify-between">
                  <span>{isArabic ? 'أقصى عدد صفقات مفتوحة' : 'Max Concurrent Trades'}</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={maxOpenTrades}
                    onChange={(e) => setMaxOpenTrades(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* Advanced Risk Management (Slippage & Trailing TP) */}
            <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>{isArabic ? 'الحماية من الانزلاق (Slippage)' : 'Max Slippage / Spread %'}</span>
                </label>
                <span className="text-amber-400 text-xs font-mono">{maxSlippage}%</span>
              </div>
              <input
                type="range"
                min="0.1" max="5.0" step="0.1"
                value={maxSlippage}
                onChange={(e) => setMaxSlippage(e.target.value)}
                className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-amber-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500">
                {isArabic ? 'يمنع الدخول في الصفقات إذا كان السبريد أو الانزلاق المتوقع أكبر من هذه القيمة.' : 'Blocks market orders if volatility or bid/ask spread exceeds this.'}
              </p>

              <div className="border-t border-slate-800/50 pt-4 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>{isArabic ? 'متابعة الأرباح (Trailing TP)' : 'Trailing Take Profit (TTP)'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setTtpEnabled(!ttpEnabled)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      ttpEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {ttpEnabled ? (isArabic ? 'مفعل' : 'Active') : (isArabic ? 'معطل' : 'Off')}
                  </button>
                </div>
                {ttpEnabled && (
                  <div className="space-y-2 animate-in fade-in">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-slate-400">{isArabic ? 'نسبة الارتداد %' : 'TTP Deviation %'}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">{ttpDeviation}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1" max="5.0" step="0.1"
                      value={ttpDeviation}
                      onChange={(e) => setTtpDeviation(e.target.value)}
                      className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-emerald-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500">
                      {isArabic ? 'يسمح للأرباح بالاستمرار فوق الهدف حتى يتراجع السعر بهذه النسبة.' : 'Allows profit to run past TP levels until price drops by this %.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Position Sizing */}
            <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl space-y-4">
              <label className="text-xs font-bold text-slate-400 block mb-2">
                {isArabic ? 'استراتيجية حجم الصفقة (Position Sizing)' : 'Position Sizing Strategy'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSizingMode('FIXED_PERCENT')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition ${sizingMode === 'FIXED_PERCENT' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs font-bold">{isArabic ? 'نسبة ثابتة من المحفظة' : 'Fixed % of Wallet'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSizingMode('RISK_BASED')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition ${sizingMode === 'RISK_BASED' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                >
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-xs font-bold">{isArabic ? 'مبني على المخاطرة (SL)' : 'Risk-Based (SL dist)'}</span>
                </button>
              </div>

              {sizingMode === 'FIXED_PERCENT' ? (
                <div className="space-y-2 pt-2 border-t border-slate-800/50">
                  <label className="text-xs font-bold text-slate-400 flex justify-between">
                    <span>{isArabic ? 'نسبة الدخول لكل صفقة' : 'Allocation Per Trade'}</span>
                    <span className="text-emerald-400">{tradeAllocation}%</span>
                  </label>
                  <input
                    type="range"
                    min="1" max="100" step="1"
                    value={tradeAllocation}
                    onChange={(e) => setTradeAllocation(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-emerald-500 cursor-pointer"
                  />
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-slate-800/50">
                  <label className="text-xs font-bold text-slate-400 flex justify-between">
                    <span>{isArabic ? 'أقصى مخاطرة لرأس المال' : 'Max Capital Risk / Trade'}</span>
                    <span className="text-rose-400">{riskPerTrade}%</span>
                  </label>
                  <input
                    type="range"
                    min="0.1" max="5.0" step="0.1"
                    value={riskPerTrade}
                    onChange={(e) => setRiskPerTrade(e.target.value)}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-rose-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-500">
                    {isArabic 
                      ? 'سيتم حساب حجم الصفقة بحيث لا تخسر أكثر من هذه النسبة إذا تم ضرب وقف الخسارة.' 
                      : 'Position size calculated so a Stop Loss hit equals this % of total capital lost.'}
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition text-sm"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl font-bold bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25 transition text-sm flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {isArabic ? 'حفظ إعدادات المخاطر' : 'Save Risk Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
