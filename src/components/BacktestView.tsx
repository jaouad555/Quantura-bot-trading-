import { apiStorage } from "../utils/apiStorage";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
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
} from '../types';
import { runHistoricalBacktest, runMultiCoinBacktest, generateFallbackKlines } from '../utils/backtestEngine';
import { RESPECTED_TRADING_PAIRS, formatCoinPrice } from '../utils/tradingPairs';
import { translations } from '../utils/translations';
import { formatDateTime } from '../utils/timezone';
import {
  Play,
  TrendingUp,
  Target,
  Shield,
  Layers,
  Coins,
  Calendar,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Activity,
  Settings2,
  ListFilter,
  Bot,
  Sparkles,
  Zap,
  CheckCircle2,
  Sliders,
  Flame,
  ArrowRight,
  RotateCcw,
  Download,
} from 'lucide-react';

import { exportBacktestToCSV } from '../utils/csvExport';

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
  activeTimeframe = '1d',
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
    } catch(e) {}
    return null;
  }, []);

  const [viewMode, setViewMode] = useState<'MULTI_COIN' | 'SINGLE_COIN'>(savedState?.viewMode || 'MULTI_COIN');
  const [activeSingleSymbol, setActiveSingleSymbol] = useState<string>(savedState?.activeSingleSymbol || symbol || 'BTCUSDT');

  // Sync symbol from props
  useEffect(() => {
    if (symbol && symbol !== activeSingleSymbol) {
      setActiveSingleSymbol(symbol);
    }
  }, [symbol]);

  const currentSymbol = activeSingleSymbol || 'BTCUSDT';

  // Strategy Presets
  const [selectedPreset, setSelectedPreset] = useState<'FUTURES_MOMENTUM' | 'FUTURES_SCALPER' | 'CONSERVATIVE_TREND' | 'SPOT_MOMENTUM' | 'SPOT_SCALPER' | 'SPOT_SWING' | 'CUSTOM'>(savedState?.selectedPreset || 'FUTURES_MOMENTUM');

  // Backtest parameters (initialized to best Futures Strategy: Trend-Momentum Multi-Tier Scaling)
  const [months, setMonths] = useState<number>(savedState?.months ?? 6);
  const [initialBalance, setInitialBalance] = useState<number>(savedState?.initialBalance ?? 1000);
  const [balanceInputText, setBalanceInputText] = useState<string>(savedState?.balanceInputText ?? '1000');
  const [leverage, setLeverage] = useState<number | ''>(savedState?.leverage ?? 3);
  const [timeframe, setTimeframe] = useState<Timeframe>(savedState?.timeframe || '1h');
  const [riskRewardTarget, setRiskRewardTarget] = useState<number | ''>(savedState?.riskRewardTarget ?? 2.0);
  const [minSignalStrength, setMinSignalStrength] = useState<number | ''>(savedState?.minSignalStrength ?? 65);
  const [slAtrMultiplier, setSlAtrMultiplier] = useState<number | ''>(savedState?.slAtrMultiplier ?? 1.5);
  const [tradeAllocationPercent, setTradeAllocationPercent] = useState<number | ''>(savedState?.tradeAllocationPercent ?? 20);
  const [marketType, setMarketType] = useState<'SPOT' | 'FUTURES'>(savedState?.marketType || 'FUTURES');
  const [trailingStopEnabled, setTrailingStopEnabled] = useState<boolean>(savedState?.trailingStopEnabled ?? true);
  const [trailingStopPercent, setTrailingStopPercent] = useState<number | ''>(savedState?.trailingStopPercent ?? 1.2);
  const [trailingActivationProfitPercent, setTrailingActivationProfitPercent] = useState<number | ''>(savedState?.trailingActivationProfitPercent ?? 1.5);
  const [feeRatePercent, setFeeRatePercent] = useState<number | ''>(savedState?.feeRatePercent ?? 0.05);
  const [slippagePercent, setSlippagePercent] = useState<number | ''>(savedState?.slippagePercent ?? 0.02);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(savedState?.showAdvancedSettings ?? true);
  const [showAppliedToast, setShowAppliedToast] = useState<boolean>(false);
  const [activeSymbolsForBacktest, setActiveSymbolsForBacktest] = useState<string[]>(
    savedState?.activeSymbolsForBacktest || RESPECTED_TRADING_PAIRS.map(p => p.symbol)
  );

  // Persist settings
  useEffect(() => {
    const stateToSave = {
      viewMode, activeSingleSymbol, selectedPreset, months, initialBalance, balanceInputText,
      leverage, timeframe, riskRewardTarget, minSignalStrength, slAtrMultiplier, tradeAllocationPercent,
      marketType, trailingStopEnabled, trailingStopPercent, trailingActivationProfitPercent,
      feeRatePercent, slippagePercent, showAdvancedSettings, activeSymbolsForBacktest
    };
    try {
      apiStorage.setItem('quantura_backtest_settings', JSON.stringify(stateToSave));
    } catch(e) {}
  }, [
      viewMode, activeSingleSymbol, selectedPreset, months, initialBalance, balanceInputText,
      leverage, timeframe, riskRewardTarget, minSignalStrength, slAtrMultiplier, tradeAllocationPercent,
      marketType, trailingStopEnabled, trailingStopPercent, trailingActivationProfitPercent,
      feeRatePercent, slippagePercent, showAdvancedSettings, activeSymbolsForBacktest
  ]);

  // Handler to apply preset templates
  const handleSelectPreset = (preset: 'FUTURES_MOMENTUM' | 'FUTURES_SCALPER' | 'CONSERVATIVE_TREND' | 'SPOT_MOMENTUM' | 'SPOT_SCALPER' | 'SPOT_SWING') => {
    setSelectedPreset(preset);
    if (preset === 'FUTURES_MOMENTUM') {
      // Best optimal Futures strategy (Long/Short, 3x leverage, 1H timeframe, ATR 1.5x SL, Trailing 1.2%)
      setMarketType('FUTURES');
      setLeverage(3);
      setTimeframe('1h');
      setTradeAllocationPercent(20);
      setMinSignalStrength(65);
      setRiskRewardTarget(2.0);
      setSlAtrMultiplier(1.5);
      setTrailingStopEnabled(true);
      setTrailingStopPercent(1.2);
      setTrailingActivationProfitPercent(1.5);
    } else if (preset === 'FUTURES_SCALPER') {
      // High frequency scalper (15m, 5x leverage, tighter TP/SL)
      setMarketType('FUTURES');
      setLeverage(5);
      setTimeframe('15m');
      setTradeAllocationPercent(15);
      setMinSignalStrength(60);
      setRiskRewardTarget(1.6);
      setSlAtrMultiplier(1.2);
      setTrailingStopEnabled(true);
      setTrailingStopPercent(0.8);
      setTrailingActivationProfitPercent(1.0);
    } else if (preset === 'CONSERVATIVE_TREND') {
      // Low risk institutional swing (4h, 2x leverage or Spot, high confidence 75)
      setMarketType('FUTURES');
      setLeverage(2);
      setTimeframe('4h');
      setTradeAllocationPercent(25);
      setMinSignalStrength(75);
      setRiskRewardTarget(2.5);
      setSlAtrMultiplier(2.0);
      setTrailingStopEnabled(true);
      setTrailingStopPercent(1.8);
      setTrailingActivationProfitPercent(2.0);
    } else if (preset === 'SPOT_MOMENTUM') {
      setMarketType('SPOT');
      setLeverage(1);
      setTimeframe('1h');
      setTradeAllocationPercent(20);
      setMinSignalStrength(65);
      setRiskRewardTarget(2.5);
      setSlAtrMultiplier(1.5);
      setTrailingStopEnabled(true);
      setTrailingStopPercent(2.0);
      setTrailingActivationProfitPercent(2.5);
    } else if (preset === 'SPOT_SCALPER') {
      setMarketType('SPOT');
      setLeverage(1);
      setTimeframe('15m');
      setTradeAllocationPercent(15);
      setMinSignalStrength(60);
      setRiskRewardTarget(2.0);
      setSlAtrMultiplier(1.2);
      setTrailingStopEnabled(true);
      setTrailingStopPercent(1.5);
      setTrailingActivationProfitPercent(2.0);
    } else if (preset === 'SPOT_SWING') {
      setMarketType('SPOT');
      setLeverage(1);
      setTimeframe('4h');
      setTradeAllocationPercent(30);
      setMinSignalStrength(75);
      setRiskRewardTarget(3.5);
      setSlAtrMultiplier(2.5);
      setTrailingStopEnabled(true);
      setTrailingStopPercent(3.0);
      setTrailingActivationProfitPercent(4.0);
    }
  };

  // Handler to push current backtested strategy directly into live bot
  const handleApplyToLiveBot = () => {
    if (onUpdateBotConfig) {
      onUpdateBotConfig({
        marketType,
        leverage: marketType === 'FUTURES' ? (Number(leverage) || 1) : 1,
        timeframe: timeframe === '1h' ? '1h' : timeframe === '4h' ? '4h' : timeframe === '15m' ? '15m' : '1d',
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

  // Results State
  const [multiResult, setMultiResult] = useState<MultiCoinBacktestResult | null>(null);
  const [singleResult, setSingleResult] = useState<BacktestResult | null>(null);
  const [visibleTradesLimit, setVisibleTradesLimit] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingStatusText, setLoadingStatusText] = useState<string>('');

  // Cached Klines
  const [allCoinsKlines, setAllCoinsKlines] = useState<Record<string, KlineCandle[]>>({});

  const currentConfig: BacktestConfig = useMemo(
    () => ({
      timeframe,
      months,
      candleLimit: Math.min(2000, timeframe === '1d' ? months * 30 : timeframe === '4h' ? months * 180 : months * 720),
      initialBalance,
      leverage: Number(leverage) || 1,
      tradeAllocationPercent: Number(tradeAllocationPercent) || 10,
      riskRewardTarget: Number(riskRewardTarget) || 2,
      minSignalStrength: Number(minSignalStrength) || 50,
      slAtrMultiplier: Number(slAtrMultiplier) || 1.5,
      marketType,
      trailingStopEnabled,
      trailingStopPercent: trailingStopPercent === '' ? 0 : Number(trailingStopPercent),
      trailingActivationProfitPercent: trailingActivationProfitPercent === '' ? 0 : Number(trailingActivationProfitPercent),
      feeRatePercent: feeRatePercent === '' ? 0 : Number(feeRatePercent),
      slippagePercent: slippagePercent === '' ? 0 : Number(slippagePercent),
    }),
    [
      timeframe, months, initialBalance, leverage, tradeAllocationPercent, riskRewardTarget,
      minSignalStrength, slAtrMultiplier, marketType, trailingStopEnabled, trailingStopPercent,
      trailingActivationProfitPercent, feeRatePercent, slippagePercent,
    ]
  );

  // Clear cached klines if data-fetching parameters change so it forces a refetch
  useEffect(() => {
    setAllCoinsKlines({});
  }, [timeframe, months, marketType]);

  const executeGlobalBacktest = useCallback(
    async (forceFetch = false) => {
      setIsLoading(true);
      setLoadingProgress(10);
      setLoadingStatusText(isArabic ? 'جاري جلب البيانات...' : 'Fetching data...');
      try {
        const symbolsToFetch = activeSymbolsForBacktest;
        let klinesMap = { ...allCoinsKlines };
        const hasAllCached = !forceFetch && symbolsToFetch.every((s) => klinesMap[s] && klinesMap[s].length >= 30);

        if (!hasAllCached) {
          setLoadingProgress(30);
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

        setLoadingProgress(70);
        setLoadingStatusText(isArabic ? 'جاري المحاكاة...' : 'Running simulation...');
        
        // Filter map to ONLY include user-selected symbols
        const activeKlinesMap: Record<string, KlineCandle[]> = {};
        symbolsToFetch.forEach(sym => {
          if (klinesMap[sym]) {
            activeKlinesMap[sym] = klinesMap[sym];
          }
        });
        
        const multiRes = runMultiCoinBacktest(activeKlinesMap, currentConfig);
        setMultiResult(multiRes);

        const coinKlines = klinesMap[currentSymbol] || klinesMap[symbolsToFetch[0]] || generateFallbackKlines(currentSymbol, timeframe, months);
        const singleRes = runHistoricalBacktest(coinKlines, currentConfig, currentSymbol);
        setSingleResult(singleRes);

        setLoadingProgress(100);
      } catch (err) {
        console.error('Backtest error:', err);
      } finally {
        setTimeout(() => { setIsLoading(false); setLoadingProgress(0); }, 200);
      }
    },
    [allCoinsKlines, currentConfig, currentSymbol, isArabic, months, timeframe, marketType, activeSymbolsForBacktest]
  );

  const executeSingleCoinBacktest = useCallback(
    async (targetSymbol: string, forceFetch: boolean = false) => {
      let coinKlines = allCoinsKlines[targetSymbol];
      if (forceFetch || !coinKlines || coinKlines.length < 30) {
        setIsLoading(true);
        try {
          const res = await fetch(`/api/binance/historical-klines?symbol=${targetSymbol}&timeframe=${timeframe}&months=${months}&marketType=${marketType}`);
          if (res.ok) {
            const data = await res.json();
            if (data.klines && data.klines.length > 0) {
              coinKlines = data.klines;
              setAllCoinsKlines((prev) => ({ ...prev, [targetSymbol]: coinKlines }));
            }
          }
        } catch (e) {
          console.warn('Fallback single fetch:', targetSymbol);
        } finally {
          setIsLoading(false);
        }
        if (!coinKlines || coinKlines.length < 30) {
          coinKlines = generateFallbackKlines(targetSymbol, timeframe, months);
          setAllCoinsKlines((prev) => ({ ...prev, [targetSymbol]: coinKlines }));
        }
      }
      if (coinKlines && coinKlines.length >= 30) {
        const res = runHistoricalBacktest(coinKlines, currentConfig, targetSymbol);
        setSingleResult(res);
      }
    },
    [allCoinsKlines, currentConfig, timeframe, months, marketType]
  );

  useEffect(() => {
    if (viewMode === 'SINGLE_COIN') {
      executeSingleCoinBacktest(currentSymbol);
    }
  }, [currentSymbol, viewMode, executeSingleCoinBacktest]);

  useEffect(() => {
    executeGlobalBacktest(false);
  }, []); // Run on mount

  useEffect(() => {
    if (Object.keys(allCoinsKlines).length > 0 && !isLoading) {
      const filteredKlinesMap: Record<string, KlineCandle[]> = {};
      activeSymbolsForBacktest.forEach(sym => {
        if (allCoinsKlines[sym]) filteredKlinesMap[sym] = allCoinsKlines[sym];
      });
      const multiRes = runMultiCoinBacktest(filteredKlinesMap, currentConfig);
      setMultiResult(multiRes);

      const coinKlines = allCoinsKlines[currentSymbol] || Object.values(allCoinsKlines)[0] || [];
      if (coinKlines.length >= 30) {
        const singleRes = runHistoricalBacktest(coinKlines, currentConfig, currentSymbol);
        setSingleResult(singleRes);
      }
    }
  }, [
    initialBalance, leverage, tradeAllocationPercent, riskRewardTarget, minSignalStrength,
    slAtrMultiplier, marketType, currentSymbol, trailingStopEnabled, trailingStopPercent,
    trailingActivationProfitPercent, feeRatePercent, slippagePercent, activeSymbolsForBacktest
  ]);

  return (
    <div className="flex flex-col xl:flex-row gap-6 w-full h-full pb-8">
      
      {/* ========================================================= */}
      {/* SIDEBAR: Settings & Configuration                         */}
      {/* ========================================================= */}
      <div className="xl:w-88 flex-shrink-0 flex flex-col gap-4">
        
        {/* Strategy Presets Selector (Top Recommended Strategies) */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#1e293b] flex items-center justify-between bg-gradient-to-r from-brand-500/10 via-transparent to-transparent">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              {isArabic ? 'نماذج استراتيجيات البوت' : 'Bot Strategy Presets'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
              {marketType}
            </span>
          </div>

          <div className="p-3 space-y-2">
            {marketType === 'FUTURES' ? (
              <>
                {/* Preset 1: Recommended Futures Momentum */}
                <button
                  onClick={() => handleSelectPreset('FUTURES_MOMENTUM')}
                  className={`w-full text-left p-3 rounded-lg border transition-all relative ${
                    selectedPreset === 'FUTURES_MOMENTUM'
                      ? 'bg-brand-500/15 border-brand-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                      : 'bg-[#1e293b]/40 border-[#334155]/60 hover:bg-[#1e293b]/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-brand-300">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isArabic ? 'الأكثر ربحية: زخم العقود الآجلة ⚡' : 'Optimal: Futures Momentum ⚡'}</span>
                    </div>
                    {selectedPreset === 'FUTURES_MOMENTUM' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {isArabic
                      ? 'رافعة 3x • فريم 1H • تأكيد الزخم ADX/RSI • تخريج 3 أهداف مع حجز Breakeven ووقف متحرك.'
                      : '3x Leverage • 1H Frame • ADX/RSI Confluence • 3-Tier Take Profit + Trailing Breakeven.'}
                  </p>
                  <div className="flex gap-2 mt-2 pt-2 border-t border-slate-700/40 text-[10px] text-slate-300">
                    <span className="bg-slate-800/80 px-2 py-0.5 rounded">Lev: 3x</span>
                    <span className="bg-slate-800/80 px-2 py-0.5 rounded">TF: 1H</span>
                    <span className="bg-slate-800/80 px-2 py-0.5 rounded">RR: 2.0</span>
                    <span className="bg-slate-800/80 px-2 py-0.5 rounded">Trail: 1.2%</span>
                  </div>
                </button>

                {/* Preset 2: Futures Scalper */}
                <button
                  onClick={() => handleSelectPreset('FUTURES_SCALPER')}
                  className={`w-full text-left p-3 rounded-lg border transition-all relative ${
                    selectedPreset === 'FUTURES_SCALPER'
                      ? 'bg-brand-500/15 border-brand-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                      : 'bg-[#1e293b]/40 border-[#334155]/60 hover:bg-[#1e293b]/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-300">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isArabic ? 'سكالبينج سريع (15m High-Freq)' : 'Futures Scalper (15m)'}</span>
                    </div>
                    {selectedPreset === 'FUTURES_SCALPER' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {isArabic
                      ? 'رافعة 5x • صفقات سريعة على فريم 15 دقيقة • أهداف سريعة مع وقف خسارة ضيق 1.2x ATR.'
                      : '5x Leverage • High velocity 15m entries • Fast TP scalps with tight 1.2x ATR stop.'}
                  </p>
                </button>

                {/* Preset 3: Conservative Trend */}
                <button
                  onClick={() => handleSelectPreset('CONSERVATIVE_TREND')}
                  className={`w-full text-left p-3 rounded-lg border transition-all relative ${
                    selectedPreset === 'CONSERVATIVE_TREND'
                      ? 'bg-brand-500/15 border-brand-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                      : 'bg-[#1e293b]/40 border-[#334155]/60 hover:bg-[#1e293b]/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-300">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isArabic ? 'سوينغ مؤسساتي محافظ (4H Swing)' : 'Institutional Trend (4H)'}</span>
                    </div>
                    {selectedPreset === 'CONSERVATIVE_TREND' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {isArabic
                      ? 'رافعة 2x • ثقة مرتفعة 75+ • استهداف قمم وقيعان المدى المتوسط مع أقل نسبة تراجع.'
                      : '2x Leverage • High filter (75+) • Swing trades on 4H with lowest Drawdown.'}
                  </p>
                </button>
              </>
            ) : (
              <>
                {/* Preset 1: Spot Momentum */}
                <button
                  onClick={() => handleSelectPreset('SPOT_MOMENTUM')}
                  className={`w-full text-left p-3 rounded-lg border transition-all relative ${
                    selectedPreset === 'SPOT_MOMENTUM'
                      ? 'bg-brand-500/15 border-brand-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                      : 'bg-[#1e293b]/40 border-[#334155]/60 hover:bg-[#1e293b]/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-brand-300">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isArabic ? 'زخم سبوت ⚡' : 'Spot Momentum ⚡'}</span>
                    </div>
                    {selectedPreset === 'SPOT_MOMENTUM' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {isArabic
                      ? 'تداول فوري بدون رافعة • فريم 1H • أهداف ممتازة مع حجز ربح متحرك.'
                      : '1x Leverage • 1H Frame • High targets with trailing profit taking.'}
                  </p>
                  <div className="flex gap-2 mt-2 pt-2 border-t border-slate-700/40 text-[10px] text-slate-300">
                    <span className="bg-slate-800/80 px-2 py-0.5 rounded">Lev: 1x</span>
                    <span className="bg-slate-800/80 px-2 py-0.5 rounded">TF: 1H</span>
                    <span className="bg-slate-800/80 px-2 py-0.5 rounded">RR: 2.5</span>
                    <span className="bg-slate-800/80 px-2 py-0.5 rounded">Trail: 2.0%</span>
                  </div>
                </button>

                {/* Preset 2: Spot Scalper */}
                <button
                  onClick={() => handleSelectPreset('SPOT_SCALPER')}
                  className={`w-full text-left p-3 rounded-lg border transition-all relative ${
                    selectedPreset === 'SPOT_SCALPER'
                      ? 'bg-brand-500/15 border-brand-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                      : 'bg-[#1e293b]/40 border-[#334155]/60 hover:bg-[#1e293b]/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-300">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isArabic ? 'سبوت سكالبينج سريع (15m)' : 'Spot Scalper (15m)'}</span>
                    </div>
                    {selectedPreset === 'SPOT_SCALPER' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {isArabic
                      ? 'صفقات يومية سريعة على السبوت • استهداف أرباح صغيرة متكررة.'
                      : 'High velocity 15m Spot entries • Fast incremental gains.'}
                  </p>
                </button>

                {/* Preset 3: Spot Swing */}
                <button
                  onClick={() => handleSelectPreset('SPOT_SWING')}
                  className={`w-full text-left p-3 rounded-lg border transition-all relative ${
                    selectedPreset === 'SPOT_SWING'
                      ? 'bg-brand-500/15 border-brand-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                      : 'bg-[#1e293b]/40 border-[#334155]/60 hover:bg-[#1e293b]/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-300">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isArabic ? 'سبوت استثماري محافظ (4H)' : 'Spot Swing (4H)'}</span>
                    </div>
                    {selectedPreset === 'SPOT_SWING' && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {isArabic
                      ? 'تخزين آمن واستهداف تقلبات أسبوعية • ثقة عالية مع وقف خسارة واسع.'
                      : 'Safe accumulation and medium term holding • High filter swing trades.'}
                  </p>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Strategy Fine-Tuning Parameters */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#1e293b] flex items-center justify-between bg-[#1e293b]/20">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-400" />
              {isArabic ? 'تعديل المعايير الدقيقة' : 'Fine-Tune Parameters'}
            </h3>
          </div>
          <div className="p-4 space-y-4">
            
            {/* Horizon */}
            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1.5">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {isArabic ? 'فترة الاختبار التاريخي' : 'Backtest Horizon'}</span>
                <span className="text-brand-400 font-mono font-bold">{months} {isArabic ? 'أشهر' : 'Months'}</span>
              </label>
              <input
                type="range"
                min="1"
                max="24"
                step="1"
                value={months}
                onChange={(e) => {
                  setSelectedPreset('CUSTOM');
                  setMonths(Number(e.target.value));
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* Capital */}
            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1.5">
                <span>{isArabic ? 'رأس المال المبدئي ($ USDT)' : 'Initial Capital ($ USDT)'}</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                <input
                  type="number"
                  value={balanceInputText}
                  onChange={(e) => {
                    setBalanceInputText(e.target.value);
                    const val = Number(e.target.value);
                    if (val > 0) setInitialBalance(val);
                  }}
                  className="w-full bg-[#1e293b]/50 border border-[#334155] rounded-lg py-1.5 pl-6 pr-3 text-xs text-white focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Allocation & Leverage */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                  {isArabic ? 'حصة الصفقة' : 'Alloc. / Trade'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={tradeAllocationPercent}
                    onChange={(e) => {
                      setSelectedPreset('CUSTOM');
                      setTradeAllocationPercent(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className="w-full bg-[#1e293b]/50 border border-[#334155] rounded-lg py-1.5 pr-6 pl-3 text-xs text-white focus:outline-none focus:border-brand-500 transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                  {isArabic ? 'الرافعة المالية' : 'Leverage'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={leverage}
                    onChange={(e) => {
                      setSelectedPreset('CUSTOM');
                      setLeverage(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className="w-full bg-[#1e293b]/50 border border-[#334155] rounded-lg py-1.5 pr-6 pl-3 text-xs text-white focus:outline-none focus:border-brand-500 transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">x</span>
                </div>
              </div>
            </div>

            {/* Timeframe & Market Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">{isArabic ? 'الفريم الزمني' : 'Timeframe'}</label>
                <select
                  value={timeframe}
                  onChange={(e) => {
                    setSelectedPreset('CUSTOM');
                    setTimeframe(e.target.value as any);
                  }}
                  className="w-full bg-[#1e293b]/50 border border-[#334155] rounded-lg py-1.5 px-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="15m">15m (Scalp)</option>
                  <option value="1h">1H (Standard)</option>
                  <option value="4h">4H (Swing)</option>
                  <option value="1d">1D (Daily)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">{isArabic ? 'نوع السوق' : 'Market Type'}</label>
                <select
                  value={marketType}
                  onChange={(e) => {
                    const newType = e.target.value as 'SPOT' | 'FUTURES';
                    setSelectedPreset('CUSTOM');
                    setMarketType(newType);
                    if (newType === 'SPOT') {
                      setLeverage(1);
                    } else if (newType === 'FUTURES') {
                      setLeverage(3);
                    }
                  }}
                  className="w-full bg-[#1e293b]/50 border border-[#334155] rounded-lg py-1.5 px-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="FUTURES">Futures (Long/Short)</option>
                  <option value="SPOT">Spot (Long only)</option>
                </select>
              </div>
            </div>

            {/* Advanced Toggle */}
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white pt-2 border-t border-[#1e293b]"
            >
              <span>{isArabic ? 'معايير الإشارات وإدارة الخطر' : 'Advanced Signal & Risk Rules'}</span>
              {showAdvancedSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvancedSettings && (
              <div className="space-y-3 pt-2 bg-[#0a0f1d] p-3 rounded-lg border border-[#1e293b]">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{isArabic ? 'العائد/المخاطرة (R:R)' : 'Risk/Reward Target'}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={riskRewardTarget}
                    onChange={(e) => {
                      setSelectedPreset('CUSTOM');
                      setRiskRewardTarget(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className="w-20 bg-[#1e293b] border border-[#334155] rounded text-center py-1 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{isArabic ? 'قوة الإشارة الدنيا (0-100)' : 'Min Signal Score'}</span>
                  <input
                    type="number"
                    step="1"
                    min="50"
                    max="95"
                    value={minSignalStrength}
                    onChange={(e) => {
                      setSelectedPreset('CUSTOM');
                      setMinSignalStrength(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className="w-20 bg-[#1e293b] border border-[#334155] rounded text-center py-1 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{isArabic ? 'مضاعف ATR لوقف الخسارة' : 'SL ATR Multiplier'}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={slAtrMultiplier}
                    onChange={(e) => {
                      setSelectedPreset('CUSTOM');
                      setSlAtrMultiplier(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className="w-20 bg-[#1e293b] border border-[#334155] rounded text-center py-1 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{isArabic ? 'الوقف المتحرك Trailing %' : 'Trailing Stop Gap %'}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={trailingStopPercent}
                    onChange={(e) => {
                      setSelectedPreset('CUSTOM');
                      setTrailingStopPercent(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className="w-20 bg-[#1e293b] border border-[#334155] rounded text-center py-1 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{isArabic ? 'تفعيل الوقف عند ربح %' : 'Trailing Activation %'}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={trailingActivationProfitPercent}
                    onChange={(e) => {
                      setSelectedPreset('CUSTOM');
                      setTrailingActivationProfitPercent(e.target.value === '' ? '' : Number(e.target.value));
                    }}
                    className="w-20 bg-[#1e293b] border border-[#334155] rounded text-center py-1 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{isArabic ? 'عمولة التداول %' : 'Fee Rate %'}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={feeRatePercent}
                    onChange={(e) => setFeeRatePercent(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-20 bg-[#1e293b] border border-[#334155] rounded text-center py-1 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {/* Apply To Live Bot Button */}
            <div className="pt-2 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={handleApplyToLiveBot}
                className="w-full py-2 px-3 bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 border border-brand-500/40 hover:border-brand-500/70 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Bot className="w-3.5 h-3.5 text-brand-400" />
                <span>{isArabic ? 'تطبيق هذه الإعدادات على البوت المباشر ⚡' : 'Apply Settings to Live Auto-Bot ⚡'}</span>
              </button>
              {showAppliedToast && (
                <div className="mt-2 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded p-1.5 text-center flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تم تحديث خطة البوت بنجاح!' : 'Auto-Bot config updated!'}</span>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Panel 3: Watchlist / Coin Selection */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl flex flex-col flex-1 max-h-[400px]">
          <div className="px-4 py-3 border-b border-[#1e293b] flex items-center justify-between bg-[#1e293b]/20">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-brand-400" />
              {isArabic ? 'قائمة العملات' : 'Watchlist & Coins'}
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {viewMode === 'SINGLE_COIN'
                ? currentSymbol.replace('USDT', '')
                : `${activeSymbolsForBacktest.length}/${RESPECTED_TRADING_PAIRS.length}`}
            </span>
          </div>
          <div className="p-2 overflow-y-auto flex-1 no-scrollbar space-y-1">
            {viewMode === 'MULTI_COIN' && (
              <div className="flex gap-2 px-2 pb-2">
                <button onClick={() => setActiveSymbolsForBacktest(RESPECTED_TRADING_PAIRS.map(p => p.symbol))} className="flex-1 py-1 bg-slate-800/50 hover:bg-slate-800 rounded text-[10px] text-slate-300">All</button>
                <button onClick={() => setActiveSymbolsForBacktest([])} className="flex-1 py-1 bg-slate-800/50 hover:bg-slate-800 rounded text-[10px] text-slate-300">Clear</button>
              </div>
            )}
            {viewMode === 'SINGLE_COIN' && (
              <div className="px-2 py-1 text-[11px] text-slate-400 bg-[#1e293b]/40 rounded mb-1.5 flex items-center justify-between">
                <span>{isArabic ? 'اضغط لاختبار أي عملة:' : 'Click to test any coin:'}</span>
                <span className="text-[10px] font-bold text-brand-400">{currentSymbol}</span>
              </div>
            )}
            {RESPECTED_TRADING_PAIRS.map((pair) => {
              const isActiveInPortfolio = activeSymbolsForBacktest.includes(pair.symbol);
              const isCurrentSingle = currentSymbol === pair.symbol;
              return (
                <div
                  key={pair.symbol}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                    viewMode === 'SINGLE_COIN'
                      ? isCurrentSingle
                        ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-[0_0_10px_rgba(20,184,166,0.15)]'
                        : 'text-slate-400 hover:bg-[#1e293b]/60'
                      : isActiveInPortfolio
                        ? 'bg-brand-500/10 text-brand-300'
                        : 'text-slate-400 hover:bg-[#1e293b]/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (viewMode === 'SINGLE_COIN') {
                        setActiveSingleSymbol(pair.symbol);
                        if (onSelectSymbol) onSelectSymbol(pair.symbol);
                        executeSingleCoinBacktest(pair.symbol);
                      } else {
                        if (isActiveInPortfolio) setActiveSymbolsForBacktest(prev => prev.filter(s => s !== pair.symbol));
                        else setActiveSymbolsForBacktest(prev => [...prev, pair.symbol]);
                      }
                    }}
                    className="flex-1 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          viewMode === 'SINGLE_COIN'
                            ? isCurrentSingle
                              ? 'bg-brand-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]'
                              : 'bg-slate-600'
                            : isActiveInPortfolio
                              ? 'bg-brand-400 shadow-[0_0_5px_rgba(45,212,191,0.5)]'
                              : 'bg-slate-700'
                        }`}
                      />
                      <span className="font-bold text-slate-100">{pair.baseAsset}</span>
                      <span className="text-[10px] text-slate-500">{isArabic ? pair.arabicName : pair.displayName}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">USDT</span>
                  </button>

                  {viewMode === 'MULTI_COIN' && (
                    <button
                      type="button"
                      title={isArabic ? 'اختبار هذه العملة فردياً' : 'Single test this coin'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSingleSymbol(pair.symbol);
                        if (onSelectSymbol) onSelectSymbol(pair.symbol);
                        setViewMode('SINGLE_COIN');
                        executeSingleCoinBacktest(pair.symbol);
                      }}
                      className="ml-2 p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-brand-300 transition-colors"
                    >
                      <Target className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            if (viewMode === 'SINGLE_COIN') {
              executeSingleCoinBacktest(currentSymbol, true);
            } else {
              executeGlobalBacktest(true);
            }
          }}
          disabled={isLoading || (viewMode === 'MULTI_COIN' && activeSymbolsForBacktest.length === 0)}
          className="w-full py-3.5 bg-brand-500 hover:bg-brand-400 text-[#0f172a] font-bold rounded-xl shadow-[0_0_15px_rgba(45,212,191,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-[#0f172a] border-t-transparent rounded-full animate-spin" />
              <span>{isArabic ? 'جاري التنفيذ...' : 'Running...'}</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>
                {viewMode === 'SINGLE_COIN'
                  ? (isArabic ? `اختبار ${currentSymbol}` : `Run ${currentSymbol}`)
                  : (isArabic ? 'بدء اختبار المحفظة' : 'Run Portfolio Test')}
              </span>
            </>
          )}
        </button>

      </div>

      {/* ========================================================= */}
      {/* MAIN AREA: Results & Charts                               */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden">
        
        {/* Top Header / Mode Switcher */}
        <div className="border-b border-[#1e293b] bg-[#1e293b]/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex bg-[#020617] rounded-lg p-1 border border-[#334155]">
              <button
                onClick={() => setViewMode('MULTI_COIN')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${viewMode === 'MULTI_COIN' ? 'bg-[#1e293b] text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                {isArabic ? 'المحفظة المجمعة' : 'Portfolio'}
              </button>
              <button
                onClick={() => setViewMode('SINGLE_COIN')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${viewMode === 'SINGLE_COIN' ? 'bg-[#1e293b] text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Target className="w-3.5 h-3.5" />
                {isArabic ? 'تحليل زوج فردي' : 'Single Asset'}
              </button>
            </div>
          </div>

          {/* Single Coin Dropdown & Fast Switcher */}
          {viewMode === 'SINGLE_COIN' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 hidden sm:inline">{isArabic ? 'الزوج المختار:' : 'Selected Pair:'}</span>
              <select
                value={currentSymbol}
                onChange={(e) => {
                  const newSym = e.target.value;
                  setActiveSingleSymbol(newSym);
                  if (onSelectSymbol) onSelectSymbol(newSym);
                  executeSingleCoinBacktest(newSym);
                }}
                className="bg-[#020617] border border-brand-500/50 text-brand-300 rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none focus:border-brand-400 cursor-pointer shadow-[0_0_10px_rgba(20,184,166,0.15)]"
              >
                {RESPECTED_TRADING_PAIRS.map((p) => (
                  <option key={p.symbol} value={p.symbol} className="bg-[#0f172a] text-slate-200">
                    {p.symbol} ({isArabic ? p.arabicName : p.displayName})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Quick-Select Coin Pills for Single Asset Mode */}
        {viewMode === 'SINGLE_COIN' && (
          <div className="px-4 py-2 bg-[#020617]/50 border-b border-[#1e293b] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-slate-500 font-semibold uppercase flex-shrink-0 mr-1">
              {isArabic ? 'العملات:' : 'Quick Select:'}
            </span>
            {RESPECTED_TRADING_PAIRS.map((pair) => {
              const isSelected = currentSymbol === pair.symbol;
              return (
                <button
                  key={pair.symbol}
                  onClick={() => {
                    setActiveSingleSymbol(pair.symbol);
                    if (onSelectSymbol) onSelectSymbol(pair.symbol);
                    executeSingleCoinBacktest(pair.symbol);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold flex-shrink-0 transition-all flex items-center gap-1 ${
                    isSelected
                      ? 'bg-brand-500 text-slate-950 shadow-[0_0_8px_rgba(20,184,166,0.4)]'
                      : 'bg-[#1e293b]/70 hover:bg-[#1e293b] text-slate-400 hover:text-slate-200 border border-[#334155]/50'
                  }`}
                >
                  <span>{pair.baseAsset}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-slate-900/80' : 'text-slate-500'}`}>/USDT</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
          
          {/* Loading Overlay State */}
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-400">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-mono">{loadingStatusText}</div>
              {loadingProgress > 0 && (
                <div className="w-64 bg-[#1e293b] rounded-full h-1.5 overflow-hidden">
                  <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
                </div>
              )}
            </div>
          ) : (
            <>
              {/* === MULTI COIN VIEW === */}
              {viewMode === 'MULTI_COIN' && multiResult && (
                <div className="space-y-6">
                  {/* KPI Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#1e293b]/30 border border-[#334155] rounded-xl p-4">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Total Net Return</div>
                      <div className={`text-2xl font-bold ${multiResult.totalNetReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {multiResult.totalNetReturnPercent >= 0 ? '+' : ''}{multiResult.totalNetReturnPercent}%
                      </div>
                    </div>
                    <div className="bg-[#1e293b]/30 border border-[#334155] rounded-xl p-4">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Final Capital</div>
                      <div className="text-2xl font-bold text-white">${multiResult.totalFinalBalance.toLocaleString()}</div>
                    </div>
                    <div className="bg-[#1e293b]/30 border border-[#334155] rounded-xl p-4">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Total Trades</div>
                      <div className="text-2xl font-bold text-white">{multiResult.totalTrades}</div>
                    </div>
                    <div className="bg-[#1e293b]/30 border border-[#334155] rounded-xl p-4">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Overall Win Rate</div>
                      <div className="text-2xl font-bold text-white">{multiResult.overallWinRate.toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* Portfolio Equity Curve */}
                  {multiResult.portfolioEquityCurve && multiResult.portfolioEquityCurve.length > 0 && (
                    <div className="bg-[#1e293b]/20 border border-[#334155] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{isArabic ? 'منحنى أداء المحفظة المجمعة' : 'Portfolio Aggregate Performance'}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-300">
                              {multiResult.coinsRanked.length} Assets
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {isArabic ? 'مقارنة نمو المحفظة باستراتيجية الشراء والاحتفاظ بالسلة' : 'Portfolio equity vs equal-weighted basket Buy & Hold'}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                            <span className="text-slate-300">Bot Portfolio</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                            <span className="text-slate-400">Basket Buy & Hold</span>
                          </div>
                        </div>
                      </div>

                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={multiResult.portfolioEquityCurve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="multiBotGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                            <XAxis
                              dataKey="timestamp"
                              tickFormatter={(ts) => new Date(ts).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                              stroke="#64748b"
                              fontSize={10}
                              tickLine={false}
                            />
                            <YAxis
                              stroke="#64748b"
                              fontSize={10}
                              tickLine={false}
                              tickFormatter={(val) => `$${Math.round(val).toLocaleString()}`}
                            />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                              labelFormatter={(label: any) => (label ? new Date(Number(label)).toLocaleString() : '')}
                              formatter={(value: any, name: string) => [
                                `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                name === 'botEquityUsdt' ? 'Bot Portfolio' : 'Basket Buy & Hold'
                              ]}
                            />
                            <Area
                              type="monotone"
                              dataKey="botEquityUsdt"
                              stroke="#0ea5e9"
                              strokeWidth={2}
                              fill="url(#multiBotGradient)"
                            />
                            <Area
                              type="monotone"
                              dataKey="buyHoldEquityUsdt"
                              stroke="#64748b"
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              fill="none"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Matrix Table */}
                  <div className="bg-[#1e293b]/20 border border-[#334155] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#1e293b]/50 border-b border-[#334155] text-slate-400">
                          <tr>
                            <th className="py-3 px-4 font-semibold uppercase text-[10px]">Asset</th>
                            <th className="py-3 px-4 font-semibold uppercase text-[10px]">Trades</th>
                            <th className="py-3 px-4 font-semibold uppercase text-[10px]">Win Rate</th>
                            <th className="py-3 px-4 font-semibold uppercase text-[10px]">Net Profit</th>
                            <th className="py-3 px-4 font-semibold uppercase text-[10px]">Final Bal.</th>
                            <th className="py-3 px-4 font-semibold uppercase text-[10px]">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#334155]">
                          {multiResult.coinsRanked.map((coin) => (
                            <tr key={coin.symbol} className="hover:bg-[#1e293b]/40 transition-colors">
                              <td className="py-3 px-4 font-bold text-white">{coin.symbol.replace('USDT','')}</td>
                              <td className="py-3 px-4 text-slate-300">{coin.totalTrades}</td>
                              <td className="py-3 px-4 text-slate-300">
                                <span className={coin.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}>{coin.winRate}%</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={coin.netProfitUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {coin.netProfitUsdt >= 0 ? '+' : ''}${coin.netProfitUsdt.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-300">${coin.finalBalance.toLocaleString()}</td>
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSingleSymbol(coin.symbol);
                                    if (onSelectSymbol) onSelectSymbol(coin.symbol);
                                    setViewMode('SINGLE_COIN');
                                    executeSingleCoinBacktest(coin.symbol);
                                  }}
                                  className="px-3 py-1 bg-[#334155] hover:bg-brand-500 hover:text-slate-900 rounded text-[10px] font-bold text-slate-200 transition-colors flex items-center gap-1"
                                >
                                  <Target className="w-3 h-3" />
                                  <span>{isArabic ? 'تحليل' : 'Analyze'}</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* === SINGLE COIN VIEW === */}
              {viewMode === 'SINGLE_COIN' && singleResult && (
                <div className="space-y-6">
                  
                  {/* Single Asset Banner Header */}
                  <div className="bg-gradient-to-r from-[#1e293b]/70 via-[#1e293b]/40 to-transparent border border-[#334155] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-300 font-black text-sm">
                        {(currentSymbol || 'BTC').replace('USDT', '').slice(0, 4)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-white">{currentSymbol}</h2>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                            {marketType}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                            {timeframe}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {isArabic ? `نتائج الاختبار التاريخي لزوج ${currentSymbol} لمدة ${months} أشهر` : `Historical backtest results for ${currentSymbol} over ${months} months`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportBacktestToCSV(singleResult)}
                        className="px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-brand-500/20 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'تصدير CSV' : 'Export CSV'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => executeSingleCoinBacktest(currentSymbol, true)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isArabic ? 'إعادة الحساب' : 'Recalculate'}</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Single KPI Row */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-[#1e293b]/30 border border-[#334155] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Win Rate</div>
                      <div className="text-xl font-bold text-emerald-400">{singleResult.winRate}%</div>
                    </div>
                    <div className="bg-[#1e293b]/30 border border-[#334155] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Total Return</div>
                      <div className={`text-xl font-bold ${singleResult.netReturnPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {singleResult.netReturnPercent >= 0 ? '+' : ''}{singleResult.netReturnPercent}%
                      </div>
                    </div>
                    <div className="bg-[#1e293b]/30 border border-[#334155] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Profit Factor</div>
                      <div className="text-xl font-bold text-slate-200">{singleResult.profitFactor}</div>
                    </div>
                    <div className="bg-[#1e293b]/30 border border-[#334155] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Max Drawdown</div>
                      <div className="text-xl font-bold text-rose-400">-{singleResult.maxDrawdownPercent}%</div>
                    </div>
                    <div className="bg-[#1e293b]/30 border border-[#334155] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Trades</div>
                      <div className="text-xl font-bold text-slate-200">{singleResult.totalTrades}</div>
                    </div>
                  </div>

                  {/* Equity Curve Chart */}
                  <div className="bg-[#1e293b]/20 border border-[#334155] rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-300 mb-4">Equity Curve vs Buy & Hold</h4>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={singleResult.equityCurve}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={10} tickMargin={8} minTickGap={30} />
                          <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickFormatter={(val) => `$${val}`} width={60} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                            itemStyle={{ fontWeight: 'bold' }}
                          />
                          <Line yAxisId="left" type="monotone" dataKey="equityUsdt" name="Strategy" stroke="#10b981" strokeWidth={2} dot={false} />
                          <Line yAxisId="left" type="monotone" dataKey="buyHoldEquityUsdt" name="Buy & Hold" stroke="#64748b" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Trades List */}
                  <div className="bg-[#1e293b]/20 border border-[#334155] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#334155] bg-[#1e293b]/30">
                      <h4 className="text-xs font-bold text-slate-300">Trade History</h4>
                    </div>
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#1e293b]/50 border-b border-[#334155] text-slate-400 sticky top-0">
                          <tr>
                            <th className="py-2.5 px-4 font-semibold uppercase text-[10px]">Time</th>
                            <th className="py-2.5 px-4 font-semibold uppercase text-[10px]">Type</th>
                            <th className="py-2.5 px-4 font-semibold uppercase text-[10px]">Entry</th>
                            <th className="py-2.5 px-4 font-semibold uppercase text-[10px]">Exit</th>
                            <th className="py-2.5 px-4 font-semibold uppercase text-[10px]">Result</th>
                            <th className="py-2.5 px-4 font-semibold uppercase text-[10px]">ROE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#334155]">
                          {(Array.isArray(singleResult?.trades) ? singleResult.trades : []).slice(0, visibleTradesLimit).map((trade) => {
                            const isWin = trade.pnlPercent > 0;
                            return (
                              <tr key={trade.id} className="hover:bg-[#1e293b]/40 transition-colors">
                                <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">{formatDateTime(trade.entryTime * 1000, timezone)}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                    {trade.type}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-200">${formatCoinPrice(trade.entryPrice, currentSymbol)}</td>
                                <td className="py-3 px-4 text-slate-200">${formatCoinPrice(trade.exitPrice, currentSymbol)}</td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] ${isWin ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                    {trade.result.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className={`py-3 px-4 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {isWin ? '+' : ''}{trade.pnlPercent}%
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
            </>
          )}

        </div>
      </div>

    </div>
  );
};
