import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCaptureProbe, buildCaptureArgs, captureFrame } from '@/lib/ue-launch/capture';

const tmps: string[] = [];
function tmp(): string { const d = mkdtempSync(join(tmpdir(), 'pof-cap-')); tmps.push(d); return d; }
afterEach(() => { for (const d of tmps.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ } } });

describe('buildCaptureProbe', () => {
  it('requests a high-res screenshot to the exact path', () => {
    const probe = buildCaptureProbe('C:/out/shot.png', 1280, 720);
    expect(probe).toContain('import unreal');
    expect(probe).toContain("take_high_res_screenshot(1280, 720, 'C:/out/shot.png')");
    expect(probe).not.toContain('load_map'); // load_map breaks the async capture
  });
});

describe('buildCaptureArgs', () => {
  it('runs the probe via the file-based exec form in a -RenderOffScreen editor', () => {
    const args = buildCaptureArgs({ uproject: 'C:/p/PoF.uproject', probePath: 'C:/t/probe.py' });
    expect(args[0]).toBe('C:/p/PoF.uproject');
    expect(args).toContain('-RenderOffScreen');
    expect(args).toContain('-EnablePlugins=PythonScriptPlugin');
    const exec = args.find((a) => a.startsWith('-ExecCmds='))!;
    expect(exec).toBe("-ExecCmds=py exec(open('C:/t/probe.py').read())"); // file-based, not inline
    expect(exec).not.toContain('-game');
  });
});

describe('captureFrame', () => {
  it('returns the exact (forward-slash) out path when the capture writes it', async () => {
    const out = join(tmp(), 'shot.png').replace(/\\/g, '/');
    const run = async (_bin: string, _args: string[]) => { writeFileSync(out, 'x'); };
    const res = await captureFrame({ uproject: 'C:/p/PoF.uproject', outPath: out, settleMs: 0 }, { run });
    expect(res).toBe(out);
  });

  it('returns null when no file is produced (capture failed / timed out)', async () => {
    const out = join(tmp(), 'missing.png').replace(/\\/g, '/');
    const run = async () => { /* produce nothing */ };
    const res = await captureFrame({ uproject: 'C:/p/PoF.uproject', outPath: out, settleMs: 0 }, { run });
    expect(res).toBeNull();
  });
});
