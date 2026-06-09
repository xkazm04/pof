import { NextRequest } from 'next/server';
import { apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// POST /api/blender-mcp/generate/import — { jobId, provider }
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const jobId = body.jobId as string;
  const provider = body.provider as GenerationProvider;

  if (!jobId || !provider)
    return apiError('jobId and provider are required', 400);

  const result = await getService().importGeneratedAsset(jobId, provider);
  return respondFromResult(result);
}, 'Blender import failed');
