/**
 * TripoSR runner — the first real generator in the zero-budget local 3D pipeline.
 * Drives `scripts/visual-gen/pof_triposr.py` through the TripoSR venv python to turn
 * a 2D image into a mesh (.obj/.glb) on the GPU. Output quality is intentionally
 * low (open-source TripoSR); the point is a proven end-to-end seam so a cloud
 * provider (Tripo/Meshy/Rodin) can slot in later behind the same interface.
 *
 * Same shape as the Experiment Lab runner: pure cores (args/parse) + an injectable
 * spawn seam so the orchestration is unit-tested without a GPU.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface TriposrSpec {
  imagePath: string;
  /** Full output mesh path; extension picks the format (.obj / .glb). */
  outputPath: string;
  device?: string;
  mcResolution?: number;
  /** Remove the image background before inference (default true). */
  removeBg?: boolean;
  /** Render NeRF views + CLIP-compare to the input image (Tier-2 fidelity). */
  fidelity?: boolean;
  /** Foreground framing ratio (how much of the frame the object fills) — a free lever
   *  for best-of-N param sweeps (the model output changes with it). */
  foregroundRatio?: number;
  /** TripoSR checkout dir (the one holding `tsr/` + `.venv/`); else POF_TRIPOSR_ROOT. */
  triposrRoot?: string;
  /** Override the venv python; else `<root>/.venv/Scripts/python.exe`. */
  venvPython?: string;
  /** Override the inference script path (default the repo-committed one). */
  scriptPath?: string;
  timeoutMs?: number;
}

export interface TriposrResult {
  ok: boolean;
  error?: string;
  meshPath?: string;
  verts?: number;
  faces?: number;
  device?: string;
  /** Tier-2 fidelity (when spec.fidelity): max/mean CLIP cosine of rendered views vs input. */
  clipMax?: number;
  clipMean?: number;
  previewPath?: string;
  durationMs: number;
}

/** Decode a `data:image/...;base64,` URL (how the browser uploads the reference image)
 * into a file extension + bytes the server can write to disk. Returns null if not a
 * supported image data URL. Pure. */
export function parseImageDataUrl(dataUrl: string): { ext: string; buffer: Buffer } | null {
  const m = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  return { ext, buffer: Buffer.from(m[2], 'base64') };
}

/** Build the python argv. Pure. */
export function buildTriposrArgs(scriptPath: string, spec: TriposrSpec, root: string): string[] {
  const args = [
    scriptPath,
    '--image', spec.imagePath,
    '--output', spec.outputPath,
    '--triposr-root', root,
    '--device', spec.device ?? 'cuda:0',
    '--mc-resolution', String(spec.mcResolution ?? 256),
  ];
  if (spec.removeBg === false) args.push('--no-remove-bg');
  if (spec.fidelity) args.push('--fidelity');
  if (spec.foregroundRatio !== undefined) args.push('--foreground-ratio', String(spec.foregroundRatio));
  return args;
}

export interface ParsedTriposr {
  ok: boolean;
  meshPath?: string;
  verts?: number;
  faces?: number;
  device?: string;
  clipMax?: number;
  clipMean?: number;
  previewPath?: string;
  error?: string;
}

/** Parse the script's `POF_TRIPOSR_*` stdout markers. Pure. */
export function parseTriposrOutput(stdout: string): ParsedTriposr {
  const get = (k: string): string | undefined => {
    const m = stdout.match(new RegExp(`^${k}=(.*)$`, 'm'));
    return m ? m[1].trim() : undefined;
  };
  const done = get('POF_TRIPOSR_DONE');
  const error = get('POF_TRIPOSR_ERROR');
  const verts = get('POF_TRIPOSR_VERTS');
  const faces = get('POF_TRIPOSR_FACES');
  const clipMax = get('POF_TRIPOSR_CLIP_MAX');
  const clipMean = get('POF_TRIPOSR_CLIP_MEAN');
  return {
    ok: done !== undefined && error === undefined,
    meshPath: done,
    error,
    verts: verts ? Number(verts) : undefined,
    faces: faces ? Number(faces) : undefined,
    device: get('POF_TRIPOSR_DEVICE'),
    clipMax: clipMax ? Number(clipMax) : undefined,
    clipMean: clipMean ? Number(clipMean) : undefined,
    previewPath: get('POF_TRIPOSR_PREVIEW'),
  };
}

type RunFn = (cmd: string, args: string[], timeoutMs: number) => Promise<{ stdout: string; code: number | null }>;

export interface TriposrDeps {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  env?: Record<string, string | undefined>;
}

function err(message: string): TriposrResult {
  return { ok: false, error: message, durationMs: 0 };
}

/** Run TripoSR image->mesh and return the observed result. */
export async function runTriposr(spec: TriposrSpec, deps: TriposrDeps = {}): Promise<TriposrResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? defaultRun;

  const root = spec.triposrRoot ?? env.POF_TRIPOSR_ROOT;
  if (!root) return err('POF_TRIPOSR_ROOT not set (path to the TripoSR checkout with tsr/ + .venv/)');
  const py = spec.venvPython ?? join(root, '.venv', 'Scripts', 'python.exe');
  if (!fileExists(py)) return err(`TripoSR venv python not found at ${py} (create the venv + install deps)`);
  const script = spec.scriptPath ?? join(process.cwd(), 'scripts', 'visual-gen', 'pof_triposr.py');
  if (!fileExists(script)) return err(`pof_triposr.py not found at ${script}`);

  const args = buildTriposrArgs(script, spec, root);
  const start = now();
  const { stdout } = await run(py, args, spec.timeoutMs ?? 300_000);
  const parsed = parseTriposrOutput(stdout);
  const meshPath = parsed.meshPath && fileExists(parsed.meshPath) ? parsed.meshPath : undefined;

  return {
    ok: parsed.ok && !!meshPath,
    error: parsed.error ?? (parsed.ok && !meshPath ? 'mesh file not written despite DONE marker' : undefined),
    meshPath,
    verts: parsed.verts,
    faces: parsed.faces,
    device: parsed.device,
    clipMax: parsed.clipMax,
    clipMean: parsed.clipMean,
    previewPath: parsed.previewPath,
    durationMs: now() - start,
  };
}

// ── default spawn seam (not unit-tested; exercised by the live smoke run) ──────
const defaultRun: RunFn = async (cmd, args, timeoutMs) => {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stdout += d.toString(); });
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, timeoutMs);
    child.on('exit', (code) => { clearTimeout(timer); resolve({ stdout, code }); });
    child.on('error', () => { clearTimeout(timer); resolve({ stdout, code: null }); });
  });
};
