import { NextRequest } from 'next/server';
import { apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { AssetSource } from '@/lib/blender-mcp/types';

// POST /api/blender-mcp/assets/download — { source, id, resolution? }
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const source = body.source as AssetSource;
  const id = body.id as string;

  if (!source || !id) return apiError('source and id are required', 400);

  const svc = getService();
  const result =
    source === 'sketchfab'
      ? await svc.downloadSketchfab(id)
      : await svc.downloadPolyHaven(id, body.resolution);

  return respondFromResult(result);
}, 'Blender asset download failed');
