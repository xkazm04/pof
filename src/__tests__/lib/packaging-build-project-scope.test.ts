/**
 * `build_history` is project-scoped on write AND on every read.
 *
 * `build_history.project_id` was added by the same migration block as
 * `feature_matrix.project_id` and then written by NOTHING and read by NOTHING —
 * `insertBuild`'s column list omitted it, so every row on this machine carries `''`.
 * `lastGreenSizeBytes(platform)` therefore took the most recent green build OF ANY
 * PROJECT as the size baseline: cook one project after another's green build and you
 * get a fabricated "package grew N%", or a REAL regression masked behind a larger
 * foreign reference.
 *
 * Every assertion below was RED before this change:
 *   • `insertBuild` stored `''` no matter what project cooked;
 *   • `lastGreenSizeBytes('Win64', B)` returned A's size;
 *   • list/stats/trend/platform reads mixed both projects;
 *   • the verdict never named the build it compared against, so a `null` baseline
 *     was indistinguishable from "no regression".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-build-project-scope-${process.pid}.db`;
});

import { getDb } from '@/lib/db';
import {
  insertBuild,
  getBuilds,
  getBuildsByPlatform,
  getBuildStats,
  getSizeTrend,
  getPlatforms,
  lastGreenSizeBytes,
  lastGreenBaseline,
  getBuildScopeReport,
  attachSmokeResultToLatestBuild,
} from '@/lib/packaging/build-history-store';
import { evaluateBuildSize, describeSizeBaseline, type SizeBudgetConfig } from '@/lib/packaging/size-budgets';

const GB = 1024 ** 3;
const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';

const config: SizeBudgetConfig = {
  failOnRegression: false,
  budgets: { Win64: { budgetBytes: 5 * GB, growthPercent: 10 } },
};

beforeEach(() => {
  getDb().prepare('DELETE FROM build_history').run();
});

describe('insertBuild persists the project that produced the build', () => {
  it('stores the normalized project id (the column existed and was never written)', () => {
    const rec = insertBuild({ projectId: PROJECT_A, platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 2 * GB });
    expect(rec.projectId).toBe('c:/users/kazda/documents/unreal projects/pof');

    const raw = getDb().prepare('SELECT project_id FROM build_history WHERE id = ?').get(rec.id) as { project_id: string };
    expect(raw.project_id).toBe('c:/users/kazda/documents/unreal projects/pof');
  });

  it('a build recorded with no project stays honestly unattributed', () => {
    const rec = insertBuild({ platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 1 * GB });
    expect(rec.projectId).toBe('');
  });
});

describe('the size baseline cannot come from another project', () => {
  it('lastGreenSizeBytes(B) is null when only A has a green build', () => {
    insertBuild({ projectId: PROJECT_A, platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 2 * GB });
    insertBuild({ projectId: PROJECT_B, platform: 'Win64', config: 'Shipping', status: 'failed' });

    expect(lastGreenSizeBytes('Win64', PROJECT_A)).toBe(2 * GB);
    expect(lastGreenSizeBytes('Win64', PROJECT_B)).toBeNull();
  });

  it('does NOT fabricate a growth regression from a foreign baseline', () => {
    // A cooked a small green build; B then cooks 4 GB. Unscoped, B "grew 300%".
    insertBuild({ projectId: PROJECT_A, platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 1 * GB });

    const baselineB = lastGreenBaseline('Win64', PROJECT_B);
    expect(baselineB).toBeNull();
    expect(evaluateBuildSize('Win64', 4 * GB, baselineB?.sizeBytes ?? null, config, baselineB)).toBeNull();

    // The same cook under A IS a regression — the check still works, it is just honest
    // about whose baseline it used.
    const baselineA = lastGreenBaseline('Win64', PROJECT_A);
    const regression = evaluateBuildSize('Win64', 4 * GB, baselineA?.sizeBytes ?? null, config, baselineA);
    expect(regression?.exceedsGrowth).toBe(true);
    expect(regression?.baseline?.projectId).toBe('c:/users/kazda/documents/unreal projects/pof');
  });

  it('does NOT mask a real regression behind a larger foreign build', () => {
    // B's own last green is 1 GB; A has a much larger 4 GB green build. Unscoped, B's
    // 2 GB cook looks like a 50% SHRINK and passes.
    insertBuild({ projectId: PROJECT_B, platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 1 * GB });
    insertBuild({ projectId: PROJECT_A, platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 4 * GB });

    const baseline = lastGreenBaseline('Win64', PROJECT_B);
    expect(baseline?.sizeBytes).toBe(1 * GB);
    const regression = evaluateBuildSize('Win64', 2 * GB, baseline?.sizeBytes ?? null, config, baseline);
    expect(regression?.exceedsGrowth).toBe(true);
    expect(regression?.actualGrowthPercent).toBeCloseTo(100, 1);
  });

  it('an unattributed green build is still a valid baseline for every project', () => {
    insertBuild({ platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 3 * GB });
    expect(lastGreenSizeBytes('Win64', PROJECT_A)).toBe(3 * GB);
    expect(lastGreenSizeBytes('Win64', PROJECT_B)).toBe(3 * GB);
    expect(lastGreenBaseline('Win64', PROJECT_A)?.projectId).toBe('');
  });
});

describe('the verdict names the baseline it compared against', () => {
  it('a null baseline reads as "no reference", never as "no regression"', () => {
    const text = describeSizeBaseline(null);
    expect(text).toContain('no baseline');
    expect(text).toContain('not "no regression"');
  });

  it('names the build id, size, project and date of the reference it used', () => {
    insertBuild({ projectId: PROJECT_A, platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 1 * GB, version: '1.2.3' });
    const baseline = lastGreenBaseline('Win64', PROJECT_A)!;
    const regression = evaluateBuildSize('Win64', 6 * GB, baseline.sizeBytes, config, baseline);

    expect(regression).not.toBeNull();
    expect(regression!.baselineNote).toContain(`build #${baseline.buildId}`);
    expect(regression!.baselineNote).toContain('v1.2.3');
    expect(regression!.baselineNote).toContain('unreal projects/pof');
    // The stored note carries it too — build notes are where this is read later.
    expect(regression!.note).toContain(`build #${baseline.buildId}`);
  });

  it('a budget-only verdict with no baseline says growth was never evaluated', () => {
    const regression = evaluateBuildSize('Win64', 6 * GB, null, config, null);
    expect(regression!.exceedsBudget).toBe(true);
    expect(regression!.exceedsGrowth).toBe(false);
    expect(regression!.note).toContain('no baseline');
  });

  it('thresholds are unchanged — only the reporting grew', () => {
    // 5 GB budget / 10% growth, exactly as before: 5.5 GB over a 5 GB baseline.
    const r = evaluateBuildSize('Win64', 5.5 * GB, 5 * GB, config);
    expect(r!.exceedsBudget).toBe(true);
    expect(r!.exceedsGrowth).toBe(false); // +10% is not > 10%
    expect(r!.budgetBytes).toBe(5 * GB);
  });
});

describe('every build-history read scopes with the same own-plus-legacy rule', () => {
  beforeEach(() => {
    insertBuild({ projectId: PROJECT_A, platform: 'Win64', config: 'Shipping', status: 'success', sizeBytes: 2 * GB });
    insertBuild({ projectId: PROJECT_B, platform: 'Linux', config: 'Shipping', status: 'failed' });
    insertBuild({ platform: 'Win64', config: 'Development', status: 'success', sizeBytes: 1 * GB });
  });

  it('list / stats / trend / platforms exclude other projects but keep legacy rows', () => {
    expect(getBuilds(100, 0, PROJECT_A).map((b) => b.projectId).sort())
      .toEqual(['', 'c:/users/kazda/documents/unreal projects/pof']);
    expect(getBuildsByPlatform('Linux', 50, PROJECT_A)).toEqual([]);
    expect(getBuildStats(PROJECT_A).totalBuilds).toBe(2);
    expect(getBuildStats(PROJECT_B).totalBuilds).toBe(2);
    expect(getSizeTrend(undefined, 30, PROJECT_B).length).toBe(1);
    expect(getPlatforms(PROJECT_B).sort()).toEqual(['Linux', 'Win64']);
  });

  it('an unscoped read sees ONLY the unattributed rows, not everything', () => {
    expect(getBuilds(100, 0).map((b) => b.projectId)).toEqual(['']);
    expect(getBuildStats().totalBuilds).toBe(1);
  });

  it('reports what it excluded instead of hiding it', () => {
    const report = getBuildScopeReport(PROJECT_A);
    expect(report.totalRows).toBe(3);
    expect(report.ownedRows).toBe(1);
    expect(report.legacyRows).toBe(1);
    expect(report.foreignRows).toBe(1);
    expect(report.distinctProjects).toBe(2);
  });

  it('a smoke result lands on THIS project\'s build', () => {
    const updated = attachSmokeResultToLatestBuild('Linux', 'Shipping', 'smoke: passed', PROJECT_A);
    expect(updated).toBeNull(); // A has no Linux build — B's must not be touched.

    const own = attachSmokeResultToLatestBuild('Win64', 'Shipping', 'smoke: passed', PROJECT_A);
    expect(own?.projectId).toBe('c:/users/kazda/documents/unreal projects/pof');
  });
});
