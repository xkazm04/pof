import { getDb } from './db';
import type { FeatureRow, FeatureStatus, FeatureSummary } from '@/types/feature-matrix';

const VALID_STATUSES: Set<string> = new Set(['implemented', 'partial', 'missing', 'unknown']);

function validateStatus(status: string): FeatureStatus {
  return VALID_STATUSES.has(status) ? (status as FeatureStatus) : 'unknown';
}

function clampQualityScore(score: unknown): number | null {
  if (typeof score !== 'number' || isNaN(score)) return null;
  return Math.min(5, Math.max(1, Math.round(score)));
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
}

function toFeatureRow(raw: RawRow): FeatureRow {
  return {
    id: raw.id,
    moduleId: raw.module_id,
    featureName: raw.feature_name,
    category: raw.category,
    status: raw.status as FeatureStatus,
    description: raw.description,
    filePaths: JSON.parse(raw.file_paths || '[]'),
    reviewNotes: raw.review_notes,
    qualityScore: raw.quality_score,
    nextSteps: raw.next_steps || '',
    lastReviewedAt: raw.last_reviewed_at,
  };
}

export function getFeaturesByModule(moduleId: string): FeatureRow[] {
  const rows = getDb()
    .prepare('SELECT * FROM feature_matrix WHERE module_id = ? ORDER BY category, feature_name')
    .all(moduleId) as RawRow[];
  return rows.map(toFeatureRow);
}

export function getFeatureSummary(moduleId: string): FeatureSummary {
  const rows = getDb()
    .prepare(
      `SELECT status, COUNT(*) as cnt FROM feature_matrix WHERE module_id = ? GROUP BY status`
    )
    .all(moduleId) as { status: string; cnt: number }[];

  const summary: FeatureSummary = { total: 0, implemented: 0, partial: 0, missing: 0, unknown: 0 };
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

export function upsertFeatures(moduleId: string, features: UpsertFeature[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO feature_matrix (module_id, feature_name, category, status, description, file_paths, review_notes, quality_score, next_steps, last_reviewed_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(module_id, feature_name) DO UPDATE SET
      category = excluded.category,
      status = excluded.status,
      description = excluded.description,
      file_paths = excluded.file_paths,
      review_notes = excluded.review_notes,
      quality_score = excluded.quality_score,
      next_steps = excluded.next_steps,
      last_reviewed_at = excluded.last_reviewed_at,
      updated_at = datetime('now')
  `);

  const transaction = db.transaction((items: UpsertFeature[]) => {
    for (const f of items) {
      stmt.run(
        moduleId,
        f.featureName,
        f.category,
        validateStatus(f.status),
        f.description,
        JSON.stringify(f.filePaths),
        f.reviewNotes,
        clampQualityScore(f.qualityScore),
        f.nextSteps ?? '',
        f.lastReviewedAt ?? null
      );
    }
  });

  transaction(features);

  // Auto-capture a review snapshot after upsert (skip for seed-only writes with all unknown)
  const hasReviewData = features.some(
    (f) => f.status !== 'unknown' || f.qualityScore != null,
  );
  if (hasReviewData) {
    captureReviewSnapshot(moduleId);
  }
}

export function clearModuleFeatures(moduleId: string): void {
  getDb().prepare('DELETE FROM feature_matrix WHERE module_id = ?').run(moduleId);
}

// ─── Aggregate queries for project-wide dashboard ─────────────────────────────

export interface ModuleAggregate {
  moduleId: string;
  total: number;
  implemented: number;
  partial: number;
  missing: number;
  unknown: number;
  avgQuality: number | null;
  lastReviewedAt: string | null;
}

// ─── Review snapshot tracking ─────────────────────────────────────────────────

export interface ReviewSnapshot {
  id: number;
  moduleId: string;
  reviewedAt: string;
  total: number;
  implemented: number;
  partial: number;
  missing: number;
  unknown: number;
  avgQuality: number | null;
}

export function captureReviewSnapshot(moduleId: string): void {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'implemented' THEN 1 ELSE 0 END) as implemented,
         SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
         SUM(CASE WHEN status = 'missing' THEN 1 ELSE 0 END) as missing,
         SUM(CASE WHEN status = 'unknown' THEN 1 ELSE 0 END) as unknown,
         AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END) as avg_quality,
         MAX(last_reviewed_at) as last_reviewed
       FROM feature_matrix
       WHERE module_id = ?`,
    )
    .get(moduleId) as {
    total: number;
    implemented: number;
    partial: number;
    missing: number;
    unknown: number;
    avg_quality: number | null;
    last_reviewed: string | null;
  };

  if (!row || row.total === 0) return;

  db.prepare(
    `INSERT INTO review_snapshots (module_id, reviewed_at, total, implemented, partial, missing, unknown, avg_quality)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    moduleId,
    row.last_reviewed ?? new Date().toISOString(),
    row.total,
    row.implemented,
    row.partial,
    row.missing,
    row.unknown,
    row.avg_quality,
  );
}

export function getReviewHistory(moduleId: string, limit = 20): ReviewSnapshot[] {
  const rows = getDb()
    .prepare(
      `SELECT id, module_id, reviewed_at, total, implemented, partial, missing, unknown, avg_quality
       FROM review_snapshots
       WHERE module_id = ?
       ORDER BY reviewed_at ASC
       LIMIT ?`,
    )
    .all(moduleId, limit) as {
    id: number;
    module_id: string;
    reviewed_at: string;
    total: number;
    implemented: number;
    partial: number;
    missing: number;
    unknown: number;
    avg_quality: number | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    moduleId: r.module_id,
    reviewedAt: r.reviewed_at,
    total: r.total,
    implemented: r.implemented,
    partial: r.partial,
    missing: r.missing,
    unknown: r.unknown,
    avgQuality: r.avg_quality !== null ? Math.round(r.avg_quality * 10) / 10 : null,
  }));
}

export function getAllReviewHistory(limit = 20): Record<string, ReviewSnapshot[]> {
  const rows = getDb()
    .prepare(
      `SELECT id, module_id, reviewed_at, total, implemented, partial, missing, unknown, avg_quality
       FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY module_id ORDER BY reviewed_at DESC) as rn
         FROM review_snapshots
       )
       WHERE rn <= ?
       ORDER BY module_id, reviewed_at ASC`,
    )
    .all(limit) as {
    id: number;
    module_id: string;
    reviewed_at: string;
    total: number;
    implemented: number;
    partial: number;
    missing: number;
    unknown: number;
    avg_quality: number | null;
  }[];

  const result: Record<string, ReviewSnapshot[]> = {};
  for (const r of rows) {
    const snap: ReviewSnapshot = {
      id: r.id,
      moduleId: r.module_id,
      reviewedAt: r.reviewed_at,
      total: r.total,
      implemented: r.implemented,
      partial: r.partial,
      missing: r.missing,
      unknown: r.unknown,
      avgQuality: r.avg_quality !== null ? Math.round(r.avg_quality * 10) / 10 : null,
    };
    if (!result[r.module_id]) result[r.module_id] = [];
    result[r.module_id].push(snap);
  }
  return result;
}

// ─── All statuses (for dependency resolution) ────────────────────────────────

export interface FeatureStatusEntry {
  moduleId: string;
  featureName: string;
  status: string;
}

export function getAllFeatureStatuses(): FeatureStatusEntry[] {
  const rows = getDb()
    .prepare('SELECT module_id, feature_name, status FROM feature_matrix')
    .all() as { module_id: string; feature_name: string; status: string }[];
  return rows.map((r) => ({
    moduleId: r.module_id,
    featureName: r.feature_name,
    status: r.status,
  }));
}

// ─── Aggregate queries for project-wide dashboard ─────────────────────────────

export function getAllModuleAggregates(): ModuleAggregate[] {
  const rows = getDb()
    .prepare(
      `SELECT
         module_id,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'implemented' THEN 1 ELSE 0 END) as implemented,
         SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
         SUM(CASE WHEN status = 'missing' THEN 1 ELSE 0 END) as missing,
         SUM(CASE WHEN status = 'unknown' THEN 1 ELSE 0 END) as unknown,
         AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score END) as avg_quality,
         MAX(last_reviewed_at) as last_reviewed_at
       FROM feature_matrix
       GROUP BY module_id
       ORDER BY module_id`
    )
    .all() as {
    module_id: string;
    total: number;
    implemented: number;
    partial: number;
    missing: number;
    unknown: number;
    avg_quality: number | null;
    last_reviewed_at: string | null;
  }[];

  return rows.map((r) => ({
    moduleId: r.module_id,
    total: r.total,
    implemented: r.implemented,
    partial: r.partial,
    missing: r.missing,
    unknown: r.unknown,
    avgQuality: r.avg_quality !== null ? Math.round(r.avg_quality * 10) / 10 : null,
    lastReviewedAt: r.last_reviewed_at,
  }));
}
