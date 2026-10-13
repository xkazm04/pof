import { NextRequest } from 'next/server';
import { apiSuccess, apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { getService } from '@/lib/blender-mcp/service';
import { mapResult } from '@/types/result';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * The bridge is a raw TCP client to a local Blender addon. A caller-chosen host
 * would turn connect into a probe of any address, so only loopback hosts and a
 * valid port are accepted; absent values fall back to the service defaults.
 */
function connectTargetError(host: unknown, port: unknown): string | null {
  if (host !== undefined && (typeof host !== 'string' || !LOOPBACK_HOSTS.has(host.toLowerCase()))) {
    return 'host must be a loopback address (localhost, 127.0.0.1 or ::1)';
  }
  if (port !== undefined && !(Number.isInteger(port) && (port as number) >= 1 && (port as number) <= 65535)) {
    return 'port must be an integer between 1 and 65535';
  }
  return null;
}

// POST /api/blender-mcp — { action: 'connect' | 'disconnect' | 'status' }
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const action = body.action as string;
  const svc = getService();

  // connect and disconnect change the bridge; status only probes and stays open.
  if (action === 'connect' || action === 'disconnect') {
    const denied = requireOperator(req);
    if (denied) return denied;
  }

  if (action === 'connect') {
    const targetError = connectTargetError(body.host, body.port);
    if (targetError) return apiError(targetError, 400);
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
