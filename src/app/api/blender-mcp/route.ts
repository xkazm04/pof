import { NextRequest } from 'next/server';
import { apiSuccess, apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import { mapResult } from '@/types/result';

// POST /api/blender-mcp — { action: 'connect' | 'disconnect' | 'status' }
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const action = body.action as string;
  const svc = getService();

  if (action === 'connect') {
    const result = await svc.connect(body.host, body.port);
    return respondFromResult(mapResult(result, (connection) => ({ connection })));
  }

  if (action === 'disconnect') {
    svc.disconnect();
    return apiSuccess({ connection: svc.getStatus() });
  }

  if (action === 'status') {
    // A real round-trip, not a cached boolean. This is the ONE call the whole
    // app's connection state derives from (the pill, the wizard banner and 19
    // Produce gates), so answering it from a field nothing verifies meant a
    // wedged addon kept every button enabled. `probe()` sends `get_scene_info`
    // (8s fast class, queued on the serialized chain) and reports what came
    // back — including WHY, when it did not.
    return apiSuccess({ connection: await svc.probe() });
  }

  return apiError('Unknown action', 400);
}, 'Blender MCP request failed');
