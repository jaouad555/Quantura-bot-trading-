import { apiStorage } from "./utils/apiStorage";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AIAnalysisResult,
  BinanceTicker,
  ConnectionState,
  KlineCandle,
  Language,
  MarketDataResponse,
  PaperWallet,
  Timeframe,
  TimezoneMode,
  TradeHistoryItem,
  AutoBotConfig,
  ActiveBotPosition,
  AutoTradeLog,
  PushAlert,
  BinanceApiConfig,
  TradingExecutionMode,
  MarketType,
} from './types';
import { Header } from './components/Header';
import { GlobalMarketScanner } from './components/GlobalMarketScanner';
import { SignalCard } from './components/SignalCard';
import { AutoTradingBot } from './components/AutoTradingBot';
import { TradingChart } from './components/TradingChart';
import { MultiTimeframeView } from './components/MultiTimeframeView';
import { MarketOverviewView } from './components/MarketOverviewView';
import { BacktestView } from './components/BacktestView';
import { RiskCalculatorView } from './components/RiskCalculatorView';
import { QwenAnalysisView } from './components/QwenAnalysisView';
import { TradeHistory } from './components/TradeHistory';
import { SettingsModal } from './components/SettingsModal';
import { RiskManagementModal } from './components/RiskManagementModal';
import { HelpQuickStartModal } from './components/HelpQuickStartModal';

import { NotificationCenter } from './components/NotificationCenter';
import { BinanceConnectionModal } from './components/BinanceConnectionModal';
import { CustomBalanceModal } from './components/CustomBalanceModal';
import { Footer } from './components/Footer';
import { AuthScreen } from './components/AuthScreen';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Sidebar } from './components/Sidebar';
import { translations } from './utils/translations';
import { binanceWsManager } from './utils/binanceWs';
import { generateQuantitativePlan, determineOptimalBotTimeframe } from './utils/quantEngine';
import { calculateTechnicalIndicators } from './utils/indicators';
import { TradingPair, RESPECTED_TRADING_PAIRS } from './utils/tradingPairs';
import { LiquidityMonitor } from './utils/liquidityMonitor';
import { sendTelegramMessage } from './utils/telegram';
import {
  LayoutDashboard,
  Bot,
  Radar,
  Layers,
  BarChart2,
  LineChart,
  History,
  FileText,
  Shield,
  Radio,
  Sliders,
  AlertCircle,
  Bell,
  BellRing,
  Check,
  TrendingUp,
  TrendingDown,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  X,
  Menu,
  Key,
  Code2,
  Terminal,
  Cpu
} from 'lucide-react';

const formatPairName = (sym?: string): string => {
  if (!sym || typeof sym !== 'string') return 'BTC/USDT';
  if (sym.includes('/')) return sym.toUpperCase();
  if (sym.toUpperCase().endsWith('USDT') && sym.length > 4) {
    return `${sym.slice(0, -4).toUpperCase()}/USDT`;
  }
  return sym.toUpperCase();
};

const normalizeSymbol = (sym?: string): string => (sym || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export type DisplayMode = 'auto' | 'standard' | 'compact' | 'fullscreen';
export const App: React.FC = () => {
  // Navigation & UI States - strictly local to this device/browser
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const isAuth = localStorage.getItem('app_is_authenticated') === 'true' || sessionStorage.getItem('app_is_authenticated') === 'true';
      const is2fa = localStorage.getItem('app_2fa_verified') === 'true' || sessionStorage.getItem('app_2fa_verified') === 'true';
      return isAuth && is2fa;
    } catch {
      return false;
    }
  });
  const [authChecking, setAuthChecking] = useState<boolean>(false);
  const isAuthenticatedRef = useRef<boolean>(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const [username, setUsername] = useState<string>(() => {
    try {
      return localStorage.getItem('app_username') || sessionStorage.getItem('app_username') || '';
    } catch {
      return '';
    }
  });

  const handleLogin = (name: string) => {
    const finalUser = name || 'trader';
    setIsAuthenticated(true);
    setUsername(finalUser);
    try {
      localStorage.setItem('app_is_authenticated', 'true');
      localStorage.setItem('app_username', finalUser);
      localStorage.setItem('app_2fa_verified', 'true');
      sessionStorage.setItem('app_is_authenticated', 'true');
      sessionStorage.setItem('app_username', finalUser);
      sessionStorage.setItem('app_2fa_verified', 'true');
    } catch {}
  };

  const handleLogout = useCallback(() => {
    try {
      signOut(auth).catch(() => {});
      localStorage.removeItem('app_is_authenticated');
      localStorage.removeItem('app_email');
      localStorage.removeItem('app_username');
      localStorage.removeItem('app_2fa_verified');
      sessionStorage.removeItem('app_is_authenticated');
      sessionStorage.removeItem('app_email');
      sessionStorage.removeItem('app_username');
      sessionStorage.removeItem('app_2fa_verified');
      apiStorage.removeItem('app_is_authenticated');
      apiStorage.removeItem('app_email');
      apiStorage.removeItem('app_username');
      apiStorage.removeItem('app_2fa_verified');
    } catch (err) {}
    
    // Set states to force immediate re-render to AuthScreen
    setIsAuthenticated(false);
    setUsername('');
  }, []);

  const [activeTab, setActiveTab] = useState<
    'signal' | 'autoBot' | 'globalScanner' | 'mtf' | 'market' | 'chart' | 'backtest' | 'analysis' | 'history' | 'riskWallet'
  >('signal');
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = apiStorage.getItem('app_language');
      if (saved && (saved === 'fr' || saved === 'ar' || saved === 'en')) return saved as Language;
    } catch {}
    return 'fr';
  });
  const languageRef = useRef<Language>(language);
  useEffect(() => { languageRef.current = language; }, [language]);
  const [timezone, setTimezone] = useState<TimezoneMode>(() => {
    try {
      const saved = apiStorage.getItem('app_timezone');
      if (saved) return saved as TimezoneMode;
    } catch {}
    return 'GMT+1';
  });
  const [isAndroidView, setIsAndroidView] = useState(false);

  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    try {
      return (apiStorage.getItem('quantura_display_mode') as DisplayMode) || 'standard';
    } catch {
      return 'standard';
    }
  });

  const [effectiveDisplayMode, setEffectiveDisplayMode] = useState<'standard' | 'compact' | 'fullscreen'>('standard');

  useEffect(() => {
    try {
      apiStorage.setItem('quantura_display_mode', displayMode);
    } catch {}

    if (displayMode === 'fullscreen') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setEffectiveDisplayMode('fullscreen');
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      
      if (displayMode === 'auto') {
        const handleResize = () => {
          const w = window.innerWidth;
          if (w < 1366) setEffectiveDisplayMode('compact');
          else setEffectiveDisplayMode('standard');
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      } else {
        setEffectiveDisplayMode(displayMode as 'standard' | 'compact');
      }
    }
  }, [displayMode]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeToastAlert, setActiveToastAlert] = useState<PushAlert | null>(null);

  const triggerToastAlert = useCallback((alert: PushAlert) => {
    if (!isAuthenticatedRef.current) return;
    setActiveToastAlert(alert);
    setTimeout(() => {
      setActiveToastAlert((curr) => (curr?.id === alert.id ? null : curr));
    }, 5000);
  }, []);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = apiStorage.getItem('app_sound_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      const saved = apiStorage.getItem('app_notifications_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const notificationsEnabledRef = useRef<boolean>(notificationsEnabled);
  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
    try {
      apiStorage.setItem('app_notifications_enabled', String(notificationsEnabled));
    } catch {}
  }, [notificationsEnabled]);

  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled((prev) => !prev);
  }, []);

  const [telegramBotToken, setTelegramBotToken] = useState<string>(() => {
    try {
      return apiStorage.getItem('app_telegram_bot_token') || '';
    } catch {}
    return '';
  });

  const [telegramChatId, setTelegramChatId] = useState<string>(() => {
    try {
      return apiStorage.getItem('app_telegram_chat_id') || '';
    } catch {}
    return '';
  });

  const telegramBotTokenRef = useRef(telegramBotToken);
  const telegramChatIdRef = useRef(telegramChatId);
  telegramBotTokenRef.current = telegramBotToken;
  telegramChatIdRef.current = telegramChatId;

  // Persist language settings and set HTML dir & lang
  useEffect(() => {
    try {
      apiStorage.setItem('app_language', language);
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    } catch {}
  }, [language]);

  // Persist telegram settings
  useEffect(() => {
    try {
      apiStorage.setItem('app_telegram_bot_token', telegramBotToken);
    } catch {}
  }, [telegramBotToken]);

  useEffect(() => {
    try {
      apiStorage.setItem('app_telegram_chat_id', telegramChatId);
    } catch {}
  }, [telegramChatId]);

  const [minConfidenceThreshold, setMinConfidenceThreshold] = useState<number>(() => {
    try {
      const saved = apiStorage.getItem('min_confidence_threshold');
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 50 && parsed <= 95) return parsed;
      }
    } catch {}
    return 75;
  });
  const [isDeveloperMode, setIsDeveloperMode] = useState<boolean>(() => {
    try {
      const saved = apiStorage.getItem('app_dev_mode');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });
  const [alerts, setAlerts] = useState<PushAlert[]>(() => {
    try {
      const saved = apiStorage.getItem('btc_push_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Binance API Integration & Real Live Trading State
  
  const [binanceConfig, setBinanceConfig] = useState<BinanceApiConfig>(() => {
    try {
      const saved = apiStorage.getItem('binance_api_config');
      return saved
        ? JSON.parse(saved)
        : {
            apiKey: '',
            apiSecret: '',
            useTestnet: false,
            isLiveModeEnabled: false,
            isConnected: false,
            accountInfo: null,
            autoTradingEnabled: false,
          };
    } catch {
      return {
        apiKey: '',
        apiSecret: '',
        useTestnet: false,
        isLiveModeEnabled: false,
        isConnected: false,
        accountInfo: null,
        autoTradingEnabled: false,
      };
    }
  });

  const [executionMode, setExecutionMode] = useState<TradingExecutionMode>(() => {
    try {
      const saved = apiStorage.getItem('trading_execution_mode');
      return (saved as TradingExecutionMode) || 'PAPER';
    } catch {
      return 'PAPER';
    }
  });

  const handleSetExecutionMode = useCallback((mode: TradingExecutionMode) => {
    setExecutionMode(mode);
    try {
      apiStorage.setItem('trading_execution_mode', mode);
    } catch {}
  }, []);

  const lastCanTradeDiagnosticRef = useRef<number>(0);
  const prevCanTradeRef = useRef<boolean | null>(null);

  // Fetch live Binance account balances (Futures / Spot) and canTrade permissions
  const fetchLiveBinanceBalance = useCallback(async () => {
    try {
      const currentMt = botConfigRef.current?.marketType || 'FUTURES';
      const res = await fetch(`/api/binance/account?marketType=${currentMt}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const canTradeStatus = data.canTrade === true;
        setBinanceConfig(prev => ({
          ...prev,
          isConnected: true,
          useTestnet: data.useTestnet !== undefined ? data.useTestnet : prev.useTestnet,
          marketType: data.marketType || prev.marketType || currentMt,
          accountInfo: {
            balances: data.balances || [],
            canTrade: canTradeStatus,
            canWithdraw: data.canWithdraw ?? false,
            canDeposit: data.canDeposit ?? true,
            updateTime: data.updateTime || Date.now(),
            accountType: data.accountType || currentMt,
            makerCommission: data.makerCommission || 0,
            takerCommission: data.takerCommission || 0,
            freeUsdt: Number(data.freeUsdt || 0),
            totalUsdtEquity: Number(data.totalUsdtEquity || data.freeUsdt || 0),
          }
        }));

        // Trigger diagnostic function if canTrade is false while API keys are configured
        if (!canTradeStatus) {
          const now = Date.now();
          // Rate-limit diagnostics to once every 2 minutes or upon status transition
          if (now - lastCanTradeDiagnosticRef.current > 120000 || prevCanTradeRef.current !== false) {
            lastCanTradeDiagnosticRef.current = now;
            const isAr = languageRef.current === 'ar';
            const diagMsg = isAr
              ? `[تشخيص أذونات Binance API] تحذير: تم الاتصال بنجاح لكن صلاحية التداول مقيدة (canTrade = false). يرجى التحقق من لوحة تحكم بايننس: 1) تفعيل 'Enable Futures' / 'Enable Spot & Margin'. 2) فحص قيود الـ IP وإضافة عنوان خادم التطبيق.`
              : `[Binance API Diagnostics] Warning: Account connected but trading permission is RESTRICTED (canTrade = false). In Binance API Management, ensure: 1) 'Enable Futures' / 'Enable Spot & Margin' is checked. 2) Server IP is whitelisted under IP restrictions.`;
            
            setBotLogs(prev => [
              {
                id: `diag-cantrade-${now}`,
                timestamp: now,
                type: 'ERROR' as any,
                symbol: `BINANCE_${data.marketType || currentMt}`,
                side: 'BUY',
                price: tickerRef.current?.price || 0,
                amountUsdt: 0,
                reason: diagMsg,
                mode: 'BINANCE_LIVE',
              },
              ...(prev || []).slice(0, 49)
            ]);
          }
        }
        prevCanTradeRef.current = canTradeStatus;
        return data;
      } else if (data.code === 'MISSING_CREDENTIALS') {
        setBinanceConfig(prev => ({
          ...prev,
          isConnected: false,
          accountInfo: null,
        }));
        prevCanTradeRef.current = null;
      }
      return data;
    } catch (err) {
      console.warn('Error polling Binance live balance:', err);
    }
  }, []);

  // Securely load config status from backend
  useEffect(() => {
    fetch('/api/config/binance')
      .then(res => res.json())
      .then(data => {
        if (data.configured) {
          setBinanceConfig(prev => ({
            ...prev,
            apiKey: prev.apiKey && !prev.apiKey.includes('...') ? prev.apiKey : '',
            apiSecret: prev.apiSecret && !prev.apiSecret.includes('...') && prev.apiSecret !== '****************' ? prev.apiSecret : '',
            useTestnet: data.useTestnet !== undefined ? data.useTestnet : prev.useTestnet,
            marketType: data.marketType || prev.marketType,
            isConnected: true
          }));
          fetchLiveBinanceBalance();
        } else {
          setBinanceConfig(prev => ({ ...prev, isConnected: false, apiKey: '', apiSecret: '' }));
        }
      })
      .catch(console.error);
  }, [fetchLiveBinanceBalance]);

  // Periodic live account & permissions polling every 5s
  useEffect(() => {
    fetchLiveBinanceBalance();
    const interval = setInterval(() => {
      fetchLiveBinanceBalance();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchLiveBinanceBalance]);


  const [isBinanceModalOpen, setIsBinanceModalOpen] = useState(false);
  const [isCustomBalanceModalOpen, setIsCustomBalanceModalOpen] = useState(false);

  // Auto-Trading Bot State
  const [botConfig, setBotConfig] = useState<AutoBotConfig>(() => {
    const defaults: AutoBotConfig = {
      enabled: false,
      activePresets: [],
      tradeAllocationPercent: 25,
      minConfidence: 75,
      mode: 'SCALE_OUT_REBUY',
      autoCompound: true,
      maxOpenTrades: 3,
      // Timeframe Strategy (AUTO adaptive or fixed)
      timeframe: 'AUTO',
      // Futures & Leverage Settings:
      marketType: 'FUTURES',
      leverage: 3,
      marginMode: 'ISOLATED',
      // Institutional Quantitative Settings:
      trailingStopEnabled: true,
      trailingStopPercent: 1.2,
      trailingActivationProfitPercent: 1.5,
      dailyDrawdownLimitPercent: 5.0, // 5% max daily loss circuit breaker
      circuitBreakerTripped: false,
      sizingMode: 'FIXED_PERCENT',
      riskPerTradePercent: 2.0,
      cooldownMinutes: 10,
      multiPairScanning: true,
      allowedSymbols: RESPECTED_TRADING_PAIRS.map(p => p.baseAsset),
    };
    try {
      const saved = apiStorage.getItem('btc_bot_config');
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
      return defaults;
    } catch {
      return defaults;
    }
  });

  // Dynamic Bot Adaptive Timeframe Info State
  const [autoBotTimeframeInfo, setAutoBotTimeframeInfo] = useState<{
    effectiveTimeframe: Timeframe;
    reasonAr: string;
    reasonEn: string;
  }>({
    effectiveTimeframe: '1h',
    reasonAr: 'فريم 1H المتوازن للمضاعفة وتأكيد الزخم',
    reasonEn: 'Standard 1H Compounding & Momentum Frame',
  });

  const [activeBotPositions, setActiveBotPositions] = useState<ActiveBotPosition[]>(() => {
    try {
      const saved = apiStorage.getItem('btc_active_bot_positions');
      let positions: ActiveBotPosition[] = [];
      if (saved) positions = JSON.parse(saved);
      else {
        // Migration from single to array
        const oldSaved = apiStorage.getItem('btc_active_bot_position');
        if (oldSaved) {
          const parsed = JSON.parse(oldSaved);
          if (parsed) positions = [parsed];
        }
      }
      // Anti-hedging deduplication: Ensure no single symbol has multiple conflicting positions (e.g., simultaneous LONG & SHORT)
      const sanitizedMap = new Map<string, ActiveBotPosition>();
      for (const pos of positions) {
        const symKey = (pos.symbol || 'BTCUSDT').toLowerCase();
        if (!sanitizedMap.has(symKey)) {
          sanitizedMap.set(symKey, pos);
        } else {
          // Keep the newest opened position only
          const existing = sanitizedMap.get(symKey)!;
          if ((pos.openedAt || 0) > (existing.openedAt || 0)) {
            sanitizedMap.set(symKey, pos);
          }
        }
      }
      return Array.from(sanitizedMap.values());
    } catch {
      return [];
    }
  });

  const [botLogs, setBotLogs] = useState<AutoTradeLog[]>(() => {
    try {
      const saved = apiStorage.getItem('btc_bot_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addBotLog = useCallback((newLog: AutoTradeLog) => {
    setBotLogs((prev) => [newLog, ...(prev || []).slice(0, 49)]);
    
    if (telegramBotTokenRef.current && telegramChatIdRef.current) {
      const modeText = newLog.mode === 'BINANCE_LIVE' ? 'LIVE' : 'PAPER';
      const pnlText = newLog.pnlUsdt ? `\nPnL: $${newLog.pnlUsdt.toFixed(2)}` : '';
      const message = `<b>Quantura Bot Action (${modeText})</b>\n\nPair: ${newLog.symbol}\nAction: ${newLog.type}\nReason: ${newLog.reason}\nPrice: $${newLog.price}${pnlText}`;
      sendTelegramMessage(telegramBotTokenRef.current, telegramChatIdRef.current, message);
    }
  }, []);

  // Selected Trading Pair (Supports BTC + 6 Respected Pairs)
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => {
    try {
      const saved = apiStorage.getItem('selected_trading_pair');
      return saved || 'BTCUSDT';
    } catch {
      return 'BTCUSDT';
    }
  });

  // Market & Trading State (Default 1h for optimal compounding & momentum)
  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    try {
      const saved = apiStorage.getItem('app_trading_timeframe');
      if (saved && ['5m', '15m', '30m', '1h', '4h', '1d', '1w'].includes(saved)) {
        return saved as Timeframe;
      }
    } catch {}
    return '1h';
  });
  const [ticker, setTicker] = useState<BinanceTicker | null>(null);
  const tickerRef = useRef<BinanceTicker | null>(null);
  useEffect(() => { tickerRef.current = ticker; }, [ticker]);
  const [klines, setKlines] = useState<KlineCandle[]>([]);
  const [marketData, setMarketData] = useState<MarketDataResponse | null>(null);
  const marketDataRef = useRef<MarketDataResponse | null>(null);
  useEffect(() => { marketDataRef.current = marketData; }, [marketData]);
  const [activeSignal, setActiveSignal] = useState<AIAnalysisResult | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Trade History & Paper Wallet (Saved in localStorage)
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>(() => {
    try {
      const saved = apiStorage.getItem('btc_trade_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [paperWallet, setPaperWallet] = useState<PaperWallet>(() => {
    try {
      const saved = apiStorage.getItem('btc_paper_wallet');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          balance: typeof parsed?.balance === 'number' ? parsed.balance : 1000,
          realizedPnl: typeof parsed?.realizedPnl === 'number' ? parsed.realizedPnl : 0,
          openPosition: parsed?.openPosition || null,
          history: Array.isArray(parsed?.history) ? parsed.history : [],
        };
      }
      return {
        balance: 1000,
        realizedPnl: 0,
        openPosition: null,
        history: [],
      };
    } catch {
      return {
        balance: 1000,
        realizedPnl: 0,
        openPosition: null,
        history: [],
      };
    }
  });

  // Real-Time Liquidity Assessment for Active Pair & Signal
  const liquidityAssessment = React.useMemo(() => {
    return LiquidityMonitor.evaluateLiquidity({
      symbol: selectedSymbol,
      orderBook: marketData?.orderBook || null,
      ticker: ticker,
      activeSignal: activeSignal,
      botConfig: botConfig,
      accountEquity: paperWallet.balance + activeBotPositions.reduce((acc, p) => acc + (p.marginUsdt || 0), 0),
    });
  }, [selectedSymbol, marketData?.orderBook, ticker, activeSignal, botConfig, paperWallet.balance, activeBotPositions]);

  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';

  const handleUpdateCustomBalance = (newBalance: number, resetHistory?: boolean) => {
    if (resetHistory) {
      updateBotPositionsSync((prev) => prev.filter((p) => p.mode === 'BINANCE_LIVE'));
      updatePaperWalletSync(() => ({
        balance: newBalance,
        realizedPnl: 0,
        openPosition: null,
        history: [],
      }));
    } else {
      const activePaperPositions = (activeBotPositionsRef.current || []).filter((p) => !p.mode || p.mode === 'PAPER');
      const inTradeMargin = activePaperPositions.reduce(
        (sum, p) => sum + (typeof p.remainingAmountUsdt === 'number' && p.remainingAmountUsdt >= 0 ? p.remainingAmountUsdt : (p.marginUsdt || p.initialAmountUsdt || 0)),
        0
      );
      const freeBalance = Math.max(0, newBalance - inTradeMargin);
      updatePaperWalletSync((prev) => ({
        ...prev,
        balance: freeBalance,
      }));
    }
  };

  // Save bot state, history and wallet changes to localStorage
  useEffect(() => {
    
    const safeConfig = { ...binanceConfig, apiSecret: '' };
    apiStorage.setItem('binance_api_config', JSON.stringify(safeConfig));
  
  }, [binanceConfig]);

  useEffect(() => {
    apiStorage.setItem('trading_execution_mode', executionMode);
  }, [executionMode]);

  useEffect(() => {
    apiStorage.setItem('btc_bot_config', JSON.stringify(botConfig));
  }, [botConfig]);

  // (activeBotPositions, paperWallet, tradeHistory, and botLogs are explicitly pushed where modified to prevent race conditions and overwrites between client and server)

  useEffect(() => {
    apiStorage.setItem('btc_push_alerts', JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    try {
      apiStorage.setItem('min_confidence_threshold', minConfidenceThreshold.toString());
    } catch {}
  }, [minConfidenceThreshold]);

  useEffect(() => {
    try {
      apiStorage.setItem('app_language', language);
    } catch {}
  }, [language]);

  useEffect(() => {
    try {
      apiStorage.setItem('app_timezone', timezone);
    } catch {}
  }, [timezone]);

  useEffect(() => {
    try {
      apiStorage.setItem('app_sound_enabled', soundEnabled.toString());
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    try {
      apiStorage.setItem('app_dev_mode', isDeveloperMode.toString());
    } catch {}
  }, [isDeveloperMode]);

  // Audio Play helper
  const playAudioChime = useCallback(() => {
    if (!soundEnabled || !isAuthenticatedRef.current) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      // Audio might be blocked by browser policy until first user interaction
    }
  }, [soundEnabled]);

  // Synchronized refs for real-time engine evaluation without causing re-render loops
  const binanceConfigRef = useRef<BinanceApiConfig>(binanceConfig);
  binanceConfigRef.current = binanceConfig;

  const executionModeRef = useRef<TradingExecutionMode>(executionMode);
  executionModeRef.current = executionMode;

  const activeBotPositionsRef = useRef<ActiveBotPosition[]>(activeBotPositions);
  useEffect(() => {
    activeBotPositionsRef.current = activeBotPositions;
  }, [activeBotPositions]);

  // Set of closed position IDs to prevent them from reappearing due to polling race conditions
  const recentlyClosedPositionIdsRef = useRef<Set<string>>(new Set<string>());

  const updateBotPositionsSync = useCallback((updater: (prev: ActiveBotPosition[]) => ActiveBotPosition[]) => {
    const rawUpdated = updater(activeBotPositionsRef.current);
    // Filter out any positions that have been marked as closed
    const safeUpdated = rawUpdated.filter(p => !recentlyClosedPositionIdsRef.current.has(p.id));
    activeBotPositionsRef.current = safeUpdated;
    setActiveBotPositions([...safeUpdated]);
    // Explicitly update storage to avoid useEffect infinite loops / race conditions
    apiStorage.setItem('btc_active_bot_positions', JSON.stringify(safeUpdated));
  }, []);

  const updatePaperWalletSync = useCallback((updater: (prev: PaperWallet) => PaperWallet) => {
    paperWalletRef.current = updater(paperWalletRef.current);
    setPaperWallet({ ...paperWalletRef.current });
    try {
      apiStorage.setItem('btc_paper_wallet', JSON.stringify(paperWalletRef.current));
    } catch {}
  }, []);

  const isOpeningTradeRef = useRef<boolean>(false);


  const botConfigRef = useRef<AutoBotConfig>(botConfig);
  botConfigRef.current = botConfig;
  const lastConfigUpdateRef = useRef<number>(0);

  const tradeHistoryRef = useRef<TradeHistoryItem[]>(tradeHistory);
  useEffect(() => {
    tradeHistoryRef.current = tradeHistory;
  }, [tradeHistory]);

  const activeSignalRef = useRef<AIAnalysisResult | null>(activeSignal);
  activeSignalRef.current = activeSignal;

  const paperWalletRef = useRef<PaperWallet>(paperWallet);
  useEffect(() => {
    paperWalletRef.current = paperWallet;
  }, [paperWallet]);

  const selectedSymbolRef = useRef<string>(selectedSymbol);
  selectedSymbolRef.current = selectedSymbol;

  const timeframeRef = useRef<Timeframe>(timeframe);
  timeframeRef.current = timeframe;

  const isDeveloperModeRef = useRef<boolean>(isDeveloperMode);
  isDeveloperModeRef.current = isDeveloperMode;

  const minConfidenceThresholdRef = useRef<number>(minConfidenceThreshold);
  minConfidenceThresholdRef.current = minConfidenceThreshold;

  const botLogsRef = useRef<AutoTradeLog[]>(botLogs);
  botLogsRef.current = botLogs;

  const lastClosedTimesBySymbolRef = useRef<Record<string, number>>({});
  const lastEmittedAlertKeyRef = useRef<Record<string, string>>({});
  const lastEmittedAlertTimeRef = useRef<Record<string, number>>({});
  const processedScannerSignalIdsRef = useRef<Set<string>>(new Set());
  const lastTradedSignalKeyRef = useRef<string>('');
  const lastBotActionTimeRef = useRef<number>(0);

  // Emit Push Alert helper
  const pushNewAlert = useCallback(
    (plan: AIAnalysisResult, isUserInitiated: boolean = false, overrideSymbol?: string) => {
      if (!plan || !isAuthenticatedRef.current) return;

      const tf = plan.recommendedTimeframe || (botConfigRef.current?.timeframe !== 'AUTO' ? botConfigRef.current?.timeframe : '1h') || '1h';
      const isArabic = language === 'ar';
      const isEn = language === 'en';
      const sym = overrideSymbol || selectedSymbolRef.current;
      const pairName = formatPairName(sym);
      const strategyLabel = plan.marketRegime ? ` [${plan.marketRegime}]` : '';

      // Deduplication key: decision + symbol + timeframe + strategy regime
      // We normalize the key by symbol, direction and regime to avoid microscopic price ticks breaking deduplication
      const alertKey = `${plan.decision}_${sym}_${tf}_${plan.marketRegime || 'DEFAULT'}`;
      const now = Date.now();
      const lastEmittedTime = lastEmittedAlertTimeRef.current[sym] || 0;
      const MIN_ALERT_COOLDOWN_MS = 90 * 1000; // 90 seconds minimum cooldown between alerts for the same symbol

      // If this is an automatic background refresh and the trade recommendation is identical or within cooldown, do NOT duplicate the notification
      if (!isUserInitiated) {
        if (lastEmittedAlertKeyRef.current[sym] === alertKey && now - lastEmittedTime < 300 * 1000) {
          return;
        }
        if (now - lastEmittedTime < MIN_ALERT_COOLDOWN_MS) {
          return;
        }
      }

      lastEmittedAlertKeyRef.current[sym] = alertKey;
      lastEmittedAlertTimeRef.current[sym] = now;

      let title = '';
      let body = '';

      if (plan.decision === 'LONG') {
        title = isArabic
          ? `[${pairName}] توصية صفقة شراء (BUY / LONG)${strategyLabel} • ${tf}`
          : isEn
          ? `[${pairName}] BUY Signal (LONG)${strategyLabel} • ${tf}`
          : `[${pairName}] Signal ACHAT (LONG)${strategyLabel} • ${tf}`;
      } else if (plan.decision === 'SHORT') {
        title = isArabic
          ? `[${pairName}] توصية صفقة بيع (SELL / SHORT)${strategyLabel} • ${tf}`
          : isEn
          ? `[${pairName}] SELL Signal (SHORT)${strategyLabel} • ${tf}`
          : `[${pairName}] Signal VENTE (SHORT)${strategyLabel} • ${tf}`;
      } else {
        title = isArabic
          ? `[${pairName}] تنبيه مراقبة عادي (WAIT)${strategyLabel} • ${tf}`
          : isEn
          ? `[${pairName}] Market Notice (WAIT)${strategyLabel} • ${tf}`
          : `[${pairName}] Alerte Marché (ATTENTE)${strategyLabel} • ${tf}`;
      }

      const marketTypeNote = plan.decision === 'LONG'
        ? (isArabic ? 'السوق: SPOT (1x) أو FUTURES (3x-5x)' : 'Marché: SPOT (1x) ou FUTURES (3x-5x)')
        : plan.decision === 'SHORT'
        ? (isArabic ? 'السوق: FUTURES فقط (3x-5x)' : 'Marché: FUTURES Uniquement (3x-5x)')
        : (isArabic ? 'حالة الترقب والانتظار' : 'Observation');

      if (plan.entryZone && plan.targets && plan.stopLoss) {
        body = isArabic
          ? `زوج العملة: ${pairName} | ${marketTypeNote} | الدخول: $${plan.entryZone.ideal.toLocaleString()} | TP1: $${plan.targets.tp1.toLocaleString()} | TP2: $${plan.targets.tp2.toLocaleString()} | TP3: $${plan.targets.tp3.toLocaleString()} | وقف الخسارة: $${plan.stopLoss.toLocaleString()} | القوة: ${plan.confidence}%`
          : `Paire: ${pairName} | ${marketTypeNote} | Entrée: $${plan.entryZone.ideal.toLocaleString()} | TP1: $${plan.targets.tp1.toLocaleString()} | TP2: $${plan.targets.tp2.toLocaleString()} | TP3: $${plan.targets.tp3.toLocaleString()} | SL: $${plan.stopLoss.toLocaleString()} | Confiance: ${plan.confidence}%`;
      } else {
        body = isArabic
          ? `زوج العملة: ${pairName} | حالة السوق: ${plan.marketRegime} | قوة التحليل: ${plan.confidence}%`
          : `Paire: ${pairName} | Régime: ${plan.marketRegime} | Score: ${plan.confidence}%`;
      }

      const newAlert: PushAlert = {
        id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title,
        body,
        timestamp: Date.now(),
        type: 'SIGNAL',
        decision: plan.decision,
        symbol: sym,
        read: false,
      };

      // Always record in alert history log
      setAlerts((prev) => [newAlert, ...(prev || []).slice(0, 49)]);

      // Only trigger UI toast and sound if notifications are enabled or user specifically requested it
      if (notificationsEnabledRef.current || isUserInitiated) {
        triggerToastAlert(newAlert);
        playAudioChime();
      }
      
      // Telegram Notification
      if (telegramBotTokenRef.current && telegramChatIdRef.current) {
        const tgMessage = `<b>${title}</b>\n\n${body}`;
        sendTelegramMessage(telegramBotTokenRef.current, telegramChatIdRef.current, tgMessage);
      }

      // Native Browser Notification (if granted and enabled)
      if (notificationsEnabledRef.current && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
          });
        } catch {
          // Ignore notification errors in iframe environment
        }
      }
    },
    [language, playAudioChime]
  );

  // -------------------------------------------------------------
  // BINANCE LIVE TRADING DISPATCH HELPER
  // -------------------------------------------------------------
  const executeBinanceLiveOrder = async (
    symbol: string,
    side: 'BUY' | 'SELL',
    quoteOrderQty?: number,
    quantity?: number,
    currentPrice?: number
  ) => {
    // Dynamic precision based on price heuristic to avoid Binance LOT_SIZE errors
    let formattedQty = quantity;
    if (quantity && currentPrice) {
      if (currentPrice > 1000) formattedQty = Number(quantity.toFixed(3)); // BTC, ETH
      else if (currentPrice > 10) formattedQty = Number(quantity.toFixed(1)); // SOL, BNB
      else if (currentPrice > 1) formattedQty = Math.floor(quantity); // low price coins
      else formattedQty = Math.floor(quantity); // DOGE, SHIB, PEPE etc
    } else if (quantity) {
      formattedQty = Number(quantity.toFixed(3)); // fallback
    }
    const currentBinanceConfig = binanceConfigRef.current;
    if (!currentBinanceConfig.apiKey || !currentBinanceConfig.apiSecret) {
      return { success: false, error: 'Binance API Key or Secret not configured.' };
    }
    try {
      const res = await fetch('/api/binance/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: currentBinanceConfig.apiKey,
          apiSecret: currentBinanceConfig.apiSecret,
          useTestnet: currentBinanceConfig.useTestnet,
          marketType: currentBinanceConfig.marketType,
          symbol,
          side,
          type: 'MARKET',
          ...(quoteOrderQty ? { quoteOrderQty: Number(Math.max(10, quoteOrderQty).toFixed(2)) } : {}),
          ...(formattedQty ? { quantity: formattedQty } : {}),
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error communicating with Binance API.' };
    }
  };

  // -------------------------------------------------------------
  // AUTOMATED TRADING BOT ENGINE (Futures & Spot Multi-Position & Multi-Coin Engine)
  // -------------------------------------------------------------
  const executeAutoTradeAction = useCallback(
    async (
      actionType: 'OPEN' | 'TP1' | 'TP2' | 'TP3' | 'REBUY' | 'SL' | 'LIQUIDATION',
      currentP: number,
      customReason?: string,
      targetPosId?: string,
      customDecision?: 'LONG' | 'SHORT',
      overrideSignal?: AIAnalysisResult,
      overrideSymbol?: string
    ) => {
      if (!currentP || currentP <= 0) return;

      const isArabicLang = language === 'ar';
      const currentPositions = activeBotPositionsRef.current;
      const signal = overrideSignal || activeSignalRef.current;
      const currentWallet = paperWalletRef.current;
      const currentConfig = botConfigRef.current;
      const currentSym = overrideSymbol || selectedSymbolRef.current;
      const isLiveMode = executionModeRef.current === 'BINANCE_LIVE';
      const currentBinance = binanceConfigRef.current;

      // 1. OPEN NEW POSITION (FUTURES or SPOT)
      if (actionType === 'OPEN' && (customDecision || (signal && (signal.decision === 'LONG' || signal.decision === 'SHORT')))) {
        if (isOpeningTradeRef.current) return;
        isOpeningTradeRef.current = true;
        try {
          // Circuit Breaker check
          if (currentConfig.circuitBreakerTripped) return;

          // Advanced Slippage & Spread Protection
          if (currentConfig.maxSlippageSpreadPercent && marketDataRef.current) {
            let effectiveSlippage = 0;
            const md = marketDataRef.current;
            if (md.orderBook && md.orderBook.topBids.length > 0 && md.orderBook.topAsks.length > 0) {
              const bestBid = md.orderBook.topBids[0].price;
              const bestAsk = md.orderBook.topAsks[0].price;
              effectiveSlippage = ((bestAsk - bestBid) / bestBid) * 100;
            } else if (md.indicators) {
              effectiveSlippage = (md.indicators.atr14 / currentP) * 100 * 0.15; // fallback ATR proxy
            }
            if (effectiveSlippage > currentConfig.maxSlippageSpreadPercent && !customDecision) {
              const rejectMsg = isArabicLang
                ? `رفض التداول: الانزلاق أو السبريد مرتفع جداً (${effectiveSlippage.toFixed(2)}% > ${currentConfig.maxSlippageSpreadPercent}%)`
                : `Trade Blocked: Slippage/Spread too high (${effectiveSlippage.toFixed(2)}% > limit ${currentConfig.maxSlippageSpreadPercent}%)`;
              addBotLog({
                id: `log-rejected-slip-${Date.now()}`,
                timestamp: Date.now(),
                type: 'ERROR' as any,
                symbol: currentSym,
                side: (customDecision || signal?.decision) === 'LONG' ? 'BUY' : 'SELL',
                price: currentP,
                amountUsdt: 0,
                reason: rejectMsg,
                mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
                marketType: currentConfig.marketType || 'FUTURES',
                leverage: currentConfig.leverage || 1,
              });
              return;
            }
          }

        const decision: 'LONG' | 'SHORT' = customDecision || (signal?.decision === 'SHORT' ? 'SHORT' : 'LONG');
        // Re-read synchronously to prevent concurrent open race conditions
        let workingPositions = [...activeBotPositionsRef.current];
        const modePositions = workingPositions.filter(p => isLiveMode ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));

        // Anti-hedging and duplicate check: Check if there is already an active position for this symbol
        const normCurrentSym = normalizeSymbol(currentSym);
        const existingPos = modePositions.find(p => normalizeSymbol(p.symbol) === normCurrentSym);
        if (existingPos) {
          // If already open in the same direction, prevent duplicate entry
          if (existingPos.decision === decision) {
            return;
          }

          // CONFLICT RESOLUTION (ANTI-HEDGING / POSITION FLIP):
          // An opposing trade is requested (e.g. was LONG and new is SHORT).
          // Immediately close the existing opposing position first so there is NEVER simultaneous LONG & SHORT on the same pair!
          const isPrevLong = existingPos.decision === 'LONG';
          const prevLev = existingPos.leverage || 1;
          const prevPriceDiffPct = ((currentP - existingPos.entryPrice) / existingPos.entryPrice) * (isPrevLong ? 1 : -1) * 100;
          const prevRoePercent = prevPriceDiffPct * prevLev;
          const prevPnlUsdt = existingPos.remainingAmountUsdt * (prevRoePercent / 100);
          const prevTotalTradePnlUsdt = existingPos.realizedPnlUsdt + prevPnlUsdt;
          const prevCashReturned = Math.max(0, existingPos.remainingAmountUsdt + prevPnlUsdt);

          if (isLiveMode && currentBinance.isConnected) {
            executeBinanceLiveOrder(existingPos.symbol, isPrevLong ? 'SELL' : 'BUY', existingPos.remainingAmountUsdt * prevLev, existingPos.remainingAmountBtc, currentP).catch(() => {});
          } else {
            updatePaperWalletSync((prev) => ({
              ...prev,
              balance: prev.balance + prevCashReturned,
              realizedPnl: prev.realizedPnl + prevPnlUsdt,
            }));
          }

          const closedReversalItem: TradeHistoryItem = {
            id: `history-flip-${Date.now()}`,
            timestamp: Date.now(),
            symbol: existingPos.symbol,
            decision: existingPos.decision,
            timeframe: timeframe,
            entryPrice: existingPos.entryPrice,
            exitPrice: currentP,
            tp1: existingPos.tp1,
            tp2: existingPos.tp2,
            tp3: existingPos.tp3,
            stopLoss: existingPos.stopLoss,
            status: 'MANUAL_EXIT',
            profitPercent: prevRoePercent,
            profitUsdt: prevTotalTradePnlUsdt,
            confidence: 80,
          strategyName: existingPos.strategyName,
          pnlHistory: existingPos.pnlHistory,
            reason: isArabicLang 
              ? `انعكاس الإشارة: إغلاق تلقائي لـ ${existingPos.decision} للدخول في ${decision}` 
              : `Signal Reversal: Auto-closed ${existingPos.decision} to enter ${decision}`,
          };
          setTradeHistory((prev) => [closedReversalItem, ...(prev || [])].slice(0, 500));

          addBotLog({
            id: `log-flip-${Date.now()}`,
            timestamp: Date.now(),
            type: 'AUTO_SL',
            symbol: existingPos.symbol,
            side: isPrevLong ? 'SELL' : 'BUY',
            price: currentP,
            amountUsdt: existingPos.remainingAmountUsdt * prevLev,
            pnlUsdt: prevPnlUsdt,
            pnlPercent: prevRoePercent,
            reason: isArabicLang 
              ? `انعكاس الاتجاه: إغلاق ${existingPos.decision} وفتح ${decision} فورياً` 
              : `Position Flip: Auto-closed ${existingPos.decision} before entering ${decision}`,
            mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
            marketType: existingPos.marketType,
            leverage: prevLev,
          });

          // Remove the opposing position
          workingPositions = workingPositions.filter(p => p.id !== existingPos.id);
        }

        // Anti-overtrading Cooldown check (per symbol)
        const lastClosedTime = lastClosedTimesBySymbolRef.current[normCurrentSym] || 0;
        const cooldownMs = (currentConfig.cooldownMinutes || 10) * 60 * 1000;
        if (Date.now() - lastClosedTime < cooldownMs && !customDecision && !existingPos) return;

        const isFutures = (currentConfig.marketType || 'FUTURES') === 'FUTURES';
        let leverage = isFutures ? Math.max(1, currentConfig.leverage || 10) : 1;
        const marginMode = currentConfig.marginMode || 'ISOLATED';

        const maxTrades = Math.max(1, currentConfig.maxOpenTrades || 3);
        const currentModePositions = workingPositions.filter(p => isLiveMode ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
        if (currentModePositions.length >= maxTrades) {
          const rejectMsg = isArabicLang
            ? `تم رفض فتح الصفقة: تم بلوغ الحد الأقصى للصفقات المتزامنة المسموح بها (${currentModePositions.length}/${maxTrades} صفقات مفتوحة). لن يتم فتح أي صفقة جديدة.`
            : `Trade Opening Blocked: Maximum open trades limit reached (${currentModePositions.length}/${maxTrades} active positions). No new trades can be opened.`;

          addBotLog({
            id: `log-rejected-${Date.now()}`,
            timestamp: Date.now(),
            type: 'ERROR' as any,
            symbol: currentSym,
            side: decision === 'LONG' ? 'BUY' : 'SELL',
            price: currentP,
            amountUsdt: 0,
            reason: rejectMsg,
            mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
            marketType: isFutures ? 'FUTURES' : 'SPOT',
            leverage,
          });

          const rejectAlert: PushAlert = {
            id: `alert-max-reached-${Date.now()}`,
            title: isArabicLang ? 'تم رفض فتح الصفقة (اكتمال الحد)' : 'Trade Rejected (Max Slots Reached)',
            body: rejectMsg,
            timestamp: Date.now(),
            type: 'SYSTEM',
            decision,
            symbol: currentSym,
            price: currentP,
            read: false,
          };
          setAlerts((prev) => [rejectAlert, ...(prev || []).slice(0, 29)]);
          triggerToastAlert(rejectAlert);
          playAudioChime();
          return;
        }

        let strategyName = 'Custom';
        
        if (currentConfig.activePresets && currentConfig.activePresets.length > 0) {
          const firstPreset = String(currentConfig.activePresets[0] || 'Custom');
          if (currentConfig.activePresets.length === 1) {
            strategyName = firstPreset.charAt(0) + firstPreset.slice(1).toLowerCase();
            if (isFutures) {
              if (firstPreset === 'SCALPER') leverage = currentConfig.leverage || 5;
              else if (firstPreset === 'BREAKOUT') leverage = currentConfig.leverage || 4;
              else if (firstPreset === 'MOMENTUM') leverage = currentConfig.leverage || 3;
              else if (firstPreset === 'MEAN_REVERSION') leverage = currentConfig.leverage || 3;
              else if (firstPreset === 'SWING') leverage = currentConfig.leverage || 2;
              else if (firstPreset === 'INSTITUTIONAL_SMC') leverage = currentConfig.leverage || 2;
              else leverage = currentConfig.leverage || leverage;
            }
          } else {
            // Multi-Strategy Mode: Determine specific strategy based on signal timeframe
            const tf = currentConfig.timeframe === 'AUTO' ? (autoBotTimeframeInfo?.effectiveTimeframe || timeframeRef.current) : (currentConfig.timeframe || timeframeRef.current);
            if (tf === '15m' || tf === '5m') {
              strategyName = 'Scalper';
              if (isFutures) leverage = currentConfig.activePresets.includes('SCALPER') ? (currentConfig.leverage || 5) : leverage;
            } else if (tf === '30m') {
              strategyName = 'Breakout';
              if (isFutures) leverage = currentConfig.activePresets.includes('BREAKOUT') ? (currentConfig.leverage || 4) : leverage;
            } else if (tf === '1h') {
              strategyName = 'Momentum';
              if (isFutures) leverage = currentConfig.activePresets.includes('MOMENTUM') ? (currentConfig.leverage || 3) : leverage;
            } else if (tf === '4h' || tf === '1d') {
              strategyName = 'Swing';
              if (isFutures) leverage = currentConfig.activePresets.includes('SWING') ? (currentConfig.leverage || 2) : leverage;
            } else {
              strategyName = 'Multi-Strategy';
              if (isFutures) leverage = currentConfig.leverage || leverage;
            }
          }
        } else if (currentConfig.timeframe === 'AUTO') {
          strategyName = 'Multi-Strategy';
          if (isFutures) leverage = currentConfig.leverage || leverage;
        }

        const totalEquity = isLiveMode && currentBinance.accountInfo?.totalUsdtEquity
          ? currentBinance.accountInfo.totalUsdtEquity
          : currentWallet.balance + currentModePositions.reduce((sum, pos) => sum + (typeof pos.remainingAmountUsdt === 'number' && pos.remainingAmountUsdt >= 0 ? pos.remainingAmountUsdt : (pos.marginUsdt || pos.initialAmountUsdt || 0)), 0);

        const availableBalance = isLiveMode && currentBinance.accountInfo?.freeUsdt
          ? currentBinance.accountInfo.freeUsdt
          : currentWallet.balance;

        const entryPrice = currentP;

        // CRITICAL VALIDATION: Signal targets must belong to THIS pair and have sensible prices and directions
        const isSignalValidForPair = !!(
          signal &&
          signal.targets &&
          signal.targets.tp1 &&
          signal.targets.tp2 &&
          signal.targets.tp3 &&
          Math.abs(((signal.currentPrice || entryPrice) - entryPrice) / entryPrice) < 0.15 &&
          (decision === 'LONG'
            ? (signal.targets.tp1 > entryPrice && signal.targets.tp2 > signal.targets.tp1 && signal.targets.tp3 > signal.targets.tp2 && (!signal.stopLoss || signal.stopLoss < entryPrice))
            : (signal.targets.tp1 < entryPrice && signal.targets.tp2 < signal.targets.tp1 && signal.targets.tp3 < signal.targets.tp2 && (!signal.stopLoss || signal.stopLoss > entryPrice)))
        );

        let tp1 = (isSignalValidForPair && signal?.targets?.tp1) ? signal.targets.tp1 : (decision === 'LONG' ? entryPrice * 1.015 : entryPrice * 0.985);
        let tp2 = (isSignalValidForPair && signal?.targets?.tp2) ? signal.targets.tp2 : (decision === 'LONG' ? entryPrice * 1.03 : entryPrice * 0.97);
        let tp3 = (isSignalValidForPair && signal?.targets?.tp3) ? signal.targets.tp3 : (decision === 'LONG' ? entryPrice * 1.05 : entryPrice * 0.95);
        let stopLoss = (isSignalValidForPair && signal?.stopLoss) ? signal.stopLoss : (decision === 'LONG' ? entryPrice * 0.985 : entryPrice * 1.015);

        // Position sizing logic: Calculate Margin allocated
        let tradeMargin = 0;
        let effectiveLeverage = leverage;
        const slDistancePct = Math.max(0.003, Math.abs(entryPrice - stopLoss) / entryPrice);

        // Clamping leverage to guarantee liquidation price can NEVER occur before Stop Loss
        if (isFutures && effectiveLeverage > 1) {
          const maxSafeLeverage = Math.max(1, Math.floor(1 / (slDistancePct + 0.008)));
          if (effectiveLeverage > maxSafeLeverage) {
            effectiveLeverage = Math.max(1, Math.min(effectiveLeverage, maxSafeLeverage));
          }
        }

        const allocPercent = Math.max(5, Math.min(100, Number(currentConfig.tradeAllocationPercent) || 25));

        if (currentConfig.sizingMode === 'RISK_BASED') {
          const targetRiskUsdt = totalEquity * ((currentConfig.riskPerTradePercent || 2.0) / 100);
          const notionalSize = targetRiskUsdt / slDistancePct;
          tradeMargin = notionalSize / effectiveLeverage;
          tradeMargin = Math.min(tradeMargin, totalEquity * 0.45); // Max 45% of portfolio per position
        } else {
          // Standard FIXED_PERCENT: Allocate exact percentage of total portfolio equity
          tradeMargin = Math.round((totalEquity * (allocPercent / 100)) * 100) / 100;
        }

        // Cap at available balance if necessary
        if (tradeMargin > availableBalance) {
          tradeMargin = Math.round(availableBalance * 100) / 100;
        }

        if (tradeMargin < 5) return;

        const positionSizeUsdt = Math.round((tradeMargin * effectiveLeverage) * 100) / 100;
        const amountCrypto = positionSizeUsdt / entryPrice;

        // Liquidation Price calculation for Futures (Isolated Margin, ~0.5% MMR)
        let liquidationPrice: number | undefined;
        if (isFutures && effectiveLeverage > 1) {
          const mmr = 0.005; // 0.5% maintenance margin
          if (decision === 'LONG') {
            liquidationPrice = entryPrice * Math.max(0.001, (1 - (1 / effectiveLeverage) + mmr));
            // Safety invariant: Ensure Stop Loss is strictly above Liquidation Price
            if (stopLoss <= liquidationPrice) {
              stopLoss = Math.round((liquidationPrice * 1.01) * 100) / 100;
            }
          } else {
            liquidationPrice = entryPrice * (1 + (1 / effectiveLeverage) - mmr);
            // Safety invariant: Ensure Stop Loss is strictly below Liquidation Price
            if (stopLoss >= liquidationPrice) {
              stopLoss = Math.round((liquidationPrice * 0.99) * 100) / 100;
            }
          }
        }

        const newPos: ActiveBotPosition = {
          id: `bot-pos-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          symbol: currentSym,
          decision,
          entryPrice,
          currentPrice: entryPrice,
          initialAmountUsdt: tradeMargin, // Margin invested
          remainingAmountUsdt: tradeMargin,
          marginUsdt: tradeMargin,
          positionSizeUsdt: positionSizeUsdt,
          initialAmountBtc: amountCrypto, // Total contract size in crypto units
          remainingAmountBtc: amountCrypto,
          leverage: effectiveLeverage,
          tp1,
          tp2,
          tp3,
          stopLoss,
          initialStopLoss: stopLoss,
          liquidationPrice,
          marketType: isFutures ? 'FUTURES' : 'SPOT',
          marginMode: currentConfig.marginMode || 'ISOLATED',
          tp1Hit: false,
          tp2Hit: false,
          tp3Hit: false,
          rebuysCount: 0,
          openedAt: Date.now(),
          strategyName,
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
          lastAction: isArabicLang
            ? (isFutures
                ? `فتح عقد آجل ${decision} برافعة ${effectiveLeverage}x عند $${entryPrice.toLocaleString()}`
                : `تم الشراء الفوري عند $${entryPrice.toLocaleString()}`)
            : (isFutures
                ? `Opened ${decision} Futures ${effectiveLeverage}x at $${entryPrice.toLocaleString()}`
                : `Spot Buy at $${entryPrice.toLocaleString()}`),
          realizedPnlUsdt: 0,
          pnlHistory: [0],
          peakPrice: entryPrice,
          isTrailingActive: false,
          trailingStopPrice: stopLoss,
        };

        lastBotActionTimeRef.current = Date.now() + 2000;
        if (signal) {
          lastTradedSignalKeyRef.current = `${decision}_${currentSym}_${Math.round(signal.entryZone?.ideal || 0)}_${Math.round(signal.stopLoss || 0)}`;
        }

        // Strict single-position-per-symbol update with HARD CAP enforcement
        let tradeBlockedByHardCap = false;
        updateBotPositionsSync((prev) => {
          const filteredPrev = prev.filter((p) => normalizeSymbol(p.symbol) !== normCurrentSym);
          const activeInMode = filteredPrev.filter(p => isLiveMode ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
          if (activeInMode.length >= maxTrades) {
            tradeBlockedByHardCap = true;
            return prev; // Strictly refuse to add new position beyond maxTrades
          }
          return [newPos, ...filteredPrev];
        });

        if (tradeBlockedByHardCap) {
          const rejectMsg = isArabicLang
            ? `تم منع فتح الصفقة بالحد الصارم: تم الوصول إلى ${maxTrades} صفقات مفتوحة كحد أقصى.`
            : `Hard Cap Block: Maximum open positions (${maxTrades}) reached.`;
          addBotLog({
            id: `log-cap-blocked-${Date.now()}`,
            timestamp: Date.now(),
            type: 'ERROR' as any,
            symbol: currentSym,
            side: decision === 'LONG' ? 'BUY' : 'SELL',
            price: entryPrice,
            amountUsdt: 0,
            reason: rejectMsg,
            mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
            marketType: isFutures ? 'FUTURES' : 'SPOT',
            leverage: effectiveLeverage,
          });
          return;
        }

        if (isLiveMode && currentBinance.isConnected) {
          executeBinanceLiveOrder(currentSym, decision === 'LONG' ? 'BUY' : 'SELL', positionSizeUsdt, amountCrypto, entryPrice).catch(() => {});
        } else {
          updatePaperWalletSync((prev) => ({
            ...prev,
            balance: Math.max(0, prev.balance - tradeMargin),
          }));
        }

        const newLog: AutoTradeLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'AUTO_BUY',
          symbol: currentSym,
          side: decision === 'LONG' ? 'BUY' : 'SELL',
          price: entryPrice,
          amountUsdt: positionSizeUsdt,
          marginUsdt: tradeMargin,
          strategyName: strategyName,
          reason: customReason || (isArabicLang 
            ? `${isFutures ? 'عقد آجل ' + effectiveLeverage + 'x' : 'فوري'} | الهامش: $${tradeMargin.toFixed(2)} (${currentConfig.tradeAllocationPercent}%) | العقد الإجمالي: $${positionSizeUsdt.toFixed(2)} | إشارة ${decision} (${signal?.confidence || 80}%)`
            : `${isFutures ? 'Futures ' + effectiveLeverage + 'x' : 'Spot'} | Margin: $${tradeMargin.toFixed(2)} (${currentConfig.tradeAllocationPercent}%) | Notional: $${positionSizeUsdt.toFixed(2)} | Signal ${decision} (${signal?.confidence || 80}%)`),
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
          marketType: isFutures ? 'FUTURES' : 'SPOT',
          leverage: effectiveLeverage,
        };
        addBotLog(newLog);
        playAudioChime();
        return;
      } finally {
        isOpeningTradeRef.current = false;
      }
    }

      // 2. OTHER ACTIONS (TP1, REBUY, TP2, TP3, SL, LIQUIDATION) require targetPosId
      const pos = currentPositions.find(p => p.id === targetPosId);
      if (!pos) return;

      // STRICT SYMBOL PRICE RESOLUTION:
      // Guarantee that the execution price matches the exact contract symbol, preventing cross-coin calculation contamination!
      const isSymbolMatch = pos.symbol.toLowerCase() === selectedSymbolRef.current.toLowerCase();
      const actualP = (isSymbolMatch && currentP > 0)
        ? currentP
        : (pos.currentPrice && pos.currentPrice > 0 ? pos.currentPrice : pos.entryPrice);

      const isLong = pos.decision === 'LONG';
      const lev = Math.max(1, pos.leverage || 1);
      const priceDiffPct = ((actualP - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1) * 100;
      const roePercent = priceDiffPct * lev;

      // 2a. LIQUIDATION HANDLER
      if (actionType === 'LIQUIDATION') {
        lastBotActionTimeRef.current = Date.now() + 2000;
        const marginLost = pos.remainingAmountUsdt;
        const totalTradePnlUsdt = pos.realizedPnlUsdt - marginLost;

        if (!isLiveMode) {
          updatePaperWalletSync((prev) => ({
            ...prev,
            realizedPnl: prev.realizedPnl - marginLost,
          }));
        }

        lastClosedTimesBySymbolRef.current[pos.symbol.toLowerCase()] = Date.now();
        updateBotPositionsSync((prev) => prev.filter(p => p.id !== pos.id));

        const closedHistoryItem: TradeHistoryItem = {
          id: `history-liq-${Date.now()}`,
          timestamp: Date.now(),
          symbol: pos.symbol,
          decision: pos.decision,
          timeframe: timeframe,
          entryPrice: pos.entryPrice,
          exitPrice: actualP,
          tp1: pos.tp1,
          tp2: pos.tp2,
          tp3: pos.tp3,
          stopLoss: pos.stopLoss,
          status: 'SL_HIT',
          profitPercent: -100,
          profitUsdt: totalTradePnlUsdt,
          confidence: 75,
          strategyName: pos.strategyName,
          pnlHistory: pos.pnlHistory,
        };
        setTradeHistory((prev) => [closedHistoryItem, ...(prev || [])].slice(0, 500));

        const newLog: AutoTradeLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'AUTO_LIQUIDATION',
          symbol: pos.symbol,
          side: isLong ? 'SELL' : 'BUY',
          price: actualP,
          amountUsdt: pos.positionSizeUsdt || (pos.initialAmountUsdt * lev),
          pnlUsdt: -marginLost,
          pnlPercent: -100,
          reason: isArabicLang 
            ? `تصفية تلقائية للعقد الآجل (${lev}x ${pos.decision}) لوصول السعر لمستوى التصفية ($${pos.liquidationPrice?.toLocaleString()})`
            : `Futures Liquidation (${lev}x ${pos.decision}) triggered at Liq Price ($${pos.liquidationPrice?.toLocaleString()})`,
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
          marketType: 'FUTURES',
          leverage: lev,
        };
        addBotLog(newLog);
        playAudioChime();
        return;
      }

      // 2b. TP1 HANDLER (50% scale-out, SL to breakeven)
      if (actionType === 'TP1' && !pos.tp1Hit) {
        lastBotActionTimeRef.current = Date.now() + 2000;
        const marginClosed = pos.remainingAmountUsdt * 0.5;
        const pnlUsdt = marginClosed * (roePercent / 100);
        const cashReturned = Math.max(0, marginClosed + pnlUsdt);

        if (isLiveMode && currentBinance.isConnected) {
          executeBinanceLiveOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc * 0.5, actualP).then((orderRes) => {
            if (!orderRes || orderRes.error) {
              setBotLogs(prev => [{ id: `log-${Date.now()}`, timestamp: Date.now(), type: 'ERROR' as any, symbol: pos.symbol, side: isLong ? 'SELL' : 'BUY', price: actualP, amountUsdt: marginClosed * lev, reason: 'TP FAILED: ' + (orderRes?.error || 'Unknown'), mode: 'BINANCE_LIVE' as any, marketType: pos.marketType, leverage: lev }, ...(prev || []).slice(0, 49)]);
            }
          });
        } else {
          updatePaperWalletSync((prev) => ({
            ...prev,
            balance: prev.balance + cashReturned,
            realizedPnl: prev.realizedPnl + pnlUsdt,
          }));
        }

        const breakevenFeeAdjusted = isLong ? pos.entryPrice * 1.0005 : pos.entryPrice * 0.9995;
        const updatedPos: ActiveBotPosition = {
          ...pos,
          tp1Hit: true,
          remainingAmountUsdt: pos.remainingAmountUsdt * 0.5,
          marginUsdt: pos.remainingAmountUsdt * 0.5,
          positionSizeUsdt: (pos.remainingAmountUsdt * 0.5) * lev,
          remainingAmountBtc: pos.remainingAmountBtc * 0.5,
          realizedPnlUsdt: pos.realizedPnlUsdt + pnlUsdt,
          stopLoss: isLong
            ? Math.max(pos.stopLoss || 0, breakevenFeeAdjusted)
            : Math.min(pos.stopLoss || breakevenFeeAdjusted, breakevenFeeAdjusted),
          lastAction: isArabicLang ? `تم تحقيق TP1 وجني 50% وتأمين SL للتعادل+` : `TP1 hit: 50% closed, SL locked at breakeven+`,
        };

        updateBotPositionsSync((prev) => prev.map(p => p.id === pos.id ? updatedPos : p));

        const closedHistoryItem: TradeHistoryItem = {
          id: `history-${Date.now()}`,
          timestamp: Date.now(),
          symbol: pos.symbol,
          decision: pos.decision,
          timeframe: timeframe,
          entryPrice: pos.entryPrice,
          exitPrice: actualP,
          tp1: pos.tp1,
          tp2: pos.tp2,
          tp3: pos.tp3,
          stopLoss: pos.stopLoss,
          status: 'TP1_HIT',
          profitPercent: roePercent,
          profitUsdt: pnlUsdt,
          confidence: 75,
          strategyName: pos.strategyName,
          pnlHistory: pos.pnlHistory,
        };
        setTradeHistory((prev) => [closedHistoryItem, ...(prev || [])].slice(0, 500));

        const newLog: AutoTradeLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'AUTO_SELL_TP1',
          symbol: pos.symbol,
          side: isLong ? 'SELL' : 'BUY',
          price: actualP,
          amountUsdt: marginClosed * lev,
          pnlUsdt,
          pnlPercent: roePercent,
          reason: isArabicLang ? `جني أرباح الهدف الأول (TP1) بنسبة 50% [${lev}x]` : `TP1 hit, 50% profit taken [${lev}x]`,
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
          marketType: pos.marketType,
          leverage: lev,
        };
        addBotLog(newLog);

        playAudioChime();
        return;
      }

      // 2c. REBUY HANDLER (Smart Dip Re-entry)
      if (actionType === 'REBUY' && pos.tp1Hit && pos.rebuysCount < 1) {
        lastBotActionTimeRef.current = Date.now() + 2000;
        const availableBalance = isLiveMode && currentBinance.accountInfo?.freeUsdt
          ? currentBinance.accountInfo.freeUsdt
          : currentWallet.balance;
        const rebuyMargin = availableBalance * (currentConfig.tradeAllocationPercent * 0.5 / 100);
        if (rebuyMargin >= 5) {
          const addedContracts = (rebuyMargin * lev) / actualP;
          const updatedPos: ActiveBotPosition = {
            ...pos,
            rebuysCount: pos.rebuysCount + 1,
            remainingAmountUsdt: pos.remainingAmountUsdt + rebuyMargin,
            marginUsdt: pos.remainingAmountUsdt + rebuyMargin,
            positionSizeUsdt: (pos.remainingAmountUsdt + rebuyMargin) * lev,
            remainingAmountBtc: pos.remainingAmountBtc + addedContracts,
            lastAction: isArabicLang ? `تعزيز العقد الآجل على الارتداد` : `Smart Futures Rebuy on pullback`,
          };
          if (isLiveMode && currentBinance.isConnected) {
            executeBinanceLiveOrder(pos.symbol, pos.decision === 'LONG' ? 'BUY' : 'SELL', rebuyMargin * lev, addedContracts, actualP).then((orderRes) => {
              if (!orderRes || orderRes.error) {
                setBotLogs(prev => [{ id: `log-${Date.now()}`, timestamp: Date.now(), type: 'ERROR' as any, symbol: pos.symbol, side: pos.decision === 'LONG' ? 'BUY' : 'SELL', price: actualP, amountUsdt: rebuyMargin * lev, reason: 'REBUY FAILED: ' + (orderRes?.error || 'Unknown'), mode: 'BINANCE_LIVE' as any, marketType: pos.marketType, leverage: lev }, ...(prev || []).slice(0, 49)]);
              }
            });
          } else {
            updatePaperWalletSync((prev) => ({
              ...prev,
              balance: Math.max(0, prev.balance - rebuyMargin),
            }));
          }
          updateBotPositionsSync((prev) => prev.map(p => p.id === pos.id ? updatedPos : p));

          const newLog: AutoTradeLog = {
            id: `log-${Date.now()}`,
            timestamp: Date.now(),
            type: 'AUTO_REBUY',
            symbol: pos.symbol,
            side: isLong ? 'BUY' : 'SELL',
            price: actualP,
            amountUsdt: rebuyMargin * lev,
            reason: isArabicLang ? `تعزيز العقد الآجل على الارتداد (${lev}x)` : `Futures Rebuy on pullback (${lev}x)`,
            mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
            marketType: pos.marketType,
            leverage: lev,
          };
          addBotLog(newLog);

          playAudioChime();
        }
        return;
      }

      // 2d. TP2 HANDLER (50% of remaining)
      if (actionType === 'TP2' && !pos.tp2Hit) {
        lastBotActionTimeRef.current = Date.now() + 2000;
        const marginClosed = pos.remainingAmountUsdt * 0.5;
        const pnlUsdt = marginClosed * (roePercent / 100);
        const cashReturned = Math.max(0, marginClosed + pnlUsdt);

        if (isLiveMode && currentBinance.isConnected) {
          executeBinanceLiveOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc * 0.5, actualP).then((orderRes) => {
            if (!orderRes || orderRes.error) {
              setBotLogs(prev => [{ id: `log-${Date.now()}`, timestamp: Date.now(), type: 'ERROR' as any, symbol: pos.symbol, side: isLong ? 'SELL' : 'BUY', price: actualP, amountUsdt: marginClosed * lev, reason: 'TP FAILED: ' + (orderRes?.error || 'Unknown'), mode: 'BINANCE_LIVE' as any, marketType: pos.marketType, leverage: lev }, ...(prev || []).slice(0, 49)]);
            }
          });
        } else {
          updatePaperWalletSync((prev) => ({
            ...prev,
            balance: prev.balance + cashReturned,
            realizedPnl: prev.realizedPnl + pnlUsdt,
          }));
        }

        const updatedPos: ActiveBotPosition = {
          ...pos,
          tp2Hit: true,
          remainingAmountUsdt: pos.remainingAmountUsdt * 0.5,
          marginUsdt: pos.remainingAmountUsdt * 0.5,
          positionSizeUsdt: (pos.remainingAmountUsdt * 0.5) * lev,
          remainingAmountBtc: pos.remainingAmountBtc * 0.5,
          realizedPnlUsdt: pos.realizedPnlUsdt + pnlUsdt,
          stopLoss: (pos.tp1 && pos.tp1 > 0)
            ? (isLong ? Math.max(pos.stopLoss || 0, pos.tp1) : Math.min(pos.stopLoss || pos.tp1, pos.tp1))
            : pos.stopLoss,
          lastAction: isArabicLang ? `تم تحقيق TP2 وجني نصف المتبقي وتأمين SL على TP1` : `TP2 hit: 50% of remaining closed, SL locked at TP1`,
        };

        updateBotPositionsSync((prev) => prev.map(p => p.id === pos.id ? updatedPos : p));

        const newLog: AutoTradeLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'AUTO_SELL_TP2',
          symbol: pos.symbol,
          side: isLong ? 'SELL' : 'BUY',
          price: actualP,
          amountUsdt: marginClosed * lev,
          pnlUsdt,
          reason: isArabicLang ? `جني أرباح الهدف الثاني (TP2) بنسبة 50% من المتبقي [${lev}x]` : `TP2 hit, 50% of remaining taken [${lev}x]`,
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
          marketType: pos.marketType,
          leverage: lev,
        };
        addBotLog(newLog);

        playAudioChime();
        return;
      }

      // 2e. TP3 or SL HANDLER (Close full position)
      if (actionType === 'TP3' || actionType === 'SL' || actionType === 'TP1' || actionType === 'TP2') {
        if (actionType === 'TP1' && !pos.tp1Hit) {
          // Handled above
        }
        lastBotActionTimeRef.current = Date.now() + 2000;
        const marginClosed = pos.remainingAmountUsdt;
        let finalPnlUsdt = marginClosed * (roePercent / 100);
        
        // Liquidation clamp
        if (finalPnlUsdt < -marginClosed) {
          finalPnlUsdt = -marginClosed;
        }
        
        const totalTradePnlUsdt = pos.realizedPnlUsdt + finalPnlUsdt;
        const cashReturned = Math.max(0, marginClosed + finalPnlUsdt);

        if (isLiveMode && currentBinance.isConnected) {
          executeBinanceLiveOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc, actualP).then((orderRes) => {
            if (!orderRes || orderRes.error) {
              setBotLogs(prev => [{ id: `log-${Date.now()}`, timestamp: Date.now(), type: 'ERROR' as any, symbol: pos.symbol, side: isLong ? 'SELL' : 'BUY', price: actualP, amountUsdt: marginClosed * lev, reason: 'TP3 FAILED: ' + (orderRes?.error || 'Unknown'), mode: 'BINANCE_LIVE' as any, marketType: pos.marketType, leverage: lev }, ...(prev || []).slice(0, 49)]);
            }
          });
        }

        lastClosedTimesBySymbolRef.current[pos.symbol.toLowerCase()] = Date.now();
        recentlyClosedPositionIdsRef.current.add(pos.id);
        updateBotPositionsSync((prev) => prev.filter(p => p.id !== pos.id));

        // Call server-side authoritative close endpoint to update backend KV and reconcile paper wallet
        fetch('/api/bot/close-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positionId: pos.id,
            exitPrice: actualP,
            reason: customReason || (actionType === 'SL' ? (pos.isTrailingActive ? 'TRAILING_SL' : 'SL_HIT') : (actionType === 'TP3' ? 'TP3_HIT' : 'MANUAL_CLOSE')),
            realizedPnlUsdt: finalPnlUsdt,
            profitPercent: roePercent,
          }),
        }).then(async (res) => {
          if (res.ok) {
            // Immediate sync of authoritative server wallet state
            try {
              const confRes = await fetch('/api/config/all');
              if (confRes.ok) {
                const confData = await confRes.json();
                if (confData.btc_paper_wallet) {
                  const sWallet = JSON.parse(confData.btc_paper_wallet);
                  setPaperWallet(sWallet);
                  paperWalletRef.current = sWallet;
                }
              }
            } catch (e) {}
          }
        }).catch(() => {});

        const closedHistoryItem: TradeHistoryItem = {
          id: `history-${Date.now()}`,
          timestamp: Date.now(),
          symbol: pos.symbol,
          decision: pos.decision,
          timeframe: timeframe,
          entryPrice: pos.entryPrice,
          exitPrice: actualP,
          tp1: pos.tp1,
          tp2: pos.tp2,
          tp3: pos.tp3,
          stopLoss: pos.stopLoss,
          status: actionType === 'SL' ? (pos.isTrailingActive ? 'TP1_HIT' : 'SL_HIT') : 'TP3_HIT',
          profitPercent: roePercent,
          profitUsdt: totalTradePnlUsdt,
          confidence: 75,
          strategyName: pos.strategyName,
          pnlHistory: pos.pnlHistory,
        };
        setTradeHistory((prev) => [closedHistoryItem, ...(prev || [])].slice(0, 500));

        const newLog: AutoTradeLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: actionType === 'SL' ? (pos.isTrailingActive ? 'AUTO_TRAILING_SL' : 'AUTO_SL') : 'AUTO_SELL_TP3',
          symbol: pos.symbol,
          side: isLong ? 'SELL' : 'BUY',
          price: actualP,
          amountUsdt: marginClosed * lev,
          pnlUsdt: finalPnlUsdt,
          pnlPercent: roePercent,
          reason: customReason || (isArabicLang 
            ? (actionType === 'SL' 
                ? (pos.isTrailingActive ? `إغلاق وتأمين الأرباح بالوقف المتحرك (${lev}x Trailing SL)` : `إغلاق كامل بوقف الخسارة (${lev}x SL)`) 
                : `إغلاق كامل بالهدف الثالث (${lev}x TP3)`) 
            : (actionType === 'SL' 
                ? (pos.isTrailingActive ? `Trailing Stop Triggered (${lev}x) — Profits Locked` : `Closed at SL (${lev}x)`) 
                : `Closed at TP3 (${lev}x)`)),
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
          marketType: pos.marketType,
          leverage: lev,
        };
        addBotLog(newLog);

        playAudioChime();
      }
    },
    [language, timeframe]
  );

  // Emergency Panic Close All handler
  const handlePanicCloseAll = useCallback(async () => {
    const isArabicLang = language === 'ar';
    const currentPositions = [...(activeBotPositionsRef.current || [])];
    const currentBinance = binanceConfigRef.current;
    const currentP = ticker?.price || 0;

    if (currentPositions.length > 0) {
      for (const pos of currentPositions) {
        const isLivePos = pos.mode === 'BINANCE_LIVE';
        const isSymbolMatch = pos.symbol.toLowerCase() === selectedSymbolRef.current.toLowerCase();
        const p = (isSymbolMatch && currentP > 0) ? currentP : (pos.currentPrice && pos.currentPrice > 0 ? pos.currentPrice : pos.entryPrice);
        const isLong = pos.decision === 'LONG';
        const lev = Math.max(1, pos.leverage || 1);
        const priceDiffPct = ((p - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1) * 100;
        const roePercent = priceDiffPct * lev;
        const finalPnlUsdt = (pos.remainingAmountUsdt || 0) * (roePercent / 100);
        const totalTradePnlUsdt = (pos.realizedPnlUsdt || 0) + finalPnlUsdt;
        const cashReturned = Math.max(0, (pos.remainingAmountUsdt || 0) + finalPnlUsdt);

        if (isLivePos && currentBinance?.isConnected) {
          executeBinanceLiveOrder(pos.symbol, isLong ? 'SELL' : 'BUY', (pos.remainingAmountUsdt || 0) * lev, pos.remainingAmountBtc, p).then((orderRes) => {
            if (!orderRes || orderRes.error) {
              setBotLogs(prev => [{ id: `log-${Date.now()}`, timestamp: Date.now(), type: 'ERROR' as any, symbol: pos.symbol, side: isLong ? 'SELL' : 'BUY', price: currentP, amountUsdt: (pos.remainingAmountUsdt || 0) * lev, reason: 'PANIC CLOSE FAILED: ' + (orderRes?.error || 'Unknown'), mode: 'BINANCE_LIVE' as any, marketType: pos.marketType || 'SPOT', leverage: lev }, ...(prev || []).slice(0, 49)]);
            }
          }).catch(() => {});
        } else {
          updatePaperWalletSync((prev) => ({
            ...prev,
            balance: Math.round(((prev.balance || 0) + cashReturned) * 100) / 100,
            realizedPnl: Math.round(((prev.realizedPnl || 0) + finalPnlUsdt) * 100) / 100,
          }));
        }

        lastClosedTimesBySymbolRef.current[pos.symbol.toLowerCase()] = Date.now();

        const closedHistoryItem: TradeHistoryItem = {
          id: `history-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          timestamp: Date.now(),
          symbol: pos.symbol,
          decision: pos.decision,
          timeframe: timeframeRef.current,
          entryPrice: pos.entryPrice,
          exitPrice: p,
          tp1: pos.tp1,
          tp2: pos.tp2,
          tp3: pos.tp3,
          stopLoss: pos.stopLoss,
          status: 'MANUAL_EXIT',
          profitPercent: roePercent,
          profitUsdt: totalTradePnlUsdt,
          confidence: 75,
          strategyName: pos.strategyName,
          pnlHistory: pos.pnlHistory,
        };
        setTradeHistory((prev) => [closedHistoryItem, ...(prev || [])].slice(0, 500));
      }
    }

    // Unconditionally wipe ALL active positions locally and remotely
    updateBotPositionsSync(() => []);
    setActiveBotPositions([]);
    activeBotPositionsRef.current = [];
    apiStorage.setItem('btc_active_bot_positions', '[]');
    try {
      sessionStorage.setItem('btc_active_bot_positions', '[]');
      localStorage.setItem('btc_active_bot_positions', '[]');
    } catch {}

    // Tell backend KV directly to clear positions so background engine sync won't restore them
    fetch('/api/bot/panic-close-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'btc_active_bot_positions', value: '[]' }),
    }).catch(() => {});

    const newLog: AutoTradeLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      type: 'PANIC_CLOSE_ALL',
      symbol: 'ALL_POSITIONS',
      side: 'SELL',
      price: currentP,
      amountUsdt: 0,
      reason: isArabicLang ? 'تصفية طارئة فورية وإغلاق كافة الصفقات النشطة (Panic Close All)' : 'Emergency Panic Close All executed for all open positions',
      mode: executionModeRef.current,
    };
    addBotLog(newLog);
    playAudioChime();
  }, [language, ticker?.price, playAudioChime, updateBotPositionsSync, updatePaperWalletSync, addBotLog]);

  // Reset Circuit Breaker
  const handleResetCircuitBreaker = useCallback(() => {
    const now = Date.now();
    setBotConfig((prev) => ({
      ...prev,
      enabled: true,
      circuitBreakerTripped: false,
      circuitBreakerTrippedAt: undefined,
      circuitBreakerResetAt: now,
    }));

    const isLiveMode = executionModeRef.current === 'BINANCE_LIVE';
    const isArabicLang = language === 'ar';
    const resetLog: AutoTradeLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      type: 'CIRCUIT_BREAKER',
      symbol: 'PORTFOLIO',
      side: 'BUY',
      price: ticker?.price || 0,
      amountUsdt: 0,
      reason: isArabicLang 
        ? 'تم استئناف البوت وإعادة تصفير عداد الخسارة اليومية بنجاح.' 
        : 'Shield reset successfully. Bot resumed and daily loss counter reset.',
      mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
    };
    addBotLog(resetLog);
    playAudioChime();
  }, [language, ticker?.price, playAudioChime]);

  // Centralized Bot Manual Activation & Deactivation Toggle
  const handleToggleBot = useCallback(() => {
    setBotConfig((prev) => {
      const nextEnabled = !prev.enabled;
      let effectivePresets: ('MOMENTUM' | 'SCALPER' | 'SWING' | 'BREAKOUT' | 'MEAN_REVERSION' | 'INSTITUTIONAL_SMC')[] = prev.activePresets && prev.activePresets.length > 0
        ? prev.activePresets
        : ['MOMENTUM'];

      // When manually turning ON the bot
      if (nextEnabled) {
        const isAr = language === 'ar';
        const startLog: AutoTradeLog = {
          id: `log-start-${Date.now()}`,
          timestamp: Date.now(),
          type: 'STRATEGY_AUDIT',
          symbol: 'PORTFOLIO',
          side: 'BUY',
          price: ticker?.price || 0,
          amountUsdt: 0,
          reason: isAr
            ? `تم تفعيل وتشغيل البوت يدوياً بنجاح (${effectivePresets.length} استراتيجية نشطة).`
            : `Bot manually activated successfully (${effectivePresets.length} active strategies).`,
          mode: executionModeRef.current === 'BINANCE_LIVE' ? 'BINANCE_LIVE' : 'PAPER',
        };
        addBotLog(startLog);
        playAudioChime();
      } else {
        const isAr = language === 'ar';
        const stopLog: AutoTradeLog = {
          id: `log-stop-${Date.now()}`,
          timestamp: Date.now(),
          type: 'STRATEGY_AUDIT',
          symbol: 'PORTFOLIO',
          side: 'SELL',
          price: ticker?.price || 0,
          amountUsdt: 0,
          reason: isAr
            ? 'تم إيقاف البوت يدوياً. لن يتم فتح أي صفقات جديدة حتى يتم تفعيله يدوياً.'
            : 'Bot manually paused. No new positions will open until manually resumed.',
          mode: executionModeRef.current === 'BINANCE_LIVE' ? 'BINANCE_LIVE' : 'PAPER',
        };
        addBotLog(stopLog);
        playAudioChime();
      }

      let nextConfig: AutoBotConfig;
      if (nextEnabled && prev.circuitBreakerTripped) {
        nextConfig = {
          ...prev,
          enabled: true,
          activePresets: effectivePresets,
          enabledAt: Date.now(),
          circuitBreakerTripped: false,
          circuitBreakerTrippedAt: undefined,
          circuitBreakerResetAt: Date.now(),
        };
      } else {
        nextConfig = {
          ...prev,
          enabled: nextEnabled,
          activePresets: effectivePresets,
          enabledAt: nextEnabled ? Date.now() : prev.enabledAt,
        };
      }
      botConfigRef.current = nextConfig;
      lastConfigUpdateRef.current = Date.now();
      apiStorage.setItem('btc_bot_config', JSON.stringify(nextConfig));
      return nextConfig;
    });
  }, [language, ticker?.price, playAudioChime, addBotLog]);

  const handleFullReset = useCallback(async () => {
    // 1. Immediately zero out refs to prevent background intervals or ticks from writing back stale positions
    activeBotPositionsRef.current = [];
    botLogsRef.current = [];
    tradeHistoryRef.current = [];
    paperWalletRef.current = {
      balance: 1000,
      realizedPnl: 0,
      openPosition: null,
      history: [],
    };

    const resetBotConfig: AutoBotConfig = {
      ...botConfigRef.current,
      enabled: false,
      activePresets: [],
      circuitBreakerTripped: false,
    };
    botConfigRef.current = resetBotConfig;
    lastConfigUpdateRef.current = Date.now();
    apiStorage.setItem('btc_bot_config', JSON.stringify(resetBotConfig));

    // 2. Clear state
    setActiveBotPositions([]);
    setTradeHistory([]);
    setBotLogs([]);
    setAlerts([]);
    setPaperWallet({
      balance: 1000,
      realizedPnl: 0,
      openPosition: null,
      history: [],
    });
    setBotConfig(resetBotConfig);

    // 3. Clear database and local storage via dedicated reset endpoint
    try {
      await apiStorage.resetTradingData();
    } catch (e) {}

    playAudioChime();

    const resetAlert: PushAlert = {
      id: `reset-alert-${Date.now()}`,
      timestamp: Date.now(),
      type: 'SYSTEM',
      title: language === 'ar' ? 'إعادة ضبط شاملة للمنصة' : language === 'fr' ? 'Réinitialisation Totale Réussie' : 'Full Platform Reset',
      body: language === 'ar'
        ? 'تم تصفير المحفظة بنجاح إلى 1,000 USDT ومسح جميع الصفقات والسجلات وإيقاف تشغيل الاستراتيجيات.'
        : language === 'fr'
        ? 'Le portefeuille a été remis à 1 000 USDT, les positions/logs ont été effacés et les stratégies désactivées.'
        : 'Paper wallet reset to $1,000 USDT, all positions and history wiped, and strategies set to inactive.',
      read: false,
    };
    triggerToastAlert(resetAlert);
  }, [language, playAudioChime, triggerToastAlert]);

  // Trim excess positions if open positions exceed maxOpenTrades
  const handleTrimExcessPositions = useCallback(() => {
    const isLive = executionModeRef.current === 'BINANCE_LIVE';
    const isArabicLang = language === 'ar';
    const currentPositions = activeBotPositionsRef.current;
    const modePositions = currentPositions.filter(p => isLive ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
    const maxTrades = Math.max(1, botConfigRef.current.maxOpenTrades || 3);

    if (modePositions.length <= maxTrades) return;

    const excessCount = modePositions.length - maxTrades;
    // Sort positions by PnL (lowest first) to close the weakest performing excess positions
    const sorted = [...modePositions].sort((a, b) => {
      const pnlA = (a.realizedPnlUsdt || 0) + (a.pnlHistory?.[a.pnlHistory.length - 1] || 0);
      const pnlB = (b.realizedPnlUsdt || 0) + (b.pnlHistory?.[b.pnlHistory.length - 1] || 0);
      return pnlA - pnlB;
    });

    const toClose = sorted.slice(0, excessCount);
    for (const pos of toClose) {
      const priceToUse = pos.currentPrice || pos.entryPrice;
      executeAutoTradeAction(
        'SL',
        priceToUse,
        isArabicLang
          ? `تقليص تلقائي للصفقة الزائدة للالتزام بحد الصفقات الأقصى (${maxTrades})`
          : `Auto-trimmed excess trade to enforce max open slots limit (${maxTrades})`,
        pos.id
      );
    }
  }, [language, executeAutoTradeAction]);

  // Need a ref to access latest ticker without re-triggering the interval
  const latestTickerRef = useRef(ticker);
  useEffect(() => {
    latestTickerRef.current = ticker;
  }, [ticker]);

  // Background PnL History Sampler & Multi-Pair Real-Time Price Sync for all active positions
  useEffect(() => {
    const updatePositionsWithPrices = (pricesMap: Record<string, number>) => {
      setActiveBotPositions((prevPositions) => {
        if (!prevPositions || prevPositions.length === 0) return prevPositions;
        let changed = false;
        const updated = prevPositions.map((pos) => {
          const normPosSym = normalizeSymbol(pos.symbol);
          const p = pricesMap[normPosSym] || pricesMap[pos.symbol.toUpperCase()];
          if (!p || isNaN(p) || p <= 0) return pos;

          const isLong = pos.decision === 'LONG';
          const lev = pos.leverage || 1;
          const priceDiffPct = ((p - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1) * 100;
          const currentRoePercent = priceDiffPct * lev;
          const remainingMargin = typeof pos.remainingAmountUsdt === 'number' && pos.remainingAmountUsdt >= 0
            ? pos.remainingAmountUsdt
            : (pos.marginUsdt || pos.initialAmountUsdt || 0);
          const unrealizedPnlUsdt = remainingMargin * (currentRoePercent / 100);

          changed = true;
          return {
            ...pos,
            currentPrice: p,
            roePercent: Math.round(currentRoePercent * 100) / 100,
            unrealizedPnlUsdt: Math.round(unrealizedPnlUsdt * 100) / 100,
            pnlHistory: [...(pos.pnlHistory || []), Math.round(currentRoePercent * 10) / 10].slice(-50),
          };
        });
        return changed ? updated : prevPositions;
      });
    };

    const interval = setInterval(async () => {
      const positions = activeBotPositionsRef.current;
      const pricesMap: Record<string, number> = {};

      const currentTicker = latestTickerRef.current;
      if (currentTicker?.price && !isNaN(currentTicker.price) && currentTicker.price > 0) {
        pricesMap[normalizeSymbol(currentTicker.symbol)] = currentTicker.price;
        pricesMap[currentTicker.symbol.toUpperCase()] = currentTicker.price;
      }

      if (positions && positions.length > 0) {
        const symbolsToFetch = Array.from(new Set(positions.map(p => p.symbol.toUpperCase())))
          .filter(sym => !pricesMap[normalizeSymbol(sym)]);

        if (symbolsToFetch.length > 0) {
          try {
            const res = await fetch(`/api/bot/prices?symbols=${symbolsToFetch.join(',')}`);
            if (res.ok) {
              const data = await res.json();
              if (data?.prices) {
                Object.entries(data.prices).forEach(([sym, price]) => {
                  if (typeof price === 'number' && price > 0) {
                    pricesMap[normalizeSymbol(sym)] = price;
                    pricesMap[sym.toUpperCase()] = price;
                  }
                });
              }
            }
          } catch (e) {
            // Silently fall back to ticker prices
          }
        }
      }

      if (Object.keys(pricesMap).length > 0) {
        updatePositionsWithPrices(pricesMap);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []); // Empty dependency array prevents interval from resetting on every tick

  // Monitor live price on every tick to execute automated TP/SL/Trailing SL/Rebuy & Circuit Breaker
  useEffect(() => {
    if (!botConfig.enabled || !ticker || !ticker.price || isNaN(ticker.price) || ticker.price <= 0) return;
    const now = Date.now();
    if (now < lastBotActionTimeRef.current) return;
    const currentP = ticker.price;
    const currentSignal = activeSignalRef.current;
    const currentSym = selectedSymbolRef.current;
    const currentPositions = activeBotPositionsRef.current;
    const isArabicLang = language === 'ar';
    const isLiveMode = executionModeRef.current === 'BINANCE_LIVE';
    const currentBinance = binanceConfigRef.current;
    const currentWallet = paperWalletRef.current;
    const normTickerSym = normalizeSymbol(ticker.symbol);

    // 0. Circuit Breaker Evaluation (Daily Drawdown Kill-Switch)
    if (botConfig.dailyDrawdownLimitPercent && botConfig.dailyDrawdownLimitPercent > 0 && !botConfig.circuitBreakerTripped) {
      const startOfTodayUtc = new Date().setUTCHours(0, 0, 0, 0);
      const baselineTime = Math.max(startOfTodayUtc, botConfig.circuitBreakerResetAt || 0);
      const todayLogs = botLogsRef.current.filter(l => l.timestamp >= baselineTime && (isLiveMode ? l.mode === 'BINANCE_LIVE' : (!l.mode || l.mode === 'PAPER')));
      const todayRealizedLoss = todayLogs.reduce((acc, l) => acc + (l.pnlUsdt || 0), 0);
      
      const totalEquity = isLiveMode && currentBinance.accountInfo?.totalUsdtEquity !== undefined
        ? currentBinance.accountInfo.totalUsdtEquity
        : currentWallet.balance + currentPositions.reduce((acc, pos) => acc + pos.initialAmountUsdt, 0);

      const maxDailyLossAllowedUsdt = (totalEquity * (botConfig.dailyDrawdownLimitPercent / 100));

      if (todayRealizedLoss <= -maxDailyLossAllowedUsdt && totalEquity > 0) {
        setBotConfig((prev) => ({
          ...prev,
          enabled: false,
          circuitBreakerTripped: true,
          circuitBreakerTrippedAt: Date.now(),
        }));

        const cbLog: AutoTradeLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'CIRCUIT_BREAKER',
          symbol: 'PORTFOLIO',
          side: 'SELL',
          price: currentP,
          amountUsdt: 0,
          pnlUsdt: todayRealizedLoss,
          reason: isArabicLang 
            ? `تفعيل قاطع الحماية (Circuit Breaker): تجاوزت خسائر اليوم -${Math.abs(todayRealizedLoss).toFixed(2)}$ (${botConfig.dailyDrawdownLimitPercent}%). تم إيقاف البوت لحماية رأس المال.` 
            : `Circuit Breaker Tripped: Max daily loss limit (-$${Math.abs(todayRealizedLoss).toFixed(2)} / ${botConfig.dailyDrawdownLimitPercent}%) reached. Bot paused to protect capital.`,
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
        };
        addBotLog(cbLog);
        playAudioChime();
        return;
      }
    }

    // 1. Check New Position Entry - MOVED TO SERVER
    // 2. Trailing Stop Loss Updates
    // 🛑 SERVER-SIDE EXECUTION MIGRATION 🛑
    // The frontend no longer automatically triggers TP/SL/LIQUIDATION/REBUY.
    // This is now handled safely 24/7 by the backend engine (src/server/botEngine.ts)
    // The frontend will receive state updates from apiStorage automatically.
  }, [ticker?.price, botConfig.enabled, botConfig.minConfidence, botConfig.maxOpenTrades, botConfig.trailingStopEnabled, botConfig.trailingStopPercent, botConfig.trailingActivationProfitPercent, botConfig.dailyDrawdownLimitPercent, botConfig.circuitBreakerTripped, botConfig.circuitBreakerResetAt, botConfig.cooldownMinutes, executeAutoTradeAction, language, playAudioChime]);

  const lastAnalysisCallRef = useRef<number>(0);

  // Run Quantitative Analysis
  const runAnalysis = useCallback(
    async (currentMarketData: MarketDataResponse | null, force: boolean = false) => {
      let data = currentMarketData;
      if (!data || !data.ticker || !data.indicators) {
        if (force) {
          fetchMarketData(timeframe, selectedSymbol, botConfig.marketType);
        }
        return;
      }

      // Automatically determine optimal bot timeframe based on quantitative market regime
      const optimalTf = determineOptimalBotTimeframe(data.indicators, data.ticker.price);
      setAutoBotTimeframeInfo({
        effectiveTimeframe: optimalTf.timeframe,
        reasonAr: optimalTf.reasonAr,
        reasonEn: optimalTf.reasonEn,
      });

      const now = Date.now();
      const incomingSym = (data.ticker?.symbol || selectedSymbolRef.current || selectedSymbol || '').toUpperCase();
      const currentActiveSym = (activeSignalRef.current?.symbol || '').toUpperCase();
      const isSymbolChanged = !currentActiveSym || currentActiveSym !== incomingSym;

      // Fast client-side pure mathematical plan for immediate UI responsiveness
      const fastPlan = generateQuantitativePlan(
        data.timeframe,
        data.ticker.price,
        data.indicators,
        data.orderBook,
        data.derivatives,
        data.mtfConfluence,
        isDeveloperMode,
        incomingSym
      );

      // If called from background interval and analyzed recently on the SAME symbol, update the mathematical plan & check for fresh alerts
      if (!force && !isSymbolChanged && now - lastAnalysisCallRef.current < 60000 && activeSignalRef.current) {
        setActiveSignal((prev) => (prev ? { ...fastPlan, detailedAnalysis: prev.detailedAnalysis } : fastPlan));
        if (fastPlan.confidence >= minConfidenceThreshold && (fastPlan.decision === 'LONG' || fastPlan.decision === 'SHORT')) {
          pushNewAlert(fastPlan);
        }
        return;
      }

      lastAnalysisCallRef.current = now;
      setIsAnalyzing(true);
      try {
        const res = await fetch('/api/qwen/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketData: currentMarketData,
            isDeveloperMode,
          }),
        });

        if (res.ok) {
          const plan: AIAnalysisResult = await res.json();
          // Guarantee symbol is stamped on returned plan
          plan.symbol = incomingSym;
          setActiveSignal(plan);

          if (plan.confidence >= minConfidenceThreshold && (plan.decision === 'LONG' || plan.decision === 'SHORT')) {
            playAudioChime();
            pushNewAlert(plan);
          }
        } else {
          setActiveSignal(fastPlan);
          if (fastPlan.confidence >= minConfidenceThreshold && (fastPlan.decision === 'LONG' || fastPlan.decision === 'SHORT')) {
            playAudioChime();
            pushNewAlert(fastPlan);
          }
        }
      } catch (err) {
        // Local quant engine fallback
        setActiveSignal(fastPlan);
        if (fastPlan.confidence >= minConfidenceThreshold && (fastPlan.decision === 'LONG' || fastPlan.decision === 'SHORT')) {
          playAudioChime();
          pushNewAlert(fastPlan);
        }
      } finally {
        setIsAnalyzing(false);
      }
    },
    [isDeveloperMode, minConfidenceThreshold, playAudioChime, pushNewAlert, selectedSymbol]
  );

  const fetchRequestIdRef = useRef<number>(0);

  // Instant direct Binance REST fetcher for sub-80ms UI responsiveness
  const instantFetchMarketData = useCallback(async (sym: string, tf: Timeframe, mt: MarketType) => {
    const normSym = sym.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const isFutures = mt === 'FUTURES';
    const tickerUrl = isFutures
      ? `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${normSym}`
      : `https://api.binance.com/api/v3/ticker/24hr?symbol=${normSym}`;
    const klinesUrl = isFutures
      ? `https://fapi.binance.com/fapi/v1/klines?symbol=${normSym}&interval=${tf}&limit=350`
      : `https://api.binance.com/api/v3/klines?symbol=${normSym}&interval=${tf}&limit=350`;

    try {
      const [tRes, kRes] = await Promise.allSettled([
        fetch(tickerUrl, { cache: 'no-cache' }).then((r) => r.json()),
        fetch(klinesUrl, { cache: 'no-cache' }).then((r) => r.json()),
      ]);

      let freshTicker: BinanceTicker | null = null;
      if (tRes.status === 'fulfilled' && tRes.value && tRes.value.lastPrice) {
        const data = tRes.value;
        if (normSym === selectedSymbolRef.current.toUpperCase()) {
          freshTicker = {
            symbol: data.symbol,
            price: parseFloat(data.lastPrice),
            priceChange24h: parseFloat(data.priceChange || '0'),
            priceChangePercent24h: parseFloat(data.priceChangePercent || '0'),
            volume24h: parseFloat(data.volume || '0'),
            quoteVolume24h: parseFloat(data.quoteVolume || '0'),
            high24h: parseFloat(data.highPrice || data.lastPrice),
            low24h: parseFloat(data.lowPrice || data.lastPrice),
            updatedAt: Date.now(),
          };
          setTicker(freshTicker);
          setConnectionState('CONNECTED');
        }
      }

      if (kRes.status === 'fulfilled' && Array.isArray(kRes.value) && kRes.value.length > 0) {
        if (normSym === selectedSymbolRef.current.toUpperCase() && tf === timeframeRef.current) {
          const freshKlines: KlineCandle[] = kRes.value.map((item: any) => ({
            time: Math.floor(item[0] / 1000),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5]),
          }));
          setKlines(freshKlines);

          // INSTANT INDICATORS & QUANT REPORT COMPUTATION (sub-80ms)
          // Guarantees that the Report, Targets, Bias, and Indicators change IMMEDIATELY on coin switch
          const freshIndicators = calculateTechnicalIndicators(freshKlines);
          const currentPrice = freshTicker ? freshTicker.price : freshKlines[freshKlines.length - 1].close;

          const fastMarketData: MarketDataResponse = {
            status: 'ONLINE',
            ticker: freshTicker || {
              symbol: normSym,
              price: currentPrice,
              priceChange24h: 0,
              priceChangePercent24h: 0,
              volume24h: 0,
              quoteVolume24h: 0,
              high24h: currentPrice,
              low24h: currentPrice,
              updatedAt: Date.now(),
            },
            timeframe: tf,
            klines: freshKlines,
            indicators: freshIndicators,
            orderBook: marketDataRef.current?.orderBook || null,
            derivatives: marketDataRef.current?.derivatives || null,
            marketRegime: freshIndicators.marketStructure?.trend === 'UPTREND'
              ? 'TRENDING_BULLISH'
              : freshIndicators.marketStructure?.trend === 'DOWNTREND'
              ? 'TRENDING_BEARISH'
              : 'RANGING',
            mtfConfluence: marketDataRef.current?.mtfConfluence || null,
            updatedAt: Date.now(),
            isDeveloperMode: isDeveloperModeRef.current,
          };

          setMarketData(fastMarketData);
          marketDataRef.current = fastMarketData;

          // Compute instant quantitative report with all SMC & indicator metrics
          const instantPlan = generateQuantitativePlan(
            tf,
            currentPrice,
            freshIndicators,
            fastMarketData.orderBook,
            fastMarketData.derivatives,
            fastMarketData.mtfConfluence,
            isDeveloperModeRef.current,
            normSym
          );
          setActiveSignal(instantPlan);
          activeSignalRef.current = instantPlan;
        }
      }
    } catch (e) {
      // Fallback handled gracefully by full fetchMarketData
    }
  }, []);

  // Fetch Full Market Data from Server with strict race-condition guards
  const fetchMarketData = useCallback(
    async (
      tf: Timeframe = timeframeRef.current,
      sym: string = selectedSymbolRef.current,
      mt: MarketType = botConfigRef.current?.marketType || 'FUTURES',
      forceAnalysis: boolean = false,
      isManual: boolean = false
    ) => {
      const currentReqId = ++fetchRequestIdRef.current;
      if (isManual) {
        setIsRefreshing(true);
      }
      try {
        const res = await fetch(
          `/api/binance/market-data?symbol=${sym}&timeframe=${tf}&devMode=${isDeveloperModeRef.current}&marketType=${mt}`
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: MarketDataResponse = await res.json();

        // Stale response guard: discard if user switched symbol or timeframe during fetch
        if (currentReqId !== fetchRequestIdRef.current) return;
        if (sym.toUpperCase() !== selectedSymbolRef.current.toUpperCase()) return;

        setMarketData(data);

        if (data.ticker && data.ticker.symbol.toUpperCase() === selectedSymbolRef.current.toUpperCase()) {
          setTicker(data.ticker);
          setConnectionState('CONNECTED');
        }
        if (data.klines && data.klines.length > 0 && tf === timeframeRef.current) {
          setKlines(data.klines);
        }

        // Run quantitative analysis on fresh data (force if symbol changed or requested)
        const currentActiveSym = (activeSignalRef.current?.symbol || '').toUpperCase();
        const isSymbolChanged = !currentActiveSym || currentActiveSym !== sym.toUpperCase();
        runAnalysis(data, forceAnalysis || isSymbolChanged);
      } catch (err) {
        console.warn('Error fetching market data from server:', err);
      } finally {
        if (currentReqId === fetchRequestIdRef.current && isManual) {
          setIsRefreshing(false);
        }
      }
    },
    [runAnalysis]
  );

  
  // Listen for backend state updates
  useEffect(() => {
    const handleStorageUpdate = (e: any) => {
        if (!e.detail) return;
        const { key, value } = e.detail;
        
        if (key === 'btc_active_bot_positions' && value) {
            try {
                if (JSON.stringify(activeBotPositionsRef.current) !== value) {
                    const positions = JSON.parse(value);
                    setActiveBotPositions(positions);
                    activeBotPositionsRef.current = positions;
                }
            } catch(e) {}
        }
        else if (key === 'btc_paper_wallet' && value) {
            try {
                if (JSON.stringify(paperWalletRef.current) !== value) {
                    const wallet = JSON.parse(value);
                    setPaperWallet(wallet);
                    paperWalletRef.current = wallet;
                }
            } catch(e) {}
        }
        else if (key === 'btc_bot_logs' && value) {
            try {
                if (JSON.stringify(botLogsRef.current) !== value) {
                    const logs = JSON.parse(value);
                    setBotLogs(logs);
                    botLogsRef.current = logs;
                }
            } catch(e) {}
        }
    };
    
    window.addEventListener('apiStorage_updated', handleStorageUpdate);
    return () => window.removeEventListener('apiStorage_updated', handleStorageUpdate);
  }, []);

  // Poll for background server state changes 
  // (because server writing to kv won't trigger frontend events automatically without WS)
  useEffect(() => {
     const interval = setInterval(async () => {
         try {
             // We just re-init apiStorage memory with latest server data
             const res = await fetch('/api/config/all');
             if (res.ok) {
                 const serverData = await res.json();
                 
                 // Check if positions changed on server
                 if (serverData.btc_active_bot_positions) {
                     try {
                         const positions = JSON.parse(serverData.btc_active_bot_positions);
                         const validPositions = Array.isArray(positions) 
                           ? positions.filter((p: any) => !recentlyClosedPositionIdsRef.current.has(p.id))
                           : [];
                         const currentLocal = JSON.stringify(activeBotPositionsRef.current);
                         if (JSON.stringify(validPositions) !== currentLocal) {
                             setActiveBotPositions(validPositions);
                             activeBotPositionsRef.current = validPositions;
                         }
                     } catch (e) {}
                 }
                 
                 // Check if wallet changed on server
                 if (serverData.btc_paper_wallet) {
                     const currentLocal = JSON.stringify(paperWalletRef.current);
                     if (serverData.btc_paper_wallet !== currentLocal) {
                         const wallet = JSON.parse(serverData.btc_paper_wallet);
                         setPaperWallet(wallet);
                         paperWalletRef.current = wallet;
                     }
                 }
                 
                 // Check if trade history changed on server
                 if (serverData.btc_trade_history) {
                     const currentLocal = JSON.stringify(tradeHistoryRef.current);
                     if (serverData.btc_trade_history !== currentLocal) {
                         const history = JSON.parse(serverData.btc_trade_history);
                         setTradeHistory(history);
                         tradeHistoryRef.current = history;
                     }
                 }

                 // Check if bot logs changed on server
                 if (serverData.btc_bot_logs) {
                     const currentLocal = JSON.stringify(botLogsRef.current);
                     if (serverData.btc_bot_logs !== currentLocal) {
                         const logs = JSON.parse(serverData.btc_bot_logs);
                         setBotLogs(logs);
                         botLogsRef.current = logs;
                     }
                 }

                 // Check if bot config changed on server
                 if (serverData.btc_bot_config) {
                     const currentLocal = JSON.stringify(botConfigRef.current);
                     if (serverData.btc_bot_config !== currentLocal) {
                         try {
                             const remoteConfig = JSON.parse(serverData.btc_bot_config);
                             setBotConfig((prev) => ({ ...prev, ...remoteConfig }));
                             botConfigRef.current = { ...botConfigRef.current, ...remoteConfig };
                         } catch (e) {}
                     }
                 }
             }
         } catch(e) {}
     }, 2500);
     return () => clearInterval(interval);
  }, []);


   
  // Poll scanner status
  const [scannerState, setScannerState] = useState<any>(null);
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/scanner/status');
        if (res.ok) {
          const data = await res.json();
          setScannerState(data);
          
          // Check for strong signals to alert across all scanned pairs
          if (data && data.symbolStates) {
            const userActivePresets = botConfigRef.current?.activePresets || [];
            const isMultiPairEnabled = botConfigRef.current?.multiPairScanning ?? true;
            const currentSelected = (selectedSymbolRef.current || '').toUpperCase();

            Object.values(data.symbolStates).forEach((state: any) => {
              if (
                state &&
                state.symbol &&
                state.confidence >= minConfidenceThresholdRef.current &&
                (state.signalDirection === 'LONG' || state.signalDirection === 'SHORT')
              ) {
                // If multi-pair scanning is disabled, only alert for the currently selected symbol
                if (!isMultiPairEnabled && state.symbol.toUpperCase() !== currentSelected) {
                  return;
                }

                // If user activated specific strategies, only alert for signals from those strategies
                if (userActivePresets.length > 0 && state.strategyId && !userActivePresets.includes(state.strategyId)) {
                  return;
                }

                // Deduplicate signal instances by unique timestamp/id to prevent repetitive notification spam
                const signalUid = `${state.symbol}_${state.strategyId || state.strategyName || 'MGR'}_${state.signalDirection}_${state.signalTimestamp || state.lastAnalyzed}`;
                if (processedScannerSignalIdsRef.current.has(signalUid)) {
                  return;
                }
                processedScannerSignalIdsRef.current.add(signalUid);
                if (processedScannerSignalIdsRef.current.size > 200) {
                  const firstKey = processedScannerSignalIdsRef.current.values().next().value;
                  if (firstKey) processedScannerSignalIdsRef.current.delete(firstKey);
                }

                const signalDecision = state.signalDirection;
                const entryP = state.price || 0;
                const isLong = signalDecision === 'LONG';
                const tf = state.timeframe || (botConfigRef.current?.timeframe !== 'AUTO' ? botConfigRef.current?.timeframe : '1h') || '1h';
                const slP = state.stopLoss || (isLong ? entryP * 0.985 : entryP * 1.015);
                const tp1P = state.tp1 || (isLong ? entryP * 1.015 : entryP * 0.985);
                const tp2P = state.tp2 || (isLong ? entryP * 1.03 : entryP * 0.97);
                const tp3P = state.tp3 || (isLong ? entryP * 1.05 : entryP * 0.95);

                const stratName = state.strategyName || 'Market Scanner';
                const descText = state.reason || `[${stratName}] ${signalDecision} signal detected on ${state.symbol} (${tf})`;
                const scannerAlertPlan: any = {
                  decision: signalDecision,
                  confidence: state.confidence,
                  marketRegime: stratName,
                  recommendedTimeframe: tf,
                  currentPrice: entryP,
                  entryZone: { min: entryP * 0.998, max: entryP * 1.002, ideal: entryP },
                  targets: { tp1: tp1P, tp2: tp2P, tp3: tp3P },
                  stopLoss: slP,
                  riskRewardRatio: 2.5,
                  detailedAnalysis: {
                    fr: descText,
                    ar: descText,
                    en: descText,
                  },
                  generatedAt: state.signalTimestamp || Date.now(),
                };

                pushNewAlert(scannerAlertPlan as AIAnalysisResult, false, state.symbol);
              }
            });
          }
        }
      } catch (err) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [pushNewAlert]);


  // 1. Initialize WebSocket streaming and periodic polling
  useEffect(() => {
    const activeMarketType = botConfig.marketType || 'FUTURES';
    binanceWsManager.connect(selectedSymbol, timeframe, activeMarketType);

    const unsubState = binanceWsManager.onStateChange((state) => {
      if (state === 'CONNECTED') {
        setConnectionState('CONNECTED');
      } else {
        setConnectionState((prev) => (prev === 'CONNECTED' ? 'CONNECTED' : state));
      }
    });

    const unsubTicker = binanceWsManager.onTicker((newTicker) => {
      if (newTicker.symbol.toUpperCase() === selectedSymbolRef.current.toUpperCase()) {
        setTicker(newTicker);
      }
    });

    const unsubKline = binanceWsManager.onKline((kline, isClosed) => {
      setKlines((prev) => {
        if (!prev || prev.length === 0) return [kline];
        const last = prev[prev.length - 1];
        if (last.time === kline.time) {
          const updated = [...prev];
          updated[updated.length - 1] = kline;
          return updated;
        } else if (kline.time > last.time) {
          return [...(prev || []).slice(1), kline];
        }
        return prev;
      });
    });

    // Refresh background polling every 5 seconds
    const interval = setInterval(() => {
      fetchMarketData(timeframeRef.current, selectedSymbolRef.current, botConfigRef.current?.marketType || 'FUTURES');
    }, 5000);

    return () => {
      clearInterval(interval);
      unsubState();
      unsubTicker();
      unsubKline();
      binanceWsManager.disconnect();
    };
  }, [timeframe, selectedSymbol, botConfig.marketType]);

  const handlePairChange = (pair: TradingPair | string) => {
    const sym = typeof pair === 'string' ? pair : pair.symbol;
    const activeMT = botConfig.marketType || 'FUTURES';
    setSelectedSymbol(sym);
    selectedSymbolRef.current = sym;
    try {
      apiStorage.setItem('selected_trading_pair', sym);
    } catch (e) {
      // ignore storage error
    }
    
    // Reset last analysis throttle so new coin receives immediate fresh analysis
    lastAnalysisCallRef.current = 0;
    
    // 1. INSTANT DIRECT REST FETCH (sub-80ms) for immediate chart, price & report update
    instantFetchMarketData(sym, timeframeRef.current, activeMT);

    // 2. Point WebSocket to new symbol
    binanceWsManager.setSymbol(sym);

    // 3. Fetch comprehensive AI & MTF data in background
    fetchMarketData(timeframeRef.current, sym, activeMT, true);
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    timeframeRef.current = tf;
    try {
      apiStorage.setItem('app_trading_timeframe', tf);
    } catch {}
    
    const activeMT = botConfig.marketType || 'FUTURES';
    const sym = selectedSymbolRef.current;

    // 1. INSTANT DIRECT REST FETCH for new timeframe klines
    instantFetchMarketData(sym, tf, activeMT);

    // 2. Switch WebSocket timeframe
    binanceWsManager.setTimeframe(tf);

    // 3. Fetch backend market data
    fetchMarketData(tf, sym, activeMT);
  };

  const handleToggleMarketType = (newMarketType: MarketType) => {
    setBotConfig((prev) => ({
      ...prev,
      marketType: newMarketType,
      leverage: newMarketType === 'FUTURES' ? ((prev.leverage && prev.leverage > 1) ? prev.leverage : 3) : 1,
    }));
    
    const sym = selectedSymbolRef.current;
    const tf = timeframeRef.current;

    // Instant update
    instantFetchMarketData(sym, tf, newMarketType);
    binanceWsManager.setMarketType(newMarketType);
    fetchMarketData(tf, sym, newMarketType);
  };

  const handleClearTradeHistory = () => {
    activeBotPositionsRef.current = [];
    tradeHistoryRef.current = [];
    setActiveBotPositions([]);
    setTradeHistory([]);
    try {
      apiStorage.removeItem('btc_active_bot_positions');
      apiStorage.removeItem('btc_trade_history');
    } catch (e) {}
  };

  const handleDeleteTrade = (id: string) => {
    setTradeHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSeedSampleHistory = () => {
    const now = Date.now();
    const sampleTrades: TradeHistoryItem[] = [
      {
        id: 'sample-1',
        symbol: 'BTCUSDT',
        timestamp: now - 1000 * 60 * 60 * 24 * 5,
        decision: 'LONG',
        timeframe: '1h',
        entryPrice: 94250,
        tp1: 96150,
        tp2: 98000,
        tp3: 100000,
        stopLoss: 92800,
        status: 'TP1_HIT',
        profitPercent: 2.01,
        confidence: 84,
        reason: 'Bullish EMA breakout & RSI momentum surge',
      },
      {
        id: 'sample-2',
        symbol: 'ETHUSDT',
        timestamp: now - 1000 * 60 * 60 * 24 * 4,
        decision: 'LONG',
        timeframe: '1h',
        entryPrice: 2650,
        tp1: 2750,
        tp2: 2880,
        tp3: 2990,
        stopLoss: 2580,
        status: 'TP2_HIT',
        profitPercent: 8.68,
        confidence: 88,
        reason: 'Multi-Timeframe 4h Confluence',
      },
      {
        id: 'sample-3',
        symbol: 'SOLUSDT',
        timestamp: now - 1000 * 60 * 60 * 24 * 3.5,
        decision: 'SHORT',
        timeframe: '15m',
        entryPrice: 182.5,
        tp1: 175.0,
        tp2: 168.0,
        tp3: 160.0,
        stopLoss: 187.0,
        status: 'SL_HIT',
        profitPercent: -2.47,
        confidence: 72,
        reason: 'False breakdown stopped out at resistance',
      },
      {
        id: 'sample-4',
        symbol: 'BTCUSDT',
        timestamp: now - 1000 * 60 * 60 * 24 * 3,
        decision: 'LONG',
        timeframe: '1h',
        entryPrice: 95100,
        tp1: 97000,
        tp2: 99200,
        tp3: 101000,
        stopLoss: 93800,
        status: 'TP1_HIT',
        profitPercent: 2.0,
        confidence: 82,
        reason: 'Orderbook delta absorption',
      },
      {
        id: 'sample-5',
        symbol: 'BNBUSDT',
        timestamp: now - 1000 * 60 * 60 * 24 * 2.5,
        decision: 'LONG',
        timeframe: '4h',
        entryPrice: 620,
        tp1: 645,
        tp2: 670,
        tp3: 700,
        stopLoss: 605,
        status: 'TP2_HIT',
        profitPercent: 8.06,
        confidence: 90,
        reason: 'Key structural retest & volume expansion',
      },
      {
        id: 'sample-6',
        symbol: 'XRPUSDT',
        timestamp: now - 1000 * 60 * 60 * 24 * 2,
        decision: 'SHORT',
        timeframe: '1h',
        entryPrice: 2.45,
        tp1: 2.3,
        tp2: 2.15,
        tp3: 2.0,
        stopLoss: 2.55,
        status: 'TP1_HIT',
        profitPercent: 6.12,
        confidence: 78,
        reason: 'Overbought MACD divergence',
      },
      {
        id: 'sample-7',
        symbol: 'BTCUSDT',
        timestamp: now - 1000 * 60 * 60 * 24 * 1.5,
        decision: 'SHORT',
        timeframe: '15m',
        entryPrice: 97800,
        tp1: 96000,
        tp2: 94500,
        tp3: 93000,
        stopLoss: 98900,
        status: 'SL_HIT',
        profitPercent: -1.12,
        confidence: 69,
        reason: 'Bullish macro continuation',
      },
      {
        id: 'sample-8',
        symbol: 'ETHUSDT',
        timestamp: now - 1000 * 60 * 60 * 24 * 1,
        decision: 'LONG',
        timeframe: '1h',
        entryPrice: 2710,
        tp1: 2820,
        tp2: 2950,
        tp3: 3100,
        stopLoss: 2640,
        status: 'TP1_HIT',
        profitPercent: 4.06,
        confidence: 86,
        reason: 'Golden cross on 1h timeframe',
      },
      {
        id: 'sample-9',
        symbol: 'SOLUSDT',
        timestamp: now - 1000 * 60 * 60 * 18,
        decision: 'LONG',
        timeframe: '4h',
        entryPrice: 188.0,
        tp1: 196.0,
        tp2: 205.0,
        tp3: 220.0,
        stopLoss: 182.0,
        status: 'TP2_HIT',
        profitPercent: 9.04,
        confidence: 91,
        reason: 'Breakout above $190 psychological level',
      },
      {
        id: 'sample-10',
        symbol: 'BTCUSDT',
        timestamp: now - 1000 * 60 * 60 * 6,
        decision: 'LONG',
        timeframe: '1h',
        entryPrice: 96400,
        tp1: 98300,
        tp2: 100500,
        tp3: 103000,
        stopLoss: 95200,
        status: 'TP1_HIT',
        profitPercent: 1.97,
        confidence: 85,
        reason: 'Institutional VWAP bounce',
      },
    ];
    setTradeHistory(sampleTrades);
  };

  const handleExecuteManualBinanceOrder = async (
    side: 'BUY' | 'SELL',
    quoteAmountUsdt: number
  ): Promise<{ success: boolean; message: string }> => {
    const isArabicLang = language === 'ar';
    if (!binanceConfig.apiKey || !binanceConfig.apiSecret) {
      return {
        success: false,
        message: isArabicLang ? 'يرجى إدخال مفاتيح Binance API أولاً.' : 'Veuillez configurer les clés API Binance.',
      };
    }
    
    // Calculate quantity for futures if price is available
    const currentPrice = ticker?.price || 0;
    const computedQuantity = (binanceConfig.marketType === 'FUTURES' && currentPrice > 0) 
      ? Number((quoteAmountUsdt / currentPrice).toFixed(5))
      : undefined;

    try {
      const res = await fetch('/api/binance/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: binanceConfig.apiKey,
          apiSecret: binanceConfig.apiSecret,
          useTestnet: binanceConfig.useTestnet,
          marketType: binanceConfig.marketType,
          symbol: selectedSymbol,
          side,
          type: 'MARKET',
          ...(quoteAmountUsdt ? { quoteOrderQty: quoteAmountUsdt } : {}),
          ...(computedQuantity ? { quantity: computedQuantity } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const order = data.order;
        const newLog: AutoTradeLog = {
          id: `manual-${Date.now()}`,
          timestamp: Date.now(),
          type: side === 'BUY' ? 'AUTO_BUY' : 'AUTO_SELL_TP1',
          symbol: selectedSymbol,
          side,
          price: ticker?.price || 0,
          amountUsdt: quoteAmountUsdt,
          reason: isArabicLang
            ? `أمر يدوي فوري على بايننس (Order ID: ${order.orderId})`
            : `Ordre direct manuel Binance (ID: ${order.orderId})`,
          mode: 'BINANCE_LIVE',
        };
        addBotLog(newLog);
        playAudioChime();
        return {
          success: true,
          message: isArabicLang
            ? `تم تنفيذ أمر ${side} بنجاح على بايننس! (رقم الأمر: ${order.orderId})`
            : `Ordre ${side} exécuté avec succès sur Binance ! (ID: ${order.orderId})`,
        };
      } else {
        return {
          success: false,
          message: data.hint || data.error || (isArabicLang ? 'فشل تنفيذ الأمر على بايننس.' : 'Échec de l\'ordre Binance.'),
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || (isArabicLang ? 'خطأ في الاتصال بخادم بايننس.' : 'Erreur réseau avec Binance.'),
      };
    }
  };

  return (
    <div className={`min-h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-brand-500 selection:text-slate-950 relative ${isArabic ? 'rtl text-right' : 'ltr'} mode-${effectiveDisplayMode}`}>
      {authChecking ? (
        <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : !isAuthenticated ? (
        <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4">
          <AuthScreen onLogin={handleLogin} language={language} />
        </div>
      ) : (
        <div className={`w-full min-h-screen flex ${isAndroidView ? 'justify-center items-start p-2 sm:p-4 bg-slate-950' : 'flex-col md:flex-row bg-slate-950'}`}>
          {/* Sidebar & Mobile Drawer (Quantura Design) */}
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            language={language}
            username={username || 'jaouad'}
            onLogout={handleLogout}
            connectionPing={connectionState === 'CONNECTED' ? (ticker ? Math.floor(Math.random() * (40 - 15) + 15) : 21) : 0}
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            botEnabled={botConfig.enabled}
            executionMode={executionMode}
            binanceConfig={binanceConfig}
            paperWallet={paperWallet}
            activeBotPositions={activeBotPositions}
            isDesktopOpen={isDesktopSidebarOpen}
            isAndroidView={isAndroidView}
            onOpenHelp={() => setIsHelpModalOpen(true)}
          />

          {/* Main Workspace */}
          <div className={`flex-1 flex flex-col min-w-0 ${isAndroidView ? 'bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[420px] shadow-2xl overflow-hidden min-h-[92vh] max-h-[96vh] relative ring-1 ring-slate-800/80' : 'min-h-screen bg-slate-950'}`}>
            {/* Navigation & Header */}
            <Header
              onOpenMenu={() => {
                if (isAndroidView) {
                  setIsMobileMenuOpen((prev) => !prev);
                } else {
                  setIsDesktopSidebarOpen((prev) => !prev);
                  setIsMobileMenuOpen((prev) => !prev);
                }
              }}
              selectedSymbol={selectedSymbol}
              onSelectPair={handlePairChange}
              ticker={ticker}
              connectionState={connectionState}
              language={language}
              timezone={timezone}
              onTimezoneChange={setTimezone}
              isAndroidView={isAndroidView}
              unreadAlertsCount={alerts.filter((a) => !a.read).length}
              soundEnabled={soundEnabled}
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={toggleNotifications}
              isRefreshing={isRefreshing}
              isDeveloperMode={isDeveloperMode}
              binanceConfig={binanceConfig}
              executionMode={executionMode}
              paperWallet={paperWallet}
              activeBotPositions={activeBotPositions}
              marketType={botConfig.marketType || 'FUTURES'}
              onToggleMarketType={handleToggleMarketType}
              onOpenBinanceModal={() => setIsBinanceModalOpen(true)}
              onOpenCustomBalanceModal={() => setIsCustomBalanceModalOpen(true)}
              onLanguageChange={setLanguage}
              onToggleAndroidView={() => setIsAndroidView(!isAndroidView)}
              displayMode={displayMode}
              onChangeDisplayMode={setDisplayMode}
              onOpenNotifications={() => setIsNotificationsOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenRiskModal={() => setIsRiskModalOpen(true)}
              onOpenHelp={() => setIsHelpModalOpen(true)}
              onPanicCloseAll={handlePanicCloseAll}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
              onRefreshData={() => fetchMarketData(timeframe, selectedSymbol, botConfig.marketType || 'FUTURES')}
              onLogout={handleLogout}
              username={username || 'JAOUAD'}
              botEnabled={botConfig.enabled}
              onToggleBot={handleToggleBot}
              activeTab={activeTab}
              onNavigateTab={setActiveTab}
              openPositionsCount={activeBotPositions.length}
            />

            {/* Scrollable workspace content container */}
            <div className={`flex-1 flex flex-col min-w-0 ${isAndroidView ? 'overflow-y-auto' : ''}`}>
              {/* Navigation Tabs Bar */}
              <nav className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-2.5 sm:px-4 py-2 relative z-20">
                <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActiveTab('signal')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'signal'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>{t.tabs.signal}</span>
                </button>

                <button
                  onClick={() => setActiveTab('autoBot')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'autoBot'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>{t.tabs.autoBot}</span>
                  {botConfig.enabled && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('globalScanner')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'globalScanner'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Radar className="w-3.5 h-3.5" />
                  <span>{t.tabs.globalScanner || (isArabic ? 'رادار السوق الشامل' : 'Global Scanner')}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                </button>

                <button
                  onClick={() => setActiveTab('mtf')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'mtf'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t.tabs.mtf}</span>
                </button>

                <button
                  onClick={() => setActiveTab('market')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'market'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>{t.tabs.market}</span>
                </button>

                <button
                  onClick={() => setActiveTab('chart')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'chart'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <LineChart className="w-3.5 h-3.5" />
                  <span>{t.tabs.chart}</span>
                </button>

                <button
                  onClick={() => setActiveTab('backtest')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'backtest'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{t.tabs.backtest}</span>
                </button>

                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'analysis'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{t.tabs.analysis}</span>
                </button>

                <button
                  onClick={() => setActiveTab('riskWallet')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'riskWallet'
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{t.tabs.riskWallet}</span>
                </button>

                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeTab === 'history'
                      ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>{t.tabs.history}</span>
                </button>
              </div>
            </nav>

            {/* Main Content Area */}
            <main className={`w-full ${isAndroidView ? 'px-3 py-3' : 'max-w-7xl mx-auto px-3 sm:px-6 py-4'} space-y-4 pb-6 flex-1`}>
          {/* Tab 1: Terminal & Main Signal */}
          {activeTab === 'signal' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
              {/* Left Column: Quantitative Signal Card */}
              <div className="w-full lg:col-span-5 xl:col-span-5">
                <SignalCard
                  symbol={selectedSymbol}
                  signal={activeSignal}
                  language={language}
                  onAnalyze={() => runAnalysis(marketData, true)}
                  isAnalyzing={isAnalyzing}
                  botConfig={botConfig}
                  marketData={marketData}
                  ticker={ticker}
                  onUpdateBotConfig={(partial) => {
                    if (partial.marketType && partial.marketType !== botConfig.marketType) {
                      handleToggleMarketType(partial.marketType);
                    } else {
                      setBotConfig((prev) => ({ ...prev, ...partial }));
                    }
                  }}
                  onNotifyRecommendation={(plan) => pushNewAlert(plan, true)}
                  onOpenNotifications={() => setIsNotificationsOpen(true)}
                  liquidityAssessment={liquidityAssessment}
                  onOpenDepthDetails={() => setActiveTab('market')}
                />
              </div>

              {/* Right Column: Interactive Live Chart */}
              <div className="w-full lg:col-span-7 xl:col-span-7 min-h-[480px] lg:min-h-[640px]" style={{ visibility: isSettingsOpen || isBinanceModalOpen ? 'hidden' : 'visible' }}>
                <TradingChart
                  symbol={selectedSymbol}
                  klines={klines}
                  activeTimeframe={timeframe}
                  onTimeframeChange={handleTimeframeChange}
                  activeSignal={activeSignal}
                  language={language}
                  ticker={ticker}
                  activeBotPositions={activeBotPositions}
                  marketType={botConfig.marketType}
                />
              </div>
            </div>
          )}

          {/* Tab: Automated AI Trading Bot (Auto Buy, TP1 Exit 50%, Rebuy, TP2 Exit) */}
          {activeTab === 'autoBot' && (
            <AutoTradingBot
              language={language}
              botConfig={botConfig}
              activePositions={activeBotPositions}
              selectedSymbol={selectedSymbol}
              logs={botLogs}
              walletBalance={paperWallet.balance}
              paperWallet={paperWallet}
              currentPrice={ticker?.price || 0}
              activeSignal={activeSignal}
              effectiveBotTimeframe={botConfig.timeframe === 'AUTO' || !botConfig.timeframe ? autoBotTimeframeInfo.effectiveTimeframe : (botConfig.timeframe as Timeframe)}
              timeframeReason={language === 'ar' ? autoBotTimeframeInfo.reasonAr : autoBotTimeframeInfo.reasonEn}
              executionMode={executionMode}
              binanceConfig={binanceConfig}
              onOpenBinanceModal={() => setIsBinanceModalOpen(true)}
              onOpenCustomBalanceModal={() => setIsCustomBalanceModalOpen(true)}
              onToggleBot={handleToggleBot}
              onUpdateConfig={(partial) => {
                if (partial.marketType && partial.marketType !== botConfig.marketType) {
                  handleToggleMarketType(partial.marketType);
                  setBotConfig((prev) => ({ ...prev, ...partial }));
                } else {
                  setBotConfig((prev) => ({ ...prev, ...partial }));
                }
              }}
              onManualClosePosition={(posId) => {
                if (posId) {
                  const currentPositions = activeBotPositionsRef.current;
                  const pos = currentPositions.find(p => p.id === posId);
                  if (pos) {
                    const isSelected = pos.symbol.toLowerCase() === selectedSymbol.toLowerCase();
                    const priceToUse = (isSelected && ticker?.price) ? ticker.price : (pos.currentPrice || pos.entryPrice);
                    executeAutoTradeAction('SL', priceToUse, 'Manual exit triggered', posId);
                  } else {
                    updateBotPositionsSync((prev) => prev.filter(p => p.id !== posId));
                  }
                }
              }}
              onManualTriggerBuy={() => {
                if (ticker?.price) {
                  const currentPositions = activeBotPositionsRef.current;
                  const isLive = executionModeRef.current === 'BINANCE_LIVE';
                  const modePositions = currentPositions.filter(p => isLive ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
                  const maxTrades = botConfigRef.current.maxOpenTrades || 3;
                  if (modePositions.length >= maxTrades) {
                    const msg = language === 'ar'
                      ? `تم رفض العملية: لديك حالياً ${modePositions.length} صفقات مفتوحة من أصل ${maxTrades} صفقات كحد أقصى!`
                      : `Action Rejected: You already have ${modePositions.length}/${maxTrades} maximum open trades!`;
                    const rejectAlert: PushAlert = {
                      id: `alert-manual-max-${Date.now()}`,
                      title: language === 'ar' ? 'تم رفض فتح الصفقة (الحد الأقصى)' : 'Trade Rejected (Max Limit)',
                      body: msg,
                      timestamp: Date.now(),
                      type: 'SYSTEM',
                      read: false,
                    };
                    setAlerts(prev => [rejectAlert, ...(prev || []).slice(0, 29)]);
                    triggerToastAlert(rejectAlert);
                    playAudioChime();
                    return;
                  }
                  executeAutoTradeAction('OPEN', ticker.price, 'Manual buy triggered');
                }
              }}
              onManualTriggerOpen={(direction) => {
                if (ticker?.price) {
                  const currentPositions = activeBotPositionsRef.current;
                  const isLive = executionModeRef.current === 'BINANCE_LIVE';
                  const modePositions = currentPositions.filter(p => isLive ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
                  const maxTrades = botConfigRef.current.maxOpenTrades || 3;
                  if (modePositions.length >= maxTrades) {
                    const msg = language === 'ar'
                      ? `تم رفض العملية: لديك حالياً ${modePositions.length} صفقات مفتوحة من أصل ${maxTrades} صفقات كحد أقصى!`
                      : `Action Rejected: You already have ${modePositions.length}/${maxTrades} maximum open trades!`;
                    const rejectAlert: PushAlert = {
                      id: `alert-manual-max-${Date.now()}`,
                      title: language === 'ar' ? 'تم رفض فتح الصفقة (الحد الأقصى)' : 'Trade Rejected (Max Limit)',
                      body: msg,
                      timestamp: Date.now(),
                      type: 'SYSTEM',
                      read: false,
                    };
                    setAlerts(prev => [rejectAlert, ...(prev || []).slice(0, 29)]);
                    triggerToastAlert(rejectAlert);
                    playAudioChime();
                    return;
                  }
                  executeAutoTradeAction('OPEN', ticker.price, `Manual ${direction} triggered`, undefined, direction);
                }
              }}
              onClearLogs={() => setBotLogs([])}
              onPanicCloseAll={handlePanicCloseAll}
              onResetCircuitBreaker={handleResetCircuitBreaker}
              onTrimExcessPositions={handleTrimExcessPositions}
              onFullReset={handleFullReset}
            />
          )}

          {/* Tab: Dedicated Global Market Scanner */}
          {activeTab === 'globalScanner' && (
            <GlobalMarketScanner
              language={language}
              onSelectPair={handlePairChange}
              onNavigateToTab={(tab) => setActiveTab(tab as any)}
              selectedSymbol={selectedSymbol}
              botEnabled={botConfig.enabled}
            />
          )}

          {/* Tab 2: Multi-Timeframe Matrix */}
          {activeTab === 'mtf' && (
            <MultiTimeframeView
              marketData={marketData}
              language={language}
              onSelectTimeframe={(tf) => {
                handleTimeframeChange(tf);
                setActiveTab('signal');
              }}
            />
          )}

          {/* Tab 3: Order Book Depth & Derivatives */}
          {activeTab === 'market' && (
            <MarketOverviewView
              marketData={marketData}
              language={language}
            />
          )}

          {/* Tab 4: Full Chart */}
          {activeTab === 'chart' && (
            <div className="flex-1 min-h-0" style={{ visibility: isSettingsOpen || isBinanceModalOpen ? 'hidden' : 'visible' }}>
              <TradingChart
                symbol={selectedSymbol}
                klines={klines}
                activeTimeframe={timeframe}
                onTimeframeChange={handleTimeframeChange}
                activeSignal={activeSignal}
                language={language}
                ticker={ticker}
                activeBotPositions={activeBotPositions}
                marketType={botConfig.marketType || 'FUTURES'}
                onManualClosePosition={handlePanicCloseAll}
              />
            </div>
          )}

          {/* Tab 5: Real Historical Backtesting */}
          {activeTab === 'backtest' && (
            <BacktestView
              klines={klines}
              activeTimeframe={timeframe}
              symbol={selectedSymbol}
              language={language}
              timezone={timezone}
              botConfig={botConfig}
              onUpdateBotConfig={(newConfig) => {
                setBotConfig((prev) => {
                  const updated = { ...prev, ...newConfig };
                  try {
                    apiStorage.setItem('btc_bot_config', JSON.stringify(updated));
                  } catch (e) {
                    console.error('Failed to persist bot config', e);
                  }
                  return updated;
                });
              }}
              onSelectSymbol={handlePairChange}
              onNavigateToBot={() => setActiveTab('autoBot')}
            />
          )}

          {/* Tab 6: Full Detailed Analysis & Indicators */}
          {activeTab === 'analysis' && (
            <QwenAnalysisView
              analysis={activeSignal}
              marketData={marketData}
              language={language}
              onRefresh={() => runAnalysis(marketData, true)}
              isRefreshing={isRefreshing || isAnalyzing}
              onSelectSymbol={handlePairChange}
              selectedSymbol={selectedSymbol}
            />
          )}

          {/* Tab 7: Risk Management & Paper Wallet */}
          {activeTab === 'riskWallet' && (
            <RiskCalculatorView
              currentPrice={ticker?.price || 0}
              activeSignal={activeSignal}
              language={language}
              paperWallet={paperWallet}
              onUpdatePaperWallet={setPaperWallet}
              onOpenCustomBalanceModal={() => setIsCustomBalanceModalOpen(true)}
              onFullReset={handleFullReset}
              executionMode={executionMode as any}
              binanceConfig={binanceConfig}
              selectedSymbol={selectedSymbol}
              activeBotPositions={activeBotPositions}
            />
          )}

          {/* Tab 8: Signal History */}
          {activeTab === 'history' && (
            <TradeHistory
              history={[
                ...activeBotPositions.map(pos => ({
                  id: pos.id,
                  timestamp: pos.openedAt,
                  symbol: pos.symbol,
                  decision: pos.decision,
                  timeframe: timeframe,
                  entryPrice: pos.entryPrice,
                  currentPrice: (pos.symbol.toLowerCase() === selectedSymbol.toLowerCase() && ticker?.price) ? ticker.price : (pos.currentPrice || pos.entryPrice),
                  tp1: pos.tp1,
                  tp2: pos.tp2,
                  tp3: pos.tp3,
                  stopLoss: pos.stopLoss,
                  status: 'ACTIVE' as const,
                  profitPercent: 0,
                  confidence: activeSignal?.confidence || 75,
                  pnlHistory: pos.pnlHistory,
                })),
                ...tradeHistory.filter(t => t.status !== 'ACTIVE')
              ]}
              paperWallet={paperWallet}
              language={language}
              currentPrice={ticker?.price}
              onClearHistory={handleClearTradeHistory}
              onDeleteTrade={handleDeleteTrade}
              onCloseActivePosition={(id) => {
                const target = activeBotPositions.find(p => p.id === id);
                const isSelected = target?.symbol.toLowerCase() === selectedSymbol.toLowerCase();
                const targetPrice = (isSelected && ticker?.price) ? ticker.price : (target?.currentPrice || target?.entryPrice || 0);
                executeAutoTradeAction('SL', targetPrice, isArabic ? 'إغلاق يدوي من سجل الصفقات' : 'Manual close from Trade Journal', id);
              }}
              onSeedSampleData={handleSeedSampleHistory}
              onFullReset={handleFullReset}
            />
          )}
        </main>

        {/* Global Institutional Platform Footer */}
        <Footer
          language={language}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          executionMode={executionMode}
          binanceConfig={binanceConfig}
          onOpenBinanceModal={() => setIsBinanceModalOpen(true)}
          onOpenRiskModal={() => setIsRiskModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
        />
            </div>
          </div>
        </div>
      )}

      {/* Root-Level Modals & Overlays (Unconstrained by workspace scroll or clipping) */}
      <RiskManagementModal
            isOpen={isRiskModalOpen}
            onClose={() => setIsRiskModalOpen(false)}
            language={language}
            botConfig={botConfig}
            onSaveConfig={(cfg) => {
              setBotConfig(cfg);
            }}
            executionMode={executionMode}
            binanceConfig={binanceConfig}
            paperWallet={paperWallet}
          />

          <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          language={language}
          timezone={timezone}
          isDeveloperMode={isDeveloperMode}
          soundEnabled={soundEnabled}
          notificationsEnabled={notificationsEnabled}
          minConfidenceThreshold={minConfidenceThreshold}
          telegramBotToken={telegramBotToken}
          telegramChatId={telegramChatId}
          binanceConfig={binanceConfig}
          executionMode={executionMode}
          paperWallet={paperWallet}
          onOpenBinanceModal={() => {
            setIsSettingsOpen(false);
            setIsBinanceModalOpen(true);
          }}
          onOpenCustomBalanceModal={() => {
            setIsSettingsOpen(false);
            setIsCustomBalanceModalOpen(true);
          }}
          onOpenHelp={() => {
            setIsSettingsOpen(false);
            setIsHelpModalOpen(true);
          }}
          onRefreshBinancePermissions={fetchLiveBinanceBalance}
          onLanguageChange={setLanguage}
          onTimezoneChange={setTimezone}
          onToggleDeveloperMode={setIsDeveloperMode}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onToggleNotifications={toggleNotifications}
          onConfidenceChange={setMinConfidenceThreshold}
          onTelegramConfigChange={(token, chatId) => {
            setTelegramBotToken(token);
            setTelegramChatId(chatId);
          }}
          onLogout={handleLogout}
          onFullReset={handleFullReset}
        />

        {/* Custom Paper Balance Management Modal */}
        <CustomBalanceModal
          isOpen={isCustomBalanceModalOpen}
          onClose={() => setIsCustomBalanceModalOpen(false)}
          language={language}
          paperWallet={paperWallet}
          onUpdateBalance={handleUpdateCustomBalance}
          activeBotPositions={activeBotPositions}
        />

        {/* Binance Real API Trading Connection Modal */}
        <BinanceConnectionModal
          isOpen={isBinanceModalOpen}
          onClose={() => setIsBinanceModalOpen(false)}
          binanceConfig={binanceConfig}
          config={binanceConfig}
          executionMode={executionMode}
          paperWallet={paperWallet}
          selectedSymbol={selectedSymbol}
          currentSymbol={selectedSymbol}
          currentPrice={ticker?.price || 0}
          language={language}
          onSaveConfig={(newConfig) => {
            setBinanceConfig(newConfig);
            if (newConfig.isLiveModeEnabled !== undefined) {
              handleSetExecutionMode(newConfig.isLiveModeEnabled ? 'BINANCE_LIVE' : 'PAPER');
            }
          }}
          onToggleExecutionMode={(mode) => handleSetExecutionMode(mode)}
          onToggleMode={(mode) => handleSetExecutionMode(mode)}
          onExecuteManualBinanceOrder={handleExecuteManualBinanceOrder}
          onExecuteManualTrade={handleExecuteManualBinanceOrder}
        />

        {/* Push Notification Center Modal */}
        <NotificationCenter
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          alerts={alerts}
          onMarkAllAsRead={() => {
            setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
          }}
          onClearAllAlerts={() => {
            setAlerts([]);
            try {
              apiStorage.removeItem('btc_push_alerts');
            } catch {}
          }}
          onDeleteAlert={(id) => {
            setAlerts((prev) => prev.filter((a) => a.id !== id));
          }}
          language={language}
          onSendTestAlert={() => activeSignal && pushNewAlert(activeSignal, true)}
        />

        {/* Quick Start & Help Guide Modal */}
        <HelpQuickStartModal
          isOpen={isHelpModalOpen}
          onClose={() => setIsHelpModalOpen(false)}
          language={language}
          onNavigateToTab={(tab) => {
            setIsHelpModalOpen(false);
            setActiveTab(tab as any);
          }}
          onOpenBinanceModal={() => {
            setIsHelpModalOpen(false);
            setIsBinanceModalOpen(true);
          }}
          onOpenRiskModal={() => {
            setIsHelpModalOpen(false);
            setIsRiskModalOpen(true);
          }}
          onOpenSettingsModal={() => {
            setIsHelpModalOpen(false);
            setIsSettingsOpen(true);
          }}
        />

        {/* Floating Recommendation Notification Toast Alert */}
        {isAuthenticated && activeToastAlert && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div
              className={`p-4 rounded-2xl border shadow-2xl  ${
                activeToastAlert.decision === 'LONG'
                  ? 'bg-slate-900/95 border-amber-500/50 shadow-emerald-500/15 ring-1 ring-emerald-500/30'
                  : activeToastAlert.decision === 'SHORT'
                  ? 'bg-slate-900/95 border-rose-500/50 shadow-rose-500/15 ring-1 ring-rose-500/30'
                  : 'bg-slate-900/95 border-sky-500/50 shadow-sky-500/15 ring-1 ring-sky-500/30'
              } ${language === 'ar' ? 'rtl text-right' : 'ltr'}`}
            >
              <div className="flex items-start gap-3">
                {/* Differentiated Icon */}
                <div
                  className={`p-2.5 rounded-xl border shrink-0 ${
                    activeToastAlert.decision === 'LONG'
                      ? 'bg-emerald-500/20 text-amber-400 border-amber-500/40 shadow-md shadow-emerald-500/10'
                      : activeToastAlert.decision === 'SHORT'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-md shadow-rose-500/10'
                      : 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-md shadow-sky-500/10'
                  }`}
                >
                  {activeToastAlert.decision === 'LONG' ? (
                    <TrendingUp className="w-5 h-5 animate-pulse" />
                  ) : activeToastAlert.decision === 'SHORT' ? (
                    <TrendingDown className="w-5 h-5 animate-pulse" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {/* Prominent Trading Pair Pill */}
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-black bg-amber-400/15 text-amber-300 border border-amber-500/30 shadow-sm">
                        {formatPairName(activeToastAlert.symbol || selectedSymbol)}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                        activeToastAlert.decision === 'LONG'
                          ? 'bg-emerald-500/20 text-emerald-300 border-amber-500/40'
                          : activeToastAlert.decision === 'SHORT'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      }`}>
                        {activeToastAlert.decision === 'LONG' ? (
                          <>
                            <ArrowUpRight className="w-3 h-3" />
                            <span>{language === 'ar' ? 'صفقة شراء' : language === 'en' ? 'BUY Signal' : 'Signal ACHAT'}</span>
                          </>
                        ) : activeToastAlert.decision === 'SHORT' ? (
                          <>
                            <ArrowDownRight className="w-3 h-3" />
                            <span>{language === 'ar' ? 'صفقة بيع' : language === 'en' ? 'SELL Signal' : 'Signal VENTE'}</span>
                          </>
                        ) : (
                          <>
                            <Info className="w-3 h-3" />
                            <span>{language === 'ar' ? 'تنبيه عادي' : language === 'en' ? 'Market Info' : 'Info Marché'}</span>
                          </>
                        )}
                      </span>
                    </div>

                    <button
                      onClick={() => setActiveToastAlert(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                      title={language === 'ar' ? 'إغلاق' : 'Fermer'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h5 className="text-xs font-bold text-white truncate mb-1">
                    {activeToastAlert.title}
                  </h5>
                  <p className="text-xs text-slate-300 leading-snug line-clamp-2 bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                    {activeToastAlert.body}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <button
                      onClick={() => {
                        setIsNotificationsOpen(true);
                        setActiveToastAlert(null);
                      }}
                      className="text-[11px] font-bold text-brand-400 hover:text-brand-300 underline"
                    >
                      {language === 'ar' ? 'فتح مركز التنبيهات' : language === 'en' ? 'Open Alerts' : 'Voir dans le centre'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default App;

