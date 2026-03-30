import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// GET /api/blender-mcp/generate/status?jobId=...&provider=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const provider = searchParams.get('provider') as GenerationProvider | null;

  if (!jobId || !provider)
    return apiError('jobId and provider are required', 400);

  const result = await getService().pollJobStatus(jobId, provider);
  if (!result.ok) return apiError(result.error, 502);
  return apiSuccess(result.data);
}
