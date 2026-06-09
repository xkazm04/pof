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
    return apiSuccess({ connection: svc.getStatus() });
  }

  return apiError('Unknown action', 400);
}, 'Blender MCP request failed');
