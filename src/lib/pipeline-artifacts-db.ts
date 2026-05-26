import { getDb } from '@/lib/db';
import type { AcceptanceStatus, AcceptanceTier } from '@/lib/catalog/acceptance/types';

export interface PipelineArtifact {
  catalogId: string;
  entityId: string;
  step: string;
  data: Record<string, unknown>;
  ueAssets: string[];
  status: AcceptanceStatus;
  tier?: AcceptanceTier;
  reason?: string;
  updatedAt?: string;
}

function ensureTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS pipeline_artifacts (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      step TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      ue_assets TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      tier TEXT,
      reason TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id, step)
    )
  `);
}

/** Column row → PipelineArtifact. Pure (exported for unit test). */
export function rowToArtifact(row: Record<string, unknown>): PipelineArtifact {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    step: row.step as string,
    data: JSON.parse((row.data as string) || '{}'),
    ueAssets: JSON.parse((row.ue_assets as string) || '[]'),
    status: row.status as AcceptanceStatus,
    ...(row.tier ? { tier: row.tier as AcceptanceTier } : {}),
    ...(row.reason ? { reason: row.reason as string } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at as string } : {}),
  };
}

export function listArtifacts(catalogId: string, entityId?: string): PipelineArtifact[] {
  ensureTable();
  const sql = entityId
    ? 'SELECT * FROM pipeline_artifacts WHERE catalog_id = ? AND entity_id = ?'
    : 'SELECT * FROM pipeline_artifacts WHERE catalog_id = ?';
  const args = entityId ? [catalogId, entityId] : [catalogId];
  return (getDb().prepare(sql).all(...args) as Record<string, unknown>[]).map(rowToArtifact);
}

export function upsertArtifact(a: PipelineArtifact): PipelineArtifact {
  ensureTable();
  getDb().prepare(`
    INSERT INTO pipeline_artifacts (catalog_id, entity_id, step, data, ue_assets, status, tier, reason, updated_at)
    VALUES (@catalog_id, @entity_id, @step, @data, @ue_assets, @status, @tier, @reason, datetime('now'))
    ON CONFLICT(catalog_id, entity_id, step) DO UPDATE SET
      data=@data, ue_assets=@ue_assets, status=@status, tier=@tier, reason=@reason, updated_at=datetime('now')
  `).run({
    catalog_id: a.catalogId, entity_id: a.entityId, step: a.step,
    data: JSON.stringify(a.data), ue_assets: JSON.stringify(a.ueAssets),
    status: a.status, tier: a.tier ?? null, reason: a.reason ?? null,
  });
  return a;
}
