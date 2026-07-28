/**
 * Mesh-finish runner — the retopo → UV → high→low bake stage the local 3D
 * pipeline never had. Generators (Hunyuan3D / Tripo / TripoSR) hand back a
 * dense single-shot mesh; shipping it needs a decimated low-poly with real UVs
 * and the high-poly detail baked down into normal/AO maps. Blender does all of
 * that headless, on the CPU, for $0 — this drives it.
 *
 * Same shape as `triposr-runner.ts`: pure cores (resolve/plan/args/parse) plus
 * an injectable spawn seam, so the orchestration is unit-tested without Blender.
 *
 * Two practices from the pro workflow are ENFORCED here rather than left to a
 * prompt: UV unwrap only ever runs on the decimated low-poly (`unwrapPlan`),
 * and a symmetric character can be authored on one half and mirrored.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Above this face count an auto-unwrap explodes into unusable island counts
 *  (and routinely hangs/crashes the unwrapper) — the high-poly is never the
 *  thing you unwrap. */
export const UNWRAP_FACE_CEILING = 200_000;

/** Known Blender installs, probed in order when nothing is configured.
 *  Mirrors `/api/visual-gen/blender/detect`. */
export const BLENDER_CANDIDATES = [
  'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
  '/usr/bin/blender',
  '/usr/local/bin/blender',
  '/Applications/Blender.app/Contents/MacOS/Blender',
];

export type MirrorAxis = 'x' | 'y' | 'z';
export type BakeMap = 'normal' | 'ao';

export interface MeshFinishSpec {
  /** Dense input mesh from a generator (.glb / .obj / .fbx). */
  highPolyPath: string;
  /** Where the finished low-poly is written (.glb). */
  outputPath: string;
  /** Decimate to roughly this many faces. Omit to skip retopo (and unwrap). */
  targetFaces?: number;
  /** Author one half and mirror it across this axis (symmetric characters). */
  mirror?: MirrorAxis;
  /** Request a UV unwrap — honoured only when the mesh is decimated first. */
  unwrap?: boolean;
  /** High→low bakes to render (needs `unwrap`). */
  bake?: BakeMap[];
  /** Baked map resolution (default 1024). */
  bakeSize?: number;
  /** Blender executable; else POF_BLENDER; else a known install. */
  blenderPath?: string;
  /** Override the Blender script path (default the repo-committed one). */
  scriptPath?: string;
  timeoutMs?: number;
}

export interface MeshFinishResult {
  ok: boolean;
  error?: string;
  meshPath?: string;
  facesIn?: number;
  facesOut?: number;
  sizeMB?: number;
  uvUnwrapped?: boolean;
  normalMapPath?: string;
  aoMapPath?: string;
  /** Set when an unwrap was asked for but refused — never dropped silently. */
  unwrapSkippedReason?: string;
  durationMs: number;
}

/** Resolve the Blender executable. Pure (filesystem via the `exists` seam). */
export function resolveBlenderPath(
  explicit: string | undefined,
  env: Record<string, string | undefined>,
  exists: (p: string) => boolean,
): string | null {
  if (explicit) return explicit;
  if (env.POF_BLENDER) return env.POF_BLENDER;
  return BLENDER_CANDIDATES.find(exists) ?? null;
}

export interface UnwrapPlan {
  unwrap: boolean;
  reason?: string;
}

/**
 * Decide whether the UV unwrap may run. Unwrapping a raw generated high-poly
 * produces tens of thousands of islands (and usually never finishes), so the
 * unwrap is gated behind a decimation to a low-poly budget.
 */
export function unwrapPlan(requested: boolean | undefined, targetFaces: number | undefined): UnwrapPlan {
  if (!requested) return { unwrap: false };
  if (targetFaces === undefined) {
    return { unwrap: false, reason: 'unwrap runs on the retopo\u2019d low-poly only — set targetFaces to decimate first' };
  }
  if (targetFaces > UNWRAP_FACE_CEILING) {
    return {
      unwrap: false,
      reason: `targetFaces ${targetFaces} is above the ${UNWRAP_FACE_CEILING}-face unwrap ceiling — the island count explodes; decimate further`,
    };
  }
  return { unwrap: true };
}

/** Build the blender argv. Pure. */
export function buildMeshFinishArgs(scriptPath: string, spec: MeshFinishSpec): string[] {
  const plan = unwrapPlan(spec.unwrap, spec.targetFaces);
  const args = [
    '--background',
    '--python',
    scriptPath,
    '--',
    '--input', spec.highPolyPath,
    '--output', spec.outputPath,
  ];
  if (spec.targetFaces !== undefined) args.push('--target-faces', String(spec.targetFaces));
  if (spec.mirror) args.push('--mirror', spec.mirror);
  if (plan.unwrap) args.push('--unwrap');
  if (plan.unwrap && spec.bake?.length) {
    args.push('--bake', spec.bake.join(','));
    args.push('--bake-size', String(spec.bakeSize ?? 1024));
  }
  return args;
}

export interface ParsedMeshFinish {
  ok: boolean;
  meshPath?: string;
  facesIn?: number;
  facesOut?: number;
  sizeMB?: number;
  uvUnwrapped?: boolean;
  normalMapPath?: string;
  aoMapPath?: string;
  error?: string;
}

/** Parse the script's `POF_MESHFINISH_*` stdout markers. Pure. */
export function parseMeshFinishOutput(stdout: string): ParsedMeshFinish {
  const get = (k: string): string | undefined => {
    const m = stdout.match(new RegExp(`^POF_MESHFINISH_${k}=(.*)$`, 'm'));
    return m ? m[1].trim() : undefined;
  };
  const num = (k: string): number | undefined => {
    const v = get(k);
    return v === undefined ? undefined : Number(v);
  };
  const done = get('DONE');
  const error = get('ERROR');
  return {
    ok: done !== undefined && error === undefined,
    meshPath: done,
    error,
    facesIn: num('FACES_IN'),
    facesOut: num('FACES_OUT'),
    sizeMB: num('SIZE_MB'),
    uvUnwrapped: get('UV') === undefined ? undefined : get('UV') === '1',
    normalMapPath: get('BAKE_NORMAL'),
    aoMapPath: get('BAKE_AO'),
  };
}

type RunFn = (cmd: string, args: string[], timeoutMs: number) => Promise<{ stdout: string; code: number | null }>;

export interface MeshFinishDeps {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  env?: Record<string, string | undefined>;
}

function err(message: string, unwrapSkippedReason?: string): MeshFinishResult {
  return { ok: false, error: message, unwrapSkippedReason, durationMs: 0 };
}

/** Retopo + UV + bake a generated high-poly into a game-tier low-poly. */
export async function runMeshFinish(spec: MeshFinishSpec, deps: MeshFinishDeps = {}): Promise<MeshFinishResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? defaultRun;

  const plan = unwrapPlan(spec.unwrap, spec.targetFaces);
  const blender = resolveBlenderPath(spec.blenderPath, env, fileExists);
  if (!blender) return err('Blender not found — set POF_BLENDER to the blender executable', plan.reason);
  if (!fileExists(spec.highPolyPath)) return err(`input mesh not found at ${spec.highPolyPath}`, plan.reason);

  const script = spec.scriptPath ?? join(process.cwd(), 'scripts', 'visual-gen', 'pof_mesh_finish.py');
  if (!fileExists(script)) return err(`pof_mesh_finish.py not found at ${script}`, plan.reason);

  const start = now();
  const { stdout } = await run(blender, buildMeshFinishArgs(script, spec), spec.timeoutMs ?? 600_000);
  const parsed = parseMeshFinishOutput(stdout);
  const meshPath = parsed.meshPath && fileExists(parsed.meshPath) ? parsed.meshPath : undefined;

  return {
    ok: parsed.ok && !!meshPath,
    error: parsed.error ?? (parsed.ok && !meshPath ? 'low-poly file not written despite DONE marker' : undefined),
    meshPath,
    facesIn: parsed.facesIn,
    facesOut: parsed.facesOut,
    sizeMB: parsed.sizeMB,
    uvUnwrapped: parsed.uvUnwrapped,
    normalMapPath: parsed.normalMapPath,
    aoMapPath: parsed.aoMapPath,
    unwrapSkippedReason: plan.reason,
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
