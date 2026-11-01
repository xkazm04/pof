/**
 * A game's VERSIONED design truth on disk: `games/<id>/pitch.md`, `canon.json`, `entities.json`
 * (spark gtai-uprising-project, WP3). Server-only (fs).
 *
 * The DB is a mirror of these files, never the other way round: an accepted intake proposal is
 * written here AND to the DB, and `syncGameDesign` re-inserts what the DB is missing, so a lost DB
 * (it happened on 2026-10-19) costs nothing a `git checkout` cannot restore.
 *
 * Writes are atomic (temp file + rename) and stable: sorted by id, two-space JSON, trailing newline,
 * so a git diff of an accept is exactly the accepted record.
 *
 * The repo root is `process.cwd()` unless `POF_GAMES_ROOT` names another one (tests point it at a
 * temp dir). A WRITE under vitest without that override throws: a test must never touch the real
 * `games/` folder, and the floor is cheaper than remembering.
 */
import fs from 'fs';
import path from 'path';
import { GAMES } from '@/lib/games/registry';
import type { GameId } from '@/lib/games/types';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { Result } from '@/types/result';

/** First line of a pitch that has not arrived yet. The intake treats it as "no pitch". */
export const PITCH_PLACEHOLDER_MARKER = '<!-- pitch: placeholder -->';

export function resolveGamesRoot(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return env.POF_GAMES_ROOT || process.cwd();
}

/** Absolute design folder of a game, or null when the game keeps no design truth on disk (PoF). */
export function gameDesignDir(gameId: GameId, root = resolveGamesRoot()): string | null {
  const rel = GAMES[gameId].designDir;
  return rel ? path.join(root, rel) : null;
}

export interface PitchRead {
  /** True when the file is missing or its first line is {@link PITCH_PLACEHOLDER_MARKER}. */
  placeholder: boolean;
  text: string;
}

export function readPitch(gameId: GameId, root = resolveGamesRoot()): PitchRead {
  const dir = gameDesignDir(gameId, root);
  const file = dir ? path.join(dir, 'pitch.md') : null;
  if (!file || !fs.existsSync(file)) return { placeholder: true, text: '' };
  const text = fs.readFileSync(file, 'utf8');
  const first = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0].trim();
  return { placeholder: first === PITCH_PLACEHOLDER_MARKER || text.trim() === '', text };
}

type DesignFile = 'canon.json' | 'entities.json';

/** A missing file (or a game without a design dir) is an empty list; unreadable JSON is an error. */
function readArray<T>(gameId: GameId, file: DesignFile, root: string): Result<T[], string> {
  const dir = gameDesignDir(gameId, root);
  if (!dir) return { ok: true, data: [] };
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) return { ok: true, data: [] };
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!Array.isArray(parsed)) return { ok: false, error: `${full}: expected a JSON array` };
    return { ok: true, data: parsed as T[] };
  } catch (e) {
    return { ok: false, error: `${full}: ${e instanceof Error ? e.message : 'unreadable'}` };
  }
}

export const readGameCanon = (gameId: GameId, root = resolveGamesRoot()) => readArray<ProjectRule>(gameId, 'canon.json', root);
export const readGameEntities = (gameId: GameId, root = resolveGamesRoot()) =>
  readArray<StoredCatalogEntity>(gameId, 'entities.json', root);

/** Stable key: a rule by id; an entity by `catalogId/id` (the entity PK is the pair). */
const ruleKey = (r: ProjectRule) => r.id;
const entityKey = (e: StoredCatalogEntity) => `${e.catalogId}/${e.id}`;

/** Write the rows sorted by key; returns them in the order written. */
function writeArray<T>(gameId: GameId, file: DesignFile, rows: readonly T[], key: (row: T) => string, root: string): T[] {
  if (process.env.VITEST && !process.env.POF_GAMES_ROOT) {
    throw new Error(`refusing to write games/${gameId}/${file} from a test without POF_GAMES_ROOT`);
  }
  const dir = gameDesignDir(gameId, root);
  if (!dir) throw new Error(`game "${gameId}" has no designDir — it keeps no design truth on disk`);
  fs.mkdirSync(dir, { recursive: true });
  const sorted = [...rows].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  const full = path.join(dir, file);
  const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, full);
  return sorted;
}

/** Insert or replace one record by key, then write the whole file atomically. */
function upsertInFile<T>(gameId: GameId, file: DesignFile, row: T, key: (row: T) => string, root: string): Result<T[], string> {
  const current = readArray<T>(gameId, file, root);
  // Never rewrite a file we could not read: that would replace the operator's truth with one row.
  if (!current.ok) return current;
  const next = [...current.data.filter((r) => key(r) !== key(row)), row];
  return { ok: true, data: writeArray(gameId, file, next, key, root) };
}

export const upsertGameRuleFile = (gameId: GameId, rule: ProjectRule, root = resolveGamesRoot()) =>
  upsertInFile(gameId, 'canon.json', rule, ruleKey, root);
export const upsertGameEntityFile = (gameId: GameId, entity: StoredCatalogEntity, root = resolveGamesRoot()) =>
  upsertInFile(gameId, 'entities.json', entity, entityKey, root);
