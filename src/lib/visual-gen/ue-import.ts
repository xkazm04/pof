/**
 * UE-import of a generated mesh — Stage 2 of the local 3D pipeline. Reuses the proven
 * Experiment Lab runner (Editor-Python mode) to run a UE glTF import in the full editor
 * (the Interchange/glTF importer is unreliable under the -run=pythonscript commandlet —
 * the editor path is the documented workaround, same as the FBX-Interchange gotcha).
 * Brings a TripoSR .glb into /Game as a Static Mesh so it's usable in the project.
 */
import { runExperiment, type ExperimentResult, type ExperimentSpec, type RunnerDeps } from '@/lib/ue-experiment/runner';

/** UE python that imports a .glb via an AssetImportTask and logs the asset path. Pure. */
export function buildGlbImportPython(glbPath: string, destPath = '/Game/Generated', assetName = 'TripoSRMesh'): string {
  const glb = glbPath.replace(/\\/g, '/');
  return [
    'task = unreal.AssetImportTask()',
    `task.filename = '${glb}'`,
    `task.destination_path = '${destPath}'`,
    `task.destination_name = '${assetName}'`,
    'task.automated = True',
    'task.replace_existing = True',
    'task.save = True',
    'unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])',
    'paths = list(task.imported_object_paths)',
    "unreal.log('POF_UE_IMPORT=' + (paths[0] if paths else 'NONE'))",
  ].join('\n');
}

export interface UeImportResult {
  ok: boolean;
  assetPath?: string;
  error?: string;
  logs: string[];
}

type RunExperimentFn = (spec: ExperimentSpec, deps?: RunnerDeps) => Promise<ExperimentResult>;

/** Import a generated .glb into the connected UE project. `runExperimentFn` is injectable
 * for tests; defaults to the real Experiment Lab runner (launches the editor). */
export async function importGlbToUE(
  glbPath: string,
  opts: { destPath?: string; assetName?: string; settleMs?: number; runExperimentFn?: RunExperimentFn } = {},
): Promise<UeImportResult> {
  const run = opts.runExperimentFn ?? runExperiment;
  const res = await run({
    python: buildGlbImportPython(glbPath, opts.destPath, opts.assetName),
    capture: false,
    settleMs: opts.settleMs ?? 180_000, // editor cold-start + import
  });
  const asset = res.markers['POF_UE_IMPORT'];
  const imported = !!asset && asset !== 'NONE';
  return {
    ok: res.ok && imported,
    assetPath: imported ? asset : undefined,
    error: res.error ?? (asset === 'NONE' ? 'no objects imported (is the glTF/Interchange importer enabled?)' : undefined),
    logs: res.logs,
  };
}
