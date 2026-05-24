import { NextRequest } from 'next/server';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { existsSync, mkdirSync } from 'node:fs';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getAudioProvider } from '@/lib/audio-gen/registry';
import {
  AUDIO_DIR,
  addAsset,
  createAudioAssetDb,
  deleteAsset,
  deleteSet,
  ensureAudioDir,
  getSet,
  listAssets,
  listSets,
  upsertSet,
} from '@/lib/audio-asset-db';
import type { AudioKind } from '@/lib/audio-gen/types';

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

interface PostBody {
  provider?: string;
  kind?: AudioKind;
  prompt?: string;
  durationSeconds?: number;
  loop?: boolean;
  setId?: string;
  setName?: string;
  eventKey?: string;
  surface?: string;
}

export async function POST(request: NextRequest) {
  let body: PostBody;
  try { body = await request.json() as PostBody; } catch { return apiError('Invalid JSON body', 400); }

  const { provider, kind, prompt } = body;
  if (!provider || !kind || !prompt || (!body.setId && !body.setName)) {
    return apiError('Missing provider/kind/prompt or setId/setName', 400);
  }
  const p = getAudioProvider(provider);
  if (!p) return apiError(`Unknown provider: ${provider}`, 400);

  let result;
  try {
    result = await p.generate({ kind, prompt, durationSeconds: body.durationSeconds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'generation failed';
    if (msg.includes('ELEVENLABS_API_KEY')) return apiError(msg, 503);
    return apiError(msg, 502);
  }

  const set = body.setId
    ? getSet(db(), body.setId) ?? upsertSet(db(), { id: body.setId, name: body.setName ?? body.setId, kind, eventKey: body.eventKey ?? null, surface: body.surface ?? null, loopable: !!body.loop })
    : upsertSet(db(), { name: body.setName!, kind, eventKey: body.eventKey ?? null, surface: body.surface ?? null, loopable: !!body.loop });

  ensureAudioDir();
  const setDir = join(AUDIO_DIR, set.id);
  if (!existsSync(setDir)) mkdirSync(setDir, { recursive: true });
  const assetId = randomUUID();
  const filename = `${assetId}.${result.format}`;
  writeFileSync(join(setDir, filename), result.bytes);

  const asset = addAsset(db(), {
    setId: set.id, filename, relPath: `${set.id}/${filename}`,
    prompt, provider: p.id, durationMs: result.durationMs, format: result.format,
  });

  return apiSuccess({ asset, set });
}

export async function GET() {
  const sets = listSets(db());
  const assets = sets.flatMap((s) => listAssets(db(), s.id));
  return apiSuccess({ sets, assets });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const assetId = url.searchParams.get('assetId');
  const setId = url.searchParams.get('setId');
  if (assetId) { deleteAsset(db(), assetId); return apiSuccess({ deleted: 'asset' }); }
  if (setId) { deleteSet(db(), setId); return apiSuccess({ deleted: 'set' }); }
  return apiError('Pass assetId or setId', 400);
}
