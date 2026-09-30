import { describe, it, expect, vi } from 'vitest';
import { locateBlender, blenderNotFound } from '@/lib/visual-gen/blender-locate';
import { resolveBlenderPath, runMeshFinish } from '@/lib/visual-gen/mesh-finish';
import { runMeshSplit } from '@/lib/visual-gen/mesh-split';
import { runMeshViews } from '@/lib/visual-gen/mesh-views';

/**
 * One Blender locator. Every seam (env, platform, exists, listDir, which) is injected,
 * so nothing here reads the real filesystem or launches a real Blender process.
 */

const FOUNDATION = 'C:\\Program Files\\Blender Foundation';
const exe = (v: string) => `${FOUNDATION}\\Blender ${v}\\blender.exe`;
const listing = (names: string[]) => (dir: string) => (dir === FOUNDATION ? names : []);
const noWhich = () => null;

describe('locateBlender — candidates come from what is installed', () => {
  it('picks the newest version from the directory listing, not from a hand-written list', () => {
    const loc = locateBlender({
      platform: 'win32',
      env: { ProgramFiles: 'C:\\Program Files' },
      listDir: listing(['Blender 4.2', 'Blender 4.5', 'Blender 5.0']),
      exists: () => true,
      which: noWhich,
    });
    expect(loc.path).toBe(exe('5.0'));
    expect(loc.source).toBe('install');
  });

  it('finds a Blender 4.5 LTS install through resolveBlenderPath with an injected listing', () => {
    const only45 = exe('4.5');
    const exists = (p: string) => p === only45;
    expect(resolveBlenderPath(undefined, {}, exists, { listDir: listing(['Blender 4.5']), which: noWhich, platform: 'win32' }))
      .toBe(only45);
  });

  it('nothing found: path and source are null, probed names every location tried, in order', () => {
    const loc = locateBlender({ platform: 'win32', env: {}, listDir: () => [], exists: () => false, which: noWhich });
    expect(loc.path).toBeNull();
    expect(loc.source).toBeNull();
    expect(loc.probed.length).toBeGreaterThanOrEqual(3);
    expect(loc.probed[0]).toContain('Blender Foundation');
    expect(loc.probed.some((p) => /Steam/.test(p))).toBe(true);
    expect(loc.probed[loc.probed.length - 1]).toMatch(/PATH/);
  });

  it('a PATH-only install resolves with source "path"', () => {
    const loc = locateBlender({
      platform: 'linux',
      env: {},
      listDir: () => [],
      exists: (p) => p === '/opt/blender/blender',
      which: (name) => (name === 'blender' ? '/opt/blender/blender' : null),
    });
    expect(loc).toMatchObject({ path: '/opt/blender/blender', source: 'path' });
  });
});

describe('the headless runners share the locator', () => {
  const env = {};
  const seams = { platform: 'win32' as const, listDir: () => [] as string[], which: noWhich };
  const run = vi.fn(async () => ({ stdout: '', code: 0 }));

  it('runMeshFinish, runMeshSplit and runMeshViews return the SAME not-found error naming what was probed', async () => {
    const fileExists = (p: string) => !/blender/i.test(p);
    const expected = blenderNotFound(locateBlender({ env, exists: fileExists, ...seams }).probed);
    expect(expected).toMatch(/Blender not found/);
    expect(expected).toMatch(/POF_BLENDER/);
    expect(expected).toMatch(/probed 3 location/);

    const deps = { run, fileExists, env, ...seams };
    const finish = await runMeshFinish({ highPolyPath: '/g/hi.glb', outputPath: '/g/lo.glb', targetFaces: 4000 }, deps);
    const split = await runMeshSplit({ inputPath: '/g/grp.glb', outputDir: '/g/out', prefix: 'grp' }, deps);
    const views = await runMeshViews({ meshPath: '/g/hi.glb', outDir: '/g/v' }, deps);
    expect(finish.error).toBe(expected);
    expect(split.error).toBe(expected);
    expect(views.error).toBe(expected);
    expect(run).not.toHaveBeenCalled();
  });

  it('a PATH-only install is what every runner spawns', async () => {
    const linux = {
      platform: 'linux' as const,
      env: {},
      listDir: () => [] as string[],
      which: (name: string) => (name === 'blender' ? '/opt/blender/blender' : null),
      fileExists: (p: string) => p === '/opt/blender/blender' || p.endsWith('.glb') || p.endsWith('.py'),
    };
    const spawned: string[] = [];
    const rec = async (cmd: string) => { spawned.push(cmd); return { stdout: '', code: 0 }; };
    await runMeshFinish({ highPolyPath: '/g/hi.glb', outputPath: '/g/lo.glb', targetFaces: 4000 }, { ...linux, run: rec });
    await runMeshSplit({ inputPath: '/g/grp.glb', outputDir: '/g/out', prefix: 'grp' }, { ...linux, run: rec });
    await runMeshViews({ meshPath: '/g/hi.glb', outDir: '/g/v' }, { ...linux, run: rec });
    expect(spawned).toEqual(['/opt/blender/blender', '/opt/blender/blender', '/opt/blender/blender']);
  });
});
