/**
 * UE-import of a generated mesh — Stage 2 of the local 3D pipeline. Reuses the proven
 * Experiment Lab runner (Editor-Python mode) to run a UE glTF import in the full editor
 * (the Interchange/glTF importer is unreliable under the -run=pythonscript commandlet —
 * the editor path is the documented workaround, same as the FBX-Interchange gotcha).
 * Brings a TripoSR .glb into /Game as a Static Mesh so it's usable in the project.
 */
import { runExperiment, type ExperimentResult, type ExperimentSpec, type RunnerDeps } from '@/lib/ue-experiment/runner';
import { buildGlbImportPython, scaleReadBackError, type CollisionPlan, type ImportScale } from './ue-import-plan';

// The plan (collision + scale) and the python that applies it are PURE and node-free, and
// live in `ue-import-plan.ts` so the client Import Automation view can render the exact python
// this module runs. Re-exported here so every existing importer of these names is unchanged.
export {
  collisionPlan,
  buildGlbImportPython,
  DEFAULT_HULL_COUNT,
  DEFAULT_MAX_HULL_VERTS,
  type CollisionUse,
  type CollisionPlan,
  type ImportScale,
} from './ue-import-plan';

export interface UeImportResult {
  ok: boolean;
  assetPath?: string;
  /**
   * Collision primitives OBSERVED on the imported mesh's `body_setup`, when a plan asked for
   * them. Absent means nothing reported a count — which is a failure when collision was
   * requested, never a silent pass.
   */
  collisionElements?: number;
  /**
   * Longest extent (cm) READ BACK from the imported mesh's bounds, when a scale was applied.
   * Absent means nothing measured it — a failure when a scale was requested.
   */
  observedExtentCm?: number;
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
    /** The plan's derived scale (`importScaleOf`). Absent → nothing applied, nothing checked. */
    scale?: ImportScale;
    runExperimentFn?: RunExperimentFn;
  } = {},
): Promise<UeImportResult> {
  const run = opts.runExperimentFn ?? runExperiment;
  const res = await run({
    python: buildGlbImportPython(glbPath, opts.destPath, opts.assetName, {
      collision: opts.collision,
      ...(opts.scale ? { scale: opts.scale.factor } : {}),
    }),
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
  // `NO` means assets imported but none of them was a StaticMesh — a texture-only or
  // material-only result. Collision cannot be built on that, and saying so names the real
  // cause instead of reporting an absent body_setup count.
  const noStaticMesh = res.markers['POF_UE_MESH'] === 'NO';
  const collisionOk =
    !wantsCollision ||
    (!noStaticMesh && collisionElements !== undefined && Number.isFinite(collisionElements) && collisionElements > 0);
  const collisionError = collisionOk
    ? undefined
    : noStaticMesh
      ? `collision was requested (${opts.collision!.kind}) but no StaticMesh was among the imported assets — a glTF import also yields textures and materials, and collision can only be built on the mesh`
      : collisionElements === undefined
        ? `collision was requested (${opts.collision!.kind}) but the mesh reported no body_setup count — nothing observed it, so it is not claimed`
        : `collision was requested (${opts.collision!.kind}) but body_setup holds 0 elements — the mesh would fall through the world`;

  // Scale, the same stance: CLAIMED only from the extent read back off the imported bounds.
  // A build-scale call that silently did nothing leaves a 100 cm hero beside a 180 cm
  // Mannequin, so a requested scale that was not observed within tolerance fails the import.
  const rawExtent = res.markers['POF_UE_EXTENT_CM'];
  const extent = rawExtent === undefined ? undefined : Number(rawExtent);
  const observedExtentCm = extent !== undefined && Number.isFinite(extent) ? extent : undefined;
  const scaleError = opts.scale ? scaleReadBackError(opts.scale, observedExtentCm) : undefined;

  return {
    ok: res.ok && imported && collisionOk && !scaleError,
    assetPath: imported ? asset : undefined,
    ...(collisionElements !== undefined && Number.isFinite(collisionElements) ? { collisionElements } : {}),
    ...(observedExtentCm !== undefined ? { observedExtentCm } : {}),
    error:
      res.error ??
      (asset === 'NONE' ? 'no objects imported (is the glTF/Interchange importer enabled?)' : undefined) ??
      collisionError ??
      scaleError,
    logs: res.logs,
  };
}
