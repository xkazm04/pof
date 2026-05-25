import { getDb } from '@/lib/db';
import type { BalanceBaseline } from '@/lib/balance/baseline';
import type { StatRow } from '@/lib/balance/threat-score';

function ensureTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS balance_baselines (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      threat_score REAL NOT NULL DEFAULT 0,
      stats TEXT NOT NULL DEFAULT '[]',
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id)
    )
  `);
}

/** Column row → BalanceBaseline. Pure (exported for unit test). */
export function rowToBaseline(row: Record<string, unknown>): BalanceBaseline {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    threatScore: Number(row.threat_score),
    stats: JSON.parse((row.stats as string) || '[]') as StatRow[],
    capturedAt: (row.captured_at as string | null) ?? undefined,
  };
}

export function getBaseline(catalogId: string, entityId: string): BalanceBaseline | null {
  ensureTable();
  const row = getDb()
    .prepare('SELECT * FROM balance_baselines WHERE catalog_id = ? AND entity_id = ?')
    .get(catalogId, entityId) as Record<string, unknown> | undefined;
  return row ? rowToBaseline(row) : null;
}

export function upsertBaseline(rec: BalanceBaseline): BalanceBaseline {
  ensureTable();
  getDb().prepare(`
    INSERT INTO balance_baselines (catalog_id, entity_id, threat_score, stats, captured_at)
    VALUES (@catalog_id, @entity_id, @threat_score, @stats, datetime('now'))
    ON CONFLICT(catalog_id, entity_id) DO UPDATE SET
      threat_score=@threat_score, stats=@stats, captured_at=datetime('now')
  `).run({
    catalog_id: rec.catalogId,
    entity_id: rec.entityId,
    threat_score: rec.threatScore,
    stats: JSON.stringify(rec.stats),
  });
  return getBaseline(rec.catalogId, rec.entityId)!;
}
