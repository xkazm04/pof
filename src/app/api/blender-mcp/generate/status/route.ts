import { NextRequest } from 'next/server';
import { apiError, apiSuccess, respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import { mcpGateForJob } from '@/lib/blender-mcp/mcp-gate';
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
  // the same verdict axis the runner path projects. Since wave 29 that verdict can be a
  // REAL one: on a delivery with a provider URL the gate downloads the mesh under an
  // explicit allow-list + size cap (`visual-gen/mesh-fetch.ts`) and runs the Tier-1
  // critique on the file. When the download is refused — or the job never had a URL,
  // because the addon imported straight into the Blender scene — it stays "delivered,
  // ungated" with the specific reason. Memoised per job, so the queue's poll loop never
  // re-downloads a paid result.
  const gate = await mcpGateForJob({
    jobId,
    status: result.data.status,
    ...(result.data.resultUrl ? { resultUrl: result.data.resultUrl } : {}),
  });
  return apiSuccess({ ...result.data, ...gate });
}, 'Blender job status failed');
