import React, { useState, useMemo, useEffect } from 'react';
import {
  Bot, 
  Play, 
  Pause, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  ShieldAlert, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  RefreshCw, 
  Sliders, 
  Clock, 
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  AlertCircle,
  Key,
  ShieldCheck,
  Shield,
  Flame,
  Activity,
  Gauge,
  AlertTriangle,
  RotateCcw,
  X,
  Coins,
  BarChart2,
  Power,
  Compass,
  Radar,
  SlidersHorizontal,
  Check,
  Scissors,
} from 'lucide-react';
import { 
  AutoBotConfig, 
  ActiveBotPosition, 
  AutoTradeLog, 
  Language, 
  AIAnalysisResult,
  TradingExecutionMode,
  BinanceApiConfig,
  Timeframe,
  BotTimeframe,
  PaperWallet
} from '../types';
import { formatCoinPrice } from '../utils/tradingPairs';
import { calculatePortfolioMetrics, calculatePositionUnrealizedPnl } from '../utils/portfolioCalc';
import { SentimentalBotAvatar } from './SentimentalBotAvatar';

interface AutoTradingBotProps {
  language: Language;
  botConfig: AutoBotConfig;
  activePositions: ActiveBotPosition[];
  logs: AutoTradeLog[];
  walletBalance: number;
  paperWallet?: PaperWallet;
  currentPrice: number;
  selectedSymbol: string;
  activeSignal: AIAnalysisResult | null;
  effectiveBotTimeframe?: Timeframe;
  timeframeReason?: string;
  executionMode?: TradingExecutionMode;
  binanceConfig?: BinanceApiConfig;
  onOpenBinanceModal?: () => void;
  onOpenCustomBalanceModal?: () => void;
  onToggleBot: () => void;
  onUpdateConfig: (newConfig: Partial<AutoBotConfig>) => void;
  onManualClosePosition: (posId?: string) => void;
  onManualTriggerBuy: () => void;
  onManualTriggerOpen?: (direction: 'LONG' | 'SHORT') => void;
  onClearLogs: () => void;
  onPanicCloseAll?: () => void;
  onResetCircuitBreaker?: () => void;
  onTrimExcessPositions?: () => void;
  onFullReset?: () => void;
}

const LEVERAGE_PRESETS = [1, 2, 3, 5, 10, 20, 25, 50];

export const AutoTradingBot: React.FC<AutoTradingBotProps> = ({
  language,
  botConfig,
  activePositions,
  logs,
  walletBalance,
  paperWallet,
  currentPrice,
  selectedSymbol,
  activeSignal,
  effectiveBotTimeframe = '1h',
  timeframeReason,
  executionMode = 'PAPER',
  binanceConfig,
  onOpenBinanceModal,
  onOpenCustomBalanceModal,
  onToggleBot,
  onUpdateConfig,
  onManualClosePosition,
  onManualTriggerBuy,
  onManualTriggerOpen,
  onClearLogs,
  onPanicCloseAll,
  onResetCircuitBreaker,
  onTrimExcessPositions,
  onFullReset,
}) => {
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [timeframeInput, setTimeframeInput] = useState<BotTimeframe>(botConfig.timeframe || 'AUTO');
  const [marketTypeInput, setMarketTypeInput] = useState<'FUTURES' | 'SPOT'>(botConfig.marketType || 'FUTURES');
  const [leverageInput, setLeverageInput] = useState(botConfig.leverage || 3);
  const [marginModeInput, setMarginModeInput] = useState<'ISOLATED' | 'CROSS'>(botConfig.marginMode || 'ISOLATED');
  const [allocationInput, setAllocationInput] = useState(botConfig.tradeAllocationPercent.toString());
  const [confidenceInput, setConfidenceInput] = useState(botConfig.minConfidence.toString());
  const [maxTradesInput, setMaxTradesInput] = useState((botConfig.maxOpenTrades || 3).toString());
  const [trailingEnabled, setTrailingEnabled] = useState(botConfig.trailingStopEnabled ?? true);
  const [trailingPercentInput, setTrailingPercentInput] = useState((botConfig.trailingStopPercent || 1.2).toString());
  const [trailingActivationInput, setTrailingActivationInput] = useState((botConfig.trailingActivationProfitPercent || 1.5).toString());
  const [circuitBreakerInput, setCircuitBreakerInput] = useState((botConfig.dailyDrawdownLimitPercent || 5.0).toString());
  const [allowedSymbolsInput, setAllowedSymbolsInput] = useState<string[]>(botConfig.allowedSymbols || []);
  const [sizingModeInput, setSizingModeInput] = useState<'FIXED_PERCENT' | 'RISK_BASED'>(botConfig.sizingMode || 'FIXED_PERCENT');
  const [riskPerTradeInput, setRiskPerTradeInput] = useState((botConfig.riskPerTradePercent || 2.0).toString());
  const [cooldownInput, setCooldownInput] = useState((botConfig.cooldownMinutes || 10).toString());
  const [multiPairInput, setMultiPairInput] = useState(botConfig.multiPairScanning ?? true);
  React.useEffect(() => {
    if (!botConfig.enabled && botConfig.activePresets?.length) {
      // If manually disabled from top button, we can optionally clear presets, or leave them.
      // We will let them persist so when they come back it's still selected.
    }
  }, [botConfig.enabled]);

  React.useEffect(() => {
    if (showConfigModal) {
      setTimeframeInput(botConfig.timeframe || 'AUTO');
      setMarketTypeInput(botConfig.marketType || 'FUTURES');
      setLeverageInput(botConfig.leverage || 3);
      setMarginModeInput(botConfig.marginMode || 'ISOLATED');
      setAllocationInput(botConfig.tradeAllocationPercent.toString());
      setConfidenceInput(botConfig.minConfidence.toString());
      setMaxTradesInput((botConfig.maxOpenTrades || 3).toString());
      setTrailingEnabled(botConfig.trailingStopEnabled ?? true);
      setTrailingPercentInput((botConfig.trailingStopPercent || 1.2).toString());
      setTrailingActivationInput((botConfig.trailingActivationProfitPercent || 1.5).toString());
      setCircuitBreakerInput((botConfig.dailyDrawdownLimitPercent || 5.0).toString());
      setAllowedSymbolsInput(botConfig.allowedSymbols || []);
      setSizingModeInput(botConfig.sizingMode || 'FIXED_PERCENT');
      setRiskPerTradeInput((botConfig.riskPerTradePercent || 2.0).toString());
      setCooldownInput((botConfig.cooldownMinutes || 10).toString());
      setMultiPairInput(botConfig.multiPairScanning ?? true);
    }
  }, [showConfigModal, botConfig]);

  const handleSaveConfig = () => {
    onUpdateConfig({
      timeframe: timeframeInput,
      marketType: marketTypeInput,
      leverage: marketTypeInput === 'FUTURES' ? Math.max(1, Math.min(50, leverageInput)) : 1,
      marginMode: marginModeInput,
      tradeAllocationPercent: Math.max(5, Math.min(100, Number(allocationInput) || 25)),
      minConfidence: Math.max(50, Math.min(95, Number(confidenceInput) || 75)),
      maxOpenTrades: Math.max(1, Math.min(10, Number(maxTradesInput) || 3)),
      trailingStopEnabled: trailingEnabled,
      trailingStopPercent: Math.max(0.3, Math.min(5.0, Number(trailingPercentInput) || 1.2)),
      trailingActivationProfitPercent: Math.max(0.5, Math.min(10.0, Number(trailingActivationInput) || 1.5)),
      dailyDrawdownLimitPercent: Math.max(1.0, Math.min(25.0, Number(circuitBreakerInput) || 5.0)),
      allowedSymbols: allowedSymbolsInput,
      sizingMode: sizingModeInput,
      riskPerTradePercent: Math.max(0.5, Math.min(10.0, Number(riskPerTradeInput) || 2.0)),
      cooldownMinutes: Math.max(0, Math.min(60, Number(cooldownInput) || 10)),
      multiPairScanning: multiPairInput,
    });
    setShowConfigModal(false);
  };

  // -------------------------------------------------------------
  // AI Real-Time Market Reader & Strategy Matcher Engine
  // -------------------------------------------------------------
  const marketAnalysisData = useMemo(() => {
    const regime = activeSignal?.marketRegime || 'TRENDING_BULLISH';
    const indicators = (activeSignal as any)?.technicalIndicators || (activeSignal as any)?.timeframeAnalysis?.[activeSignal?.recommendedTimeframe || '1h']?.indicators;
    const adx = indicators?.adx14 ?? 28.5;
    const rsi = indicators?.rsi14 ?? 54.0;
    const bbBandwidth = indicators?.bollingerBands?.bandwidthPercent ?? 4.2;
    const tradeType = activeSignal?.tradeType || 'FAST_TRADE';
    const confidence = activeSignal?.confidence ?? 78;
    const decision = activeSignal?.decision || 'LONG';
    const hasSmc = Boolean(
      (activeSignal as any)?.smcAnalysis?.orderBlocks?.length || 
      (activeSignal as any)?.smcAnalysis?.fvgZones?.length ||
      tradeType === 'SHORT_TRADE' ||
      tradeType === 'SWING_TRADE'
    );

    // Calculate match score for each strategy based on strict quantitative criteria
    const scores: Record<
      'MOMENTUM' | 'SCALPER' | 'BREAKOUT' | 'MEAN_REVERSION' | 'INSTITUTIONAL_SMC' | 'SWING',
      {
        score: number;
        criteriaTagsAr: string[];
        criteriaTagsFr: string[];
        primaryReasonAr: string;
        primaryReasonFr: string;
      }
    > = {
      MOMENTUM: {
        score: 0,
        criteriaTagsAr: [],
        criteriaTagsFr: [],
        primaryReasonAr: '',
        primaryReasonFr: '',
      },
      SCALPER: {
        score: 0,
        criteriaTagsAr: [],
        criteriaTagsFr: [],
        primaryReasonAr: '',
        primaryReasonFr: '',
      },
      BREAKOUT: {
        score: 0,
        criteriaTagsAr: [],
        criteriaTagsFr: [],
        primaryReasonAr: '',
        primaryReasonFr: '',
      },
      MEAN_REVERSION: {
        score: 0,
        criteriaTagsAr: [],
        criteriaTagsFr: [],
        primaryReasonAr: '',
        primaryReasonFr: '',
      },
      INSTITUTIONAL_SMC: {
        score: 0,
        criteriaTagsAr: [],
        criteriaTagsFr: [],
        primaryReasonAr: '',
        primaryReasonFr: '',
      },
      SWING: {
        score: 0,
        criteriaTagsAr: [],
        criteriaTagsFr: [],
        primaryReasonAr: '',
        primaryReasonFr: '',
      },
    };

    // 1. MOMENTUM SCORING
    let momScore = 45;
    if (regime === 'TRENDING_BULLISH' || regime === 'TRENDING_BEARISH') {
      momScore += 32;
      scores.MOMENTUM.criteriaTagsAr.push(regime === 'TRENDING_BULLISH' ? 'اتجاه صاعد قوي' : 'اتجاه هابط قوي');
      scores.MOMENTUM.criteriaTagsFr.push('Tendance Forte');
    }
    if (adx >= 25) {
      momScore += 18;
      scores.MOMENTUM.criteriaTagsAr.push(`ADX ${adx.toFixed(1)} > 25`);
      scores.MOMENTUM.criteriaTagsFr.push(`ADX ${adx.toFixed(1)} (Solide)`);
    }
    if (tradeType === 'SHORT_TRADE' || ((activeSignal as any)?.quantScore?.trend ?? 50) > 60) {
      momScore += 10;
    }
    momScore = Math.min(98, Math.max(30, momScore));
    scores.MOMENTUM.score = momScore;
    scores.MOMENTUM.primaryReasonAr = `سوق في اتجاه صريح مع زخم قوي في مؤشر ADX (${adx.toFixed(1)}) وتوافق المتوسطات المتحركة EMA.`;
    scores.MOMENTUM.primaryReasonFr = `Tendance directionnelle confirmée avec ADX (${adx.toFixed(1)}) et alignement des moyennes mobiles.`;

    // 2. SCALPER SCORING
    let scalperScore = 40;
    if (regime === 'HIGH_VOLATILITY') {
      scalperScore += 38;
      scores.SCALPER.criteriaTagsAr.push('تقلبات سريعة');
      scores.SCALPER.criteriaTagsFr.push('Forte Volatilité');
    }
    if (activeSignal?.recommendedTimeframe === '5m' || activeSignal?.recommendedTimeframe === '15m') {
      scalperScore += 15;
      scores.SCALPER.criteriaTagsAr.push('فريم لحظي 15m');
      scores.SCALPER.criteriaTagsFr.push('TF 15m');
    }
    if (tradeType === 'FAST_TRADE') scalperScore += 12;
    scalperScore = Math.min(98, Math.max(30, scalperScore));
    scores.SCALPER.score = scalperScore;
    scores.SCALPER.primaryReasonAr = 'حركة سعرية سريعة تسمح باقتناص أهداف خاطفة بنقاط وقف خسارة ضيقة وتكرار سريع.';
    scores.SCALPER.primaryReasonFr = 'Micro-oscillations rapides idéales pour entrées fractionnées et sorties rapides.';

    // 3. BREAKOUT SCORING
    let brkScore = 38;
    if (bbBandwidth > 4.5 || ((activeSignal as any)?.quantScore?.volatility ?? 50) > 65) {
      brkScore += 35;
      scores.BREAKOUT.criteriaTagsAr.push('انفجار بولينجر');
      scores.BREAKOUT.criteriaTagsFr.push('Expansion BB');
    }
    if (regime === 'HIGH_VOLATILITY' || regime === 'TRENDING_BULLISH') {
      brkScore += 18;
      scores.BREAKOUT.criteriaTagsAr.push('اختراق مستويات');
      scores.BREAKOUT.criteriaTagsFr.push('Cassure Niveaux');
    }
    brkScore = Math.min(98, Math.max(30, brkScore));
    scores.BREAKOUT.score = brkScore;
    scores.BREAKOUT.primaryReasonAr = 'اتساع في نطاقات بولينجر باند وضغط سيولة ينذر باختراق مستويات القمم والقيعان.';
    scores.BREAKOUT.primaryReasonFr = 'Élargissement des bandes de Bollinger avec volume dynamique sur franchissement de niveaux.';

    // 4. MEAN REVERSION SCORING
    let revScore = 35;
    if (regime === 'RANGING' || regime === 'LOW_VOLATILITY') {
      revScore += 40;
      scores.MEAN_REVERSION.criteriaTagsAr.push('نطاق عرضي Ranging');
      scores.MEAN_REVERSION.criteriaTagsFr.push('Marché en Range');
    }
    if (rsi > 68 || rsi < 32) {
      revScore += 25;
      scores.MEAN_REVERSION.criteriaTagsAr.push(`RSI ${rsi.toFixed(1)} تشبع`);
      scores.MEAN_REVERSION.criteriaTagsFr.push(`RSI ${rsi.toFixed(1)} Extrême`);
    }
    if (regime === 'RANGING') revScore += 15;
    revScore = Math.min(98, Math.max(30, revScore));
    scores.MEAN_REVERSION.score = revScore;
    scores.MEAN_REVERSION.primaryReasonAr = 'سوق متذبذب داخل نطاق محدد مع تشبع مؤشر RSI، مثالي للارتداد إلى المتوسط السعري.';
    scores.MEAN_REVERSION.primaryReasonFr = 'Marché sans tendance avec RSI en zone extrême, propice au retour à la moyenne.';

    // 5. INSTITUTIONAL SMC SCORING
    let smcScore = 48;
    if (hasSmc) {
      smcScore += 30;
      scores.INSTITUTIONAL_SMC.criteriaTagsAr.push('Order Blocks & FVG');
      scores.INSTITUTIONAL_SMC.criteriaTagsFr.push('Zones SMC / FVG');
    }
    if (regime === 'TRENDING_BULLISH' || regime === 'TRENDING_BEARISH') {
      smcScore += 16;
      scores.INSTITUTIONAL_SMC.criteriaTagsAr.push('توافق سيولة كبرى');
      scores.INSTITUTIONAL_SMC.criteriaTagsFr.push('Liquidité institutionnelle');
    }
    if (confidence >= 75) smcScore += 8;
    smcScore = Math.min(98, Math.max(35, smcScore));
    scores.INSTITUTIONAL_SMC.score = smcScore;
    scores.INSTITUTIONAL_SMC.primaryReasonAr = 'تمركز أوامر السيولة المؤسسية وتغطية الفجوات السعرية FVG مع بنية هيكلية سليمة.';
    scores.INSTITUTIONAL_SMC.primaryReasonFr = 'Balayage de liquidité et blocs d\'ordres institutionnels avec ratios risque/rendement élevés.';

    // 6. SWING SCORING
    let swingScore = 42;
    if (activeSignal?.recommendedTimeframe === '4h' || activeSignal?.recommendedTimeframe === '1d' || tradeType === 'SWING_TRADE' || tradeType === 'POSITION_TRADE') {
      swingScore += 32;
      scores.SWING.criteriaTagsAr.push('توافق فريم 4H/1D');
      scores.SWING.criteriaTagsFr.push('Confluence 4H/1D');
    }
    if (regime === 'TRENDING_BULLISH' || regime === 'TRENDING_BEARISH') {
      swingScore += 18;
      scores.SWING.criteriaTagsAr.push('هيكل ماكرو مستقر');
      scores.SWING.criteriaTagsFr.push('Structure macro');
    }
    swingScore = Math.min(98, Math.max(30, swingScore));
    scores.SWING.score = swingScore;
    scores.SWING.primaryReasonAr = 'استقرار الهيكل الماكرو للفريمات الكبرى مع تراجع المخاطر لحمل الصفقات لفترات أطول.';
    scores.SWING.primaryReasonFr = 'Structure de marché stable sur unités de temps majeures (4H/1D) avec drawdown minimal.';

    // Sort to extract absolute top matching strategy
    const entries = Object.entries(scores) as [
      'MOMENTUM' | 'SCALPER' | 'BREAKOUT' | 'MEAN_REVERSION' | 'INSTITUTIONAL_SMC' | 'SWING',
      typeof scores['MOMENTUM']
    ][];
    entries.sort((a, b) => b[1].score - a[1].score);
    const topStrategyId = entries[0][0];
    const topScore = entries[0][1].score;

    return {
      regime,
      adx,
      rsi,
      bbBandwidth,
      tradeType,
      confidence,
      decision,
      scores,
      topStrategyId,
      topScore,
      topAnalysis: entries[0][1],
    };
  }, [activeSignal]);

  // Sync strategy activation states on mount with authoritative backend StrategyManager
  // AND automatically match & select the optimal strategy if none is selected or if autoAdaptive is enabled!
  useEffect(() => {
    fetch('/api/strategies')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.activeStrategies)) {
          const backendActive = data.activeStrategies;
          const current = botConfig.activePresets || [];
          
          if (backendActive.length > 0) {
            if (JSON.stringify(backendActive.sort()) !== JSON.stringify([...current].sort())) {
              onUpdateConfig({
                activePresets: backendActive,
                ...(backendActive.length === 0 && botConfig.enabled ? { enabled: false } : {}),
              });
            }
          } else if (current.length === 0 || botConfig.autoAdaptiveStrategy) {
            // Auto-select optimal strategy matching market conditions immediately upon user entry!
            handleSelectOptimalStrategy(marketAnalysisData.topStrategyId);
          }
        } else if ((!botConfig.activePresets || botConfig.activePresets.length === 0) || botConfig.autoAdaptiveStrategy) {
          handleSelectOptimalStrategy(marketAnalysisData.topStrategyId);
        }
      })
      .catch((err) => {
        console.warn('[AutoTradingBot] Could not fetch backend strategies:', err);
        if ((!botConfig.activePresets || botConfig.activePresets.length === 0) || botConfig.autoAdaptiveStrategy) {
          handleSelectOptimalStrategy(marketAnalysisData.topStrategyId);
        }
      });
  }, [marketAnalysisData.topStrategyId]);

  const handleSelectOptimalStrategy = (strategyType: 'MOMENTUM' | 'SCALPER' | 'SWING' | 'BREAKOUT' | 'MEAN_REVERSION' | 'INSTITUTIONAL_SMC') => {
    const isFutures = botConfig.marketType === 'FUTURES';
    
    // Inform backend
    fetch('/api/strategies/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategyId: strategyType, enabled: true }),
    }).catch(() => {});

    let newConfig: Partial<AutoBotConfig> = {
      activePresets: [strategyType],
    };

    if (strategyType === 'MOMENTUM') {
      newConfig = {
        ...newConfig,
        timeframe: '1h',
        leverage: isFutures ? 3 : 1,
        tradeAllocationPercent: 20,
        minConfidence: 65,
        trailingStopEnabled: true,
        trailingStopPercent: isFutures ? 1.2 : 2.0,
        trailingActivationProfitPercent: isFutures ? 1.5 : 2.5,
        sizingMode: 'FIXED_PERCENT'
      };
    } else if (strategyType === 'SCALPER') {
      newConfig = {
        ...newConfig,
        timeframe: '15m',
        leverage: isFutures ? 5 : 1,
        tradeAllocationPercent: 15,
        minConfidence: 60,
        trailingStopEnabled: true,
        trailingStopPercent: isFutures ? 0.8 : 1.5,
        trailingActivationProfitPercent: isFutures ? 1.0 : 2.0,
        sizingMode: 'FIXED_PERCENT'
      };
    } else if (strategyType === 'SWING') {
      newConfig = {
        ...newConfig,
        timeframe: '4h',
        leverage: isFutures ? 2 : 1,
        tradeAllocationPercent: 30,
        minConfidence: 75,
        trailingStopEnabled: true,
        trailingStopPercent: isFutures ? 1.8 : 3.0,
        trailingActivationProfitPercent: isFutures ? 2.0 : 4.0,
        sizingMode: 'FIXED_PERCENT'
      };
    } else if (strategyType === 'BREAKOUT') {
      newConfig = {
        ...newConfig,
        timeframe: '30m',
        leverage: isFutures ? 4 : 1,
        tradeAllocationPercent: 20,
        minConfidence: 70,
        trailingStopEnabled: true,
        trailingStopPercent: isFutures ? 1.0 : 1.8,
        trailingActivationProfitPercent: isFutures ? 1.2 : 2.2,
        sizingMode: 'FIXED_PERCENT'
      };
    } else if (strategyType === 'MEAN_REVERSION') {
      newConfig = {
        ...newConfig,
        timeframe: '15m',
        leverage: isFutures ? 3 : 1,
        tradeAllocationPercent: 15,
        minConfidence: 68,
        trailingStopEnabled: true,
        trailingStopPercent: isFutures ? 0.9 : 1.6,
        trailingActivationProfitPercent: isFutures ? 1.1 : 2.0,
        sizingMode: 'FIXED_PERCENT'
      };
    } else if (strategyType === 'INSTITUTIONAL_SMC') {
      newConfig = {
        ...newConfig,
        timeframe: '1h',
        leverage: isFutures ? 2 : 1,
        tradeAllocationPercent: 25,
        minConfidence: 75,
        trailingStopEnabled: true,
        trailingStopPercent: isFutures ? 1.5 : 2.5,
        trailingActivationProfitPercent: isFutures ? 2.0 : 3.5,
        sizingMode: 'FIXED_PERCENT'
      };
    }

    onUpdateConfig(newConfig);
  };

  const handleApplyStrategy = (strategyType: 'MOMENTUM' | 'SCALPER' | 'SWING' | 'BREAKOUT' | 'MEAN_REVERSION' | 'INSTITUTIONAL_SMC') => {
    const isFutures = botConfig.marketType === 'FUTURES';
    
    let currentPresets = botConfig.activePresets || [];
    const willBeEnabled = !currentPresets.includes(strategyType);
    
    // Toggle preset locally
    if (currentPresets.includes(strategyType)) {
      currentPresets = currentPresets.filter(p => p !== strategyType);
    } else {
      currentPresets = [...currentPresets, strategyType];
    }
    
    // Immediately inform authoritative backend StrategyManager
    fetch('/api/strategies/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategyId: strategyType, enabled: willBeEnabled }),
    }).catch((err) => console.error('[StrategyManager] Failed to toggle strategy state:', err));

    let newConfig: Partial<AutoBotConfig> = { 
      // The bot MUST strictly remain disabled until the user manually clicks Start Bot.
      // Modifying or activating a strategy must NEVER enable the bot automatically!
      activePresets: currentPresets,
      ...(currentPresets.length === 0 && botConfig.enabled ? { enabled: false } : {})
    };
    
    // Apply specific parameters based on selection
    if (currentPresets.length === 1) {
      const activeStr = currentPresets[0];
      if (activeStr === 'MOMENTUM') {
        newConfig = {
          ...newConfig,
          timeframe: '1h',
          leverage: isFutures ? 3 : 1,
          tradeAllocationPercent: 20,
          minConfidence: 65,
          trailingStopEnabled: true,
          trailingStopPercent: isFutures ? 1.2 : 2.0,
          trailingActivationProfitPercent: isFutures ? 1.5 : 2.5,
          sizingMode: 'FIXED_PERCENT'
        };
      } else if (activeStr === 'SCALPER') {
        newConfig = {
          ...newConfig,
          timeframe: '15m',
          leverage: isFutures ? 5 : 1,
          tradeAllocationPercent: 15,
          minConfidence: 60,
          trailingStopEnabled: true,
          trailingStopPercent: isFutures ? 0.8 : 1.5,
          trailingActivationProfitPercent: isFutures ? 1.0 : 2.0,
          sizingMode: 'FIXED_PERCENT'
        };
      } else if (activeStr === 'SWING') {
        newConfig = {
          ...newConfig,
          timeframe: '4h',
          leverage: isFutures ? 2 : 1,
          tradeAllocationPercent: 30,
          minConfidence: 75,
          trailingStopEnabled: true,
          trailingStopPercent: isFutures ? 1.8 : 3.0,
          trailingActivationProfitPercent: isFutures ? 2.0 : 4.0,
          sizingMode: 'FIXED_PERCENT'
        };
      } else if (activeStr === 'BREAKOUT') {
        newConfig = {
          ...newConfig,
          timeframe: '30m',
          leverage: isFutures ? 4 : 1,
          tradeAllocationPercent: 20,
          minConfidence: 70,
          trailingStopEnabled: true,
          trailingStopPercent: isFutures ? 1.0 : 1.8,
          trailingActivationProfitPercent: isFutures ? 1.2 : 2.2,
          sizingMode: 'FIXED_PERCENT'
        };
      } else if (activeStr === 'MEAN_REVERSION') {
        newConfig = {
          ...newConfig,
          timeframe: '15m',
          leverage: isFutures ? 3 : 1,
          tradeAllocationPercent: 15,
          minConfidence: 68,
          trailingStopEnabled: true,
          trailingStopPercent: isFutures ? 0.9 : 1.6,
          trailingActivationProfitPercent: isFutures ? 1.1 : 2.0,
          sizingMode: 'FIXED_PERCENT'
        };
      } else if (activeStr === 'INSTITUTIONAL_SMC') {
        newConfig = {
          ...newConfig,
          timeframe: '1h',
          leverage: isFutures ? 2 : 1,
          tradeAllocationPercent: 25,
          minConfidence: 75,
          trailingStopEnabled: true,
          trailingStopPercent: isFutures ? 1.5 : 2.5,
          trailingActivationProfitPercent: isFutures ? 2.0 : 3.5,
          sizingMode: 'FIXED_PERCENT'
        };
      }
    } else if (currentPresets.length > 1) {
      // Multi-Strategy Mode (Adaptive)
      let maxLev = 1;
      if (isFutures) {
        if (currentPresets.includes('SCALPER')) maxLev = 5;
        else if (currentPresets.includes('BREAKOUT')) maxLev = 4;
        else if (currentPresets.includes('MOMENTUM')) maxLev = 3;
        else if (currentPresets.includes('MEAN_REVERSION')) maxLev = 3;
        else if (currentPresets.includes('SWING')) maxLev = 2;
        else if (currentPresets.includes('INSTITUTIONAL_SMC')) maxLev = 2;
        else maxLev = 3;
      }
      newConfig = {
        ...newConfig,
        timeframe: 'AUTO',
        leverage: maxLev,
        tradeAllocationPercent: 15, // Conservative sizing when running multiple
        minConfidence: 65,
        trailingStopEnabled: true,
        trailingStopPercent: isFutures ? 1.2 : 2.0,
        trailingActivationProfitPercent: isFutures ? 1.5 : 2.5,
        sizingMode: 'FIXED_PERCENT'
      };
    }
    
    onUpdateConfig(newConfig);
  };

  const handleToggleAll = (enable: boolean) => {
    const allPresets: Array<'MOMENTUM' | 'SCALPER' | 'SWING' | 'BREAKOUT' | 'MEAN_REVERSION' | 'INSTITUTIONAL_SMC'> = [
      'MOMENTUM', 'SCALPER', 'BREAKOUT', 'MEAN_REVERSION', 'INSTITUTIONAL_SMC', 'SWING'
    ];
    const newPresets = enable ? allPresets : [];
    
    // Sync to authoritative backend StrategyManager
    allPresets.forEach((strategyId) => {
      fetch('/api/strategies/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId, enabled: enable }),
      }).catch((err) => console.error('[StrategyManager] Failed to toggle strategy state:', err));
    });

    const isFutures = botConfig.marketType === 'FUTURES';
    onUpdateConfig({
      activePresets: newPresets,
      ...(newPresets.length === 0 && botConfig.enabled ? { enabled: false } : {}),
      timeframe: enable ? 'AUTO' : botConfig.timeframe,
      leverage: enable ? (isFutures ? 3 : 1) : botConfig.leverage,
      tradeAllocationPercent: enable ? 15 : botConfig.tradeAllocationPercent,
    });
  };

  const strategiesList = useMemo(() => [
    {
      id: 'MOMENTUM' as const,
      title: isArabic ? 'زخم الاتجاه الخوارزمي' : 'Momentum Trend Pro',
      badge: isArabic ? 'زخم وترند' : 'MOMENTUM',
      icon: Flame,
      color: {
        text: 'text-cyan-400',
        activeCard: 'border-cyan-500/50 bg-gradient-to-b from-cyan-500/[0.08] via-slate-900/90 to-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.12)]',
        activeIconBg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
        tagBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      },
      tagsFutures: ['3x Leverage', '1H Frame', 'ADX / RSI', 'Trailing 1.2%'],
      tagsSpot: ['1x Spot', '1H Frame', 'High TP', 'Trailing 2.5%'],
      desc: botConfig.marketType === 'FUTURES'
        ? (isArabic ? 'رافعة 3x • فريم 1H • تأكيد الزخم ADX/RSI • وقف متحرك 1.2%' : '3x Leverage • 1H Frame • ADX/RSI Confluence • Trailing 1.2%')
        : (isArabic ? 'تداول فوري • فريم 1H • أهداف ممتازة مع حجز ربح متحرك' : '1x Spot • 1H Frame • High targets with trailing profit taking.'),
    },
    {
      id: 'SCALPER' as const,
      title: isArabic ? 'سكالبينج عالي التردد' : 'High-Freq Scalper',
      badge: isArabic ? 'خاطف سريع' : 'SCALPER',
      icon: Zap,
      color: {
        text: 'text-cyan-400',
        activeCard: 'border-cyan-500/50 bg-gradient-to-b from-cyan-500/[0.08] via-slate-900/90 to-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.12)]',
        activeIconBg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
        tagBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      },
      tagsFutures: ['5x Leverage', '15m Frame', 'Tight SL', 'Fast TP'],
      tagsSpot: ['1x Spot', '15m Frame', 'Quick Rebound', 'Incremental'],
      desc: botConfig.marketType === 'FUTURES'
        ? (isArabic ? 'رافعة 5x • فريم 15m • صفقات خاطفة مع وقف خسارة ضيق' : '5x Leverage • 15m entries • Fast scalps tight stop')
        : (isArabic ? 'صفقات سريعة 15m • استهداف أرباح صغيرة متكررة' : '15m Spot entries • Fast incremental gains'),
    },
    {
      id: 'BREAKOUT' as const,
      title: isArabic ? 'قناص الاختراقات السعرية' : 'Breakout Sniper',
      badge: isArabic ? 'انفجار سعري' : 'BREAKOUT',
      icon: Target,
      color: {
        text: 'text-cyan-400',
        activeCard: 'border-cyan-500/50 bg-gradient-to-b from-cyan-500/[0.08] via-slate-900/90 to-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.12)]',
        activeIconBg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
        tagBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      },
      tagsFutures: ['4x Leverage', '30m Frame', 'Vol Spike', 'S/R Breakout'],
      tagsSpot: ['1x Spot', '30m Frame', 'Vol Expansion', 'Accumulation'],
      desc: botConfig.marketType === 'FUTURES'
        ? (isArabic ? 'رافعة 4x • فريم 30m • انفجار سعري عند كسر المقاومات بحجم تداول عالي' : '4x Leverage • 30m • High-volume support/resistance breakouts')
        : (isArabic ? 'فوري 30m • اقتناص الانفجارات السعرية بعد تجميع طويل' : '30m Spot • Range expansion breakouts with volume spikes'),
    },
    {
      id: 'MEAN_REVERSION' as const,
      title: isArabic ? 'ارتداد القمم والقيعان' : 'Mean Reversion Pro',
      badge: isArabic ? 'ارتداد تشبع' : 'REVERSION',
      icon: Activity,
      color: {
        text: 'text-cyan-400',
        activeCard: 'border-cyan-500/50 bg-gradient-to-b from-cyan-500/[0.08] via-slate-900/90 to-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.12)]',
        activeIconBg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
        tagBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      },
      tagsFutures: ['3x Leverage', '15m Frame', 'RSI Extrema', 'Bollinger Bounce'],
      tagsSpot: ['1x Spot', '15m Frame', 'Buy Dips', 'Quick Bounce'],
      desc: botConfig.marketType === 'FUTURES'
        ? (isArabic ? 'رافعة 3x • فريم 15m • ارتداد ذروة الشراء والبيع RSI وبولينجر باند' : '3x Leverage • 15m • Counter-trend RSI extremes & Bollinger bounces')
        : (isArabic ? 'اقتناص القيعان 15m • شراء عند ذروة البيع وبيع عند ذروة الشراء' : '15m Spot • Buy oversold dips and take quick rebounds'),
    },
    {
      id: 'INSTITUTIONAL_SMC' as const,
      title: isArabic ? 'صانع السوق المؤسسي (SMC)' : 'Smart Money SMC',
      badge: isArabic ? 'أموال ذكية' : 'SMART MONEY',
      icon: ShieldCheck,
      color: {
        text: 'text-cyan-400',
        activeCard: 'border-cyan-500/50 bg-gradient-to-b from-cyan-500/[0.08] via-slate-900/90 to-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.12)]',
        activeIconBg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
        tagBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      },
      tagsFutures: ['2x Leverage', '1H Frame', 'Order Blocks', 'FVG Zones'],
      tagsSpot: ['1x Spot', '1H Frame', 'Smart Money', 'Liquidity Pools'],
      desc: botConfig.marketType === 'FUTURES'
        ? (isArabic ? 'رافعة 2x • فريم 1H • تتبع صانع السوق وكتل الأوامر Order Blocks وFVG' : '2x Leverage • 1H • Institutional Order Blocks & Fair Value Gaps')
        : (isArabic ? 'تجميع مؤسسي 1H • أعلى نسبة دقة مع مناطق السيولة الكبرى' : '1H Spot • Smart Money accumulation zones with institutional bias'),
    },
    {
      id: 'SWING' as const,
      title: isArabic ? 'سوينغ محافظ ومستقر' : 'Conservative Swing',
      badge: isArabic ? 'سوينغ آمن' : 'SAFE SWING',
      icon: Shield,
      color: {
        text: 'text-cyan-400',
        activeCard: 'border-cyan-500/50 bg-gradient-to-b from-cyan-500/[0.08] via-slate-900/90 to-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.12)]',
        activeIconBg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
        tagBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      },
      tagsFutures: ['2x Leverage', '4H Frame', 'Min Drawdown', 'Trailing 1.8%'],
      tagsSpot: ['1x Spot', '4H Frame', 'Safe Storage', 'Wide Trailing'],
      desc: botConfig.marketType === 'FUTURES'
        ? (isArabic ? 'رافعة 2x • فريم 4H • استهداف قمم وقيعان المدى المتوسط بأمان' : '2x Leverage • Swing trades on 4H with lowest Drawdown')
        : (isArabic ? 'تخزين آمن 4H • ثقة عالية مع وقف خسارة واسع' : 'Safe accumulation 4H • High filter swing trades'),
    },
  ], [isArabic, botConfig.marketType]);

  const isLiveMode = executionMode === 'BINANCE_LIVE';
  
  const filteredPositions = activePositions.filter(p => isLiveMode ? p.mode === 'BINANCE_LIVE' : (!p.mode || p.mode === 'PAPER'));
  const displayPositions = filteredPositions.length > 0 ? filteredPositions : activePositions;
  const displayLogs = logs.filter(l => isLiveMode ? l.mode === 'BINANCE_LIVE' : (!l.mode || l.mode === 'PAPER'));
  const maxTradesLimit = Math.max(1, botConfig.maxOpenTrades || 3);
  const isAtMaxTrades = displayPositions.length >= maxTradesLimit;
  const isOverMaxTrades = displayPositions.length > maxTradesLimit;

  const metrics = calculatePortfolioMetrics(paperWallet, displayPositions, currentPrice, selectedSymbol);
  const floatingPnl = metrics.floatingPnl;

  const totalEquity = isLiveMode && binanceConfig?.accountInfo?.totalUsdtEquity !== undefined
    ? binanceConfig.accountInfo.totalUsdtEquity
    : metrics.totalEquity;

  // Live calculation helper for Futures / Spot positions
  const getPositionMetrics = (pos: ActiveBotPosition) => {
    const p = pos.symbol.toLowerCase() === selectedSymbol.toLowerCase() && currentPrice > 0 ? currentPrice : (pos.currentPrice || pos.entryPrice);
    const isLong = pos.decision === 'LONG';
    const lev = Math.max(1, pos.leverage || 1);
    const priceDiffPct = ((p - pos.entryPrice) / pos.entryPrice) * (isLong ? 1 : -1) * 100;
    const roePercent = priceDiffPct * lev;
    const margin = typeof pos.remainingAmountUsdt === 'number' && pos.remainingAmountUsdt >= 0
      ? pos.remainingAmountUsdt
      : (pos.marginUsdt || pos.initialAmountUsdt || 0);
    const usdt = calculatePositionUnrealizedPnl(pos, p);

    // Distance to liquidation %
    let distanceToLiqPct: number | null = null;
    if (pos.liquidationPrice && pos.liquidationPrice > 0) {
      distanceToLiqPct = Math.abs((p - pos.liquidationPrice) / p) * 100;
    }

    return { 
      roePercent, 
      priceDiffPct, 
      usdt, 
      currentP: p,
      margin,
      positionSizeUsdt: margin * lev,
      distanceToLiqPct
    };
  };

  // Performance Stats Calculation based on wallet and trade logs
  const totalRealizedPnl = (paperWallet?.realizedPnl !== undefined && typeof paperWallet.realizedPnl === 'number')
    ? paperWallet.realizedPnl
    : displayLogs.reduce((acc, log) => acc + (log.pnlUsdt || 0), 0);

  const tradeCloseLogs = displayLogs.filter(log => 
    log.type.includes('SELL') || 
    log.type.includes('SL') || 
    log.type.includes('TP') || 
    log.type.includes('LIQUIDATION') ||
    (log.pnlUsdt !== undefined && log.pnlUsdt !== 0)
  );
  const winningTrades = tradeCloseLogs.filter(log => (log.pnlUsdt || 0) > 0).length;
  const losingTrades = tradeCloseLogs.filter(log => (log.pnlUsdt || 0) <= 0).length;
  const totalTradesCount = winningTrades + losingTrades;
  const winRate = totalTradesCount > 0 ? ((winningTrades / totalTradesCount) * 100).toFixed(1) : '0.0';

  const renderActiveCard = (activePosition: ActiveBotPosition, index: number) => {
    const metrics = getPositionMetrics(activePosition);
    const liveRoePercent = metrics.roePercent;
    const livePnlUsdt = metrics.usdt;
    const lev = activePosition.leverage || 1;
    const isFutures = (activePosition.marketType || 'FUTURES') === 'FUTURES';

    return (
      <div key={activePosition.id} className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Glow Header Accent */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${
          activePosition.decision === 'LONG' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-amber-500'
        }`} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl font-bold flex items-center gap-1.5 text-xs ${
              activePosition.decision === 'LONG'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/10'
            }`}>
              {activePosition.decision === 'LONG' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>
                {isFutures 
                  ? `${lev}x ${activePosition.decision}` 
                  : (activePosition.decision === 'LONG' ? (isArabic ? 'شراء فوري (Spot BUY)' : 'SPOT BUY') : (isArabic ? 'بيع فوري (Spot SELL)' : 'SPOT SELL'))} {activePosition.symbol}
              </span>
            </div>

            <div>
              <div className="flex items-center flex-wrap gap-2 mb-0.5">
                <span className="text-xs text-cyan-400 font-bold">
                  {isFutures 
                    ? (isArabic ? `عقد آجل #${index + 1}` : (isEn ? `Futures Contract #${index + 1}` : `Contrat Futures #${index + 1}`))
                    : (isArabic ? `صفقة تداول فوري #${index + 1}` : (isEn ? `Spot Trade #${index + 1}` : `Ordre Spot #${index + 1}`))}
                </span>
                {isFutures ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {activePosition.marginMode || 'ISOLATED'}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                    {isArabic ? 'تداول فوري (1x Spot)' : 'SPOT (1x)'}
                  </span>
                )}
                {activePosition.strategyName && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    {activePosition.strategyName}
                  </span>
                )}
                {activePosition.isTrailingActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>{isArabic ? 'الوقف المتحرك نشط' : 'Trailing SL'}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>
                  {isFutures ? (isArabic ? `الهامش المودع:` : `Margin:`) : (isArabic ? `قيمة الأصل المشتري:` : `Purchased Value:`)} <strong className="text-white font-mono">${metrics.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</strong>
                </span>
                {isFutures && (
                  <>
                    <span className="text-slate-600">|</span>
                    <span>
                      {isArabic ? `حجم العقد الإجمالي:` : `Notional Size:`} <strong className="text-cyan-300 font-mono">${metrics.positionSizeUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({lev}x)</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">{isFutures ? (isArabic ? 'العائد على الهامش (ROE %)' : 'Return on Equity (ROE)') : (isArabic ? 'ربح / خسارة الصفقة' : 'Spot PnL')}</span>
              <div className={`text-base sm:text-lg font-mono font-bold flex items-center justify-end gap-1 ${
                liveRoePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {liveRoePercent >= 0 ? '+' : ''}{liveRoePercent.toFixed(2)}% {isFutures ? 'ROE' : ''}
                <span className="text-xs opacity-90 font-mono">
                  ({livePnlUsdt >= 0 ? '+' : ''}${livePnlUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              </div>
            </div>
            <button
              onClick={() => onManualClosePosition(activePosition.id)}
              className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition shadow-lg shadow-rose-500/10 cursor-pointer"
              title={isFutures ? 'Close Futures Position' : 'Sell Spot Asset'}
            >
              {isFutures ? (isArabic ? 'إغلاق فوري للعقد' : 'Close Position') : (isArabic ? 'بيع فوري للسبوت' : 'Sell Spot')}
            </button>
          </div>
        </div>

        {/* Stepper Progress & Protection Gauge */}
        <div className="my-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isFutures ? (isArabic ? 'مسار الأهداف ومستويات الوقف والتصفية' : 'Futures Targets & Liquidation Guard') : (isArabic ? 'مسار الأهداف وحماية رأس المال' : 'Spot Targets & Capital Guard')}</span>
            </span>
            <span className="text-[11px] text-cyan-300 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {activePosition.lastAction || 'Active'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
            {/* 1. Entry & Live Price */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
                <span>{isArabic ? 'الدخول / الحالي' : 'Entry / Current'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <div className="font-bold text-white font-mono">${formatCoinPrice(activePosition.entryPrice, activePosition.symbol)}</div>
              <div className="text-[10px] text-cyan-300 font-mono mt-0.5 flex items-center justify-between">
                <span>${formatCoinPrice(metrics.currentP, activePosition.symbol)}</span>
                <span className="text-slate-400">{isFutures ? `$${metrics.margin.toFixed(0)} Mgn` : '1x Spot'}</span>
              </div>
            </div>

            {/* 2. TP1 */}
            <div className={`p-2.5 rounded-xl border transition ${
              activePosition.tp1Hit 
                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
                <span>1. TP1 (50%)</span>
                {activePosition.tp1Hit ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Target className="w-3 h-3 text-slate-500" />}
              </div>
              <div className="font-bold font-mono">${formatCoinPrice(activePosition.tp1, activePosition.symbol)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {activePosition.tp1Hit ? (isArabic ? 'جني 50% ونقل SL' : '50% Secured') : (isArabic ? 'جني نصف العقد' : 'Scale 50%')}
              </div>
            </div>

            {/* 3. TP2 */}
            <div className={`p-2.5 rounded-xl border transition ${
              activePosition.tp2Hit 
                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
                <span>2. TP2 (50% reste)</span>
                {activePosition.tp2Hit ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Target className="w-3 h-3 text-slate-500" />}
              </div>
              <div className="font-bold font-mono">${formatCoinPrice(activePosition.tp2, activePosition.symbol)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {activePosition.tp2Hit ? (isArabic ? 'تم بنجاح' : 'Hit') : (isArabic ? 'الهدف الثاني' : 'Target 2')}
              </div>
            </div>

            {/* 4. TP3 (Max Target / Runner) */}
            <div className={`p-2.5 rounded-xl border transition ${
              activePosition.tp3Hit 
                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
                <span>3. TP3 (Max)</span>
                {activePosition.tp3Hit ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Target className="w-3 h-3 text-purple-400" />}
              </div>
              <div className="font-bold font-mono text-purple-200">
                ${formatCoinPrice(activePosition.tp3 || (activePosition.tp2 ? activePosition.tp2 * 1.02 : activePosition.entryPrice * 1.05), activePosition.symbol)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {activePosition.tp3Hit ? (isArabic ? 'الهدف الأقصى' : 'Max Hit') : (isArabic ? 'الهدف الأقصى' : 'Final Target')}
              </div>
            </div>

            {/* 5. Stop Loss / Trailing Stop */}
            <div className={`p-2.5 rounded-xl border ${
              activePosition.isTrailingActive 
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300' 
                : 'bg-slate-950 border-rose-500/30'
            }`}>
              <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5">
                <span>
                  {activePosition.isTrailingActive 
                    ? (isArabic ? 'الوقف المتحرك' : 'Trailing SL')
                    : (activePosition.tp1Hit ? 'Breakeven' : (isArabic ? 'وقف الخسارة' : 'Stop Loss'))}
                </span>
                {activePosition.isTrailingActive ? <Zap className="w-3 h-3 text-amber-400" /> : <ShieldAlert className="w-3 h-3 text-rose-400" />}
              </div>
              <div className="font-bold text-rose-300 font-mono">${formatCoinPrice(activePosition.stopLoss, activePosition.symbol)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {activePosition.isTrailingActive
                  ? (isArabic ? 'أرباح مؤمنة' : 'Locked')
                  : activePosition.tp1Hit 
                  ? (isArabic ? '0$ مخاطرة' : 'Risk-Free') 
                  : (isArabic ? 'حماية' : 'SL')}
              </div>
            </div>

            {/* 6. Liquidation Price Level (Futures) OR Spot Asset Security (Spot) */}
            {isFutures ? (
              <div className="bg-rose-950/20 border border-rose-500/40 p-2.5 rounded-xl text-rose-200">
                <div className="flex items-center justify-between text-rose-400 text-[10px] mb-0.5 font-bold">
                  <span>{isArabic ? 'سعر التصفية (Liq)' : 'Liq Price'}</span>
                  <ShieldAlert className="w-3 h-3 text-rose-400 animate-pulse" />
                </div>
                <div className="font-bold text-white font-mono">
                  {activePosition.liquidationPrice ? `$${formatCoinPrice(activePosition.liquidationPrice, activePosition.symbol)}` : 'N/A'}
                </div>
                <div className="text-[10px] text-rose-300 mt-0.5 font-mono">
                  {metrics.distanceToLiqPct !== null 
                    ? (isArabic ? `يبعد ${metrics.distanceToLiqPct.toFixed(1)}%` : `${metrics.distanceToLiqPct.toFixed(1)}% away`)
                    : (isArabic ? 'آمن جداً' : 'Safe')}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/25 border border-emerald-500/40 p-2.5 rounded-xl text-emerald-200">
                <div className="flex items-center justify-between text-emerald-400 text-[10px] mb-0.5 font-bold">
                  <span>{isArabic ? 'حماية السبوت' : (isEn ? 'Spot Security' : 'Sécurité Spot')}</span>
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="font-bold text-emerald-300 font-mono text-xs">
                  {isArabic ? 'بدون تصفية (0% Liq)' : '100% Asset Ownership'}
                </div>
                <div className="text-[10px] text-emerald-400/90 mt-0.5 font-sans">
                  {isArabic ? 'أصل مملوك بالكامل' : (isEn ? 'No Liquidation Risk' : 'Sans Liquidation')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* Circuit Breaker Tripped Guard Banner */}
      {botConfig.circuitBreakerTripped && (
        <div className="p-4 bg-rose-950/60 border-2 border-rose-500 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-200 shadow-xl animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-sm text-white">
                {isArabic ? 'تم تفعيل قاطع الحماية المؤسسي (Circuit Breaker Tripped)' : 'Institutional Circuit Breaker Tripped'}
              </div>
              <div className="text-xs text-rose-300 mt-0.5">
                {isArabic 
                  ? `تم إيقاف فتح صفقات جديدة آلياً بعد الوصول للحد الأقصى اليومي للخسارة (${botConfig.dailyDrawdownLimitPercent}%). رأس مالك محمي.` 
                  : `Automated entries paused after hitting max daily loss limit (${botConfig.dailyDrawdownLimitPercent}%). Your capital is protected.`}
              </div>
            </div>
          </div>
          {onResetCircuitBreaker && (
            <button
              onClick={onResetCircuitBreaker}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shrink-0 transition shadow-lg shadow-rose-600/30"
            >
              {isArabic ? 'إلغاء التجميد واستئناف الحماية' : 'Reset Shield & Resume'}
            </button>
          )}
        </div>
      )}

      {/* Bot Master Control Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col gap-5">
          {/* Bot Title & Status Header with Sentimental Robot Avatar */}
          <div className="flex items-start sm:items-center gap-3.5">
            <SentimentalBotAvatar
              enabled={botConfig.enabled}
              floatingPnlUsdt={floatingPnl}
              realizedPnlUsdt={totalRealizedPnl}
              circuitBreakerTriggered={botConfig.circuitBreakerTripped}
              marketSentiment={activeSignal?.bias || (activeSignal?.decision === 'LONG' ? 'BULLISH' : activeSignal?.decision === 'SHORT' ? 'BEARISH' : 'NEUTRAL')}
              marketRegime={activeSignal?.marketRegime}
              activePositionsCount={displayPositions.length}
              signalDecision={activeSignal?.decision}
              confidence={activeSignal?.confidence}
              language={language}
              showMoodBadge={false}
              size="md"
            />

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <span className="text-white">
                      Moteur Quantitatif IA
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-black uppercase tracking-wider flex items-center gap-1">
                      <span>BOT</span>
                      <Zap className="w-3 h-3 text-amber-400" />
                    </span>
                  </h2>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-mono ${
                  botConfig.enabled 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {botConfig.enabled 
                    ? (isArabic ? 'نشط ويعمل كمياً' : 'ACTIVE') 
                    : (isArabic ? 'متوقف' : 'PAUSED')}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>{botConfig.marketType === 'SPOT' ? 'SPOT 1x' : `FUTURES ${botConfig.leverage || 10}x [${botConfig.marginMode || 'ISOLATED'}]`}</span>
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {botConfig.timeframe === 'AUTO' 
                      ? (isArabic ? `فريم تلقائي ذكي [${effectiveBotTimeframe.toUpperCase()}]` : `Dynamic AUTO [${effectiveBotTimeframe.toUpperCase()}]`)
                      : (isArabic ? `استراتيجية فريم ${botConfig.timeframe?.toUpperCase() || '1H'}` : `${botConfig.timeframe?.toUpperCase() || '1H'} Strategy`)}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                {isArabic 
                  ? `محرك خوارزمي كمي مؤسسي مدعوم بنماذج الذكاء الاصطناعي لتداول عقود ${botConfig.marketType === 'SPOT' ? 'Spot' : 'Futures'} ${botConfig.timeframe === 'AUTO' ? `بفريم تكيفي ذكي (${effectiveBotTimeframe.toUpperCase()})` : `على فريم (${botConfig.timeframe?.toUpperCase() || '1H'})`} مع جدار حماية محرك إدارة المخاطر، وجني أرباح ذكي (Scale-Out) ووقف خسارة متحرك.` 
                  : `Moteur algorithmique & quantitatif propulsé par l'IA pour les contrats ${botConfig.marketType === 'SPOT' ? 'Spot' : 'Futures'} ${botConfig.timeframe === 'AUTO' ? `en timeframe adaptatif (${effectiveBotTimeframe.toUpperCase()})` : `sur le timeframe ${botConfig.timeframe?.toUpperCase() || '1H'}`} avec protection Risk Engine, scale-out profit et trailing SL.`}
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar: Exact 2 Lines x 2 Columns (2 Rows, 2 Cols) */}
          <div 
            className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          >
            {/* Line 1 - Column 1: Start / Stop Bot */}
            <button
              id="btn-bot-toggle-main"
              onClick={onToggleBot}
              className={`h-9 sm:h-10 px-2 sm:px-3 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border min-w-0 ${
                botConfig.enabled
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
              }`}
              title={botConfig.enabled ? (isArabic ? 'إيقاف البوت' : 'Stop Bot') : (isArabic ? 'تشغيل البوت التلقائي' : 'Start Bot')}
            >
              {botConfig.enabled ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span className="truncate font-mono uppercase tracking-wide">
                    {isArabic ? 'إيقاف البوت' : isEn ? 'Stop Bot' : 'Arrêter Bot'}
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span className="truncate font-mono uppercase tracking-wide">
                    {isArabic ? 'تشغيل البوت' : isEn ? 'Start Bot' : 'Lancer Bot'}
                  </span>
                </>
              )}
            </button>

            {/* Line 1 - Column 2: Emergency Close All */}
            <button
              id="btn-bot-close-all"
              onClick={() => {
                if (displayPositions.length > 0 && onPanicCloseAll) {
                  onPanicCloseAll();
                }
              }}
              disabled={displayPositions.length === 0}
              className={`h-9 sm:h-10 px-2 sm:px-3 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors min-w-0 ${
                displayPositions.length > 0
                  ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-200 border-rose-600 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
              }`}
              title={isArabic ? 'إغلاق وتصفية جميع الصفقات المفتوحة فورياً' : isEn ? 'Emergency Close All Positions' : 'Clôturer d\'urgence toutes les positions'}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate font-mono flex items-center gap-1">
                <span>{isArabic ? `إغلاق (${displayPositions.length})` : `Close (${displayPositions.length})`}</span>
              </span>
            </button>

            {/* Line 2 - Column 1: Binance API Connection */}
            {onOpenBinanceModal ? (
              <button
                id="btn-bot-binance-modal"
                onClick={onOpenBinanceModal}
                className={`h-9 sm:h-10 px-2 sm:px-3 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-0 ${
                  executionMode === 'BINANCE_LIVE'
                    ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-600'
                    : 'bg-slate-800 hover:bg-slate-750 text-amber-300 border-slate-700'
                }`}
                title={isArabic ? 'إعدادات ربط Binance API' : isEn ? 'Binance API Connection' : 'Connexion API Binance'}
              >
                <Key className={`w-3.5 h-3.5 shrink-0 ${executionMode === 'BINANCE_LIVE' ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="truncate font-mono flex items-center gap-1">
                  <span>{executionMode === 'BINANCE_LIVE' ? 'Binance Live' : 'Binance API'}</span>
                </span>
              </button>
            ) : (
              <div className="h-9 sm:h-10 px-2 sm:px-3 rounded-lg sm:rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center text-[11px] sm:text-xs font-mono text-slate-500 min-w-0">
                <span className="truncate">Binance Local</span>
              </div>
            )}

            {/* Line 2 - Column 2: Leverage & Bot Config */}
            <button
              id="btn-bot-config-modal"
              onClick={() => setShowConfigModal(true)}
              className="h-9 sm:h-10 px-2 sm:px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg sm:rounded-xl border border-slate-700 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-0"
              title={isArabic ? 'إعدادات الرافعة وإدارة المخاطر' : isEn ? 'Bot Settings & Leverage' : 'Paramètres & Levier du Bot'}
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate font-mono">
                {isArabic ? (botConfig.marketType === 'SPOT' ? 'إعدادات البوت' : 'الرافعة والإعدادات') : 'Config'}
              </span>
            </button>
          </div>
        </div>

        {/* Quantitative Features Status Badges */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-cyan-800/40 flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isArabic ? 'فريم البوت:' : 'Bot Timeframe:'}</span>
            <span className="font-bold text-cyan-300 font-mono">
              {botConfig.timeframe === 'AUTO' 
                ? `AUTO (${effectiveBotTimeframe.toUpperCase()})` 
                : (botConfig.timeframe?.toUpperCase() || '1H')}
            </span>
            {botConfig.timeframe === 'AUTO' && (
              <span className="px-1.5 py-0.5 text-[9px] bg-cyan-900/60 text-cyan-200 rounded font-sans border border-cyan-700/50">
                {isArabic ? 'متكيف ذكياً' : 'Adaptive'}
              </span>
            )}
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{isArabic ? 'الرافعة المالية:' : 'Leverage:'}</span>
            <span className="font-bold text-amber-300 font-mono">{botConfig.marketType === 'SPOT' ? '1x Spot' : `${botConfig.leverage || 10}x (${botConfig.marginMode || 'ISOLATED'})`}</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-slate-300">
            <Zap className={`w-3.5 h-3.5 ${botConfig.trailingStopEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>{isArabic ? 'الوقف المتحرك:' : 'Trailing SL:'}</span>
            <span className="font-bold text-white font-mono">{botConfig.trailingStopEnabled ? `${botConfig.trailingStopPercent || 1.2}%` : (isArabic ? 'معطل' : 'Off')}</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isArabic ? 'قاطع الحماية:' : 'Circuit Breaker:'}</span>
            <span className="font-bold text-white font-mono">-{botConfig.dailyDrawdownLimitPercent || 5.0}% Max</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-slate-300">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isArabic ? 'الهامش المخصص:' : 'Margin:'}</span>
            <span className="font-bold text-white font-mono">
              {botConfig.sizingMode === 'RISK_BASED' 
                ? (isArabic ? `مخاطرة ${botConfig.riskPerTradePercent || 2}%` : `Risk ${botConfig.riskPerTradePercent || 2}%`) 
                : `${botConfig.tradeAllocationPercent}% Eq`}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-slate-300">
            <Target className="w-3.5 h-3.5 text-brand-400" />
            <span>{isArabic ? 'الصفقات المتزامنة:' : 'Max Slots:'}</span>
            <span className={`font-bold font-mono ${isOverMaxTrades ? 'text-rose-400' : 'text-white'}`}>
              {displayPositions.length}/{maxTradesLimit}
            </span>
          </div>
        </div>
      </div>

      {/* Bot Strategy Presets & Authorization Matrix */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5">
        
        {/* Header with Title and Mode Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-white text-base tracking-tight flex items-center gap-2">
                <span>{isArabic ? 'قارئ السوق الذكي ومصفوفة الاستراتيجيات' : 'AI Market Reader & Strategy Matrix'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {isArabic ? 'مطابقة ذكية للبيئة' : 'Auto-Matched'}
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              {isArabic 
                ? 'يقرأ البوت ظروف السوق اللحظية (الاتجاه، الزخم، التذبذب والسيولة) لاختيار الاستراتيجية الأكثر ملاءمة تلقائياً'
                : 'The bot analyzes real-time market dynamics (regime, momentum, volatility, SMC) to auto-select the best fitting strategy'}
            </p>
          </div>

          {/* Quick Actions & Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Auto Adaptive Mode Toggle */}
            <button
              type="button"
              onClick={() => onUpdateConfig({ autoAdaptiveStrategy: !botConfig.autoAdaptiveStrategy })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ${
                botConfig.autoAdaptiveStrategy !== false
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title={isArabic ? 'تفعيل التكيف التلقائي مع تغيرات السوق' : 'Enable Auto-Adaptive Market Mode'}
            >
              <Radar className={`w-3.5 h-3.5 ${botConfig.autoAdaptiveStrategy !== false ? 'text-cyan-400 animate-spin' : 'text-slate-400'}`} style={{ animationDuration: '8s' }} />
              <span>{isArabic ? 'النمط التكيفي التلقائي' : 'Auto-Adaptive'}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${botConfig.autoAdaptiveStrategy !== false ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
            </button>

            {/* Quick Toggle All Buttons */}
            <button
              type="button"
              onClick={() => handleToggleAll(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              title={isArabic ? 'تفعيل جميع الاستراتيجيات الست' : 'Activate All Strategies'}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isArabic ? 'تفعيل الكل' : 'Activate All'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleAll(false)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              title={isArabic ? 'إيقاف وتعطيل جميع الاستراتيجيات' : 'Disable All Strategies'}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isArabic ? 'إيقاف الكل' : 'Disable All'}</span>
            </button>

            {/* Active Count Badge */}
            <span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono border flex items-center gap-2 shadow-sm ${
              (botConfig.activePresets?.length || 0) > 0 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
            }`}>
              {(botConfig.activePresets?.length || 0) > 0 ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>{botConfig.activePresets?.length} / 6 {isArabic ? 'نشطة' : 'Active'}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>0 / 6 {isArabic ? 'معطلة (متوقف)' : 'All Paused'}</span>
                </>
              )}
            </span>

            <span className="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono bg-brand-500/15 text-brand-300 border border-brand-500/30">
              {botConfig.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT'}
            </span>
          </div>
        </div>

        {/* AI Market Pulse & Auto-Matched Recommendation Banner */}
        <div className="rounded-xl p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border border-cyan-500/30 relative overflow-hidden shadow-[0_0_24px_rgba(6,182,212,0.08)]">
          <div className="absolute top-0 right-0 w-64 h-32 bg-cyan-500/10 blur-3xl pointer-events-none rounded-full" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            {/* Left: Market Diagnostics Summary */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>{isArabic ? 'تشخيص السوق الآلي:' : 'Market Diagnostics:'}</span>
                  <span className="text-white">
                    {marketAnalysisData.regime === 'TRENDING_BULLISH' ? (isArabic ? 'اتجاه صاعد قوي' : 'Bullish Trend')
                      : marketAnalysisData.regime === 'TRENDING_BEARISH' ? (isArabic ? 'اتجاه هابط قوي' : 'Bearish Trend')
                      : marketAnalysisData.regime === 'HIGH_VOLATILITY' ? (isArabic ? 'تقلبات مرتفعة' : 'High Volatility')
                      : marketAnalysisData.regime === 'RANGING' ? (isArabic ? 'نطاق عرضي متذبذب' : 'Ranging Market')
                      : (isArabic ? 'سوق مستقر' : 'Stable Market')}
                  </span>
                </span>

                <span className="text-[11px] font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  ADX: <span className="font-bold text-cyan-300">{marketAnalysisData.adx.toFixed(1)}</span>
                </span>
                <span className="text-[11px] font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  RSI: <span className="font-bold text-amber-300">{marketAnalysisData.rsi.toFixed(1)}</span>
                </span>
                <span className="text-[11px] font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  BB Width: <span className="font-bold text-emerald-300">{marketAnalysisData.bbBandwidth.toFixed(1)}%</span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>
                  {isArabic ? 'الاستراتيجية الأنسب فورياً وفق معايير السوق:' : 'Optimal strategy based on market metrics:'}
                </span>
                <span className="font-bold text-white bg-slate-800/90 px-2 py-0.5 rounded font-mono border border-cyan-500/30 text-cyan-300">
                  {marketAnalysisData.topStrategyId} ({marketAnalysisData.topScore}% {isArabic ? 'تطابق' : 'Match'})
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isArabic ? marketAnalysisData.topAnalysis.primaryReasonAr : marketAnalysisData.topAnalysis.primaryReasonFr}
              </p>
            </div>

            {/* Right: Quick 1-Click Apply Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSelectOptimalStrategy(marketAnalysisData.topStrategyId)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95 cursor-pointer font-sans"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>
                  {isArabic ? 'تطبيق الاستراتيجية الأنسب فورياً' : 'Apply Optimal Strategy'}
                </span>
                <span className="font-mono bg-black/20 px-1.5 py-0.5 rounded text-[10px]">
                  {marketAnalysisData.topScore}%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Zero Active Strategies Warning Banner */}
        {(!botConfig.activePresets || botConfig.activePresets.length === 0) && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-relaxed">
              {isArabic 
                ? 'قانون الأمان الصارم: جميع الاستراتيجيات معطلة حالياً. محرك التداول متوقف بالكامل ولن يولد إشارات أو يفتح صفقات حتى تفعيل استراتيجية واحدة على الأقل أدناه.' 
                : 'Zero Active Strategies Rule: Trading Engine is strictly locked. No market analysis, signals, or orders will execute until at least one strategy is activated below.'}
            </span>
          </div>
        )}
        
        {/* Modern Strategy Cards Grid with Live AI Match Scoring */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategiesList.map((strat) => {
            const isActive = botConfig.activePresets?.includes(strat.id);
            const StratIcon = strat.icon;
            const currentTags = botConfig.marketType === 'FUTURES' ? strat.tagsFutures : strat.tagsSpot;
            const stratScoreData = marketAnalysisData.scores[strat.id];
            const isTopMatch = strat.id === marketAnalysisData.topStrategyId;

            return (
              <div
                key={strat.id}
                className={`rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 border relative overflow-hidden group ${
                  isTopMatch
                    ? 'border-cyan-400/60 bg-gradient-to-b from-cyan-950/30 via-slate-900/90 to-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.18)]'
                    : isActive
                    ? strat.color.activeCard
                    : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700/90 hover:bg-slate-900/40 shadow-sm'
                }`}
              >
                {/* Subtle Ambient Top Accent Glow */}
                {(isActive || isTopMatch) && (
                  <div className={`absolute -top-12 left-1/2 -translate-x-1/2 w-36 h-20 blur-2xl pointer-events-none rounded-full ${
                    isTopMatch ? 'bg-cyan-400/20' : 'bg-emerald-500/10'
                  }`} />
                )}

                <div>
                  {/* Top Match Banner Pill if this is the AI Recommended Strategy */}
                  {isTopMatch && (
                    <div className="mb-3 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500/20 via-emerald-500/15 to-cyan-500/10 border border-cyan-400/40 text-cyan-300 text-[10px] font-bold flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-cyan-300 animate-pulse" />
                        <span>{isArabic ? 'الأنسب لظروف السوق حالياً' : 'AI Market Match'}</span>
                      </div>
                      <span className="font-mono text-white bg-cyan-500/30 px-1.5 py-0.2 rounded text-[9px]">
                        {stratScoreData?.score ?? 95}% {isArabic ? 'توافق' : 'Fit'}
                      </span>
                    </div>
                  )}

                  {/* Card Header: Icon, Titles & Status */}
                  <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border shrink-0 ${
                          isTopMatch
                            ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-300 shadow-[0_0_14px_rgba(6,182,212,0.3)]'
                            : isActive
                            ? strat.color.activeIconBg
                            : 'bg-slate-800/80 text-slate-400 border-slate-700'
                        }`}
                      >
                        <StratIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-sm text-slate-100 truncate group-hover:text-white transition-colors">
                            {strat.title}
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono tracking-wider font-semibold text-slate-400 block uppercase">
                          {strat.badge}
                        </span>
                      </div>
                    </div>

                    {/* Top Status Pill & Score */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0 flex items-center gap-1.5 transition-colors ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700/80'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{isArabic ? 'نشط' : 'ACTIVE'}</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            <span>{isArabic ? 'متوقف' : 'PAUSED'}</span>
                          </>
                        )}
                      </span>

                      {!isTopMatch && stratScoreData && (
                        <span className="text-[9px] font-mono text-slate-400">
                          {stratScoreData.score}% {isArabic ? 'توافق' : 'fit'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Market Criteria Tags Chips */}
                  {stratScoreData && (stratScoreData.criteriaTagsAr.length > 0 || stratScoreData.criteriaTagsFr.length > 0) && (
                    <div className="flex flex-wrap gap-1 mb-2.5 relative z-10">
                      {(isArabic ? stratScoreData.criteriaTagsAr : stratScoreData.criteriaTagsFr).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-slate-800/90 text-cyan-300 border border-slate-700/80"
                        >
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Parameter Tags Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3 relative z-10">
                    {currentTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border transition-colors ${
                          isActive
                            ? strat.color.tagBg
                            : 'bg-slate-900/90 text-slate-400 border-slate-800'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4 relative z-10 line-clamp-2">
                    {strat.desc}
                  </p>
                </div>

                {/* Modern Interactive Strategy Action Button */}
                <button
                  type="button"
                  onClick={() => handleApplyStrategy(strat.id)}
                  className={`w-full relative overflow-hidden rounded-xl p-2.5 sm:p-3 font-sans transition-all duration-300 border flex items-center justify-between group/btn cursor-pointer select-none relative z-10 active:scale-[0.98] ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-950/40 via-emerald-900/25 to-slate-900/90 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.12)] hover:border-rose-500/50 hover:bg-rose-950/20 hover:shadow-[0_0_20px_rgba(244,63,94,0.18)]'
                      : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-700/80 hover:border-cyan-500/50 text-slate-300 hover:text-white shadow-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                  }`}
                >
                  {/* Left: Tactical Icon & Status Label */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 border shrink-0 ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 group-hover/btn:bg-rose-500/20 group-hover/btn:text-rose-400 group-hover/btn:border-rose-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700 group-hover/btn:bg-cyan-500/20 group-hover/btn:text-cyan-400 group-hover/btn:border-cyan-500/30'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Power className="w-3.5 h-3.5 group-hover/btn:hidden" />
                          <X className="w-3.5 h-3.5 hidden group-hover/btn:block" />
                        </>
                      ) : (
                        <Power className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                      )}
                    </div>

                    <div className="text-left rtl:text-right">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-bold tracking-tight transition-colors ${
                            isActive
                              ? 'text-emerald-300 group-hover/btn:hidden'
                              : 'text-slate-200 group-hover/btn:text-white'
                          }`}
                        >
                          {isActive
                            ? (isArabic ? 'الاستراتيجية مفعلة' : 'STRATEGY ACTIVE')
                            : (isArabic ? 'تفعيل الاستراتيجية' : 'ACTIVATE STRATEGY')}
                        </span>
                        {isActive && (
                          <span className="text-xs font-bold tracking-tight text-rose-300 hidden group-hover/btn:inline">
                            {isArabic ? 'إيقاف / تعطيل' : 'CLICK TO DISABLE'}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {isActive
                          ? (isArabic ? '● تعمل في الرصد والتداول' : '● Scanning & Executing')
                          : (isArabic ? '○ متوقفة (انقر للتشغيل)' : '○ Standby Mode')}
                      </span>
                    </div>
                  </div>

                  {/* Right: Modern Switch Pill */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 flex items-center border ${
                        isActive
                          ? 'bg-emerald-500 border-emerald-400 justify-end group-hover/btn:bg-rose-500/80 group-hover/btn:border-rose-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                          : 'bg-slate-800 border-slate-700 justify-start group-hover/btn:border-cyan-500/50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center transform transition-transform duration-300 ${
                          isActive
                            ? 'scale-100 text-emerald-600 group-hover/btn:text-rose-600'
                            : 'scale-90 text-slate-400'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 group-hover/btn:hidden" />
                            <X className="w-3.5 h-3.5 hidden group-hover/btn:block" />
                          </>
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Portfolio Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 relative group">
          <div className="text-slate-400 text-xs mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-brand-400" />
              <span>{isArabic ? 'إجمالي رصيد العقود (Equity)' : 'Futures Wallet Equity'}</span>
            </div>
            {!isLiveMode && onOpenCustomBalanceModal && (
              <button
                onClick={onOpenCustomBalanceModal}
                className="text-[10px] text-brand-400 hover:text-brand-300 font-mono font-bold bg-brand-500/10 hover:bg-brand-500/20 px-1.5 py-0.5 rounded border border-brand-500/30 transition flex items-center gap-1"
                title={isArabic ? 'تعديل الرصيد الوهمي' : 'Modifier le solde virtuel'}
              >
                <span>{isArabic ? 'تعديل' : 'Éditer'}</span>
              </button>
            )}
          </div>
          <div className="text-base sm:text-lg font-bold text-white font-mono">
            ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-800/80 flex items-center justify-between font-mono">
            <span title={isArabic ? 'السيولة المتاحة لفتح صفقات جديدة' : 'Free Cash Available'}>
              {isArabic ? 'المتاح:' : 'Free:'} <span className="text-emerald-400 font-bold">${metrics.freeCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </span>
            {displayPositions.length > 0 && (
              <span title={isArabic ? 'الهامش المحجوز في الصفقات النشطة' : 'Margin locked in trades'}>
                {isArabic ? 'محجوز:' : 'Margin:'} <span className="text-amber-400 font-bold">${metrics.inTradeMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </span>
            )}
            {floatingPnl !== 0 && (
              <span title={isArabic ? 'الأرباح/الخسائر العائمة' : 'Floating PnL'}>
                {isArabic ? 'عائم:' : 'PnL:'} <span className={`font-bold ${floatingPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {floatingPnl >= 0 ? '+' : ''}${floatingPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isArabic ? 'الأرباح المحققة (Logs)' : 'Total Realized P&L'}</span>
          </div>
          <div className={`text-base sm:text-lg font-bold font-mono ${totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {winningTrades} {isArabic ? 'ربح' : 'Wins'} | {losingTrades} {isArabic ? 'خسارة' : 'Losses'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isArabic ? 'نسبة النجاح (Win Rate)' : 'Win Rate'}</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-white font-mono">
            {winRate}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {totalTradesCount} {isArabic ? 'عقود مغلقة' : 'Closed Contracts'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>{isArabic ? 'العقود النشطة الآن' : 'Active Contracts'}</span>
          </div>
          <div className={`text-base sm:text-lg font-bold font-mono ${isOverMaxTrades ? 'text-rose-400' : 'text-brand-400'}`}>
            {displayPositions.length} / {maxTradesLimit}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {isOverMaxTrades ? (isArabic ? 'تجاوز الحد الأقصى' : 'Limit exceeded') : (isArabic ? 'أقصى حد متزامن' : 'Open slots')}
          </div>
        </div>
      </div>

      {/* Quick Manual Contract Actions Bar */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-slate-300">
              {isArabic ? `تداول فوري يدوي (${selectedSymbol}):` : `Quick Manual Contract (${selectedSymbol}):`}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {botConfig.marketType === 'SPOT' ? 'SPOT 1x' : `USDT-M ${botConfig.leverage || 10}x`}
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
              isOverMaxTrades 
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' 
                : isAtMaxTrades 
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' 
                  : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              {displayPositions.length} / {maxTradesLimit}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={isAtMaxTrades}
              onClick={() => onManualTriggerOpen ? onManualTriggerOpen('LONG') : onManualTriggerBuy()}
              className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                isAtMaxTrades 
                  ? 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed' 
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
              }`}
              title={isAtMaxTrades ? (isArabic ? 'تم الوصول للحد الأقصى لعدد الصفقات المسموح بها' : 'Maximum open trades reached') : ''}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                {botConfig.marketType === 'SPOT'
                  ? (isArabic ? 'شراء فوري يدوي (Spot Buy)' : 'Manual Spot Buy')
                  : (isArabic ? `فتح عقد آجل LONG (${botConfig.leverage || 10}x)` : `Open LONG (${botConfig.leverage || 10}x)`)}
              </span>
            </button>

            {botConfig.marketType !== 'SPOT' && (
              <button
                disabled={isAtMaxTrades}
                onClick={() => onManualTriggerOpen ? onManualTriggerOpen('SHORT') : onManualTriggerBuy()}
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                  isAtMaxTrades 
                    ? 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed' 
                    : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 shadow-lg shadow-rose-500/10'
                }`}
                title={isAtMaxTrades ? (isArabic ? 'تم الوصول للحد الأقصى لعدد الصفقات المسموح بها' : 'Maximum open trades reached') : ''}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>{isArabic ? `فتح عقد آجل SHORT (${botConfig.leverage || 10}x)` : `Open SHORT (${botConfig.leverage || 10}x)`}</span>
              </button>
            )}
          </div>
        </div>

        {isAtMaxTrades && (
          <div className={`px-3 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            isOverMaxTrades 
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${isOverMaxTrades ? 'text-rose-400' : 'text-amber-400'}`} />
              <span>
                {isOverMaxTrades 
                  ? (isArabic 
                      ? `تجاوز للحد الأقصى (${displayPositions.length}/${maxTradesLimit} صفقات مفتوحة). تم قفل فتح أي صفقات جديدة حتى يتم تقليصها إلى ${maxTradesLimit}.` 
                      : `Limit Exceeded (${displayPositions.length}/${maxTradesLimit} open positions). Trading locked until count is reduced to ${maxTradesLimit}.`)
                  : (isArabic 
                      ? `تم الوصول للحد الأقصى (${displayPositions.length}/${maxTradesLimit} صفقات مفتوحة). لن يسمح البوت أو التطبيق بفتح صفقات إضافية حتى يتم إغلاق إحداها.` 
                      : `Maximum trade limit reached (${displayPositions.length}/${maxTradesLimit}). The bot and app are locked from opening new trades until one is closed.`)}
              </span>
            </div>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${
              isOverMaxTrades ? 'bg-rose-500/25 text-rose-200' : 'bg-amber-500/20 text-amber-200'
            }`}>
              {isArabic ? 'مكتمل' : 'LOCKED'}
            </span>
          </div>
        )}
      </div>

      {/* Excess Positions Instant Resolution Box */}
      {isOverMaxTrades && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-rose-300 text-sm">
                  {isArabic ? `تنبيه: عدد العقود المفتوحة (${displayPositions.length}) يتجاوز الحد الأقصى المضبوط (${maxTradesLimit})` : `Warning: Open contracts (${displayPositions.length}) exceed maximum limit (${maxTradesLimit})`}
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {isArabic 
                    ? `تم قفل فتح أي صفقات جديدة تلقائياً. يمكنك تقليص الصفقات الزائدة بنقرة واحدة لتتوافق فورياً مع حدك (${maxTradesLimit})، أو رفع الحد الأقصى ليتناسب مع عقودك المفتوحة.`
                    : `New trades are strictly locked. You can trim excess trades with one click to match your limit (${maxTradesLimit}), or adjust your limit to match your active positions.`}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
              {displayPositions.length} / {maxTradesLimit}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-500/20">
            {onTrimExcessPositions && (
              <button
                type="button"
                onClick={onTrimExcessPositions}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{isArabic ? `إغلاق الصفقات الزائدة (${displayPositions.length - maxTradesLimit}) تلقائياً` : `Trim ${displayPositions.length - maxTradesLimit} Excess Positions`}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onUpdateConfig({ maxOpenTrades: displayPositions.length })}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isArabic ? `رفع الحد الأقصى إلى ${displayPositions.length} صفقات` : `Increase Limit to ${displayPositions.length}`}</span>
            </button>
            {onPanicCloseAll && (
              <button
                type="button"
                onClick={onPanicCloseAll}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{isArabic ? 'إغلاق كافة الصفقات' : 'Panic Close All'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Positions Cards List */}
      {displayPositions.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-300">
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-400" />
              <span>
                {botConfig.marketType === 'FUTURES'
                  ? (isArabic ? `العقود الآجلة المفتوحة قيد المراقبة اللحظية (${displayPositions.length})` : (isEn ? `Active Futures Positions (${displayPositions.length})` : `Positions Futures Actives (${displayPositions.length})`))
                  : (isArabic ? `صفقات التداول الفوري (Spot) المفتوحة (${displayPositions.length})` : (isEn ? `Active Spot Trades (${displayPositions.length})` : `Positions Spot Actives (${displayPositions.length})`))}
              </span>
            </span>
            <div className="flex items-center gap-2">
              {onPanicCloseAll && (
                <button
                  type="button"
                  onClick={onPanicCloseAll}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                  title={isArabic ? 'إغلاق فوري لجميع العقود المفتوحة' : 'Close all active positions'}
                >
                  <X className="w-3 h-3" />
                  <span>{isArabic ? 'إغلاق كل الصفقات' : 'Fermer toutes'}</span>
                </button>
              )}
              {onFullReset && (
                <button
                  type="button"
                  onClick={onFullReset}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600/70 text-slate-300 hover:text-white border border-slate-700 hover:border-rose-500 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                  title={isArabic ? 'إغلاق كل الصفقات ومسح الأرشيف وإعادة ضبط المحفظة 1000$' : 'Tout réinitialiser (1000$)'}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isArabic ? 'إعادة ضبط شاملة (1000$)' : 'Reset tout (1000$)'}</span>
                </button>
              )}
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                {isArabic ? 'تحديث لحظي' : 'Live WebSocket'}
              </span>
            </div>
          </div>
          {displayPositions.map((pos, idx) => renderActiveCard(pos, idx))}
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <div className="flex justify-center">
            <SentimentalBotAvatar
              enabled={botConfig.enabled}
              floatingPnlUsdt={floatingPnl}
              realizedPnlUsdt={totalRealizedPnl}
              circuitBreakerTriggered={botConfig.circuitBreakerTripped}
              marketSentiment={activeSignal?.bias || (activeSignal?.decision === 'LONG' ? 'BULLISH' : activeSignal?.decision === 'SHORT' ? 'BEARISH' : 'NEUTRAL')}
              marketRegime={activeSignal?.marketRegime}
              activePositionsCount={displayPositions.length}
              signalDecision={activeSignal?.decision}
              confidence={activeSignal?.confidence}
              language={language}
              showMoodBadge={true}
              size="lg"
            />
          </div>
          <h3 className="font-bold text-white text-sm">
            {botConfig.marketType === 'FUTURES'
              ? (isArabic ? 'لا توجد عقود آجلة مفتوحة حالياً' : (isEn ? 'No Active Futures Positions' : 'Aucune position futures active'))
              : (isArabic ? 'لا توجد صفقات تداول فوري (Spot) مفتوحة حالياً' : (isEn ? 'No Active Spot Trades' : 'Aucune position Spot active'))}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {botConfig.enabled
              ? (botConfig.marketType === 'FUTURES'
                  ? (isArabic 
                      ? `البوت في وضع الاستعداد لمراقبة ${selectedSymbol}. عند ظهور إشارة كمية بثقة ≥ ${botConfig.minConfidence}%، سيقوم بفتح عقد آجل ${botConfig.leverage || 10}x تلقائياً.`
                      : (isEn 
                          ? `Bot standing by for ${selectedSymbol}. Upon detecting a signal with confidence ≥ ${botConfig.minConfidence}%, it will open a ${botConfig.leverage || 10}x Futures position.`
                          : `Le bot est en veille sur ${selectedSymbol}. Dès qu'un signal avec confiance ≥ ${botConfig.minConfidence}% apparaît, il ouvrira un contrat Futures ${botConfig.leverage || 10}x.`))
                  : (isArabic
                      ? `البوت في وضع الاستعداد لمراقبة ${selectedSymbol}. عند توفر إشارة شراء مؤكدة بثقة ≥ ${botConfig.minConfidence}%، سيقوم بشراء فوري (Spot Buy 1x) تلقائياً وحجز الأصل.`
                      : (isEn
                          ? `Bot standing by for ${selectedSymbol}. Upon detecting a confirmed buy signal with confidence ≥ ${botConfig.minConfidence}%, it will execute a Spot Buy (1x) automatically.`
                          : `Le bot est en veille sur ${selectedSymbol}. Dès qu'un signal d'achat avec confiance ≥ ${botConfig.minConfidence}% apparaît, il achètera au comptant (Spot 1x).`)))
              : (isArabic 
                  ? 'البوت متوقف حالياً. انقر على "تشغيل التداول الآلي" لتفعيل الفحص والتنفيذ الآلي.'
                  : (isEn ? 'Bot is paused. Click "Enable Auto-Trading" to start scanning and auto-executing.' : 'Le bot est en pause. Cliquez sur "Activer l\'Auto-Trading" pour lancer les scans automatiques.'))}
          </p>

          <div className="pt-2 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => onManualTriggerOpen ? onManualTriggerOpen('LONG') : onManualTriggerBuy()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-600/20"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{isArabic ? `فتح LONG يدوي (${selectedSymbol} ${botConfig.leverage || 10}x)` : `Open LONG (${selectedSymbol} ${botConfig.leverage || 10}x)`}</span>
            </button>
            <button
              onClick={() => onManualTriggerOpen ? onManualTriggerOpen('SHORT') : onManualTriggerBuy()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-rose-600/20"
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{isArabic ? `فتح SHORT يدوي (${selectedSymbol} ${botConfig.leverage || 10}x)` : `Open SHORT (${selectedSymbol} ${botConfig.leverage || 10}x)`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Logs History */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
              {isArabic ? 'سجل عمليات العقود الآجلة (Live Futures Auto-Logs)' : 'Journal des Exécutions Futures'}
            </h3>
          </div>

          {displayLogs.length > 0 && (
            <button
              onClick={onClearLogs}
              className="text-[11px] text-slate-400 hover:text-rose-300 transition"
            >
              {isArabic ? 'مسح السجل' : 'Effacer journal'}
            </button>
          )}
        </div>

        {displayLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-mono">
            {isArabic ? 'لم يقم البوت بأي عمليات تداول بعد.' : 'Aucune opération automatique enregistrée pour le moment.'}
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {displayLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs font-mono"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg shrink-0 ${
                    log.side === 'BUY'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {log.side === 'BUY' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span className="text-cyan-400 bg-cyan-500/10 px-1.5 rounded">{log.symbol}</span>
                      {log.leverage && (
                        <span className="text-amber-400 bg-amber-500/10 px-1 rounded text-[10px]">
                          {log.leverage}x
                        </span>
                      )}
                      <span>{log.type}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({new Date(log.timestamp).toLocaleTimeString()})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {log.marginUsdt ? (
                        <span className="text-emerald-400/90 font-mono font-semibold mr-1.5">
                          {isArabic ? `الهامش: $${log.marginUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT` : `Margin: $${log.marginUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`}
                        </span>
                      ) : null}
                      <span>{log.reason || (isArabic ? `الحجم: $${(log.amountUsdt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `Size: $${(log.amountUsdt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <div className="font-bold text-white">${formatCoinPrice(log.price ?? 0, log.symbol || selectedSymbol)}</div>
                  {log.pnlUsdt !== undefined && log.pnlUsdt !== null && (
                    <div className={`text-[11px] font-bold ${log.pnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {log.pnlUsdt >= 0 ? '+' : ''}${(log.pnlUsdt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({log.pnlPercent ? log.pnlPercent.toFixed(2) : '0.00'}% ROE)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Quantitative Futures Settings Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <span>{isArabic ? 'إعدادات العقود الآجلة والرافعة (Futures Settings)' : 'Paramètres Futures & Effet de Levier'}</span>
            </h3>

            <div className="space-y-4 text-xs">
              {/* 0. Market Type Selection: Futures vs Spot */}
              <div className="p-3 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-3">
                <label className="block text-slate-200 font-bold">
                  {isArabic ? 'نوع السوق المعتمد (Market Type)' : 'Type de Marché'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMarketTypeInput('FUTURES')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition ${
                      marketTypeInput === 'FUTURES'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-500/20'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-white text-xs flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isArabic ? 'عقود آجلة (USDT-M Futures)' : 'USDT-M Futures'}</span>
                    </div>
                    <div className="text-[10px] font-normal text-slate-400 mt-1">
                      {isArabic ? 'رافعة مالية + صفقات LONG و SHORT' : 'Effet de levier + LONG & SHORT'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMarketTypeInput('SPOT')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition ${
                      marketTypeInput === 'SPOT'
                        ? 'bg-brand-500/20 border-brand-500 text-brand-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-white text-xs">{isArabic ? 'تداول فوري (Spot 1x)' : 'Marché Spot (1x)'}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-1">
                      {isArabic ? 'شراء بدون رافعة مالية وبدون تصفية' : 'Achat direct sans effet de levier'}
                    </div>
                  </button>
                </div>

                {/* Leverage Settings (If Futures) */}
                {marketTypeInput === 'FUTURES' && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-bold">
                        {isArabic ? `الرافعة المالية (Leverage): ${leverageInput}x` : `Effet de Levier: ${leverageInput}x`}
                      </label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setMarginModeInput('ISOLATED')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            marginModeInput === 'ISOLATED' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          ISOLATED
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarginModeInput('CROSS')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            marginModeInput === 'CROSS' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          CROSS
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {LEVERAGE_PRESETS.map((lev) => (
                        <button
                          key={lev}
                          type="button"
                          onClick={() => setLeverageInput(lev)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                            leverageInput === lev
                              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                          }`}
                        >
                          {lev}x
                        </button>
                      ))}
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={leverageInput}
                      onChange={(e) => setLeverageInput(Number(e.target.value))}
                      className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded-lg"
                    />

                    
                    <p className="text-[10px] text-amber-300/80">
                      {isArabic 
                        ? `عند رافعة ${leverageInput}x: كل 100$ هامش تتحكم في عقد بقيمة ${(100 * leverageInput).toLocaleString()}$ USDT.`
                        : `À ${leverageInput}x: 100$ de marge contrôle un contrat de ${(100 * leverageInput).toLocaleString()}$ USDT.`}
                    </p>
                  </div>
                )}
              </div>

              {/* Timeframe Strategy Selection */}
              <div className="p-3.5 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>{isArabic ? 'فريم استراتيجية البوت (Bot Timeframe Strategy)' : 'Bot Trading Timeframe Strategy'}</span>
                  </label>
                  {timeframeInput === 'AUTO' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                      {isArabic ? 'وضع الذكاء التكيفي' : 'Adaptive Mode'}
                    </span>
                  )}
                </div>

                {/* Auto vs Fixed Selection */}
                <div className="space-y-2">
                  {/* AUTO Dynamic Adaptive Option */}
                  <button
                    type="button"
                    onClick={() => setTimeframeInput('AUTO')}
                    className={`w-full p-2.5 rounded-xl border text-left font-bold transition flex items-center justify-between ${
                      timeframeInput === 'AUTO'
                        ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${timeframeInput === 'AUTO' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-white text-xs font-bold flex items-center gap-1.5">
                          <span>{isArabic ? 'اختيار تلقائي ذكي (Dynamic AUTO)' : (isEn ? 'Dynamic AUTO (Adaptive Regime)' : 'AUTO Dynamique (Régime Adaptatif)')}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-300 font-mono font-semibold">
                            {isArabic ? 'موصى به' : (isEn ? 'Recommended' : 'Recommandé')}
                          </span>
                        </div>
                        <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                          {isArabic 
                            ? 'يحلل البوت تقلبات السوق وزخم الاتجاه ويتكيف آلياً بين 15m و 1h و 4h.'
                            : (isEn 
                                ? 'Automatically switches between 15m, 1h, and 4h based on market volatility and momentum.'
                                : 'Bascule automatiquement entre 15m, 1h et 4h selon la volatilité et le momentum.')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-mono font-black ${timeframeInput === 'AUTO' ? 'text-cyan-300' : 'text-slate-500'}`}>
                        {timeframeInput === 'AUTO' ? `[${effectiveBotTimeframe.toUpperCase()}]` : 'AUTO'}
                      </span>
                    </div>
                  </button>

                  {/* Manual Timeframe Grid */}
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1.5 font-medium">
                      {isArabic ? 'أو حدد فريماً ثابتاً للبوت:' : (isEn ? 'Or select a fixed bot timeframe:' : 'Ou choisissez une période fixe :')}
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {[
                        { id: '5m', label: '5M', desc: isArabic ? 'سكالبينج فائق السرعة' : (isEn ? 'Ultra Scalp' : 'Scalping Ultra-Rapide') },
                        { id: '15m', label: '15M', desc: isArabic ? 'مضاربة سريعة وزخم' : (isEn ? 'Fast Momentum' : 'Momentum Rapide') },
                        { id: '30m', label: '30M', desc: isArabic ? 'مضاربة قصيرة' : (isEn ? 'Short Swing' : 'Court Terme') },
                        { id: '1h', label: '1H', desc: isArabic ? 'تداول يومي ومضاعفة' : (isEn ? 'Day Compounding' : 'Intrajournalier & Intérêts Composés') },
                        { id: '4h', label: '4H', desc: isArabic ? 'سوينغ وتأكيد قوي' : (isEn ? 'Swing Trend' : 'Tendance Swing') },
                        { id: '1d', label: '1D', desc: isArabic ? 'اتجاه استثماري' : (isEn ? 'Daily Trend' : 'Tendance Journalière') },
                      ].map((tf) => (
                        <button
                          key={tf.id}
                          type="button"
                          onClick={() => setTimeframeInput(tf.id as BotTimeframe)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold font-mono transition text-center border ${
                            timeframeInput === tf.id
                              ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-md shadow-cyan-500/20 ring-2 ring-cyan-400/40'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                          title={tf.desc}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Active Explanation Pill */}
                <div className="text-[10px] bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-slate-400">
                  <span className="text-cyan-300 font-semibold">{isArabic ? 'سلوك الفريم المعتمد: ' : (isEn ? 'Active Behavior: ' : 'Comportement Actif : ')}</span>
                  {timeframeInput === 'AUTO' && (isArabic 
                    ? `الوضع التلقائي يختار حالياً [${effectiveBotTimeframe.toUpperCase()}] بناءً على: ${timeframeReason || 'توازن الزخم وتقلبات السوق الحالية'}`
                    : (isEn 
                        ? `Auto mode currently trading on [${effectiveBotTimeframe.toUpperCase()}] because: ${timeframeReason || 'Current market momentum balance'}`
                        : `Mode Auto sélectionne actuellement [${effectiveBotTimeframe.toUpperCase()}] : ${timeframeReason || 'Équilibre de volatilité et de momentum'}`))}
                  {timeframeInput === '5m' && (isArabic ? 'فريم 5 دقائق: إشارات سكالبينج سريعة جداً مع أهداف صغيرة ومخاطرة محسوبة.' : (isEn ? '5M: Ultra-fast scalp signals with tight targets and quick turnover.' : '5M : Signaux de scalping ultra-rapides avec objectifs courts.'))}
                  {timeframeInput === '15m' && (isArabic ? 'فريم 15 دقيقة: اقتناص موجات الزخم الصاعدة والهابطة اليومية بدقة.' : (isEn ? '15M: Intraday momentum capturing with rapid confirmation.' : '15M : Capture du momentum intrajournalier avec confirmation rapide.'))}
                  {timeframeInput === '30m' && (isArabic ? 'فريم 30 دقيقة: يجمع بين سرعة الدخول وتصفية جزء كبير من التذبذبات.' : (isEn ? '30M: Balances fast response with reduced market noise.' : '30M : Équilibre entre réactivité et réduction du bruit de marché.'))}
                  {timeframeInput === '1h' && (isArabic ? 'فريم 1 ساعة (الافتراضي): الفريم القياسي المؤسساتي لتحقيق أعلى توازن بين الأرباح ونسبة النجاح.' : (isEn ? '1H (Default): Institutional compounding standard with high win-rate balance.' : '1H (Par défaut) : Standard institutionnel avec équilibre optimal de réussite.'))}
                  {timeframeInput === '4h' && (isArabic ? 'فريم 4 ساعات: صفقات سوينغ موثوقة جداً بعد تأكيد الاتجاه وتصفية الضوضاء اليومية.' : (isEn ? '4H: High-conviction swing trends with minimal market noise.' : '4H : Tendances swing fiables avec un bruit de marché minimal.'))}
                  {timeframeInput === '1d' && (isArabic ? 'فريم يومي: صفقات اتجاهية كبرى طويلة المدى.' : (isEn ? '1D: Macro directional trend position trading.' : '1D : Positionnement sur les grandes tendances macroéconomiques.'))}
                </div>
              </div>

              {/* 1. Sizing Mode Selection */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  {isArabic ? '1. نموذج تحجيم الهامش المودع (Margin Sizing Mode)' : '1. Modèle de Dimensionnement de Marge'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSizingModeInput('FIXED_PERCENT')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition ${
                      sizingModeInput === 'FIXED_PERCENT'
                        ? 'bg-brand-500/20 border-brand-500 text-brand-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-white text-xs">{isArabic ? 'حصة ثابتة (% من رأس المال)' : 'Allocation Fixe (% Equity)'}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{isArabic ? 'تخصيص نسبة مئوية متساوية' : 'Taille identique par slot'}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSizingModeInput('RISK_BASED')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition ${
                      sizingModeInput === 'RISK_BASED'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-white text-xs">{isArabic ? 'حساب بالمخاطر (Risk-Based)' : 'Volatilité / Risque Fixe'}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">{isArabic ? 'معايرة الحجم حسب بُعد الوقف' : 'Dimensionné selon le Stop'}</div>
                  </button>
                </div>
              </div>

              {/* Sizing Value Inputs */}
              {sizingModeInput === 'FIXED_PERCENT' ? (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isArabic ? 'هامش كل صفقة من إجمالي الرصيد (%)' : 'Marge par Trade (% du capital total)'}
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={allocationInput}
                    onChange={(e) => setAllocationInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {isArabic ? `يتم حساب النسبة من إجمالي رأس المال (${totalEquity.toFixed(2)}$) لضمان ثبات مبلغ الصفقات` : `Calculé sur le capital total (${totalEquity.toFixed(2)}$)`}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isArabic ? 'أقصى نسبة مخاطرة مسموحة لكل صفقة (% Risk of Equity)' : 'Risque Maximal par Trade (% du Capital)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="10"
                    value={riskPerTradeInput}
                    onChange={(e) => setRiskPerTradeInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {isArabic ? 'يتم احتساب حجم الصفقة تلقائياً بحيث لا تخسر المحفظة أكثر من هذه النسبة عند ضرب الوقف.' : 'La taille est ajustée dynamiquement pour ne jamais dépasser cette perte en cas de SL.'}
                  </p>
                </div>
              )}

              {/* Confidence Threshold & Max Trades */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isArabic ? 'حد الثقة الأدنى (%)' : 'Confiance Min (%)'}
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="95"
                    value={confidenceInput}
                    onChange={(e) => setConfidenceInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isArabic ? 'أقصى صفقات متزامنة' : 'Slots Max Simultanés'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxTradesInput}
                    onChange={(e) => setMaxTradesInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              {/* 2. Trailing Stop Loss System */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white">
                      {isArabic ? '2. نظام الوقف المتحرك (Trailing Stop Loss)' : '2. Trailing Stop Loss Dynamique'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrailingEnabled(!trailingEnabled)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      trailingEnabled 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {trailingEnabled ? (isArabic ? 'مفعل' : 'Activé') : (isArabic ? 'معطل' : 'Désactivé')}
                  </button>
                </div>

                {trailingEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">
                        {isArabic ? 'مسافة التتبع Trailing (%)' : 'Distance de Suivi (%)'}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.3"
                        max="5.0"
                        value={trailingPercentInput}
                        onChange={(e) => setTrailingPercentInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">
                        {isArabic ? 'بدء التفعيل عند ربح (%)' : 'Déclenchement à partir de (%)'}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="10.0"
                        value={trailingActivationInput}
                        onChange={(e) => setTrailingActivationInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Institutional Circuit Breaker (Daily Drawdown Shield) */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white">
                    {isArabic ? '3. قاطع الحماية اليومي (Circuit Breaker)' : '3. Coupe-Circuit Journalier (Daily Max Drawdown)'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2/3">
                    <label className="block text-slate-400 text-[11px] mb-1">
                      {isArabic ? 'أقصى خسارة يومية مسموحة للمحفظة (%)' : 'Perte journalière max tolérée (%)'}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="25.0"
                      value={circuitBreakerInput}
                      onChange={(e) => setCircuitBreakerInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                    />
                  </div>
                  <div className="w-1/3 text-[10px] text-slate-500 leading-tight pt-3">
                    {isArabic ? 'يوقف البوت تلقائياً عند ضرب الحد لمنع استنزاف المحفظة.' : 'Verrouille le bot pour protéger vos fonds.'}
                  </div>
                </div>
              </div>

              {/* 4. Anti-Chop Cooldown Timer */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-white">
                    {isArabic ? '4. فترة التهدئة بعد إغلاق الصفقة (Anti-Chop Cooldown)' : '4. Délai de Refroidissement (Cooldown)'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1/2">
                    <label className="block text-slate-400 text-[11px] mb-1">
                      {isArabic ? 'المدة بالدقائق (Minutes)' : 'Durée (Minutes)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={cooldownInput}
                      onChange={(e) => setCooldownInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
                    />
                  </div>
                  <div className="w-1/2 text-[10px] text-slate-500 leading-tight pt-3">
                    {isArabic ? 'يمنع الدخول الفوري المتكرر على نفس العملة لتفادي التذبذب الوهمي.' : 'Évite les faux départs et le sur-trading.'}
                  </div>
                </div>
              </div>
            </div>

                        {/* Coin Selection Whitelist (Allowed Symbols) */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-slate-300 text-xs font-bold flex items-center gap-1.5">
                  <span>{isArabic ? 'العملات المسموح للبوت بتداولها' : 'Cryptos Autorisées pour le Bot'}</span>
                  <span className="text-[10px] text-slate-500 font-mono">({allowedSymbolsInput.length})</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setAllowedSymbolsInput(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'DOGE', 'LTC', 'UNI', 'ATOM', 'TRX', 'ETC', 'BCH', 'XLM', 'ALGO', 'VET'])}
                    className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                  >
                    {isArabic ? 'تحديد الكل' : 'Tout Sélectionner'}
                  </button>
                  <button
                    onClick={() => setAllowedSymbolsInput([])}
                    className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                  >
                    {isArabic ? 'إلغاء الكل' : 'Tout effacer'}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mb-2 leading-tight">
                {isArabic 
                  ? 'اختر العملات التي ترغب أن يراقبها البوت لفتح صفقات تلقائية (حسب عدد الـ Slots المتاح).' 
                  : 'Sélectionnez les cryptos que le bot doit surveiller pour ouvrir des trades (selon vos slots).'}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                {['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'DOGE', 'LTC', 'UNI', 'ATOM', 'TRX', 'ETC', 'BCH', 'XLM', 'ALGO', 'VET'].map((sym) => {
                  const isActive = allowedSymbolsInput.includes(sym);
                  return (
                    <button
                      key={sym}
                      onClick={() => {
                        if (isActive) {
                          setAllowedSymbolsInput(prev => prev.filter(s => s !== sym));
                        } else {
                          setAllowedSymbolsInput(prev => [...prev, sym]);
                        }
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition flex items-center gap-1 border ${
                        isActive 
                          ? 'bg-brand-500/20 text-brand-300 border-brand-500/40 shadow-sm shadow-brand-500/10' 
                          : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-brand-400' : 'bg-slate-700'}`} />
                      {sym}
                    </button>
                  );
                })}
              </div>
              {allowedSymbolsInput.length === 0 && (
                <div className="text-[10px] font-bold text-rose-400 mt-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  {isArabic ? 'تنبيه: يجب اختيار عملة واحدة على الأقل ليتمكن البوت من التداول' : 'Alerte: Sélectionnez au moins une crypto pour que le bot puisse trader'}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                {isArabic ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-bold"
              >
                {botConfig.marketType === 'FUTURES'
                  ? (isArabic ? 'حفظ وتفعيل معايير العقود الآجلة' : (isEn ? 'Save & Apply Futures Settings' : 'Sauvegarder les Paramètres Futures'))
                  : (isArabic ? 'حفظ وتفعيل إعدادات التداول الفوري (Spot)' : (isEn ? 'Save & Apply Spot Settings' : 'Sauvegarder les Paramètres Spot'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
