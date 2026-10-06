import WebSocket from 'ws';

export interface MiniTickerData {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
  change24h: number;
  changePercent24h: number;
  timestamp: number;
}

class BinanceWebSocketManager {
  private static instance: BinanceWebSocketManager;
  private futuresWs: WebSocket | null = null;
  private spotWs: WebSocket | null = null;
  private priceMap: Map<string, MiniTickerData> = new Map();
  private isReconnectingFutures = false;
  private isReconnectingSpot = false;
  private pingIntervalFutures: NodeJS.Timeout | null = null;
  private pingIntervalSpot: NodeJS.Timeout | null = null;
  private reconnectTimeoutFutures: NodeJS.Timeout | null = null;
  private reconnectTimeoutSpot: NodeJS.Timeout | null = null;
  private isStarted = false;
  private activeMarketType: 'SPOT' | 'FUTURES' = 'SPOT';

  private constructor() {}

  public static getInstance(): BinanceWebSocketManager {
    if (!BinanceWebSocketManager.instance) {
      BinanceWebSocketManager.instance = new BinanceWebSocketManager();
    }
    return BinanceWebSocketManager.instance;
  }

  public getMarketType(): 'SPOT' | 'FUTURES' {
    return this.activeMarketType;
  }

  public start(initialMarketType: 'SPOT' | 'FUTURES' = 'SPOT') {
    this.activeMarketType = initialMarketType === 'FUTURES' ? 'FUTURES' : 'SPOT';
    if (this.isStarted) {
      this.setMarketType(this.activeMarketType);
      return;
    }
    this.isStarted = true;
    console.log(`[BINANCE WS] 🚀 Initializing Binance Real-Time WebSocket for [${this.activeMarketType}]... (The other market is strictly DISABLED)`);
    
    if (this.activeMarketType === 'FUTURES') {
      this.disconnectSpot();
      this.connectFutures();
    } else {
      this.disconnectFutures();
      this.connectSpot();
    }
  }

  public setMarketType(newMarketType: 'SPOT' | 'FUTURES') {
    const targetMt = newMarketType === 'FUTURES' ? 'FUTURES' : 'SPOT';
    const previousMt = this.activeMarketType;
    this.activeMarketType = targetMt;

    if (previousMt !== targetMt) {
      console.log(`[BINANCE WS] 🔄 Market Type switched: [${previousMt}] → [${targetMt}]. Purging stale price cache & disabling ${previousMt}...`);
      this.priceMap.clear();
    }

    if (targetMt === 'FUTURES') {
      this.disconnectSpot();
      if (!this.futuresWs || this.futuresWs.readyState !== WebSocket.OPEN) {
        this.connectFutures();
      }
    } else {
      this.disconnectFutures();
      if (!this.spotWs || this.spotWs.readyState !== WebSocket.OPEN) {
        this.connectSpot();
      }
    }
  }

  public disconnectFutures() {
    this.isReconnectingFutures = false;
    if (this.reconnectTimeoutFutures) {
      clearTimeout(this.reconnectTimeoutFutures);
      this.reconnectTimeoutFutures = null;
    }
    if (this.pingIntervalFutures) {
      clearInterval(this.pingIntervalFutures);
      this.pingIntervalFutures = null;
    }
    if (this.futuresWs) {
      const wsToClose = this.futuresWs;
      this.futuresWs = null;
      try {
        wsToClose.on('error', () => {});
        wsToClose.removeAllListeners('error');
        wsToClose.on('error', () => {});
        if (wsToClose.readyState === WebSocket.OPEN) {
          wsToClose.close();
        } else {
          wsToClose.terminate();
        }
      } catch (_) {}
      console.log('[BINANCE WS] 🛑 Futures WebSocket completely disconnected & DISABLED');
    }
  }

  public disconnectSpot() {
    this.isReconnectingSpot = false;
    if (this.reconnectTimeoutSpot) {
      clearTimeout(this.reconnectTimeoutSpot);
      this.reconnectTimeoutSpot = null;
    }
    if (this.pingIntervalSpot) {
      clearInterval(this.pingIntervalSpot);
      this.pingIntervalSpot = null;
    }
    if (this.spotWs) {
      const wsToClose = this.spotWs;
      this.spotWs = null;
      try {
        wsToClose.on('error', () => {});
        wsToClose.removeAllListeners('error');
        wsToClose.on('error', () => {});
        if (wsToClose.readyState === WebSocket.OPEN) {
          wsToClose.close();
        } else {
          wsToClose.terminate();
        }
      } catch (_) {}
      console.log('[BINANCE WS] 🛑 Spot WebSocket completely disconnected & DISABLED');
    }
  }

  public stop() {
    this.isStarted = false;
    this.disconnectFutures();
    this.disconnectSpot();
    this.priceMap.clear();
  }

  public getPrice(symbol: string): number | null {
    const norm = (symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const data = this.priceMap.get(norm) || this.priceMap.get(`${norm}USDT`);
    if (data && data.price > 0 && Date.now() - data.timestamp < 30000) {
      return data.price;
    }
    return null;
  }

  public getTicker(symbol: string): MiniTickerData | null {
    const norm = (symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const data = this.priceMap.get(norm) || this.priceMap.get(`${norm}USDT`);
    if (data && data.price > 0 && Date.now() - data.timestamp < 30000) {
      return data;
    }
    return null;
  }

  public getAllTickers(): Record<string, MiniTickerData> {
    const result: Record<string, MiniTickerData> = {};
    const now = Date.now();
    for (const [sym, data] of this.priceMap.entries()) {
      if (now - data.timestamp < 30000) {
        result[sym] = data;
      }
    }
    return result;
  }

  public isHealthy(): boolean {
    if (this.activeMarketType === 'FUTURES') {
      return this.futuresWs?.readyState === WebSocket.OPEN && this.priceMap.size > 0;
    }
    return this.spotWs?.readyState === WebSocket.OPEN && this.priceMap.size > 0;
  }

  private connectFutures() {
    // Strictly prevent connecting if market is not FUTURES
    if (!this.isStarted || this.activeMarketType !== 'FUTURES' || this.isReconnectingFutures) return;
    this.isReconnectingFutures = true;

    try {
      if (this.pingIntervalFutures) clearInterval(this.pingIntervalFutures);
      if (this.futuresWs) {
        try {
          this.futuresWs.on('error', () => {});
          this.futuresWs.terminate();
        } catch (_) {}
        this.futuresWs = null;
      }

      // Binance Futures Mini-Ticker Array Stream
      const wsUrl = 'wss://fstream.binance.com/ws/!miniTicker@arr';
      const ws = new WebSocket(wsUrl);
      this.futuresWs = ws;

      ws.on('error', (err) => {
        console.warn('[BINANCE WS] Futures WebSocket warning:', err?.message);
      });

      ws.on('open', () => {
        this.isReconnectingFutures = false;
        if (this.activeMarketType !== 'FUTURES') {
          this.disconnectFutures();
          return;
        }
        console.log('[BINANCE WS] ✅ Futures WebSocket Connected (!miniTicker@arr) [SPOT is DISABLED]');
        this.pingIntervalFutures = setInterval(() => {
          if (this.futuresWs?.readyState === WebSocket.OPEN) {
            this.futuresWs.ping();
          }
        }, 30000);
      });

      ws.on('message', (raw: WebSocket.Data) => {
        if (this.activeMarketType !== 'FUTURES') return;
        try {
          const items = JSON.parse(raw.toString());
          if (Array.isArray(items)) {
            const now = Date.now();
            for (const item of items) {
              const s = item.s;
              const c = parseFloat(item.c);
              const o = parseFloat(item.o);
              const h = parseFloat(item.h);
              const l = parseFloat(item.l);
              const v = parseFloat(item.v);
              const q = parseFloat(item.q);

              if (s && !isNaN(c) && c > 0) {
                const diff = c - o;
                const pct = o > 0 ? (diff / o) * 100 : 0;
                this.priceMap.set(s, {
                  symbol: s,
                  price: c,
                  open: o,
                  high: h,
                  low: l,
                  volume: v,
                  quoteVolume: q,
                  change24h: diff,
                  changePercent24h: pct,
                  timestamp: now,
                });
              }
            }
          }
        } catch (_) {}
      });

      ws.on('close', () => {
        if (this.pingIntervalFutures) clearInterval(this.pingIntervalFutures);
        this.futuresWs = null;
        if (this.isStarted && this.activeMarketType === 'FUTURES') {
          this.reconnectTimeoutFutures = setTimeout(() => {
            this.isReconnectingFutures = false;
            this.connectFutures();
          }, 5000);
        }
      });
    } catch (err: any) {
      this.isReconnectingFutures = false;
      if (this.activeMarketType === 'FUTURES') {
        this.reconnectTimeoutFutures = setTimeout(() => this.connectFutures(), 5000);
      }
    }
  }

  private connectSpot() {
    // Strictly prevent connecting if market is not SPOT
    if (!this.isStarted || this.activeMarketType !== 'SPOT' || this.isReconnectingSpot) return;
    this.isReconnectingSpot = true;

    try {
      if (this.pingIntervalSpot) clearInterval(this.pingIntervalSpot);
      if (this.spotWs) {
        try {
          this.spotWs.on('error', () => {});
          this.spotWs.terminate();
        } catch (_) {}
        this.spotWs = null;
      }

      // Binance Spot Mini-Ticker Array Stream
      const wsUrl = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';
      const ws = new WebSocket(wsUrl);
      this.spotWs = ws;

      ws.on('error', (err) => {
        console.warn('[BINANCE WS] Spot WebSocket warning:', err?.message);
      });

      ws.on('open', () => {
        this.isReconnectingSpot = false;
        if (this.activeMarketType !== 'SPOT') {
          this.disconnectSpot();
          return;
        }
        console.log('[BINANCE WS] ✅ Spot WebSocket Connected (!miniTicker@arr) [FUTURES is DISABLED]');
        this.pingIntervalSpot = setInterval(() => {
          if (this.spotWs?.readyState === WebSocket.OPEN) {
            this.spotWs.ping();
          }
        }, 30000);
      });

      ws.on('message', (raw: WebSocket.Data) => {
        if (this.activeMarketType !== 'SPOT') return;
        try {
          const items = JSON.parse(raw.toString());
          if (Array.isArray(items)) {
            const now = Date.now();
            for (const item of items) {
              const s = item.s;
              const c = parseFloat(item.c);
              const o = parseFloat(item.o);
              const h = parseFloat(item.h);
              const l = parseFloat(item.l);
              const v = parseFloat(item.v);
              const q = parseFloat(item.q);

              if (s && !isNaN(c) && c > 0) {
                const diff = c - o;
                const pct = o > 0 ? (diff / o) * 100 : 0;
                this.priceMap.set(s, {
                  symbol: s,
                  price: c,
                  open: o,
                  high: h,
                  low: l,
                  volume: v,
                  quoteVolume: q,
                  change24h: diff,
                  changePercent24h: pct,
                  timestamp: now,
                });
              }
            }
          }
        } catch (_) {}
      });

      ws.on('close', () => {
        if (this.pingIntervalSpot) clearInterval(this.pingIntervalSpot);
        this.spotWs = null;
        if (this.isStarted && this.activeMarketType === 'SPOT') {
          this.reconnectTimeoutSpot = setTimeout(() => {
            this.isReconnectingSpot = false;
            this.connectSpot();
          }, 5000);
        }
      });
    } catch (err: any) {
      this.isReconnectingSpot = false;
      if (this.activeMarketType === 'SPOT') {
        this.reconnectTimeoutSpot = setTimeout(() => this.connectSpot(), 5000);
      }
    }
  }
}

export const binanceWs = BinanceWebSocketManager.getInstance();
