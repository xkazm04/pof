import { getSetting, setSetting } from '@/lib/db';
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

export function getBudgetConfig(): SizeBudgetConfig {
  const raw = getSetting(BUDGETS_KEY);
  if (!raw) {
    return { budgets: getDefaultBudgets(), failOnRegression: false };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SizeBudgetConfig>;
    return {
      budgets: parsed.budgets && typeof parsed.budgets === 'object' ? parsed.budgets : getDefaultBudgets(),
      failOnRegression: Boolean(parsed.failOnRegression),
    };
  } catch {
    return { budgets: getDefaultBudgets(), failOnRegression: false };
  }
}

export function setBudgetConfig(config: SizeBudgetConfig): void {
  setSetting(BUDGETS_KEY, JSON.stringify(config));
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

  const note = `${SIZE_REGRESSION_NOTE_PREFIX} ${platformLabel(platform)} ${formatBytes(sizeBytes, { signed: true })} — ${parts.join('; ')}`;

  return {
    sizeBytes,
    budgetBytes: budget.budgetBytes,
    growthPercent: budget.growthPercent,
    lastGreenSizeBytes,
    actualGrowthPercent,
    exceedsBudget,
    exceedsGrowth,
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
