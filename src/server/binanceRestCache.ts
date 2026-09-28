import { binanceWs, MiniTickerData } from './binanceWebSocket.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

class BinanceRestCache {
  private static instance: BinanceRestCache;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private ipBannedUntil: number = 0;

  private constructor() {}

  public static getInstance(): BinanceRestCache {
    if (!BinanceRestCache.instance) {
      BinanceRestCache.instance = new BinanceRestCache();
    }
    return BinanceRestCache.instance;
  }

  public isIpBanned(): boolean {
    return Date.now() < this.ipBannedUntil;
  }

  public recordIpBan(bannedUntilTimestamp?: number) {
    // If timestamp provided (e.g. 1790635379022), use it, otherwise default to 5 minutes
    const until = bannedUntilTimestamp && bannedUntilTimestamp > Date.now() 
      ? bannedUntilTimestamp 
      : Date.now() + 5 * 60 * 1000;
    this.ipBannedUntil = until;
    console.warn(`[BINANCE RATE LIMIT] ⚠️ IP Ban detected. Backing off REST calls until ${new Date(until).toISOString()}. Relying 100% on WebSocket live streams!`);
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  public set<T>(key: string, data: T, ttlMs: number = 30000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
    });
  }

  public clear() {
    this.cache.clear();
  }
}

export const binanceRestCache = BinanceRestCache.getInstance();
