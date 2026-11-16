import { NextRequest } from 'next/server';
import { apiSuccess, apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { getService } from '@/lib/blender-mcp/service';
import { mapResult } from '@/types/result';
import { connectTargetError } from '@/lib/blender-mcp/connect-target';
import { MALFORMED_BODY_ERROR, readJsonObject } from '@/app/api/blender-mcp/_lib/body';

// POST /api/blender-mcp — { action: 'connect' | 'disconnect' | 'status' }
export const POST = withRoute(async (req: NextRequest) => {
  const body = await readJsonObject(req);
  if (!body) return apiError(MALFORMED_BODY_ERROR, 400);
  const action = body.action;
  const svc = getService();

  // connect and disconnect change the bridge; status only probes and stays open.
  if (action === 'connect' || action === 'disconnect') {
    const denied = requireOperator(req);
    if (denied) return denied;
  }

  if (action === 'connect') {
    const targetError = connectTargetError(body.host, body.port);
    if (targetError) return apiError(targetError, 400);
    // connectTargetError has narrowed both to `string | undefined` / `number | undefined`.
    const result = await svc.connect(body.host as string | undefined, body.port as number | undefined);
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
