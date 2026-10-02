/**
 * Server-only accessor that binds the audio persistence layer to the shared `getDb()`
 * connection and guarantees its schema exists (the `library-db-conn.ts` precedent).
 *
 * The audio stack used to open three private connections on a hard-coded
 * `~/.pof/pof.db`, which walked past `POF_DB_PATH` — so every test run wrote its audio
 * fixtures into the operator's real database. Routes and `audio-import-db.ts` call
 * `getAudioDb()`; the pure helpers in `audio-asset-db.ts` keep their explicit `db`
 * parameter so they stay unit-testable against `:memory:`.
 */

import type Database from 'better-sqlite3';
import { getDb } from '@/lib/db';
import { createAudioAssetDb } from '@/lib/audio-asset-db';

let ready = false;

/** One row per recorded UE import of an audio set (written by the import CLI callback). */
function createAudioImportRuns(db: Database.Database): void {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_audio_import_runs_setName ON audio_import_runs(setName, id);
  `);
}

export function getAudioDb(): Database.Database {
  const db = getDb();
  if (!ready) {
    createAudioAssetDb(db);
    createAudioImportRuns(db);
    ready = true;
  }
  return db;
}
