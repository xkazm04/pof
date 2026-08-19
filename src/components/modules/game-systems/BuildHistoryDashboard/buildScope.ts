/**
 * What the Builds tab's scoped read could and could not see, in the dashboard's own words.
 *
 * `build_history` is scoped by the SAME own-plus-legacy rule as `feature_matrix`
 * (`projectScopeSql`), so an empty Builds tab has exactly the four causes the matrix
 * has — and only one of them is "you have never built". The four-state CLASSIFICATION
 * is therefore delegated to `describeMatrixScope`, the one classifier: a second copy
 * of that decision is precisely how two subsystems drift into two behaviours.
 *
 * Only the SENTENCE is rewritten here. The matrix's copy talks about "rows", "modules"
 * and "the feature matrix"; a build dashboard that borrowed those nouns would be
 * describing a table it is not showing. Nouns are domain copy; the classification is not.
 *
 * Pure and display-only — it never changes what is queried or attributed. Adopting the
 * unattributed legacy builds is an operator decision and is deliberately not offered.
 */

import type { ProjectScopeCounts } from '@/lib/project-id';
import type { StatusLevel } from '@/lib/status-token';
import {
  describeMatrixScope,
  shortProjectLabel,
  type MatrixScopeState,
} from '@/components/modules/shared/FeatureMatrix/matrixScope';

export interface BuildScopeDescription {
  state: MatrixScopeState;
  /** False only for `own` — the read hid nothing, so a banner would be noise. */
  show: boolean;
  level: StatusLevel;
  word: string;
  /** One sentence that always names the build counts it is talking about. */
  headline: string;
  /** What the scoped query actually did, spelled out. */
  note: string;
}

/** `10 builds` / `1 build` — the counts are the whole point, so they are never elided. */
function buildWord(n: number): string {
  return `${n} build${n === 1 ? '' : 's'}`;
}

/**
 * The build-history equivalent of the feature matrix's report `note`: a plain
 * statement of what the scoped query returned and what it left out. Written here
 * because `getBuildScopeReport` returns bare counts (`ProjectScopeCounts`), not a
 * report carrying its own prose.
 */
export function buildScopeNote(scope: ProjectScopeCounts): string {
  const named = `${scope.distinctProjects} named project(s)`;
  return scope.unscoped
    ? `NO project was open, so this read was UNSCOPED: it returned only the ${scope.legacyRows} build(s) that carry no project attribution, and excluded ${scope.foreignRows} build(s) owned by ${named}. ${scope.totalRows} build(s) exist in total.`
    : `Scoped to "${scope.projectId}": ${scope.ownedRows} build(s) were recorded under it, ${scope.legacyRows} carry no project attribution (shown, because nothing proves they belong elsewhere), and ${scope.foreignRows} belong to another project and are NOT shown. ${scope.totalRows} build(s) exist in total across ${named}.`;
}

/**
 * @param scope         the counts the dashboard fetch returned, or null before it landed
 * @param visibleBuilds how many builds the tab actually has on screen — an empty tab
 *                      with foreign builds is the case this whole banner exists for,
 *                      so it is escalated rather than left as a quiet caveat.
 */
export function describeBuildScope(
  scope: ProjectScopeCounts | null | undefined,
  visibleBuilds: number,
): BuildScopeDescription | null {
  if (!scope) return null;

  const note = buildScopeNote(scope);
  // The ONE classifier decides the state, the ramp level and the tag word. `moduleId`
  // is absent because build history has no module dimension at all.
  const base = describeMatrixScope({ ...scope, note }, visibleBuilds);
  if (!base) return null;

  const label = scope.unscoped ? '' : shortProjectLabel(scope.projectId);
  const under = label ? `"${label}"` : 'this read';

  let headline: string;
  switch (base.state) {
    case 'foreign':
      headline = visibleBuilds === 0
        ? `This is not "you have never built" — ${buildWord(scope.foreignRows)} were recorded under another project and are not visible under ${under}.`
        : `${buildWord(scope.foreignRows)} were recorded under another project and are excluded from this view.`;
      break;
    case 'legacy':
      headline = scope.unscoped
        ? `No project is open, so this is the unattributed legacy set: ${buildWord(scope.legacyRows)} that no project owns. They exist and are shown — open a project to see its own builds.`
        : `All ${buildWord(scope.legacyRows)} here were recorded before builds carried a project; every project sees them. Nothing has been cooked under ${under} yet.`;
      break;
    case 'mixed':
      headline = `${buildWord(scope.ownedRows)} were cooked under ${under}; ${buildWord(scope.legacyRows)} carry no project attribution and are shown to every project.`;
      break;
    default:
      headline = `${buildWord(scope.ownedRows)} in view, all cooked under ${under}. Nothing was excluded by scope.`;
      break;
  }

  return { state: base.state, show: base.show, level: base.level, word: base.word, headline, note };
}

/**
 * What an EMPTY builds table is allowed to say.
 *
 * "No builds recorded yet" is a claim about the whole table, and the scoped read is
 * not entitled to make it: from wave 20 on, a project's own cooks are invisible to an
 * unscoped read and foreign cooks are invisible to a scoped one. When builds provably
 * exist elsewhere, the copy names them instead.
 */
export function emptyHistoryCopy(scope: ProjectScopeCounts | null | undefined): string {
  if (scope && scope.foreignRows > 0) {
    return `No builds are visible here, but ${buildWord(scope.foreignRows)} exist — they were recorded under another project. This is not "you have never built".`;
  }
  return 'No builds recorded yet. Use "Record" to add your first build.';
}
