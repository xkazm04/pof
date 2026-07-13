import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getDb } from '@/lib/db';
import { distillStyleDna } from '@/lib/visual-gen/style-dna';
import { parseVisionImage } from '@/lib/visual-gen/input-gate';
import { saveStyleDna, getActiveStyleDna, listStyleDna, setActiveStyleDna } from '@/lib/visual-gen/style-dna-db';

/**
 * Style DNA — distill a mood board once, inject everywhere.
 *
 * POST { images: dataUrl[], name? } → VLM-distill the board into a StyleDna profile,
 *   save it as the active one. A distiller that cannot run is an error with the
 *   reason, never a silently empty profile.
 * GET → { active, profiles }.
 * PATCH { id } → make that profile active.
 *
 * Generation routes read the active profile (e.g. /api/leonardo `applyStyleDna`).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { images?: string[]; name?: string };
    if (!body.images?.length) return apiError('Missing required field: images (data URLs)', 400);
    const parsed = body.images.map(parseVisionImage);
    if (parsed.some((p) => p === null)) return apiError('every image must be a base64 image data URL', 400);

    const result = await distillStyleDna(parsed.map((p) => p!));
    if (!result.ok) return apiError(`style distillation failed: ${result.error}`, 502);

    const profile = saveStyleDna(getDb(), {
      name: body.name?.trim() || `Style ${new Date().toISOString().slice(0, 10)}`,
      dna: result.dna,
      sourceImageCount: parsed.length,
    });
    return apiSuccess({ profile, raw: result.raw });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'style-dna distillation failed', 500);
  }
}

export async function GET() {
  try {
    const db = getDb();
    return apiSuccess({ active: getActiveStyleDna(db), profiles: listStyleDna(db) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to read style-dna profiles', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) return apiError('Missing required field: id', 400);
    if (!setActiveStyleDna(getDb(), body.id)) return apiError(`no style-dna profile with id ${body.id}`, 404);
    return apiSuccess({ active: getActiveStyleDna(getDb()) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to activate style-dna profile', 500);
  }
}
