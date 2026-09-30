import { execSync } from 'child_process';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { locateBlender } from '@/lib/visual-gen/blender-locate';

function getBlenderVersion(path: string): string | null {
  try {
    const output = execSync(`"${path}" --version`, { timeout: 10000, encoding: 'utf-8' });
    const match = output.match(/Blender\s+(\d+\.\d+(?:\.\d+)?)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
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
    const version = path ? getBlenderVersion(path) : null;
    return apiSuccess({ path, version, source, probed });
  } catch {
    return apiError('Failed to detect Blender installation');
  }
}
