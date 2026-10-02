/**
 * FBX -> GLB as a headless FILE job.
 *
 * The Blender pipeline's FBX tab used to push a script into the operator's LIVE Blender
 * over the MCP bridge, and its first line reset the scene they had open — every
 * conversion wiped their work. A file-to-file transform needs no live session, so it now
 * runs the way the other headless Blender capabilities do (`runMeshSplit`,
 * `runMeshFinish`, `runMeshViews`): `locateBlender` -> spawn a `--background
 * --factory-startup` Blender on `scripts/visual-gen/pof_fbx_convert.py` -> parse the
 * `POF_FBXCONV_*` receipt -> believe it only if the GLB is on disk and was written by
 * THIS run. The operator is judged by the artifact, never by the transport.
 *
 * Draco is opt-in: the app's own viewer (`SceneViewer`'s bare `GLTFLoader`) has no Draco
 * decoder, so a compressed GLB would not open inside PoF.
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { blenderNotFound, locateBlender, type BlenderSeams } from './blender-locate';
import { processFailureReason, runLocalProcess, type ProcessOutcome } from './local-process';

export interface FbxConvertSpec {
  /** Absolute path of the .fbx to convert. */
  inputPath: string;
  /** Where the GLB is written. The caller owns the allow-listing. */
  outputPath: string;
  /** Draco mesh compression. Default false — PoF's own viewer cannot decode it. */
  draco?: boolean;
  blenderPath?: string;
  scriptPath?: string;
  timeoutMs?: number;
}

export interface ParsedFbxConvert {
  ok: boolean;
  meshes?: number;
  tris?: number;
  output?: string;
  error?: string;
}

export interface FbxConvertResult extends ParsedFbxConvert {
  /** Size of the written GLB. */
  bytes?: number;
  durationMs: number;
}

/** The route's answer — a refusal is an answer (`converted: false`), not an error. */
export type FbxConvertResponse =
  | { converted: true; name: string; url: string; meshes?: number; tris?: number; bytes?: number; durationMs: number }
  | { converted: false; reason: string; durationMs: number };

export const FBX_CONVERT_TIMEOUT_MS = 300_000;

/** Build the blender argv. Pure. */
export function buildFbxConvertArgs(scriptPath: string, spec: Pick<FbxConvertSpec, 'inputPath' | 'outputPath' | 'draco'>): string[] {
  const args = [
    '--background', '--factory-startup', '--python', scriptPath, '--',
    '--input', spec.inputPath,
    '--output', spec.outputPath,
  ];
  if (spec.draco) args.push('--draco');
  return args;
}

/** Parse the script's `POF_FBXCONV_*` stdout markers. Pure. */
export function parseFbxConvertOutput(stdout: string): ParsedFbxConvert {
  const get = (k: string): string | undefined => {
    const m = stdout.match(new RegExp(`^POF_FBXCONV_${k}=(.*)$`, 'm'));
    return m ? m[1].trim() : undefined;
  };
  const error = get('ERROR');
  if (error) return { ok: false, error };
  const output = get('DONE');
  if (!output) return { ok: false, error: 'Blender printed no receipt (no POF_FBXCONV_DONE or _ERROR marker)' };
  return { ok: true, meshes: Number(get('MESHES')), tris: Number(get('TRIS')), output };
}

type RunFn = (cmd: string, args: string[], timeoutMs: number) => Promise<ProcessOutcome>;

export interface FbxConvertDeps extends BlenderSeams {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  /** Size + mtime of a file, or null. Used to prove the GLB is THIS run's. */
  statFile?: (p: string) => { size: number; mtimeMs: number } | null;
  now?: () => number;
  env?: Record<string, string | undefined>;
}

/** Filesystem mtime granularity slack, so a file written in the same instant still counts. */
const MTIME_SLACK_MS = 2_000;

function fail(error: string, durationMs = 0): FbxConvertResult {
  return { ok: false, error, durationMs };
}

function defaultStat(p: string): { size: number; mtimeMs: number } | null {
  try {
    const s = statSync(p);
    return { size: s.size, mtimeMs: s.mtimeMs };
  } catch {
    return null;
  }
}

/** Convert one FBX to one GLB in a headless Blender; ok only when the GLB is on disk. */
export async function runFbxConvert(spec: FbxConvertSpec, deps: FbxConvertDeps = {}): Promise<FbxConvertResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const statFile = deps.statFile ?? defaultStat;
  const now = deps.now ?? (() => Date.now());
  const run: RunFn = deps.run ?? ((cmd, args, timeoutMs) => runLocalProcess(cmd, args, { timeoutMs }));

  const located = locateBlender({ ...deps, explicit: spec.blenderPath, env, exists: fileExists });
  if (!located.path) return fail(blenderNotFound(located.probed));
  if (!fileExists(spec.inputPath)) return fail(`input FBX not found at ${spec.inputPath}`);

  const script = spec.scriptPath ?? join(process.cwd(), 'scripts', 'visual-gen', 'pof_fbx_convert.py');
  if (!fileExists(script)) return fail(`pof_fbx_convert.py not found at ${script}`);

  const timeoutMs = spec.timeoutMs ?? FBX_CONVERT_TIMEOUT_MS;
  const start = now();
  const outcome = await run(located.path, buildFbxConvertArgs(script, spec), timeoutMs);
  const parsed = parseFbxConvertOutput(outcome.stdout);
  const durationMs = now() - start;

  if (!parsed.ok) {
    const markerless = !/^POF_FBXCONV_ERROR=/m.test(outcome.stdout);
    const reason = markerless
      ? `${parsed.error}: ${processFailureReason(outcome, { tool: 'Blender', timeoutMs })}`
      : parsed.error ?? 'conversion failed';
    return fail(reason, durationMs);
  }

  // The receipt is a claim; the file is the fact. A GLB that is absent, or older than
  // this run (a previous conversion's output), was not written by this conversion.
  const stat = fileExists(spec.outputPath) ? statFile(spec.outputPath) : null;
  if (!fileExists(spec.outputPath) || (stat && stat.mtimeMs < start - MTIME_SLACK_MS)) {
    return fail(`Blender reported the GLB but it was not written at ${spec.outputPath}`, durationMs);
  }
  return { ...parsed, output: spec.outputPath, bytes: stat?.size, durationMs };
}
