import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import { apiError } from '@/lib/api-utils';
import { getExperimentJob } from '@/lib/ue-experiment/job-store';

/**
 * GET /api/experiment/screenshot/:id
 * Serves the captured PNG for a finished experiment job. Safe by construction:
 * the only path read is the one the runner itself produced and stored on the job
 * (the client never supplies a path), so there's no traversal surface.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getExperimentJob(id);
  const path = job?.result?.screenshotPath;
  if (!path) return apiError('no screenshot for this experiment', 404);
  try {
    const buf = await readFile(path);
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
  } catch {
    return apiError('screenshot file missing', 404);
  }
}
