import { getDb } from '@/lib/db';
import {
  normalizeProjectId,
  projectScopeSql,
  foldProjectScopeCounts,
  type ProjectScopeCounts,
} from '@/lib/project-id';
import { normalizePlatformId } from './build-profiles';

// ---------- Project scoping ----------
//
// `build_history.project_id` was added by the same migration block as
// `feature_matrix.project_id` and then written by NOTHING and read by NOTHING —
// `insertBuild`'s column list omitted it, so every row on this machine carries `''`.
// The consequence is not cosmetic: `lastGreenSizeBytes` took the most recent green
// build OF ANY PROJECT as the size baseline, so cooking one project after another's
// green build either fabricates a "package grew N%" regression or MASKS a real one
// behind a larger foreign reference.
//
// IDENTITY: the same normalized `projectPath` the rest of the app uses
// (`@/lib/project-id`), passed EXPLICITLY by the caller — never inferred here.
// RULE: the ONE own-plus-legacy `projectScopeSql` — a named project sees its own rows
// plus the unattributed `''` rows; an unscoped caller sees ONLY the `''` rows. The six
// existing `''` rows stay visible and counted (`getBuildScopeReport`); nothing guesses
// them into an owner.

/** WHERE fragment scoping a build read, optionally ANDed with more conditions. */
function buildScope(projectId?: string | null, ...extra: string[]): { where: string; params: string[] } {
  const scope = projectScopeSql(normalizeProjectId(projectId));
  const clauses = [scope.sql, ...extra];
  return { where: `WHERE ${clauses.join(' AND ')}`, params: scope.params };
}

/**
 * What a scoped build-history read could and could not see, in counts. Pure reporting
 * — it never moves a row or adopts one. Lets a UI say "6 builds belong to no recorded
 * project" instead of showing them as this project's history without comment.
 */
export function getBuildScopeReport(projectPath?: string | null): ProjectScopeCounts {
  const rows = getDb()
    .prepare('SELECT project_id, COUNT(*) as cnt FROM build_history GROUP BY project_id')
    .all() as { project_id: string; cnt: number }[];
  return foldProjectScopeCounts(
    rows.map((r) => ({ projectValue: r.project_id, count: r.cnt })),
    normalizeProjectId(projectPath),
  );
}

// ---------- Types ----------

export interface BuildRecord {
  id: number;
  /** Normalized project this build belongs to; `''` = recorded before the column was written. */
  projectId: string;
  platform: string;
  config: string;
  status: 'success' | 'failed' | 'cancelled';
  sizeBytes: number | null;
  durationMs: number | null;
  version: string | null;
  outputPath: string | null;
  errorSummary: string | null;
  cookTimeMs: number | null;
  warningCount: number;
  errorCount: number;
  notes: string | null;
  createdAt: string;
}

export interface BuildRecordInput {
  /** Project this build belongs to (raw `projectPath`; normalized on write). Omitted = unattributed. */
  projectId?: string | null;
  platform: string;
  config: string;
  status: 'success' | 'failed' | 'cancelled';
  sizeBytes?: number | null;
  durationMs?: number | null;
  version?: string | null;
  outputPath?: string | null;
  errorSummary?: string | null;
  cookTimeMs?: number | null;
  warningCount?: number;
  errorCount?: number;
  notes?: string | null;
}

export interface BuildStats {
  /** Every row in scope, cancelled included. */
  totalBuilds: number;
  successCount: number;
  failedCount: number;
  /**
   * Builds that actually reached a verdict (`success` + `failed`). A cancelled
   * build was never judged, so it belongs in NEITHER half of the split.
   */
  decidedBuilds: number;
  /** Builds the user (or a dropped client) aborted — judged by nothing. */
  cancelledCount: number;
  /**
   * success / decidedBuilds — NOT success / totalBuilds.
   *
   * Cancelled rows used to sit in the denominator while being excluded from
   * `failedCount`, so the Failed card's `100 - successRate` sub-label counted every
   * abort as a failure. Two aborts on a nine-build day read as 22% failing when
   * nothing had failed at all.
   */
  successRate: number;
  avgDurationMs: number | null;
  avgSizeBytes: number | null;
  latestVersion: string | null;
  platforms: PlatformStats[];
}

export interface PlatformStats {
  platform: string;
  total: number;
  success: number;
  failed: number;
  successRate: number;
  avgDurationMs: number | null;
  avgSizeBytes: number | null;
  latestSizeBytes: number | null;
}

export interface SizeTrendPoint {
  id: number;
  platform: string;
  sizeBytes: number;
  version: string | null;
  createdAt: string;
}

// ---------- Row mapping ----------

interface BuildRow {
  id: number;
  project_id: string | null;
  platform: string;
  config: string;
  status: string;
  size_bytes: number | null;
  duration_ms: number | null;
  version: string | null;
  output_path: string | null;
  error_summary: string | null;
  cook_time_ms: number | null;
  warning_count: number;
  error_count: number;
  notes: string | null;
  created_at: string;
}

function rowToRecord(row: BuildRow): BuildRecord {
  return {
    id: row.id,
    projectId: row.project_id ?? '',
    platform: row.platform,
    config: row.config,
    status: row.status as BuildRecord['status'],
    sizeBytes: row.size_bytes,
    durationMs: row.duration_ms,
    version: row.version,
    outputPath: row.output_path,
    errorSummary: row.error_summary,
    cookTimeMs: row.cook_time_ms,
    warningCount: row.warning_count ?? 0,
    errorCount: row.error_count ?? 0,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// ---------- CRUD ----------

export function insertBuild(input: BuildRecordInput): BuildRecord {
  const db = getDb();
  // Normalize the platform to its canonical token on write so every row stores
  // one spelling — budgets and history filters then match without guessing.
  // `project_id` is persisted here for the first time — the column existed from the
  // start and this INSERT omitted it, which is why every pre-existing row reads `''`.
  const result = db.prepare(`
    INSERT INTO build_history (project_id, platform, config, status, size_bytes, duration_ms, version, output_path, error_summary, cook_time_ms, warning_count, error_count, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    normalizeProjectId(input.projectId),
    normalizePlatformId(input.platform),
    input.config,
    input.status,
    input.sizeBytes ?? null,
    input.durationMs ?? null,
    input.version ?? null,
    input.outputPath ?? null,
    input.errorSummary ?? null,
    input.cookTimeMs ?? null,
    input.warningCount ?? 0,
    input.errorCount ?? 0,
    input.notes ?? null,
  );

  return getBuild(Number(result.lastInsertRowid))!;
}

export function getBuild(id: number): BuildRecord | null {
  const row = getDb().prepare('SELECT * FROM build_history WHERE id = ?').get(id) as BuildRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function getBuilds(limit = 100, offset = 0, projectId?: string | null): BuildRecord[] {
  const scope = buildScope(projectId);
  const rows = getDb().prepare(
    `SELECT * FROM build_history ${scope.where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...scope.params, limit, offset) as BuildRow[];
  return rows.map(rowToRecord);
}

export function getBuildsByPlatform(platform: string, limit = 50, projectId?: string | null): BuildRecord[] {
  const scope = buildScope(projectId, 'platform = ?');
  const rows = getDb().prepare(
    `SELECT * FROM build_history ${scope.where} ORDER BY created_at DESC LIMIT ?`
  ).all(...scope.params, normalizePlatformId(platform), limit) as BuildRow[];
  return rows.map(rowToRecord);
}

/**
 * The build the size-budget growth check compares against: the most recent green build
 * WITH A MEASURED SIZE for this platform, in scope of this project. `null` means there
 * is no reference — NOT that the package did not grow.
 *
 * Returning the record rather than a bare number so the verdict can NAME the build it
 * compared to. A baseline that silently came from another project is the failure this
 * exists to end, and a number alone cannot show which project it came from.
 */
export interface SizeBaselineBuild {
  buildId: number;
  projectId: string;
  platform: string;
  sizeBytes: number;
  version: string | null;
  createdAt: string;
}

export function lastGreenBaseline(platform: string, projectId?: string | null): SizeBaselineBuild | null {
  const recent = getBuildsByPlatform(platform, 50, projectId);
  const green = recent.find((b) => b.status === 'success' && b.sizeBytes && b.sizeBytes > 0);
  if (!green || green.sizeBytes == null) return null;
  return {
    buildId: green.id,
    projectId: green.projectId,
    platform: green.platform,
    sizeBytes: green.sizeBytes,
    version: green.version,
    createdAt: green.createdAt,
  };
}

/**
 * Size (bytes) of the most recent green build for a platform IN SCOPE of `projectId`,
 * or null when none has a measured size. Shared baseline for the size-budget growth
 * check so the scheduled runner and the interactive cook path evaluate against the
 * same "last green" reference.
 */
export function lastGreenSizeBytes(platform: string, projectId?: string | null): number | null {
  return lastGreenBaseline(platform, projectId)?.sizeBytes ?? null;
}

/**
 * Replace the notes on an existing build. Used by the interactive cook path to
 * append a size-regression note after the build is recorded (the regression can
 * only be evaluated once the size is known and the build row exists).
 */
export function updateBuildNotes(id: number, notes: string): void {
  getDb().prepare('UPDATE build_history SET notes = ? WHERE id = ?').run(notes, id);
}

/**
 * Add a note line to a build WITHOUT destroying what is already there.
 *
 * A build accumulates notes from more than one stage — `execute/route.ts` writes the
 * `[SIZE_BUDGET]` verdict the moment the size is known, and the smoke test appends its
 * own moments later. The smoke path used a wholesale `UPDATE ... SET notes = ?`, so the
 * size-regression verdict was silently overwritten and `extractRegressionNote` could
 * never find it again. Newline-joined, because that is exactly what
 * `extractRegressionNote` splits on.
 */
export function appendBuildNote(id: number, note: string): void {
  const db = getDb();
  const row = db.prepare('SELECT notes FROM build_history WHERE id = ?').get(id) as { notes: string | null } | undefined;
  if (!row) return;
  const merged = row.notes ? `${row.notes}\n${note}` : note;
  db.prepare('UPDATE build_history SET notes = ? WHERE id = ?').run(merged, id);
}

export function deleteBuild(id: number): boolean {
  const result = getDb().prepare('DELETE FROM build_history WHERE id = ?').run(id);
  return result.changes > 0;
}

/** What a smoke verdict did to the build history — never a bare `BuildRecord | null`. */
export interface SmokeAttachment {
  /** The build the verdict landed on, or null when none was in scope. */
  build: BuildRecord | null;
  /** The status that build carried BEFORE the verdict. */
  previousStatus: BuildRecord['status'] | null;
  /** True when the verdict CHANGED the build's status — the UI must reconcile. */
  statusChanged: boolean;
  /**
   * Why nothing was recorded, when `build` is null. A smoke test whose verdict went
   * nowhere used to return `recordedToBuildId: null` beside a pass, which reads as
   * "verified" — the only proof the packaged exe runs, silently discarded.
   */
  unrecordedReason: string | null;
}

/**
 * Attach a post-cook smoke verdict to the most recent successful build for a
 * platform+config, IN SCOPE of the project that cooked it. The smoke-test runs
 * immediately after a cook, so the latest matching success is reliably the build it
 * verified.
 *
 * `smokeStatus` is the verdict itself, and a `fail` CONDEMNS the build: status flips
 * to `failed` and the note becomes its `errorSummary`. This is the classification the
 * scheduled runner has always made (`smokeFailed ? 'failed' : 'success'`,
 * `scheduled-build-runner.ts:136`); the interactive path had no equivalent, so a build
 * whose exe died in 25 s stayed `status='success'` in history forever. The runner is
 * deliberately unchanged — this converges onto it.
 *
 * The note is APPENDED (see {@link appendBuildNote}), so a `[SIZE_BUDGET]` note written
 * moments earlier survives.
 */
export function attachSmokeResultToLatestBuild(
  platform: string,
  config: string,
  note: string,
  projectId?: string | null,
  smokeStatus?: 'pass' | 'fail',
): SmokeAttachment {
  const db = getDb();
  const normalizedPlatform = normalizePlatformId(platform);
  const scope = buildScope(projectId, 'platform = ?', 'config = ?', "status = 'success'");
  const row = db.prepare(
    `SELECT id, status FROM build_history ${scope.where} ORDER BY created_at DESC LIMIT 1`
  ).get(...scope.params, normalizedPlatform, config) as { id: number; status: string } | undefined;

  if (!row) {
    const where = normalizeProjectId(projectId)
      ? `project "${normalizeProjectId(projectId)}" (or the unattributed legacy set)`
      : 'the unattributed legacy set — no project was named on the request';
    return {
      build: null,
      previousStatus: null,
      statusChanged: false,
      unrecordedReason:
        `no successful ${normalizedPlatform}/${config} build is recorded under ${where}, `
        + 'so this smoke verdict was NOT saved to build history.',
    };
  }

  const previousStatus = row.status as BuildRecord['status'];
  appendBuildNote(row.id, note);

  const condemned = smokeStatus === 'fail';
  if (condemned) {
    db.prepare('UPDATE build_history SET status = ?, error_summary = ? WHERE id = ?')
      .run('failed', note, row.id);
  }

  return {
    build: getBuild(row.id),
    previousStatus,
    statusChanged: condemned && previousStatus !== 'failed',
    unrecordedReason: null,
  };
}

// ---------- Analytics ----------

export function getBuildStats(projectId?: string | null): BuildStats {
  const db = getDb();
  const s = buildScope(projectId);
  const p = s.params;

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM build_history ${s.where}`).get(...p) as { cnt: number };
  const success = db.prepare(`SELECT COUNT(*) as cnt FROM build_history ${s.where} AND status = 'success'`).get(...p) as { cnt: number };
  const failed = db.prepare(`SELECT COUNT(*) as cnt FROM build_history ${s.where} AND status = 'failed'`).get(...p) as { cnt: number };
  const cancelled = db.prepare(`SELECT COUNT(*) as cnt FROM build_history ${s.where} AND status = 'cancelled'`).get(...p) as { cnt: number };
  const avgDur = db.prepare(`SELECT AVG(duration_ms) as v FROM build_history ${s.where} AND duration_ms IS NOT NULL AND status = 'success'`).get(...p) as { v: number | null };
  const avgSize = db.prepare(`SELECT AVG(size_bytes) as v FROM build_history ${s.where} AND size_bytes IS NOT NULL AND status = 'success'`).get(...p) as { v: number | null };
  const latest = db.prepare(`SELECT version FROM build_history ${s.where} AND version IS NOT NULL ORDER BY created_at DESC LIMIT 1`).get(...p) as { version: string } | undefined;

  // Per-platform stats
  const platformRows = db.prepare(`
    SELECT
      platform,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      AVG(CASE WHEN status = 'success' AND duration_ms IS NOT NULL THEN duration_ms END) as avg_dur,
      AVG(CASE WHEN status = 'success' AND size_bytes IS NOT NULL THEN size_bytes END) as avg_size
    FROM build_history
    ${s.where}
    GROUP BY platform
    ORDER BY total DESC
  `).all(...p) as Array<{
    platform: string; total: number; success: number; failed: number;
    avg_dur: number | null; avg_size: number | null;
  }>;

  // Latest green size per platform in ONE window-function query (avoids the
  // former N+1: one SELECT per platform inside the .map below).
  const latestSizeRows = db.prepare(`
    SELECT platform, size_bytes FROM (
      SELECT platform, size_bytes,
        ROW_NUMBER() OVER (PARTITION BY platform ORDER BY created_at DESC) rn
      FROM build_history
      ${s.where} AND size_bytes IS NOT NULL AND status = 'success'
    ) WHERE rn = 1
  `).all(...p) as Array<{ platform: string; size_bytes: number }>;
  const latestSizeByPlatform = new Map<string, number>(
    latestSizeRows.map((r) => [r.platform, r.size_bytes])
  );

  const platforms: PlatformStats[] = platformRows.map((r) => ({
    platform: r.platform,
    total: r.total,
    success: r.success,
    failed: r.failed,
    // Same rule as the top-level rate: a cancelled build was judged by nothing
    // and must not dilute the platform's success percentage.
    successRate: r.success + r.failed > 0 ? (r.success / (r.success + r.failed)) * 100 : 0,
    avgDurationMs: r.avg_dur ? Math.round(r.avg_dur) : null,
    avgSizeBytes: r.avg_size ? Math.round(r.avg_size) : null,
    latestSizeBytes: latestSizeByPlatform.get(r.platform) ?? null,
  }));

  const decided = success.cnt + failed.cnt;
  return {
    totalBuilds: total.cnt,
    successCount: success.cnt,
    failedCount: failed.cnt,
    decidedBuilds: decided,
    cancelledCount: cancelled.cnt,
    successRate: decided > 0 ? (success.cnt / decided) * 100 : 0,
    avgDurationMs: avgDur.v ? Math.round(avgDur.v) : null,
    avgSizeBytes: avgSize.v ? Math.round(avgSize.v) : null,
    latestVersion: latest?.version ?? null,
    platforms,
  };
}

export function getSizeTrend(platform?: string, limit = 30, projectId?: string | null): SizeTrendPoint[] {
  const db = getDb();
  const s = buildScope(
    projectId,
    'size_bytes IS NOT NULL',
    "status = 'success'",
    ...(platform ? ['platform = ?'] : []),
  );
  const query = `SELECT id, platform, size_bytes, version, created_at FROM build_history ${s.where} ORDER BY created_at ASC LIMIT ?`;

  const params: (string | number)[] = platform
    ? [...s.params, normalizePlatformId(platform), limit]
    : [...s.params, limit];
  const rows = db.prepare(query).all(...params) as Array<{
    id: number; platform: string; size_bytes: number; version: string | null; created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    sizeBytes: r.size_bytes,
    version: r.version,
    createdAt: r.created_at,
  }));
}

export function getPlatforms(projectId?: string | null): string[] {
  const s = buildScope(projectId);
  const rows = getDb()
    .prepare(`SELECT DISTINCT platform FROM build_history ${s.where} ORDER BY platform`)
    .all(...s.params) as Array<{ platform: string }>;
  return rows.map((r) => r.platform);
}
