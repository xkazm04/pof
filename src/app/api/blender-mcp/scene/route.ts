import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// GET /api/blender-mcp/scene
export async function GET() {
  const result = await getService().getSceneInfo();
  if (!result.ok) return apiError(result.error, 502);
  return apiSuccess(result.data);
}
