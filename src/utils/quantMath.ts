/**
 * Quantura Quantitative Mathematical Engine
 * Rigorous deterministic calculations for Spot and USDT-M Perpetual Futures
 */

export interface SpotOrderCalculation {
  marketType: 'SPOT';
  quantity: number;
  totalCostUsdt: number;
  estimatedFeeUsdt: number;
  stopLossDistancePercent: number;
  potentialProfitUsdt: number;
  potentialLossUsdt: number;
  riskRewardRatio: number;
}

export interface FuturesOrderCalculation {
  marketType: 'FUTURES';
  side: 'LONG' | 'SHORT';
  leverage: number;
  quantity: number;
  notionalValueUsdt: number;
  initialMarginUsdt: number;
  maintenanceMarginUsdt: number;
  liquidationPrice: number;
  distanceToLiquidationPercent: number;
  estimatedFeeUsdt: number;
  stopLossDistancePercent: number;
  potentialLossUsdt: number;
  potentialProfitTp1Usdt: number;
  potentialProfitTp2Usdt: number;
  potentialProfitTp3Usdt: number;
  riskRewardRatio: number;
  isLiquidationSafe: boolean; // True if SL is hit before Liquidation Price
}

export class QuantMath {
  // Binance standard fee rates
  public static readonly SPOT_TAKER_FEE = 0.001; // 0.10%
  public static readonly SPOT_MAKER_FEE = 0.001; // 0.10%
  public static readonly FUTURES_TAKER_FEE = 0.0004; // 0.04%
  public static readonly FUTURES_MAKER_FEE = 0.0002; // 0.02%
  public static readonly DEFAULT_FUTURES_MMR = 0.005; // 0.50% Maintenance Margin Ratio

  /**
   * Calculate Spot Trade Parameters (Strictly 1x Leverage, Cash Based)
   */
  public static calculateSpotOrder(params: {
    capitalUsdt: number;
    allocationPercent: number; // e.g. 20%
    entryPrice: number;
    stopLossPrice: number;
    tp1Price: number;
    customQuantity?: number;
  }): SpotOrderCalculation {
    const { capitalUsdt, allocationPercent, entryPrice, stopLossPrice, tp1Price, customQuantity } = params;
    
    const allocatedCapital = (capitalUsdt * Math.max(1, Math.min(100, allocationPercent))) / 100;
    const price = Math.max(0.000001, entryPrice);
    const quantity = customQuantity && customQuantity > 0 ? customQuantity : allocatedCapital / price;
    const totalCostUsdt = quantity * price;
    const estimatedFeeUsdt = totalCostUsdt * this.SPOT_TAKER_FEE;

    const slDistance = Math.abs(price - stopLossPrice);
    const stopLossDistancePercent = price > 0 ? (slDistance / price) * 100 : 0;
    const potentialLossUsdt = quantity * slDistance + estimatedFeeUsdt;

    const tp1Distance = Math.max(0, tp1Price - price);
    const potentialProfitUsdt = quantity * tp1Distance - estimatedFeeUsdt;

    const riskRewardRatio = potentialLossUsdt > 0 ? potentialProfitUsdt / potentialLossUsdt : 0;

    return {
      marketType: 'SPOT',
      quantity,
      totalCostUsdt,
      estimatedFeeUsdt,
      stopLossDistancePercent,
      potentialProfitUsdt: Math.max(0, potentialProfitUsdt),
      potentialLossUsdt: Math.max(0, potentialLossUsdt),
      riskRewardRatio: Math.max(0, Math.round(riskRewardRatio * 100) / 100),
    };
  }

  /**
   * Calculate USDT-M Perpetual Futures Parameters
   * Includes Notional Value, Isolated Margin, Maintenance Margin, and Exact Liquidation Price
   */
  public static calculateFuturesOrder(params: {
    side: 'LONG' | 'SHORT';
    capitalUsdt: number;
    allocationPercent: number; // e.g. 20%
    leverage: number; // 1x - 50x
    entryPrice: number;
    stopLossPrice: number;
    tp1Price: number;
    tp2Price?: number;
    tp3Price?: number;
    customMarginUsdt?: number;
    maintenanceMarginRatio?: number;
  }): FuturesOrderCalculation {
    const {
      side,
      capitalUsdt,
      allocationPercent,
      leverage: rawLeverage,
      entryPrice: rawEntry,
      stopLossPrice: rawSl,
      tp1Price: rawTp1,
      tp2Price,
      tp3Price,
      customMarginUsdt,
      maintenanceMarginRatio = this.DEFAULT_FUTURES_MMR,
    } = params;

    const leverage = Math.max(1, Math.min(50, rawLeverage || 10));
    const entryPrice = Math.max(0.000001, rawEntry);
    const stopLossPrice = Math.max(0.000001, rawSl);
    const tp1Price = Math.max(0.000001, rawTp1);

    // Initial Margin calculation
    const allocatedMargin = customMarginUsdt && customMarginUsdt > 0
      ? customMarginUsdt
      : (capitalUsdt * Math.max(1, Math.min(100, allocationPercent))) / 100;
    
    const initialMarginUsdt = Math.max(1, allocatedMargin);
    const notionalValueUsdt = initialMarginUsdt * leverage;
    const quantity = notionalValueUsdt / entryPrice;
    const maintenanceMarginUsdt = notionalValueUsdt * maintenanceMarginRatio;

    // Exact Liquidation Price Formula (Binance USDT-M Futures Standard):
    // For Isolated Margin:
    // LONG: LiqPrice = EntryPrice * (1 - (1 / Leverage) + MMR)
    // SHORT: LiqPrice = EntryPrice * (1 + (1 / Leverage) - MMR)
    let liquidationPrice = 0;
    if (side === 'LONG') {
      liquidationPrice = entryPrice * (1 - (1 / leverage) + maintenanceMarginRatio);
    } else {
      liquidationPrice = entryPrice * (1 + (1 / leverage) - maintenanceMarginRatio);
    }
    liquidationPrice = Math.max(0, liquidationPrice);

    const distanceToLiquidationPercent = entryPrice > 0
      ? (Math.abs(entryPrice - liquidationPrice) / entryPrice) * 100
      : 0;

    // Fees: Entry + Exit Taker Fee on Notional Value
    const estimatedFeeUsdt = notionalValueUsdt * this.FUTURES_TAKER_FEE * 2;

    // Stop Loss calculations
    const slPriceDiff = Math.abs(entryPrice - stopLossPrice);
    const stopLossDistancePercent = entryPrice > 0 ? (slPriceDiff / entryPrice) * 100 : 0;
    const potentialLossUsdt = (slPriceDiff * quantity) + estimatedFeeUsdt;

    // Target Profit calculations
    const tp1Diff = Math.abs(tp1Price - entryPrice);
    const potentialProfitTp1Usdt = Math.max(0, (tp1Diff * quantity) - estimatedFeeUsdt);

    const tp2Diff = tp2Price ? Math.abs(tp2Price - entryPrice) : tp1Diff * 1.5;
    const potentialProfitTp2Usdt = Math.max(0, (tp2Diff * quantity) - estimatedFeeUsdt);

    const tp3Diff = tp3Price ? Math.abs(tp3Price - entryPrice) : tp1Diff * 2.2;
    const potentialProfitTp3Usdt = Math.max(0, (tp3Diff * quantity) - estimatedFeeUsdt);

    const riskRewardRatio = potentialLossUsdt > 0 ? potentialProfitTp1Usdt / potentialLossUsdt : 0;

    // Safety check: Does Stop Loss trigger before liquidation occurs?
    const isLiquidationSafe = side === 'LONG'
      ? stopLossPrice > liquidationPrice
      : stopLossPrice < liquidationPrice;

    return {
      marketType: 'FUTURES',
      side,
      leverage,
      quantity,
      notionalValueUsdt,
      initialMarginUsdt,
      maintenanceMarginUsdt,
      liquidationPrice: Math.round(liquidationPrice * 100) / 100,
      distanceToLiquidationPercent: Math.round(distanceToLiquidationPercent * 100) / 100,
      estimatedFeeUsdt: Math.round(estimatedFeeUsdt * 100) / 100,
      stopLossDistancePercent: Math.round(stopLossDistancePercent * 100) / 100,
      potentialLossUsdt: Math.round(potentialLossUsdt * 100) / 100,
      potentialProfitTp1Usdt: Math.round(potentialProfitTp1Usdt * 100) / 100,
      potentialProfitTp2Usdt: Math.round(potentialProfitTp2Usdt * 100) / 100,
      potentialProfitTp3Usdt: Math.round(potentialProfitTp3Usdt * 100) / 100,
      riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
      isLiquidationSafe,
    };
  }

  /**
   * Real-time Gross and Net ROE% Calculator for Open Positions
   */
  public static calculatePositionROE(params: {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    currentPrice: number;
    leverage: number;
    initialMarginUsdt: number;
    marketType?: 'SPOT' | 'FUTURES';
    fundingRatePaidUsdt?: number;
  }): {
    unrealizedPnlUsdt: number;
    grossRoePercent: number;
    netRoePercent: number;
    priceDeltaPercent: number;
  } {
    const { side, entryPrice, currentPrice, leverage, initialMarginUsdt, marketType = 'FUTURES', fundingRatePaidUsdt = 0 } = params;
    if (entryPrice <= 0 || initialMarginUsdt <= 0) {
      return { unrealizedPnlUsdt: 0, grossRoePercent: 0, netRoePercent: 0, priceDeltaPercent: 0 };
    }

    const isSpot = marketType === 'SPOT';
    const effectiveLev = isSpot ? 1 : Math.max(1, leverage);
    const notional = initialMarginUsdt * effectiveLev;
    const quantity = notional / entryPrice;

    let deltaPrice = 0;
    if (side === 'LONG') {
      deltaPrice = currentPrice - entryPrice;
    } else {
      deltaPrice = isSpot ? 0 : (entryPrice - currentPrice);
    }

    const unrealizedPnlUsdt = deltaPrice * quantity;
    const priceDeltaPercent = (deltaPrice / entryPrice) * 100;
    const grossRoePercent = priceDeltaPercent * effectiveLev;

    // Deduct estimated closing fees + funding rate cost
    const feeRate = isSpot ? this.SPOT_TAKER_FEE : this.FUTURES_TAKER_FEE;
    const totalFeesUsdt = notional * feeRate * 2;
    const netPnlUsdt = unrealizedPnlUsdt - totalFeesUsdt - fundingRatePaidUsdt;
    const netRoePercent = (netPnlUsdt / initialMarginUsdt) * 100;

    return {
      unrealizedPnlUsdt: Math.round(unrealizedPnlUsdt * 100) / 100,
      grossRoePercent: Math.round(grossRoePercent * 100) / 100,
      netRoePercent: Math.round(netRoePercent * 100) / 100,
      priceDeltaPercent: Math.round(priceDeltaPercent * 100) / 100,
    };
  }
}
