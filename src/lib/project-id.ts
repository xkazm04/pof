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
