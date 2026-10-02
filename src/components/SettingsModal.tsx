import React, { useState } from 'react';
import { 
  Language, 
  TimezoneMode, 
  BinanceApiConfig, 
  TradingExecutionMode, 
  PaperWallet, 
  DisplayMode, 
  AutoBotConfig,
  ActiveBotPosition
} from '../types';
import { translations } from '../utils/translations';
import { X, Check, RotateCcw } from 'lucide-react';
import { SettingsView } from './SettingsView';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  timezone: TimezoneMode;
  isDeveloperMode: boolean;
  soundEnabled: boolean;
  notificationsEnabled?: boolean;
  minConfidenceThreshold: number;
  telegramBotToken?: string;
  telegramChatId?: string;
  binanceConfig?: BinanceApiConfig;
  executionMode?: TradingExecutionMode;
  paperWallet?: PaperWallet;
  displayMode?: DisplayMode;
  botConfig?: AutoBotConfig;
  activeBotPositions?: ActiveBotPosition[];
  username?: string;
  onOpenBinanceModal?: () => void;
  onOpenCustomBalanceModal?: () => void;
  onOpenHelp?: () => void;
  onRefreshBinancePermissions?: () => Promise<any> | void;
  onLanguageChange: (lang: Language) => void;
  onTimezoneChange: (tz: TimezoneMode) => void;
  onToggleDeveloperMode: (active: boolean) => void;
  onToggleSound: () => void;
  onToggleNotifications?: () => void;
  onConfidenceChange: (val: number) => void;
  onTelegramConfigChange?: (token: string, chatId: string) => void;
  onChangeDisplayMode?: (mode: DisplayMode) => void;
  onUpdatePaperWallet?: (wallet: PaperWallet) => void;
  onUpdateBotConfig?: (config: Partial<AutoBotConfig>) => void;
  onLogout?: () => void;
  onFullReset?: () => void | Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const { isOpen, onClose, language, onTelegramConfigChange, onFullReset } = props;
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!isOpen) return null;

  const isArabic = language === 'ar';
  const isEn = language === 'en';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`bg-[#070b14] border border-slate-800 rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden ${isArabic ? 'rtl text-right' : 'ltr'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
              <img src="/logo.png" alt="Quantura" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight uppercase font-mono">
                {isArabic ? 'إعدادات النظام والتحكم' : isEn ? 'System Settings & Control' : 'Paramètres du Système'}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase opacity-70">
                Institutional Quant Terminal v2.5
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content (The Full SettingsView) */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-[#070b14]">
          <SettingsView {...props} />
        </div>

        {/* Footer with Save and Close buttons */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold font-mono transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isArabic ? 'إعادة ضبط المصنع' : isEn ? 'Factory Reset' : 'Réinitialiser'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <X className="w-4 h-4" />
              <span>{isArabic ? 'إغلاق' : isEn ? 'Close' : 'Fermer'}</span>
            </button>

            <button
              onClick={() => {
                // SettingsView already handles local state updates, but we can trigger a final save/sync if needed
                onClose();
              }}
              className="flex-1 sm:flex-none px-8 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isArabic ? 'حفظ التغييرات' : isEn ? 'Save Changes' : 'Enregistrer'}</span>
            </button>
          </div>
        </div>

        {/* Reset Confirmation Overlay */}
        {showResetConfirm && (
          <div className="absolute inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                {isArabic ? 'تأكيد الحذف النهائي؟' : 'Confirmer le Reset ?'}
              </h3>
              <p className="text-sm text-slate-300">
                {isArabic 
                  ? 'سيتم تصفير محرك المخاطر ومسح كافة الصفقات وتاريخ التداول وإعادة المحفظة إلى 1,000 USDT، مع الحفاظ التام على مفاتيح API وتيليغرام ونموذج الذكاء الاصطناعي.'
                  : isEn
                  ? 'Reset Risk Engine, clear all active trades, trade history and set wallet to $1,000 USDT. API keys, Telegram tokens and AI model settings are fully preserved.'
                  : 'Remet le Risk Engine à zéro, efface toutes les positions et l\'historique (1 000 USDT). Vos clés API, Telegram et modèle IA sont strictement conservés.'}
              </p>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
                >
                  {isArabic ? 'إلغاء' : 'Annuler'}
                </button>
                <button 
                  onClick={async () => {
                    if (onFullReset) await onFullReset();
                    setShowResetConfirm(false);
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black transition cursor-pointer"
                >
                  {isArabic ? 'تأكيد المسح' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
