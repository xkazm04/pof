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
import { bakeSizeForExtent } from './texel-density';

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
export type BakeMap = 'normal' | 'ao' | 'diffuse' | 'roughness' | 'metallic';

/** Maps Cycles can bake as a native pass. `metallic` is deliberately absent —
 *  see `bakePlan`. */
export const BAKEABLE_MAPS = ['normal', 'ao', 'diffuse', 'roughness'] as const;

/**
 * Crease angle (degrees) for the auto-smooth pass. Edges sharper than this stay hard,
 * everything flatter is smoothed — 30° keeps a hard-surface bevel crisp while letting
 * an organic body read as curved.
 */
export const DEFAULT_SMOOTH_ANGLE = 30;

/**
 * UV layout for the decimated low-poly.
 * - `smart` — angle-based projection. Correct when the source carries no usable UVs.
 * - `pack-existing` — keep the islands the source parts already had and only re-pack
 *   them into one atlas. Joining N textured parts leaves N layouts stacked in the same
 *   0-1 space; re-projecting throws away authored seams that are usually better than
 *   anything an angle limit finds, so consolidating a textured multi-part asset wants
 *   the pack, not the projection.
 */
export type UvMode = 'smart' | 'pack-existing';

/**
 * How the low-poly is built from the dense input.
 *
 *  - `collapse` (default, unchanged): a Blender DECIMATE modifier in COLLAPSE mode.
 *    Edge-collapse — fast, robust on any input, and triangle soup by construction:
 *    irregular, density-varying, with no edge flow.
 *  - `quadriflow`: Blender's built-in QuadriFlow field-aligned remesher
 *    (`bpy.ops.object.quadriflow_remesh`, present in the Blender 4.2 this repo already
 *    drives headlessly — no new dependency). Authors a regular, even-density quad mesh
 *    that follows the surface's principal curvature.
 *
 * WHAT `quadriflow` DOES NOT GIVE YOU: quads in the delivered artifact. glTF 2.0 has no
 * quad primitive mode, so Blender triangulates on GLB export and `mesh-finish` writes
 * GLB. The win is the TOPOLOGY the triangles are derived from — even density and real
 * edge flow, which is what skinning/deformation, UV island quality, and the high→low
 * bake actually care about — not the primitive type on disk. `quadDeliveryNote` states
 * this on every quadriflow run so the mode name can never be read as "the .glb has
 * quads". Genuine quads on disk would need an FBX output branch; that is a separate,
 * larger change.
 *
 * Note this is the practice `ue-gotchas` `ai-lowpoly-generation-not-final` already
 * prescribes ("RETOPOLOGIZE deterministically — algorithmic quad-remesh for small
 * objects"): until now PoF injected that advice into prompts without being able to
 * execute it.
 */
export type RetopoMode = 'collapse' | 'quadriflow';

/**
 * The standing truth about a quadriflow delivery. Returned for `quadriflow` runs only —
 * a collapse run never authored quads, so a note claiming they were triangulated would
 * be noise, not honesty.
 */
export function quadDeliveryNote(mode: RetopoMode | undefined): string | undefined {
  if (mode !== 'quadriflow') return undefined;
  return 'Topology was AUTHORED as quads by QuadriFlow and DELIVERED triangulated: glTF 2.0 defines no quad primitive, so the GLB export triangulates it. The gain is even-density, curvature-aligned edge flow (better skinning, UV islands and high→low bakes), not quad primitives in the file.';
}

export interface MeshFinishSpec {
  /** Dense input mesh from a generator (.glb / .obj / .fbx). */
  highPolyPath: string;
  /** Where the finished low-poly is written (.glb). */
  outputPath: string;
  /** Decimate to roughly this many faces. Omit to skip retopo (and unwrap). */
  targetFaces?: number;
  /**
   * How to reach `targetFaces` — see `RetopoMode`. Defaults to `collapse`, so every
   * existing caller keeps its exact behaviour and argv. Ignored without `targetFaces`
   * (a remesher with no target has nothing to aim at).
   */
  retopo?: RetopoMode;
  /**
   * Real-world size the finished asset should have — longest extent in METRES.
   *
   * The script still does not RESCALE (the low-poly keeps the generator's ~1 m box);
   * the Tier-1 gate grades the delivery against it and reports the import scale that
   * fixes it. It does now size the BAKE: a map covers a real-world surface, so the
   * resolution a mesh earns follows from its metres (`texel-density.ts`). Before this,
   * the intended size reached mesh-finish and the bake ignored it — a 10 cm coin and a
   * 12 m cave chunk both received the same flat 1024 map.
   */
  targetExtentM?: number;
  /** Author one half and mirror it across this axis (symmetric characters). */
  mirror?: MirrorAxis;
  /**
   * Delete WELDED interior faces before decimating — geometry enclosed inside one
   * continuous shell. Measured on Blender 4.2: occlusion between SEPARATE shells (the
   * body under a chest plate, the scalp under a helmet) is invisible to this operator,
   * so on an assembled character this often removes nothing; `cullLimitReason` then says
   * so rather than letting a `facesCulled: 0` read as "nothing is hidden".
   *
   * The cull runs on the FULL-DENSITY mesh (before decimation), so the script refuses it
   * above its own `CULL_FACE_CEILING` (200k faces) and reports `cullRefusedReason` — the
   * memory-bounded shell walk is cheap, but the Blender operator it feeds is not ours to
   * bound. `POST /api/visual-gen/mesh-finish` refuses the flag outright; this field is
   * reachable only from in-process callers that have measured their own input.
   */
  cullInterior?: boolean;
  /**
   * Crease angle (degrees) for the auto-smooth pass, applied after decimation. Defaults
   * to `DEFAULT_SMOOTH_ANGLE`; `0` disables it.
   *
   * Only ever re-shades a mesh that has NO custom split normals. Measured on Blender 4.2
   * against real Tripo output: a generated .glb already carries custom normals and every
   * polygon is already smooth, custom normals override the crease angle, and the pass is
   * a no-op there (0 of 30,967 exported normals changed). Forcing it by clearing them
   * rewrote 99.9% of normals by a mean of 73° — worse information, not better. So the
   * angle serves the input class that genuinely imports faceted (.obj/.fbx without
   * normals); otherwise `shadingSkippedReason` says why it was refused.
   */
  smoothAngle?: number;
  /** Request a UV unwrap — honoured only when the mesh is decimated first. */
  unwrap?: boolean;
  /** How to lay out the UVs when unwrapping (default `smart`). */
  uvMode?: UvMode;
  /** High→low bakes to render (needs `unwrap`). */
  bake?: BakeMap[];
  /** Baked map resolution. Defaults to what `targetExtentM` earns, else 1024. */
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
  /** Faces removed by the interior cull (absent when no cull ran). */
  facesCulled?: number;
  /** Disconnected shells present when the interior cull ran. */
  cullUnevaluatedShells?: number;
  /** Why a `facesCulled: 0` does not mean "nothing was hidden". */
  cullLimitReason?: string;
  /**
   * Set when the script REFUSED the interior cull outright — the mesh was above its
   * `CULL_FACE_CEILING` and the cull runs before decimation, so nothing was culled and
   * no shell count was computed. Distinct from `cullLimitReason` (the cull ran and found
   * nothing); an absent `facesCulled` must never read as "the cull found nothing".
   */
  cullRefusedReason?: string;
  sizeMB?: number;
  uvUnwrapped?: boolean;
  /** The layout Blender actually used — not necessarily the one requested. */
  uvMode?: UvMode;
  /** Why the requested layout could not run (e.g. no authored UVs to pack). */
  uvModeFallbackReason?: string;
  /** Shading actually applied (e.g. `auto_smooth@30`); absent when none ran. */
  shading?: string;
  /** Why the re-shade was refused — the source's own normals are better information. */
  shadingSkippedReason?: string;
  /**
   * The retopo mode the script actually applied. Absent for output produced before the
   * mode existed — which must not be read as `collapse` by a caller that cares.
   */
  retopo?: RetopoMode;
  /** Why a requested `quadriflow` could not run and the script fell back to collapse. */
  retopoFallbackReason?: string;
  /** Quads QuadriFlow authored, measured Blender-side BEFORE the triangulating export. */
  quadsAuthored?: number;
  /** States that authored quads ship triangulated — see `quadDeliveryNote`. */
  quadDeliveryNote?: string;
  normalMapPath?: string;
  aoMapPath?: string;
  diffuseMapPath?: string;
  roughnessMapPath?: string;
  /** Requested maps that were not baked, each with the reason — a partial PBR set
   *  must never be reported as a full one. */
  bakeSkipped?: SkippedBake[];
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

export interface SkippedBake {
  map: BakeMap;
  reason: string;
}

export interface BakePlan {
  run: BakeMap[];
  skipped: SkippedBake[];
}

/**
 * Decide which requested maps can actually be baked.
 *
 * Cycles exposes NORMAL, AO, DIFFUSE and ROUGHNESS as native passes, so those four
 * cover a game-ready base set. There is **no metallic pass**: baking metallic means
 * re-wiring every source material's Metallic input through an Emission shader and
 * baking EMIT, which is graph surgery that behaves differently for a constant, a
 * texture and a mix — not something to claim without a live Blender run. Refusing it
 * by name beats dropping it silently, which would let a caller read a 3-map result as
 * the full PBR set it asked for.
 */
export function bakePlan(requested: BakeMap[] | undefined): BakePlan {
  const run: BakeMap[] = [];
  const skipped: SkippedBake[] = [];
  const seen = new Set<BakeMap>();

  for (const map of requested ?? []) {
    if (seen.has(map)) continue;
    seen.add(map);
    if ((BAKEABLE_MAPS as readonly BakeMap[]).includes(map)) {
      run.push(map);
    } else {
      skipped.push({
        map,
        reason:
          'Cycles has no metallic bake pass — it needs an emission re-wire of every source material, which is unproven here; the map is not claimed rather than faked',
      });
    }
  }
  return { run, skipped };
}

/** Build the blender argv. Pure. */
/**
 * The bake resolution a spec earns. An explicit `bakeSize` always wins — the caller
 * stays in charge. Otherwise a known real-world extent sizes the map (`texel-density.ts`),
 * and with neither the historic flat 1024 stands, so silence changes nothing.
 */
export function resolveBakeSize(spec: Pick<MeshFinishSpec, 'bakeSize' | 'targetExtentM'>): number {
  if (spec.bakeSize !== undefined) return spec.bakeSize;
  if (spec.targetExtentM !== undefined) return bakeSizeForExtent(spec.targetExtentM);
  return 1024;
}

export function buildMeshFinishArgs(scriptPath: string, spec: MeshFinishSpec): string[] {
  const plan = unwrapPlan(spec.unwrap, spec.targetFaces);
  const bakes = bakePlan(spec.bake).run;
  const args = [
    '--background',
    '--python',
    scriptPath,
    '--',
    '--input', spec.highPolyPath,
    '--output', spec.outputPath,
  ];
  if (spec.targetFaces !== undefined) args.push('--target-faces', String(spec.targetFaces));
  // Only the non-default mode is emitted, so existing callers produce a byte-identical
  // argv. Gated on a budget: quadriflow targets a face count and has nothing to aim at
  // without one — matching how `unwrapPlan` already refuses an unwrap with no retopo.
  if (spec.retopo === 'quadriflow' && spec.targetFaces !== undefined) args.push('--retopo', 'quadriflow');
  const smoothAngle = spec.smoothAngle ?? DEFAULT_SMOOTH_ANGLE;
  if (smoothAngle > 0) args.push('--smooth-angle', String(smoothAngle));
  if (spec.mirror) args.push('--mirror', spec.mirror);
  if (spec.cullInterior) args.push('--cull-interior');
  if (plan.unwrap) {
    args.push('--unwrap');
    args.push('--uv-mode', spec.uvMode ?? 'smart');
  }
  if (plan.unwrap && bakes.length) {
    args.push('--bake', bakes.join(','));
    args.push('--bake-size', String(resolveBakeSize(spec)));
  }
  return args;
}

export interface ParsedMeshFinish {
  ok: boolean;
  meshPath?: string;
  facesIn?: number;
  facesOut?: number;
  facesCulled?: number;
  sizeMB?: number;
  uvUnwrapped?: boolean;
  uvMode?: UvMode;
  uvModeFallbackReason?: string;
  /** Shading the script actually applied (e.g. `auto_smooth@30`) — absent when none ran. */
  shading?: string;
  /** Why the re-shade was refused (the source's own normals win) — never a silent skip. */
  shadingSkippedReason?: string;
  /**
   * The retopo mode the script actually applied. Absent for output produced before the
   * mode existed — which must not be read as `collapse` by a caller that cares.
   */
  retopo?: RetopoMode;
  /** Why a requested `quadriflow` could not run and the script fell back to collapse. */
  retopoFallbackReason?: string;
  /** Quads QuadriFlow authored, measured Blender-side BEFORE the triangulating export. */
  quadsAuthored?: number;
  /** States that authored quads ship triangulated — see `quadDeliveryNote`. */
  quadDeliveryNote?: string;
  normalMapPath?: string;
  aoMapPath?: string;
  diffuseMapPath?: string;
  roughnessMapPath?: string;
  /** Disconnected shells present when the interior cull ran. */
  cullUnevaluatedShells?: number;
  /** Set when the cull removed nothing but the mesh had shells it cannot see into. */
  cullLimitReason?: string;
  /** Set when the script refused to attempt the cull at all (mesh above its ceiling). */
  cullRefusedReason?: string;
  error?: string;
}

/**
 * What `select_interior_faces` structurally cannot reach. Measured on Blender 4.2
 * headless: an enclosed separate shell selects 0 faces, a welded shared wall selects 1.
 */
export function cullLimitReasonFor(facesCulled: number | undefined, shells: number | undefined): string | undefined {
  if (facesCulled !== 0 || shells === undefined || shells <= 1) return undefined;
  return `interior cull removed nothing: it selects only WELDED interior, so the ${shells} separate shells in this mesh were not evaluated — occlusion between parts needs visibility culling, not select_interior_faces`;
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
  const facesCulled = num('FACES_CULLED');
  const cullUnevaluatedShells = num('CULL_UNEVALUATED_SHELLS');
  const retopo = get('RETOPO') as RetopoMode | undefined;
  return {
    retopo,
    retopoFallbackReason: get('RETOPO_FALLBACK'),
    quadsAuthored: num('QUADS_AUTHORED'),
    // Derived from the mode the script REPORTS, not the mode requested — a run that
    // fell back to collapse must not carry a note about quads it never authored.
    quadDeliveryNote: quadDeliveryNote(retopo),
    cullUnevaluatedShells,
    cullLimitReason: cullLimitReasonFor(facesCulled, cullUnevaluatedShells),
    cullRefusedReason: get('CULL_REFUSED'),
    ok: done !== undefined && error === undefined,
    meshPath: done,
    error,
    facesIn: num('FACES_IN'),
    facesOut: num('FACES_OUT'),
    facesCulled,
    sizeMB: num('SIZE_MB'),
    uvUnwrapped: get('UV') === undefined ? undefined : get('UV') === '1',
    uvMode: get('UV_MODE') as UvMode | undefined,
    uvModeFallbackReason: get('UV_MODE_FALLBACK'),
    shading: get('SHADING'),
    shadingSkippedReason: get('SHADING_SKIPPED'),
    normalMapPath: get('BAKE_NORMAL'),
    aoMapPath: get('BAKE_AO'),
    diffuseMapPath: get('BAKE_DIFFUSE'),
    roughnessMapPath: get('BAKE_ROUGHNESS'),
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
  const bakes = bakePlan(spec.bake);
  const bakeSkipped = bakes.skipped.length ? bakes.skipped : undefined;
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
    facesCulled: parsed.facesCulled,
    cullUnevaluatedShells: parsed.cullUnevaluatedShells,
    cullLimitReason: parsed.cullLimitReason,
    cullRefusedReason: parsed.cullRefusedReason,
    sizeMB: parsed.sizeMB,
    uvUnwrapped: parsed.uvUnwrapped,
    uvMode: parsed.uvMode,
    uvModeFallbackReason: parsed.uvModeFallbackReason,
    shading: parsed.shading,
    shadingSkippedReason: parsed.shadingSkippedReason,
    normalMapPath: parsed.normalMapPath,
    aoMapPath: parsed.aoMapPath,
    diffuseMapPath: parsed.diffuseMapPath,
    roughnessMapPath: parsed.roughnessMapPath,
    bakeSkipped,
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
