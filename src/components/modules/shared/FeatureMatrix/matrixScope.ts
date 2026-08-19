/**
 * Turn a project-scope report into the one sentence the matrix owes the user.
 *
 * Project scoping (phase 1) made every feature-matrix read return counts for what
 * it could and could not see — `ownedRows`, `legacyRows`, `foreignRows`. Until this
 * module existed nothing rendered them, so two very different situations looked
 * identical on screen:
 *
 *  - a module NOTHING has ever reviewed, and
 *  - a module whose rows are held by a DIFFERENT project (the UNIQUE key is still
 *    `(module_id, feature_name)`, so a feature is physically one row and only one
 *    project can hold it — an empty view is then an artefact of scoping, not of
 *    absence).
 *
 * That is the same conflation this campaign has closed elsewhere (a failed fetch vs
 * an empty result; an unmeasured score vs a low one), and it is closed here by
 * NAMING the counts.
 *
 * Pure and display-only: it reads counts, it never changes what is queried, scored,
 * or attributed. Adopting a legacy row is an operator decision and is deliberately
 * not offered here.
 */

import type { ProjectScopeCounts } from '@/lib/project-id';
import type { StatusLevel } from '@/lib/status-token';

/**
 * The facts {@link describeMatrixScope} actually reads.
 *
 * The feature matrix's `ProjectScopeReport` satisfies it — and so does the plain {@link ProjectScopeCounts}
 * that every OTHER project-scoped table returns (`build_history`,
 * `telemetry_snapshots`). Widened to this structural minimum so those surfaces can
 * REUSE this four-state classification instead of forking a second one that would
 * drift from it; only the domain SENTENCE differs per surface, and that is supplied
 * by the caller (see `BuildHistoryDashboard/buildScope.ts`).
 *
 * Type-only widening: every existing caller passes a full report and is unaffected.
 */
export type ScopeClassifierFacts = ProjectScopeCounts & {
  /** The module the counts are restricted to; absent/null = whole-table counts. */
  moduleId?: string | null;
  /** The report's own sentence, when it has one. */
  note?: string;
};

/**
 * Which of the four scope situations a module is in.
 *
 * - `own`     — every row in view is attributed to the active project. Nothing was
 *               hidden, so there is nothing to disclose (`show: false`).
 * - `mixed`   — the project owns some rows, but others are still unattributed
 *               legacy rows that EVERY project sees.
 * - `legacy`  — the only rows here are unattributed legacy rows. Distinct from
 *               "never reviewed": rows exist, they just belong to nobody.
 * - `foreign` — rows of this module are owned by another named project and are
 *               excluded from this read.
 */
export type MatrixScopeState = 'own' | 'mixed' | 'legacy' | 'foreign';

/**
 * What the underlying report's counts are ABOUT.
 *
 * `getProjectScopeReport(projectId, moduleId?)` returns `moduleId: null` when it
 * counted the whole table — which is exactly what `/all-statuses` and `/aggregate`
 * ask for. A project-wide report therefore cannot say how many rows of any ONE
 * module are foreign, and copy that claimed it would overclaim. The subject is
 * derived from the report itself so a surface can never mislabel its own counts.
 */
export type MatrixScopeSubject = 'module' | 'project';

export interface MatrixScopeDescription {
  state: MatrixScopeState;
  /** Whether the counts describe one module or the whole matrix (see {@link MatrixScopeSubject}). */
  subject: MatrixScopeSubject;
  /** False only for `own` — the read hid nothing, so a banner would be noise. */
  show: boolean;
  /** Ramp level for the shared `StatusTag` / container tint. */
  level: StatusLevel;
  /** Short uppercase word shown in the tag. */
  word: string;
  /** One sentence that always names the counts it is talking about. */
  headline: string;
  /** The scope report's own note, verbatim — never a paraphrase of it. */
  note: string;
}

/** `12 rows` / `1 row` — the counts are load-bearing, so they are never elided. */
function rowWord(n: number): string {
  return `${n} row${n === 1 ? '' : 's'}`;
}

/**
 * Last path segment of a normalized project id, for readable copy.
 * `c:/users/kazda/documents/unreal projects/pof` → `pof`. Returns `''` for the
 * unscoped id so callers can branch on "no project named".
 */
export function shortProjectLabel(projectId: string): string {
  if (!projectId) return '';
  const parts = projectId.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? projectId;
}

/**
 * @param scope       the report the hook returned, or null before the first fetch
 * @param visibleRows how many rows this view actually has on screen — an empty view
 *                    with foreign rows is the case the whole banner exists for, and
 *                    it is escalated so it cannot read as a quiet caveat.
 */
export function describeMatrixScope(
  scope: ScopeClassifierFacts | null | undefined,
  visibleRows: number,
): MatrixScopeDescription | null {
  if (!scope) return null;
  const scopeNote = scope.note ?? '';

  const label = scope.unscoped ? '' : shortProjectLabel(scope.projectId);
  const under = label ? `"${label}"` : 'this read';

  // Derived from the report, never from the calling surface: a project-wide read
  // knows nothing about any single module, so it must not borrow that noun.
  const subject: MatrixScopeSubject = scope.moduleId ? 'module' : 'project';
  const isModule = subject === 'module';
  const thisSubject = isModule ? 'This module' : 'This project';
  const ofSubject = isModule ? 'of this module' : 'of the feature matrix';
  const ofItself = isModule ? 'of it' : 'of the feature matrix';

  // Foreign rows first: it is the strongest claim on screen, and the only state in
  // which an EMPTY module is provably not an unreviewed one.
  if (scope.foreignRows > 0) {
    const blind = visibleRows === 0;
    return {
      state: 'foreign',
      subject,
      show: true,
      level: blind ? 'bad' : 'warn',
      word: 'OTHER PROJECT',
      headline: blind
        ? `${thisSubject} is not unreviewed — ${rowWord(scope.foreignRows)} ${ofItself} are owned by another project and are not visible under ${under}.`
        : `${rowWord(scope.foreignRows)} ${ofSubject} are owned by another project and are excluded from this view.`,
      note: scopeNote,
    };
  }

  if (scope.legacyRows > 0 && scope.ownedRows === 0) {
    return {
      state: 'legacy',
      subject,
      show: true,
      level: 'warn',
      word: 'UNATTRIBUTED',
      headline: scope.unscoped
        ? `No project is open, so this is the unattributed legacy set: ${rowWord(scope.legacyRows)} that no project owns. They exist and are shown — that is not the same as a ${subject} nothing has reviewed.`
        : `All ${rowWord(scope.legacyRows)} here are unattributed legacy rows that every project sees; nothing has been written under ${under}. They exist — that is not the same as a ${subject} nothing has reviewed.`,
      note: scopeNote,
    };
  }

  if (scope.legacyRows > 0) {
    return {
      state: 'mixed',
      subject,
      show: true,
      level: 'warn',
      word: 'PARTLY UNATTRIBUTED',
      headline: `${rowWord(scope.ownedRows)} are attributed to ${under}; ${rowWord(scope.legacyRows)} carry no project attribution and are shown to every project.`,
      note: scopeNote,
    };
  }

  return {
    state: 'own',
    subject,
    show: false,
    level: 'ok',
    word: 'SCOPED',
    headline: `${rowWord(scope.ownedRows)} in view, all attributed to ${under}. Nothing was excluded by scope.`,
    note: scopeNote,
  };
}

/**
 * How many feature-matrix rows one module actually has in a shared status map.
 *
 * The evaluator surfaces read `/all-statuses` (project-wide), but several of them
 * render ONE module — the Constellation, the NBA card. `describeMatrixScope`'s
 * escalation to `bad` turns on "this view is showing nothing", so those surfaces
 * need the per-module count rather than the map's size. Pure, so it is the same
 * number in the component and in the test.
 */
export function countModuleRows(statusMap: Map<string, string>, moduleId: string): number {
  const prefix = `${moduleId}::`;
  let n = 0;
  for (const key of statusMap.keys()) if (key.startsWith(prefix)) n++;
  return n;
}

/**
 * How many feature-matrix rows a per-module roll-up was built from.
 *
 * The roll-up dashboards must NOT use their own `totals.total`: that figure falls
 * back to `MODULE_FEATURE_DEFINITIONS.length` for modules with no rows, so it stays
 * large even when the scoped read returned nothing — precisely the "looks reviewed,
 * saw nothing" reading this disclosure exists to prevent.
 */
export function countAggregateRows(aggregates: { total: number }[]): number {
  let n = 0;
  for (const a of aggregates) n += a.total;
  return n;
}
