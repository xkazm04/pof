import {
  expectRecord, readSettingsBlob, writeSettingsBlob,
  type SettingsBlobRead, type SettingsBlobSpec,
} from '@/lib/settings/settings-blob';
import { formatBytes } from '@/lib/format';
import { normalizePlatformId, platformLabel } from './build-profiles';

const BUDGETS_KEY = 'build_size_budgets';

export interface SizeBudget {
  /** Hard budget in bytes (0 = no budget) */
  budgetBytes: number;
  /** Maximum allowed percent growth vs last green build (0 = disabled) */
  growthPercent: number;
}

export type SizeBudgetMap = Record<string, SizeBudget>;

export interface SizeBudgetConfig {
  /** Per-platform budgets, keyed by canonical PlatformId token (e.g. 'Win64'). */
  budgets: SizeBudgetMap;
  /** When true, record API returns a non-success envelope on regression (gate the pipeline) */
  failOnRegression: boolean;
  /**
   * Read-time marker: the stored config could NOT be read, so these budgets are
   * fail-closed defaults rather than anything the operator chose. Never
   * persisted (`setBudgetConfig` strips it) — a disabled gate and a corrupt one
   * must stay distinguishable, and this is what tells them apart.
   */
  unreadable?: boolean;
}

/**
 * The build a growth check compared against — enough to NAME it. Structurally the
 * subset of `SizeBaselineBuild` this module needs; kept local so `size-budgets` stays
 * free of a DB import.
 */
export interface SizeBaselineRef {
  buildId: number;
  projectId: string;
  sizeBytes: number;
  version: string | null;
  createdAt: string;
}

/**
 * Plain statement of WHICH build the growth check used as its reference — or that it
 * had none.
 *
 * `lastGreenSizeBytes` used to take the most recent green build of ANY project,
 * because `build_history.project_id` was never written. A verdict therefore could not
 * be distinguished from one computed against a foreign baseline, and `null` (no
 * reference at all) was reported the same way as "no regression". Both now say what
 * they are.
 */
export function describeSizeBaseline(baseline: SizeBaselineRef | null | undefined): string {
  if (!baseline) {
    return 'no baseline: this project has no green build with a measured size for this platform, so growth was NOT evaluated (this is "no reference", not "no regression")';
  }
  const owner = baseline.projectId
    ? `project ${baseline.projectId}`
    : 'a build recorded before builds carried a project (unattributed)';
  const version = baseline.version ? ` v${baseline.version}` : '';
  return `compared against build #${baseline.buildId}${version} — ${formatBytes(baseline.sizeBytes, { signed: true })}, ${owner}, ${baseline.createdAt}`;
}

export interface SizeRegression {
  /** Build size in bytes */
  sizeBytes: number;
  /** Budget that was applied (bytes, 0 if no platform budget) */
  budgetBytes: number;
  /** Configured percent growth threshold (0 if disabled) */
  growthPercent: number;
  /** Last green build size for the same platform (bytes) */
  lastGreenSizeBytes: number | null;
  /** Actual percent growth vs last green (signed; positive = bloat) */
  actualGrowthPercent: number | null;
  /** True if the build's size exceeds the budget */
  exceedsBudget: boolean;
  /** True if growth vs last green exceeds the configured percent */
  exceedsGrowth: boolean;
  /** The build the growth check referenced, when the caller supplied one; null = none. */
  baseline: SizeBaselineRef | null;
  /** Which baseline this verdict used, in words — see {@link describeSizeBaseline}. */
  baselineNote: string;
  /** Human-readable summary, suitable for build notes */
  note: string;
}

// 5 GB / 5 GB / 8 GB / 4 GB / 4 GB defaults — typical UE5 shipping sizes.
// Keyed by canonical PlatformId tokens; `platformBudget` normalizes the lookup
// so a build cooked as 'Win64' resolves the same budget a 'Windows' record does.
const DEFAULT_BUDGETS: SizeBudgetMap = {
  Win64:   { budgetBytes: 5 * 1024 ** 3, growthPercent: 10 },
  Linux:   { budgetBytes: 5 * 1024 ** 3, growthPercent: 10 },
  Mac:     { budgetBytes: 8 * 1024 ** 3, growthPercent: 10 },
  Android: { budgetBytes: 4 * 1024 ** 3, growthPercent: 10 },
  IOS:     { budgetBytes: 4 * 1024 ** 3, growthPercent: 10 },
};

export const SIZE_REGRESSION_NOTE_PREFIX = '[SIZE_BUDGET]';

export function getDefaultBudgets(): SizeBudgetMap {
  return JSON.parse(JSON.stringify(DEFAULT_BUDGETS));
}

/**
 * The budget config is one JSON string in one `settings` row, and its failure
 * direction was the sharpest kind of fail-OPEN: an unparseable value returned
 * `failOnRegression: false`, so a corrupt row silently DISABLED the size gate —
 * indistinguishable from an operator who had switched it off on purpose.
 *
 * The corrupt default is now `failOnRegression: true`: an unreadable gate config
 * leaves the gate armed. An ABSENT row keeps returning `false` — never
 * configured is a different fact from configured-but-unreadable, and only the
 * second one is a defect.
 */
const BUDGETS_SPEC: SettingsBlobSpec<SizeBudgetConfig> = {
  key: BUDGETS_KEY,
  absent: () => ({ budgets: getDefaultBudgets(), failOnRegression: false }),
  corrupt: () => ({ budgets: getDefaultBudgets(), failOnRegression: true, unreadable: true }),
  hydrate: (parsed) => {
    const record = expectRecord(parsed, 'size budget config') as Partial<SizeBudgetConfig>;
    return {
      budgets: record.budgets && typeof record.budgets === 'object' ? record.budgets : getDefaultBudgets(),
      failOnRegression: Boolean(record.failOnRegression),
    };
  },
};

/** The full read, for a caller that wants to REPORT an unreadable budget config. */
export function readBudgetConfig(): SettingsBlobRead<SizeBudgetConfig> {
  return readSettingsBlob(BUDGETS_SPEC);
}

export function getBudgetConfig(): SizeBudgetConfig {
  return readSettingsBlob(BUDGETS_SPEC).value;
}

export function setBudgetConfig(config: SizeBudgetConfig): void {
  // `unreadable` is a read-time marker, never persisted: it would otherwise be
  // stored as configuration and outlive the corruption that produced it. The
  // rest of the object is written with its original key order, so a config that
  // never carried the marker serialises byte-identically to before.
  const persisted: SizeBudgetConfig = { ...config };
  delete persisted.unreadable;
  writeSettingsBlob(BUDGETS_SPEC, persisted);
}

function platformBudget(platform: string, budgets: SizeBudgetMap): SizeBudget {
  // Prefer the canonical-token key; fall back to the raw spelling so a config
  // authored with a legacy friendly key still resolves.
  const id = normalizePlatformId(platform);
  return budgets[id] ?? budgets[platform] ?? { budgetBytes: 0, growthPercent: 0 };
}

/**
 * Evaluate a successful build's size against the per-platform budget and the
 * size of the last green build. Returns a regression record when either the
 * absolute budget or the growth threshold is exceeded; otherwise null.
 */
export function evaluateBuildSize(
  platform: string,
  sizeBytes: number | null | undefined,
  lastGreenSizeBytes: number | null,
  config: SizeBudgetConfig = getBudgetConfig(),
  baseline: SizeBaselineRef | null = null,
): SizeRegression | null {
  if (sizeBytes == null || sizeBytes <= 0) return null;
  const budget = platformBudget(platform, config.budgets);

  const exceedsBudget = budget.budgetBytes > 0 && sizeBytes > budget.budgetBytes;

  let actualGrowthPercent: number | null = null;
  let exceedsGrowth = false;
  if (lastGreenSizeBytes && lastGreenSizeBytes > 0) {
    actualGrowthPercent = ((sizeBytes - lastGreenSizeBytes) / lastGreenSizeBytes) * 100;
    exceedsGrowth = budget.growthPercent > 0 && actualGrowthPercent > budget.growthPercent;
  }

  if (!exceedsBudget && !exceedsGrowth) return null;

  const parts: string[] = [];
  if (exceedsBudget) {
    const overBy = sizeBytes - budget.budgetBytes;
    const overPct = (overBy / budget.budgetBytes) * 100;
    parts.push(
      `exceeds ${formatBytes(budget.budgetBytes, { signed: true })} budget by ${formatBytes(overBy, { signed: true })} (+${overPct.toFixed(1)}%)`,
    );
  }
  if (exceedsGrowth && actualGrowthPercent != null && lastGreenSizeBytes != null) {
    const delta = sizeBytes - lastGreenSizeBytes;
    parts.push(
      `grew ${actualGrowthPercent.toFixed(1)}% vs last green (+${formatBytes(delta, { signed: true })}, threshold ${budget.growthPercent}%)`,
    );
  }

  // Every verdict names its reference. A budget-only verdict with no baseline used to
  // read as "the package did not grow"; it now says growth was never evaluated.
  const baselineNote = baseline
    ? describeSizeBaseline(baseline)
    : lastGreenSizeBytes && lastGreenSizeBytes > 0
      // A bare size with no record behind it: the comparison happened, but which build
      // (and whose project) it came from was not supplied. Say that, don't imply it.
      ? `compared against an unidentified last-green size of ${formatBytes(lastGreenSizeBytes, { signed: true })} — the caller passed no baseline build, so its project is unknown`
      : describeSizeBaseline(null);
  // A verdict reached with fail-closed defaults says so, so nobody reads it as a
  // budget the operator set.
  const configNote = config.unreadable
    ? ' [budget config UNREADABLE — these are fail-closed defaults, not your configured budgets]'
    : '';
  const note = `${SIZE_REGRESSION_NOTE_PREFIX} ${platformLabel(platform)} ${formatBytes(sizeBytes, { signed: true })} — ${parts.join('; ')} [${baselineNote}]${configNote}`;

  return {
    sizeBytes,
    budgetBytes: budget.budgetBytes,
    growthPercent: budget.growthPercent,
    lastGreenSizeBytes,
    actualGrowthPercent,
    exceedsBudget,
    exceedsGrowth,
    baseline,
    baselineNote,
    note,
  };
}

export function hasSizeRegressionNote(notes: string | null | undefined): boolean {
  return !!notes && notes.includes(SIZE_REGRESSION_NOTE_PREFIX);
}

export function extractRegressionNote(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const lines = notes.split('\n');
  const hit = lines.find((l) => l.includes(SIZE_REGRESSION_NOTE_PREFIX));
  return hit ? hit.trim() : null;
}
