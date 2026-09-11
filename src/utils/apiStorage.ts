class ApiStorage {
  private mem: Record<string, string> = {};
  private initialized = false;

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
          this.mem = { ...this.mem, ...serverData };
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

  
  setItem(key: string, value: string) {
    this.mem[key] = value;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {}
    }
    
    // Fire event for UI to update
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('apiStorage_updated', { detail: { key, value } }));
    }

    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    }).catch(() => {});
  }


  removeItem(key: string) {
    delete this.mem[key];
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {}
    }
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: null }),
    }).catch(() => {});
  }

  async resetTradingData() {
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

