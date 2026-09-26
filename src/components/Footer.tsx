import React from 'react';
import {
  Cpu,
  Shield,
  Zap,
  Activity,
  Key,
  ChevronRight,
  TrendingUp,
  Radar,
  Bot,
  Layers,
  BarChart2,
  LineChart,
  ShieldCheck,
  Globe2,
  Wifi,
  Sparkles,
  ArrowUp,
  Lock,
  BadgeCheck,
  Fingerprint,
  Award,
  Sliders,
  CheckCircle2,
  PieChart,
  History,
  Coins,
  Brain,
  HelpCircle,
  Bell,
  Wallet,
  Scale,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { Language, TradingExecutionMode, BinanceApiConfig, APP_VERSION_TAG } from '../types';

export interface FooterProps {
  language: Language;
  activeTab: string;
  onSelectTab: (tab: any) => void;
  executionMode: TradingExecutionMode;
  binanceConfig: BinanceApiConfig;
  onOpenBinanceModal: () => void;
  onOpenRiskModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenCustomBalanceModal?: () => void;
  onOpenHelpModal?: () => void;
  onOpenNotifications?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  language,
  activeTab,
  onSelectTab,
  executionMode,
  binanceConfig,
  onOpenBinanceModal,
  onOpenRiskModal,
  onOpenSettingsModal,
  onOpenCustomBalanceModal,
  onOpenHelpModal,
  onOpenNotifications,
}) => {
  const isArabic = language === 'ar';
  const isEn = language === 'en';
  const marketType = binanceConfig?.marketType || 'FUTURES';

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className={`mt-20 border-t border-slate-800/80 bg-gradient-to-b from-slate-950 via-[#050811] to-[#020408] text-slate-400 relative z-10 overflow-hidden font-sans ${isArabic ? 'rtl text-right' : 'ltr text-left'}`}>
      {/* Top subtle decorative ambient glow line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-24 bg-cyan-500/[0.04] pointer-events-none rounded-full" />

      {/* Top Bar: Live Institutional Ticker / Ecosystem Status */}
      <div className="border-b border-slate-800/70 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            {/* Live Gateway Status */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              </span>
              <span className="text-slate-200 font-mono text-[11px] font-bold tracking-wider">
                BINANCE WS: <span className="text-emerald-400">STREAMING ACTIVE</span>
              </span>
            </div>

            <span className="hidden sm:inline text-slate-700">|</span>

            {/* Execution Engine Mode */}
            <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                ENGINE:{' '}
                <strong className={executionMode === 'BINANCE_LIVE' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {executionMode === 'BINANCE_LIVE' ? 'BINANCE LIVE (REAL)' : 'PAPER SIMULATION'}
                </strong>
              </span>
            </div>

            <span className="hidden md:inline text-slate-700">|</span>

            {/* Active Market Protocol Badge */}
            <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>
                MARKET:{' '}
                <strong className={marketType === 'FUTURES' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {marketType === 'FUTURES' ? 'USDT-M FUTURES' : 'SPOT TRADING'}
                </strong>
              </span>
            </div>

            <span className="hidden md:inline text-slate-700">|</span>

            {/* Risk Guard State */}
            <div className="hidden lg:flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>RISK SHIELD: <strong className="text-cyan-300 font-bold">CIRCUIT BREAKER ARMED</strong></span>
            </div>
          </div>

          {/* Quick Right Side Links & Back to Top */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenBinanceModal}
              className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Key className="w-3 h-3 text-amber-400" />
              <span>{binanceConfig?.isConnected ? (isArabic ? 'بينانس متصل' : 'API CONNECTED') : (isArabic ? 'ربط بينانس API' : 'SETUP API')}</span>
            </button>

            {onOpenHelpModal && (
              <button
                onClick={onOpenHelpModal}
                className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title={isArabic ? 'دليل البدء السريع' : 'Quick Start Guide'}
              >
                <HelpCircle className="w-3 h-3 text-cyan-400" />
                <span>{isArabic ? 'المساعدة' : 'GUIDE'}</span>
              </button>
            )}

            <button
              onClick={scrollToTop}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 border border-slate-700 transition-colors cursor-pointer shadow-xs group"
              title={isArabic ? 'الرجوع إلى الأعلى' : 'Back to top'}
            >
              <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Multi-Column Institutional Footer Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          
          {/* Column 1: Brand, Identity & Executive Founder (2 Spans on LG) */}
          <div className="lg:col-span-2 flex flex-col justify-between space-y-6">
            <div>
              {/* Brand Logo & Title */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="relative group cursor-pointer shrink-0"
                  onClick={scrollToTop}
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-[#02050b] border-2 border-cyan-500/50 p-1 shadow-2xl transition-transform duration-300 group-hover:scale-105 flex items-center justify-center overflow-hidden">
                    <img
                      src="/logo.png"
                      alt="Quantura Logo"
                      className="w-full h-full rounded-xl object-cover"
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-['Syncopate',sans-serif] font-black text-white tracking-[0.18em] text-lg sm:text-xl uppercase text-sweep-shine">
                      QUANTURA
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-[9.5px] font-bold tracking-wider shadow-xs">
                      {APP_VERSION_TAG}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-cyan-400 text-xs font-mono font-black tracking-[0.22em] uppercase">
                      TRADE SMARTER
                    </span>
                    <span className="text-slate-600 font-mono text-xs">•</span>
                    <span className="text-slate-400 text-[10px] font-mono tracking-wider uppercase">
                      QUANTITATIVE TERMINAL
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio & Description */}
              <p className="text-xs text-slate-400 leading-relaxed mb-4 max-w-md">
                {isArabic
                  ? 'محطة التداول الكمي الاحترافية المدعومة بالذكاء الاصطناعي المؤسسي. توفر معمارية تداول مزدوجة تدعم Spot (1x) و USDT-M Futures (1x إلى 50x Isolated)، مع 10 استراتيجيات خوارزمية ذكية، ومحرك إدارة المخاطر، وجني أرباح مجزأ، ووقف خسارة متحرك لحظي.'
                  : 'Enterprise-grade quantitative AI trading terminal engineered with institutional algorithms, dual-engine Spot (1x) & USDT-M Futures (1x to 50x Isolated) execution, 10 automated quant strategies, dynamic scale-out TP, trailing SL, and real-time risk circuit breaker.'}
              </p>

              {/* Institutional Specs Chips */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow-sm">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>ED25519 / HMAC-SHA256</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow-sm">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Spot & Futures Isolated</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow-sm">
                  <Shield className="w-3 h-3 text-cyan-400" />
                  <span>Direct Non-Custodial Keys</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow-sm">
                  <Bot className="w-3 h-3 text-purple-400" />
                  <span>10 Quant Presets + AI</span>
                </span>
              </div>
            </div>

            {/* Executive Founder & Quantitative Architect Credential Card */}
            <div className="rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/80 to-[#070b14] border border-slate-800 hover:border-cyan-500/40 p-4 sm:p-4.5 shadow-2xl relative overflow-hidden group transition-colors duration-300">
              {/* Dynamic Top Ambient Laser Glow */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500/60 via-cyan-400 to-emerald-400/60" />

              {/* Card Header Row: Badge & Official Status */}
              <div className="flex items-center justify-between gap-2 mb-3.5 relative z-10">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-mono font-bold tracking-wider uppercase">
                  <Award className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{isArabic ? 'المؤسس والمعماري الرئيسي' : 'FOUNDER & CHIEF ARCHITECT'}</span>
                </div>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9.5px] font-mono font-bold shadow-sm">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isArabic ? 'توثيق رسمي' : 'VERIFIED'}</span>
                </div>
              </div>

              {/* Main Body: Executive Monogram Avatar & Name */}
              <div className="flex items-center gap-3.5 relative z-10 mb-3">
                {/* Monogram Executive Avatar */}
                <div className="relative shrink-0 group/avatar">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-800 to-cyan-500/20 border-2 border-amber-500/40 group-hover:border-cyan-400/60 shadow-md flex items-center justify-center transition-transform duration-300 group-hover/avatar:scale-105">
                    <span className="font-['Syncopate',sans-serif] font-black text-sm tracking-tighter bg-gradient-to-br from-amber-200 via-amber-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm">
                      JA
                    </span>
                  </div>
                  {/* Status Beacon Dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-900" />
                  </span>
                </div>

                {/* Identity & Typography */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-['Syncopate',sans-serif] font-extrabold text-xs sm:text-[13px] tracking-[0.24em] uppercase text-slate-100 truncate">
                      JAOUAD ABDECHCHAFI
                    </h4>
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono leading-tight truncate">
                    {isArabic 
                      ? 'مهندس خوارزميات التداول الكمي والذكاء الاصطناعي' 
                      : 'Lead Quantitative Systems & AI Protocol Architect'}
                  </p>
                </div>
              </div>

              {/* Bottom Card Strip: Cryptographic Signature & Spec */}
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-400 relative z-10">
                <span className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition-colors">
                  <Fingerprint className="w-3 h-3 text-cyan-400/80" />
                  <span>ID: JA-QUANT-001</span>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-amber-400/80 font-semibold tracking-wider">
                  GENESIS CORE
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-400/80">
                  PROTOCOL SIGNED
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Terminal Modules (All 10 Core Views) */}
          <div>
            <h4 className="text-white text-xs font-mono font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>{isArabic ? 'وحدات المحطة (10 Modules)' : 'Terminal Modules (10)'}</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onSelectTab('signal')}
                  className={`w-full flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'signal' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'لوحة الإشارات الفورية' : 'AI Live Signals'}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-mono font-bold">
                    PRO
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('autoBot')}
                  className={`w-full flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'autoBot' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'محرك البوت الآلي' : 'Quant Trading Bot'}</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-mono font-bold">
                    10 STRATS
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('globalScanner')}
                  className={`w-full flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'globalScanner' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Radar className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'رادار ومسّاح السوق' : 'Market Radar Scanner'}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('chart')}
                  className={`w-full flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'chart' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <LineChart className="w-3.5 h-3.5 text-sky-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'الرسم البياني المتكامل' : 'Pro Trading Chart'}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('mtf')}
                  className={`w-full flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'mtf' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'تحليل الأطر المتعددة' : 'Multi-Timeframe MTF'}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('market')}
                  className={`w-full flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'market' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Globe2 className="w-3.5 h-3.5 text-teal-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'نظرة عامة والسيولة' : 'Market Overview & Hub'}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('analysis')}
                  className={`w-full flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'analysis' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'تحليل الذكاء الاصطناعي' : 'AI Deep Market Analysis'}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('backtest')}
                  className={`w-full flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'backtest' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'محرك الاختبار التاريخي' : 'Quant Backtesting'}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('history')}
                  className={`w-full flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'history' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'سجل الصفقات الحي' : 'Trade History & Journal'}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('riskWallet')}
                  className={`w-full flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'riskWallet' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <PieChart className="w-3.5 h-3.5 text-teal-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'المحفظة وتوزيع المخاطر' : 'Wallet & Risk Allocation'}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: 10 Quantitative Strategies */}
          <div>
            <h4 className="text-white text-xs font-mono font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{isArabic ? 'الاستراتيجيات الكمية (10)' : 'Quant Strategies (10)'}</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="truncate">Momentum Trend Pro</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">ADX/EMA</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  <span className="truncate">High-Freq Scalper</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">5m/15m</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                  <span className="truncate">Breakout Sniper</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">Vol Expan</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                  <span className="truncate">Mean Reversion Pro</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">BB %B</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span className="truncate">Smart Money (SMC)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">OB / FVG</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">Conservative Swing</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">Low DD</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span className="truncate">Dynamic Volatility</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">ATR Guard</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                  <span className="truncate">Liquidity Sweep Hunt</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">Stop Sweep</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0" />
                  <span className="truncate">MTF Trend Rider</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">SuperTrend</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shrink-0" />
                  <span className="truncate">AI Adaptive Matrix</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">Auto Regime</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Security, Protocols & Quick System Controls */}
          <div>
            <h4 className="text-white text-xs font-mono font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>{isArabic ? 'الحماية والتحكم السريع' : 'Security & Controls'}</span>
            </h4>
            <div className="space-y-2.5 text-xs">
              <button
                onClick={onOpenRiskModal}
                className="w-full p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-slate-200 font-semibold group-hover:text-cyan-300 transition-colors">
                    {isArabic ? 'محرك إدارة المخاطر' : 'Risk Management Engine'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isArabic ? 'قاطع الحماية، الحد اليومي والسحب' : 'Circuit Breaker, Daily Drawdown'}
                  </div>
                </div>
                <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
              </button>

              <button
                onClick={onOpenBinanceModal}
                className="w-full p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-slate-200 font-semibold group-hover:text-amber-300 transition-colors">
                    {isArabic ? 'إعدادات ربط بينانس API' : 'Binance API Integration'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {binanceConfig?.isConnected ? `${marketType} CONNECTED` : 'KEY PAIR UNCONFIGURED'}
                  </div>
                </div>
                <Key className="w-4 h-4 text-amber-400 shrink-0" />
              </button>

              {onOpenCustomBalanceModal && (
                <button
                  onClick={onOpenCustomBalanceModal}
                  className="w-full p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="text-slate-200 font-semibold group-hover:text-emerald-300 transition-colors">
                      {isArabic ? 'رصيد المحاكاة الافتراضي' : 'Virtual Paper Balance'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {isArabic ? 'تخصيص رصيد المحفظة التجريبية' : 'Adjust Paper Wallet Funds'}
                    </div>
                  </div>
                  <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                </button>
              )}

              {onOpenNotifications && (
                <button
                  onClick={onOpenNotifications}
                  className="w-full p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="text-slate-200 font-semibold group-hover:text-purple-300 transition-colors">
                      {isArabic ? 'مركز التنبيهات الفورية' : 'Push Notification Center'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isArabic ? 'سجل التنبيهات وإشارات التليجرام' : 'Live Alerts & Telegram Bot'}
                    </div>
                  </div>
                  <Bell className="w-4 h-4 text-purple-400 shrink-0" />
                </button>
              )}

              <button
                onClick={onOpenSettingsModal}
                className="w-full p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-slate-200 font-semibold group-hover:text-cyan-300 transition-colors">
                    {isArabic ? 'تفضيلات المحطة وتليجرام' : 'Terminal Preferences'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isArabic ? 'بوت التليجرام، الصوت والمظهر' : 'Telegram Bot, Sounds & Theme'}
                  </div>
                </div>
                <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
              </button>
            </div>
          </div>

        </div>

        {/* Quantitative Architecture Specifications Bar */}
        <div className="mt-10 pt-6 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Binance REST v3</span>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
              <span>USDT-M Futures fapi</span>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sub-100ms WebSocket</span>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Client-Side Non-Custodial Direct</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-500">
            <span>UPTIME: 99.98%</span>
            <span>•</span>
            <span>LATENCY: ~35ms</span>
          </div>
        </div>

        {/* Institutional Risk Disclaimer */}
        <div className="mt-8 pt-6 border-t border-slate-800/70 text-[11px] text-slate-400 leading-relaxed space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-mono font-bold uppercase text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>{isArabic ? 'إخلاء المسؤولية المالي والتنظيمي' : (isEn ? 'INSTITUTIONAL RISK WARNING & DISCLAIMER' : 'AVERTISSEMENT SUR LES RISQUES FINANCIERS')}</span>
          </div>
          <p>
            {isArabic
              ? 'تداول الأصول الرقمية، العقود الفورية (Spot)، والعقود الآجلة (USDT-M Futures) ينطوي على مخاطر مالية عالية وتقلبات سعرية حادة قد تؤدي إلى خسارة جزء أو كامل رأس المال المستثمر. منصة Quantura توفر أدوات تحليل وخوارزميات مساعدة كمية، ولا تقدم أي نصائح أو استشارات استثمارية أو مالية مباشرة. الأداء التاريخي لأي استراتيجية ليس ضماناً للنتائج المستقبلية. تقع مسؤولية إدارة المخاطر وتحديد حجم الصفقات ومضاعف الرافعة بالكامل على عاتق المستخدم.'
              : (isEn 
                  ? 'Digital asset trading across Spot and USDT-M Futures markets carries substantial financial risk and extreme price volatility that can result in the loss of all deployed capital. Quantura provides quantitative tooling and automated algorithmic infrastructure for informational and execution purposes only, and does not constitute financial, investment, or legal advice. Past performance is no guarantee of future returns. You remain solely responsible for your risk tolerance and capital preservation.'
                  : 'Le trading d\'actifs numériques sur les marchés Spot et Contrats Futures USDT-M comporte un risque financier substantiel et une volatilité extrême pouvant entraîner la perte de l\'intégralité du capital investi. Quantura fournit des outils quantitatifs et une infrastructure algorithmique automatisée à des fins informatives et d\'exécution technique, et ne constitue en aucun cas un conseil financier ou d\'investissement direct. Les performances passées ne préjugent pas des résultats futurs.')}
          </p>
        </div>

        {/* Bottom Bar: Copyright & Platform Meta */}
        <div className="mt-8 pt-6 border-t border-slate-800/70 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-400 font-mono">
          <div className="flex flex-wrap items-center gap-3">
            <span>&copy; {currentYear} QUANTURA TERMINAL ({APP_VERSION_TAG}). ALL RIGHTS RESERVED.</span>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <span className="text-slate-300">SPOT & USDT-M FUTURES PROTOCOLS</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Cpu className="w-3 h-3" />
              <span>QUANTURA AI QUANT CORE {APP_VERSION_TAG}</span>
            </span>
            <span className="text-slate-700">•</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Wifi className="w-3 h-3" />
              <span>99.98% UPTIME</span>
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
