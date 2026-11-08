import { execFile } from 'child_process';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { locateBlender } from '@/lib/visual-gen/blender-locate';

const VERSION_TIMEOUT_MS = 10000;

/**
 * Async and shell-free: Blender's start-up must not stall every other request on the single
 * Node process, and a path from POF_BLENDER is an argv entry, never shell text.
 */
function getBlenderVersion(path: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      execFile(path, ['--version'], { timeout: VERSION_TIMEOUT_MS, encoding: 'utf-8' }, (err, stdout) => {
        if (err) return resolve(null);
        const match = String(stdout).match(/Blender\s+(\d+\.\d+(?:\.\d+)?)/);
        resolve(match ? match[1] : null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * GET /api/visual-gen/blender/detect
 * Which Blender this machine's headless runners will spawn. Resolved by the SAME
 * `locateBlender` the runners use (POF_BLENDER, installed versions newest-first, fixed
 * paths, PATH), so this route can never report an install the runners would not use.
 * Answers `{ path, version, source, probed }`; `version` is null when `--version` fails.
 */
export async function GET() {
  try {
    const { path, source, probed } = locateBlender();
    const version = path ? await getBlenderVersion(path) : null;
    return apiSuccess({ path, version, source, probed });
  } catch {
    return apiError('Failed to detect Blender installation');
  }
}
