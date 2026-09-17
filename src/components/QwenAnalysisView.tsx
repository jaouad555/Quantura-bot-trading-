import React, { useState } from 'react';
import { AIAnalysisResult, MarketDataResponse, Language } from '../types';
import { translations } from '../utils/translations';
import { formatCoinPrice } from '../utils/tradingPairs';
import {
  Sparkles,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Cpu,
  Zap,
  ShieldAlert,
  Compass,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  BarChart2,
  Sliders,
  AlertTriangle,
  Award,
  BookOpen,
  PieChart,
  Eye,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

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
  const [copied, setCopied] = useState(false);
  const [selectedLangTab, setSelectedLangTab] = useState<Language>(language);
  const [activeSubSection, setActiveSubSection] = useState<'SUMMARY' | 'INDICATORS' | 'PLAYBOOK'>('SUMMARY');

  if (!analysis || !marketData) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-3 animate-pulse">
          <Sparkles className="w-6 h-6 text-cyan-400" />
        </div>
        <h3 className="text-white font-bold text-base mb-1">
          {isArabic ? 'بانتظار تشغيل التحليل الكمي...' : 'Rapport d\'Analyse en Attente...'}
        </h3>
        <p className="text-xs text-slate-500">
          {isArabic ? 'قم بتحديث الإشارة من التبويب الرئيسي لتوليد تقرير الذكاء الاصطناعي والمحرك الكمي' : 'Lancez une analyse depuis le terminal pour générer le rapport institutionnel complet'}
        </p>
      </div>
    );
  }

  const { indicators, orderBook, mtfConfluence, marketRegime, ticker } = marketData;
  const currentSymbol = ticker?.symbol || 'BTCUSDT';
  const currentPrice = analysis.currentPrice || ticker?.price || 0;

  // Selected language text with fallbacks
  const detailedText =
    analysis.detailedAnalysis?.[selectedLangTab] ||
    analysis.detailedAnalysis?.fr ||
    analysis.detailedAnalysis?.en ||
    (isArabic ? 'تم حساب التقرير الكمي بنجاح وفق استراتيجيات SMC والزخم.' : 'Rapport quantitatif calculé avec succès selon les stratégies institutionnelles.');

  const isBullish = analysis.decision === 'LONG';
  const isBearish = analysis.decision === 'SHORT';

  // Copy report handler
  const handleCopyReport = () => {
    const reportStr = `=== QUANTURA QUANTITATIVE REPORT [${currentSymbol}] ===
Decision: ${analysis.decision} | Bias: ${analysis.bias} | Confidence: ${analysis.confidence}% | Grade: ${analysis.entryQuality?.grade || 'A'}
Current Price: $${formatCoinPrice(currentPrice, currentSymbol)}
Entry Zone: $${formatCoinPrice(analysis.entryZone?.min, currentSymbol)} - $${formatCoinPrice(analysis.entryZone?.max, currentSymbol)} (Ideal: $${formatCoinPrice(analysis.entryZone?.ideal, currentSymbol)})
TP1: $${formatCoinPrice(analysis.targets?.tp1, currentSymbol)} | TP2: $${formatCoinPrice(analysis.targets?.tp2, currentSymbol)} | TP3: $${formatCoinPrice(analysis.targets?.tp3, currentSymbol)}
Stop Loss: $${formatCoinPrice(analysis.stopLoss, currentSymbol)} (R/R: ${analysis.riskRewardRatio || '2.5'}x)
Regime: ${analysis.marketRegime}
Invalidation: ${analysis.invalidation?.reason || 'Loss of structural pivot'}

Key Factors:
${(analysis.keyFactors || []).map((f) => `- ${f}`).join('\n')}

Detailed Thesis:
${detailedText}
`;
    navigator.clipboard.writeText(reportStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getConfluenceBadge = (val: 'BULLISH' | 'BEARISH' | 'NEUTRAL') => {
    if (val === 'BULLISH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono">
          <ArrowUpRight className="w-3 h-3" /> {isArabic ? 'صعود 🟢' : 'Bull 🟢'}
        </span>
      );
    } else if (val === 'BEARISH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold font-mono">
          <ArrowDownRight className="w-3 h-3" /> {isArabic ? 'هبوط 🔴' : 'Bear 🔴'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold font-mono">
        {isArabic ? 'محايد ⚪' : 'Neutre ⚪'}
      </span>
    );
  };

  // Quant score breakdown items
  const breakdown = analysis.quantScore?.breakdown || {
    trend: 75,
    marketStructure: 80,
    momentum: 70,
    volume: 65,
    volatility: 60,
    supportResistance: 85,
    mtfConfluence: 80,
    orderBook: 70,
    derivatives: 75,
  };

  return (
    <div className={`space-y-5 ${isArabic ? 'rtl text-right' : 'ltr'}`}>
      {/* 1. EXECUTIVE INSTITUTIONAL HEADER */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border shadow-lg ${
              isBullish
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-emerald-500/10'
                : isBearish
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-rose-500/10'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-amber-500/10'
            }`}>
              {isBullish ? <TrendingUp className="w-6 h-6" /> : isBearish ? <TrendingDown className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {isArabic ? `تقرير التحليل الكمي والمؤسسي (${currentSymbol})` : `Rapport d'Intelligence Quantitatif & SMC (${currentSymbol})`}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                  QUANTURA AI v2.5
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isArabic 
                  ? `السعر اللحظي: $${formatCoinPrice(currentPrice, currentSymbol)} • ثقة النموذج: ${analysis.confidence}% • نظام السوق: ${analysis.marketRegime}`
                  : `Prix: $${formatCoinPrice(currentPrice, currentSymbol)} • Indice de Confiance: ${analysis.confidence}% • Régime: ${analysis.marketRegime}`}
              </p>
            </div>
          </div>

          {/* Top Actions: Copy & Section Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Lang switcher */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['ar', 'fr', 'en'] as Language[]).map((langKey) => (
                <button
                  key={langKey}
                  onClick={() => setSelectedLangTab(langKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    selectedLangTab === langKey
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {langKey.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold transition-all shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{copied ? (isArabic ? 'تم النسخ!' : 'Copié !') : (isArabic ? 'نسخ التقرير' : 'Copier')}</span>
            </button>
          </div>
        </div>

        {/* 4 Essential Quantitative Key Pillars */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs font-mono">
          {/* Pillar 1: Decision & Bias */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
              {isArabic ? 'القرار والاتجاه' : 'Décision & Biais'}
            </span>
            <div className={`text-base font-bold flex items-center gap-1.5 ${
              isBullish ? 'text-emerald-400' : isBearish ? 'text-rose-400' : 'text-amber-400'
            }`}>
              <span>{analysis.decision}</span>
              <span className="text-xs text-slate-400">({analysis.bias})</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Grade {analysis.entryQuality?.grade || 'A'} ({analysis.entryQuality?.score || 85}/100)
            </span>
          </div>

          {/* Pillar 2: Risk / Reward */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
              {isArabic ? 'نسبة العائد / المخاطرة (R:R)' : 'Ratio Risque / Rendement'}
            </span>
            <div className="text-base font-bold text-cyan-400">
              {analysis.riskRewardRatio ? `1 : ${analysis.riskRewardRatio.toFixed(2)}` : '1 : 2.50'}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              SL: ${formatCoinPrice(analysis.stopLoss, currentSymbol)}
            </span>
          </div>

          {/* Pillar 3: Execution Timeframe */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
              {isArabic ? 'نافذة التداول المثالية' : 'Fenêtre & Horizon'}
            </span>
            <div className="text-base font-bold text-white">
              {analysis.recommendedTimeframe || '1h'} • {analysis.tradeType || 'SWING'}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {analysis.timing?.expectedDuration || '4h - 24h'}
            </span>
          </div>

          {/* Pillar 4: Confluence Score */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
              {isArabic ? 'قوة التوافق الكمي' : 'Score de Confluence'}
            </span>
            <div className="text-base font-bold text-emerald-400 flex items-center justify-between">
              <span>{analysis.confidence}%</span>
              <span className="text-[10px] font-normal text-slate-400">
                {analysis.confidence >= 75 ? (isArabic ? 'عالي جداً' : 'Très Élevé') : (isArabic ? 'متوسط' : 'Modéré')}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full rounded-full"
                style={{ width: `${analysis.confidence}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SUB-SECTION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubSection('SUMMARY')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeSubSection === 'SUMMARY'
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{isArabic ? 'الأطروحة والسيناريوهات' : 'Thèse & Scénarios'}</span>
        </button>
        <button
          onClick={() => setActiveSubSection('INDICATORS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeSubSection === 'INDICATORS'
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{isArabic ? 'المصفوفة الفنية و MTF' : 'Matrice Technique & MTF'}</span>
        </button>
        <button
          onClick={() => setActiveSubSection('PLAYBOOK')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            activeSubSection === 'PLAYBOOK'
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>{isArabic ? 'دليل التنفيذ (Playbook)' : 'Guide d\'Exécution'}</span>
        </button>
      </div>

      {/* SECTION 1: SUMMARY & SCENARIOS */}
      {activeSubSection === 'SUMMARY' && (
        <div className="space-y-5">
          {/* Deep AI Rationale Box */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">
                  {isArabic ? 'الأطروحة التحليلية المؤسسية المفصلة' : 'Thèse Analytique & Justification Algorithmique'}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {selectedLangTab.toUpperCase()} View
              </span>
            </div>

            <div className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
              {detailedText}
            </div>

            {/* Key Catalysts / Factors */}
            {analysis.keyFactors && analysis.keyFactors.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
                  {isArabic ? 'العوامل الإيجابية والسلبية الرئيسية المرصودة:' : 'Facteurs Clés & Confluences Détectés:'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {analysis.keyFactors.map((factor, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{factor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Primary Roadmap vs Alternative Invalidation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Primary Roadmap */}
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Target className="w-4 h-4" />
                <span>{isArabic ? 'السيناريو الرئيسي المرجح' : 'Scénario Principal'}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                {analysis.scenarios?.primary || (isArabic ? 'متابعة الاتجاه نحو مستويات جني الأرباح مع الالتزام التام بنقاط وقف الخسارة.' : 'Poursuite de l\'impulsion haussière vers les cibles TP1/TP2.')}
              </p>

              {/* Targets List */}
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">TP1 (Sécurisation 50%):</span>
                  <span className="text-emerald-400 font-bold">${formatCoinPrice(analysis.targets?.tp1, currentSymbol)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">TP2 (Objectif Principal):</span>
                  <span className="text-emerald-400 font-bold">${formatCoinPrice(analysis.targets?.tp2, currentSymbol)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">TP3 (Macro Runner):</span>
                  <span className="text-emerald-400 font-bold">${formatCoinPrice(analysis.targets?.tp3, currentSymbol)}</span>
                </div>
              </div>
            </div>

            {/* Alternative & Invalidation Roadmap */}
            <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>{isArabic ? 'شروط إلغاء الصفقة (Invalidation)' : 'Conditions d\'Invalidation'}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                {analysis.invalidation?.reason || (isArabic ? 'إغلاق شمعة أسفل قاع الهيكل الحالي يلغي الاتجاه الإيجابي فوراً.' : 'Une clôture sous le niveau d\'invalidation structurel annule le plan.')}
              </p>

              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-rose-500/20">
                  <span className="text-slate-400">{isArabic ? 'وقف الخسارة الصارم (SL):' : 'Stop Loss Rigide (SL):'}</span>
                  <span className="text-rose-400 font-bold">${formatCoinPrice(analysis.stopLoss, currentSymbol)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">{isArabic ? 'إلغاء الشراء أسفل:' : 'Invalidation Long Sous:'}</span>
                  <span className="text-slate-300 font-bold">${formatCoinPrice(analysis.invalidation?.longInvalidBelow || analysis.stopLoss, currentSymbol)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">{isArabic ? 'إلغاء البيع أعلى:' : 'Invalidation Short Au-dessus:'}</span>
                  <span className="text-slate-300 font-bold">${formatCoinPrice(analysis.invalidation?.shortInvalidAbove, currentSymbol)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: TECHNICAL INDICATORS & MTF MATRIX */}
      {activeSubSection === 'INDICATORS' && indicators && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: 9-Factor Quant Scorecard (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">
                  {isArabic ? 'مصفوفة الدرجات الكمية (9 ركائز)' : 'Scorecard Quantitatif (9 Facteurs)'}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 font-bold">100% Weighted</span>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              {[
                { label: isArabic ? 'اتجاه المتوسطات (Trend EMA)' : 'Tendance EMA (20%)', val: breakdown.trend },
                { label: isArabic ? 'هيكل السوق المؤسسي (SMC)' : 'Structure SMC (20%)', val: breakdown.marketStructure },
                { label: isArabic ? 'الزخم (RSI & MACD)' : 'Momentum (15%)', val: breakdown.momentum },
                { label: isArabic ? 'الحجم والسيولة (VWAP)' : 'Volume & VWAP (10%)', val: breakdown.volume },
                { label: isArabic ? 'التقلبات ومؤشر ATR' : 'Volatilité ADX/ATR (10%)', val: breakdown.volatility },
                { label: isArabic ? 'الدعوم والمقاومات' : 'Supports & Résistances (10%)', val: breakdown.supportResistance },
                { label: isArabic ? 'تطابق الفريمات (MTF)' : 'Confluence MTF (5%)', val: breakdown.mtfConfluence },
                { label: isArabic ? 'دفتر الطلبات (Orderbook)' : 'Pression Carnet (5%)', val: breakdown.orderBook },
                { label: isArabic ? 'المشتقات و Funding' : 'Données Dérivés (5%)', val: breakdown.derivatives },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">{item.label}</span>
                    <span className={`font-bold ${item.val >= 70 ? 'text-emerald-400' : item.val <= 40 ? 'text-rose-400' : 'text-amber-400'}`}>
                      {item.val}/100
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.val >= 70 ? 'bg-emerald-400' : item.val <= 40 ? 'bg-rose-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, item.val))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Live Indicators & MTF Confluence (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Live Indicators Deep Dive */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider pb-1 border-b border-slate-800">
                <Activity className="w-4 h-4" />
                <span>{isArabic ? 'المؤشرات الفنية اللحظية' : 'Indicateurs Techniques Directs'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                {/* RSI Gauge */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>RSI (14)</span>
                    <span className={`font-bold ${indicators.rsi14 > 70 ? 'text-rose-400' : indicators.rsi14 < 30 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                      {indicators.rsi14}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, indicators.rsi14))}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {indicators.rsi14 > 70 ? 'Zone Surachetée (Prudence)' : indicators.rsi14 < 30 ? 'Zone Survendu (Rebond Possible)' : 'Zone d\'Équilibre'}
                  </span>
                </div>

                {/* MACD */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>MACD Histogram</span>
                    <span className={`font-bold ${indicators.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {indicators.macd.histogram}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Ligne: {indicators.macd.macdLine} | Signal: {indicators.macd.signalLine}
                  </span>
                </div>

                {/* EMAs */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 sm:col-span-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">EMA 20</span>
                    <span className="text-white font-bold">${formatCoinPrice(indicators.ema20, currentSymbol)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">EMA 50</span>
                    <span className="text-white font-bold">${formatCoinPrice(indicators.ema50, currentSymbol)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">EMA 200</span>
                    <span className="text-white font-bold">${formatCoinPrice(indicators.ema200, currentSymbol)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MTF Matrix Card */}
            {mtfConfluence && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                      {isArabic ? 'توافق الفريمات المتعددة (MTF Alignment)' : 'Alignement Multi-Timeframes'}
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {mtfConfluence.alignmentPercent}% {isArabic ? 'تطابق' : 'Aligné'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                  {Object.entries(mtfConfluence.timeframes || {}).map(([tf, item]: [string, any]) => (
                    <div key={tf} className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 uppercase font-bold text-[11px]">{tf}</span>
                      {getConfluenceBadge(item.bias)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: STRATEGY EXECUTION PLAYBOOK */}
      {activeSubSection === 'PLAYBOOK' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Scalper Profile */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Zap className="w-4 h-4" />
              <span>{isArabic ? 'خطة المضاربة السريعة (Scalping)' : 'Profil Scalper (1m - 15m)'}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              {isArabic 
                ? 'استهدف مستويات TP1 فقط مع تأمين الوقف فوراً عند تحقيق 0.5R لتجنب الارتدادات السريعة.'
                : 'Sécurisez 70% de la position sur TP1. Déplacez le Stop Loss au Breakeven dès le franchissement de la première résistance.'}
            </p>
            <div className="text-[11px] font-mono text-slate-400 space-y-1">
              <div>• Levier recommandé: <strong>3x - 5x max</strong></div>
              <div>• Horizon de temps: <strong>15m à 2h</strong></div>
            </div>
          </div>

          {/* Day Trader Profile */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Target className="w-4 h-4" />
              <span>{isArabic ? 'خطة التداول اليومي (Day Trading)' : 'Profil Day Trader (15m - 1h)'}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              {isArabic
                ? 'اترك 40% من العقد للوصول إلى TP2 مع تحريك الوقف التدريجي (Trailing Stop) أسفل قيعان 15 دقيقة.'
                : 'Visez TP1 et TP2. Laissez courir le solde avec un Trailing Stop calculé sur l\'EMA 20 du 1h.'}
            </p>
            <div className="text-[11px] font-mono text-slate-400 space-y-1">
              <div>• Levier recommandé: <strong>2x - 3x</strong></div>
              <div>• Horizon de temps: <strong>4h à 24h</strong></div>
            </div>
          </div>

          {/* Swing Trader Profile */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
              <Compass className="w-4 h-4" />
              <span>{isArabic ? 'خطة التداول المتأرجح (Swing)' : 'Profil Swing Trader (4h - 1d)'}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              {isArabic
                ? 'استهدف TP3 لاقتناص كامل الاتجاه الأسبوعي، مع الحفاظ على مخاطرة لا تتجاوز 1% من رأس المال.'
                : 'Conservez une partie pour TP3 afin de capter l\'impulsion macro hebdo complète avec un risque strict de 1%.'}
            </p>
            <div className="text-[11px] font-mono text-slate-400 space-y-1">
              <div>• Levier recommandé: <strong>1x - 2x (Spot / Low Lev)</strong></div>
              <div>• Horizon de temps: <strong>1 à 7 jours</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
