import { describe, it, expect } from 'vitest';
import {
  UNWRAP_FACE_CEILING,
  BLENDER_CANDIDATES,
  resolveBlenderPath,
  unwrapPlan,
  buildMeshFinishArgs,
  parseMeshFinishOutput,
  runMeshFinish,
} from '@/lib/visual-gen/mesh-finish';

const SPEC = {
  highPolyPath: 'C:/gen/jinx_hi.glb',
  outputPath: 'C:/gen/jinx_low.glb',
  targetFaces: 40_000,
};

describe('resolveBlenderPath', () => {
  it('prefers the explicit path, then POF_BLENDER, then a known install', () => {
    const exists = (p: string) => p === BLENDER_CANDIDATES[0];
    expect(resolveBlenderPath('C:/custom/blender.exe', {}, () => true)).toBe('C:/custom/blender.exe');
    expect(resolveBlenderPath(undefined, { POF_BLENDER: 'C:/env/blender.exe' }, () => true)).toBe('C:/env/blender.exe');
    expect(resolveBlenderPath(undefined, {}, exists)).toBe(BLENDER_CANDIDATES[0]);
  });

  it('returns null when nothing resolves (never guesses a path that is not there)', () => {
    expect(resolveBlenderPath(undefined, {}, () => false)).toBeNull();
  });
});

describe('unwrapPlan — never UV-unwrap the high-poly', () => {
  it('allows unwrapping when the mesh is decimated to a low-poly budget first', () => {
    expect(unwrapPlan(true, 40_000)).toEqual({ unwrap: true });
  });

  it('refuses to unwrap an undecimated mesh, with a reason', () => {
    const plan = unwrapPlan(true, undefined);
    expect(plan.unwrap).toBe(false);
    expect(plan.reason).toMatch(/low.?poly|decimat|targetFaces/i);
  });

  it('refuses to unwrap above the island-explosion ceiling, naming the ceiling', () => {
    const plan = unwrapPlan(true, UNWRAP_FACE_CEILING + 1);
    expect(plan.unwrap).toBe(false);
    expect(plan.reason).toContain(String(UNWRAP_FACE_CEILING));
  });

  it('stays off when unwrap was not requested, without inventing a reason', () => {
    expect(unwrapPlan(false, 40_000)).toEqual({ unwrap: false });
  });
});

describe('buildMeshFinishArgs', () => {
  it('runs blender headless with the script after the -- separator', () => {
    const args = buildMeshFinishArgs('C:/repo/scripts/pof_mesh_finish.py', SPEC);
    expect(args.slice(0, 3)).toEqual(['--background', '--python', 'C:/repo/scripts/pof_mesh_finish.py']);
    expect(args).toContain('--');
    expect(args.indexOf('--')).toBeLessThan(args.indexOf('--input'));
  });

  it('passes input, output and the face budget', () => {
    const args = buildMeshFinishArgs('s.py', SPEC);
    expect(args).toContain('--input');
    expect(args[args.indexOf('--input') + 1]).toBe(SPEC.highPolyPath);
    expect(args[args.indexOf('--output') + 1]).toBe(SPEC.outputPath);
    expect(args[args.indexOf('--target-faces') + 1]).toBe('40000');
  });

  it('emits --unwrap only when the unwrap plan allows it', () => {
    expect(buildMeshFinishArgs('s.py', { ...SPEC, unwrap: true })).toContain('--unwrap');
    expect(buildMeshFinishArgs('s.py', { ...SPEC, unwrap: true, targetFaces: undefined })).not.toContain('--unwrap');
  });

  it('passes the mirror axis so a symmetric character is authored once', () => {
    const args = buildMeshFinishArgs('s.py', { ...SPEC, mirror: 'x' });
    expect(args[args.indexOf('--mirror') + 1]).toBe('x');
    expect(buildMeshFinishArgs('s.py', SPEC)).not.toContain('--mirror');
  });

  it('passes the requested high→low bakes as one comma list plus a map size', () => {
    const args = buildMeshFinishArgs('s.py', { ...SPEC, unwrap: true, bake: ['normal', 'ao'], bakeSize: 2048 });
    expect(args[args.indexOf('--bake') + 1]).toBe('normal,ao');
    expect(args[args.indexOf('--bake-size') + 1]).toBe('2048');
  });

  it('drops the bake when the unwrap was refused — a bake with no UVs is meaningless', () => {
    const args = buildMeshFinishArgs('s.py', { ...SPEC, targetFaces: undefined, unwrap: true, bake: ['normal'] });
    expect(args).not.toContain('--bake');
  });

  it('asks for the interior cull only when requested', () => {
    expect(buildMeshFinishArgs('s.py', { ...SPEC, cullInterior: true })).toContain('--cull-interior');
    expect(buildMeshFinishArgs('s.py', SPEC)).not.toContain('--cull-interior');
  });
});

describe('parseMeshFinishOutput', () => {
  const OK = [
    'Blender quit',
    'POF_MESHFINISH_FACES_IN=1500000',
    'POF_MESHFINISH_FACES_OUT=39812',
    'POF_MESHFINISH_SIZE_MB=4.31',
    'POF_MESHFINISH_UV=1',
    'POF_MESHFINISH_BAKE_NORMAL=C:/gen/jinx_normal.png',
    'POF_MESHFINISH_BAKE_AO=C:/gen/jinx_ao.png',
    'POF_MESHFINISH_DONE=C:/gen/jinx_low.glb',
  ].join('\n');

  it('reads the measured face counts, size and baked maps', () => {
    const p = parseMeshFinishOutput(OK);
    expect(p.ok).toBe(true);
    expect(p.meshPath).toBe('C:/gen/jinx_low.glb');
    expect(p.facesIn).toBe(1_500_000);
    expect(p.facesOut).toBe(39_812);
    expect(p.sizeMB).toBeCloseTo(4.31);
    expect(p.uvUnwrapped).toBe(true);
    expect(p.normalMapPath).toBe('C:/gen/jinx_normal.png');
    expect(p.aoMapPath).toBe('C:/gen/jinx_ao.png');
  });

  it('reads how many interior faces the cull removed', () => {
    const p = parseMeshFinishOutput(`${OK}\nPOF_MESHFINISH_FACES_CULLED=4120`);
    expect(p.facesCulled).toBe(4120);
  });

  it('leaves facesCulled undefined when no cull ran — never reports a 0 it did not measure', () => {
    expect(parseMeshFinishOutput(OK).facesCulled).toBeUndefined();
  });

  it('reports an error marker instead of a silent pass', () => {
    const p = parseMeshFinishOutput('POF_MESHFINISH_ERROR=no mesh in C:/gen/x.glb');
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/no mesh/);
  });

  it('is not ok when blender produced no markers at all', () => {
    expect(parseMeshFinishOutput('Segmentation fault').ok).toBe(false);
  });
});

describe('runMeshFinish', () => {
  const deps = (over: Record<string, unknown> = {}) => ({
    run: async () => ({
      stdout: 'POF_MESHFINISH_FACES_OUT=39812\nPOF_MESHFINISH_SIZE_MB=4.31\nPOF_MESHFINISH_DONE=C:/gen/jinx_low.glb',
      code: 0,
    }),
    fileExists: () => true,
    now: () => 0,
    env: { POF_BLENDER: 'C:/b/blender.exe' },
    ...over,
  });

  it('returns the measured low-poly result', async () => {
    const r = await runMeshFinish(SPEC, deps());
    expect(r.ok).toBe(true);
    expect(r.facesOut).toBe(39_812);
    expect(r.sizeMB).toBeCloseTo(4.31);
    expect(r.meshPath).toBe('C:/gen/jinx_low.glb');
  });

  it('fails with a reason when Blender is not installed', async () => {
    const r = await runMeshFinish(SPEC, deps({ env: {}, fileExists: () => false }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/blender/i);
  });

  it('fails when the input mesh is missing', async () => {
    const r = await runMeshFinish(SPEC, deps({ fileExists: (p: string) => p !== SPEC.highPolyPath }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/input mesh|jinx_hi/i);
  });

  it('does not claim success when the DONE marker names a file that was never written', async () => {
    const r = await runMeshFinish(SPEC, deps({ fileExists: (p: string) => p !== SPEC.outputPath }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not written/i);
  });

  it('surfaces the skipped-unwrap reason instead of silently dropping it', async () => {
    const r = await runMeshFinish({ ...SPEC, targetFaces: undefined, unwrap: true }, deps());
    expect(r.unwrapSkippedReason).toMatch(/low.?poly|decimat|targetFaces/i);
  });
});
