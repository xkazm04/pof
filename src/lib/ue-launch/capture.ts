/**
 * Autonomous rendered-frame capture for the L4 visual gate. Launches a headless
 * `-RenderOffScreen` editor and fires `AutomationLibrary.take_high_res_screenshot`
 * to an EXACT path via a python probe file — no operator, no live editor, no
 * :30040 bridge. Returns that exact path (deterministic). Proven live: a 439 KB
 * 1280×720 PNG in ~15s.
 *
 * Two hard-won constraints (each cost a failed live run):
 *  - Use the **file-based** `py exec(open(probe).read())` form (`buildPythonExecFile`),
 *    NOT inline `-ExecCmds=py …` (inline multi-statement / quoting is fragile).
 *  - Do NOT `load_map` — it breaks the async screenshot (no frame is ever written).
 *    The frame is therefore the generic editor view; meaningful per-level framing is
 *    a follow-up via the existing `-game -PoFScenario` Observation Spine.
 *
 * The pure builders are tested; the spawn is an injectable seam.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveEditorBinary } from './engines';
import { buildPythonExecFile } from './python';

/** Python probe that requests a high-res screenshot to an exact path. Pure. */
export function buildCaptureProbe(outPath: string, resX: number, resY: number): string {
  return [
    'import unreal',
    `unreal.AutomationLibrary.take_high_res_screenshot(${resX}, ${resY}, '${outPath}')`,
    "unreal.log('POF_CAPTURE_REQUESTED')",
    '',
  ].join('\n');
}

/** Editor launch args that run a capture probe file. Pure. */
export function buildCaptureArgs(o: { uproject: string; probePath: string }): string[] {
  return [
    o.uproject,
    '-RenderOffScreen', '-unattended', '-nopause', '-nosplash', '-NoLiveCoding',
    '-EnablePlugins=PythonScriptPlugin',
    `-ExecCmds=${buildPythonExecFile(o.probePath)}`,
  ];
}

type CaptureRun = (binary: string, args: string[], settleMs: number) => Promise<void>;

/** Spawn the windowed editor, let it render + write the screenshot for `settleMs`, then SIGKILL. */
const defaultRun: CaptureRun = (binary, args, settleMs) =>
  new Promise((resolve) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: 'ignore' });
    const done = () => {
      try { if (child.pid) execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* gone */ }
      try { execFileSync('taskkill', ['/IM', 'UnrealEditor.exe', '/F'], { stdio: 'ignore' }); } catch { /* none */ }
      resolve();
    };
    const timer = setTimeout(done, settleMs);
    child.on('error', () => { clearTimeout(timer); resolve(); });
  });

export interface CaptureFrameOptions {
  uproject: string;
  /** Engine version for the editor binary (default 5.8 via resolveEditorBinary). */
  engine?: string;
  resX?: number;
  resY?: number;
  /** How long to let the editor render before killing it. Default 25s. */
  settleMs?: number;
  /** Explicit PNG output path (default a temp file). */
  outPath?: string;
}

export interface CaptureDeps {
  run?: CaptureRun;
  now?: () => number;
}

/**
 * Capture one rendered frame. Returns the PNG path if it was written, else null
 * (capture failed / timed out — the L4 job stays deferred).
 */
export async function captureFrame(opts: CaptureFrameOptions, deps: CaptureDeps = {}): Promise<string | null> {
  const run = deps.run ?? defaultRun;
  const now = deps.now ?? (() => Date.now());
  const binary = resolveEditorBinary({ ...(opts.engine ? { engine: opts.engine } : {}), windowed: true });
  const resX = opts.resX ?? 1280;
  const resY = opts.resY ?? 720;
  const stamp = now();
  const outPath = (opts.outPath ?? join(tmpdir(), `pof_l4_${stamp}.png`)).replace(/\\/g, '/');
  const probePath = join(tmpdir(), `pof_l4_probe_${stamp}.py`).replace(/\\/g, '/');
  writeFileSync(probePath, buildCaptureProbe(outPath, resX, resY));
  try {
    await run(binary, buildCaptureArgs({ uproject: opts.uproject, probePath }), opts.settleMs ?? 25_000);
    return existsSync(outPath) ? outPath : null;
  } finally {
    try { unlinkSync(probePath); } catch { /* ignore */ }
  }
}
