import { getDb } from './db';
import { buildUpdateQuery } from './db-utils';
import { logger } from './logger';
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

/**
 * Parse one JSON blob column, reporting failure instead of throwing.
 *
 * These columns are free-form TEXT: a truncated write, a hand-edited row or an
 * older schema is enough to make `JSON.parse` throw. Thrown from inside a
 * `rows.map()`, that single bad row used to 500 the whole GET — every level
 * design in the project became unreachable because one was damaged.
 */
function parseBlob<T>(raw: unknown, field: string, broken: string[]): T[] {
  const text = typeof raw === 'string' ? raw : '';
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      broken.push(field);
      return [];
    }
    return parsed as T[];
  } catch {
    broken.push(field);
    return [];
  }
}

/**
 * Marker appended to a document whose stored data could not be read, so a
 * damaged row is loudly identifiable in the sidebar rather than silently
 * appearing as an empty (and therefore over-writable) level.
 */
export const BROKEN_DOC_MARKER = 'UNREADABLE';

export function brokenDocName(name: string, brokenFields: string[]): string {
  return `${name} [${BROKEN_DOC_MARKER}: ${brokenFields.join(', ')}]`;
}

export function rowToDoc(row: Record<string, unknown>): LevelDesignDocument {
  const broken: string[] = [];
  const name = (row.name as string) ?? '';

  const doc: LevelDesignDocument = {
    id: row.id as number,
    name,
    description: (row.description as string) ?? '',
    designNarrative: (row.design_narrative as string) ?? '',
    rooms: parseBlob<RoomNode>(row.rooms, 'rooms', broken),
    connections: parseBlob<LevelDesignDocument['connections'][number]>(row.connections, 'connections', broken),
    difficultyArc: parseBlob<string>(row.difficulty_arc, 'difficultyArc', broken),
    pacingNotes: (row.pacing_notes as string) ?? '',
    syncStatus: row.sync_status as LevelDesignDocument['syncStatus'],
    syncReport: parseBlob<LevelDesignDocument['syncReport'][number]>(row.sync_report, 'syncReport', broken),
    lastGeneratedAt: row.last_generated_at as string | null,
    lastCodeHash: row.last_code_hash as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };

  if (broken.length > 0) {
    logger.error(`level-design doc ${doc.id} has unreadable data in: ${broken.join(', ')}`);
    doc.name = brokenDocName(name, broken);
  }
  return doc;
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
  ensureLevelDesignTable();

  // Only `rooms` and `sync_status` feed the summary — skip parsing the heavy
  // `connections` / `difficulty_arc` / `sync_report` blobs that getAllDocs() would.
  const rows = getDb()
    .prepare('SELECT rooms, sync_status FROM level_design_docs')
    .all() as { rooms: string; sync_status: LevelDesignDocument['syncStatus'] }[];

  const diffDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<DifficultyLevel, number>;
  const typeDist = {
    combat: 0, puzzle: 0, exploration: 0, boss: 0,
    safe: 0, transition: 0, cutscene: 0, hub: 0,
  } as Record<RoomType, number>;

  let totalRooms = 0;
  let syncedCount = 0;
  let divergedCount = 0;
  let unlinkedCount = 0;

  for (const row of rows) {
    const status = row.sync_status;
    if (status === 'synced') syncedCount++;
    else if (status === 'diverged' || status === 'doc-ahead' || status === 'code-ahead') divergedCount++;
    else if (status === 'unlinked') unlinkedCount++;

    // Same guard as rowToDoc: one damaged blob must not take down the summary
    // (and with it the whole document list) for every other level.
    const rooms = parseBlob<RoomNode>(row.rooms, 'rooms', []);
    totalRooms += rooms.length;
    for (const room of rooms) {
      if (room.difficulty >= 1 && room.difficulty <= 5) diffDist[room.difficulty]++;
      if (room.type in typeDist) typeDist[room.type]++;
    }
  }

  return {
    totalDocs: rows.length,
    totalRooms,
    syncedCount,
    divergedCount,
    unlinkedCount,
    difficultyDistribution: diffDist,
    roomTypeDistribution: typeDist,
  };
}
