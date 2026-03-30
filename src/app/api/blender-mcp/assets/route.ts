import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { AssetSource } from '@/lib/blender-mcp/types';

// GET /api/blender-mcp/assets?source=polyhaven|sketchfab&query=...&category=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source') as AssetSource | null;
  const query = searchParams.get('query') ?? '';
  const category = searchParams.get('category') ?? undefined;

  const svc = getService();

  if (source === 'sketchfab') {
    const result = await svc.searchSketchfab(query);
    if (!result.ok) return apiError(result.error, 502);
    return apiSuccess({ assets: result.data });
  }

  // Default to polyhaven
  const result = await svc.searchPolyHaven(query, category);
  if (!result.ok) return apiError(result.error, 502);
  return apiSuccess({ assets: result.data });
}
