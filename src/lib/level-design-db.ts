import { getDb } from './db';
import { buildUpdateQuery } from './db-utils';
import type {
  LevelDesignDocument,
  LevelDesignSummary,
  CreateDocPayload,
  UpdateDocPayload,
  RoomNode,
  DifficultyLevel,
  RoomType,
} from '@/types/level-design';

// ── Schema bootstrap ──

export function ensureLevelDesignTable() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS level_design_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      design_narrative TEXT NOT NULL DEFAULT '',
      rooms TEXT NOT NULL DEFAULT '[]',
      connections TEXT NOT NULL DEFAULT '[]',
      difficulty_arc TEXT NOT NULL DEFAULT '[]',
      pacing_notes TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'unlinked'
        CHECK(sync_status IN ('synced', 'doc-ahead', 'code-ahead', 'diverged', 'unlinked')),
      sync_report TEXT NOT NULL DEFAULT '[]',
      last_generated_at TEXT,
      last_code_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// ── Helpers ──

function rowToDoc(row: Record<string, unknown>): LevelDesignDocument {
  return {
    id: row.id as number,
    name: row.name as string,
    description: row.description as string,
    designNarrative: row.design_narrative as string,
    rooms: JSON.parse((row.rooms as string) || '[]'),
    connections: JSON.parse((row.connections as string) || '[]'),
    difficultyArc: JSON.parse((row.difficulty_arc as string) || '[]'),
    pacingNotes: row.pacing_notes as string,
    syncStatus: row.sync_status as LevelDesignDocument['syncStatus'],
    syncReport: JSON.parse((row.sync_report as string) || '[]'),
    lastGeneratedAt: row.last_generated_at as string | null,
    lastCodeHash: row.last_code_hash as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── CRUD ──

export function getAllDocs(): LevelDesignDocument[] {
  ensureLevelDesignTable();
  const rows = getDb()
    .prepare('SELECT * FROM level_design_docs ORDER BY updated_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map(rowToDoc);
}

export function getDoc(id: number): LevelDesignDocument | null {
  ensureLevelDesignTable();
  const row = getDb()
    .prepare('SELECT * FROM level_design_docs WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToDoc(row) : null;
}

export function createDoc(payload: CreateDocPayload): LevelDesignDocument {
  ensureLevelDesignTable();
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO level_design_docs (name, description, design_narrative) VALUES (?, ?, ?)`
    )
    .run(payload.name, payload.description, payload.designNarrative ?? '');
  return getDoc(result.lastInsertRowid as number)!;
}

export function updateDoc(payload: UpdateDocPayload): LevelDesignDocument | null {
  ensureLevelDesignTable();
  const db = getDb();
  const existing = getDoc(payload.id);
  if (!existing) return null;

  const query = buildUpdateQuery('level_design_docs', payload.id, payload, [
    { key: 'name', column: 'name' },
    { key: 'description', column: 'description' },
    { key: 'designNarrative', column: 'design_narrative' },
    { key: 'rooms', column: 'rooms' },
    { key: 'connections', column: 'connections' },
    { key: 'difficultyArc', column: 'difficulty_arc' },
    { key: 'pacingNotes', column: 'pacing_notes' },
    { key: 'syncStatus', column: 'sync_status' },
    { key: 'syncReport', column: 'sync_report' },
    { key: 'lastGeneratedAt', column: 'last_generated_at' },
    { key: 'lastCodeHash', column: 'last_code_hash' },
  ], new Set(['rooms', 'connections', 'difficultyArc', 'syncReport']));

  if (!query) return existing;

  db.prepare(query.sql).run(...query.values);
  return getDoc(payload.id);
}

export function deleteDoc(id: number): boolean {
  ensureLevelDesignTable();
  const result = getDb().prepare('DELETE FROM level_design_docs WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Summary ──

export function getSummary(): LevelDesignSummary {
  const docs = getAllDocs();

  const allRooms: RoomNode[] = docs.flatMap((d) => d.rooms);

  const diffDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<DifficultyLevel, number>;
  const typeDist = {
    combat: 0, puzzle: 0, exploration: 0, boss: 0,
    safe: 0, transition: 0, cutscene: 0, hub: 0,
  } as Record<RoomType, number>;

  for (const room of allRooms) {
    if (room.difficulty >= 1 && room.difficulty <= 5) diffDist[room.difficulty]++;
    if (room.type in typeDist) typeDist[room.type]++;
  }

  return {
    totalDocs: docs.length,
    totalRooms: allRooms.length,
    syncedCount: docs.filter((d) => d.syncStatus === 'synced').length,
    divergedCount: docs.filter((d) => d.syncStatus === 'diverged' || d.syncStatus === 'doc-ahead' || d.syncStatus === 'code-ahead').length,
    unlinkedCount: docs.filter((d) => d.syncStatus === 'unlinked').length,
    difficultyDistribution: diffDist,
    roomTypeDistribution: typeDist,
  };
}
