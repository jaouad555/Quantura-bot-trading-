import React from 'react';
import { PushAlert, AlertSettings, Language } from '../types';
import { translations } from '../utils/translations';
import { Bell, BellOff, Volume2, VolumeX, CheckCircle, ShieldCheck, X, Zap } from 'lucide-react';

interface PushAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: PushAlert[];
  alertSettings: AlertSettings;
  onUpdateSettings: (settings: AlertSettings) => void;
  onRequestPermission: () => void;
  permissionStatus: NotificationPermission;
  onSendTestAlert: () => void;
  language: Language;
}

export const PushAlertsModal: React.FC<PushAlertsModalProps> = ({
  isOpen,
  onClose,
  alerts,
  alertSettings,
  onUpdateSettings,
  onRequestPermission,
  permissionStatus,
  onSendTestAlert,
  language,
}) => {
  if (!isOpen) return null;

  const t = translations[language];
  const isArabic = language === 'ar';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 transform-gpu isolate flex items-center justify-center p-4">
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl relative ${isArabic ? 'rtl text-right' : 'ltr'}`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2.5 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{t.pushAlerts}</h2>
            <p className="text-xs text-slate-400">{t.pushAlertsDesc}</p>
          </div>
        </div>

        {/* Permission Banner */}
        <div className="mb-5 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-400" />
              <span>Permission Navigateur Push</span>
            </span>
            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
              permissionStatus === 'granted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {permissionStatus.toUpperCase()}
            </span>
          </div>

          {permissionStatus !== 'granted' && (
            <button
              onClick={onRequestPermission}
              className="w-full mt-2 py-2 px-3 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-md shadow-brand-500/20 flex items-center justify-center gap-2"
            >
              <Bell className="w-4 h-4" />
              <span>{t.enableNotifications}</span>
            </button>
          )}
        </div>

        {/* Notification Settings Toggles */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <span className="text-xs font-medium text-slate-200">{t.soundAlerts}</span>
            <button
              onClick={() => onUpdateSettings({ ...alertSettings, soundEnabled: !alertSettings.soundEnabled })}
              className={`p-1.5 rounded-lg border text-xs font-semibold transition flex items-center gap-1.5 ${
                alertSettings.soundEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              {alertSettings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{alertSettings.soundEnabled ? 'Activé' : 'Désactivé'}</span>
            </button>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="flex justify-between text-xs font-medium text-slate-200 mb-2">
              <span>Confiance Minimale pour Alerte Push</span>
              <span className="font-mono text-brand-400 font-bold">{alertSettings.minConfidence}%</span>
            </div>
            <input
              type="range"
              min="60"
              max="95"
              value={alertSettings.minConfidence}
              onChange={(e) => onUpdateSettings({ ...alertSettings, minConfidence: parseInt(e.target.value) })}
              className="w-full accent-brand-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Test Alert Button */}
        <button
          onClick={onSendTestAlert}
          className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-brand-400 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          <span>{t.testAlert}</span>
        </button>
      </div>
    </div>
  );
};
