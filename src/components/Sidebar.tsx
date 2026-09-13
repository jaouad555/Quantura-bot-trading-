import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  LayoutDashboard, 
  Bot, 
  Layers, 
  BarChart2, 
  LineChart, 
  TrendingUp, 
  BrainCircuit, 
  ShieldCheck, 
  History, 
  LogOut, 
  X,
  User,
  ShieldOff,
  Coins,
  Lock,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  RefreshCcwDot,
  Copy
} from 'lucide-react';
import { Language, PaperWallet } from '../types';
import { translations } from '../utils/translations';
import { 
  getOrCreate2FASecret, 
  generateNew2FASecret, 
  verifyTOTP, 
  getTOTPUri, 
  generateQRCodeDataUrl, 
  formatSecretKeyWithSpaces, 
  getTOTPTimeRemaining,
  is2FAEnabled,
  set2FAEnabled,
  disable2FA
} from '../utils/totp';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  language: Language;
  username: string;
  onLogout: () => void;
  connectionPing?: number;
  isOpen?: boolean;
  onClose?: () => void;
  botEnabled?: boolean;
  executionMode?: 'PAPER' | 'BINANCE_LIVE';
  paperWallet?: PaperWallet;
  isDesktopOpen?: boolean;
  isAndroidView?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  language,
  username,
  onLogout,
  connectionPing = 21,
  isOpen = false,
  onClose,
  botEnabled = false,
  executionMode = 'PAPER',
  paperWallet,
  isDesktopOpen = true,
  isAndroidView = false,
}) => {
  const t = translations[language] || translations.en;
  const isArabic = language === 'ar';

  const displayUsername = username?.trim() || 'JAOUAD';
  const userIdent = displayUsername.toLowerCase();

  // 2FA & Password Modals State
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [is2FAActive, setIs2FAActive] = useState(() => is2FAEnabled(userIdent));
  const [copiedKey, setCopiedKey] = useState(false);
  const [setupKey2FA, setSetupKey2FA] = useState('');
  const [setupQR2FA, setSetupQR2FA] = useState('');
  const [test2FACode, setTest2FACode] = useState('');
  const [test2FAResult, setTest2FAResult] = useState<'SUCCESS' | 'ERROR' | null>(null);
  const [totpCountdown, setTotpCountdown] = useState(getTOTPTimeRemaining());
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Sync 2FA state
  useEffect(() => {
    setIs2FAActive(is2FAEnabled(userIdent));
  }, [userIdent, is2FAModalOpen]);

  // Generate TOTP secret and QR code when 2FA modal opens
  useEffect(() => {
    if (is2FAModalOpen) {
      const userKey = getOrCreate2FASecret(displayUsername);
      setSetupKey2FA(userKey);
      const uri = getTOTPUri(userKey, `Quantura (${displayUsername})`);
      generateQRCodeDataUrl(uri).then(setSetupQR2FA).catch(console.error);
      setTest2FACode('');
      setTest2FAResult(null);
      setFeedbackMsg(null);
    }
  }, [is2FAModalOpen, displayUsername]);

  // Live countdown for TOTP refresh
  useEffect(() => {
    if (!is2FAModalOpen) return;
    const interval = setInterval(() => {
      setTotpCountdown(getTOTPTimeRemaining());
    }, 1000);
    return () => clearInterval(interval);
  }, [is2FAModalOpen]);

  const handleCopyKey = () => {
    if (!setupKey2FA) return;
    navigator.clipboard.writeText(setupKey2FA);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleToggle2FA = (enable: boolean) => {
    if (enable) {
      set2FAEnabled(true, userIdent);
      setIs2FAActive(true);
      setFeedbackMsg(isArabic ? '✅ تم تفعيل المصادقة الثنائية بنجاح!' : '✅ 2FA activée avec succès !');
    } else {
      disable2FA(userIdent);
      setIs2FAActive(false);
      setTest2FAResult(null);
      setFeedbackMsg(isArabic ? '⚪ تم تعطيل المصادقة الثنائية. يمكنك الدخول مباشرة بكلمة المرور.' : '⚪ 2FA désactivée. Vous pouvez vous connecter sans code.');
    }
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleRegenerateKey = () => {
    const newSecret = generateNew2FASecret(userIdent);
    setSetupKey2FA(newSecret);
    const uri = getTOTPUri(newSecret, `Quantura (${displayUsername || 'JAOUAD'})`);
    generateQRCodeDataUrl(uri).then(setSetupQR2FA).catch(console.error);
    setTest2FACode('');
    setTest2FAResult(null);
    setFeedbackMsg(isArabic ? '🔄 تم توليد مفتاح سري جديد' : '🔄 Nouvelle clé secrète générée');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleVerifyTestCode = () => {
    const clean = test2FACode.trim().replace(/\D/g, '');
    if (clean.length !== 6) return;
    const isValid = verifyTOTP(clean, setupKey2FA);
    setTest2FAResult(isValid ? 'SUCCESS' : 'ERROR');
    if (isValid) {
      set2FAEnabled(true, userIdent);
      setIs2FAActive(true);
      setFeedbackMsg(isArabic ? '✅ تم التحقق وتفعيل المصادقة الثنائية بنجاح!' : '✅ 2FA validée et activée avec succès !');
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  // Complete list of navigation items
  const menuItems = [
    { 
      id: 'signal', 
      label: t.tabs?.signal || 'Dashboard', 
      icon: LayoutDashboard,
      badge: null
    },
    { 
      id: 'autoBot', 
      label: t.tabs?.autoBot || 'Auto Trading Bot', 
      icon: Bot,
      badge: botEnabled ? 'ACTIVE' : null
    },
    { 
      id: 'mtf', 
      label: t.tabs?.mtf || 'Scanner MTF', 
      icon: Layers,
      badge: null
    },
    { 
      id: 'market', 
      label: t.tabs?.market || 'Markets', 
      icon: BarChart2,
      badge: null
    },
    { 
      id: 'chart', 
      label: t.tabs?.chart || 'Interactive Charts', 
      icon: LineChart,
      badge: null
    },
    { 
      id: 'backtest', 
      label: t.tabs?.backtest || 'Strategy Backtest', 
      icon: TrendingUp,
      badge: null
    },
    { 
      id: 'analysis', 
      label: t.tabs?.analysis || 'AI Quant Analysis', 
      icon: BrainCircuit,
      badge: null
    },
    { 
      id: 'riskWallet', 
      label: t.tabs?.riskWallet || 'Risk Engine & Wallet', 
      icon: ShieldCheck,
      badge: null
    },
    { 
      id: 'history', 
      label: t.tabs?.history || 'Trade History', 
      icon: History,
      badge: null
    },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (onClose) {
      onClose();
    }
  };

  const menuContent = (
    <div className="w-full h-full bg-[#070b12] text-slate-100 flex flex-col justify-between overflow-y-auto no-scrollbar relative border-r border-slate-800/80 shadow-2xl selection:bg-cyan-500 selection:text-slate-950">
      {/* Ambient Top Glow */}
      <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-cyan-500/20 via-blue-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Main Upper Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        {/* Top bar with Quantura Logo and Close button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Small Brand Avatar with Glow */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 to-cyan-400/40 blur-md rounded-xl" />
              <div className="relative w-11 h-11 rounded-xl bg-slate-950 border border-cyan-500/40 flex items-center justify-center p-1 shadow-[0_0_15px_rgba(6,182,212,0.35)] overflow-hidden">
                <img 
                  src="/logo.png" 
                  alt="Quantura" 
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-['Syncopate',sans-serif] font-bold text-white tracking-widest text-sm uppercase text-sweep-shine leading-none">
                  QUANTURA
                </h1>
                <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-300 font-mono font-bold border border-cyan-500/40">
                  PRO
                </span>
              </div>
              <p className="text-cyan-400 text-[9px] font-mono font-black tracking-[0.25em] uppercase mt-1">
                TRADE SMARTER
              </p>
              <p className="text-slate-400 text-[8px] font-mono tracking-wider uppercase">
                {isArabic ? 'المنصة الكمية والذكاء الاصطناعي' : 'Quantitative AI Precision'}
              </p>
            </div>
          </div>

          {/* Close button (X) */}
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-900/90 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition shadow-md cursor-pointer"
              title="إغلاق القائمة"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 mb-4 pl-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-slate-400 text-xs font-medium">
            Flux <span className="text-slate-200 font-mono font-semibold">{connectionPing}ms</span>
          </span>
          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ml-0.5">
            LIVE
          </span>
          {botEnabled && (
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ml-auto animate-pulse">
              BOT ACTIVE
            </span>
          )}
        </div>

        {/* Navigation Menu Items */}
        <nav className="space-y-1.5 flex-1">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 group relative cursor-pointer ${
                  isActive
                    ? 'bg-slate-900/90 text-white border border-slate-800 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
                }`}
              >
                {/* Active Left Pill Indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-cyan-400 rounded-r-md shadow-[0_0_12px_rgba(34,211,238,1)]" />
                )}

                <div className="flex items-center gap-3">
                  <IconComponent
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  />
                  <span className={`text-xs sm:text-sm tracking-wide ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                    {item.label}
                  </span>
                </div>

                {/* Right Badge or Active Dot */}
                <div className="flex items-center gap-2">
                  {item.badge && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)]" />
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Real Full User Account Section (Transferred from Top Bar into Menu) */}
      <div className="p-3.5 sm:p-4 bg-[#05080e] border-t border-slate-800/80 relative z-10 space-y-3">
        {/* User Card Header */}
        <div className="flex items-center justify-between bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <User className="w-5 h-5 text-slate-950 font-black" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 shadow-[0_0_6px_#34d399]"></span>
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-white text-xs sm:text-sm font-bold font-mono uppercase tracking-wider leading-none">
                  {displayUsername}
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-amber-500/40 text-[9px] font-mono font-bold">
                  PRO VIP
                </span>
              </div>
              <span className="text-slate-400 text-[10px] font-mono tracking-tight mt-1">
                jawman27227@gmail.com
              </span>
            </div>
          </div>
        </div>

        {/* Account Info Grid (Status, Security, Rank, Balance) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Security Status */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2">
            <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">
              {isArabic ? 'الأمان' : 'Sécurité'}
            </span>
            <div className={`flex items-center gap-1 text-[11px] font-mono font-bold ${is2FAActive ? 'text-amber-400' : 'text-slate-400'}`}>
              {is2FAActive ? (
                <>
                  <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{isArabic ? '2FA مفعل 🟢' : '2FA Actif'}</span>
                </>
              ) : (
                <>
                  <ShieldOff className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{isArabic ? '2FA معطل ⚪' : '2FA Inactif'}</span>
                </>
              )}
            </div>
          </div>

          {/* Trader Rank */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2">
            <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">
              {isArabic ? 'الرتبة' : 'Rang'}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-cyan-300">
              <Coins className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>VIP Level 3</span>
            </div>
          </div>

          {/* Trading Mode */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2">
            <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">
              {isArabic ? 'الوضع' : 'Mode'}
            </span>
            <div className="text-[11px] font-mono font-bold text-white truncate">
              {executionMode === 'BINANCE_LIVE' ? (
                <span className="text-rose-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                  Binance Live
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Paper Trading
                </span>
              )}
            </div>
          </div>

          {/* Portfolio Balance */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2">
            <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">
              {isArabic ? 'الرصيد' : 'Solde'}
            </span>
            <div className="text-[11px] font-mono font-bold text-emerald-300 truncate">
              ${(paperWallet?.balance ?? 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USDT
            </div>
          </div>
        </div>

        {/* Security & Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsPasswordModalOpen(true)}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-200 transition cursor-pointer group"
          >
            <Lock className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="truncate">{isArabic ? 'كلمة المرور' : 'Mot de passe'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIs2FAModalOpen(true)}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-200 transition cursor-pointer group"
          >
            <QrCode className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="truncate">{isArabic ? 'إعدادات 2FA' : 'Gestion 2FA'}</span>
          </button>
        </div>

        {/* Logout Action Button */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500/50 text-xs font-bold font-mono transition cursor-pointer group"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400 group-hover:-translate-x-1 transition-transform" />
          <span>{isArabic ? 'تسجيل الخروج' : 'Déconnexion (Logout)'}</span>
        </button>

        {/* Bottom Credits */}
        <div className="flex items-center justify-between px-1 pt-2 border-t border-slate-800/40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-slate-950 border border-cyan-500/30 flex items-center justify-center overflow-hidden shrink-0">
              <img src="/logo.png" alt="Quantura" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-['Syncopate',sans-serif] font-bold text-slate-300 text-[9px] tracking-wider uppercase leading-tight">
                QUANTURA
              </span>
              <span className="text-cyan-400 text-[8px] font-mono font-bold tracking-[0.2em] uppercase leading-tight">
                TRADE SMARTER
              </span>
            </div>
          </div>
          <span className="text-slate-500 text-[8.5px] uppercase tracking-wider font-mono">
            v5.1 AI CORE
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar (hidden in Android preview or when collapsed) */}
      {!isAndroidView && (
        <aside 
          className={`hidden md:flex flex-shrink-0 h-screen sticky top-0 z-40 transition-all duration-300 ease-in-out ${
            isDesktopOpen 
              ? 'w-[290px] lg:w-[310px] xl:w-[320px] opacity-100' 
              : 'w-0 opacity-0 pointer-events-none overflow-hidden'
          }`}
        >
          <div className="w-[290px] lg:w-[310px] xl:w-[320px] h-full">
            {menuContent}
          </div>
        </aside>
      )}

      {/* 2. Mobile, Tablet & Android Preview Slide-out Drawer Overlay */}
      {isOpen && (
        <div className={`fixed inset-0 z-50 flex ${isAndroidView ? '' : 'md:hidden'}`}>
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={onClose}
          />

          {/* Drawer Slide-in */}
          <div className="relative z-50 h-full w-[85vw] max-w-[340px] shadow-2xl animate-in slide-in-from-left duration-300">
            {menuContent}
          </div>
        </div>
      )}

      {/* 2FA Setup Modal (Teleported to document.body) */}
      {is2FAModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setIs2FAModalOpen(false)}
        >
          <div 
            className="relative w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-6 overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-cyan-400"></div>
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  {isArabic ? 'إعداد المصادقة الثنائية (2FA)' : 'Configuration 2FA'}
                </h3>
              </div>
              <button onClick={() => setIs2FAModalOpen(false)} className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3.5 space-y-3.5 max-h-[75vh] overflow-y-auto no-scrollbar">
              {feedbackMsg && (
                <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 text-xs flex items-center gap-2 animate-in fade-in duration-150 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{feedbackMsg}</span>
                </div>
              )}

              {/* Master 2FA Toggle Card */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${is2FAActive ? 'bg-emerald-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                      {is2FAActive ? <ShieldCheck className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{isArabic ? 'المصادقة الثنائية (2FA)' : 'Authentification 2FA'}</span>
                        <span className="text-[10px] font-normal text-slate-400">({isArabic ? 'اختيارية' : 'Optionnel'})</span>
                      </div>
                      <div className="text-[11px] font-mono mt-0.5">
                        {is2FAActive ? (
                          <span className="text-amber-400 font-bold">{isArabic ? '🟢 مفعلة ونشطة' : '🟢 Activée'}</span>
                        ) : (
                          <span className="text-slate-400">{isArabic ? '⚪ معطلة (دخول مباشر)' : '⚪ Désactivée'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={is2FAActive}
                      onChange={(e) => handleToggle2FA(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2.5">
                  {isArabic
                    ? is2FAActive
                      ? 'المصادقة الثنائية مفعلة. عند تسجيل الدخول، سيطلب منك النظام إدخال الرمز المكون من 6 أرقام من تطبيق هاتفك.'
                      : 'المصادقة الثنائية معطلة. يمكنك تسجيل الدخول باسم المستخدم وكلمة المرور فقط دون الحاجة لأي رمز.'
                    : is2FAActive
                      ? '2FA est active. Lors de la connexion, un code à 6 chiffres depuis votre application d\'authentification sera demandé.'
                      : '2FA est désactivée. Vous pouvez vous connecter directement avec vos identifiants sans code.'}
                </p>
              </div>

              {is2FAActive ? (
                /* Configured and Active state */
                <div className="space-y-3 animate-in fade-in duration-150">
                  {/* Real-Time TOTP Sync Verification Test */}
                  <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">
                        {isArabic ? 'فحص مزامنة رمز هاتفك الآن:' : 'Tester la synchronisation :'}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                        ⏱️ {totpCountdown}s
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={test2FACode}
                        onChange={(e) => {
                          setTest2FACode(e.target.value.replace(/\D/g, ''));
                          setTest2FAResult(null);
                        }}
                        placeholder="000000"
                        className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-center text-sm font-mono tracking-widest text-cyan-300 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyTestCode}
                        disabled={test2FACode.length !== 6}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold font-mono transition cursor-pointer shrink-0"
                      >
                        {isArabic ? 'فحص' : 'Tester'}
                      </button>
                    </div>

                    {test2FAResult === 'SUCCESS' && (
                      <div className="p-2 rounded-lg bg-emerald-500/20 border border-amber-500/40 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{isArabic ? '✅ الرمز صحيح ومطابق مع هاتفك!' : '✅ Code valide et synchronisé avec succès !'}</span>
                      </div>
                    )}
                    {test2FAResult === 'ERROR' && (
                      <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{isArabic ? '❌ الرمز غير صحيح أو انتهت صلاحيته.' : '❌ Code invalide ou expiré.'}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions: Disable button or reset key */}
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleToggle2FA(false)}
                      className="w-full py-2.5 px-3 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <ShieldOff className="w-4 h-4 text-rose-400" />
                      <span>{isArabic ? 'تعطيل المصادقة الثنائية (جعل الدخول مباشر)' : 'Désactiver la 2FA (Connexion directe)'}</span>
                    </button>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
                      <span>{isArabic ? 'تغيير الجهاز أو الهاتف؟' : 'Changement d\'appareil ?'}</span>
                      <button
                        type="button"
                        onClick={handleRegenerateKey}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <RefreshCcwDot className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'توليد مفتاح جديد' : 'Générer nouvelle clé'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Disabled state: Allow setup or quick activation */
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl space-y-1.5">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{isArabic ? 'الميزة معطلة حالياً' : '2FA Désactivée actuellement'}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {isArabic
                        ? 'إذا أردت تفعيلها لحماية حسابك برمز من Google Authenticator، امسح الرمز أدناه ثم اضغط تفعيل.'
                        : 'Pour activer 2FA et sécuriser votre compte avec Google Authenticator, scannez le code ci-dessous puis activez.'}
                    </p>
                  </div>

                  {/* Scannable QR Code */}
                  <div className="flex flex-col items-center justify-center bg-white p-3 rounded-xl mx-auto w-fit shadow-md">
                    {setupQR2FA ? (
                      <img src={setupQR2FA} alt="2FA QR Code" className="w-36 h-36 block" />
                    ) : (
                      <div className="w-36 h-36 flex items-center justify-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
                      </div>
                    )}
                  </div>

                  {/* Manual Base32 Secret Key */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-400">
                      <span>{isArabic ? 'مفتاح الإعداد اليدوي:' : 'Clé secrète manuelle :'}</span>
                      <button
                        type="button"
                        onClick={handleRegenerateKey}
                        className="text-slate-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                        title={isArabic ? 'توليد مفتاح جديد' : 'Générer une nouvelle clé'}
                      >
                        <RefreshCcwDot className="w-3 h-3" />
                        <span>{isArabic ? 'تجديد' : 'Régénérer'}</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 gap-2">
                      <span className="text-xs font-mono font-bold tracking-wider text-emerald-300 select-all break-all leading-relaxed">
                        {formatSecretKeyWithSpaces(setupKey2FA)}
                      </span>
                      <button 
                        type="button"
                        onClick={handleCopyKey}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white text-[11px] font-mono flex items-center gap-1 transition cursor-pointer shrink-0 ml-2"
                        title={isArabic ? 'نسخ المفتاح' : 'Copier la clé'}
                      >
                        {copiedKey ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-emerald-300">{isArabic ? 'تم' : 'OK'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{isArabic ? 'نسخ' : 'Copier'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Verify & Activate Box */}
                  <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">
                        {isArabic ? 'أدخل الرمز من هاتفك للتفعيل:' : 'Code de confirmation :'}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                        ⏱️ {totpCountdown}s
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={test2FACode}
                        onChange={(e) => {
                          setTest2FACode(e.target.value.replace(/\D/g, ''));
                          setTest2FAResult(null);
                        }}
                        placeholder="000000"
                        className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-center text-sm font-mono tracking-widest text-cyan-300 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyTestCode}
                        disabled={test2FACode.length !== 6}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold font-mono transition cursor-pointer shrink-0"
                      >
                        {isArabic ? 'تحقق وتفعيل' : 'Activer 2FA'}
                      </button>
                    </div>

                    {test2FAResult === 'SUCCESS' && (
                      <div className="p-2 rounded-lg bg-emerald-500/20 border border-amber-500/40 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{isArabic ? '✅ تم تفعيل المصادقة الثنائية بنجاح!' : '✅ 2FA activée avec succès !'}</span>
                      </div>
                    )}
                    {test2FAResult === 'ERROR' && (
                      <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{isArabic ? '❌ الرمز غير صحيح أو انتهت صلاحيته.' : '❌ Code invalide ou expiré.'}</span>
                      </div>
                    )}
                  </div>

                  {/* Direct 1-Click Enable Button */}
                  <button
                    type="button"
                    onClick={() => handleToggle2FA(true)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-amber-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>{isArabic ? 'تفعيل 2FA مباشرة بدون اختبار' : 'Activer 2FA directement'}</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setIs2FAModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold uppercase tracking-wide text-xs transition mt-2 cursor-pointer border border-slate-700"
            >
              {isArabic ? 'إغلاق وحفظ' : 'Fermer'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Password Change Modal (Teleported to document.body) */}
      {isPasswordModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setIsPasswordModalOpen(false)}
        >
          <div 
            className="relative w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-6 overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  {isArabic ? 'تغيير كلمة المرور' : 'Changer le mot de passe'}
                </h3>
              </div>
              <button onClick={() => setIsPasswordModalOpen(false)} className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500">
                  {isArabic ? 'كلمة المرور الحالية' : 'Mot de passe actuel'}
                </label>
                <input 
                  type="password" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50 transition" 
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500">
                  {isArabic ? 'كلمة المرور الجديدة' : 'Nouveau mot de passe'}
                </label>
                <input 
                  type="password" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50 transition" 
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500">
                  {isArabic ? 'تأكيد كلمة المرور' : 'Confirmer le mot de passe'}
                </label>
                <input 
                  type="password" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50 transition" 
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              onClick={() => setIsPasswordModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold uppercase tracking-wide text-xs transition mt-2 cursor-pointer"
            >
              {isArabic ? 'حفظ التغييرات' : 'Sauvegarder'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
