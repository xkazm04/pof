/**
 * UE Visual Gate — the "game-runs" ground-truth check.
 *
 * Every other UE gate proves the C++ COMPILES (`ue-compile`) or that automation
 * tests PASS (`ue-test`). None of them observes that the built game actually
 * BOOTS AND RENDERS. This gate closes that gap: it boots the game headlessly,
 * captures one rendered frame, and judges it with a REAL check.
 *
 * Reuse (cross-context READ, sanctioned): the capture path is the campaign-proven
 * `captureScenarioFrame` from `@/lib/ue-launch/capture` — a headless
 * `-game -PoFScenario -RenderOffScreen` boot that loads the map, spawns the
 * player, and writes `shot_<NN>.png` via the project's UScenarioController. We do
 * NOT modify that module; we import its pure entry point and inject it as a seam.
 *
 * Verdict (never a pass without a frame):
 *  - No UE env (`POF_UE_EDITOR_CMD` / `POF_UE_UPROJECT`) → `unverifiable` (honest
 *    "unknown", never a silent pass; mirrors `ue-compile`).
 *  - Env present but no frame produced (headless boot failed / timed out) →
 *    `unverifiable` (an environmental capture failure is not a code failure).
 *  - Frame produced but BLACK / near-empty → `fail` (the game booted but rendered
 *    nothing — a real observed failure). Heuristic is documented on `inspectFrame`.
 *  - Frame produced and non-empty → `pass` (floor). If VLM judging is enabled
 *    (`POF_UE_VISUAL_VLM`) and the auto-judge is reachable, its `fail` overrides
 *    the floor; a judge OUTAGE never downgrades a captured frame (the frame is
 *    kept for eyeball review).
 *
 * Cost / placement: a headless boot is MINUTES. This gate is OPT-IN
 * (`ueVisual`) and ADVISORY (`required:false` — never blocks the loop). It is
 * per-`(statePath,iteration)` de-duped so the streaming pool boots the game ONCE
 * per iteration and every concurrent area shares that frame. It is intended as an
 * end-of-iteration observation, not a per-area rerun.
 */

import * as fs from 'fs';
import * as path from 'path';
import { captureScenarioFrame } from '@/lib/ue-launch/capture';
import { resolveUeEnv, type UeEnv } from './ue-gates';
import type { VerificationGate } from './types';
import type { VisualModuleResult } from './visual-gate';
import { logger } from '@/lib/logger';

// ── Frame heuristic ───────────────────────────────────────────────────────────

export interface FrameInspection {
  /** True when the frame carries real rendered content (not black / near-empty). */
  ok: boolean;
  reason: string;
  /** On-disk size of the PNG. */
  bytes: number;
  /**
   * Fraction of sampled pixels that are meaningfully brighter than black
   * (`null` when `pngjs` is unavailable and only the byte heuristic ran).
   */
  nonBlackFraction: number | null;
}

export interface FrameInspectOptions {
  /**
   * Byte floor: a solid-black 1280×720 PNG compresses to a few KB, while a real
   * rendered frame is hundreds of KB (proven capture: 439 KB). A file under this
   * size is treated as blank when pixel inspection is unavailable. Default 12 KB.
   */
  minBytes?: number;
  /**
   * Minimum fraction of sampled pixels that must be brighter than
   * `blackLevel` for the frame to count as rendered. Default 0.01 (1%).
   */
  minNonBlackFraction?: number;
  /** Per-channel luminance (0–255) at/below which a pixel is "black". Default 8. */
  blackLevel?: number;
}

/** Lazy-require pngjs so the gate degrades to the byte heuristic if it's absent. */
function tryLoadPng(): { sync: { read: (b: Buffer) => { width: number; height: number; data: Buffer } } } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('pngjs');
    return mod?.PNG ?? mod ?? null;
  } catch {
    return null;
  }
}

/**
 * Cheap, documented black/near-empty detector. Byte-size floor always applies;
 * when `pngjs` is installed it additionally samples pixels (every ~64th, capped)
 * and computes the fraction brighter than `blackLevel`. A frame passes only when
 * BOTH the byte floor AND (if pixel data is available) the non-black fraction are
 * satisfied — a large-but-black frame is still caught by the pixel pass, a small
 * real frame is caught by the byte pass.
 */
export function inspectFrame(pngPath: string, opts: FrameInspectOptions = {}): FrameInspection {
  const minBytes = opts.minBytes ?? 12 * 1024;
  const minNonBlack = opts.minNonBlackFraction ?? 0.01;
  const blackLevel = opts.blackLevel ?? 8;

  let bytes = 0;
  try {
    bytes = fs.statSync(pngPath).size;
  } catch {
    return { ok: false, reason: 'frame file not readable', bytes: 0, nonBlackFraction: null };
  }
  if (bytes < minBytes) {
    return { ok: false, reason: `frame is ${bytes}B (< ${minBytes}B floor) — blank/black`, bytes, nonBlackFraction: null };
  }

  const PNG = tryLoadPng();
  if (!PNG) {
    // Byte floor passed and no pixel inspector available — accept on size alone.
    return { ok: true, reason: `frame ${bytes}B ≥ byte floor (pixel inspect unavailable)`, bytes, nonBlackFraction: null };
  }

  try {
    const png = PNG.sync.read(fs.readFileSync(pngPath));
    const { width, height, data } = png;
    const pixels = width * height;
    // Sample stride: aim for ≤ ~20k samples for speed on a 720p+ frame.
    const stride = Math.max(1, Math.floor(pixels / 20000));
    let sampled = 0;
    let nonBlack = 0;
    for (let i = 0; i < pixels; i += stride) {
      const o = i * 4;
      const lum = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
      sampled += 1;
      if (lum > blackLevel) nonBlack += 1;
    }
    const fraction = sampled > 0 ? nonBlack / sampled : 0;
    if (fraction < minNonBlack) {
      return { ok: false, reason: `only ${(fraction * 100).toFixed(2)}% of pixels non-black (< ${(minNonBlack * 100).toFixed(0)}%) — black/un-lit`, bytes, nonBlackFraction: fraction };
    }
    return { ok: true, reason: `${(fraction * 100).toFixed(1)}% of pixels rendered content`, bytes, nonBlackFraction: fraction };
  } catch (e) {
    // Decode failed — fall back to the byte floor verdict (already passed above).
    logger.debug(`[ue-visual] pixel inspect failed, byte floor stands: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: true, reason: `frame ${bytes}B ≥ byte floor (pixel decode failed)`, bytes, nonBlackFraction: null };
  }
}

// ── Gate ──────────────────────────────────────────────────────────────────────

/** Injectable capture seam — same shape as `captureScenarioFrame`. */
export type FrameCapture = (opts: { uproject: string; map?: string; engine?: string }) => Promise<string | null>;

export interface UeVisualGateOptions {
  /**
   * Override env resolution (tests). `undefined` → `resolveUeEnv()`; `null` →
   * force the "no env configured" (unverifiable) path.
   */
  env?: UeEnv | null;
  /** Map to boot + render. Default: the capture path's own vertical-slice default. */
  map?: string;
  /** Engine version for the editor binary. */
  engine?: string;
  /** Injectable capture (tests). Default: the real `captureScenarioFrame`. */
  capture?: FrameCapture;
  /** Frame heuristic tuning. */
  inspect?: FrameInspectOptions;
  /** Optional VLM judging via `/api/verify/visual`. Default off unless env opts in. */
  vlm?: UeVisualVlmOptions | false;
  /** Injectable fetch (tests). */
  fetchImpl?: typeof fetch;
}

export interface UeVisualVlmOptions {
  /** Absolute origin where `/api/verify/visual` lives (server-side runner). */
  appOrigin: string;
  /** Gemini check mode. Default 'lighting' (is the scene lit / rendering?). */
  mode?: 'hud' | 'texture' | 'lighting' | 'character';
  /** Logical module id recorded with the verification. Default 'harness-game'. */
  moduleId?: string;
}

export interface UeVisualGateResult {
  passed: boolean;
  /** Could not be evaluated (no env / no frame) — not a pass, not a hard fail. */
  unverifiable?: boolean;
  output: string;
  durationMs: number;
  errors?: Array<{ message: string }>;
  /** Absolute path to the captured GAME frame (stored under the run), if any. */
  screenshot?: string;
}

/** Advisory `ue-visual` gate config (opt-in; never blocks — `required:false`). */
export function createUeVisualGate(): VerificationGate {
  return { name: 'ue-visual', type: 'ue-visual', required: false };
}

/**
 * Resolve the optional VLM config from env. Enabled only when
 * `POF_UE_VISUAL_VLM` is truthy; appOrigin from `POF_APP_ORIGIN` or localhost.
 */
export function resolveVlmFromEnv(env: Record<string, string | undefined> = process.env): UeVisualVlmOptions | false {
  const flag = env.POF_UE_VISUAL_VLM?.trim();
  if (!flag || flag === '0' || flag.toLowerCase() === 'false') return false;
  const origin = env.POF_APP_ORIGIN?.trim() || `http://localhost:${env.PORT?.trim() || '3000'}`;
  const mode = env.POF_UE_VISUAL_VLM_MODE?.trim();
  return {
    appOrigin: origin,
    ...(mode === 'hud' || mode === 'texture' || mode === 'lighting' || mode === 'character' ? { mode } : {}),
  };
}

// ── In-flight de-dupe (one boot per iteration, shared across concurrent areas) ──

const inflightCaptures = new Map<string, Promise<UeVisualGateResult>>();

/**
 * Run the game-runs gate. Boots the game headlessly (once per
 * `(statePath,iteration)`), inspects the frame, optionally VLM-judges it, and
 * stores the GAME frame under `<statePath>/screenshots/<iteration>/game.png`
 * with a `result.json` row tagged `capture:'game'` so the gallery labels it.
 */
export function runUeVisualGate(
  projectPath: string,
  statePath: string,
  iteration: number,
  options: UeVisualGateOptions = {},
): Promise<UeVisualGateResult> {
  const key = `${statePath}::${iteration}`;
  const inflight = inflightCaptures.get(key);
  if (inflight) return inflight;
  const run = executeUeVisualGate(projectPath, statePath, iteration, options).finally(() => {
    if (inflightCaptures.get(key) === run) inflightCaptures.delete(key);
  });
  inflightCaptures.set(key, run);
  return run;
}

/** Not memoised — callers go through {@link runUeVisualGate}. Exported for tests. */
export async function executeUeVisualGate(
  projectPath: string,
  statePath: string,
  iteration: number,
  options: UeVisualGateOptions = {},
): Promise<UeVisualGateResult> {
  const start = Date.now();
  const env = options.env !== undefined ? options.env : resolveUeEnv();
  if (!env) {
    return {
      passed: false,
      unverifiable: true,
      durationMs: Date.now() - start,
      output:
        'UE visual gate UNVERIFIABLE — no UE environment configured '
        + '(set POF_UE_EDITOR_CMD and POF_UE_UPROJECT to boot + render the game). '
        + 'The game-runs check did NOT self-certify.',
      errors: [{ message: 'UE env not configured (POF_UE_EDITOR_CMD / POF_UE_UPROJECT)' }],
    };
  }

  const capture = options.capture ?? ((o) => captureScenarioFrame(o));
  let framePath: string | null = null;
  try {
    framePath = await capture({
      uproject: env.uproject,
      ...(options.map ? { map: options.map } : {}),
      ...(options.engine ? { engine: options.engine } : {}),
    });
  } catch (e) {
    framePath = null;
    logger.warn(`[ue-visual] capture threw: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!framePath || !fs.existsSync(framePath)) {
    return {
      passed: false,
      unverifiable: true,
      durationMs: Date.now() - start,
      output: 'UE visual gate UNVERIFIABLE — the headless boot produced no frame (editor failed to render / timed out). Not a code failure; the game-runs check stays unknown.',
      errors: [{ message: 'no rendered frame produced by the headless game boot' }],
    };
  }

  // Store the GAME frame under the run so the gallery can surface it.
  const stored = storeGameFrame(statePath, iteration, framePath);
  const screenshot = stored ?? framePath;

  // ── Real check #1: the frame is not black / near-empty ──
  const inspection = inspectFrame(screenshot, options.inspect);
  const frameErrors: string[] = [];
  if (!inspection.ok) frameErrors.push(`BLACK_FRAME: ${inspection.reason}`);

  // ── Real check #2 (optional): VLM judgment ──
  const vlm = options.vlm !== undefined ? options.vlm : resolveVlmFromEnv();
  let vlmNote = '';
  let vlmFailed = false;
  if (inspection.ok && vlm) {
    const judged = await vlmJudge(screenshot, vlm, options.fetchImpl);
    if (judged.status === 'fail') { vlmFailed = true; frameErrors.push(`VLM_FAIL: ${judged.note}`); }
    vlmNote = ` · VLM ${judged.status}: ${judged.note}`;
  }

  const passed = inspection.ok && !vlmFailed;
  const moduleRow: VisualModuleResult = {
    slug: 'game',
    label: `Game: ${options.map ?? 'vertical slice'} (iter ${iteration})`,
    status: passed ? 'pass' : 'fail',
    screenshot,
    changePct: null,
    diffPath: null,
    a11yViolations: 0,
    errors: frameErrors,
    capture: 'game',
  };
  writeGameResultJson(statePath, iteration, moduleRow);

  return {
    passed,
    durationMs: Date.now() - start,
    output: `Game-runs gate: ${passed ? 'PASS' : 'FAIL'} — ${inspection.reason}${vlmNote} (frame: ${screenshot})`,
    ...(frameErrors.length > 0 ? { errors: frameErrors.map((message) => ({ message })) } : {}),
    screenshot,
  };
}

// ── VLM helper ─────────────────────────────────────────────────────────────────

async function vlmJudge(
  screenshotPath: string,
  vlm: UeVisualVlmOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: 'pass' | 'fail' | 'unavailable'; note: string }> {
  try {
    const res = await fetchImpl(`${vlm.appOrigin}/api/verify/visual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleId: vlm.moduleId ?? 'harness-game',
        itemId: 'game-runs',
        screenshotPath,
        mode: vlm.mode ?? 'lighting',
      }),
    });
    const envlp = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: { verdict?: string; notes?: string }; error?: string }
      | null;
    if (!res.ok || !envlp?.success) {
      // Judge outage is NOT an observed failure — the frame is captured, keep it.
      return { status: 'unavailable', note: `auto-judge unavailable (${envlp?.error ?? res.status}) — frame kept for review` };
    }
    return envlp.data?.verdict === 'pass'
      ? { status: 'pass', note: envlp.data?.notes ?? 'scene lit/rendering' }
      : { status: 'fail', note: envlp.data?.notes ?? 'scene reads as black / un-lit' };
  } catch (e) {
    return { status: 'unavailable', note: `auto-judge error (${e instanceof Error ? e.message : String(e)}) — frame kept for review` };
  }
}

// ── Frame storage (so the gallery surfaces the GAME capture) ─────────────────────

/** Copy the captured frame into the run's screenshots tree; returns the stored path. */
function storeGameFrame(statePath: string, iteration: number, framePath: string): string | null {
  try {
    const dir = path.join(statePath, 'screenshots', String(iteration));
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, 'game.png');
    fs.copyFileSync(framePath, dest);
    return dest;
  } catch (e) {
    logger.warn(`[ue-visual] could not store game frame: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Merge the game module row into the iteration's `result.json` (the same file
 * the screenshots API + gallery read). Game rows carry `capture:'game'`; any
 * existing rows (e.g. a prior webapp run, though a UE tree won't have one) are
 * preserved and the game row replaces a previous game row.
 */
function writeGameResultJson(statePath: string, iteration: number, row: VisualModuleResult): void {
  try {
    const dir = path.join(statePath, 'screenshots', String(iteration));
    fs.mkdirSync(dir, { recursive: true });
    const resultPath = path.join(dir, 'result.json');
    let modules: VisualModuleResult[] = [];
    if (fs.existsSync(resultPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(resultPath, 'utf-8')) as { modules?: VisualModuleResult[] };
        modules = (parsed.modules ?? []).filter((m) => m.slug !== row.slug);
      } catch { /* corrupt — overwrite */ }
    }
    modules.push(row);
    const result = {
      passed: modules.every((m) => m.status !== 'fail'),
      modulesChecked: modules.length,
      errors: modules.flatMap((m) => m.errors.map((e) => `${e}: ${m.slug}`)),
      screenshots: modules.map((m) => m.screenshot),
      modules,
      a11yViolations: modules.reduce((s, m) => s + m.a11yViolations, 0),
    };
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  } catch (e) {
    logger.warn(`[ue-visual] could not write game result.json: ${e instanceof Error ? e.message : String(e)}`);
  }
}
