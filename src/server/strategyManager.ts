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
    this.resetToDefaults();

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
        // Double-check if btc_bot_config has activePresets
        const botConfigStr = await kv.get('btc_bot_config');
        if (botConfigStr) {
          const config = JSON.parse(botConfigStr);
          if (Array.isArray(config.activePresets) && config.enabled) {
            for (const preset of config.activePresets) {
              const strat = this.strategies.get(preset as StrategyId);
              if (strat) {
                strat.enabled = true;
                strat.activatedAt = Date.now();
              }
            }
            await this.persist();
          }
        }
      }
    } catch (err) {
      console.error('[STRATEGY_MGR] Failed to load strategy activation state:', err);
      this.resetToDefaults();
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
        // If activeIds is empty, bot enabled should remain false or reflect 0 active
        if (activeIds.length === 0) {
          config.enabled = false;
        }
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
    const activePresets: string[] = Array.isArray(config.activePresets) ? config.activePresets : [];
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

    // Rule 2: Strategy must be enabled
    if (!strat.enabled) {
      const reason = 'STRATEGY_INACTIVE';
      await this.logAudit(
        `[TRADE BLOCKED] ${symbol} ${side} Strategy: ${strat.name} Reason: ${reason}`,
        true
      );
      return { authorized: false, reason };
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
        const isBullishTrend = currentPrice > ema20 && ema20 > ema50 && adx >= 20;
        const isBearishTrend = currentPrice < ema20 && ema20 < ema50 && adx >= 20;

        if (isBullishTrend && rsi >= 48 && rsi <= 72) {
          decision = 'LONG';
          confidence = Math.min(92, Math.round(65 + (adx - 20) * 1.2 + (rsi - 50) * 0.5));
          reason = `Momentum Trend: EMA alignment (20>50) with strong ADX (${adx.toFixed(1)}) and healthy RSI (${rsi.toFixed(1)}).`;
          const rawSl = Math.min(ema50, currentPrice - atr * 1.5);
          stopLoss = rawSl < currentPrice ? rawSl : currentPrice - Math.max(atr * 1.5, currentPrice * 0.01);
          const risk = currentPrice - stopLoss;
          tp1 = currentPrice + risk * 1.5;
          tp2 = currentPrice + risk * 2.5;
          tp3 = currentPrice + risk * 4.0;
        } else if (isBearishTrend && rsi <= 52 && rsi >= 28) {
          decision = 'SHORT';
          confidence = Math.min(92, Math.round(65 + (adx - 20) * 1.2 + (50 - rsi) * 0.5));
          reason = `Momentum Trend: Bearish EMA alignment (20<50) with high ADX (${adx.toFixed(1)}) and falling RSI (${rsi.toFixed(1)}).`;
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
        // High-frequency fast micro-pullbacks on RSI & Stochastic extremes
        if ((stoch.k < 25 && stoch.k > stoch.d && rsi <= 45) || (rsi <= 35 && currentPrice <= bb.lower * 1.005)) {
          decision = 'LONG';
          confidence = Math.min(90, Math.round(68 + (30 - stoch.k) * 0.6));
          reason = `HFT Scalper: Oversold oscillator bounce (Stoch ${stoch.k.toFixed(1)}, RSI ${rsi.toFixed(1)}) near support.`;
          const risk = Math.max(atr * 0.8, currentPrice * 0.006);
          stopLoss = currentPrice - risk;
          tp1 = currentPrice + risk * 1.2;
          tp2 = currentPrice + risk * 2.0;
          tp3 = currentPrice + risk * 3.2;
        } else if ((stoch.k > 75 && stoch.k < stoch.d && rsi >= 55) || (rsi >= 65 && currentPrice >= bb.upper * 0.995)) {
          decision = 'SHORT';
          confidence = Math.min(90, Math.round(68 + (stoch.k - 70) * 0.6));
          reason = `HFT Scalper: Overbought oscillator rejection (Stoch ${stoch.k.toFixed(1)}, RSI ${rsi.toFixed(1)}) near resistance.`;
          const risk = Math.max(atr * 0.8, currentPrice * 0.006);
          stopLoss = currentPrice + risk;
          tp1 = currentPrice - risk * 1.2;
          tp2 = currentPrice - risk * 2.0;
          tp3 = Math.max(currentPrice * 0.05, currentPrice - risk * 3.2);
        }
        break;
      }

      case 'BREAKOUT': {
        // Volatility expansion breaking out of squeeze
        const isBandwidthExpanding = bb.bandwidthPercent > 3.0;
        if (isBandwidthExpanding && currentPrice >= bb.upper && rsi >= 58) {
          decision = 'LONG';
          confidence = Math.min(94, Math.round(70 + bb.bandwidthPercent * 2));
          reason = `Volatility Breakout: Bollinger bandwidth expansion (${bb.bandwidthPercent.toFixed(1)}%) piercing upper envelope with RSI ${rsi.toFixed(1)}.`;
          const rawSl = Math.min(bb.middle, currentPrice - atr * 1.2);
          stopLoss = rawSl < currentPrice ? rawSl : currentPrice - Math.max(atr * 1.2, currentPrice * 0.008);
          const risk = currentPrice - stopLoss;
          tp1 = currentPrice + risk * 1.5;
          tp2 = currentPrice + risk * 2.8;
          tp3 = currentPrice + risk * 4.5;
        } else if (isBandwidthExpanding && currentPrice <= bb.lower && rsi <= 42) {
          decision = 'SHORT';
          confidence = Math.min(94, Math.round(70 + bb.bandwidthPercent * 2));
          reason = `Volatility Breakout: Downward volatility expansion (${bb.bandwidthPercent.toFixed(1)}%) piercing lower envelope with RSI ${rsi.toFixed(1)}.`;
          const rawSl = Math.max(bb.middle, currentPrice + atr * 1.2);
          stopLoss = rawSl > currentPrice ? rawSl : currentPrice + Math.max(atr * 1.2, currentPrice * 0.008);
          const risk = stopLoss - currentPrice;
          tp1 = currentPrice - risk * 1.5;
          tp2 = currentPrice - risk * 2.8;
          tp3 = Math.max(currentPrice * 0.05, currentPrice - risk * 4.5);
        }
        break;
      }

      case 'MEAN_REVERSION': {
        // Statistical deviation bounce towards EMA20 / BB Middle
        if (currentPrice < bb.lower || (rsi < 30 && currentPrice < ema20)) {
          decision = 'LONG';
          confidence = Math.min(88, Math.round(66 + (30 - rsi) * 1.0));
          reason = `Mean Reversion: Extreme deviation below Lower Bollinger Band / RSI ${rsi.toFixed(1)}. Targeting mean reversion to EMA20.`;
          const risk = Math.max(atr * 1.2, currentPrice * 0.008);
          stopLoss = currentPrice - risk;
          tp1 = Math.max(currentPrice + risk * 1.2, ema20 > currentPrice ? ema20 : currentPrice + risk * 1.2);
          tp2 = Math.max(tp1 + risk * 0.8, bb.middle > tp1 ? bb.middle : tp1 + risk * 0.8);
          tp3 = Math.max(tp2 + risk * 1.0, bb.upper > tp2 ? bb.upper : tp2 + risk * 1.0);
        } else if (currentPrice > bb.upper || (rsi > 70 && currentPrice > ema20)) {
          decision = 'SHORT';
          confidence = Math.min(88, Math.round(66 + (rsi - 70) * 1.0));
          reason = `Mean Reversion: Extreme deviation above Upper Bollinger Band / RSI ${rsi.toFixed(1)}. Targeting mean reversion to EMA20.`;
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
        const isSmcBullish = ms.trend === 'UPTREND' || ms.structure === 'HIGHER_HIGH' || (typeof ms.bos === 'string' && ms.bos.toLowerCase().includes('bullish'));
        const isSmcBearish = ms.trend === 'DOWNTREND' || ms.structure === 'LOWER_LOW' || (typeof ms.bos === 'string' && ms.bos.toLowerCase().includes('bearish'));

        if (isSmcBullish && currentPrice > ema50 && rsi >= 46) {
          decision = 'LONG';
          confidence = 82;
          reason = `Institutional SMC: Bullish market structure break (BOS) with discount liquidity sweep mitigation.`;
          const risk = Math.max(atr * 1.4, currentPrice * 0.01);
          stopLoss = currentPrice - risk;
          tp1 = currentPrice + risk * 1.8;
          tp2 = currentPrice + risk * 3.0;
          tp3 = currentPrice + risk * 5.0;
        } else if (isSmcBearish && currentPrice < ema50 && rsi <= 54) {
          decision = 'SHORT';
          confidence = 82;
          reason = `Institutional SMC: Bearish market structure break (BOS) with premium liquidity pool mitigation.`;
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
          confidence = 85;
          reason = `Conservative Swing: Multi-period HTF trend alignment (Price > EMA50 > EMA200, ADX ${adx.toFixed(1)}). Low drawdown swing.`;
          const rawSl = Math.min(ema200, currentPrice - atr * 2.5);
          stopLoss = rawSl < currentPrice ? rawSl : currentPrice - Math.max(atr * 2.0, currentPrice * 0.015);
          const risk = currentPrice - stopLoss;
          tp1 = currentPrice + risk * 1.8;
          tp2 = currentPrice + risk * 3.0;
          tp3 = currentPrice + risk * 5.0;
        } else if (isSwingBearish && rsi <= 55 && rsi >= 32) {
          decision = 'SHORT';
          confidence = 85;
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

    // Safety Invariants Enforcement: Never allow inverted TP or SL
    if (decision === 'LONG') {
      if (!stopLoss || stopLoss >= currentPrice) {
        stopLoss = currentPrice * 0.985;
      }
      const risk = currentPrice - stopLoss;
      if (!tp1 || tp1 <= currentPrice) tp1 = currentPrice + risk * 1.5;
      if (!tp2 || tp2 <= tp1) tp2 = tp1 + risk * 1.0;
      if (!tp3 || tp3 <= tp2) tp3 = tp2 + risk * 1.5;
    } else if (decision === 'SHORT') {
      if (!stopLoss || stopLoss <= currentPrice) {
        stopLoss = currentPrice * 1.015;
      }
      const risk = stopLoss - currentPrice;
      if (!tp1 || tp1 >= currentPrice) tp1 = currentPrice - risk * 1.5;
      if (!tp2 || tp2 >= tp1) tp2 = tp1 - risk * 1.0;
      if (!tp3 || tp3 >= tp2) tp3 = Math.max(currentPrice * 0.05, tp2 - risk * 1.5);
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
