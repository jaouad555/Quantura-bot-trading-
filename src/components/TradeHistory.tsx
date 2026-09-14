import React, { useState } from 'react';
import { TradeHistoryItem, PaperWallet, Language } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import { TradingPerformanceSummary } from './TradingPerformanceSummary';
import { DailyRealizedPnLChart } from './DailyRealizedPnLChart';
import { TradeMetricsDashboard } from './TradeMetricsDashboard';
import { LineChart, Line, YAxis } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import {
  Award,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
  Trash2,
  Search,
  Filter,
  History,
  Sparkles,
} from 'lucide-react';

interface TradeHistoryProps {
  history: TradeHistoryItem[];
  paperWallet?: PaperWallet;
  language: Language;
  currentPrice?: number;
  onClearHistory?: () => void;
  onDeleteTrade?: (id: string) => void;
  onCloseActivePosition?: (posId: string) => void;
  onSeedSampleData?: () => void;
  onFullReset?: () => void;
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({
  history,
  paperWallet,
  language,
  currentPrice,
  onClearHistory,
  onDeleteTrade,
  onCloseActivePosition,
  onSeedSampleData,
  onFullReset,
}) => {
  const t = translations[language] || translations.fr;
  const isArabic = language === 'ar';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDecision, setFilterDecision] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'WIN' | 'LOSS'>('ALL');

  // Filter items in the table
  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      searchTerm === '' ||
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.reason && item.reason.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDecision = filterDecision === 'ALL' || item.decision === filterDecision;

    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && item.status === 'ACTIVE') ||
      (filterStatus === 'WIN' && item.status !== 'ACTIVE' && item.profitPercent > 0.01) ||
      (filterStatus === 'LOSS' && item.status !== 'ACTIVE' && item.profitPercent < -0.01);

    return matchesSearch && matchesDecision && matchesStatus;
  });

  return (
    <div className={`space-y-6 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* 1. VISUAL RECHARTS PERFORMANCE SUMMARY SECTION */}
      <TradingPerformanceSummary
        history={history}
        language={language}
        currentPrice={currentPrice}
        onSeedSampleData={onSeedSampleData}
      />

      {/* 2. REALIZED PNL OVER TIME (DAILY PROFIT/LOSS PERFORMANCE) BAR CHART */}
      <DailyRealizedPnLChart
        history={history}
        paperWallet={paperWallet}
        language={language}
        onSeedSampleData={onSeedSampleData}
      />

      <TradeMetricsDashboard history={history} language={language} />

      {/* 3. DETAILED AUDIT TRAIL / TRADE HISTORY LOG TABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span>{isArabic ? 'سجل الصفقات التفصيلي وتتبع الأوامر' : 'Journal Détaillé des Trades'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {filteredHistory.length} / {history.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isArabic
                  ? 'سجل زمني دقيق لكافة الصفقات المنفذة، نقاط الدخول، الأهداف المحققة ونسب الأرباح'
                  : 'Historique chronologique avec prix d\'entrée, cibles atteintes et ratios réalisés.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isArabic ? 'بحث بالرمز...' : 'Filtrer par symbole...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 w-full sm:w-36 font-mono"
              />
            </div>

            {/* Decision Filter */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs font-mono">
              <button
                onClick={() => setFilterDecision('ALL')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                  filterDecision === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ALL
              </button>
              <button
                onClick={() => setFilterDecision('LONG')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                  filterDecision === 'LONG'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                LONG
              </button>
              <button
                onClick={() => setFilterDecision('SHORT')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                  filterDecision === 'SHORT'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                SHORT
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs font-mono">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                  filterStatus === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isArabic ? 'الكل' : 'Tous'}
              </button>
              <button
                onClick={() => setFilterStatus('ACTIVE')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                  filterStatus === 'ACTIVE'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isArabic ? 'الجارية' : 'En cours'}
              </button>
              <button
                onClick={() => setFilterStatus('WIN')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                  filterStatus === 'WIN'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Wins
              </button>
              <button
                onClick={() => setFilterStatus('LOSS')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                  filterStatus === 'LOSS'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Losses
              </button>
            </div>

            {onClearHistory && history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-xl border border-slate-700 hover:border-rose-500/30 transition shadow-sm"
                title={isArabic ? 'مسح كافة الصفقات' : 'Effacer l\'historique'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isArabic ? 'مسح الكل' : 'Effacer'}</span>
              </button>
            )}
            {onFullReset && (
              <button
                onClick={onFullReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-rose-600/40 text-slate-300 hover:text-rose-200 rounded-xl border border-slate-700 hover:border-rose-500/50 transition shadow-sm"
                title={isArabic ? 'إغلاق ومسح كافة الصفقات وإعادة ضبط المحفظة 1000$' : 'Tout réinitialiser (1000$)'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isArabic ? 'إعادة ضبط شاملة (1000$)' : 'Reset tout ($1,000)'}</span>
              </button>
            )}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-300">
                {isArabic ? 'لا توجد صفقات مطابقة للفلتر المحدد' : 'Aucun trade ne correspond aux critères.'}
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {isArabic
                  ? 'جرب تغيير شروط البحث أو توليد عينة صفقات للتجربة'
                  : 'Essayez de réinitialiser vos filtres ou de charger un échantillon.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="pb-2.5 pl-2">{isArabic ? 'التوقيت' : 'Heure / Date'}</th>
                  <th className="pb-2.5">{isArabic ? 'الزوج' : 'Paire'}</th>
                  <th className="pb-2.5">{isArabic ? 'القرار' : 'Action'}</th>
                  <th className="pb-2.5">{isArabic ? 'الدخول' : 'Entrée'}</th>
                  <th className="pb-2.5">{isArabic ? 'الأهداف' : 'TP1 / TP2'}</th>
                  <th className="pb-2.5">{isArabic ? 'الحالة' : 'Statut'}</th>
                  <th className="pb-2.5 text-center">{isArabic ? 'مسار' : 'Graphique'}</th>
                  <th className="pb-2.5 text-right pr-2">{isArabic ? 'الربح %' : 'P&L %'}</th>
                  {onDeleteTrade && <th className="pb-2.5 text-center w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <AnimatePresence mode="popLayout">
                  {filteredHistory.map((item, idx) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      key={item.id || idx}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      <td className="py-3 pl-2 text-slate-400">
                      <div className="text-white font-medium">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(item.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </td>

                    <td className="py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                          {item.symbol || 'BTCUSDT'}
                        </span>
                        {item.strategyName && (
                          <span className="text-[9px] text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20 max-w-[80px] truncate" title={item.strategyName}>
                            {item.strategyName}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] inline-flex items-center gap-1 ${
                          item.decision === 'LONG'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {item.decision === 'LONG' ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {item.decision}
                      </span>
                    </td>

                    <td className="py-3 text-slate-200">
                      ${formatCoinPrice(item.entryPrice, item.symbol)}
                    </td>

                    <td className="py-3 text-slate-300 text-[11px]">
                      <div>TP1: ${formatCoinPrice(item.tp1, item.symbol)}</div>
                      {item.tp2 && (
                        <div className="text-slate-400 text-[10px]">
                          TP2: ${formatCoinPrice(item.tp2, item.symbol)}
                        </div>
                      )}
                    </td>

                    <td className="py-3">
                      {item.status === 'ACTIVE' ? (
                        <span className="text-cyan-400 font-bold flex items-center gap-1.5 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                          <span>{isArabic ? 'صفقة جارية' : 'En Cours'}</span>
                        </span>
                      ) : item.status === 'PROFIT_TP1' || item.status === 'TP1_HIT' ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> TP1 Hit
                        </span>
                      ) : item.status === 'PROFIT_TP2' || item.status === 'TP2_HIT' ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> TP2 Hit
                        </span>
                      ) : item.status === 'TP3_HIT' ? (
                        <span className="text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/15 px-2 py-0.5 rounded-lg border border-emerald-400/40">
                          <CheckCircle2 className="w-3.5 h-3.5" /> TP3 Max
                        </span>
                      ) : item.status === 'STOPPED_OUT' || item.status === 'SL_HIT' ? (
                        <span className="text-rose-400 font-bold flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/30">
                          <ShieldAlert className="w-3.5 h-3.5" /> Stop Loss
                        </span>
                      ) : item.status === 'MANUAL_EXIT' || item.status === 'CLOSED' ? (
                        <span className="text-amber-300 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {isArabic ? 'إغلاق يدوي' : 'Sortie Manuelle'}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                          {isArabic ? 'مغلقة' : 'Clôturé'}
                        </span>
                      )}
                    </td>

                    <td className="py-3 text-center opacity-70">
                      {item.pnlHistory && item.pnlHistory.length > 1 ? (
                        <div className="inline-block" style={{ width: 60, height: 24 }}>
                          <LineChart width={60} height={24} data={item.pnlHistory.map((val, i) => ({ val, i }))}>
                            <YAxis domain={['dataMin', 'dataMax']} hide />
                            <Line 
                              type="monotone" 
                              dataKey="val" 
                              stroke={item.pnlHistory[item.pnlHistory.length - 1] >= 0 ? '#34d399' : '#fb7185'} 
                              strokeWidth={1.5} 
                              dot={false}
                              isAnimationActive={false} 
                            />
                          </LineChart>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-600">-</span>
                      )}
                    </td>

                    <td className="py-3 text-right pr-2 font-bold">
                      {(() => {
                        if (item.status === 'ACTIVE') {
                          const activePrice = item.currentPrice || item.entryPrice;
                          const isLong = item.decision === 'LONG';
                          const diff = isLong
                            ? activePrice - item.entryPrice
                            : item.entryPrice - activePrice;
                          const pnl = (diff / item.entryPrice) * 100;
                          return (
                            <span
                              className={`text-sm ${
                                pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {pnl >= 0 ? '+' : ''}
                              {(pnl || 0).toFixed(2)}%
                            </span>
                          );
                        }
                        return (
                          <span
                            className={`text-sm ${
                              (item.profitPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {(item.profitPercent ?? 0) >= 0 ? '+' : ''}
                            {(item.profitPercent ?? 0).toFixed(2)}%
                          </span>
                        );
                      })()}
                    </td>

                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {item.status === 'ACTIVE' && onCloseActivePosition && (
                          <button
                            onClick={() => onCloseActivePosition(item.id)}
                            className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-md transition shadow-sm"
                            title={isArabic ? 'إغلاق هذه الصفقة فوراً' : 'Clôturer la position'}
                          >
                            {isArabic ? 'إغلاق' : 'Fermer'}
                          </button>
                        )}
                        {onDeleteTrade && item.status !== 'ACTIVE' && (
                          <button
                            onClick={() => onDeleteTrade(item.id)}
                            className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-lg transition opacity-0 group-hover:opacity-100"
                            title={isArabic ? 'حذف هذا السجل' : 'Supprimer'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
