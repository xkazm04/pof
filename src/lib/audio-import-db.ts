import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AudioImportResult } from '@/types/audio-import';

const DB_PATH = join(homedir(), '.pof', 'pof.db');
let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  if (!existsSync(join(homedir(), '.pof'))) mkdirSync(join(homedir(), '.pof'), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS audio_import_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setName TEXT NOT NULL,
      eventKey TEXT,
      surface TEXT,
      assetsImported INTEGER NOT NULL DEFAULT 0,
      cuePath TEXT,
      wiredEvent TEXT,
      createdAt INTEGER NOT NULL
    );
  `);
  return _db;
}

export interface RecordAudioImportInput {
  setName: string;
  eventKey?: string | null;
  surface?: string | null;
  assetsImported: number;
  cuePath?: string | null;
  wiredEvent?: string | null;
}

export function recordAudioImport(input: RecordAudioImportInput): AudioImportResult {
  const createdAt = Date.now();
  const info = db().prepare(`
    INSERT INTO audio_import_runs (setName, eventKey, surface, assetsImported, cuePath, wiredEvent, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(input.setName, input.eventKey ?? null, input.surface ?? null, input.assetsImported, input.cuePath ?? null, input.wiredEvent ?? null, createdAt);
  return {
    id: Number(info.lastInsertRowid),
    setName: input.setName,
    eventKey: input.eventKey ?? null,
    surface: input.surface ?? null,
    assetsImported: input.assetsImported,
    cuePath: input.cuePath ?? null,
    wiredEvent: input.wiredEvent ?? null,
    createdAt,
  };
}

export function getLatestAudioImport(): AudioImportResult | null {
  const row = db().prepare('SELECT * FROM audio_import_runs ORDER BY createdAt DESC LIMIT 1').get() as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: Number(row.id),
    setName: String(row.setName),
    eventKey: (row.eventKey as string | null) ?? null,
    surface: (row.surface as string | null) ?? null,
    assetsImported: Number(row.assetsImported),
    cuePath: (row.cuePath as string | null) ?? null,
    wiredEvent: (row.wiredEvent as string | null) ?? null,
    createdAt: Number(row.createdAt),
  };
}
