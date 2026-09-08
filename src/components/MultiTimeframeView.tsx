import React from 'react';
import { MarketDataResponse, Language, Timeframe } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import { Layers, ArrowUpRight, ArrowDownRight, Minus, CheckCircle, Activity, Compass } from 'lucide-react';

interface MultiTimeframeViewProps {
  marketData: MarketDataResponse | null;
  language: Language;
  onSelectTimeframe: (tf: Timeframe) => void;
}

export const MultiTimeframeView: React.FC<MultiTimeframeViewProps> = ({
  marketData,
  language,
  onSelectTimeframe,
}) => {
  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';

  if (!marketData || !marketData.mtfConfluence) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <Layers className="w-8 h-8 text-brand-400 animate-pulse mx-auto mb-2" />
        <p>Chargement de la matrice multi-timeframes...</p>
      </div>
    );
  }

  const { mtfConfluence, allTimeframes, ticker } = marketData;
  const { bullishCount, bearishCount, neutralCount, alignmentPercent, overallBias } = mtfConfluence;

  const isEn = language === 'en';

  const timeframes: { tf: Timeframe; name: string; desc: string }[] = [
    { tf: '5m', name: isArabic ? '5 دقائق' : (isEn ? '5 Minutes' : '5 Minutes'), desc: isArabic ? 'سكالبينج فائق السرعة' : (isEn ? 'Ultra-fast Scalping' : 'Scalping Ultra-Rapide') },
    { tf: '15m', name: isArabic ? '15 دقيقة' : (isEn ? '15 Minutes' : '15 Minutes'), desc: isArabic ? 'دقة الدخول والزخم السريع' : (isEn ? 'Fast Momentum & Precision' : 'Scalping & Précision d\'entrée') },
    { tf: '30m', name: isArabic ? '30 دقيقة' : (isEn ? '30 Minutes' : '30 Minutes'), desc: isArabic ? 'هيكل السوق قصير المدى' : (isEn ? 'Short-term Market Structure' : 'Structure Court Terme') },
    { tf: '1h', name: isArabic ? '1 ساعة' : (isEn ? '1 Hour' : '1 Heure'), desc: isArabic ? 'الاتجاه اليومي والمضاعفة' : (isEn ? 'Intraday Trend' : 'Tendance Intraday') },
    { tf: '4h', name: isArabic ? '4 ساعات' : (isEn ? '4 Hours' : '4 Heures'), desc: isArabic ? 'هيكل سوينغ رئيسي' : (isEn ? 'Major Swing Structure' : 'Structure Swing Majeure') },
    { tf: '1d', name: isArabic ? '1 يوم' : (isEn ? '1 Day' : '1 Jour'), desc: isArabic ? 'الاتجاه متوسط المدى' : (isEn ? 'Medium Term Trend' : 'Tendance Moyen Terme') },
    { tf: '1w', name: isArabic ? '1 أسبوع' : (isEn ? '1 Week' : '1 Semaine'), desc: isArabic ? 'الدورة الكبرى الأسبوعية' : (isEn ? 'Macro Cycle' : 'Cycle Macro Hebdomadaire') },
  ];

  const getBiasBadge = (bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL') => {
    if (bias === 'BULLISH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
          <ArrowUpRight className="w-3.5 h-3.5" /> HAUSSIER
        </span>
      );
    } else if (bias === 'BEARISH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold">
          <ArrowDownRight className="w-3.5 h-3.5" /> BAISSIER
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-xs font-mono font-bold">
        <Minus className="w-3.5 h-3.5" /> NEUTRE
      </span>
    );
  };

  return (
    <div className={`space-y-5 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* Overall Confluence Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base sm:text-lg">
                  Matrice de Confluence Multi-Timeframes (MTF)
                </h3>
                {getBiasBadge(overallBias)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Évaluation continue de 15m à 1 semaine pour valider l'alignement de tendance institutionnelle.
              </p>
            </div>
          </div>

          {/* Alignment Stats Bar */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono min-w-[240px]">
            <div className="flex justify-between text-slate-400 mb-1.5">
              <span>Alignement Global</span>
              <span className="font-bold text-brand-400">{alignmentPercent}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${(bullishCount / 5) * 100}%` }}
                title={`${bullishCount} Haussiers`}
              />
              <div
                className="bg-slate-600 h-full transition-all"
                style={{ width: `${(neutralCount / 5) * 100}%` }}
                title={`${neutralCount} Neutres`}
              />
              <div
                className="bg-rose-500 h-full transition-all"
                style={{ width: `${(bearishCount / 5) * 100}%` }}
                title={`${bearishCount} Baissiers`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span className="text-emerald-400">{bullishCount} Bull</span>
              <span className="text-slate-400">{neutralCount} Neutre</span>
              <span className="text-rose-400">{bearishCount} Bear</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Timeframe Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {timeframes.map(({ tf, name, desc }) => {
          const tfData = mtfConfluence.timeframes[tf];
          const fullData = allTimeframes ? allTimeframes[tf] : null;
          const inds = fullData?.indicators;

          return (
            <div
              key={tf}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition rounded-2xl p-4 shadow-lg space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold text-white">{name} ({tf.toUpperCase()})</span>
                    <span className="text-[11px] text-slate-500 block">{desc}</span>
                  </div>
                  {tfData && getBiasBadge(tfData.bias)}
                </div>

                {inds ? (
                  <div className="space-y-2 text-xs font-mono bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Structure :</span>
                      <span className="text-slate-200 font-bold">{inds.marketStructure.trend}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">RSI (14) :</span>
                      <span className={`font-bold ${inds.rsi14 > 70 ? 'text-rose-400' : inds.rsi14 < 30 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {inds.rsi14}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">EMA 20 / 50 :</span>
                      <span className="text-slate-300">${formatCoinPrice(inds.ema20, ticker?.symbol || 'BTCUSDT')} / ${formatCoinPrice(inds.ema50, ticker?.symbol || 'BTCUSDT')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">EMA 200 :</span>
                      <span className="text-slate-300">${formatCoinPrice(inds.ema200, ticker?.symbol || 'BTCUSDT')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">MACD Histogram :</span>
                      <span className={`font-bold ${inds.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {inds.macd.histogram}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-3 text-center">
                    Chargement des données {tf}...
                  </div>
                )}
              </div>

              <button
                onClick={() => onSelectTimeframe(tf)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-brand-400" />
                <span>Afficher le Graphique {tf.toUpperCase()}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
