import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  ColorType,
  IChartApi,
  ISeriesApi,
  LineStyle,
  IPriceLine,
} from 'lightweight-charts';
import {
  KlineCandle,
  Timeframe,
  AIAnalysisResult,
  Language,
  BinanceTicker,
  ActiveBotPosition,
  MarketType,
} from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import {
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateHeikinAshi,
  calculatePivotPoints,
} from '../utils/chartIndicators';
import {
  Maximize2,
  Minimize2,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Eye,
  EyeOff,
  Radio,
  BarChart2,
  RotateCcw,
  Zap,
  ShieldAlert,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  Sliders,
  Sparkles,
} from 'lucide-react';

export type ChartType = 'candlestick' | 'heikin-ashi' | 'area' | 'line';

interface TradingChartProps {
  symbol?: string;
  klines: KlineCandle[];
  activeTimeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  activeSignal: AIAnalysisResult | null;
  language: Language;
  ticker?: BinanceTicker | null;
  activeBotPositions?: ActiveBotPosition[];
  marketType?: MarketType;
  onManualClosePosition?: (positionId: string) => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol = 'BTCUSDT',
  klines,
  activeTimeframe,
  onTimeframeChange,
  activeSignal,
  language,
  ticker,
  activeBotPositions = [],
  marketType = 'FUTURES',
  onManualClosePosition,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);

  // Series refs
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Price lines (Signal + Position levels)
  const signalPriceLinesRef = useRef<IPriceLine[]>([]);
  const positionPriceLinesRef = useRef<IPriceLine[]>([]);
  const pivotPriceLinesRef = useRef<IPriceLine[]>([]);

  // Chart configuration states
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIndicatorsBar, setShowIndicatorsBar] = useState(true);

  // Indicator toggle states
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showEma200, setShowEma200] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showPivots, setShowPivots] = useState(false);
  const [showSignalLevels, setShowSignalLevels] = useState(true);
  const [showPositionLevels, setShowPositionLevels] = useState(true);

  // Hovered candle data for crosshair inspection bar
  const [hoveredCandle, setHoveredCandle] = useState<{
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    changePct: number;
    ema20?: number;
    ema50?: number;
    ema200?: number;
  } | null>(null);

  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';
  const isEn = language === 'en';

  // Find active position for this specific symbol
  const activePosition = useMemo(() => {
    return activeBotPositions.find(
      (p) => p.symbol.toLowerCase() === symbol.toLowerCase()
    );
  }, [activeBotPositions, symbol]);

  // Derived indicator calculations
  const rsiValue = useMemo(() => calculateRSI(klines, 14), [klines]);
  const pivotData = useMemo(() => calculatePivotPoints(klines), [klines]);

  // Latest candle info
  const latestCandle = useMemo(() => {
    if (!klines || klines.length === 0) return null;
    const last = klines[klines.length - 1];
    const prev = klines.length > 1 ? klines[klines.length - 2] : last;
    const changePct = ((last.close - last.open) / (last.open || 1)) * 100;
    return {
      ...last,
      changePct,
    };
  }, [klines]);

  // Estimated Order Flow Imbalance / Volume Pressure from recent candles
  const volumePressure = useMemo(() => {
    if (!klines || klines.length < 5) return { buyersPct: 50, sellersPct: 50 };
    const slice = klines.slice(-15);
    let buyVol = 0;
    let sellVol = 0;
    slice.forEach((k) => {
      if (k.close >= k.open) buyVol += k.volume;
      else sellVol += k.volume;
    });
    const total = buyVol + sellVol;
    if (total === 0) return { buyersPct: 50, sellersPct: 50 };
    const buyersPct = Math.round((buyVol / total) * 100);
    return { buyersPct, sellersPct: 100 - buyersPct };
  }, [klines]);

  // Real-time price display with strict symbol matching to eliminate lag/mismatch
  const isTickerMatching = ticker?.symbol ? ticker.symbol.toUpperCase() === symbol.toUpperCase() : false;
  const currentPrice = isTickerMatching && ticker?.price ? ticker.price : (latestCandle?.close || 0);
  const priceChange24h = isTickerMatching ? (ticker?.priceChangePercent24h || 0) : (latestCandle?.changePct || 0);
  const high24h = isTickerMatching && ticker?.high24h ? ticker.high24h : (latestCandle?.high || currentPrice);
  const low24h = isTickerMatching && ticker?.low24h ? ticker.low24h : (latestCandle?.low || currentPrice);
  const volume24h = isTickerMatching ? (ticker?.volume24h || 0) : 0;

  // 24h Range percentage
  const priceRangePct = useMemo(() => {
    if (high24h <= low24h || currentPrice <= 0) return 50;
    const pct = ((currentPrice - low24h) / (high24h - low24h)) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
  }, [currentPrice, high24h, low24h]);

  // Trend strength determination
  const trendStatus = useMemo(() => {
    if (!klines || klines.length < 50) return 'NEUTRAL';
    const ema20 = calculateEMA(klines, 20);
    const ema50 = calculateEMA(klines, 50);
    if (ema20.length === 0 || ema50.length === 0) return 'NEUTRAL';
    const lastEma20 = ema20[ema20.length - 1].value;
    const lastEma50 = ema50[ema50.length - 1].value;

    if (currentPrice > lastEma20 && lastEma20 > lastEma50) return 'STRONG_BULLISH';
    if (currentPrice > lastEma50) return 'BULLISH';
    if (currentPrice < lastEma20 && lastEma20 < lastEma50) return 'STRONG_BEARISH';
    if (currentPrice < lastEma50) return 'BEARISH';
    return 'NEUTRAL';
  }, [klines, currentPrice]);

  // Initialize and build chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      chartContainerRef.current.innerHTML = '';

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#090d16' },
          textColor: '#94a3b8',
          fontSize: 11,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        },
        grid: {
          vertLines: { color: 'rgba(30, 41, 59, 0.45)', style: LineStyle.Dotted },
          horzLines: { color: 'rgba(30, 41, 59, 0.45)', style: LineStyle.Dotted },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: '#38bdf8',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#0284c7',
          },
          horzLine: {
            color: '#38bdf8',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#0284c7',
          },
        },
        rightPriceScale: {
          borderColor: '#1e293b',
          scaleMargins: {
            top: 0.08,
            bottom: 0.22,
          },
          autoScale: true,
        },
        timeScale: {
          borderColor: '#1e293b',
          timeVisible: true,
          secondsVisible: false,
          shiftVisibleRangeOnNewBar: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      // Volume Series (histogram at bottom)
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.82,
          bottom: 0,
        },
      });

      // Technical Indicators Series
      const ema20Series = chart.addSeries(LineSeries, {
        color: '#f59e0b', // Gold / Amber
        lineWidth: 1.5 as any,
        title: 'EMA 20',
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const ema50Series = chart.addSeries(LineSeries, {
        color: '#06b6d4', // Cyan
        lineWidth: 1.5 as any,
        title: 'EMA 50',
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const ema200Series = chart.addSeries(LineSeries, {
        color: '#a855f7', // Purple
        lineWidth: 2 as any,
        title: 'EMA 200',
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const bbUpper = chart.addSeries(LineSeries, {
        color: 'rgba(56, 189, 248, 0.6)',
        lineWidth: 1 as any,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const bbMiddle = chart.addSeries(LineSeries, {
        color: 'rgba(148, 163, 184, 0.5)',
        lineWidth: 1 as any,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const bbLower = chart.addSeries(LineSeries, {
        color: 'rgba(56, 189, 248, 0.6)',
        lineWidth: 1 as any,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      // Main Price Series based on Chart Type
      let mainSeries: any;
      if (chartType === 'line') {
        mainSeries = chart.addSeries(LineSeries, {
          color: '#38bdf8',
          lineWidth: 2 as any,
        });
      } else if (chartType === 'area') {
        mainSeries = chart.addSeries(AreaSeries, {
          topColor: 'rgba(56, 189, 248, 0.35)',
          bottomColor: 'rgba(56, 189, 248, 0.02)',
          lineColor: '#38bdf8',
          lineWidth: 2 as any,
        });
      } else {
        // Candlestick & Heikin-Ashi
        mainSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#10b981',
          downColor: '#f43f5e',
          borderVisible: false,
          wickUpColor: '#10b981',
          wickDownColor: '#f43f5e',
        });
      }

      chartApiRef.current = chart;
      mainSeriesRef.current = mainSeries;
      volumeSeriesRef.current = volumeSeries as any;
      ema20SeriesRef.current = ema20Series as any;
      ema50SeriesRef.current = ema50Series as any;
      ema200SeriesRef.current = ema200Series as any;
      bbUpperSeriesRef.current = bbUpper as any;
      bbMiddleSeriesRef.current = bbMiddle as any;
      bbLowerSeriesRef.current = bbLower as any;

      // Crosshair Hover Inspection Handler
      chart.subscribeCrosshairMove((param) => {
        if (!param || !param.time || !param.seriesData || param.point === undefined) {
          setHoveredCandle(null);
          return;
        }

        const data = param.seriesData.get(mainSeries);
        const volData = param.seriesData.get(volumeSeries);
        const e20 = param.seriesData.get(ema20Series);
        const e50 = param.seriesData.get(ema50Series);
        const e200 = param.seriesData.get(ema200Series);

        if (data) {
          const candleData = data as any;
          const open = candleData.open ?? candleData.value ?? 0;
          const high = candleData.high ?? candleData.value ?? 0;
          const low = candleData.low ?? candleData.value ?? 0;
          const close = candleData.close ?? candleData.value ?? 0;
          const vol = (volData as any)?.value || 0;
          const changePct = open > 0 ? ((close - open) / open) * 100 : 0;

          setHoveredCandle({
            time: param.time as any,
            open,
            high,
            low,
            close,
            volume: vol,
            changePct,
            ema20: (e20 as any)?.value,
            ema50: (e50 as any)?.value,
            ema200: (e200 as any)?.value,
          });
        }
      });

      // Responsive Resize Observer
      const resizeObserver = new ResizeObserver((entries) => {
        if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
        const newRect = entries[0].contentRect;
        if (chartApiRef.current && newRect.width > 0 && newRect.height > 0) {
          chartApiRef.current.applyOptions({
            width: newRect.width,
            height: newRect.height,
          });
        }
      });

      resizeObserver.observe(chartContainerRef.current);

      return () => {
        resizeObserver.disconnect();
        if (chartApiRef.current) {
          try {
            chartApiRef.current.remove();
          } catch (e) {
            // ignore
          }
          chartApiRef.current = null;
        }
        mainSeriesRef.current = null;
        volumeSeriesRef.current = null;
        ema20SeriesRef.current = null;
        ema50SeriesRef.current = null;
        ema200SeriesRef.current = null;
        bbUpperSeriesRef.current = null;
        bbMiddleSeriesRef.current = null;
        bbLowerSeriesRef.current = null;
        if (chartContainerRef.current) {
          chartContainerRef.current.innerHTML = '';
        }
      };
    } catch (err) {
      console.error('Error creating chart:', err);
    }
  }, [chartType]);

  // Update Data & Indicators Series
  useEffect(() => {
    if (!mainSeriesRef.current || !volumeSeriesRef.current || !klines || klines.length === 0) return;

    try {
      // 1. Process Candle Data
      const processedKlines = chartType === 'heikin-ashi' ? calculateHeikinAshi(klines) : klines;

      if (chartType === 'line' || chartType === 'area') {
        const lineData = processedKlines.map((k) => ({
          time: k.time as any,
          value: k.close,
        }));
        (mainSeriesRef.current as any).setData(lineData);
      } else {
        const candleData = processedKlines.map((k) => ({
          time: k.time as any,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));
        (mainSeriesRef.current as any).setData(candleData);
      }

      // 2. Volume Series
      const volumeData = klines.map((k) => ({
        time: k.time as any,
        value: k.volume,
        color: k.close >= k.open ? 'rgba(16, 185, 129, 0.28)' : 'rgba(244, 63, 94, 0.28)',
      }));
      volumeSeriesRef.current.setData(volumeData);
      volumeSeriesRef.current.applyOptions({ visible: showVolume });

      // 3. EMA Indicators
      if (ema20SeriesRef.current) {
        const ema20Data = calculateEMA(klines, 20).map((d) => ({ time: d.time as any, value: d.value }));
        ema20SeriesRef.current.setData(ema20Data);
        ema20SeriesRef.current.applyOptions({ visible: showEma20 });
      }

      if (ema50SeriesRef.current) {
        const ema50Data = calculateEMA(klines, 50).map((d) => ({ time: d.time as any, value: d.value }));
        ema50SeriesRef.current.setData(ema50Data);
        ema50SeriesRef.current.applyOptions({ visible: showEma50 });
      }

      if (ema200SeriesRef.current) {
        const ema200Data = calculateEMA(klines, 200).map((d) => ({ time: d.time as any, value: d.value }));
        ema200SeriesRef.current.setData(ema200Data);
        ema200SeriesRef.current.applyOptions({ visible: showEma200 });
      }

      // 4. Bollinger Bands
      if (bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
        const bb = calculateBollingerBands(klines, 20, 2);
        bbUpperSeriesRef.current.setData(bb.upper.map((d) => ({ time: d.time as any, value: d.value })));
        bbMiddleSeriesRef.current.setData(bb.middle.map((d) => ({ time: d.time as any, value: d.value })));
        bbLowerSeriesRef.current.setData(bb.lower.map((d) => ({ time: d.time as any, value: d.value })));

        bbUpperSeriesRef.current.applyOptions({ visible: showBollinger });
        bbMiddleSeriesRef.current.applyOptions({ visible: showBollinger });
        bbLowerSeriesRef.current.applyOptions({ visible: showBollinger });
      }

      // 5. Clean Previous Price Lines
      const clearLines = (ref: React.MutableRefObject<IPriceLine[]>) => {
        if (ref.current.length > 0 && mainSeriesRef.current) {
          ref.current.forEach((pl) => {
            try {
              (mainSeriesRef.current as any)?.removePriceLine(pl);
            } catch (e) {}
          });
          ref.current = [];
        }
      };

      clearLines(signalPriceLinesRef);
      clearLines(positionPriceLinesRef);
      clearLines(pivotPriceLinesRef);

      // 6. Draw AI Quantitative Signal Lines
      if (
        showSignalLevels &&
        activeSignal &&
        mainSeriesRef.current &&
        activeSignal.entryZone &&
        activeSignal.targets &&
        activeSignal.stopLoss
      ) {
        const entryPrice = activeSignal.entryZone.ideal;
        const { tp1, tp2, tp3 } = activeSignal.targets;
        const sl = activeSignal.stopLoss;

        const p1 = (mainSeriesRef.current as any).createPriceLine({
          price: entryPrice,
          color: '#3b82f6',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `🎯 SIGNAL ENTRÉE: $${formatCoinPrice(entryPrice, symbol)}`,
        });

        const p2 = (mainSeriesRef.current as any).createPriceLine({
          price: tp1,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP1: $${formatCoinPrice(tp1, symbol)}`,
        });

        const p3 = (mainSeriesRef.current as any).createPriceLine({
          price: tp2,
          color: '#059669',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP2: $${formatCoinPrice(tp2, symbol)}`,
        });

        const p4 = (mainSeriesRef.current as any).createPriceLine({
          price: tp3,
          color: '#047857',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP3: $${formatCoinPrice(tp3, symbol)}`,
        });

        const p5 = (mainSeriesRef.current as any).createPriceLine({
          price: sl,
          color: '#f43f5e',
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `SL: $${formatCoinPrice(sl, symbol)}`,
        });

        signalPriceLinesRef.current = [p1, p2, p3, p4, p5];
      }

      // 7. Draw Active Bot Position Overlays
      if (showPositionLevels && activePosition && mainSeriesRef.current) {
        const isLong = activePosition.decision === 'LONG';
        const pLineColor = isLong ? '#10b981' : '#f43f5e';

        const posLine = (mainSeriesRef.current as any).createPriceLine({
          price: activePosition.entryPrice,
          color: pLineColor,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `⚡ BOT ${activePosition.decision} @ $${formatCoinPrice(activePosition.entryPrice, symbol)}`,
        });

        const posLines = [posLine];

        if (activePosition.stopLoss > 0) {
          const slLine = (mainSeriesRef.current as any).createPriceLine({
            price: activePosition.stopLoss,
            color: '#e11d48',
            lineWidth: 2,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `🛡️ BOT SL @ $${formatCoinPrice(activePosition.stopLoss, symbol)}`,
          });
          posLines.push(slLine);
        }

        if (activePosition.tp1 > 0 && !activePosition.tp1Hit) {
          const tp1Line = (mainSeriesRef.current as any).createPriceLine({
            price: activePosition.tp1,
            color: '#34d399',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `🎯 BOT TP1 @ $${formatCoinPrice(activePosition.tp1, symbol)}`,
          });
          posLines.push(tp1Line);
        }

        positionPriceLinesRef.current = posLines;
      }

      // 8. Draw Pivot Points / S&R Levels
      if (showPivots && pivotData && mainSeriesRef.current) {
        const r1Line = (mainSeriesRef.current as any).createPriceLine({
          price: pivotData.r1,
          color: 'rgba(239, 68, 68, 0.7)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `R1: $${formatCoinPrice(pivotData.r1, symbol)}`,
        });

        const pLine = (mainSeriesRef.current as any).createPriceLine({
          price: pivotData.pivot,
          color: 'rgba(234, 179, 8, 0.7)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `PIVOT: $${formatCoinPrice(pivotData.pivot, symbol)}`,
        });

        const s1Line = (mainSeriesRef.current as any).createPriceLine({
          price: pivotData.s1,
          color: 'rgba(16, 185, 129, 0.7)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `S1: $${formatCoinPrice(pivotData.s1, symbol)}`,
        });

        pivotPriceLinesRef.current = [r1Line, pLine, s1Line];
      }

      // Auto fit content on timeframe or symbol change
      const contextKey = `${symbol}-${activeTimeframe}`;
      if (
        chartContainerRef.current &&
        chartContainerRef.current.getAttribute('data-context') !== contextKey
      ) {
        chartContainerRef.current.setAttribute('data-context', contextKey);
        setTimeout(() => {
          try {
            chartApiRef.current?.timeScale().fitContent();
          } catch (e) {}
        }, 20);
      }
    } catch (err) {
      console.warn('Error updating chart data series:', err);
    }
  }, [
    klines,
    chartType,
    showVolume,
    showEma20,
    showEma50,
    showEma200,
    showBollinger,
    showSignalLevels,
    showPositionLevels,
    showPivots,
    activeSignal,
    activePosition,
    pivotData,
    symbol,
    activeTimeframe,
  ]);

  const handleResetZoom = useCallback(() => {
    chartApiRef.current?.timeScale().fitContent();
  }, []);

  const timeframes: { tf: Timeframe; label: string }[] = [
    { tf: '5m', label: isArabic ? '5د Scalp' : '5M Scalp' },
    { tf: '15m', label: isArabic ? '15د Fast' : '15M Fast' },
    { tf: '30m', label: isArabic ? '30د Mid' : '30M Mid' },
    { tf: '1h', label: isArabic ? '1س Intraday' : '1H Intraday' },
    { tf: '4h', label: isArabic ? '4س Swing' : '4H Swing' },
    { tf: '1d', label: isArabic ? '1ي Daily' : isEn ? '1D Daily' : '1J Jour' },
    { tf: '1w', label: isArabic ? '1أ Weekly' : isEn ? '1W Weekly' : '1S Hebdo' },
  ];

  // Active position live PnL calculations
  const positionPnl = useMemo(() => {
    if (!activePosition) return null;
    const isLong = activePosition.decision === 'LONG';
    const lev = Math.max(1, activePosition.leverage || 1);
    const p = currentPrice > 0 ? currentPrice : activePosition.entryPrice;
    const priceDiffPct = ((p - activePosition.entryPrice) / (activePosition.entryPrice || 1)) * (isLong ? 1 : -1) * 100;
    const roePercent = priceDiffPct * lev;
    const unrealizedUsdt = (activePosition.remainingAmountUsdt || 0) * (roePercent / 100);
    const isProfit = unrealizedUsdt >= 0;

    return {
      roePercent: Number(roePercent.toFixed(2)),
      unrealizedUsdt: Number(unrealizedUsdt.toFixed(2)),
      isProfit,
    };
  }, [activePosition, currentPrice]);

  return (
    <div
      className={`bg-slate-950 border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-2xl flex flex-col gap-3.5 transition-all ${
        isFullscreen ? 'fixed inset-2 z-50 bg-slate-950/95 backdrop-blur-xl border-cyan-500/40' : 'h-full min-h-[620px]'
      }`}
    >
      {/* 1. TOP PRO TRADING HEADER (Live Symbol, Real-Time Price, 24h Stats, Momentum Gauge) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-lg">
        {/* Left: Symbol & Price Flash */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black font-mono tracking-tight text-white">
                  {symbol}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  {marketType}
                </span>
                {trendStatus.includes('BULLISH') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {isArabic ? 'صاعد' : 'BULL'}
                  </span>
                )}
                {trendStatus.includes('BEARISH') && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" />
                    {isArabic ? 'هابط' : 'BEAR'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Binance Futures Stream
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block" />

          {/* Current Live Price */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                ${formatCoinPrice(currentPrice, symbol)}
              </span>
              <span className={`text-xs sm:text-sm font-bold font-mono px-2 py-0.5 rounded-lg flex items-center gap-0.5 ${
                priceChange24h >= 0
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                {priceChange24h >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: 24h Metrics & Momentum HUD */}
        <div className="flex items-center gap-3 sm:gap-6 flex-wrap text-xs font-mono">
          {/* 24h High/Low with Mini Range Slider */}
          <div className="hidden md:flex flex-col gap-1 min-w-[140px]">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>L: ${formatCoinPrice(low24h, symbol)}</span>
              <span>H: ${formatCoinPrice(high24h, symbol)}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full"
                style={{ width: `${priceRangePct}%` }}
              />
            </div>
          </div>

          {/* RSI Momentum Gauge */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <div>
              <span className="text-[10px] text-slate-400 block leading-none">RSI (14)</span>
              <span className={`font-bold ${
                rsiValue >= 70 ? 'text-rose-400' : rsiValue <= 30 ? 'text-emerald-400' : 'text-cyan-300'
              }`}>
                {rsiValue}{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  {rsiValue >= 70 ? (isArabic ? 'تشبع شراء' : 'Suracheté') : rsiValue <= 30 ? (isArabic ? 'تشبع بيع' : 'Survendu') : (isArabic ? 'معتدل' : 'Neutre')}
                </span>
              </span>
            </div>
          </div>

          {/* Order Pressure Bar (Buyers vs Sellers) */}
          <div className="hidden lg:flex flex-col gap-1 min-w-[110px]">
            <div className="flex justify-between text-[10px]">
              <span className="text-emerald-400 font-bold">{volumePressure.buyersPct}% B</span>
              <span className="text-rose-400 font-bold">{volumePressure.sellersPct}% S</span>
            </div>
            <div className="w-full h-1.5 bg-rose-500/40 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${volumePressure.buyersPct}%` }}
              />
            </div>
          </div>

          {/* Action Tools (Reset Zoom, Indicators, Fullscreen) */}
          <div className="flex items-center gap-1.5">
            <button
              id="btn-chart-reset-zoom"
              onClick={handleResetZoom}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-300 hover:text-white transition cursor-pointer active:scale-95"
              title={isArabic ? 'إعادة ضبط العرض' : 'Recentrer le graphique'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              id="btn-chart-toggle-indicators-bar"
              onClick={() => setShowIndicatorsBar(!showIndicatorsBar)}
              className={`p-2 rounded-xl border transition cursor-pointer active:scale-95 ${
                showIndicatorsBar
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/80 text-slate-400'
              }`}
              title={isArabic ? 'لوحة المؤشرات الفنية' : 'Barre des indicateurs'}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            <button
              id="btn-chart-fullscreen"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-2 rounded-xl border transition cursor-pointer active:scale-95 ${
                isFullscreen
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/80 text-slate-300'
              }`}
              title={isFullscreen ? (isArabic ? 'تصغير' : 'Réduire') : (isArabic ? 'ملء الشاشة' : 'Plein écran')}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. TIMEFRAME & CHART STYLE TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 p-2 rounded-2xl border border-slate-800/60">
        {/* Timeframe selector pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {timeframes.map(({ tf, label }) => (
            <button
              id={`btn-chart-tf-${tf}`}
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-3 py-1.5 text-xs font-bold font-mono rounded-xl transition-all cursor-pointer active:scale-95 shrink-0 ${
                activeTimeframe === tf
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Chart Style Switcher (Candles, Heikin-Ashi, Area, Line) */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/90">
          <button
            id="btn-style-candle"
            onClick={() => setChartType('candlestick')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              chartType === 'candlestick'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Candlestick (Bougies classiques)"
          >
            🕯️ {isArabic ? 'شموع' : 'Bougies'}
          </button>
          <button
            id="btn-style-heikin"
            onClick={() => setChartType('heikin-ashi')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              chartType === 'heikin-ashi'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Heikin-Ashi (Bougies lissées)"
          >
            📊 Heikin-Ashi
          </button>
          <button
            id="btn-style-area"
            onClick={() => setChartType('area')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              chartType === 'area'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Area (Zone de gradient)"
          >
            🌊 {isArabic ? 'مساحة' : 'Zone'}
          </button>
          <button
            id="btn-style-line"
            onClick={() => setChartType('line')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              chartType === 'line'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Line (Ligne continue)"
          >
            📈 {isArabic ? 'خط' : 'Ligne'}
          </button>
        </div>
      </div>

      {/* 3. TECHNICAL INDICATORS CONTROL BAR (Collapsible Pills) */}
      {showIndicatorsBar && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-900/70 border border-slate-800/80 rounded-2xl animate-in fade-in duration-200">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            {isArabic ? 'المؤشرات النشطة:' : 'Indicateurs:'}
          </span>

          {/* EMA 20 */}
          <button
            id="toggle-ema20"
            onClick={() => setShowEma20(!showEma20)}
            className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
              showEma20
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            EMA 20
          </button>

          {/* EMA 50 */}
          <button
            id="toggle-ema50"
            onClick={() => setShowEma50(!showEma50)}
            className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
              showEma50
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            EMA 50
          </button>

          {/* EMA 200 */}
          <button
            id="toggle-ema200"
            onClick={() => setShowEma200(!showEma200)}
            className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
              showEma200
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            EMA 200
          </button>

          {/* Bollinger Bands */}
          <button
            id="toggle-bollinger"
            onClick={() => setShowBollinger(!showBollinger)}
            className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
              showBollinger
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            BB (20,2)
          </button>

          {/* Volume */}
          <button
            id="toggle-volume"
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
              showVolume
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {isArabic ? 'الحجم (Vol)' : 'Volume'}
          </button>

          {/* Pivot / Support Resistance */}
          <button
            id="toggle-pivots"
            onClick={() => setShowPivots(!showPivots)}
            className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
              showPivots
                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            {isArabic ? 'الدعوم والمقاومات (Pivots)' : 'Pivots S/R'}
          </button>

          {/* AI Signal Targets */}
          {activeSignal && (
            <button
              id="toggle-signals"
              onClick={() => setShowSignalLevels(!showSignalLevels)}
              className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                showSignalLevels
                  ? 'bg-brand-500/15 border-brand-500/40 text-brand-300 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              <Sparkles className="w-3 h-3 text-brand-400" />
              {isArabic ? 'أهداف الإشارة (TP/SL)' : 'Cibles Signal'}
            </button>
          )}

          {/* Active Bot Position */}
          {activePosition && (
            <button
              id="toggle-positions"
              onClick={() => setShowPositionLevels(!showPositionLevels)}
              className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                showPositionLevels
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm animate-pulse'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              {isArabic ? 'صفقة البوت الحية' : 'Position Bot'}
            </button>
          )}
        </div>
      )}

      {/* 4. REAL-TIME CANDLE INSPECTION BAR (Crosshair HUD) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/80 border border-slate-800/80 rounded-xl text-xs font-mono text-slate-300">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <span className="text-slate-400">
            {hoveredCandle ? (isArabic ? 'الشمعة المحددة:' : 'Curseur:') : (isArabic ? 'الشمعة الحالية:' : 'Dernier bar:')}
          </span>
          <span>
            <strong className="text-slate-400">O:</strong>{' '}
            <span className="text-white">${formatCoinPrice(hoveredCandle?.open || latestCandle?.open || 0, symbol)}</span>
          </span>
          <span>
            <strong className="text-slate-400">H:</strong>{' '}
            <span className="text-emerald-400">${formatCoinPrice(hoveredCandle?.high || latestCandle?.high || 0, symbol)}</span>
          </span>
          <span>
            <strong className="text-slate-400">L:</strong>{' '}
            <span className="text-rose-400">${formatCoinPrice(hoveredCandle?.low || latestCandle?.low || 0, symbol)}</span>
          </span>
          <span>
            <strong className="text-slate-400">C:</strong>{' '}
            <span className="text-white">${formatCoinPrice(hoveredCandle?.close || latestCandle?.close || 0, symbol)}</span>
          </span>
          <span>
            <strong className="text-slate-400">Δ:</strong>{' '}
            <span
              className={
                (hoveredCandle?.changePct ?? latestCandle?.changePct ?? 0) >= 0
                  ? 'text-emerald-400 font-bold'
                  : 'text-rose-400 font-bold'
              }
            >
              {(hoveredCandle?.changePct ?? latestCandle?.changePct ?? 0) >= 0 ? '+' : ''}
              {(hoveredCandle?.changePct ?? latestCandle?.changePct ?? 0).toFixed(2)}%
            </span>
          </span>
          <span>
            <strong className="text-slate-400">Vol:</strong>{' '}
            <span className="text-cyan-300">{(hoveredCandle?.volume ?? latestCandle?.volume ?? 0).toFixed(2)}</span>
          </span>
        </div>

        {/* Indicators values on crosshair */}
        <div className="hidden xl:flex items-center gap-3 text-[11px]">
          {showEma20 && hoveredCandle?.ema20 && (
            <span className="text-amber-400">EMA20: ${formatCoinPrice(hoveredCandle.ema20, symbol)}</span>
          )}
          {showEma50 && hoveredCandle?.ema50 && (
            <span className="text-cyan-400">EMA50: ${formatCoinPrice(hoveredCandle.ema50, symbol)}</span>
          )}
          {showEma200 && hoveredCandle?.ema200 && (
            <span className="text-purple-400">EMA200: ${formatCoinPrice(hoveredCandle.ema200, symbol)}</span>
          )}
        </div>
      </div>

      {/* 5. MAIN INTERACTIVE CANVAS WITH FLOATING HUD OVERLAYS */}
      <div className="relative w-full flex-1 overflow-hidden rounded-2xl bg-slate-950 border border-slate-800/90 min-h-[420px]">
        {/* Canvas DOM container */}
        <div ref={chartContainerRef} className="w-full h-full min-h-[420px]" />

        {/* Active Floating Position HUD (When an open trade exists) */}
        {activePosition && positionPnl && (
          <div className="absolute bottom-3 left-3 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col gap-2 max-w-[340px] animate-in slide-in-from-bottom duration-300 ring-1 ring-slate-700/50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-lg text-xs font-black font-mono tracking-wider ${
                    activePosition.decision === 'LONG'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {activePosition.decision} {activePosition.leverage ? `${activePosition.leverage}x` : ''}
                </span>
                <span className="text-xs font-bold text-white font-mono">{symbol}</span>
              </div>
              <div
                className={`text-sm font-black font-mono px-2 py-0.5 rounded-lg ${
                  positionPnl.isProfit
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-400'
                }`}
              >
                {positionPnl.isProfit ? '+' : ''}${positionPnl.unrealizedUsdt} ({positionPnl.isProfit ? '+' : ''}
                {positionPnl.roePercent}%)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/80 p-2 rounded-xl border border-slate-800/80 text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px]">
                  {isArabic ? 'سعر الدخول' : 'Prix Entrée'}
                </span>
                <span className="font-bold text-white">${formatCoinPrice(activePosition.entryPrice, symbol)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">
                  {isArabic ? 'وقف الخسارة (SL)' : 'Stop Loss'}
                </span>
                <span className="font-bold text-rose-400">
                  {activePosition.stopLoss > 0 ? `$${formatCoinPrice(activePosition.stopLoss, symbol)}` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">TP1 Target</span>
                <span className={`font-bold ${activePosition.tp1Hit ? 'text-emerald-400 line-through' : 'text-emerald-300'}`}>
                  ${formatCoinPrice(activePosition.tp1, symbol)} {activePosition.tp1Hit && '✓'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">TP2 Target</span>
                <span className={`font-bold ${activePosition.tp2Hit ? 'text-emerald-400 line-through' : 'text-emerald-300'}`}>
                  ${formatCoinPrice(activePosition.tp2, symbol)} {activePosition.tp2Hit && '✓'}
                </span>
              </div>
            </div>

            {onManualClosePosition && (
              <button
                id="btn-chart-close-pos"
                onClick={() => onManualClosePosition(activePosition.id)}
                className="w-full py-1.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{isArabic ? 'إغلاق الصفقة فوراً بالسعر الحالي' : 'Clôturer la position au marché'}</span>
              </button>
            )}
          </div>
        )}

        {/* Floating AI Signal Badge in Top Left */}
        {activeSignal && showSignalLevels && (
          <div className="absolute top-2.5 left-2.5 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] font-mono text-slate-300 flex items-center gap-2.5 shadow-lg">
            <span
              className={`w-2 h-2 rounded-full ${
                activeSignal.decision === 'LONG'
                  ? 'bg-emerald-400 animate-pulse'
                  : activeSignal.decision === 'SHORT'
                  ? 'bg-rose-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-bold text-white">
              {activeSignal.decision} ({activeSignal.confidence}%)
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-blue-400">
              Entry: ${formatCoinPrice(activeSignal.entryZone?.ideal || 0, symbol)}
            </span>
            <span className="text-emerald-400">
              TP1: ${formatCoinPrice(activeSignal.targets?.tp1 || 0, symbol)}
            </span>
            <span className="text-rose-400">
              SL: ${formatCoinPrice(activeSignal.stopLoss || 0, symbol)}
            </span>
          </div>
        )}
      </div>

      {/* 6. BOTTOM PIVOT POINTS & TECHNICAL SUPPORT/RESISTANCE TARGETS FOOTER */}
      {pivotData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800/60 text-xs font-mono">
          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[10px] text-rose-400 font-bold block">R2 (Resistance 2)</span>
            <span className="text-slate-200 font-bold">${formatCoinPrice(pivotData.r2, symbol)}</span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[10px] text-rose-400/80 font-bold block">R1 (Resistance 1)</span>
            <span className="text-slate-200 font-bold">${formatCoinPrice(pivotData.r1, symbol)}</span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] text-amber-400 font-bold block">PIVOT (Point Pivot)</span>
            <span className="text-amber-300 font-black">${formatCoinPrice(pivotData.pivot, symbol)}</span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[10px] text-emerald-400/80 font-bold block">S1 (Support 1)</span>
            <span className="text-slate-200 font-bold">${formatCoinPrice(pivotData.s1, symbol)}</span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 text-center">
            <span className="text-[10px] text-emerald-400 font-bold block">S2 (Support 2)</span>
            <span className="text-slate-200 font-bold">${formatCoinPrice(pivotData.s2, symbol)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
