import { kv } from '../db';
import { RiskAuditEntry, RiskDecision, buildRiskScopeKey } from './types';

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
    const scopeKey = entry.scopeKey || buildRiskScopeKey(entry.executionMode, entry.marketType);
    const enriched: RiskAuditEntry = {
      ...entry,
      executionMode: entry.executionMode || 'PAPER',
      marketType: entry.marketType || 'FUTURES',
      scopeKey,
    };
    this.inMemoryLogs.unshift(enriched);
    if (this.inMemoryLogs.length > 1000) {
      this.inMemoryLogs = this.inMemoryLogs.slice(0, 1000);
    }
    // Async persist top 250 entries to KV store
    kv.set('risk_audit_log_entries', JSON.stringify(this.inMemoryLogs.slice(0, 250))).catch(() => {});
  }

  /**
   * Query recent audit records with filter support (strictly isolated by executionMode & marketType when provided)
   */
  public static getLogs(
    optionsOrLimit:
      | number
      | {
          limit?: number;
          offset?: number;
          symbol?: string;
          decision?: RiskDecision;
          executionMode?: string;
          marketType?: string;
          scopeKey?: string;
        } = 50,
    filterDecision?: RiskDecision
  ): RiskAuditEntry[] {
    let limit = 50;
    let offset = 0;
    let symbolFilter: string | undefined;
    let decisionFilter = filterDecision;
    let modeFilter: string | undefined;
    let marketFilter: string | undefined;
    let scopeFilter: string | undefined;

    if (typeof optionsOrLimit === 'number') {
      limit = optionsOrLimit;
    } else if (typeof optionsOrLimit === 'object' && optionsOrLimit !== null) {
      limit = optionsOrLimit.limit || 50;
      offset = optionsOrLimit.offset || 0;
      symbolFilter = optionsOrLimit.symbol;
      if (optionsOrLimit.decision) decisionFilter = optionsOrLimit.decision;
      modeFilter = optionsOrLimit.executionMode;
      marketFilter = optionsOrLimit.marketType;
      scopeFilter = optionsOrLimit.scopeKey;
    }

    let filtered = this.inMemoryLogs;
    if (scopeFilter) {
      filtered = filtered.filter(
        e => (e.scopeKey || buildRiskScopeKey(e.executionMode, e.marketType)) === scopeFilter
      );
    } else {
      if (modeFilter) {
        filtered = filtered.filter(e => (e.executionMode || 'PAPER') === modeFilter);
      }
      if (marketFilter) {
        filtered = filtered.filter(e => (e.marketType || 'FUTURES').toUpperCase() === marketFilter.toUpperCase());
      }
    }
    if (decisionFilter) {
      filtered = filtered.filter(e => e.decision === decisionFilter);
    }
    if (symbolFilter) {
      filtered = filtered.filter(e => e.symbol.toUpperCase() === symbolFilter?.toUpperCase());
    }

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get aggregate audit statistics for a specific scope or overall
   */
  public static getStats(filter?: {
    executionMode?: string;
    marketType?: string;
    scopeKey?: string;
  }): { totalEvaluations: number; approvedCount: number; rejectedCount: number; approvalRatePercent: number } {
    let logs = this.inMemoryLogs;
    if (filter) {
      if (filter.scopeKey) {
        logs = logs.filter(
          e => (e.scopeKey || buildRiskScopeKey(e.executionMode, e.marketType)) === filter.scopeKey
        );
      } else {
        if (filter.executionMode) {
          logs = logs.filter(e => (e.executionMode || 'PAPER') === filter.executionMode);
        }
        if (filter.marketType) {
          logs = logs.filter(e => (e.marketType || 'FUTURES').toUpperCase() === filter.marketType?.toUpperCase());
        }
      }
    }

    const total = logs.length;
    const approved = logs.filter(e => e.decision === 'APPROVED').length;
    const rejected = logs.filter(e => e.decision === 'REJECTED').length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 100;

    return {
      totalEvaluations: total,
      approvedCount: approved,
      rejectedCount: rejected,
      approvalRatePercent: approvalRate,
    };
  }

  /**
   * Clear audit records (either for a specific scope or all) and sync to storage
   */
  public static async clear(filter?: {
    executionMode?: string;
    marketType?: string;
    scopeKey?: string;
  }): Promise<void> {
    if (filter && (filter.scopeKey || filter.executionMode || filter.marketType)) {
      const targetScope =
        filter.scopeKey ||
        (filter.executionMode && filter.marketType
          ? buildRiskScopeKey(filter.executionMode, filter.marketType)
          : undefined);

      this.inMemoryLogs = this.inMemoryLogs.filter(e => {
        const entryScope = e.scopeKey || buildRiskScopeKey(e.executionMode, e.marketType);
        if (targetScope) return entryScope !== targetScope;
        if (filter.executionMode && (e.executionMode || 'PAPER') === filter.executionMode) return false;
        if (filter.marketType && (e.marketType || 'FUTURES').toUpperCase() === filter.marketType.toUpperCase()) return false;
        return true;
      });

      try {
        await kv.set('risk_audit_log_entries', JSON.stringify(this.inMemoryLogs.slice(0, 250)));
      } catch {
        // non-fatal
      }
      return;
    }

    this.inMemoryLogs = [];
    try {
      await kv.delete('risk_audit_log_entries');
    } catch {
      // non-fatal
    }
  }
}

