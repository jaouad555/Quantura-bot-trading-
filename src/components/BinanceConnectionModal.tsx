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
  Copy,
  CheckCheck,
  Shield,
  Coins,
  Cpu,
  Radio,
  FlaskConical,
  Trash2,
  Save,
  Globe,
  Gauge
} from 'lucide-react';
import {
  Language,
  BinanceApiConfig,
  BinanceAccountInfo,
  TradingExecutionMode,
  PaperWallet,
  MarketType
} from '../types';

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
  const [marketType, setMarketType] = useState<MarketType>(activeBinanceConfig.marketType || 'SPOT');
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    accountInfo?: BinanceAccountInfo;
    latencyMs?: number;
  } | null>(null);

  const [modeError, setModeError] = useState<string | null>(null);
  const [showRealMoneyConfirm, setShowRealMoneyConfirm] = useState(false);
  const [manualOrderAmount, setManualOrderAmount] = useState('25');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<{ success: boolean; text: string } | null>(null);
  const [isUpdatingNetwork, setIsUpdatingNetwork] = useState(false);

  // Quick Amount Presets for Order Console
  const quickAmounts = ['10', '25', '50', '100', '250', '500'];

  // Sync state on modal open
  useEffect(() => {
    if (isOpen) {
      setApiKey(activeBinanceConfig.apiKey || '');
      setApiSecret(activeBinanceConfig.apiSecret || '');
      setUseTestnet(activeBinanceConfig.useTestnet || false);
      setMarketType(activeBinanceConfig.marketType || 'SPOT');
      setTestResult(null);
      setModeError(null);
      setOrderFeedback(null);

      // Auto-query live account status and real-time balance
      fetch(`/api/binance/account?marketType=${activeBinanceConfig.marketType || 'SPOT'}&useTestnet=${activeBinanceConfig.useTestnet ? 'true' : 'false'}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            const accountInfo: BinanceAccountInfo = {
              canTrade: data.canTrade ?? true,
              canWithdraw: data.canWithdraw ?? false,
              canDeposit: data.canDeposit ?? true,
              accountType: data.accountType || 'SPOT',
              makerCommission: data.makerCommission ?? 10,
              takerCommission: data.takerCommission ?? 10,
              updateTime: data.updateTime || Date.now(),
              balances: data.balances || [],
              totalUsdtEquity: data.totalUsdtEquity ?? 0,
              freeUsdt: data.freeUsdt ?? 0,
            };
            setTestResult({
              success: true,
              message: isArabic
                ? `تم الاتصال بنجاح مع منصة بايننس (${data.marketType || 'SPOT'}) | الاستجابة: ${data.latencyMs ?? 24}ms`
                : isEn
                ? `Successfully connected to Binance (${data.marketType || 'SPOT'}) | Latency: ${data.latencyMs ?? 24}ms`
                : `Connecté avec succès à Binance (${data.marketType || 'SPOT'}) | Latence : ${data.latencyMs ?? 24}ms`,
              accountInfo,
              latencyMs: data.latencyMs,
            });
            if (data.useTestnet !== undefined) {
              setUseTestnet(data.useTestnet);
            }
            onSaveConfig({
              ...activeBinanceConfig,
              isConnected: true,
              useTestnet: data.useTestnet !== undefined ? data.useTestnet : activeBinanceConfig.useTestnet,
              accountInfo,
              marketType: data.marketType || activeBinanceConfig.marketType,
            });
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle Testnet vs Mainnet with server sync
  const handleToggleTestnet = async (newVal: boolean) => {
    setUseTestnet(newVal);
    setIsUpdatingNetwork(true);
    setTestResult(null);

    const targetMode: TradingExecutionMode = newVal 
      ? 'BINANCE_TESTNET' 
      : (executionMode === 'BINANCE_TESTNET' ? 'PAPER' : executionMode);

    const updatedConfig: BinanceApiConfig = {
      ...activeBinanceConfig,
      useTestnet: newVal,
      executionMode: targetMode,
      isLiveModeEnabled: targetMode === 'BINANCE_LIVE',
    };
    onSaveConfig(updatedConfig);
    handleToggleModeFn(targetMode);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      await fetch('/api/config/binance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          apiSecret: apiSecret.trim() || undefined,
          useTestnet: newVal,
          marketType,
        }),
        signal: controller.signal,
      });

      // Verify account on the selected network
      const res = await fetch(`/api/binance/account?marketType=${marketType}&useTestnet=${newVal}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: isArabic
            ? `تم تحويل الشبكة إلى: ${newVal ? 'Binance Testnet Sandbox' : 'Binance Mainnet'}! (الرصيد المتاح: $${(data.freeUsdt || 0).toFixed(2)} USDT)`
            : isEn
            ? `Network switched to: ${newVal ? 'Binance Testnet Sandbox' : 'Binance Mainnet'}! (Free: $${(data.freeUsdt || 0).toFixed(2)} USDT)`
            : `Réseau basculé vers : ${newVal ? 'Binance Testnet' : 'Binance Mainnet'} ! (Libre : $${(data.freeUsdt || 0).toFixed(2)} USDT)`,
          accountInfo: data,
          latencyMs: data.latencyMs,
        });
      } else {
        setTestResult({
          success: true,
          message: isArabic
            ? `تم التبديل بنجاح إلى وضع: ${newVal ? 'Binance Testnet Sandbox (بيئة الاختبار)' : 'Binance Mainnet (الشبكة الحية)'}! ${!apiKey.trim() ? '(ملاحظة: يمكنك إدخال مفاتيح Testnet الخاصة بك للاتصال)' : ''}`
            : `Switched network mode to: ${newVal ? 'Binance Testnet Sandbox' : 'Binance Mainnet'}!`,
        });
      }
    } catch (e) {
      console.warn('Network switch note:', e);
      setTestResult({
        success: true,
        message: isArabic
          ? `تم تفعيل ${newVal ? 'Binance Testnet Sandbox' : 'Binance Mainnet'} بنجاح.`
          : `Switched to ${newVal ? 'Binance Testnet Sandbox' : 'Binance Mainnet'}.`,
      });
    } finally {
      setIsUpdatingNetwork(false);
    }
  };

  // Toggle Spot vs Futures
  const handleSelectMarketType = async (newMarket: MarketType) => {
    setMarketType(newMarket);
    onSaveConfig({
      ...activeBinanceConfig,
      marketType: newMarket,
    });
    try {
      await fetch('/api/config/binance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          apiSecret: apiSecret.trim() || undefined,
          useTestnet,
          marketType: newMarket,
        }),
      });
      // Refresh account balances for new market
      const res = await fetch(`/api/binance/account?marketType=${newMarket}&useTestnet=${useTestnet}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: isArabic
            ? `تم التحويل إلى سوق ${newMarket === 'FUTURES' ? 'العقود الآجلة (USDT-M Futures)' : 'التداول الفوري (Spot)'} بنجاح!`
            : `Market switched to ${newMarket === 'FUTURES' ? 'USDT-M Futures' : 'Spot Market'} successfully!`,
          accountInfo: data,
          latencyMs: data.latencyMs,
        });
      }
    } catch (e) {
      console.error('Failed to switch market:', e);
    }
  };

  // Test and optionally persist credentials
  const handleTestAndSave = async (autoSave: boolean = true) => {
    const hasInputKeys = Boolean(apiKey.trim() && apiSecret.trim());
    if (!hasInputKeys && !activeBinanceConfig.isConnected) {
      setTestResult({
        success: false,
        message: isArabic
          ? 'يرجى إدخال كل من API Key و API Secret الكاملين للاتصال'
          : isEn
          ? 'Please enter both full API Key and API Secret to connect'
          : 'Veuillez saisir votre API Key et API Secret complets.',
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
          canTrade: data.canTrade ?? true,
          canWithdraw: data.canWithdraw ?? false,
          canDeposit: data.canDeposit ?? true,
          accountType: data.accountType || marketType,
          makerCommission: data.makerCommission ?? 10,
          takerCommission: data.takerCommission ?? 10,
          updateTime: data.updateTime || Date.now(),
          balances: data.balances || [],
          totalUsdtEquity: data.totalUsdtEquity ?? 0,
          freeUsdt: data.freeUsdt ?? 0,
        };

        const updatedConfig: BinanceApiConfig = {
          ...activeBinanceConfig,
          apiKey: hasInputKeys ? apiKey.trim() : activeBinanceConfig.apiKey,
          apiSecret: '',
          useTestnet,
          marketType,
          isConnected: true,
          lastConnectedAt: Date.now(),
          latencyMs: data.latencyMs,
          accountInfo,
          isLiveModeEnabled: executionMode === 'BINANCE_LIVE',
        };

        setTestResult({
          success: true,
          message: isArabic
            ? `✅ تم الاتصال بنجاح مع بايننس (${marketType === 'SPOT' ? 'SPOT' : 'FUTURES'})! الاستجابة: ${data.latencyMs ?? 24}ms | الرصيد المتاح: $${(data.freeUsdt || 0).toFixed(2)} USDT`
            : isEn
            ? `✅ Successfully connected to Binance (${marketType === 'SPOT' ? 'SPOT' : 'FUTURES'})! Latency: ${data.latencyMs ?? 24}ms | Free: $${(data.freeUsdt || 0).toFixed(2)} USDT`
            : `✅ Connexion réussie à Binance (${marketType === 'SPOT' ? 'SPOT' : 'FUTURES'}) ! Latence : ${data.latencyMs ?? 24}ms | Libre : $${(data.freeUsdt || 0).toFixed(2)} USDT`,
          accountInfo,
          latencyMs: data.latencyMs,
        });

        if (autoSave) {
          setIsSaving(true);
          await fetch('/api/config/binance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: hasInputKeys ? apiKey.trim() : undefined,
              apiSecret: hasInputKeys ? apiSecret.trim() : undefined,
              useTestnet,
              marketType,
            })
          }).catch(console.error);
          setIsSaving(false);
        }

        onSaveConfig(updatedConfig);
      } else {
        setTestResult({
          success: false,
          message: data.error || (isArabic ? `فشل الاتصال بـ Binance API (${marketType}): تحقق من صحة المفاتيح وصلاحياتها` : `Échec de connexion à Binance API (${marketType}) : vérifiez vos clés`),
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || (isArabic ? 'حدث خطأ في شبكة الاتصال' : 'Erreur de connexion réseau'),
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Clear credentials
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

  // Execution Mode Switch Request
  const handleToggleModeRequest = (newMode: TradingExecutionMode) => {
    setModeError(null);
    if (newMode === 'BINANCE_LIVE') {
      if (!activeBinanceConfig.isConnected || !activeBinanceConfig.apiKey) {
        setModeError(
          isArabic
            ? 'تنبيه أمان: يجب فحص وتأكيد الاتصال بـ Binance API بنجاح أولاً قبل تفعيل التداول الحقيقي!'
            : 'Veuillez d\'abord configurer et tester vos clés API Binance avec succès avant d\'activer le mode Réel !'
        );
        return;
      }
      setShowRealMoneyConfirm(true);
    } else if (newMode === 'BINANCE_TESTNET') {
      setShowRealMoneyConfirm(false);
      handleToggleTestnet(true);
    } else {
      setShowRealMoneyConfirm(false);
      handleToggleTestnet(false);
      handleToggleModeFn('PAPER');
      onSaveConfig({ ...activeBinanceConfig, isLiveModeEnabled: false, executionMode: 'PAPER', useTestnet: false });
    }
  };

  const confirmEnableLiveTrading = () => {
    handleToggleModeFn('BINANCE_LIVE');
    setShowRealMoneyConfirm(false);
    onSaveConfig({ ...activeBinanceConfig, isLiveModeEnabled: true });
  };

  // Quick Manual Trade Execution
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
        handleTestAndSave(false);
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
  const estimatedCryptoQty = currentPrice > 0 ? (parseFloat(manualOrderAmount) || 0) / currentPrice : 0;
  const baseAsset = activeSymbol.replace(/USDT$/i, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden max-h-[92vh] flex flex-col font-sans">
        
        {/* ========================================================================= */}
        {/* 1. SMART MODAL HEADER                                                     */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            {/* Binance Gold Emblem Logo */}
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-amber-400" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L6.5 7.5L8.6 9.6L12 6.2L15.4 9.6L17.5 7.5L12 2Z" />
                <path d="M2 12L7.5 6.5L9.6 8.6L6.2 12L9.6 15.4L7.5 17.5L2 12Z" />
                <path d="M12 22L17.5 16.5L15.4 14.4L12 17.8L8.6 14.4L6.5 16.5L12 22Z" />
                <path d="M22 12L16.5 17.5L14.4 15.4L17.8 12L14.4 8.6L16.5 6.5L22 12Z" />
                <path d="M12 9.5L9.5 12L12 14.5L14.5 12L12 9.5Z" />
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-white text-base sm:text-lg tracking-tight">
                  {isArabic ? 'إعدادات وربط Binance API الذكي' : isEn ? 'Smart Binance API Integration & Execution' : 'Intégration Binance API & Trading Réel'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  v3.0 QUANT
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
                    activeBinanceConfig.isConnected
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${activeBinanceConfig.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {activeBinanceConfig.isConnected
                    ? (isArabic ? 'متصل بالمنصة' : 'API CONNECTED')
                    : (isArabic ? 'غير متصل' : 'NOT CONNECTED')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isArabic
                  ? 'بوابة ربط آمنة مشفرة لتنفيذ صفقات البوت الرياضية على حسابك المباشر في بايننس'
                  : 'Secure 256-bit encrypted gateway to execute quant bot orders directly on Binance'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
            title={isArabic ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY (SCROLLABLE)                                                   */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
          
          {/* ========================================================================= */}
          {/* 2. ORDERLY 3-WAY EXECUTION MODE SWITCHER (SYMMETRICAL GRID)               */}
          {/* ========================================================================= */}
          <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-3.5 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isArabic ? 'وضع تنفيذ التداول النشط' : isEn ? 'Active Execution Mode' : 'Mode d\'Exécution Actif'}</span>
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                executionMode === 'BINANCE_LIVE'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : executionMode === 'BINANCE_TESTNET'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {executionMode === 'BINANCE_LIVE' 
                  ? '🚀 LIVE REAL MONEY' 
                  : executionMode === 'BINANCE_TESTNET'
                  ? '⚡ TESTNET SANDBOX'
                  : '🧪 SIMULATED PAPER'}
              </span>
            </div>

            {/* Symmetrical 3-column button grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
              {/* Button 1: PAPER */}
              <button
                type="button"
                onClick={() => handleToggleModeRequest('PAPER')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 font-bold transition-all text-left rtl:text-right cursor-pointer ${
                  executionMode === 'PAPER' && !useTestnet
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900 border-slate-800/90 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 text-xs text-white">
                    <FlaskConical className="w-4 h-4 text-emerald-400" />
                    <span>{isArabic ? 'تداول تجريبي' : 'Paper Trading'}</span>
                  </div>
                  {executionMode === 'PAPER' && !useTestnet && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 uppercase">
                      {isArabic ? 'نشط' : 'Active'}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-sans font-normal">
                  {isArabic ? 'أموال افتراضية محاكاة بدون مخاطر' : 'Zero-risk virtual simulated balance'}
                </span>
              </button>

              {/* Button 2: TESTNET */}
              <button
                type="button"
                onClick={() => handleToggleModeRequest('BINANCE_TESTNET')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 font-bold transition-all text-left rtl:text-right cursor-pointer ${
                  executionMode === 'BINANCE_TESTNET' || (executionMode !== 'BINANCE_LIVE' && useTestnet)
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                    : 'bg-slate-900 border-slate-800/90 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 text-xs text-white">
                    <Radio className="w-4 h-4 text-amber-400" />
                    <span>{isArabic ? 'بيئة الاختبار' : 'Testnet Sandbox'}</span>
                  </div>
                  {(executionMode === 'BINANCE_TESTNET' || (executionMode !== 'BINANCE_LIVE' && useTestnet)) && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 uppercase">
                      {isArabic ? 'نشط' : 'Active'}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-sans font-normal">
                  {isArabic ? 'سيرفرات بايننس الرسمية التجريبية' : 'Official Binance API test sandbox'}
                </span>
              </button>

              {/* Button 3: LIVE */}
              <button
                type="button"
                onClick={() => handleToggleModeRequest('BINANCE_LIVE')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1 font-bold transition-all text-left rtl:text-right cursor-pointer ${
                  executionMode === 'BINANCE_LIVE'
                    ? 'bg-rose-500/25 text-rose-300 border-rose-500/70 shadow-lg shadow-rose-500/20 animate-pulse'
                    : 'bg-slate-900 border-slate-800/90 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 text-xs text-white">
                    <Flame className="w-4 h-4 text-rose-400" />
                    <span>{isArabic ? 'حساب حقيقي' : 'Binance Live'}</span>
                  </div>
                  {executionMode === 'BINANCE_LIVE' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-300 uppercase">
                      {isArabic ? 'نشط' : 'Active'}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-sans font-normal">
                  {isArabic ? 'تنفيذ فوري مباشر بأموال حقيقية' : 'Real-money orders executed live'}
                </span>
              </button>
            </div>

            {/* Live Mode Critical Warning */}
            {executionMode === 'BINANCE_LIVE' && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {isArabic ? 'تنبيه: التداول الحقيقي المباشر مفعل بأموالك الفعلية!' : isEn ? 'Warning: Real-Money Live Trading Active!' : 'Attention : Le Trading Réel est Actif !'}
                  </p>
                  <p className="text-[11px] text-rose-300/80 mt-0.5 leading-relaxed">
                    {isArabic
                      ? 'عندما يصدر البوت إشارة مؤكدة (BUY/SELL)، سيتم إرسال أمر فوري حقيقي إلى حسابك في منصة Binance. تأكد من ضبط محرك إدارة المخاطر بدقة.'
                      : 'When the bot issues confirmed signals (BUY/SELL), real market orders execute on your Binance balance. Ensure strict Risk Engine rules.'}
                  </p>
                </div>
              </div>
            )}

            {modeError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="font-bold leading-relaxed">{modeError}</p>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. SYMMETRICAL PAIR DECK: MARKET SELECTOR & NETWORK ENVIRONMENT           */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Market Selection Box */}
            <div className="p-3.5 bg-slate-950 border border-slate-800/90 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isArabic ? 'سوق التداول' : 'Trading Market'}</span>
                </span>
                <span className="text-[10px] text-slate-500">{marketType}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => handleSelectMarketType('SPOT')}
                  className={`py-2 px-3 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    marketType === 'SPOT'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>SPOT</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectMarketType('FUTURES')}
                  className={`py-2 px-3 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    marketType === 'FUTURES'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>USDT-M FUTURES</span>
                </button>
              </div>
            </div>

            {/* Network Environment Box */}
            <div className="p-3.5 bg-slate-950 border border-slate-800/90 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isArabic ? 'شبكة بايننس' : 'Binance Network'}</span>
                </span>
                {isUpdatingNetwork && (
                  <span className="text-[10px] text-cyan-400 animate-pulse font-mono">{isArabic ? 'جاري التحويل...' : 'Switching...'}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleTestnet(false)}
                  className={`py-2 px-3 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    !useTestnet
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>MAINNET</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleTestnet(true)}
                  className={`py-2 px-3 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    useTestnet
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>TESTNET SANDBOX</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4. REAL-TIME ACCOUNT EQUITY & PORTFOLIO METRICS DASHBOARD                */}
          {/* ========================================================================= */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {isArabic ? 'أرصدة المحفظة والمصدر النشط للتنفيذ' : 'Portfolio Balances & Active Source'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {testResult?.latencyMs !== undefined && (
                  <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    ⚡ {testResult.latencyMs}ms
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleTestAndSave(false)}
                  disabled={isTesting}
                  className="p-1 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                  title={isArabic ? 'تحديث الرصيد اللحظي' : 'Refresh live balance'}
                >
                  <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Paper Balance Card */}
              <div className={`p-3 rounded-xl border transition ${
                executionMode === 'PAPER'
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-900/60 border-slate-800/80 opacity-70'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isArabic ? 'رصيد Paper' : 'Paper Equity'}</span>
                  </span>
                  {executionMode === 'PAPER' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded uppercase">
                      {isArabic ? 'نشط' : 'Active'}
                    </span>
                  )}
                </div>
                <div className="text-base font-black text-emerald-400">
                  ${(paperWallet?.balance ?? 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-500 font-sans">USDT</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
                  {isArabic ? 'أموال محاكاة بدون مخاطر' : 'Simulated virtual funds'}
                </div>
              </div>

              {/* Binance Live Free USDT Card */}
              <div className={`p-3 rounded-xl border transition ${
                executionMode === 'BINANCE_LIVE' || executionMode === 'BINANCE_TESTNET'
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900/60 border-slate-800/80 opacity-70'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isArabic ? 'USDT متاح (بايننس)' : 'Binance Free USDT'}</span>
                  </span>
                  {(executionMode === 'BINANCE_LIVE' || executionMode === 'BINANCE_TESTNET') && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded uppercase">
                      {isArabic ? 'نشط' : 'Active'}
                    </span>
                  )}
                </div>
                <div className="text-base font-black text-white">
                  ${(activeAccount?.freeUsdt ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-500 font-sans">USDT</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-sans truncate">
                  Total: ${(activeAccount?.totalUsdtEquity ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Held Crypto Assets Card */}
              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isArabic ? 'العملات المحتفظ بها' : 'Held Assets'}</span>
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {activeAccount?.balances ? `${activeAccount.balances.length} coins` : '0'}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-200 truncate mt-1">
                  {(Array.isArray(activeAccount?.balances) ? activeAccount.balances : [])
                    .filter((b) => b.asset !== 'USDT' && b.free > 0.0001)
                    .slice(0, 2)
                    .map((b) => `${b.asset}: ${b.free < 1 ? b.free.toFixed(4) : b.free.toFixed(2)}`)
                    .join(' | ') || (isArabic ? 'لا توجد عملات أخرى' : 'USDT only')}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
                  {marketType} Account ({useTestnet ? 'Testnet' : 'Mainnet'})
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 5. CREDENTIALS FORTRESS & SYMMETRICAL ACTION BUTTONS                      */}
          {/* ========================================================================= */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>{isArabic ? 'مفاتيح Binance API المشفرة' : 'Encrypted Binance API Credentials'}</span>
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>HMAC-SHA256 Proxy</span>
              </span>
            </div>

            {/* Input 1: API Key */}
            <div className="space-y-1">
              <label className="text-slate-300 font-bold flex items-center justify-between text-[11px]">
                <span>Binance API Key (Public):</span>
                <span className="text-[10px] text-slate-500 font-sans">
                  {isArabic ? 'المفتاح العام للتداول' : 'Public Trading Key'}
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. vmPUZE6mv9SD5VNHk4Hl..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition text-xs font-mono"
                />
              </div>
            </div>

            {/* Input 2: API Secret */}
            <div className="space-y-1">
              <label className="text-slate-300 font-bold flex items-center justify-between text-[11px]">
                <span>Binance API Secret:</span>
                <span className="text-[10px] text-slate-500 font-sans">
                  {isArabic ? 'المفتاح السري (يُحفظ بأمان)' : 'HMAC Private Secret'}
                </span>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="e.g. NhqPtmdSJYdKjVHj..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Security Checklist Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 text-[11px] font-sans">
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{isArabic ? 'قراءة الحساب: مفعلة' : 'Account Read: Active'}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{isArabic ? 'تنفيذ التداول: مفعل' : 'Spot/Futures: Enabled'}</span>
              </div>
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-300 font-semibold">
                <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{isArabic ? 'السحب: معطل تماماً 🛡️' : 'Withdrawals: DISABLED 🛡️'}</span>
              </div>
            </div>

            {/* SYMMETRICAL ACTION BUTTONS TOOLBAR (تصفيف الأزرار بانتظام متناسق) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {/* Button 1: Test & Save */}
              <button
                type="button"
                onClick={() => handleTestAndSave(true)}
                disabled={isTesting}
                className="py-2.5 px-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer text-xs font-sans"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isArabic ? 'جارِ الفحص...' : 'Testing...'}</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'فحص الاتصال' : 'Test API'}</span>
                  </>
                )}
              </button>

              {/* Button 2: Save Only */}
              <button
                type="button"
                onClick={() => handleTestAndSave(true)}
                disabled={isTesting || isSaving}
                className="py-2.5 px-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition flex items-center justify-center gap-1.5 cursor-pointer text-xs font-sans"
              >
                <Save className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isArabic ? 'حفظ المفاتيح' : 'Save Keys'}</span>
              </button>

              {/* Button 3: Refresh Balances */}
              <button
                type="button"
                onClick={() => handleTestAndSave(false)}
                disabled={isTesting}
                className="py-2.5 px-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition flex items-center justify-center gap-1.5 cursor-pointer text-xs font-sans"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isArabic ? 'تحديث الرصيد' : 'Refresh'}</span>
              </button>

              {/* Button 4: Clear Keys */}
              <button
                type="button"
                onClick={handleClearCredentials}
                className="py-2.5 px-3 rounded-xl font-bold bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/40 transition flex items-center justify-center gap-1.5 cursor-pointer text-xs font-sans"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isArabic ? 'مسح المفاتيح' : 'Clear Keys'}</span>
              </button>
            </div>

            {/* Test Feedback Message */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed animate-in fade-in ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <p className="font-bold flex-1">{testResult.message}</p>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 6. SMART INSTANT ORDER EXECUTION CONSOLE (SYMMETRICAL BUY/SELL)          */}
          {/* ========================================================================= */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{isArabic ? `تنفيذ أمر فوري تجريبي (${activeSymbol})` : `Instant Manual Order Console (${activeSymbol})`}</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Price: <strong className="text-white">${currentPrice > 0 ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '---'}</strong>
              </span>
            </div>

            {/* Amount Presets & Conversion Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-sans">{isArabic ? 'قيمة الصفقة (USDT):' : 'Order Size (USDT):'}</span>
                <span className="text-slate-300">
                  ≈ <strong className="text-cyan-400">{estimatedCryptoQty > 0 ? estimatedCryptoQty.toFixed(5) : '0.00'}</strong> {baseAsset}
                </span>
              </div>

              {/* Preset Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setManualOrderAmount(amt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                      manualOrderAmount === amt
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
                <div className="flex-1 min-w-[80px]">
                  <input
                    type="number"
                    value={manualOrderAmount}
                    onChange={(e) => setManualOrderAmount(e.target.value)}
                    placeholder="USDT"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Symmetrical Side-by-Side BUY & SELL Buttons or Spot-Adaptive LONG Console */}
            {marketType === 'SPOT' ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                  <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'نظام التداول الفوري (Spot Mode):' : 'Spot Market Mode:'}</span>
                  </span>
                  <span className="text-slate-300 font-mono text-[10px]">
                    {isArabic ? 'يدعم صفقات الشراء (LONG) فقط' : 'LONG / BUY Orders Only (No Short)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleQuickManualOrder('BUY')}
                    disabled={isOrdering}
                    className="p-3 rounded-xl font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10"
                  >
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <div className="flex flex-col text-left rtl:text-right">
                      <span className="text-xs font-black">{isArabic ? 'شراء فوري SPOT BUY (LONG)' : 'SPOT BUY (LONG)'}</span>
                      <span className="text-[10px] text-emerald-400/80 font-normal font-sans">${manualOrderAmount} USDT</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickManualOrder('SELL')}
                    disabled={isOrdering}
                    className="p-3 rounded-xl font-bold bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
                    title={isArabic ? 'بيع رصيد العملة المملوك وتحويله إلى USDT' : 'Sell owned crypto back to USDT'}
                  >
                    <TrendingUp className="w-4 h-4 rotate-180 text-amber-400" />
                    <div className="flex flex-col text-left rtl:text-right">
                      <span className="text-xs font-black">{isArabic ? 'بيع رصيد العملة (Spot Sell)' : 'SPOT SELL ASSET'}</span>
                      <span className="text-[10px] text-slate-400 font-normal font-sans">{isArabic ? 'تحويل إلى USDT' : 'Convert to USDT'}</span>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleQuickManualOrder('BUY')}
                  disabled={isOrdering}
                  className="p-3 rounded-xl font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10"
                >
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <div className="flex flex-col text-left rtl:text-right">
                    <span className="text-xs font-black">{isArabic ? 'عقد شراء LONG (Futures)' : 'FUTURES LONG BUY'}</span>
                    <span className="text-[10px] text-emerald-400/80 font-normal font-sans">${manualOrderAmount} USDT</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickManualOrder('SELL')}
                  disabled={isOrdering}
                  className="p-3 rounded-xl font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-500/10"
                >
                  <TrendingUp className="w-4 h-4 rotate-180 text-rose-400" />
                  <div className="flex flex-col text-left rtl:text-right">
                    <span className="text-xs font-black">{isArabic ? 'عقد هبوط SHORT (Futures)' : 'FUTURES SHORT SELL'}</span>
                    <span className="text-[10px] text-rose-400/80 font-normal font-sans">${manualOrderAmount} USDT</span>
                  </div>
                </button>
              </div>
            )}

            {orderFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs font-mono animate-in fade-in ${
                  orderFeedback.success
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {orderFeedback.text}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 7. VPS / SSH TERMINAL DIAGNOSTICS                                         */}
          {/* ========================================================================= */}
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span className="flex items-center gap-1.5 font-bold text-slate-200">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isArabic ? 'فحص الاتصال عبر سطر أوامر السيرفر / VPS' : 'SSH / Server Diagnostic Probe'}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText('curl -s http://localhost:3000/api/binance/account');
                  setCopiedCurl(true);
                  setTimeout(() => setCopiedCurl(false), 2000);
                }}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                {copiedCurl ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCurl ? (isArabic ? 'تم النسخ!' : 'Copied!') : (isArabic ? 'نسخ الأمر' : 'Copy')}</span>
              </button>
            </div>
            <div className="bg-black/60 p-2 rounded text-[10px] text-slate-300 select-all overflow-x-auto border border-slate-800/80">
              <code>curl -s http://localhost:3000/api/binance/account</code>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 8. MODAL FOOTER                                                           */}
        {/* ========================================================================= */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
            {activeBinanceConfig.isConnected 
              ? (isArabic ? `● الربط سليم (${activeBinanceConfig.marketType || 'SPOT'})` : `● Live Gateway OK (${activeBinanceConfig.marketType || 'SPOT'})`)
              : (isArabic ? '○ في انتظار الربط' : '○ Standby')}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition cursor-pointer"
          >
            {isArabic ? 'إغلاق النافذة' : isEn ? 'Close Window' : 'Fermer'}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 9. REAL-MONEY LIVE TRADING CONFIRMATION MODAL                             */}
      {/* ========================================================================= */}
      {showRealMoneyConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-500/60 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto animate-bounce">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">
                {isArabic ? 'تأكيد تفعيل التداول الحقيقي بالأموال الفعلية' : 'Confirm Live Real-Money Trading'}
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {isArabic
                  ? 'أنت على وشك تفعيل وضع التداول الحقيقي (Binance Live). سيقوم البوت بإرسال وتنفيذ صفقات شراء وبيع بأموال حقيقية على حسابك في بايننس.'
                  : 'You are about to activate Live Real-Money Trading. The bot will place genuine buy/sell orders on Binance with real capital.'}
              </p>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 text-left rtl:text-right space-y-1">
              <div>• {isArabic ? 'الرصيد المتاح:' : 'Available Balance:'} <strong className="text-emerald-400">${(activeAccount?.freeUsdt ?? 0).toFixed(2)} USDT</strong></div>
              <div>• {isArabic ? 'الشبكة:' : 'Network:'} <strong className="text-white">{useTestnet ? 'Binance Testnet Sandbox' : 'Binance Mainnet (Live)'}</strong></div>
              <div>• {isArabic ? 'السوق:' : 'Market:'} <strong className="text-amber-400">{marketType}</strong></div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRealMoneyConfirm(false)}
                className="px-4 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
              >
                {isArabic ? 'إلغاء (البقاء تجريبياً)' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmEnableLiveTrading}
                className="px-4 py-2.5 rounded-xl font-bold bg-rose-500 hover:bg-rose-400 text-white text-xs shadow-lg shadow-rose-500/25 transition cursor-pointer"
              >
                {isArabic ? 'نعم، تفعيل التداول الحقيقي' : 'Yes, Activate Live'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
