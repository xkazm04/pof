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
import { existsSync, writeFileSync, unlinkSync, mkdirSync, readdirSync, statSync, readFileSync } from 'node:fs';
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

/** Spawn the editor; resolve when it self-exits (a `-game` scenario RequestExits when done)
 *  or after `settleMs` (the watchdog, for the non-exiting editor-probe case), then SIGKILL. */
const defaultRun: CaptureRun = (binary, args, settleMs) =>
  new Promise((resolve) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: 'ignore' });
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { if (child.pid) execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* gone */ }
      try { execFileSync('taskkill', ['/IM', 'UnrealEditor.exe', '/F'], { stdio: 'ignore' }); } catch { /* none */ }
      resolve();
    };
    timer = setTimeout(done, settleMs);
    // A `-game` scenario self-exits when it finishes — resolve early (with a small grace for the
    // final async screenshot to flush) instead of blocking the whole watchdog. The editor
    // screenshot probe does NOT self-exit, so it still falls through to settleMs.
    child.on('exit', () => setTimeout(done, 800));
    child.on('error', () => done());
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

// ── Scenario capture (per-level framing via the Observation Spine) ────────────
//
// Unlike the editor screenshot (generic empty view), a `-game -PoFScenario
// -RenderOffScreen` run loads the level + spawns the player, and the project's
// UScenarioController writes `shot_<NN>.png` (the on-screen viewport) into out_dir.
// In `-game` the map IS a working command-line arg (the editor's load_map is not).

/** A scenario input (structurally compatible with the gate-runner's GateScenarioInput,
 *  so a GateScenario can be passed straight in — ue-launch stays independent of it). */
export interface CaptureScenarioInput {
  key?: string;
  action?: string;
  value?: [number, number];
  event?: string;
  eventArg?: string;
  start: number;
  duration: number;
}

/** The subset of a gate scenario this capture needs (a GateScenario is assignable). */
export interface CaptureScenarioSpec {
  map?: string;
  totalSeconds?: number;
  numSamples?: number;
  settle?: number;
  inputs?: CaptureScenarioInput[];
  /** Destroy AI-possessed pawns at scenario start so combat can't interfere with the
   *  observed behavior (e.g. isolate locomotion — enemies otherwise stagger the player). */
  disableAI?: boolean;
}

/** Scenario inbox — capture-only (no inputs) or driving a per-gate action. Pure. */
export function buildScenarioInbox(
  outDir: string,
  opts: { totalSeconds?: number; numSamples?: number; settle?: number; inputs?: CaptureScenarioInput[]; disableAI?: boolean } = {},
): string {
  return JSON.stringify({
    out_dir: outDir,
    total_seconds: opts.totalSeconds ?? 3,
    num_samples: opts.numSamples ?? 1,
    settle: opts.settle ?? 1.5,
    ...(opts.disableAI ? { disable_ai: true } : {}),
    inputs: (opts.inputs ?? []).map((i) => ({
      ...(i.key ? { key: i.key } : {}),
      ...(i.action ? { action: i.action } : {}),
      ...(i.value ? { value: i.value } : {}),
      ...(i.event ? { event: i.event } : {}),
      ...(i.eventArg ? { event_arg: i.eventArg } : {}),
      start: i.start,
      duration: i.duration,
    })),
  }, null, 2);
}

/** Args for a `-game -PoFScenario -RenderOffScreen` capture run. Pure. Mirrors
 *  spawnExecutor.buildScenarioArgs but renders (no `-nullrhi`). */
export function buildScenarioArgs(o: { uproject: string; map: string; inboxPath: string; resX: number; resY: number }): string[] {
  return [
    o.uproject, o.map, '-game', `-PoFScenario=${o.inboxPath}`,
    '-RenderOffScreen', `-ResX=${o.resX}`, `-ResY=${o.resY}`,
    // Fixed timestep: deterministic frames + the Motion Quality Probe's accel metric is stable
    // (uncapped headless fps makes dt ~0.0006s and accel explodes). Proven live in P0.
    '-benchmark', '-fps=60',
    '-unattended', '-nopause', '-nosplash', '-NoLiveCoding',
  ];
}

/** Newest `shot_<NN>.png` in `dir` by mtime (ignores `frame_*` cams / non-png). Pure(+fs). */
export function newestShot(dir: string): string | null {
  let names: string[];
  try { names = readdirSync(dir); } catch { return null; }
  let best: { path: string; mtime: number } | null = null;
  for (const name of names) {
    if (!/^shot_\d+\.png$/i.test(name)) continue;
    const full = join(dir, name);
    let mtime: number;
    try { mtime = statSync(full).mtimeMs; } catch { continue; }
    if (!best || mtime > best.mtime) best = { path: full, mtime };
  }
  return best ? best.path : null;
}

/**
 * Pick the shot at the sample where the action is most active — first a
 * `montage_playing` sample, else max `anim_speed`, else the last — so a per-gate
 * action frame shows the peak (an ability's montage often finishes before the last
 * sample). Reads `observations.json` (sample idx ↔ `shot_<idx>.png`). Falls back to
 * `newestShot` (no observations / missing shot file). Pure(+fs).
 */
export function pickActionShot(dir: string): string | null {
  let obs: { samples?: Array<{ montage_playing?: boolean; anim_speed?: number }> };
  try { obs = JSON.parse(readFileSync(join(dir, 'observations.json'), 'utf-8')); } catch { return newestShot(dir); }
  const samples = obs?.samples ?? [];
  if (samples.length === 0) return newestShot(dir);
  let idx = samples.findIndex((s) => s.montage_playing === true);
  if (idx < 0) {
    let best = -1;
    samples.forEach((s, i) => { const a = s.anim_speed ?? 0; if (a > best) { best = a; idx = i; } });
    if (best <= 0) idx = samples.length - 1;
  }
  const shot = join(dir, `shot_${String(idx).padStart(2, '0')}.png`);
  return existsSync(shot) ? shot : newestShot(dir);
}

export interface CaptureScenarioFrameOptions {
  uproject: string;
  /** Map to load + render (default the vertical slice). A real `-game` arg. */
  map?: string;
  engine?: string;
  resX?: number;
  resY?: number;
  /** Watchdog for the scenario run. Default 180s. */
  settleMs?: number;
  /** Override the scenario out_dir (default a temp dir). */
  outDir?: string;
  /** A per-gate scenario to drive (action inputs + map + timing). Absent → generic
   *  spawn-and-settle. A gate-runner GateScenario is assignable. */
  scenario?: CaptureScenarioSpec;
}

/**
 * Capture a meaningful per-level frame via the Observation Spine. Returns the
 * newest `shot_<NN>.png`, or null if the scenario produced none.
 */
export async function captureScenarioFrame(opts: CaptureScenarioFrameOptions, deps: CaptureDeps = {}): Promise<string | null> {
  const run = deps.run ?? defaultRun;
  const now = deps.now ?? (() => Date.now());
  // The HEADLESS commandlet host (UnrealEditor-Cmd) — proven in P0 to render real shot_NN.png
  // under -RenderOffScreen. The windowed UnrealEditor.exe produced no frame in the drain path.
  const binary = resolveEditorBinary({ ...(opts.engine ? { engine: opts.engine } : {}), windowed: false });
  const scn = opts.scenario;
  // Caller-supplied map wins over the scenario's: L4 renders on a LIT map, while the
  // scenario's own map is L3-oriented (often dark/headless, e.g. TestHarness).
  const map = opts.map ?? scn?.map ?? '/Game/Maps/VerticalSlice';
  const resX = opts.resX ?? 1280;
  const resY = opts.resY ?? 720;
  const outDir = (opts.outDir ?? join(tmpdir(), `pof_l4_scn_${now()}`)).replace(/\\/g, '/');
  mkdirSync(outDir, { recursive: true });
  const inboxPath = join(outDir, 'inbox.json').replace(/\\/g, '/');
  writeFileSync(inboxPath, buildScenarioInbox(outDir, scn ? {
    totalSeconds: scn.totalSeconds,
    // ≥4 samples so a viewport screenshot is captured well BEFORE the final frame — the last
    // shot is requested in the same frame as RequestExit and never flushes (1 sample → no shot).
    numSamples: scn.numSamples ?? 4,
    settle: scn.settle,
    inputs: scn.inputs,
    disableAI: scn.disableAI,
  } : { numSamples: 4 }));
  await run(binary, buildScenarioArgs({ uproject: opts.uproject, map, inboxPath, resX, resY }), opts.settleMs ?? 180_000);
  // Pick the action-active sample's shot (falls back to newest for the generic case).
  return pickActionShot(outDir);
}
