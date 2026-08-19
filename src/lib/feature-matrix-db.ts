import { getDb } from './db';
import { logger } from '@/lib/logger';
import type { SubModuleId } from '@/types/modules';
import { FEATURE_STATUSES, normalizeFeatureSource } from '@/types/feature-matrix';
import type { FeatureRow, FeatureSource, FeatureStatus, FeatureSummary } from '@/types/feature-matrix';

const VALID_STATUSES: Set<string> = new Set(FEATURE_STATUSES);

/** The five per-status count fields, keyed by FeatureStatus. Shared across snapshot/aggregate rows. */
type StatusCounts = Record<FeatureStatus, number>;

/** SQL fragment: per-status `SUM(CASE WHEN status = X THEN 1 ELSE 0 END) as X` count columns,
 *  derived from FEATURE_STATUSES so the column list can never drift from the status tuple.
 *  Statuses come from a hardcoded const tuple (never user input), so interpolation is injection-safe. */
const STATUS_COUNT_COLUMNS = FEATURE_STATUSES.map(
  (s) => `SUM(CASE WHEN status = '${s}' THEN 1 ELSE 0 END) as ${s}`,
).join(',\n         ');

/** Ensure DB is initialized (tables created by getDb()). Call at the top of every exported function. */
function ensureTables() {
  getDb();
}

function validateStatus(status: string): FeatureStatus {
  return VALID_STATUSES.has(status) ? (status as FeatureStatus) : 'unknown';
}

// ─── Project scoping ─────────────────────────────────────────────────────────
//
// `project_id` was added to `feature_matrix` and `review_snapshots` by a migration
// and then read and written by NOTHING: the schema LOOKED scoped while every query
// was global, so switching projects scored project B's checklist against project A's
// scan rows. This block makes the column real on every path.
//
// IDENTITY: the active project is its `projectPath` — the value the client already
// persists (`projectStore.projectPath`), the value `/api/gdd-compliance` already
// receives, and the same key `gdd_gap_resolutions.project_path` scopes by. It is
// passed EXPLICITLY (query param / body field / function argument); nothing here
// infers it, because a read that guessed which project it was scoped to would be
// exactly the silent mis-attribution this change exists to remove.
//
// NOT in this slice (phase 2, deliberately): the UNIQUE key is still
// `(module_id, feature_name)` — so a feature is physically ONE row and can belong
// to only one project at a time — and legacy rows are NOT backfilled. Both are
// reported by {@link getProjectScopeReport} rather than migrated.

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
 * WHERE fragment + params scoping a read to the active project.
 *
 * - A NAMED project sees its own rows **plus** the unattributed legacy rows
 *   (`project_id = ''`). Legacy rows cannot be proven to belong to anyone else, and
 *   a user's whole matrix vanishing is a worse failure than the contamination this
 *   change is narrowing — so they stay visible and are COUNTED
 *   (`ProjectScopeReport.legacyRows`) instead of being hidden or silently adopted.
 * - An UNSCOPED caller (no project named) sees ONLY the legacy set. It does not
 *   silently get everything: rows owned by named projects are excluded and counted
 *   as `foreignRows`, so the ambiguity is stated rather than papered over.
 */
function projectScopeSql(projectId: string, col = 'project_id'): { sql: string; params: string[] } {
  return projectId
    ? { sql: `(${col} = ? OR ${col} = '')`, params: [projectId] }
    : { sql: `${col} = ''`, params: [] };
}

/**
 * What a scoped read could and could not see, in counts — the "REPORT, don't
 * migrate" half of the slice. Surfaced by the feature-matrix routes so the operator
 * can see the contamination before any key migration is attempted.
 */
export interface ProjectScopeReport {
  /** The normalized project this report describes (`''` = no project was named). */
  projectId: string;
  /** True when the caller named no project — the read saw ONLY unattributed rows. */
  unscoped: boolean;
  /** The module the counts are restricted to, or `null` for project-wide counts. */
  moduleId: string | null;
  /** Every `feature_matrix` row in scope of `moduleId` (all projects). */
  totalRows: number;
  /** Rows carrying no project attribution (`project_id = ''`) — visible to everyone. */
  legacyRows: number;
  /** Rows explicitly owned by this project. 0 while nothing has written under it. */
  ownedRows: number;
  /** Rows owned by a DIFFERENT named project — excluded from this read. */
  foreignRows: number;
  /** Every distinct `project_id` present, with its row count (`''` included). */
  projects: { projectId: string; rows: number }[];
  /** How many DISTINCT named projects are represented (excludes the legacy `''` bucket). */
  distinctProjects: number;
  /** The same four counts for `review_snapshots`. */
  snapshots: { totalRows: number; legacyRows: number; ownedRows: number; foreignRows: number };
  /** Plain statement of what this scope saw — never a claim it verified anything. */
  note: string;
}

interface ScopeCounts {
  total: number;
  legacy: number;
  owned: number;
  foreign: number;
}

function countScope(table: string, projectId: string, moduleId?: string): ScopeCounts {
  const where = moduleId ? 'WHERE module_id = ?' : '';
  const params = moduleId ? [moduleId] : [];
  const rows = getDb()
    .prepare(`SELECT project_id, COUNT(*) as cnt FROM ${table} ${where} GROUP BY project_id`)
    .all(...params) as { project_id: string; cnt: number }[];

  const counts: ScopeCounts = { total: 0, legacy: 0, owned: 0, foreign: 0 };
  for (const r of rows) {
    counts.total += r.cnt;
    if (r.project_id === '') counts.legacy += r.cnt;
    else if (r.project_id === projectId) counts.owned += r.cnt;
    else counts.foreign += r.cnt;
  }
  return counts;
}

/**
 * Count what the active project can and cannot see. Pure reporting — it never
 * moves a row, adopts one, or changes a status.
 */
export function getProjectScopeReport(projectId?: string, moduleId?: string): ProjectScopeReport {
  ensureTables();
  const pid = normalizeProjectId(projectId);
  const rows = countScope('feature_matrix', pid, moduleId);
  const snaps = countScope('review_snapshots', pid, moduleId);

  const projectRows = getDb()
    .prepare('SELECT project_id, COUNT(*) as cnt FROM feature_matrix GROUP BY project_id ORDER BY project_id')
    .all() as { project_id: string; cnt: number }[];
  const projects = projectRows.map((r) => ({ projectId: r.project_id, rows: r.cnt }));
  const distinctProjects = projects.filter((p) => p.projectId !== '').length;

  const where = moduleId ? `module "${moduleId}"` : 'the feature matrix';
  const note = pid
    ? `Scoped to "${pid}": ${rows.owned} row(s) of ${where} are attributed to it, ` +
      `${rows.legacy} carry no project attribution (shown, because nothing proves they belong elsewhere), ` +
      `and ${rows.foreign} belong to another project and are NOT shown. ` +
      `${distinctProjects} named project(s) are represented across the table. ` +
      `The UNIQUE key is still (module_id, feature_name), so a feature is one row and can be held by only one project — phase 2.`
    : `NO project was named, so this read is UNSCOPED: it returned only the ${rows.legacy} unattributed row(s) of ${where} ` +
      `and excluded ${rows.foreign} row(s) owned by ${distinctProjects} named project(s). ` +
      `This is not a project-wide view — it is the legacy set, stated as such.`;

  return {
    projectId: pid,
    unscoped: pid === '',
    moduleId: moduleId ?? null,
    totalRows: rows.total,
    legacyRows: rows.legacy,
    ownedRows: rows.owned,
    foreignRows: rows.foreign,
    projects,
    distinctProjects,
    snapshots: {
      totalRows: snaps.total,
      legacyRows: snaps.legacy,
      ownedRows: snaps.owned,
      foreignRows: snaps.foreign,
    },
    note,
  };
}

function clampQualityScore(score: unknown): number | null {
  if (typeof score !== 'number' || isNaN(score)) return null;
  return Math.min(5, Math.max(1, Math.round(score)));
}

/**
 * Normalize a review timestamp to ISO-8601 UTC before it is stored.
 *
 * `last_reviewed_at` is the evidence date the GDD compliance engine reads, and it
 * compares those values across rows. Storing whatever text a caller supplied made
 * two equally-valid spellings of the same instant (`2026-08-18T00:00:00+02:00` vs
 * the UTC form) sort against each other by their first differing CHARACTER. Every
 * parseable value is written in one canonical spelling so lexical and chronological
 * order agree. An unparseable value is passed through untouched rather than
 * silently replaced with `now` — inventing a date is the failure mode this whole
 * column exists to prevent; the import route rejects such values up front.
 */
export function normalizeReviewTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? value : new Date(ms).toISOString();
}

interface RawRow {
  id: number;
  module_id: string;
  feature_name: string;
  category: string;
  status: string;
  description: string;
  file_paths: string;
  review_notes: string;
  quality_score: number | null;
  next_steps: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  source: string | null;
}

function safeParseJsonArray(value: string | null | undefined, rowId: number): string[] {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    logger.warn(`[feature-matrix-db] Corrupt file_paths JSON in row ${rowId}, falling back to []`);
    return [];
  }
}

function toFeatureRow(raw: RawRow): FeatureRow {
  return {
    id: raw.id,
    moduleId: raw.module_id as SubModuleId,
    featureName: raw.feature_name,
    category: raw.category,
    status: raw.status as FeatureStatus,
    description: raw.description,
    filePaths: safeParseJsonArray(raw.file_paths, raw.id),
    reviewNotes: raw.review_notes,
    qualityScore: raw.quality_score,
    nextSteps: raw.next_steps || '',
    lastReviewedAt: raw.last_reviewed_at,
    source: normalizeFeatureSource(raw.source),
  };
}

export function getFeaturesByModule(moduleId: SubModuleId, projectId?: string): FeatureRow[] {
  ensureTables();
  const scope = projectScopeSql(normalizeProjectId(projectId));
  const rows = getDb()
    .prepare(
      `SELECT * FROM feature_matrix WHERE module_id = ? AND ${scope.sql} ORDER BY category, feature_name`,
    )
    .all(moduleId, ...scope.params) as RawRow[];
  return rows.map(toFeatureRow);
}

export function getFeatureSummary(moduleId: SubModuleId, projectId?: string): FeatureSummary {
  ensureTables();
  const scope = projectScopeSql(normalizeProjectId(projectId));
  const rows = getDb()
    .prepare(
      `SELECT status, COUNT(*) as cnt FROM feature_matrix WHERE module_id = ? AND ${scope.sql} GROUP BY status`
    )
    .all(moduleId, ...scope.params) as { status: string; cnt: number }[];

  const summary: FeatureSummary = { total: 0, implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0 };
  for (const row of rows) {
    const count = row.cnt;
    summary.total += count;
    if (row.status in summary) {
      summary[row.status as keyof Omit<FeatureSummary, 'total'>] = count;
    }
  }
  return summary;
}

export interface UpsertFeature {
  featureName: string;
  category: string;
  status: FeatureStatus;
  description: string;
  filePaths: string[];
  reviewNotes: string;
  qualityScore?: number | null;
  nextSteps?: string;
  lastReviewedAt?: string | null;
}

/** What an upsert batch actually did — so a caller can report it instead of assuming. */
export interface UpsertResult {
  /** Rows the statements actually changed (a `seedOnly` batch is DO NOTHING on existing rows). */
  written: number;
  /** The project every written row is now stamped with. */
  projectId: string;
  /**
   * Rows this write took over from a DIFFERENT named project.
   *
   * The UNIQUE key is still `(module_id, feature_name)`, so a feature is physically
   * ONE row: a full upsert under project B necessarily overwrites project A's row.
   * Stamping the writer is the honest half (the project that wrote can see what it
   * wrote); this count is the other half — the takeover is REPORTED rather than
   * silent. Phase 2 (project in the UNIQUE key) is what removes the takeover itself.
   */
  takenOver: number;
}

export function upsertFeatures(
  moduleId: SubModuleId,
  features: UpsertFeature[],
  opts?: { seedOnly?: boolean; source?: FeatureSource; projectId?: string },
): UpsertResult {
  ensureTables();
  const db = getDb();
  const projectId = normalizeProjectId(opts?.projectId);
  // Provenance travels with the WRITE PATH, not with the individual row: one call
  // is one path (a CLI review, an auto-verify sweep, a seed). Callers that do not
  // say which they are get 'unknown' — silence must not be able to claim 'review'.
  const source = normalizeFeatureSource(opts?.source);
  // seedOnly = insert-if-missing: seeding static definitions must never
  // clobber an existing row's review data (statuses, scores, notes) — the
  // full DO UPDATE path is for real reviews/imports only.
  const conflictClause = opts?.seedOnly
    ? 'ON CONFLICT(module_id, feature_name) DO NOTHING'
    : `ON CONFLICT(module_id, feature_name) DO UPDATE SET
      category = excluded.category,
      status = excluded.status,
      description = excluded.description,
      file_paths = excluded.file_paths,
      review_notes = excluded.review_notes,
      quality_score = excluded.quality_score,
      next_steps = excluded.next_steps,
      last_reviewed_at = excluded.last_reviewed_at,
      source = excluded.source,
      project_id = excluded.project_id,
      updated_at = datetime('now')`;
  const stmt = db.prepare(`
    INSERT INTO feature_matrix (module_id, feature_name, category, status, description, file_paths, review_notes, quality_score, next_steps, last_reviewed_at, source, project_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ${conflictClause}
  `);

  // Which of the rows this batch touches are currently held by ANOTHER named
  // project. Measured BEFORE the write, because the write reassigns them.
  const ownerStmt = db.prepare(
    'SELECT project_id FROM feature_matrix WHERE module_id = ? AND feature_name = ?',
  );

  // Count what the statements ACTUALLY wrote. A seedOnly batch is `DO NOTHING` on
  // every existing row, so the input array says nothing about whether the table
  // changed — and a snapshot taken off the input records a "review" that never
  // touched a row.
  const transaction = db.transaction((items: UpsertFeature[]) => {
    let written = 0;
    let takenOver = 0;
    for (const f of items) {
      const owner = ownerStmt.get(moduleId, f.featureName) as { project_id: string } | undefined;
      const isForeign =
        owner !== undefined && owner.project_id !== '' && owner.project_id !== projectId;
      const info = stmt.run(
        moduleId,
        f.featureName,
        f.category,
        validateStatus(f.status),
        f.description,
        JSON.stringify(f.filePaths),
        f.reviewNotes,
        clampQualityScore(f.qualityScore),
        f.nextSteps ?? '',
        normalizeReviewTimestamp(f.lastReviewedAt),
        source,
        projectId,
      );
      written += info.changes;
      // A `seedOnly` conflict is DO NOTHING: nothing changed, so nothing was taken.
      if (isForeign && info.changes > 0) takenOver += 1;
    }
    return { written, takenOver };
  });

  const { written: writtenRows, takenOver } = transaction(features) as {
    written: number;
    takenOver: number;
  };

  if (takenOver > 0) {
    logger.warn(
      `[feature-matrix-db] ${takenOver} row(s) in "${moduleId}" were re-assigned to project ` +
        `"${projectId || '(unscoped)'}" by this write — the UNIQUE key is still ` +
        `(module_id, feature_name), so one feature is one row across all projects (phase 2).`,
    );
  }

  // Auto-capture a review snapshot after upsert — only when a row actually changed
  // AND the batch carried a verdict (a seed of `unknown` placeholders is not a review).
  const hasReviewData = features.some(
    (f) => f.status !== 'unknown' || f.qualityScore != null,
  );
  if (writtenRows > 0 && hasReviewData) {
    captureReviewSnapshot(moduleId, projectId);
  }

  return { written: writtenRows, projectId, takenOver };
}

/** Outcome of a single-row status write, so the caller can report what happened
 *  instead of always answering `{ updated: true }`. */
export interface StatusUpdateResult {
  /** False when no row matched (module/feature name typo, or the row was never seeded). */
  updated: boolean;
  /** The status the row held before this write (`null` when no row matched). */
  previousStatus: FeatureStatus | null;
  /** True when the write actually moved the status — the signal a snapshot needs. */
  statusChanged: boolean;
  /** The review timestamp stamped by this write (`null` when nothing was written). */
  reviewedAt: string | null;
  source: FeatureSource;
  /**
   * When the row EXISTS but belongs to a different named project, its owner —
   * so the 404 can say "another project holds that row" instead of the flatly
   * wrong "no such feature". `null` in every other case.
   */
  foreignOwner: string | null;
}

/**
 * Update ONE row's status — the CLI fix flow's write path.
 *
 * This used to write `status` + `updated_at` and nothing else, which broke the row's
 * provenance in the worst possible direction: the status became NEW while
 * `last_reviewed_at` still pointed at an older review that had assessed a DIFFERENT
 * state, and the compliance engine read that pair as a measured verdict with evidence
 * of that older date.
 *
 * DECISION: a fix DOES stamp `last_reviewed_at = now` and `source = 'fix'`.
 * The alternative — leaving the date alone and having the compliance engine discount
 * `fix` rows — keeps a date on the row that provably describes a different status, and
 * would require changing how compliance SCORES rather than what it reads. A fix is a
 * real, dated assertion about the row's current state; it is simply a weaker CLASS of
 * assertion than an independent review, because the actor that made the change is the
 * one reporting it. `source` carries that caveat explicitly (surfaced per row in the
 * matrix), so the date can be honest without anything having to be re-weighted.
 */
export function updateFeatureStatus(
  moduleId: SubModuleId,
  featureName: string,
  status: FeatureStatus,
  opts?: { source?: FeatureSource; reviewedAt?: string; projectId?: string },
): StatusUpdateResult {
  ensureTables();
  const db = getDb();
  const source = normalizeFeatureSource(opts?.source ?? 'fix');
  const projectId = normalizeProjectId(opts?.projectId);
  const reviewedAt = normalizeReviewTimestamp(opts?.reviewedAt) ?? new Date().toISOString();
  const nextStatus = validateStatus(status);

  const existing = db
    .prepare('SELECT status, project_id FROM feature_matrix WHERE module_id = ? AND feature_name = ?')
    .get(moduleId, featureName) as { status: string; project_id: string } | undefined;

  if (!existing) {
    return {
      updated: false, previousStatus: null, statusChanged: false,
      reviewedAt: null, source, foreignOwner: null,
    };
  }

  // The row exists but is held by another named project: this fix is about a
  // feature the active project cannot see, so it must not silently rewrite it.
  // Reported as a distinct outcome rather than folded into "no such feature".
  if (existing.project_id !== '' && existing.project_id !== projectId) {
    return {
      updated: false, previousStatus: null, statusChanged: false,
      reviewedAt: null, source, foreignOwner: existing.project_id,
    };
  }

  db.prepare(
    `UPDATE feature_matrix
     SET status = ?, last_reviewed_at = ?, source = ?, project_id = ?, updated_at = datetime('now')
     WHERE module_id = ? AND feature_name = ?`,
  ).run(nextStatus, reviewedAt, source, projectId, moduleId, featureName);

  const previousStatus = existing.status as FeatureStatus;
  const statusChanged = previousStatus !== nextStatus;
  // Only a real status move changes the module's counts — re-asserting the same
  // status is fresh evidence for the row but not a new point on the trend line.
  if (statusChanged) captureReviewSnapshot(moduleId, projectId);

  return { updated: true, previousStatus, statusChanged, reviewedAt, source, foreignOwner: null };
}

/** Delete a module's rows WITHIN the active project's scope (see {@link projectScopeSql}).
 *  An unscoped call clears only the unattributed legacy rows — it can never reach
 *  another project's matrix. */
export function clearModuleFeatures(moduleId: SubModuleId, projectId?: string): void {
  ensureTables();
  const scope = projectScopeSql(normalizeProjectId(projectId));
  getDb()
    .prepare(`DELETE FROM feature_matrix WHERE module_id = ? AND ${scope.sql}`)
    .run(moduleId, ...scope.params);
}

// ─── Aggregate queries for project-wide dashboard ─────────────────────────────

export interface ModuleAggregate {
  moduleId: SubModuleId;
  total: number;
  implemented: number;
  improved: number;
  partial: number;
  missing: number;
  unknown: number;
  avgQuality: number | null;
  lastReviewedAt: string | null;
}

// ─── Review snapshot tracking ─────────────────────────────────────────────────

export interface ReviewSnapshot {
  id: number;
  moduleId: SubModuleId;
  reviewedAt: string;
  total: number;
  implemented: number;
  improved: number;
  partial: number;
  missing: number;
  unknown: number;
  avgQuality: number | null;
}

/** Raw row returned by the review_snapshots SELECTs in getReviewHistory / getAllReviewHistory. */
interface SnapshotRow extends StatusCounts {
  id: number;
  module_id: string;
  reviewed_at: string;
  total: number;
  avg_quality: number | null;
}

/** Column list selected from review_snapshots. COALESCE(improved, 0) covers rows written before
 *  the improved column existed. Shared so getReviewHistory / getAllReviewHistory cannot drift. */
const SNAPSHOT_SELECT =
  `id, module_id, reviewed_at, total, implemented, COALESCE(improved, 0) as improved, partial, missing, unknown, avg_quality`;

/** Map a raw review_snapshots row to the public ReviewSnapshot shape (rounds avg quality to 1dp). */
function mapSnapshotRow(r: SnapshotRow): ReviewSnapshot {
  return {
    id: r.id,
    moduleId: r.module_id as SubModuleId,
    reviewedAt: r.reviewed_at,
    total: r.total,
    implemented: r.implemented,
    improved: r.improved,
    partial: r.partial,
    missing: r.missing,
    unknown: r.unknown,
    avgQuality: r.avg_quality !== null ? Math.round(r.avg_quality * 10) / 10 : null,
  };
}

/**
 * Retention bound per module. The table was unbounded — one row per review, forever,
 * for a trend line nothing reads more than ~20 points of. 200 keeps years of real
 * review history while giving the table a ceiling. Pruning can never empty a module:
 * it only ever deletes rows BEYOND the newest {@link MAX_SNAPSHOTS_PER_MODULE}.
 */
export const MAX_SNAPSHOTS_PER_MODULE = 200;

/**
 * Record the module's current counts as a point on its quality trend.
 *
 * Two ways this used to write points that were not review events:
 *  - the timestamp is `MAX(last_reviewed_at)`, so re-importing a report (same
 *    `reviewedAt`) appended a SECOND row at an identical timestamp — a duplicate
 *    point that reads as a flat stretch of the trend that never happened;
 *  - nothing bounded the table.
 *
 * A capture at a timestamp the module's latest snapshot already holds now updates
 * that row in place instead of appending beside it: one point per reviewed instant,
 * carrying the newest counts for it.
 */
export function captureReviewSnapshot(moduleId: SubModuleId, projectId?: string): void {
  ensureTables();
  const db = getDb();
  // The counts, the de-duplication probe and the prune are ALL scoped to the same
  // project. An unscoped capture that read the whole table would record another
  // project's rows as this project's trend point, and an unscoped prune would let a
  // busy project's history evict a quiet one's only point.
  const pid = normalizeProjectId(projectId);
  const scope = projectScopeSql(pid);
  const row = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         ${STATUS_COUNT_COLUMNS},
         AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END) as avg_quality,
         MAX(last_reviewed_at) as last_reviewed
       FROM feature_matrix
       WHERE module_id = ? AND ${scope.sql}`,
    )
    .get(moduleId, ...scope.params) as StatusCounts & {
    total: number;
    avg_quality: number | null;
    last_reviewed: string | null;
  };

  if (!row || row.total === 0) return;

  const reviewedAt = row.last_reviewed ?? new Date().toISOString();

  // Probed through the READ scope (own + legacy), because that is the set the
  // sparkline plots: inserting beside a legacy point at an identical timestamp
  // would re-create the duplicate-point lie across the project boundary. A matched
  // legacy row is updated in place and stays legacy — adopting it would be a
  // backfill, which is explicitly phase 2.
  const latest = db
    .prepare(
      `SELECT id, reviewed_at FROM review_snapshots
       WHERE module_id = ? AND ${scope.sql}
       ORDER BY reviewed_at DESC, id DESC
       LIMIT 1`,
    )
    .get(moduleId, ...scope.params) as { id: number; reviewed_at: string } | undefined;

  if (latest && latest.reviewed_at === reviewedAt) {
    db.prepare(
      `UPDATE review_snapshots
       SET total = ?, implemented = ?, improved = ?, partial = ?, missing = ?, unknown = ?, avg_quality = ?
       WHERE id = ?`,
    ).run(
      row.total, row.implemented, row.improved, row.partial, row.missing, row.unknown,
      row.avg_quality, latest.id,
    );
    return;
  }

  db.prepare(
    `INSERT INTO review_snapshots (module_id, reviewed_at, total, implemented, improved, partial, missing, unknown, avg_quality, project_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    moduleId,
    reviewedAt,
    row.total,
    row.implemented,
    row.improved,
    row.partial,
    row.missing,
    row.unknown,
    row.avg_quality,
    pid,
  );

  pruneReviewSnapshots(moduleId, pid);
}

/** Drop everything older than the newest {@link MAX_SNAPSHOTS_PER_MODULE} snapshots
 *  for one module. Scoped by `module_id`, so a quiet module's only point is never a
 *  casualty of a busy module's history — and by EXACT `project_id`, so a prune can
 *  only ever delete rows the same project inserted. (Deliberately narrower than the
 *  read scope: a project must not be able to evict another project's — or the shared
 *  legacy bucket's — history.) */
function pruneReviewSnapshots(moduleId: SubModuleId, projectId: string): void {
  getDb()
    .prepare(
      `DELETE FROM review_snapshots
       WHERE module_id = ? AND project_id = ?
         AND id NOT IN (
           SELECT id FROM review_snapshots
           WHERE module_id = ? AND project_id = ?
           ORDER BY reviewed_at DESC, id DESC
           LIMIT ?
         )`,
    )
    .run(moduleId, projectId, moduleId, projectId, MAX_SNAPSHOTS_PER_MODULE);
}

/**
 * The most RECENT `limit` snapshots for one module, oldest-first (the order the
 * sparkline plots left-to-right).
 *
 * This read `ORDER BY reviewed_at ASC LIMIT ?` — the OLDEST N — while its sibling
 * `getAllReviewHistory` already took the newest via ROW_NUMBER. Past 20 snapshots the
 * per-module sparkline froze on ancient history and never moved again, however many
 * reviews ran. The inner query takes the recent window; the outer restores chronology.
 */
export function getReviewHistory(
  moduleId: SubModuleId,
  limit = 20,
  projectId?: string,
): ReviewSnapshot[] {
  ensureTables();
  const scope = projectScopeSql(normalizeProjectId(projectId));
  const rows = getDb()
    .prepare(
      `SELECT * FROM (
         SELECT ${SNAPSHOT_SELECT}
         FROM review_snapshots
         WHERE module_id = ? AND ${scope.sql}
         ORDER BY reviewed_at DESC, id DESC
         LIMIT ?
       )
       ORDER BY reviewed_at ASC, id ASC`,
    )
    .all(moduleId, ...scope.params, limit) as SnapshotRow[];

  return rows.map(mapSnapshotRow);
}

export function getAllReviewHistory(limit = 20, projectId?: string): Record<string, ReviewSnapshot[]> {
  ensureTables();
  // The scope filter goes INSIDE the window function's source, so the per-module
  // "newest N" window is computed over this project's points — not over another
  // project's, which would silently shorten (or empty) the sparkline.
  const scope = projectScopeSql(normalizeProjectId(projectId));
  const rows = getDb()
    .prepare(
      `SELECT ${SNAPSHOT_SELECT}
       FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY module_id ORDER BY reviewed_at DESC) as rn
         FROM review_snapshots
         WHERE ${scope.sql}
       )
       WHERE rn <= ?
       ORDER BY module_id, reviewed_at ASC`,
    )
    .all(...scope.params, limit) as SnapshotRow[];

  const result: Record<string, ReviewSnapshot[]> = {};
  for (const r of rows) {
    if (!result[r.module_id]) result[r.module_id] = [];
    result[r.module_id].push(mapSnapshotRow(r));
  }
  return result;
}

// ─── All statuses (for dependency resolution) ────────────────────────────────

export interface FeatureStatusEntry {
  moduleId: SubModuleId;
  featureName: string;
  status: string;
}

export function getAllFeatureStatuses(projectId?: string): FeatureStatusEntry[] {
  ensureTables();
  const scope = projectScopeSql(normalizeProjectId(projectId));
  const rows = getDb()
    .prepare(`SELECT module_id, feature_name, status FROM feature_matrix WHERE ${scope.sql}`)
    .all(...scope.params) as { module_id: string; feature_name: string; status: string }[];
  return rows.map((r) => ({
    moduleId: r.module_id as SubModuleId,
    featureName: r.feature_name,
    status: r.status,
  }));
}

// ─── Aggregate queries for project-wide dashboard ─────────────────────────────

export function getAllModuleAggregates(projectId?: string): ModuleAggregate[] {
  ensureTables();
  const scope = projectScopeSql(normalizeProjectId(projectId));
  const rows = getDb()
    .prepare(
      `SELECT
         module_id,
         COUNT(*) as total,
         ${STATUS_COUNT_COLUMNS},
         AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END) as avg_quality,
         MAX(last_reviewed_at) as last_reviewed_at
       FROM feature_matrix
       WHERE ${scope.sql}
       GROUP BY module_id
       ORDER BY module_id`
    )
    .all(...scope.params) as (StatusCounts & {
    module_id: string;
    total: number;
    avg_quality: number | null;
    last_reviewed_at: string | null;
  })[];

  return rows.map((r) => ({
    moduleId: r.module_id as SubModuleId,
    total: r.total,
    implemented: r.implemented,
    improved: r.improved,
    partial: r.partial,
    missing: r.missing,
    unknown: r.unknown,
    avgQuality: r.avg_quality !== null ? Math.round(r.avg_quality * 10) / 10 : null,
    lastReviewedAt: r.last_reviewed_at,
  }));
}
