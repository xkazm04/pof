import { NextRequest } from 'next/server';
import { existsSync } from 'node:fs';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { readJsonObject, MALFORMED_BODY_ERROR } from '@/app/api/blender-mcp/_lib/body';
import { renderIconFromMesh } from '@/lib/visual-gen/icon-from-mesh';

/**
 * POST /api/visual-gen/icon-from-mesh
 *
 * Render an item icon FROM the entity's own mesh, instead of generating a second,
 * independent illustration of it. The icon library is filled by a text→image generator
 * that never sees the GLB, so an entity can ship a mesh and an icon that depict
 * different objects — and nothing can notice, because an icon matches its step by
 * filename and a filename cannot disagree with a mesh.
 *
 * Body: { meshPath, catalogId, step, entityId?, heroYaw?, resolution? }
 *
 * Synchronous, unlike `/view-gate`: this is one headless Blender orbit and NO vision
 * call, so it returns inside a request rather than needing a job to poll.
 *
 * The icon is written through the library door (`commitLibraryIcon`, a `<name>.prov.json` bound to its bytes) and is surfaced by
 * `GET /api/visual-gen/icons` with `renderedFrom` set — the claim "this icon depicts the
 * shipped asset" is checkable rather than asserted.
 */
/** Sanity bounds on a rendered icon; the default is 512. */
const RESOLUTION_MIN = 64;
const RESOLUTION_MAX = 2048;

/** The first wrongly shaped field as a refusal, or null when the body may start a render. */
function bodyShapeRefusal(body: Record<string, unknown>): string | null {
  for (const field of ['meshPath', 'catalogId', 'step', 'entityId']) {
    if (body[field] != null && typeof body[field] !== 'string') return `${field} must be a string`;
  }
  if (body.heroYaw != null && !Number.isFinite(body.heroYaw)) return 'heroYaw must be a number of degrees';
  const r = body.resolution;
  if (r != null && !(Number.isInteger(r) && (r as number) >= RESOLUTION_MIN && (r as number) <= RESOLUTION_MAX)) {
    return `resolution must be a whole number from ${RESOLUTION_MIN} to ${RESOLUTION_MAX}`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = requireOperator(request);
  if (denied) return denied;
  try {
    const parsed = await readJsonObject(request);
    if (!parsed) return apiError(MALFORMED_BODY_ERROR, 400);
    const shapeRefusal = bodyShapeRefusal(parsed);
    if (shapeRefusal) return apiError(shapeRefusal, 400);
    const body = parsed as {
      meshPath?: string;
      catalogId?: string;
      step?: string;
      entityId?: string;
      heroYaw?: number;
      resolution?: number;
    };

    const meshPath = body.meshPath?.trim();
    const catalogId = body.catalogId?.trim();
    const step = body.step?.trim();
    if (!meshPath) return apiError('meshPath is required', 400);
    if (!catalogId || !step) {
      // Both halves name the artifact the icon is FOR. Without them the file would be
      // written under a name no consumer can match — the `_unaddressable/` failure.
      return apiError('catalogId and step are required — they are the name every icon consumer matches on', 400);
    }
    if (!existsSync(meshPath)) return apiError(`mesh not found at ${meshPath}`, 400);

    const result = await renderIconFromMesh({
      meshPath,
      catalogId,
      step,
      ...(body.entityId?.trim() ? { entityId: body.entityId.trim() } : {}),
      ...(typeof body.heroYaw === 'number' ? { heroYaw: body.heroYaw } : {}),
      ...(typeof body.resolution === 'number' ? { resolution: body.resolution } : {}),
    });

    // A render that produced no icon is an ERROR envelope carrying its reason, not a
    // success carrying `ok: false` — a caller reading `success` must not also have to
    // read `ok` to find out that nothing was written.
    if (!result.ok) return apiError(result.error ?? result.reason, 500);
    return apiSuccess(result);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Failed to render icon from mesh', 500);
  }
}
