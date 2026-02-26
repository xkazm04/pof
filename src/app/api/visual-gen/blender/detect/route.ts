import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { apiSuccess, apiError } from '@/lib/api-utils';

const BLENDER_PATHS_WIN = [
  'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Blender\\blender.exe',
];

const BLENDER_PATHS_UNIX = [
  '/usr/bin/blender',
  '/usr/local/bin/blender',
  '/snap/bin/blender',
];

const BLENDER_PATHS_MAC = [
  '/Applications/Blender.app/Contents/MacOS/Blender',
  '/Applications/Blender.app/Contents/MacOS/blender',
];

function getPlatformPaths(): string[] {
  if (process.platform === 'win32') return BLENDER_PATHS_WIN;
  if (process.platform === 'darwin') return BLENDER_PATHS_MAC;
  return BLENDER_PATHS_UNIX;
}

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
 * Auto-detect Blender installation on this system.
 */
export async function GET() {
  try {
    const paths = getPlatformPaths();

    for (const path of paths) {
      if (existsSync(path)) {
        const version = getBlenderVersion(path);
        if (version) {
          return apiSuccess({ path, version });
        }
      }
    }

    // Try `which` / `where` as fallback
    try {
      const cmd = process.platform === 'win32' ? 'where blender' : 'which blender';
      const found = execSync(cmd, { timeout: 5000, encoding: 'utf-8' }).trim().split('\n')[0];
      if (found && existsSync(found)) {
        const version = getBlenderVersion(found);
        if (version) {
          return apiSuccess({ path: found, version });
        }
      }
    } catch {
      // Not found via PATH
    }

    return apiSuccess({ path: null, version: null });
  } catch {
    return apiError('Failed to detect Blender installation');
  }
}
