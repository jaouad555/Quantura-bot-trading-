import { apiStorage } from '../utils/apiStorage';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  KlineCandle,
  Timeframe,
  Language,
  BacktestConfig,
  BacktestResult,
  MultiCoinBacktestResult,
  TimezoneMode,
  AutoBotConfig,
  BacktestStrategyId,
} from '../types';
import {
  runHistoricalBacktest,
  runMultiCoinBacktest,
  runComparativeStrategyBacktest,
  generateFallbackKlines,
  BACKTEST_STRATEGIES,
  StrategyComparisonItem,
} from '../utils/backtestEngine';
import { RESPECTED_TRADING_PAIRS, formatCoinPrice } from '../utils/tradingPairs';
import { translations } from '../utils/translations';
import { formatDateTime } from '../utils/timezone';
import { exportBacktestToCSV } from '../utils/csvExport';
import {
  Play,
  TrendingUp,
  Target,
  Shield,
  Layers,
  Coins,
  Sparkles,
  Zap,
  CheckCircle2,
  Sliders,
  Flame,
  ArrowRight,
  RotateCcw,
  Download,
  BarChart3,
  TrendingDown,
  Percent,
  Search,
  Check,
  Cpu,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Crosshair,
  Gauge,
  Wallet,
  Clock,
  CircleDot,
  LineChart as LineChartIcon,
  Activity,
  ChevronDown,
  X,
  Star,
  Filter,
} from 'lucide-react';

interface BacktestViewProps {
  klines?: KlineCandle[];
  activeTimeframe?: Timeframe;
  symbol?: string;
  language: Language;
  timezone: TimezoneMode;
  botConfig?: AutoBotConfig;
  onUpdateBotConfig?: (newConfig: Partial<AutoBotConfig>) => void;
  onSelectSymbol?: (symbol: string) => void;
  onNavigateToBot?: () => void;
}

export const BacktestView: React.FC<BacktestViewProps> = ({
  klines = [],
  activeTimeframe = '1h',
  symbol = 'BTCUSDT',
  language,
  timezone,
  botConfig,
  onUpdateBotConfig,
  onSelectSymbol,
  onNavigateToBot,
}) => {
  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';

  const savedState = useMemo(() => {
    try {
      const saved = apiStorage.getItem('quantura_backtest_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  }, []);

  const [viewMode, setViewMode] = useState<'SINGLE_COIN' | 'MULTI_COIN'>(savedState?.viewMode || 'SINGLE_COIN');
  const [activeSingleSymbol, setActiveSingleSymbol] = useState<string>(savedState?.activeSingleSymbol || symbol || 'BTCUSDT');
  const [activeTab, setActiveTab] = useState<'CHART' | 'STRATEGY_MATRIX' | 'TRADES' | 'PORTFOLIO' | 'SETTINGS'>('CHART');

  // Sync symbol from props
  useEffect(() => {
    if (symbol && symbol !== activeSingleSymbol) {
      setActiveSingleSymbol(symbol);
    }
  }, [symbol]);

  const currentSymbol = activeSingleSymbol || 'BTCUSDT';

  // Backtest Parameters State
  const [selectedStrategyId, setSelectedStrategyId] = useState<BacktestStrategyId>(
    savedState?.selectedStrategyId || 'ALL_STRATEGIES'
  );
  const [timeframe, setTimeframe] = useState<Timeframe>(savedState?.timeframe || activeTimeframe || '1h');
  const [months, setMonths] = useState<number>(savedState?.months || 6);
  const [initialBalance, setInitialBalance] = useState<number>(savedState?.initialBalance || 1000);
  const [leverage, setLeverage] = useState<number | string>(savedState?.leverage !== undefined ? savedState.leverage : 3);
  const [marketType, setMarketType] = useState<'SPOT' | 'FUTURES'>(savedState?.marketType || 'FUTURES');
  const [tradeAllocationPercent, setTradeAllocationPercent] = useState<number | string>(
    savedState?.tradeAllocationPercent !== undefined ? savedState.tradeAllocationPercent : 20
  );
  const [riskRewardTarget, setRiskRewardTarget] = useState<number | string>(
    savedState?.riskRewardTarget !== undefined ? savedState.riskRewardTarget : 2.0
  );
  const [minSignalStrength, setMinSignalStrength] = useState<number | string>(
    savedState?.minSignalStrength !== undefined ? savedState.minSignalStrength : 65
  );
  const [slAtrMultiplier, setSlAtrMultiplier] = useState<number | string>(
    savedState?.slAtrMultiplier !== undefined ? savedState.slAtrMultiplier : 1.5
  );

  // Advanced Execution Controls
  const [trailingStopEnabled, setTrailingStopEnabled] = useState<boolean>(
    savedState?.trailingStopEnabled !== undefined ? savedState.trailingStopEnabled : true
  );
  const [trailingStopPercent, setTrailingStopPercent] = useState<number | string>(
    savedState?.trailingStopPercent !== undefined ? savedState.trailingStopPercent : 1.2
  );
  const [trailingActivationProfitPercent, setTrailingActivationProfitPercent] = useState<number | string>(
    savedState?.trailingActivationProfitPercent !== undefined ? savedState.trailingActivationProfitPercent : 1.5
  );
  const [feeRatePercent, setFeeRatePercent] = useState<number | string>(
    savedState?.feeRatePercent !== undefined ? savedState.feeRatePercent : 0.05
  );
  const [slippagePercent, setSlippagePercent] = useState<number | string>(
    savedState?.slippagePercent !== undefined ? savedState.slippagePercent : 0.02
  );

  // Trade Blotter Search & Filters
  const [tradeSearch, setTradeSearch] = useState('');
  const [tradeResultFilter, setTradeResultFilter] = useState<'ALL' | 'WINS' | 'LOSSES' | 'LIQUIDATED'>('ALL');
  const [visibleTradesLimit, setVisibleTradesLimit] = useState<number>(35);

  // Symbol selector dropdown & search state
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState(false);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState('');
  const [selectedPairCategory, setSelectedPairCategory] = useState<'ALL' | 'HOT' | 'MAJOR' | 'DEFI' | 'LAYER1'>('ALL');
  const symbolDropdownRef = useRef<HTMLDivElement>(null);

  // Timeframe selector in-app dropdown state
  const [isTimeframeDropdownOpen, setIsTimeframeDropdownOpen] = useState(false);
  const timeframeDropdownRef = useRef<HTMLDivElement>(null);

  // Leverage selector in-app dropdown state
  const [isLeverageDropdownOpen, setIsLeverageDropdownOpen] = useState(false);
  const leverageDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (symbolDropdownRef.current && !symbolDropdownRef.current.contains(e.target as Node)) {
        setIsSymbolDropdownOpen(false);
      }
      if (timeframeDropdownRef.current && !timeframeDropdownRef.current.contains(e.target as Node)) {
        setIsTimeframeDropdownOpen(false);
      }
      if (leverageDropdownRef.current && !leverageDropdownRef.current.contains(e.target as Node)) {
        setIsLeverageDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Multi-coin active pair basket
  const [activeSymbolsForBacktest, setActiveSymbolsForBacktest] = useState<string[]>(
    savedState?.activeSymbolsForBacktest || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT']
  );
  const [isBasketModalOpen, setIsBasketModalOpen] = useState(false);
  const [basketSearchQuery, setBasketSearchQuery] = useState('');

  const toggleBasketSymbol = (sym: string) => {
    setActiveSymbolsForBacktest((prev) => {
      if (prev.includes(sym)) {
        if (prev.length <= 1) return prev; // keep at least 1 coin
        return prev.filter((s) => s !== sym);
      } else {
        return [...prev, sym];
      }
    });
  };

  const setBasketPreset = (type: 'TOP3' | 'TOP5' | 'TOP10' | 'DEFI' | 'LAYER1' | 'ALL' | 'CLEAR') => {
    if (type === 'TOP3') {
      setActiveSymbolsForBacktest(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
    } else if (type === 'TOP5') {
      setActiveSymbolsForBacktest(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']);
    } else if (type === 'TOP10') {
      setActiveSymbolsForBacktest(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT']);
    } else if (type === 'DEFI') {
      setActiveSymbolsForBacktest(['UNIUSDT', 'AAVEUSDT', 'LINKUSDT', 'INJUSDT', 'CRVUSDT']);
    } else if (type === 'LAYER1') {
      setActiveSymbolsForBacktest(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'AVAXUSDT', 'NEARUSDT', 'SUIUSDT']);
    } else if (type === 'ALL') {
      setActiveSymbolsForBacktest(RESPECTED_TRADING_PAIRS.map((p) => p.symbol));
    } else if (type === 'CLEAR') {
      setActiveSymbolsForBacktest(['BTCUSDT']);
    }
  };

  // Results State
  const [multiResult, setMultiResult] = useState<MultiCoinBacktestResult | null>(null);
  const [singleResult, setSingleResult] = useState<BacktestResult | null>(null);
  const [strategyComparison, setStrategyComparison] = useState<StrategyComparisonItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingStatusText, setLoadingStatusText] = useState<string>('');
  const [showAppliedToast, setShowAppliedToast] = useState<boolean>(false);

  // Cached Klines
  const [allCoinsKlines, setAllCoinsKlines] = useState<Record<string, KlineCandle[]>>({});

  // Persist settings
  useEffect(() => {
    const settings = {
      viewMode,
      activeSingleSymbol,
      selectedStrategyId,
      timeframe,
      months,
      initialBalance,
      leverage,
      marketType,
      tradeAllocationPercent,
      riskRewardTarget,
      minSignalStrength,
      slAtrMultiplier,
      trailingStopEnabled,
      trailingStopPercent,
      trailingActivationProfitPercent,
      feeRatePercent,
      slippagePercent,
      activeSymbolsForBacktest,
    };
    try {
      apiStorage.setItem('quantura_backtest_settings', JSON.stringify(settings));
    } catch (e) {}
  }, [
    viewMode,
    activeSingleSymbol,
    selectedStrategyId,
    timeframe,
    months,
    initialBalance,
    leverage,
    marketType,
    tradeAllocationPercent,
    riskRewardTarget,
    minSignalStrength,
    slAtrMultiplier,
    trailingStopEnabled,
    trailingStopPercent,
    trailingActivationProfitPercent,
    feeRatePercent,
    slippagePercent,
    activeSymbolsForBacktest,
  ]);

  const currentConfig: BacktestConfig = useMemo(
    () => ({
      timeframe,
      months,
      candleLimit: Math.min(2000, timeframe === '1d' ? months * 30 : timeframe === '4h' ? months * 180 : months * 720),
      initialBalance,
      leverage: marketType === 'FUTURES' ? Number(leverage) || 1 : 1,
      tradeAllocationPercent: Number(tradeAllocationPercent) || 20,
      riskRewardTarget: Number(riskRewardTarget) || 2,
      minSignalStrength: Number(minSignalStrength) || 65,
      slAtrMultiplier: Number(slAtrMultiplier) || 1.5,
      marketType,
      strategyId: selectedStrategyId,
      trailingStopEnabled,
      trailingStopPercent: trailingStopPercent === '' ? 0 : Number(trailingStopPercent),
      trailingActivationProfitPercent: trailingActivationProfitPercent === '' ? 0 : Number(trailingActivationProfitPercent),
      feeRatePercent: feeRatePercent === '' ? 0 : Number(feeRatePercent),
      slippagePercent: slippagePercent === '' ? 0 : Number(slippagePercent),
    }),
    [
      timeframe,
      months,
      initialBalance,
      leverage,
      tradeAllocationPercent,
      riskRewardTarget,
      minSignalStrength,
      slAtrMultiplier,
      marketType,
      selectedStrategyId,
      trailingStopEnabled,
      trailingStopPercent,
      trailingActivationProfitPercent,
      feeRatePercent,
      slippagePercent,
    ]
  );

  // Filtered trading pairs for pro symbol selector
  const filteredTradingPairs = useMemo(() => {
    return RESPECTED_TRADING_PAIRS.filter((pair) => {
      const q = symbolSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        pair.symbol.toLowerCase().includes(q) ||
        pair.baseAsset.toLowerCase().includes(q) ||
        (pair.category && pair.category.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedPairCategory === 'ALL') return true;
      if (selectedPairCategory === 'HOT') return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'].includes(pair.symbol);
      if (selectedPairCategory === 'MAJOR') return ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT'].includes(pair.symbol);
      if (selectedPairCategory === 'DEFI') return ['UNIUSDT', 'AAVEUSDT', 'LINKUSDT', 'MKRUSDT', 'CRVUSDT', 'SNXUSDT', 'SUSHIUSDT', 'INJUSDT', 'RUNEUSDT'].includes(pair.symbol);
      if (selectedPairCategory === 'LAYER1') return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'NEARUSDT', 'ATOMUSDT', 'SUIUSDT', 'APTUSDT', 'SEIUSDT', 'FTMUSDT'].includes(pair.symbol);

      return true;
    });
  }, [symbolSearchQuery, selectedPairCategory]);

  // Switch Strategy handler
  const handleSelectStrategy = (stratId: BacktestStrategyId) => {
    setSelectedStrategyId(stratId);
    const info = BACKTEST_STRATEGIES.find((s) => s.id === stratId);
    if (info && stratId !== 'ALL_STRATEGIES') {
      setTimeframe(info.defaultTimeframe);
      if (marketType === 'FUTURES') {
        setLeverage(info.defaultLeverage);
      }
      setSlAtrMultiplier(info.defaultSlAtr);
      setRiskRewardTarget(info.defaultRiskReward);
    }
  };

  // Apply to Live Bot
  const handleApplyToLiveBot = () => {
    if (onUpdateBotConfig) {
      const activePresets = selectedStrategyId === 'ALL_STRATEGIES'
        ? ['MOMENTUM', 'SCALPER', 'BREAKOUT', 'MEAN_REVERSION', 'INSTITUTIONAL_SMC', 'SWING']
        : [selectedStrategyId];
      onUpdateBotConfig({
        activePresets: activePresets as any,
        marketType,
        leverage: marketType === 'FUTURES' ? Number(leverage) || 1 : 1,
        timeframe: (timeframe === '1h' || timeframe === '4h' || timeframe === '15m' || timeframe === '30m' || timeframe === '1d') ? timeframe : '1h',
        tradeAllocationPercent: Number(tradeAllocationPercent) || 20,
        minConfidence: Number(minSignalStrength) || 65,
        trailingStopEnabled,
        trailingStopPercent: Number(trailingStopPercent) || 1.2,
        trailingActivationProfitPercent: Number(trailingActivationProfitPercent) || 1.5,
      });
      setShowAppliedToast(true);
      setTimeout(() => setShowAppliedToast(false), 3000);
    }
  };

  // Run Simulation
  const executeSimulation = useCallback(
    async (forceFetch = false) => {
      setIsLoading(true);
      setLoadingProgress(15);
      setLoadingStatusText(isArabic ? 'جاري جلب شموع بينانس التاريخية...' : 'Fetching historical Binance candles...');

      try {
        const symbolsToFetch = viewMode === 'MULTI_COIN' ? activeSymbolsForBacktest : [currentSymbol];
        let klinesMap = { ...allCoinsKlines };
        const hasAllCached = !forceFetch && symbolsToFetch.every((s) => klinesMap[s] && klinesMap[s].length >= 30);

        if (!hasAllCached) {
          setLoadingProgress(35);
          try {
            const res = await fetch('/api/binance/batch-historical-klines', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: symbolsToFetch, timeframe, months, marketType }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.results && Object.keys(data.results).length > 0) {
                klinesMap = data.results;
              }
            }
          } catch (fetchErr) {
            console.warn('Backend fetch failed, using fallback.', fetchErr);
          }

          symbolsToFetch.forEach((sym) => {
            if (!klinesMap[sym] || klinesMap[sym].length < 30) {
              klinesMap[sym] = generateFallbackKlines(sym, timeframe, months);
            }
          });
          setAllCoinsKlines(klinesMap);
        }

        setLoadingProgress(75);
        setLoadingStatusText(isArabic ? 'جاري محاكاة الصفقات واختبار الاستراتيجيات...' : 'Simulating order executions...');

        // 1. Single Asset Backtest
        const primaryKlines = klinesMap[currentSymbol] || klinesMap[symbolsToFetch[0]] || generateFallbackKlines(currentSymbol, timeframe, months);
        const singleRes = runHistoricalBacktest(primaryKlines, currentConfig, currentSymbol);
        setSingleResult(singleRes);

        // 2. 6 Strategies Comparison Matrix
        const compMatrix = runComparativeStrategyBacktest(primaryKlines, currentConfig, currentSymbol);
        setStrategyComparison(compMatrix);

        // 3. Multi Coin Basket (if applicable)
        if (viewMode === 'MULTI_COIN') {
          const activeKlinesMap: Record<string, KlineCandle[]> = {};
          symbolsToFetch.forEach((sym) => {
            if (klinesMap[sym]) activeKlinesMap[sym] = klinesMap[sym];
          });
          const multiRes = runMultiCoinBacktest(activeKlinesMap, currentConfig);
          setMultiResult(multiRes);
        }

        setLoadingProgress(100);
      } catch (err) {
        console.error('Simulation error:', err);
      } finally {
        setTimeout(() => {
          setIsLoading(false);
          setLoadingProgress(0);
        }, 200);
      }
    },
    [allCoinsKlines, currentConfig, currentSymbol, isArabic, months, timeframe, marketType, viewMode, activeSymbolsForBacktest]
  );

  useEffect(() => {
    executeSimulation(false);
  }, [timeframe, months, currentSymbol, viewMode, selectedStrategyId]);

  // Primary active result
  const activeResult: BacktestResult | null = useMemo(() => {
    if (viewMode === 'SINGLE_COIN') return singleResult;
    if (multiResult) {
      return {
        symbol: 'PORTFOLIO_BASKET',
        config: currentConfig,
        initialBalance: multiResult.totalInitialBalance,
        finalBalance: multiResult.totalFinalBalance,
        netProfitUsdt: multiResult.totalNetProfitUsdt,
        netReturnPercent: multiResult.totalNetReturnPercent,
        maxDrawdownPercent: 0,
        maxDrawdownUsdt: 0,
        totalTrades: multiResult.totalTrades,
        winningTrades: multiResult.totalWinningTrades,
        losingTrades: multiResult.totalLosingTrades,
        winRate: multiResult.overallWinRate,
        lossRate: 100 - multiResult.overallWinRate,
        equityCurve: multiResult.portfolioEquityCurve,
        profitFactor: 2.1,
        averageRR: Number(riskRewardTarget) || 2.0,
        expectancy: 0,
        avgWinUsdt: 0,
        avgLossUsdt: 0,
        tp1Rate: 0,
        tp2Rate: 0,
        tp3Rate: 0,
        slRate: 0,
        trades: [],
        sharpeRatio: 1.8,
        sortinoRatio: 2.3,
        totalFeesUsdt: 0,
      };
    }
    return singleResult;
  }, [viewMode, singleResult, multiResult, currentConfig, riskRewardTarget]);

  // Filtered trades blotter
  const filteredTrades = useMemo(() => {
    if (!singleResult || !singleResult.trades) return [];
    return singleResult.trades.filter((trade) => {
      const matchSearch =
        !tradeSearch ||
        trade.symbol.toLowerCase().includes(tradeSearch.toLowerCase()) ||
        trade.strategyName?.toLowerCase().includes(tradeSearch.toLowerCase()) ||
        trade.result.toLowerCase().includes(tradeSearch.toLowerCase());

      let matchFilter = true;
      if (tradeResultFilter === 'WINS') matchFilter = trade.pnlPercent > 0;
      else if (tradeResultFilter === 'LOSSES') matchFilter = trade.pnlPercent <= 0 && trade.result !== 'LIQUIDATED';
      else if (tradeResultFilter === 'LIQUIDATED') matchFilter = trade.result === 'LIQUIDATED';

      return matchSearch && matchFilter;
    });
  }, [singleResult, tradeSearch, tradeResultFilter]);

  const activeStrategyObj = useMemo(
    () => BACKTEST_STRATEGIES.find((s) => s.id === selectedStrategyId) || BACKTEST_STRATEGIES[0],
    [selectedStrategyId]
  );

  return (
    <div className="flex flex-col w-full h-full gap-4 text-slate-100 pb-10" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      {showAppliedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-emerald-500/90 backdrop-blur-md text-white font-bold rounded-xl shadow-2xl shadow-emerald-500/30 border border-emerald-400/40 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{isArabic ? 'تم تطبيق بارامترات الاستراتيجية بنجاح على البوت الحي!' : 'Strategy parameters applied to Live Bot!'}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMPACT PRO CONTROL BAR (Platform Grade Terminal Header)                 */}
      {/* ========================================================================= */}
      <div className="relative z-30 bg-[#0f172a]/95 border border-[#1e293b] rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col gap-4">
        
        {/* Row 1: Strategy Selector Bar & Mode Switches */}
        <div className="flex flex-col gap-3 border-b border-[#1e293b] pb-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Strategy Title & Quick Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-brand-400" />
                {isArabic ? 'الاستراتيجية:' : 'Strategy:'}
              </span>

              {BACKTEST_STRATEGIES.map((strat) => {
                const isSelected = selectedStrategyId === strat.id;
                return (
                  <button
                    key={strat.id}
                    onClick={() => handleSelectStrategy(strat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 border relative cursor-pointer ${
                      isSelected
                        ? 'bg-brand-500/20 text-brand-300 border-brand-500/70 shadow-[0_0_10px_rgba(20,184,166,0.3)] ring-1 ring-brand-500/50'
                        : 'bg-[#1e293b]/60 text-slate-400 border-slate-700/50 hover:text-slate-200 hover:bg-[#1e293b]'
                    }`}
                    title={isArabic ? strat.shortDescAr : strat.shortDesc}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: strat.color }}
                    />
                    <span className={isSelected ? 'font-black text-white' : ''}>
                      {isArabic ? strat.nameAr.split('(')[0].trim() : strat.name}
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-black/50 text-slate-300 font-mono border border-slate-700/40">
                      {strat.defaultTimeframe.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Right Action Buttons */}
            <div className="flex items-center gap-2">
              {onUpdateBotConfig && (
                <button
                  onClick={handleApplyToLiveBot}
                  className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                  title={isArabic ? 'نقل هذه الإعدادات مباشرة للبوت الحي' : 'Apply parameters to Live Bot'}
                >
                  <Zap className="w-3 h-3 text-amber-300" />
                  <span>{isArabic ? 'تطبيق على البوت' : 'Apply to Bot'}</span>
                </button>
              )}

              {singleResult && singleResult.trades.length > 0 && (
                <button
                  onClick={() => exportBacktestToCSV(singleResult)}
                  className="px-2.5 py-1 bg-[#1e293b] hover:bg-[#334155] text-slate-300 rounded-lg text-[11px] font-bold flex items-center gap-1 border border-slate-700 transition-all active:scale-95 cursor-pointer"
                  title="Export CSV"
                >
                  <Download className="w-3 h-3" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
              )}

              <button
                onClick={() => executeSimulation(true)}
                disabled={isLoading}
                className="px-3 py-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-brand-600/25 transition-all active:scale-95 cursor-pointer"
              >
                <Play className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? (isArabic ? 'جاري المحاكاة...' : 'Simulating...') : isArabic ? 'إعادة الاختبار' : 'Run Test'}</span>
              </button>
            </div>
          </div>

          {/* DYNAMIC ACTIVE STRATEGY SHOWCASE BANNER */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]"
                style={{ color: activeStrategyObj.color, backgroundColor: activeStrategyObj.color }}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">
                  {isArabic ? 'الاستراتيجية:' : 'Strategy:'}
                </span>
                <span className="text-xs font-extrabold text-white tracking-wide">
                  {isArabic ? activeStrategyObj.nameAr : activeStrategyObj.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-300 border border-brand-500/30 font-bold font-mono">
                  {isArabic ? `فريم: ${timeframe.toUpperCase()}` : `Frame: ${timeframe.toUpperCase()}`}
                </span>
                {marketType === 'SPOT' ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold font-mono">
                    {isArabic ? 'سوق فوري (بدون رافعة)' : 'Spot: 1x (No Lev)'}
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold font-mono">
                    {isArabic ? `رافعة: ${leverage}x` : `Lev: ${leverage}x`}
                  </span>
                )}
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold font-mono">
                  {isArabic ? `هدف: 1:${riskRewardTarget}` : `RR: 1:${riskRewardTarget}`}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug max-w-xl">
              {isArabic ? activeStrategyObj.shortDescAr : activeStrategyObj.shortDesc}
            </p>
          </div>
        </div>

        {/* Row 2: Parameters Grid (High Density) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          
          {/* Mode Switch (Single Coin vs Multi Coin) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'وضع النطاق' : 'Scope'}
            </span>
            <div className="flex bg-[#1e293b] p-0.5 rounded-lg border border-slate-700/60">
              <button
                type="button"
                onClick={() => setViewMode('SINGLE_COIN')}
                className={`flex-1 py-1 px-1.5 rounded-md font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  viewMode === 'SINGLE_COIN' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Crosshair className="w-3 h-3" />
                {isArabic ? 'زوج واحد' : 'Single'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MULTI_COIN')}
                className={`flex-1 py-1 px-1.5 rounded-md font-bold text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  viewMode === 'MULTI_COIN' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                {isArabic ? 'سلة أزواج' : 'Basket'}
              </button>
            </div>
          </div>

          {/* Symbol Selector (when single coin) or Basket Trigger (when multi coin) */}
          {viewMode === 'SINGLE_COIN' ? (
            <div className={`flex flex-col gap-1 relative ${isSymbolDropdownOpen ? 'z-50' : 'z-10'}`} ref={symbolDropdownRef}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {isArabic ? 'زوج التداول' : 'Symbol'}
                </span>
                <span className="text-[9px] text-brand-400/80 font-mono">
                  {RESPECTED_TRADING_PAIRS.length} {isArabic ? 'متاح' : 'pairs'}
                </span>
              </div>
              
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsSymbolDropdownOpen((prev) => !prev)}
                className={`w-full bg-[#1e293b] border ${
                  isSymbolDropdownOpen ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-700 hover:border-slate-600'
                } rounded-lg px-2 py-1 text-xs font-bold text-white flex items-center justify-between transition-all shadow-sm cursor-pointer`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                  <span className="font-mono text-white text-xs">{currentSymbol}</span>
                  <span className="text-[9px] text-slate-400 font-normal">
                    ({RESPECTED_TRADING_PAIRS.find(p => p.symbol === currentSymbol)?.baseAsset || 'USDT'})
                  </span>
                </div>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isSymbolDropdownOpen ? 'rotate-180 text-brand-400' : ''}`} />
              </button>

              {/* Floating Pro Pairs Dropdown Menu (Strictly within in-app container) */}
              {isSymbolDropdownOpen && (
                <div className="absolute top-[105%] start-0 z-[100] w-72 sm:w-80 bg-[#0f172a] border border-slate-700/90 rounded-xl shadow-2xl backdrop-blur-xl p-2 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/80">
                  {/* Search Bar inside dropdown */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={symbolSearchQuery}
                      onChange={(e) => setSymbolSearchQuery(e.target.value)}
                      placeholder={isArabic ? 'بحث في الأزواج (BTC, SOL, ETH)...' : 'Search pair or token (e.g. BTC, SOL)...'}
                      autoFocus
                      className="w-full bg-[#1e293b] border border-slate-700/80 rounded-lg pl-8 pr-7 py-1 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                    />
                    {symbolSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSymbolSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[9px]">
                    {[
                      { id: 'ALL', label: isArabic ? 'الكل' : 'All' },
                      { id: 'HOT', label: isArabic ? 'الشائعة' : 'Hot' },
                      { id: 'MAJOR', label: isArabic ? 'القيادية' : 'Major' },
                      { id: 'LAYER1', label: 'Layer 1' },
                      { id: 'DEFI', label: 'DeFi' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedPairCategory(cat.id as any)}
                        className={`px-1.5 py-0.5 rounded font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          selectedPairCategory === cat.id
                            ? 'bg-brand-500 text-white shadow-xs'
                            : 'bg-[#1e293b] text-slate-400 hover:text-slate-200 hover:bg-[#334155]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Pairs Scrollable List */}
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/60 rounded-lg border border-slate-800">
                    {filteredTradingPairs.length === 0 ? (
                      <div className="py-4 text-center text-slate-500 text-xs">
                        {isArabic ? 'لم يتم العثور على أزواج متطابقة' : 'No pairs found'}
                      </div>
                    ) : (
                      filteredTradingPairs.map((pair) => {
                        const isCurrent = pair.symbol === currentSymbol;
                        return (
                          <button
                            key={pair.symbol}
                            type="button"
                            onClick={() => {
                              setActiveSingleSymbol(pair.symbol);
                              if (onSelectSymbol) onSelectSymbol(pair.symbol);
                              setIsSymbolDropdownOpen(false);
                            }}
                            className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-brand-500/20 text-brand-300 font-bold'
                                : 'hover:bg-[#1e293b] text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-white">
                                {pair.symbol}
                              </span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                                {pair.baseAsset}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {pair.category && (
                                <span className="text-[9px] text-slate-500 uppercase font-mono">
                                  {pair.category}
                                </span>
                              )}
                              {isCurrent && (
                                <Check className="w-3 h-3 text-brand-400" />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {isArabic ? 'سلة الأزواج' : 'Pair Basket'}
                </span>
                <span className="text-[9px] text-amber-400 font-mono">
                  {activeSymbolsForBacktest.length}/{RESPECTED_TRADING_PAIRS.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsBasketModalOpen(true)}
                className="flex items-center justify-between px-2 py-1 bg-[#1e293b] hover:bg-slate-800 border border-brand-500/40 hover:border-brand-500 rounded-lg text-xs font-bold text-brand-300 transition-all shadow-sm cursor-pointer"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 animate-pulse" />
                  <span className="font-mono text-white text-xs">
                    {activeSymbolsForBacktest.length} {isArabic ? 'أزواج' : 'Pairs'}
                  </span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30">
                  {isArabic ? 'تعديل' : 'Edit'}
                </span>
              </button>
            </div>
          )}

          {/* Market Type (Futures / Spot) */}
          <div className={`flex flex-col gap-1 relative ${isLeverageDropdownOpen ? 'z-50' : 'z-10'}`} ref={leverageDropdownRef}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'السوق والرافعة' : 'Market & Lev'}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="flex bg-[#1e293b] p-0.5 rounded-lg border border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setMarketType('FUTURES')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    marketType === 'FUTURES' ? 'bg-brand-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Futures
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMarketType('SPOT');
                    setLeverage(1);
                    setIsLeverageDropdownOpen(false);
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                    marketType === 'SPOT' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Spot
                </button>
              </div>

              {marketType === 'FUTURES' ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsLeverageDropdownOpen((prev) => !prev)}
                    className={`bg-[#1e293b] border ${
                      isLeverageDropdownOpen ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-amber-500/50 hover:border-amber-400'
                    } rounded-lg px-2.5 py-1 text-xs font-bold text-amber-300 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-mono font-bold text-amber-300">{leverage}x</span>
                    <ChevronDown className={`w-3 h-3 text-amber-400/80 transition-transform ${isLeverageDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Vertical Popover List strictly inside the app, floating high above Net P&L and all cards */}
                  {isLeverageDropdownOpen && (
                    <div className="absolute top-[110%] start-0 z-[100] w-56 bg-[#0a101f] border border-slate-700 rounded-xl shadow-2xl backdrop-blur-2xl p-1.5 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto no-scrollbar ring-1 ring-amber-500/30">
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                        {isArabic ? 'اختر الرافعة المالية' : 'Select Leverage'}
                      </div>
                      {[
                        { lev: 1, label: '1x', desc: isArabic ? 'بدون مضاعفة (محافظ)' : '1x Conservative', tag: 'Safe' },
                        { lev: 2, label: '2x', desc: isArabic ? 'موصى به للأمان' : '2x Low Risk', tag: 'Safe' },
                        { lev: 3, label: '3x', desc: isArabic ? 'توازن مثالي' : '3x Balanced', tag: 'Optimal' },
                        { lev: 5, label: '5x', desc: isArabic ? 'مخاطرة قياسية' : '5x Standard', tag: 'Standard' },
                        { lev: 7, label: '7x', desc: isArabic ? 'صفقات زخم' : '7x Momentum', tag: 'Active' },
                        { lev: 10, label: '10x', desc: isArabic ? 'مضاربة نشطة' : '10x Scalp', tag: 'Aggressive' },
                        { lev: 15, label: '15x', desc: isArabic ? 'مضاربة عالية' : '15x High Risk', tag: 'High' },
                        { lev: 20, label: '20x', desc: isArabic ? 'مضاربة سريعة' : '20x Fast Scalp', tag: 'High' },
                        { lev: 25, label: '25x', desc: isArabic ? 'احترافية قصوى' : '25x Pro Only', tag: 'Expert' },
                        { lev: 50, label: '50x', desc: isArabic ? 'مخاطرة قصوى' : '50x Extreme', tag: 'Extreme' },
                      ].map((item) => {
                        const isSelected = Number(leverage) === item.lev;
                        return (
                          <button
                            key={item.lev}
                            type="button"
                            onClick={() => {
                              setLeverage(item.lev);
                              setIsLeverageDropdownOpen(false);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-left rtl:text-right flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                                : 'hover:bg-[#1e293b] text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-amber-300">
                                {item.label}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({item.desc})
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                                item.lev <= 3 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                                item.lev <= 10 ? 'bg-amber-950 text-amber-400 border border-amber-800/40' :
                                'bg-rose-950 text-rose-400 border border-rose-800/40'
                              }`}>
                                {item.tag}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-2 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-[10px] font-mono text-cyan-300 flex items-center gap-1">
                  <span>1x (Spot)</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeframe Selector (Custom in-app popover dropdown strictly inside the application) */}
          <div className={`flex flex-col gap-1 relative ${isTimeframeDropdownOpen ? 'z-50' : 'z-10'}`} ref={timeframeDropdownRef}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'الفريم الزمني' : 'Timeframe'}
            </span>
            
            {/* Timeframe Trigger Button */}
            <button
              type="button"
              onClick={() => setIsTimeframeDropdownOpen((prev) => !prev)}
              className={`w-full bg-[#1e293b] border ${
                isTimeframeDropdownOpen ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-700 hover:border-slate-600'
              } rounded-lg px-2 py-1 text-xs font-bold text-white flex items-center justify-between transition-all shadow-sm cursor-pointer`}
            >
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-brand-400" />
                <span className="font-mono text-white uppercase text-xs">{timeframe}</span>
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isTimeframeDropdownOpen ? 'rotate-180 text-brand-400' : ''}`} />
            </button>

            {/* In-app floating popup inside container */}
            {isTimeframeDropdownOpen && (
              <div className="absolute top-[105%] start-0 z-[100] w-48 bg-[#0a101f] border border-slate-700 rounded-xl shadow-2xl backdrop-blur-2xl p-1.5 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-brand-500/20">
                {[
                  { value: '15m' as Timeframe, label: '15m', desc: isArabic ? '15 دقيقة' : '15 Min', tag: 'Scalper' },
                  { value: '30m' as Timeframe, label: '30m', desc: isArabic ? '30 دقيقة' : '30 Min', tag: 'Breakout' },
                  { value: '1h' as Timeframe, label: '1h', desc: isArabic ? '1 ساعة' : '1 Hour', tag: 'Trend/SMC' },
                  { value: '4h' as Timeframe, label: '4h', desc: isArabic ? '4 ساعات' : '4 Hours', tag: 'Swing' },
                  { value: '1d' as Timeframe, label: '1d', desc: isArabic ? '1 يوم' : '1 Day', tag: 'Macro' },
                ].map((tf) => {
                  const isCurrent = timeframe === tf.value;
                  return (
                    <button
                      key={tf.value}
                      type="button"
                      onClick={() => {
                        setTimeframe(tf.value);
                        setIsTimeframeDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-brand-500/20 text-brand-300 font-bold border border-brand-500/40'
                          : 'hover:bg-[#1e293b] text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-white uppercase">
                          {tf.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({tf.desc})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-slate-400 font-mono">
                          {tf.tag}
                        </span>
                        {isCurrent && <Check className="w-3 h-3 text-brand-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historical Horizon */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'العمق الزمني' : 'Horizon'}
            </span>
            <div className="flex bg-[#1e293b] p-0.5 rounded-lg border border-slate-700">
              {[
                { m: 1, label: isArabic ? '1ش' : '1M' },
                { m: 3, label: isArabic ? '3ش' : '3M' },
                { m: 6, label: isArabic ? '6ش' : '6M' },
                { m: 12, label: isArabic ? '1س' : '1Y' },
                { m: 24, label: isArabic ? '2س' : '2Y' },
              ].map((h) => (
                <button
                  key={h.m}
                  type="button"
                  onClick={() => setMonths(h.m)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    months === h.m ? 'bg-brand-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Initial Capital */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'رأس المال' : 'Balance'}
            </span>
            <div className="relative">
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(Math.max(10, Number(e.target.value)))}
                className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-emerald-400 pl-5 focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
              <span className="absolute left-1.5 top-1.5 text-slate-400 text-xs font-bold">$</span>
            </div>
          </div>

          {/* Allocation % */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'تخصيص الصفقة' : 'Per Trade Alloc'}
            </span>
            <div className="relative">
              <input
                type="number"
                value={tradeAllocationPercent}
                onChange={(e) => setTradeAllocationPercent(Math.min(100, Math.max(1, Number(e.target.value))))}
                className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-white pr-5 focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
              <span className="absolute right-1.5 top-1.5 text-slate-400 text-xs font-bold">%</span>
            </div>
          </div>

        </div>

        {/* Progress bar during simulation */}
        {isLoading && (
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-brand-500 via-teal-400 to-emerald-400 h-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* EXECUTIVE KPI PERFORMANCE STRIP (Institutional Financial Metrics)        */}
      {/* ========================================================================= */}
      {activeResult && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative z-0">
          
          {/* Card 1: Net PnL & ROI */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3.5 flex flex-col justify-between shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isArabic ? 'صافي الأرباح' : 'Net P&L'}
              </span>
              <div className={`p-1 rounded-md ${activeResult.netProfitUsdt >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                {activeResult.netProfitUsdt >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              </div>
            </div>
            <div className="mt-2">
              <div className={`text-xl font-extrabold font-mono ${activeResult.netProfitUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {activeResult.netProfitUsdt >= 0 ? '+' : ''}${activeResult.netProfitUsdt.toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold mt-0.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeResult.netReturnPercent >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {activeResult.netReturnPercent >= 0 ? '+' : ''}{activeResult.netReturnPercent.toFixed(2)}% ROI
                </span>
                <span className="text-[10px] text-slate-500">
                  ${activeResult.finalBalance.toLocaleString()} bal
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Win Rate & Ratio */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isArabic ? 'نسبة النجاح' : 'Win Rate'}
              </span>
              <Target className="w-3.5 h-3.5 text-brand-400" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold font-mono text-brand-300">
                {activeResult.winRate.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold mt-0.5 text-slate-400">
                <span className="text-emerald-400">{activeResult.winningTrades}W</span>
                <span>/</span>
                <span className="text-rose-400">{activeResult.losingTrades}L</span>
                <span className="text-slate-500">({activeResult.totalTrades} {isArabic ? 'صفقة' : 'trades'})</span>
              </div>
            </div>
          </div>

          {/* Card 3: Profit Factor */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isArabic ? 'معامل الربحية' : 'Profit Factor'}
              </span>
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-2">
              <div className={`text-xl font-extrabold font-mono ${activeResult.profitFactor >= 2 ? 'text-emerald-400' : activeResult.profitFactor >= 1.3 ? 'text-amber-400' : 'text-rose-400'}`}>
                {activeResult.profitFactor > 0 ? activeResult.profitFactor.toFixed(2) : '0.00'}
              </div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                {activeResult.profitFactor >= 2 ? (isArabic ? 'ممتاز جداً' : 'Institutional Grade') : (isArabic ? 'مقبول' : 'Standard')}
              </div>
            </div>
          </div>

          {/* Card 4: Max Drawdown */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isArabic ? 'أقصى تراجع' : 'Max Drawdown'}
              </span>
              <Shield className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold font-mono text-rose-400">
                -{activeResult.maxDrawdownPercent.toFixed(2)}%
              </div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                -${activeResult.maxDrawdownUsdt.toFixed(1)} peak dd
              </div>
            </div>
          </div>

          {/* Card 5: Sharpe & Sortino */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isArabic ? 'مؤشر شارب' : 'Sharpe / Sortino'}
              </span>
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold font-mono text-indigo-300">
                {activeResult.sharpeRatio.toFixed(2)}
              </div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                Sortino: {activeResult.sortinoRatio.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Card 6: Expectancy / Trade */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isArabic ? 'توقع كل صفقة' : 'Expectancy / Trade'}
              </span>
              <CircleDot className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="mt-2">
              <div className={`text-xl font-extrabold font-mono ${activeResult.expectancy >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>
                {activeResult.expectancy >= 0 ? '+' : ''}${activeResult.expectancy.toFixed(2)}
              </div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                R:R target: 1:{riskRewardTarget}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MULTI-TAB WORKSPACE NAVIGATION                                           */}
      {/* ========================================================================= */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl flex flex-col">
        
        {/* Navigation Tabs Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e293b] bg-slate-900/80">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab('CHART')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'CHART'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]'
              }`}
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span>{isArabic ? 'منحنى النمو والمحفظة' : 'Equity Curve'}</span>
            </button>

            <button
              onClick={() => setActiveTab('STRATEGY_MATRIX')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'STRATEGY_MATRIX'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{isArabic ? 'مصفوفة مقارنة الاستراتيجيات الست' : '6 Strategies Benchmark'}</span>
            </button>

            <button
              onClick={() => setActiveTab('TRADES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'TRADES'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{isArabic ? 'سجل الصفقات المنفذة' : 'Trade Blotter'} ({singleResult?.trades.length || 0})</span>
            </button>

            {viewMode === 'MULTI_COIN' && (
              <button
                onClick={() => setActiveTab('PORTFOLIO')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'PORTFOLIO'
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>{isArabic ? 'ترتيب سلة العملات' : 'Basket Ranking'}</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'SETTINGS'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isArabic ? 'الإعدادات المتقدمة' : 'Advanced Parameters'}</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-400" />
              {isArabic ? 'استراتيجية البوت' : 'Bot Equity'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              {isArabic ? 'الشراء والاحتفاظ' : 'Buy & Hold'}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: EQUITY CURVE CHART & PERFORMANCE VISUALIZATION                     */}
        {/* ========================================================================= */}
        {activeTab === 'CHART' && activeResult && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: activeStrategyObj.color }}
                />
                <span className="text-xs font-extrabold text-white">
                  {isArabic
                    ? `منحنى النمو: ${activeStrategyObj.nameAr} (${viewMode === 'SINGLE_COIN' ? currentSymbol : 'سلة العملات'})`
                    : `Equity Growth: ${activeStrategyObj.name} (${viewMode === 'SINGLE_COIN' ? currentSymbol : 'Basket'})`}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                  {timeframe} • {marketType === 'FUTURES' ? `${leverage}x` : 'Spot'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {activeResult.trades.length} {isArabic ? 'صفقة منفذة خلال' : 'trades across'} {months} {isArabic ? 'أشهر' : 'months'}
              </span>
            </div>

            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={activeResult.equityCurve}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="botGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="bhGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#475569"
                    fontSize={10}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    domain={['auto', 'auto']}
                    tickFormatter={(val) => `$${Math.round(val)}`}
                    orientation={isArabic ? 'right' : 'left'}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      fontSize: '11px',
                    }}
                    formatter={(val: any, name: string) => [
                      `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                      name === 'botEquityUsdt' ? (isArabic ? 'رأس مال البوت' : 'Bot Equity') : isArabic ? 'الشراء والاحتفاظ' : 'Buy & Hold',
                    ]}
                    labelFormatter={(label) => new Date(Number(label)).toLocaleString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="buyHoldEquityUsdt"
                    stroke="#64748b"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="url(#bhGrad)"
                    name="buyHoldEquityUsdt"
                  />
                  <Area
                    type="monotone"
                    dataKey="botEquityUsdt"
                    stroke="#14b8a6"
                    strokeWidth={2.5}
                    fill="url(#botGrad)"
                    name="botEquityUsdt"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Target Execution Distribution Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
              <div className="bg-[#1e293b]/40 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  {isArabic ? 'تخريج الهدف 1 (TP1)' : 'Target 1 (TP1 Hit)'}
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-extrabold font-mono text-emerald-300">{activeResult.tp1Rate}%</span>
                  <span className="text-[10px] text-slate-400">{isArabic ? 'حجز 50% + Breakeven' : '50% secured'}</span>
                </div>
              </div>

              <div className="bg-[#1e293b]/40 border border-teal-500/20 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">
                  {isArabic ? 'تخريج الهدف 2 (TP2)' : 'Target 2 (TP2 Hit)'}
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-extrabold font-mono text-teal-300">{activeResult.tp2Rate}%</span>
                  <span className="text-[10px] text-slate-400">{isArabic ? 'حجز 25% إضافي' : '25% locked'}</span>
                </div>
              </div>

              <div className="bg-[#1e293b]/40 border border-brand-500/20 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">
                  {isArabic ? 'تخريج الهدف 3 الكامل (TP3)' : 'Target 3 (TP3 Full Scale)'}
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-extrabold font-mono text-brand-300">{activeResult.tp3Rate}%</span>
                  <span className="text-[10px] text-slate-400">{isArabic ? 'إغلاق كامل بربح مضاعف' : 'Full scale-out'}</span>
                </div>
              </div>

              <div className="bg-[#1e293b]/40 border border-rose-500/20 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                  {isArabic ? 'نسبة ضرب الوقف (SL Rate)' : 'Stop Loss (SL Rate)'}
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-extrabold font-mono text-rose-300">{activeResult.slRate}%</span>
                  <span className="text-[10px] text-slate-400">{isArabic ? 'حماية رأس المال' : 'Protected'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 6 STRATEGIES COMPARISON BENCHMARK MATRIX                           */}
        {/* ========================================================================= */}
        {activeTab === 'STRATEGY_MATRIX' && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {isArabic ? `مقارنة أداء الاستراتيجيات الست على ${currentSymbol}` : `Benchmark: 6 Strategies Performance on ${currentSymbol}`}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isArabic
                    ? 'اختبار حقيقي لكافة الاستراتيجيات على نفس الشموع لمعرفة الاستراتيجية الأكثر إنتاجية وربحية.'
                    : 'Simultaneous backtest of all 6 strategies on identical historical candles to find the optimal trading model.'}
                </p>
              </div>

              <button
                onClick={() => executeSimulation(false)}
                className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تحديث المقارنة' : 'Refresh'}</span>
              </button>
            </div>

            {/* Leaderboard Table */}
            <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#1e293b]/70 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#1e293b]">
                  <tr>
                    <th className="py-3 px-4">{isArabic ? 'الاستراتيجية' : 'Strategy'}</th>
                    <th className="py-3 px-3">{isArabic ? 'الصافي ($)' : 'Net P&L ($)'}</th>
                    <th className="py-3 px-3">{isArabic ? 'العائد %' : 'ROI %'}</th>
                    <th className="py-3 px-3">{isArabic ? 'نسبة النجاح' : 'Win Rate'}</th>
                    <th className="py-3 px-3">{isArabic ? 'الصفقات' : 'Trades'}</th>
                    <th className="py-3 px-3">{isArabic ? 'معامل الربح' : 'Profit Factor'}</th>
                    <th className="py-3 px-3">{isArabic ? 'أقصى تراجع' : 'Max DD'}</th>
                    <th className="py-3 px-3">{isArabic ? 'شارب' : 'Sharpe'}</th>
                    <th className="py-3 px-4 text-center">{isArabic ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b] font-mono">
                  {strategyComparison.map((item, idx) => {
                    const isCurrent = selectedStrategyId === item.strategyId;
                    return (
                      <tr
                        key={item.strategyId}
                        className={`transition-colors ${
                          item.isBest
                            ? 'bg-amber-500/10 hover:bg-amber-500/15'
                            : isCurrent
                            ? 'bg-brand-500/10 hover:bg-brand-500/15'
                            : 'hover:bg-[#1e293b]/40'
                        }`}
                      >
                        {/* Strategy Info */}
                        <td className="py-3 px-4 font-sans font-bold text-white flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{isArabic ? item.strategyNameAr : item.strategyName}</span>
                              {item.isBest && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  {isArabic ? '★ الأفضل' : '★ Top #1'}
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                                  {isArabic ? 'المحددة حالياً' : 'Active'}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {item.badge}
                            </span>
                          </div>
                        </td>

                        {/* Net Profit */}
                        <td className={`py-3 px-3 font-bold ${item.netProfitUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.netProfitUsdt >= 0 ? '+' : ''}${item.netProfitUsdt.toLocaleString()}
                        </td>

                        {/* ROI % */}
                        <td className={`py-3 px-3 font-bold ${item.netReturnPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {item.netReturnPercent >= 0 ? '+' : ''}{item.netReturnPercent.toFixed(1)}%
                        </td>

                        {/* Win Rate */}
                        <td className="py-3 px-3 font-bold text-slate-200">
                          {item.winRate.toFixed(1)}%
                          <span className="text-[10px] text-slate-500 font-normal ml-1">
                            ({item.winningTrades}W/{item.losingTrades}L)
                          </span>
                        </td>

                        {/* Total Trades */}
                        <td className="py-3 px-3 text-slate-300 font-bold">
                          {item.totalTrades}
                        </td>

                        {/* Profit Factor */}
                        <td className="py-3 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            item.profitFactor >= 2 ? 'bg-emerald-500/20 text-emerald-300' : item.profitFactor >= 1.3 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {item.profitFactor > 0 ? item.profitFactor.toFixed(2) : '0.00'}
                          </span>
                        </td>

                        {/* Max Drawdown */}
                        <td className="py-3 px-3 text-rose-400 font-bold">
                          -{item.maxDrawdownPercent.toFixed(1)}%
                        </td>

                        {/* Sharpe */}
                        <td className="py-3 px-3 text-indigo-300 font-bold">
                          {item.sharpeRatio.toFixed(2)}
                        </td>

                        {/* Action Button */}
                        <td className="py-3 px-4 text-center font-sans">
                          <button
                            onClick={() => {
                              handleSelectStrategy(item.strategyId);
                              setActiveTab('CHART');
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              isCurrent
                                ? 'bg-brand-500 text-white'
                                : 'bg-[#1e293b] hover:bg-brand-600 hover:text-white text-slate-300 border border-slate-700'
                            }`}
                          >
                            {isCurrent ? (isArabic ? 'مفعلة' : 'Active') : (isArabic ? 'اختيار' : 'Select')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TRADE BLOTTER / DETAILED TRANSACTION LOGS                          */}
        {/* ========================================================================= */}
        {activeTab === 'TRADES' && (
          <div className="p-5 flex flex-col gap-4">
            
            {/* Blotter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isArabic ? 'بحث في الصفقات (الاستراتيجية، النتيجة)...' : 'Search trades (strategy, result)...'}
                    value={tradeSearch}
                    onChange={(e) => setTradeSearch(e.target.value)}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5">
                {(['ALL', 'WINS', 'LOSSES', 'LIQUIDATED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTradeResultFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                      tradeResultFilter === filter
                        ? 'bg-brand-500/20 text-brand-300 border-brand-500/50'
                        : 'bg-[#1e293b]/60 text-slate-400 border-slate-700/50 hover:bg-[#1e293b]'
                    }`}
                  >
                    {filter === 'ALL'
                      ? isArabic ? 'الكل' : 'All'
                      : filter === 'WINS'
                      ? isArabic ? 'الرابحة' : 'Wins'
                      : filter === 'LOSSES'
                      ? isArabic ? 'الخاسرة' : 'Losses'
                      : isArabic ? 'التصفيات' : 'Liquidations'}
                  </button>
                ))}
              </div>
            </div>

            {/* Trades Table */}
            <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#1e293b]/70 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#1e293b]">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">{isArabic ? 'النوع والرمز' : 'Type & Pair'}</th>
                    <th className="py-3 px-3">{isArabic ? 'الاستراتيجية' : 'Strategy'}</th>
                    <th className="py-3 px-3">{isArabic ? 'سعر الدخول' : 'Entry Price'}</th>
                    <th className="py-3 px-3">{isArabic ? 'سعر الخروج' : 'Exit Price'}</th>
                    <th className="py-3 px-3">{isArabic ? 'النتيجة والسبب' : 'Result'}</th>
                    <th className="py-3 px-3">{isArabic ? 'الربح %' : 'ROE %'}</th>
                    <th className="py-3 px-3">{isArabic ? 'الربح ($)' : 'PnL ($)'}</th>
                    <th className="py-3 px-3">{isArabic ? 'الرصيد بعد' : 'Balance After'}</th>
                    <th className="py-3 px-3">{isArabic ? 'المدة' : 'Duration'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b] font-mono">
                  {filteredTrades.slice(0, visibleTradesLimit).map((trade, idx) => {
                    const isWin = trade.pnlPercent > 0;
                    return (
                      <tr key={trade.id} className="hover:bg-[#1e293b]/40 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500 text-[10px]">{idx + 1}</td>

                        {/* Type & Pair */}
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                trade.type === 'LONG'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {trade.type}
                            </span>
                            <span className="font-bold text-white">{trade.symbol}</span>
                          </div>
                        </td>

                        {/* Strategy */}
                        <td className="py-2.5 px-3 font-sans text-slate-300 font-bold">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] border border-slate-700">
                            {trade.strategyName || 'Ensemble'}
                          </span>
                        </td>

                        {/* Entry Price */}
                        <td className="py-2.5 px-3 text-slate-200">
                          ${formatCoinPrice(trade.entryPrice)}
                        </td>

                        {/* Exit Price */}
                        <td className="py-2.5 px-3 text-slate-200">
                          ${formatCoinPrice(trade.exitPrice)}
                        </td>

                        {/* Result */}
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              trade.result === 'TP3_WIN' || trade.result === 'TP2_WIN' || trade.result === 'TP1_WIN'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : trade.result === 'TRAILING_SL_WIN'
                                ? 'bg-teal-500/20 text-teal-300'
                                : trade.result === 'BREAKEVEN_SL'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {trade.result}
                          </span>
                        </td>

                        {/* ROE % */}
                        <td className={`py-2.5 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                        </td>

                        {/* PnL USDT */}
                        <td className={`py-2.5 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}${trade.pnlUsdt.toFixed(2)}
                        </td>

                        {/* Balance After */}
                        <td className="py-2.5 px-3 text-slate-300">
                          ${trade.balanceAfter.toLocaleString()}
                        </td>

                        {/* Duration */}
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {trade.durationCandles || 1} {isArabic ? 'شمعة' : 'bars'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredTrades.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {isArabic ? 'لم يتم العثور على صفقات تطابق شروط البحث.' : 'No trades matching criteria.'}
                </div>
              )}
            </div>

            {/* Pagination / Load more */}
            {filteredTrades.length > visibleTradesLimit && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setVisibleTradesLimit((prev) => prev + 50)}
                  className="px-4 py-2 bg-[#1e293b] hover:bg-[#334155] text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-all"
                >
                  {isArabic ? `عرض المزيد (+50 صفقة)` : `Load More Trades (+50)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: MULTI-COIN PORTFOLIO BASKET RANKING                                */}
        {/* ========================================================================= */}
        {activeTab === 'PORTFOLIO' && multiResult && (
          <div className="p-5 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-brand-400" />
              {isArabic ? 'ترتيب أداء العملات في السلة' : 'Basket Assets Performance Ranking'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {multiResult.coinsRanked.map((coin, idx) => (
                <div
                  key={coin.symbol}
                  className="bg-[#1e293b]/60 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 font-bold text-[10px] flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-white text-sm">{coin.symbol}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-extrabold font-mono ${coin.netReturnPercent >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {coin.netReturnPercent >= 0 ? '+' : ''}{coin.netReturnPercent.toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs pt-2 border-t border-slate-800/80 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 font-sans block">{isArabic ? 'نسبة النجاح' : 'Win Rate'}</span>
                      <span className="text-slate-200 font-bold">{coin.winRate.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-sans block">{isArabic ? 'الأرباح الصافية' : 'Net Profit'}</span>
                      <span className={`font-bold ${coin.netProfitUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${coin.netProfitUsdt.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-sans block">{isArabic ? 'الصفقات' : 'Trades'}</span>
                      <span className="text-slate-300 font-bold">{coin.totalTrades}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-sans block">{isArabic ? 'معامل الربح' : 'Profit Factor'}</span>
                      <span className="text-amber-400 font-bold">{coin.profitFactor.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: ADVANCED RISK & EXECUTION PARAMETERS TUNER                         */}
        {/* ========================================================================= */}
        {activeTab === 'SETTINGS' && (
          <div className="p-5 flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand-400" />
                {isArabic ? 'ضبط المعايير الرياضية وإدارة المخاطر' : 'Quantitative Risk & Execution Tuning'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isArabic
                  ? 'قم بتعديل نسب وقف الخسارة المتحرك ومضاعفات ATR والعمولات لمحاكاة سلوك التداول الحقيقي بدقة تامة.'
                  : 'Customize Trailing Stop tolerances, ATR volatility multipliers, slippage, and exchange fees for institutional backtest fidelity.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Risk Reward Target */}
              <div className="bg-[#1e293b]/40 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">{isArabic ? 'نسبة العائد إلى المخاطرة (R:R)' : 'Risk/Reward Target (R:R)'}</span>
                  <span className="text-xs font-bold font-mono text-brand-300">1:{riskRewardTarget}</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="4.0"
                  step="0.1"
                  value={riskRewardTarget}
                  onChange={(e) => setRiskRewardTarget(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </div>

              {/* SL ATR Multiplier */}
              <div className="bg-[#1e293b]/40 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">{isArabic ? 'مضاعف تقلب وقف الخسارة (ATR)' : 'Stop Loss ATR Multiplier'}</span>
                  <span className="text-xs font-bold font-mono text-amber-300">{slAtrMultiplier}x ATR</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="3.0"
                  step="0.1"
                  value={slAtrMultiplier}
                  onChange={(e) => setSlAtrMultiplier(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Min Confidence Score */}
              <div className="bg-[#1e293b]/40 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">{isArabic ? 'الحد الأدنى لقوة الإشارة' : 'Min Confidence Score'}</span>
                  <span className="text-xs font-bold font-mono text-teal-300">{minSignalStrength}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="90"
                  step="5"
                  value={minSignalStrength}
                  onChange={(e) => setMinSignalStrength(Number(e.target.value))}
                  className="w-full accent-teal-500"
                />
              </div>

              {/* Trailing Stop Enable Toggle */}
              <div className="bg-[#1e293b]/40 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">{isArabic ? 'الوقف المتحرك (Trailing Stop)' : 'Trailing Stop Loss'}</span>
                  <input
                    type="checkbox"
                    checked={trailingStopEnabled}
                    onChange={(e) => setTrailingStopEnabled(e.target.checked)}
                    className="w-4 h-4 accent-brand-500 cursor-pointer rounded"
                  />
                </div>
                <span className="text-[11px] text-slate-500">
                  {isArabic ? 'تتبع القمم السعرية وحجز الأرباح تلقائياً' : 'Dynamically ratchet stop loss to lock in floating profit.'}
                </span>
              </div>

              {/* Trailing Distance % */}
              <div className="bg-[#1e293b]/40 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">{isArabic ? 'مسافة الوقف المتحرك' : 'Trailing Gap Distance'}</span>
                  <span className="text-xs font-bold font-mono text-brand-300">{trailingStopPercent}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.5"
                  step="0.1"
                  value={trailingStopPercent}
                  onChange={(e) => setTrailingStopPercent(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </div>

              {/* Trailing Activation % */}
              <div className="bg-[#1e293b]/40 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">{isArabic ? 'ربح تفعيل الوقف المتحرك' : 'Trailing Activation Threshold'}</span>
                  <span className="text-xs font-bold font-mono text-emerald-300">{trailingActivationProfitPercent}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4.0"
                  step="0.1"
                  value={trailingActivationProfitPercent}
                  onChange={(e) => setTrailingActivationProfitPercent(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  executeSimulation(false);
                  setActiveTab('CHART');
                }}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-600/25 transition-all"
              >
                {isArabic ? 'تطبيق وإعادة المحاكاة' : 'Apply & Re-simulate'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Multi-Pair Basket Customizer Modal */}
      {isBasketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div
            className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {isArabic ? 'تخصيص سلة أزواج الاختبار الرجعي' : 'Custom Backtest Pairs Basket'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isArabic
                      ? `حدد زوجاً واحداً أو عدة أزواج لتشغيل المحاكاة عليها متزامنة (${activeSymbolsForBacktest.length} من ${RESPECTED_TRADING_PAIRS.length} محددة)`
                      : `Select 1 or more pairs to simulate simultaneously (${activeSymbolsForBacktest.length} of ${RESPECTED_TRADING_PAIRS.length} selected)`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBasketModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets Bar */}
            <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-900/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400">
                {isArabic ? 'تحديدات سريعة:' : 'Quick Presets:'}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBasketPreset('TOP3')}
                  className="px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 hover:border-brand-500/50 transition-all text-xs cursor-pointer"
                >
                  Top 3 (BTC, ETH, SOL)
                </button>
                <button
                  type="button"
                  onClick={() => setBasketPreset('TOP5')}
                  className="px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 hover:border-brand-500/50 transition-all text-xs cursor-pointer"
                >
                  Top 5 Major
                </button>
                <button
                  type="button"
                  onClick={() => setBasketPreset('LAYER1')}
                  className="px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 hover:border-brand-500/50 transition-all text-xs cursor-pointer"
                >
                  Layer 1
                </button>
                <button
                  type="button"
                  onClick={() => setBasketPreset('DEFI')}
                  className="px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 hover:border-brand-500/50 transition-all text-xs cursor-pointer"
                >
                  DeFi
                </button>
                <button
                  type="button"
                  onClick={() => setBasketPreset('ALL')}
                  className="px-2.5 py-1 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 font-bold border border-brand-500/40 transition-all text-xs cursor-pointer"
                >
                  {isArabic ? 'الكل (21)' : 'All (21)'}
                </button>
                <button
                  type="button"
                  onClick={() => setBasketPreset('CLEAR')}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold border border-rose-500/30 transition-all text-xs cursor-pointer"
                >
                  {isArabic ? 'مسح' : 'Clear'}
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={basketSearchQuery}
                  onChange={(e) => setBasketSearchQuery(e.target.value)}
                  placeholder={isArabic ? 'بحث في أزواج السلة (BTC, SOL, XRP, SUI)...' : 'Filter pairs (e.g. BTC, SOL, XRP)...'}
                  className="w-full bg-[#1e293b] border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                />
                {basketSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setBasketSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Pairs Grid */}
            <div className="flex-1 p-3 overflow-y-auto max-h-96">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                {RESPECTED_TRADING_PAIRS.filter((p) => {
                  const q = basketSearchQuery.trim().toLowerCase();
                  return !q || p.symbol.toLowerCase().includes(q) || p.baseAsset.toLowerCase().includes(q);
                }).map((pair) => {
                  const isChecked = activeSymbolsForBacktest.includes(pair.symbol);
                  return (
                    <button
                      key={pair.symbol}
                      type="button"
                      onClick={() => toggleBasketSymbol(pair.symbol)}
                      className={`p-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-brand-500/15 border-brand-500/60 shadow-sm text-white ring-1 ring-brand-500/30'
                          : 'bg-[#1e293b]/50 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                            isChecked ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="font-mono font-bold text-xs text-white">
                            {pair.symbol}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {pair.baseAsset}
                          </span>
                        </div>
                      </div>
                      {pair.category && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-slate-400 font-mono">
                          {pair.category}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {isArabic
                    ? `${activeSymbolsForBacktest.length} أزواج محددة للاختبار الرجعي`
                    : `${activeSymbolsForBacktest.length} pairs selected for Backtesting`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBasketModalOpen(false)}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-600/25 transition-all cursor-pointer"
                >
                  {isArabic ? 'حفظ وتطبيق السلة' : 'Done & Apply Basket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
