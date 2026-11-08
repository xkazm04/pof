import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getAllAudioScenes,
  getAudioScene,
  createAudioScene,
  updateAudioScene,
  deleteAudioScene,
  getAudioSceneSummary,
} from '@/lib/audio-scene-db';
import { REVERB_PARAMS } from '@/lib/audio-scene-acoustics';
import type { UpdateAudioScenePayload } from '@/types/audio-scene';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id');

  if (id) {
    const doc = getAudioScene(Number(id));
    if (!doc) return apiError('Not found', 404);
    return apiSuccess({ doc });
  }

  const docs = getAllAudioScenes();
  const summary = getAudioSceneSummary(docs);
  return apiSuccess({ docs, summary });
}

/**
 * Read a JSON object body: malformed or non-object JSON is a 400 (the house shape, see
 * `pipeline-artifacts/_lib/sweepBody.ts`), never a 500 thrown out of `req.json()`.
 */
async function readObjectBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await req.json();
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The JSON-blob columns rowToDoc / the summary / generateAudioCode iterate as arrays. */
const ARRAY_FIELDS = ['zones', 'emitters'] as const;

export async function POST(req: NextRequest) {
  const body = await readObjectBody(req);
  if (!body) return apiError('Body must be a JSON object', 400);
  const { name, description } = body;
  if (!name || typeof name !== 'string') {
    return apiError('name is required', 400);
  }
  const doc = createAudioScene({ name, description: typeof description === 'string' ? description : undefined });
  return apiSuccess({ doc }, 201);
}

/** A pool size is a positive whole number; generateAudioCode writes it straight into C++. */
function isPositiveInt(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/** First bad scalar field of a PUT body (checked before the database is touched), or null. */
function scalarFieldError(body: Record<string, unknown>): string | null {
  if ('name' in body && (typeof body.name !== 'string' || body.name.trim() === '')) {
    return 'name must be a non-empty string';
  }
  if ('globalReverbPreset' in body
    && !(typeof body.globalReverbPreset === 'string' && Object.hasOwn(REVERB_PARAMS, body.globalReverbPreset))) {
    return 'globalReverbPreset must be a known reverb preset';
  }
  for (const field of ['soundPoolSize', 'maxConcurrentSounds'] as const) {
    if (field in body && !isPositiveInt(body[field])) return `${field} must be a positive integer`;
  }
  return null;
}

export async function PUT(req: NextRequest) {
  const body = await readObjectBody(req);
  if (!body) return apiError('Body must be a JSON object', 400);
  if (!body.id || typeof body.id !== 'number') {
    return apiError('id is required', 400);
  }
  for (const field of ARRAY_FIELDS) {
    if (field in body && !Array.isArray(body[field])) {
      return apiError(`${field} must be an array`, 400);
    }
  }
  const scalarError = scalarFieldError(body);
  if (scalarError) return apiError(scalarError, 400);
  const doc = updateAudioScene(body as unknown as UpdateAudioScenePayload);
  if (!doc) return apiError('Not found', 404);
  return apiSuccess({ doc });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id = searchParams.get('id');
  if (!id) return apiError('id is required', 400);
  const ok = deleteAudioScene(Number(id));
  if (!ok) return apiError('Not found', 404);
  return apiSuccess({ deleted: true });
}
