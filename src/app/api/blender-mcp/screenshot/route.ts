import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// GET /api/blender-mcp/screenshot
export async function GET() {
  const result = await getService().getViewportScreenshot();
  if (!result.ok) return apiError(result.error, 502);
  return apiSuccess({ screenshot: result.data });
}
