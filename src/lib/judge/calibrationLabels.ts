import { err, ok, type Result } from '@/types/result';
import { RUBRIC_VERSION } from './rubrics';
import {
  CALIBRATION_MIN_CONFIRMED,
  calibrationKey,
  type Band,
  type CalibrationStanding,
  type CalibrationTarget,
} from './calibration';

/**
 * Calibration bench — content-bound human labels (pure; the table lives in
 * `calibration-labels-db.ts`, the door in `/api/judge-calibration`).
 *
 * A CONFIRMED calibration label is a human's band for ONE specific artifact, given against the
 * rubric in force (registry: game-production/quality-verdict-integrity#calibration-against-
 * confirmed-labels-only). So a stored label carries the `stepContentHash` of the content the
 * operator was looking at and the `RUBRIC_VERSION` it was judged under, and it confirms a target
 * only while BOTH still hold. A re-produced artifact or a rubric bump retires the label (listed
 * as `excluded`, never counted) instead of letting it vouch for content nobody labelled.
 *
 * Honest floor: labels are MEASUREMENT of the judge. Nothing in acceptance or `statusModel`
 * reads them, so a label can never move a grade.
 */

/** The three bands a label can take, in ladder order. */
export const LABEL_BANDS: readonly Band[] = ['fail', 'placeholder', 'shippable'];

export interface CalibrationLabel {
  catalogId: string;
  entityId: string;
  step: string;
  label: Band;
  /** `stepContentHash` of the artifact on record when the label was given. */
  contentHash: string;
  /** The `RUBRIC_VERSION` in force when the label was given. */
  rubricVersion: number;
  labelledAt: string;
  note?: string;
}

/** A stored label that does not confirm its target, and why. */
export interface CalibrationExclusion {
  key: string;
  label: Band;
  reason: string;
}

export interface LabelProgress {
  confirmed: number;
  needed: number;
  byBand: Record<Band, number>;
}

/** GET /api/judge-calibration's `data`. `cell` is present only on a per-cell read. */
export interface CalibrationBenchRead {
  targets: CalibrationTarget[];
  excluded: CalibrationExclusion[];
  progress: LabelProgress;
  standing: CalibrationStanding;
  message: string;
  cell?: {
    label: CalibrationLabel | null;
    /** Why the stored label no longer confirms (content moved / rubric changed), else null. */
    issue: string | null;
    /** The latest run's band for this target — only once a human label exists (anti-anchoring). */
    judge: { band: Band; score: number } | null;
    rubric: { cls: string | null; dimensions: string[]; bands: { shippable: number; placeholder: number } };
  };
}

/** Why `label` no longer confirms the content now on record, or null when it still binds. */
export function labelBindingIssue(label: CalibrationLabel, hashNow: string | undefined, rubricVersion = RUBRIC_VERSION): string | null {
  if (label.rubricVersion !== rubricVersion) {
    return `labelled under rubric v${label.rubricVersion}; the rubric in force is v${rubricVersion}`;
  }
  if (hashNow === undefined) return 'no artifact on record any more';
  if (hashNow !== label.contentHash) return 'content changed since it was labelled';
  return null;
}

/**
 * The set `--calibrate` measures: every stored label that still binds becomes a CONFIRMED target
 * (replacing a seed at the same key, or joining the set), every other seed stays provisional,
 * and a label that no longer binds is `excluded` with its reason. `seed` is never mutated.
 * `contentNow` maps `calibrationKey` → the `stepContentHash` on record now.
 */
export function resolveCalibrationTargets(
  seed: readonly CalibrationTarget[],
  labels: readonly CalibrationLabel[],
  contentNow: Readonly<Record<string, string>>,
  rubricVersion = RUBRIC_VERSION,
): { targets: CalibrationTarget[]; excluded: CalibrationExclusion[] } {
  const confirmed = new Map<string, CalibrationTarget>();
  const excluded: CalibrationExclusion[] = [];
  for (const l of labels) {
    const key = calibrationKey(l);
    const issue = labelBindingIssue(l, contentNow[key], rubricVersion);
    if (issue) { excluded.push({ key, label: l.label, reason: issue }); continue; }
    confirmed.set(key, {
      catalogId: l.catalogId, entityId: l.entityId, step: l.step, label: l.label, provisional: false,
      ...(l.note ? { note: l.note } : {}),
    });
  }
  const targets: CalibrationTarget[] = seed.map((t) => {
    const key = calibrationKey(t);
    const c = confirmed.get(key);
    if (c) { confirmed.delete(key); return c; }
    return { ...t, provisional: true };
  });
  return { targets: [...targets, ...confirmed.values()], excluded };
}

/** Confirmed labels toward the enforcement floor, split by band so a lopsided set shows. */
export function labelProgress(targets: readonly CalibrationTarget[]): LabelProgress {
  const byBand: Record<Band, number> = { fail: 0, placeholder: 0, shippable: 0 };
  let confirmed = 0;
  for (const t of targets) {
    if (t.provisional) continue;
    confirmed++;
    byBand[t.label]++;
  }
  return { confirmed, needed: CALIBRATION_MIN_CONFIRMED, byBand };
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * Parse a GET /api/judge-calibration response BODY (the `{ success, data }` envelope) into the
 * targets `judge-run --calibrate` scores. A failed envelope or any malformed target is an error —
 * never an empty set, which would read as "nothing to calibrate".
 */
export function calibrationTargetsFromResponse(body: unknown): Result<{ targets: CalibrationTarget[]; excluded: CalibrationExclusion[] }, string> {
  const env = body as { success?: unknown; error?: unknown; data?: { targets?: unknown; excluded?: unknown } } | null;
  if (!env || typeof env !== 'object') return err('calibration read: not a JSON envelope');
  if (env.success !== true) return err(`calibration read failed: ${typeof env.error === 'string' ? env.error : 'unknown error'}`);
  const raw = env.data?.targets;
  if (!Array.isArray(raw)) return err('calibration read: data.targets is not an array');
  const targets: CalibrationTarget[] = [];
  for (const [i, t] of raw.entries()) {
    const r = t as Partial<CalibrationTarget> | null;
    if (!r || !isStr(r.catalogId) || !isStr(r.entityId) || !isStr(r.step) || !LABEL_BANDS.includes(r.label as Band)) {
      return err(`calibration read: target ${i} is malformed`);
    }
    targets.push({
      catalogId: r.catalogId, entityId: r.entityId, step: r.step, label: r.label as Band,
      provisional: r.provisional !== false,
      ...(typeof r.note === 'string' ? { note: r.note } : {}),
    });
  }
  const excluded = Array.isArray(env.data?.excluded) ? (env.data.excluded as CalibrationExclusion[]) : [];
  return ok({ targets, excluded });
}
