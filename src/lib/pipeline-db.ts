import { getDb } from '@/lib/db';
import type { PipelineTrackRecord } from '@/lib/pipeline/types';
import type { PipelineTrackId, TrackState } from '@/lib/pipeline/tracks';

function ensureTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS pipeline_tracks (
      catalog_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'not-started',
      note TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (catalog_id, entity_id, track_id)
    )
  `);
}

/** Column row → PipelineTrackRecord. Pure (exported for unit test). */
export function rowToTrack(row: Record<string, unknown>): PipelineTrackRecord {
  return {
    catalogId: row.catalog_id as string,
    entityId: row.entity_id as string,
    trackId: row.track_id as PipelineTrackId,
    state: row.state as TrackState,
    note: (row.note as string | null) ?? undefined,
    updatedAt: (row.updated_at as string | null) ?? undefined,
  };
}

export function listTracks(catalogId: string, entityId: string): PipelineTrackRecord[] {
  ensureTable();
  const rows = getDb()
    .prepare('SELECT * FROM pipeline_tracks WHERE catalog_id = ? AND entity_id = ?')
    .all(catalogId, entityId) as Record<string, unknown>[];
  return rows.map(rowToTrack);
}

export function upsertTrack(rec: PipelineTrackRecord): PipelineTrackRecord {
  ensureTable();
  getDb().prepare(`
    INSERT INTO pipeline_tracks
      (catalog_id, entity_id, track_id, state, note, updated_at)
    VALUES (@catalog_id, @entity_id, @track_id, @state, @note, datetime('now'))
    ON CONFLICT(catalog_id, entity_id, track_id) DO UPDATE SET
      state=@state, note=@note, updated_at=datetime('now')
  `).run({
    catalog_id: rec.catalogId,
    entity_id: rec.entityId,
    track_id: rec.trackId,
    state: rec.state,
    note: rec.note ?? null,
  });
  const row = getDb()
    .prepare('SELECT * FROM pipeline_tracks WHERE catalog_id = ? AND entity_id = ? AND track_id = ?')
    .get(rec.catalogId, rec.entityId, rec.trackId) as Record<string, unknown>;
  return rowToTrack(row);
}
