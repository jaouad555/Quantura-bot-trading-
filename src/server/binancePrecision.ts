/**
 * Binance Precision & Lot Size Rules for Spot and Futures
 * Provides authoritative stepSize, minQty, tickSize, and minNotional
 * Prevents Binance Error Code -1111 (Precision is over the maximum defined)
 * and Error Code -1013 (Filter failure: MIN_NOTIONAL / LOT_SIZE).
 */

export interface SymbolFilterRules {
  stepSize: number;       // e.g. 0.001 for BTC, 1 for DOGE/DOT
  minQty: number;         // e.g. 0.001
  minNotional: number;    // Minimum USDT value of order (5 for Futures, 10 for Spot)
  priceDecimals: number;  // Price tick precision
  qtyDecimals: number;    // Decimal places for quantity formatting
}

// Authoritative rules for top liquid pairs across Spot & Futures
const DEFAULT_RULES: Record<string, { spot: SymbolFilterRules; futures: SymbolFilterRules }> = {
  BTCUSDT: {
    spot: { stepSize: 0.00001, minQty: 0.00001, minNotional: 10, priceDecimals: 2, qtyDecimals: 5 },
    futures: { stepSize: 0.001, minQty: 0.001, minNotional: 5, priceDecimals: 1, qtyDecimals: 3 },
  },
  ETHUSDT: {
    spot: { stepSize: 0.0001, minQty: 0.0001, minNotional: 10, priceDecimals: 2, qtyDecimals: 4 },
    futures: { stepSize: 0.001, minQty: 0.001, minNotional: 5, priceDecimals: 2, qtyDecimals: 3 },
  },
  SOLUSDT: {
    spot: { stepSize: 0.01, minQty: 0.01, minNotional: 10, priceDecimals: 2, qtyDecimals: 2 },
    futures: { stepSize: 0.01, minQty: 0.01, minNotional: 5, priceDecimals: 2, qtyDecimals: 2 },
  },
  BNBUSDT: {
    spot: { stepSize: 0.001, minQty: 0.001, minNotional: 10, priceDecimals: 1, qtyDecimals: 3 },
    futures: { stepSize: 0.01, minQty: 0.01, minNotional: 5, priceDecimals: 2, qtyDecimals: 2 },
  },
  XRPUSDT: {
    spot: { stepSize: 0.1, minQty: 0.1, minNotional: 10, priceDecimals: 4, qtyDecimals: 1 },
    futures: { stepSize: 0.1, minQty: 0.1, minNotional: 5, priceDecimals: 4, qtyDecimals: 1 },
  },
  DOGEUSDT: {
    spot: { stepSize: 1, minQty: 1, minNotional: 10, priceDecimals: 5, qtyDecimals: 0 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 5, qtyDecimals: 0 },
  },
  ADAUSDT: {
    spot: { stepSize: 0.1, minQty: 0.1, minNotional: 10, priceDecimals: 4, qtyDecimals: 1 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 4, qtyDecimals: 0 },
  },
  AVAXUSDT: {
    spot: { stepSize: 0.01, minQty: 0.01, minNotional: 10, priceDecimals: 2, qtyDecimals: 2 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 3, qtyDecimals: 0 },
  },
  DOTUSDT: {
    spot: { stepSize: 0.01, minQty: 0.01, minNotional: 10, priceDecimals: 3, qtyDecimals: 2 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 3, qtyDecimals: 0 }, // Critical: Futures DOT is 0 decimals (stepSize: 1)
  },
  NEARUSDT: {
    spot: { stepSize: 0.1, minQty: 0.1, minNotional: 10, priceDecimals: 3, qtyDecimals: 1 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 3, qtyDecimals: 0 },
  },
  LINKUSDT: {
    spot: { stepSize: 0.01, minQty: 0.01, minNotional: 10, priceDecimals: 3, qtyDecimals: 2 },
    futures: { stepSize: 0.01, minQty: 0.01, minNotional: 5, priceDecimals: 3, qtyDecimals: 2 },
  },
  SUIUSDT: {
    spot: { stepSize: 0.1, minQty: 0.1, minNotional: 10, priceDecimals: 4, qtyDecimals: 1 },
    futures: { stepSize: 0.1, minQty: 0.1, minNotional: 5, priceDecimals: 4, qtyDecimals: 1 },
  },
  MATICUSDT: {
    spot: { stepSize: 0.1, minQty: 0.1, minNotional: 10, priceDecimals: 4, qtyDecimals: 1 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 4, qtyDecimals: 0 },
  },
  POLUSDT: {
    spot: { stepSize: 0.1, minQty: 0.1, minNotional: 10, priceDecimals: 4, qtyDecimals: 1 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 4, qtyDecimals: 0 },
  },
  LTCUSDT: {
    spot: { stepSize: 0.001, minQty: 0.001, minNotional: 10, priceDecimals: 2, qtyDecimals: 3 },
    futures: { stepSize: 0.001, minQty: 0.001, minNotional: 5, priceDecimals: 2, qtyDecimals: 3 },
  },
  UNIUSDT: {
    spot: { stepSize: 0.01, minQty: 0.01, minNotional: 10, priceDecimals: 3, qtyDecimals: 2 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 3, qtyDecimals: 0 },
  },
  ATOMUSDT: {
    spot: { stepSize: 0.01, minQty: 0.01, minNotional: 10, priceDecimals: 3, qtyDecimals: 2 },
    futures: { stepSize: 0.01, minQty: 0.01, minNotional: 5, priceDecimals: 3, qtyDecimals: 2 },
  },
  TRXUSDT: {
    spot: { stepSize: 1, minQty: 1, minNotional: 10, priceDecimals: 5, qtyDecimals: 0 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 5, qtyDecimals: 0 },
  },
  ETCUSDT: {
    spot: { stepSize: 0.01, minQty: 0.01, minNotional: 10, priceDecimals: 2, qtyDecimals: 2 },
    futures: { stepSize: 0.01, minQty: 0.01, minNotional: 5, priceDecimals: 3, qtyDecimals: 2 },
  },
  BCHUSDT: {
    spot: { stepSize: 0.001, minQty: 0.001, minNotional: 10, priceDecimals: 1, qtyDecimals: 3 },
    futures: { stepSize: 0.001, minQty: 0.001, minNotional: 5, priceDecimals: 2, qtyDecimals: 3 },
  },
  XLMUSDT: {
    spot: { stepSize: 1, minQty: 1, minNotional: 10, priceDecimals: 5, qtyDecimals: 0 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 5, qtyDecimals: 0 },
  },
  ALGOUSDT: {
    spot: { stepSize: 0.1, minQty: 0.1, minNotional: 10, priceDecimals: 4, qtyDecimals: 1 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 4, qtyDecimals: 0 },
  },
  VETUSDT: {
    spot: { stepSize: 1, minQty: 1, minNotional: 10, priceDecimals: 5, qtyDecimals: 0 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 5, qtyDecimals: 0 },
  },
  APTUSDT: {
    spot: { stepSize: 0.01, minQty: 0.01, minNotional: 10, priceDecimals: 3, qtyDecimals: 2 },
    futures: { stepSize: 0.1, minQty: 0.1, minNotional: 5, priceDecimals: 3, qtyDecimals: 1 },
  },
  RENDERUSDT: {
    spot: { stepSize: 0.01, minQty: 0.01, minNotional: 10, priceDecimals: 3, qtyDecimals: 2 },
    futures: { stepSize: 0.1, minQty: 0.1, minNotional: 5, priceDecimals: 3, qtyDecimals: 1 },
  },
  FETUSDT: {
    spot: { stepSize: 1, minQty: 1, minNotional: 10, priceDecimals: 4, qtyDecimals: 0 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 4, qtyDecimals: 0 },
  },
  SHIBUSDT: {
    spot: { stepSize: 1, minQty: 1, minNotional: 10, priceDecimals: 8, qtyDecimals: 0 },
    futures: { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 6, qtyDecimals: 0 },
  },
  PEPEUSDT: {
    spot: { stepSize: 1, minQty: 1, minNotional: 10, priceDecimals: 8, qtyDecimals: 0 },
    futures: { stepSize: 100, minQty: 100, minNotional: 5, priceDecimals: 7, qtyDecimals: 0 },
  },
};

/**
 * Returns accurate filter rules for a given symbol and market type.
 */
export function getSymbolFilterRules(symbol: string, marketType: 'SPOT' | 'FUTURES'): SymbolFilterRules {
  const norm = symbol.toUpperCase().replace('/', '').replace('-', '').trim();
  const pairRules = DEFAULT_RULES[norm];
  if (pairRules) {
    return marketType === 'FUTURES' ? pairRules.futures : pairRules.spot;
  }

  // Fallback defaults for unknown tokens
  if (marketType === 'FUTURES') {
    return { stepSize: 1, minQty: 1, minNotional: 5, priceDecimals: 4, qtyDecimals: 0 };
  } else {
    return { stepSize: 0.1, minQty: 0.1, minNotional: 10, priceDecimals: 4, qtyDecimals: 1 };
  }
}

/**
 * Formats a quantity strictly according to Binance LOT_SIZE stepSize rules.
 * Uses exact step truncation to guarantee zero precision rejection errors.
 */
export function formatBinancePrecisionQty(
  symbol: string,
  quantity: number,
  marketType: 'SPOT' | 'FUTURES' = 'SPOT'
): string {
  if (!quantity || isNaN(quantity) || quantity <= 0) return '0';
  const rules = getSymbolFilterRules(symbol, marketType);

  // Exact stepSize rounding: qty = Math.floor(quantity / stepSize) * stepSize
  const steps = Math.floor(quantity / rules.stepSize);
  const validQty = steps * rules.stepSize;

  if (validQty < rules.minQty) {
    return '0';
  }

  return validQty.toFixed(rules.qtyDecimals);
}

/**
 * Formats a price strictly according to tickSize price decimals.
 */
export function formatBinancePrecisionPrice(
  symbol: string,
  price: number,
  marketType: 'SPOT' | 'FUTURES' = 'SPOT'
): string {
  if (!price || isNaN(price) || price <= 0) return '0';
  const rules = getSymbolFilterRules(symbol, marketType);
  return price.toFixed(rules.priceDecimals);
}
