import { kv } from '../db';
import { RiskAuditEntry, RiskDecision } from './types';

export class AuditTrail {
  private static inMemoryLogs: RiskAuditEntry[] = [];
  private static isInitialized = false;

  public static async init() {
    if (this.isInitialized) return;
    try {
      const stored = await kv.get('risk_audit_log_entries');
      if (stored) {
        this.inMemoryLogs = JSON.parse(stored);
      }
      this.isInitialized = true;
    } catch {
      this.isInitialized = true;
    }
  }

  /**
   * Record a new risk evaluation decision in the audit trail
   */
  public static record(entry: RiskAuditEntry) {
    this.inMemoryLogs.unshift(entry);
    if (this.inMemoryLogs.length > 500) {
      this.inMemoryLogs = this.inMemoryLogs.slice(0, 500);
    }
    // Async persist top 100 entries to KV store
    kv.set('risk_audit_log_entries', JSON.stringify(this.inMemoryLogs.slice(0, 100))).catch(() => {});
  }

  /**
   * Query recent audit records with filter support
   */
  public static getLogs(
    optionsOrLimit: number | { limit?: number; offset?: number; symbol?: string; decision?: RiskDecision } = 50,
    filterDecision?: RiskDecision
  ): RiskAuditEntry[] {
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

    let filtered = this.inMemoryLogs;
    if (decisionFilter) {
      filtered = filtered.filter(e => e.decision === decisionFilter);
    }
    if (symbolFilter) {
      filtered = filtered.filter(e => e.symbol.toUpperCase() === symbolFilter?.toUpperCase());
    }

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get aggregate audit statistics
   */
  public static getStats(): { totalEvaluations: number; approvedCount: number; rejectedCount: number; approvalRatePercent: number } {
    const total = this.inMemoryLogs.length;
    const approved = this.inMemoryLogs.filter(e => e.decision === 'APPROVED').length;
    const rejected = this.inMemoryLogs.filter(e => e.decision === 'REJECTED').length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 100;

    return {
      totalEvaluations: total,
      approvedCount: approved,
      rejectedCount: rejected,
      approvalRatePercent: approvalRate
    };
  }
}
