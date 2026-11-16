import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { getDb } from '@/lib/db';
import { parseVisionImage } from '@/lib/visual-gen/input-gate';
import { getActiveStyleDna, listStyleDna, setActiveStyleDna } from '@/lib/visual-gen/style-dna-db';
import { startStyleDnaJob } from '@/lib/visual-gen/style-dna-job-store';

/**
 * Style DNA — distill a mood board once, inject everywhere.
 *
 * POST { images: dataUrl[], name? } → STARTS a distillation and returns 202 { jobId };
 *   poll GET /api/visual-gen/style-dna/status?jobId=... A distiller that cannot run is an
 *   error with the reason, never a silently empty profile.
 * GET → { active, profiles }.
 * PATCH { id } → make that profile active.
 *
 * Distilling is a job because it is a vision call over N board images, and the chokepoint's
 * ceiling is deliberately 15 minutes (one machine, one operator, waiting beats racing). The
 * panel therefore cannot await it — a fifteen-minute spinner with no cancel is worse than the
 * timeout it replaced. `view-gate` is the in-family precedent for this shape. The two fast
 * operations below stay synchronous: they touch SQLite and nothing else.
 *
 * Generation routes read the active profile (e.g. /api/leonardo `applyStyleDna`).
 */
export async function POST(request: NextRequest) {
  // Starts a metered vision job: refuse a cross-site POST.
  const denied = requireOperator(request);
  if (denied) return denied;
  try {
    const body = await readJsonObject(request);
    if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
    const { images, name } = body;
    if (!Array.isArray(images) || images.length === 0) return apiError('Missing required field: images (data URLs)', 400);
    if (name !== undefined && typeof name !== 'string') return apiError('name must be a string', 400);
    const parsed = images.map((image: unknown) => (typeof image === 'string' ? parseVisionImage(image) : null));
    if (parsed.some((p) => p === null)) return apiError('every image must be a base64 image data URL', 400);

    // Validation happens BEFORE the job starts, so a typo comes back as a 400 the caller can
    // act on rather than as a job that fails a minute later.
    const jobId = startStyleDnaJob({
      images: parsed.map((p) => p!),
      ...(name?.trim() ? { name: name.trim() } : {}),
    });
    return apiSuccess({ jobId, images: parsed.length }, 202);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to start style-dna distillation', 500);
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
    const body = await readJsonObject(request);
    if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
    if (typeof body.id !== 'string' || !body.id) return apiError('Missing required field: id', 400);
    if (!setActiveStyleDna(getDb(), body.id)) return apiError(`no style-dna profile with id ${body.id}`, 404);
    return apiSuccess({ active: getActiveStyleDna(getDb()) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to activate style-dna profile', 500);
  }
}
