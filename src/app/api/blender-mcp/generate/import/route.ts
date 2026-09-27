import { NextRequest } from 'next/server';
import { apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import { ledger } from '@/lib/blender-mcp/generation-ledger';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// POST /api/blender-mcp/generate/import — { jobId, provider }
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const jobId = body.jobId as string;
  const provider = body.provider as GenerationProvider;

  if (!jobId || !provider)
    return apiError('jobId and provider are required', 400);

  // Idempotent: ONE import into the Blender scene per job. A repeat (a second tab, or a
  // resumed poll reaching `completed` again) is answered from the ledger with the object
  // the first import produced (`alreadyImported: true`); a concurrent caller joins it.
  const result = await ledger.importOnce(jobId, provider, () =>
    getService().importGeneratedAsset(jobId, provider),
  );
  return respondFromResult(result);
}, 'Blender import failed');
