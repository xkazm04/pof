import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// POST /api/blender-mcp/execute — { code: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.code || typeof body.code !== 'string') {
      return apiError('code is required', 400);
    }
    const result = await getService().executeCode(body.code);
    if (!result.ok) return apiError(result.error, 502);
    return apiSuccess(result.data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error', 500);
  }
}
