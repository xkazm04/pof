import { respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// GET /api/blender-mcp/scene
export const GET = withRoute(async () => {
  const result = await getService().getSceneInfo();
  return respondFromResult(result);
}, 'Blender scene info failed');
