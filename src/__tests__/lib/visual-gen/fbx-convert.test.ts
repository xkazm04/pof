import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  buildFbxConvertArgs,
  parseFbxConvertOutput,
  runFbxConvert,
  type FbxConvertSpec,
} from '@/lib/visual-gen/fbx-convert';
import { blenderNotFound, locateBlender } from '@/lib/visual-gen/blender-locate';

/**
 * FBX -> GLB is a FILE job. It used to be a script pushed into the operator's live
 * Blender whose first line was `read_factory_settings(use_empty=True)` — every
 * conversion wiped the scene they had open. It now runs in a factory-empty background
 * Blender (the mesh-split / mesh-finish runner shape) and counts as done only when the
 * GLB is on disk.
 */

const OUT = 'C:/pof/generated/converted/m.glb';
const spec: FbxConvertSpec = {
  inputPath: 'C:/in/m.fbx',
  outputPath: OUT,
  blenderPath: 'C:/blender/blender.exe',
  scriptPath: '/s/pof_fbx_convert.py',
};

describe('buildFbxConvertArgs', () => {
  it('spawns a background, factory-startup Blender with Draco OFF unless asked', () => {
    const args = buildFbxConvertArgs('/s/pof_fbx_convert.py', { inputPath: 'C:/in/m.fbx', outputPath: OUT });
    expect(args).toEqual([
      '--background', '--factory-startup', '--python', '/s/pof_fbx_convert.py', '--',
      '--input', 'C:/in/m.fbx', '--output', OUT,
    ]);
    expect(args).not.toContain('--draco');
    expect(buildFbxConvertArgs('/s/x.py', { inputPath: 'a.fbx', outputPath: OUT, draco: true })).toContain('--draco');
  });
});

describe('parseFbxConvertOutput', () => {
  it('reads the receipt markers', () => {
    expect(parseFbxConvertOutput(`POF_FBXCONV_MESHES=3\nPOF_FBXCONV_TRIS=12840\nPOF_FBXCONV_DONE=${OUT}`))
      .toEqual({ ok: true, meshes: 3, tris: 12840, output: OUT });
  });
  it('carries the script refusal verbatim', () => {
    expect(parseFbxConvertOutput('POF_FBXCONV_ERROR=the FBX holds no mesh'))
      .toEqual({ ok: false, error: 'the FBX holds no mesh' });
  });
  it('never reads a marker-less ending as success', () => {
    const p = parseFbxConvertOutput('Blender quit');
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/no receipt/);
  });
});

describe('runFbxConvert — judged by the artifact', () => {
  it('refuses a receipt whose GLB is not on disk', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: `POF_FBXCONV_MESHES=1\nPOF_FBXCONV_TRIS=12\nPOF_FBXCONV_DONE=${OUT}`, code: 0 });
    const r = await runFbxConvert(spec, { run, fileExists: (p) => p !== spec.outputPath });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not written/);
  });

  it('refuses a GLB left over from an earlier conversion (older than this run)', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: `POF_FBXCONV_MESHES=1\nPOF_FBXCONV_TRIS=12\nPOF_FBXCONV_DONE=${OUT}`, code: 0 });
    const r = await runFbxConvert(spec, {
      run, fileExists: () => true, now: () => 50_000, statFile: () => ({ size: 10, mtimeMs: 1_000 }),
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not written/);
  });

  it('reports meshes, triangles and bytes of a written GLB', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: `POF_FBXCONV_MESHES=3\nPOF_FBXCONV_TRIS=12840\nPOF_FBXCONV_DONE=${OUT}`, code: 0 });
    const r = await runFbxConvert(spec, {
      run, fileExists: () => true, now: () => 1_000, statFile: () => ({ size: 4096, mtimeMs: 1_000 }),
    });
    expect(r).toMatchObject({ ok: true, meshes: 3, tris: 12840, bytes: 4096, output: OUT });
    expect(run.mock.calls[0][1]).toContain('--factory-startup');
  });

  it('with no Blender found, returns the one locator error and never spawns', async () => {
    const run = vi.fn();
    const seams = { env: {}, platform: 'linux' as const, which: () => null };
    const r = await runFbxConvert({ ...spec, blenderPath: undefined }, { ...seams, run, fileExists: () => false });
    const probed = locateBlender({ ...seams, exists: () => false }).probed;
    expect(r.ok).toBe(false);
    expect(r.error).toBe(blenderNotFound(probed));
    expect(run).not.toHaveBeenCalled();
  });
});

describe('[guard] no live-session Blender script resets the operator scene', () => {
  it('has 0 occurrences of read_factory_settings under src/lib/blender-mcp/scripts', () => {
    const dir = path.resolve(__dirname, '../../../lib/blender-mcp/scripts');
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const offenders = walk(dir).filter((f) => fs.readFileSync(f, 'utf-8').includes('read_factory_settings'));
    expect(offenders.map((f) => path.relative(dir, f))).toEqual([]);
  });
});
