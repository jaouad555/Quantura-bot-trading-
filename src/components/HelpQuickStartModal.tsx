import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  Sparkles, 
  Target, 
  Bot, 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft, 
  Lightbulb, 
  HelpCircle, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Play, 
  Zap, 
  Key, 
  Bell, 
  ShieldCheck, 
  DollarSign, 
  Percent, 
  BarChart2, 
  Compass, 
  ChevronRight, 
  Check, 
  Info,
  Scale,
  Crosshair,
  Lock,
  ExternalLink,
  Flame,
  Activity,
  Cpu
} from 'lucide-react';
import { Language, APP_VERSION_TAG } from '../types';

interface HelpQuickStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onNavigateToTab?: (tab: string) => void;
  onOpenBinanceModal?: () => void;
  onOpenRiskModal?: () => void;
  onOpenSettingsModal?: () => void;
}

type GuideTab = 'quickStart' | 'aiSignals' | 'botSetup' | 'riskManagement' | 'faq';

export const HelpQuickStartModal: React.FC<HelpQuickStartModalProps> = ({
  isOpen,
  onClose,
  language,
  onNavigateToTab,
  onOpenBinanceModal,
  onOpenRiskModal,
  onOpenSettingsModal,
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('quickStart');
  const [interactiveSignalType, setInteractiveSignalType] = useState<'LONG' | 'SHORT'>('LONG');
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>('confidence');
  
  // Checklist progress state (saved locally)
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('quantura_checklist_progress');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      step1: true,
      step2: false,
      step3: false,
      step4: false,
      step5: false,
    };
  });

  const toggleStep = (stepKey: string) => {
    setCompletedSteps(prev => {
      const updated = { ...prev, [stepKey]: !prev[stepKey] };
      try {
        localStorage.setItem('quantura_checklist_progress', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  if (!isOpen) return null;

  const isArabic = language === 'ar';
  const isFrench = language === 'fr';

  const texts = {
    modalTitle: isArabic ? 'دليل البدء السريع & مركز المساعدة' : isFrench ? 'Guide de Démarrage Rapide & Aide' : 'Quick Start Guide & Help Center',
    modalSubtitle: isArabic ? 'تعلم كيفية قراءة الإشارات الذكية، تشغيل البوت وإدارة المخاطر باحترافية' : isFrench ? 'Apprenez à interpréter les signaux IA, configurer le bot et gérer le risque' : 'Learn how to interpret AI signals, configure the bot, and master risk management',
    tabs: {
      quickStart: isArabic ? 'البدء السريع (5 دقائق)' : isFrench ? 'Démarrage Rapide (5 min)' : 'Quick Start (5 min)',
      aiSignals: isArabic ? 'تفسير إشارات الذكاء' : isFrench ? 'Interprétation Signaux IA' : 'Interpreting AI Signals',
      botSetup: isArabic ? 'إعداد وتشغيل البوت' : isFrench ? 'Configuration du Bot' : 'Bot Setup & Execution',
      riskManagement: isArabic ? 'إدارة المخاطر والأمان' : isFrench ? 'Gestion du Risque' : 'Risk & Capital Rules',
      faq: isArabic ? 'أسئلة شائعة ونصائح' : isFrench ? 'FAQ & Bonnes Pratiques' : 'FAQ & Pro Tips',
    }
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 5) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`bg-slate-900 border border-slate-800/90 rounded-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden ${
          isArabic ? 'rtl text-right font-sans' : 'ltr text-left'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-slate-800/80 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/40 via-amber-500/30 to-emerald-500/40 rounded-2xl blur-xs opacity-75"></div>
              <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-950 border border-cyan-500/50 flex items-center justify-center shadow-lg">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>{texts.modalTitle}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                    {APP_VERSION_TAG}
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {texts.modalSubtitle}
              </p>
            </div>
          </div>

          <button
            id="btn-close-help-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 p-2 sm:px-4 bg-slate-950/40 border-b border-slate-800/60 overflow-x-auto no-scrollbar shrink-0">
          {(['quickStart', 'aiSignals', 'botSetup', 'riskManagement', 'faq'] as GuideTab[]).map((tabKey) => {
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 text-cyan-300 shadow-xs'
                    : 'bg-slate-900/60 hover:bg-slate-800/70 border border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{texts.tabs[tabKey]}</span>
                {tabKey === 'quickStart' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-200 font-mono font-bold">
                    {progressPercent}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-300 text-sm">

          {/* ========================================================================= */}
          {/* TAB 1: 5-MINUTE QUICK START CHECKLIST */}
          {/* ========================================================================= */}
          {activeTab === 'quickStart' && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              {/* Welcome Banner with Progress Bar */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-amber-950/20 border border-cyan-500/30 shadow-lg relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-mono uppercase font-bold text-amber-300 tracking-wider">
                        {isArabic ? 'خارطة طريق المتداول الجديد' : isFrench ? 'Feuille de Route Nouveau Trader' : 'New Trader Roadmap'}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      {isArabic ? 'ابدأ تداولك في 5 خطوات آمنة ومدروسة' : isFrench ? 'Démarrez en 5 étapes simples et sécurisées' : 'Start Trading in 5 Safe & Simple Steps'}
                    </h3>
                    <p className="text-xs text-slate-300">
                      {isArabic 
                        ? 'اتبع هذه القائمة للتأكد من فهمك للنظام وتفعيل حسابك بأعلى درجات الأمان وحماية رأس المال.'
                        : isFrench
                        ? 'Suivez cette liste pour maîtriser la plateforme et sécuriser vos premiers pas sans risque.'
                        : 'Follow this checklist to master the platform and safely set up your quantitative trading environment.'}
                    </p>
                  </div>

                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center min-w-[120px] shrink-0">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      {isArabic ? 'نسبة الإنجاز' : isFrench ? 'Progression' : 'Progress'}
                    </div>
                    <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">
                      {completedCount} / 5
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Checklist Items */}
              <div className="space-y-3">
                {[
                  {
                    id: 'step1',
                    num: '1',
                    title: isArabic ? 'استكشاف إشارات الذكاء الاصطناعي (Terminal & Signals)' : isFrench ? 'Explorer les Signaux Quantitatifs' : 'Explore AI Signals & Market Terminal',
                    desc: isArabic 
                      ? 'تفقد شاشة الإشارة الرئيسية. راقب نسبة الثقة (Confidence %)، وسعر الدخول المثالي (Entry Zone)، ومستويات الأهداف الثلاثة (TP1 / TP2 / TP3).'
                      : isFrench
                      ? 'Consultez l’onglet Signal. Observez le score de confiance %, la zone d’entrée et les 3 objectifs (TP1, TP2, TP3).'
                      : 'Review the main Signal tab. Check confidence scores, entry zones, and the 3 tiered targets (TP1, TP2, TP3).',
                    actionLabel: isArabic ? 'الانتقال إلى الإشارات' : isFrench ? 'Voir les Signaux' : 'Go to Signals',
                    actionTab: 'signal',
                  },
                  {
                    id: 'step2',
                    num: '2',
                    title: isArabic ? 'البدء بوضع التداول الافتراضي (Paper Trading Mode)' : isFrench ? 'Tester avec le Paper Trading (Sans Risque)' : 'Practice with Paper Trading Mode',
                    desc: isArabic
                      ? 'ابدأ دائماً بمحفظة الـ Paper Trading الافتراضية ($10,000 USDT). تتيح لك مراقبة كفاءة الصفقات وتجربة البوت بأمان كامل دون المخاطرة بأموال حقيقية.'
                      : isFrench
                      ? 'Activez le mode Paper Trading avec 10 000$ USDT virtuels pour tester les stratégies en conditions réelles sans risquer de capital.'
                      : 'Always start with the $10,000 USDT Paper Trading wallet to observe bot performance in live conditions with zero financial risk.',
                    actionLabel: isArabic ? 'فتح البوت الافتراضي' : isFrench ? 'Ouvrir le Bot' : 'Open Bot Engine',
                    actionTab: 'autoBot',
                  },
                  {
                    id: 'step3',
                    num: '3',
                    title: isArabic ? 'اختيار استراتيجية التداول المناسبة (Strategy Presets)' : isFrench ? 'Sélectionner vos Stratégies Préférées' : 'Choose Your Strategy Presets',
                    desc: isArabic
                      ? 'فعل استراتيجية HFT Scalper للصفقات السريعة الخاطفة، أو استراتيجية Momentum لموجات الكسر القوية، أو استراتيجية Institutional SMC لمناطق السيولة.'
                      : isFrench
                      ? 'Activez HFT Scalper pour le scalping rapide, Momentum pour les cassures de tendance, ou Institutional SMC pour les Order Blocks.'
                      : 'Toggle HFT Scalper for rapid micro-scalps, Momentum for 15m trend breakouts, or Institutional SMC for Order Blocks.',
                    actionLabel: isArabic ? 'إعداد الاستراتيجيات' : isFrench ? 'Gérer Stratégies' : 'Manage Strategies',
                    actionTab: 'autoBot',
                  },
                  {
                    id: 'step4',
                    num: '4',
                    title: isArabic ? 'ضبط حدود الرافعة وإدارة المخاطر (Risk Parameters)' : isFrench ? 'Définir les Limites de Risque & Levier' : 'Set Risk Limits & Max Leverage',
                    desc: isArabic
                      ? 'اضبط الرافعة المالية بين 2x إلى 5x كحد أقصى للمبتدئين، وتأكد من تفعيل خاصية Breakeven Lock التي تحول وقف الخسارة إلى نقطة الدخول بمجرد تحقيق TP1.'
                      : isFrench
                      ? 'Réglez le levier entre 2x et 5x pour commencer et vérifiez l’activation du Breakeven automatique dès l’atteinte de TP1.'
                      : 'Set leverage to 2x-5x max for safety and ensure auto-breakeven locking is active to make trades risk-free after TP1.',
                    actionLabel: isArabic ? 'حاسبة المخاطر' : isFrench ? 'Calculateur Risque' : 'Risk Calculator',
                    actionTab: 'riskWallet',
                    isRiskAction: true,
                  },
                  {
                    id: 'step5',
                    num: '5',
                    title: isArabic ? 'تفعيل تنبيهات Telegram الفورية (Instant Mobile Alerts)' : isFrench ? 'Configurer les Alertes Telegram Mobiles' : 'Configure Instant Telegram Push Alerts',
                    desc: isArabic
                      ? 'أدخل توكن بوت التليجرام و Chat ID في الإعدادات لتستقبل إشعارات فورية على هاتفك عند فتح أي صفقة أو تحقيق الأهداف أو إغلاق الأرباح.'
                      : isFrench
                      ? 'Renseignez votre Bot Token et Chat ID Telegram dans les paramètres pour recevoir instantanément chaque entrée et sortie de trade sur mobile.'
                      : 'Enter your Telegram Bot Token & Chat ID in Settings to receive instant notifications whenever a trade opens or hits TP/SL.',
                    actionLabel: isArabic ? 'فتح الإعدادات' : isFrench ? 'Ouvrir Paramètres' : 'Open Settings',
                    isSettingsAction: true,
                  },
                ].map((item) => {
                  const isDone = completedSteps[item.id];
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDone
                          ? 'bg-slate-900/80 border-emerald-500/40 shadow-xs'
                          : 'bg-slate-900/40 hover:bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleStep(item.id)}
                          className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer ${
                            isDone
                              ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                          }`}
                          title={isDone ? 'Mark as incomplete' : 'Mark as completed'}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <span className="text-xs font-mono font-bold">{item.num}</span>}
                        </button>
                        <div className="space-y-1">
                          <h4 className={`text-sm font-bold ${isDone ? 'text-emerald-300 line-through decoration-emerald-500/50' : 'text-slate-100'}`}>
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {item.isRiskAction ? (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenRiskModal ? onOpenRiskModal() : onNavigateToTab?.('riskWallet');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                          </button>
                        ) : item.isSettingsAction ? (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenSettingsModal?.();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              item.actionTab && onNavigateToTab?.(item.actionTab);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
                          >
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Navigation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('aiSignals')}
                  className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-cyan-500/40 transition text-left rtl:text-right group cursor-pointer"
                >
                  <Target className="w-5 h-5 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="font-bold text-xs text-white group-hover:text-cyan-300">
                    {isArabic ? 'كيف تقرأ الإشارات؟' : isFrench ? 'Comment lire les Signaux ?' : 'How to Read Signals?'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {isArabic ? 'شرح نسب الثقة والأهداف' : isFrench ? 'Explication de la confiance & cibles' : 'Confidence & target zones'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('botSetup')}
                  className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition text-left rtl:text-right group cursor-pointer"
                >
                  <Bot className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="font-bold text-xs text-white group-hover:text-emerald-300">
                    {isArabic ? 'دليل إعداد البوت' : isFrench ? 'Guide Config Bot' : 'Bot Engine Guide'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {isArabic ? 'شرح الاستراتيجيات والرافعة' : isFrench ? 'Stratégies & Effet de Levier' : 'Presets & leverage rules'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('riskManagement')}
                  className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-amber-500/40 transition text-left rtl:text-right group cursor-pointer"
                >
                  <Shield className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="font-bold text-xs text-white group-hover:text-amber-300">
                    {isArabic ? 'قواعد الأمان وحماية الحساب' : isFrench ? 'Règles de Protection' : 'Capital Protection Rules'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {isArabic ? 'قاعدة 1-2% ووقف الخسارة' : isFrench ? 'Règle des 1-2% & Stop Loss' : '1-2% rule & circuit breaker'}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: INTERPRETING AI SIGNALS */}
          {/* ========================================================================= */}
          {activeTab === 'aiSignals' && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-cyan-400" />
                    <span>{isArabic ? 'تشريح بطاقة الإشارة الذكية (Interactive Signal Anatomy)' : isFrench ? 'Anatomie d’un Signal Quantitatif' : 'Anatomy of an AI Signal Card'}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isArabic 
                      ? 'اضغط على أي جزء من الإشارة التفاعلية أدناه لمعرفة وظيفته وكيفية استخدامه في صفقاتك.'
                      : isFrench
                      ? 'Cliquez sur n’importe quel élément ci-dessous pour découvrir sa signification.'
                      : 'Click on any hotspot on the interactive signal card below to learn what it means.'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setInteractiveSignalType('LONG')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      interactiveSignalType === 'LONG'
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    LONG
                  </button>
                  <button
                    type="button"
                    onClick={() => setInteractiveSignalType('SHORT')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      interactiveSignalType === 'SHORT'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    SHORT
                  </button>
                </div>
              </div>

              {/* Interactive Signal Mockup */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left / Top: Interactive Card */}
                <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-white">BTC/USDT</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold">15m</span>
                    </div>

                    {/* Hotspot 1: Decision Badge */}
                    <button
                      type="button"
                      onClick={() => setSelectedHotspot('decision')}
                      className={`px-3 py-1 rounded-xl text-xs font-black font-mono transition-all flex items-center gap-1.5 cursor-pointer ring-2 ${
                        selectedHotspot === 'decision' ? 'ring-cyan-400 scale-105' : 'ring-transparent'
                      } ${
                        interactiveSignalType === 'LONG'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                      }`}
                    >
                      {interactiveSignalType === 'LONG' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{interactiveSignalType === 'LONG' ? 'ACHAT (LONG)' : 'VENTE (SHORT)'}</span>
                    </button>
                  </div>

                  {/* Hotspot 2: Confidence Bar */}
                  <button
                    type="button"
                    onClick={() => setSelectedHotspot('confidence')}
                    className={`w-full text-left rtl:text-right p-2.5 rounded-xl transition-all border cursor-pointer ${
                      selectedHotspot === 'confidence'
                        ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        {isArabic ? 'درجة الثقة الكمية (Confidence Score)' : 'Score de Confiance Quantitatif'}
                      </span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">88.5% (Grade A+)</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full w-[88.5%] rounded-full" />
                    </div>
                  </button>

                  {/* Hotspot 3: Entry Zone */}
                  <button
                    type="button"
                    onClick={() => setSelectedHotspot('entry')}
                    className={`w-full text-left rtl:text-right p-2.5 rounded-xl transition-all border cursor-pointer ${
                      selectedHotspot === 'entry'
                        ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80'
                    }`}
                  >
                    <div className="text-[11px] text-slate-400 uppercase font-mono flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                        {isArabic ? 'نطاق الدخول المثالي (Entry Zone)' : 'Zone d’Entrée Idéale'}
                      </span>
                      <span className="text-amber-300 font-bold">$68,200.00</span>
                    </div>
                    <div className="text-xs font-mono text-slate-200 mt-1">
                      Ideal: <span className="text-amber-400 font-bold">$68,200</span> | Max Slippage Limit: $68,350
                    </div>
                  </button>

                  {/* Hotspot 4: Targets (TP1, TP2, TP3) */}
                  <button
                    type="button"
                    onClick={() => setSelectedHotspot('targets')}
                    className={`w-full text-left rtl:text-right p-2.5 rounded-xl transition-all border cursor-pointer ${
                      selectedHotspot === 'targets'
                        ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80'
                    }`}
                  >
                    <div className="text-[11px] text-slate-400 uppercase font-mono mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Target className="w-3.5 h-3.5 text-emerald-400" />
                        {isArabic ? 'الأهداف الثلاثة المتدرجة (TP1 / TP2 / TP3)' : 'Objectifs Progressifs'}
                      </span>
                      <span className="text-emerald-400 font-bold text-[10px]">Ratio R:R 1:2.8</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
                      <div className="p-1.5 rounded bg-slate-950 border border-emerald-500/30 text-emerald-300 text-center">
                        <div className="text-[9px] text-slate-500">TP1 (50%)</div>
                        <div>$69,300</div>
                      </div>
                      <div className="p-1.5 rounded bg-slate-950 border border-emerald-500/30 text-emerald-300 text-center">
                        <div className="text-[9px] text-slate-500">TP2 (25%)</div>
                        <div>$70,500</div>
                      </div>
                      <div className="p-1.5 rounded bg-slate-950 border border-emerald-500/30 text-emerald-300 text-center">
                        <div className="text-[9px] text-slate-500">TP3 (Moon)</div>
                        <div>$72,400</div>
                      </div>
                    </div>
                  </button>

                  {/* Hotspot 5: Stop Loss */}
                  <button
                    type="button"
                    onClick={() => setSelectedHotspot('stopLoss')}
                    className={`w-full text-left rtl:text-right p-2.5 rounded-xl transition-all border cursor-pointer ${
                      selectedHotspot === 'stopLoss'
                        ? 'bg-rose-950/40 border-rose-500 shadow-md ring-1 ring-rose-500/50'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80'
                    }`}
                  >
                    <div className="text-[11px] text-rose-400 uppercase font-mono flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-rose-400" />
                        {isArabic ? 'وقف الخسارة ومستوى الإلغاء (Stop Loss)' : 'Stop Loss & Invalidation'}
                      </span>
                      <span className="font-bold">$67,400.00 (-1.17%)</span>
                    </div>
                  </button>

                  {/* Hotspot 6: SMC Confluence */}
                  <button
                    type="button"
                    onClick={() => setSelectedHotspot('smc')}
                    className={`w-full text-left rtl:text-right p-2.5 rounded-xl transition-all border cursor-pointer ${
                      selectedHotspot === 'smc'
                        ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80'
                    }`}
                  >
                    <div className="text-[11px] text-cyan-400 uppercase font-mono flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-cyan-400" />
                        {isArabic ? 'تأكيدات السيولة ومناطق المؤسسات (SMC)' : 'Confluences Institutionnelles SMC'}
                      </span>
                      <span className="text-[10px] text-slate-400">Bullish Order Block + FVG Mitigated</span>
                    </div>
                  </button>
                </div>

                {/* Right / Bottom: Dynamic Explainer Details */}
                <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-5 h-5 text-cyan-400 shrink-0" />
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                        {selectedHotspot === 'confidence' && (isArabic ? 'درجة الثقة ونسب النجاح' : 'Score de Confiance & Probabilité')}
                        {selectedHotspot === 'decision' && (isArabic ? 'اتجاه الصفقة والقرار' : 'Décision & Direction du Marché')}
                        {selectedHotspot === 'entry' && (isArabic ? 'نقطة الدخول والانزلاق السعري' : 'Zone d’Entrée & Slippage')}
                        {selectedHotspot === 'targets' && (isArabic ? 'الأهداف المتدرجة وجني الأرباح' : 'Cibles Multi-Paliers & Prise de Profit')}
                        {selectedHotspot === 'stopLoss' && (isArabic ? 'وقف الخسارة وحماية الحساب' : 'Stop Loss & Invalidation Structurelle')}
                        {selectedHotspot === 'smc' && (isArabic ? 'المفاهيم المؤسسية (Order Blocks & FVG)' : 'Concepts Institutionnels SMC')}
                      </h4>
                    </div>

                    <div className="text-xs text-slate-300 leading-relaxed space-y-3">
                      {selectedHotspot === 'confidence' && (
                        <>
                          <p>
                            {isArabic 
                              ? 'يتم حساب درجة الثقة من خلال خوارزميات كمية متطورة تدمج حركة السعر (Price Action)، تدفق السيولة المؤسسية (Order Flow)، وحجم التداول اللحظي.'
                              : 'Le score de confiance est calculé par des modèles quantitatifs combinant le Price Action, le flux d’ordres institutionnel et la volatilité relative.'}
                          </p>
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                            <div className="text-emerald-400 flex items-center justify-between">
                              <span>80% - 100% (Grade A+)</span>
                              <span className="text-[10px] text-slate-400">{isArabic ? 'أقوى الصفقات' : 'Très Haute Probabilité'}</span>
                            </div>
                            <div className="text-amber-400 flex items-center justify-between">
                              <span>65% - 79% (Grade B)</span>
                              <span className="text-[10px] text-slate-400">{isArabic ? 'صفقات اتجاهية جيدة' : 'Tendance Solide'}</span>
                            </div>
                            <div className="text-slate-400 flex items-center justify-between">
                              <span>&lt; 65% (Grade C/D)</span>
                              <span className="text-[10px] text-slate-500">{isArabic ? 'تجنب الدخول / انتظار' : 'Marché Neutre / Attente'}</span>
                            </div>
                          </div>
                        </>
                      )}

                      {selectedHotspot === 'decision' && (
                        <>
                          <p>
                            {isArabic 
                              ? 'يوضح الاتجاه المؤكد للصفقة. LONG تعني المراهنة على صعود السعر، و SHORT تعني الاستفادة من هبوط السعر (في العقود الآجلة Futures).'
                              : 'Indique la direction validée par le modèle. LONG pour acheter à la hausse, SHORT pour vendre à la baisse (Marché Futures USDT-M).'}
                          </p>
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                            {isArabic 
                              ? 'لا تدخل أي صفقة إذا كانت الإشارة NO_TRADE أو WAIT حتى تتكون شمعة تأكيد جديدة.'
                              : 'N’entrez jamais sur un statut WAIT ou NO_TRADE avant confirmation algorithmique.'}
                          </div>
                        </>
                      )}

                      {selectedHotspot === 'entry' && (
                        <>
                          <p>
                            {isArabic 
                              ? 'سعر الدخول المثالي (Ideal Price) هو النقطة الأدق للدخول. لا تقم بالدخول إذا ابتعد السعر عن الحد المسموح لتجنب الإنزلاق (Slippage) والحفاظ على نسبة العائد للمخاطرة.'
                              : 'Le prix idéal est le point d’entrée optimal. Évitez d’entrer si le prix a dépassé la limite max de slippage recommandée.'}
                          </p>
                        </>
                      )}

                      {selectedHotspot === 'targets' && (
                        <>
                          <p>
                            {isArabic 
                              ? 'نظام جني الأرباح الذكي مقسم إلى 3 مراحل لتأمين رأس المال وتعظيم المكاسب:'
                              : 'Le système de prise de profit est divisé en 3 tranches stratégiques :'}
                          </p>
                          <ul className="space-y-1.5 list-disc list-inside text-[11px]">
                            <li>
                              <strong className="text-emerald-400">TP1:</strong> {isArabic ? 'إغلاق 50% من العقد ونقل وقف الخسارة تلقائياً إلى سعر الدخول (Break-Even).' : 'Fermeture de 50% et déplacement du Stop Loss à Breakeven.'}
                            </li>
                            <li>
                              <strong className="text-emerald-400">TP2:</strong> {isArabic ? 'إغلاق 25% إضافية ونقل وقف الخسارة إلى مستوى TP1.' : 'Fermeture de 25% supplémentaire et sécurisation du Stop à TP1.'}
                            </li>
                            <li>
                              <strong className="text-emerald-400">TP3 (Moonbag):</strong> {isArabic ? 'ترك الـ 25% الأخيرة بركوب الموجة الكاملة عبر Trailing Stop.' : 'Les 25% restants profitent de l’extension maximale avec Trailing.'}
                            </li>
                          </ul>
                        </>
                      )}

                      {selectedHotspot === 'stopLoss' && (
                        <>
                          <p>
                            {isArabic 
                              ? 'مستوى وقف الخسارة الصارم. في حال كسر السعر لهذا المستوى، يتم إلغاء التحليل فوراً لحمايتك من الانعكاسات الكبيرة.'
                              : 'Niveau d’invalidation strict. Si le prix touche ce seuil, la structure est rompue et le trade est coupé immédiatement.'}
                          </p>
                          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px]">
                            {isArabic 
                              ? 'البوت الآلي يلتزم دائماً بوقف الخسارة ولا يتردد في الإغلاق لحماية 98% من رصيدك.'
                              : 'Le bot exécute rigoureusement le Stop Loss pour préserver votre capital disponible.'}
                          </div>
                        </>
                      )}

                      {selectedHotspot === 'smc' && (
                        <>
                          <p>
                            {isArabic 
                              ? 'مفاهيم التداول المؤسسي (Smart Money Concepts) ترصد أماكن تجمع أوامر الشراء والبيع للبنوك وصناع السوق الكبار.'
                              : 'Les concepts SMC (Smart Money Concepts) identifient les zones d’accumulation des institutions et banques.'}
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mt-2">
                            <div className="p-2 rounded bg-slate-950 border border-slate-800 text-cyan-300">
                              <strong>Order Block (OB):</strong> منطقة تجمع سيولة مؤسسية
                            </div>
                            <div className="p-2 rounded bg-slate-950 border border-slate-800 text-amber-300">
                              <strong>FVG Gap:</strong> فجوة سعرية غير متوازنة يتم ملؤها
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-500">{isArabic ? 'اضغط على عنصر آخر للاستكشاف' : 'Cliquez sur un autre élément'}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('botSetup')}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isArabic ? 'التالي: إعداد البوت' : 'Suivant : Configurer le Bot'}</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: TRADING BOT SETUP & STRATEGIES */}
          {/* ========================================================================= */}
          {activeTab === 'botSetup' && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-emerald-400" />
                  <span>{isArabic ? 'دليل إعداد وتشغيل محرك التداول الآلي (Bot Engine)' : isFrench ? 'Guide de Configuration du Moteur de Trading Automatique' : 'Automated Trading Bot Setup Guide'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isArabic 
                    ? 'تعرف على الفرق بين أوضاع التداول، وشرح الاستراتيجيات الست، وضبط الرافعة المالية بأمان.'
                    : isFrench
                    ? 'Découvrez les modes d’exécution, les 6 stratégies quantitatives et la gestion sécurisée du levier.'
                    : 'Understand execution modes, the 6 quantitative strategy presets, and safe leverage limits.'}
                </p>
              </div>

              {/* Execution Modes Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                        <FlaskConical className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-amber-300 font-mono">
                        PAPER TRADING (Simulé)
                      </h4>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                      {isArabic ? 'بدون مخاطرة' : 'Zéro Risque'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isArabic 
                      ? 'محاكاة كاملة بأسعار حية لحظية من Binance مع رصيد افتراضي 10,000$ USDT. ممتاز لاختبار الاستراتيجيات وقياس نسبة الأرباح قبل المخاطرة بأموال حقيقية.'
                      : 'Simulation complète avec le flux de prix Binance réel et 10 000$ USDT virtuels. Idéal pour observer le comportement du bot et valider les stratégies.'}
                  </p>
                  <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    <li>{isArabic ? 'لا يتطلب مفاتيح Binance API' : 'Aucune clé API requise'}</li>
                    <li>{isArabic ? 'تنفيذ فوري مطابق للسوق الحقيقي' : 'Exécution identique aux conditions de marché'}</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-sm">
                        <Zap className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-rose-300 font-mono">
                        BINANCE LIVE FUTURES
                      </h4>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold">
                      {isArabic ? 'حساب حقيقي' : 'Capital Réel'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isArabic
                      ? 'تنفيذ حقيقي للصفقات مباشرة على حسابك في منصة بينانس عبر الـ API الرسمي. أوامر الشراء والبيع والـ TP/SL توضع تلقائياً على خوادم بينانس.'
                      : 'Exécution réelle directement sur votre compte Binance via API officielle sécurisée. Les ordres TP/SL sont placés directement chez le courtier.'}
                  </p>
                  <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    <li>{isArabic ? 'يتطلب صلاحيات التداول فقط (بدون إذن سحب)' : 'Permissions Trade uniquement (SANS retrait)'}</li>
                    <li>{isArabic ? 'تأمين كامل وتشفير محلي للـ API Keys' : 'Chiffrement local des clés API'}</li>
                  </ul>
                </div>
              </div>

              {/* 6 Strategies Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase font-bold text-cyan-300 tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>{isArabic ? 'الاستراتيجيات الكمية المتاحة في البوت' : isFrench ? 'Les 6 Stratégies Quantitatives Disponibles' : 'The 6 Quantitative Strategy Presets'}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    {
                      name: 'HFT Scalper',
                      tf: '1m / 5m',
                      lev: '3x - 5x',
                      desc: isArabic ? 'صفقات خاطفة سريعة تخطف ارتدادات 0.8% إلى 1.5% بنسبة فوز مرتفعة.' : 'Scalping haute fréquence sur micro-mouvements avec stops très serrés.',
                    },
                    {
                      name: 'Momentum Trend',
                      tf: '15m / 1h',
                      lev: '2x - 3x',
                      desc: isArabic ? 'تتبع الاتجاهات القوية وكسر مستويات الدعم والمقاومة التاريخية.' : 'Suit les vagues de tendance directionnelles et les cassures de structure.',
                    },
                    {
                      name: 'Institutional SMC',
                      tf: '15m / 4h',
                      lev: '2x - 3x',
                      desc: isArabic ? 'دخول دقيق على مناطق تجمع سيولة البنوك (Order Blocks & Fair Value Gaps).' : 'Entrées institutionnelles sur balayages de liquidité et blocs d’ordres.',
                    },
                    {
                      name: 'Breakout Volatility',
                      tf: '5m / 15m',
                      lev: '3x - 5x',
                      desc: isArabic ? 'رصد انفجارات الفولتيلتي بعد فترات الضغط والانضغاط السعري الساكن.' : 'Détecte les explosions de volatilité après compression de Bollinger.',
                    },
                    {
                      name: 'Mean Reversion',
                      tf: '15m / 30m',
                      lev: '2x - 3x',
                      desc: isArabic ? 'شراء مناطق التشبع البيعي الحاد وبيع مناطق التشبع الشرائي نحو EMA20.' : 'Achète les surventes RSI extrêmes pour un retour à la moyenne EMA.',
                    },
                    {
                      name: 'Swing Macro',
                      tf: '1h / 4h / 1D',
                      lev: '1x - 2x',
                      desc: isArabic ? 'صفقات استثمارية طويلة المدى تستهدف نسب ربح عالية (R:R 1:4+).' : 'Positions swing de plusieurs jours visant de grands ratios R:R (1:4+).',
                    },
                  ].map((strat, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-white">{strat.name}</div>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-cyan-300 font-mono border border-slate-800">{strat.tf}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 leading-relaxed">
                        {strat.desc}
                      </div>
                      <div className="text-[10px] font-mono text-amber-400 pt-1 border-t border-slate-900">
                        {isArabic ? 'الرافعة الموصى بها:' : 'Levier recommandé:'} <span className="font-bold">{strat.lev}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bot Best Practices Box */}
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-cyan-300">
                    {isArabic ? 'نصيحة ذهبية لتشغيل البوت' : isFrench ? 'Conseil d’or pour la gestion du Bot' : 'Golden Rule for Bot Execution'}
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {isArabic 
                      ? 'ابدأ بتفعيل استراتيجية واحدة أو استراتيجيتين معاً (مثل HFT Scalper + Momentum) على وضع Paper Trading لمدة 24 ساعة للتعرف على وتيرة الصفقات قبل الانتقال للحساب الحقيقي.'
                      : isFrench
                      ? 'Activez 1 à 2 stratégies au début (ex. HFT Scalper + Momentum) en Paper Trading pendant 24h pour valider le comportement avant de passer en Live.'
                      : 'Start by activating 1 or 2 strategies (e.g. HFT Scalper + Momentum) in Paper Trading mode for 24h to understand the frequency before switching to Live.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: RISK MANAGEMENT & CAPITAL RULES */}
          {/* ========================================================================= */}
          {activeTab === 'riskManagement' && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-400" />
                  <span>{isArabic ? 'قواعد الأمان، إدارة المخاطر وحماية رأس المال' : isFrench ? 'Gestion des Risques & Préservation du Capital' : 'Risk Management & Capital Preservation Rules'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isArabic 
                    ? 'إدارة المخاطر هي العنصر الأهم الذي يفصل بين المتداول المحترف والهاوي. التزم بهذه القواعد الصارمة.'
                    : isFrench
                    ? 'La gestion du risque est le facteur n°1 de longévité en trading quantitatif. Respectez ces principes.'
                    : 'Risk management is the single most important factor for long-term consistency in quantitative trading.'}
                </p>
              </div>

              {/* 3 Core Rules Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                    <Percent className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white font-mono uppercase">
                    {isArabic ? '1. قاعدة المخاطرة 1% - 2%' : isFrench ? '1. Règle des 1% à 2%' : '1. The 1% - 2% Risk Rule'}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isArabic 
                      ? 'لا تخاطر بأكثر من 1% إلى 2% من إجمالي رأس مالك في أي صفقة واحدة. إذا كان حسابك 10,000$، أقصى خسارة مسموح بها في الصفقة هي 100$ إلى 200$.'
                      : 'Ne risquez jamais plus de 1% à 2% de votre capital total sur un seul trade. Sur 10 000$, la perte maximale par trade ne doit pas dépasser 100$ à 200$.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white font-mono uppercase">
                    {isArabic ? '2. تأمين الدخول (Breakeven)' : isFrench ? '2. Sécurisation Breakeven' : '2. Auto Breakeven Lock'}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isArabic 
                      ? 'بمجرد أن يحقق السعر الهدف الأول (TP1)، يقوم البوت تلقائياً بنقل وقف الخسارة إلى سعر الدخول مع إضافة العمولات ليصبح الـ Trade خالياً تماماً من المخاطر (Risk-Free).'
                      : 'Dès que le TP1 est atteint, le bot déplace automatiquement le Stop Loss au point d’entrée pour éliminer tout risque de perte.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white font-mono uppercase">
                    {isArabic ? '3. قاطع الدائرة (Daily Circuit Breaker)' : isFrench ? '3. Coupe-Circuit Journalier' : '3. Daily Circuit Breaker'}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isArabic 
                      ? 'إذا تجاوزت خسارة اليوم حداً معيناً (مثلاً 5%)، يقوم البوت بإيقاف التداول تلقائياً لحماية الحساب من ظروف السوق غير الطبيعية والتذبذب العنيف.'
                      : 'Si la perte journalière dépasse le seuil configuré (ex. 5%), le bot gèle les nouvelles entrées pour protéger le capital.'}
                  </p>
                </div>
              </div>

              {/* Leverage & Margin Matrix */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-cyan-400" />
                    <span>{isArabic ? 'جدول الرافعة المالية والمسافة إلى التصفية (Liquidation Distance)' : isFrench ? 'Tableau du Levier & Distance de Liquidation' : 'Leverage Matrix & Liquidation Distance'}</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Isolated Margin Mode</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left rtl:text-right font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                        <th className="py-2 px-2">{isArabic ? 'الرافعة' : 'Levier'}</th>
                        <th className="py-2 px-2">{isArabic ? 'الهامش المطلوب' : 'Marge'}</th>
                        <th className="py-2 px-2">{isArabic ? 'مسافة التصفية التقريبية' : 'Dist. Liquidation'}</th>
                        <th className="py-2 px-2">{isArabic ? 'مستوى الأمان' : 'Niveau de Sécurité'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300 text-[11px]">
                      <tr>
                        <td className="py-2 px-2 font-bold text-emerald-400">1x (Spot)</td>
                        <td className="py-2 px-2">100%</td>
                        <td className="py-2 px-2">-100% (No liquidation)</td>
                        <td className="py-2 px-2 text-emerald-400 font-bold">أمان فائق (Ultra Safe)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 font-bold text-cyan-400">2x - 3x</td>
                        <td className="py-2 px-2">33% - 50%</td>
                        <td className="py-2 px-2">-33% إلى -50%</td>
                        <td className="py-2 px-2 text-cyan-300">موصى به للمبتدئين (Recommended)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 font-bold text-amber-400">5x</td>
                        <td className="py-2 px-2">20%</td>
                        <td className="py-2 px-2">-20%</td>
                        <td className="py-2 px-2 text-amber-300">مخاطرة متوسطة (Moderate)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 font-bold text-rose-400">10x</td>
                        <td className="py-2 px-2">10%</td>
                        <td className="py-2 px-2">-10%</td>
                        <td className="py-2 px-2 text-rose-400">يتطلب احترافية ومراقبة (High Risk)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: FAQ & PRO TIPS */}
          {/* ========================================================================= */}
          {activeTab === 'faq' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <span>{isArabic ? 'الأسئلة الشائعة وأفضل الممارسات (FAQ)' : isFrench ? 'Foire Aux Questions & Bonnes Pratiques' : 'Frequently Asked Questions & Pro Tips'}</span>
                </h3>
              </div>

              <div className="space-y-3">
                {[
                  {
                    q: isArabic ? 'هل أحتاج لإبقاء المتصفح مفتوحاً ليعمل البوت والتنبيهات؟' : isFrench ? 'Dois-je laisser le navigateur ouvert pour que le bot fonctionne ?' : 'Do I need to keep the browser open for the bot to run?',
                    a: isArabic 
                      ? 'لا! يعمل محرك البوت وفحص الأسواق وإرسال تنبيهات Telegram مباشرة من السيرفر الخلفي المستقل (Server-side). حتى لو أغلقت جهازك أو الهاتف، سيستمر البوت في العمل وإرسال الإشعارات.'
                      : isFrench
                      ? 'Non ! Le moteur du bot s’exécute directement sur le serveur indépendant. Les alertes Telegram et les exécutions se poursuivent même si votre navigateur est fermé.'
                      : 'No! The trading bot and Telegram alerts run autonomously on the backend server. It continues scanning and executing trades even if your browser is completely closed.',
                  },
                  {
                    q: isArabic ? 'هل مفاتيح الـ API الخاصة بحسابي في بينانس آمنة؟' : isFrench ? 'Mes clés API Binance sont-elles en sécurité ?' : 'Are my Binance API keys secure?',
                    a: isArabic 
                      ? 'نعم، تماماً. نحن نطلب فقط إذن التداول (Enable Spot & Futures Trading). لا تفعل إذن السحب (Enable Withdrawals) أبداً. كما يتم تشفير المفاتيح وحفظها بأمان.'
                      : isFrench
                      ? 'Oui, absolument. Nous ne demandons que l’autorisation de trading (Spot & Futures). N’activez JAMAIS les retraits. Les clés sont sécurisées et chiffrées.'
                      : 'Yes, 100%. Never enable "Withdrawals" on your Binance API keys — only check "Spot & Futures Trading". Keys are encrypted and stored safely.',
                  },
                  {
                    q: isArabic ? 'كيف أبدأ التداول الحقيقي بعد تجربة الـ Paper Trading؟' : isFrench ? 'Comment passer en Trading Réel après le Paper Trading ?' : 'How do I switch to Live Trading after testing?',
                    a: isArabic 
                      ? '1. افتح نافذة ربط Binance وأدخل مفاتيح الـ API. 2. من محرك البوت، غير وضع التنفيذ من Paper إلى Binance Live. 3. اختر أزواج العملات وحدد رأس المال والرافعة المالية.'
                      : isFrench
                      ? '1. Connectez vos clés API Binance. 2. Dans l’onglet Bot, passez de Paper à Binance Live. 3. Choisissez vos paires et démarrez.'
                      : '1. Connect your Binance API keys in settings. 2. In the Bot tab, toggle the execution mode to Binance Live. 3. Select active pairs and start the bot.',
                  },
                  {
                    q: isArabic ? 'ماذا يعني Trailing Stop وكيف يزيد أرباحي؟' : isFrench ? 'Qu’est-ce que le Trailing Stop et comment augmente-t-il les gains ?' : 'What is Trailing Stop and how does it maximize profits?',
                    a: isArabic 
                      ? 'الوقف المتحرك يرفع نقطة وقف الخسارة تدريجياً مع صعود السعر، مما يسمح للصفقة بالاستمرار في تحقيق أرباح طالما أن الاتجاه صاعد، ويغلق الصفقة فور حدوث ارتداد.'
                      : isFrench
                      ? 'Le Trailing Stop suit le prix à la hausse pour verrouiller les gains continus et coupe la position dès qu’un retournement significatif survient.'
                      : 'Trailing Stop automatically moves your stop-loss upward as the market rises, letting profits run while locking in gains on any sharp reversal.',
                  },
                ].map((faq, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="text-cyan-400 font-mono font-bold">Q{i + 1}:</span>
                      <span>{faq.q}</span>
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed pl-6 rtl:pr-6">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 sm:p-4 border-t border-slate-800/80 bg-slate-950/80 gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Quantura Institutional Core • 24/7 Live Monitoring</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              id="btn-help-close-footer"
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              {isArabic ? 'إغلاق الدليل' : isFrench ? 'Fermer le Guide' : 'Close Guide'}
            </button>
            <button
              id="btn-help-start-trading"
              type="button"
              onClick={() => {
                onClose();
                onNavigateToTab?.('signal');
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition shadow-md shadow-cyan-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isArabic ? 'بدء التداول الآن' : isFrench ? 'Lancer le Trading' : 'Start Trading Now'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
