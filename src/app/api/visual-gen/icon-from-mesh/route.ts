import { NextRequest } from 'next/server';
import { existsSync } from 'node:fs';
import { apiSuccess, apiError } from '@/lib/api-utils';
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
 * The written icon carries a `<base>.render.json` provenance sidecar and is surfaced by
 * `GET /api/visual-gen/icons` with `renderedFrom` set — the claim "this icon depicts the
 * shipped asset" is checkable rather than asserted.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
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
