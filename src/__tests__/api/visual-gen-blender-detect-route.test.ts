// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';

/**
 * GET /api/visual-gen/blender/detect answers from the SAME locator the headless runners
 * use. fs and child_process are mocked: no real directory is listed and no real Blender
 * process is launched. The machine is described once (files + directory listings) and
 * both sides read that description.
 */

const h = vi.hoisted(() => {
  const machine = { files: new Set<string>(), dirs: new Map<string, string[]>() };
  const existsSync = (p: unknown) => machine.files.has(String(p));
  const readdirSync = (d: unknown) => {
    const hit = machine.dirs.get(String(d));
    if (!hit) throw Object.assign(new Error(`ENOENT: ${String(d)}`), { code: 'ENOENT' });
    return hit;
  };
  const execSync = vi.fn((cmd: string) => {
    if (cmd.includes('--version')) return 'Blender 4.5.3\n\tbuild date: 2025-09-01\n';
    throw new Error(`unexpected command in test: ${cmd}`);
  });
  const withFs = (orig: Record<string, unknown>) =>
    ({ ...orig, existsSync, readdirSync, default: { ...(orig.default as object), existsSync, readdirSync } });
  const withCp = (orig: Record<string, unknown>) =>
    ({ ...orig, execSync, default: { ...(orig.default as object), execSync } });
  return { machine, existsSync, readdirSync, execSync, withFs, withCp };
});
vi.mock('fs', async (orig) => h.withFs(await orig()));
vi.mock('node:fs', async (orig) => h.withFs(await orig()));
vi.mock('child_process', async (orig) => h.withCp(await orig()));
vi.mock('node:child_process', async (orig) => h.withCp(await orig()));
const { machine, existsSync, readdirSync, execSync } = h;

const FOUNDATION = 'C:\\Program Files\\Blender Foundation';
const realPlatform = process.platform;

beforeAll(() => { Object.defineProperty(process, 'platform', { value: 'win32' }); });
afterAll(() => { Object.defineProperty(process, 'platform', { value: realPlatform }); });
afterEach(() => {
  vi.unstubAllEnvs();
  machine.files.clear();
  machine.dirs.clear();
  execSync.mockClear();
});

function describeMachine(env: Record<string, string>, files: string[], dirs: Record<string, string[]> = {}) {
  vi.stubEnv('POF_BLENDER', '');
  vi.stubEnv('ProgramFiles', 'C:\\Program Files');
  vi.stubEnv('ProgramFiles(x86)', 'C:\\Program Files (x86)');
  vi.stubEnv('PATH', '');
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  for (const f of files) machine.files.add(f);
  for (const [d, names] of Object.entries(dirs)) machine.dirs.set(d, names);
}

async function detect() {
  const { GET } = await import('@/app/api/visual-gen/blender/detect/route');
  const res = await GET();
  const body = (await res.json()) as { success: boolean; data: { path: string | null; version: string | null; source: string | null; probed: string[] } };
  expect(body.success).toBe(true);
  return body.data;
}

describe('GET /api/visual-gen/blender/detect', () => {
  it('reads POF_BLENDER like the runners do and reports its version and source', async () => {
    describeMachine({ POF_BLENDER: 'D:\\Tools\\Blender\\blender.exe' }, ['D:\\Tools\\Blender\\blender.exe']);
    const data = await detect();
    expect(data).toMatchObject({ path: 'D:\\Tools\\Blender\\blender.exe', version: '4.5.3', source: 'env' });
  });

  const FIXTURES: Record<string, () => void> = {
    env: () => describeMachine({ POF_BLENDER: 'D:\\Tools\\Blender\\blender.exe' }, ['D:\\Tools\\Blender\\blender.exe']),
    'explicit-install': () => describeMachine({}, [`${FOUNDATION}\\Blender 4.2\\blender.exe`, `${FOUNDATION}\\Blender 5.0\\blender.exe`],
      { [FOUNDATION]: ['Blender 4.2', 'Blender 5.0'] }),
    PATH: () => describeMachine({ PATH: 'C:\\Windows;D:\\blender' }, ['D:\\blender\\blender.exe']),
    none: () => describeMachine({}, []),
  };
  const EXPECTED: Record<string, string | null> = {
    env: 'D:\\Tools\\Blender\\blender.exe',
    'explicit-install': `${FOUNDATION}\\Blender 5.0\\blender.exe`,
    PATH: 'D:\\blender\\blender.exe',
    none: null,
  };

  it.each(Object.keys(FIXTURES))('parity (%s): detect reports the exact path runMeshFinish resolves and spawns', async (name) => {
    FIXTURES[name]();
    const data = await detect();

    const { resolveBlenderPath, runMeshFinish } = await import('@/lib/visual-gen/mesh-finish');
    const resolved = resolveBlenderPath(undefined, process.env, existsSync, {
      listDir: (d) => readdirSafe(d),
      platform: 'win32',
    });
    expect(resolved).toBe(EXPECTED[name]);
    expect(data.path).toBe(resolved);

    const spawned: string[] = [];
    const r = await runMeshFinish(
      { highPolyPath: '/g/hi.glb', outputPath: '/g/lo.glb', targetFaces: 4000, scriptPath: '/s/f.py' },
      {
        env: process.env,
        fileExists: (p) => existsSync(p) || p === '/g/hi.glb' || p === '/s/f.py',
        listDir: (d) => readdirSafe(d),
        platform: 'win32',
        run: async (cmd) => { spawned.push(cmd); return { stdout: '', code: 0 }; },
      },
    );
    if (resolved) expect(spawned).toEqual([resolved]);
    else {
      expect(data.source).toBeNull();
      expect(r.error).toMatch(new RegExp(`probed ${data.probed.length} location`));
    }
  });
});

function readdirSafe(d: string): string[] {
  try { return readdirSync(d) as string[]; } catch { return []; }
}
