/**
 * Turn a {@link ProjectScopeReport} into the one sentence the matrix owes the user.
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

import type { ProjectScopeReport } from '@/lib/feature-matrix-db';
import type { StatusLevel } from '@/lib/status-token';

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

export interface MatrixScopeDescription {
  state: MatrixScopeState;
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
  scope: ProjectScopeReport | null | undefined,
  visibleRows: number,
): MatrixScopeDescription | null {
  if (!scope) return null;

  const label = scope.unscoped ? '' : shortProjectLabel(scope.projectId);
  const under = label ? `"${label}"` : 'this read';

  // Foreign rows first: it is the strongest claim on screen, and the only state in
  // which an EMPTY module is provably not an unreviewed one.
  if (scope.foreignRows > 0) {
    const blind = visibleRows === 0;
    return {
      state: 'foreign',
      show: true,
      level: blind ? 'bad' : 'warn',
      word: 'OTHER PROJECT',
      headline: blind
        ? `This module is not unreviewed — ${rowWord(scope.foreignRows)} of it are owned by another project and are not visible under ${under}.`
        : `${rowWord(scope.foreignRows)} of this module are owned by another project and are excluded from this view.`,
      note: scope.note,
    };
  }

  if (scope.legacyRows > 0 && scope.ownedRows === 0) {
    return {
      state: 'legacy',
      show: true,
      level: 'warn',
      word: 'UNATTRIBUTED',
      headline: scope.unscoped
        ? `No project is open, so this is the unattributed legacy set: ${rowWord(scope.legacyRows)} that no project owns. They exist and are shown — that is not the same as a module nothing has reviewed.`
        : `All ${rowWord(scope.legacyRows)} here are unattributed legacy rows that every project sees; nothing has been written under ${under}. They exist — that is not the same as a module nothing has reviewed.`,
      note: scope.note,
    };
  }

  if (scope.legacyRows > 0) {
    return {
      state: 'mixed',
      show: true,
      level: 'warn',
      word: 'PARTLY UNATTRIBUTED',
      headline: `${rowWord(scope.ownedRows)} are attributed to ${under}; ${rowWord(scope.legacyRows)} carry no project attribution and are shown to every project.`,
      note: scope.note,
    };
  }

  return {
    state: 'own',
    show: false,
    level: 'ok',
    word: 'SCOPED',
    headline: `${rowWord(scope.ownedRows)} in view, all attributed to ${under}. Nothing was excluded by scope.`,
    note: scope.note,
  };
}
