import { NextRequest } from 'next/server';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { existsSync, mkdirSync } from 'node:fs';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getAudioProvider } from '@/lib/audio-gen/registry';
import { computePromptHash } from '@/lib/audio-gen/prompt-hash';
import {
  AUDIO_DIR,
  DEFAULT_AUDIO_MONTHLY_QUOTA,
  addAsset,
  createAudioAssetDb,
  deleteAsset,
  deleteSet,
  ensureAudioDir,
  findAssetByPromptHash,
  getAsset,
  getDiskFootprint,
  getSet,
  getUsageSummary,
  listAllAssets,
  listSets,
  logUsage,
  removeAssetFile,
  removeSetDirectory,
  setAssetFavorite,
  upsertSet,
  type FileRemoval,
} from '@/lib/audio-asset-db';
import { AUDIO_KINDS, type AudioKind } from '@/lib/audio-gen/types';
import { isAudioKind, refusalMessage, supportsKind } from '@/lib/audio-gen/capabilities';

/** Start-of-current-month epoch ms — the window the usage meter counts within. */
function startOfMonth(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/**
 * The monthly budget the usage meter fills against — INFORMATIONAL by design,
 * and POST deliberately never consults it.
 *
 * The number is a default nobody chose (200), so blocking on it would refuse a
 * generation the user never asked to have limited — a silent 402 replacing the
 * old silent overclaim. The meter says so in the UI (`AudioUsageMeter`), which
 * is the honest half of the pair: a limit that is displayed but not enforced
 * must say it is not enforced.
 */
function monthlyQuota(): number {
  const env = Number(process.env.AUDIO_MONTHLY_QUOTA);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_AUDIO_MONTHLY_QUOTA;
}

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

  // The provider's capability contract, enforced — BEFORE the cache and before
  // any billed call. Until now `capabilities` was never consulted, so a `music`
  // or `tts` request went to ElevenLabs' sound-generation endpoint like any
  // other and returned an SFX clip filed under the requested kind. A kind the
  // provider cannot serve is now refused with the provider's own reason.
  if (!isAudioKind(kind)) {
    return apiError(`Unknown audio kind: ${String(kind)}. Expected one of ${AUDIO_KINDS.join(', ')}.`, 400);
  }
  if (!supportsKind(p, kind)) return apiError(refusalMessage(p, kind), 400);

  // Scope the cache to the destination set/event so the same prompt aimed at a
  // different set is a miss (and generates INTO that set) rather than returning
  // the original set's asset and silently dropping the requested one.
  const promptHash = computePromptHash({
    provider: p.id, kind, prompt, durationSeconds: body.durationSeconds,
    setKey: body.setId ?? body.setName, eventKey: body.eventKey,
  });

  // Content-hash cache: an identical prompt was generated before → return that
  // asset instead of paying for a billed provider call (folder idea-5f3f1c9d).
  const cached = findAssetByPromptHash(db(), promptHash);
  if (cached) {
    const cachedSet = getSet(db(), cached.setId);
    if (cachedSet) {
      logUsage(db(), { provider: p.id, kind, promptHash, cached: true, durationMs: cached.durationMs });
      return apiSuccess({ asset: cached, set: cachedSet, cached: true });
    }
    // Set was deleted out from under the cached row — fall through to regenerate.
  }

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
    prompt, provider: p.id, durationMs: result.durationMs, format: result.format, promptHash,
  });
  logUsage(db(), { provider: p.id, kind, promptHash, cached: false, durationMs: result.durationMs });

  return apiSuccess({ asset, set, cached: false });
}

export async function GET() {
  const d = db();
  const sets = listSets(d);
  const assets = listAllAssets(d);
  const usage = getUsageSummary(d, startOfMonth(), monthlyQuota());
  // `audioDir` is the server-resolved absolute AUDIO_DIR. The client used to hand
  // the import CLI a `~/.pof/audio/...` path, but `~` is not expanded by PowerShell
  // env-var assignment — the dispatch carried an unusable path that only an
  // (absent) script's expanduser would have saved.
  // `disk` is the module's REAL footprint under AUDIO_DIR (bytes never had a surface).
  return apiSuccess({ sets, assets, usage, audioDir: AUDIO_DIR, disk: getDiskFootprint() });
}

interface PatchBody { assetId?: string; favorite?: boolean }

export async function PATCH(request: NextRequest) {
  let body: PatchBody;
  try { body = await request.json() as PatchBody; } catch { return apiError('Invalid JSON body', 400); }
  if (!body.assetId || typeof body.favorite !== 'boolean') {
    return apiError('Pass assetId + favorite:boolean', 400);
  }
  const asset = setAssetFavorite(db(), body.assetId, body.favorite);
  if (!asset) return apiError('Asset not found', 404);
  return apiSuccess({ asset });
}

/**
 * Delete removes what it owns — the DB row AND the bytes it wrote.
 *
 * Previously SQL-only, so every mp3 under `~/.pof/audio/<setId>/` survived its
 * row forever and the module's disk use only ever grew. The file work is
 * attempted FIRST and its outcome is always reported alongside the DB row's
 * fate: a failed unlink returns `fileRemoval.ok === false` with the path left
 * behind, never a bare success. Paths are resolved and proven to sit under
 * AUDIO_DIR before anything is unlinked (`resolveAudioPath`).
 */
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const assetId = url.searchParams.get('assetId');
  const setId = url.searchParams.get('setId');

  if (assetId) {
    // Read the row's relPath BEFORE deleting it — afterwards the path is unknowable.
    const asset = getAsset(db(), assetId);
    const fileRemoval: FileRemoval = asset
      ? removeAssetFile(asset.relPath)
      : { ok: true, path: null, removed: 0, reason: 'No such asset row — nothing on disk to remove' };
    deleteAsset(db(), assetId);
    return apiSuccess({ deleted: 'asset', dbRowDeleted: true, fileRemoval });
  }

  if (setId) {
    // The whole `<setId>` directory: assets cascade in SQL, and every clip the
    // set ever wrote lives under that one root.
    const fileRemoval = removeSetDirectory(setId);
    deleteSet(db(), setId);
    return apiSuccess({ deleted: 'set', dbRowDeleted: true, fileRemoval });
  }

  return apiError('Pass assetId or setId', 400);
}
