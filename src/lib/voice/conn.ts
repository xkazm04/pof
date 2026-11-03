/**
 * Server-only accessor binding the voice room's tables to the shared `getDb()` connection (the
 * `audio-db-conn.ts` precedent), plus the repo root the quest packages are read from.
 */
import type Database from 'better-sqlite3';
import { getDb } from '@/lib/db';
import { resolveGamesRoot } from '@/lib/games/intake/files';
import { createVoiceDb } from '@/lib/voice/voice-db';

let ready = false;

export function getVoiceDb(): Database.Database {
  const db = getDb();
  if (!ready) {
    createVoiceDb(db);
    ready = true;
  }
  return db;
}

/** The PoF repo root holding `games/gtai/quests` and `games/gtai/voices`. */
export const questRoot = (): string => resolveGamesRoot();

/** The voice room exists for GTAI only (its quest loop is GTAI-only). */
export const VOICE_GAMES: readonly string[] = ['gtai'];
