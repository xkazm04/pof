/**
 * Calibration guard (Direction: judge-calibration-enforced).
 *
 * `calibration.ts` used to OPEN by asserting that "the guard test enforces the threshold" — and
 * no such test existed: the only calibration test asserted `computeAgreement`'s arithmetic on
 * synthetic numbers, and `CALIBRATION` / `computeAgreement` had zero non-test consumers. Since a
 * judge verdict can downgrade a step to `fail` through `bridgeJudgeVerdict`, an unverified
 * calibration meant an uncalibrated judge silently condemning real work.
 *
 * These tests are the guard the docstring now describes, and they pin the claim to the code:
 * the threshold is enforced over the latest PERSISTED `--calibrate` run, scoped to CONFIRMED
 * (non-provisional) labels, and every other standing is an explicit "not proven" rather than a
 * green.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import {
  appendCalibrationRun,
  bandOf,
  buildCalibrationRun,
  calibrationDrift,
  calibrationHistoryPath,
  calibrationKey,
  computeAgreement,
  evaluateCalibration,
  latestCalibrationRun,
  readCalibrationHistory,
  CALIBRATION,
  CALIBRATION_THRESHOLD,
  type CalibrationRun,
  type CalibrationTarget,
} from '@/lib/judge/calibration';

const REPO_ROOT = process.cwd();
const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'pof-lotc-calib-'));
  dirs.push(d);
  return join(d, 'judge-calibration.jsonl');
};

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

/** Four targets: two confirmed, two provisional — the shape a half-labelled set really has. */
const TARGETS: CalibrationTarget[] = [
  { catalogId: 'items', entityId: 'item-1', step: 'Economy', label: 'shippable' },
  { catalogId: 'items', entityId: 'item-1', step: 'Attributes', label: 'placeholder' },
  { catalogId: 'items', entityId: 'item-1', step: '3D Mesh', label: 'placeholder', provisional: true },
  { catalogId: 'characters', entityId: 'character-1', step: '3D Mesh', label: 'fail', provisional: true },
];

const key = (i: number) => calibrationKey(TARGETS[i]);

const run = (scores: Record<string, number>, over: Partial<Parameters<typeof buildCalibrationRun>[0]> = {}) =>
  buildCalibrationRun({
    targets: TARGETS,
    scores,
    rubricVersion: RUBRIC_VERSION,
    model: 'claude-opus-4',
    effort: 'high',
    spend: { costUsd: 1.5, spawns: 4, unknownCost: 1 },
    ranAt: '2026-08-18T00:00:00.000Z',
    ...over,
  });

describe('calibration threshold', () => {
  it('is the documented 85% and is never weakened to make a run pass', () => {
    expect(CALIBRATION_THRESHOLD).toBe(0.85);
  });

  it('the seeded set is honest about how much of it a human has confirmed', () => {
    // Every seeded target is provisional today. This is the fact the docstring states; if it
    // ever changes, the claim must change with it.
    const confirmed = CALIBRATION.filter((t) => !t.provisional);
    expect(CALIBRATION.length).toBeGreaterThan(0);
    expect(confirmed.length).toBe(0);
  });
});

describe('buildCalibrationRun', () => {
  it('separates the enforced (confirmed) rate from the reported (all-scored) rate', () => {
    // Confirmed: one agrees (95→shippable), one disagrees (95→shippable vs placeholder).
    // Provisional: both agree — which must NOT be allowed to prop the enforced rate up.
    const r = run({ [key(0)]: 95, [key(1)]: 95, [key(2)]: 80, [key(3)]: 30 });
    expect(r.overall.scored).toBe(4);
    expect(r.overall.agreed).toBe(3);
    expect(r.confirmed.scored).toBe(2);
    expect(r.confirmed.agreed).toBe(1);
    expect(r.confirmed.rate).toBe(0.5);
  });

  it('records WHY an unscored target has no score, and flags provisional per target', () => {
    const r = run({ [key(0)]: 95 }, { unscored: { [key(1)]: 'no stored artifact' } });
    const rows = new Map(r.targets.map((t) => [t.key, t]));
    expect(rows.get(key(0))!.judge).toBe('shippable');
    expect(rows.get(key(0))!.agreed).toBe(true);
    expect(rows.get(key(1))!.score).toBeNull();
    expect(rows.get(key(1))!.agreed).toBeNull();
    expect(rows.get(key(1))!.note).toBe('no stored artifact');
    expect(rows.get(key(2))!.provisional).toBe(true);
    expect(rows.get(key(0))!.provisional).toBe(false);
  });
});

describe('evaluateCalibration — what is actually guaranteed', () => {
  it('no persisted run is UNRUN, never a pass', () => {
    const v = evaluateCalibration(null, RUBRIC_VERSION);
    expect(v.standing).toBe('unrun');
    expect(v.rate).toBeNull();
    expect(v.message).toContain('--calibrate');
  });

  it('a run scored under an older rubric is STALE, not a standing pass', () => {
    const stale = { ...run({ [key(0)]: 95, [key(1)]: 80 }), rubricVersion: RUBRIC_VERSION - 1 };
    const v = evaluateCalibration(stale, RUBRIC_VERSION);
    expect(v.standing).toBe('stale');
    expect(v.message).toContain(`v${RUBRIC_VERSION - 1}`);
  });

  it('a run that scored nothing is UNSCORED, not 0% and not a pass', () => {
    const v = evaluateCalibration(run({}), RUBRIC_VERSION);
    expect(v.standing).toBe('unscored');
    expect(v.rate).toBeNull();
  });

  it('perfect agreement on PROVISIONAL labels alone is never enforced-pass', () => {
    const v = evaluateCalibration(run({ [key(2)]: 80, [key(3)]: 30 }), RUBRIC_VERSION);
    expect(v.standing).toBe('provisional');
    expect(v.rate).toBe(1);
    expect(v.confirmedRate).toBeNull();
    expect(v.confirmedScored).toBe(0);
    expect(v.message).toContain('0 of them carry a confirmed human label');
  });

  it('a confirmed rate under the threshold is enforced-fail and says so', () => {
    const v = evaluateCalibration(run({ [key(0)]: 95, [key(1)]: 95 }), RUBRIC_VERSION);
    expect(v.standing).toBe('enforced-fail');
    expect(v.confirmedRate).toBe(0.5);
    expect(v.confirmedScored).toBe(2);
    expect(v.belowThreshold).toBe(true);
    expect(v.message).toContain('DRIFTED');
  });

  it('a confirmed rate at or above the threshold passes, and states how many labels back it', () => {
    const v = evaluateCalibration(run({ [key(0)]: 95, [key(1)]: 80, [key(2)]: 10 }), RUBRIC_VERSION);
    expect(v.standing).toBe('enforced-pass');
    expect(v.confirmedRate).toBe(1);
    expect(v.confirmedScored).toBe(2);
    expect(v.belowThreshold).toBe(false);
    // The provisional disagreement is still reported in the overall rate, never hidden.
    expect(v.rate).toBeCloseTo(2 / 3, 5);
    expect(v.message).toContain('2 confirmed target(s)');
  });

  it('exactly at the threshold is a pass, one disagreement below it is not', () => {
    const at: CalibrationRun = { ...run({}), confirmed: { total: 20, scored: 20, agreed: 17, rate: 0.85, disagreements: [] }, overall: { total: 20, scored: 20, agreed: 17, rate: 0.85, disagreements: [] } };
    expect(evaluateCalibration(at, RUBRIC_VERSION).standing).toBe('enforced-pass');
    const under: CalibrationRun = { ...at, confirmed: { ...at.confirmed, agreed: 16, rate: 16 / 20 } };
    expect(evaluateCalibration(under, RUBRIC_VERSION).standing).toBe('enforced-fail');
  });
});

describe('calibration history — drift is comparable across runs', () => {
  it('appends, reads back oldest-first, and reports the latest run', () => {
    const path = tmp();
    expect(latestCalibrationRun(path)).toBeNull();
    const a = run({ [key(0)]: 95 }, { ranAt: '2026-08-01T00:00:00.000Z' });
    const b = run({ [key(0)]: 60 }, { ranAt: '2026-08-18T00:00:00.000Z' });
    expect(appendCalibrationRun(a, path).ok).toBe(true);
    expect(appendCalibrationRun(b, path).ok).toBe(true);
    const hist = readCalibrationHistory(path);
    expect(hist.map((r) => r.ranAt)).toEqual([a.ranAt, b.ranAt]);
    expect(latestCalibrationRun(path)!.ranAt).toBe(b.ranAt);
  });

  it('a corrupt line is skipped rather than making the whole guard unreadable', () => {
    const path = tmp();
    appendCalibrationRun(run({ [key(0)]: 95 }), path);
    writeFileSync(path, readFileSync(path, 'utf8') + '{"truncated":\n', 'utf8');
    expect(readCalibrationHistory(path).length).toBe(1);
  });

  it('a failed append is RETURNED, so an unpersisted run is never reported as persisted', () => {
    const r = appendCalibrationRun(run({}), join(tmp(), 'nested-as-a-file', ' bad'));
    expect(r.ok).toBe(false);
  });

  it('drift names the targets whose band moved between runs', () => {
    const before = run({ [key(0)]: 95, [key(1)]: 80 });
    const after = run({ [key(0)]: 60, [key(1)]: 80 });
    const d = calibrationDrift(before, after);
    expect(d.rateDelta).toBe(-0.5);
    expect(d.moved.map((m) => m.key)).toEqual([key(0)]);
    expect(d.moved[0]).toMatchObject({ from: 'shippable', to: 'fail', fromScore: 95, toScore: 60 });
    // With no prior run there is no drift to claim.
    expect(calibrationDrift(null, after).rateDelta).toBeNull();
  });

  it('honours POF_JUDGE_CALIBRATION_PATH so a run can be pointed at a scratch file', () => {
    expect(calibrationHistoryPath({ POF_JUDGE_CALIBRATION_PATH: '/tmp/x.jsonl' })).toBe('/tmp/x.jsonl');
    expect(calibrationHistoryPath({})).toContain('judge-calibration.jsonl');
  });
});

describe('the claim and the code agree', () => {
  it('the harness really implements the --calibrate mode the docstring points at', () => {
    const src = readFileSync(join(REPO_ROOT, 'scripts', 'judge-run.ts'), 'utf8');
    expect(src).toContain("has('calibrate')");
    expect(src).toContain('appendCalibrationRun');
    expect(src).toContain('evaluateCalibration');
    // Calibration is metered like any other draw and writes no verdict.
    expect(src).toContain('drawJudge');
  });

  it('the docstring points at the mode and the guard, not at an unimplemented promise', () => {
    const doc = readFileSync(join(REPO_ROOT, 'src', 'lib', 'judge', 'calibration.ts'), 'utf8').split('export type Band')[0];
    expect(doc).toContain('--calibrate');
    expect(doc).toContain('evaluateCalibration');
    expect(doc).toContain('src/__tests__/lib/judge/calibration.test.ts');
  });
});

describe('GUARD — the judge may not drift past the threshold', () => {
  /**
   * The real enforcement: whatever the last `--calibrate` run on this machine measured, an
   * `enforced-fail` fails the build. `unrun` / `stale` / `provisional` are not green — they are
   * reported here as the honest standing rather than asserted away.
   */
  it('the latest persisted calibration run does not fail the threshold', () => {
    const latest = latestCalibrationRun();
    const v = evaluateCalibration(latest, RUBRIC_VERSION);
    expect(v.standing, v.message).not.toBe('enforced-fail');
    if (v.standing === 'enforced-pass') {
      expect(v.confirmedRate!).toBeGreaterThanOrEqual(CALIBRATION_THRESHOLD);
      expect(v.confirmedScored).toBeGreaterThan(0);
    } else {
      // Not proven — and the verdict must say which flavour of unproven it is, never a rate
      // that reads as an enforced pass.
      expect(['unrun', 'stale', 'unscored', 'provisional']).toContain(v.standing);
      expect(v.confirmedRate).toBeNull();
    }
  });

  it('agreement is measured on the band, and the bands are the ones the judge scores into', () => {
    expect(bandOf(95)).toBe('shippable');
    expect(bandOf(80)).toBe('placeholder');
    expect(bandOf(30)).toBe('fail');
    const r = computeAgreement(TARGETS, { [key(0)]: 92, [key(1)]: 75 });
    expect(r.scored).toBe(2);
    expect(r.agreed).toBe(2);
    expect(r.rate).toBe(1);
  });
});
