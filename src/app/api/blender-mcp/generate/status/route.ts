import { NextRequest } from 'next/server';
import { apiError, apiSuccess, respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import { mcpGateProjection } from '@/lib/blender-mcp/mcp-gate';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// GET /api/blender-mcp/generate/status?jobId=...&provider=...
export const GET = withRoute(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const provider = searchParams.get('provider') as GenerationProvider | null;

  if (!jobId || !provider)
    return apiError('jobId and provider are required', 400);

  const result = await getService().pollJobStatus(jobId, provider);
  if (!result.ok) return respondFromResult(result);

  // The bridge reports transport only (status / progress / resultUrl). Alongside it goes
  // the same verdict axis the runner path projects — here always the ungated one, because
  // nothing on this server ever sees the mesh (see `mcp-gate.ts` for the located reason).
  // Without this a finished Blender generation rendered as a bare "Complete" in the very
  // queue where a runner mesh's "Complete" means a gate passed it.
  return apiSuccess({ ...result.data, ...mcpGateProjection(result.data.status) });
}, 'Blender job status failed');
