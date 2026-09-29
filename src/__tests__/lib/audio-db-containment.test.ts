/**
 * The audio stack must sit behind the same containment floor as every other table.
 *
 * `src/lib/db.ts` is the one connection door: it honours `POF_DB_PATH` (the vitest floor,
 * Playwright e2e, the pof-mcp integration suite) and bootstraps WAL + foreign keys. The
 * audio stack used to bypass it with three private `new Database(~/.pof/pof.db)` blocks and
 * a hard-coded `~/.pof/audio`, so every test run wrote audio fixtures into the operator's
 * real database. Measured 2026-09-29: 917 of 917 `audio_sets` and 522 of 522
 * `audio_import_runs` rows in the live DB were test residue, and the Library, codegen's set
 * bindings and the usage meter all read them.
 *
 * Like `db-containment.test.ts`, this file sets NO `vi.hoisted` override: it proves the
 * floor in `vitest.config.ts` reaches the audio code paths.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { AUDIO_DIR, addAsset, createAudioAssetDb, resolveAudioDir, upsertSet } from '@/lib/audio-asset-db';
import { recordAudioImport } from '@/lib/audio-import-db';
import { createAudioScene, updateAudioScene } from '@/lib/audio-scene-db';
import { DELETE, POST as generate } from '@/app/api/audio-gen/route';
import { POST as codegen } from '@/app/api/audio-codegen/route';
import type { SoundEmitter } from '@/types/audio-scene';

const REAL_DB = path.join(os.homedir(), '.pof', 'pof.db');
const MARK = `test-audio-containment-${process.pid}-${Date.now()}`;

/** Rows matching `col = value` in the REAL database, read-only. `null` = cannot look. */
function realDbRows(table: string, col: string, value: string): number | null {
  if (!fs.existsSync(REAL_DB)) return null;
  let db: Database.Database | null = null;
  try {
    db = new Database(REAL_DB, { readonly: true, fileMustExist: true });
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!exists) return 0;
    return (db.prepare(`SELECT count(*) AS c FROM ${table} WHERE ${col} = ?`).get(value) as { c: number }).c;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

/** Count in the database `getDb()` opened; a missing table reads as 0, never a throw. */
function testDbRows(table: string, col: string, value: string): number {
  const exists = getDb().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (!exists) return 0;
  return (getDb().prepare(`SELECT count(*) AS c FROM ${table} WHERE ${col} = ?`).get(value) as { c: number }).c;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ELEVENLABS_API_KEY;
});

function jsonReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('audio persistence goes through the one DB door', () => {
  it('an import run lands in the floor DB, not in ~/.pof/pof.db', () => {
    const marker = `${MARK}-import`;
    recordAudioImport({ setName: marker, assetsImported: 1 });
    expect(testDbRows('audio_import_runs', 'setName', marker)).toBe(1);
    const leaked = realDbRows('audio_import_runs', 'setName', marker);
    if (leaked !== null) expect(leaked).toBe(0);
  });

  it('a generated set lands in the floor DB, not in ~/.pof/pof.db', async () => {
    const marker = `${MARK}-gen`;
    process.env.ELEVENLABS_API_KEY = 'sk-test';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    const res = await generate(jsonReq('http://localhost/api/audio-gen', 'POST', {
      provider: 'elevenlabs', kind: 'sfx', prompt: `containment ${marker}`, setName: marker,
    }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(testDbRows('audio_sets', 'id', body.data.set.id)).toBe(1);
    const leaked = realDbRows('audio_sets', 'name', marker);
    if (leaked !== null) expect(leaked).toBe(0);
  });

  it('clip bytes follow the data dir: <dirname(POF_DB_PATH)>/audio, a temp dir under the floor', () => {
    const tmp = os.tmpdir();
    expect(resolveAudioDir({ POF_DB_PATH: path.join(tmp, 'x', 'pof.db') })).toBe(path.join(tmp, 'x', 'audio'));
    expect(path.resolve(AUDIO_DIR).startsWith(path.resolve(tmp))).toBe(true);
  });

  it('[guard] with no override the clip dir is the production ~/.pof/audio', () => {
    expect(resolveAudioDir({})).toBe(path.join(os.homedir(), '.pof', 'audio'));
  });

  it('[guard] deleting a set cascades its asset rows on the shared connection', async () => {
    createAudioAssetDb(getDb());
    const set = upsertSet(getDb(), { name: `${MARK}-cascade`, kind: 'sfx', loopable: false });
    for (const n of [1, 2]) {
      addAsset(getDb(), {
        setId: set.id, filename: `${n}.mp3`, relPath: `${set.id}/${n}.mp3`,
        prompt: 'cascade', provider: 'elevenlabs', durationMs: 0, format: 'mp3',
      });
    }
    expect(testDbRows('audio_assets', 'setId', set.id)).toBe(2);
    const res = await (await DELETE(jsonReq(`http://localhost/api/audio-gen?setId=${set.id}`, 'DELETE'))).json();
    expect(res.success).toBe(true);
    expect(testDbRows('audio_sets', 'id', set.id)).toBe(0);
    expect(testDbRows('audio_assets', 'setId', set.id)).toBe(0);
  });

  it('[guard] codegen reads sets, import runs and scenes from one file', async () => {
    createAudioAssetDb(getDb());
    const setName = `${MARK}-codegen`;
    const set = upsertSet(getDb(), { name: setName, kind: 'ambient', loopable: true });
    recordAudioImport({ setName, assetsImported: 1, cuePath: '/Game/Audio/x/SC_x' });
    const scene = createAudioScene({ name: setName });
    const emitter: SoundEmitter = {
      id: 'em-1', name: 'Brazier', type: 'point', x: 0, y: 0, soundCueRef: '',
      assetSetId: set.id, attenuationRadius: 100, volumeMultiplier: 1,
      pitchMin: 1, pitchMax: 1, spawnChance: 1, cooldownSeconds: 0, zoneId: null,
    };
    updateAudioScene({ id: scene.id, emitters: [emitter] });

    const body = await (await codegen(jsonReq('http://localhost/api/audio-codegen', 'POST', { sceneId: scene.id }))).json();
    expect(body.success).toBe(true);
    const cpp = (body.data.files as Array<{ content: string }>).map((f) => f.content).join('\n');
    expect(cpp).toContain(`recorded UE import of audio set "${setName}"`);
    expect(cpp).toContain('/Game/Audio/x/SC_x');
  });
});
