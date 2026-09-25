import { kv } from './db.js';
import { TechnicalIndicators, OrderBookSummary, DerivativesData, MTFConfluenceData } from '../types.js';

export type StrategyId = 
  | 'MOMENTUM' 
  | 'SCALPER' 
  | 'SWING' 
  | 'BREAKOUT' 
  | 'MEAN_REVERSION' 
  | 'INSTITUTIONAL_SMC';

export interface StrategyDefinition {
  id: StrategyId;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  enabled: boolean;
  timeframe: '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  defaultLeverage: number;
  activatedAt?: number;
}

export interface StrategySignal {
  strategyId: StrategyId;
  strategyName: string;
  strategyStatus: 'ACTIVE';
  symbol: string;
  decision: 'LONG' | 'SHORT' | 'WAIT';
  confidence: number;
  currentPrice: number;
  tp1: number;
  tp2: number;
  tp3: number;
  stopLoss: number;
  riskRewardRatio: number;
  timeframe: string;
  reason: string;
  timestamp: number;
}

// -------------------------------------------------------------
// DEFAULT INACTIVE STATE: ALL 6 STRATEGIES MUST BE INACTIVE BY DEFAULT
// -------------------------------------------------------------
const DEFAULT_STRATEGIES: Record<StrategyId, Omit<StrategyDefinition, 'enabled'>> = {
  MOMENTUM: {
    id: 'MOMENTUM',
    name: 'Momentum Grid',
    nameAr: 'شبكة الزخم والاتجاه (Momentum Grid)',
    description: 'Trend following via EMA alignment, ADX strength, and MACD expansion.',
    descriptionAr: 'تتبع الاتجاه القوي بتوافق متوسطات EMA وقوة مؤشر ADX وتوسع زخم MACD.',
    timeframe: '1h',
    defaultLeverage: 3,
  },
  SCALPER: {
    id: 'SCALPER',
    name: 'HFT Scalper',
    nameAr: 'سكالبينج فائق السرعة (HFT Scalper)',
    description: 'High-frequency fast micro-pullbacks on RSI & Stochastic extremes.',
    descriptionAr: 'اقتناص ارتدادات سريعة وصغيرة بناءً على تشبعات RSI ومؤشر Stochastic.',
    timeframe: '15m',
    defaultLeverage: 5,
  },
  SWING: {
    id: 'SWING',
    name: 'Swing Trend',
    nameAr: 'سوينغ محافظ (Swing Trend)',
    description: 'Conservative multi-day swings on 4H structure with lowest drawdown.',
    descriptionAr: 'صفقات متأرجحة لعدة أيام على فريم 4H بأقل نسبة تراجع للمحفظة.',
    timeframe: '4h',
    defaultLeverage: 2,
  },
  BREAKOUT: {
    id: 'BREAKOUT',
    name: 'Volatility Breakout',
    nameAr: 'قناص الاختراق (Volatility Breakout)',
    description: 'Volume surges breaking Bollinger bandwidth squeezes and market structure.',
    descriptionAr: 'اقتناص الانفجارات السعرية بعد انضغاط البولنجر مع تصاعد أحجام التداول.',
    timeframe: '30m',
    defaultLeverage: 4,
  },
  MEAN_REVERSION: {
    id: 'MEAN_REVERSION',
    name: 'Mean Reversion',
    nameAr: 'الارتداد للمتوسط (Mean Reversion)',
    description: 'Counter-trend reversion from extreme Bollinger Band deviations and RSI exhaustion.',
    descriptionAr: 'دخول ارتدادي معاكس عند ملامسة حدود البولنجر القصوى وتشبع مؤشر القوة النسبية.',
    timeframe: '15m',
    defaultLeverage: 3,
  },
  INSTITUTIONAL_SMC: {
    id: 'INSTITUTIONAL_SMC',
    name: 'Institutional SMC',
    nameAr: 'المؤسساتي الذكي (Institutional SMC)',
    description: 'Smart Money Concepts: Order blocks, Fair Value Gaps, and liquidity sweeps.',
    descriptionAr: 'مفاهيم صانع السوق الذكي: كتل الأوامر والفجوات السعرية واقتناص السيولة.',
    timeframe: '1h',
    defaultLeverage: 2,
  },
};

class StrategyManager {
  private strategies: Map<StrategyId, StrategyDefinition> = new Map();
  private initialized = false;

  constructor() {
    this.resetToDefaults();
  }

  /**
   * Reset all strategies to INACTIVE (enabled: false)
   */
  public resetToDefaults() {
    this.strategies.clear();
    for (const [id, def] of Object.entries(DEFAULT_STRATEGIES)) {
      this.strategies.set(id as StrategyId, {
        ...def,
        enabled: false, // MANDATORY: Every strategy MUST be INACTIVE by default
      });
    }
  }

  /**
   * Initialize and restore persisted activation state from KV store
   */
  public async init() {
    if (this.initialized) return;

    try {
      const savedStr = await kv.get('quantura_active_strategies');
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        if (parsed && typeof parsed === 'object') {
          for (const [id, enabled] of Object.entries(parsed)) {
            const strat = this.strategies.get(id as StrategyId);
            if (strat && typeof enabled === 'boolean') {
              strat.enabled = enabled;
              if (enabled) {
                strat.activatedAt = Date.now();
              }
            }
          }
          console.log('[STRATEGY_MGR] Restored strategy activation state from KV:', 
            Array.from(this.strategies.values()).map(s => `${s.id}: ${s.enabled ? 'ON' : 'OFF'}`).join(', ')
          );
        }
      } else {
        // Fallback: check if btc_bot_config has activePresets
        const botConfigStr = await kv.get('btc_bot_config');
        if (botConfigStr) {
          const config = JSON.parse(botConfigStr);
          if (Array.isArray(config.activePresets)) {
            const activeSet = new Set(config.activePresets);
            for (const strat of this.strategies.values()) {
              strat.enabled = activeSet.has(strat.id);
              if (strat.enabled) {
                strat.activatedAt = Date.now();
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[STRATEGY_MGR] Failed to load strategy activation state:', err);
    }

    this.initialized = true;
  }

  /**
   * Persist current activation states to KV and synchronize with btc_bot_config
   */
  private async persist() {
    try {
      const stateMap: Record<string, boolean> = {};
      const activeIds: StrategyId[] = [];

      for (const [id, strat] of this.strategies.entries()) {
        stateMap[id] = strat.enabled;
        if (strat.enabled) {
          activeIds.push(id);
        }
      }

      await kv.set('quantura_active_strategies', JSON.stringify(stateMap));

      // Synchronize with btc_bot_config
      const configStr = await kv.get('btc_bot_config');
      if (configStr) {
        const config = JSON.parse(configStr);
        config.activePresets = activeIds;
        await kv.set('btc_bot_config', JSON.stringify(config));
      }
    } catch (err) {
      console.error('[STRATEGY_MGR] Failed to persist strategy state:', err);
    }
  }

  /**
   * Log audit entry to console and btc_bot_logs
   */
  private async logAudit(message: string, isBlock = false) {
    console.log(`[AUDIT] ${message}`);
    try {
      const logsStr = await kv.get('btc_bot_logs');
      const logs = logsStr ? JSON.parse(logsStr) : [];
      logs.unshift({
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: Date.now(),
        type: isBlock ? 'TRADE_BLOCKED' : 'STRATEGY_AUDIT',
        symbol: 'SYSTEM',
        side: 'BUY',
        price: 0,
        amountUsdt: 0,
        reason: message,
        mode: 'PAPER',
      });
      await kv.set('btc_bot_logs', JSON.stringify(logs.slice(0, 500)));
    } catch (e) {
      // Non-blocking log failure
    }
  }

  /**
   * Returns all 6 registered strategies
   */
  public getAllStrategies(): StrategyDefinition[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Returns ONLY strategies where enabled === true
   */
  public getActiveStrategies(): StrategyDefinition[] {
    return Array.from(this.strategies.values()).filter(s => s.enabled);
  }

  /**
   * Get specific strategy by ID
   */
  public getStrategy(id: string): StrategyDefinition | undefined {
    return this.strategies.get(id as StrategyId);
  }

  /**
   * Check if strategy is active
   */
  public isStrategyActive(id: string): boolean {
    const strat = this.strategies.get(id as StrategyId);
    return !!strat && strat.enabled === true;
  }

  /**
   * Set activation state of a single strategy
   */
  public async setStrategyState(id: StrategyId, enabled: boolean): Promise<StrategyDefinition> {
    const strat = this.strategies.get(id);
    if (!strat) {
      throw new Error(`Strategy ${id} not found in registry`);
    }

    const previousState = strat.enabled;
    strat.enabled = enabled;
    if (enabled) {
      strat.activatedAt = Date.now();
    } else {
      strat.activatedAt = undefined;
    }

    if (previousState !== enabled) {
      const logMsg = `[STRATEGY] ${strat.name} → ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}`;
      await this.logAudit(logMsg);
    }

    await this.persist();
    return strat;
  }

  /**
   * Batch update strategy states
   */
  public async setAllStrategiesState(stateMap: Record<string, boolean>): Promise<StrategyDefinition[]> {
    for (const [id, enabled] of Object.entries(stateMap)) {
      const strat = this.strategies.get(id as StrategyId);
      if (strat && typeof enabled === 'boolean') {
        const prev = strat.enabled;
        strat.enabled = enabled;
        if (enabled) {
          strat.activatedAt = Date.now();
        } else {
          strat.activatedAt = undefined;
        }
        if (prev !== enabled) {
          await this.logAudit(`[STRATEGY] ${strat.name} → ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}`);
        }
      }
    }
    await this.persist();
    return this.getAllStrategies();
  }

  /**
   * CRITICAL GATE: Final trade authorization check immediately before order execution
   */
  public async authorizeTrade(params: {
    strategyId: string;
    symbol: string;
    side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  }): Promise<{ authorized: boolean; reason?: string; strategy?: StrategyDefinition }> {
    const { strategyId, symbol, side } = params;

    // Rule 0: Global Bot MUST be explicitly enabled
    const configStr = await kv.get('btc_bot_config');
    const config = configStr ? JSON.parse(configStr) : null;
    if (!config || !config.enabled) {
      const reason = 'BOT_DISABLED';
      await this.logAudit(
        `[TRADE BLOCKED] ${symbol} ${side} - Global Bot is Disabled (${reason})`,
        true
      );
      return { authorized: false, reason };
    }

    // Rule 0.5: Strategy must be in activePresets of btc_bot_config
    const activePresets: string[] = Array.isArray(config.activePresets)
      ? config.activePresets
      : this.getActiveStrategies().map(s => s.id);

    if (!activePresets.includes(strategyId)) {
      const reason = 'STRATEGY_NOT_IN_ACTIVE_PRESETS';
      await this.logAudit(
        `[TRADE BLOCKED] ${symbol} ${side} - Strategy ${strategyId} is not in user active presets`,
        true
      );
      return { authorized: false, reason };
    }

    const strat = this.getStrategy(strategyId);

    // Rule 1: Unknown or missing strategy
    if (!strat) {
      const reason = 'STRATEGY_INACTIVE';
      await this.logAudit(
        `[TRADE BLOCKED] ${symbol} ${side} Strategy: Unknown (${strategyId}) Reason: ${reason}`,
        true
      );
      return { authorized: false, reason };
    }

    // Auto-enable strategy if in user active presets
    if (!strat.enabled) {
      strat.enabled = true;
      strat.activatedAt = Date.now();
    }

    // Rule 3: Zero active strategies rule
    const activeCount = this.getActiveStrategies().length;
    if (activeCount === 0) {
      const reason = 'ZERO_ACTIVE_STRATEGIES';
      await this.logAudit(
        `[TRADE BLOCKED] ${symbol} ${side} Strategy: ${strat.name} Reason: ${reason}`,
        true
      );
      return { authorized: false, reason };
    }

    return { authorized: true, strategy: strat };
  }

  /**
   * Run strategy-specific quantitative analysis for active strategies
   */
  public evaluateStrategy(
    strategyId: StrategyId,
    symbol: string,
    currentPrice: number,
    indicators: TechnicalIndicators,
    orderBook: OrderBookSummary | null,
    derivatives: DerivativesData | null,
    mtfConfluence: MTFConfluenceData | null
  ): StrategySignal | null {
    // A strategy MUST NEVER participate in analysis if not active
    if (!this.isStrategyActive(strategyId)) {
      return null;
    }

    const strat = this.getStrategy(strategyId)!;
    const atr = Math.max(indicators?.atr14 || currentPrice * 0.01, currentPrice * 0.005);
    const rsi = indicators?.rsi14 || 50;
    const ema20 = indicators?.ema20 || currentPrice;
    const ema50 = indicators?.ema50 || currentPrice;
    const ema200 = indicators?.ema200 || currentPrice;
    const adx = indicators?.adx14 || 0;
    const bb = indicators?.bollingerBands || { upper: currentPrice * 1.02, middle: currentPrice, lower: currentPrice * 0.98, bandwidthPercent: 4.0 };
    const stoch = indicators?.stoch || { k: 50, d: 50 };
    const ms = indicators?.marketStructure || { trend: 'RANGING', structure: 'RANGE', bos: '', swingHigh: 0, swingLow: 0 };

    let decision: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT';
    let confidence = 50;
    let reason = '';
    let tp1 = 0;
    let tp2 = 0;
    let tp3 = 0;
    let stopLoss = 0;

    switch (strategyId) {
      case 'MOMENTUM': {
        // Trend following with moving average confluence and ADX
        const isBullishMacro = currentPrice >= ema200 || ema50 >= ema200;
        const isBearishMacro = currentPrice <= ema200 || ema50 <= ema200;
        const isBullishTrend = currentPrice > ema20 && ema20 > ema50 && adx >= 22;
        const isBearishTrend = currentPrice < ema20 && ema20 < ema50 && adx >= 22;

        if (isBullishTrend && rsi >= 48 && rsi <= 68 && isBullishMacro) {
          decision = 'LONG';
          confidence = Math.min(94, Math.round(70 + (adx - 22) * 1.0 + (rsi - 50) * 0.4 + (currentPrice > ema200 ? 6 : 0)));
          reason = `Momentum Trend: Golden EMA alignment (Price > EMA20 > EMA50) with strong ADX (${adx.toFixed(1)}) and healthy RSI (${rsi.toFixed(1)}).`;
          const rawSl = Math.min(ema50, currentPrice - atr * 1.5);
          stopLoss = rawSl < currentPrice ? rawSl : currentPrice - Math.max(atr * 1.5, currentPrice * 0.01);
          const risk = currentPrice - stopLoss;
          tp1 = currentPrice + risk * 1.5;
          tp2 = currentPrice + risk * 2.5;
          tp3 = currentPrice + risk * 4.0;
        } else if (isBearishTrend && rsi <= 52 && rsi >= 32 && isBearishMacro) {
          decision = 'SHORT';
          confidence = Math.min(94, Math.round(70 + (adx - 22) * 1.0 + (50 - rsi) * 0.4 + (currentPrice < ema200 ? 6 : 0)));
          reason = `Momentum Trend: Bearish EMA alignment (Price < EMA20 < EMA50) with high ADX (${adx.toFixed(1)}) and falling RSI (${rsi.toFixed(1)}).`;
          const rawSl = Math.max(ema50, currentPrice + atr * 1.5);
          stopLoss = rawSl > currentPrice ? rawSl : currentPrice + Math.max(atr * 1.5, currentPrice * 0.01);
          const risk = stopLoss - currentPrice;
          tp1 = currentPrice - risk * 1.5;
          tp2 = currentPrice - risk * 2.5;
          tp3 = Math.max(currentPrice * 0.05, currentPrice - risk * 4.0);
        }
        break;
      }

      case 'SCALPER': {
        // Institutional Precision Scalping (High Win-Rate, Strict Trend Alignment)
        // 1. Structural Trend Filter: EMA20 vs EMA50 dictates micro-trend direction
        const isBullishMicroTrend = currentPrice >= ema20 && ema20 >= ema50;
        const isBearishMicroTrend = currentPrice <= ema20 && ema20 <= ema50;
        const isAboveEma200 = currentPrice >= ema200;

        // 2. Volatility Condition: Avoid dead/flat sideways consolidation where noise triggers false signals
        const hasMinimumVolatility = atr >= currentPrice * 0.0025;

        // 3. Precision Oscillators: Extreme pullbacks with momentum confirmation
        const isOversoldStoch = stoch.k < 26 && stoch.k > stoch.d;
        const isOverboughtStoch = stoch.k > 74 && stoch.k < stoch.d;
        const isLowerBbTouch = currentPrice <= bb.lower * 1.004;
        const isUpperBbTouch = currentPrice >= bb.upper * 0.996;

        // LONG Condition: Bullish micro-trend pullback to support in alignment with macro trend
        if (
          hasMinimumVolatility &&
          isBullishMicroTrend &&
          (isOversoldStoch || isLowerBbTouch) &&
          rsi >= 38 && rsi <= 55 &&
          isAboveEma200
        ) {
          decision = 'LONG';
          confidence = Math.min(95, Math.round(76 + (28 - Math.min(28, stoch.k)) * 0.5 + (isAboveEma200 ? 6 : 0)));
          reason = `Precision Scalper: Bullish trend pullback to key support (Stoch ${stoch.k.toFixed(1)}, RSI ${rsi.toFixed(1)}, Price > EMA200).`;
          
          const risk = Math.max(atr * 0.9, currentPrice * 0.007);
          stopLoss = currentPrice - risk;
          tp1 = currentPrice + risk * 2.0;
          tp2 = currentPrice + risk * 3.2;
          tp3 = currentPrice + risk * 5.0;
        } else if (
          hasMinimumVolatility &&
          isBearishMicroTrend &&
          (isOverboughtStoch || isUpperBbTouch) &&
          rsi <= 62 && rsi >= 45 &&
          !isAboveEma200
        ) {
          decision = 'SHORT';
          confidence = Math.min(95, Math.round(76 + (Math.max(72, stoch.k) - 72) * 0.5 + (!isAboveEma200 ? 6 : 0)));
          reason = `Precision Scalper: Bearish trend pullback to key resistance (Stoch ${stoch.k.toFixed(1)}, RSI ${rsi.toFixed(1)}, Price < EMA200).`;
          
          const risk = Math.max(atr * 0.9, currentPrice * 0.007);
          stopLoss = currentPrice + risk;
          tp1 = currentPrice - risk * 2.0;
          tp2 = currentPrice - risk * 3.2;
          tp3 = Math.max(currentPrice * 0.05, currentPrice - risk * 5.0);
        }
        break;
      }

      case 'BREAKOUT': {
        // Volatility expansion breaking out of squeeze with ADX & Volume confirmation
        const isBandwidthExpanding = bb.bandwidthPercent > 3.2 && adx >= 24;
        const vol = indicators?.volume || 0;
        const volAvg = indicators?.volumeAvg20 || 0;
        const hasVolSurge = volAvg > 0 ? vol >= volAvg * 1.15 : true;
        const isNotOverExtendedLong = rsi <= 68 && Math.abs(currentPrice - ema20) <= 1.5 * atr;
        const isNotOverExtendedShort = rsi >= 32 && Math.abs(currentPrice - ema20) <= 1.5 * atr;

        if (isBandwidthExpanding && currentPrice >= bb.upper && rsi >= 54 && isNotOverExtendedLong && hasVolSurge) {
          decision = 'LONG';
          confidence = Math.min(94, Math.round(74 + Math.min(10, bb.bandwidthPercent * 1.5) + (currentPrice > ema200 ? 5 : 0)));
          reason = `Volatility Breakout: Confirmed Bollinger expansion (${bb.bandwidthPercent.toFixed(1)}%) with Volume surge, ADX (${adx.toFixed(1)}) and RSI ${rsi.toFixed(1)}.`;
          const rawSl = Math.min(bb.middle, currentPrice - atr * 1.2);
          stopLoss = rawSl < currentPrice ? rawSl : currentPrice - Math.max(atr * 1.2, currentPrice * 0.008);
          const risk = currentPrice - stopLoss;
          tp1 = currentPrice + risk * 1.8;
          tp2 = currentPrice + risk * 3.0;
          tp3 = currentPrice + risk * 4.8;
        } else if (isBandwidthExpanding && currentPrice <= bb.lower && rsi <= 46 && isNotOverExtendedShort && hasVolSurge) {
          decision = 'SHORT';
          confidence = Math.min(94, Math.round(74 + Math.min(10, bb.bandwidthPercent * 1.5) + (currentPrice < ema200 ? 5 : 0)));
          reason = `Volatility Breakout: Downward expansion (${bb.bandwidthPercent.toFixed(1)}%) with Volume surge, ADX (${adx.toFixed(1)}) and RSI ${rsi.toFixed(1)}.`;
          const rawSl = Math.max(bb.middle, currentPrice + atr * 1.2);
          stopLoss = rawSl > currentPrice ? rawSl : currentPrice + Math.max(atr * 1.2, currentPrice * 0.008);
          const risk = stopLoss - currentPrice;
          tp1 = currentPrice - risk * 1.8;
          tp2 = currentPrice - risk * 3.0;
          tp3 = Math.max(currentPrice * 0.05, currentPrice - risk * 4.8);
        }
        break;
      }

      case 'MEAN_REVERSION': {
        // Statistical deviation bounce ONLY in ranging/non-trending market (ADX < 24)
        const isRangingMarket = adx < 24;
        if (isRangingMarket && (currentPrice < bb.lower || (rsi < 28 && currentPrice < ema20))) {
          decision = 'LONG';
          confidence = Math.min(90, Math.round(68 + (28 - Math.min(28, rsi)) * 1.2));
          reason = `Mean Reversion: Statistical oversold deviation in range market (RSI ${rsi.toFixed(1)}, ADX ${adx.toFixed(1)}). Targeting EMA20.`;
          const risk = Math.max(atr * 1.2, currentPrice * 0.008);
          stopLoss = currentPrice - risk;
          tp1 = Math.max(currentPrice + risk * 1.2, ema20 > currentPrice ? ema20 : currentPrice + risk * 1.2);
          tp2 = Math.max(tp1 + risk * 0.8, bb.middle > tp1 ? bb.middle : tp1 + risk * 0.8);
          tp3 = Math.max(tp2 + risk * 1.0, bb.upper > tp2 ? bb.upper : tp2 + risk * 1.0);
        } else if (isRangingMarket && (currentPrice > bb.upper || (rsi > 72 && currentPrice > ema20))) {
          decision = 'SHORT';
          confidence = Math.min(90, Math.round(68 + (Math.max(72, rsi) - 72) * 1.2));
          reason = `Mean Reversion: Statistical overbought rejection in range market (RSI ${rsi.toFixed(1)}, ADX ${adx.toFixed(1)}). Targeting EMA20.`;
          const risk = Math.max(atr * 1.2, currentPrice * 0.008);
          stopLoss = currentPrice + risk;
          tp1 = Math.min(currentPrice - risk * 1.2, ema20 < currentPrice ? ema20 : currentPrice - risk * 1.2);
          tp2 = Math.min(tp1 - risk * 0.8, bb.middle < tp1 ? bb.middle : tp1 - risk * 0.8);
          tp3 = Math.max(currentPrice * 0.05, Math.min(tp2 - risk * 1.0, bb.lower < tp2 ? bb.lower : tp2 - risk * 1.0));
        }
        break;
      }

      case 'INSTITUTIONAL_SMC': {
        // Smart Money Concepts: BOS / CHoCH + Liquidity Sweeps
        const isSmcBullish = (ms.trend === 'UPTREND' || ms.structure === 'HIGHER_HIGH' || (typeof ms.bos === 'string' && ms.bos.toLowerCase().includes('bullish'))) && currentPrice >= ema50;
        const isSmcBearish = (ms.trend === 'DOWNTREND' || ms.structure === 'LOWER_LOW' || (typeof ms.bos === 'string' && ms.bos.toLowerCase().includes('bearish'))) && currentPrice <= ema50;

        if (isSmcBullish && currentPrice > ema50 && rsi >= 46 && rsi <= 68) {
          decision = 'LONG';
          confidence = Math.min(95, 82 + (currentPrice > ema200 ? 5 : 0) + (adx >= 22 ? 4 : 0));
          reason = `Institutional SMC: Bullish structure break (BOS) with discount liquidity sweep mitigation above EMA50.`;
          const risk = Math.max(atr * 1.4, currentPrice * 0.01);
          stopLoss = currentPrice - risk;
          tp1 = currentPrice + risk * 1.8;
          tp2 = currentPrice + risk * 3.0;
          tp3 = currentPrice + risk * 5.0;
        } else if (isSmcBearish && currentPrice < ema50 && rsi <= 54 && rsi >= 32) {
          decision = 'SHORT';
          confidence = Math.min(95, 82 + (currentPrice < ema200 ? 5 : 0) + (adx >= 22 ? 4 : 0));
          reason = `Institutional SMC: Bearish structure break (BOS) with premium liquidity pool mitigation below EMA50.`;
          const risk = Math.max(atr * 1.4, currentPrice * 0.01);
          stopLoss = currentPrice + risk;
          tp1 = currentPrice - risk * 1.8;
          tp2 = currentPrice - risk * 3.0;
          tp3 = Math.max(currentPrice * 0.05, currentPrice - risk * 5.0);
        }
        break;
      }

      case 'SWING': {
        // Conservative multi-day swing trend
        const isSwingBullish = currentPrice > ema50 && ema50 > ema200 && adx >= 22;
        const isSwingBearish = currentPrice < ema50 && ema50 < ema200 && adx >= 22;

        if (isSwingBullish && rsi >= 45 && rsi <= 68) {
          decision = 'LONG';
          confidence = Math.min(96, 86 + (adx >= 26 ? 4 : 0));
          reason = `Conservative Swing: Multi-period HTF trend alignment (Price > EMA50 > EMA200, ADX ${adx.toFixed(1)}). Low drawdown swing.`;
          const rawSl = Math.min(ema200, currentPrice - atr * 2.5);
          stopLoss = rawSl < currentPrice ? rawSl : currentPrice - Math.max(atr * 2.0, currentPrice * 0.015);
          const risk = currentPrice - stopLoss;
          tp1 = currentPrice + risk * 1.8;
          tp2 = currentPrice + risk * 3.0;
          tp3 = currentPrice + risk * 5.0;
        } else if (isSwingBearish && rsi <= 55 && rsi >= 32) {
          decision = 'SHORT';
          confidence = Math.min(96, 86 + (adx >= 26 ? 4 : 0));
          reason = `Conservative Swing: Multi-period HTF downtrend alignment (Price < EMA50 < EMA200, ADX ${adx.toFixed(1)}). Low drawdown swing.`;
          const rawSl = Math.max(ema200, currentPrice + atr * 2.5);
          stopLoss = rawSl > currentPrice ? rawSl : currentPrice + Math.max(atr * 2.0, currentPrice * 0.015);
          const risk = stopLoss - currentPrice;
          tp1 = currentPrice - risk * 1.8;
          tp2 = currentPrice - risk * 3.0;
          tp3 = Math.max(currentPrice * 0.05, currentPrice - risk * 5.0);
        }
        break;
      }
    }

    if (decision === 'WAIT') {
      return null;
    }

    // Safety Invariants Enforcement: Never allow inverted TP or SL, ensure R:R >= 2.0
    if (decision === 'LONG') {
      if (!stopLoss || stopLoss >= currentPrice) {
        stopLoss = currentPrice * 0.985;
      }
      const risk = currentPrice - stopLoss;
      if (!tp1 || tp1 <= currentPrice || (tp1 - currentPrice) < risk * 2.0) tp1 = currentPrice + risk * 2.0;
      if (!tp2 || tp2 <= tp1) tp2 = tp1 + risk * 1.2;
      if (!tp3 || tp3 <= tp2) tp3 = tp2 + risk * 1.8;
    } else if (decision === 'SHORT') {
      if (!stopLoss || stopLoss <= currentPrice) {
        stopLoss = currentPrice * 1.015;
      }
      const risk = stopLoss - currentPrice;
      if (!tp1 || tp1 >= currentPrice || (currentPrice - tp1) < risk * 2.0) tp1 = currentPrice - risk * 2.0;
      if (!tp2 || tp2 >= tp1) tp2 = tp1 - risk * 1.2;
      if (!tp3 || tp3 >= tp2) tp3 = Math.max(currentPrice * 0.05, tp2 - risk * 1.8);
    }

    const slDistance = Math.abs(currentPrice - stopLoss);
    const tp1Distance = Math.abs(tp1 - currentPrice);
    const riskRewardRatio = slDistance > 0 ? Math.round((tp1Distance / slDistance) * 10) / 10 : 1.5;

    return {
      strategyId: strat.id,
      strategyName: strat.name,
      strategyStatus: 'ACTIVE',
      symbol,
      decision,
      confidence,
      currentPrice,
      tp1,
      tp2,
      tp3,
      stopLoss,
      riskRewardRatio,
      timeframe: strat.timeframe,
      reason,
      timestamp: Date.now(),
    };
  }
}

export const strategyManager = new StrategyManager();
