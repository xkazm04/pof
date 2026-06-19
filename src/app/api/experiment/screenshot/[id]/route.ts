import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import { apiError } from '@/lib/api-utils';
import { getExperimentJob } from '@/lib/ue-experiment/job-store';
import { getExperimentRun } from '@/lib/ue-experiment/experiment-db';

/**
 * GET /api/experiment/screenshot/:id
 * Serves the captured PNG for an experiment — the live job if still in memory,
 * else the persisted run. Safe by construction: the only path read is the one
 * the runner itself produced and stored (the client never supplies a path), so
 * there's no traversal surface.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = getExperimentJob(id)?.result?.screenshotPath ?? getExperimentRun(id)?.screenshotPath ?? null;
  if (!path) return apiError('no screenshot for this experiment', 404);
  try {
    const buf = await readFile(path);
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
  } catch {
    return apiError('screenshot file missing', 404);
  }
}
