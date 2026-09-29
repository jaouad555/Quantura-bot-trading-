import React, { useState, useEffect } from 'react';
import { 
  Language, 
  TimezoneMode, 
  BinanceApiConfig, 
  TradingExecutionMode, 
  PaperWallet, 
  DisplayMode, 
  APP_VERSION_TAG,
  AutoBotConfig,
  ActiveBotPosition,
  BotTimeframe
} from '../types';
import { translations } from '../utils/translations';
import { apiStorage } from '../utils/apiStorage';
import { sendTelegramMessage } from '../utils/telegram';
import { exportConfigToJson, importConfigFromJson } from '../utils/exportImport';
import {
  Globe,
  Clock,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  ShieldCheck,
  Key,
  Wallet,
  RotateCcw,
  Check,
  Trash2,
  Send,
  Download,
  Upload,
  User,
  LogOut,
  Loader2,
  BookOpen,
  RefreshCw,
  Activity,
  Zap,
  Bot,
  Lock,
  QrCode,
  Copy,
  ChevronRight,
  Eye,
  EyeOff,
  Monitor,
  AlertTriangle,
  Sparkles,
  Sliders,
  CheckCircle2,
  Play,
  Gauge,
  Layers,
  Cpu,
  Coins
} from 'lucide-react';
import {
  getOrCreate2FASecret,
  generateNew2FASecret,
  verifyTOTP,
  getTOTPUri,
  generateQRCodeDataUrl,
  getTOTPTimeRemaining,
  is2FAEnabled,
  set2FAEnabled,
  disable2FA
} from '../utils/totp';

export interface SettingsViewProps {
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
  onNavigateTab?: (tab: any) => void;
  onLogout?: () => void;
  onFullReset?: () => void | Promise<void>;
}

type SettingsSection = 'general' | 'binance' | 'wallet' | 'bot' | 'security' | 'notifications' | 'backup';

const AVAILABLE_PAIRS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', tag: 'Major' },
  { symbol: 'ETHUSDT', name: 'Ethereum', tag: 'Major' },
  { symbol: 'SOLUSDT', name: 'Solana', tag: 'L1 Fast' },
  { symbol: 'BNBUSDT', name: 'BNB Chain', tag: 'Exchange' },
  { symbol: 'XRPUSDT', name: 'Ripple', tag: 'Payment' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', tag: 'Meme' },
  { symbol: 'ADAUSDT', name: 'Cardano', tag: 'L1' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', tag: 'L1' },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol', tag: 'AI & Data' },
  { symbol: 'SUIUSDT', name: 'Sui Network', tag: 'L1 Fast' },
  { symbol: 'LINKUSDT', name: 'Chainlink', tag: 'Oracle' },
  { symbol: 'DOTUSDT', name: 'Polkadot', tag: 'Interoperable' }
];

const SettingsViewComponent: React.FC<SettingsViewProps> = ({
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
  displayMode = 'standard',
  botConfig,
  activeBotPositions = [],
  username = 'JAOUAD',
  onOpenBinanceModal,
  onOpenCustomBalanceModal,
  onOpenHelp,
  onRefreshBinancePermissions,
  onLanguageChange,
  onTimezoneChange,
  onToggleDeveloperMode,
  onToggleSound,
  onToggleNotifications,
  onConfidenceChange,
  onTelegramConfigChange,
  onChangeDisplayMode,
  onUpdatePaperWallet,
  onUpdateBotConfig,
  onNavigateTab,
  onLogout,
  onFullReset,
}) => {
  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [localTgToken, setLocalTgToken] = useState(telegramBotToken);
  const [localTgChatId, setLocalTgChatId] = useState(telegramChatId);
  const [showTgToken, setShowTgToken] = useState(false);
  const [isTestingTg, setIsTestingTg] = useState(false);
  const [tgFeedback, setTgFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Custom balance input state
  const [customBalanceInput, setCustomBalanceInput] = useState((paperWallet?.balance ?? 1000).toString());
  const [balanceFeedback, setBalanceFeedback] = useState<string | null>(null);

  // Bot Local Config state
  const [localBotFeedback, setLocalBotFeedback] = useState<string | null>(null);

  // Binance testing state
  const [isTestingBinance, setIsTestingBinance] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    canTrade?: boolean;
    message: string;
    details?: string;
    serverIp?: string;
    latencyMs?: number;
  } | null>(null);

  // 2FA state
  const userIdent = (username || 'JAOUAD').trim().toLowerCase();
  const [is2FAActive, setIs2FAActive] = useState(() => is2FAEnabled(userIdent));
  const [copiedKey, setCopiedKey] = useState(false);
  const [setupKey2FA, setSetupKey2FA] = useState(() => getOrCreate2FASecret(username || 'JAOUAD'));
  const [setupQR2FA, setSetupQR2FA] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [totpCountdown, setTotpCountdown] = useState(getTOTPTimeRemaining());
  const [totpFeedback, setTotpFeedback] = useState<string | null>(null);
  
  // Test PIN / TOTP code validator
  const [testPinInput, setTestPinInput] = useState('');
  const [testPinResult, setTestPinResult] = useState<'VALID' | 'INVALID' | null>(null);

  // Sound chime synthesizer
  const playSoundChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.1); // A5
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.2); // D6
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('Audio test failed', e);
    }
  };

  // Sync prop changes safely without triggering unnecessary re-renders
  useEffect(() => {
    setLocalTgToken(telegramBotToken || '');
    setLocalTgChatId(telegramChatId || '');
  }, [telegramBotToken, telegramChatId]);

  useEffect(() => {
    if (paperWallet?.balance !== undefined) {
      setCustomBalanceInput(paperWallet.balance.toString());
    }
  }, [paperWallet?.balance]);

  // Live TOTP countdown (Only active when inside the Security & 2FA section to prevent background re-render loops)
  useEffect(() => {
    if (activeSection !== 'security') return;
    const interval = setInterval(() => {
      setTotpCountdown(getTOTPTimeRemaining());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSection]);

  const handleCopyKey = () => {
    if (!setupKey2FA) return;
    navigator.clipboard.writeText(setupKey2FA);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRegenerateKey = () => {
    const newSecret = generateNew2FASecret(userIdent);
    setSetupKey2FA(newSecret);
    const uri = getTOTPUri(newSecret, `Quantura (${username || 'JAOUAD'})`);
    generateQRCodeDataUrl(uri).then(setSetupQR2FA).catch(console.error);
    setTotpFeedback(isArabic ? 'تم توليد مفتاح 2FA سري جديد' : 'New 2FA Secret Key generated');
    setTimeout(() => setTotpFeedback(null), 3000);
  };

  const handleOpenQR = () => {
    const uri = getTOTPUri(setupKey2FA, `Quantura (${username || 'JAOUAD'})`);
    generateQRCodeDataUrl(uri).then(setSetupQR2FA).catch(console.error);
    setShowQRModal(true);
  };

  const handleToggle2FAState = (enable: boolean) => {
    if (enable) {
      set2FAEnabled(true, userIdent);
      setIs2FAActive(true);
      setTotpFeedback(isArabic ? 'تم تفعيل المصادقة الثنائية بنجاح!' : '2FA Enabled successfully!');
    } else {
      disable2FA(userIdent);
      setIs2FAActive(false);
      setTotpFeedback(isArabic ? 'تم تعطيل المصادقة الثنائية.' : '2FA Disabled.');
    }
    setTimeout(() => setTotpFeedback(null), 3500);
  };

  const handleVerifyTestPin = () => {
    const clean = testPinInput.trim().replace(/\D/g, '');
    const masterPin = apiStorage.getItem('app_2fa_master_pin') || '272270';
    if (clean === masterPin || verifyTOTP(clean, setupKey2FA)) {
      setTestPinResult('VALID');
      setTotpFeedback(isArabic ? 'الرمز صحيح ومصرح بالدخول 100% ✅' : 'Valid Code! Authorized Access ✅');
    } else {
      setTestPinResult('INVALID');
      setTotpFeedback(isArabic ? 'رمز غير صحيح ❌ حاول مجدداً' : 'Invalid Code ❌ Try again');
    }
    setTimeout(() => {
      setTestPinResult(null);
      setTotpFeedback(null);
    }, 4000);
  };

  const handleApplyCustomBalance = () => {
    const val = parseFloat(customBalanceInput);
    if (!isNaN(val) && val > 0 && onUpdatePaperWallet && paperWallet) {
      onUpdatePaperWallet({
        ...paperWallet,
        balance: val,
      });
      setBalanceFeedback(isArabic ? `تم تعديل الرصيد إلى $${val.toLocaleString()} USDT بنجاح!` : `Balance updated to $${val.toLocaleString()} USDT!`);
      setTimeout(() => setBalanceFeedback(null), 3000);
    }
  };

  const handleBotUpdateWithFeedback = (partial: Partial<AutoBotConfig>, msgAr: string, msgEn: string) => {
    if (onUpdateBotConfig) {
      onUpdateBotConfig(partial);
      setLocalBotFeedback(isArabic ? msgAr : msgEn);
      setTimeout(() => setLocalBotFeedback(null), 3000);
    }
  };

  const handleTogglePairSelection = (symbol: string) => {
    const current = botConfig?.allowedSymbols || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];
    let updated: string[];
    if (current.includes(symbol)) {
      if (current.length <= 1) {
        setLocalBotFeedback(isArabic ? 'يجب الإبقاء على زوج واحد على الأقل نشطاً' : 'Must keep at least 1 pair selected');
        setTimeout(() => setLocalBotFeedback(null), 2500);
        return;
      }
      updated = current.filter(s => s !== symbol);
    } else {
      updated = [...current, symbol];
    }
    handleBotUpdateWithFeedback({ allowedSymbols: updated }, `تم تعديل قائمة الأزواج المسموحة (${updated.length} أزواج)`, `Allowed universe updated (${updated.length} pairs)`);
  };

  const handleTestBinanceConnection = async () => {
    setIsTestingBinance(true);
    setTestResult(null);
    const t0 = performance.now();
    try {
      if (onRefreshBinancePermissions) {
        await onRefreshBinancePermissions();
      }
      const [accRes, ipRes] = await Promise.all([
        fetch(`/api/binance/account?marketType=${binanceConfig?.marketType || 'FUTURES'}`),
        fetch('/api/server-ip').catch(() => null),
      ]);
      const t1 = performance.now();
      const latencyMs = Math.round(t1 - t0);
      const accData = await accRes.json().catch(() => ({}));
      let serverIp = '';
      if (ipRes && ipRes.ok) {
        const ipData = await ipRes.json().catch(() => ({}));
        serverIp = ipData.ip || '';
      }

      if (accRes.ok && accData.success) {
        if (accData.canTrade === true) {
          setTestResult({
            success: true,
            canTrade: true,
            message: isArabic ? 'الاتصال سليم وأذونات التداول مفعلة 100%' : 'Binance Connection Active & Trading Permissions Verified',
            details: isArabic
              ? `تم تحديث الحساب: canTrade = TRUE | السوق: ${accData.accountType || binanceConfig?.marketType || 'FUTURES'} | الرصيد المتاح: $${Number(accData.freeUsdt || 0).toFixed(2)} USDT`
              : `Account verified: canTrade = TRUE | Market: ${accData.accountType || binanceConfig?.marketType || 'FUTURES'} | Free USDT: $${Number(accData.freeUsdt || 0).toFixed(2)}`,
            serverIp,
            latencyMs,
          });
        } else {
          setTestResult({
            success: true,
            canTrade: false,
            message: isArabic ? 'تم الاتصال ولكن أذونات التداول مقيدة (canTrade: FALSE)' : 'Connected, but Trading Permission Restricted (canTrade: FALSE)',
            details: isArabic
              ? 'يرجى تفعيل "Enable Futures" أو "Enable Spot & Margin" في لوحة تحكم بايننس، أو إضافة IP السيرفر للقائمة البيضاء.'
              : 'Enable "Futures" / "Spot & Margin" permissions on Binance or whitelist the server IP.',
            serverIp,
            latencyMs,
          });
        }
      } else {
        setTestResult({
          success: false,
          message: isArabic ? 'فشل الاتصال بحساب بينانس' : 'Binance Connection Failed',
          details: accData.error || accData.hint || (isArabic ? 'تأكد من صحة مفاتيح API واتصال الإنترنت.' : 'Check API keys and server IP whitelist.'),
          serverIp,
          latencyMs,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: isArabic ? 'خطأ أثناء فحص الاتصال' : 'Connection Test Error',
        details: err.message || 'Network error',
      });
    } finally {
      setIsTestingBinance(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!localTgToken || !localTgChatId) {
      setTgFeedback({
        success: false,
        message: isArabic ? 'يرجى إدخال Bot Token و Chat ID أولاً' : 'Please enter both Bot Token and Chat ID',
      });
      return;
    }
    setIsTestingTg(true);
    setTgFeedback(null);
    try {
      const testMsg = `🔔 <b>Quantura Terminal Notification</b>\n\n✅ <b>Status:</b> Telegram Bot Connected Successfully!\n⏱️ <b>Time:</b> ${new Date().toLocaleString()}\n⚡ <b>Engine:</b> Quantitative Scalper & AI Confluence`;
      
      const success = await sendTelegramMessage(localTgToken, localTgChatId, testMsg);
      if (success) {
        setTgFeedback({
          success: true,
          message: isArabic ? 'تم إرسال رسالة الاختبار بنجاح وبشكل فوري إلى تليجرام!' : 'Test message sent instantly to Telegram!',
        });
        if (onTelegramConfigChange) {
          onTelegramConfigChange(localTgToken, localTgChatId);
        }
      } else {
        setTgFeedback({
          success: false,
          message: isArabic ? 'تعذر الإرسال: تأكد من صحة الـ Token و الـ Chat ID أو أرسل /start للبوت أولاً.' : 'Failed: Check Token & Chat ID, or send /start to your bot first.',
        });
      }
    } catch (err: any) {
      setTgFeedback({
        success: false,
        message: isArabic ? 'تعذر الاتصال بـ Telegram API' : 'Failed to reach Telegram API',
      });
    } finally {
      setIsTestingTg(false);
    }
  };

  const handleSaveTelegram = () => {
    const cleanToken = (localTgToken || '').trim();
    const cleanChatId = (localTgChatId || '').trim();
    if (onTelegramConfigChange) {
      onTelegramConfigChange(cleanToken, cleanChatId);
    }
    try {
      apiStorage.setItem('app_telegram_bot_token', cleanToken);
      apiStorage.setItem('app_telegram_chat_id', cleanChatId);
      fetch('/api/config/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken, chatId: cleanChatId }),
      }).catch(console.error);
    } catch {}
    setTgFeedback({
      success: true,
      message: isArabic ? 'تم حفظ إعدادات تليجرام بنجاح!' : 'Telegram settings saved successfully!',
    });
    setTimeout(() => setTgFeedback(null), 3000);
  };

  const sections = [
    {
      id: 'general' as SettingsSection,
      label: isArabic ? 'العام واللغة والتوقيت' : isEn ? 'General & System' : 'Général & Système',
      desc: isArabic ? 'التوقيت، لغة الواجهة، الصوت وشاشة العرض' : isEn ? 'Timezone, Language, Sound, Viewport' : 'Fuseau, Langue, Audio, Affichage',
      icon: Globe,
    },
    {
      id: 'binance' as SettingsSection,
      label: isArabic ? 'ربط بايننس والتداول' : isEn ? 'Binance API & Live' : 'Binance & Réel',
      desc: isArabic ? 'مفاتيح API، الصلاحيات، فحص الاتصال والسيرفر' : isEn ? 'API Keys, Permissions, Connectivity Ping' : 'Clés API, Permissions, Test Serveur',
      icon: Key,
      badge: binanceConfig?.isConnected ? 'ACTIVE' : null,
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    },
    {
      id: 'wallet' as SettingsSection,
      label: isArabic ? 'المحفظة الافتراضية' : isEn ? 'Paper Capital' : 'Capital Virtuel',
      desc: isArabic ? 'رأس مال التداول التجريبي وتعديل الرصيد' : isEn ? 'Simulated trading balance & custom equity' : 'Solde de simulation & gestion du capital',
      icon: Wallet,
    },
    {
      id: 'bot' as SettingsSection,
      label: isArabic ? 'محرك البوت الخوارزمي' : isEn ? 'Bot Engine Presets' : 'Moteur du Bot',
      desc: isArabic ? 'العقود الآجلة، الرافعة، ونموذج المخاطر' : isEn ? 'Futures leverage, risk models & slots' : 'Futures, levier et modèle de risque',
      icon: Bot,
      badge: botConfig?.enabled ? 'BOT ON' : null,
      badgeColor: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30'
    },
    {
      id: 'security' as SettingsSection,
      label: isArabic ? 'الأمان و 2FA' : isEn ? 'Security & 2FA' : 'Sécurité & 2FA',
      desc: isArabic ? 'المصادقة الثنائية، رمز PIN، وجلسة المستخدم' : isEn ? 'Two-Factor TOTP, PIN code, user session' : 'Authentification 2FA, PIN Master, session',
      icon: ShieldCheck,
      badge: is2FAActive ? '2FA ON' : 'PIN OK',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    },
    {
      id: 'notifications' as SettingsSection,
      label: isArabic ? 'التنبيهات وتليجرام' : isEn ? 'Alerts & Telegram' : 'Alertes & Telegram',
      desc: isArabic ? 'إشعارات الصفقات، بوت تليجرام، وحدود الثقة' : isEn ? 'Trade notifications, Telegram alerts, confidence' : 'Alertes push, notifications Telegram, seuils',
      icon: Send,
    },
    {
      id: 'backup' as SettingsSection,
      label: isArabic ? 'النسخ والصيانة' : isEn ? 'Backup & Maintenance' : 'Sauvegarde & Reset',
      desc: isArabic ? 'تصدير واستيراد الإعدادات، وضع المطور وضبط المصنع' : isEn ? 'Export/Import JSON, Developer mode, Factory reset' : 'Export/Import JSON, Mode Dev, Reset usine',
      icon: Download,
    },
  ];

  const currentLeverage = botConfig?.marketType === 'SPOT' ? 1 : (botConfig?.leverage || 3);
  const currentMarginMode = botConfig?.marginMode || 'ISOLATED';
  const currentTimeframe = botConfig?.timeframe || '5m';
  const isAutoAdaptive = botConfig?.autoAdaptiveStrategy ?? true;
  const currentSizingMode = botConfig?.sizingMode || 'FIXED_PERCENT';
  const currentRiskPercent = botConfig?.tradeAllocationPercent || 20;
  const currentMaxTrades = botConfig?.maxOpenTrades || 3;
  const currentAllowedPairs = botConfig?.allowedSymbols || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

  return (
    <div className={`w-full h-full bg-[#070b14] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      
      {/* Main Container */}
      <div className="max-w-full w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-5 relative">
        {/* Ambient Glow */}
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-cyan-500/10 via-amber-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
        
        {/* Mobile-Friendly Horizontal Category Tab Bar */}
        <div className="lg:hidden overflow-x-auto no-scrollbar pb-1">
          <div className="flex items-center gap-1.5 min-w-max bg-[#090e1c] p-1.5 rounded-2xl border border-slate-800/80 shadow-md">
            {sections.map((sec) => {
              const isActive = activeSection === sec.id;
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold font-mono transition flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-md'
                      : 'bg-slate-900/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout Grid: Left Sidebar Categories + Right Main Settings Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column: Category Navigation Menu (4 cols on lg) */}
          <div className="hidden lg:block lg:col-span-4 space-y-2">
            <div className="bg-[#090e1c] border border-slate-800/80 rounded-2xl p-2.5 shadow-xl space-y-1">
              <div className="px-3 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/60 flex items-center justify-between">
                <span>{isArabic ? 'أقسام الإعدادات' : isEn ? 'Settings Categories' : 'Rubriques'}</span>
                <span className="text-[10px] text-cyan-400 font-mono">7 MODULES</span>
              </div>

              <div className="space-y-1 pt-1">
                {sections.map((sec) => {
                  const isActive = activeSection === sec.id;
                  const Icon = sec.icon;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setActiveSection(sec.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 text-left group cursor-pointer ${
                        isActive
                          ? 'bg-cyan-500/15 text-white border border-cyan-500/40 shadow-md shadow-cyan-950/30'
                          : 'bg-slate-900/40 hover:bg-slate-900/80 text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-xl border transition ${
                          isActive
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700/60 group-hover:text-slate-200'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold tracking-wide truncate flex items-center gap-1.5">
                            <span>{sec.label}</span>
                            {sec.badge && (
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border ${sec.badgeColor || 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30'}`}>
                                {sec.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {sec.desc}
                          </div>
                        </div>
                      </div>

                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isArabic ? 'rotate-180' : ''
                      } ${isActive ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Summary Pill Card */}
            <div className="bg-[#090e1c] border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] font-bold">
                <span>{isArabic ? 'ملخص المحرك' : 'Engine Status'}</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500">{isArabic ? 'المحفظة' : 'Wallet'}</div>
                  <div className="font-mono font-bold text-amber-400 text-xs">
                    ${(paperWallet?.balance ?? 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500">{isArabic ? 'الصفقات المفتوحة' : 'Open Slots'}</div>
                  <div className="font-mono font-bold text-cyan-300 text-xs">
                    {activeBotPositions.length} / {botConfig?.maxOpenTrades || 3}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Active Settings Workspace (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* SECTION 1: GENERAL & LOCALIZATION */}
            {activeSection === 'general' && (
              <div key="section-general" className="bg-[#090e1c] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 transition-all duration-150">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {isArabic ? 'إعدادات النظام، التوقيت واللغة' : isEn ? 'General System & Localization' : 'Paramètres Généraux & Localisation'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {isArabic ? 'تخصيص لغة المنصة، التوقيت المرجعي للإشارات، المؤثرات الصوتية وشاشات العرض' : 'Configure interface language, reference timezone, audio alerts and viewport display.'}
                    </p>
                  </div>
                </div>

                {/* Reference Timezone */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <label className="text-sm font-bold text-white">
                        {isArabic ? 'التوقيت الزمني المرجعي' : t.settings?.timezoneTitle || 'Reference Timezone'}
                      </label>
                    </div>
                    <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/30 font-bold">
                      ACTIVE: {timezone}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {isArabic 
                      ? 'يتم تحويل وتوحيد كافة أوقات الشموع، التنبيهات وسجل الصفقات وفقاً لهذا التوقيت.' 
                      : (t.settings?.timezoneDesc || 'All charts, alerts, and trade history timestamps are formatted in this timezone.')}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {[
                      { id: 'GMT+1', title: 'GMT+1 (Maroc / Casablanca)', sub: 'Casablanca, Paris, Madrid' },
                      { id: 'UTC', title: 'UTC (Temps Universel)', sub: 'Binance Standard UTC' },
                      { id: 'LOCAL', title: 'Heure Locale (Système)', sub: 'Heure locale de votre appareil' },
                    ].map((tz) => {
                      const isSelected = timezone === tz.id;
                      return (
                        <button
                          key={tz.id}
                          type="button"
                          onClick={() => {
                            onTimezoneChange(tz.id as TimezoneMode);
                            try {
                              apiStorage.setItem('app_timezone', tz.id);
                            } catch {}
                          }}
                          className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/15 ring-2 ring-amber-500/40'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-bold text-xs">{tz.title}</span>
                            {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0 stroke-[3]" />}
                          </div>
                          <span className="text-[10px] text-slate-400">{tz.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Interface Language */}
                <div className="space-y-3 pt-5 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <label className="text-sm font-bold text-white">
                        {isArabic ? 'لغة الواجهة (Interface Language)' : 'Langue de l\'Interface'}
                      </label>
                    </div>
                    <span className="text-xs font-mono text-cyan-300 uppercase font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {language === 'ar' ? 'العربية' : language === 'fr' ? 'Français' : 'English'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { code: 'ar', label: 'العربية', note: 'واجهة عربية كاملة RTL' },
                      { code: 'fr', label: 'Français', note: 'Interface en Français' },
                      { code: 'en', label: 'English', note: 'Full English Terminal' },
                    ].map((item) => {
                      const isSelected = language === item.code;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => {
                            onLanguageChange(item.code as Language);
                            try {
                              apiStorage.setItem('app_language', item.code);
                            } catch {}
                          }}
                          className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 font-black shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400/40'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <div className="text-sm font-bold flex items-center justify-center gap-1">
                            <span>{item.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{item.note}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sound and Audio Alerts */}
                <div className="space-y-3 pt-5 border-t border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border ${soundEnabled ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{isArabic ? 'المؤثرات الصوتية ونغمات الصفقات' : 'Sons Audio & Alertes Sonores'}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${soundEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                            {soundEnabled ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {isArabic ? 'تشغيل نغمة فورية عند فتح أو إغلاق صفقة أو صدور إشارة قوية' : 'Émettre un signal sonore lors d\'un trade ou nouveau signal.'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={playSoundChime}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold font-mono transition flex items-center gap-1 cursor-pointer active:scale-95"
                        title={isArabic ? 'سماع نغمة الاختبار' : 'Tester le son'}
                      >
                        <Play className="w-3 h-3" />
                        <span>{isArabic ? 'تجربة الصوت' : 'Test Audio'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={onToggleSound}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                          soundEnabled ? 'bg-cyan-500' : 'bg-slate-800'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-slate-950 shadow-md transition-all absolute top-1 ${
                            soundEnabled ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Viewport Display Density Mode */}
                {onChangeDisplayMode && (
                  <div className="space-y-3 pt-5 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-emerald-400" />
                        <label className="text-sm font-bold text-white">
                          {isArabic ? 'كثافة الشاشة ووضع العرض' : 'Mode d\'Affichage & Densité'}
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: 'standard', title: isArabic ? 'قياسي (Fluid)' : 'Standard', desc: isArabic ? 'تناسب شاشات الحواسب والهواتف' : 'Adaptatif complet' },
                        { id: 'compact', title: isArabic ? 'مكثف (Terminal Pro)' : 'Compact Pro', desc: isArabic ? 'كثافة بيانات احترافية للمضاربة' : 'Haute densité d\'informations' },
                        { id: 'fullscreen', title: isArabic ? 'ملء الشاشة' : 'Plein Écran', desc: isArabic ? 'إخفاء عناصر المتصفح' : 'Mode kiosque plein écran' },
                      ].map((dm) => {
                        const isSelected = displayMode === dm.id;
                        return (
                          <button
                            key={dm.id}
                            type="button"
                            onClick={() => onChangeDisplayMode(dm.id as DisplayMode)}
                            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/20 border-emerald-400 text-white font-bold shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                            }`}
                          >
                            <div className="text-xs font-bold text-white flex items-center justify-between">
                              <span>{dm.title}</span>
                              {isSelected && <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">{dm.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: BINANCE API & LIVE TRADING */}
            {activeSection === 'binance' && (
              <div key="section-binance" className="bg-[#090e1c] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 transition-all duration-150">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {isArabic ? 'ربط حساب بايننس الحقيقي (Binance API)' : 'Intégration Binance API & Compte Réel'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {isArabic ? 'إدارة مفاتيح API، اختبار الصلاحيات (canTrade)، وسرعة استجابة السيرفر' : 'Manage Binance API credentials, verify permissions and server connectivity.'}
                    </p>
                  </div>
                </div>

                {/* Connection Status Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/5 border border-amber-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-mono uppercase text-slate-400">
                          {isArabic ? 'حالة التداول الحقيقي' : 'Mode d\'Exécution'}
                        </div>
                        <div className="text-base font-bold text-white flex items-center gap-2">
                          <span>{executionMode === 'BINANCE_LIVE' ? (isArabic ? 'التداول الحقيقي مفعل' : 'Binance Live Actif') : (isArabic ? 'وضع المحاكاة التجريبي (Paper)' : 'Mode Simulation (Paper)')}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border ${
                            binanceConfig?.isConnected
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {binanceConfig?.isConnected ? 'API CONNECTED' : 'DISCONNECTED'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {onOpenBinanceModal && (
                      <button
                        type="button"
                        onClick={onOpenBinanceModal}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95"
                      >
                        <Key className="w-4 h-4" />
                        <span>{isArabic ? 'إدارة وتعديل مفاتيح API' : 'Gérer les clés API'}</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-300">
                    {isArabic 
                      ? '🔒 المفاتيح تخزن بأمان مشفر محلياً في متصفحك أو عبر البروكسي الآمن ولا ترسل لأي طرف خارجي.' 
                      : '🔒 Keys are stored securely in your browser and used only for balance retrieval and authorized trading execution.'}
                  </p>
                </div>

                {/* Direct Connection & Permissions Tester */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-white flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-cyan-400" />
                      <span>{isArabic ? 'فحص الاتصال وتحديث الصلاحيات (Live Connection Ping)' : 'Test Connection & Permission Audit'}</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestBinanceConnection}
                    disabled={isTestingBinance}
                    className="w-full py-3 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 font-mono font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-md active:scale-95"
                  >
                    {isTestingBinance ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                        <span>{isArabic ? 'جاري اختبار الاتصال بحساب بايننس والتحقق من الصلاحيات...' : 'Testing connection and Binance permissions...'}</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 text-cyan-400" />
                        <span>{isArabic ? 'بدء فحص الاتصال وتأكيد الصلاحيات (Test Connection Now)' : 'Run Connection & Permission Audit Now'}</span>
                      </>
                    )}
                  </button>

                  {testResult && (
                    <div className={`p-4 rounded-xl border text-xs font-mono transition-all ${
                      testResult.success && testResult.canTrade
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : testResult.success && !testResult.canTrade
                        ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
                        : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    }`}>
                      <div className="flex items-start gap-3">
                        {testResult.success && testResult.canTrade ? (
                          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                        )}
                        <div className="flex-1 space-y-1.5">
                          <div className="font-bold text-sm flex items-center justify-between">
                            <span>{testResult.message}</span>
                            {testResult.latencyMs && <span className="text-xs text-slate-400">~{testResult.latencyMs}ms</span>}
                          </div>
                          {testResult.details && (
                            <div className="text-xs text-slate-200 opacity-90">{testResult.details}</div>
                          )}
                          {testResult.serverIp && (
                            <div className="text-xs text-cyan-400 font-mono pt-1 border-t border-slate-700/60">
                              Server Outbound IP: {testResult.serverIp}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 3: PAPER WALLET & CAPITAL */}
            {activeSection === 'wallet' && (
              <div key="section-wallet" className="bg-[#090e1c] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 transition-all duration-150">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {isArabic ? 'المحفظة الافتراضية ورأس المال التجريبي' : 'Portefeuille Virtuel (Paper Trading)'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {isArabic ? 'تخصيص رصيد المحفظة التجريبية واختبار استراتيجيات التداول بدون أي مخاطرة' : 'Configure simulated capital to test quantitative strategies risk-free.'}
                    </p>
                  </div>
                </div>

                {/* Capital Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-slate-900 to-teal-500/5 border border-emerald-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-400 font-mono">
                        {isArabic ? 'الرصيد المتاح الحالي (Available Balance)' : 'Solde Virtuel Disponible'}
                      </div>
                      <div className="text-3xl font-black font-mono text-emerald-400 mt-1">
                        ${(paperWallet?.balance ?? 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-emerald-200">USDT</span>
                      </div>
                    </div>

                    {onOpenCustomBalanceModal && (
                      <button
                        type="button"
                        onClick={onOpenCustomBalanceModal}
                        className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer active:scale-95"
                      >
                        <Wallet className="w-4 h-4" />
                        <span>{isArabic ? 'فتح نافذة التخصيص' : 'Modifier le Solde'}</span>
                      </button>
                    )}
                  </div>

                  {/* Inline Direct Balance Changer */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <label className="block text-xs font-bold text-slate-300">
                      {isArabic ? 'أدخل أي رصيد تريده مباشرة واضغط تطبيق:' : 'Saisir un montant personnalisé :'}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="10"
                          step="100"
                          value={customBalanceInput}
                          onChange={(e) => setCustomBalanceInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                          placeholder="Ex: 5000"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">USDT</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCustomBalance}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-md shadow-emerald-500/20"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'تطبيق الرصيد' : 'Appliquer'}</span>
                      </button>
                    </div>

                    {balanceFeedback && (
                      <div className="text-xs text-emerald-400 font-mono font-bold animate-in fade-in">
                        {balanceFeedback}
                      </div>
                    )}
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="pt-2">
                    <div className="text-xs text-slate-400 mb-2">
                      {isArabic ? 'أو اختر رصيداً سريعاً للمحفظة بضغطة واحدة:' : 'Ou choisissez un montant prédéfini :'}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[1000, 5000, 10000, 50000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            if (onUpdatePaperWallet && paperWallet) {
                              onUpdatePaperWallet({ ...paperWallet, balance: amt });
                              setCustomBalanceInput(amt.toString());
                              setBalanceFeedback(isArabic ? `تم ضبط الرصيد على $${amt.toLocaleString()} USDT` : `Balance set to $${amt.toLocaleString()} USDT`);
                              setTimeout(() => setBalanceFeedback(null), 2500);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-center font-mono font-bold text-xs transition cursor-pointer active:scale-95 ${
                            paperWallet?.balance === amt
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          ${amt.toLocaleString()} USDT
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
                  💡 {isArabic 
                    ? 'في وضع المحاكاة (Paper Trading)، يتم فتح وإغلاق الصفقات بأسعار بايننس الحية الفورية (Live Binance Tickers)، مع حساب كامل للربح والخسارة والرافعة المالية دون أي استنزاف لأموال حقيقية.'
                    : 'Simulation trades execute against live real-time Binance prices with real PnL and leverage calculations, without risking real funds.'}
                </div>
              </div>
            )}

            {/* SECTION 4: BOT ENGINE PRESETS (COMPREHENSIVE INSTITUTIONAL CONTROLS) */}
            {activeSection === 'bot' && (
              <div key="section-bot" className="bg-[#090e1c] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 transition-all duration-150">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">
                        {isArabic ? 'إعدادات محرك البوت والتداول الكمي' : 'Moteur du Bot & Paramètres Algorithmiques'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {isArabic ? 'نوع السوق، الرافعة، النوافذ الزمنية، إدارة المخاطر وقائمة الأصول المسموحة' : 'Market engine, leverage, timeframes, risk management, and permitted pairs.'}
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                    botConfig?.enabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {botConfig?.enabled ? 'BOT ACTIVE' : 'BOT IDLE'}
                  </span>
                </div>

                {localBotFeedback && (
                  <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 text-xs font-mono font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{localBotFeedback}</span>
                  </div>
                )}

                {/* 1. Market Engine (Futures vs Spot) */}
                <div className="space-y-3">
                  <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider block">
                    {isArabic ? '1. محرك السوق والتداول (Market Engine)' : '1. Market Engine & Venue'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleBotUpdateWithFeedback({ marketType: 'FUTURES' }, 'تم التحويل إلى سوق USDT-M Futures بنجاح', 'Switched to USDT-M Futures')}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer active:scale-95 ${
                        botConfig?.marketType === 'FUTURES'
                          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/15 ring-1 ring-cyan-500/40'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold text-white flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>USDT-M Futures (عقود آجلة)</span>
                        </span>
                        {botConfig?.marketType === 'FUTURES' && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isArabic ? 'رافعة مالية 1x إلى 50x + صفقات LONG صعود و SHORT هبوط' : 'Leverage 1x-50x + LONG & SHORT positions'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBotUpdateWithFeedback({ marketType: 'SPOT', leverage: 1 }, 'تم التحويل إلى سوق Spot الفوري بنجاح (LONG فقط)', 'Switched to Spot (LONG only)')}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer active:scale-95 ${
                        botConfig?.marketType === 'SPOT'
                          ? 'bg-brand-500/20 border-brand-400 text-white shadow-md shadow-brand-500/15 ring-1 ring-brand-500/40'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold text-white flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Spot 1x (تداول فوري)</span>
                        </span>
                        {botConfig?.marketType === 'SPOT' && <Check className="w-4 h-4 text-brand-400" />}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isArabic ? 'شراء وتملك أصول فقط (LONG فقط) بدون رافعة مالية وبدون تصفية' : 'Direct Spot ownership (LONG only, zero liquidation risk)'}
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Margin Mode & Leverage (Futures Only) */}
                {botConfig?.marketType !== 'SPOT' && (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-mono font-bold text-slate-200">
                          {isArabic ? '2. نظام الهامش والرافعة المالية' : '2. Margin Mode & Leverage Multiplier'}
                        </span>
                      </div>
                      
                      {/* Margin Mode Switch */}
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                        {(['ISOLATED', 'CROSS'] as const).map((mode) => {
                          const isSel = currentMarginMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => handleBotUpdateWithFeedback({ marginMode: mode }, `تم تعيين الهامش: ${mode}`, `Margin Mode: ${mode}`)}
                              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition cursor-pointer active:scale-95 ${
                                isSel
                                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {mode}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Leverage Presets */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">{isArabic ? 'الرافعة المالية الحالية:' : 'Selected Leverage:'}</span>
                        <span className="font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30">
                          {currentLeverage}x
                        </span>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 font-mono text-xs">
                        {[1, 2, 3, 5, 10, 20, 50].map((lev) => {
                          const isSelected = currentLeverage === lev;
                          return (
                            <button
                              key={lev}
                              type="button"
                              onClick={() => handleBotUpdateWithFeedback({ leverage: lev }, `تم ضبط الرافعة على ${lev}x`, `Leverage set to ${lev}x`)}
                              className={`p-2 rounded-xl border text-center font-bold transition cursor-pointer active:scale-95 ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md shadow-amber-500/20'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                              }`}
                            >
                              {lev}x
                            </button>
                          );
                        })}
                      </div>

                      {/* Live Buying Power Calculation Box */}
                      <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">
                          {isArabic ? 'القوة الشرائية لكل $1,000 هامش:' : 'Buying Power per $1,000 Margin:'}
                        </span>
                        <span className="text-cyan-300 font-bold">
                          ${(1000 * currentLeverage).toLocaleString()} USDT
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Strategy Timeframe & Adaptive Engine */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-mono font-bold text-slate-200">
                        {isArabic ? '3. الإطار الزمني ومحرك التكيف الذكي' : '3. Timeframe & Adaptive Engine'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBotUpdateWithFeedback({ autoAdaptiveStrategy: !isAutoAdaptive }, `تم ${!isAutoAdaptive ? 'تفعيل' : 'تعطيل'} التكيف التلقائي`, `Auto-Adaptive ${!isAutoAdaptive ? 'Enabled' : 'Disabled'}`)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer border active:scale-95 ${
                        isAutoAdaptive
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isAutoAdaptive ? 'AUTO ADAPTIVE (مفعل)' : 'MANUAL TIMEFRAME'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">
                    {isArabic 
                      ? 'يقوم محرك Quantura باختيار الإطار الزمني الأمثل تلقائياً وفقاً لتقلبات السوق والسيولة اللحظية.'
                      : 'When AUTO is active, the engine dynamically selects the optimal timeframe based on regime volatility.'}
                  </p>

                  <div className="grid grid-cols-5 gap-2 pt-1 font-mono text-xs">
                    {(['5m', '15m', '30m', '1h', '4h'] as BotTimeframe[]).map((tf) => {
                      const isSel = currentTimeframe === tf;
                      return (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => handleBotUpdateWithFeedback({ timeframe: tf, autoAdaptiveStrategy: false }, `تم تعيين الفريم: ${tf}`, `Timeframe set to ${tf}`)}
                          className={`p-2.5 rounded-xl border text-center font-bold transition cursor-pointer active:scale-95 ${
                            isSel && !isAutoAdaptive
                              ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-md shadow-cyan-500/20'
                              : isSel && isAutoAdaptive
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                          }`}
                        >
                          {tf}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Capital Allocation & Risk Sizing */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-mono font-bold text-slate-200">
                        {isArabic ? '4. حجم المراكز وإدارة رأس المال' : '4. Position Sizing & Capital Allocation'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      {(['FIXED_PERCENT', 'RISK_BASED'] as const).map((sm) => {
                        const isSel = currentSizingMode === sm;
                        return (
                          <button
                            key={sm}
                            type="button"
                            onClick={() => handleBotUpdateWithFeedback({ sizingMode: sm }, `نموذج الحساب: ${sm === 'FIXED_PERCENT' ? 'نسبة ثابتة' : 'مخاطرة ديناميكية'}`, `Sizing: ${sm}`)}
                            className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition cursor-pointer active:scale-95 ${
                              isSel
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {sm === 'FIXED_PERCENT' ? '% FIXED' : 'ATR RISK'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Allocation % */}
                    <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{isArabic ? 'نسبة الهامش لكل صفقة:' : 'Margin Allocation per Trade:'}</span>
                        <span className="font-mono font-bold text-emerald-400">{currentRiskPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        value={currentRiskPercent}
                        onChange={(e) => handleBotUpdateWithFeedback({ tradeAllocationPercent: Number(e.target.value) }, `تم ضبط نسبة الصفقة على ${e.target.value}%`, `Allocation: ${e.target.value}%`)}
                        className="w-full accent-emerald-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Max Open Slots */}
                    <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{isArabic ? 'الحد الأقصى للصفقات المتزامنة:' : 'Max Open Slots:'}</span>
                        <span className="font-mono font-bold text-cyan-300">{currentMaxTrades} صفقات</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={currentMaxTrades}
                        onChange={(e) => handleBotUpdateWithFeedback({ maxOpenTrades: Number(e.target.value) }, `الحد الأقصى: ${e.target.value} صفقات`, `Max Slots: ${e.target.value}`)}
                        className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Allowed Asset Universe */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-mono font-bold text-slate-200">
                        {isArabic ? '5. قائمة العملات المسموحة للتداول الآلي' : '5. Permitted Universe Whitelist'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleBotUpdateWithFeedback({ allowedSymbols: AVAILABLE_PAIRS.map(p => p.symbol) }, 'تم تحديد جميع أزواج المنصة', 'Selected all pairs')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 transition cursor-pointer active:scale-95"
                      >
                        {isArabic ? 'تحديد الكل' : 'Select All'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBotUpdateWithFeedback({ allowedSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'] }, 'تم ضبط أفضل 5 أزواج كبرى', 'Top 5 Majors Selected')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-amber-300 transition cursor-pointer active:scale-95"
                      >
                        {isArabic ? 'أهم 5' : 'Top 5'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                    {AVAILABLE_PAIRS.map((pair) => {
                      const isChecked = currentAllowedPairs.includes(pair.symbol);
                      return (
                        <button
                          key={pair.symbol}
                          type="button"
                          onClick={() => handleTogglePairSelection(pair.symbol)}
                          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer active:scale-95 ${
                            isChecked
                              ? 'bg-cyan-500/15 border-cyan-500/40 text-white shadow-sm'
                              : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-mono font-bold text-slate-100">{pair.symbol}</div>
                            <div className="text-[10px] text-slate-400">{pair.name}</div>
                          </div>
                          <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isChecked ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-700 bg-slate-900'
                          }`}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Jump to Full Auto Trading Bot Tab */}
                {onNavigateTab && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('autoBot')}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-teal-500/20 hover:from-cyan-500/30 hover:to-teal-500/30 border border-cyan-500/40 text-cyan-200 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md active:scale-95"
                    >
                      <Bot className="w-4 h-4 text-cyan-300" />
                      <span>{isArabic ? 'فتح لوحة تحكم البوت الشاملة (Live Terminal Engine)' : 'Open Full Bot Live Control Terminal'}</span>
                      <ChevronRight className={`w-4 h-4 ${isArabic ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 5: SECURITY & 2FA */}
            {activeSection === 'security' && (
              <div key="section-security" className="bg-[#090e1c] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 transition-all duration-150">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {isArabic ? 'الأمان، المصادقة الثنائية ورمز PIN' : 'Sécurité, Authentification 2FA & PIN Master'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {isArabic ? 'تأمين تسجيل الدخول، رمز التحقق الرئيسي 6 أرقام وتطبيقات Google/Microsoft Authenticator' : 'Two-Factor TOTP authentication, 6-digit Master PIN, and secure sessions.'}
                    </p>
                  </div>
                </div>

                {/* 2FA Master Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-slate-900 to-teal-500/5 border border-emerald-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-mono uppercase text-slate-400">
                          {isArabic ? 'المصادقة الثنائية (Two-Factor Authentication)' : 'Statut de Protection'}
                        </div>
                        <div className="text-base font-bold text-white flex items-center gap-2">
                          <span>{is2FAActive ? (isArabic ? 'المصادقة الثنائية مفعلة' : '2FA Active') : (isArabic ? 'المصادقة الثنائية معطلة' : '2FA Désactivée')}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${is2FAActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                            {is2FAActive ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggle2FAState(!is2FAActive)}
                        className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer active:scale-95 ${
                          is2FAActive
                            ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                        }`}
                      >
                        {is2FAActive ? (isArabic ? 'تعطيل 2FA' : 'Désactiver') : (isArabic ? 'تفعيل 2FA' : 'Activer 2FA')}
                      </button>

                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-mono">TOTP TIMER</div>
                        <div className="text-sm font-mono font-bold text-cyan-300">
                          {totpCountdown}s
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Master PIN Box */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">
                        {isArabic ? 'رمز التحقق الثنائي الرئيسي (Master 2FA PIN):' : 'Code PIN Master de Sécurité :'}
                      </span>
                      <span className="font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 text-sm tracking-wider">
                        {apiStorage.getItem('app_2fa_master_pin') || '272270'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {isArabic 
                        ? '🔒 عند تسجيل الدخول أو فتح التطبيق من متصفح جديد، يتطلب النظام إدخال هذا الرمز أو رمز TOTP لتأكيد هويتك.' 
                        : '🔒 Required upon login from any new browser or session to guarantee unauthorized access prevention.'}
                    </p>
                  </div>

                  {/* Interactive PIN / TOTP Code Test Tool */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    <label className="block text-xs font-bold text-slate-300">
                      {isArabic ? 'تجربة واختبار رمز 2FA أو Master PIN الآن:' : 'Tester votre code 2FA ou PIN Master :'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={testPinInput}
                        onChange={(e) => setTestPinInput(e.target.value)}
                        placeholder="Ex: 272270"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm tracking-widest text-center focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyTestPin}
                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer active:scale-95 shadow-md shadow-cyan-500/20"
                      >
                        {isArabic ? 'تحقق' : 'Vérifier'}
                      </button>
                    </div>
                  </div>

                  {/* TOTP Secret & QR Code Actions */}
                  <div className="space-y-2 pt-2">
                    <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                      <span className="text-slate-400 font-mono">{isArabic ? 'المفتاح السري (Secret Key):' : 'Secret Key (TOTP):'}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleCopyKey}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] flex items-center gap-1 transition cursor-pointer active:scale-95"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedKey ? (isArabic ? 'تم النسخ!' : 'Copié !') : (isArabic ? 'نسخ' : 'Copier')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenQR}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-mono text-[10px] flex items-center gap-1 transition cursor-pointer active:scale-95"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>{isArabic ? 'عرض QR Code' : 'Voir QR'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRegenerateKey}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-mono text-[10px] flex items-center gap-1 transition cursor-pointer active:scale-95"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{isArabic ? 'تجديد' : 'Nouveau'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 break-all select-all">
                      {setupKey2FA}
                    </div>

                    {totpFeedback && (
                      <div className={`text-xs font-mono font-bold animate-in fade-in p-2.5 rounded-lg border ${
                        testPinResult === 'INVALID' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      }`}>
                        {totpFeedback}
                      </div>
                    )}
                  </div>
                </div>

                {/* User Session Details */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{isArabic ? 'جلسة الحساب النشطة' : 'Session Active'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">jawman27227@gmail.com</div>
                      </div>
                    </div>

                    {onLogout && (
                      <button
                        type="button"
                        onClick={onLogout}
                        className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold font-mono transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-400" />
                        <span>{isArabic ? 'تسجيل الخروج' : 'Déconnexion'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 6: NOTIFICATIONS & TELEGRAM */}
            {activeSection === 'notifications' && (
              <div key="section-notifications" className="bg-[#090e1c] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 transition-all duration-150">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {isArabic ? 'التنبيهات وتكامل تليجرام (Telegram Alerts)' : 'Notifications & Intégration Telegram'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {isArabic ? 'استقبال إشعارات الصفقات المباشرة وتنبيهات أهداف TP/SL على حسابك في تليجرام' : 'Receive instant trade signals, entries, and TP/SL hits directly on Telegram.'}
                    </p>
                  </div>
                </div>

                {/* Push Notifications Toggle */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${notificationsEnabled ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                      {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        {isArabic ? 'إشعارات المتصفح المنبثقة (In-App Toast Alerts)' : 'Alertes Push & Popups'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {isArabic ? 'إظهار نوافذ منبثقة عند صدور إشارة كمية جديدة أو تنفيذ صفقة' : 'Afficher des notifications visuelles en direct dans l\'interface.'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleNotifications}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      notificationsEnabled ? 'bg-amber-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-slate-950 shadow-md transition-all absolute top-1 ${
                        notificationsEnabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Minimum Confidence Slider */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>{isArabic ? 'حد الثقة الأدنى للتنبيهات (%)' : 'Seuil Minimal de Confiance'}</span>
                    </label>
                    <span className="font-mono font-bold text-cyan-300 text-xs bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {minConfidenceThreshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={minConfidenceThreshold}
                    onChange={(e) => onConfidenceChange(Number(e.target.value))}
                    className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>50% (Tous Signaux)</span>
                    <span>70% (Standard)</span>
                    <span>85%+ (Haute Probabilité)</span>
                  </div>
                </div>

                {/* Telegram Bot Setup */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-slate-900 to-cyan-500/5 border border-blue-500/30 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Send className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-bold text-white">
                      {isArabic ? 'إعدادات بوت تليجرام (Telegram Bot Configuration)' : 'Paramètres du Bot Telegram'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {isArabic 
                      ? 'أنشئ بوتاً عبر @BotFather واحصل على Token، ثم أرسل رسالة للبوت واستخرج Chat ID الخاص بك.'
                      : 'Créez un bot avec @BotFather pour obtenir le Token, puis entrez votre Chat ID pour recevoir les alertes.'}
                  </p>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="telegram_bot_token_input" className="block text-xs font-bold text-slate-300">
                          Telegram Bot Token
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowTgToken(!showTgToken)}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition select-none"
                        >
                          {showTgToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showTgToken ? (isArabic ? 'إخفاء' : 'Masquer') : (isArabic ? 'إظهار' : 'Afficher')}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="telegram_bot_token_input"
                          name="telegram_bot_token_input"
                          type={showTgToken ? 'text' : 'password'}
                          placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                          value={localTgToken || ''}
                          onChange={(e) => setLocalTgToken(e.target.value)}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          data-lpignore="true"
                          data-1p-ignore="true"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="telegram_chat_id_input" className="block text-xs font-bold text-slate-300 mb-1">
                        Telegram Chat ID
                      </label>
                      <input
                        id="telegram_chat_id_input"
                        name="telegram_chat_id_input"
                        type="text"
                        placeholder="123456789 ou -100123456789"
                        value={localTgChatId || ''}
                        onChange={(e) => setLocalTgChatId(e.target.value)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSaveTelegram}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-blue-500/20 active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'حفظ إعدادات تليجرام' : 'Enregistrer'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isTestingTg}
                        onClick={handleTestTelegram}
                        className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 active:scale-95"
                      >
                        {isTestingTg ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{isArabic ? 'إرسال رسالة تجريبية' : 'Test Telegram'}</span>
                      </button>
                    </div>

                    {tgFeedback && (
                      <div className={`p-3 rounded-xl text-xs font-mono border ${
                        tgFeedback.success 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}>
                        {tgFeedback.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 7: BACKUP, EXPORT & MAINTENANCE */}
            {activeSection === 'backup' && (
              <div key="section-backup" className="bg-[#090e1c] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 transition-all duration-150">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {isArabic ? 'النسخ الاحتياطي، تصدير الإعدادات وضبط المصنع' : 'Sauvegarde, Exportation JSON & Maintenance'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {isArabic ? 'تصدير كامل إعدادات واستراتيجيات البوت، استيرادها كملف، أو إعادة ضبط المصنع' : 'Export and import configurations, enable developer mode or perform a complete reset.'}
                    </p>
                  </div>
                </div>

                {/* Export & Import JSON */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-white">
                      {isArabic ? 'تصدير / استيراد ملف الإعدادات (JSON Config)' : 'Sauvegarder & Transférer la Configuration'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {isArabic 
                      ? 'يمكنك حفظ نسخة احتياطية من جميع إعداداتك واستراتيجياتك ومشاركتها مع أجهزة أخرى بسهولة.' 
                      : 'Export your strategy parameters, bot preferences, and settings as a portable JSON file.'}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => exportConfigToJson()}
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold font-mono transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
                    >
                      <Download className="w-4 h-4 text-amber-400" />
                      <span>{isArabic ? 'تصدير ملف (Export JSON)' : 'Exporter (JSON)'}</span>
                    </button>

                    <label className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold font-mono transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95">
                      <Upload className="w-4 h-4 text-cyan-400" />
                      <span>{isArabic ? 'استيراد ملف (Import JSON)' : 'Importer (JSON)'}</span>
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            importConfigFromJson(
                              file,
                              () => {
                                alert(isArabic ? 'تم استيراد الإعدادات بنجاح. سيتم إعادة تحميل المنصة.' : 'Configuration imported successfully. App will reload.');
                                window.location.reload();
                              },
                              (err) => {
                                alert(isArabic ? `فشل الاستيراد: ${err}` : `Import failed: ${err}`);
                              }
                            );
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Developer Mode Toggle */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <div>
                        <span className="text-sm font-bold text-white">
                          {isArabic ? 'وضع المطور والاختبار (Developer Test Mode)' : 'Mode Développeur (Données Test)'}
                        </span>
                        <div className="text-xs text-slate-400">
                          {isArabic ? 'محاكاة حركة الأسعار والإشارات محلياً دون انتظار كاندلات السوق' : 'Simulation locale hors-ligne pour le développement.'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleDeveloperMode(!isDeveloperMode)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        isDeveloperMode ? 'bg-amber-500' : 'bg-slate-800'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-slate-950 shadow-md transition-all absolute top-1 ${
                          isDeveloperMode ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Factory Reset Danger Zone */}
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Trash2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-bold text-rose-300">
                          {isArabic ? 'منطقة الخطر: إعادة ضبط المصنع ومسح البيانات' : 'Zone Critique : Réinitialisation Totale'}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5">
                          {isArabic 
                            ? 'إرجاع كافة الإعدادات والصفقات ومحفظة المحاكاة إلى الوضع الافتراضي النظيف (1,000 USDT).'
                            : 'Remet à zéro l\'historique des trades, les alertes et réinitialise le solde à 1 000 USDT.'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0 shadow-md shadow-rose-950/50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isArabic ? 'إعادة الضبط' : 'Réinitialiser'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* QR Code Modal for 2FA */}
      {showQRModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090e1c] border border-cyan-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span>{isArabic ? 'مسح رمز 2FA QR Code' : 'Scan 2FA QR Code'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {setupQR2FA ? (
              <div className="p-3 bg-white rounded-xl inline-block shadow-lg mx-auto">
                <img src={setupQR2FA} alt="2FA QR Code" className="w-48 h-48 mx-auto" />
              </div>
            ) : (
              <div className="py-12 text-xs text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
                Generating QR Code...
              </div>
            )}

            <p className="text-xs text-slate-400 leading-relaxed">
              {isArabic 
                ? 'امسح هذا الرمز باستخدام تطبيق Google Authenticator أو Authy لإضافة حساب Quantura.' 
                : 'Scan this code with Google Authenticator or Authy to connect your account.'}
            </p>

            <button
              type="button"
              onClick={() => setShowQRModal(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer active:scale-95"
            >
              {isArabic ? 'إغلاق' : 'Fermer'}
            </button>
          </div>
        </div>
      )}

      {/* Factory Reset Double Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#090e1c] border border-rose-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-300">
                  {isArabic ? 'تأكيد إعادة ضبط المصنع الكاملة؟' : 'Confirmer la Réinitialisation Complète ?'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isArabic 
                    ? 'سيتم مسح جميع الصفقات المفتوحة، التاريخ، مفاتيح بايننس المخزنة محلياً وإرجاع المحفظة إلى 1,000 USDT. هذا الإجراء لا يمكن التراجع عنه.'
                    : 'All trade history, local keys and cache will be reset. Paper wallet balance will be restored to 1,000 USDT.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
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
                  } catch (e) {
                    console.error('Reset failed', e);
                  } finally {
                    setIsResetting(false);
                    setShowResetConfirm(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-rose-950/60 active:scale-95"
              >
                {isResetting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isArabic ? 'نعم، مسح كل شيء' : 'Oui, Réinitialiser'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SettingsView = React.memo(SettingsViewComponent);
