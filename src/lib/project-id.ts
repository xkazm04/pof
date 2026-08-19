/**
 * The ONE spelling of a project's identity.
 *
 * Extracted from `feature-matrix-db.ts` so the SCHEMA MIGRATION in `db.ts` can
 * derive the same id the application writes. A migration that backfills rows with
 * a differently-normalized id would attribute every legacy row to a project the
 * app can never match — the rows would still exist and still be invisible, which
 * is the failure mode a backfill exists to end. `feature-matrix-db.ts` re-exports
 * this, so nothing else needs to know where it lives.
 *
 * This module imports NOTHING (in particular not `./db`): it sits below the
 * database layer precisely so the migration can use it.
 */

/**
 * Normalize an active-project identity into the value stored in `project_id`.
 *
 * Paths are compared case-insensitively with forward slashes and no trailing
 * separator, so `C:\Users\...\PoF\` and `c:/users/.../pof` are one project rather
 * than three. An absent/blank value normalizes to `''` — the UNSCOPED id, which is
 * also what every legacy row carries.
 */
export function normalizeProjectId(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/** The id every legacy (never-attributed) row carries, and what an unscoped caller resolves to. */
export const UNSCOPED_PROJECT_ID = '';

/**
 * WHERE fragment + params scoping a read to the active project — the ONE
 * own-plus-legacy rule, shared by every project-scoped table.
 *
 * - A NAMED project sees its own rows **plus** the unattributed legacy rows
 *   (`project_id = ''`). Legacy rows cannot be proven to belong to anyone else, and
 *   a user's whole history vanishing is a worse failure than the contamination this
 *   rule narrows — so they stay visible and are COUNTED instead of hidden or
 *   silently adopted.
 * - An UNSCOPED caller (no project named) sees ONLY the legacy set. It does not
 *   silently get everything: rows owned by named projects are excluded and counted,
 *   so the ambiguity is stated rather than papered over.
 *
 * Lives here (not in `feature-matrix-db.ts`, where wave 15 first wrote it) because
 * `telemetry-db` and `build-history-store` scope with the SAME rule — a second copy
 * is exactly how two subsystems drift into two behaviours. `feature-matrix-db.ts`
 * re-exports it; nothing else needs to know where it lives.
 *
 * `col` is a caller-supplied column NAME, never user input — it is interpolated.
 */
export function projectScopeSql(projectId: string, col = 'project_id'): { sql: string; params: string[] } {
  return projectId
    ? { sql: `(${col} = ? OR ${col} = '')`, params: [projectId] }
    : { sql: `${col} = ''`, params: [] };
}

/**
 * The same own-plus-legacy rule applied in JS, for a table whose project column
 * stores a RAW (un-normalized) value — `telemetry_snapshots.project_path` holds the
 * spelling the scan was launched with, and normalizing it in SQL would be a second,
 * drift-prone re-implementation of {@link normalizeProjectId}.
 *
 * Both arguments are compared AFTER normalization, so this and `projectScopeSql`
 * decide identically for the same pair.
 */
export function isInProjectScope(rowValue: string | null | undefined, projectId: string): boolean {
  const row = normalizeProjectId(rowValue);
  return projectId ? row === projectId || row === UNSCOPED_PROJECT_ID : row === UNSCOPED_PROJECT_ID;
}

/** Which bucket a row falls in relative to a scope — the vocabulary the counts use. */
export type ProjectRowClass = 'owned' | 'legacy' | 'foreign';

export function classifyProjectRow(rowValue: string | null | undefined, projectId: string): ProjectRowClass {
  const row = normalizeProjectId(rowValue);
  if (row === UNSCOPED_PROJECT_ID) return 'legacy';
  return row === projectId ? 'owned' : 'foreign';
}

/** Counts of what a scoped read could and could not see. Reporting only — never moves a row. */
export interface ProjectScopeCounts {
  /** The normalized project these counts describe (`''` = no project was named). */
  projectId: string;
  /** True when the caller named no project — the read saw ONLY unattributed rows. */
  unscoped: boolean;
  /** Every row in the table (all projects). */
  totalRows: number;
  /** Rows carrying no project attribution — visible to everyone, adopted by no one. */
  legacyRows: number;
  /** Rows explicitly owned by this project. */
  ownedRows: number;
  /** Rows owned by a DIFFERENT named project — excluded from this read. */
  foreignRows: number;
  /** Every distinct project value present, normalized, with its row count (`''` included). */
  projects: { projectId: string; rows: number }[];
  /** DISTINCT named projects represented (excludes the legacy `''` bucket). */
  distinctProjects: number;
}

/**
 * Fold raw `(projectValue, count)` pairs into {@link ProjectScopeCounts}. Takes the
 * pairs rather than a table name so it works for a normalized `project_id` column and
 * a raw `project_path` column alike — both normalize through the same function here.
 */
export function foldProjectScopeCounts(
  rows: { projectValue: string | null | undefined; count: number }[],
  projectId: string,
): ProjectScopeCounts {
  const byProject = new Map<string, number>();
  const counts = { totalRows: 0, legacyRows: 0, ownedRows: 0, foreignRows: 0 };
  for (const r of rows) {
    const id = normalizeProjectId(r.projectValue);
    byProject.set(id, (byProject.get(id) ?? 0) + r.count);
    counts.totalRows += r.count;
    if (id === UNSCOPED_PROJECT_ID) counts.legacyRows += r.count;
    else if (id === projectId) counts.ownedRows += r.count;
    else counts.foreignRows += r.count;
  }
  const projects = [...byProject.entries()]
    .map(([pid, rowCount]) => ({ projectId: pid, rows: rowCount }))
    .sort((a, b) => b.rows - a.rows || a.projectId.localeCompare(b.projectId));
  return {
    projectId,
    unscoped: projectId === UNSCOPED_PROJECT_ID,
    ...counts,
    projects,
    distinctProjects: projects.filter((p) => p.projectId !== UNSCOPED_PROJECT_ID).length,
  };
}
