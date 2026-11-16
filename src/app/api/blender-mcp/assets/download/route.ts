import { NextRequest } from 'next/server';
import { apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { getService } from '@/lib/blender-mcp/service';
import { MALFORMED_BODY_ERROR, readJsonObject } from '@/app/api/blender-mcp/_lib/body';
import type { AssetSource } from '@/lib/blender-mcp/types';

function isAssetSource(value: unknown): value is AssetSource {
  return value === 'polyhaven' || value === 'sketchfab';
}

// POST /api/blender-mcp/assets/download — { source, id, resolution? }
// Downloads to disk and imports into the live Blender scene, so it sits behind the operator guard.
export const POST = withRoute(async (req: NextRequest) => {
  const denied = requireOperator(req);
  if (denied) return denied;
  const body = await readJsonObject(req);
  if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
  const source = body.source;
  const id = body.id;

  if (!source || !id) return apiError('source and id are required', 400);
  // The dispatch below treats anything but sketchfab as Poly Haven.
  if (!isAssetSource(source)) return apiError('source must be polyhaven or sketchfab', 400);
  if (typeof id !== 'string') return apiError('id must be a string', 400);

  const svc = getService();
  const result =
    source === 'sketchfab'
      ? await svc.downloadSketchfab(id)
      : await svc.downloadPolyHaven(id, body.resolution as string | undefined);

  return respondFromResult(result);
}, 'Blender asset download failed');
