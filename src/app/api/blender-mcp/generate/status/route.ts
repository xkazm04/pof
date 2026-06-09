import { NextRequest } from 'next/server';
import { apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// GET /api/blender-mcp/generate/status?jobId=...&provider=...
export const GET = withRoute(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const provider = searchParams.get('provider') as GenerationProvider | null;

  if (!jobId || !provider)
    return apiError('jobId and provider are required', 400);

  const result = await getService().pollJobStatus(jobId, provider);
  return respondFromResult(result);
}, 'Blender job status failed');
