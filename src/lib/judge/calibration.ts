import { BANDS } from './rubrics';

/**
 * Calibration set (Quality Program WS2) — the anti-drift anchor. A human labels each target
 * with the band it TRULY belongs in; the strict judge must agree with the human on >= 85% of
 * the set or the rubric wording is off. Re-run whenever RUBRIC_VERSION changes.
 *
 * Workflow: user hand-labels (fail / placeholder / shippable) → run the judge harness on these
 * exact targets → `computeAgreement` compares. The guard test enforces the threshold once the
 * judge has scored them (it skips while unscored so it can't be a false green).
 */
export type Band = 'fail' | 'placeholder' | 'shippable';

export interface CalibrationTarget {
  catalogId: string;
  entityId: string;
  step: string;
  /** The human's ground-truth band. */
  label: Band;
  /** Provisional = seeded from prior evidence, NOT yet user-confirmed. */
  provisional?: boolean;
  note?: string;
}

/** Score → band, the single mapping the whole program uses. */
export function bandOf(score: number): Band {
  if (score >= BANDS.shippable) return 'shippable';
  if (score >= BANDS.placeholder) return 'placeholder';
  return 'fail';
}

/**
 * Provisional seed — a handful of targets with strong prior evidence (documented honest
 * fails/passes from the gap-loop audit). The user must CONFIRM these and expand to ~20
 * spanning the map before the calibration is authoritative.
 */
export const CALIBRATION: CalibrationTarget[] = [
  { catalogId: 'characters', entityId: 'character-1', step: '3D Mesh', label: 'fail', provisional: true, note: 'Qwen already flagged the 3D face at 6/10 — a known hard fail.' },
  { catalogId: 'dialog-trees', entityId: 'dialog-1', step: 'Icon 2D Art', label: 'placeholder', provisional: true, note: 'Clean speech-bubble icon, competent but not distinctive AAA UI.' },
  { catalogId: 'items', entityId: 'item-1', step: '3D Mesh', label: 'placeholder', provisional: true, note: 'Iron longsword reads, but basic surface/topology — placeholder-plus.' },
];

export interface AgreementResult {
  total: number;
  scored: number;
  agreed: number;
  rate: number; // agreed / scored, 0-1
  disagreements: { key: string; human: Band; judge: Band; score: number }[];
}

/**
 * Compare human labels to judge scores. `scores` maps `${catalogId}::${entityId}::${step}` →
 * the judge's 0-100 score (from the strict rubric run). Only labeled+scored targets count.
 */
export function computeAgreement(targets: CalibrationTarget[], scores: Record<string, number>): AgreementResult {
  const disagreements: AgreementResult['disagreements'] = [];
  let scored = 0, agreed = 0;
  for (const t of targets) {
    const key = `${t.catalogId}::${t.entityId}::${t.step}`;
    if (!(key in scores)) continue;
    scored++;
    const judge = bandOf(scores[key]);
    if (judge === t.label) agreed++;
    else disagreements.push({ key, human: t.label, judge, score: scores[key] });
  }
  return { total: targets.length, scored, agreed, rate: scored ? agreed / scored : 0, disagreements };
}
