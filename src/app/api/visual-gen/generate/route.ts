import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';

/**
 * POST /api/visual-gen/generate
 *
 * Placeholder endpoint for 3D generation.
 * Currently returns a simulated response. Will be wired to
 * TripoSR / TRELLIS.2 subprocess in the future.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, prompt, providerId } = body;

    if (!mode || !providerId) {
      return apiError('Missing required fields: mode, providerId');
    }

    if (mode === 'text-to-3d' && !prompt) {
      return apiError('Missing prompt for text-to-3d mode');
    }

    // For now, return a placeholder response indicating the job was queued.
    // Real implementation will spawn a subprocess for local providers
    // or call cloud API for paid providers.
    return apiSuccess({
      jobId: `gen-${Date.now()}`,
      status: 'pending',
      message: `Generation queued with provider "${providerId}". Local model integration coming soon.`,
      provider: providerId,
      mode,
    });
  } catch {
    return apiError('Failed to process generation request');
  }
}
