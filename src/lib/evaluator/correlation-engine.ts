import type { ModuleAggregate, ReviewSnapshot } from '@/lib/feature-matrix-db';
import type { AnalyticsDashboard, ModuleStats } from '@/types/session-analytics';
import type { EvaluatorReport, ModuleScore } from '@/types/evaluator';

// ─── Correlation types ───────────────────────────────────────────────────────

export interface ModuleCorrelation {
  moduleId: string;
  label: string;
  // Quality data
  avgQuality: number | null;
  pctComplete: number;
  totalFeatures: number;
  implemented: number;
  partial: number;
  missing: number;
  // Dependency data
  blockedCount: number;
  dependencyCount: number;
  // Session analytics
  sessionCount: number;
  successRate: number;
  avgDurationMs: number;
  // Scanner data
  scannerScore: number | null;
  issueCount: number;
  // Derived
  hasData: boolean;
}

export interface CorrelationResult {
  modules: ModuleCorrelation[];
  timestamp: number;
}

// ─── Module labels (shared constant) ─────────────────────────────────────────

export const MODULE_LABELS: Record<string, string> = {
  'arpg-character': 'Character',
  'arpg-animation': 'Animation',
  'arpg-gas': 'GAS',
  'arpg-combat': 'Combat',
  'arpg-enemy-ai': 'Enemy AI',
  'arpg-inventory': 'Inventory',
  'arpg-loot': 'Loot',
  'arpg-ui': 'UI / HUD',
  'arpg-progression': 'Progression',
  'arpg-world': 'World',
  'arpg-save': 'Save',
  'arpg-polish': 'Polish',
};

// ─── Correlation engine ──────────────────────────────────────────────────────

export function correlateModuleData(
  aggregates: ModuleAggregate[],
  analytics: AnalyticsDashboard | null,
  scanReport: EvaluatorReport | null,
  depBlockedMap: Map<string, number>,
  depCountMap: Map<string, number>,
): CorrelationResult {
  const aggMap = new Map(aggregates.map((a) => [a.moduleId, a]));
  const analyticsMap = new Map<string, ModuleStats>(
    (analytics?.moduleStats ?? []).map((ms) => [ms.moduleId, ms]),
  );
  const scanMap = new Map<string, ModuleScore>(
    (scanReport?.moduleScores ?? []).map((ms) => [ms.moduleId, ms]),
  );

  // Collect all module IDs from all sources
  const allModuleIds = new Set<string>();
  for (const a of aggregates) allModuleIds.add(a.moduleId);
  for (const ms of analytics?.moduleStats ?? []) allModuleIds.add(ms.moduleId);
  for (const ms of scanReport?.moduleScores ?? []) allModuleIds.add(ms.moduleId);
  for (const id of Object.keys(MODULE_LABELS)) allModuleIds.add(id);

  const modules: ModuleCorrelation[] = [];

  for (const moduleId of allModuleIds) {
    const agg = aggMap.get(moduleId);
    const session = analyticsMap.get(moduleId);
    const scan = scanMap.get(moduleId);

    const totalFeatures = agg?.total ?? 0;
    const implemented = agg?.implemented ?? 0;
    const pctComplete = totalFeatures > 0 ? implemented / totalFeatures : 0;

    const hasQuality = agg != null && agg.avgQuality != null;
    const hasSession = session != null && session.totalSessions > 0;
    const hasScan = scan != null;

    modules.push({
      moduleId,
      label: MODULE_LABELS[moduleId] ?? moduleId,
      avgQuality: agg?.avgQuality ?? null,
      pctComplete,
      totalFeatures,
      implemented,
      partial: agg?.partial ?? 0,
      missing: agg?.missing ?? 0,
      blockedCount: depBlockedMap.get(moduleId) ?? 0,
      dependencyCount: depCountMap.get(moduleId) ?? 0,
      sessionCount: session?.totalSessions ?? 0,
      successRate: session?.successRate ?? 0,
      avgDurationMs: session?.avgDurationMs ?? 0,
      scannerScore: scan?.score ?? null,
      issueCount: scan?.issues.length ?? 0,
      hasData: hasQuality || hasSession || hasScan,
    });
  }

  // Sort by label for consistent ordering
  modules.sort((a, b) => a.label.localeCompare(b.label));

  return { modules, timestamp: Date.now() };
}
