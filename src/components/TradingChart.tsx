import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  IChartApi,
  ISeriesApi,
  LineStyle,
  IPriceLine,
} from 'lightweight-charts';
import { KlineCandle, Timeframe, AIAnalysisResult, Language } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import { Layers, Eye, EyeOff, Radio } from 'lucide-react';

interface TradingChartProps {
  symbol?: string;
  klines: KlineCandle[];
  activeTimeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  activeSignal: AIAnalysisResult | null;
  language: Language;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol = 'BTCUSDT',
  klines,
  activeTimeframe,
  onTimeframeChange,
  activeSignal,
  language,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const [showIndicators, setShowIndicators] = useState(true);
  const t = translations[language] || translations.fr;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      chartContainerRef.current.innerHTML = '';

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#090d16' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: '#131c2e' },
          horzLines: { color: '#131c2e' },
        },
        crosshair: {
          mode: 1,
          vertLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
          horzLine: { color: '#475569', labelBackgroundColor: '#1e293b' },
        },
        rightPriceScale: {
          borderColor: '#1e293b',
          scaleMargins: {
            top: 0.1,
            bottom: 0.2,
          },
        },
        timeScale: {
          borderColor: '#1e293b',
          timeVisible: true,
          secondsVisible: false,
        },
        height: 400,
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#f43f5e',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#f43f5e',
      });

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

      chartApiRef.current = chart;
      candlestickSeriesRef.current = candleSeries as any;
      volumeSeriesRef.current = volumeSeries as any;

      const handleResize = () => {
        if (chartContainerRef.current && chartApiRef.current) {
          chartApiRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartApiRef.current) {
          try {
            chartApiRef.current.remove();
          } catch (e) {
            // ignore
          }
        }
      };
    } catch (err) {
      console.error('Error creating chart:', err);
    }
  }, []);

  // Update candle & volume data and active price lines
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !klines || klines.length === 0) return;

    try {
      const formattedCandles = klines.map((k) => ({
        time: k.time as any,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      }));

      const formattedVolume = klines.map((k) => ({
        time: k.time as any,
        value: k.volume,
        color: k.close >= k.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)',
      }));

      candlestickSeriesRef.current.setData(formattedCandles);
      volumeSeriesRef.current.setData(formattedVolume);
      volumeSeriesRef.current.applyOptions({ visible: showIndicators });

      // Clean up previous price lines
      if (priceLinesRef.current.length > 0 && candlestickSeriesRef.current) {
        priceLinesRef.current.forEach((pl) => {
          try {
            candlestickSeriesRef.current?.removePriceLine(pl);
          } catch (e) {
            // ignore
          }
        });
        priceLinesRef.current = [];
      }

      // Add Price Lines for active quantitative signal
      if (activeSignal && showIndicators && candlestickSeriesRef.current && activeSignal.entryZone && activeSignal.targets && activeSignal.stopLoss) {
        const entryPrice = activeSignal.entryZone.ideal;
        const tp1 = activeSignal.targets.tp1;
        const tp2 = activeSignal.targets.tp2;
        const tp3 = activeSignal.targets.tp3;
        const sl = activeSignal.stopLoss;

        const p1 = candlestickSeriesRef.current.createPriceLine({
          price: entryPrice,
          color: '#3b82f6',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `ENTRÉE: $${formatCoinPrice(entryPrice, symbol)}`,
        });

        const p2 = candlestickSeriesRef.current.createPriceLine({
          price: tp1,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP1: $${formatCoinPrice(tp1, symbol)}`,
        });

        const p3 = candlestickSeriesRef.current.createPriceLine({
          price: tp2,
          color: '#059669',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP2: $${formatCoinPrice(tp2, symbol)}`,
        });

        const p4 = candlestickSeriesRef.current.createPriceLine({
          price: tp3,
          color: '#047857',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP3: $${formatCoinPrice(tp3, symbol)}`,
        });

        const p5 = candlestickSeriesRef.current.createPriceLine({
          price: sl,
          color: '#f43f5e',
          lineWidth: 2,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `SL: $${formatCoinPrice(sl, symbol)}`,
        });

        priceLinesRef.current = [p1, p2, p3, p4, p5];
      }

      if (
        chartContainerRef.current &&
        chartContainerRef.current.getAttribute('data-context') !== `${symbol}-${activeTimeframe}`
      ) {
        setTimeout(() => chartApiRef.current?.timeScale().fitContent(), 50);
        chartContainerRef.current.setAttribute('data-context', `${symbol}-${activeTimeframe}`);
      }
    } catch (e) {
      console.warn('Error updating chart data series:', e);
    }
  }, [klines, activeSignal, showIndicators, symbol, activeTimeframe]);

  const isArabic = language === 'ar';
  const isEn = language === 'en';

  const timeframes: { tf: Timeframe; label: string }[] = [
    { tf: '5m', label: isArabic ? '5د (Scalp)' : '5M (Scalp)' },
    { tf: '15m', label: isArabic ? '15د (Fast)' : '15M (Fast)' },
    { tf: '30m', label: isArabic ? '30د (Short)' : '30M (Short)' },
    { tf: '1h', label: isArabic ? '1س (Intraday)' : '1H (Intraday)' },
    { tf: '4h', label: isArabic ? '4س (Swing)' : '4H (Swing)' },
    { tf: '1d', label: isArabic ? '1ي (Daily)' : (isEn ? '1D (Daily)' : '1J (Jour)') },
    { tf: '1w', label: isArabic ? '1أ (Weekly)' : (isEn ? '1W (Weekly)' : '1S (Semaine)') },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl">
      {/* Timeframe Switcher & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {timeframes.map(({ tf, label }) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                activeTimeframe === tf
                  ? 'bg-brand-500 text-slate-950 font-bold shadow-md shadow-brand-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {activeSignal && (
            <button
              onClick={() => setShowIndicators(!showIndicators)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                showIndicators
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {showIndicators ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showIndicators ? 'Masquer Niveaux' : 'Afficher Niveaux'}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
            <Radio className="w-3 h-3 text-brand-400" />
            <span>Binance Klines Live</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800/90">
        <div ref={chartContainerRef} className="w-full h-[400px]" />

        {/* Legend Overlay */}
        <div className="absolute top-2 left-2 z-10 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-300 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Hausse</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Baisse</span>
          </div>
          {activeSignal && activeSignal.entryZone && activeSignal.targets && activeSignal.stopLoss && (
            <div className="hidden sm:flex items-center gap-2 border-l border-slate-700 pl-2 flex-wrap">
              <span className="text-brand-300 font-bold bg-brand-500/10 border border-brand-500/30 px-1.5 py-0.5 rounded text-[10px]">
                {activeSignal.recommendedTimeframe || activeTimeframe}
              </span>
              <span className="text-blue-400">Entrée: ${formatCoinPrice(activeSignal.entryZone.ideal, symbol)}</span>
              <span className="text-emerald-400">TP1: ${formatCoinPrice(activeSignal.targets.tp1, symbol)}</span>
              <span className="text-emerald-400">TP2: ${formatCoinPrice(activeSignal.targets.tp2, symbol)}</span>
              <span className="text-emerald-400">TP3: ${formatCoinPrice(activeSignal.targets.tp3, symbol)}</span>
              <span className="text-rose-400">SL: ${formatCoinPrice(activeSignal.stopLoss, symbol)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
