/**
 * UE-import of a generated mesh — Stage 2 of the local 3D pipeline. Reuses the proven
 * Experiment Lab runner (Editor-Python mode) to run a UE glTF import in the full editor
 * (the Interchange/glTF importer is unreliable under the -run=pythonscript commandlet —
 * the editor path is the documented workaround, same as the FBX-Interchange gotcha).
 * Brings a TripoSR .glb into /Game as a Static Mesh so it's usable in the project.
 */
import { runExperiment, type ExperimentResult, type ExperimentSpec, type RunnerDeps } from '@/lib/ue-experiment/runner';

/**
 * What the imported mesh is FOR. Collision is a use-decision, not a mesh property: the same
 * geometry wants hulls as a crate and nothing at all as a wall decoration.
 */
export type CollisionUse = 'blocking' | 'decorative' | 'character';

/**
 * How collision should be built for one imported mesh.
 *
 * `complex` (the render mesh used directly as collision) is deliberately NOT representable.
 * It is forbidden for anything that moves and is a last resort everywhere else; leaving it out
 * of the type means no plan can quietly select it.
 */
export interface CollisionPlan {
  kind: 'none' | 'simple' | 'convex';
  /** Primitive for `simple`. */
  shape?: 'BOX' | 'SPHERE' | 'CAPSULE' | 'NDOP10_X';
  /** Hull budget for `convex`. */
  hullCount?: number;
  maxHullVerts?: number;
  /** Why this plan, in one line — a bare enum cannot explain a refusal. */
  reason: string;
}

/** Hulls for a multi-part blocking prop. Low on purpose: raise only if the silhouette blocks wrongly. */
export const DEFAULT_HULL_COUNT = 6;
export const DEFAULT_MAX_HULL_VERTS = 16;

/**
 * Decide collision for an imported generated mesh. Pure.
 *
 * A generated `.glb` carries no collision of any kind, and glTF has no `UCX_` convention to
 * carry one (that is FBX-importer-only — a `UCX_` object exported into a `.glb` imports as a
 * second VISIBLE mesh). So collision has to be built after import, and something has to decide
 * what shape it takes. See the `generated-mesh-arrives-without-collision` gotcha.
 */
export function collisionPlan(req: { use: CollisionUse; components?: number }): CollisionPlan {
  if (req.use === 'decorative') {
    return {
      kind: 'none',
      reason: 'decorative asset — no collision at all; a wrong hull blocks the player worse than nothing does',
    };
  }
  // One shell → one primitive reads correctly and costs nothing. Multiple shells mean the
  // silhouette has concavities a single box would bridge, which is what hulls are for.
  if ((req.components ?? 1) <= 1) {
    return {
      kind: 'simple',
      shape: 'BOX',
      reason: 'single-shell mesh — one box primitive is the cheapest collision that reads correctly',
    };
  }
  return {
    kind: 'convex',
    hullCount: DEFAULT_HULL_COUNT,
    maxHullVerts: DEFAULT_MAX_HULL_VERTS,
    reason: `${req.components} shells — convex decomposition at ${DEFAULT_HULL_COUNT} hulls; raise the budget only if the silhouette blocks wrongly`,
  };
}

/**
 * The python lines that build collision and READ IT BACK. Empty for a `none` plan.
 *
 * ⚠️ UNVERIFIED AGAINST A LIVE EDITOR. The call names come from the documented
 * `EditorStaticMeshLibrary` surface and the emitted source is syntax-checked, but the
 * `body_setup` -> `agg_geom` -> `convex_elems` / `box_elems` / `sphere_elems` / `sphyl_elems`
 * property chain has NOT been introspected on this project's UE build. Per the
 * `python-api-introspect-first` gotcha, the first live run should `dir()` the objects and
 * correct these names rather than assume them — and note that a wrong property name here fails
 * SAFE: the read-back throws or yields 0, and `importGlbToUE` then refuses to claim collision.
 */
function collisionPython(plan: CollisionPlan | undefined): string[] {
  if (!plan || plan.kind === 'none') return [];
  const call =
    plan.kind === 'simple'
      ? `unreal.EditorStaticMeshLibrary.add_simple_collisions(mesh, unreal.ScriptingCollisionShapeType.${plan.shape ?? 'BOX'})`
      : `unreal.EditorStaticMeshLibrary.set_convex_decomposition_collisions(mesh, ${plan.hullCount ?? DEFAULT_HULL_COUNT}, ${plan.maxHullVerts ?? DEFAULT_MAX_HULL_VERTS}, 100000)`;
  return [
    'mesh = unreal.load_asset(paths[0]) if paths else None',
    'if mesh:',
    `    ${call}`,
    // The observation. A collision call that runs and produces nothing is indistinguishable
    // from one that worked unless the aggregate geometry is counted afterwards.
    "    bs = mesh.get_editor_property('body_setup')",
    '    agg = bs.get_editor_property(\'agg_geom\') if bs else None',
    '    n = (len(agg.get_editor_property(\'convex_elems\')) + len(agg.get_editor_property(\'box_elems\')) + len(agg.get_editor_property(\'sphere_elems\')) + len(agg.get_editor_property(\'sphyl_elems\'))) if agg else 0',
    "    unreal.log('POF_UE_COLLISION=' + str(n))",
    '    unreal.EditorAssetLibrary.save_loaded_asset(mesh)',
  ];
}

/**
 * UE python that imports a .glb via an AssetImportTask and logs the asset path. Pure.
 *
 * With a collision plan the task does NOT save at import time — saving before the collision
 * call would persist the mesh without it — and the asset is saved explicitly afterwards.
 */
export function buildGlbImportPython(
  glbPath: string,
  destPath = '/Game/Generated',
  assetName = 'TripoSRMesh',
  opts: { collision?: CollisionPlan } = {},
): string {
  const glb = glbPath.replace(/\\/g, '/');
  const wantsCollision = !!opts.collision && opts.collision.kind !== 'none';
  return [
    'task = unreal.AssetImportTask()',
    `task.filename = '${glb}'`,
    `task.destination_path = '${destPath}'`,
    `task.destination_name = '${assetName}'`,
    'task.automated = True',
    'task.replace_existing = True',
    `task.save = ${wantsCollision ? 'False' : 'True'}`,
    'unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])',
    'paths = list(task.imported_object_paths)',
    "unreal.log('POF_UE_IMPORT=' + (paths[0] if paths else 'NONE'))",
    ...collisionPython(opts.collision),
  ].join('\n');
}

export interface UeImportResult {
  ok: boolean;
  assetPath?: string;
  /**
   * Collision primitives OBSERVED on the imported mesh's `body_setup`, when a plan asked for
   * them. Absent means nothing reported a count — which is a failure when collision was
   * requested, never a silent pass.
   */
  collisionElements?: number;
  error?: string;
  logs: string[];
}

type RunExperimentFn = (spec: ExperimentSpec, deps?: RunnerDeps) => Promise<ExperimentResult>;

/** Import a generated .glb into the connected UE project. `runExperimentFn` is injectable
 * for tests; defaults to the real Experiment Lab runner (launches the editor). */
export async function importGlbToUE(
  glbPath: string,
  opts: {
    destPath?: string;
    assetName?: string;
    settleMs?: number;
    collision?: CollisionPlan;
    runExperimentFn?: RunExperimentFn;
  } = {},
): Promise<UeImportResult> {
  const run = opts.runExperimentFn ?? runExperiment;
  const res = await run({
    python: buildGlbImportPython(glbPath, opts.destPath, opts.assetName, { collision: opts.collision }),
    capture: false,
    settleMs: opts.settleMs ?? 180_000, // editor cold-start + import
  });
  const asset = res.markers['POF_UE_IMPORT'];
  const imported = !!asset && asset !== 'NONE';

  // Collision is CLAIMED only from the read-back. An asset whose body_setup holds zero
  // aggregate elements passes every import check and then falls through the world, so a
  // requested-but-absent collision is an import failure rather than a warning.
  const wantsCollision = !!opts.collision && opts.collision.kind !== 'none';
  const raw = res.markers['POF_UE_COLLISION'];
  const collisionElements = raw === undefined ? undefined : Number(raw);
  const collisionOk =
    !wantsCollision || (collisionElements !== undefined && Number.isFinite(collisionElements) && collisionElements > 0);
  const collisionError = collisionOk
    ? undefined
    : collisionElements === undefined
      ? `collision was requested (${opts.collision!.kind}) but the mesh reported no body_setup count — nothing observed it, so it is not claimed`
      : `collision was requested (${opts.collision!.kind}) but body_setup holds 0 elements — the mesh would fall through the world`;

  return {
    ok: res.ok && imported && collisionOk,
    assetPath: imported ? asset : undefined,
    ...(collisionElements !== undefined && Number.isFinite(collisionElements) ? { collisionElements } : {}),
    error:
      res.error ??
      (asset === 'NONE' ? 'no objects imported (is the glTF/Interchange importer enabled?)' : undefined) ??
      collisionError,
    logs: res.logs,
  };
}
