import React from 'react';
import {
  Cpu,
  Terminal,
  Shield,
  Zap,
  Activity,
  Key,
  Code2,
  ExternalLink,
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
  Radio,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { Language, TradingExecutionMode, BinanceApiConfig, APP_VERSION_TAG, APP_VERSION } from '../types';

interface FooterProps {
  language: Language;
  activeTab: string;
  onSelectTab: (tab: any) => void;
  executionMode: TradingExecutionMode;
  binanceConfig: BinanceApiConfig;
  onOpenBinanceModal: () => void;
  onOpenRiskModal: () => void;
  onOpenSettingsModal: () => void;
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
}) => {
  const isArabic = language === 'ar';

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-slate-800/80 bg-gradient-to-b from-slate-950 via-[#060a12] to-[#02050b] text-slate-400 relative z-10 overflow-hidden font-sans">
      {/* Top subtle decorative ambient glow line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-24 bg-cyan-500/[0.04] blur-3xl pointer-events-none rounded-full"></div>

      {/* Top Bar: Live Institutional Ticker / Ecosystem Status */}
      <div className="border-b border-slate-800/70 bg-slate-900/50 backdrop-blur-md px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* Live Gateway Status */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
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

            {/* Risk Guard State */}
            <div className="hidden md:flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>RISK GUARD: <strong className="text-cyan-300">STRICT ARMED</strong></span>
            </div>
          </div>

          {/* Quick Right Side Links & Back to Top */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenBinanceModal}
              className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Key className="w-3 h-3 text-amber-400" />
              <span>{binanceConfig.isConnected ? 'API CONNECTED' : 'SETUP API KEYS'}</span>
            </button>

            <button
              onClick={scrollToTop}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 border border-slate-700 transition-all cursor-pointer shadow-xs group"
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
          
          {/* Column 1: Brand, Identity & Vision (2 Spans on LG) */}
          <div className="lg:col-span-2 flex flex-col justify-between">
            <div>
              {/* Brand Logo & Title */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="relative group cursor-pointer shrink-0"
                  onClick={scrollToTop}
                >
                  <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500/40 via-cyan-400/40 to-emerald-400/40 rounded-2xl blur-lg opacity-50 group-hover:opacity-100 transition duration-500"></div>
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-[#02050b] border-2 border-cyan-500/50 p-1 shadow-2xl transition-all duration-500 group-hover:scale-105 flex items-center justify-center overflow-hidden">
                    <img
                      src="/logo.png"
                      alt="Quantura Logo"
                      className="w-full h-full rounded-xl object-cover"
                    />
                  </div>
                </div>

                <div className="flex flex-col text-left rtl:text-right">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-['Syncopate',sans-serif] font-black text-white tracking-[0.18em] text-lg sm:text-xl uppercase text-sweep-shine">
                      QUANTURA
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-[9.5px] font-bold tracking-wider shadow-xs">
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
              <p className="text-xs text-slate-400 leading-relaxed mb-5 max-w-md">
                {isArabic
                  ? 'محطة التداول الكمي الاحترافية المدعومة بالذكاء الاصطناعي وخوارزميات المؤسسات المالية. صممت لتوفير تنفيذ فوري للصفقات، حماية صارمة لرأس المال عبر إدارة المخاطر اللحظية، ومسح شامل لأسواق بينانس في بيئة موثوقة وفائقة السرعة.'
                  : 'Enterprise-grade quantitative AI trading terminal engineered with institutional algorithms, deterministic risk guardrails, real-time Binance order routing, and sub-millisecond market intelligence.'}
              </p>

              {/* Institutional Specs Chips */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow-sm">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>ED25519 / HMAC-SHA256</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow-sm">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Low Latency Routing</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1.5 shadow-sm">
                  <Shield className="w-3 h-3 text-cyan-400" />
                  <span>Non-Custodial Direct Keys</span>
                </span>
              </div>
            </div>

            {/* Executive Founder & Quantitative Architect Credential Card */}
            <div className="rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-900/80 to-[#070b14] border border-slate-800 hover:border-cyan-500/40 p-4 sm:p-4.5 shadow-2xl relative overflow-hidden group transition-all duration-500">
              {/* Dynamic Top Ambient Laser Glow */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500/60 via-cyan-400 to-emerald-400/60 group-hover:h-[2.5px] transition-all duration-500"></div>
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-cyan-500/10 blur-2xl pointer-events-none rounded-full group-hover:bg-cyan-500/20 transition-all duration-700"></div>

              {/* Card Header Row: Badge & Official Status */}
              <div className="flex items-center justify-between gap-2 mb-3.5 relative z-10">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 text-amber-300 text-[9px] font-mono font-bold tracking-wider uppercase">
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
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-800 to-cyan-500/20 border-2 border-amber-500/40 group-hover:border-cyan-400/60 shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center justify-center transition-all duration-500 group-hover/avatar:scale-105">
                    <span className="font-['Syncopate',sans-serif] font-black text-sm tracking-tighter bg-gradient-to-br from-amber-200 via-amber-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm">
                      JA
                    </span>
                  </div>
                  {/* Status Beacon Dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-900"></span>
                  </span>
                </div>

                {/* Identity & Typography */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    {/* Ethereal rising smoke vapor */}
                    <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0" title="Quantum Vapor">
                      <span className="w-1 h-1 rounded-full bg-cyan-400/60 blur-[0.5px]"></span>
                      <span className="smoke-wisp-1 absolute bottom-0.5 w-2 h-2 rounded-full bg-slate-300/50 blur-[1.5px] pointer-events-none"></span>
                      <span className="smoke-wisp-2 absolute bottom-0.5 w-2.5 h-2.5 rounded-full bg-cyan-200/40 blur-[2px] pointer-events-none"></span>
                    </div>

                    <h4 className="text-sweep-shine font-['Syncopate',sans-serif] font-extrabold text-xs sm:text-[13px] tracking-[0.24em] uppercase text-slate-100 truncate">
                      JAOUAD ABDECHCHAFI
                    </h4>
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono leading-tight truncate">
                    {isArabic 
                      ? 'مهندس خوارزميات التداول العصبي وشبكة الربط الفوري' 
                      : 'Lead Quantitative Systems & Core Protocol Architect'}
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

          {/* Column 2: Terminal Navigation */}
          <div>
            <h4 className="text-white text-xs font-mono font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>{isArabic ? 'وحدات المحطة (Terminal)' : 'Terminal Modules'}</span>
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  onClick={() => onSelectTab('signal')}
                  className={`w-full text-left rtl:text-right flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'signal' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'لوحة الإشارات الفورية' : 'AI Live Signals'}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('autoBot')}
                  className={`w-full text-left rtl:text-right flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'autoBot' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'محرك البوت الآلي' : 'Quant Trading Bot'}</span>
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-mono font-bold">
                    6 PRESETS
                  </span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('globalScanner')}
                  className={`w-full text-left rtl:text-right flex items-center justify-between transition-colors group cursor-pointer ${
                    activeTab === 'globalScanner' ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Radar className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                    <span>{isArabic ? 'رادار ومسّاح السوق' : 'Market Radar Scanner'}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('chart')}
                  className={`w-full text-left rtl:text-right flex items-center justify-between transition-colors group cursor-pointer ${
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
                  className={`w-full text-left rtl:text-right flex items-center justify-between transition-colors group cursor-pointer ${
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
                  onClick={() => onSelectTab('backtest')}
                  className={`w-full text-left rtl:text-right flex items-center justify-between transition-colors group cursor-pointer ${
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
            </ul>
          </div>

          {/* Column 3: Quantitative Strategies */}
          <div>
            <h4 className="text-white text-xs font-mono font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>{isArabic ? 'الاستراتيجيات المدمجة' : 'Built-in Strategies'}</span>
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>Momentum Trend Pro</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">ADX / RSI</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                  <span>High-Freq Scalper</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Fast 15m</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  <span>Breakout Sniper</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Vol Expansion</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                  <span>Mean Reversion Pro</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Bollinger %B</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span>Smart Money (SMC)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">OB & FVG</span>
              </li>
              <li className="flex items-center justify-between text-slate-400 hover:text-slate-200">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Conservative Swing</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Low Drawdown</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Security, Compliance & System Controls */}
          <div>
            <h4 className="text-white text-xs font-mono font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>{isArabic ? 'الحماية والأدوات' : 'Security & Tools'}</span>
            </h4>
            <div className="space-y-3 text-xs">
              <button
                onClick={onOpenRiskModal}
                className="w-full text-left rtl:text-right p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/40 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-slate-200 font-semibold group-hover:text-cyan-300 transition-colors">
                    {isArabic ? 'محرك إدارة المخاطر' : 'Risk Management Engine'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isArabic ? 'حد أقصى للخسارة والسحب اليومي' : 'Max SL, Daily Cap, Spread'}
                  </div>
                </div>
                <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
              </button>

              <button
                onClick={onOpenBinanceModal}
                className="w-full text-left rtl:text-right p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-slate-200 font-semibold group-hover:text-amber-300 transition-colors">
                    {isArabic ? 'إعدادات ربط بينانس API' : 'Binance API Integration'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {binanceConfig.isConnected ? 'SPOT & FUTURES CONNECTED' : 'KEY PAIR UNCONFIGURED'}
                  </div>
                </div>
                <Key className="w-4 h-4 text-amber-400 shrink-0" />
              </button>

              <button
                onClick={onOpenSettingsModal}
                className="w-full text-left rtl:text-right p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/40 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-slate-200 font-semibold group-hover:text-cyan-300 transition-colors">
                    {isArabic ? 'تفضيلات المحطة وتليجرام' : 'Terminal Preferences'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isArabic ? 'التنبيهات الفورية والمظهر' : 'Telegram Bot & UI Setup'}
                  </div>
                </div>
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              </button>
            </div>
          </div>

        </div>

        {/* Institutional Risk Disclaimer (Standard for Binance, TradingView, Bybit) */}
        <div className="mt-12 pt-8 border-t border-slate-800/70 text-[11px] text-slate-400 leading-relaxed space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-mono font-bold uppercase text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>{isArabic ? 'إخلاء المسؤولية المالي والتنظيمي' : 'INSTITUTIONAL RISK WARNING & DISCLAIMER'}</span>
          </div>
          <p>
            {isArabic
              ? 'تداول الأصول الرقمية والعقود الآجلة ينطوي على مخاطر مالية عالية وتقلبات سعرية حادة قد تؤدي إلى خسارة جزء أو كامل رأس المال المستثمر. منصة Quantura توفر أدوات تحليل وخوارزميات مساعدة كمية، ولا تقدم أي نصائح أو استشارات استثمارية أو مالية مباشرة. الأداء التاريخي لأي استراتيجية ليس ضماناً للنتائج المستقبلية. تقع مسؤولية إدارة المخاطر وتحديد حجم الصفقات بالكامل على عاتق المستخدم.'
              : 'Digital asset trading, futures, and algorithmic derivatives carry substantial financial risk and extreme price volatility that can result in the loss of all deployed capital. Quantura provides quantitative tooling and automated algorithmic infrastructure for informational and execution purposes only, and does not constitute financial, investment, or legal advice. Past performance is no guarantee of future returns. You remain solely responsible for your risk tolerance and capital preservation.'}
          </p>
        </div>

        {/* Bottom Bar: Copyright & Platform Meta */}
        <div className="mt-8 pt-6 border-t border-slate-800/70 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-400 font-mono">
          <div className="flex flex-wrap items-center gap-3">
            <span>&copy; {currentYear} QUANTURA TERMINAL ({APP_VERSION_TAG}). ALL RIGHTS RESERVED.</span>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <span className="text-slate-300">BINANCE REST API & WEBHOOK COMPATIBLE</span>
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

