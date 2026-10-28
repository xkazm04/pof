import { NextRequest } from 'next/server';
import { apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { requireOperator } from '@/lib/api-auth';
import { getService } from '@/lib/blender-mcp/service';
import { ledger } from '@/lib/blender-mcp/generation-ledger';
import { isGenerationProvider } from '@/app/api/blender-mcp/_lib/provider';

// POST /api/blender-mcp/generate — { provider, prompt }
// Starts a PAID provider job, so it sits behind the operator guard like execute.
export const POST = withRoute(async (req: NextRequest) => {
  const denied = requireOperator(req);
  if (denied) return denied;
  const body = await req.json();
  const provider: unknown = body.provider;
  const prompt = body.prompt as string;

  if (!provider || !prompt)
    return apiError('provider and prompt are required', 400);
  if (!isGenerationProvider(provider))
    return apiError('provider must be hyper3d or hunyuan3d', 400);

  const svc = getService();
  const result =
    provider === 'hyper3d'
      ? await svc.generateHyper3D(prompt)
      : await svc.generateHunyuan3D(prompt);

  // The provider accepted (and billed) this job: the server keeps its id so a reloaded
  // forge queue can re-adopt it via GET /generate/jobs instead of paying again.
  if (result.ok) ledger.record({ jobId: result.data.jobId, provider, prompt });

  return respondFromResult(result, 201);
}, 'Blender generate failed');
