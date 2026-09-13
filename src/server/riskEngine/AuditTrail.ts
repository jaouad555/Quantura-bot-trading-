import db, { kv } from '../db';
import { RiskAuditEntry, RiskDecision, RejectionCode } from './types';

export class AuditTrail {
  private static isInitialized = false;

  public static init() {
    if (this.isInitialized) return;
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS risk_audit_log (
          id TEXT PRIMARY KEY,
          timestamp INTEGER,
          symbol TEXT,
          side TEXT,
          marketType TEXT,
          decision TEXT,
          reasonCode TEXT,
          message TEXT,
          riskScore INTEGER,
          equity REAL,
          riskPercent REAL,
          riskAmountUsdt REAL,
          entryPrice REAL,
          stopLoss REAL,
          quantity REAL,
          leverage INTEGER,
          portfolioRiskPercent REAL,
          totalExposurePercent REAL,
          symbolExposurePercent REAL,
          riskReward REAL,
          volatilityRegime TEXT,
          clientOrderId TEXT
        )
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_risk_audit_timestamp ON risk_audit_log (timestamp DESC)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_risk_audit_decision ON risk_audit_log (decision)`);
      this.isInitialized = true;
    } catch (err) {
      console.error('Failed to initialize risk_audit_log table in SQLite:', err);
    }
  }

  /**
   * Record a new risk evaluation decision in the audit trail
   */
  public static record(entry: RiskAuditEntry) {
    this.init();
    try {
      const stmt = db.prepare(`
        INSERT INTO risk_audit_log (
          id, timestamp, symbol, side, marketType, decision, reasonCode, message,
          riskScore, equity, riskPercent, riskAmountUsdt, entryPrice, stopLoss,
          quantity, leverage, portfolioRiskPercent, totalExposurePercent, symbolExposurePercent,
          riskReward, volatilityRegime, clientOrderId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        entry.id,
        entry.timestamp,
        entry.symbol,
        entry.side,
        entry.marketType,
        entry.decision,
        entry.reasonCode || null,
        entry.message,
        entry.riskScore,
        entry.equity,
        entry.riskPercent,
        entry.riskAmountUsdt,
        entry.entryPrice,
        entry.stopLoss,
        entry.quantity,
        entry.leverage,
        entry.portfolioRiskPercent,
        entry.totalExposurePercent,
        entry.symbolExposurePercent,
        entry.riskReward,
        entry.volatilityRegime,
        entry.clientOrderId || null
      );
    } catch (err) {
      console.error('Error recording risk audit log:', err);
    }
  }

  /**
   * Query recent audit records with filter support
   */
  public static getLogs(
    optionsOrLimit: number | { limit?: number; offset?: number; symbol?: string; decision?: RiskDecision } = 50,
    filterDecision?: RiskDecision
  ): RiskAuditEntry[] {
    this.init();
    try {
      let limit = 50;
      let offset = 0;
      let symbolFilter: string | undefined;
      let decisionFilter = filterDecision;

      if (typeof optionsOrLimit === 'number') {
        limit = optionsOrLimit;
      } else if (typeof optionsOrLimit === 'object' && optionsOrLimit !== null) {
        limit = optionsOrLimit.limit || 50;
        offset = optionsOrLimit.offset || 0;
        symbolFilter = optionsOrLimit.symbol;
        if (optionsOrLimit.decision) decisionFilter = optionsOrLimit.decision;
      }

      let query = 'SELECT * FROM risk_audit_log WHERE 1=1';
      const params: any[] = [];
      if (decisionFilter) {
        query += ' AND decision = ?';
        params.push(decisionFilter);
      }
      if (symbolFilter) {
        query += ' AND symbol = ?';
        params.push(symbolFilter);
      }
      query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as any[];
      return rows.map(r => ({
        id: r.id,
        auditId: r.id,
        timestamp: r.timestamp,
        symbol: r.symbol,
        side: r.side,
        marketType: r.marketType,
        decision: r.decision,
        reasonCode: r.reasonCode,
        message: r.message,
        riskScore: r.riskScore,
        equity: r.equity,
        riskPercent: r.riskPercent,
        riskAmountUsdt: r.riskAmountUsdt,
        entryPrice: r.entryPrice,
        stopLoss: r.stopLoss,
        quantity: r.quantity,
        leverage: r.leverage,
        portfolioRiskPercent: r.portfolioRiskPercent,
        totalExposurePercent: r.totalExposurePercent,
        symbolExposurePercent: r.symbolExposurePercent,
        riskReward: r.riskReward,
        volatilityRegime: r.volatilityRegime,
        clientOrderId: r.clientOrderId,
      }));
    } catch (err) {
      console.error('Error fetching risk audit logs:', err);
      return [];
    }
  }

  /**
   * Get aggregate audit statistics
   */
  public static getStats(): { totalEvaluations: number; approvedCount: number; rejectedCount: number; approvalRatePercent: number } {
    this.init();
    try {
      const stmt = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN decision = 'APPROVED' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN decision = 'REJECTED' THEN 1 ELSE 0 END) as rejected
        FROM risk_audit_log
      `);
      const row = stmt.get() as any;
      const total = row?.total || 0;
      const approved = row?.approved || 0;
      const rejected = row?.rejected || 0;
      const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 100;
      return {
        totalEvaluations: total,
        approvedCount: approved,
        rejectedCount: rejected,
        approvalRatePercent: approvalRate
      };
    } catch (err) {
      console.error('Error calculating audit statistics:', err);
      return { totalEvaluations: 0, approvedCount: 0, rejectedCount: 0, approvalRatePercent: 100 };
    }
  }
}
