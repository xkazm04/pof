import { getDb } from '@/lib/db';

// ---------- Types ----------

export interface BuildRecord {
  id: number;
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
  totalBuilds: number;
  successCount: number;
  failedCount: number;
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
  const result = db.prepare(`
    INSERT INTO build_history (platform, config, status, size_bytes, duration_ms, version, output_path, error_summary, cook_time_ms, warning_count, error_count, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.platform,
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

export function getBuilds(limit = 100, offset = 0): BuildRecord[] {
  const rows = getDb().prepare(
    'SELECT * FROM build_history ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as BuildRow[];
  return rows.map(rowToRecord);
}

export function getBuildsByPlatform(platform: string, limit = 50): BuildRecord[] {
  const rows = getDb().prepare(
    'SELECT * FROM build_history WHERE platform = ? ORDER BY created_at DESC LIMIT ?'
  ).all(platform, limit) as BuildRow[];
  return rows.map(rowToRecord);
}

export function deleteBuild(id: number): boolean {
  const result = getDb().prepare('DELETE FROM build_history WHERE id = ?').run(id);
  return result.changes > 0;
}

// ---------- Analytics ----------

export function getBuildStats(): BuildStats {
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as cnt FROM build_history').get() as { cnt: number };
  const success = db.prepare("SELECT COUNT(*) as cnt FROM build_history WHERE status = 'success'").get() as { cnt: number };
  const failed = db.prepare("SELECT COUNT(*) as cnt FROM build_history WHERE status = 'failed'").get() as { cnt: number };
  const avgDur = db.prepare("SELECT AVG(duration_ms) as v FROM build_history WHERE duration_ms IS NOT NULL AND status = 'success'").get() as { v: number | null };
  const avgSize = db.prepare("SELECT AVG(size_bytes) as v FROM build_history WHERE size_bytes IS NOT NULL AND status = 'success'").get() as { v: number | null };
  const latest = db.prepare("SELECT version FROM build_history WHERE version IS NOT NULL ORDER BY created_at DESC LIMIT 1").get() as { version: string } | undefined;

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
    GROUP BY platform
    ORDER BY total DESC
  `).all() as Array<{
    platform: string; total: number; success: number; failed: number;
    avg_dur: number | null; avg_size: number | null;
  }>;

  const platforms: PlatformStats[] = platformRows.map((r) => {
    // Latest size for this platform
    const latestSize = db.prepare(
      "SELECT size_bytes FROM build_history WHERE platform = ? AND size_bytes IS NOT NULL AND status = 'success' ORDER BY created_at DESC LIMIT 1"
    ).get(r.platform) as { size_bytes: number } | undefined;

    return {
      platform: r.platform,
      total: r.total,
      success: r.success,
      failed: r.failed,
      successRate: r.total > 0 ? (r.success / r.total) * 100 : 0,
      avgDurationMs: r.avg_dur ? Math.round(r.avg_dur) : null,
      avgSizeBytes: r.avg_size ? Math.round(r.avg_size) : null,
      latestSizeBytes: latestSize?.size_bytes ?? null,
    };
  });

  return {
    totalBuilds: total.cnt,
    successCount: success.cnt,
    failedCount: failed.cnt,
    successRate: total.cnt > 0 ? (success.cnt / total.cnt) * 100 : 0,
    avgDurationMs: avgDur.v ? Math.round(avgDur.v) : null,
    avgSizeBytes: avgSize.v ? Math.round(avgSize.v) : null,
    latestVersion: latest?.version ?? null,
    platforms,
  };
}

export function getSizeTrend(platform?: string, limit = 30): SizeTrendPoint[] {
  const db = getDb();
  const query = platform
    ? "SELECT id, platform, size_bytes, version, created_at FROM build_history WHERE size_bytes IS NOT NULL AND status = 'success' AND platform = ? ORDER BY created_at ASC LIMIT ?"
    : "SELECT id, platform, size_bytes, version, created_at FROM build_history WHERE size_bytes IS NOT NULL AND status = 'success' ORDER BY created_at ASC LIMIT ?";

  const params = platform ? [platform, limit] : [limit];
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

export function getPlatforms(): string[] {
  const rows = getDb().prepare('SELECT DISTINCT platform FROM build_history ORDER BY platform').all() as Array<{ platform: string }>;
  return rows.map((r) => r.platform);
}
