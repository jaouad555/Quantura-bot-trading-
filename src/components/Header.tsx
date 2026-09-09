import React, { useEffect, useState, useRef } from 'react';
import {
  createPortal } from 'react-dom';
import { BinanceTicker, ConnectionState, Language, TimezoneMode, BinanceApiConfig, TradingExecutionMode, PaperWallet, MarketType } from '../types';
import { translations } from '../utils/translations';
import { formatTime, getTimezoneLabel } from '../utils/timezone';
import { TradingPair, RESPECTED_TRADING_PAIRS, formatCoinPrice } from '../utils/tradingPairs';
import { getOrCreate2FASecret, generateNew2FASecret, formatSecretKeyWithSpaces, getCurrentTOTP, getTOTPUri, generateQRCodeDataUrl, verifyTOTP, getTOTPTimeRemaining, is2FAConfigured, set2FAConfigured, is2FAEnabled, set2FAEnabled, disable2FA, enable2FA } from '../utils/totp';
import {
  Radar,
  Activity,
  Volume2,
  VolumeX,
  Bell,
  Settings,
  Globe,
  Smartphone,
  Monitor,
  RefreshCw, RefreshCcwDot,
  Clock,
  AlertTriangle,
  Radio,
  Key,
  Flame,
  ShieldCheck,
  ShieldOff,
  Wallet,
  Coins,
  User,
  LogOut,
  ChevronDown,
  Shield,
  ShieldAlert,
  CheckCircle2,
  X,
  Lock,
  QrCode,
  Copy,
} from 'lucide-react';

interface HeaderProps {
  selectedSymbol: string;
  onSelectPair: (pair: TradingPair) => void;
  ticker: BinanceTicker | null;
  connectionState: ConnectionState;
  language: Language;
  timezone: TimezoneMode;
  isAndroidView: boolean;
  unreadAlertsCount: number;
  soundEnabled: boolean;
  isRefreshing: boolean;
  isDeveloperMode: boolean;
  binanceConfig?: BinanceApiConfig;
  executionMode?: TradingExecutionMode;
  paperWallet?: PaperWallet;
  marketType?: MarketType;
  onToggleMarketType?: (marketType: MarketType) => void;
  onOpenBinanceModal?: () => void;
  onOpenCustomBalanceModal?: () => void;
  onLanguageChange: (lang: Language) => void;
  onToggleAndroidView: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenRiskModal?: () => void;
  onToggleSound: () => void;
  onRefreshData: () => void;
  onLogout?: () => void;
  username?: string;
}

export const Header: React.FC<HeaderProps> = ({
  selectedSymbol,
  onSelectPair,
  ticker,
  connectionState,
  language,
  timezone,
  isAndroidView,
  unreadAlertsCount,
  soundEnabled,
  isRefreshing,
  isDeveloperMode,
  binanceConfig,
  executionMode = 'PAPER',
  paperWallet,
  marketType = 'FUTURES',
  onToggleMarketType,
  onOpenBinanceModal,
  onOpenCustomBalanceModal,
  onLanguageChange,
  onToggleAndroidView,
  onOpenNotifications,
  onOpenSettings,
  onOpenRiskModal,
  onToggleSound,
  onRefreshData,
  onLogout,
  username,
}) => {
  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<'UP' | 'DOWN' | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userModalRef = useRef<HTMLDivElement>(null);

  const displayUsername = username?.trim() || 'JAOUAD';
  const userIdent = displayUsername.toLowerCase();

  const [is2FAActive, setIs2FAActive] = useState(() => is2FAEnabled(userIdent));
  const [copiedKey, setCopiedKey] = useState(false);
  const [setupKey2FA, setSetupKey2FA] = useState('');
  const [setupQR2FA, setSetupQR2FA] = useState('');
  const [test2FACode, setTest2FACode] = useState('');
  const [test2FAResult, setTest2FAResult] = useState<'SUCCESS' | 'ERROR' | null>(null);
  const [totpCountdown, setTotpCountdown] = useState(getTOTPTimeRemaining());
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Keep 2FA state in sync with storage
  useEffect(() => {
    setIs2FAActive(is2FAEnabled(userIdent));
  }, [userIdent, is2FAModalOpen, isUserMenuOpen]);

  // Generate real TOTP secret and QR code when 2FA modal opens
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

  // Horizontal Drag-to-Scroll refs & state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't drag if clicking buttons, selects, inputs, links, or interactive controls
    if (target.closest('button, select, input, a, [role="button"]')) return;

    if (!scrollContainerRef.current) return;
    setIsMouseDown(true);
    startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !scrollContainerRef.current) return;
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 4) {
      e.preventDefault();
      scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsMouseDown(false);
  };

  const activePair =
    RESPECTED_TRADING_PAIRS.find((p) => p.symbol === selectedSymbol) ||
    RESPECTED_TRADING_PAIRS[0];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close user dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Do not close if clicking inside the avatar trigger button in the header
      if (userMenuRef.current?.contains(target)) return;
      // Do not close if clicking inside the user modal card itself
      if (userModalRef.current?.contains(target)) return;
      setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (ticker?.price) {
      if (prevPrice !== null) {
        if (ticker.price > prevPrice) {
          setPriceFlash('UP');
          setTimeout(() => setPriceFlash(null), 600);
        } else if (ticker.price < prevPrice) {
          setPriceFlash('DOWN');
          setTimeout(() => setPriceFlash(null), 600);
        }
      }
      setPrevPrice(ticker.price);
    }
  }, [ticker?.price]);

  const isPricePositive = (ticker?.priceChangePercent24h || 0) >= 0;

  const getConnectionBadge = () => {
    switch (connectionState) {
      case 'CONNECTED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-medium shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <Radio className="w-2.5 h-2.5 text-amber-400" />
            <span className="hidden xl:inline">{t.status.connected}</span>
            <span className="xl:hidden">LIVE</span>
          </span>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-medium shrink-0">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            <span>{t.status.connecting}</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono font-medium shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
            <span>{t.status.offline}</span>
          </span>
        );
    }
  };

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 shadow-md">
      {/* Dev Mode Banner if active */}
      {isDeveloperMode && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-3 py-0.5 text-center text-[11px] text-amber-300 flex items-center justify-center gap-1.5 font-mono">
          <AlertTriangle className="w-3 h-3" />
          <span>⚠️ {t.status.devModeWarning}</span>
        </div>
      )}

      <div className="w-full px-3 sm:px-4 py-2 sm:py-2.5">
        {/* Single Line Horizontally Draggable Header Layout */}
        <div 
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={`flex items-center justify-between gap-3 sm:gap-4 overflow-x-auto no-scrollbar select-none transition-[cursor] ${
            isMouseDown ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
        >
          
          {/* Left: Brand + Pair Selector + Realtime Price */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Quantura Brand Compact Logo & Name */}
            <div 
              className="flex items-center gap-2 shrink-0 cursor-pointer group pr-2.5 border-r border-slate-800/80" 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              title="Quantura Terminal"
            >
              <div className="relative shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/50 to-cyan-500/50 rounded-xl blur-[2px] opacity-40 group-hover:opacity-90 transition duration-300"></div>
                <img
                  src="/logo.png"
                  alt="Quantura Logo"
                  referrerPolicy="no-referrer"
                  className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-amber-500/60 shadow-md group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="hidden xs:flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-sm sm:text-base font-black tracking-wider bg-gradient-to-r from-white via-slate-100 to-emerald-400 bg-clip-text text-transparent font-mono">
                    QUANTURA
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-amber-400 font-mono font-bold border border-amber-500/40">
                    v2.5
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block leading-none mt-1">
                  Quant Algo Terminal
                </span>
              </div>
            </div>

            {/* Active Selected Pair Indicator */}
            <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner shrink-0">
              <div
                className={`w-6 h-6 rounded-lg bg-gradient-to-br ${activePair.iconBg} flex items-center justify-center text-slate-950 font-black text-xs shadow-sm shrink-0`}
              >
                {activePair.iconText}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-bold text-white text-xs sm:text-sm font-mono tracking-tight leading-none">
                  {activePair.displayName}
                </span>
                <span className="text-[9px] font-mono text-slate-400 block leading-tight mt-0.5">
                  {isArabic ? activePair.arabicName : activePair.category}
                </span>
              </div>
            </div>

            {/* Compact Real-Time Price Ticker Pill */}
            {ticker && (
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/90 rounded-xl px-2.5 sm:px-3 py-1.5 shrink-0 shadow-inner">
                {onToggleMarketType ? (
                  <button
                    type="button"
                    onClick={() => onToggleMarketType(marketType === 'FUTURES' ? 'SPOT' : 'FUTURES')}
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border transition flex items-center gap-1 ${
                      marketType === 'FUTURES'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-amber-500/40 hover:bg-emerald-500/30'
                    }`}
                    title={isArabic ? 'اضغط للتبديل بين Spot و Futures' : 'Cliquer pour basculer entre Spot et Futures'}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${marketType === 'FUTURES' ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span>{marketType}</span>
                  </button>
                ) : (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                    {marketType}
                  </span>
                )}

                <div
                  className={`text-xs sm:text-sm md:text-base font-mono font-black transition-colors duration-300 ${
                    priceFlash === 'UP'
                      ? 'text-amber-400'
                      : priceFlash === 'DOWN'
                      ? 'text-rose-400'
                      : 'text-white'
                  }`}
                >
                  ${formatCoinPrice(ticker.price, selectedSymbol)}
                </div>

                <div
                  className={`text-[11px] font-mono font-bold flex items-center ${
                    isPricePositive ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  <span>{isPricePositive ? '+' : ''}{(ticker.priceChangePercent24h ?? 0).toFixed(2)}%</span>
                </div>

                
                {/* 4. Refresh Button (Moved next to price) */}
                <button
                  onClick={onRefreshData}
                  disabled={isRefreshing}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 transition disabled:opacity-50 shrink-0 ml-1"
                  title={isArabic ? 'تحديث البيانات' : 'Actualiser'}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
                </button>
                <div className="hidden md:inline-block">
                  {getConnectionBadge()}
                </div>
              </div>
            )}
          </div>

          {/* Right: Controls & Icons in ONE Single Horizontal Row (Draggable & Accessible) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* 1. Custom Virtual Balance Button */}
            {onOpenCustomBalanceModal && (
              <button
                onClick={onOpenCustomBalanceModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-amber-500/30 hover:border-amber-500/50 text-xs font-mono font-bold transition shadow-sm shrink-0"
                title={isArabic ? 'تخصيص الرصيد الوهمي' : 'Définir le solde virtuel'}
              >
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                <span>${(paperWallet?.balance ?? 10000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                <span className="text-[10px] text-amber-400/80 font-normal hidden sm:inline">USDT</span>
              </button>
            )}

            {/* 2. Binance API Live Connection Button */}
            {onOpenBinanceModal && (
              <button
                onClick={onOpenBinanceModal}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition shadow-sm shrink-0 ${
                  executionMode === 'BINANCE_LIVE'
                    ? 'bg-brand-500/20 text-brand-300 border-brand-500/50 animate-pulse'
                    : binanceConfig?.isConnected
                    ? 'bg-brand-500/10 text-brand-300 border-brand-500/30 hover:bg-brand-500/20'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                }`}
                title={executionMode === 'BINANCE_LIVE' ? 'Binance Live' : 'Binance API'}
              >
                <Key className={`w-3.5 h-3.5 ${executionMode === 'BINANCE_LIVE' || binanceConfig?.isConnected ? 'text-brand-400' : 'text-amber-400'}`} />
                <span className="hidden md:inline">
                  {executionMode === 'BINANCE_LIVE' ? '🔴 Live' : binanceConfig?.isConnected ? '🟢 API' : 'Binance'}
                </span>
              </button>
            )}

            {/* 3. GMT+1 / Timezone Clock */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-300 shrink-0">
              <Clock className="w-3.5 h-3.5 text-brand-400" />
              <span>{formatTime(currentTime, timezone, true)}</span>
            </div>

            

            {/* 5. Sound Toggle Button */}
            <button
              onClick={onToggleSound}
              className={`p-2 rounded-xl border transition shrink-0 ${
                soundEnabled
                  ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-500 hover:text-slate-300'
              }`}
              title={soundEnabled ? 'Mute' : 'Sound ON'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* 6. Notifications Button */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition shrink-0"
              title={isArabic ? 'الإشعارات' : 'Notifications'}
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {/* 7. Android View Toggle */}
            <button
              onClick={onToggleAndroidView}
              className={`p-2 rounded-xl border transition shrink-0 ${
                isAndroidView
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white'
              }`}
              title={isAndroidView ? 'Fullscreen' : 'Android Frame'}
            >
              {isAndroidView ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            </button>

            {/* 7.5. Risk Engine Button */}
            {onOpenRiskModal && (
              <button
                onClick={onOpenRiskModal}
                className="p-2 text-rose-400 hover:text-rose-300 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition shrink-0"
                title={isArabic ? 'محرك إدارة المخاطر' : 'Risk Management Engine'}
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
            )}
            {/* 8. Settings Button */}
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition shrink-0"
              title={isArabic ? 'الإعدادات (بما في ذلك اختيار اللغة)' : 'Paramètres & Langues'}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* 9. USER ACCOUNT ICON (حساب المستخدم في نفس الصف) */}
            <div className="shrink-0" ref={userMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsUserMenuOpen((prev) => !prev);
                }}
                className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition shadow-sm cursor-pointer ${
                  isUserMenuOpen
                    ? 'bg-cyan-500/25 border-cyan-500/70 text-cyan-300 shadow-[0_0_14px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-200 hover:border-cyan-500/50 hover:text-white'
                }`}
                title={isArabic ? 'حساب المستخدم' : 'Compte Utilisateur'}
              >
                {/* User Avatar with Green Active Dot */}
                <div className="relative flex items-center justify-center shrink-0">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-inner">
                    <User className="w-3.5 h-3.5 text-slate-950 font-bold" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-slate-900 shadow-[0_0_4px_#34d399]"></span>
                </div>

                {/* Username label (visible on sm screens and up) */}
                <span className="text-xs font-bold font-mono text-cyan-300 tracking-wide uppercase hidden sm:inline">
                  {displayUsername}
                </span>

                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180 text-cyan-400' : ''}`} />
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Quick Trading Pairs Ticker Bar (شريط الأزواج المباشر مع رمز كل عملة) */}
      <div className="w-full px-3 sm:px-4 py-1.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar select-none">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider shrink-0 pr-2 border-r border-slate-800">
          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
          <span>{isArabic ? 'الأزواج:' : 'Paires:'}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {RESPECTED_TRADING_PAIRS.map((pair) => {
            const isSelected = pair.symbol === selectedSymbol;
            return (
              <button
                key={pair.symbol}
                type="button"
                onClick={() => onSelectPair(pair)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold shrink-0 transition-all flex items-center gap-2 cursor-pointer border ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border-amber-500/50 shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-500/30'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
                title={isArabic ? pair.arabicName : pair.displayName}
              >
                <div
                  className={`w-5 h-5 rounded-md bg-gradient-to-br ${pair.iconBg} flex items-center justify-center text-slate-950 font-black text-[10px] shadow-xs shrink-0`}
                >
                  {pair.iconText}
                </div>
                <span className="leading-none">{pair.displayName}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* User Account Profile Modal (Rendered via createPortal to document.body) */}
      {isUserMenuOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setIsUserMenuOpen(false)}
        >
          <div 
            ref={userModalRef}
            className="relative w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-5 overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {/* Top Accent Gradient Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-cyan-400 to-indigo-500"></div>

            {/* Header with Close Button */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <User className="w-5 h-5 text-slate-950 font-black" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 shadow-[0_0_6px_#34d399]"></span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">
                      {displayUsername}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-amber-500/40 text-[9px] font-mono font-bold">
                      PRO VIP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    jawman27227@gmail.com
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUserMenuOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Account Status Grid */}
            <div className="grid grid-cols-2 gap-2.5 my-4">
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
                <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                  {isArabic ? 'حالة الأمان' : 'Sécurité'}
                </span>
                <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${is2FAActive ? 'text-amber-400' : 'text-slate-400'}`}>
                  {is2FAActive ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{isArabic ? '2FA مفعل 🟢' : '2FA Actif 🟢'}</span>
                    </>
                  ) : (
                    <>
                      <ShieldOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{isArabic ? '2FA معطل ⚪' : '2FA Inactif ⚪'}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
                <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                  {isArabic ? 'صلاحيات الحساب' : 'Rang Trader'}
                </span>
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-300">
                  <Coins className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>VIP Level 3</span>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
                <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                  {isArabic ? 'وضع التداول' : 'Mode Trading'}
                </span>
                <div className="text-xs font-mono font-bold text-white">
                  {executionMode === 'BINANCE_LIVE' ? (
                    <span className="text-rose-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                      Binance Live
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      Paper Trading
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
                <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                  {isArabic ? 'رصيد المحفظة' : 'Solde Portefeuille'}
                </span>
                <div className="text-xs font-mono font-bold text-emerald-300 truncate">
                  ${(paperWallet?.balance ?? 10000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USDT
                </div>
              </div>
            </div>

            {/* Quick Actions / Security */}
            <div className="space-y-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  setIsPasswordModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-200 transition group cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>{isArabic ? 'تغيير كلمة المرور' : 'Changer le mot de passe'}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono text-cyan-500/50">********</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  setIs2FAModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-200 transition group cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>{isArabic ? 'إعدادات 2FA (اختيارية)' : 'Gestion 2FA (Optionnelle)'}</span>
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${is2FAActive ? 'bg-emerald-500/20 text-emerald-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {is2FAActive ? (isArabic ? 'مفعل 🟢' : 'Actif 🟢') : (isArabic ? 'معطل ⚪' : 'Désactivé ⚪')}
                </span>
              </button>
            </div>

            {/* Logout Action Button */}
            {onLogout && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsUserMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 active:bg-rose-500/40 text-rose-200 hover:text-white border border-rose-500/40 hover:border-rose-500/60 text-xs font-bold font-mono transition shadow-lg shadow-rose-950/40 cursor-pointer group"
              >
                <LogOut className="w-4 h-4 text-rose-400 group-hover:-translate-x-1 transition-transform shrink-0" />
                <span>{isArabic ? 'تسجيل الخروج (Déconnexion)' : 'Déconnexion / Logout'}</span>
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
      {/* 2FA Setup Modal */}
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

      {/* Password Change Modal */}
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
    </header>
  );
};
