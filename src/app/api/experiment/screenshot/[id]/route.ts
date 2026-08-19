import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import { apiError } from '@/lib/api-utils';
import { getExperimentJob } from '@/lib/ue-experiment/job-store';
import { getExperimentRun } from '@/lib/ue-experiment/experiment-db';
import { isServableCapture } from '@/lib/ue-experiment/capture-store';

/**
 * GET /api/experiment/screenshot/:id
 * Serves the captured PNG for an experiment — the live job if still in memory, else the
 * persisted run. The path always comes from the runner's own record (the client never supplies
 * one), and it is additionally re-checked to resolve INSIDE an allowed capture root
 * (`isServableCapture` — same realpath discipline as `/api/visual-gen/asset/:name`, which also
 * refuses a symlink pointing out of the root).
 *
 * A recorded path whose file is gone gets its OWN 410 + reason. It used to 404 with
 * "screenshot file missing" while the history rendered the `<img>` regardless — a broken image
 * with the run's verdict still standing beside it.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = getExperimentJob(id)?.result?.screenshotPath ?? getExperimentRun(id)?.screenshotPath ?? null;
  if (!path) return apiError('no screenshot for this experiment', 404);
  if (!isServableCapture(path)) {
    return apiError('capture no longer on disk — this run\'s visual evidence cannot be audited', 410);
  }
  try {
    const buf = await readFile(path);
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
  } catch {
    return apiError('capture no longer on disk — this run\'s visual evidence cannot be audited', 410);
  }
}
