import React, { useState, useMemo } from 'react';
import { PushAlert, Language } from '../types';
import { 
  Bell, 
  CheckCheck, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  X, 
  Copy, 
  Check, 
  Send,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  Trash2
} from 'lucide-react';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: PushAlert[];
  onMarkAllAsRead: () => void;
  onClearAllAlerts: () => void;
  onDeleteAlert: (id: string) => void;
  language: Language;
  onSendTestAlert?: () => void;
}

// Helper to format pair nicely e.g. BTCUSDT -> BTC/USDT
const formatSymbolBadge = (symbol?: string, title?: string): string => {
  if (symbol && typeof symbol === 'string') {
    if (symbol.includes('/')) return symbol.toUpperCase();
    if (symbol.toUpperCase().endsWith('USDT') && symbol.length > 4) {
      return `${symbol.slice(0, -4).toUpperCase()}/USDT`;
    }
    return symbol.toUpperCase();
  }
  if (title && typeof title === 'string') {
    const match = title.match(/([A-Z0-9]+)\/USDT|[A-Z0-9]{2,6}USDT/i);
    if (match && match[0]) {
      const found = match[0].toUpperCase();
      if (found.includes('/')) return found;
      if (found.endsWith('USDT') && found.length > 4) return `${found.slice(0, -4)}/USDT`;
      return found;
    }
  }
  return 'BTC/USDT';
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  alerts,
  onMarkAllAsRead,
  onClearAllAlerts,
  onDeleteAlert,
  language,
  onSendTestAlert,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL' | 'INFO'>('ALL');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const handleRequestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setPermissionStatus(perm);
        if (perm === 'granted' && onSendTestAlert) {
          onSendTestAlert();
        }
      } catch (e) {
        console.warn('Error requesting permission', e);
      }
    }
  };

  if (!isOpen) return null;

  const isArabic = language === 'ar';

  const handleCopyAlert = (alert: PushAlert) => {
    const text = `${alert.title}\n${alert.body}\n© 2026 jaouad abdechchafi — Binance AI Trading Terminal`;
    navigator.clipboard.writeText(text);
    setCopiedId(alert.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filterType === 'BUY') return alert.decision === 'LONG';
    if (filterType === 'SELL') return alert.decision === 'SHORT';
    if (filterType === 'INFO') return alert.decision !== 'LONG' && alert.decision !== 'SHORT';
    return true;
  });

  const getAlertVisual = (alert: PushAlert) => {
    if (alert.decision === 'LONG') {
      return {
        category: isArabic ? 'صفقة شراء' : language === 'en' ? 'BUY Signal' : 'Signal ACHAT',
        badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/10',
        cardBorder: 'border-emerald-500/40',
        glowRing: 'ring-1 ring-emerald-500/30',
        icon: <TrendingUp className="w-5 h-5" />,
        miniIcon: <ArrowUpRight className="w-3.5 h-3.5" />
      };
    }
    if (alert.decision === 'SHORT') {
      return {
        category: isArabic ? 'صفقة بيع' : language === 'en' ? 'SELL Signal' : 'Signal VENTE',
        badgeBg: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
        iconBg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-lg shadow-rose-500/10',
        cardBorder: 'border-rose-500/40',
        glowRing: 'ring-1 ring-rose-500/30',
        icon: <TrendingDown className="w-5 h-5" />,
        miniIcon: <ArrowDownRight className="w-3.5 h-3.5" />
      };
    }
    return {
      category: isArabic ? 'تنبيه عادي / مراقبة' : language === 'en' ? 'Market Notice' : 'Alerte Marché',
      badgeBg: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
      iconBg: 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-lg shadow-sky-500/10',
      cardBorder: 'border-sky-500/30',
      glowRing: 'ring-1 ring-sky-500/20',
      icon: <Info className="w-5 h-5" />,
      miniIcon: <Bell className="w-3.5 h-3.5" />
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className={`bg-slate-900 border-l border-slate-800 w-full max-w-md h-full p-4 flex flex-col shadow-2xl ${isArabic ? 'rtl text-right' : 'ltr'}`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">
                {isArabic ? 'مركز الإشعارات والتنبيهات' : language === 'en' ? 'Notification Center' : 'Centre de Notifications'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isArabic ? 'تنبيهات الصفقات والإشارات الحية + تليجرام' : 'Signaux réels, alertes audio & Telegram'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title={isArabic ? 'إغلاق' : 'Fermer'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Permission Banner if not granted */}
        {permissionStatus !== 'granted' && (
          <div className="my-2 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-cyan-400 shrink-0 animate-bounce" />
              <div className="text-[11px] text-slate-300 truncate">
                {isArabic ? 'تفعيل إشعارات المتصفح المنبثقة' : 'Activer les notifications du navigateur'}
              </div>
            </div>
            <button
              onClick={handleRequestPermission}
              className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] rounded-lg transition shrink-0 shadow-sm shadow-cyan-500/30"
            >
              {isArabic ? 'تفعيل الآن' : 'Autoriser'}
            </button>
          </div>
        )}

        {/* Filter Chips Bar */}
        <div className="flex items-center gap-1.5 pt-3 pb-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 shrink-0 ${
              filterType === 'ALL'
                ? 'bg-slate-800 text-white border-slate-600'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>{isArabic ? 'الكل' : 'Tous'}</span>
            <span className="text-[10px] font-mono opacity-70">({alerts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('BUY')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 shrink-0 ${
              filterType === 'BUY'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-emerald-400'
            }`}
          >
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span>{isArabic ? 'صفقات شراء' : 'Achat'}</span>
            <span className="text-[10px] font-mono text-emerald-400">({alerts.filter(a => a.decision === 'LONG').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('SELL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 shrink-0 ${
              filterType === 'SELL'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-rose-400'
            }`}
          >
            <TrendingDown className="w-3 h-3 text-rose-400" />
            <span>{isArabic ? 'صفقات بيع' : 'Vente'}</span>
            <span className="text-[10px] font-mono text-rose-400">({alerts.filter(a => a.decision === 'SHORT').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('INFO')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 shrink-0 ${
              filterType === 'INFO'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-sky-400'
            }`}
          >
            <Info className="w-3 h-3 text-sky-400" />
            <span>{isArabic ? 'تنبيهات عامة' : 'Info'}</span>
            <span className="text-[10px] font-mono text-sky-400">({alerts.filter(a => a.decision !== 'LONG' && a.decision !== 'SHORT').length})</span>
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex justify-between items-center my-2 text-xs flex-wrap gap-1.5">
          <span className="text-slate-400 font-mono text-[11px]">
            {filteredAlerts.length} {isArabic ? 'إشعار معروض' : 'alertes affichées'}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {onSendTestAlert && (
              <button
                onClick={onSendTestAlert}
                className="text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold flex items-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-1 rounded border border-cyan-500/30 transition"
                title={isArabic ? 'تجربة إشعار فوري' : 'Tester une alerte'}
              >
                <Send className="w-3 h-3" />
                <span>{isArabic ? 'تجربة' : 'Test'}</span>
              </button>
            )}

            {alerts.length > 0 && (
              <>
                <button
                  onClick={onMarkAllAsRead}
                  className="text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1 text-[11px] bg-brand-500/10 hover:bg-brand-500/20 px-2 py-1 rounded border border-brand-500/30 transition"
                  title={isArabic ? 'تحديد الكل كمقروء' : 'Marquer comme lu'}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'قراءة الكل' : 'Tout lire'}</span>
                </button>

                {confirmClearAll ? (
                  <div className="flex items-center gap-1 bg-rose-950/80 p-0.5 rounded border border-rose-500/40 animate-in fade-in">
                    <span className="text-[10px] text-rose-300 font-bold px-1">
                      {isArabic ? 'مسح الكل؟' : 'Confirmer?'}
                    </span>
                    <button
                      onClick={() => {
                        onClearAllAlerts();
                        setConfirmClearAll(false);
                      }}
                      className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded transition"
                    >
                      {isArabic ? 'نعم، امسح' : 'Oui'}
                    </button>
                    <button
                      onClick={() => setConfirmClearAll(false)}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded transition"
                    >
                      {isArabic ? 'إلغاء' : 'Non'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClearAll(true)}
                    className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 text-[11px] bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded border border-rose-500/30 transition"
                    title={isArabic ? 'مسح وحذف جميع الإشعارات' : 'Vider toutes les alertes'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'مسح الكل' : 'Vider'}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <p className="font-semibold text-slate-400">
                {isArabic ? 'لا توجد إشعارات في هذا القسم.' : language === 'en' ? 'No alerts in this category.' : 'Aucune alerte dans cette catégorie.'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                {isArabic
                  ? 'سيتم إرسال إشعار فوري مع زوج العملة وأيقونة نوع الصفقة عند رصد إشارة تداول.'
                  : 'Les nouvelles alertes afficheront la paire et l\'icône spécifique (Achat/Vente/Info).'}
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const visual = getAlertVisual(alert);
              const symbolBadge = formatSymbolBadge(alert.symbol, alert.title);

              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border transition ${
                    alert.read
                      ? 'bg-slate-950/60 border-slate-800/80 opacity-90'
                      : `bg-slate-950 ${visual.cardBorder} shadow-lg ${visual.glowRing}`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Distinct Icon */}
                    <div className={`p-2.5 rounded-xl border shrink-0 ${visual.iconBg}`}>
                      {visual.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Pair Badge & Category Header */}
                      <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {/* Prominent Trading Pair Badge */}
                          <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-black bg-amber-400/10 text-amber-300 border border-amber-500/30 tracking-wide shadow-sm">
                            {symbolBadge}
                          </span>

                          {/* Signal Type Pill */}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${visual.badgeBg}`}>
                            {visual.miniIcon}
                            <span>{visual.category}</span>
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-bold text-white mb-1 leading-snug">
                        {alert.title}
                      </h4>

                      {/* Body Description */}
                      <p className="text-xs text-slate-300 font-sans leading-relaxed break-words bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80 mt-1">
                        {alert.body}
                      </p>

                      {/* Card Actions (Copy & Delete) */}
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-900/60">
                        <button
                          onClick={() => onDeleteAlert(alert.id)}
                          className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition px-2 py-0.5 rounded bg-slate-900/70 hover:bg-rose-500/10 border border-slate-800/60 hover:border-rose-500/30"
                          title={isArabic ? 'حذف هذا الإشعار' : 'Supprimer cette alerte'}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{isArabic ? 'حذف' : 'Supprimer'}</span>
                        </button>

                        <button
                          onClick={() => handleCopyAlert(alert)}
                          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition px-2.5 py-0.5 rounded bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60"
                          title="Copier la recommandation"
                        >
                          {copiedId === alert.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">{isArabic ? 'تم النسخ' : 'Copié'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>{isArabic ? 'نسخ التوصية' : 'Copier'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};


