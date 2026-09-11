# ⚡ Quantura | Institutional Algorithmic Crypto Trading Terminal & Autonomous Bot

![License: All Rights Reserved](https://img.shields.io/badge/License-All_Rights_Reserved-red.svg?style=for-the-badge)
![Status: Proprietary](https://img.shields.io/badge/Access-Proprietary_Software-blueviolet?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-2.5.0-cyan?style=for-the-badge)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Binance](https://img.shields.io/badge/Binance_API-F3BA2F?style=for-the-badge&logo=binance&logoColor=black)

**Quantura** is an institutional-grade algorithmic cryptocurrency trading terminal and autonomous bot execution system. Designed for high-frequency market analysis and capital efficiency across **Binance Spot** and **Binance USDT-M Futures**, the platform combines multi-factor mathematical models, real-time liquidity depth analysis, autonomous risk-shielding protocols, and deterministic historical backtesting.

---

## 🔒 Copyright & Proprietary Notice

> **CONFIDENTIAL & PROPRIETARY**  
> Copyright © 2026 **Jaouad Abdechchafi**. All Rights Reserved.  
> 
> This software, including its source code, documentation, algorithms, visual design, and user interface, is the exclusive intellectual property of the copyright holder. 
> 
> **Strict Restrictions:**
> - No part of this software may be copied, reproduced, reverse-engineered, decompiled, distributed, publicly displayed, or transmitted in any form or by any means without prior written permission from the copyright owner.
> - Unauthorized commercial use, resale, sublicensing, or deployment of this software or its algorithms is strictly prohibited and subject to legal prosecution.

---

## 🌟 Core Architecture & Capabilities

### 1. 📊 Quant Signal Engine
* **Market Regime Detection:** Mathematical identification of macro trend structures (Strong Bullish, Bearish, Squeeze Ranges, and High-Volatility regimes).
* **Multi-Factor Scoring Matrix:** Continuous evaluation across Exponential Moving Averages (EMA 20/50/100/200, SMA 200), momentum oscillators (RSI, Stochastic, MACD), and institutional volume indicators (VWAP, Order Book Imbalance).
* **Deterministic Execution Plan:** Computes real-time Entry Zones, Multi-Target Take Profits (TP1, TP2, TP3), Strict Stop-Loss thresholds, and Risk-to-Reward (R:R) ratios.
* **Multilingual AI Technical Reporting:** Real-time trade rationales generated in Arabic, French, and English.

### 2. 🤖 Autonomous Trading Bot (24/7 Execution)
* **Pre-Engineered Strategy Presets:** One-click configurations for `Momentum Trend`, `Fast Scalper`, `Breakout Sniper`, `Mean Reversion`, `Smart Money Concepts (SMC)`, and `Conservative Swing`.
* **Dynamic Adaptive Timeframe (AUTO Mode):** Autonomously recalibrates execution timeframes (from 15m to 4h) depending on prevailing volatility states to mitigate market noise.
* **Scale-Out Profit Securing:** Automatically realizes 50% profit at TP1 and repositions the Stop Loss to Breakeven (0% risk).
* **Smart Rebuy Engine:** Re-allocates contracts dynamically during healthy corrective pullbacks post-TP1.

### 3. 🛡️ Capital Shield & Risk Mitigation
* **Automated Daily Circuit Breaker:** Hard-stops bot execution if cumulative daily drawdown reaches the predefined limit (e.g., 5%).
* **Trailing Stop-Loss & Trailing Take-Profit (TTP):** Locks in floating profits dynamically as the market trends favorably.
* **Slippage & Spread Guard:** Blocks order dispatch if the bid/ask spread or liquidity depth is suboptimal.
* **Anti-Hedging Rules & Position Caps:** Prevents conflicting positions and enforces strict maximum concurrent trade limits.
* **Panic Close All:** Immediate, single-click market liquidation across all open contracts for sudden risk-off market events.

### 4. 📈 Institutional Backtesting Suite
* **24-Month Binance Depth:** Quantitative backtesting against authentic historical candlestick datasets.
* **Multi-Asset Portfolio Stress Testing:** Evaluates individual assets or composite token baskets factoring in realistic exchange fees, leverage, and slippage models.
* **Performance Analytics:** In-depth tracking of Win Rate, Profit Factor, Max Drawdown, Sharpe-like metrics, and full CSV exports.

### 5. 🔐 Enterprise Security & Integrations
* **Dual Execution Modes:** Zero-risk Paper Trading simulator alongside authenticated Binance Live API execution.
* **Military-Grade Key Security:** Client-side AES-256-CBC credential encryption with HMAC-SHA256 signature authorization.
* **Telegram Integration:** Direct push-notification delivery for order placements, trailing trigger hits, and risk events.
* **Access Hardening:** RFC 6238 TOTP Two-Factor Authentication (Google Authenticator / Authy).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19, TypeScript, Vite, Tailwind CSS 4 |
| **Interactive Visuals** | TradingView Lightweight Charts, Recharts, Framer Motion |
| **Application Server** | Node.js, Express.js |
| **Local Persistence** | SQLite (WAL Mode via `better-sqlite3`) |
| **Real-Time Data** | Binance Native WebSocket Streams |
| **Cryptographic Security** | AES-256-CBC, HMAC-SHA256, OTPAuth (2FA) |

---

## ⚙️ Environment Configuration

For authorized operators configuring a production instance, define the following variables in your `.env` configuration:

```env
PORT=3000
NODE_ENV=production
# Optional: Model API Key for AI Analysis Summaries
GEMINI_API_KEY=your_secure_api_key_here
