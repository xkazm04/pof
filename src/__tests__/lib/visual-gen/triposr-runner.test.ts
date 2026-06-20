import { describe, it, expect } from 'vitest';
import { buildTriposrArgs, parseTriposrOutput, runTriposr, parseImageDataUrl } from '@/lib/visual-gen/triposr-runner';

const SPEC = { imagePath: 'in.png', outputPath: 'out/mesh.glb' };
const ENV = { POF_TRIPOSR_ROOT: 'C:/triposr' };

describe('buildTriposrArgs', () => {
  it('passes image, output, root, device + mc-resolution', () => {
    const a = buildTriposrArgs('pof_triposr.py', SPEC, 'C:/triposr');
    expect(a).toEqual(expect.arrayContaining(['--image', 'in.png', '--output', 'out/mesh.glb', '--triposr-root', 'C:/triposr', '--mc-resolution', '256']));
    expect(a[0]).toBe('pof_triposr.py');
  });

  it('adds --no-remove-bg only when removeBg is false', () => {
    expect(buildTriposrArgs('s', SPEC, 'r')).not.toContain('--no-remove-bg');
    expect(buildTriposrArgs('s', { ...SPEC, removeBg: false }, 'r')).toContain('--no-remove-bg');
  });

  it('adds --fidelity only when fidelity is requested', () => {
    expect(buildTriposrArgs('s', SPEC, 'r')).not.toContain('--fidelity');
    expect(buildTriposrArgs('s', { ...SPEC, fidelity: true }, 'r')).toContain('--fidelity');
  });
});

describe('parseTriposrOutput', () => {
  it('parses DONE + verts/faces/device markers', () => {
    const out = 'POF_TRIPOSR_DEVICE=cuda:0\nlog noise\nPOF_TRIPOSR_VERTS=12000\nPOF_TRIPOSR_FACES=24000\nPOF_TRIPOSR_DONE=out/mesh.glb';
    const r = parseTriposrOutput(out);
    expect(r.ok).toBe(true);
    expect(r.meshPath).toBe('out/mesh.glb');
    expect(r.verts).toBe(12000);
    expect(r.faces).toBe(24000);
    expect(r.device).toBe('cuda:0');
  });

  it('reports ok=false + error when the script raised', () => {
    const r = parseTriposrOutput("Traceback...\nPOF_TRIPOSR_ERROR=RuntimeError('CUDA oom')");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/CUDA oom/);
  });

  it('parses the fidelity markers (CLIP max/mean + preview)', () => {
    const out = 'POF_TRIPOSR_CLIP_MAX=0.8120\nPOF_TRIPOSR_CLIP_MEAN=0.7010\nPOF_TRIPOSR_PREVIEW=out/chair.preview.png\nPOF_TRIPOSR_DONE=out/chair.glb';
    const r = parseTriposrOutput(out);
    expect(r.clipMax).toBeCloseTo(0.812);
    expect(r.clipMean).toBeCloseTo(0.701);
    expect(r.previewPath).toBe('out/chair.preview.png');
  });
});

describe('parseImageDataUrl', () => {
  it('decodes a png data URL to ext + bytes', () => {
    const png = Buffer.from('hello').toString('base64');
    const r = parseImageDataUrl(`data:image/png;base64,${png}`);
    expect(r?.ext).toBe('png');
    expect(r?.buffer.toString()).toBe('hello');
  });
  it('normalizes jpeg → jpg and rejects non-image URLs', () => {
    expect(parseImageDataUrl('data:image/jpeg;base64,' + Buffer.from('x').toString('base64'))?.ext).toBe('jpg');
    expect(parseImageDataUrl('https://example.com/x.png')).toBeNull();
    expect(parseImageDataUrl('data:text/plain;base64,aGk=')).toBeNull();
  });
});

describe('runTriposr (orchestration, deps-seam)', () => {
  it('runs the venv python, parses markers, and confirms the mesh file', async () => {
    const run = async (_cmd: string, args: string[]) => {
      const out = args[args.indexOf('--output') + 1];
      return { stdout: `POF_TRIPOSR_DEVICE=cuda:0\nPOF_TRIPOSR_VERTS=9\nPOF_TRIPOSR_FACES=12\nPOF_TRIPOSR_DONE=${out}`, code: 0 };
    };
    const res = await runTriposr(SPEC, { run, fileExists: () => true, env: ENV, now: () => 1 });
    expect(res.ok).toBe(true);
    expect(res.meshPath).toBe('out/mesh.glb');
    expect(res.verts).toBe(9);
    expect(res.device).toBe('cuda:0');
  });

  it('errors when POF_TRIPOSR_ROOT is unset', async () => {
    const res = await runTriposr(SPEC, { run: async () => ({ stdout: '', code: 0 }), env: {} });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/POF_TRIPOSR_ROOT/);
  });

  it('errors when the venv python is missing', async () => {
    const res = await runTriposr(SPEC, { run: async () => ({ stdout: '', code: 0 }), fileExists: () => false, env: ENV });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/venv python not found/);
  });

  it('fails when the script claims done but no mesh file exists', async () => {
    const run = async () => ({ stdout: 'POF_TRIPOSR_DONE=out/mesh.glb', code: 0 });
    // fileExists: python yes, script yes, mesh no
    const fileExists = (p: string) => !p.endsWith('mesh.glb');
    const res = await runTriposr(SPEC, { run, fileExists, env: ENV });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/mesh file/i);
  });
});
