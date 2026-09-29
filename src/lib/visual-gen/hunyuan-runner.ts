/**
 * Hunyuan3D runner — the OFFICIAL PoF image-to-3D generator. Drives
 * `scripts/visual-gen/pof_hunyuan.py` (Hunyuan3D-2 shape model,
 * Hunyuan3DDiTFlowMatchingPipeline, ~6GB VRAM) to turn a 2D image into a high-detail
 * mesh (~360K faces — an ~8x geometry jump over TripoSR). Shape only; texturing is a
 * separate step. Hunyuan3D is NON-COMMERCIAL — TripoSR (MIT) stays the commercial-safe
 * fallback behind the same interface.
 *
 * Same shape as the TripoSR runner: pure cores (args/parse) + an injectable spawn seam
 * so the orchestration is unit-tested without a GPU. The Hunyuan deps are co-installed
 * in the shared TripoSR venv, so the venv python defaults to POF_TRIPOSR_ROOT's unless
 * POF_HUNYUAN_VENV overrides; the hy3dgen package is located via POF_HUNYUAN_ROOT.
 */
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { processFailureReason, readMarker, runLocalProcess, type ProcessOutcome } from '@/lib/visual-gen/local-process';

export interface HunyuanSpec {
  imagePath: string;
  /** Full output mesh path; extension picks the format (.glb / .obj). */
  outputPath: string;
  /** Hunyuan3D checkout dir holding the `hy3dgen` package; else POF_HUNYUAN_ROOT. */
  hunyuanRoot?: string;
  /** Python with Hunyuan's deps; else POF_HUNYUAN_VENV, else the shared TripoSR venv. */
  venvPython?: string;
  /** Override the inference script path (default the repo-committed one). */
  scriptPath?: string;
  /** HF model id (default tencent/Hunyuan3D-2). */
  model?: string;
  timeoutMs?: number;
}

export interface HunyuanResult {
  ok: boolean;
  error?: string;
  meshPath?: string;
  verts?: number;
  faces?: number;
  /** Peak VRAM (GB) reported by the script. */
  vramGb?: number;
  /** Gray-shape preview render (for the critique tiers + UI). */
  previewPath?: string;
  durationMs: number;
}

/** Build the python argv. Pure. */
export function buildHunyuanArgs(scriptPath: string, spec: HunyuanSpec, root: string): string[] {
  const args = [
    scriptPath,
    '--image', spec.imagePath,
    '--output', spec.outputPath,
    '--hunyuan-root', root,
  ];
  if (spec.model) args.push('--model', spec.model);
  return args;
}

export interface ParsedHunyuan {
  ok: boolean;
  meshPath?: string;
  verts?: number;
  faces?: number;
  vramGb?: number;
  previewPath?: string;
  error?: string;
}

/** Parse the script's `POF_HY3D_*` stdout markers. Pure. */
export function parseHunyuanOutput(stdout: string): ParsedHunyuan {
  const get = (k: string): string | undefined => readMarker(stdout, k);
  const done = get('POF_HY3D_DONE');
  const error = get('POF_HY3D_ERROR');
  const verts = get('POF_HY3D_VERTS');
  const faces = get('POF_HY3D_FACES');
  const vram = get('POF_HY3D_VRAM_GB');
  return {
    ok: done !== undefined && error === undefined,
    meshPath: done,
    error,
    verts: verts ? Number(verts) : undefined,
    faces: faces ? Number(faces) : undefined,
    vramGb: vram ? Number(vram) : undefined,
    previewPath: get('POF_HY3D_PREVIEW'),
  };
}

type RunFn = (cmd: string, args: string[], timeoutMs: number) => Promise<ProcessOutcome>;

export interface HunyuanDeps {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  env?: Record<string, string | undefined>;
}

function err(message: string): HunyuanResult {
  return { ok: false, error: message, durationMs: 0 };
}

/** Run Hunyuan3D image->mesh and return the observed result. */
export async function runHunyuan(spec: HunyuanSpec, deps: HunyuanDeps = {}): Promise<HunyuanResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? defaultRun;

  const root = spec.hunyuanRoot ?? env.POF_HUNYUAN_ROOT;
  if (!root) return err('POF_HUNYUAN_ROOT not set (path to the Hunyuan3D checkout holding the hy3dgen package)');
  const py = spec.venvPython ?? env.POF_HUNYUAN_VENV
    ?? (env.POF_TRIPOSR_ROOT ? join(env.POF_TRIPOSR_ROOT, '.venv', 'Scripts', 'python.exe') : undefined);
  if (!py) return err('no Hunyuan venv python (set POF_HUNYUAN_VENV, or POF_TRIPOSR_ROOT for the shared venv)');
  if (!fileExists(py)) return err(`Hunyuan venv python not found at ${py}`);
  const script = spec.scriptPath ?? join(process.cwd(), 'scripts', 'visual-gen', 'pof_hunyuan.py');
  if (!fileExists(script)) return err(`pof_hunyuan.py not found at ${script}`);

  const args = buildHunyuanArgs(script, spec, root);
  const start = now();
  // Hunyuan is slower than TripoSR (model load + 31s flow-matching gen); the first run
  // also downloads the ~9GB model. Default to a generous 15-min ceiling.
  const timeoutMs = spec.timeoutMs ?? 900_000;
  const outcome = await run(py, args, timeoutMs);
  const parsed = parseHunyuanOutput(outcome.stdout);
  const meshPath = parsed.meshPath && fileExists(parsed.meshPath) ? parsed.meshPath : undefined;

  return {
    ok: parsed.ok && !!meshPath,
    // No marker at all → the process itself says why (timeout, crash, could not start).
    error: parsed.error ?? (parsed.ok
      ? (meshPath ? undefined : 'mesh file not written despite DONE marker')
      : processFailureReason(outcome, { tool: basename(script), timeoutMs })),
    meshPath,
    verts: parsed.verts,
    faces: parsed.faces,
    vramGb: parsed.vramGb,
    previewPath: parsed.previewPath,
    durationMs: now() - start,
  };
}

// ── default spawn seam: the shared local-process seam (tested in local-process.test.ts) ──
const defaultRun: RunFn = (cmd, args, timeoutMs) => runLocalProcess(cmd, args, { timeoutMs });
