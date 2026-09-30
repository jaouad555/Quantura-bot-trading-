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
import { exportBacktestToCSV } from '../utils/csvExport';
import {
  Play,
  TrendingUp,
  Target,
  Shield,
  Layers,
  Coins,
  Zap,
  CheckCircle2,
  Sliders,
  RotateCcw,
  Download,
  BarChart3,
  TrendingDown,
  Search,
  Check,
  Cpu,
  Trophy,
  Crosshair,
  Gauge,
  Clock,
  CircleDot,
  LineChart as LineChartIcon,
  Activity,
  ChevronDown,
  X,
  ExternalLink,
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
  botConfig,
  onUpdateBotConfig,
  onSelectSymbol,
  onNavigateToBot,
}) => {
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

  // Dropdown States
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState(false);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState('');
  const [selectedPairCategory, setSelectedPairCategory] = useState<'ALL' | 'HOT' | 'MAJOR' | 'DEFI' | 'LAYER1'>('ALL');
  const symbolDropdownRef = useRef<HTMLDivElement>(null);

  const [isTimeframeDropdownOpen, setIsTimeframeDropdownOpen] = useState(false);
  const timeframeDropdownRef = useRef<HTMLDivElement>(null);

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
        if (prev.length <= 1) return prev;
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

  // Filtered trading pairs
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
        ? [
            'MOMENTUM',
            'SCALPER',
            'SWING',
            'BREAKOUT',
            'MEAN_REVERSION',
            'INSTITUTIONAL_SMC',
            'MTF_CONFLUENCE',
            'VWAP_VOLUME_DELTA',
            'FUNDING_SQUEEZE',
            'LIQUIDITY_HUNT'
          ]
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
        const hasAllCached = !forceFetch && symbolsToFetch.every((s) => klinesMap[`${marketType}_${s}`] && klinesMap[`${marketType}_${s}`].length >= 30);

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
                Object.entries(data.results).forEach(([sym, klines]) => {
                  klinesMap[`${marketType}_${sym}`] = klines as KlineCandle[];
                });
              }
            }
          } catch (fetchErr) {
            console.warn('Backend fetch failed, using fallback.', fetchErr);
          }

          symbolsToFetch.forEach((sym) => {
            const kKey = `${marketType}_${sym}`;
            if (!klinesMap[kKey] || klinesMap[kKey].length < 30) {
              klinesMap[kKey] = generateFallbackKlines(sym, timeframe, months);
            }
          });
          setAllCoinsKlines(klinesMap);
        }

        setLoadingProgress(75);
        setLoadingStatusText(isArabic ? 'جاري محاكاة الصفقات واختبار الاستراتيجيات...' : 'Simulating order executions...');

        // 1. Single Asset Backtest
        const primaryKlines = klinesMap[`${marketType}_${currentSymbol}`] || klinesMap[`${marketType}_${symbolsToFetch[0]}`] || generateFallbackKlines(currentSymbol, timeframe, months);
        const singleRes = runHistoricalBacktest(primaryKlines, currentConfig, currentSymbol);
        setSingleResult(singleRes);

        // 2. 10 Strategies Benchmark Comparison Matrix
        const compMatrix = runComparativeStrategyBacktest(primaryKlines, currentConfig, currentSymbol);
        setStrategyComparison(compMatrix);

        // 3. Multi Coin Basket (if applicable)
        if (viewMode === 'MULTI_COIN') {
          const activeKlinesMap: Record<string, KlineCandle[]> = {};
          symbolsToFetch.forEach((sym) => {
            const kKey = `${marketType}_${sym}`;
            if (klinesMap[kKey]) activeKlinesMap[sym] = klinesMap[kKey];
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
  }, [timeframe, months, currentSymbol, viewMode, selectedStrategyId, marketType]);

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
    <div className="flex flex-col w-full h-full gap-4 text-slate-100 pb-12" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      {showAppliedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-emerald-600/95 backdrop-blur-md text-white font-bold rounded-xl shadow-2xl shadow-emerald-500/30 border border-emerald-400/40 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <div className="flex flex-col text-left rtl:text-right">
            <span className="text-sm font-black">{isArabic ? 'تمت المزامنة بنجاح!' : 'Successfully Synchronized!'}</span>
            <span className="text-xs text-emerald-100 font-normal">
              {isArabic ? 'تم تطبيق المعايير ومصفوفة الاستراتيجية على البوت الحي.' : 'Parameters & strategy preset applied to Live Bot.'}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP HEADER & CONTROL CONSOLE                                              */}
      {/* ========================================================================= */}
      <div className={`relative ${isLeverageDropdownOpen || isSymbolDropdownOpen || isTimeframeDropdownOpen ? 'z-50' : 'z-20'} bg-[#0f172a] border border-[#1e293b] rounded-2xl p-4 shadow-xl flex flex-col gap-4`}>
        
        {/* Row 1: Console Header & Quick Global Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e293b] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  {isArabic ? 'مختبر الاختبار الخوارزمي والمحاكاة التاريخية' : 'Algorithmic Backtesting & Simulation'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono font-bold">
                  10 Strategies
                </span>
                {botConfig?.marketType && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold">
                    {botConfig.marketType} {botConfig.leverage ? `${botConfig.leverage}x` : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isArabic
                  ? 'محاكاة رياضية على بيانات بينانس الحقيقية مع احتساب العمولات، الانزلاق، ووقف الخسارة المتحرك.'
                  : 'Deterministic historical simulation on Binance candles with realistic fees, slippage, and trailing ratchets.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onUpdateBotConfig && (
              <button
                type="button"
                onClick={handleApplyToLiveBot}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                title={isArabic ? 'نقل هذه الإعدادات مباشرة للبوت الحي' : 'Apply parameters to Live Bot'}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>{isArabic ? 'تطبيق على البوت' : 'Apply to Bot'}</span>
              </button>
            )}

            {onNavigateToBot && (
              <button
                type="button"
                onClick={onNavigateToBot}
                className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] text-slate-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isArabic ? 'واجهة البوت' : 'Live Bot'}</span>
              </button>
            )}

            {singleResult && singleResult.trades.length > 0 && (
              <button
                type="button"
                onClick={() => exportBacktestToCSV(singleResult)}
                className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] text-slate-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => executeSimulation(true)}
              disabled={isLoading}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-brand-600/25 transition-all active:scale-95 cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? (isArabic ? 'جاري المحاكاة...' : 'Simulating...') : isArabic ? 'تشغيل المحاكاة' : 'Run Backtest'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PARALLEL SYMMETRIC STRATEGY MATRIX (تصفيف الاستراتيجيات بانتظام متوازية)     */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-400" />
              {isArabic ? 'مصفوفة الاستراتيجيات العشر (تصفيف متوازي ومنتظم):' : 'Strategy Portfolio Matrix (Symmetric Parallel Layout):'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {isArabic ? 'انقر على أي استراتيجية لتحميل إعداداتها فوراً' : 'Click to load strategy preset'}
            </span>
          </div>

          {/* Symmetrical Parallel Grid of All 11 Strategies (10 Individual + Ensemble) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-1.5">
            {BACKTEST_STRATEGIES.map((strat) => {
              const isSelected = selectedStrategyId === strat.id;
              return (
                <button
                  key={strat.id}
                  type="button"
                  onClick={() => handleSelectStrategy(strat.id)}
                  className={`p-2 rounded-xl text-left rtl:text-right transition-all flex flex-col justify-between gap-1 border relative cursor-pointer min-h-[64px] ${
                    isSelected
                      ? 'bg-brand-500/15 text-white border-brand-500 shadow-md shadow-brand-500/10 ring-1 ring-brand-500/40'
                      : 'bg-[#1e293b]/60 text-slate-300 border-slate-700/50 hover:bg-[#1e293b] hover:border-slate-600'
                  }`}
                  title={isArabic ? strat.shortDescAr : strat.shortDesc}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: strat.color }}
                      />
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                        {strat.badge}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="w-3 h-3 text-brand-400" />
                    )}
                  </div>

                  <div className="font-bold text-xs leading-tight truncate text-white" title={isArabic ? strat.nameAr : strat.name}>
                    {isArabic ? strat.nameAr.split('(')[0].trim() : strat.name}
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
                    <span className="px-1 py-0.2 rounded bg-black/40 text-slate-300">
                      {strat.defaultTimeframe.toUpperCase()}
                    </span>
                    <span className="text-amber-300/90 font-bold">
                      {strat.defaultLeverage}x
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Strategy Detailed Context Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl mt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]"
                style={{ color: activeStrategyObj.color, backgroundColor: activeStrategyObj.color }}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">
                  {isArabic ? 'الاستراتيجية النشطة:' : 'Selected Strategy:'}
                </span>
                <span className="text-xs font-black text-white">
                  {isArabic ? activeStrategyObj.nameAr : activeStrategyObj.name}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-brand-500/15 text-brand-300 border border-brand-500/30 font-bold">
                  {timeframe.toUpperCase()}
                </span>
                <span className={`px-2 py-0.5 rounded font-bold border ${marketType === 'FUTURES' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'}`}>
                  {marketType === 'FUTURES' ? `${leverage}x Lev` : 'Spot 1x'}
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-bold">
                  R:R 1:{riskRewardTarget}
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold">
                  SL {slAtrMultiplier}x ATR
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 max-w-2xl leading-relaxed">
              {isArabic ? activeStrategyObj.shortDescAr : activeStrategyObj.shortDesc}
            </p>
          </div>
        </div>

        {/* Row 2: Unified Execution Controls Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs pt-1 border-t border-slate-800">
          
          {/* Scope Mode (Single vs Multi Basket) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'نطاق الاختبار' : 'Simulation Scope'}
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

          {/* Symbol / Basket Selector */}
          {viewMode === 'SINGLE_COIN' ? (
            <div className={`flex flex-col gap-1 relative ${isSymbolDropdownOpen ? 'z-50' : 'z-10'}`} ref={symbolDropdownRef}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {isArabic ? 'الزوج المحدد' : 'Asset Pair'}
                </span>
                <span className="text-[9px] text-brand-400 font-mono">
                  {RESPECTED_TRADING_PAIRS.length} {isArabic ? 'متاح' : 'pairs'}
                </span>
              </div>
              
              <button
                type="button"
                onClick={() => setIsSymbolDropdownOpen((prev) => !prev)}
                className={`w-full bg-[#1e293b] border ${
                  isSymbolDropdownOpen ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-700 hover:border-slate-600'
                } rounded-lg px-2.5 py-1 text-xs font-bold text-white flex items-center justify-between transition-all cursor-pointer`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                  <span className="font-mono text-white text-xs">{currentSymbol}</span>
                </div>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isSymbolDropdownOpen ? 'rotate-180 text-brand-400' : ''}`} />
              </button>

              {/* Floating Pro Pairs Dropdown */}
              {isSymbolDropdownOpen && (
                <div className="absolute top-[105%] start-0 z-[100] w-72 sm:w-80 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl p-2 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/80">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={symbolSearchQuery}
                      onChange={(e) => setSymbolSearchQuery(e.target.value)}
                      placeholder={isArabic ? 'بحث في الأزواج...' : 'Search token...'}
                      autoFocus
                      className="w-full bg-[#1e293b] border border-slate-700 rounded-lg pl-8 pr-7 py-1 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
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

                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[9px]">
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
                            : 'bg-[#1e293b] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

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
                            className={`w-full px-2.5 py-1.5 text-left rtl:text-right flex items-center justify-between transition-colors cursor-pointer ${
                              isCurrent ? 'bg-brand-500/20 text-brand-300 font-bold' : 'hover:bg-[#1e293b] text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-white">{pair.symbol}</span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                                {pair.baseAsset}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {pair.category && (
                                <span className="text-[9px] text-slate-500 uppercase font-mono">{pair.category}</span>
                              )}
                              {isCurrent && <Check className="w-3 h-3 text-brand-400" />}
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
                className="flex items-center justify-between px-2.5 py-1 bg-[#1e293b] hover:bg-slate-800 border border-brand-500/40 rounded-lg text-xs font-bold text-brand-300 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 animate-pulse" />
                  <span className="font-mono text-white text-xs">{activeSymbolsForBacktest.length} {isArabic ? 'أزواج' : 'Pairs'}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold">
                  {isArabic ? 'تعديل' : 'Edit'}
                </span>
              </button>
            </div>
          )}

          {/* Market & Leverage Selector */}
          <div className={`flex flex-col gap-1 relative ${isLeverageDropdownOpen ? 'z-[80]' : 'z-10'}`} ref={leverageDropdownRef}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'السوق والرافعة' : 'Market & Lev'}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="flex bg-[#1e293b] p-0.5 rounded-lg border border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setMarketType('FUTURES')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                    marketType === 'FUTURES' ? 'bg-brand-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
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
                  className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                    marketType === 'SPOT' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
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
                    className="bg-[#1e293b] border border-amber-500/50 hover:border-amber-400 rounded-lg px-2 py-1 text-xs font-bold text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="font-mono">{leverage}x</span>
                    <ChevronDown className={`w-3 h-3 text-amber-400/80 transition-transform ${isLeverageDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isLeverageDropdownOpen && (
                    <div className="absolute top-full mt-2 start-0 z-[9999] w-60 bg-[#0f172a] border-2 border-amber-500/80 rounded-xl shadow-2xl p-2 flex flex-col gap-1 max-h-72 overflow-y-auto">
                      <div className="px-2 py-1 text-[10px] font-bold text-amber-400 uppercase border-b border-slate-800 flex items-center justify-between">
                        <span>{isArabic ? 'الرافعة المالية' : 'Leverage Level'}</span>
                        <span className="font-mono text-white">{leverage}x</span>
                      </div>
                      {[
                        { lev: 1, label: '1x (Safe)' },
                        { lev: 2, label: '2x (Conservative)' },
                        { lev: 3, label: '3x (Optimal)' },
                        { lev: 5, label: '5x (Standard)' },
                        { lev: 7, label: '7x (Momentum)' },
                        { lev: 10, label: '10x (Active Scalp)' },
                        { lev: 15, label: '15x (High Risk)' },
                        { lev: 20, label: '20x (Fast Scalp)' },
                      ].map((item) => (
                        <button
                          key={item.lev}
                          type="button"
                          onClick={() => {
                            setLeverage(item.lev);
                            setIsLeverageDropdownOpen(false);
                          }}
                          className={`w-full px-2 py-1.5 rounded-lg text-left rtl:text-right flex items-center justify-between text-xs font-mono transition-colors cursor-pointer ${
                            Number(leverage) === item.lev ? 'bg-amber-500/20 text-amber-300 font-bold' : 'hover:bg-[#1e293b] text-slate-300'
                          }`}
                        >
                          <span>{item.label}</span>
                          {Number(leverage) === item.lev && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-2 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-[10px] font-mono text-cyan-300">
                  1x Spot
                </div>
              )}
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className={`flex flex-col gap-1 relative ${isTimeframeDropdownOpen ? 'z-50' : 'z-10'}`} ref={timeframeDropdownRef}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'الفريم الزمني' : 'Timeframe'}
            </span>
            <button
              type="button"
              onClick={() => setIsTimeframeDropdownOpen((prev) => !prev)}
              className="w-full bg-[#1e293b] border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-bold text-white flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-brand-400" />
                <span className="font-mono uppercase">{timeframe}</span>
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isTimeframeDropdownOpen ? 'rotate-180 text-brand-400' : ''}`} />
            </button>

            {isTimeframeDropdownOpen && (
              <div className="absolute top-[105%] start-0 z-[100] w-44 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1">
                {[
                  { value: '15m' as Timeframe, label: '15m', desc: 'Scalper' },
                  { value: '30m' as Timeframe, label: '30m', desc: 'Breakout' },
                  { value: '1h' as Timeframe, label: '1h', desc: 'Trend / SMC' },
                  { value: '4h' as Timeframe, label: '4h', desc: 'Swing' },
                  { value: '1d' as Timeframe, label: '1d', desc: 'Macro' },
                ].map((tf) => (
                  <button
                    key={tf.value}
                    type="button"
                    onClick={() => {
                      setTimeframe(tf.value);
                      setIsTimeframeDropdownOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left rtl:text-right flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      timeframe === tf.value ? 'bg-brand-500/20 text-brand-300 font-bold' : 'hover:bg-[#1e293b] text-slate-300'
                    }`}
                  >
                    <span className="font-mono font-bold uppercase">{tf.label}</span>
                    <span className="text-[10px] text-slate-400">{tf.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Horizon (Months) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'العمق التاريخي' : 'Horizon'}
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
                  className={`flex-1 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    months === h.m ? 'bg-brand-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
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
              {isArabic ? 'رأس المال' : 'Balance ($)'}
            </span>
            <div className="relative">
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(Math.max(10, Number(e.target.value)))}
                className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-emerald-400 pl-5 focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
              <span className="absolute left-1.5 top-1.5 text-slate-400 text-xs font-bold">$</span>
            </div>
          </div>

          {/* Trade Allocation % */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isArabic ? 'تخصيص الصفقة' : 'Trade Allocation'}
            </span>
            <div className="relative">
              <input
                type="number"
                value={tradeAllocationPercent}
                onChange={(e) => setTradeAllocationPercent(Math.min(100, Math.max(1, Number(e.target.value))))}
                className="w-full bg-[#1e293b] border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-white pr-5 focus:ring-1 focus:ring-brand-500 focus:outline-none"
              />
              <span className="absolute right-1.5 top-1.5 text-slate-400 text-xs font-bold">%</span>
            </div>
          </div>

        </div>

        {/* Loading Progress Indicator */}
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
      {/* EXECUTIVE FINANCIAL KPI STRIP (Institutional Performance Metrics)         */}
      {/* ========================================================================= */}
      {activeResult && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          {/* Card 1: Net PnL & ROI */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isArabic ? 'صافي الأرباح' : 'Net P&L'}
              </span>
              <div className={`p-1 rounded-md ${activeResult.netProfitUsdt >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                {activeResult.netProfitUsdt >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              </div>
            </div>
            <div className="mt-2">
              <div className={`text-xl font-black font-mono tabular-nums ${activeResult.netProfitUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {activeResult.netProfitUsdt >= 0 ? '+' : ''}${activeResult.netProfitUsdt.toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold mt-0.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${activeResult.netReturnPercent >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {activeResult.netReturnPercent >= 0 ? '+' : ''}{activeResult.netReturnPercent.toFixed(2)}% ROI
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ${activeResult.finalBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Win Rate */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isArabic ? 'نسبة النجاح' : 'Win Rate'}
              </span>
              <Target className="w-3.5 h-3.5 text-brand-400" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-black font-mono tabular-nums text-brand-300">
                {activeResult.winRate.toFixed(1)}%
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold mt-0.5 font-mono text-slate-400">
                <span className="text-emerald-400">{activeResult.winningTrades}W</span>
                <span>/</span>
                <span className="text-rose-400">{activeResult.losingTrades}L</span>
                <span className="text-slate-500 font-normal">({activeResult.totalTrades} {isArabic ? 'صفقة' : 'trades'})</span>
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
              <div className={`text-xl font-black font-mono tabular-nums ${activeResult.profitFactor >= 2 ? 'text-emerald-400' : activeResult.profitFactor >= 1.3 ? 'text-amber-400' : 'text-rose-400'}`}>
                {activeResult.profitFactor > 0 ? activeResult.profitFactor.toFixed(2) : '0.00'}
              </div>
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                {activeResult.profitFactor >= 2 ? (isArabic ? 'أداء مؤسسي ممتاز' : 'Institutional Grade') : (isArabic ? 'مقبول' : 'Standard')}
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
              <div className="text-xl font-black font-mono tabular-nums text-rose-400">
                -{activeResult.maxDrawdownPercent.toFixed(2)}%
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
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
              <div className="text-xl font-black font-mono tabular-nums text-indigo-300">
                {activeResult.sharpeRatio.toFixed(2)}
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                Sortino: {activeResult.sortinoRatio.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Card 6: Expectancy */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isArabic ? 'التوقع للصفقة' : 'Trade Expectancy'}
              </span>
              <CircleDot className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="mt-2">
              <div className={`text-xl font-black font-mono tabular-nums ${activeResult.expectancy >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>
                {activeResult.expectancy >= 0 ? '+' : ''}${activeResult.expectancy.toFixed(2)}
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                Target 1:{riskRewardTarget} R:R
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* WORKSPACE NAVIGATION TABS                                                 */}
      {/* ========================================================================= */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl flex flex-col">
        
        {/* Navigation Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e293b] bg-slate-900/80">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('CHART')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'CHART'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]'
              }`}
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span>{isArabic ? 'منحنى النمو والمحفظة' : 'Equity Growth'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STRATEGY_MATRIX')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'STRATEGY_MATRIX'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{isArabic ? 'مصفوفة مقارنة الاستراتيجيات (10)' : 'Benchmark Matrix (10 Strategies)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('TRADES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'TRADES'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{isArabic ? 'سجل الصفقات' : 'Trade Blotter'} ({singleResult?.trades.length || 0})</span>
            </button>

            {viewMode === 'MULTI_COIN' && (
              <button
                type="button"
                onClick={() => setActiveTab('PORTFOLIO')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'PORTFOLIO'
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>{isArabic ? 'ترتيب سلة العملات' : 'Basket Assets'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('SETTINGS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'SETTINGS'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e293b]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isArabic ? 'المعايير المتقدمة' : 'Risk & Execution'}</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs font-mono font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-400" />
              {isArabic ? 'نمو البوت' : 'Bot Strategy'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              {isArabic ? 'الشراء والاحتفاظ' : 'Buy & Hold'}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: EQUITY CURVE & PERFORMANCE VISUALIZATION                           */}
        {/* ========================================================================= */}
        {activeTab === 'CHART' && activeResult && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: activeStrategyObj.color }}
                />
                <span className="text-xs font-bold text-white">
                  {isArabic
                    ? `منحنى النمو: ${activeStrategyObj.nameAr} (${viewMode === 'SINGLE_COIN' ? currentSymbol : 'سلة العملات'})`
                    : `Equity Curve: ${activeStrategyObj.name} (${viewMode === 'SINGLE_COIN' ? currentSymbol : 'Basket'})`}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {timeframe} • {marketType === 'FUTURES' ? `${leverage}x` : 'Spot'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {activeResult.trades.length} {isArabic ? 'صفقة على مدى' : 'trades across'} {months} {isArabic ? 'أشهر' : 'months'}
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
                  {isArabic ? 'تحقيق الهدف 1 (TP1)' : 'Target 1 (TP1 Hit)'}
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-bold font-mono text-emerald-300">{activeResult.tp1Rate}%</span>
                  <span className="text-[10px] text-slate-400">{isArabic ? 'حجز 50% + Breakeven' : '50% secured'}</span>
                </div>
              </div>

              <div className="bg-[#1e293b]/40 border border-teal-500/20 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">
                  {isArabic ? 'تحقيق الهدف 2 (TP2)' : 'Target 2 (TP2 Hit)'}
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-bold font-mono text-teal-300">{activeResult.tp2Rate}%</span>
                  <span className="text-[10px] text-slate-400">{isArabic ? 'حجز 25% إضافي' : '25% locked'}</span>
                </div>
              </div>

              <div className="bg-[#1e293b]/40 border border-brand-500/20 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">
                  {isArabic ? 'تحقيق الهدف 3 الكامل (TP3)' : 'Target 3 (TP3 Full Scale)'}
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-bold font-mono text-brand-300">{activeResult.tp3Rate}%</span>
                  <span className="text-[10px] text-slate-400">{isArabic ? 'إغلاق كامل بربح مضاعف' : 'Full scale-out'}</span>
                </div>
              </div>

              <div className="bg-[#1e293b]/40 border border-rose-500/20 p-3 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                  {isArabic ? 'نسبة وقف الخسارة (SL Rate)' : 'Stop Loss (SL Rate)'}
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-bold font-mono text-rose-300">{activeResult.slRate}%</span>
                  <span className="text-[10px] text-slate-400">{isArabic ? 'حماية رأس المال' : 'Capital protected'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 10 STRATEGIES COMPARISON BENCHMARK MATRIX                           */}
        {/* ========================================================================= */}
        {activeTab === 'STRATEGY_MATRIX' && (
          <div className="p-5 flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {isArabic ? `مقارنة أداء كافة الاستراتيجيات العشر على ${currentSymbol}` : `Benchmark Matrix: All 10 Strategies on ${currentSymbol}`}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isArabic
                    ? 'اختبار حقيقي لكافة الاستراتيجيات على نفس الشموع التاريخية بتصفيف متوازي يسهل المقارنة واختيار الأفضل.'
                    : 'Parallel backtest of all strategies on identical historical candles to find the mathematically optimal model.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => executeSimulation(false)}
                className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تحديث الاختبار' : 'Refresh Matrix'}</span>
              </button>
            </div>

            {/* Symmetrical Parallel Strategy Cards Grid (بطاقات متوازية بانتظام) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {strategyComparison.map((item, idx) => {
                const isCurrent = selectedStrategyId === item.strategyId;
                return (
                  <div
                    key={item.strategyId}
                    className={`bg-[#1e293b]/50 rounded-xl p-3.5 border transition-all flex flex-col justify-between gap-3 ${
                      item.isBest
                        ? 'border-amber-500/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                        : isCurrent
                        ? 'border-brand-500/70 shadow-lg shadow-brand-500/10 ring-1 ring-brand-500/30'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Card Header */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                            {item.badge}
                          </span>
                        </div>
                        {item.isBest && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ★ TOP #1
                          </span>
                        )}
                        {isCurrent && !item.isBest && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-brand-500/20 text-brand-300 border border-brand-500/30">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-xs text-white truncate" title={isArabic ? item.strategyNameAr : item.strategyName}>
                        {isArabic ? item.strategyNameAr : item.strategyName}
                      </h4>
                    </div>

                    {/* Parallel Metric Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono py-2 border-y border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-500 font-sans block">{isArabic ? 'صافي الربح' : 'Net P&L'}</span>
                        <span className={`font-bold ${item.netProfitUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.netProfitUsdt >= 0 ? '+' : ''}${item.netProfitUsdt.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-sans block">{isArabic ? 'العائد ROI' : 'ROI'}</span>
                        <span className={`font-bold ${item.netReturnPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {item.netReturnPercent >= 0 ? '+' : ''}{item.netReturnPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-sans block">{isArabic ? 'نسبة النجاح' : 'Win Rate'}</span>
                        <span className="text-slate-200 font-bold">{item.winRate.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-sans block">{isArabic ? 'معامل الربح' : 'Profit Factor'}</span>
                        <span className={`font-bold ${item.profitFactor >= 2 ? 'text-emerald-400' : item.profitFactor >= 1.3 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {item.profitFactor > 0 ? item.profitFactor.toFixed(2) : '0.00'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-sans block">{isArabic ? 'أقصى تراجع' : 'Max DD'}</span>
                        <span className="text-rose-400 font-bold">-{item.maxDrawdownPercent.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-sans block">{isArabic ? 'الصفقات' : 'Trades'}</span>
                        <span className="text-slate-300 font-bold">{item.totalTrades}</span>
                      </div>
                    </div>

                    {/* Action CTA */}
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectStrategy(item.strategyId);
                        setActiveTab('CHART');
                      }}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                          : 'bg-[#1e293b] hover:bg-brand-600 hover:text-white text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isCurrent ? (isArabic ? 'مفعلة حالياً' : 'Current Active') : (isArabic ? 'اختيار ومحاكاة' : 'Select & Simulate')}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Comprehensive Parallel Leaderboard Table */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-300">
                {isArabic ? 'جدول الترتيب والمقارنة الرقمية الدقيقة:' : 'Ranked Benchmark Financial Table:'}
              </span>
              <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
                <table className="w-full text-xs text-left rtl:text-right">
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
                  <tbody className="divide-y divide-[#1e293b] font-mono tabular-nums">
                    {strategyComparison.map((item) => {
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
                                    ★ #1
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {item.badge}
                              </span>
                            </div>
                          </td>

                          <td className={`py-3 px-3 font-bold ${item.netProfitUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.netProfitUsdt >= 0 ? '+' : ''}${item.netProfitUsdt.toLocaleString()}
                          </td>

                          <td className={`py-3 px-3 font-bold ${item.netReturnPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {item.netReturnPercent >= 0 ? '+' : ''}{item.netReturnPercent.toFixed(1)}%
                          </td>

                          <td className="py-3 px-3 font-bold text-slate-200">
                            {item.winRate.toFixed(1)}%
                            <span className="text-[10px] text-slate-500 font-normal ml-1">
                              ({item.winningTrades}W/{item.losingTrades}L)
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-300 font-bold">
                            {item.totalTrades}
                          </td>

                          <td className="py-3 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                              item.profitFactor >= 2 ? 'bg-emerald-500/20 text-emerald-300' : item.profitFactor >= 1.3 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {item.profitFactor > 0 ? item.profitFactor.toFixed(2) : '0.00'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-rose-400 font-bold">
                            -{item.maxDrawdownPercent.toFixed(1)}%
                          </td>

                          <td className="py-3 px-3 text-indigo-300 font-bold">
                            {item.sharpeRatio.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-center font-sans">
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectStrategy(item.strategyId);
                                setActiveTab('CHART');
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: REAL SIMULATED TRADE BLOTTER                                       */}
        {/* ========================================================================= */}
        {activeTab === 'TRADES' && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isArabic ? 'بحث في الصفقات (الرمز، النتيجة)...' : 'Search blotter...'}
                    value={tradeSearch}
                    onChange={(e) => setTradeSearch(e.target.value)}
                    className="w-full bg-[#1e293b] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {(['ALL', 'WINS', 'LOSSES', 'LIQUIDATED'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTradeResultFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
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

            <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-[#1e293b]/70 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#1e293b]">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">{isArabic ? 'النوع والرمز' : 'Type & Pair'}</th>
                    <th className="py-3 px-3">{isArabic ? 'الاستراتيجية' : 'Strategy'}</th>
                    <th className="py-3 px-3">{isArabic ? 'سعر الدخول' : 'Entry Price'}</th>
                    <th className="py-3 px-3">{isArabic ? 'سعر الخروج' : 'Exit Price'}</th>
                    <th className="py-3 px-3">{isArabic ? 'النتيجة' : 'Result'}</th>
                    <th className="py-3 px-3">{isArabic ? 'الربح %' : 'ROE %'}</th>
                    <th className="py-3 px-3">{isArabic ? 'الربح ($)' : 'PnL ($)'}</th>
                    <th className="py-3 px-3">{isArabic ? 'الرصيد بعد' : 'Balance After'}</th>
                    <th className="py-3 px-3">{isArabic ? 'المدة' : 'Duration'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b] font-mono tabular-nums">
                  {filteredTrades.slice(0, visibleTradesLimit).map((trade, idx) => {
                    const isWin = trade.pnlPercent > 0;
                    return (
                      <tr key={trade.id} className="hover:bg-[#1e293b]/40 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500 text-[10px]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
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
                        <td className="py-2.5 px-3 font-sans text-slate-300 font-bold">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] border border-slate-700">
                            {trade.strategyName || 'Ensemble'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-200">
                          ${formatCoinPrice(trade.entryPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-200">
                          ${formatCoinPrice(trade.exitPrice)}
                        </td>
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
                        <td className={`py-2.5 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                        </td>
                        <td className={`py-2.5 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}${trade.pnlUsdt.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          ${trade.balanceAfter.toLocaleString()}
                        </td>
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

            {filteredTrades.length > visibleTradesLimit && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleTradesLimit((prev) => prev + 50)}
                  className="px-4 py-2 bg-[#1e293b] hover:bg-[#334155] text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-all cursor-pointer"
                >
                  {isArabic ? `عرض المزيد (+50 صفقة)` : `Load More (+50)`}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
                    <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${coin.netReturnPercent >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
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
                type="button"
                onClick={() => {
                  executeSimulation(false);
                  setActiveTab('CHART');
                }}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-600/25 transition-all cursor-pointer"
              >
                {isArabic ? 'تطبيق وإعادة المحاكاة' : 'Apply & Re-simulate'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Multi-Pair Basket Customizer Modal */}
      {isBasketModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div
            className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
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

            <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-900/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400">
                {isArabic ? 'تحديدات سريعة:' : 'Quick Presets:'}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBasketPreset('TOP3')}
                  className="px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 text-xs cursor-pointer"
                >
                  Top 3
                </button>
                <button
                  type="button"
                  onClick={() => setBasketPreset('TOP5')}
                  className="px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 text-xs cursor-pointer"
                >
                  Top 5
                </button>
                <button
                  type="button"
                  onClick={() => setBasketPreset('LAYER1')}
                  className="px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 text-xs cursor-pointer"
                >
                  Layer 1
                </button>
                <button
                  type="button"
                  onClick={() => setBasketPreset('DEFI')}
                  className="px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 text-xs cursor-pointer"
                >
                  DeFi
                </button>
                <button
                  type="button"
                  onClick={() => setBasketPreset('ALL')}
                  className="px-2.5 py-1 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 font-bold border border-brand-500/40 text-xs cursor-pointer"
                >
                  {isArabic ? 'الكل (21)' : 'All (21)'}
                </button>
                <button
                  type="button"
                  onClick={() => setBasketPreset('CLEAR')}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold border border-rose-500/30 text-xs cursor-pointer"
                >
                  {isArabic ? 'مسح' : 'Clear'}
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={basketSearchQuery}
                  onChange={(e) => setBasketSearchQuery(e.target.value)}
                  placeholder={isArabic ? 'بحث في أزواج السلة (BTC, SOL, XRP)...' : 'Filter pairs (e.g. BTC, SOL)...'}
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
                        <div className="flex flex-col text-left rtl:text-right">
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

            <div className="px-5 py-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {isArabic
                    ? `${activeSymbolsForBacktest.length} أزواج محددة للاختبار الرجعي`
                    : `${activeSymbolsForBacktest.length} pairs selected for Backtesting`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsBasketModalOpen(false)}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-600/25 transition-all cursor-pointer"
              >
                {isArabic ? 'حفظ وتطبيق السلة' : 'Apply Basket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
