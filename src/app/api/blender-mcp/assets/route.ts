import { NextRequest } from 'next/server';
import { respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import { mapResult } from '@/types/result';
import type { AssetSource } from '@/lib/blender-mcp/types';

// GET /api/blender-mcp/assets?source=polyhaven|sketchfab&query=...&category=...
export const GET = withRoute(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source') as AssetSource | null;
  const query = searchParams.get('query') ?? '';
  const category = searchParams.get('category') ?? undefined;

  const svc = getService();
  const result =
    source === 'sketchfab'
      ? await svc.searchSketchfab(query)
      : await svc.searchPolyHaven(query, category);

  return respondFromResult(mapResult(result, (assets) => ({ assets })));
}, 'Blender asset search failed');
