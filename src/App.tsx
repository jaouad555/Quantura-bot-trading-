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

import { NotificationCenter } from './components/NotificationCenter';
import { BinanceConnectionModal } from './components/BinanceConnectionModal';
import { CustomBalanceModal } from './components/CustomBalanceModal';
import { AuthScreen } from './components/AuthScreen';
import { translations } from './utils/translations';
import { binanceWsManager } from './utils/binanceWs';
import { generateQuantitativePlan, determineOptimalBotTimeframe } from './utils/quantEngine';
import { calculateTechnicalIndicators } from './utils/indicators';
import { TradingPair, RESPECTED_TRADING_PAIRS } from './utils/tradingPairs';
import { sendTelegramMessage } from './utils/telegram';
import {
  LayoutDashboard,
  Bot,
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
  Key,
  Code2,
  Terminal,
  Cpu
} from 'lucide-react';

const formatPairName = (sym?: string): string => {
  if (!sym) return 'BTC/USDT';
  if (sym.includes('/')) return sym.toUpperCase();
  if (sym.toUpperCase().endsWith('USDT')) {
    return `${sym.slice(0, -4).toUpperCase()}/USDT`;
  }
  return sym.toUpperCase();
};

const normalizeSymbol = (sym?: string): string => (sym || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const App: React.FC = () => {
  // Navigation & UI States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return apiStorage.getItem('app_is_authenticated') === 'true';
    } catch {
      return false;
    }
  });
  const [username, setUsername] = useState<string>(() => {
    try {
      return apiStorage.getItem('app_username') || '';
    } catch {
      return '';
    }
  });

  const handleLogin = (name: string) => {
    setIsAuthenticated(true);
    setUsername(name);
    try {
      apiStorage.setItem('app_is_authenticated', 'true');
      apiStorage.setItem('app_username', name);
    } catch {}
  };

  const handleLogout = useCallback(() => {
    try {
      apiStorage.removeItem('app_is_authenticated');
      apiStorage.removeItem('app_username');
      sessionStorage.removeItem('app_is_authenticated');
      sessionStorage.removeItem('app_username');
    } catch (err) {}
    
    // Set states to force immediate re-render to AuthScreen
    setIsAuthenticated(false);
    setUsername('');
  }, []);

  const [activeTab, setActiveTab] = useState<
    'signal' | 'autoBot' | 'mtf' | 'market' | 'chart' | 'backtest' | 'analysis' | 'history' | 'riskWallet'
  >('signal');
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = apiStorage.getItem('app_language');
      if (saved && (saved === 'fr' || saved === 'ar' || saved === 'en')) return saved as Language;
    } catch {}
    return 'fr';
  });
  const [timezone, setTimezone] = useState<TimezoneMode>(() => {
    try {
      const saved = apiStorage.getItem('app_timezone');
      if (saved) return saved as TimezoneMode;
    } catch {}
    return 'GMT+1';
  });
  const [isAndroidView, setIsAndroidView] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeToastAlert, setActiveToastAlert] = useState<PushAlert | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = apiStorage.getItem('app_sound_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

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

  // Securely load config status from backend
  useEffect(() => {
    fetch('/api/config/binance')
      .then(res => res.json())
      .then(data => {
        if (data.configured) {
          setBinanceConfig(prev => ({
            ...prev,
            apiKey: data.apiKeyPrefix,
            apiSecret: '****************', // Fake mask
            useTestnet: data.useTestnet,
            marketType: data.marketType,
            isConnected: true
          }));
        } else {
           setBinanceConfig(prev => ({ ...prev, isConnected: false, apiKey: '', apiSecret: '' }));
        }
      })
      .catch(console.error);
  }, []);


  const [executionMode, setExecutionMode] = useState<TradingExecutionMode>(() => {
    try {
      const saved = apiStorage.getItem('trading_execution_mode');
      return (saved as TradingExecutionMode) || 'PAPER';
    } catch {
      return 'PAPER';
    }
  });

  const [isBinanceModalOpen, setIsBinanceModalOpen] = useState(false);
  const [isCustomBalanceModalOpen, setIsCustomBalanceModalOpen] = useState(false);

  // Auto-Trading Bot State
  const [botConfig, setBotConfig] = useState<AutoBotConfig>(() => {
    const defaults: AutoBotConfig = {
      enabled: false,
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
    setBotLogs((prev) => [newLog, ...prev.slice(0, 49)]);
    
    if (telegramBotTokenRef.current && telegramChatIdRef.current) {
      const modeText = newLog.mode === 'BINANCE_LIVE' ? '🔴 LIVE' : '🧪 PAPER';
      const pnlText = newLog.pnlUsdt ? `\nPnL: $${newLog.pnlUsdt.toFixed(2)}` : '';
      const message = `<b>🤖 Bot Action (${modeText})</b>\n\nPair: ${newLog.symbol}\nAction: ${newLog.type}\nReason: ${newLog.reason}\nPrice: $${newLog.price}${pnlText}`;
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
  const [klines, setKlines] = useState<KlineCandle[]>([]);
  const [marketData, setMarketData] = useState<MarketDataResponse | null>(null);
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
      return saved
        ? JSON.parse(saved)
        : {
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

  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';

  const handleUpdateCustomBalance = (newBalance: number, resetHistory?: boolean) => {
    setPaperWallet((prev) => ({
      ...prev,
      balance: newBalance,
      realizedPnl: resetHistory ? 0 : prev.realizedPnl,
      history: resetHistory ? [] : prev.history,
    }));
    try {
      apiStorage.setItem('paper_balance', newBalance.toString());
    } catch {
      // ignore
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

  useEffect(() => {
    apiStorage.setItem('btc_active_bot_positions', JSON.stringify(activeBotPositions));
  }, [activeBotPositions]);

  useEffect(() => {
    apiStorage.setItem('btc_bot_logs', JSON.stringify(botLogs));
  }, [botLogs]);

  useEffect(() => {
    apiStorage.setItem('btc_trade_history', JSON.stringify(tradeHistory));
  }, [tradeHistory]);

  useEffect(() => {
    apiStorage.setItem('btc_paper_wallet', JSON.stringify(paperWallet));
  }, [paperWallet]);

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
    if (!soundEnabled) return;
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

  const updateBotPositionsSync = useCallback((updater: (prev: ActiveBotPosition[]) => ActiveBotPosition[]) => {
    activeBotPositionsRef.current = updater(activeBotPositionsRef.current);
    setActiveBotPositions([...activeBotPositionsRef.current]);
  }, []);

  const isOpeningTradeRef = useRef<boolean>(false);


  const botConfigRef = useRef<AutoBotConfig>(botConfig);
  botConfigRef.current = botConfig;

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
  const lastTradedSignalKeyRef = useRef<string>('');
  const lastBotActionTimeRef = useRef<number>(0);

  // Emit Push Alert helper
  const pushNewAlert = useCallback(
    (plan: AIAnalysisResult, isUserInitiated: boolean = false, overrideSymbol?: string) => {
      if (!plan) return;

      const tf = plan.recommendedTimeframe || '1h';
      const isArabic = language === 'ar';
      const isEn = language === 'en';
      const sym = overrideSymbol || selectedSymbolRef.current;
      const pairName = formatPairName(sym);

      // Deduplication key: decision + timeframe + approximate entry + stop loss
      const alertKey = `${plan.decision}_${sym}_${tf}_${Math.round(plan.entryZone?.ideal || 0)}_${Math.round(plan.stopLoss || 0)}`;

      // If this is an automatic background refresh and the trade recommendation is identical, do NOT duplicate the notification
      if (!isUserInitiated && lastEmittedAlertKeyRef.current[sym] === alertKey) {
        return;
      }

      lastEmittedAlertKeyRef.current[sym] = alertKey;

      let title = '';
      let body = '';

      if (plan.decision === 'LONG') {
        title = isArabic
          ? `🟢 [${pairName}] توصية صفقة شراء (BUY / LONG) • ${tf}`
          : isEn
          ? `🟢 [${pairName}] BUY Signal (LONG) • ${tf}`
          : `🟢 [${pairName}] Signal ACHAT (LONG) • ${tf}`;
      } else if (plan.decision === 'SHORT') {
        title = isArabic
          ? `🔴 [${pairName}] توصية صفقة بيع (SELL / SHORT) • ${tf}`
          : isEn
          ? `🔴 [${pairName}] SELL Signal (SHORT) • ${tf}`
          : `🔴 [${pairName}] Signal VENTE (SHORT) • ${tf}`;
      } else {
        title = isArabic
          ? `🔵 [${pairName}] تنبيه مراقبة عادي (WAIT) • ${tf}`
          : isEn
          ? `🔵 [${pairName}] Market Notice (WAIT) • ${tf}`
          : `🔵 [${pairName}] Alerte Marché (ATTENTE) • ${tf}`;
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

      setAlerts((prev) => [newAlert, ...prev.slice(0, 29)]);
      setActiveToastAlert(newAlert);
      playAudioChime();
      
      // Telegram Notification
      if (telegramBotTokenRef.current && telegramChatIdRef.current) {
        const tgMessage = `<b>${title}</b>\n\n${body}`;
        sendTelegramMessage(telegramBotTokenRef.current, telegramChatIdRef.current, tgMessage);
      }

      // Native Browser Notification (if granted)
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
          });
        } catch {
          // Ignore notification errors in iframe environment
        }
      }

      // Auto dismiss floating toast after 5s
      setTimeout(() => {
        setActiveToastAlert((curr) => (curr?.id === newAlert.id ? null : curr));
      }, 5000);
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
            setPaperWallet((prev) => ({
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
          setTradeHistory((prev) => [closedReversalItem, ...prev].slice(0, 500));

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
            ? `🛑 تم رفض فتح الصفقة: تم بلوغ الحد الأقصى للصفقات المتزامنة المسموح بها (${currentModePositions.length}/${maxTrades} صفقات مفتوحة). لن يتم فتح أي صفقة جديدة.`
            : `🛑 Trade Opening Blocked: Maximum open trades limit reached (${currentModePositions.length}/${maxTrades} active positions). No new trades can be opened.`;

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
            title: isArabicLang ? '⚠️ تم رفض فتح الصفقة (اكتمال الحد)' : '⚠️ Trade Rejected (Max Slots Reached)',
            body: rejectMsg,
            timestamp: Date.now(),
            type: 'SYSTEM',
            decision,
            symbol: currentSym,
            price: currentP,
            read: false,
          };
          setAlerts((prev) => [rejectAlert, ...prev.slice(0, 29)]);
          setActiveToastAlert(rejectAlert);
          playAudioChime();
          return;
        }

        let strategyName = 'Custom';
        
        if (currentConfig.activePresets && currentConfig.activePresets.length > 0) {
          if (currentConfig.activePresets.length === 1) {
            strategyName = currentConfig.activePresets[0].charAt(0) + currentConfig.activePresets[0].slice(1).toLowerCase();
          } else {
            // Multi-Strategy Mode: Determine specific strategy based on signal timeframe
            const tf = currentConfig.timeframe === 'AUTO' ? (autoBotTimeframeInfo?.effectiveTimeframe || timeframeRef.current) : (currentConfig.timeframe || timeframeRef.current);
            if (tf === '15m' || tf === '5m') {
              strategyName = 'Scalper';
              if (isFutures) leverage = currentConfig.activePresets.includes('SCALPER') ? 5 : leverage;
            } else if (tf === '1h') {
              strategyName = 'Momentum';
              if (isFutures) leverage = currentConfig.activePresets.includes('MOMENTUM') ? 3 : leverage;
            } else if (tf === '4h' || tf === '1d') {
              strategyName = 'Swing';
              if (isFutures) leverage = currentConfig.activePresets.includes('SWING') ? 2 : leverage;
            } else {
              strategyName = 'Multi-Strategy';
            }
          }
        } else if (currentConfig.timeframe === 'AUTO') {
          strategyName = 'Multi-Strategy';
        }

        const totalEquity = isLiveMode && currentBinance.accountInfo?.totalUsdtEquity
          ? currentBinance.accountInfo.totalUsdtEquity
          : currentWallet.balance + currentModePositions.reduce((sum, pos) => sum + (pos.marginUsdt || pos.initialAmountUsdt), 0);

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

        const tp1 = (isSignalValidForPair && signal?.targets?.tp1) ? signal.targets.tp1 : (decision === 'LONG' ? entryPrice * 1.015 : entryPrice * 0.985);
        const tp2 = (isSignalValidForPair && signal?.targets?.tp2) ? signal.targets.tp2 : (decision === 'LONG' ? entryPrice * 1.03 : entryPrice * 0.97);
        const tp3 = (isSignalValidForPair && signal?.targets?.tp3) ? signal.targets.tp3 : (decision === 'LONG' ? entryPrice * 1.05 : entryPrice * 0.95);
        const stopLoss = (isSignalValidForPair && signal?.stopLoss) ? signal.stopLoss : (decision === 'LONG' ? entryPrice * 0.985 : entryPrice * 1.015);

        // Position sizing logic: Calculate Margin allocated
        let tradeMargin = 0;
        if (currentConfig.sizingMode === 'RISK_BASED') {
          const slDistancePct = Math.abs(entryPrice - stopLoss) / entryPrice;
          const targetRiskUsdt = totalEquity * ((currentConfig.riskPerTradePercent || 2.0) / 100);
          const notionalSize = targetRiskUsdt / Math.max(0.008, slDistancePct);
          tradeMargin = notionalSize / leverage;
          tradeMargin = Math.min(tradeMargin, totalEquity * 0.45); // Max 45% of portfolio per position
        } else {
          tradeMargin = totalEquity * (currentConfig.tradeAllocationPercent / 100);
        }

        // Cap at available balance if necessary
        if (tradeMargin > availableBalance) {
          tradeMargin = availableBalance;
        }

        if (tradeMargin < 5) return;

        const positionSizeUsdt = tradeMargin * leverage;
        const amountCrypto = positionSizeUsdt / entryPrice;

        // Liquidation Price calculation for Futures (Isolated Margin, ~0.5% MMR)
        let liquidationPrice: number | undefined;
        if (isFutures && leverage > 1) {
          const mmr = 0.005; // 0.5% maintenance margin
          if (decision === 'LONG') {
            liquidationPrice = entryPrice * Math.max(0.001, (1 - (1 / leverage) + mmr));
          } else {
            liquidationPrice = entryPrice * (1 + (1 / leverage) - mmr);
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
          initialAmountBtc: amountCrypto, // Total contract size in crypto units
          remainingAmountBtc: amountCrypto,
          tp1,
          tp2,
          tp3,
          stopLoss,
          initialStopLoss: stopLoss,
          tp1Hit: false,
          tp2Hit: false,
          tp3Hit: false,
          rebuysCount: 0,
          openedAt: Date.now(),
          strategyName,
          lastAction: isArabicLang
            ? (isFutures
                ? `⚡ فتح عقد آجل ${decision} برافعة ${leverage}x عند $${entryPrice.toLocaleString()}`
                : `تم الشراء الفوري عند $${entryPrice.toLocaleString()}`)
            : (isFutures
                ? `⚡ Opened ${decision} Futures ${leverage}x at $${entryPrice.toLocaleString()}`
                : `Spot Buy at $${entryPrice.toLocaleString()}`),
          realizedPnlUsdt: 0,
          pnlHistory: [0],
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
          marketType: isFutures ? 'FUTURES' : 'SPOT',
          leverage,
          marginMode,
          marginUsdt: tradeMargin,
          positionSizeUsdt,
          liquidationPrice,
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
            ? `🛑 تم منع فتح الصفقة بالحد الصارم: تم الوصول إلى ${maxTrades} صفقات مفتوحة كحد أقصى.`
            : `🛑 Hard Cap Block: Maximum open positions (${maxTrades}) reached.`;
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
            leverage,
          });
          return;
        }

        if (isLiveMode && currentBinance.isConnected) {
          executeBinanceLiveOrder(currentSym, decision === 'LONG' ? 'BUY' : 'SELL', positionSizeUsdt, amountCrypto, entryPrice).catch(() => {});
        } else {
          setPaperWallet((prev) => ({
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
          reason: customReason || (isArabicLang 
            ? `${isFutures ? 'عقد آجل ' + leverage + 'x' : 'فوري'} | إشارة ${decision} (${signal?.confidence || 80}%) [${currentConfig.sizingMode === 'RISK_BASED' ? 'تحجيم بالمخاطر' : 'حصة ثابتة'}]`
            : `${isFutures ? 'Futures ' + leverage + 'x' : 'Spot'} | Signal ${decision} (${signal?.confidence || 80}%) [${currentConfig.sizingMode === 'RISK_BASED' ? 'Risk-Sized' : 'Fixed %'}]`),
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
          marketType: isFutures ? 'FUTURES' : 'SPOT',
          leverage,
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
      const isLong = pos.decision === 'LONG';
      const lev = pos.leverage || 1;
      const priceDiffPct = ((currentP - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1) * 100;
      const roePercent = priceDiffPct * lev;

      // 2a. LIQUIDATION HANDLER
      if (actionType === 'LIQUIDATION') {
        lastBotActionTimeRef.current = Date.now() + 2000;
        const marginLost = pos.remainingAmountUsdt;
        const totalTradePnlUsdt = pos.realizedPnlUsdt - marginLost;

        if (!isLiveMode) {
          setPaperWallet((prev) => ({
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
          exitPrice: currentP,
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
        setTradeHistory((prev) => [closedHistoryItem, ...prev].slice(0, 500));

        const newLog: AutoTradeLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'AUTO_LIQUIDATION',
          symbol: pos.symbol,
          side: isLong ? 'SELL' : 'BUY',
          price: currentP,
          amountUsdt: pos.positionSizeUsdt || (pos.initialAmountUsdt * lev),
          pnlUsdt: -marginLost,
          pnlPercent: -100,
          reason: isArabicLang 
            ? `🚨 تصفية تلقائية للعقد الآجل (${lev}x ${pos.decision}) لوصول السعر لمستوى التصفية ($${pos.liquidationPrice?.toLocaleString()})`
            : `🚨 Futures Liquidation (${lev}x ${pos.decision}) triggered at Liq Price ($${pos.liquidationPrice?.toLocaleString()})`,
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
          const orderRes = await executeBinanceLiveOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc * 0.5, currentP);
          if (!orderRes || orderRes.error) {
            setBotLogs(prev => [{ id: `log-${Date.now()}`, timestamp: Date.now(), type: 'ERROR' as any, symbol: pos.symbol, side: isLong ? 'SELL' : 'BUY', price: currentP, amountUsdt: marginClosed * lev, reason: 'TP FAILED: ' + (orderRes?.error || 'Unknown'), mode: 'BINANCE_LIVE' as any, marketType: pos.marketType, leverage: lev }, ...prev.slice(0, 49)]);
            return;
          }
        } else {
          setPaperWallet((prev) => ({
            ...prev,
            balance: prev.balance + cashReturned,
            realizedPnl: prev.realizedPnl + pnlUsdt,
          }));
        }

        const updatedPos: ActiveBotPosition = {
          ...pos,
          tp1Hit: true,
          remainingAmountUsdt: pos.remainingAmountUsdt * 0.5,
          remainingAmountBtc: pos.remainingAmountBtc * 0.5,
          realizedPnlUsdt: pos.realizedPnlUsdt + pnlUsdt,
          stopLoss: pos.entryPrice, // Breakeven
          lastAction: isArabicLang ? `تم تحقيق TP1 وجني 50% وتحريك SL للتعادل ✓` : `TP1 hit: 50% closed, SL moved to breakeven ✓`,
        };

        updateBotPositionsSync((prev) => prev.map(p => p.id === pos.id ? updatedPos : p));

        const closedHistoryItem: TradeHistoryItem = {
          id: `history-${Date.now()}`,
          timestamp: Date.now(),
          symbol: pos.symbol,
          decision: pos.decision,
          timeframe: timeframe,
          entryPrice: pos.entryPrice,
          exitPrice: currentP,
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
        setTradeHistory((prev) => [closedHistoryItem, ...prev].slice(0, 500));

        const newLog: AutoTradeLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'AUTO_SELL_TP1',
          symbol: pos.symbol,
          side: isLong ? 'SELL' : 'BUY',
          price: currentP,
          amountUsdt: marginClosed * lev,
          pnlUsdt,
          pnlPercent: roePercent,
          reason: isArabicLang ? `جني أرباح الهدف الأول (TP1) بنسبة 50% [${lev}x] ✓` : `TP1 hit, 50% profit taken [${lev}x] ✓`,
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
          const addedContracts = (rebuyMargin * lev) / currentP;
          const updatedPos: ActiveBotPosition = {
            ...pos,
            rebuysCount: pos.rebuysCount + 1,
            remainingAmountUsdt: pos.remainingAmountUsdt + rebuyMargin,
            remainingAmountBtc: pos.remainingAmountBtc + addedContracts,
            lastAction: isArabicLang ? `تعزيز العقد الآجل على الارتداد ✓` : `Smart Futures Rebuy on pullback ✓`,
          };
          if (isLiveMode && currentBinance.isConnected) {
            const orderRes = await executeBinanceLiveOrder(pos.symbol, pos.decision === 'LONG' ? 'BUY' : 'SELL', rebuyMargin * lev, addedContracts, currentP);
            if (!orderRes || orderRes.error) {
              setBotLogs(prev => [{ id: `log-${Date.now()}`, timestamp: Date.now(), type: 'ERROR' as any, symbol: pos.symbol, side: pos.decision === 'LONG' ? 'BUY' : 'SELL', price: currentP, amountUsdt: rebuyMargin * lev, reason: 'REBUY FAILED: ' + (orderRes?.error || 'Unknown'), mode: 'BINANCE_LIVE' as any, marketType: pos.marketType, leverage: lev }, ...prev.slice(0, 49)]);
              return;
            }
          } else {
            setPaperWallet((prev) => ({
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
            price: currentP,
            amountUsdt: rebuyMargin * lev,
            reason: isArabicLang ? `تعزيز العقد الآجل على الارتداد (${lev}x) ✓` : `Futures Rebuy on pullback (${lev}x) ✓`,
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
          const orderRes = await executeBinanceLiveOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc * 0.5, currentP);
          if (!orderRes || orderRes.error) {
            setBotLogs(prev => [{ id: `log-${Date.now()}`, timestamp: Date.now(), type: 'ERROR' as any, symbol: pos.symbol, side: isLong ? 'SELL' : 'BUY', price: currentP, amountUsdt: marginClosed * lev, reason: 'TP FAILED: ' + (orderRes?.error || 'Unknown'), mode: 'BINANCE_LIVE' as any, marketType: pos.marketType, leverage: lev }, ...prev.slice(0, 49)]);
            return;
          }
        } else {
          setPaperWallet((prev) => ({
            ...prev,
            balance: prev.balance + cashReturned,
            realizedPnl: prev.realizedPnl + pnlUsdt,
          }));
        }

        const updatedPos: ActiveBotPosition = {
          ...pos,
          tp2Hit: true,
          remainingAmountUsdt: pos.remainingAmountUsdt * 0.5,
          remainingAmountBtc: pos.remainingAmountBtc * 0.5,
          realizedPnlUsdt: pos.realizedPnlUsdt + pnlUsdt,
          lastAction: isArabicLang ? `تم تحقيق TP2 وجني نصف المتبقي ✓` : `TP2 hit: 50% of remaining closed ✓`,
        };

        updateBotPositionsSync((prev) => prev.map(p => p.id === pos.id ? updatedPos : p));

        const newLog: AutoTradeLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'AUTO_SELL_TP2',
          symbol: pos.symbol,
          side: isLong ? 'SELL' : 'BUY',
          price: currentP,
          amountUsdt: marginClosed * lev,
          pnlUsdt,
          reason: isArabicLang ? `جني أرباح الهدف الثاني (TP2) بنسبة 50% من المتبقي [${lev}x] ✓` : `TP2 hit, 50% of remaining taken [${lev}x] ✓`,
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
          marketType: pos.marketType,
          leverage: lev,
        };
        addBotLog(newLog);

        playAudioChime();
        return;
      }

      // 2e. TP3 or SL HANDLER (Close full position)
      if (actionType === 'TP3' || actionType === 'SL') {
        lastBotActionTimeRef.current = Date.now() + 2000;
        const marginClosed = pos.remainingAmountUsdt;
        const finalPnlUsdt = marginClosed * (roePercent / 100);
        const totalTradePnlUsdt = pos.realizedPnlUsdt + finalPnlUsdt;
        const cashReturned = Math.max(0, marginClosed + finalPnlUsdt);

        if (isLiveMode && currentBinance.isConnected) {
          const orderRes = await executeBinanceLiveOrder(pos.symbol, isLong ? 'SELL' : 'BUY', marginClosed * lev, pos.remainingAmountBtc, currentP);
          if (!orderRes || orderRes.error) {
            setBotLogs(prev => [{ id: `log-${Date.now()}`, timestamp: Date.now(), type: 'ERROR' as any, symbol: pos.symbol, side: isLong ? 'SELL' : 'BUY', price: currentP, amountUsdt: marginClosed * lev, reason: 'TP3 FAILED: ' + (orderRes?.error || 'Unknown'), mode: 'BINANCE_LIVE' as any, marketType: pos.marketType, leverage: lev }, ...prev.slice(0, 49)]);
            return;
          }
        } else {
          setPaperWallet((prev) => ({
            ...prev,
            balance: prev.balance + cashReturned,
            realizedPnl: prev.realizedPnl + finalPnlUsdt,
          }));
        }

        lastClosedTimesBySymbolRef.current[pos.symbol.toLowerCase()] = Date.now();
        updateBotPositionsSync((prev) => prev.filter(p => p.id !== pos.id));

        const closedHistoryItem: TradeHistoryItem = {
          id: `history-${Date.now()}`,
          timestamp: Date.now(),
          symbol: pos.symbol,
          decision: pos.decision,
          timeframe: timeframe,
          entryPrice: pos.entryPrice,
          exitPrice: currentP,
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
        setTradeHistory((prev) => [closedHistoryItem, ...prev].slice(0, 500));

        const newLog: AutoTradeLog = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: actionType === 'SL' ? (pos.isTrailingActive ? 'AUTO_TRAILING_SL' : 'AUTO_SL') : 'AUTO_SELL_TP3',
          symbol: pos.symbol,
          side: isLong ? 'SELL' : 'BUY',
          price: currentP,
          amountUsdt: marginClosed * lev,
          pnlUsdt: finalPnlUsdt,
          pnlPercent: roePercent,
          reason: isArabicLang 
            ? (actionType === 'SL' 
                ? (pos.isTrailingActive ? `إغلاق وتأمين الأرباح بالوقف المتحرك (${lev}x Trailing SL) 🎯` : `إغلاق كامل بوقف الخسارة (${lev}x SL) 🛑`) 
                : `إغلاق كامل بالهدف الثالث (${lev}x TP3) 🚀`) 
            : (actionType === 'SL' 
                ? (pos.isTrailingActive ? `Trailing Stop Triggered (${lev}x) — Profits Locked 🎯` : `Closed at SL (${lev}x) 🛑`) 
                : `Closed at TP3 (${lev}x) 🚀`),
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
    const isLiveMode = executionModeRef.current === 'BINANCE_LIVE';
    const currentPositions = activeBotPositionsRef.current;
    const targetPositions = currentPositions.filter(p => isLiveMode ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
    const currentBinance = binanceConfigRef.current;
    const currentP = ticker?.price || 0;

    if (targetPositions.length === 0) return;

    for (const pos of targetPositions) {
      const p = pos.symbol.toLowerCase() === selectedSymbolRef.current.toLowerCase() && currentP > 0 ? currentP : pos.currentPrice || pos.entryPrice;
      const isLong = pos.decision === 'LONG';
      const lev = pos.leverage || 1;
      const priceDiffPct = ((p - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1) * 100;
      const roePercent = priceDiffPct * lev;
      const finalPnlUsdt = pos.remainingAmountUsdt * (roePercent / 100);
      const totalTradePnlUsdt = pos.realizedPnlUsdt + finalPnlUsdt;
      const cashReturned = Math.max(0, pos.remainingAmountUsdt + finalPnlUsdt);

      if (isLiveMode && currentBinance.isConnected) {
        const orderRes = await executeBinanceLiveOrder(pos.symbol, isLong ? 'SELL' : 'BUY', pos.remainingAmountUsdt * lev, pos.remainingAmountBtc, p);
        if (!orderRes || orderRes.error) {
          setBotLogs(prev => [{ id: `log-${Date.now()}`, timestamp: Date.now(), type: 'ERROR' as any, symbol: pos.symbol, side: isLong ? 'SELL' : 'BUY', price: currentP, amountUsdt: pos.remainingAmountUsdt * lev, reason: 'SL/CLOSE FAILED: ' + (orderRes?.error || 'Unknown'), mode: 'BINANCE_LIVE' as any, marketType: pos.marketType || 'SPOT', leverage: lev }, ...prev.slice(0, 49)]);
          return;
        }
      } else {
        setPaperWallet((prev) => ({
          ...prev,
          balance: prev.balance + cashReturned,
          realizedPnl: prev.realizedPnl + finalPnlUsdt,
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
      setTradeHistory((prev) => [closedHistoryItem, ...prev].slice(0, 500));
    }

    updateBotPositionsSync((prev) => prev.filter(p => isLiveMode ? p.mode !== 'BINANCE_LIVE' : (p.mode === 'BINANCE_LIVE')));

    const newLog: AutoTradeLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      type: 'PANIC_CLOSE_ALL',
      symbol: 'ALL_POSITIONS',
      side: 'SELL',
      price: currentP,
      amountUsdt: 0,
      reason: isArabicLang ? '🚨 تصفية طارئة فورية وإغلاق كافة الصفقات النشطة (Panic Close All)' : '🚨 Emergency Panic Close All executed for all open positions',
      mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
    };
    addBotLog(newLog);
    playAudioChime();
  }, [language, ticker?.price, playAudioChime]);

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
        ? '🛡️ تم استئناف البوت وإعادة تصفير عداد الخسارة اليومية بنجاح.' 
        : '🛡️ Shield reset successfully. Bot resumed and daily loss counter reset.',
      mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
    };
    addBotLog(resetLog);
    playAudioChime();
  }, [language, ticker?.price, playAudioChime]);

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

    // 3. Clear database and local storage via dedicated reset endpoint
    try {
      await apiStorage.resetTradingData();
    } catch (e) {}

    playAudioChime();
  }, [playAudioChime]);

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
          ? `✂️ تقليص تلقائي للصفقة الزائدة للالتزام بحد الصفقات الأقصى (${maxTrades})`
          : `✂️ Auto-trimmed excess trade to enforce max open slots limit (${maxTrades})`,
        pos.id
      );
    }
  }, [language, executeAutoTradeAction]);

  // Need a ref to access latest ticker without re-triggering the interval
  const latestTickerRef = useRef(ticker);
  useEffect(() => {
    latestTickerRef.current = ticker;
  }, [ticker]);

  // Background PnL History Sampler for all active positions
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTicker = latestTickerRef.current;
      if (!currentTicker?.price || isNaN(currentTicker.price) || currentTicker.price <= 0) return;
      const normTickerSym = normalizeSymbol(currentTicker.symbol);
      setActiveBotPositions((prevPositions) =>
        prevPositions.map((pos) => {
          if (normTickerSym !== normalizeSymbol(pos.symbol)) return pos;
          const isLong = pos.decision === 'LONG';
          const lev = pos.leverage || 1;
          const priceDiffPct = ((currentTicker.price - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1) * 100;
          const currentRoePercent = priceDiffPct * lev;
          return {
            ...pos,
            currentPrice: currentTicker.price,
            pnlHistory: [...(pos.pnlHistory || []), currentRoePercent].slice(-50),
          };
        })
      );
    }, 5000);
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
            ? `🛑 تفعيل قاطع الحماية (Circuit Breaker): تجاوزت خسائر اليوم -${Math.abs(todayRealizedLoss).toFixed(2)}$ (${botConfig.dailyDrawdownLimitPercent}%). تم إيقاف البوت لحماية رأس المال.` 
            : `🛑 Circuit Breaker Tripped: Max daily loss limit (-$${Math.abs(todayRealizedLoss).toFixed(2)} / ${botConfig.dailyDrawdownLimitPercent}%) reached. Bot paused to protect capital.`,
          mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER',
        };
        addBotLog(cbLog);
        playAudioChime();
        return;
      }
    }

    // 1. Check New Position Entry
    if (currentSignal && (currentSignal.decision === 'LONG' || currentSignal.decision === 'SHORT') && !botConfig.circuitBreakerTripped) {
      
      // Prevent immediate trading of stale signals generated before the bot was turned on
      const signalTimestamp = currentSignal.timestamp || 0;
      const botEnabledAt = botConfig.enabledAt || 0;
      const isFreshSignal = signalTimestamp >= botEnabledAt;

      // Check if current symbol is in the allowed whitelist
      const allowed = botConfig.allowedSymbols || [];
      const isAllowed = allowed.length === 0 ? false : allowed.some(a => currentSym.toUpperCase().startsWith(a.toUpperCase()));
      
      if (isAllowed && isFreshSignal) {
        const modePositions = currentPositions.filter(p => isLiveMode ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
        const maxTrades = botConfig.maxOpenTrades || 3;
        const canOpen = modePositions.length < maxTrades && !modePositions.some(p => normalizeSymbol(p.symbol) === normalizeSymbol(currentSym));
        
        const lastClosed = lastClosedTimesBySymbolRef.current[normalizeSymbol(currentSym)] || 0;
        const cooldownMs = (botConfig.cooldownMinutes || 10) * 60 * 1000;
        const isCooledDown = (Date.now() - lastClosed) >= cooldownMs;

        if (canOpen && isCooledDown && currentSignal.confidence >= botConfig.minConfidence && normTickerSym === normalizeSymbol(currentSym)) {
          const signalKey = `${currentSignal.decision}_${currentSym}_${Math.round(currentSignal.entryZone?.ideal || 0)}_${Math.round(currentSignal.stopLoss || 0)}`;
          if (lastTradedSignalKeyRef.current !== signalKey) {
            executeAutoTradeAction('OPEN', currentP);
            return;
          }
        }
      }
    }

    // 2. Trailing Stop Loss Updates
    let hasTrailingUpdates = false;
    const trailingUpdates: Record<string, Partial<typeof currentPositions[0]>> = {};

    for (const pos of currentPositions) {
      const normPosSym = normalizeSymbol(pos.symbol);
      // ONLY update trailing stops if this live ticker matches this position's symbol
      if (normTickerSym !== normPosSym) continue;
      
      const isLong = pos.decision === 'LONG';

      // Dynamic Trailing Stop Loss Ratchet
      if (botConfig.trailingStopEnabled) {
        const trailGapPercent = (botConfig.trailingStopPercent || 1.2) / 100;
        const activationProfit = botConfig.trailingActivationProfitPercent || 1.5;

        if (isLong) {
          const currentGainPct = ((currentP - pos.entryPrice) / pos.entryPrice) * 100;
          const currentPeak = Math.max(pos.peakPrice || pos.entryPrice, currentP);
          
          let updatedPos: Partial<typeof pos> = {};
          if (currentPeak > (pos.peakPrice || 0)) {
            updatedPos.peakPrice = currentPeak;
            hasTrailingUpdates = true;
          }

          if (currentGainPct >= activationProfit || pos.tp1Hit) {
            const calculatedTrailingSl = currentPeak * (1 - trailGapPercent);
            if (calculatedTrailingSl > pos.stopLoss) {
              updatedPos.stopLoss = calculatedTrailingSl;
              updatedPos.trailingStopPrice = calculatedTrailingSl;
              updatedPos.isTrailingActive = true;
              updatedPos.lastAction = isArabicLang 
                ? `تتبع الربح Trailing SL: ${calculatedTrailingSl.toFixed(2)} ⚡` 
                : `Trailing SL: ${calculatedTrailingSl.toFixed(2)} ⚡`;
              hasTrailingUpdates = true;
            }
          }
          if (Object.keys(updatedPos).length > 0) trailingUpdates[pos.id] = updatedPos;
        } else {
          const currentGainPct = ((pos.entryPrice - currentP) / pos.entryPrice) * 100;
          const currentTrough = Math.min(pos.peakPrice || pos.entryPrice, currentP);

          let updatedPos: Partial<typeof pos> = {};
          if (currentTrough < (pos.peakPrice || Infinity)) {
            updatedPos.peakPrice = currentTrough;
            hasTrailingUpdates = true;
          }

          if (currentGainPct >= activationProfit || pos.tp1Hit) {
            const calculatedTrailingSl = currentTrough * (1 + trailGapPercent);
            if (calculatedTrailingSl < pos.stopLoss) {
              updatedPos.stopLoss = calculatedTrailingSl;
              updatedPos.trailingStopPrice = calculatedTrailingSl;
              updatedPos.isTrailingActive = true;
              updatedPos.lastAction = isArabicLang 
                ? `تتبع الربح Trailing SL: ${calculatedTrailingSl.toFixed(2)} ⚡` 
                : `Trailing SL: ${calculatedTrailingSl.toFixed(2)} ⚡`;
              hasTrailingUpdates = true;
            }
          }
          if (Object.keys(updatedPos).length > 0) trailingUpdates[pos.id] = updatedPos;
        }
      }
    }

    if (hasTrailingUpdates) {
      updateBotPositionsSync(prev => prev.map(p => trailingUpdates[p.id] ? { ...p, ...trailingUpdates[p.id] } : p));
    }

    // 3. Execution Check for Open Positions
    // We use the potentially updated stop loss values.
    const positionsForExecution = currentPositions.map(p => trailingUpdates[p.id] ? { ...p, ...trailingUpdates[p.id] } : p);

    for (const pos of positionsForExecution) {
      const normPosSym = normalizeSymbol(pos.symbol);
      // STRICT SAFETY: Only execute TP/SL against a LIVE, verified ticker of the EXACT same symbol!
      if (normTickerSym !== normPosSym) continue;

      // Anomaly Spike Guard: Ignore disconnection/reconnection glitches or sudden spikes (>75% jump in 1 tick)
      const priceDeltaPct = Math.abs(currentP - pos.entryPrice) / pos.entryPrice;
      if (priceDeltaPct > 0.75) {
        continue;
      }

      const isLong = pos.decision === 'LONG';

      // 0. Check Futures Liquidation Threshold
      if (pos.liquidationPrice && pos.liquidationPrice > 0) {
        if ((isLong && currentP <= pos.liquidationPrice) || (!isLong && currentP >= pos.liquidationPrice)) {
          executeAutoTradeAction('LIQUIDATION', currentP, undefined, pos.id);
          return;
        }
      }

      if (isLong) {
        if (!pos.tp1Hit && currentP >= pos.tp1) {
          executeAutoTradeAction('TP1', currentP, undefined, pos.id);
          return;
        }
        if (pos.tp1Hit && pos.rebuysCount < 1 && currentP <= pos.entryPrice * 1.004 && currentP >= pos.entryPrice * 0.998) {
          executeAutoTradeAction('REBUY', currentP, undefined, pos.id);
          return;
        }
        if (!pos.tp2Hit && currentP >= pos.tp2) {
          executeAutoTradeAction('TP2', currentP, undefined, pos.id);
          return;
        }
        if (currentP >= pos.tp3) {
          executeAutoTradeAction('TP3', currentP, undefined, pos.id);
          return;
        }
        if (currentP <= pos.stopLoss) {
          executeAutoTradeAction('SL', currentP, pos.isTrailingActive ? (isArabicLang ? 'إغلاق بربح محمي عبر الوقف المتحرك (Trailing SL) 🎯' : 'Trailing Stop Hit - Accrued Profits Locked 🎯') : undefined, pos.id);
          return;
        }
      } else {
        if (!pos.tp1Hit && currentP <= pos.tp1) {
          executeAutoTradeAction('TP1', currentP, undefined, pos.id);
          return;
        }
        if (pos.tp1Hit && pos.rebuysCount < 1 && currentP >= pos.entryPrice * 0.996 && currentP <= pos.entryPrice * 1.002) {
          executeAutoTradeAction('REBUY', currentP, undefined, pos.id);
          return;
        }
        if (!pos.tp2Hit && currentP <= pos.tp2) {
          executeAutoTradeAction('TP2', currentP, undefined, pos.id);
          return;
        }
        if (currentP <= pos.tp3) {
          executeAutoTradeAction('TP3', currentP, undefined, pos.id);
          return;
        }
        if (currentP >= pos.stopLoss) {
          executeAutoTradeAction('SL', currentP, pos.isTrailingActive ? (isArabicLang ? 'إغلاق بربح محمي عبر الوقف المتحرك (Trailing SL) 🎯' : 'Trailing Stop Hit - Accrued Profits Locked 🎯') : undefined, pos.id);
          return;
        }
      }
    }
  }, [ticker?.price, botConfig.enabled, botConfig.minConfidence, botConfig.maxOpenTrades, botConfig.trailingStopEnabled, botConfig.trailingStopPercent, botConfig.trailingActivationProfitPercent, botConfig.dailyDrawdownLimitPercent, botConfig.circuitBreakerTripped, botConfig.circuitBreakerResetAt, botConfig.cooldownMinutes, executeAutoTradeAction, language, playAudioChime]);

  const lastAnalysisCallRef = useRef<number>(0);

  // Run Quantitative Analysis
  const runAnalysis = useCallback(
    async (currentMarketData: MarketDataResponse | null, force: boolean = false) => {
      if (!currentMarketData || !currentMarketData.ticker || !currentMarketData.indicators) {
        return;
      }

      // Automatically determine optimal bot timeframe based on quantitative market regime
      const optimalTf = determineOptimalBotTimeframe(currentMarketData.indicators, currentMarketData.ticker.price);
      setAutoBotTimeframeInfo({
        effectiveTimeframe: optimalTf.timeframe,
        reasonAr: optimalTf.reasonAr,
        reasonEn: optimalTf.reasonEn,
      });

      const now = Date.now();
      // Fast client-side pure mathematical plan for immediate UI responsiveness
      const fastPlan = generateQuantitativePlan(
        currentMarketData.timeframe,
        currentMarketData.ticker.price,
        currentMarketData.indicators,
        currentMarketData.orderBook,
        currentMarketData.derivatives,
        currentMarketData.mtfConfluence,
        isDeveloperMode,
        currentMarketData.ticker.symbol || selectedSymbol
      );

      // If called from background interval and analyzed recently, just update the mathematical plan
      if (!force && now - lastAnalysisCallRef.current < 60000 && activeSignalRef.current) {
        setActiveSignal((prev) => (prev ? { ...fastPlan, detailedAnalysis: prev.detailedAnalysis } : fastPlan));
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
    [isDeveloperMode, minConfidenceThreshold, playAudioChime, pushNewAlert]
  );

  // Fetch Full Market Data from Server
  const fetchMarketData = useCallback(
    async (tf: Timeframe = timeframe, sym: string = selectedSymbol, mt: MarketType = botConfig.marketType || 'FUTURES') => {
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/binance/market-data?symbol=${sym}&timeframe=${tf}&devMode=${isDeveloperMode}&marketType=${mt}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: MarketDataResponse = await res.json();
        setMarketData(data);

        if (data.ticker) {
          setTicker(data.ticker);
          setConnectionState('CONNECTED');
        }
        if (data.klines && data.klines.length > 0) {
          setKlines(data.klines);
        }

        // Run quantitative analysis on fresh data
        runAnalysis(data);
      } catch (err) {
        console.warn('Error fetching market data from server:', err);
      } finally {
        setIsRefreshing(false);
      }
    },
    [timeframe, selectedSymbol, botConfig.marketType, isDeveloperMode, runAnalysis]
  );

  // Background Global Scanner for all pairs (Alerts only)
  useEffect(() => {
    let currentIndex = 0;
    let isActive = true;

    const scanNextPair = async () => {
      if (!isActive) return;
      const pair = RESPECTED_TRADING_PAIRS[currentIndex];
      currentIndex = (currentIndex + 1) % RESPECTED_TRADING_PAIRS.length;
      
      // The currently selected pair is already polled actively by fetchMarketData, so skip it here
      if (pair.symbol === selectedSymbolRef.current) return;
      
      try {
        const currentMt = botConfigRef.current?.marketType || 'FUTURES';
        const res = await fetch(`/api/binance/market-data?symbol=${pair.symbol}&timeframe=${timeframeRef.current}&devMode=${isDeveloperModeRef.current}&marketType=${currentMt}`);
        if (!res.ok) return;
        const data: MarketDataResponse = await res.json();
        
        if (!data || !data.ticker || !data.indicators) return;

        const fastPlan = generateQuantitativePlan(
          data.timeframe,
          data.ticker.price,
          data.indicators,
          data.orderBook,
          data.derivatives,
          data.mtfConfluence,
          isDeveloperModeRef.current,
          pair.symbol
        );


        // Update background active positions with latest price
        updateBotPositionsSync(prev => {
          let modified = false;
          const normPairSym = normalizeSymbol(pair.symbol);
          const next = prev.map(p => {
            if (normalizeSymbol(p.symbol) === normPairSym && Math.abs((p.currentPrice || 0) - data.ticker.price) > Number.EPSILON) {
              modified = true;
              const isL = p.decision === 'LONG';
              const diffPct = ((data.ticker.price - p.entryPrice) / p.entryPrice) * (isL ? 1 : -1) * 100;
              const roe = diffPct * (p.leverage || 1);
              return { ...p, currentPrice: data.ticker.price, pnlHistory: [...(p.pnlHistory || []), roe].slice(-50) };
            }
            return p;
          });
          return modified ? next : prev;
        });

        if (fastPlan.confidence >= minConfidenceThresholdRef.current && (fastPlan.decision === 'LONG' || fastPlan.decision === 'SHORT')) {
          // It's a strong signal, let's notify using the override symbol!
          pushNewAlert(fastPlan, false, pair.symbol);
          playAudioChime();
          
          // Background Auto-Trading for Allowed Symbols
          const currentConfig = botConfigRef.current;
          if (currentConfig?.enabled && currentConfig.multiPairScanning !== false) {
            const isLive = executionModeRef.current === 'BINANCE_LIVE';
            const currentModePositions = activeBotPositionsRef.current.filter(p => isLive ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
            const maxTrades = Math.max(1, currentConfig.maxOpenTrades || 3);
            if (currentModePositions.length < maxTrades) {
              const allowedSymbols = currentConfig.allowedSymbols || [];
              const isAllowedBg = allowedSymbols.length === 0 ? false : allowedSymbols.some(a => pair.symbol.toUpperCase().startsWith(a.toUpperCase()));
              if (isAllowedBg) {
                // Try to open trade for this symbol in the background
                executeAutoTradeAction('OPEN', data.ticker.price, undefined, undefined, undefined, fastPlan, pair.symbol);
              }
            }
          }
        }
      } catch (err) {
        // silent background fail
      }
    };

    // Scan one pair every 15 seconds sequentially
    const interval = setInterval(scanNextPair, 15000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [pushNewAlert, playAudioChime]);

  // 1. Initialize WebSocket streaming and fetch initial data
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
      setTicker(newTicker);
    });

    const unsubKline = binanceWsManager.onKline((kline, isClosed) => {
      setKlines((prev) => {
        if (prev.length === 0) return [kline];
        const last = prev[prev.length - 1];
        if (last.time === kline.time) {
          const updated = [...prev];
          updated[updated.length - 1] = kline;
          return updated;
        } else if (kline.time > last.time) {
          return [...prev.slice(1), kline];
        }
        return prev;
      });
    });

    fetchMarketData(timeframe, selectedSymbol, activeMarketType);

    // Refresh background polling every 5 seconds
    const interval = setInterval(() => {
      fetchMarketData(timeframe, selectedSymbol, botConfigRef.current?.marketType || 'FUTURES');
    }, 5000);

    return () => {
      clearInterval(interval);
      unsubState();
      unsubTicker();
      unsubKline();
      binanceWsManager.disconnect();
    };
  }, [timeframe, selectedSymbol, botConfig.marketType]);

  const handlePairChange = (pair: TradingPair) => {
    setSelectedSymbol(pair.symbol);
    try {
      apiStorage.setItem('selected_trading_pair', pair.symbol);
    } catch (e) {
      // ignore storage error
    }
    
    // FAST UI UPDATE: Fetch ticker instantly from Binance REST directly for immediate visual feedback
    const activeMT = botConfig.marketType || 'FUTURES';
    const baseUrl = activeMT === 'FUTURES' ? 'https://fapi.binance.com/fapi/v1/ticker/24hr' : 'https://api.binance.com/api/v3/ticker/24hr';
    fetch(`${baseUrl}?symbol=${pair.symbol}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.lastPrice) {
          setTicker({
            symbol: data.symbol,
            price: parseFloat(data.lastPrice),
            priceChange24h: parseFloat(data.priceChange || '0'),
            priceChangePercent24h: parseFloat(data.priceChangePercent || '0'),
            volume24h: parseFloat(data.volume || '0'),
            quoteVolume24h: parseFloat(data.quoteVolume || '0'),
            high24h: parseFloat(data.highPrice || data.lastPrice),
            low24h: parseFloat(data.lowPrice || data.lastPrice),
            updatedAt: Date.now(),
          });
        }
      })
      .catch(() => {});

    binanceWsManager.setSymbol(pair.symbol);
    fetchMarketData(timeframe, pair.symbol, activeMT);
  };

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    try {
      apiStorage.setItem('app_trading_timeframe', tf);
    } catch {}
    binanceWsManager.setTimeframe(tf);
    fetchMarketData(tf, selectedSymbol, botConfig.marketType || 'FUTURES');
  };

  const handleToggleMarketType = (newMarketType: MarketType) => {
    setBotConfig((prev) => ({
      ...prev,
      marketType: newMarketType,
      leverage: newMarketType === 'FUTURES' ? ((prev.leverage && prev.leverage > 1) ? prev.leverage : 3) : 1,
    }));
    
    // FAST UI UPDATE
    const baseUrl = newMarketType === 'FUTURES' ? 'https://fapi.binance.com/fapi/v1/ticker/24hr' : 'https://api.binance.com/api/v3/ticker/24hr';
    fetch(`${baseUrl}?symbol=${selectedSymbol}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.lastPrice) {
          setTicker({
            symbol: data.symbol,
            price: parseFloat(data.lastPrice),
            priceChange24h: parseFloat(data.priceChange || '0'),
            priceChangePercent24h: parseFloat(data.priceChangePercent || '0'),
            volume24h: parseFloat(data.volume || '0'),
            quoteVolume24h: parseFloat(data.quoteVolume || '0'),
            high24h: parseFloat(data.highPrice || data.lastPrice),
            low24h: parseFloat(data.lowPrice || data.lastPrice),
            updatedAt: Date.now(),
          });
        }
      })
      .catch(() => {});

    binanceWsManager.setMarketType(newMarketType);
    fetchMarketData(timeframe, selectedSymbol, newMarketType);
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
            ? `✅ تم تنفيذ أمر ${side} بنجاح على بايننس! (رقم الأمر: ${order.orderId})`
            : `✅ Ordre ${side} exécuté avec succès sur Binance ! (ID: ${order.orderId})`,
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
    <div className={`min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-brand-500 selection:text-slate-950 ${isArabic ? 'rtl' : 'ltr'}`}>
      {!isAuthenticated ? (
        <AuthScreen onLogin={handleLogin} language={language} />
      ) : (
        <div className={isAndroidView ? 'max-w-md mx-auto my-4 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl bg-slate-950' : 'w-full'}>
          {/* Navigation & Header */}
          <Header
            selectedSymbol={selectedSymbol}
            onSelectPair={handlePairChange}
            ticker={ticker}
            connectionState={connectionState}
            language={language}
            timezone={timezone}
            isAndroidView={isAndroidView}
            unreadAlertsCount={alerts.filter((a) => !a.read).length}
            soundEnabled={soundEnabled}
            isRefreshing={isRefreshing}
            isDeveloperMode={isDeveloperMode}
            binanceConfig={binanceConfig}
            executionMode={executionMode}
            paperWallet={paperWallet}
            marketType={botConfig.marketType || 'FUTURES'}
            onToggleMarketType={handleToggleMarketType}
            onOpenBinanceModal={() => setIsBinanceModalOpen(true)}
            onOpenCustomBalanceModal={() => setIsCustomBalanceModalOpen(true)}
            onLanguageChange={setLanguage}
            onToggleAndroidView={() => setIsAndroidView(!isAndroidView)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenRiskModal={() => setIsRiskModalOpen(true)}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onRefreshData={() => fetchMarketData(timeframe, selectedSymbol, botConfig.marketType || 'FUTURES')}
            onLogout={handleLogout}
            username={username || 'JAOUAD'}
          />

        {/* Navigation Tabs Bar */}
        <nav className="bg-slate-900 border-b border-slate-800 sticky top-[56px] sm:top-[60px] z-20 px-3 sm:px-4 py-2 [transform:translateZ(0)]">
          <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('signal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === 'signal'
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{t.tabs.signal}</span>
            </button>

            <button
              onClick={() => setActiveTab('autoBot')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === 'autoBot'
                  ? 'bg-gradient-to-r from-amber-500 to-teal-400 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                  : 'text-amber-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-amber-500/20'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{t.tabs.autoBot}</span>
              {botConfig.enabled && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('mtf')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === 'mtf'
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t.tabs.mtf}</span>
            </button>

            <button
              onClick={() => setActiveTab('market')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === 'market'
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{t.tabs.market}</span>
            </button>

            <button
              onClick={() => setActiveTab('chart')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === 'chart'
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>{t.tabs.chart}</span>
            </button>

            <button
              onClick={() => setActiveTab('backtest')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === 'backtest'
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{t.tabs.backtest}</span>
            </button>

            <button
              onClick={() => setActiveTab('analysis')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === 'analysis'
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t.tabs.analysis}</span>
            </button>

            <button
              onClick={() => setActiveTab('riskWallet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeTab === 'riskWallet'
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{t.tabs.riskWallet}</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
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
        <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
          {/* Tab 1: Terminal & Main Signal */}
          {activeTab === 'signal' && (
            <div className="space-y-6">
              <SignalCard
                symbol={selectedSymbol}
                signal={activeSignal}
                language={language}
                onAnalyze={() => runAnalysis(marketData, true)}
                isAnalyzing={isAnalyzing}
                botConfig={botConfig}
                onUpdateBotConfig={(partial) => {
                  if (partial.marketType && partial.marketType !== botConfig.marketType) {
                    handleToggleMarketType(partial.marketType);
                  } else {
                    setBotConfig((prev) => ({ ...prev, ...partial }));
                  }
                }}
                onNotifyRecommendation={(plan) => pushNewAlert(plan, true)}
                onOpenNotifications={() => setIsNotificationsOpen(true)}
              />

              <div style={{ visibility: isSettingsOpen || isBinanceModalOpen || isCustomBalanceModalOpen ? 'hidden' : 'visible' }}>
                <TradingChart
                  symbol={selectedSymbol}
                  klines={klines}
                  activeTimeframe={timeframe}
                  onTimeframeChange={handleTimeframeChange}
                  activeSignal={activeSignal}
                  language={language}
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
              currentPrice={ticker?.price || 0}
              activeSignal={activeSignal}
              effectiveBotTimeframe={botConfig.timeframe === 'AUTO' || !botConfig.timeframe ? autoBotTimeframeInfo.effectiveTimeframe : (botConfig.timeframe as Timeframe)}
              timeframeReason={language === 'ar' ? autoBotTimeframeInfo.reasonAr : autoBotTimeframeInfo.reasonEn}
              executionMode={executionMode}
              binanceConfig={binanceConfig}
              onOpenBinanceModal={() => setIsBinanceModalOpen(true)}
              onOpenCustomBalanceModal={() => setIsCustomBalanceModalOpen(true)}
              onToggleBot={() => {
                setBotConfig((prev) => {
                  const nextEnabled = !prev.enabled;
                  if (nextEnabled && prev.circuitBreakerTripped) {
                    return {
                      ...prev,
                      enabled: true,
                      enabledAt: Date.now(),
                      circuitBreakerTripped: false,
                      circuitBreakerTrippedAt: undefined,
                      circuitBreakerResetAt: Date.now(),
                    };
                  }
                  return { ...prev, enabled: nextEnabled, enabledAt: nextEnabled ? Date.now() : prev.enabledAt };
                });
              }}
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
                  const pos = activeBotPositions.find(p => p.id === posId);
                  if (pos) {
                    const isSelected = pos.symbol.toLowerCase() === selectedSymbol.toLowerCase();
                    const priceToUse = (isSelected && ticker?.price) ? ticker.price : (pos.currentPrice || pos.entryPrice);
                    executeAutoTradeAction('SL', priceToUse, 'Manual exit triggered', posId);
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
                      ? `🛑 تم رفض العملية: لديك حالياً ${modePositions.length} صفقات مفتوحة من أصل ${maxTrades} صفقات كحد أقصى!`
                      : `🛑 Action Rejected: You already have ${modePositions.length}/${maxTrades} maximum open trades!`;
                    const rejectAlert: PushAlert = {
                      id: `alert-manual-max-${Date.now()}`,
                      title: language === 'ar' ? '⚠️ تم رفض فتح الصفقة (الحد الأقصى)' : '⚠️ Trade Rejected (Max Limit)',
                      body: msg,
                      timestamp: Date.now(),
                      type: 'SYSTEM',
                      read: false,
                    };
                    setAlerts(prev => [rejectAlert, ...prev.slice(0, 29)]);
                    setActiveToastAlert(rejectAlert);
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
                      ? `🛑 تم رفض العملية: لديك حالياً ${modePositions.length} صفقات مفتوحة من أصل ${maxTrades} صفقات كحد أقصى!`
                      : `🛑 Action Rejected: You already have ${modePositions.length}/${maxTrades} maximum open trades!`;
                    const rejectAlert: PushAlert = {
                      id: `alert-manual-max-${Date.now()}`,
                      title: language === 'ar' ? '⚠️ تم رفض فتح الصفقة (الحد الأقصى)' : '⚠️ Trade Rejected (Max Limit)',
                      body: msg,
                      timestamp: Date.now(),
                      type: 'SYSTEM',
                      read: false,
                    };
                    setAlerts(prev => [rejectAlert, ...prev.slice(0, 29)]);
                    setActiveToastAlert(rejectAlert);
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
            <div style={{ visibility: isSettingsOpen || isBinanceModalOpen || isCustomBalanceModalOpen ? 'hidden' : 'visible' }}>
              <TradingChart
                symbol={selectedSymbol}
                klines={klines}
                activeTimeframe={timeframe}
                onTimeframeChange={handleTimeframeChange}
                activeSignal={activeSignal}
                language={language}
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
              onSelectSymbol={setSelectedSymbol}
              onNavigateToBot={() => setActiveTab('autoBot')}
            />
          )}

          {/* Tab 6: Full Detailed Analysis & Indicators */}
          {activeTab === 'analysis' && (
            <QwenAnalysisView
              analysis={activeSignal}
              marketData={marketData}
              language={language}
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
              onCloseActivePosition={(id) => executeAutoTradeAction('SL', ticker?.price || 0, isArabic ? 'إغلاق يدوي من سجل الصفقات' : 'Manual close from Trade Journal', id)}
              onSeedSampleData={handleSeedSampleHistory}
              onFullReset={handleFullReset}
            />
          )}
        </main>

        {/* Global Footer (Magic Touch Copyright) */}
        <footer className="mt-20 mb-10 px-4 flex justify-center w-full relative z-10">
          <div className="max-w-4xl w-full flex flex-col items-center gap-6">
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent mb-4"></div>
            
            <div className="flex flex-col md:flex-row items-center justify-between w-full gap-8">
              
              {/* Left Side: Brand & Identity */}
              <div className="flex items-center gap-4">
                <div className="relative group cursor-pointer shrink-0" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500/40 to-cyan-500/40 rounded-2xl blur-lg opacity-40 group-hover:opacity-90 transition duration-500"></div>
                  <img
                    src="/logo.png"
                    alt="Quantura Logo"
                    className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-amber-500/50 shadow-2xl transition-all duration-500 group-hover:scale-105 object-cover"
                  />
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black tracking-widest text-xl font-sans">QUANTURA</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-[9px] font-bold tracking-wider">v2.5.0</span>
                  </div>
                  <span className="text-slate-400 text-[11px] font-mono tracking-widest uppercase mt-0.5">Algorithmic Trading Terminal</span>
                </div>
              </div>

              {/* Center: Developer Signature */}
              <div className="flex flex-col items-center py-2.5 px-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent group-hover:via-cyan-400 transition-all duration-700"></div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Code2 className="w-3 h-3 text-cyan-400/80 group-hover:text-cyan-400 transition-colors duration-300" />
                  <span className="text-slate-400 text-[8.5px] font-mono tracking-[0.22em] uppercase">Engineered & Designed By</span>
                </div>
                
                {/* Developer Name with rising ethereal smoke on the left and light sweep across letters from J to I */}
                <div className="relative flex items-center justify-center gap-2.5">
                  {/* Ethereal rising smoke wisps on the left of the name */}
                  <div className="relative w-3.5 h-4 flex items-center justify-center shrink-0" title="Quantum Vapor">
                    <span className="w-1 h-1 rounded-full bg-cyan-400/50 blur-[0.5px]"></span>
                    <span className="smoke-wisp-1 absolute bottom-0.5 w-2.5 h-2.5 rounded-full bg-slate-300/40 blur-[2px] pointer-events-none"></span>
                    <span className="smoke-wisp-2 absolute bottom-0.5 w-3 h-3 rounded-full bg-cyan-200/35 blur-[3px] pointer-events-none"></span>
                    <span className="smoke-wisp-3 absolute bottom-0.5 w-2 h-2 rounded-full bg-slate-200/30 blur-[2px] pointer-events-none"></span>
                  </div>

                  <h4 className="text-sweep-shine font-['Syncopate',sans-serif] font-bold text-[9.5px] sm:text-[10px] tracking-[0.28em] uppercase transition-all duration-300">
                    JAOUAD ABDECHCHAFI
                  </h4>
                </div>
              </div>

              {/* Right Side: Status & Settings */}
              <div className="flex flex-col items-center md:items-end gap-2.5">
                <div className="flex items-center gap-2">
                   <div className="bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1 text-slate-400 font-mono text-[9px] tracking-wider shadow-sm flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-cyan-500" />
                    <span>SYS_READY</span>
                  </div>
                  <div className="bg-emerald-500/10 border border-amber-500/20 rounded-md px-2.5 py-1 text-emerald-500 font-mono text-[9px] tracking-wider flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
                    <span>LIVE PING</span>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsBinanceModalOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-medium tracking-wide transition-all duration-300 ${
                    executionMode === 'BINANCE_LIVE' || binanceConfig?.isConnected
                      ? 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30'
                      : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30'
                  }`}
                >
                  <Key className="w-3 h-3" />
                  <span className="font-mono uppercase">{t.independentDisclaimer || 'API Settings'}</span>
                </button>
              </div>

            </div>

            <div className="w-full flex justify-between items-center text-[10px] text-slate-600 font-mono border-t border-slate-800/50 pt-4 px-2">
              <span className="tracking-widest">&copy; {new Date().getFullYear()} ALL RIGHTS RESERVED.</span>
              <span className="flex items-center gap-1.5 tracking-widest"><Cpu className="w-3 h-3 text-slate-500"/> QUANTURA AI CORE</span>
            </div>
          </div>
        </footer>

        {/* Settings Modal */}
        
          {/* Risk Management Modal */}
          <RiskManagementModal
            isOpen={isRiskModalOpen}
            onClose={() => setIsRiskModalOpen(false)}
            language={language}
            botConfig={botConfig}
            onSaveConfig={(cfg) => {
              setBotConfig(cfg);
            }}
            logs={botLogs}
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
          onLanguageChange={setLanguage}
          onTimezoneChange={setTimezone}
          onToggleDeveloperMode={setIsDeveloperMode}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
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
            if (newConfig.isLiveModeEnabled) {
              setExecutionMode('BINANCE_LIVE');
            } else {
              setExecutionMode('PAPER');
            }
          }}
          onToggleExecutionMode={(mode) => setExecutionMode(mode)}
          onToggleMode={(mode) => setExecutionMode(mode)}
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

        {/* Floating Recommendation Notification Toast Alert */}
        {activeToastAlert && (
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
      )}
    </div>
  );
};

export default App;

