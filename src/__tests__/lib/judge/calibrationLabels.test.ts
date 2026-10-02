/**
 * Calibration bench — the pure side (`@/lib/judge/calibrationLabels`).
 *
 * A confirmed calibration label is a human's band for ONE specific artifact, judged against the
 * rubric in force (registry: game-production/quality-verdict-integrity#calibration-against-
 * confirmed-labels-only). Before this module a label was a hand-edited `CALIBRATION` entry keyed
 * catalog::entity::step only, so a re-produced artifact silently inherited a label a human gave to
 * different content, and `judge-run --calibrate` had no other label source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import {
  buildCalibrationRun,
  CALIBRATION,
  CALIBRATION_MIN_CONFIRMED,
  calibrationKey,
  type CalibrationTarget,
} from '@/lib/judge/calibration';
import {
  calibrationTargetsFromResponse,
  labelProgress,
  resolveCalibrationTargets,
  type CalibrationLabel,
} from '@/lib/judge/calibrationLabels';

const ITEM_MESH = 'items::item-1::3D Mesh';
const H = 'v2-abc-deadbeef';
const H2 = 'v2-abd-feedface';

const label = (over: Partial<CalibrationLabel> = {}): CalibrationLabel => ({
  catalogId: 'items', entityId: 'item-1', step: '3D Mesh', label: 'shippable',
  contentHash: H, rubricVersion: RUBRIC_VERSION, labelledAt: '2026-09-29T00:00:00.000Z', ...over,
});

const byKey = (targets: CalibrationTarget[]) => new Map(targets.map((t) => [calibrationKey(t), t]));

describe('resolveCalibrationTargets — a stored label confirms only the content it was given to', () => {
  it('a label bound to the content on record under the rubric in force confirms that target', () => {
    const before = JSON.stringify(CALIBRATION);
    const r = resolveCalibrationTargets(CALIBRATION, [label()], { [ITEM_MESH]: H });
    const t = byKey(r.targets).get(ITEM_MESH)!;
    expect(t.label).toBe('shippable'); // from the store, not the seed's 'placeholder'
    expect(t.provisional).toBe(false);
    for (const other of r.targets.filter((x) => calibrationKey(x) !== ITEM_MESH)) {
      expect(other.provisional).toBe(true);
    }
    expect(r.targets).toHaveLength(CALIBRATION.length);
    expect(r.excluded).toEqual([]);
    expect(JSON.stringify(CALIBRATION)).toBe(before); // the seed is never mutated
  });

  it('a label whose content has moved is excluded, never counted', () => {
    const r = resolveCalibrationTargets(CALIBRATION, [label()], { [ITEM_MESH]: H2 });
    expect(byKey(r.targets).get(ITEM_MESH)!.provisional).toBe(true);
    expect(r.targets.filter((t) => !t.provisional)).toHaveLength(0);
    expect(r.excluded).toHaveLength(1);
    expect(r.excluded[0].key).toBe(ITEM_MESH);
    expect(r.excluded[0].reason).toMatch(/content changed since it was labelled/);
  });

  it('a label given under an older rubric is excluded, naming that rubric', () => {
    const r = resolveCalibrationTargets(CALIBRATION, [label({ rubricVersion: RUBRIC_VERSION - 1 })], { [ITEM_MESH]: H });
    expect(r.targets.filter((t) => !t.provisional)).toHaveLength(0);
    expect(r.excluded).toHaveLength(1);
    expect(r.excluded[0].reason).toContain(`rubric v${RUBRIC_VERSION - 1}`);
  });

  it('a confirmed label outside the seed joins the set', () => {
    const extra = label({ entityId: 'item-7', label: 'fail' });
    const r = resolveCalibrationTargets(CALIBRATION, [extra], { 'items::item-7::3D Mesh': H });
    expect(r.targets).toHaveLength(CALIBRATION.length + 1);
    expect(byKey(r.targets).get('items::item-7::3D Mesh')).toMatchObject({ label: 'fail', provisional: false });
  });
});

describe('labelProgress — how far the set is from being enforceable, by band', () => {
  it('counts confirmed labels only, against the enforcement floor, split by band', () => {
    const targets: CalibrationTarget[] = [
      { catalogId: 'a', entityId: '1', step: 's', label: 'fail' },
      { catalogId: 'a', entityId: '2', step: 's', label: 'fail' },
      { catalogId: 'a', entityId: '3', step: 's', label: 'placeholder' },
      { catalogId: 'a', entityId: '4', step: 's', label: 'placeholder', provisional: true },
    ];
    expect(labelProgress(targets)).toEqual({
      confirmed: 3,
      needed: CALIBRATION_MIN_CONFIRMED,
      byBand: { fail: 2, placeholder: 1, shippable: 0 },
    });
    expect(CALIBRATION_MIN_CONFIRMED).toBe(10);
  });
});

describe('calibrationTargetsFromResponse — the contract judge-run --calibrate reads', () => {
  it('a GET body with one confirmed items::item-1::3D Mesh label yields a run with 1 confirmed target', () => {
    const resolved = resolveCalibrationTargets(CALIBRATION, [label()], { [ITEM_MESH]: H });
    const body = {
      success: true,
      data: { targets: resolved.targets, excluded: [], progress: labelProgress(resolved.targets), standing: 'unrun' },
    };
    const parsed = calibrationTargetsFromResponse(JSON.parse(JSON.stringify(body)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(byKey(parsed.data.targets).get(ITEM_MESH)).toMatchObject({ provisional: false, label: 'shippable' });
    const run = buildCalibrationRun({
      targets: parsed.data.targets, scores: {}, rubricVersion: RUBRIC_VERSION,
      model: 'm', effort: 'high', spend: { costUsd: 0, spawns: 0, unknownCost: 0 },
    });
    expect(run.confirmed.total).toBe(1);
  });

  it('a failed envelope or a malformed target is an error, never an empty set', () => {
    const failed = calibrationTargetsFromResponse({ success: false, error: 'boom' });
    expect(failed.ok).toBe(false);
    const bad = calibrationTargetsFromResponse({ success: true, data: { targets: [{ catalogId: 'a', entityId: '1', step: 's', label: 'great' }] } });
    expect(bad.ok).toBe(false);
  });

  it('judge-run --calibrate takes its targets from the route through this parser, not the constant', () => {
    const src = readFileSync(join(process.cwd(), 'scripts', 'judge-run.ts'), 'utf8');
    const body = src.slice(src.indexOf('async function calibrate('), src.indexOf('async function main('));
    expect(body).toContain('/api/judge-calibration');
    expect(body).toContain('calibrationTargetsFromResponse(');
    expect(body).not.toMatch(/\bCALIBRATION\b(?!_)/);
  });
});
