import {
  expectRecord, readSettingsBlob, updateSettingsBlob, writeSettingsBlob,
  type SettingsBlobRead, type SettingsBlobSpec,
} from '@/lib/settings/settings-blob';
import { normalizePlatformId } from './build-profiles';
import {
  getDefaultBudgets, judgeBuildSize,
  type SizeBaselineRef, type SizeBudget, type SizeBudgetConfig, type SizeBudgetsPayload, type SizeRegression,
} from './size-verdict';

// The pure half (types, defaults, the rule, the note helpers) lives in size-verdict.ts
// so a client component can judge with the SAME function the cook gate uses. This
// module keeps the settings I/O and re-exports the pure half, so every importer of
// size-budgets is unchanged.
export {
  describeSizeBaseline, getDefaultBudgets, hasSizeRegressionNote, extractRegressionNote,
  SIZE_REGRESSION_NOTE_PREFIX,
} from './size-verdict';
export type {
  SizeBudget, SizeBudgetMap, SizeBudgetConfig, SizeBaselineRef, SizeRegression, SizeBudgetsPayload,
} from './size-verdict';

const BUDGETS_KEY = 'build_size_budgets';

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

/** The dashboard's view of the budgets — the value in use AND whether it was readable. */
export function budgetsPayload(): SizeBudgetsPayload {
  const read = readBudgetConfig();
  return { budgets: read.value.budgets, failOnRegression: read.value.failOnRegression, unreadable: read.corrupt };
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

/**
 * Retune ONE platform's budget under its canonical id; every other platform and
 * `failOnRegression` are carried over untouched. A read-modify-write, so an
 * unreadable row is refused (SettingsBlobCorruptError, bytes preserved) rather than
 * overwritten with defaults. Callers validate with `budgetInputError` first.
 */
export function setPlatformBudget(platform: string, budget: SizeBudget): SizeBudgetConfig {
  const id = normalizePlatformId(platform);
  return updateSettingsBlob(BUDGETS_SPEC, (current) => ({
    ...current,
    budgets: { ...current.budgets, [id]: { budgetBytes: budget.budgetBytes, growthPercent: budget.growthPercent } },
  })).value;
}

/**
 * The cook gate's entry point: {@link judgeBuildSize} with the STORED config by
 * default. A thin wrapper, not a second rule — the chart calls judgeBuildSize with
 * the same config the dashboard reports.
 */
export function evaluateBuildSize(
  platform: string,
  sizeBytes: number | null | undefined,
  lastGreenSizeBytes: number | null,
  config: SizeBudgetConfig = getBudgetConfig(),
  baseline: SizeBaselineRef | null = null,
): SizeRegression | null {
  return judgeBuildSize(platform, sizeBytes, lastGreenSizeBytes, config, baseline);
}
