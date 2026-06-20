import { describe, it, expect } from 'vitest';
import { buildHunyuanArgs, parseHunyuanOutput, runHunyuan } from '@/lib/visual-gen/hunyuan-runner';

const SPEC = { imagePath: 'in.png', outputPath: 'out/mesh.glb' };
const ENV = { POF_HUNYUAN_ROOT: 'C:/hunyuan3d', POF_HUNYUAN_VENV: 'C:/triposr/.venv/Scripts/python.exe' };

describe('buildHunyuanArgs', () => {
  it('passes image, output, hunyuan-root', () => {
    const a = buildHunyuanArgs('pof_hunyuan.py', SPEC, 'C:/hunyuan3d');
    expect(a).toEqual(expect.arrayContaining(['--image', 'in.png', '--output', 'out/mesh.glb', '--hunyuan-root', 'C:/hunyuan3d']));
    expect(a[0]).toBe('pof_hunyuan.py');
  });

  it('adds --model only when provided', () => {
    expect(buildHunyuanArgs('s', SPEC, 'r')).not.toContain('--model');
    expect(buildHunyuanArgs('s', { ...SPEC, model: 'tencent/Hunyuan3D-2mini' }, 'r')).toContain('tencent/Hunyuan3D-2mini');
  });
});

describe('parseHunyuanOutput', () => {
  it('parses DONE + verts/faces/vram/preview markers', () => {
    const out = 'POF_HY3D_LOAD_S=60\nlog noise\nPOF_HY3D_VERTS=180007\nPOF_HY3D_FACES=360086\nPOF_HY3D_VRAM_GB=6.0\nPOF_HY3D_PREVIEW=out/mesh.preview.png\nPOF_HY3D_DONE=out/mesh.glb';
    const r = parseHunyuanOutput(out);
    expect(r.ok).toBe(true);
    expect(r.meshPath).toBe('out/mesh.glb');
    expect(r.verts).toBe(180007);
    expect(r.faces).toBe(360086);
    expect(r.vramGb).toBeCloseTo(6.0);
    expect(r.previewPath).toBe('out/mesh.preview.png');
  });

  it('reports ok=false + error when the script raised', () => {
    const r = parseHunyuanOutput("Traceback...\nPOF_HY3D_ERROR=RuntimeError('CUDA oom')");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/CUDA oom/);
  });
});

describe('runHunyuan (orchestration, deps-seam)', () => {
  it('runs the venv python, parses markers, and confirms the mesh file', async () => {
    const run = async (_cmd: string, args: string[]) => {
      const out = args[args.indexOf('--output') + 1];
      return { stdout: `POF_HY3D_VERTS=9\nPOF_HY3D_FACES=12\nPOF_HY3D_VRAM_GB=6.0\nPOF_HY3D_DONE=${out}`, code: 0 };
    };
    const res = await runHunyuan(SPEC, { run, fileExists: () => true, env: ENV, now: () => 1 });
    expect(res.ok).toBe(true);
    expect(res.meshPath).toBe('out/mesh.glb');
    expect(res.faces).toBe(12);
    expect(res.vramGb).toBeCloseTo(6.0);
  });

  it('errors when POF_HUNYUAN_ROOT is unset', async () => {
    const res = await runHunyuan(SPEC, { run: async () => ({ stdout: '', code: 0 }), env: { POF_HUNYUAN_VENV: 'py' } });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/POF_HUNYUAN_ROOT/);
  });

  it('falls back to the shared TripoSR venv python when POF_HUNYUAN_VENV is unset', async () => {
    const seen: string[] = [];
    const run = async (cmd: string) => { seen.push(cmd); return { stdout: 'POF_HY3D_DONE=out/mesh.glb', code: 0 }; };
    const res = await runHunyuan(SPEC, { run, fileExists: () => true, env: { POF_HUNYUAN_ROOT: 'C:/hunyuan3d', POF_TRIPOSR_ROOT: 'C:/triposr' }, now: () => 1 });
    expect(res.ok).toBe(true);
    expect(seen[0]).toMatch(/triposr[\\/]\.venv/i);
  });

  it('errors when the venv python is missing', async () => {
    const res = await runHunyuan(SPEC, { run: async () => ({ stdout: '', code: 0 }), fileExists: () => false, env: ENV });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/python not found/);
  });

  it('fails when the script claims done but no mesh file exists', async () => {
    const run = async () => ({ stdout: 'POF_HY3D_DONE=out/mesh.glb', code: 0 });
    const fileExists = (p: string) => !p.endsWith('mesh.glb');
    const res = await runHunyuan(SPEC, { run, fileExists, env: ENV });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/mesh file/i);
  });
});
