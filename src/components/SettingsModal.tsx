import { apiStorage } from "../utils/apiStorage";
import React, { useState } from 'react';
import { Language, TimezoneMode, BinanceApiConfig, TradingExecutionMode, PaperWallet, APP_VERSION_TAG } from '../types';
import { translations } from '../utils/translations';
import { X, Globe, Clock, AlertTriangle, Bell, BellOff, Volume2, ShieldCheck, Cpu, Key, Flame, Wallet, DollarSign, RotateCcw, Check, Trash2, Send, Download, Upload, User, LogOut, Loader2, BookOpen, HelpCircle } from 'lucide-react';
import { exportConfigToJson, importConfigFromJson } from '../utils/exportImport';

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
  onOpenBinanceModal?: () => void;
  onOpenCustomBalanceModal?: () => void;
  onOpenHelp?: () => void;
  onLanguageChange: (lang: Language) => void;
  onTimezoneChange: (tz: TimezoneMode) => void;
  onToggleDeveloperMode: (active: boolean) => void;
  onToggleSound: () => void;
  onToggleNotifications?: () => void;
  onConfidenceChange: (val: number) => void;
  onTelegramConfigChange?: (token: string, chatId: string) => void;
  onLogout?: () => void;
  onFullReset?: () => void | Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  language,
  timezone,
  isDeveloperMode,
  soundEnabled,
  notificationsEnabled = true,
  minConfidenceThreshold,
  telegramBotToken = '',
  telegramChatId = '',
  binanceConfig,
  executionMode = 'PAPER',
  paperWallet,
  onOpenBinanceModal,
  onOpenCustomBalanceModal,
  onOpenHelp,
  onLanguageChange,
  onTimezoneChange,
  onToggleDeveloperMode,
  onToggleSound,
  onToggleNotifications,
  onConfidenceChange,
  onTelegramConfigChange,
  onLogout,
  onFullReset,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [localTgToken, setLocalTgToken] = useState(telegramBotToken);
  const [localTgChatId, setLocalTgChatId] = useState(telegramChatId);


  if (!isOpen) return null;

  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden ${isArabic ? 'rtl text-right' : 'ltr'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3.5">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/40 to-cyan-500/40 rounded-2xl blur opacity-50"></div>
              <img
                src="/logo.png"
                alt="Quantura Logo"
                referrerPolicy="no-referrer"
                className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-amber-500/60 shadow-xl shadow-emerald-950/60"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-['Syncopate',sans-serif] font-bold text-white tracking-widest text-base sm:text-lg uppercase text-sweep-shine">QUANTURA</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono font-bold border border-cyan-500/40">
                  {APP_VERSION_TAG}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-cyan-400 text-[10px] font-mono font-black tracking-[0.2em] uppercase">TRADE SMARTER</span>
                <span className="text-slate-600 font-mono text-[10px]">&bull;</span>
                <p className="text-xs text-slate-400">{t.settings.title}</p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Quick Start & Help Guide Banner */}
          {onOpenHelp && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-emerald-500/10 border border-cyan-500/30 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{isArabic ? 'دليل البدء السريع وإدارة المخاطر' : 'Guide de Démarrage & Gestion du Risque'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">5 Steps</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {isArabic 
                      ? 'تعلم كيفية قراءة إشارات الذكاء الاصطناعي، تفعيل البوت، وقواعد الأمان.' 
                      : 'Apprenez à interpréter les signaux IA, configurer le bot et sécuriser vos fonds.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHelp();
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{isArabic ? 'فتح الدليل' : 'Ouvrir'}</span>
              </button>
            </div>
          )}

          {/* Paper Trading Custom Balance Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-teal-500/5 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-amber-400 border border-amber-500/30">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isArabic ? 'الرصيد الوهمي للتداول التجريبي' : 'Capital Virtuel de Trading (Paper)'}
                  </h4>
                  <span className="text-xs text-emerald-300 font-mono font-bold">
                    ${(paperWallet?.balance ?? 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                  </span>
                </div>
              </div>

              {onOpenCustomBalanceModal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenCustomBalanceModal();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition"
                >
                  {isArabic ? 'تعديل الرصيد' : 'Modifier'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {isArabic 
                ? 'يمكنك وضع وتخصيص أي مبلغ تريده لاختبار البوت وإدارة المخاطر بحرية كاملة.' 
                : 'Définissez le montant de simulation exact pour tester vos stratégies sans risque.'}
            </p>
          </div>

          {/* Binance API & Real Money Mode Card */}
          {onOpenBinanceModal && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/5 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {isArabic ? 'ربط حساب بايننس الحقيقي (Binance API)' : 'Intégration Binance API & Compte Réel'}
                    </h4>
                    <span className="text-xs text-slate-400">
                      {executionMode === 'BINANCE_LIVE'
                        ? (isArabic ? '🔴 التداول الحقيقي مفعل' : '🔴 Mode Réel Actif')
                        : (isArabic ? '🧪 وضع التداول التجريبي (Paper)' : '🧪 Mode Virtuel Actif')}
                    </span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  binanceConfig?.isConnected
                    ? 'bg-emerald-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {binanceConfig?.isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onOpenBinanceModal();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition"
              >
                <Key className="w-4 h-4" />
                <span>{isArabic ? 'إدارة مفاتيح API وإعدادات التداول الحقيقي' : 'Gérer les clés API et le Mode Réel'}</span>
              </button>
            </div>
          )}

          {/* Reference Timezone */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" />
              <label className="text-sm font-bold text-white">{t.settings.timezoneTitle}</label>
            </div>
            <p className="text-xs text-slate-400">{t.settings.timezoneDesc}</p>

            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
              <button
                onClick={() => onTimezoneChange('GMT+1')}
                className={`p-2.5 rounded-xl border text-center font-bold transition ${
                  timezone === 'GMT+1'
                    ? 'bg-brand-500 text-slate-950 border-brand-400 shadow-md shadow-brand-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                GMT+1 (Maroc)
              </button>
              <button
                onClick={() => onTimezoneChange('UTC')}
                className={`p-2.5 rounded-xl border text-center font-bold transition ${
                  timezone === 'UTC'
                    ? 'bg-brand-500 text-slate-950 border-brand-400 shadow-md shadow-brand-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                UTC (Temps Universel)
              </button>
              <button
                onClick={() => onTimezoneChange('LOCAL')}
                className={`p-2.5 rounded-xl border text-center font-bold transition ${
                  timezone === 'LOCAL'
                    ? 'bg-brand-500 text-slate-950 border-brand-400 shadow-md shadow-brand-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                Heure Locale
              </button>
            </div>
          </div>

          {/* Interface Language */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-brand-400" />
              <label className="text-sm font-bold text-white">Langue de l'Interface</label>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
              {(['fr', 'ar', 'en'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => onLanguageChange(lang)}
                  className={`p-2.5 rounded-xl border text-center font-bold transition ${
                    language === lang
                      ? 'bg-brand-500 text-slate-950 border-brand-400 shadow-md shadow-brand-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {lang === 'fr' ? 'Français' : lang === 'ar' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>
          </div>

          {/* Minimum Confidence Threshold */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white">{t.settings.minConfidence}</label>
              <span className="text-xs font-mono font-bold text-brand-400">{minConfidenceThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="85"
              step="5"
              value={minConfidenceThreshold}
              onChange={(e) => onConfidenceChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>50% (Plus de signaux)</span>
              <span>85% (Filtre Strict Grade A)</span>
            </div>
          </div>

          {/* Sound & Notifications */}
          <div className="space-y-4 pt-3 border-t border-slate-800">
            {/* Sound Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">{t.settings.soundEnabled}</span>
              </div>
              <button
                id="btn-settings-toggle-sound"
                type="button"
                onClick={onToggleSound}
                className={`w-11 h-6 rounded-full transition relative cursor-pointer ${
                  soundEnabled ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
                title={soundEnabled ? 'Désactiver' : 'Activer'}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-slate-950 transition-all absolute top-1 ${
                    soundEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Notification Alerts Toggle (Activer / Désactiver les notifications) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {notificationsEnabled ? (
                  <Bell className="w-4 h-4 text-amber-400" />
                ) : (
                  <BellOff className="w-4 h-4 text-slate-500" />
                )}
                <div>
                  <span className="text-sm font-medium text-white">
                    {isArabic ? 'تنبيهات وإشعارات الصفقات (Notifications)' : 'Notifications & Alertes de Signaux'}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {isArabic
                      ? 'تفعيل أو إيقاف وصول نوافذ التنبيهات المنبثقة للتحليلات والإشارات'
                      : 'Activer ou désactiver les popups et alertes en direct des signaux'}
                  </p>
                </div>
              </div>
              <button
                id="btn-settings-toggle-notifications"
                type="button"
                onClick={onToggleNotifications}
                className={`w-11 h-6 rounded-full transition relative shrink-0 cursor-pointer ${
                  notificationsEnabled ? 'bg-amber-500' : 'bg-slate-800'
                }`}
                title={notificationsEnabled ? (isArabic ? 'تعطيل التنبيهات' : 'Désactiver notifications') : (isArabic ? 'تفعيل التنبيهات' : 'Activer notifications')}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-slate-950 transition-all absolute top-1 ${
                    notificationsEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Telegram Notifications */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-bold text-white">Telegram Notifications</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isArabic ? 'أدخل Token الخاص بالبوت و Chat ID لاستقبال تنبيهات الصفقات المباشرة على تليجرام.' : 'Enter your Bot Token and Chat ID to receive live trade signals on Telegram.'}
            </p>
            <div className="space-y-2">
              <input
                type="password"
                placeholder={isArabic ? 'توكن البوت (Bot Token)' : 'Bot Token'}
                value={localTgToken}
                onChange={(e) => setLocalTgToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
              />
              <input
                type="text"
                placeholder={isArabic ? 'معرف الدردشة (Chat ID)' : 'Chat ID'}
                value={localTgChatId}
                onChange={(e) => setLocalTgChatId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          {/* Config Export / Import */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-white">
                {isArabic ? 'حفظ / استعادة الإعدادات' : 'Export / Import Configuration'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isArabic 
                ? 'قم بتصدير إعدادات واستراتيجيات البوت لتبادلها مع أصدقائك أو حفظها كنسخة احتياطية.' 
                : 'Backup or share your trading strategies and bot settings.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => exportConfigToJson()}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {isArabic ? 'تصدير (Export)' : 'Export JSON'}
              </button>
              
              <label className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                {isArabic ? 'استيراد (Import)' : 'Import JSON'}
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      importConfigFromJson(file, () => {
                        alert(isArabic ? 'تم استيراد الإعدادات بنجاح. سيتم إعادة تحميل التطبيق.' : 'Configuration imported successfully. App will reload.');
                        window.location.reload();
                      }, (err) => {
                        alert(isArabic ? `فشل الاستيراد: ${err}` : `Import failed: ${err}`);
                      });
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* Account & Session (Déconnexion) */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isArabic ? 'جلسة الحساب' : 'Session du Compte'}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">jawman27227@gmail.com</p>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500/50 text-xs font-bold font-mono transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isArabic ? 'تسجيل الخروج (Déconnexion)' : 'Déconnexion'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Developer Test Mode Warning Box */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white">{t.settings.devModeTitle}</span>
              </div>
              <button
                onClick={() => onToggleDeveloperMode(!isDeveloperMode)}
                className={`w-11 h-6 rounded-full transition relative ${
                  isDeveloperMode ? 'bg-amber-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-slate-950 transition-all absolute top-1 ${
                    isDeveloperMode ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-slate-400">{t.settings.devModeDesc}</p>
            {isDeveloperMode && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-mono">
                ⚠️ ATTENTION : Le mode Test utilise des données simulées pour le développement hors-ligne.
              </div>
            )}
          </div>
        </div>

        {/* Reset Confirmation Prompt if triggered */}
        {showResetConfirm && (
          <div className="mx-4 sm:mx-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 animate-in fade-in space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-rose-300">
                  {isArabic ? 'تأكيد إعادة ضبط المصنع؟' : 'Confirmer la réinitialisation totale ?'}
                </h4>
                <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                  {isArabic 
                    ? 'سيتم مسح جميع الصفقات، التنبيهات، مفاتيح بايننس وإعادة المحفظة إلى 1,000 USDT.'
                    : 'Toutes les données locales, alertes et clés seront effacées. Le portefeuille sera réinitialisé à 1 000 USDT.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-500/20">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                {isArabic ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={async () => {
                  setIsResetting(true);
                  try {
                    if (onFullReset) {
                      await onFullReset();
                    } else {
                      await apiStorage.resetTradingData();
                    }
                  } catch (err) {
                    console.error('Reset error:', err);
                  } finally {
                    setIsResetting(false);
                    setShowResetConfirm(false);
                    onClose();
                  }
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black shadow-lg shadow-rose-950/60 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                {isResetting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {isResetting
                    ? (isArabic ? 'جاري المسح...' : language === 'en' ? 'Resetting...' : 'Réinitialisation...')
                    : (isArabic ? 'تأكيد المسح نهائياً' : language === 'en' ? 'Yes, Reset All' : 'Oui, Réinitialiser')}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Footer with 3 Unified Side-by-Side Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* 1. Bouton Réinitialiser */}
            <button
              onClick={() => setShowResetConfirm(true)}
              type="button"
              className="py-3 px-2 sm:px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-sm group"
              title={isArabic ? 'إعادة ضبط كل البيانات' : 'Réinitialiser toutes les données'}
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 group-hover:-rotate-90 transition-transform duration-300 shrink-0" />
              <span className="truncate">
                {isArabic ? 'إعادة ضبط' : language === 'en' ? 'Reset' : 'Réinitialiser'}
              </span>
            </button>

            {/* 2. Bouton Fermer */}
            <button
              onClick={onClose}
              type="button"
              className="py-3 px-2 sm:px-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/70 hover:border-slate-600 flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-sm"
              title={isArabic ? 'إغلاق بدون حفظ إضافي' : 'Fermer la fenêtre'}
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
              <span className="truncate">
                {isArabic ? 'إغلاق' : language === 'en' ? 'Close' : 'Fermer'}
              </span>
            </button>

            {/* 3. Bouton Enregistrer */}
            <button
              onClick={() => {
                if (onTelegramConfigChange) {
                  onTelegramConfigChange(localTgToken, localTgChatId);
                }
                onClose();
              }}
              type="button"
              className="py-3 px-2 sm:px-3 rounded-xl bg-gradient-to-r from-brand-500 to-teal-400 hover:from-brand-400 hover:to-teal-300 text-slate-950 flex items-center justify-center gap-1.5 text-xs font-black shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 active:scale-[0.98] transition-all"
              title={isArabic ? 'حفظ وتطبيق الإعدادات' : 'Enregistrer les paramètres'}
            >
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3] shrink-0" />
              <span className="truncate">
                {isArabic ? 'حفظ' : language === 'en' ? 'Save' : 'Enregistrer'}
              </span>
            </button>
          </div>

          <div className="text-center space-y-0.5 pt-1">
            <p className="text-[11px] text-slate-400 font-mono">{t.copyright}</p>
            <p className="text-[10px] text-slate-500">{t.independentDisclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
