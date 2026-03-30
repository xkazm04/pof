import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getService } from '@/lib/blender-mcp/service';
import type { GenerationProvider } from '@/lib/blender-mcp/types';

// POST /api/blender-mcp/generate — { provider, prompt }
export async function POST(req: NextRequest) {
  try {
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

    if (!result.ok) return apiError(result.error, 502);
    return apiSuccess(result.data, 201);
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Internal error', 500);
  }
}
