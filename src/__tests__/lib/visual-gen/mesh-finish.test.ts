import { describe, it, expect } from 'vitest';
import {
  UNWRAP_FACE_CEILING,
  BLENDER_CANDIDATES,
  BAKEABLE_MAPS,
  resolveBlenderPath,
  unwrapPlan,
  bakePlan,
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

describe('bakePlan — only claim the maps Cycles can actually produce', () => {
  it('runs the four native Cycles passes, so a finished asset carries colour and not just detail', () => {
    const plan = bakePlan(['normal', 'ao', 'diffuse', 'roughness']);
    expect(plan.run).toEqual(['normal', 'ao', 'diffuse', 'roughness']);
    expect(plan.skipped).toEqual([]);
  });

  it('refuses metallic with a reason — Cycles has no metallic pass, and a silent drop would read as baked', () => {
    const plan = bakePlan(['diffuse', 'metallic']);
    expect(plan.run).toEqual(['diffuse']);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].map).toBe('metallic');
    expect(plan.skipped[0].reason).toMatch(/no metallic bake pass|emission/i);
  });

  it('de-duplicates a repeated map instead of baking it twice', () => {
    expect(bakePlan(['ao', 'ao', 'normal']).run).toEqual(['ao', 'normal']);
  });

  it('is empty for no request, and every runnable map is declared bakeable', () => {
    expect(bakePlan(undefined)).toEqual({ run: [], skipped: [] });
    expect(bakePlan([...BAKEABLE_MAPS]).skipped).toEqual([]);
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

  it('passes only the bakeable maps, so an unsupported one never reaches Blender', () => {
    const args = buildMeshFinishArgs('s.py', { ...SPEC, unwrap: true, bake: ['diffuse', 'metallic', 'roughness'] });
    expect(args[args.indexOf('--bake') + 1]).toBe('diffuse,roughness');
  });

  it('passes the UV mode so authored islands can be packed instead of re-projected', () => {
    const args = buildMeshFinishArgs('s.py', { ...SPEC, unwrap: true, uvMode: 'pack-existing' });
    expect(args[args.indexOf('--uv-mode') + 1]).toBe('pack-existing');
  });

  it('omits the UV mode when no unwrap runs — there is no layout to choose', () => {
    expect(buildMeshFinishArgs('s.py', { ...SPEC, uvMode: 'pack-existing' })).not.toContain('--uv-mode');
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

  it('reads the colour and roughness maps, so a textured result is reported as textured', () => {
    const p = parseMeshFinishOutput(
      `${OK}\nPOF_MESHFINISH_BAKE_DIFFUSE=C:/gen/jinx_diffuse.png\nPOF_MESHFINISH_BAKE_ROUGHNESS=C:/gen/jinx_roughness.png`,
    );
    expect(p.diffuseMapPath).toBe('C:/gen/jinx_diffuse.png');
    expect(p.roughnessMapPath).toBe('C:/gen/jinx_roughness.png');
  });

  it('reports the UV layout actually used, and the reason when the asked-for one was not available', () => {
    const p = parseMeshFinishOutput(
      `${OK}\nPOF_MESHFINISH_UV_MODE=smart\nPOF_MESHFINISH_UV_MODE_FALLBACK=pack-existing needs authored UVs; none survived the join`,
    );
    expect(p.uvMode).toBe('smart');
    expect(p.uvModeFallbackReason).toMatch(/authored UVs/i);
  });

  it('leaves the fallback reason undefined when the asked-for layout ran', () => {
    expect(parseMeshFinishOutput(`${OK}\nPOF_MESHFINISH_UV_MODE=pack-existing`).uvModeFallbackReason).toBeUndefined();
  });

  it('reads how many interior faces the cull removed', () => {
    const p = parseMeshFinishOutput(`${OK}\nPOF_MESHFINISH_FACES_CULLED=4120`);
    expect(p.facesCulled).toBe(4120);
  });

  it('leaves facesCulled undefined when no cull ran — never reports a 0 it did not measure', () => {
    expect(parseMeshFinishOutput(OK).facesCulled).toBeUndefined();
  });

  // Blender probe (4.2, headless): a small cube fully enclosed inside a big cube and
  // joined into one object yields 0 selected faces from select_interior_faces, because
  // the operator only selects faces whose every edge has >2 face users — i.e. WELDED
  // interior. A welded shared wall does select (1 face). So on the assembled
  // multi-part character the cull was written for, `facesCulled: 0` is not a
  // measurement of "nothing hidden" — it is the operator being blind to loose shells.
  it('names the shells the interior cull could not evaluate instead of implying none were hidden', () => {
    const p = parseMeshFinishOutput(`${OK}\nPOF_MESHFINISH_FACES_CULLED=0\nPOF_MESHFINISH_CULL_UNEVALUATED_SHELLS=14`);
    expect(p.facesCulled).toBe(0);
    expect(p.cullUnevaluatedShells).toBe(14);
    expect(p.cullLimitReason).toMatch(/loose shell|separate shell|welded/i);
  });

  it('reports no cull limitation when the mesh is a single shell', () => {
    const p = parseMeshFinishOutput(`${OK}\nPOF_MESHFINISH_FACES_CULLED=0\nPOF_MESHFINISH_CULL_UNEVALUATED_SHELLS=1`);
    expect(p.cullLimitReason).toBeUndefined();
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

  it('reports a requested map it could not bake, so the caller never assumes a full PBR set', async () => {
    const r = await runMeshFinish({ ...SPEC, unwrap: true, bake: ['diffuse', 'metallic'] }, deps());
    expect(r.bakeSkipped).toHaveLength(1);
    expect(r.bakeSkipped?.[0].map).toBe('metallic');
  });

  it('leaves bakeSkipped undefined when every requested map ran', async () => {
    const r = await runMeshFinish({ ...SPEC, unwrap: true, bake: ['diffuse'] }, deps());
    expect(r.bakeSkipped).toBeUndefined();
  });
});
