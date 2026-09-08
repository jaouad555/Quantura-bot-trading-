import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  X, 
  Check, 
  DollarSign, 
  RotateCcw, 
  Plus, 
  Minus, 
  TrendingUp, 
  Sparkles, 
  ShieldCheck, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { Language, PaperWallet } from '../types';

interface CustomBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  paperWallet: PaperWallet;
  onUpdateBalance: (newBalance: number, resetHistory?: boolean) => void;
}

export const CustomBalanceModal: React.FC<CustomBalanceModalProps> = ({
  isOpen,
  onClose,
  language,
  paperWallet,
  onUpdateBalance,
}) => {
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  const [inputVal, setInputVal] = useState<string>(paperWallet.balance.toString());
  const [resetPnL, setResetPnL] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputVal(paperWallet.balance.toString());
      setResetPnL(false);
      setError(null);
    }
  }, [isOpen, paperWallet.balance]);

  if (!isOpen) return null;

  const presets = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

  const handleApplyPreset = (val: number) => {
    setInputVal(val.toString());
    setError(null);
  };

  const handleAdjust = (delta: number) => {
    const current = parseFloat(inputVal) || 0;
    const next = Math.max(10, current + delta);
    setInputVal(next.toString());
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(inputVal);
    if (isNaN(num) || num < 10) {
      setError(
        isArabic 
          ? 'يرجى إدخال رصيد صحيح أكبر من 10 USDT' 
          : isEn 
          ? 'Please enter a valid balance greater than 10 USDT' 
          : 'Veuillez saisir un solde supérieur à 10 USDT'
      );
      return;
    }

    onUpdateBalance(num, resetPnL);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 transform-gpu isolate animate-fadeIn">
      <div 
        className={`bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden ${
          isArabic ? 'rtl text-right' : 'ltr text-left'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span>{isArabic ? 'تخصيص الرصيد الوهمي' : isEn ? 'Custom Virtual Balance' : 'Personnaliser le Solde Virtuel'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-brand-500/20 text-brand-300 border border-brand-500/40">
                  PAPER
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isArabic 
                  ? 'حدد الرصيد الافتراضي الذي ترغب في التداول به وتجربته' 
                  : isEn 
                  ? 'Set the exact virtual USDT capital you want to trade with' 
                  : 'Définissez le capital virtuel USDT souhaité pour vos simulations'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current State Info */}
        <div className="bg-slate-950/40 px-5 py-3 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-brand-400" />
            {isArabic ? 'الرصيد الحالي:' : isEn ? 'Current Balance:' : 'Solde Actuel:'}
          </span>
          <span className="text-slate-200 font-bold font-mono">
            ${paperWallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Main Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>{isArabic ? 'المبلغ المطلوب (USDT):' : isEn ? 'Desired Amount (USDT):' : 'Montant Souhaité (USDT) :'}</span>
              <span className="text-[11px] text-brand-400 font-mono font-normal">
                {isArabic ? 'أي مبلغ مخصص' : 'Custom any amount'}
              </span>
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-3.5 rtl:pl-0 rtl:pr-3.5 flex items-center pointer-events-none text-slate-400 font-mono font-bold text-base">
                $
              </div>
              <input
                type="number"
                step="any"
                min="10"
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  setError(null);
                }}
                placeholder="10000"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pl-9 rtl:pl-16 pr-16 rtl:pr-9 py-3 outline-none focus:border-brand-500 font-mono font-bold text-lg transition shadow-inner"
                autoFocus
              />
              <div className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 pr-3.5 rtl:pr-0 rtl:pl-3.5 flex items-center pointer-events-none text-xs font-mono font-bold text-slate-400">
                USDT
              </div>
            </div>

            {error && (
              <p className="text-rose-400 text-xs mt-1.5 font-medium">{error}</p>
            )}
          </div>

          {/* Quick Increment/Decrement Step Buttons */}
          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5">
              {isArabic ? 'تعديل سريع (إضافة / خصم):' : isEn ? 'Quick Adjustments (+ / -):' : 'Ajustements Rapides :'}
            </span>
            <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => handleAdjust(-1000)}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/80 transition font-bold"
              >
                -1,000$
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(-500)}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/80 transition font-bold"
              >
                -500$
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(500)}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/80 transition font-bold"
              >
                +500$
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(1000)}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/80 transition font-bold"
              >
                +1,000$
              </button>
            </div>
          </div>

          {/* Popular Presets */}
          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5">
              {isArabic ? 'مبالغ جاهزة وموصى بها:' : isEn ? 'Recommended Presets:' : 'Montants Prédéfinis :'}
            </span>
            <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`py-2 rounded-lg border font-bold transition ${
                    parseFloat(inputVal) === preset
                      ? 'bg-brand-500 text-slate-950 border-brand-400 shadow-md shadow-brand-500/20'
                      : 'bg-slate-950 transform-gpu isolate hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  ${preset >= 1000 ? `${preset / 1000}k` : preset}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Options Checkbox */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetPnL}
                onChange={(e) => setResetPnL(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-950 text-brand-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-brand-500"
              />
              <span className="text-xs text-slate-300 leading-tight">
                {isArabic 
                  ? 'إعادة تعيين الأرباح والخسائر السابقة (تصفير Realized PnL وبدء سجل جديد)' 
                  : isEn 
                  ? 'Reset realized P&L to 0 for a clean new trading session' 
                  : 'Réinitialiser le P&L réalisé à 0 pour une nouvelle session'}
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition border border-slate-700"
            >
              {isArabic ? 'إلغاء' : isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="submit"
              className="flex-[2] py-2.5 bg-brand-500 hover:bg-brand-400 text-slate-950 rounded-xl text-xs font-black transition shadow-lg shadow-brand-500/25 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isArabic ? 'حفظ وتطبيق الرصيد' : isEn ? 'Apply Balance' : 'Appliquer le Solde'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
