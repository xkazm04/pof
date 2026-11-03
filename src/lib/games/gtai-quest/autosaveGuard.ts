/**
 * Autosave guard: a quest design says where the save engine may checkpoint it.
 *
 * Owner 2026-11-03: "Each quest design will have in its design points for autosave." The game's save engine
 * (rtai branch `d-save`) reads `autosavePoints` from the package: each point is a beat boundary plus the
 * designer's reason. The quest's end is always an autosave, declared or not.
 *
 * What it checks (pure, no table needed):
 *  - `AUTOSAVE_MISSING`: no `autosavePoints` (absent or empty). Error for a design made on or after
 *    `AUTOSAVE_REQUIRED_FROM` (every proposal, every package fused that day or later); a warn for a package
 *    fused before it (the quests the owner approved before the field existed);
 *  - `AUTOSAVE_BAD_SHAPE`: an entry that is not an object, or whose `id` is not a non-empty string;
 *  - `AUTOSAVE_DUPLICATE_ID`: an id used twice;
 *  - `AUTOSAVE_UNKNOWN_BEAT`: `beat` is not an id in `beats[]`;
 *  - `AUTOSAVE_BAD_AT`: `at` is neither `"start"` nor `"end"`;
 *  - `AUTOSAVE_EMPTY_WHY`: `why` is empty (the designer owes a reason).
 * Every finding's `ref` is the point id (or `#<index>` when it has none), so a red verdict names the point.
 */
import type { AutosavePoint, GuardFinding, GuardVerdict, QuestDesign } from '@/lib/games/gtai-quest/types';

/** Designs fused on or after this day must carry autosave points; earlier packages are warned, not failed. */
export const AUTOSAVE_REQUIRED_FROM = '2026-11-04';

export const AUTOSAVE_AT = ['start', 'end'] as const;

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** True when a design dated `designedAt` (an ISO date or timestamp) predates the requirement. Undated = new. */
export function predatesAutosave(designedAt: string | undefined): boolean {
  return !!designedAt && /^\d{4}-\d{2}-\d{2}/.test(designedAt) && designedAt.slice(0, 10) < AUTOSAVE_REQUIRED_FROM;
}

/** Findings for the points themselves (not the missing-list case); exported so tests can read them directly. */
export function autosaveFindings(points: readonly unknown[], beatIds: ReadonlySet<string>): GuardFinding[] {
  const out: GuardFinding[] = [];
  const seen = new Set<string>();
  points.forEach((raw, i) => {
    const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof AutosavePoint, unknown>>;
    const ref = isText(p.id) ? p.id : `#${i}`;
    const err = (code: string, message: string): number => out.push({ code, severity: 'error', message, ref });
    if (!isText(p.id)) err('AUTOSAVE_BAD_SHAPE', `autosave point #${i} has no id (each point needs { id, beat, at, why })`);
    else if (seen.has(p.id)) err('AUTOSAVE_DUPLICATE_ID', `autosave point id "${p.id}" is used more than once`);
    else seen.add(p.id);
    if (!isText(p.beat) || !beatIds.has(p.beat)) {
      err('AUTOSAVE_UNKNOWN_BEAT', `autosave point "${ref}" names beat ${JSON.stringify(p.beat ?? null)}, which is not in beats[] (${[...beatIds].join(', ') || 'no beats'})`);
    }
    if (p.at !== 'start' && p.at !== 'end') err('AUTOSAVE_BAD_AT', `autosave point "${ref}" has at ${JSON.stringify(p.at ?? null)}; it must be "start" or "end"`);
    if (!isText(p.why)) err('AUTOSAVE_EMPTY_WHY', `autosave point "${ref}" has no why: say what replaying from here saves the player`);
  });
  return out;
}

export function assessAutosave(design: QuestDesign, designedAt?: string): GuardVerdict {
  const points: readonly unknown[] = Array.isArray(design.autosavePoints) ? design.autosavePoints : [];
  const findings: GuardFinding[] = [];
  if (points.length === 0) {
    const legacy = predatesAutosave(designedAt);
    findings.push({
      code: 'AUTOSAVE_MISSING',
      severity: legacy ? 'warn' : 'error',
      message: legacy
        ? `no autosavePoints (designed ${designedAt}, before the field was required on ${AUTOSAVE_REQUIRED_FROM}); only the quest's end saves`
        : 'no autosavePoints: every quest design places autosave points at beat boundaries, each with a reason',
    });
  } else {
    findings.push(...autosaveFindings(points, new Set(design.beats.map((b) => b.id))));
  }
  return {
    guard: 'autosave',
    state: findings.some((f) => f.severity === 'error') ? 'red' : 'green',
    basis: `autosavePoints against beats[] (${points.length} point(s); required from ${AUTOSAVE_REQUIRED_FROM})`,
    findings,
  };
}
