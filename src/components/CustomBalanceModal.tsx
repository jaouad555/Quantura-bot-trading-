import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, 
  X, 
  Check, 
  DollarSign, 
  ArrowUpRight,
  ArrowDownRight
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

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setInputVal(paperWallet.balance.toString());
      setResetPnL(false);
      setError(null);
    }
  }, [isOpen, paperWallet.balance]);

  // Handle ESC key to close modal smoothly
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
          ? 'يرجى إدخال رصيد صحيح (10 USDT على الأقل)' 
          : isEn 
          ? 'Please enter a valid balance (min 10 USDT)' 
          : 'Veuillez saisir un solde valide (min 10 USDT)'
      );
      return;
    }

    onUpdateBalance(num, resetPnL);
    onClose();
  };

  if (!isOpen) return null;

  const currentNum = parseFloat(inputVal) || 0;
  const diff = currentNum - paperWallet.balance;
  const diffPercent = paperWallet.balance > 0 ? (diff / paperWallet.balance) * 100 : 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-200 ${
          isArabic ? 'rtl text-right' : 'ltr text-left'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Sleek & Compact */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                <span>{isArabic ? 'تخصيص الرصيد' : isEn ? 'Custom Balance' : 'Solde Personnalisé'}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PAPER
                </span>
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-3.5 space-y-3 overflow-y-auto no-scrollbar flex-1">
          {/* Current & Target Dynamic Preview */}
          <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block">
                {isArabic ? 'الرصيد الحالي:' : isEn ? 'Current:' : 'Solde Actuel :'}
              </span>
              <span className="text-slate-200 font-bold text-xs">
                ${paperWallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {diff !== 0 && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">
                  {isArabic ? 'الفارق:' : isEn ? 'Difference:' : 'Écart :'}
                </span>
                <span className={`text-[11px] font-bold inline-flex items-center gap-0.5 ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {diff > 0 ? '+' : ''}${Math.abs(diff).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  <span className="text-[9px] opacity-80">({diff > 0 ? '+' : ''}{diffPercent.toFixed(0)}%)</span>
                </span>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              {isArabic ? 'المبلغ الجديد (USDT):' : isEn ? 'New Balance (USDT):' : 'Nouveau Solde (USDT) :'}
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-2.5 rtl:pl-0 rtl:pr-2.5 flex items-center pointer-events-none text-slate-400 font-mono font-bold text-xs">
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
                className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-brand-500 text-white rounded-lg pl-6 rtl:pl-14 pr-14 rtl:pr-6 py-1.5 text-xs font-mono font-bold outline-none transition"
                autoFocus
              />
              <div className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 pr-2.5 rtl:pr-0 rtl:pl-2.5 flex items-center pointer-events-none text-[10px] font-mono font-bold text-slate-400">
                USDT
              </div>
            </div>

            {error && (
              <p className="text-rose-400 text-[10px] mt-1 font-medium">{error}</p>
            )}
          </div>

          {/* Quick Increment/Decrement Buttons - Compact */}
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">
              {isArabic ? 'تعديل سريع:' : isEn ? 'Quick Adjust:' : 'Ajustement Rapide :'}
            </span>
            <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => handleAdjust(-1000)}
                className="py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700/60 transition font-bold active:scale-95 cursor-pointer text-center"
              >
                -1,000$
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(-500)}
                className="py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700/60 transition font-bold active:scale-95 cursor-pointer text-center"
              >
                -500$
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(500)}
                className="py-1 bg-slate-800/90 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded border border-slate-700/60 transition font-bold active:scale-95 cursor-pointer text-center"
              >
                +500$
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(1000)}
                className="py-1 bg-slate-800/90 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 rounded border border-slate-700/60 transition font-bold active:scale-95 cursor-pointer text-center"
              >
                +1,000$
              </button>
            </div>
          </div>

          {/* Presets - Compact grid */}
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">
              {isArabic ? 'مبالغ شائعة:' : isEn ? 'Presets:' : 'Montants Prédéfinis :'}
            </span>
            <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
              {presets.map((preset) => {
                const isSelected = parseFloat(inputVal) === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`py-1 rounded border font-semibold transition active:scale-95 cursor-pointer text-center ${
                      isSelected
                        ? 'bg-brand-500 text-slate-950 border-brand-400 font-bold shadow-xs'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ${preset >= 1000 ? `${preset / 1000}k` : preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset Options Checkbox */}
          <div className="pt-1.5 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetPnL}
                onChange={(e) => setResetPnL(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-brand-500 focus:ring-0 cursor-pointer accent-brand-500"
              />
              <span className="text-[10px] text-slate-400 hover:text-slate-300 leading-tight">
                {isArabic 
                  ? 'تصفير الأرباح والخسائر السابقة (بدء جلسة جديدة)' 
                  : isEn 
                  ? 'Reset realized P&L to 0 for a clean session' 
                  : 'Réinitialiser le P&L réalisé à 0'}
              </span>
            </label>
          </div>

          {/* Actions - Compact & Responsive */}
          <div className="pt-2 flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition border border-slate-700/80 active:scale-95 cursor-pointer"
            >
              {isArabic ? 'إلغاء' : isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="submit"
              className="flex-1 py-1.5 bg-brand-500 hover:bg-brand-400 text-slate-950 rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isArabic ? 'تطبيق الرصيد' : isEn ? 'Apply' : 'Appliquer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
