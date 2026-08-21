import { describe, it, expect } from 'vitest';
import {
  buildTrellisArgs, parseTrellisOutput, runTrellis, toWslPath, fromWslPath, withWslenv,
} from '@/lib/visual-gen/trellis-runner';
import { trellisFaceLimit, trellisGateDeps } from '@/lib/visual-gen/trellis-job-store';

const SPEC = { imagePath: 'in.png', outputPath: 'out/mesh.glb' };
const ENV = { POF_TRELLIS_ROOT: '/home/u/TRELLIS.2', POF_TRELLIS_VENV: '/home/u/t2env/bin/python' };

describe('toWslPath / fromWslPath', () => {
  it('translates a Windows path onto /mnt/<drive>', () => {
    expect(toWslPath('C:/Users/k/pof/in.png')).toBe('/mnt/c/Users/k/pof/in.png');
    expect(toWslPath('C:\\Users\\k\\pof\\in.png')).toBe('/mnt/c/Users/k/pof/in.png');
    expect(toWslPath('D:/gen/a.glb')).toBe('/mnt/d/gen/a.glb');
  });

  /** The venv python and the TRELLIS.2 checkout legitimately live INSIDE the distro.
   *  Rewriting them would break every WSL-mode run. */
  it('passes an already-POSIX path through untouched', () => {
    expect(toWslPath('/home/u/t2env/bin/python')).toBe('/home/u/t2env/bin/python');
  });

  it('round-trips a Windows path', () => {
    expect(fromWslPath(toWslPath('C:/Users/k/out.glb'))).toBe('C:/Users/k/out.glb');
  });

  it('leaves a non-/mnt path alone on the way back', () => {
    expect(fromWslPath('/home/u/out.glb')).toBe('/home/u/out.glb');
  });
});

describe('buildTrellisArgs', () => {
  it('passes image, output, trellis-root', () => {
    const a = buildTrellisArgs('pof_trellis.py', SPEC, '/root');
    expect(a).toEqual(expect.arrayContaining([
      '--image', 'in.png', '--output', 'out/mesh.glb', '--trellis-root', '/root',
    ]));
    expect(a[0]).toBe('pof_trellis.py');
  });

  it('omits optional flags unless provided', () => {
    const a = buildTrellisArgs('s', SPEC, 'r');
    expect(a).not.toContain('--model');
    expect(a).not.toContain('--decimation-target');
    expect(a).not.toContain('--texture-size');
  });

  it('passes the native face budget and texture size when set', () => {
    const a = buildTrellisArgs('s', { ...SPEC, decimationTarget: 40000, textureSize: 2048 }, 'r');
    expect(a[a.indexOf('--decimation-target') + 1]).toBe('40000');
    expect(a[a.indexOf('--texture-size') + 1]).toBe('2048');
  });

  it('translates only the Windows-side paths in wsl mode', () => {
    const a = buildTrellisArgs('C:/pof/s.py', { imagePath: 'C:/pof/in.png', outputPath: 'C:/pof/out.glb' }, '/home/u/TRELLIS.2', true);
    expect(a[0]).toBe('/mnt/c/pof/s.py');
    expect(a[a.indexOf('--image') + 1]).toBe('/mnt/c/pof/in.png');
    expect(a[a.indexOf('--trellis-root') + 1]).toBe('/home/u/TRELLIS.2');
  });
});

describe('parseTrellisOutput', () => {
  it('parses DONE + verts/faces/vram/bake/preview markers', () => {
    const out = [
      'POF_T2_LOAD_S=44', 'noise', 'POF_T2_GEN_S=31.2', 'POF_T2_VRAM_GB=21.4',
      'POF_T2_BAKE_S=18.5', 'POF_T2_VERTS=20001', 'POF_T2_FACES=40000',
      'POF_T2_PREVIEW=out/mesh.preview.png', 'POF_T2_DONE=out/mesh.glb',
    ].join('\n');
    const r = parseTrellisOutput(out);
    expect(r.ok).toBe(true);
    expect(r.meshPath).toBe('out/mesh.glb');
    expect(r.faces).toBe(40000);
    expect(r.vramGb).toBeCloseTo(21.4);
    expect(r.bakeSeconds).toBeCloseTo(18.5);
    expect(r.previewPath).toBe('out/mesh.preview.png');
  });

  it('reports ok=false + error when the script raised', () => {
    const r = parseTrellisOutput("Traceback...\nPOF_T2_ERROR=OutOfMemoryError('CUDA oom')");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/oom/i);
  });
});

describe('runTrellis (orchestration, deps-seam)', () => {
  it('runs the venv python, parses markers, confirms the mesh file', async () => {
    const run = async (_cmd: string, args: string[]) => {
      const out = args[args.indexOf('--output') + 1];
      return { stdout: `POF_T2_FACES=40000\nPOF_T2_VRAM_GB=21.4\nPOF_T2_DONE=${out}`, code: 0 };
    };
    const res = await runTrellis(SPEC, { run, fileExists: () => true, env: ENV, now: () => 1 });
    expect(res.ok).toBe(true);
    expect(res.meshPath).toBe('out/mesh.glb');
    expect(res.faces).toBe(40000);
  });

  it('spawns through wsl.exe and maps the produced path back to Windows', async () => {
    const seen: { cmd: string; args: string[] }[] = [];
    const run = async (cmd: string, args: string[]) => {
      seen.push({ cmd, args });
      return { stdout: 'POF_T2_DONE=/mnt/c/pof/out.glb', code: 0 };
    };
    const res = await runTrellis(
      { imagePath: 'C:/pof/in.png', outputPath: 'C:/pof/out.glb', scriptPath: 'C:/pof/s.py' },
      { run, fileExists: () => true, env: { ...ENV, POF_TRELLIS_WSL: 'Ubuntu' }, now: () => 1 },
    );
    expect(seen[0].cmd).toBe('wsl.exe');
    expect(seen[0].args.slice(0, 4)).toEqual(['-d', 'Ubuntu', '--', '/home/u/t2env/bin/python']);
    expect(res.ok).toBe(true);
    // Reported as a WSL path, handed back to PoF as a Windows one.
    expect(res.meshPath).toBe('C:/pof/out.glb');
  });

  it('errors when POF_TRELLIS_ROOT is unset', async () => {
    const res = await runTrellis(SPEC, { run: async () => ({ stdout: '', code: 0 }), env: { POF_TRELLIS_VENV: 'py' } });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/POF_TRELLIS_ROOT/);
  });

  it('errors when POF_TRELLIS_VENV is unset', async () => {
    const res = await runTrellis(SPEC, { run: async () => ({ stdout: '', code: 0 }), env: { POF_TRELLIS_ROOT: 'r' } });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/POF_TRELLIS_VENV/);
  });

  it('fails when the script claims done but no mesh file exists', async () => {
    const run = async () => ({ stdout: 'POF_T2_DONE=out/mesh.glb', code: 0 });
    const fileExists = (p: string) => !p.endsWith('mesh.glb');
    const res = await runTrellis(SPEC, { run, fileExists, env: ENV });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/mesh file/i);
  });
});

describe('trellis budget wiring', () => {
  it('derives the generator face limit from the asset class', () => {
    expect(trellisFaceLimit({ ...SPEC, assetClass: 'character' })).toBe(40_000);
    expect(trellisFaceLimit({ ...SPEC, assetClass: 'weapon' })).toBe(15_000);
  });

  it('lets an explicit decimationTarget win over the class', () => {
    expect(trellisFaceLimit({ ...SPEC, assetClass: 'character', decimationTarget: 9 })).toBe(9);
  });

  it('sends no budget for an unknown class', () => {
    expect(trellisFaceLimit({ ...SPEC })).toBeUndefined();
  });

  /** The invariant `localCritiqueDeps` protects: never grade against a budget that was
   *  not actually sent. TRELLIS.2 may attach one ONLY because it really sends it. */
  it('attaches a budget grade iff a limit was actually sent', () => {
    expect(trellisGateDeps('character', undefined, 40_000).deps.budget).toEqual({
      triangleBudget: 40_000, topology: 'triangles',
    });
    expect(trellisGateDeps('character', undefined, undefined).deps.budget).toBeUndefined();
  });
});

describe('attention backend passthrough', () => {
  it('omits the flag by default and forwards it when pinned', () => {
    expect(buildTrellisArgs('s', SPEC, 'r')).not.toContain('--attn-backend');
    const a = buildTrellisArgs('s', { ...SPEC, attnBackend: 'xformers' }, 'r');
    expect(a[a.indexOf('--attn-backend') + 1]).toBe('xformers');
  });
});

describe('HF_TOKEN forwarding (the gated DINOv3 dependency)', () => {
  /** TRELLIS.2 conditions on the GATED facebook/dinov3-* repo, so an unauthenticated run
   *  dies at pipeline load with a 401. A Windows env var does not cross into a distro
   *  unless WSLENV names it. */
  it('declares HF_TOKEN in WSLENV without duplicating an existing entry', () => {
    expect(withWslenv(undefined, 'HF_TOKEN')).toBe('HF_TOKEN/u');
    expect(withWslenv('FOO/p', 'HF_TOKEN')).toBe('FOO/p:HF_TOKEN/u');
    expect(withWslenv('HF_TOKEN/u', 'HF_TOKEN')).toBe('HF_TOKEN/u');
  });

  it('passes the token through the env overlay, never through argv', async () => {
    let seenArgs: string[] = [];
    let seenEnv: Record<string, string | undefined> | undefined;
    const run = async (_c: string, a: string[], _t: number, e?: Record<string, string | undefined>) => {
      seenArgs = a; seenEnv = e;
      return { stdout: 'POF_T2_DONE=/mnt/c/pof/out.glb', code: 0 };
    };
    await runTrellis(
      { imagePath: 'C:/pof/in.png', outputPath: 'C:/pof/out.glb', scriptPath: 'C:/pof/s.py' },
      { run, fileExists: () => true, now: () => 1,
        env: { ...ENV, POF_TRELLIS_WSL: 'Ubuntu', HF_TOKEN: 'hf_secret' } },
    );
    expect(seenEnv?.HF_TOKEN).toBe('hf_secret');
    expect(seenEnv?.WSLENV).toContain('HF_TOKEN/u');
    expect(seenArgs.join(' ')).not.toContain('hf_secret');
  });

  it('sends no overlay when there is no token to forward', async () => {
    let seenEnv: Record<string, string | undefined> | undefined = { sentinel: 'x' };
    const run = async (_c: string, _a: string[], _t: number, e?: Record<string, string | undefined>) => {
      seenEnv = e; return { stdout: 'POF_T2_DONE=out/mesh.glb', code: 0 };
    };
    await runTrellis(SPEC, { run, fileExists: () => true, env: ENV, now: () => 1 });
    expect(seenEnv).toBeUndefined();
  });
});
