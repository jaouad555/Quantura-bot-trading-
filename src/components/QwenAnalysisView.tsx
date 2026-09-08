import React from 'react';
import { AIAnalysisResult, MarketDataResponse, Language } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import { Sparkles, Activity, Layers, ArrowUpRight, ArrowDownRight, CheckCircle2, Cpu, Zap, ShieldAlert, Compass } from 'lucide-react';

interface QwenAnalysisViewProps {
  analysis: AIAnalysisResult | null;
  marketData: MarketDataResponse | null;
  language: Language;
}

export const QwenAnalysisView: React.FC<QwenAnalysisViewProps> = ({
  analysis,
  marketData,
  language,
}) => {
  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';

  if (!analysis || !marketData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <Sparkles className="w-8 h-8 text-brand-400 animate-pulse mx-auto mb-2" />
        <p>Lancez une actualisation de l'analyse pour consulter le rapport complet.</p>
      </div>
    );
  }

  const detailedText =
    analysis.detailedAnalysis?.[language] ||
    analysis.detailedAnalysis?.fr ||
    analysis.detailedAnalysis?.en ||
    (isArabic ? 'تم حساب التقرير الكمي بنجاح.' : 'Rapport quantitatif calculé avec succès.');

  const { indicators, orderBook, mtfConfluence, marketRegime } = marketData;

  const getConfluenceBadge = (val: 'BULLISH' | 'BEARISH' | 'NEUTRAL') => {
    if (val === 'BULLISH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
          <ArrowUpRight className="w-3 h-3" /> {isArabic ? 'صعود (Bull)' : 'Hausse (Bull)'}
        </span>
      );
    } else if (val === 'BEARISH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold">
          <ArrowDownRight className="w-3 h-3" /> {isArabic ? 'هبوط (Bear)' : 'Baisse (Bear)'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold">
        {isArabic ? 'محايد' : 'Neutre'}
      </span>
    );
  };

  return (
    <div className={`space-y-4 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* Detailed AI / Quantitative Rationale Text */}
      <div className="bg-slate-900/90 border border-brand-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-white text-base">
              {isArabic 
                ? `تقرير التحليل الكمي والمؤسسي لعملة ${marketData.ticker?.symbol || 'BTCUSDT'}`
                : `Rapport d'Analyse Quantitatif & Institutionnel ${marketData.ticker?.symbol || 'BTCUSDT'}`}
            </h3>
          </div>
          <span className="text-[11px] font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
            {isArabic ? 'محرك حتمي + ذكاء اصطناعي' : 'Moteur Déterministe + LLM'}
          </span>
        </div>

        <div className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
          {detailedText}
        </div>

        {/* Key Confluence Drivers */}
        {analysis.keyFactors && analysis.keyFactors.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-2">
              {isArabic ? 'العوامل الرئيسية المرصودة' : 'Facteurs Clés de Confluence Détectés'}
            </h4>
            <div className="space-y-1.5">
              {analysis.keyFactors.map((factor, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{factor}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Technical Indicators & MTF Stats */}
      {indicators && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Indicators Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-brand-400 uppercase tracking-wider">
              <Activity className="w-4 h-4" />
              <span>{isArabic ? 'المؤشرات الفنية (الإطار الزمني الحالي)' : 'Indicateurs Techniques (Timeframe Actuel)'}</span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              {/* RSI */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>RSI (14)</span>
                  <span className={`font-bold ${indicators.rsi14 > 70 ? 'text-rose-400' : indicators.rsi14 < 30 ? 'text-emerald-400' : 'text-brand-400'}`}>
                    {indicators.rsi14} ({indicators.rsi14 > 70 ? (isArabic ? 'ذروة شراء' : 'Suracheté') : indicators.rsi14 < 30 ? (isArabic ? 'ذروة بيع' : 'Survendu') : (isArabic ? 'محايد' : 'Neutre')})
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-400 via-brand-400 to-rose-400 h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, indicators.rsi14))}%` }}
                  />
                </div>
              </div>

              {/* MACD */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">MACD Histogram</span>
                <span className={`font-bold ${indicators.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {indicators.macd.histogram} ({isArabic ? 'خط' : 'Ligne'}: {indicators.macd.macdLine} / {isArabic ? 'إشارة' : 'Signal'}: {indicators.macd.signalLine})
                </span>
              </div>

              {/* EMAs */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <span className="text-slate-500 block">EMA 20</span>
                  <span className="text-slate-200 font-bold">${formatCoinPrice(indicators.ema20, marketData.ticker?.symbol || 'BTCUSDT')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">EMA 50</span>
                  <span className="text-slate-200 font-bold">${formatCoinPrice(indicators.ema50, marketData.ticker?.symbol || 'BTCUSDT')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">EMA 200</span>
                  <span className="text-slate-200 font-bold">${formatCoinPrice(indicators.ema200, marketData.ticker?.symbol || 'BTCUSDT')}</span>
                </div>
              </div>

              {/* Support & Resistance */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-emerald-400 font-bold block mb-1">{isArabic ? 'دعوم مرصودة' : 'Supports Détectés'}</span>
                  {indicators.supportLevels.slice(0, 3).map((s, i) => (
                    <div key={i} className="text-slate-300">${formatCoinPrice(s, marketData.ticker?.symbol || 'BTCUSDT')}</div>
                  ))}
                </div>
                <div>
                  <span className="text-rose-400 font-bold block mb-1">{isArabic ? 'مقاومات مرصودة' : 'Résistances Détectées'}</span>
                  {indicators.resistanceLevels.slice(0, 3).map((r, i) => (
                    <div key={i} className="text-slate-300">${formatCoinPrice(r, marketData.ticker?.symbol || 'BTCUSDT')}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* MTF Confluence & Depth */}
          <div className="space-y-4">
            {mtfConfluence && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-400 mb-3 uppercase tracking-wider">
                  <Compass className="w-4 h-4" />
                  <span>{isArabic ? 'تطابق الإطارات الزمنية المتعددة' : 'Confluence Multi-Timeframes'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {Object.entries(mtfConfluence.timeframes || {}).map(([tf, item]: [string, any]) => (
                    <div key={tf} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 uppercase font-bold">{tf}</span>
                      {getConfluenceBadge(item.bias)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {orderBook && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center justify-between text-xs font-bold text-brand-400 mb-2 uppercase tracking-wider">
                  <span>{isArabic ? 'ضغط سجل الطلبات' : 'Pression du Carnet Binance'}</span>
                  <span className="text-slate-300 font-mono">{isArabic ? 'النسبة' : 'Ratio'} : {orderBook.bidAskRatio}</span>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Bids : ${orderBook.bidTotal.toLocaleString()} | Asks : ${orderBook.askTotal.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
