import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCaptureProbe, buildCaptureArgs, captureFrame, buildScenarioInbox, buildScenarioArgs, newestShot, captureScenarioFrame } from '@/lib/ue-launch/capture';

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

describe('buildScenarioInbox', () => {
  it('writes a capture-only inbox with the required out_dir and no inputs', () => {
    const inbox = JSON.parse(buildScenarioInbox('C:/t/out'));
    expect(inbox.out_dir).toBe('C:/t/out');
    expect(inbox.inputs).toEqual([]);
    expect(inbox.num_samples).toBeGreaterThanOrEqual(1);
    expect(typeof inbox.total_seconds).toBe('number');
  });
});

describe('buildScenarioArgs', () => {
  it('builds a -game -PoFScenario -RenderOffScreen invocation (NOT -nullrhi)', () => {
    const args = buildScenarioArgs({ uproject: 'C:/p/PoF.uproject', map: '/Game/Maps/VerticalSlice', inboxPath: 'C:/t/out/inbox.json', resX: 1280, resY: 720 });
    expect(args[0]).toBe('C:/p/PoF.uproject');
    expect(args[1]).toBe('/Game/Maps/VerticalSlice');
    expect(args).toContain('-game');
    expect(args).toContain('-RenderOffScreen');
    expect(args).toContain('-PoFScenario=C:/t/out/inbox.json');
    expect(args).not.toContain('-nullrhi'); // L4 must render
  });
});

describe('newestShot', () => {
  it('returns the newest shot_*.png, ignoring frame_*/non-png', () => {
    const d = tmp();
    writeFileSync(join(d, 'shot_00.png'), 'a'); utimesSync(join(d, 'shot_00.png'), 1000, 1000);
    writeFileSync(join(d, 'shot_01.png'), 'b'); utimesSync(join(d, 'shot_01.png'), 2000, 2000);
    writeFileSync(join(d, 'frame_05.png'), 'c'); utimesSync(join(d, 'frame_05.png'), 3000, 3000);
    expect(newestShot(d)).toBe(join(d, 'shot_01.png'));
  });

  it('returns null when there is no shot (or the dir is missing)', () => {
    expect(newestShot(tmp())).toBeNull();
    expect(newestShot(join(tmp(), 'nope'))).toBeNull();
  });
});

describe('captureScenarioFrame', () => {
  it('writes the inbox, runs the scenario, and returns the newest shot', async () => {
    const outDir = tmp();
    const run = async (_bin: string, _args: string[]) => { writeFileSync(join(outDir, 'shot_00.png'), 'x'); };
    const res = await captureScenarioFrame({ uproject: 'C:/p/PoF.uproject', outDir, settleMs: 0 }, { run });
    expect(res).toBe(join(outDir, 'shot_00.png'));
  });

  it('returns null when the scenario produces no shot', async () => {
    const outDir = tmp();
    const run = async () => { /* nothing */ };
    const res = await captureScenarioFrame({ uproject: 'C:/p/PoF.uproject', outDir, settleMs: 0 }, { run });
    expect(res).toBeNull();
  });
});
