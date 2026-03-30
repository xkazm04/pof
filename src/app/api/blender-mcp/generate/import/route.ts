import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// POST /api/blender-mcp/generate/import — { jobId, provider }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobId = body.jobId as string;
    const provider = body.provider as GenerationProvider;

    if (!jobId || !provider)
      return apiError('jobId and provider are required', 400);

    const result = await getService().importGeneratedAsset(jobId, provider);
    if (!result.ok) return apiError(result.error, 502);
    return apiSuccess(result.data);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error', 500);
  }
}
