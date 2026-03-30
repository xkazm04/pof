import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { AssetSource } from '@/lib/blender-mcp/types';

// POST /api/blender-mcp/assets/download — { source, id, resolution? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const source = body.source as AssetSource;
    const id = body.id as string;

    if (!source || !id) return apiError('source and id are required', 400);

    const svc = getService();

    if (source === 'sketchfab') {
      const result = await svc.downloadSketchfab(id);
      if (!result.ok) return apiError(result.error, 502);
      return apiSuccess(result.data);
    }

    const result = await svc.downloadPolyHaven(id, body.resolution);
    if (!result.ok) return apiError(result.error, 502);
    return apiSuccess(result.data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error', 500);
  }
}
