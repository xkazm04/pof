/**
 * TRELLIS.2 runner — the first PoF provider that emits GEOMETRY **AND** PBR TEXTURE in
 * one pass. Drives `scripts/visual-gen/pof_trellis.py` (Trellis2ImageTo3DPipeline,
 * microsoft/TRELLIS.2-4B). Two things make it structurally different from the Hunyuan /
 * TripoSR runners rather than just another entry:
 *
 *  1. **MIT licensed** (Microsoft) — Hunyuan3D is non-commercial and Tripo3D's free tier
 *     is CC BY 4.0, so this is the first commercial-safe HIGH-QUALITY local route.
 *     TripoSR is the only other MIT option and is explicitly the lower-detail fallback.
 *  2. **Native face budget.** `--decimation-target` is honoured by the generator's own
 *     export (o_voxel.postprocess.to_glb), so an asset class can STEER generation.
 *     Hunyuan3D emits ~360K faces and accepts no budget input, so its class only decides
 *     what the delivery is held to after the fact.
 *
 * ── The WSL seam ───────────────────────────────────────────────────────────────
 * TRELLIS.2 is Linux-only upstream ("currently tested only on Linux") and builds five
 * CUDA extensions (flash-attn, nvdiffrast, nvdiffrec, CuMesh, FlexGEMM, o-voxel), so on
 * a Windows workstation it runs inside WSL against the same GPU. Set POF_TRELLIS_WSL to
 * the distro name and the runner spawns `wsl.exe -d <distro> <python> <script> …`,
 * translating the paths PoF owns (image, output, script) across the OS boundary and
 * translating the produced mesh path back. Paths that already live inside WSL (the venv
 * python, the checkout root) pass through untouched — see {@link toWslPath}.
 *
 * Same shape as the Hunyuan runner otherwise: pure cores (args/parse/path) + an
 * injectable spawn seam, so the orchestration is unit-tested without a GPU.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface TrellisSpec {
  imagePath: string;
  /** Full output mesh path; `.glb` (the export is a textured glTF binary). */
  outputPath: string;
  /** TRELLIS.2 checkout dir holding the `trellis2` package; else POF_TRELLIS_ROOT. */
  trellisRoot?: string;
  /** Python with TRELLIS.2's deps; else POF_TRELLIS_VENV. */
  venvPython?: string;
  /** Override the inference script path (default the repo-committed one). */
  scriptPath?: string;
  /** HF model id (default microsoft/TRELLIS.2-4B). */
  model?: string;
  /** Native face budget handed to the generator's own export. */
  decimationTarget?: number;
  /** PBR texture resolution (default 4096). The first lever to drop when VRAM is tight. */
  textureSize?: number;
  /** WSL distro to run inside; else POF_TRELLIS_WSL. Absent ⇒ run the python directly. */
  wslDistro?: string;
  timeoutMs?: number;
}

export interface TrellisResult {
  ok: boolean;
  error?: string;
  meshPath?: string;
  verts?: number;
  faces?: number;
  /** Peak VRAM (GB) reported by the script. */
  vramGb?: number;
  /** Seconds spent in the texture bake / decimation export, reported separately from
   *  generation: it is the stage that OOMs first at 4096 and the one `textureSize`
   *  actually moves. */
  bakeSeconds?: number;
  /** PBR-lit preview render (for the critique tiers + UI). A textured mesh judged on a
   *  gray shape render would hide exactly what this provider adds. */
  previewPath?: string;
  durationMs: number;
}

/**
 * Translate a path across the WSL boundary. A Windows path (`C:\x`, `C:/x`) becomes
 * `/mnt/c/x`; anything already POSIX is returned unchanged, because the venv python and
 * the TRELLIS.2 checkout legitimately live INSIDE the distro and must not be rewritten.
 * Pure.
 */
export function toWslPath(p: string): string {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(p);
  if (!m) return p.replace(/\\/g, '/');
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}

/** Inverse of {@link toWslPath} for paths the script reports back. Pure. */
export function fromWslPath(p: string): string {
  const m = /^\/mnt\/([a-z])\/(.*)$/.exec(p);
  return m ? `${m[1].toUpperCase()}:/${m[2]}` : p;
}

/** Argv for the inference script (after the interpreter). Pure. */
export function buildTrellisArgs(script: string, spec: TrellisSpec, root: string, wsl = false): string[] {
  const p = (v: string) => (wsl ? toWslPath(v) : v);
  const args = [
    p(script),
    '--image', p(spec.imagePath),
    '--output', p(spec.outputPath),
    '--trellis-root', p(root),
  ];
  if (spec.model) args.push('--model', spec.model);
  if (spec.decimationTarget !== undefined) args.push('--decimation-target', String(spec.decimationTarget));
  if (spec.textureSize !== undefined) args.push('--texture-size', String(spec.textureSize));
  return args;
}

/** Parse the POF_T2_* marker block out of the script's stdout. Pure. */
export function parseTrellisOutput(stdout: string): Omit<TrellisResult, 'durationMs'> {
  const get = (k: string): string | undefined => {
    const m = stdout.match(new RegExp(`^${k}=(.*)$`, 'm'));
    return m ? m[1].trim() : undefined;
  };
  const done = get('POF_T2_DONE');
  const error = get('POF_T2_ERROR');
  const num = (k: string) => { const v = get(k); return v ? Number(v) : undefined; };
  return {
    ok: done !== undefined && error === undefined,
    meshPath: done,
    error,
    verts: num('POF_T2_VERTS'),
    faces: num('POF_T2_FACES'),
    vramGb: num('POF_T2_VRAM_GB'),
    bakeSeconds: num('POF_T2_BAKE_S'),
    previewPath: get('POF_T2_PREVIEW'),
  };
}

type RunFn = (cmd: string, args: string[], timeoutMs: number) => Promise<{ stdout: string; code: number | null }>;

export interface TrellisDeps {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  env?: Record<string, string | undefined>;
}

function err(message: string): TrellisResult {
  return { ok: false, error: message, durationMs: 0 };
}

/** Run TRELLIS.2 image->textured mesh and return the observed result. */
export async function runTrellis(spec: TrellisSpec, deps: TrellisDeps = {}): Promise<TrellisResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? defaultRun;

  const root = spec.trellisRoot ?? env.POF_TRELLIS_ROOT;
  if (!root) return err('POF_TRELLIS_ROOT not set (path to the TRELLIS.2 checkout holding the trellis2 package)');
  const py = spec.venvPython ?? env.POF_TRELLIS_VENV;
  if (!py) return err('POF_TRELLIS_VENV not set (python with TRELLIS.2 + o_voxel installed)');

  const distro = spec.wslDistro ?? env.POF_TRELLIS_WSL;
  const script = spec.scriptPath ?? join(process.cwd(), 'scripts', 'visual-gen', 'pof_trellis.py');
  if (!fileExists(script)) return err(`pof_trellis.py not found at ${script}`);
  // Only the non-WSL interpreter is stat-able from here. Inside a distro the venv is not
  // on a Windows path, so a missing interpreter surfaces as a spawn failure with the
  // script's own stderr rather than as a preflight error — stated, not silently skipped.
  if (!distro && !fileExists(py)) return err(`TRELLIS.2 venv python not found at ${py}`);

  const args = buildTrellisArgs(script, spec, root, !!distro);
  const [cmd, argv] = distro ? ['wsl.exe', ['-d', distro, '--', py, ...args]] : [py, args];

  const start = now();
  // 4B params + a 4096 PBR bake, and the first run also downloads the ~16GB model.
  // Default to a 40-min ceiling — well above Hunyuan's 15.
  const { stdout } = await run(cmd, argv, spec.timeoutMs ?? 2_400_000);
  const parsed = parseTrellisOutput(stdout);

  const back = (p?: string) => (p && distro ? fromWslPath(p) : p);
  const meshPath = back(parsed.meshPath);
  const confirmed = meshPath && fileExists(meshPath) ? meshPath : undefined;

  return {
    ok: parsed.ok && !!confirmed,
    error: parsed.error ?? (parsed.ok && !confirmed ? 'mesh file not written despite DONE marker' : undefined),
    meshPath: confirmed,
    verts: parsed.verts,
    faces: parsed.faces,
    vramGb: parsed.vramGb,
    bakeSeconds: parsed.bakeSeconds,
    previewPath: back(parsed.previewPath),
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
