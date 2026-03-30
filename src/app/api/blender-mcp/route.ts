import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// POST /api/blender-mcp — { action: 'connect' | 'disconnect' | 'status' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;
    const svc = getService();

    if (action === 'connect') {
      const result = await svc.connect(body.host, body.port);
      if (!result.ok) return apiError(result.error, 502);
      return apiSuccess({ connection: result.data });
    }

    if (action === 'disconnect') {
      svc.disconnect();
      return apiSuccess({ connection: svc.getStatus() });
    }

    if (action === 'status') {
      return apiSuccess({ connection: svc.getStatus() });
    }

    return apiError('Unknown action', 400);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error', 500);
  }
}
