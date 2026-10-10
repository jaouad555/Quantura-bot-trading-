# Zero-Decimal & Meme Coin Support Architecture (PEPE, SHIB, BONK, FLOKI)

Enable institutional-grade quantitative automated trading for zero-decimal and meme cryptocurrencies across Binance Spot and USDT-M Futures, resolving precision truncation, symbol multiplier translation, and risk engine volatility gates.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following requirements:
> - **Enabled Zero Coins**: Top meme/zero-decimal assets (`PEPE`, `SHIB`, `BONK`, `FLOKI`).
> - **Markets**: Both Spot (`PEPEUSDT`, `SHIBUSDT`) and Futures with 1000x multiplier (`1000PEPEUSDT`, `1000SHIBUSDT`, `1000BONKUSDT`, `1000FLOKIUSDT`).
> - **Risk Engine Tuning**: Adapt bid-ask spread threshold (up to 1.5% for meme coins instead of the strict 0.25% BTC benchmark) and calibrate ATR regimes to accommodate meme coin price dynamics without tripping false circuit breakers.

---

## 1. Overview & Core Concept

Currently, the Quantura bot avoids or fails to execute trades on zero-decimal cryptocurrencies (such as PEPE, SHIB, BONK, and FLOKI) due to four interlocking gates:

1. **UI Whitelist Limitation**: The Bot Settings modal had a hardcoded list of 25 traditional altcoins, omitting meme coins from allowed executions.
2. **Binance Futures Multiplier Desynchronization**: Binance USDT-M Futures does not list `PEPEUSDT` or `BONKUSDT` directly; it lists them as `1000PEPEUSDT`, `1000SHIBUSDT`, `1000BONKUSDT`, and `1000FLOKIUSDT`. Without automatic translation, orders to Binance Futures fail with `Invalid Symbol` (Error -1121).
3. **Precision & Lot Size Filters**: Precision helpers previously defaulted unknown assets to 4 decimal places (`priceDecimals: 4`), which truncates sub-penny prices (e.g., $0.0000085) down to `$0.0000`, causing instant exchange filter rejection (Error -1111 / -1013).
4. **Institutional Risk Engine Constraints**: The Risk Engine enforces a strict 0.25% maximum bid-ask spread and a 7.0% maximum ATR ceiling. In sub-penny coins, a single minimum tick movement often exceeds 0.5%–1.2% in percentage spread, and volatility frequently exceeds 10%, causing the `MarketProtection` layer to reject trade proposals.

This plan addresses all four layers, enabling seamless execution across both Paper and Live/Testnet environments in Spot and Futures modes.

---

## 2. User Experience & Visual Design

### Key User Flows
- **Bot Settings Modal (`AutoTradingBot.tsx`)**:
  - The "Allowed Pairs" selection panel now features a dedicated category filter: `All`, `Major`, `Layer 1`, `DeFi`, and `Meme & Zero Coins`.
  - Badges clearly indicate meme tokens (`PEPE`, `SHIB`, `BONK`, `FLOKI`, `WIF`) with their 1000x Futures multiplier status badge (`1000x Futures`).
  - One-click "Select All Meme Coins" or individual toggle buttons with real-time persistence.
- **Active Positions & Terminal Display**:
  - Positions show accurate decimal formatting using `formatCoinPrice` (displaying up to 8 decimals for Spot and 4–6 decimals for Futures 1000x contracts) rather than rounded `$0.00`.
  - Liquidation prices, SL/TP levels, and ROE metrics format cleanly without text clipping.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Transparent Multiplier Translation (`1000x`)**:
  - *Chosen Approach*: Maintain unified `PEPE/USDT` identity on the frontend and scanner, while transparently translating to `1000PEPEUSDT` when routing orders and queries to the Binance Futures API (adjusting price $\times 1000$ and quantity $\div 1000$).
  - *Why*: Prevents cluttering the UI with two separate tokens for the same asset while guaranteeing 100% compliance with Binance Futures exchange rules.
- **Decision 2: Adaptive Meme Coin Risk Engine Profile**:
  - *Chosen Approach*: Identify tokens marked with `category: 'MEME'` or `price < 0.01` and apply a tailored risk profile:
    - Max Spread: $1.5\%$ (vs $0.25\%$ for Major pairs).
    - Normal ATR ceiling: up to $15\%$ (vs $7.0\%$ for BTC/ETH).
    - Max Quantity Cap: increased to $10,000,000,000$ units to accommodate high unit counts.
  - *Why*: Allows algorithmic trading during genuine breakout and momentum setups without discarding structural capital safety.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        QUANTURA BOT ENGINE                             │
└────────────────────────────────────────────────────────────────────────┘
                                │
         ┌──────────────────────┴──────────────────────┐
         ▼                                             ▼
┌──────────────────────────────┐              ┌─────────────────────────┐
│     Global Market Scanner    │              │   UI Whitelist & Config │
│  Monitors PEPE, SHIB, BONK   │              │  Added Meme category &  │
│  & FLOKI on Spot & Futures   │              │  zero-decimal tokens    │
└──────────────────────────────┘              └─────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Symbol Translation Layer (Bidirectional)                 │
│  Spot: PEPEUSDT                                                        │
│  Futures: 1000PEPEUSDT (Price x1000, Quantity /1000)                   │
└────────────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Risk Engine & MarketProtection (Adaptive Gate)             │
│  - Adaptive Spread Limit: 1.5% for Meme tokens                         │
│  - Adaptive ATR Regime: Accommodates high-volatility meme momentum     │
│  - Dynamic Lot Size: Up to 10B units & 8 decimal precision             │
└────────────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Execution Layer (Spot & Futures)                    │
│  - Spot: Binance API (PEPEUSDT, 8 decimals, LOT_SIZE compliant)       │
│  - Futures: Binance FAPI (1000PEPEUSDT, precision compliant)           │
│  - Paper Wallet: Accurate balance and PnL accounting                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Components & Modules to Update

1. **`src/utils/tradingPairs.ts`**:
   - Add comprehensive metadata for `PEPEUSDT`, `SHIBUSDT`, `BONKUSDT`, `FLOKIUSDT`, `WIFUSDT` with appropriate categories and decimal tags.
   - Add futures translation mapping utilities:
     - `getFuturesSymbol(spotSymbol: string): string`
     - `getSpotSymbol(futuresSymbol: string): string`
     - `isZeroDecimalCoin(symbol: string): boolean`

2. **`src/server/binancePrecision.ts`**:
   - Add exact rules for both Spot and Futures for `PEPEUSDT`, `1000PEPEUSDT`, `SHIBUSDT`, `1000SHIBUSDT`, `BONKUSDT`, `1000BONKUSDT`, `FLOKIUSDT`, `1000FLOKIUSDT`.
   - Update fallback logic to calculate dynamic price decimals based on order of magnitude ($p < 0.0001 \to 8\text{ decimals}$).

3. **`src/server/riskEngine/constants.ts` & `PositionSizer.ts` & `MarketProtection.ts`**:
   - Add symbol trading rules for zero-decimal and 1000x tokens.
   - Update `MarketProtection.ts` to apply an adaptive spread ceiling ($1.5\%$) and elevated ATR regime for meme coins.
   - Ensure `PositionSizer.ts` handles large unit counts without overflow or truncation.

4. **`src/server/marketScanner.ts` & `src/server/botEngine.ts`**:
   - Route order submissions using `toFuturesSymbol` and adjust price/quantity when `marketType === 'FUTURES'`.
   - Ensure WebSocket and REST ticker data accurately resolve both base and 1000x futures pairs.

5. **`src/components/AutoTradingBot.tsx`**:
   - Update allowed symbol selection list to include meme tokens with categorized filtering.

---

## Verification Plan

### Automated Build & Lint Check
- Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `compile_applet` (`npm run build`) to confirm full-stack bundling succeeds.

### Runtime Verification
- Verify `curl -s http://127.0.0.1:3000/api/health` returns healthy status.
- Test symbol translation and precision formatting with test payloads for `PEPEUSDT`, `1000PEPEUSDT`, `SHIBUSDT`, and `BONKUSDT`.
