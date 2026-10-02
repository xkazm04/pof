/**
 * "Check against disk" — the pure half of the on-demand checklist reconcile.
 *
 * - `diskVerifiableItems(moduleId, checklist)` — the ids this module can verify now:
 *   those it OWNS an expectation for (`getExpectationsFor`; ids repeat across modules,
 *   so ai-behavior never borrows arpg-inventory's ai-1).
 * - `planDiskReconcile(results, progress)` — diffs each verify-semantic verdict against
 *   the tick into one row per verifiable item, each proposing at most one action:
 *   built -> tick, regressed -> untick, partial/stub -> finish the missing members.
 *   A result with no owned expectation is counted in `unverifiable` and gets no row.
 * - `buildFinishPrompt(item, target)` — an add-only Claude prompt naming the class and
 *   exactly the members the parser found missing.
 *
 * Nothing here writes: the hook records verdicts and ticks only on an explicit click.
 */

import { getExpectationsFor } from '@/lib/checklist-expectations';
import type { ChecklistItem } from '@/types/modules';

/** One verify-semantic result (`POST /api/filesystem/verify-semantic`). */
export interface DiskResult {
  /** Echoed by the route when the request named it */
  moduleId?: string;
  itemId: string;
  status: 'full' | 'partial' | 'stub' | 'missing' | 'no-expectations';
  completeness: number;
  missingMembers: string[];
  /** Per-class breakdown (primary first) */
  details?: {
    className: string;
    missingComponents?: string[];
    missingProperties?: string[];
    missingFunctions?: string[];
  }[];
}

/** What a Finish run should add, and to which class. */
export interface FinishTarget {
  className: string;
  missingMembers: string[];
}

export type DiskRowKind = 'built' | 'confirmed' | 'partial' | 'stub' | 'absent' | 'regressed';
export type DiskAction = 'tick' | 'untick' | 'finish';

export interface DiskRow {
  itemId: string;
  kind: DiskRowKind;
  /** The checklist tick at plan time */
  checked: boolean;
  completeness: number;
  missingMembers: string[];
  /** The one action this row proposes; null = disk and checklist agree (or nothing to do yet) */
  action: DiskAction | null;
  /** Present when action === 'finish' */
  finish?: FinishTarget;
}

export interface DiskPlan {
  rows: DiskRow[];
  /** Results with no owned expectation — never a row, never an action */
  unverifiable: number;
  /** Ids whose verdict is full while unticked (the "Mark built" set) */
  built: string[];
}

/** The ids of `checklist` this module can verify against disk, in checklist order. */
export function diskVerifiableItems(moduleId: string, checklist: Pick<ChecklistItem, 'id'>[]): string[] {
  return checklist.filter((i) => getExpectationsFor(moduleId, i.id) !== null).map((i) => i.id);
}

/**
 * The class a Finish run targets from a flat missing-member list (a stored verdict has
 * no per-class breakdown): each member goes to the first expected class (primary, then
 * secondaries) that lists it, unmatched members to the primary; the target is the class
 * of the first member, with only that class's members — one class per run, so a member
 * is never added to the wrong class, and a re-check surfaces the next class.
 */
export function finishTargetFor(moduleId: string, itemId: string, missingMembers: string[]): FinishTarget {
  const exp = getExpectationsFor(moduleId, itemId);
  if (!exp) return { className: itemId, missingMembers };
  const classes = [exp.primary, ...(exp.secondary ?? [])];
  const owner = (m: string) => (classes.find((c) =>
    [...(c.expectedComponents ?? []), ...(c.expectedProperties ?? []), ...(c.expectedFunctions ?? [])].includes(m),
  ) ?? exp.primary).className;
  const className = missingMembers.length > 0 ? owner(missingMembers[0]) : exp.primary.className;
  return { className, missingMembers: missingMembers.filter((m) => owner(m) === className) };
}

/** Prefer the route's per-class breakdown (primary first); else map the flat list. */
function finishTarget(moduleId: string, result: DiskResult): FinishTarget {
  for (const d of result.details ?? []) {
    const missing = [...(d.missingComponents ?? []), ...(d.missingProperties ?? []), ...(d.missingFunctions ?? [])];
    if (missing.length > 0) return { className: d.className, missingMembers: missing };
  }
  return finishTargetFor(moduleId, result.itemId, result.missingMembers ?? []);
}

function rowFor(moduleId: string, result: DiskResult, checked: boolean): DiskRow {
  const base = {
    itemId: result.itemId,
    checked,
    completeness: result.completeness,
    missingMembers: result.missingMembers ?? [],
  };
  switch (result.status) {
    case 'full':
      return checked ? { ...base, kind: 'confirmed', action: null } : { ...base, kind: 'built', action: 'tick' };
    case 'partial':
    case 'stub':
      return { ...base, kind: result.status, action: 'finish', finish: finishTarget(moduleId, result) };
    default:
      return checked ? { ...base, kind: 'regressed', action: 'untick' } : { ...base, kind: 'absent', action: null };
  }
}

/** Diff verdicts against checklist progress. Pure; proposes, never applies. */
export function planDiskReconcile(results: DiskResult[], progress: Record<string, boolean>): DiskPlan {
  const rows: DiskRow[] = [];
  let unverifiable = 0;
  for (const result of results) {
    const owned = result.moduleId !== undefined
      && result.status !== 'no-expectations'
      && getExpectationsFor(result.moduleId, result.itemId) !== null;
    if (!owned) {
      unverifiable++;
      continue;
    }
    rows.push(rowFor(result.moduleId as string, result, !!progress[result.itemId]));
  }
  return { rows, unverifiable, built: rows.filter((r) => r.kind === 'built').map((r) => r.itemId) };
}

/** An add-only prompt: finish the members the parser found missing, touch nothing else. */
export function buildFinishPrompt(item: Pick<ChecklistItem, 'id' | 'label'>, target: FinishTarget): string {
  const members = target.missingMembers.length > 0 ? target.missingMembers.join(', ') : '(none named — the class body is a stub)';
  return [
    `Finish "${item.label}" (checklist item ${item.id}).`,
    `A disk check of the project's headers found ${target.className}, but it is missing: ${members}.`,
    '',
    `Add only the missing members listed above to ${target.className} (header declaration, plus a .cpp definition or constructor initialisation where one is needed).`,
    'A name that is a type (e.g. U...Component) means: add a UPROPERTY member of that type.',
    'Do NOT remove, rename, reorder or rewrite any existing member, function or include.',
    'Build afterwards and fix only errors your additions caused.',
    'Do NOT use TodoWrite.',
  ].join('\n');
}
