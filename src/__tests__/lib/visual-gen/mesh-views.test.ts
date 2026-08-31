/* eslint-disable no-restricted-syntax -- the hex literals below are sample palette DATA
   inside a parser fixture, not UI theme colors. */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VIEWS,
  DEFAULT_VIEW_RES,
  MAX_VIEWS,
  viewsPlan,
  buildMeshViewsArgs,
  parseMeshViewsOutput,
  runMeshViews,
} from '@/lib/visual-gen/mesh-views';

const SPEC = { meshPath: 'C:/gen/crate.glb', outDir: 'C:/gen/views/crate' };

describe('viewsPlan', () => {
  it('defaults to enough yaws to see every side', () => {
    expect(viewsPlan(undefined).views).toBe(DEFAULT_VIEWS);
  });

  it('refuses fewer than two views — one view is what got us here', () => {
    const p = viewsPlan(1);
    expect(p.views).toBe(2);
    expect(p.reason).toMatch(/at least two|one view/i);
  });

  it('caps the yaw count so a gate cannot cost unbounded VLM calls', () => {
    const p = viewsPlan(64);
    expect(p.views).toBe(MAX_VIEWS);
    expect(p.reason).toMatch(/cap|ceiling|most/i);
  });
});

describe('buildMeshViewsArgs', () => {
  it('drives Blender headless with the script and the mesh', () => {
    const args = buildMeshViewsArgs('s.py', SPEC);
    expect(args.slice(0, 4)).toEqual(['--background', '--factory-startup', '--python', 's.py']);
    expect(args).toContain('--');
    expect(args[args.indexOf('--') + 1]).toBe(SPEC.meshPath);
    expect(args[args.indexOf('--') + 2]).toBe(SPEC.outDir);
  });

  it('passes the planned view count, not the raw request', () => {
    const args = buildMeshViewsArgs('s.py', { ...SPEC, views: 999 });
    expect(args[args.indexOf('--views') + 1]).toBe(String(MAX_VIEWS));
  });

  it('passes a resolution, defaulting to the project default', () => {
    expect(buildMeshViewsArgs('s.py', SPEC)[
      buildMeshViewsArgs('s.py', SPEC).indexOf('--res') + 1
    ]).toBe(String(DEFAULT_VIEW_RES));
  });
});

describe('parseMeshViewsOutput', () => {
  const OK = [
    'Blender quit',
    'POF_VIEWS_0=0.0|C:/gen/views/crate/view_00.png|#8a7a5c,#3b3228',
    'POF_VIEWS_1=90.0|C:/gen/views/crate/view_01.png|#8b7b5d',
    'POF_VIEWS_DONE=2',
  ].join('\n');

  it('reads each view with its yaw and image path', () => {
    const p = parseMeshViewsOutput(OK);
    expect(p.ok).toBe(true);
    expect(p.views).toHaveLength(2);
    expect(p.views[0].yawDeg).toBe(0);
    expect(p.views[1].yawDeg).toBe(90);
    expect(p.views[1].imagePath).toBe('C:/gen/views/crate/view_01.png');
  });

  it('reads the per-view palette the renderer measured from real pixels', () => {
    expect(parseMeshViewsOutput(OK).views[0].palette).toEqual(['#8a7a5c', '#3b3228']);
  });

  it('leaves the palette undefined rather than empty when none was emitted', () => {
    const p = parseMeshViewsOutput('POF_VIEWS_0=0.0|a.png\nPOF_VIEWS_DONE=1');
    expect(p.views[0].palette).toBeUndefined();
  });

  it('surfaces the script error instead of reporting an empty success', () => {
    const p = parseMeshViewsOutput('POF_VIEWS_ERROR=no mesh objects in the glb');
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/no mesh objects/);
  });

  it('fails when the DONE count disagrees with the views actually emitted', () => {
    const p = parseMeshViewsOutput('POF_VIEWS_0=0.0|a.png\nPOF_VIEWS_DONE=6');
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/6.*1|1.*6/);
  });

  it('reports missing markers rather than claiming zero views succeeded', () => {
    const p = parseMeshViewsOutput('Blender quit');
    expect(p.ok).toBe(false);
    expect(p.error).toBeTruthy();
  });
});

describe('runMeshViews', () => {
  const deps = (stdout: string, present: string[] = []) => ({
    run: async () => ({ stdout, stderr: '', code: 0 }),
    fileExists: (p: string) =>
      p.endsWith('.glb') || p.endsWith('.py') || p.endsWith('blender.exe') || present.includes(p),
    env: { POF_BLENDER: 'C:/b/blender.exe' },
    now: (() => { let t = 0; return () => (t += 250); })(),
  });

  it('returns the rendered views', async () => {
    const r = await runMeshViews(SPEC, deps(
      'POF_VIEWS_0=0.0|C:/gen/views/crate/view_00.png\nPOF_VIEWS_DONE=1',
      ['C:/gen/views/crate/view_00.png'],
    ));
    expect(r.ok).toBe(true);
    expect(r.views).toHaveLength(1);
    expect(r.durationMs).toBeGreaterThan(0);
  });

  it('drops a view whose PNG was never written — a marker is not a file', async () => {
    const r = await runMeshViews(SPEC, deps(
      'POF_VIEWS_0=0.0|C:/gen/views/crate/view_00.png\nPOF_VIEWS_DONE=1',
      [],
    ));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not written|missing/i);
  });

  it('refuses without Blender rather than reporting an empty render', async () => {
    const r = await runMeshViews(SPEC, {
      run: async () => ({ stdout: '', stderr: '', code: 0 }),
      fileExists: () => false,
      env: {},
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Blender/i);
  });

  it('refuses when the mesh does not exist', async () => {
    const r = await runMeshViews(SPEC, {
      run: async () => ({ stdout: '', stderr: '', code: 0 }),
      fileExists: (p: string) => p.endsWith('blender.exe') || p.endsWith('.py'),
      env: { POF_BLENDER: 'C:/b/blender.exe' },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/mesh not found/i);
  });
});
