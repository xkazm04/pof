import { BANDS } from '@/lib/judge/rubrics';
import { verdictProvenance } from '@/lib/catalog/acceptance/judgeBridge';
import type { JudgeAttribution } from '@/lib/catalog/acceptance/types';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * Pure reading of ONE stored judge verdict for the `?ux=judge-verdict` prototype.
 *
 * The acceptance bridge keeps only `findings.slice(0, 200)` (`judgeBridge.ts`), and the judge
 * runner stores `[rubric vN(+canon)] [median-of-3: a,b,c] <critique> FIX: <fix>` cut at 1500
 * characters (`scripts/judge-run.ts`). So the first 200 characters are the header and, usually,
 * the judge's praise; the defect it condemned and its own FIX sit past them. This splits the
 * record back into those parts. A verdict from any other writer (no header, no FIX) still
 * parses: everything lands in `critique`.
 */

/** The length the judge runner cuts a stored `findings` record to. */
export const STORED_FINDINGS_CAP = 1500;

const HEADER = /^\s*\[rubric (v\d+)(\+canon)?\]\s*(?:\[median-of-3:\s*([\d.,\s]+)\]\s*)?/;
const FIX_MARK = ' FIX: ';

export interface ParsedFindings {
  /** Rubric tag from the header (`v4`), when the record carries one. */
  rubric?: string;
  /** The header said the judge read the canon (`+canon`). */
  canon: boolean;
  /** The three panel scores behind a median-of-3 verdict (empty when single-shot). */
  panel: number[];
  /** What the judge found: the record minus its header and its FIX. */
  critique: string;
  /** The judge's own corrective instruction, when it survived storage. */
  fix?: string;
  /** The record is exactly at the storage cap, so its tail was cut. */
  clipped: boolean;
}

export function parseFindings(raw: string): ParsedFindings {
  const head = HEADER.exec(raw);
  const body = head ? raw.slice(head[0].length) : raw;
  const at = body.lastIndexOf(FIX_MARK);
  const panel = (head?.[3] ?? '').split(',').map((s) => Number(s.trim())).filter(isScore);
  return {
    ...(head ? { rubric: head[1] } : {}),
    canon: !!head?.[2],
    panel,
    critique: (at >= 0 ? body.slice(0, at) : body).trim(),
    ...(at >= 0 ? { fix: body.slice(at + FIX_MARK.length).trim() } : {}),
    clipped: raw.length >= STORED_FINDINGS_CAP,
  };
}

function isScore(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * The stored verdict the acceptance bridge attributed — matched on every field the
 * attribution copies (`judgeBridge.attribute`), so the panel shows the verdict that is
 * actually blocking the step, never a neighbour from another judge class or rubric.
 */
export function matchVerdict(rows: readonly JudgeVerdict[], judge: JudgeAttribution): JudgeVerdict | undefined {
  return rows.find((v) => v.verdict === judge.verdict && v.score === judge.score && v.judge === judge.judge
    && (v.model || undefined) === judge.model && (v.judgedAt || undefined) === judge.judgedAt);
}

/** Content no verdict judged, written after any judgment — what a re-produce leaves on record. */
const REPRODUCED = { hash: 'reproduced-content', updatedAt: '9999-12-31T00:00:00Z' };

/**
 * Would a re-produce retire this verdict? Asked of the bridge's own `verdictProvenance`: a
 * verdict with a comparable content hash, or none, goes `stale` against new content and stops
 * blocking. One stamped under an old hash scheme or a future rubric stays `unknown`, and an
 * `unknown` FAIL keeps blocking until a fresh judge run replaces it.
 */
export function retiredByReproduce(v: JudgeVerdict): boolean {
  return verdictProvenance(v, REPRODUCED) === 'stale';
}

/** How far a score sits below the shippable bar (0 when at or above it). */
export function pointsShort(score: number): number {
  return Math.max(0, BANDS.shippable - score);
}

/** Rubric dimensions, weakest first — the judge says the weakest few dominate the score. */
export function weakestFirst(dimensions: Record<string, number> | undefined): [string, number][] {
  return Object.entries(dimensions ?? {}).filter(([, n]) => Number.isFinite(n)).sort((a, b) => a[1] - b[1]);
}

/**
 * The Produce direction built from the judge's own words: its FIX when one survived storage,
 * else its full critique. It names the score and the bar, and invents no target the judge
 * did not state.
 */
export function judgeDirection(step: string, v: Pick<JudgeVerdict, 'score'>, p: ParsedFindings): string {
  const lead = `Revise the ${step} to answer the judge, who scored it ${v.score} against a bar of ${BANDS.shippable}.`;
  const body = p.fix
    ? ` The judge's fix: ${p.fix}${p.clipped ? ' (the stored fix is cut off at this point)' : ''}`
    : ` The judge found: ${p.critique}`;
  return `${lead}${body} Keep what the judge did not condemn and change only what it names.`;
}
