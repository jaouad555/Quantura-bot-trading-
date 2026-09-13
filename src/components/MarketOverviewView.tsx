import React from 'react';
import { MarketDataResponse, Language } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import { Layers, ShieldCheck, Activity, BarChart2, Zap, ArrowDown, ArrowUp, AlertCircle } from 'lucide-react';

interface MarketOverviewViewProps {
  marketData: MarketDataResponse | null;
  language: Language;
}

export const MarketOverviewView: React.FC<MarketOverviewViewProps> = ({
  marketData,
  language,
}) => {
  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';

  if (!marketData || !marketData.orderBook) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <Layers className="w-8 h-8 text-brand-400 animate-pulse mx-auto mb-2" />
        <p>Chargement des données de flux et du carnet d'ordres Binance...</p>
      </div>
    );
  }

  const { orderBook, derivatives, ticker } = marketData;
  const currentSymbol = ticker?.symbol || 'BTCUSDT';
  const baseAsset = currentSymbol.replace('USDT', '');
  const bidsList = Array.isArray(orderBook?.topBids) ? orderBook.topBids : [];
  const asksList = Array.isArray(orderBook?.topAsks) ? orderBook.topAsks : [];
  const maxBidQty = bidsList.length > 0 ? Math.max(...bidsList.map((b) => b.qty)) : 1;
  const maxAskQty = asksList.length > 0 ? Math.max(...asksList.map((a) => a.qty)) : 1;
  const maxQty = Math.max(maxBidQty, maxAskQty, 1);

  return (
    <div className={`space-y-5 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* Top Derivatives Metrics Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-white text-base">
              {isArabic 
                ? `بيانات المشتقات والعقود الآجلة ${currentSymbol} (Binance Live)`
                : `Données de Dérivés & Futures ${currentSymbol} (Binance Live)`}
            </h3>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
            {derivatives?.source || 'Binance Futures'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          {/* Open Interest */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Open Interest ({baseAsset})</span>
            <div className="text-base font-bold text-white mt-1">
              {derivatives?.openInterest ? `${Math.round(derivatives.openInterest).toLocaleString()} ${baseAsset}` : 'Non disponible (API)'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">Contrats ouverts actifs</span>
          </div>

          {/* Funding Rate */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Funding Rate (8h)</span>
            <div className={`text-base font-bold mt-1 ${
              (derivatives?.fundingRate || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {derivatives?.fundingRate !== null ? `${(derivatives?.fundingRate || 0) > 0 ? '+' : ''}${derivatives?.fundingRate}%` : 'Non disponible'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {(derivatives?.fundingRate || 0) > 0.03 ? 'Longs paient les Shorts (Optimisme élevé)' : 'Taux neutre / équilibré'}
            </span>
          </div>

          {/* Taker Long/Short Ratio */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Ratio Taker Long/Short</span>
            <div className={`text-base font-bold mt-1 ${
              (derivatives?.takerLongShortRatio || 1) >= 1.1 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {derivatives?.takerLongShortRatio !== null ? derivatives?.takerLongShortRatio : 'Non disponible'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {(derivatives?.takerLongShortRatio || 1) >= 1 ? 'Volume acheteur dominant' : 'Volume vendeur dominant'}
            </span>
          </div>
        </div>
      </div>

      {/* Order Book Depth & Pressure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Orderbook Pressure Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-brand-400" />
              <h3 className="font-bold text-white text-base">Pression du Carnet d'Ordres</h3>
            </div>
            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
              orderBook.bias === 'BUYERS_STRONG'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : orderBook.bias === 'SELLERS_STRONG'
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {orderBook.bias === 'BUYERS_STRONG' ? 'ACHETEURS DOMINANTS' : orderBook.bias === 'SELLERS_STRONG' ? 'VENDEURS DOMINANTS' : 'ÉQUILIBRÉ'}
            </span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-emerald-400 font-bold">Bids (Acheteurs) : ${orderBook.bidTotal.toLocaleString()}</span>
              <span className="text-rose-400 font-bold">Asks (Vendeurs) : ${orderBook.askTotal.toLocaleString()}</span>
            </div>

            <div className="w-full bg-rose-500/80 h-3.5 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{
                  width: `${Math.min(90, Math.max(10, (orderBook.bidTotal / ((orderBook.bidTotal + orderBook.askTotal) || 1)) * 100))}%`,
                }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-500 pt-1">
              <span>Ratio Acheteurs/Vendeurs : <strong className="text-white">{orderBook.bidAskRatio}</strong></span>
              <span>Déséquilibre : <strong className={orderBook.imbalancePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{orderBook.imbalancePercent}%</strong></span>
            </div>
          </div>

          {/* Large Walls Detected */}
          {orderBook.largeWalls && orderBook.largeWalls.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider block">
                Murs de Liquidité Détectés (Whales)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {orderBook.largeWalls.map((wall, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      wall.type === 'BID'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    <span>{wall.type === 'BID' ? '🟢 Mur Achat' : '🔴 Mur Vente'}</span>
                    <span className="font-bold">${formatCoinPrice(wall.price, currentSymbol)} (${(wall.volume / 1000000).toFixed(2)}M)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Depth Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="font-bold text-white text-base">Profondeur du Carnet (Top 10 Niveaux)</h3>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {/* Bids */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-500 uppercase pb-1 border-b border-slate-800">
                <span>Prix Achat</span>
                <span>Volume {baseAsset}</span>
              </div>
              {bidsList.slice(0, 8).map((b, i) => (
                <div key={i} className="relative flex justify-between items-center py-1 px-1.5 rounded overflow-hidden">
                  <div
                    className="absolute top-0 right-0 bottom-0 bg-emerald-500/15"
                    style={{ width: `${(b.qty / maxQty) * 100}%` }}
                  />
                  <span className="relative z-10 text-emerald-400 font-bold">${formatCoinPrice(b.price, currentSymbol)}</span>
                  <span className="relative z-10 text-slate-300">{b.qty.toFixed(3)}</span>
                </div>
              ))}
            </div>

            {/* Asks */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-500 uppercase pb-1 border-b border-slate-800">
                <span>Prix Vente</span>
                <span>Volume {baseAsset}</span>
              </div>
              {asksList.slice(0, 8).map((a, i) => (
                <div key={i} className="relative flex justify-between items-center py-1 px-1.5 rounded overflow-hidden">
                  <div
                    className="absolute top-0 left-0 bottom-0 bg-rose-500/15"
                    style={{ width: `${(a.qty / maxQty) * 100}%` }}
                  />
                  <span className="relative z-10 text-rose-400 font-bold">${formatCoinPrice(a.price, currentSymbol)}</span>
                  <span className="relative z-10 text-slate-300">{a.qty.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
