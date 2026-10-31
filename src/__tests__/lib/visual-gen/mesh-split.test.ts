import { describe, it, expect } from 'vitest';
import {
  buildMeshSplitArgs,
  parseMeshSplitOutput,
  runMeshSplit,
  rescaleSplitGroup,
  DEFAULT_MIN_FACE_SHARE,
  DEFAULT_MAX_PARTS,
  DEFAULT_MIN_COVERAGE,
  type MeshSplitSpec,
} from '@/lib/visual-gen/mesh-split';

const spec = (over: Partial<MeshSplitSpec> = {}): MeshSplitSpec => ({
  inputPath: '/g/props.glb',
  outputDir: '/g/mesh-split',
  prefix: 'props',
  ...over,
});

describe('buildMeshSplitArgs', () => {
  it('runs Blender headless against the script with the defaults stated, not implied', () => {
    const args = buildMeshSplitArgs('/s/pof_mesh_split.py', spec());
    expect(args.slice(0, 4)).toEqual(['--background', '--python', '/s/pof_mesh_split.py', '--']);
    expect(args).toContain('--input');
    expect(args[args.indexOf('--input') + 1]).toBe('/g/props.glb');
    expect(args[args.indexOf('--output-dir') + 1]).toBe('/g/mesh-split');
    expect(args[args.indexOf('--prefix') + 1]).toBe('props');
    expect(args[args.indexOf('--min-face-share') + 1]).toBe(String(DEFAULT_MIN_FACE_SHARE));
    expect(args[args.indexOf('--max-parts') + 1]).toBe(String(DEFAULT_MAX_PARTS));
    expect(args[args.indexOf('--min-coverage') + 1]).toBe(String(DEFAULT_MIN_COVERAGE));
  });

  it('passes an explicit speck threshold and part cap through', () => {
    const args = buildMeshSplitArgs('/s/x.py', spec({ minFaceShare: 0.02, maxParts: 4 }));
    expect(args[args.indexOf('--min-face-share') + 1]).toBe('0.02');
    expect(args[args.indexOf('--max-parts') + 1]).toBe('4');
  });

  it('only asks for re-centring when it is wanted', () => {
    expect(buildMeshSplitArgs('/s/x.py', spec())).toContain('--center');
    expect(buildMeshSplitArgs('/s/x.py', spec({ center: false }))).not.toContain('--center');
  });
});

const OUT = [
  'Blender quit noise',
  'POF_MESHSPLIT_FACES_IN=9800',
  'POF_MESHSPLIT_COMPONENTS=5',
  'POF_MESHSPLIT_PART=props_01.glb|4200|0.4286|/g/mesh-split/props_01.glb',
  'POF_MESHSPLIT_PART=props_02.glb|3600|0.3673|/g/mesh-split/props_02.glb',
  'POF_MESHSPLIT_PART=props_03.glb|1980|0.2020|/g/mesh-split/props_03.glb',
  'POF_MESHSPLIT_DISCARDED=2',
  'POF_MESHSPLIT_DISCARDED_FACES=20',
  'POF_MESHSPLIT_CAPPED=0',
  'POF_MESHSPLIT_COVERAGE=0.9980',
  'POF_MESHSPLIT_DONE=1',
].join('\n');

describe('parseMeshSplitOutput', () => {
  it('reads every part with its own face count and share', () => {
    const p = parseMeshSplitOutput(OUT);
    expect(p.ok).toBe(true);
    expect(p.facesIn).toBe(9800);
    expect(p.components).toBe(5);
    expect(p.parts.map((x) => x.name)).toEqual(['props_01.glb', 'props_02.glb', 'props_03.glb']);
    expect(p.parts[0]).toMatchObject({ faces: 4200, share: 0.4286, path: '/g/mesh-split/props_01.glb' });
  });

  it('reports the specks it threw away instead of letting them vanish', () => {
    const p = parseMeshSplitOutput(OUT);
    expect(p.discarded).toBe(2);
    expect(p.discardedFaces).toBe(20);
    expect(p.capped).toBe(0);
    expect(p.coverage).toBe(0.998);
  });

  /**
   * The guard the first live run made necessary. `props__crate.glb` is ONE crate that
   * fragmented into 451 components; without a coverage floor the split wrote 24 "assets"
   * and discarded 77% of the faces. A group of props and a shattered mesh are the same
   * shape to a face-share threshold — coverage is what separates them.
   */
  it('surfaces a refusal to split a shattered mesh as an error, not as 24 assets', () => {
    const p = parseMeshSplitOutput(
      'POF_MESHSPLIT_ERROR=the 24 components above the threshold cover only 23% of the faces — this is one fragmented mesh, not a group of objects',
    );
    expect(p.ok).toBe(false);
    expect(p.parts).toEqual([]);
    expect(p.error).toMatch(/one fragmented mesh/);
  });

  it('carries the script error and never claims ok', () => {
    const p = parseMeshSplitOutput('POF_MESHSPLIT_ERROR=mesh has one connected component — nothing to split');
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/one connected component/);
    expect(p.parts).toEqual([]);
  });

  it('is not ok when the run said DONE but wrote no part', () => {
    const p = parseMeshSplitOutput('POF_MESHSPLIT_FACES_IN=10\nPOF_MESHSPLIT_DONE=1');
    expect(p.ok).toBe(false);
  });
});

describe('runMeshSplit', () => {
  const deps = (stdout: string, exists: (p: string) => boolean) => ({
    run: async () => ({ stdout, code: 0 }),
    fileExists: exists,
    now: () => 0,
    env: { POF_BLENDER: '/bin/blender' },
  });

  it('returns the parts it can actually see on disk', async () => {
    const r = await runMeshSplit(spec(), deps(OUT, () => true));
    expect(r.ok).toBe(true);
    expect(r.parts).toHaveLength(3);
    expect(r.facesIn).toBe(9800);
  });

  it('drops a part the script announced but did not write, and says so', async () => {
    const seen = (p: string) => !p.endsWith('props_02.glb');
    const r = await runMeshSplit(spec(), deps(OUT, seen));
    expect(r.parts.map((x) => x.name)).toEqual(['props_01.glb', 'props_03.glb']);
    expect(r.error).toMatch(/props_02\.glb/);
  });

  it('refuses without Blender rather than reporting an empty split', async () => {
    // No POF_BLENDER and no candidate install on disk — the probe finds nothing.
    const noBlender = (p: string) => !/blender/i.test(p);
    const r = await runMeshSplit(spec(), { ...deps(OUT, noBlender), env: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Blender not found/);
  });

  it('refuses when the input mesh is missing', async () => {
    const r = await runMeshSplit(spec(), deps(OUT, (p) => p !== '/g/props.glb'));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/input mesh not found/);
  });
});

/**
 * Recorded from a real run of pof_mesh_split.py (Blender 4.2) over a four-prop group
 * built at known sizes - a 1.2 m well, a 3.0 m lamp post, two 0.9 m barrels, left to
 * right in that order - and normalised as a whole to a 1 m longest extent, the way a
 * generator delivers it. Face-count order is well, barrel B, barrel A, lamp post.
 */
const GROUP_OUT = [
  'POF_MESHSPLIT_FACES_IN=448',
  'POF_MESHSPLIT_GROUP_EXTENTS=1.000000,0.295567,0.738916',
  'POF_MESHSPLIT_COMPONENTS=4',
  'POF_MESHSPLIT_COVERAGE=1.0000',
  'POF_MESHSPLIT_PART=g_01.glb|188|0.4196|/g/mesh-split/g_01.glb|0.295567,0.295567,0.295567|0.600000,0.000000,0.600000',
  'POF_MESHSPLIT_PART=g_02.glb|124|0.2768|/g/mesh-split/g_02.glb|0.147783,0.147783,0.221675|1.378325,0.000000,0.563054',
  'POF_MESHSPLIT_PART=g_03.glb|92|0.2054|/g/mesh-split/g_03.glb|0.147783,0.147783,0.221675|1.107389,0.000000,0.563054',
  'POF_MESHSPLIT_PART=g_04.glb|44|0.0982|/g/mesh-split/g_04.glb|0.039409,0.039409,0.738916|0.890640,0.000000,0.821675',
  'POF_MESHSPLIT_DISCARDED=0',
  'POF_MESHSPLIT_DISCARDED_FACES=0',
  'POF_MESHSPLIT_CAPPED=0',
  'POF_MESHSPLIT_DONE=1',
].join('\n');

describe('the group frame travels with every part (decollate before invert)', () => {
  it('reads the group extents and each part\'s extents and pre-recentre origin', () => {
    const p = parseMeshSplitOutput(GROUP_OUT);
    expect(p.groupExtents).toEqual([1, 0.295567, 0.738916]);
    expect(p.parts[3]).toMatchObject({ extents: [0.039409, 0.039409, 0.738916], origin: [0.89064, 0, 0.821675] });
  });

  it('still parses a four-field PART from an older script, without inventing a frame', () => {
    const p = parseMeshSplitOutput(OUT);
    expect(p.groupExtents).toBeUndefined();
    expect(p.parts[0].extents).toBeUndefined();
    expect(p.parts[0].origin).toBeUndefined();
  });

  it('resolves every prop from ONE known size, because the group shares one scale', () => {
    const truth: Record<string, number> = { 'g_01.glb': 1.2, 'g_02.glb': 0.9, 'g_03.glb': 0.9, 'g_04.glb': 3.0 };
    const r = rescaleSplitGroup(parseMeshSplitOutput(GROUP_OUT).parts, { name: 'g_01.glb', targetExtentM: 1.2 });
    expect(r).toBeDefined();
    for (const part of r!) expect(Math.abs(part.worldExtentM / truth[part.name] - 1)).toBeLessThan(0.01);
    expect(new Set(r!.map((x) => x.importUniformScale)).size).toBe(1);
  });

  it('recovers the reference image\'s left-to-right order where the face-count rank cannot', () => {
    const parts = parseMeshSplitOutput(GROUP_OUT).parts;
    const leftToRight = [...parts].sort((a, b) => a.origin![0] - b.origin![0]).map((x) => x.name);
    // well, lamp post, barrel A, barrel B - the two barrels have identical extents, so
    // only the origin tells them apart once both are re-centred.
    expect(leftToRight).toEqual(['g_01.glb', 'g_04.glb', 'g_03.glb', 'g_02.glb']);
  });

  it('refuses to guess a scale when the known part or a measurement is missing', () => {
    const parts = parseMeshSplitOutput(GROUP_OUT).parts;
    expect(rescaleSplitGroup(parts, { name: 'nope.glb', targetExtentM: 1.2 })).toBeUndefined();
    expect(rescaleSplitGroup(parts, { name: 'g_01.glb', targetExtentM: 0 })).toBeUndefined();
    expect(rescaleSplitGroup(parseMeshSplitOutput(OUT).parts, { name: 'props_01.glb', targetExtentM: 1 })).toBeUndefined();
  });
});
