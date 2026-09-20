export interface TradingPair {
  symbol: string;         // e.g. 'BTCUSDT'
  baseAsset: string;      // e.g. 'BTC'
  quoteAsset: string;     // e.g. 'USDT'
  displayName: string;    // e.g. 'BTC / USDT'
  arabicName: string;     // e.g. 'بيتكوين (Bitcoin)'
  category: 'MAJOR' | 'LAYER1' | 'ORACLE_INFRA' | 'HIGH_MOMENTUM' | 'DEFI' | 'MEME';
  description: string;
  arabicDescription: string;
  iconBg: string;
  iconText: string;
  decimals: number;
}

export const RESPECTED_TRADING_PAIRS: TradingPair[] = [
  {
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    displayName: 'BTC / USDT',
    arabicName: 'بيتكوين (Bitcoin)',
    category: 'MAJOR',
    description: 'The King of Crypto & Global Liquidity Benchmark',
    arabicDescription: 'ملك العملات الرقمية والمحرك الرئيسي لسيولة السوق العالمي',
    iconBg: 'from-amber-500 to-orange-600',
    iconText: '₿',
    decimals: 2,
  },
  {
    symbol: 'ETHUSDT',
    baseAsset: 'ETH',
    quoteAsset: 'USDT',
    displayName: 'ETH / USDT',
    arabicName: 'إيثيريوم (Ethereum)',
    category: 'MAJOR',
    description: 'Leading Smart Contract Platform & Deepest Institutional Liquidity',
    arabicDescription: 'عملاق العقود الذكية والمنظومة الأكثر احتراماً في حركة الشارت والتحليل الفني',
    iconBg: 'from-blue-500 to-indigo-600',
    iconText: 'Ξ',
    decimals: 2,
  },
  {
    symbol: 'SOLUSDT',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    displayName: 'SOL / USDT',
    arabicName: 'سولانا (Solana)',
    category: 'LAYER1',
    description: 'High-Speed Layer 1 & Premier Volatility & Trend Trading Pair',
    arabicDescription: 'أقوى شبكة Layer 1 من حيث الزخم والسيولة واحترام مستويات الدعم والمقاومة',
    iconBg: 'from-purple-500 to-teal-400',
    iconText: '◎',
    decimals: 2,
  },
  {
    symbol: 'BNBUSDT',
    baseAsset: 'BNB',
    quoteAsset: 'USDT',
    displayName: 'BNB / USDT',
    arabicName: 'بي إن بي (BNB Chain)',
    category: 'MAJOR',
    description: 'Ecosystem Fuel for Binance with High Stability & Clean Trends',
    arabicDescription: 'عملة منصة بينانس الأساسية، تتميز باتجاهات قوية واستقرار عالٍ في الشارت',
    iconBg: 'from-yellow-400 to-amber-600',
    iconText: '◆',
    decimals: 2,
  },
  {
    symbol: 'XRPUSDT',
    baseAsset: 'XRP',
    quoteAsset: 'USDT',
    displayName: 'XRP / USDT',
    arabicName: 'ريبل (Ripple XRP)',
    category: 'MAJOR',
    description: 'Cross-Border Institutional Settlement Giant with Massive Volume',
    arabicDescription: 'عملاق التحويلات المصرفية الكبرى ذو سيولة تاريخية ومناطق تجميع واحترام للشارت',
    iconBg: 'from-slate-700 to-slate-900',
    iconText: '✕',
    decimals: 4,
  },
  {
    symbol: 'AVAXUSDT',
    baseAsset: 'AVAX',
    quoteAsset: 'USDT',
    displayName: 'AVAX / USDT',
    arabicName: 'أفالانش (Avalanche)',
    category: 'LAYER1',
    description: 'Institutional Subnet Architecture with Clean Fibonacci & Structure Respect',
    arabicDescription: 'شبكة المؤسسات الفرعية، نموذج كلاسيكي لاحترام مستويات فيبوناتشي ونطاقات العرض والطلب',
    iconBg: 'from-rose-500 to-red-600',
    iconText: '▲',
    decimals: 2,
  },
  {
    symbol: 'SUIUSDT',
    baseAsset: 'SUI',
    quoteAsset: 'USDT',
    displayName: 'SUI / USDT',
    arabicName: 'سوي (Sui Network)',
    category: 'LAYER1',
    description: 'Next-Gen Move-based Layer 1 with High Throughput & Momentum',
    arabicDescription: 'شبكة الجيل القادم بلغة Move ذات زخم تداولي وتدفق سيولة مضاربية متسارعة',
    iconBg: 'from-cyan-500 to-blue-600',
    iconText: 'S',
    decimals: 4,
  },
  {
    symbol: 'NEARUSDT',
    baseAsset: 'NEAR',
    quoteAsset: 'USDT',
    displayName: 'NEAR / USDT',
    arabicName: 'نير بروتوكول (NEAR)',
    category: 'LAYER1',
    description: 'AI & Chain Abstraction Pioneer with High Liquidity & Technical Precision',
    arabicDescription: 'رائد الذكاء الاصطناعي وتجريد السلاسل ذو نماذج فنية دقيقة واحترام لقنوات التداول',
    iconBg: 'from-emerald-500 to-teal-700',
    iconText: 'Ⓝ',
    decimals: 3,
  },
  {
    symbol: 'LINKUSDT',
    baseAsset: 'LINK',
    quoteAsset: 'USDT',
    displayName: 'LINK / USDT',
    arabicName: 'تشين لينك (Chainlink)',
    category: 'ORACLE_INFRA',
    description: 'Standard Web3 Oracle Infrastructure, Super Clean Technical Patterns',
    arabicDescription: 'البنية التحتية للأوراكل وCCIP، يشتهر بنماذج فنية نقية جداً وكسور واضحة للهيكل',
    iconBg: 'from-blue-600 to-cyan-500',
    iconText: '⬡',
    decimals: 3,
  },
  {
    symbol: 'DOGEUSDT',
    baseAsset: 'DOGE',
    quoteAsset: 'USDT',
    displayName: 'DOGE / USDT',
    arabicName: 'دوج كوين (Dogecoin)',
    category: 'MEME',
    description: 'The Pioneer Liquidity & Community Giant with Strong Support Levels',
    arabicDescription: 'العملة الأكثر شعبية، تتميز باحترام قوي للمتوسطات المتحركة والقمم السابقة',
    iconBg: 'from-amber-400 to-yellow-600',
    iconText: 'Ð',
    decimals: 4,
  },
  {
    symbol: 'ADAUSDT',
    baseAsset: 'ADA',
    quoteAsset: 'USDT',
    displayName: 'ADA / USDT',
    arabicName: 'كاردانو (Cardano)',
    category: 'LAYER1',
    description: 'Peer-Reviewed Proof of Stake with Deep Structural Cycles',
    arabicDescription: 'مشروع كاردانو المؤسسي، ذو دورات تجميع وكسور اتجاه متوازنة على الإطارات المتوسطة',
    iconBg: 'from-blue-700 to-indigo-900',
    iconText: '₳',
    decimals: 4,
  },
  {
    symbol: 'DOTUSDT',
    baseAsset: 'DOT',
    quoteAsset: 'USDT',
    displayName: 'DOT / USDT',
    arabicName: 'بولكادوت (Polkadot)',
    category: 'LAYER1',
    description: 'Interoperability Protocol with Clear Wave Structures',
    arabicDescription: 'بروتوكول الربط بين السلاسل، يتيح موجات تصحيح واضحة ومستويات ارتداد موثوقة',
    iconBg: 'from-pink-600 to-rose-700',
    iconText: '●',
    decimals: 3,
  },
  {
    symbol: 'PEPEUSDT',
    baseAsset: 'PEPE',
    quoteAsset: 'USDT',
    displayName: 'PEPE / USDT',
    arabicName: 'بيبي (Pepe)',
    category: 'MEME',
    description: 'Ultra High Beta Momentum Asset with Explosive Breakouts',
    arabicDescription: 'أعلى عملة زخماً وسيولة مضاربية مع انفجارات سعرية واضحة للكسور الفنية',
    iconBg: 'from-green-500 to-emerald-700',
    iconText: 'P',
    decimals: 7,
  },
  {
    symbol: 'SHIBUSDT',
    baseAsset: 'SHIB',
    quoteAsset: 'USDT',
    displayName: 'SHIB / USDT',
    arabicName: 'شيبا إينو (Shiba Inu)',
    category: 'MEME',
    description: 'Massive Global Community Ecosystem with Deep Liquidity',
    arabicDescription: 'منظومة شيبا العالمية ذات السيولة الضخمة والارتدادات الحادة على مستويات الدعم',
    iconBg: 'from-orange-500 to-amber-600',
    iconText: 'SH',
    decimals: 7,
  },
  {
    symbol: 'LTCUSDT',
    baseAsset: 'LTC',
    quoteAsset: 'USDT',
    displayName: 'LTC / USDT',
    arabicName: 'لايتكوين (Litecoin)',
    category: 'MAJOR',
    description: 'Digital Silver with High Reliability & Clean Technical Breakouts',
    arabicDescription: 'الفضة الرقمية وواحدة من أقدم العملات، ذات قنوات سعرية هندسية واضحة',
    iconBg: 'from-slate-500 to-slate-700',
    iconText: 'Ł',
    decimals: 2,
  },
  {
    symbol: 'APTUSDT',
    baseAsset: 'APT',
    quoteAsset: 'USDT',
    displayName: 'APT / USDT',
    arabicName: 'أبتوس (Aptos)',
    category: 'LAYER1',
    description: 'Ultra Fast Move-Based Layer 1 with High Institutional Inflow',
    arabicDescription: 'شبكة الجيل الجديد بلغة Move ذات سرعة معالجة عالية وزخم مضاربي قوي',
    iconBg: 'from-teal-500 to-emerald-600',
    iconText: '⩓',
    decimals: 3,
  },
  {
    symbol: 'INJUSDT',
    baseAsset: 'INJ',
    quoteAsset: 'USDT',
    displayName: 'INJ / USDT',
    arabicName: 'إنجكتيف (Injective)',
    category: 'DEFI',
    description: 'DeFi & Derivatives Specialized Layer 1 with Powerful Trend Consistency',
    arabicDescription: 'بلوكتشين المشتقات والتمويل اللامركزي ذو الاتجاهات السعرية الواضحة',
    iconBg: 'from-cyan-600 to-blue-700',
    iconText: 'INJ',
    decimals: 3,
  },
  {
    symbol: 'RENDERUSDT',
    baseAsset: 'RENDER',
    quoteAsset: 'USDT',
    displayName: 'RENDER / USDT',
    arabicName: 'ريندر (Render AI)',
    category: 'HIGH_MOMENTUM',
    description: 'Decentralized GPU Compute & AI Narrative Leader',
    arabicDescription: 'رائد الحوسبة اللامركزية والذكاء الاصطناعي ذو موجات صعود قوية',
    iconBg: 'from-red-500 to-rose-700',
    iconText: 'R',
    decimals: 3,
  },
  {
    symbol: 'AAVEUSDT',
    baseAsset: 'AAVE',
    quoteAsset: 'USDT',
    displayName: 'AAVE / USDT',
    arabicName: 'آفي (Aave Protocol)',
    category: 'DEFI',
    description: 'Premier Global Liquidity & Lending Market Leader',
    arabicDescription: 'بروتوكول الإقراض اللامركزي الأول عالمياً ذو احترام هيكلي عالي للمستويات',
    iconBg: 'from-purple-600 to-indigo-700',
    iconText: 'A',
    decimals: 2,
  },
  {
    symbol: 'WIFUSDT',
    baseAsset: 'WIF',
    quoteAsset: 'USDT',
    displayName: 'WIF / USDT',
    arabicName: 'دوج ويف هات (WIF)',
    category: 'MEME',
    description: 'Top Solana Ecosystem Meme with High Volatility & Sharp Trend Swings',
    arabicDescription: 'عملة سولانا الشعبية ذات التقلبات السعرية العالية والفرص المضاربية السريعة',
    iconBg: 'from-amber-600 to-yellow-700',
    iconText: 'W',
    decimals: 4,
  },
  {
    symbol: 'FETUSDT',
    baseAsset: 'FET',
    quoteAsset: 'USDT',
    displayName: 'FET / USDT',
    arabicName: 'فيتش إيه آي (Fetch AI)',
    category: 'HIGH_MOMENTUM',
    description: 'Autonomous AI Agent Economy & Superintelligence Alliance',
    arabicDescription: 'تحالف الذكاء الاصطناعي الفائق ذو الزخم التداولي والتوافق الفني',
    iconBg: 'from-blue-600 to-teal-500',
    iconText: 'F',
    decimals: 4,
  },
];

/**
 * Find pair metadata by symbol
 */
export function getTradingPair(symbol: string): TradingPair | undefined {
  const norm = (symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return RESPECTED_TRADING_PAIRS.find((p) => p.symbol === norm);
}

/**
 * Format any cryptocurrency price according to its real magnitude & symbol precision
 */
export function formatCoinPrice(price: number | null | undefined, symbol?: string): string {
  if (price === null || price === undefined || isNaN(price)) return '0.00';
  
  const pair = symbol ? getTradingPair(symbol) : undefined;
  
  if (price >= 1000) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 50) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 1) {
    const maxDec = Math.min(20, Math.max(2, pair?.decimals ?? 3));
    const minDec = Math.min(2, maxDec);
    return price.toLocaleString(undefined, { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
  }
  if (price >= 0.01) {
    const maxDec = Math.min(20, Math.max(2, pair?.decimals ?? 4));
    const minDec = Math.min(2, maxDec);
    return price.toLocaleString(undefined, { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
  }
  if (price >= 0.0001) {
    return price.toFixed(6);
  }
  const maxDec = Math.min(20, Math.max(2, pair?.decimals ?? 8));
  return price.toFixed(maxDec);
}

/**
 * Round a price mathematically preserving full decimal integrity for any coin
 */
export function roundPriceByMagnitude(val: number, symbol?: string): number {
  if (val >= 1000) return Math.round(val * 100) / 100;
  if (val >= 50) return Math.round(val * 100) / 100;
  if (val >= 1) return Math.round(val * 1000) / 1000;
  if (val >= 0.01) return Math.round(val * 10000) / 10000;
  if (val >= 0.0001) return Math.round(val * 1000000) / 1000000;
  return Math.round(val * 100000000) / 100000000;
}
