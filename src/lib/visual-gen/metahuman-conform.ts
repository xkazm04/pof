/**
 * MetaHuman conform — the auto-rig bridge (UE 5.8, Candidate B). Takes a generated
 * humanoid mesh (.glb from Asset Forge / Hunyuan / TripoSR) and conforms the parametric
 * MetaHuman body to it, producing a fully-rigged `MetaHumanCharacter` asset — closing the
 * "generated SHAPE has no rig" gap. Reuses the Experiment Lab runner (full-editor headless
 * Python) so the whole flow runs with no interactive editor.
 *
 * Ground-truthed on the real UE 5.8.0 install (2026-07-05): imports the glb, extracts
 * topology via `MetaHumanCharacterEditorSubsystem.get_mesh_data_for_conforming`, then
 * `conform_body_to_target(...)` fits the parametric body and saves the character asset.
 * Requires the `MetaHumanCharacter` plugin enabled in the .uproject (it is, as of this change).
 *
 * NOTE on the API: the high-level `conform_to_target_meshes(character, key, params)` wrapper
 * executes headless but returns False without the interactive tool's keypoint/curve targets
 * (and the MetaHuman Optional Content). The lower-level `conform_body_to_target` — which takes
 * the extracted target vertices directly — is the proven programmatic conform, so it's what
 * this seam uses. See `docs/research/ai-to-metahuman-conform-recipe.md`.
 */
import { runExperiment, type ExperimentResult, type ExperimentSpec, type RunnerDeps } from '@/lib/ue-experiment/runner';

export interface ConformOptions {
  /** /Game path for the imported target mesh + the MetaHumanCharacter asset. */
  destPath?: string;
  /** Name of the created MetaHumanCharacter asset. */
  charName?: string;
  /** Name of the imported target Static Mesh. */
  targetMeshName?: string;
  settleMs?: number;
  runExperimentFn?: (spec: ExperimentSpec, deps?: RunnerDeps) => Promise<ExperimentResult>;
}

/**
 * UE editor-Python that imports a .glb, extracts its conform topology, creates a
 * MetaHumanCharacter, and conforms the parametric body to the mesh. Pure (no I/O) so it's
 * unit-testable; the runner wraps it in try/except + DONE and spawns the editor.
 */
export function buildConformPython(glbPath: string, opts: ConformOptions = {}): string {
  const glb = glbPath.replace(/\\/g, '/');
  const dest = opts.destPath ?? '/Game/Generated/MetaHumans';
  const charName = opts.charName ?? 'MH_Conformed';
  const meshName = opts.targetMeshName ?? 'ConformTarget';
  return [
    'task = unreal.AssetImportTask()',
    `task.filename = '${glb}'`,
    `task.destination_path = '${dest}'`,
    `task.destination_name = '${meshName}'`,
    'task.automated = True',
    'task.replace_existing = True',
    'task.save = True',
    'unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])',
    '_paths = list(task.imported_object_paths)',
    "unreal.log('POF_MH_IMPORT=' + (_paths[0] if _paths else 'NONE'))",
    '_sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)',
    '_mesh = unreal.load_asset(_paths[0]) if _paths else None',
    '_md = _sub.get_mesh_data_for_conforming(_mesh) if _mesh else None',
    '_verts = _md[0] if _md else []',
    "unreal.log('POF_MH_VERTS=' + str(len(_verts)))",
    `_char = unreal.AssetToolsHelpers.get_asset_tools().create_asset('${charName}', '${dest}', unreal.MetaHumanCharacter, unreal.MetaHumanCharacterFactoryNew()) if _md else None`,
    "unreal.log('POF_MH_CHAR=' + (_char.get_path_name() if _char else 'NONE'))",
    '_ok = False',
    'if _char:',
    '    _sub.try_add_object_to_edit(_char)',
    '    _ok = _sub.conform_body_to_target(_char, _verts, [], True, True)',
    '    _sub.commit_body_state(_char)',
    '    unreal.EditorAssetLibrary.save_loaded_asset(_char)',
    '    _sub.remove_object_to_edit(_char)',
    "unreal.log('POF_MH_CONFORMED=' + str(_ok))",
  ].join('\n');
}

export interface ConformResult {
  ok: boolean;
  /** /Game path of the conformed MetaHumanCharacter asset. */
  characterPath?: string;
  /** /Game path of the imported target Static Mesh. */
  targetMeshPath?: string;
  /** Vertex count extracted from the target mesh (0 if extraction failed). */
  vertexCount: number;
  error?: string;
  logs: string[];
}

/**
 * Conform a generated .glb into a rigged MetaHumanCharacter on the connected UE project.
 * `runExperimentFn` is injectable for tests; defaults to the real Experiment Lab runner.
 */
export async function conformMeshToMetaHuman(glbPath: string, opts: ConformOptions = {}): Promise<ConformResult> {
  const run = opts.runExperimentFn ?? runExperiment;
  const res = await run({
    python: buildConformPython(glbPath, opts),
    capture: false,
    settleMs: opts.settleMs ?? 300_000, // editor cold-start + glb import + body solve
  });
  const imported = res.markers['POF_MH_IMPORT'];
  const charPath = res.markers['POF_MH_CHAR'];
  const conformed = res.markers['POF_MH_CONFORMED'] === 'True';
  const vertexCount = Number(res.markers['POF_MH_VERTS'] ?? '0') || 0;
  const hasChar = !!charPath && charPath !== 'NONE';
  const hasImport = !!imported && imported !== 'NONE';
  return {
    ok: res.ok && conformed && hasChar,
    characterPath: hasChar ? charPath : undefined,
    targetMeshPath: hasImport ? imported : undefined,
    vertexCount,
    error: res.error ?? (!hasImport ? 'glb import produced no asset' : !conformed ? 'conform_body_to_target returned False' : undefined),
    logs: res.logs,
  };
}

export interface AssembleOptions {
  /** Override the assembled MetaHuman's name (MetaHumanCharacterEditorBuildParameters.name_override). */
  nameOverride?: string;
  settleMs?: number;
  runExperimentFn?: (spec: ExperimentSpec, deps?: RunnerDeps) => Promise<ExperimentResult>;
}

/**
 * UE editor-Python that assembles a conformed MetaHumanCharacter into a usable MetaHuman.
 * `can_build_meta_human(char, True)` gates the assembly and logs the blocking reason — verified
 * live to return False + "texture synthesis data … does not contain valid data" when the
 * MetaHuman Optional Content ("MetaHuman Creator Core Data", an Epic Launcher download) is absent.
 *
 * PREREQUISITES (both external to this seam):
 *  - MetaHuman Optional Content installed (Epic Launcher → UE 5.8 → Options → "MetaHuman Creator
 *    Core Data") — without it `can_build` is False and this reports the reason.
 *  - Online + Epic auth: auto-rigging (`request_auto_rigging`) and texture synthesis run on Epic's
 *    CLOUD servers, so a fully-textured, auto-rigged assemble is NOT a pure-local-headless step.
 * Pure (no I/O); the runner wraps it in try/except + DONE and spawns the editor.
 */
export function buildAssemblePython(characterPath: string, opts: AssembleOptions = {}): string {
  const cp = characterPath.replace(/\\/g, '/');
  const nameLine = opts.nameOverride
    ? [`    _p.set_editor_property('name_override', '${opts.nameOverride}')`]
    : [];
  return [
    '_sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)',
    `_char = unreal.load_asset('${cp}')`,
    "unreal.log('POF_MH_CHAR=' + (_char.get_path_name() if _char else 'NONE'))",
    '_can = False',
    '_assembled = False',
    'if _char:',
    '    _sub.try_add_object_to_edit(_char)',
    '    _can = _sub.can_build_meta_human(_char, True)',
    "    unreal.log('POF_MH_CAN_BUILD=' + str(_can))",
    '    if _can:',
    '        _p = unreal.MetaHumanCharacterEditorBuildParameters()',
    ...nameLine,
    '        _sub.build_meta_human(_char, _p)',
    '        unreal.EditorAssetLibrary.save_loaded_asset(_char)',
    '        _assembled = True',
    '    _sub.remove_object_to_edit(_char)',
    "unreal.log('POF_MH_ASSEMBLED=' + str(_assembled))",
  ].join('\n');
}

export interface AssembleResult {
  ok: boolean;
  /** Whether the character passed `can_build_meta_human` (assemble-ready). */
  canBuild: boolean;
  /** Whether `build_meta_human` ran and the asset was saved. */
  assembled: boolean;
  error?: string;
  logs: string[];
}

/**
 * Assemble a conformed MetaHumanCharacter. Gated by `can_build_meta_human`; when the MetaHuman
 * Optional Content is missing this returns `{canBuild:false}` with the reason surfaced in `logs`.
 */
export async function assembleMetaHuman(characterPath: string, opts: AssembleOptions = {}): Promise<AssembleResult> {
  const run = opts.runExperimentFn ?? runExperiment;
  const res = await run({
    python: buildAssemblePython(characterPath, opts),
    capture: false,
    settleMs: opts.settleMs ?? 300_000,
  });
  const canBuild = res.markers['POF_MH_CAN_BUILD'] === 'True';
  const assembled = res.markers['POF_MH_ASSEMBLED'] === 'True';
  return {
    ok: res.ok && assembled,
    canBuild,
    assembled,
    error: res.error ?? (!canBuild
      ? 'not assemble-ready (can_build_meta_human=False) — install the MetaHuman Optional Content (Epic Launcher → UE 5.8 → Options → "MetaHuman Creator Core Data"); see logs for the exact reason'
      : !assembled ? 'build_meta_human did not complete' : undefined),
    logs: res.logs,
  };
}
