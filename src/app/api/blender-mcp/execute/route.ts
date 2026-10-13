import { NextRequest } from 'next/server';
import { apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { getService } from '@/lib/blender-mcp/service';

// POST /api/blender-mcp/execute — { code: string }
// Blender Python has full OS access, so this sits behind the operator guard.
export const POST = withRoute(async (req: NextRequest) => {
  const denied = requireOperator(req);
  if (denied) return denied;
  const body = await req.json();
  if (!body.code || typeof body.code !== 'string') {
    return apiError('code is required', 400);
  }
  const result = await getService().executeCode(body.code);
  return respondFromResult(result);
}, 'Blender execute failed');
