import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getAudioScene } from '@/lib/audio-scene-db';
import { createAudioAssetDb, listSets } from '@/lib/audio-asset-db';
import { listLatestAudioImportsBySet } from '@/lib/audio-import-db';
import { generateAudioCode, type AudioAssetBindings } from '@/lib/audio-codegen';

const DB_PATH = join(homedir(), '.pof', 'pof.db');
let _db: Database.Database | null = null;
function db(): Database.Database {
  if (_db) return _db;
  if (!existsSync(join(homedir(), '.pof'))) mkdirSync(join(homedir(), '.pof'), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  createAudioAssetDb(_db);
  return _db;
}

/**
 * What each generated audio set REALLY is, keyed by the id an emitter binds to.
 *
 * Import runs are recorded per set NAME, so the join goes id → name → last run.
 * A set with no run at all is still listed — with `cuePath: null`, which is the
 * fact the generator needs to write "no import recorded" instead of a path it
 * invented. Failing to open the asset DB yields an EMPTY map, which degrades to
 * the same honest placeholder rather than to a fabricated path.
 */
function resolveAssetBindings(): AudioAssetBindings {
  try {
    const imports = listLatestAudioImportsBySet();
    const bindings: AudioAssetBindings = {};
    for (const set of listSets(db())) {
      bindings[set.id] = { setName: set.name, cuePath: imports[set.name]?.cuePath ?? null };
    }
    return bindings;
  } catch {
    return {};
  }
}

// POST: generate code from an audio scene document
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sceneId, moduleName, apiMacro } = body;

    if (!sceneId) return apiError('sceneId required', 400);

    const doc = getAudioScene(sceneId);
    if (!doc) return apiError('Audio scene not found', 404);

    const result = generateAudioCode(
      doc,
      moduleName || 'MyProject',
      apiMacro || 'MYPROJECT_API',
      resolveAssetBindings(),
    );

    return apiSuccess(result);
  } catch (e) {
    return apiError(String(e));
  }
}
