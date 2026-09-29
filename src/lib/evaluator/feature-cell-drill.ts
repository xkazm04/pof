/**
 * What a Features-heatmap count means — the features behind one (module, status)
 * cell, split into what can be built now and what waits on something else.
 *
 * The Features tab already holds both inputs: the shared statusMap
 * (`useFeatureStatuses`) and the implementation plan derived from it
 * (`generatePlan`), whose `PlanItem`s carry readiness, unmet deps and impact.
 * This joins them per cell so the tab can answer "which 5 are missing, and which
 * of them can I build?" without leaving the Evaluator. Readiness is the plan's
 * own (`isFeatureDone` deps); a ready row's `buildItem` is what the ONE gated
 * dispatch door (`usePlanDispatch` → `planDispatch`) takes.
 *
 * Pure and deterministic.
 */

import { MODULE_FEATURE_DEFINITIONS, buildDependencyMap } from '@/lib/feature-definitions';
import { isFeatureDone } from '@/lib/feature-done';
import { unblockFrontier } from '@/lib/topology/unblockFrontier';
import type { ImplementationPlan, PlanItem } from '@/lib/implementation-planner/plan-generator';
import type { SubModuleId } from '@/types/modules';

/**
 * - `ready`: not done, every dependency done — `buildItem` is its PlanItem.
 * - `blocked`: not done, waits on `unmetDeps`; `frontier` is what to build first.
 * - `done`: implemented / improved — nothing to build.
 * - `untracked`: a status row for a feature no longer in MODULE_FEATURE_DEFINITIONS,
 *   so the plan has no item for it (still counted by the cell, so still listed).
 */
export type DrillReadiness = 'ready' | 'blocked' | 'done' | 'untracked';

export interface DrillRow {
  /** `moduleId::featureName` */
  key: string;
  featureName: string;
  status: string;
  readiness: DrillReadiness;
  /** Dependencies not done yet — [] unless `blocked`. */
  unmetDeps: string[];
  /** `unblockFrontier(statusMap, key)` for a blocked row — [] otherwise. */
  frontier: string[];
  /** The plan item to dispatch — non-null exactly when `ready`. */
  buildItem: PlanItem | null;
  impactScore: number;
}

const READINESS_ORDER: Record<DrillReadiness, number> = { ready: 0, blocked: 1, done: 2, untracked: 3 };

const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Ready first, then blocked; within a group impact desc, then feature name. */
function compareRows(a: DrillRow, b: DrillRow): number {
  return READINESS_ORDER[a.readiness] - READINESS_ORDER[b.readiness]
    || b.impactScore - a.impactScore
    || byKey(a.featureName, b.featureName);
}

/**
 * The features of `moduleId` whose status is `status` (a feature with no status
 * row counts as 'unknown', as the cell does), with readiness from `plan` — which
 * must be `generatePlan(statusMap)` for the same map.
 */
export function drillCell(
  statusMap: ReadonlyMap<string, string>,
  moduleId: SubModuleId | string,
  status: string,
  plan: ImplementationPlan,
): DrillRow[] {
  const prefix = `${moduleId}::`;
  const keys = new Set<string>(
    (MODULE_FEATURE_DEFINITIONS[moduleId as SubModuleId] ?? []).map((f) => prefix + f.featureName),
  );
  for (const key of statusMap.keys()) if (key.startsWith(prefix)) keys.add(key);

  const planByKey = new Map(plan.items.map((i) => [i.key, i]));
  let depMap: ReturnType<typeof buildDependencyMap> | null = null;

  const rows: DrillRow[] = [];
  for (const key of keys) {
    const rowStatus = statusMap.get(key) ?? 'unknown';
    if (rowStatus !== status) continue;
    const item = planByKey.get(key);
    const base = { key, featureName: key.slice(prefix.length), status: rowStatus, impactScore: item?.impact.score ?? 0 };
    if (isFeatureDone(rowStatus)) {
      rows.push({ ...base, readiness: 'done', unmetDeps: [], frontier: [], buildItem: null });
    } else if (!item) {
      rows.push({ ...base, readiness: 'untracked', unmetDeps: [], frontier: [], buildItem: null });
    } else if (item.isReady) {
      rows.push({ ...base, readiness: 'ready', unmetDeps: [], frontier: [], buildItem: item });
    } else {
      depMap ??= buildDependencyMap();
      rows.push({
        ...base,
        readiness: 'blocked',
        unmetDeps: [...item.unmetDeps],
        frontier: unblockFrontier(statusMap, key, depMap),
        buildItem: null,
      });
    }
  }
  return rows.sort(compareRows);
}

/**
 * The `limit` highest-impact features buildable right now, across every module:
 * ready (every dependency done) and not done themselves, by impact desc then key.
 * Every item passes `planDispatch`.
 */
export function buildableNow(plan: ImplementationPlan, limit = 8): PlanItem[] {
  return plan.items
    .filter((i) => i.isReady && !isFeatureDone(i.status))
    .sort((a, b) => b.impact.score - a.impact.score || byKey(a.key, b.key))
    .slice(0, limit);
}
