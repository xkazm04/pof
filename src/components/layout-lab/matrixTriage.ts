/**
 * Matrix triage — the pure model behind the CatalogMatrix's rank / filter / count.
 *
 * The board used to render rows in storage order (`Object.values` of the store maps), so it
 * reshuffled on refetch and could not answer "which of these 106 rows needs me first?". Now:
 *
 *  - **Rank** by the ONE coach ladder (`COACH_PRIORITY_RANK` over each row's `issue`, the same
 *    `pickLadderIssue` pick both coaches make), then by entity id — an immutable unique
 *    tiebreaker, so the order is total and storage order can never leak through.
 *  - **Filter** to one rung (`{kind:'rung'}`) or to one column's status (`{kind:'column'}`). A
 *    column predicate only ever matches rows whose OWN pipeline has that step (profile-scoped
 *    steps, D18): a step an entity does not have is never counted as unproduced.
 *  - **Count** each rung over the UNFILTERED set, and caption the filtered board with its
 *    predicate ("2 of 5 · deferred") — a count never floats free of what it counts.
 */
import { COACH_LADDER, COACH_PRIORITY_RANK, type CoachPriority } from './coachLadder';
import type { StepDisplayStatus } from './hooks/useEntityArtifacts';
import type { MatrixRow } from './matrixRows';

/** A ladder rung, or `none` — the row has nothing actionable (every own step passes). */
export type TriageRung = CoachPriority | 'none';
export const TRIAGE_RUNGS: readonly TriageRung[] = [...COACH_LADDER, 'none'];

export type TriagePredicate =
  | { kind: 'rung'; rung: TriageRung }
  | { kind: 'column'; step: string; status: StepDisplayStatus };

/** The row surface triage reads (a `MatrixRow`, or any row carrying the same derivations). */
export type TriageRow = Pick<MatrixRow, 'id' | 'name' | 'issue' | 'applies' | 'statusByStep' | 'stepIndex'>;

/** Most urgent first — the order a column header cycles through the statuses present in it. */
const COLUMN_STATUS_ORDER: readonly StepDisplayStatus[] = ['fail', 'pending', 'deferred', 'unproduced', 'pass'];

export const rungOf = (r: TriageRow): TriageRung => r.issue?.priority ?? 'none';
const rankOf = (r: TriageRow) => (r.issue ? COACH_PRIORITY_RANK[r.issue.priority] : COACH_LADDER.length);

/** Rows by coach-ladder rank, then entity id (code-unit order — locale-independent). */
export function rankMatrixRows<R extends TriageRow>(rows: readonly R[]): R[] {
  return [...rows].sort((a, b) => rankOf(a) - rankOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Whether a row satisfies the predicate (`null` = no predicate, every row). */
export function matchesPredicate(r: TriageRow, p: TriagePredicate | null): boolean {
  if (!p) return true;
  if (p.kind === 'rung') return rungOf(r) === p.rung;
  return r.applies(p.step) && r.statusByStep(p.step) === p.status;
}

/** The rows a predicate keeps, in their incoming order. */
export function filterMatrixRows<R extends TriageRow>(rows: readonly R[], p: TriagePredicate | null): R[] {
  return p ? rows.filter((r) => matchesPredicate(r, p)) : [...rows];
}

/** How many rows sit on each rung — over the set passed in (the board passes the unfiltered one). */
export function tallyRungs(rows: readonly TriageRow[]): Record<TriageRung, number> {
  const tally = Object.fromEntries(TRIAGE_RUNGS.map((r) => [r, 0])) as Record<TriageRung, number>;
  for (const r of rows) tally[rungOf(r)] += 1;
  return tally;
}

/** Spoken name of a rung (`none` reads as what it is: every own step passes). */
export const rungLabel = (r: TriageRung): string => (r === 'none' ? 'all pass' : r);

/** The predicate alone: `deferred` / `Test Gate: deferred`. */
export function predicateLabel(p: TriagePredicate): string {
  return p.kind === 'rung' ? rungLabel(p.rung) : `${p.step}: ${p.status}`;
}

/** The filtered board's caption — the count carries its predicate: `2 of 5 · deferred`. */
export function describePredicate(p: TriagePredicate, shown: number, total: number): string {
  return `${shown} of ${total} · ${predicateLabel(p)}`;
}

/**
 * What a click on column `step`'s header applies: the most urgent status present in that column
 * (over rows whose pipeline has the step); clicking the same column again moves to the next
 * status present, and past the last one clears the predicate (`null`).
 */
export function nextColumnPredicate(rows: readonly TriageRow[], step: string, current: TriagePredicate | null): TriagePredicate | null {
  const present = COLUMN_STATUS_ORDER.filter((s) => rows.some((r) => r.applies(step) && r.statusByStep(step) === s));
  const at = current?.kind === 'column' && current.step === step ? present.indexOf(current.status) : -1;
  const status = present[at + 1];
  return status ? { kind: 'column', step, status } : null;
}
