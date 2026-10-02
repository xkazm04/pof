/**
 * Mesh split — one generated GLB holding SEVERAL objects → one asset per object.
 *
 * The pipeline already owns the opposite two edges and was missing this one:
 * `scene-decompose` + `scene-crop` split a scene IMAGE into per-prop crops (one paid
 * generation each), and `pof_mesh_finish.py` JOINS a fragmented delivery into a single
 * mesh. Nothing took a delivery that legitimately contains several distinct props and
 * gave each its own file.
 *
 * Why that edge is worth having: a generator charges per job, not per object, and it
 * spends its detail budget across whatever the reference image shows. Asking one job for
 * a small group of simple props — a well, a lamp post, two barrels — and separating them
 * afterwards costs one job instead of four, and each separated prop lands well under its
 * class budget without any decimation. The trade is real and belongs to the caller: less
 * detail per object than four dedicated generations. This module never makes that choice,
 * it only performs the split and REPORTS what came out.
 *
 * ── Two things this deliberately does not do ────────────────────────────────────────
 *
 * 1. **It never splits in trimesh.** `trimesh.split()` deep-copies material data per
 *    connected component; on a heavily-fragmented textured mesh it consumed 211 GB and
 *    crashed the operator's machine (2026-08-18). The split happens inside Blender's own
 *    BMesh via `bpy.ops.mesh.separate(type='LOOSE')`, which is what that operator exists
 *    for, and the spawn carries a timeout + SIGKILL.
 *
 * 2. **It never silently drops geometry.** Generated meshes carry speck debris — measured
 *    on real Tripo character output, 314 of 375 components were specks holding 36% of the
 *    face budget. Specks must not each become an "asset", so components below a face
 *    SHARE threshold are discarded (the same face-share rule as
 *    `assembled-character-is-multi-shell`) — and the count and face total of what was
 *    discarded are reported, so "3 props out of 5 components" is never mistaken for
 *    "the mesh had 3 components".
 */
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { BLENDER_CANDIDATES } from './mesh-finish';
import { blenderNotFound, locateBlender, type BlenderSeams } from './blender-locate';
import { processFailureReason, runLocalProcess, type ProcessOutcome } from '@/lib/visual-gen/local-process';
import { readMarkerBlock } from '@/lib/visual-gen/script-markers';

/**
 * Components holding less than this share of the total faces are specks, not props.
 * 0.5% is the line measured on real generator output; a legitimate prop in a 4-prop
 * group carries ~25%, two orders of magnitude clear of it.
 */
export const DEFAULT_MIN_FACE_SHARE = 0.005;

/** Upper bound on assets one split may produce — a shattered mesh is a defect, not 300 props. */
export const DEFAULT_MAX_PARTS = 24;

/**
 * The share of the input's faces the kept parts must together account for.
 *
 * This is the guard that tells a GROUP OF OBJECTS from ONE SHATTERED OBJECT, and it was
 * added because the first live run needed it: `props__crate.glb` — a single crate — has
 * 451 loose components, and a face-share threshold alone happily wrote 24 "assets" out
 * of it while discarding 77% of the geometry. A real group of props has few components
 * each holding a large share (four props ≈ 25% each, coverage ≈ 1.0); a fragmented
 * generation has hundreds of tiny ones. Below this floor the split REFUSES rather than
 * manufacturing assets out of debris.
 */
export const DEFAULT_MIN_COVERAGE = 0.8;

export { BLENDER_CANDIDATES };

export interface MeshSplitSpec {
  /** The multi-object GLB to separate. */
  inputPath: string;
  /** Directory each part is written into. The caller owns the allow-listing. */
  outputDir: string;
  /** Basename stem for each part: `<prefix>_01.glb`, `<prefix>_02.glb`, … */
  prefix: string;
  /** Speck threshold as a share of total faces. Defaults to {@link DEFAULT_MIN_FACE_SHARE}. */
  minFaceShare?: number;
  /** Cap on parts written. Defaults to {@link DEFAULT_MAX_PARTS}. */
  maxParts?: number;
  /** Face-coverage floor below which the split refuses. Defaults to {@link DEFAULT_MIN_COVERAGE}. */
  minCoverage?: number;
  /**
   * Re-centre each part on its own bounding-box centre before export. Default true —
   * a prop separated out of a group keeps the group's world offset otherwise, and every
   * downstream consumer (the viewer, the UE import, the scale gate) assumes an
   * origin-centred asset.
   */
  center?: boolean;
  blenderPath?: string;
  scriptPath?: string;
  timeoutMs?: number;
}

export interface SplitPart {
  name: string;
  path: string;
  faces: number;
  /** This part's share of the input's faces, 0..1. */
  share: number;
}

export interface ParsedMeshSplit {
  ok: boolean;
  facesIn?: number;
  /** Loose components the script found BEFORE the speck filter. */
  components?: number;
  parts: SplitPart[];
  discarded?: number;
  discardedFaces?: number;
  /** Parts dropped by the `maxParts` cap — counted apart from specks, which are a different fact. */
  capped?: number;
  /** Share of the input's faces the written parts account for, 0..1. */
  coverage?: number;
  /** Any marker the declaration does not know, verbatim (`script-markers.ts`). */
  diagnostics?: Record<string, string>;
  error?: string;
}

export interface MeshSplitResult extends ParsedMeshSplit {
  durationMs: number;
}

/** Build the blender argv. Pure. */
export function buildMeshSplitArgs(scriptPath: string, spec: MeshSplitSpec): string[] {
  const args = [
    '--background',
    '--python',
    scriptPath,
    '--',
    '--input', spec.inputPath,
    '--output-dir', spec.outputDir,
    '--prefix', spec.prefix,
    '--min-face-share', String(spec.minFaceShare ?? DEFAULT_MIN_FACE_SHARE),
    '--max-parts', String(spec.maxParts ?? DEFAULT_MAX_PARTS),
    '--min-coverage', String(spec.minCoverage ?? DEFAULT_MIN_COVERAGE),
  ];
  if (spec.center !== false) args.push('--center');
  return args;
}

/** Parse the script's `POF_MESHSPLIT_*` stdout markers (declared in `script-markers.ts`). Pure. */
export function parseMeshSplitOutput(stdout: string): ParsedMeshSplit {
  const block = readMarkerBlock('meshSplit', stdout);
  const { get, num } = block;

  const error = get('ERROR');
  if (error) return { ok: false, parts: [], error };

  const parts: SplitPart[] = [];
  for (const value of block.all('PART')) {
    const [name, faces, share, path] = value.split('|');
    if (!name || !path) continue;
    parts.push({ name: name.trim(), path: path.trim(), faces: Number(faces), share: Number(share) });
  }

  // DONE with no part is not a success: the caller asked for assets and got none, and
  // "the script finished" is not the thing being reported.
  const done = get('DONE') !== undefined;
  const ok = done && parts.length > 0;
  return {
    ok,
    facesIn: num('FACES_IN'),
    components: num('COMPONENTS'),
    parts,
    discarded: num('DISCARDED'),
    discardedFaces: num('DISCARDED_FACES'),
    capped: num('CAPPED'),
    coverage: num('COVERAGE'),
    diagnostics: block.diagnostics,
    // The speck reason is true only of a run that FINISHED; a run that never printed
    // DONE (killed, crashed, never started) gets its process reason from runMeshSplit.
    error: ok || parts.length
      ? undefined
      : done ? 'split produced no part above the speck threshold' : 'no POF_MESHSPLIT_DONE marker — the split did not finish',
  };
}

type RunFn = (cmd: string, args: string[], timeoutMs: number) => Promise<ProcessOutcome>;

export interface MeshSplitDeps extends BlenderSeams {
  run?: RunFn;
  fileExists?: (p: string) => boolean;
  now?: () => number;
  env?: Record<string, string | undefined>;
}

function err(message: string): MeshSplitResult {
  return { ok: false, parts: [], error: message, durationMs: 0 };
}

/** Separate a multi-object GLB into one GLB per substantial component. */
export async function runMeshSplit(spec: MeshSplitSpec, deps: MeshSplitDeps = {}): Promise<MeshSplitResult> {
  const env = deps.env ?? process.env;
  const fileExists = deps.fileExists ?? existsSync;
  const now = deps.now ?? (() => Date.now());
  const run = deps.run ?? defaultRun;

  const located = locateBlender({ ...deps, explicit: spec.blenderPath, env, exists: fileExists });
  const blender = located.path;
  if (!blender) return err(blenderNotFound(located.probed));
  if (!fileExists(spec.inputPath)) return err(`input mesh not found at ${spec.inputPath}`);

  const script = spec.scriptPath ?? join(process.cwd(), 'scripts', 'visual-gen', 'pof_mesh_split.py');
  if (!fileExists(script)) return err(`pof_mesh_split.py not found at ${script}`);

  const start = now();
  const timeoutMs = spec.timeoutMs ?? 600_000;
  const outcome = await run(blender, buildMeshSplitArgs(script, spec), timeoutMs);
  const parsed = parseMeshSplitOutput(outcome.stdout);
  // No DONE and no ERROR marker → Blender itself says why (crash, timeout, never started).
  const ended = readMarkerBlock('meshSplit', outcome.stdout);
  const markerless = ended.get('DONE') === undefined && ended.get('ERROR') === undefined;
  const processError = markerless
    ? processFailureReason(outcome, { tool: `Blender (${basename(script)})`, timeoutMs })
    : undefined;

  // A part is only a part if the file is there. The script announcing one it did not
  // write would otherwise become an asset URL that 404s at the viewer.
  const written = parsed.parts.filter((p) => fileExists(p.path));
  const missing = parsed.parts.filter((p) => !fileExists(p.path)).map((p) => p.name);

  return {
    ...parsed,
    ok: parsed.ok && written.length > 0 && missing.length === 0,
    parts: written,
    error: processError ?? parsed.error
      ?? (missing.length ? `the split announced ${missing.length} part(s) that were not written: ${missing.join(', ')}` : undefined),
    durationMs: now() - start,
  };
}

// ── default spawn seam: the shared local-process seam (tested in local-process.test.ts) ──
const defaultRun: RunFn = (cmd, args, timeoutMs) => runLocalProcess(cmd, args, { timeoutMs });
