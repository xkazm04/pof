/**
 * GET /api/pipeline-artifacts/drain/frame?path=<absolute png>
 *
 * Serves ONE rendered L4 gate frame so the drain's `screenshots[]` are actually
 * REACHABLE from the UI. `drainJobs` hoists these paths to the summary precisely so a
 * caller can LOOK at them, but they are absolute filesystem paths — the browser cannot
 * open them, so until now the frames surfaced nowhere.
 *
 * **Jail.** L4 capture writes into the OS temp dir (`captureFrame` → `pof_l4_*.png`,
 * `captureScenarioFrame` → a `pof_l4_scn_<stamp>` dir of `shot_NN.png`), so it serves ONLY `.png`
 * files resolving inside `os.tmpdir()`. Anything else is refused — a `path` param is
 * never trusted to name an arbitrary file.
 *
 * Errors use the standard envelope (`apiError`); success is the raw PNG body, matching
 * the existing binary-serving precedent in `/api/harness/screenshot`.
 */
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { apiError } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('path');
  if (!raw) return apiError('Missing path', 400);
  if (!raw.toLowerCase().endsWith('.png')) return apiError('Only .png frames are served', 400);

  const jail = fs.realpathSync.native(path.resolve(os.tmpdir()));
  let target: string;
  try {
    target = fs.realpathSync.native(path.resolve(raw));
  } catch {
    return apiError('Frame not found', 404);
  }
  // Path-jailed: a capture frame always lives under the OS temp dir.
  if (target !== jail && !target.startsWith(jail + path.sep)) {
    return apiError('Frame is outside the capture directory', 403);
  }

  const buf = fs.readFileSync(target);
  return new Response(new Uint8Array(buf), {
    status: 200,
    // A captured frame is immutable for the life of the file name.
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300, immutable' },
  });
}
