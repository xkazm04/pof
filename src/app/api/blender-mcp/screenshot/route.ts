import { respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import { mapResult } from '@/types/result';

// GET /api/blender-mcp/screenshot
export const GET = withRoute(async () => {
  const result = await getService().getViewportScreenshot();
  return respondFromResult(mapResult(result, (screenshot) => ({ screenshot })));
}, 'Blender screenshot failed');
