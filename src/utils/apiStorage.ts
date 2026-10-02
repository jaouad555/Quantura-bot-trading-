class ApiStorage {
  private mem: Record<string, string> = {};
  private initialized = false;
  private pendingSync: Record<string, string | null> = {};
  private syncTimeout: any = null;

  async init() {
    if (this.initialized) return;
    
    // First synchronously load everything from localStorage into memory
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k) {
            const v = window.localStorage.getItem(k);
            if (v !== null) {
              this.mem[k] = v;
            }
          }
        }
      } catch (e) {
        // Ignore localStorage access issues
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/config/all', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const serverData = await res.json();
        if (serverData && typeof serverData === 'object') {
          // Never import device-specific or auth session keys from server
          const AUTH_SESSION_KEYS = new Set([
            'app_is_authenticated',
            'app_email',
            'app_username',
            'app_2fa_verified',
            'session_token',
          ]);
          const filtered: Record<string, string> = {};
          for (const [k, v] of Object.entries(serverData)) {
            if (!AUTH_SESSION_KEYS.has(k) && typeof v === 'string') {
              filtered[k] = v;
            }
          }
          this.mem = { ...this.mem, ...filtered };
        }
      }
    } catch {
      // Gracefully silent on network or server offline
    } finally {
      this.initialized = true;
    }
  }

  getItem(key: string): string | null {
    if (this.mem[key] !== undefined) {
      return this.mem[key];
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const val = window.localStorage.getItem(key);
        if (val !== null) {
          this.mem[key] = val;
          return val;
        }
      } catch (e) {}
    }
    return null;
  }

  // High-performance batched backend synchronization
  private scheduleBackendSync(key: string, value: string | null) {
    const AUTH_SESSION_KEYS = ['app_is_authenticated', 'app_email', 'app_username', 'app_2fa_verified', 'session_token'];
    if (AUTH_SESSION_KEYS.includes(key)) return;

    this.pendingSync[key] = value;

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      const itemsToSync = { ...this.pendingSync };
      this.pendingSync = {};
      this.syncTimeout = null;

      const keys = Object.keys(itemsToSync);
      if (keys.length === 0) return;

      if (keys.length === 1) {
        const singleKey = keys[0];
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: singleKey, value: itemsToSync[singleKey] }),
        }).catch(() => {});
      } else {
        // Multi-key batch sync
        Promise.all(
          keys.map((k) =>
            fetch('/api/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: k, value: itemsToSync[k] }),
            }).catch(() => {})
          )
        ).catch(() => {});
      }
    }, 250); // 250ms batching window
  }

  setItem(key: string, value: string) {
    const prev = this.mem[key];
    if (prev === value) return; // Prevent unnecessary dirty writes & event cascades

    this.mem[key] = value;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {}
    }
    
    // Fire event for UI to update only if value actually changed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('apiStorage_updated', { detail: { key, value } }));
    }

    this.scheduleBackendSync(key, value);
  }

  removeItem(key: string) {
    if (this.mem[key] === undefined) return;
    delete this.mem[key];
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {}
    }
    this.scheduleBackendSync(key, null);
  }

  async resetTradingData() {
    // 1. Immediately abort any debounced or pending backend writes
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    this.pendingSync = {};

    // 2. Define the STRICT white-list of keys to preserve:
    // - API Keys (Binance & Exchange credentials)
    // - Telegram Bot Token and Chat ID
    // - AI Model Keys & Settings (DeepSeek, Gemini, OpenAI, model selections)
    // - User Authentication & Session
    // - UI preferences (Language, Theme, Sound)
    const PRESERVED_KEYS = new Set([
      // Binance / Exchange API keys & configs
      'app_binance_api_key',
      'app_binance_api_secret',
      'app_binance_use_testnet',
      'app_binance_market_type',
      'binance_api_config',
      // Telegram bot tokens
      'app_telegram_bot_token',
      'app_telegram_chat_id',
      // AI model & API keys
      'DEEPSEEK_API_KEY',
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
      'selected_ai_model',
      'app_ai_model',
      'ai_model',
      'gemini_model',
      'ai_provider',
      // User authentication & session
      'app_is_authenticated',
      'app_username',
      'app_email',
      'session_token',
      'app_2fa_master_pin',
      'app_2fa_verified',
      'quantura_2fa_enabled',
      'quantura_2fa_configured',
      'quantura_2fa_secret',
      // UI Preferences
      'app_language',
      'app_timezone',
      'app_sound_enabled',
      'app_notifications_enabled',
      'quantura_display_mode',
      'app_dev_mode',
    ]);

    // 3. Clear all non-preserved keys from in-memory cache
    const currentMemKeys = Object.keys(this.mem);
    for (const k of currentMemKeys) {
      if (!PRESERVED_KEYS.has(k)) {
        delete this.mem[k];
      }
    }

    // 4. Clear all non-preserved keys from window.localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && !PRESERVED_KEYS.has(k)) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          window.localStorage.removeItem(k);
        }
      } catch (e) {}
    }

    // 5. Establish clean default baselines (1,000 USDT Paper Wallet, 0 Drawdown, 0 Trades)
    const preservedMarketType = this.getItem('app_binance_market_type') || 'FUTURES';

    const defaultBotConfig = JSON.stringify({
      enabled: false,
      activePresets: [],
      tradeAllocationPercent: 25,
      minConfidence: 75,
      mode: 'SCALE_OUT_REBUY',
      autoCompound: true,
      maxOpenTrades: 3,
      timeframe: 'AUTO',
      marketType: preservedMarketType,
      leverage: 3,
      marginMode: 'ISOLATED',
      trailingStopEnabled: true,
      trailingStopPercent: 1.2,
      trailingActivationProfitPercent: 1.5,
      dailyDrawdownLimitPercent: 5.0,
      circuitBreakerTripped: false,
      sizingMode: 'FIXED_PERCENT',
      riskPerTradePercent: 2.0,
      cooldownMinutes: 10,
      multiPairScanning: true,
      allowedSymbols: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'DOGE', 'LTC', 'UNI', 'ATOM', 'TRX', 'ETC', 'BCH', 'XLM', 'ALGO', 'VET'],
    });

    const defaultStrategies = JSON.stringify({
      INSTITUTIONAL_SMC: false,
      MOMENTUM: false,
      SWING: false,
      MTF_CONFLUENCE: false,
      VWAP_VOLUME_DELTA: false,
      FUNDING_SQUEEZE: false,
      BREAKOUT: false,
      SCALPER: false,
      MEAN_REVERSION: false,
      LIQUIDITY_HUNT: false,
    });

    const cleanWallet = JSON.stringify({
      balance: 1000,
      realizedPnl: 0,
      openPosition: null,
      history: [],
    });

    const cleanDrawdown = JSON.stringify({
      startingDailyEquity: 1000,
      lastDailyResetTimestamp: Date.now(),
      peakEquity: 1000,
      dailyRealizedPnl: 0,
      dailyFeesPaid: 0,
      dailyFundingPaid: 0,
      consecutiveLosses: 0,
      consecutiveWins: 0,
      lastClosedTradePnl: 0,
      lastClosedTradeSizeUsdt: 0,
      lastClosedTradeLeverage: 1,
    });

    // Write pristine zero baselines to mem
    this.mem['btc_active_bot_positions'] = '[]';
    this.mem['btc_trade_history'] = '[]';
    this.mem['btc_bot_logs'] = '[]';
    this.mem['btc_push_alerts'] = '[]';
    this.mem['btc_paper_wallet'] = cleanWallet;
    this.mem['paper_wallet_initial_deposit'] = '1000';
    this.mem['btc_bot_config'] = defaultBotConfig;
    this.mem['quantura_active_strategies'] = defaultStrategies;
    this.mem['quantura_risk_drawdown_state'] = cleanDrawdown;

    // Write pristine zero baselines to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('btc_active_bot_positions', '[]');
        window.localStorage.setItem('btc_trade_history', '[]');
        window.localStorage.setItem('btc_bot_logs', '[]');
        window.localStorage.setItem('btc_push_alerts', '[]');
        window.localStorage.setItem('btc_paper_wallet', cleanWallet);
        window.localStorage.setItem('paper_wallet_initial_deposit', '1000');
        window.localStorage.setItem('btc_bot_config', defaultBotConfig);
        window.localStorage.setItem('quantura_active_strategies', defaultStrategies);
        window.localStorage.setItem('quantura_risk_drawdown_state', cleanDrawdown);
      } catch (e) {}
    }

    // 6. Execute root-level server reset
    try {
      const res = await fetch('/api/system/full-factory-reset', { method: 'POST' });
      if (!res.ok) {
        await fetch('/api/trading/reset', { method: 'POST' });
      }
    } catch {
      try {
        await fetch('/api/trading/reset', { method: 'POST' });
      } catch {}
    }

    // 7. Dispatch storage update notification for UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('apiStorage_updated', { detail: { key: 'ALL_RESET' } }));
    }
  }

  clear() {
    this.mem = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const authPrefixes = ['firebase', 'auth', 'user', 'session', 'clerk', 'supabase', 'google'];
        const keysToRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && !authPrefixes.some(p => k.toLowerCase().includes(p))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => window.localStorage.removeItem(k));
      } catch (e) {}
    }
    fetch('/api/config/clear', { method: 'POST' }).catch(() => {});
  }
  
  get length() {
    return Object.keys(this.mem).length;
  }
  
  key(index: number) {
    return Object.keys(this.mem)[index] || null;
  }
}

export const apiStorage = new ApiStorage();
