import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  ShieldCheck,
  DollarSign,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Wallet,
  Play,
  Pause,
  Server,
  Activity,
  Flame,
  Check,
} from 'lucide-react';
import {
  Language,
  BinanceApiConfig,
  BinanceAccountInfo,
  TradingExecutionMode,
  PaperWallet,
} from '../types';
import { translations } from '../utils/translations';

interface BinanceConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  binanceConfig?: BinanceApiConfig;
  config?: BinanceApiConfig;
  executionMode?: TradingExecutionMode;
  paperWallet?: PaperWallet;
  onSaveConfig: (config: BinanceApiConfig) => void;
  onToggleExecutionMode?: (mode: TradingExecutionMode) => void;
  onToggleMode?: (mode: TradingExecutionMode) => void;
  currentPrice?: number;
  selectedSymbol?: string;
  currentSymbol?: string;
  onExecuteManualBinanceOrder?: (side: 'BUY' | 'SELL', quoteAmountUsdt: number) => Promise<{ success: boolean; message: string }>;
  onExecuteManualTrade?: (side: 'BUY' | 'SELL', quoteAmountUsdt: number) => Promise<{ success: boolean; message: string }>;
}

const DEFAULT_BINANCE_CONFIG: BinanceApiConfig = {
  apiKey: '',
  apiSecret: '',
  useTestnet: false,
  isLiveModeEnabled: false,
  isConnected: false,
  accountInfo: null,
  autoTradingEnabled: false,
};

export const BinanceConnectionModal: React.FC<BinanceConnectionModalProps> = ({
  isOpen,
  onClose,
  language,
  binanceConfig: propBinanceConfig,
  config: propConfig,
  executionMode = 'PAPER',
  paperWallet,
  onSaveConfig,
  onToggleExecutionMode,
  onToggleMode,
  currentPrice = 0,
  selectedSymbol: propSelectedSymbol,
  currentSymbol: propCurrentSymbol,
  onExecuteManualBinanceOrder,
  onExecuteManualTrade,
}) => {
  const activeBinanceConfig = propBinanceConfig || propConfig || DEFAULT_BINANCE_CONFIG;
  const activeSymbol = propSelectedSymbol || propCurrentSymbol || 'BTCUSDT';
  const handleToggleModeFn = onToggleExecutionMode || onToggleMode || (() => {});
  const handleManualOrderFn = onExecuteManualBinanceOrder || onExecuteManualTrade;

  const isArabic = language === 'ar';
  const isEn = language === 'en';

  const [apiKey, setApiKey] = useState(activeBinanceConfig.apiKey || '');
  const [apiSecret, setApiSecret] = useState(activeBinanceConfig.apiSecret || '');
  const [useTestnet, setUseTestnet] = useState(activeBinanceConfig.useTestnet || false);
  const [marketType, setMarketType] = useState<'SPOT' | 'FUTURES'>(activeBinanceConfig.marketType || 'SPOT');
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    accountInfo?: BinanceAccountInfo;
    latencyMs?: number;
  } | null>(null);

  const [modeError, setModeError] = useState<string | null>(null);
  const [showRealMoneyConfirm, setShowRealMoneyConfirm] = useState(false);
  const [manualOrderAmount, setManualOrderAmount] = useState('15');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(activeBinanceConfig.apiKey || '');
      setApiSecret(activeBinanceConfig.apiSecret || '');
      setUseTestnet(activeBinanceConfig.useTestnet || false);
      setMarketType(activeBinanceConfig.marketType || 'SPOT');
      setTestResult(null);
      setModeError(null);
      setOrderFeedback(null);

      // Auto-refresh account status and live balance on modal open
      fetch('/api/binance/account')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const accountInfo: BinanceAccountInfo = {
              canTrade: data.canTrade,
              canWithdraw: data.canWithdraw,
              canDeposit: data.canDeposit,
              accountType: data.accountType,
              makerCommission: data.makerCommission,
              takerCommission: data.takerCommission,
              updateTime: data.updateTime,
              balances: data.balances,
              totalUsdtEquity: data.totalUsdtEquity,
              freeUsdt: data.freeUsdt,
            };
            setTestResult({
              success: true,
              message: isArabic
                ? `الحساب متصل بنجاح مع بايننس (${data.marketType || 'SPOT'}) | الاستجابة: ${data.latencyMs}ms`
                : isEn
                ? `Account connected with Binance (${data.marketType || 'SPOT'}) | Latency: ${data.latencyMs}ms`
                : `Compte connecté à Binance (${data.marketType || 'SPOT'}) | Latence : ${data.latencyMs}ms`,
              accountInfo,
              latencyMs: data.latencyMs,
            });
            onSaveConfig({
              ...activeBinanceConfig,
              isConnected: true,
              accountInfo,
              marketType: data.marketType || activeBinanceConfig.marketType,
            });
          }
        })
        .catch(() => {});
    }
  }, [isOpen, activeBinanceConfig.isConnected]);

  if (!isOpen) return null;

  const handleTestAndSave = async (autoSave: boolean = true) => {
    const hasInputKeys = Boolean(apiKey.trim() && apiSecret.trim());
    if (!hasInputKeys && !activeBinanceConfig.isConnected) {
      setTestResult({
        success: false,
        message: isArabic
          ? 'يرجى إدخال كل من API Key و Secret Key الكاملين'
          : isEn
          ? 'Please enter both full unmasked API Key and Secret Key'
          : 'Veuillez saisir votre API Key et votre Secret Key complets.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const payload: any = {
        useTestnet,
        marketType,
      };

      if (hasInputKeys) {
        payload.apiKey = apiKey.trim();
        payload.apiSecret = apiSecret.trim();
      }

      const response = await fetch('/api/binance/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const accountInfo: BinanceAccountInfo = {
          canTrade: data.canTrade,
          canWithdraw: data.canWithdraw,
          canDeposit: data.canDeposit,
          accountType: data.accountType,
          makerCommission: data.makerCommission,
          takerCommission: data.takerCommission,
          updateTime: data.updateTime,
          balances: data.balances,
          totalUsdtEquity: data.totalUsdtEquity,
          freeUsdt: data.freeUsdt,
        };

        const updatedConfig: BinanceApiConfig = {
          ...activeBinanceConfig,
          apiKey: hasInputKeys ? apiKey.trim() : activeBinanceConfig.apiKey,
          apiSecret: '',
          useTestnet,
          marketType: data.marketType || marketType,
          isConnected: true,
          lastConnectedAt: Date.now(),
          latencyMs: data.latencyMs,
          accountInfo,
          isLiveModeEnabled: executionMode === 'BINANCE_LIVE',
        };

        setTestResult({
          success: true,
          message: isArabic
            ? `تم الاتصال بنجاح مع بايننس (${data.marketType || marketType})! الاستجابة: ${data.latencyMs}ms | الرصيد المتاح: $${(data.freeUsdt || 0).toFixed(2)} USDT`
            : isEn
            ? `Connected successfully to Binance (${data.marketType || marketType})! Latency: ${data.latencyMs}ms | Free: $${(data.freeUsdt || 0).toFixed(2)} USDT`
            : `Connexion réussie à Binance (${data.marketType || marketType}) ! Latence : ${data.latencyMs}ms | Libre : $${(data.freeUsdt || 0).toFixed(2)} USDT`,
          accountInfo,
          latencyMs: data.latencyMs,
        });

        if (autoSave && hasInputKeys) {
          // Securely save credentials on the backend
          fetch('/api/config/binance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: apiKey.trim(),
              apiSecret: apiSecret.trim(),
              useTestnet,
              marketType: data.marketType || marketType,
            })
          }).catch(console.error);
        }
        
        // Pass full updated config with account info back to App
        onSaveConfig(updatedConfig);
      } else {
        setTestResult({
          success: false,
          message: data.error || (isArabic ? 'فشل الاتصال بـ Binance API' : 'Échec de connexion à Binance API'),
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || (isArabic ? 'حدث خطأ أثناء الاتصال' : 'Erreur de connexion réseau'),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearCredentials = () => {
    fetch('/api/config/binance', { method: 'DELETE' }).catch(console.error);
    setApiKey('');
    setApiSecret('');
    const clearedConfig: BinanceApiConfig = {
      apiKey: '',
      apiSecret: '',
      useTestnet: false,
      isLiveModeEnabled: false,
      isConnected: false,
      accountInfo: null,
      autoTradingEnabled: false,
    };
    onSaveConfig(clearedConfig);
    handleToggleModeFn('PAPER');
    setTestResult(null);
  };

  const handleToggleModeRequest = (newMode: TradingExecutionMode) => {
    setModeError(null);
    if (newMode === 'BINANCE_LIVE') {
      if (!activeBinanceConfig.isConnected || !activeBinanceConfig.apiKey) {
        setModeError(
          isArabic
            ? 'يجب اختبار وتأكيد الاتصال بـ Binance API أولاً من الأسفل قبل تفعيل التداول الحقيقي!'
            : 'Veuillez d\'abord configurer et tester vos clés API Binance (en bas) avant d\'activer le mode Réel !'
        );
        return;
      }
      setShowRealMoneyConfirm(true);
    } else {
      handleToggleModeFn('PAPER');
      setShowRealMoneyConfirm(false);
      onSaveConfig({ ...activeBinanceConfig, isLiveModeEnabled: false });
    }
  };

  const confirmEnableLiveTrading = () => {
    handleToggleModeFn('BINANCE_LIVE');
    setShowRealMoneyConfirm(false);
    onSaveConfig({ ...activeBinanceConfig, isLiveModeEnabled: true });
  };

  const handleQuickManualOrder = async (side: 'BUY' | 'SELL') => {
    const amount = parseFloat(manualOrderAmount);
    if (!amount || amount < 10) {
      setOrderFeedback({
        success: false,
        text: isArabic ? 'الحد الأدنى لصفقات بايننس هو 10$ USDT' : 'Montant minimum Binance : 10$ USDT',
      });
      return;
    }

    if (!handleManualOrderFn) return;

    setIsOrdering(true);
    setOrderFeedback(null);
    try {
      const res = await handleManualOrderFn(side, amount);
      setOrderFeedback({
        success: res.success,
        text: res.message,
      });
      if (res.success) {
        // Refresh account balance
        handleTestAndSave(true);
      }
    } catch (e: any) {
      setOrderFeedback({
        success: false,
        text: e.message || 'Order failed',
      });
    } finally {
      setIsOrdering(false);
    }
  };

  const activeAccount = testResult?.accountInfo || activeBinanceConfig.accountInfo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className={`bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col ${
          isArabic ? 'rtl text-right' : 'ltr'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl transition-colors ${
              executionMode === 'BINANCE_LIVE' || activeBinanceConfig.isConnected
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40 shadow-md shadow-brand-500/10'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/25 shadow-md shadow-amber-500/10'
            }`}>
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base sm:text-lg">
                  {isArabic ? 'إعدادات وربط Binance API' : isEn ? 'Binance API Integration & Live Bot' : 'Intégration Binance API & Trading Réel'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    activeBinanceConfig.isConnected
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {activeBinanceConfig.isConnected
                    ? (isArabic ? 'متصل' : 'CONNECTED')
                    : (isArabic ? 'غير متصل' : 'DISCONNECTED')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isArabic
                  ? 'ربط مباشر لتنفيذ صفقات البوت الذكي على حسابك في بايننس'
                  : isEn
                  ? 'Direct API integration to execute bot trades on your Binance account'
                  : 'Exécution automatique des signaux d\'achat/vente sur votre compte Binance'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 font-sans">
          {/* 1. Mode Switcher (Paper vs Live) */}
          <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                {isArabic ? 'وضع تنفيذ التداول (Execution Mode)' : isEn ? 'Execution Mode' : 'Mode d\'Exécution'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {executionMode === 'BINANCE_LIVE' ? 'LIVE REAL MONEY' : 'SIMULATED PAPER'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <button
                onClick={() => handleToggleModeRequest('PAPER')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition ${
                  executionMode === 'PAPER'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{isArabic ? 'تداول تجريبي (Paper Trading)' : isEn ? 'Paper Trading (Simulated)' : 'Paper Trading (Virtuel)'}</span>
              </button>

              <button
                onClick={() => handleToggleModeRequest('BINANCE_LIVE')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition ${
                  executionMode === 'BINANCE_LIVE'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-lg shadow-rose-500/10 animate-pulse'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Flame className="w-4 h-4 text-rose-400" />
                <span>{isArabic ? 'حساب حقيقي (Binance Live)' : isEn ? 'Real Account (Binance Live)' : 'Compte Réel (Binance Live)'}</span>
              </button>
            </div>

            {executionMode === 'BINANCE_LIVE' && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {isArabic ? 'تنبيه: التداول الحقيقي مفعل بالأموال الحقيقية!' : isEn ? 'Warning: Live Real-Money Trading is Active!' : 'Attention : Le Trading Réel est Actif !'}
                  </p>
                  <p className="text-[11px] text-rose-300/80 mt-0.5">
                    {isArabic
                      ? 'عندما يصدر البوت إشارة مؤكدة (BUY/SELL)، سيتم إرسال أمر فوري حقيقي إلى حسابك في بايننس.'
                      : isEn
                      ? 'When the bot issues confirmed signals (BUY/SELL), real market orders will execute on your Binance account.'
                      : 'Les signaux validés par le bot exécuteront des ordres réels sur votre compte Binance.'}
                  </p>
                </div>
              </div>
            )}

            {modeError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="font-bold leading-relaxed">{modeError}</p>
              </div>
            )}
          </div>

          {/* 1.5 Dynamic Balance Source Switcher Overview */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {isArabic ? 'مقارنة الأرصدة والمصدر النشط للتداول' : isEn ? 'Balance Overview (Paper vs Live)' : 'Aperçu des Soldes (Paper vs Live)'}
                </span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                executionMode === 'BINANCE_LIVE' 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {executionMode === 'BINANCE_LIVE' ? 'LIVE BINANCE ACTIVE' : 'PAPER WALLET ACTIVE'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Paper Wallet Card */}
              <div className={`p-3.5 rounded-xl border transition ${
                executionMode === 'PAPER'
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-900/60 border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isArabic ? 'رصيد الورقة المالية (Paper)' : isEn ? 'Paper Wallet Balance' : 'Solde Virtuel (Paper)'}</span>
                  </span>
                  {executionMode === 'PAPER' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded uppercase">
                      {isArabic ? 'نشط' : isEn ? 'Active' : 'Actif'}
                    </span>
                  )}
                </div>
                <div className="text-base font-black font-mono text-emerald-400">
                  ${(paperWallet?.balance ?? 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-500 font-sans">USDT</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-sans">
                  {isArabic ? 'أموال محاكاة تجريبية بدون مخاطرة' : isEn ? 'Risk-free simulated balance' : 'Fonds virtuels de simulation'}
                </div>
              </div>

              {/* Live Binance Wallet Card */}
              <div className={`p-3.5 rounded-xl border transition ${
                executionMode === 'BINANCE_LIVE'
                  ? 'bg-rose-500/10 border-rose-500/50 shadow-md shadow-rose-500/10'
                  : 'bg-slate-900/60 border-slate-800 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    <span>{isArabic ? 'رصيد بايننس الحقيقي (Live)' : isEn ? 'Binance Live Balance' : 'Solde Binance Réel (Live)'}</span>
                  </span>
                  {executionMode === 'BINANCE_LIVE' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded uppercase">
                      {isArabic ? 'نشط' : isEn ? 'Active' : 'Actif'}
                    </span>
                  )}
                </div>
                <div className="text-base font-black font-mono text-white">
                  ${(activeAccount?.freeUsdt ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-500 font-sans">USDT {isArabic ? 'متاح' : isEn ? 'Free' : 'Libre'}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-sans flex items-center justify-between">
                  <span>Total: ${(activeAccount?.totalUsdtEquity ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={activeBinanceConfig.isConnected ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {activeBinanceConfig.isConnected ? (isArabic ? '● متصل' : isEn ? '● Connected' : '● Connecté') : (isArabic ? '○ غير متصل' : isEn ? '○ Not Connected' : '○ Non Connecté')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTestAndSave(false)}
                      disabled={isTesting}
                      className="p-1 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700 transition"
                      title={isArabic ? 'تحديث الرصيد فوراً' : 'Actualiser le solde'}
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${isTesting ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* VPS / SSH Verification Guide */}
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span className="flex items-center gap-1.5 font-bold text-slate-200">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isArabic ? 'فحص الاتصال عبر SSH / السيرفر' : 'Vérification via SSH / VPS'}</span>
              </span>
              <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                curl localhost:3000
              </span>
            </div>
            <div className="bg-black/60 p-2 rounded text-[10px] text-slate-300 select-all overflow-x-auto border border-slate-800/80">
              <code>curl -s http://localhost:3000/api/binance/account</code>
            </div>
            <p className="text-[10px] text-slate-400 font-sans">
              {isArabic
                ? 'إذا أدخلت المفاتيح في ملف .env بالخادم، شغّل الأمر أعلاه عبر SSH للتحقق المباشر من الاتصال والرصيد.'
                : 'Si vous avez configuré vos clés dans le fichier .env de votre VPS, exécutez la commande ci-dessus en SSH pour tester le compte.'}
            </p>
          </div>

          {/* 2. Security Best Practices Box */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>{isArabic ? 'إرشادات الأمان الموصى بها لمفاتيح API' : isEn ? 'API Key Security & Permissions' : 'Sécurité & Permissions de vos Clés API'}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
              <li>
                <strong className="text-white">{isArabic ? 'تعطيل السحب (Disable Withdrawals):' : isEn ? 'Disable Withdrawals:' : 'Désactiver les Retraits :'}</strong>{' '}
                {isArabic
                  ? 'تأكد من عدم تفعيل صلاحية السحب في إعدادات بايننس. اترك فقط صلاحية Spot Trading.'
                  : isEn
                  ? 'Never enable Withdrawals in Binance API settings. Only allow Spot / Futures Trading.'
                  : 'Ne cochez jamais "Enable Withdrawals". Autorisez uniquement "Enable Spot Trading".'}
              </li>
              <li>
                <strong className="text-white">{isArabic ? 'تشفير الخادم:' : isEn ? 'Server-side Security:' : 'Sécurité Serveur :'}</strong>{' '}
                {isArabic
                  ? 'يتم توقيع الأوامر عبر HMAC-SHA256 من الخادم الخلفي بشكل آمن ومحمي.'
                  : isEn
                  ? 'All HMAC-SHA256 signatures are securely generated on the backend server.'
                  : 'Toutes les signatures HMAC-SHA256 sont générées côté serveur de manière sécurisée.'}
              </li>
            </ul>
          </div>

          {/* 3. API Key & Secret Form */}
          <div className="space-y-4 font-mono text-xs">
            {/* Market type selection (SPOT vs FUTURES) */}
            <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-400" />
                <span className="text-slate-300 font-bold">
                  {isArabic ? 'سوق التداول' : isEn ? 'Trading Market' : 'Marché de Trading'}
                </span>
              </div>
              <div className="flex bg-slate-800/80 rounded-lg p-1">
                <button
                  onClick={() => setMarketType('SPOT')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    marketType === 'SPOT' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  SPOT
                </button>
                <button
                  onClick={() => setMarketType('FUTURES')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    marketType === 'FUTURES' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  USDT-M FUTURES
                </button>
              </div>
            </div>

            {/* Network mode toggle (Testnet vs Mainnet) */}
            <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300 font-bold">
                  {isArabic ? 'شبكة الاختبار (Testnet Sandbox)' : isEn ? 'Use Binance Testnet Sandbox' : 'Utiliser Binance Testnet'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useTestnet}
                  onChange={(e) => setUseTestnet(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold flex items-center justify-between">
                <span>Binance API Key:</span>
                <span className="text-[10px] text-slate-500 font-sans">
                  {isArabic ? 'المفتاح العام' : isEn ? 'Public Key' : 'Clé Publique'}
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. vmPUZE6mv9SD5VNHk4Hl..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition text-xs font-mono"
                />
              </div>
            </div>

            {/* Secret Key */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold flex items-center justify-between">
                <span>Binance API Secret:</span>
                <span className="text-[10px] text-slate-500 font-sans">
                  {isArabic ? 'المفتاح السري (يتم حفظه بأمان)' : isEn ? 'Secret Key (Securely Saved)' : 'Clé Secrète'}
                </span>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="e.g. NhqPtmdSJYdKjVHj..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Actions: Test Connection & Save */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={() => handleTestAndSave(true)}
                disabled={isTesting || (!activeBinanceConfig.isConnected && (!apiKey.trim() || !apiSecret.trim()))}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 transition font-sans text-xs"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isArabic ? 'جارِ التحقق والاتصال...' : isEn ? 'Verifying & Connecting...' : 'Vérification en cours...'}</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>{isArabic ? 'فحص الاتصال وحفظ المفاتيح' : isEn ? 'Test Connection & Save Keys' : 'Tester & Sauvegarder la Connexion'}</span>
                  </>
                )}
              </button>

              {activeBinanceConfig.isConnected && (
                <button
                  onClick={handleClearCredentials}
                  className="px-3.5 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 transition font-sans text-xs"
                >
                  {isArabic ? 'مسح المفاتيح' : isEn ? 'Clear Keys' : 'Effacer'}
                </button>
              )}
            </div>

            {/* Test result feedback banner */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold">{testResult.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Live Binance Account Balances Overview (if connected) */}
          {activeAccount && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {isArabic ? 'أرصدة حساب Binance المباشر' : isEn ? 'Live Binance Account Balances' : 'Solde du Compte Binance Réel'}
                  </h4>
                </div>
                <span className="text-[10px] text-slate-400">
                  Type: {activeAccount.accountType || 'SPOT'} | Can Trade: {activeAccount.canTrade ? 'Active' : 'Disabled'}
                </span>
              </div>

              {/* Balance Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">{isArabic ? 'USDT المتاح' : isEn ? 'Available USDT (Free)' : 'USDT Disponible (Free)'}</span>
                  <span className="text-base font-black text-emerald-400">
                    ${activeAccount.freeUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">{isArabic ? 'إجمالي الرصيد' : isEn ? 'Total USDT Equity' : 'Total USDT Equity'}</span>
                  <span className="text-base font-black text-white">
                    ${activeAccount.totalUsdtEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 block">{isArabic ? 'العملات المحتفظ بها' : isEn ? 'Held Coins' : 'Actifs Détenus (Coins)'}</span>
                  <span className="text-xs font-bold text-slate-200 block truncate">
                    {(Array.isArray(activeAccount?.balances) ? activeAccount.balances : [])
                      .filter((b) => b.asset !== 'USDT')
                      .slice(0, 3)
                      .map((b) => `${b.asset}: ${b.free.toFixed(3)}`)
                      .join(' | ') || (isArabic ? 'لا توجد عملات أخرى' : isEn ? 'No other assets' : 'Aucun autre actif')}
                  </span>
                </div>
              </div>

              {/* Quick Manual Trade Test */}
              <div className="pt-2 border-t border-slate-800 space-y-2 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isArabic ? `تنفيذ يدوي فوري على بايننس (${activeSymbol})` : isEn ? `Instant Manual Order (${activeSymbol})` : `Ordre Manuel Immédiat (${activeSymbol})`}</span>
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="text-slate-400">{isArabic ? 'المبلغ ($):' : isEn ? 'Amount ($):' : 'Montant ($):'}</span>
                    <input
                      type="number"
                      value={manualOrderAmount}
                      onChange={(e) => setManualOrderAmount(e.target.value)}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-white font-bold text-xs text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <button
                    onClick={() => handleQuickManualOrder('BUY')}
                    disabled={isOrdering}
                    className="p-2.5 rounded-xl font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{isArabic ? `شراء فوري BUY ($${manualOrderAmount})` : isEn ? `MARKET BUY ($${manualOrderAmount})` : `ACHAT MARKET ($${manualOrderAmount})`}</span>
                  </button>

                  <button
                    onClick={() => handleQuickManualOrder('SELL')}
                    disabled={isOrdering}
                    className="p-2.5 rounded-xl font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5 rotate-180" />
                    <span>{isArabic ? `بيع فوري SELL ($${manualOrderAmount})` : isEn ? `MARKET SELL ($${manualOrderAmount})` : `VENTE MARKET ($${manualOrderAmount})`}</span>
                  </button>
                </div>

                {orderFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-mono ${
                      orderFeedback.success
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {orderFeedback.text}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            {isArabic ? 'إغلاق النافذة' : isEn ? 'Close' : 'Fermer'}
          </button>
        </div>
      </div>

      {/* Confirmation Modal when switching to LIVE REAL MONEY */}
      {showRealMoneyConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto animate-bounce">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">
                {isArabic ? 'تأكيد تفعيل التداول الحقيقي بالأموال الفعلية' : isEn ? 'Confirm Live Real-Money Trading' : 'Confirmer l\'Activation du Trading Réel'}
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {isArabic
                  ? 'أنت على وشك تفعيل التداول الحقيقي (Binance Live). سيقوم البوت الآلي بفتح وإغلاق صفقات شراء وبيع على حسابك في منصة Binance بأموالك الحقيقية عند تأكيد الإشارات.'
                  : isEn
                  ? 'You are about to enable Live Trading. The automated bot will execute real buy and sell orders on your Binance account using your real balance.'
                  : 'Vous êtes sur le point d\'activer le mode Réel. Le bot automatique enverra des ordres réels sur Binance en utilisant votre solde réel.'}
              </p>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 text-left rtl:text-right space-y-1">
              <div>• {isArabic ? 'الرصيد المتاح للتداول:' : isEn ? 'Available Balance:' : 'Solde disponible :'} <strong className="text-emerald-400">${activeAccount?.freeUsdt.toFixed(2) || '0.00'} USDT</strong></div>
              <div>• {isArabic ? 'الشبكة:' : isEn ? 'Network:' : 'Réseau :'} <strong className="text-white">{useTestnet ? 'Binance Testnet' : 'Binance Mainnet (Live)'}</strong></div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setShowRealMoneyConfirm(false)}
                className="px-4 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
              >
                {isArabic ? 'إلغاء والعودة للتجريبي' : isEn ? 'Cancel (Stay in Paper)' : 'Annuler'}
              </button>
              <button
                onClick={confirmEnableLiveTrading}
                className="px-4 py-2.5 rounded-xl font-bold bg-rose-500 hover:bg-rose-400 text-white text-xs shadow-lg shadow-rose-500/25 transition cursor-pointer"
              >
                {isArabic ? 'نعم، تفعيل التداول الحقيقي' : isEn ? 'Yes, Activate Live Trading' : 'Oui, Activer le Mode Réel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
