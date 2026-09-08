import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TradeHistoryItem, Language } from '../types';
import { translations } from '../utils/translations';
import { Award, TrendingUp, TrendingDown, Target, Activity, Percent } from 'lucide-react';

interface TradeMetricsDashboardProps {
  history: TradeHistoryItem[];
  language: Language;
}

export const TradeMetricsDashboard: React.FC<TradeMetricsDashboardProps> = ({ history, language }) => {
  const isArabic = language === 'ar';

  const stats = useMemo(() => {
    const closedTrades = history.filter(t => t.status !== 'ACTIVE');
    const total = closedTrades.length;
    
    if (total === 0) return { winRate: 0, profitFactor: 0, avgRoi: 0, totalPnl: 0, wins: 0, losses: 0 };

    const wins = closedTrades.filter(t => t.profitPercent > 0);
    const losses = closedTrades.filter(t => t.profitPercent < 0);
    
    const winRate = (wins.length / total) * 100;
    
    const grossProfit = wins.reduce((acc, t) => acc + t.profitPercent, 0);
    const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.profitPercent, 0));
    
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
    
    const totalPnl = closedTrades.reduce((acc, t) => acc + t.profitPercent, 0);
    const avgRoi = totalPnl / total;

    return {
      winRate,
      profitFactor,
      avgRoi,
      totalPnl,
      wins: wins.length,
      losses: losses.length,
      total
    };
  }, [history]);

  const cards = [
    {
      id: 'winRate',
      title: isArabic ? 'معدل النجاح' : 'Win Rate',
      value: `${stats.winRate.toFixed(1)}%`,
      sub: isArabic ? `${stats.wins} ربح / ${stats.total} إجمالي` : `${stats.wins} Wins / ${stats.total} Total`,
      icon: Award,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20'
    },
    {
      id: 'profitFactor',
      title: isArabic ? 'عامل الربح' : 'Profit Factor',
      value: stats.profitFactor.toFixed(2),
      sub: isArabic ? 'إجمالي الربح / إجمالي الخسارة' : 'Gross Profit / Gross Loss',
      icon: Target,
      color: stats.profitFactor >= 1 ? 'text-emerald-400' : 'text-rose-400',
      bg: stats.profitFactor >= 1 ? 'bg-emerald-500/10' : 'bg-rose-500/10',
      border: stats.profitFactor >= 1 ? 'border-emerald-500/20' : 'border-rose-500/20'
    },
    {
      id: 'avgRoi',
      title: isArabic ? 'متوسط العائد' : 'Average ROI',
      value: `${stats.avgRoi > 0 ? '+' : ''}${stats.avgRoi.toFixed(2)}%`,
      sub: isArabic ? 'لكل صفقة مغلقة' : 'Per closed trade',
      icon: Activity,
      color: stats.avgRoi >= 0 ? 'text-brand-400' : 'text-rose-400',
      bg: stats.avgRoi >= 0 ? 'bg-brand-500/10' : 'bg-rose-500/10',
      border: stats.avgRoi >= 0 ? 'border-brand-500/20' : 'border-rose-500/20'
    },
    {
      id: 'totalPnl',
      title: isArabic ? 'صافي الأرباح' : 'Net P&L',
      value: `${stats.totalPnl > 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}%`,
      sub: isArabic ? 'التراكمي' : 'Cumulative Return',
      icon: TrendingUp,
      color: stats.totalPnl >= 0 ? 'text-cyan-400' : 'text-rose-400',
      bg: stats.totalPnl >= 0 ? 'bg-cyan-500/10' : 'bg-rose-500/10',
      border: stats.totalPnl >= 0 ? 'border-cyan-500/20' : 'border-rose-500/20'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <AnimatePresence mode="popLayout">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              layout
              key={card.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, delay: i * 0.1, type: "spring", bounce: 0.4 }}
              className={`relative overflow-hidden rounded-2xl border ${card.border} bg-slate-900/50 p-4 shadow-lg `}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">{card.title}</p>
                  <h4 className={`text-2xl font-black font-mono tracking-tight ${card.color}`}>
                    {card.value}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium uppercase tracking-wider">{card.sub}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${card.bg} ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
