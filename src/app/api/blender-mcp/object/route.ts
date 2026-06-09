import { NextRequest } from 'next/server';
import { apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';

// GET /api/blender-mcp/object?name=ObjectName
export const GET = withRoute(async (req: NextRequest) => {
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return apiError('name is required', 400);
  const result = await getService().getObjectInfo(name);
  return respondFromResult(result);
}, 'Blender object info failed');
