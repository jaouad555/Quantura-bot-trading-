import { BinanceTicker, KlineCandle, OrderBookSummary, Timeframe, ConnectionState, MarketType } from '../types';

type TickerCallback = (ticker: BinanceTicker) => void;
type KlineCallback = (kline: KlineCandle, isFinal: boolean) => void;
type OrderBookCallback = (orderBook: OrderBookSummary) => void;
type StateCallback = (state: ConnectionState) => void;

class BinanceWebSocketManager {
  private ws: WebSocket | null = null;
  private currentSymbol = 'btcusdt';
  private currentTimeframe: Timeframe = '1h';
  private currentMarketType: MarketType = 'SPOT';
  private connectionState: ConnectionState = 'OFFLINE';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private connectTimeoutTimer: any = null;

  private tickerListeners: Set<TickerCallback> = new Set();
  private klineListeners: Set<KlineCallback> = new Set();
  private orderBookListeners: Set<OrderBookCallback> = new Set();
  private stateListeners: Set<StateCallback> = new Set();

  private isIntentionalClose = false;

  public connect(
    symbolOrTimeframe: string | Timeframe = 'btcusdt',
    timeframe: Timeframe = '1h',
    marketType: MarketType = this.currentMarketType
  ) {
    if (symbolOrTimeframe.includes('m') || symbolOrTimeframe.includes('h') || symbolOrTimeframe.includes('d') || symbolOrTimeframe.includes('w')) {
      this.currentTimeframe = symbolOrTimeframe as Timeframe;
    } else {
      this.currentSymbol = symbolOrTimeframe.toLowerCase();
      this.currentTimeframe = timeframe;
    }
    this.currentMarketType = marketType;
    this.isIntentionalClose = false;
    this.cleanup();
    this.setState('CONNECTING');

    const streamTimeframe = this.mapTimeframe(this.currentTimeframe);
    // Combined streams URL
    const streams = [
      `${this.currentSymbol}@ticker`,
      `${this.currentSymbol}@kline_${streamTimeframe}`,
      `${this.currentSymbol}@depth20@1000ms`,
    ].join('/');

    // Futures WebSocket vs Spot WebSocket
    const isFutures = this.currentMarketType === 'FUTURES';
    const wsUrl = isFutures
      ? `wss://fstream.binance.com/stream?streams=${streams}`
      : `wss://stream.binance.com:9443/stream?streams=${streams}`;

    // Safety timeout: if WebSocket doesn't connect in 4 seconds, abort attempt
    this.connectTimeoutTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        try {
          this.ws.close();
        } catch (_) {}
      }
    }, 4000);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
        this.reconnectAttempts = 0;
        this.setState('CONNECTED');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleStreamMessage(payload);
        } catch (e) {
          // ignore malformed message
        }
      };

      this.ws.onerror = (err) => {
        console.warn(`Binance WebSocket error (${this.currentMarketType}):`, err);
        this.setState('ERROR');
      };

      this.ws.onclose = (ev) => {
        this.stopHeartbeat();
        if (!this.isIntentionalClose) {
          this.setState('RECONNECTING');
          this.scheduleReconnect();
        } else {
          this.setState('OFFLINE');
        }
      };
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
      this.setState('ERROR');
      this.scheduleReconnect();
    }
  }

  public updateSymbol(newSymbol: string) {
    const clean = newSymbol.toLowerCase();
    if (this.currentSymbol === clean && this.connectionState === 'CONNECTED') {
      return;
    }
    this.currentSymbol = clean;
    this.connect(clean, this.currentTimeframe, this.currentMarketType);
  }

  public setSymbol(newSymbol: string) {
    this.updateSymbol(newSymbol);
  }

  public updateTimeframe(newTimeframe: Timeframe) {
    if (this.currentTimeframe === newTimeframe && this.connectionState === 'CONNECTED') {
      return;
    }
    this.currentTimeframe = newTimeframe;
    this.connect(this.currentSymbol, newTimeframe, this.currentMarketType);
  }

  public setTimeframe(newTimeframe: Timeframe) {
    this.updateTimeframe(newTimeframe);
  }

  public updateMarketType(newMarketType: MarketType) {
    if (this.currentMarketType === newMarketType && this.connectionState === 'CONNECTED') {
      return;
    }
    this.currentMarketType = newMarketType;
    this.connect(this.currentSymbol, this.currentTimeframe, newMarketType);
  }

  public setMarketType(newMarketType: MarketType) {
    this.updateMarketType(newMarketType);
  }

  public getMarketType(): MarketType {
    return this.currentMarketType;
  }

  public disconnect() {
    this.isIntentionalClose = true;
    this.cleanup();
    this.setState('OFFLINE');
  }

  public onTicker(cb: TickerCallback) {
    this.tickerListeners.add(cb);
    return () => this.tickerListeners.delete(cb);
  }

  public onKline(cb: KlineCallback) {
    this.klineListeners.add(cb);
    return () => this.klineListeners.delete(cb);
  }

  public onOrderBook(cb: OrderBookCallback) {
    this.orderBookListeners.add(cb);
    return () => this.orderBookListeners.delete(cb);
  }

  public onStateChange(cb: StateCallback) {
    this.stateListeners.add(cb);
    cb(this.connectionState);
    return () => this.stateListeners.delete(cb);
  }

  public getState(): ConnectionState {
    return this.connectionState;
  }

  private setState(state: ConnectionState) {
    this.connectionState = state;
    this.stateListeners.forEach((cb) => cb(state));
  }

  private mapTimeframe(tf: string): string {
    switch (tf) {
      case '1m': return '1m';
      case '3m': return '3m';
      case '5m': return '5m';
      case '15m': return '15m';
      case '30m': return '30m';
      case '1h': return '1h';
      case '2h': return '2h';
      case '4h': return '4h';
      case '6h': return '6h';
      case '8h': return '8h';
      case '12h': return '12h';
      case '1d': return '1d';
      case '3d': return '3d';
      case '1w': return '1w';
      case '1M': return '1M';
      default: return tf || '1h';
    }
  }

  private handleStreamMessage(payload: any) {
    if (!payload || !payload.stream || !payload.data) return;

    const stream = payload.stream;
    const data = payload.data;

    // 1. Ticker Stream
    if (stream.endsWith('@ticker')) {
      const price = parseFloat(data.c);
      if (isNaN(price) || price <= 0) return;
      const ticker: BinanceTicker = {
        symbol: (data.s || this.currentSymbol).toUpperCase(),
        price: price,
        priceChange24h: parseFloat(data.p) || 0,
        priceChangePercent24h: parseFloat(data.P) || 0,
        high24h: parseFloat(data.h) || price,
        low24h: parseFloat(data.l) || price,
        volume24h: parseFloat(data.v) || 0,
        quoteVolume24h: parseFloat(data.q) || 0,
        updatedAt: data.E || Date.now(),
      };
      this.tickerListeners.forEach((cb) => cb(ticker));
    }

    // 2. Kline Stream
    if (stream.includes('@kline')) {
      const k = data.k;
      if (k) {
        const kline: KlineCandle = {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        };
        const isFinal = k.x;
        this.klineListeners.forEach((cb) => cb(kline, isFinal));
      }
    }

    // 3. Depth (Order Book) Stream
    if (stream.includes('@depth')) {
      const bids = (data.bids || []).map((b: string[]) => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
      const asks = (data.asks || []).map((a: string[]) => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));

      const bidTotal = bids.reduce((acc: number, b: any) => acc + b.price * b.qty, 0);
      const askTotal = asks.reduce((acc: number, a: any) => acc + a.price * a.qty, 0);
      const total = bidTotal + askTotal;

      const bidAskRatio = askTotal > 0 ? Math.round((bidTotal / askTotal) * 100) / 100 : 1;
      const imbalancePercent = total > 0 ? Math.round(((bidTotal - askTotal) / total) * 1000) / 10 : 0;

      let bias: 'BUYERS_STRONG' | 'SELLERS_STRONG' | 'BALANCED' = 'BALANCED';
      if (bidAskRatio >= 1.25) bias = 'BUYERS_STRONG';
      else if (bidAskRatio <= 0.8) bias = 'SELLERS_STRONG';

      const largeWalls: { price: number; type: 'BID' | 'ASK'; volume: number }[] = [];
      const avgBidVol = bids.reduce((a: number, b: any) => a + b.qty, 0) / (bids.length || 1);
      const avgAskVol = asks.reduce((a: number, b: any) => a + b.qty, 0) / (asks.length || 1);

      bids.forEach((b: any) => {
        if (b.qty > avgBidVol * 2.5) {
          largeWalls.push({ price: b.price, type: 'BID', volume: Math.round(b.qty * b.price) });
        }
      });
      asks.forEach((a: any) => {
        if (a.qty > avgAskVol * 2.5) {
          largeWalls.push({ price: a.price, type: 'ASK', volume: Math.round(a.qty * a.price) });
        }
      });

      const orderBook: OrderBookSummary = {
        bidTotal: Math.round(bidTotal),
        askTotal: Math.round(askTotal),
        bidAskRatio,
        imbalancePercent,
        bias,
        topBids: bids.slice(0, 8),
        topAsks: asks.slice(0, 8),
        largeWalls: largeWalls.slice(0, 4),
      };

      this.orderBookListeners.forEach((cb) => cb(orderBook));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max WebSocket reconnect attempts reached. Waiting for manual reconnect.');
      this.setState('OFFLINE');
      return;
    }

    const backoffMs = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.currentSymbol, this.currentTimeframe, this.currentMarketType);
    }, backoffMs);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send lightweight ping if needed
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private cleanup() {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
  }
}

export const binanceWs = new BinanceWebSocketManager();
export const binanceWsManager = binanceWs;

