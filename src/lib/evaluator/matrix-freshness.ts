/**
 * Goal-3 instrument — "the Feature Matrix reflects reality". Pure: reads the
 * `last_reviewed_at` evidence date already carried by every `feature_matrix` row and
 * says how much of the matrix has been re-reviewed recently. The CLI reading lives in
 * `scripts/kpi-matrix-freshness.mjs`; this file has no imports so Node can load it directly.
 */

/** The stated freshness window: a module is fresh when every row was reviewed this recently. */
export const MATRIX_FRESH_WINDOW_DAYS = 14;

const DAY_MS = 86_400_000;

/** The two `feature_matrix` columns the reading needs (`module_id`, `last_reviewed_at`). */
export interface MatrixFreshnessRow {
  moduleId: string;
  lastReviewedAt: string | null;
}

export interface StaleModule {
  moduleId: string;
  /** Oldest review date among the module's REVIEWED rows; null when none was ever reviewed. */
  oldestReviewedAt: string | null;
  /** Rows of this module with no (or an unparseable) `last_reviewed_at`. */
  neverReviewedRows: number;
}

export interface MatrixFreshness {
  windowDays: number;
  /** Distinct `moduleId`s present in the rows. */
  modulesTotal: number;
  /** Modules whose rows were ALL reviewed within the window (age <= windowDays). */
  modulesFresh: number;
  /** Modules with at least one never-reviewed row (a subset of the stale modules). */
  modulesWithNeverReviewedRow: number;
  /** Every non-fresh module, oldest review first (never-reviewed modules lead), then by id. */
  staleModules: StaleModule[];
  /**
   * modulesFresh / modulesTotal as a percentage, one decimal. NULL (not 0) for an empty
   * table: with no modules there is nothing to be fresh or stale, and 0% would claim a failure.
   */
  freshPct: number | null;
}

/** Epoch ms of a stored timestamp, or NaN. Naive SQLite `YYYY-MM-DD HH:MM:SS` is UTC. */
function parseStamp(s: string): number {
  const naive = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s);
  return Date.parse(naive ? `${s.replace(' ', 'T')}Z` : s);
}

/**
 * Per-module freshness of the feature matrix at `now` (epoch ms) for a window of
 * `windowDays`. An unparseable `lastReviewedAt` counts as never reviewed; a review dated
 * in the future (clock skew) counts as fresh. Never throws, including on an empty table.
 */
export function matrixFreshness(
  rows: ReadonlyArray<MatrixFreshnessRow>,
  now: number,
  windowDays: number = MATRIX_FRESH_WINDOW_DAYS,
): MatrixFreshness {
  const byModule = new Map<string, { oldest: number; never: number; stale: boolean }>();
  for (const { moduleId, lastReviewedAt } of rows) {
    const m = byModule.get(moduleId) ?? { oldest: Infinity, never: 0, stale: false };
    const t = lastReviewedAt ? parseStamp(lastReviewedAt) : NaN;
    if (Number.isNaN(t)) {
      m.never += 1;
      m.stale = true;
    } else {
      m.oldest = Math.min(m.oldest, t);
      if (now - t > windowDays * DAY_MS) m.stale = true;
    }
    byModule.set(moduleId, m);
  }

  const staleModules: StaleModule[] = [];
  let withNever = 0;
  for (const [moduleId, m] of byModule) {
    if (m.never > 0) withNever += 1;
    if (!m.stale) continue;
    staleModules.push({
      moduleId,
      oldestReviewedAt: m.oldest === Infinity ? null : new Date(m.oldest).toISOString(),
      neverReviewedRows: m.never,
    });
  }
  staleModules.sort((a, b) => {
    if (a.oldestReviewedAt !== b.oldestReviewedAt) {
      if (a.oldestReviewedAt === null) return -1;
      if (b.oldestReviewedAt === null) return 1;
      return a.oldestReviewedAt < b.oldestReviewedAt ? -1 : 1;
    }
    return a.moduleId < b.moduleId ? -1 : 1;
  });

  const modulesTotal = byModule.size;
  const modulesFresh = modulesTotal - staleModules.length;
  return {
    windowDays,
    modulesTotal,
    modulesFresh,
    modulesWithNeverReviewedRow: withNever,
    staleModules,
    freshPct: modulesTotal === 0 ? null : Math.round((modulesFresh / modulesTotal) * 1000) / 10,
  };
}
