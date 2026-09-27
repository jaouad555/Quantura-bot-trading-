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
    const defaultBotConfig = JSON.stringify({
      enabled: false,
      activePresets: [],
      tradeAllocationPercent: 25,
      minConfidence: 75,
      mode: 'SCALE_OUT_REBUY',
      autoCompound: true,
      maxOpenTrades: 3,
      timeframe: 'AUTO',
      marketType: 'FUTURES',
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
      MOMENTUM: false,
      SCALPER: false,
      SWING: false,
      BREAKOUT: false,
      MEAN_REVERSION: false,
      INSTITUTIONAL_SMC: false,
    });

    this.mem['btc_active_bot_positions'] = '[]';
    this.mem['btc_trade_history'] = '[]';
    this.mem['btc_bot_logs'] = '[]';
    this.mem['btc_paper_wallet'] = JSON.stringify({
      balance: 1000,
      realizedPnl: 0,
      openPosition: null,
      history: [],
    });
    this.mem['btc_push_alerts'] = '[]';
    this.mem['btc_bot_config'] = defaultBotConfig;
    this.mem['quantura_active_strategies'] = defaultStrategies;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('btc_active_bot_positions', '[]');
        window.localStorage.setItem('btc_trade_history', '[]');
        window.localStorage.setItem('btc_bot_logs', '[]');
        window.localStorage.setItem('btc_paper_wallet', JSON.stringify({
          balance: 1000,
          realizedPnl: 0,
          openPosition: null,
          history: [],
        }));
        window.localStorage.setItem('btc_push_alerts', '[]');
        window.localStorage.setItem('btc_bot_config', defaultBotConfig);
        window.localStorage.setItem('quantura_active_strategies', defaultStrategies);
      } catch (e) {}
    }

    try {
      await fetch('/api/trading/reset', { method: 'POST' });
    } catch {}
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
