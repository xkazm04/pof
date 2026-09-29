// Pure projection of the size trend into per-platform series, each point judged by
// the cook gate's own rule (`judgeBuildSize` from size-verdict.ts). Client-safe.
//
// Baseline rule = the gate's lastGreenBaseline rule applied inside the window: a
// point's reference is the previous green sized point of the SAME platform. The
// trend query only returns green sized builds, so that is simply the previous point
// of the series. A point with no prior in the window is 'no-baseline' — no reference
// is not "no regression".
import type { SizeTrendPoint } from './build-history-store';
import { normalizePlatformId, platformLabel, PLATFORM_IDS } from './build-profiles';
import {
  judgeBuildSize, platformBudget,
  type SizeBudget, type SizeBudgetConfig, type SizeBudgetMap, type SizeRegression,
} from './size-verdict';

export type TrendPointState = 'flagged' | 'ok' | 'no-baseline';

/** The (baseline, regressor) build ids the Compare tab opens on. */
export interface ComparePair {
  left: number;
  right: number;
}

export interface TrendPointModel extends SizeTrendPoint {
  state: TrendPointState;
  /** The gate's verdict for this point, or null when within budget and allowance. */
  verdict: SizeRegression | null;
  /** The same-platform point this one was compared against, or null (no baseline). */
  baselineId: number | null;
  /** Set only for a flagged point that HAS a baseline — the pair worth comparing. */
  comparePair: ComparePair | null;
}

export interface PlatformSeries {
  /** Canonical platform id. */
  platform: string;
  label: string;
  budget: SizeBudget;
  points: TrendPointModel[];
  /** Last minus first WITHIN this platform; null with fewer than 2 points. */
  deltaBytes: number | null;
  deltaPercent: number | null;
  flaggedCount: number;
  noBaselineCount: number;
  /**
   * What a per-build growth allowance lets through: compounding it over the series'
   * steps. A moving baseline ratchets — only the absolute budget stops it.
   */
  allowedCompoundPercent: number | null;
}

export interface SizeTrendModel {
  series: PlatformSeries[];
}

/** Judge one platform's points (oldest-first) against `config`. */
function judgeSeries(points: SizeTrendPoint[], config: SizeBudgetConfig): TrendPointModel[] {
  return points.map((p, i) => {
    const prev = i > 0 ? points[i - 1] : null;
    const verdict = judgeBuildSize(
      p.platform,
      p.sizeBytes,
      prev?.sizeBytes ?? null,
      config,
      prev
        ? { buildId: prev.id, projectId: prev.projectId, sizeBytes: prev.sizeBytes, version: prev.version, createdAt: prev.createdAt }
        : null,
    );
    const state: TrendPointState = verdict ? 'flagged' : prev ? 'ok' : 'no-baseline';
    return {
      ...p,
      state,
      verdict,
      baselineId: prev?.id ?? null,
      comparePair: verdict && prev ? { left: prev.id, right: p.id } : null,
    };
  });
}

/** Group points by canonical platform, keeping each group's order. Known platforms first. */
function groupByPlatform(points: SizeTrendPoint[]): Map<string, SizeTrendPoint[]> {
  const groups = new Map<string, SizeTrendPoint[]>();
  for (const p of points) {
    const id = normalizePlatformId(p.platform);
    const list = groups.get(id);
    if (list) list.push(p); else groups.set(id, [p]);
  }
  const rank = (id: string) => {
    const i = (PLATFORM_IDS as string[]).indexOf(id);
    return i === -1 ? PLATFORM_IDS.length : i;
  };
  return new Map([...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])));
}

export function buildSizeTrendModel(points: SizeTrendPoint[], config: SizeBudgetConfig): SizeTrendModel {
  const series: PlatformSeries[] = [];
  for (const [platform, group] of groupByPlatform(points)) {
    const judged = judgeSeries(group, config);
    const budget = platformBudget(platform, config.budgets);
    const first = judged[0];
    const last = judged[judged.length - 1];
    const deltaBytes = judged.length >= 2 ? last.sizeBytes - first.sizeBytes : null;
    const steps = judged.length - 1;
    series.push({
      platform,
      label: platformLabel(platform),
      budget,
      points: judged,
      deltaBytes,
      deltaPercent: deltaBytes != null && first.sizeBytes > 0 ? (deltaBytes / first.sizeBytes) * 100 : null,
      flaggedCount: judged.filter((p) => p.state === 'flagged').length,
      noBaselineCount: judged.filter((p) => p.state === 'no-baseline').length,
      allowedCompoundPercent: steps >= 1 && budget.growthPercent > 0
        ? ((1 + budget.growthPercent / 100) ** steps - 1) * 100
        : null,
    });
  }
  return { series };
}

/**
 * Preview: how many of these points a candidate budget map would flag. Pure — no
 * request is issued until the operator applies the budget.
 */
export function whatIf(points: SizeTrendPoint[], budgets: SizeBudgetMap): { flagged: number; total: number } {
  const model = buildSizeTrendModel(points, { budgets, failOnRegression: false });
  const flagged = model.series.reduce((n, s) => n + s.flaggedCount, 0);
  return { flagged, total: points.length };
}
