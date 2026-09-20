import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  LayoutDashboard, 
  Bot, 
  Radar,
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
  Copy,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import { Language, PaperWallet, ActiveBotPosition, APP_VERSION_TAG } from '../types';
import { calculatePortfolioMetrics } from '../utils/portfolioCalc';
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
  activeBotPositions?: ActiveBotPosition[];
  isDesktopOpen?: boolean;
  isAndroidView?: boolean;
  onOpenHelp?: () => void;
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
  activeBotPositions,
  isDesktopOpen = true,
  isAndroidView = false,
  onOpenHelp,
}) => {
  const t = translations[language] || translations.en;
  const isArabic = language === 'ar';
  const isEn = language === 'en';
  const isFrench = language === 'fr';

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
      setFeedbackMsg(isArabic ? 'تم تفعيل المصادقة الثنائية بنجاح!' : isFrench ? '2FA activée avec succès !' : '2FA enabled successfully!');
    } else {
      disable2FA(userIdent);
      setIs2FAActive(false);
      setTest2FAResult(null);
      setFeedbackMsg(isArabic ? 'تم تعطيل المصادقة الثنائية. يمكنك الدخول مباشرة بكلمة المرور.' : isFrench ? '2FA désactivée. Vous pouvez vous connecter sans code.' : '2FA disabled. You can log in directly with your password.');
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
    setFeedbackMsg(isArabic ? 'تم توليد مفتاح سري جديد' : isFrench ? 'Nouvelle clé secrète générée' : 'New secret key generated');
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
      setFeedbackMsg(isArabic ? 'تم التحقق وتفعيل المصادقة الثنائية بنجاح!' : isFrench ? '2FA validée et activée avec succès !' : '2FA verified and enabled successfully!');
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
      id: 'globalScanner', 
      label: t.tabs?.globalScanner || (isArabic ? 'رادار السوق الشامل' : 'Global Market Scanner'), 
      icon: Radar,
      badge: 'LIVE'
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
            {/* Enhanced Brand Avatar with Dual Ambient Glow */}
            <div className="relative group/logo shrink-0">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500/40 via-cyan-400/50 to-emerald-400/40 blur-md rounded-2xl opacity-75 group-hover/logo:opacity-100 transition-all duration-500" />
              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-[#030712] border-2 border-cyan-500/50 flex items-center justify-center p-1 shadow-[0_0_20px_rgba(6,182,212,0.4)] overflow-hidden transition-transform duration-300 group-hover/logo:scale-105">
                <img 
                  src="/logo.png" 
                  alt="Quantura" 
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              {/* Active Pulse Ring Indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-950"></span>
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-['Syncopate',sans-serif] font-black text-white tracking-[0.18em] text-sm sm:text-[15px] uppercase text-sweep-shine leading-none">
                  QUANTURA
                </h1>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/40 shadow-xs">
                  {APP_VERSION_TAG}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-cyan-400 text-[9px] font-mono font-black tracking-[0.22em] uppercase">
                  TRADE SMARTER
                </span>
                <span className="text-slate-600 text-[8px]">•</span>
                <span className="text-amber-400 text-[8px] font-mono font-semibold tracking-wider uppercase">
                  PRO AI
                </span>
              </div>
              <p className="text-slate-400 text-[8px] font-mono tracking-wider uppercase truncate mt-0.5">
                {isArabic ? 'المنصة المؤسسية الكمية' : 'Institutional Quant Terminal'}
              </p>
            </div>
          </div>

          {/* Close button (X) */}
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-900/90 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition shadow-md cursor-pointer shrink-0"
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
              {isArabic ? 'الأمان' : isFrench ? 'Sécurité' : 'Security'}
            </span>
            <div className={`flex items-center gap-1 text-[11px] font-mono font-bold ${is2FAActive ? 'text-amber-400' : 'text-slate-400'}`}>
              {is2FAActive ? (
                <>
                  <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{isArabic ? '2FA مفعل' : isFrench ? '2FA Actif' : '2FA Active'}</span>
                </>
              ) : (
                <>
                  <ShieldOff className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{isArabic ? '2FA معطل' : isFrench ? '2FA Inactif' : '2FA Off'}</span>
                </>
              )}
            </div>
          </div>

          {/* Trader Rank */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2">
            <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">
              {isArabic ? 'الرتبة' : isFrench ? 'Rang' : 'Rank'}
            </span>
            <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-cyan-300">
              <Coins className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>VIP Level 3</span>
            </div>
          </div>

          {/* Trading Mode */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2">
            <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">
              {isArabic ? 'الوضع' : isFrench ? 'Mode' : 'Mode'}
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

          {/* Portfolio Balance / Total Equity */}
          {(() => {
            const metrics = calculatePortfolioMetrics(paperWallet, activeBotPositions);
            return (
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">
                    {isArabic ? 'إجمالي المحفظة' : 'Equity'}
                  </span>
                  {metrics.floatingPnl !== 0 && (
                    <span className={`text-[8px] font-mono font-bold px-1 rounded ${
                      metrics.floatingPnl >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {metrics.floatingPnl >= 0 ? '+' : ''}${metrics.floatingPnl.toFixed(0)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono font-bold text-emerald-300 truncate">
                  ${metrics.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USDT
                </div>
                {metrics.inTradeMargin > 0 && (
                  <div className="text-[8px] text-slate-400 font-mono mt-1 flex items-center justify-between border-t border-slate-900 pt-0.5">
                    <span>{isArabic ? 'متاح:' : 'Free:'} ${metrics.freeCash.toFixed(0)}</span>
                    <span>{isArabic ? 'في الصفقات:' : 'Trades:'} ${metrics.inTradeMargin.toFixed(0)}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Security & Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsPasswordModalOpen(true)}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-200 transition cursor-pointer group"
          >
            <Lock className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="truncate">{isArabic ? 'كلمة المرور' : isFrench ? 'Mot de passe' : 'Password'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIs2FAModalOpen(true)}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-200 transition cursor-pointer group"
          >
            <QrCode className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="truncate">{isArabic ? 'إعدادات 2FA' : isFrench ? 'Gestion 2FA' : '2FA Settings'}</span>
          </button>
        </div>

        {/* Quick Start & Help Guide Button */}
        {onOpenHelp && (
          <button
            type="button"
            onClick={onOpenHelp}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-emerald-500/15 hover:from-cyan-500/25 hover:to-blue-500/25 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-bold font-mono transition cursor-pointer group shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>{isArabic ? 'دليل البدء السريع & المساعدة' : isFrench ? 'Guide & Démarrage Rapide' : 'Quick Start & Help Guide'}</span>
          </button>
        )}

        {/* Logout Action Button */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500/50 text-xs font-bold font-mono transition cursor-pointer group"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400 group-hover:-translate-x-1 transition-transform" />
          <span>{isArabic ? 'تسجيل الخروج' : isFrench ? 'Déconnexion' : 'Logout'}</span>
        </button>

        {/* Bottom Credits */}
        <div className="flex items-center justify-between px-1 pt-2 border-t border-slate-800/40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-slate-950 border border-cyan-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              <img src="/logo.png" alt="Quantura" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col text-left rtl:text-right">
              <span className="font-['Syncopate',sans-serif] font-bold text-slate-200 text-[9px] tracking-wider uppercase leading-tight">
                QUANTURA
              </span>
              <span className="text-cyan-400 text-[7.5px] font-mono font-bold tracking-[0.2em] uppercase leading-tight">
                TRADE SMARTER
              </span>
            </div>
          </div>
          <span className="text-cyan-400/90 text-[8.5px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
            {APP_VERSION_TAG} CORE
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
                  {isArabic ? 'إعداد المصادقة الثنائية (2FA)' : isFrench ? 'Configuration 2FA' : '2FA Security Configuration'}
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
                        <span>{isArabic ? 'المصادقة الثنائية (2FA)' : isFrench ? 'Authentification 2FA' : 'Two-Factor Authentication (2FA)'}</span>
                        <span className="text-[10px] font-normal text-slate-400">({isArabic ? 'اختيارية' : isFrench ? 'Optionnel' : 'Optional'})</span>
                      </div>
                      <div className="text-[11px] font-mono mt-0.5">
                        {is2FAActive ? (
                          <span className="text-amber-400 font-bold">{isArabic ? 'مفعلة ونشطة' : isFrench ? 'Activée' : 'Enabled & Active'}</span>
                        ) : (
                          <span className="text-slate-400">{isArabic ? 'معطلة (دخول مباشر)' : isFrench ? 'Désactivée' : 'Disabled (Direct login)'}</span>
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
                        {isArabic ? 'فحص مزامنة رمز هاتفك الآن:' : isFrench ? 'Tester la synchronisation :' : 'Test phone code sync now:'}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                        {totpCountdown}s
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
                        {isArabic ? 'فحص' : isFrench ? 'Tester' : 'Test'}
                      </button>
                    </div>

                    {test2FAResult === 'SUCCESS' && (
                      <div className="p-2 rounded-lg bg-emerald-500/20 border border-amber-500/40 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{isArabic ? 'الرمز صحيح ومطابق مع هاتفك!' : isFrench ? 'Code valide et synchronisé avec succès !' : 'Code is valid and synchronized!'}</span>
                      </div>
                    )}
                    {test2FAResult === 'ERROR' && (
                      <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{isArabic ? 'الرمز غير صحيح أو انتهت صلاحيته.' : isFrench ? 'Code invalide ou expiré.' : 'Invalid or expired code.'}</span>
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
                      <span>{isArabic ? 'تعطيل المصادقة الثنائية (جعل الدخول مباشر)' : isFrench ? 'Désactiver la 2FA (Connexion directe)' : 'Disable 2FA (Enable direct login)'}</span>
                    </button>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
                      <span>{isArabic ? 'تغيير الجهاز أو الهاتف؟' : isFrench ? 'Changement d\'appareil ?' : 'Changing device or phone?'}</span>
                      <button
                        type="button"
                        onClick={handleRegenerateKey}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <RefreshCcwDot className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'توليد مفتاح جديد' : isFrench ? 'Générer nouvelle clé' : 'Generate New Key'}</span>
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
                      <span>{isArabic ? 'الميزة معطلة حالياً' : isFrench ? '2FA Désactivée actuellement' : '2FA is currently disabled'}</span>
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
                      <span>{isArabic ? 'مفتاح الإعداد اليدوي:' : isFrench ? 'Clé secrète manuelle :' : 'Manual Setup Key:'}</span>
                      <button
                        type="button"
                        onClick={handleRegenerateKey}
                        className="text-slate-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                        title={isArabic ? 'توليد مفتاح جديد' : isFrench ? 'Générer une nouvelle clé' : 'Generate new key'}
                      >
                        <RefreshCcwDot className="w-3 h-3" />
                        <span>{isArabic ? 'تجديد' : isFrench ? 'Régénérer' : 'Regenerate'}</span>
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
                        title={isArabic ? 'نسخ المفتاح' : isFrench ? 'Copier la clé' : 'Copy Key'}
                      >
                        {copiedKey ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-emerald-300">{isArabic ? 'تم' : 'OK'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{isArabic ? 'نسخ' : isFrench ? 'Copier' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Verify & Activate Box */}
                  <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">
                        {isArabic ? 'أدخل الرمز من هاتفك للتفعيل:' : isFrench ? 'Code de confirmation :' : 'Enter code from your phone:'}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                        {totpCountdown}s
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
                        {isArabic ? 'تحقق وتفعيل' : isFrench ? 'Activer 2FA' : 'Verify & Enable 2FA'}
                      </button>
                    </div>

                    {test2FAResult === 'SUCCESS' && (
                      <div className="p-2 rounded-lg bg-emerald-500/20 border border-amber-500/40 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{isArabic ? 'تم تفعيل المصادقة الثنائية بنجاح!' : '2FA activée avec succès !'}</span>
                      </div>
                    )}
                    {test2FAResult === 'ERROR' && (
                      <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{isArabic ? 'الرمز غير صحيح أو انتهت صلاحيته.' : isFrench ? 'Code invalide ou expiré.' : 'Invalid or expired code.'}</span>
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
                    <span>{isArabic ? 'تفعيل 2FA مباشرة بدون اختبار' : isFrench ? 'Activer 2FA directement' : 'Enable 2FA directly without test'}</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setIs2FAModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold uppercase tracking-wide text-xs transition mt-2 cursor-pointer border border-slate-700"
            >
              {isArabic ? 'إغلاق وحفظ' : isFrench ? 'Fermer' : 'Close'}
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
                  {isArabic ? 'تغيير كلمة المرور' : isFrench ? 'Changer le mot de passe' : 'Change Password'}
                </h3>
              </div>
              <button onClick={() => setIsPasswordModalOpen(false)} className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500">
                  {isArabic ? 'كلمة المرور الحالية' : isFrench ? 'Mot de passe actuel' : 'Current Password'}
                </label>
                <input 
                  type="password" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50 transition" 
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500">
                  {isArabic ? 'كلمة المرور الجديدة' : isFrench ? 'Nouveau mot de passe' : 'New Password'}
                </label>
                <input 
                  type="password" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50 transition" 
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500">
                  {isArabic ? 'تأكيد كلمة المرور' : isFrench ? 'Confirmer le mot de passe' : 'Confirm New Password'}
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
              {isArabic ? 'حفظ التغييرات' : isFrench ? 'Sauvegarder' : 'Save Changes'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
