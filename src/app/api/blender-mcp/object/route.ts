import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// GET /api/blender-mcp/object?name=ObjectName
export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return apiError('name is required', 400);
  const result = await getService().getObjectInfo(name);
  if (!result.ok) return apiError(result.error, 502);
  return apiSuccess(result.data);
}
