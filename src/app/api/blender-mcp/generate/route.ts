import { NextRequest } from 'next/server';
import { apiError, respondFromResult, withRoute } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// POST /api/blender-mcp/generate — { provider, prompt }
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const provider = body.provider as GenerationProvider;
  const prompt = body.prompt as string;

  if (!provider || !prompt)
    return apiError('provider and prompt are required', 400);

  const svc = getService();
  const result =
    provider === 'hyper3d'
      ? await svc.generateHyper3D(prompt)
      : await svc.generateHunyuan3D(prompt);

  return respondFromResult(result, 201);
}, 'Blender generate failed');
