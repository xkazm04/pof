// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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
  // The fake Blender takes `startMs` to answer. A sync spawn blocks the whole process for it;
  // an async spawn only waits. Both fakes share the latency so the event-loop test can tell them apart.
  const blender = { startMs: 0 };
  const VERSION_OUT = 'Blender 4.5.3\n\tbuild date: 2025-09-01\n';
  const execSync = vi.fn((cmd: string) => {
    if (cmd.includes('--version')) {
      if (blender.startMs) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, blender.startMs);
      return VERSION_OUT;
    }
    throw new Error(`unexpected command in test: ${cmd}`);
  });
  const execFile = vi.fn((file: string, args: string[], _opts: unknown, cb: (e: Error | null, out: string) => void) => {
    if (!args.includes('--version')) return cb(new Error(`unexpected command in test: ${file} ${args.join(' ')}`), '');
    setTimeout(() => cb(null, VERSION_OUT), blender.startMs);
  });
  const withFs = (orig: Record<string, unknown>) =>
    ({ ...orig, existsSync, readdirSync, default: { ...(orig.default as object), existsSync, readdirSync } });
  const withCp = (orig: Record<string, unknown>) =>
    ({ ...orig, execSync, execFile, default: { ...(orig.default as object), execSync, execFile } });
  return { machine, blender, existsSync, readdirSync, execSync, execFile, withFs, withCp };
});
vi.mock('fs', async (orig) => h.withFs(await orig()));
vi.mock('node:fs', async (orig) => h.withFs(await orig()));
vi.mock('child_process', async (orig) => h.withCp(await orig()));
vi.mock('node:child_process', async (orig) => h.withCp(await orig()));
const { machine, blender, existsSync, readdirSync, execSync, execFile } = h;

const FOUNDATION = 'C:\\Program Files\\Blender Foundation';
const realPlatform = process.platform;

beforeAll(() => { Object.defineProperty(process, 'platform', { value: 'win32' }); });
afterAll(() => { Object.defineProperty(process, 'platform', { value: realPlatform }); });
afterEach(() => {
  vi.unstubAllEnvs();
  machine.files.clear();
  machine.dirs.clear();
  execSync.mockClear();
  execFile.mockClear();
  blender.startMs = 0;
  cleanup();
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

  it('does not block the event loop while Blender starts (no shell, no sync spawn)', async () => {
    describeMachine({ POF_BLENDER: 'D:\\Tools\\Blender\\blender.exe' }, ['D:\\Tools\\Blender\\blender.exe']);
    blender.startMs = 400;
    // Warm the module graph so import time is not counted as a stall.
    await detect();
    execFile.mockClear();
    execSync.mockClear();

    let maxGap = 0;
    let last = performance.now();
    const ticker = setInterval(() => {
      const now = performance.now();
      maxGap = Math.max(maxGap, now - last);
      last = now;
    }, 10);
    const data = await detect();
    await new Promise((r) => setTimeout(r, 30)); // let a tick that a blocked loop delayed fire and record its gap
    clearInterval(ticker);

    expect(data.version).toBe('4.5.3');
    expect(maxGap).toBeLessThan(150); // a 400 ms synchronous spawn shows as a ~400 ms gap
    expect(execSync).not.toHaveBeenCalled();
    expect(execFile.mock.calls[0][1]).toEqual(['--version']); // argv, not shell text
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
