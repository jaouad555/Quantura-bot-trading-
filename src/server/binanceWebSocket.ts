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
  private isStarted = false;

  private constructor() {}

  public static getInstance(): BinanceWebSocketManager {
    if (!BinanceWebSocketManager.instance) {
      BinanceWebSocketManager.instance = new BinanceWebSocketManager();
    }
    return BinanceWebSocketManager.instance;
  }

  public start() {
    if (this.isStarted) return;
    this.isStarted = true;
    console.log('[BINANCE WS] 🚀 Initializing Binance Real-Time WebSocket Price Streaming...');
    this.connectFutures();
    this.connectSpot();
  }

  public stop() {
    this.isStarted = false;
    if (this.pingIntervalFutures) clearInterval(this.pingIntervalFutures);
    if (this.pingIntervalSpot) clearInterval(this.pingIntervalSpot);
    if (this.futuresWs) {
      try { this.futuresWs.terminate(); } catch (_) {}
      this.futuresWs = null;
    }
    if (this.spotWs) {
      try { this.spotWs.terminate(); } catch (_) {}
      this.spotWs = null;
    }
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
    return (
      (this.futuresWs?.readyState === WebSocket.OPEN || this.spotWs?.readyState === WebSocket.OPEN) &&
      this.priceMap.size > 0
    );
  }

  private connectFutures() {
    if (!this.isStarted || this.isReconnectingFutures) return;
    this.isReconnectingFutures = true;

    try {
      if (this.pingIntervalFutures) clearInterval(this.pingIntervalFutures);
      if (this.futuresWs) {
        try { this.futuresWs.terminate(); } catch (_) {}
      }

      // Binance Futures Mini-Ticker Array Stream: streams all symbols every 1 second in a single stream!
      const wsUrl = 'wss://fstream.binance.com/ws/!miniTicker@arr';
      this.futuresWs = new WebSocket(wsUrl);

      this.futuresWs.on('open', () => {
        this.isReconnectingFutures = false;
        console.log('[BINANCE WS] ✅ Futures WebSocket Connected (!miniTicker@arr)');
        this.pingIntervalFutures = setInterval(() => {
          if (this.futuresWs?.readyState === WebSocket.OPEN) {
            this.futuresWs.ping();
          }
        }, 30000);
      });

      this.futuresWs.on('message', (raw: WebSocket.Data) => {
        try {
          const items = JSON.parse(raw.toString());
          if (Array.isArray(items)) {
            const now = Date.now();
            for (const item of items) {
              const s = item.s; // Symbol (e.g. BTCUSDT)
              const c = parseFloat(item.c); // Current close price
              const o = parseFloat(item.o); // Open price
              const h = parseFloat(item.h); // High
              const l = parseFloat(item.l); // Low
              const v = parseFloat(item.v); // Volume
              const q = parseFloat(item.q); // Quote volume

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

      this.futuresWs.on('error', (err) => {
        console.warn('[BINANCE WS] Futures WebSocket warning:', err.message);
      });

      this.futuresWs.on('close', () => {
        if (this.pingIntervalFutures) clearInterval(this.pingIntervalFutures);
        this.futuresWs = null;
        if (this.isStarted) {
          setTimeout(() => {
            this.isReconnectingFutures = false;
            this.connectFutures();
          }, 5000);
        }
      });
    } catch (err: any) {
      this.isReconnectingFutures = false;
      setTimeout(() => this.connectFutures(), 5000);
    }
  }

  private connectSpot() {
    if (!this.isStarted || this.isReconnectingSpot) return;
    this.isReconnectingSpot = true;

    try {
      if (this.pingIntervalSpot) clearInterval(this.pingIntervalSpot);
      if (this.spotWs) {
        try { this.spotWs.terminate(); } catch (_) {}
      }

      // Binance Spot Mini-Ticker Array Stream: streams all symbols every 1 second
      const wsUrl = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';
      this.spotWs = new WebSocket(wsUrl);

      this.spotWs.on('open', () => {
        this.isReconnectingSpot = false;
        console.log('[BINANCE WS] ✅ Spot WebSocket Connected (!miniTicker@arr)');
        this.pingIntervalSpot = setInterval(() => {
          if (this.spotWs?.readyState === WebSocket.OPEN) {
            this.spotWs.ping();
          }
        }, 30000);
      });

      this.spotWs.on('message', (raw: WebSocket.Data) => {
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

              // Don't overwrite Futures if it was updated in the last 2 seconds
              const existing = this.priceMap.get(s);
              if (existing && now - existing.timestamp < 2000) {
                continue;
              }

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

      this.spotWs.on('error', (err) => {
        console.warn('[BINANCE WS] Spot WebSocket warning:', err.message);
      });

      this.spotWs.on('close', () => {
        if (this.pingIntervalSpot) clearInterval(this.pingIntervalSpot);
        this.spotWs = null;
        if (this.isStarted) {
          setTimeout(() => {
            this.isReconnectingSpot = false;
            this.connectSpot();
          }, 5000);
        }
      });
    } catch (err: any) {
      this.isReconnectingSpot = false;
      setTimeout(() => this.connectSpot(), 5000);
    }
  }
}

export const binanceWs = BinanceWebSocketManager.getInstance();
