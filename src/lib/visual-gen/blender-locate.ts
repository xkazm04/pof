/**
 * The ONE Blender locator. Every headless Blender capability (mesh-finish and its
 * Finish-in-Blender remedy, mesh-split, the mesh-views render gate, icon-from-mesh)
 * and `GET /api/visual-gen/blender/detect` resolve the executable here, so the route
 * that says "Blender is here" and the runners that spawn it can never disagree.
 *
 * Candidates are DERIVED from what is installed, not hand-listed: on Windows each
 * `%ProgramFiles%\Blender Foundation\Blender X.Y` directory is enumerated and tried
 * newest-first, so 4.5 LTS and 5.x are found without a code change. Order:
 *   explicit → POF_BLENDER → installed versions (newest first) → Steam / unix / mac
 *   fixed paths → PATH → none (with every location that was tried).
 *
 * Pure over injected seams (env, platform, exists, listDir, which); the defaults read
 * the real filesystem but never spawn a process — the PATH lookup scans `PATH` itself.
 */
import { existsSync, readdirSync } from 'node:fs';

export type BlenderSource = 'explicit' | 'env' | 'install' | 'path';

/** Discovery seams beyond `env` / `exists` — what a runner's deps may inject. */
export interface BlenderSeams {
  platform?: NodeJS.Platform;
  /** Entry names in a directory; [] when it is absent or unreadable. */
  listDir?: (dir: string) => string[];
  /** Resolve an executable name on PATH, or null. */
  which?: (name: string) => string | null;
}

export interface LocateBlenderInput extends BlenderSeams {
  explicit?: string;
  env?: Record<string, string | undefined>;
  exists?: (p: string) => boolean;
}

export interface BlenderLocation {
  path: string | null;
  source: BlenderSource | null;
  /** Every location tried, in order. */
  probed: string[];
}

const INSTALL_DIR = /^Blender (\d+(?:\.\d+)*)$/i;
const UNIX_PATHS = ['/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender'];
const MAC_PATHS = ['/Applications/Blender.app/Contents/MacOS/Blender'];

function programFiles(env: Record<string, string | undefined>): string {
  return env.ProgramFiles ?? 'C:\\Program Files';
}

/** The fixed (non-versioned) install paths for a platform. Versioned Windows installs
 *  are not here: they come from the directory listing. */
export function fixedBlenderCandidates(
  platform: NodeJS.Platform = process.platform,
  env: Record<string, string | undefined> = {},
): string[] {
  if (platform === 'win32') {
    const x86 = env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    return [`${x86}\\Steam\\steamapps\\common\\Blender\\blender.exe`];
  }
  return platform === 'darwin' ? MAC_PATHS : UNIX_PATHS;
}

/** `Blender X.Y` directory names, newest version first. Anything else is ignored. */
export function newestFirst(names: string[]): string[] {
  const ver = (n: string) => (INSTALL_DIR.exec(n)?.[1] ?? '').split('.').map(Number);
  return names
    .filter((n) => INSTALL_DIR.test(n))
    .sort((a, b) => {
      const va = ver(a), vb = ver(b);
      for (let i = 0; i < Math.max(va.length, vb.length); i++) {
        const d = (vb[i] ?? 0) - (va[i] ?? 0);
        if (d) return d;
      }
      return 0;
    });
}

function defaultListDir(dir: string): string[] {
  try { return readdirSync(dir); } catch { return []; }
}

/** PATH scan without spawning `where` / `which`. */
function pathScan(env: Record<string, string | undefined>, platform: NodeJS.Platform, exists: (p: string) => boolean) {
  return (name: string): string | null => {
    const win = platform === 'win32';
    const file = win && !/\.exe$/i.test(name) ? `${name}.exe` : name;
    const sep = win ? '\\' : '/';
    for (const raw of (env.PATH ?? env.Path ?? '').split(win ? ';' : ':')) {
      const dir = raw.trim().replace(/^"|"$/g, '').replace(/[\\/]+$/, '');
      if (!dir) continue;
      const p = `${dir}${sep}${file}`;
      if (exists(p)) return p;
    }
    return null;
  };
}

/** Find the Blender executable, reporting where it came from and everywhere it looked. */
export function locateBlender(input: LocateBlenderInput = {}): BlenderLocation {
  const env = input.env ?? process.env;
  const platform = input.platform ?? process.platform;
  const exists = input.exists ?? existsSync;
  const listDir = input.listDir ?? defaultListDir;
  const which = input.which ?? pathScan(env, platform, exists);

  if (input.explicit) return { path: input.explicit, source: 'explicit', probed: [input.explicit] };
  if (env.POF_BLENDER) return { path: env.POF_BLENDER, source: 'env', probed: [env.POF_BLENDER] };

  const probed: string[] = [];
  if (platform === 'win32') {
    const foundation = `${programFiles(env)}\\Blender Foundation`;
    const installs = newestFirst(listDir(foundation)).map((d) => `${foundation}\\${d}\\blender.exe`);
    if (!installs.length) probed.push(foundation);
    for (const p of installs) {
      probed.push(p);
      if (exists(p)) return { path: p, source: 'install', probed };
    }
  }
  for (const p of fixedBlenderCandidates(platform, env)) {
    probed.push(p);
    if (exists(p)) return { path: p, source: 'install', probed };
  }

  probed.push(`PATH (${platform === 'win32' ? 'blender.exe' : 'blender'})`);
  const onPath = which('blender');
  if (onPath && exists(onPath)) return { path: onPath, source: 'path', probed };
  return { path: null, source: null, probed };
}

/** The one not-found error every headless Blender runner returns. */
export function blenderNotFound(probed: string[]): string {
  return `Blender not found — probed ${probed.length} location(s): ${probed.join('; ')}. `
    + 'Set POF_BLENDER to the blender executable.';
}
