import React, { useState, useMemo } from 'react';
import { MarketDataResponse, Language } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import {
  Layers,
  ShieldCheck,
  Activity,
  BarChart2,
  Zap,
  ArrowDown,
  ArrowUp,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Eye,
  Sliders,
  DollarSign,
  Gauge,
  Crosshair,
  Flame,
  Clock,
  HelpCircle,
  ChevronRight,
  Calculator,
  RefreshCw,
} from 'lucide-react';

interface MarketOverviewViewProps {
  marketData: MarketDataResponse | null;
  language: Language;
}

type ViewSubTab = 'LADDER' | 'WHALES_LIQUIDATION' | 'SIMULATOR';

export const MarketOverviewView: React.FC<MarketOverviewViewProps> = ({
  marketData,
  language,
}) => {
  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';
  const [activeSubTab, setActiveSubTab] = useState<ViewSubTab>('LADDER');
  const [simulatedSizeUsd, setSimulatedSizeUsd] = useState<number>(10000);
  const [customSizeInput, setCustomSizeInput] = useState<string>('10000');

  if (!marketData || !marketData.orderBook) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-3 animate-pulse">
          <Layers className="w-6 h-6 text-cyan-400" />
        </div>
        <h3 className="text-white font-bold text-base mb-1">
          {isArabic ? 'جاري جلب دفتر الطلبات والمشتقات اللحظية...' : 'Chargement du Carnet d\'Ordres & Dérivés Binance...'}
        </h3>
        <p className="text-xs text-slate-500">
          {isArabic ? 'اتصال مباشر عالي السرعة بمحرك سيولة بينانس' : 'Connexion flux direct haute fréquence API Binance'}
        </p>
      </div>
    );
  }

  const { orderBook, derivatives, ticker } = marketData;
  const currentSymbol = ticker?.symbol || 'BTCUSDT';
  const baseAsset = currentSymbol.replace('USDT', '');
  const currentPrice = ticker?.price || (orderBook.topBids[0]?.price ? (orderBook.topBids[0].price + orderBook.topAsks[0]?.price) / 2 : 0);

  const bidsList = Array.isArray(orderBook?.topBids) ? orderBook.topBids : [];
  const asksList = Array.isArray(orderBook?.topAsks) ? orderBook.topAsks : [];

  const maxBidQty = bidsList.length > 0 ? Math.max(...bidsList.map((b) => b.qty)) : 1;
  const maxAskQty = asksList.length > 0 ? Math.max(...asksList.map((a) => a.qty)) : 1;
  const maxQty = Math.max(maxBidQty, maxAskQty, 1);

  // Cumulative depth calculations
  let cumBidTotal = 0;
  const cumulativeBids = bidsList.map((b) => {
    cumBidTotal += b.price * b.qty;
    return { ...b, cumTotal: cumBidTotal };
  });

  let cumAskTotal = 0;
  const cumulativeAsks = asksList.map((a) => {
    cumAskTotal += a.price * a.qty;
    return { ...a, cumTotal: cumAskTotal };
  });

  const bestBid = bidsList[0]?.price || currentPrice;
  const bestAsk = asksList[0]?.price || currentPrice;
  const spreadUsd = Math.max(0, bestAsk - bestBid);
  const spreadBps = currentPrice > 0 ? (spreadUsd / currentPrice) * 10000 : 0;

  // Imbalance & Volume computations
  const totalVolumeInDepth = orderBook.bidTotal + orderBook.askTotal || 1;
  const bidDominancePct = Math.round((orderBook.bidTotal / totalVolumeInDepth) * 100);
  const askDominancePct = 100 - bidDominancePct;

  // Derivatives Smart Interpretations
  const fundingRateVal = derivatives?.fundingRate ?? null;
  const annualizedFunding = fundingRateVal !== null ? (fundingRateVal * 3 * 365).toFixed(2) : null;
  const takerRatio = derivatives?.takerLongShortRatio ?? 1.0;

  // Simulated Execution Slippage
  const simulationResults = useMemo(() => {
    const size = simulatedSizeUsd;
    if (size <= 0 || !currentPrice) return null;

    // Simulate Buy (eating Asks)
    let remainingBuyUsd = size;
    let totalBuyCoins = 0;
    let weightedBuyCost = 0;
    for (const ask of asksList) {
      const levelUsd = ask.price * ask.qty;
      if (remainingBuyUsd <= levelUsd) {
        const coinsFilled = remainingBuyUsd / ask.price;
        totalBuyCoins += coinsCoinsSafe(coinsFilled);
        weightedBuyCost += remainingBuyUsd;
        remainingBuyUsd = 0;
        break;
      } else {
        totalBuyCoins += ask.qty;
        weightedBuyCost += levelUsd;
        remainingBuyUsd -= levelUsd;
      }
    }
    const avgBuyPrice = totalBuyCoins > 0 ? weightedBuyCost / totalBuyCoins : bestAsk;
    const buySlippageBps = ((avgBuyPrice - currentPrice) / currentPrice) * 10000;

    // Simulate Sell (eating Bids)
    let remainingSellUsd = size;
    let totalSellCoins = 0;
    let weightedSellCost = 0;
    for (const bid of bidsList) {
      const levelUsd = bid.price * bid.qty;
      if (remainingSellUsd <= levelUsd) {
        const coinsFilled = remainingSellUsd / bid.price;
        totalSellCoins += coinsCoinsSafe(coinsFilled);
        weightedSellCost += remainingSellUsd;
        remainingSellUsd = 0;
        break;
      } else {
        totalSellCoins += bid.qty;
        weightedSellCost += levelUsd;
        remainingSellUsd -= levelUsd;
      }
    }
    const avgSellPrice = totalSellCoins > 0 ? weightedSellCost / totalSellCoins : bestBid;
    const sellSlippageBps = ((currentPrice - avgSellPrice) / currentPrice) * 10000;

    function coinsCoinsSafe(val: number) {
      return isNaN(val) ? 0 : val;
    }

    return {
      avgBuyPrice,
      buySlippageBps: Math.max(0, buySlippageBps),
      avgSellPrice,
      sellSlippageBps: Math.max(0, sellSlippageBps),
      unfilledBuy: remainingBuyUsd,
      unfilledSell: remainingSellUsd,
    };
  }, [simulatedSizeUsd, currentPrice, asksList, bidsList, bestAsk, bestBid]);

  // Estimated Liquidation Clusters
  const liquidationClusters = useMemo(() => {
    if (!currentPrice || currentPrice <= 0) return { longs: [], shorts: [] };
    const p = currentPrice;
    return {
      longs: [
        { leverage: '100x', price: p * 0.992, distance: -0.8, density: 'HIGH', label: isArabic ? 'تصفية عقود 100x شراء' : 'Liq Longs 100x' },
        { leverage: '50x', price: p * 0.982, distance: -1.8, density: 'VERY_HIGH', label: isArabic ? 'تصفية عقود 50x شراء' : 'Liq Longs 50x' },
        { leverage: '25x', price: p * 0.962, distance: -3.8, density: 'EXTREME', label: isArabic ? 'تجمع سيولة 25x شراء' : 'Cluster Longs 25x' },
        { leverage: '10x', price: p * 0.905, distance: -9.5, density: 'MEDIUM', label: isArabic ? 'تصفية عقود 10x شراء' : 'Liq Longs 10x' },
      ],
      shorts: [
        { leverage: '100x', price: p * 1.008, distance: 0.8, density: 'HIGH', label: isArabic ? 'تصفية عقود 100x بيع' : 'Liq Shorts 100x' },
        { leverage: '50x', price: p * 1.018, distance: 1.8, density: 'VERY_HIGH', label: isArabic ? 'تصفية عقود 50x بيع' : 'Liq Shorts 50x' },
        { leverage: '25x', price: p * 1.038, distance: 3.8, density: 'EXTREME', label: isArabic ? 'تجمع سيولة 25x بيع' : 'Cluster Shorts 25x' },
        { leverage: '10x', price: p * 1.095, distance: 9.5, density: 'MEDIUM', label: isArabic ? 'تصفية عقود 10x بيع' : 'Liq Shorts 10x' },
      ],
    };
  }, [currentPrice, isArabic]);

  return (
    <div className={`space-y-5 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* HEADER SECTION: Institutional Title & Quick Stats */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {isArabic ? `عمق السيولة والمشتقات (${currentSymbol})` : `Carnet d'Ordres & Dérivés Institutionnels (${currentSymbol})`}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold animate-pulse">
                  LIVE BINANCE L2
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isArabic 
                  ? 'رادار حيتان السيولة، تحليل معدلات التمويل وفروقات السبريد مع محاكي الإنزلاق السعري'
                  : 'Radar de liquidité des Whales, taux de financement (Funding), déséquilibre et simulateur d\'impact'}
              </p>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveSubTab('LADDER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'LADDER'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isArabic ? 'سلم الدفتر' : 'Ladder & Profondeur'}</span>
            </button>
            <button
              onClick={() => setActiveSubTab('WHALES_LIQUIDATION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'WHALES_LIQUIDATION'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{isArabic ? 'الحيتان والتصفيات' : 'Whales & Liquidations'}</span>
            </button>
            <button
              onClick={() => setActiveSubTab('SIMULATOR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'SIMULATOR'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{isArabic ? 'محاكي التنفيذ' : 'Simulateur d\'Ordre'}</span>
            </button>
          </div>
        </div>

        {/* Top Institutional Metrics 4-Column Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs font-mono">
          {/* Metric 1: Open Interest (OI) */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">
              <span>Open Interest (OI)</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-base font-bold text-white">
              {derivatives?.openInterest
                ? `${Math.round(derivatives.openInterest).toLocaleString()} ${baseAsset}`
                : 'API Futures'}
            </div>
            <div className="text-[10px] text-cyan-400/90 mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>
                {derivatives?.openInterest
                  ? `≈ $${((derivatives.openInterest * currentPrice) / 1e6).toFixed(1)}M USD`
                  : 'Flux Binance'}
              </span>
            </div>
          </div>

          {/* Metric 2: Funding Rate (8h) */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 relative overflow-hidden group hover:border-amber-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">
              <span>Funding Rate (8h)</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className={`text-base font-bold ${
              (fundingRateVal ?? 0) > 0 ? 'text-emerald-400' : (fundingRateVal ?? 0) < 0 ? 'text-rose-400' : 'text-slate-300'
            }`}>
              {fundingRateVal !== null ? `${fundingRateVal > 0 ? '+' : ''}${fundingRateVal}%` : 'N/A'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {annualizedFunding ? `APR: ${annualizedFunding}% / an` : 'Binance Perpetuals'}
            </div>
          </div>

          {/* Metric 3: Taker Volume Ratio */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">
              <span>Taker L/S Ratio</span>
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className={`text-base font-bold ${takerRatio >= 1.05 ? 'text-emerald-400' : takerRatio <= 0.95 ? 'text-rose-400' : 'text-amber-400'}`}>
              {takerRatio.toFixed(2)}x
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {takerRatio >= 1 ? (isArabic ? '🟢 شراء هجومي سائد' : '🟢 Acheteurs Dominants') : (isArabic ? '🔴 بيع هجومي سائد' : '🔴 Vendeurs Dominants')}
            </div>
          </div>

          {/* Metric 4: Spread & Liquidity Quality */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">
              <span>Spread & Liquidité</span>
              <Crosshair className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-base font-bold text-white">
              ${formatCoinPrice(spreadUsd, currentSymbol)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {spreadBps < 1.0 ? '💎 Liquidité Ultra-Élevée' : spreadBps < 3.0 ? '⚡ Liquidité Excellente' : '⚠️ Spread Élargi'} ({spreadBps.toFixed(2)} bps)
            </div>
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: LADDER & DEPTH DYNAMICS */}
      {activeSubTab === 'LADDER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Pressure Meter & Imbalance Insights (4 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Real-Time Order Flow Imbalance */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-white text-sm">
                    {isArabic ? 'ميزان ضغط الطلبات اللحظي' : 'Pression Instantanée du Carnet'}
                  </h3>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  orderBook.bias === 'BUYERS_STRONG'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : orderBook.bias === 'SELLERS_STRONG'
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {orderBook.bias === 'BUYERS_STRONG'
                    ? (isArabic ? '🟢 هيمنة المشترين' : 'ACHETEURS DOMINANTS')
                    : orderBook.bias === 'SELLERS_STRONG'
                    ? (isArabic ? '🔴 هيمنة البائعين' : 'VENDEURS DOMINANTS')
                    : (isArabic ? '⚪ توازن قوى' : 'ÉQUILIBRÉ')}
                </span>
              </div>

              {/* Dominance Visual Bar */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <ArrowUp className="w-3.5 h-3.5" /> Bids: ${Math.round(orderBook.bidTotal).toLocaleString()} ({bidDominancePct}%)
                  </span>
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    Asks: ${Math.round(orderBook.askTotal).toLocaleString()} ({askDominancePct}%) <ArrowDown className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="w-full bg-rose-500/80 h-3 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${bidDominancePct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div>
                    <span>{isArabic ? 'معامل التفاوت:' : 'Ratio Bid/Ask:'}</span>
                    <span className="text-white font-bold block">{orderBook.bidAskRatio}x</span>
                  </div>
                  <div className={isArabic ? 'text-left' : 'text-right'}>
                    <span>{isArabic ? 'صافي عدم التوازن:' : 'Delta Imbalance:'}</span>
                    <span className={`font-bold block ${orderBook.imbalancePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {orderBook.imbalancePercent >= 0 ? '+' : ''}{orderBook.imbalancePercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Flow Diagnostic Analysis */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                  {isArabic ? 'تشخيص المحرك الكمي:' : 'Diagnostic de Flux d\'Ordres:'}
                </span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {orderBook.bias === 'BUYERS_STRONG'
                    ? (isArabic
                        ? 'تراكم قوي لطلبات الشراء في عمق الدفتر القريب، مما يشكل وسادة امتصاص متينة تمنع الهبوط وتدعم كسر المقاومات.'
                        : 'Forte concentration d\'ordres d\'achat limités en soutien, formant un coussin de liquidité robuste limitant le risque de baisse.')
                    : orderBook.bias === 'SELLERS_STRONG'
                    ? (isArabic
                        ? 'ضغط بيعي كثيف يظهر في عروض البيع المعلقة، مما يتطلب سيولة شرائية هائلة لاختراق المستويات العليا.'
                        : 'Pression vendeuse institutionnelle avec des blocs d\'offres massifs bloquant la hausse immédiate.')
                    : (isArabic
                        ? 'توزيع سيولة متكافئ بين المشترين والبائعين حول السعر العادل، مما يشير إلى مرحلة تجميع/تذبذب داخل النطاق.'
                        : 'Distribution symétrique de la liquidité acheteuse et vendeuse, propice au trading de range.')}
                </p>
              </div>
            </div>

            {/* Quick Whale Summary Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-400" />
                  {isArabic ? 'أقرب جدار حيتان نشط' : 'Mur Whale Principal'}
                </span>
                <span className="text-[10px] font-mono text-cyan-400">Binance Depth</span>
              </div>
              {orderBook.largeWalls && orderBook.largeWalls.length > 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs">
                  <div>
                    <span className={orderBook.largeWalls[0].type === 'BID' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {orderBook.largeWalls[0].type === 'BID' ? (isArabic ? '🟢 جدار شراء ضخم' : '🟢 Support Whale') : (isArabic ? '🔴 جدار بيع ضخم' : '🔴 Résistance Whale')}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      ${formatCoinPrice(orderBook.largeWalls[0].price, currentSymbol)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-bold">${(orderBook.largeWalls[0].volume / 1e6).toFixed(2)}M</span>
                    <span className="text-[10px] text-slate-400 block">Volume Total</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-2">
                  {isArabic ? 'لا توجد جدران حيتان شاذة في أول 20 مستوى' : 'Aucun mur anormal dans les 20 premiers niveaux'}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Live Dual Depth Ladder (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">
                  {isArabic ? 'جدول عمق السيولة اللحظي (Top 10 Niveaux)' : 'Échelle de Profondeur Live (Top 10 Niveaux)'}
                </h3>
              </div>
              <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                <span>Mid: <strong className="text-white">${formatCoinPrice(currentPrice, currentSymbol)}</strong></span>
              </div>
            </div>

            {/* Depth Dual Grid */}
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              {/* Bids Column (Green / Buyers) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase pb-1.5 border-b border-slate-800">
                  <span>{isArabic ? 'سعر الشراء (Bid)' : 'Prix Achat'}</span>
                  <span>{isArabic ? `الكمية (${baseAsset})` : `Volume (${baseAsset})`}</span>
                </div>
                {cumulativeBids.slice(0, 10).map((b, idx) => {
                  const pct = Math.min(100, Math.max(5, (b.qty / maxQty) * 100));
                  const isWhale = (b.price * b.qty) > 50000;
                  return (
                    <div
                      key={`bid-${idx}`}
                      className={`relative flex justify-between items-center py-1 px-2 rounded overflow-hidden transition-all ${
                        isWhale ? 'bg-emerald-950/40 border border-emerald-500/30' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div
                        className="absolute top-0 right-0 bottom-0 bg-emerald-500/15 pointer-events-none transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                      <span className="relative z-10 text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                        {isWhale && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                        ${formatCoinPrice(b.price, currentSymbol)}
                      </span>
                      <span className="relative z-10 text-slate-300 text-[11px]">
                        {b.qty.toFixed(b.qty >= 100 ? 1 : 3)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Asks Column (Red / Sellers) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase pb-1.5 border-b border-slate-800">
                  <span>{isArabic ? 'سعر البيع (Ask)' : 'Prix Vente'}</span>
                  <span>{isArabic ? `الكمية (${baseAsset})` : `Volume (${baseAsset})`}</span>
                </div>
                {cumulativeAsks.slice(0, 10).map((a, idx) => {
                  const pct = Math.min(100, Math.max(5, (a.qty / maxQty) * 100));
                  const isWhale = (a.price * a.qty) > 50000;
                  return (
                    <div
                      key={`ask-${idx}`}
                      className={`relative flex justify-between items-center py-1 px-2 rounded overflow-hidden transition-all ${
                        isWhale ? 'bg-rose-950/40 border border-rose-500/30' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div
                        className="absolute top-0 left-0 bottom-0 bg-rose-500/15 pointer-events-none transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                      <span className="relative z-10 text-rose-400 font-bold text-[11px] flex items-center gap-1">
                        {isWhale && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                        ${formatCoinPrice(a.price, currentSymbol)}
                      </span>
                      <span className="relative z-10 text-slate-300 text-[11px]">
                        {a.qty.toFixed(a.qty >= 100 ? 1 : 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: WHALES & LIQUIDATIONS RADAR */}
      {activeSubTab === 'WHALES_LIQUIDATION' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Whale Liquidity Walls Radar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  {isArabic ? 'رادار كشف جدران الحيتان (Whale Walls)' : 'Radar des Murs de Liquidité Institutionnels'}
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                L2 Anomalies
              </span>
            </div>

            <p className="text-xs text-slate-400">
              {isArabic 
                ? 'يتم رصد الكتل غير الطبيعية التي تفوق متوسط أحجام السوق لتحديد مناطق الدفاع أو التصريف المحتملة للحيتان.'
                : 'Détection des blocs anormaux d\'ordres limites constituant des barrières de prix institutionnelles.'}
            </p>

            <div className="space-y-2.5 font-mono text-xs">
              {orderBook.largeWalls && orderBook.largeWalls.length > 0 ? (
                orderBook.largeWalls.map((wall, idx) => {
                  const distPct = currentPrice > 0 ? ((wall.price - currentPrice) / currentPrice) * 100 : 0;
                  const isBid = wall.type === 'BID';
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                        isBid
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-950/20 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">
                            {isBid ? (isArabic ? '🟢 جدار شراء مؤسسي' : '🟢 Mur d\'Achat (Support)') : (isArabic ? '🔴 جدار بيع مؤسسي' : '🔴 Mur de Vente (Résistance)')}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-300">
                            {distPct > 0 ? `+${distPct.toFixed(2)}%` : `${distPct.toFixed(2)}%`}
                          </span>
                        </div>
                        <span className="text-xs text-slate-300">
                          {isArabic ? 'السعر المستهدف:' : 'Niveau de Prix:'} <strong className="text-white">${formatCoinPrice(wall.price, currentSymbol)}</strong>
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-bold text-white">
                          ${(wall.volume / 1e6).toFixed(2)}M
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {isArabic ? 'حجم الجدار المحجوز' : 'Volume Détecté'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                  {isArabic ? 'لا توجد جدران غير طبيعية حالياً (السيولة موزعة بانتظام)' : 'Aucun mur extrême détecté actuellement'}
                </div>
              )}
            </div>
          </div>

          {/* Futures Liquidation Clusters & Squeeze Radar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">
                  {isArabic ? 'تقدير تجمعات التصفيات (Liquidation Clusters)' : 'Estimation des Zones de Liquidation Futures'}
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20">
                Squeeze Engine
              </span>
            </div>

            <p className="text-xs text-slate-400">
              {isArabic 
                ? 'مناطق استهداف السيولة المحتملة حيث تتركز أوامر الوقف للمتداولين ذوي الرافعة المالية العالية.'
                : 'Zones magnétiques où la chasse aux stops des positions à fort levier peut déclencher des cascades d\'achats/ventes.'}
            </p>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              {/* Short Squeeze Targets (Above Price) */}
              <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-rose-400 font-bold text-xs block pb-1 border-b border-slate-800 flex items-center justify-between">
                  <span>{isArabic ? 'تصفيات الـ Shorts (أعلى)' : 'Liq. Shorts (Haut)'}</span>
                  <ArrowUp className="w-3 h-3" />
                </span>
                {liquidationClusters.shorts.map((item, idx) => (
                  <div key={idx} className="p-1.5 rounded bg-slate-900/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">{item.leverage}</span>
                    <span className="text-white font-bold">${formatCoinPrice(item.price, currentSymbol)}</span>
                    <span className="text-rose-400 font-semibold text-[10px]">+{item.distance}%</span>
                  </div>
                ))}
              </div>

              {/* Long Squeeze Targets (Below Price) */}
              <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-emerald-400 font-bold text-xs block pb-1 border-b border-slate-800 flex items-center justify-between">
                  <span>{isArabic ? 'تصفيات الـ Longs (أسفل)' : 'Liq. Longs (Bas)'}</span>
                  <ArrowDown className="w-3 h-3" />
                </span>
                {liquidationClusters.longs.map((item, idx) => (
                  <div key={idx} className="p-1.5 rounded bg-slate-900/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">{item.leverage}</span>
                    <span className="text-white font-bold">${formatCoinPrice(item.price, currentSymbol)}</span>
                    <span className="text-emerald-400 font-semibold text-[10px]">{item.distance}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: SMART ORDER IMPACT & SLIPPAGE SIMULATOR */}
      {activeSubTab === 'SIMULATOR' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="font-bold text-white text-base">
                  {isArabic ? 'محاكي تأثير السيولة والإنزلاق السعري (Slippage Simulator)' : 'Simulateur d\'Impact de Carnet & Slippage Institutionnel'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isArabic ? 'احسب متوسط سعر التنفيذ الحقيقي لأي حجم صفقة في الدفتر اللحظي' : 'Calculez le prix moyen exécuté réel et le glissement (slippage) selon la profondeur'}
                </p>
              </div>
            </div>

            {/* Quick Size Presets */}
            <div className="flex items-center gap-1.5">
              {[1000, 5000, 25000, 100000, 500000].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setSimulatedSizeUsd(size);
                    setCustomSizeInput(size.toString());
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    simulatedSizeUsd === size
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  ${size >= 1000 ? `${size / 1000}k` : size}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Size Input */}
          <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 max-w-md">
            <DollarSign className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-slate-400">{isArabic ? 'حجم الصفقة المراد محاكاتها:' : 'Montant à Simuler (USDT):'}</span>
            <input
              type="number"
              value={customSizeInput}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setCustomSizeInput(e.target.value);
                setSimulatedSizeUsd(val);
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm font-mono font-bold text-white w-32 text-right focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Simulation Output Cards */}
          {simulationResults && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
              {/* Buy Impact Card */}
              <div className="bg-slate-950 p-5 rounded-xl border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                    <ArrowUp className="w-4 h-4" /> {isArabic ? 'محاكاة أمر شراء فوري (Market BUY)' : 'Simulation Achat Marché (BUY)'}
                  </span>
                  <span className="text-xs text-slate-400">${simulatedSizeUsd.toLocaleString()} USDT</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">{isArabic ? 'سعر السوق اللحظي:' : 'Prix Marché Actuel:'}</span>
                    <span className="text-slate-300 font-bold">${formatCoinPrice(currentPrice, currentSymbol)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">{isArabic ? 'متوسط سعر التنفيذ المقدر:' : 'Prix d\'Exécution Moyen:'}</span>
                    <span className="text-emerald-400 font-bold">${formatCoinPrice(simulationResults.avgBuyPrice, currentSymbol)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">{isArabic ? 'الإنزلاق السعري المقدر (Slippage):' : 'Slippage Estimé:'}</span>
                    <span className={`font-bold ${simulationResults.buySlippageBps > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {simulationResults.buySlippageBps.toFixed(2)} bps ({((simulationResults.buySlippageBps / 10000) * 100).toFixed(3)}%)
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">{isArabic ? 'حالة التغطية بالدفتر:' : 'Couverture du Carnet:'}</span>
                    <span className={simulationResults.unfilledBuy === 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {simulationResults.unfilledBuy === 0 ? '100% Rempli' : `Partiel ($${Math.round(simulationResults.unfilledBuy)} restant)`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sell Impact Card */}
              <div className="bg-slate-950 p-5 rounded-xl border border-rose-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-rose-400 font-bold text-sm flex items-center gap-1.5">
                    <ArrowDown className="w-4 h-4" /> {isArabic ? 'محاكاة أمر بيع فوري (Market SELL)' : 'Simulation Vente Marché (SELL)'}
                  </span>
                  <span className="text-xs text-slate-400">${simulatedSizeUsd.toLocaleString()} USDT</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">{isArabic ? 'سعر السوق اللحظي:' : 'Prix Marché Actuel:'}</span>
                    <span className="text-slate-300 font-bold">${formatCoinPrice(currentPrice, currentSymbol)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">{isArabic ? 'متوسط سعر التنفيذ المقدر:' : 'Prix d\'Exécution Moyen:'}</span>
                    <span className="text-rose-400 font-bold">${formatCoinPrice(simulationResults.avgSellPrice, currentSymbol)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">{isArabic ? 'الإنزلاق السعري المقدر (Slippage):' : 'Slippage Estimé:'}</span>
                    <span className={`font-bold ${simulationResults.sellSlippageBps > 10 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {simulationResults.sellSlippageBps.toFixed(2)} bps ({((simulationResults.sellSlippageBps / 10000) * 100).toFixed(3)}%)
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">{isArabic ? 'حالة التغطية بالدفتر:' : 'Couverture du Carnet:'}</span>
                    <span className={simulationResults.unfilledSell === 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {simulationResults.unfilledSell === 0 ? '100% Rempli' : `Partiel ($${Math.round(simulationResults.unfilledSell)} restant)`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
