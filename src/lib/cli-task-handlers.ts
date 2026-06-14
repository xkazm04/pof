/**
 * Per-task-type prompt builders for {@link buildTaskPrompt}.
 *
 * This module is a pure extraction of the former 540-line `switch` in
 * `cli-task.ts`: each task type's old `case` body lives here verbatim as a
 * focused handler, keyed by {@link CLITaskType} in {@link taskPromptHandlers}.
 * `buildTaskPrompt` computes the shared setup (`isUE5`, `knownAssetDomains`,
 * `wiringBlock`) once and dispatches through the map. The per-type logic —
 * prompt text, `registerCallback` calls, and asset logic — is unchanged, so
 * the assembled prompt for every task type is byte-for-byte identical to the
 * pre-extraction output.
 */

import type { ProjectContext } from '@/lib/prompt-context';
import {
  buildProjectContextHeader,
  getModuleDomainContext,
  getModuleName,
} from '@/lib/prompt-context';
import { buildEvalPrompt } from '@/lib/evaluator/module-eval-prompts';
import { getModuleChecklist } from '@/lib/module-registry';
import { buildVisualCheckSection } from '@/lib/prompts/visual-check';
import { getRecipe, STEP_TO_LIFECYCLE } from '@/lib/catalog/recipe';
import { trackLabel, trackHint } from '@/lib/pipeline/tracks';
import { buildAbilitySpecDraftPrompt } from '@/lib/ability/logic-prompts';
import { buildGenerateAbilityBundlePrompt } from '@/lib/ability/effect-codegen-prompt';
import { buildRunTestsPrompt, buildMockStimuliPrompt } from '@/lib/prompts/ai-testing';

import {
  registerCallback,
  getCallback,
  buildCallbackSection,
  type CLITask,
  type CLITaskType,
  type ChecklistTask,
  type FeatureFixTask,
  type FeatureReviewTask,
  type ModuleScanTask,
  type WBPStarterTask,
  type ProcgenDungeonTask,
  type BiomeScatterTask,
  type MixamoImportTask,
  type CharacterSetupTask,
  type AudioImportTask,
  type GenerateTask,
  type EvaluateTrackTask,
  type DraftAbilitySpecTask,
  type GenerateGasEffectsTask,
  type RunAITestsTask,
  type DetectStimuliTask,
} from '@/lib/cli-task';

/**
 * Shared setup computed once by {@link buildTaskPrompt} before dispatch and
 * passed to each handler — exactly the values that lived in the local scope of
 * the original `switch` (so each handler body can stay verbatim).
 */
export interface TaskPromptShared {
  /** Whether the project targets UE5 (drives domain/wiring/asset sections). */
  isUE5: boolean;
  /** Known asset domains for the task's module (empty for non-UE5). */
  knownAssetDomains: string[];
  /** Pre-assembled Wiring Requirements block ('' when not applicable). */
  wiringBlock: string;
}

/** A per-task-type prompt builder. Returns the fully assembled prompt string. */
export type TaskPromptHandler = (
  task: CLITask,
  ctx: ProjectContext,
  shared: TaskPromptShared,
) => string;

// ── Per-task-type handlers (verbatim from the former switch) ─────────────────

const checklist: TaskPromptHandler = (task, ctx, { isUE5, knownAssetDomains, wiringBlock }) => {
  const ct = task as ChecklistTask;
  const header = buildProjectContextHeader(ctx, { knownAssetDomains });
  const domainContext = isUE5 ? getModuleDomainContext(task.moduleId) : undefined;
  const domainSection = domainContext
    ? `\n\n## Domain Context\n${domainContext}`
    : '';

  const cbId = registerCallback({
    url: `${ct.appOrigin}/api/checklist/complete`,
    method: 'POST',
    staticFields: {
      moduleId: task.moduleId,
      itemId: ct.itemId,
      projectPath: ctx.projectPath,
    },
    schemaHint: '  "completed": true',
  });

  const itemDef = getModuleChecklist(task.moduleId).find((i) => i.id === ct.itemId);
  const visualBlock =
    isUE5 && itemDef?.visualCheck
      ? `\n\n${buildVisualCheckSection({
          projectPath: ctx.projectPath,
          appOrigin: ct.appOrigin,
          moduleId: task.moduleId,
          itemId: ct.itemId,
        })}`
      : '';

  const lightingBlock =
    isUE5 && itemDef?.lightingCheck
      ? `\n\n${buildVisualCheckSection({
          projectPath: ctx.projectPath,
          appOrigin: ct.appOrigin,
          moduleId: task.moduleId,
          itemId: ct.itemId,
          mode: 'lighting',
        })}`
      : '';

  const characterBlock =
    isUE5 && itemDef?.characterCheck
      ? `\n\n${buildVisualCheckSection({
          projectPath: ctx.projectPath,
          appOrigin: ct.appOrigin,
          moduleId: task.moduleId,
          itemId: ct.itemId,
          mode: 'character',
        })}`
      : '';

  return `${header}${domainSection}\n\n## Task\n${task.prompt}${wiringBlock}\n\n${buildCallbackSection(getCallback(cbId)!)}${visualBlock}${lightingBlock}${characterBlock}`;
};

const quickActionOrAskClaude: TaskPromptHandler = (task, ctx, { isUE5, knownAssetDomains, wiringBlock }) => {
  const header = buildProjectContextHeader(ctx, { knownAssetDomains });
  const domainContext = isUE5 ? getModuleDomainContext(task.moduleId) : undefined;
  const domainSection = domainContext
    ? `\n\n## Domain Context\n${domainContext}`
    : '';
  return `${header}${domainSection}\n\n## Task\n${task.prompt}${wiringBlock}`;
};

const featureFix: TaskPromptHandler = (task, ctx, { isUE5, knownAssetDomains, wiringBlock }) => {
  const ft = task as FeatureFixTask;
  const header = buildProjectContextHeader(ctx, { knownAssetDomains });
  const domainContext = isUE5 ? getModuleDomainContext(task.moduleId) : undefined;
  const domainSection = domainContext
    ? `\n\n## Domain Context\n${domainContext}`
    : '';
  const fileSection =
    ft.filePaths.length > 0
      ? `\n\n## Relevant Files\n${ft.filePaths.map((fp) => `- ${fp}`).join('\n')}\n\nStart by reading these files to understand the current implementation.`
      : '';
  const qualityNote =
    ft.qualityScore != null ? ` (current quality: ${ft.qualityScore}/5)` : '';

  const cbId = registerCallback({
    url: `${ft.appOrigin}/api/feature-matrix`,
    method: 'PATCH',
    staticFields: {
      moduleId: ft.moduleId,
      featureName: ft.featureName,
      status: 'improved',
    },
    schemaHint: '  "completed": true',
  });

  return `${header}${domainSection}\n${fileSection}\n\n## Task: Improve "${ft.featureName}"\n\nCurrent status: **${ft.status}**${qualityNote}\n\n### What needs to be done\n${ft.nextSteps}\n\nImplement all the improvements listed above. Work through them methodically — read existing code first, then make targeted changes. The goal is to bring this feature to production quality (5/5).${wiringBlock}\n\n### Completion\n\nAfter you have completed **all** improvements and verified they compile correctly, mark the feature as improved.\n\n${buildCallbackSection(getCallback(cbId)!)}`;
};

const featureReview: TaskPromptHandler = (task, ctx, { isUE5 }) => {
  const rt = task as FeatureReviewTask;
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    includeBuildCommand: false,
    includeRules: false,
  });
  const domainContext = isUE5 ? getModuleDomainContext(task.moduleId) : undefined;
  const domainSection = domainContext
    ? `\n\n## Domain Context\n${domainContext}`
    : '';
  const featureList = rt.features
    .map((f, i) => `${i + 1}. **${f.featureName}** [${f.category}]: ${f.description}`)
    .join('\n');

  const cbId = registerCallback({
    url: `${rt.appOrigin}/api/feature-matrix/import`,
    method: 'POST',
    staticFields: {
      moduleId: task.moduleId,
    },
    schemaHint: `  "reviewedAt": "<ISO timestamp>",
  "features": [
    {
      "featureName": "<exact name from list>",
      "category": "<category>",
      "status": "implemented|partial|missing|unknown",
      "description": "<your description of what exists>",
      "filePaths": ["${isUE5 ? 'Source/path/to/File.h' : 'src/path/to/file.ts'}"],
      "reviewNotes": "<brief explanation>",
      "qualityScore": <1-5 or null if missing>,
      "nextSteps": "<concrete actions to reach pro quality>"
    }
  ]`,
  });

  const searchInstr = isUE5
    ? `1. For each feature, search Source/${moduleName}/ for relevant C++ classes, headers, and config.`
    : `1. For each feature, search the project source code for relevant implementations.`;

  const qualityRef = isUE5
    ? '   - **5**: Pro / production-grade — robust, optimized, follows UE best practices'
    : '   - **5**: Pro / production-grade — robust, optimized, follows best practices';

  const reviewRules = isUE5
    ? `### Rules
- Do NOT modify any project files — this is a read-only review.
- Do NOT use TodoWrite or Task/Explore tools.
- Do NOT write any files to disk — submit results using the callback format below.`
    : `### Rules
- Do NOT modify any project files — this is a read-only review.
- Do NOT write any files to disk — submit results using the callback format below.`;

  return `${header}${domainSection}

## Task: Feature Review for "${rt.moduleLabel}"

Scan the project source code and determine the implementation status of each feature listed below.

### Features to Check
${featureList}

### Instructions
${searchInstr}
2. Determine the status:
   - **implemented**: Feature is fully present and functional code exists
   - **partial**: Some parts exist but incomplete (e.g., class exists but methods are empty)
   - **missing**: No evidence of this feature in the codebase
   - **unknown**: Cannot determine
3. Record file paths (relative to project root) that contain the implementation.
4. Write brief review notes explaining your assessment.
5. Assign a **qualityScore** from 1 to 5 measuring production readiness:
   - **1**: Stub / placeholder only — no real logic
   - **2**: Basic skeleton — compiles but lacks core behavior
   - **3**: Functional — works for basic cases, needs polish
   - **4**: Solid — handles edge cases, good structure, minor gaps
${qualityRef}
   For missing features, use \`null\`.
6. Write **nextSteps**: a concise list of what is needed to reach quality 5 (pro-grade). Focus on concrete actions: missing methods, unhandled edge cases, performance gaps, best practices not yet followed. For features already at 5, write "None — production ready." For missing features, describe what needs to be built from scratch.

${reviewRules}

Include ALL features from the list, even if missing. Use the EXACT featureName strings.

${buildCallbackSection(getCallback(cbId)!)}`;
};

const moduleScan: TaskPromptHandler = (task, ctx) => {
  const st = task as ModuleScanTask;
  const moduleName = getModuleName(ctx.projectName);
  const sourcePath = `Source/${moduleName}/`;
  const passPrompts = st.passes.map((pass) =>
    buildEvalPrompt({
      moduleId: task.moduleId,
      pass,
      projectName: ctx.projectName,
      moduleName,
      sourcePath,
    }),
  );
  const combinedPassPrompt = passPrompts.join('\n\n---\n\n');
  const previousSection = st.previousFindings
    ? `\n\n## Previous Findings (for context)\nThese issues were found in a previous scan. Focus on NEW issues or verify whether these have been fixed:\n${st.previousFindings}`
    : '';

  const cbId = registerCallback({
    url: `${st.appOrigin}/api/module-scan/import`,
    method: 'POST',
    staticFields: {
      moduleId: task.moduleId,
    },
    schemaHint: `  "findings": [
    {
      "pass": "structure|quality|performance",
      "category": "string",
      "severity": "critical|high|medium|low",
      "file": "relative/path.h or null",
      "line": null,
      "description": "what the issue is",
      "suggestedFix": "specific fix",
      "effort": "trivial|small|medium|large"
    }
  ]`,
  });

  return `${combinedPassPrompt}${previousSection}

${buildCallbackSection(getCallback(cbId)!)}`;
};

const wbpStarter: TaskPromptHandler = (task, ctx) => {
  const wt = task as WBPStarterTask;
  const header = buildProjectContextHeader(ctx);
  const cls = wt.targetClass;
  const name = cls.replace(/^U/, '');
  return `${header}

## Task: Scaffold a Widget Blueprint stub for \`${cls}\`

\`${cls}\` is a C++ UUserWidget that uses \`UPROPERTY(meta=(BindWidget))\` members, so it cannot run without a companion Widget Blueprint authored in the UMG editor — and the widget tree itself cannot be created from Python. Scaffold the stub asset plus a wiring README so the operator can finish it by hand.

1. **Find and read the header** for \`${cls}\` under \`Source/\` (e.g. \`Source/PoF/UI/${name}.h\`).
2. **Extract the bind targets**: every \`UPROPERTY(meta=(BindWidget))\` and \`UPROPERTY(meta=(BindWidgetOptional))\` member. Record each property name, its \`UWidget\` subtype (UProgressBar, UTextBlock, UImage, UCanvasPanel, …), and whether it is required (BindWidget) or optional (BindWidgetOptional).
3. **Create the stub WBP via the full editor.** Do NOT use \`-run=pythonscript\` — that commandlet path is unreliable for asset creation. Use the full editor with \`-ExecutePythonScript=\` instead:
   \`& "<UnrealEditor.exe>" "<the .uproject in ${ctx.projectPath}>" -ExecutePythonScript="<your script>"\`
   The Python should:
   - build \`factory = unreal.WidgetBlueprintFactory()\` and set its parent class to \`${cls}\` (\`unreal.load_class(None, "/Script/PoF.${name}")\`, adjusting the module path if needed);
   - call \`unreal.AssetToolsHelpers.get_asset_tools().create_asset("WBP_${name}", "/Game/UI", unreal.WidgetBlueprint, factory)\`;
   - save the new asset. The result is an empty shell — that is expected; Python cannot author the widget tree or resolve BindWidget names.
4. **Write the wiring README** to \`Source/PoF/UI/WBP_${name}.README.md\` containing:
   - the parent C++ class (\`${cls}\`) and the WBP asset path (\`/Game/UI/WBP_${name}\`);
   - a markdown table with one row per bind target: \`| Property name | Widget type | Required? | Suggested parent/slot |\`;
   - a "How to finish in the UMG editor" section: open the WBP, add each child widget using the EXACT property name (BindWidget resolves by name), parent them under a root Canvas Panel, then compile.
5. **Report** a one-paragraph summary: the WBP asset path, how many bind targets were found, and the README path.

This is a scaffold only — laying out the widget tree is the operator's manual UMG-editor step. Do not attempt the tree from Python.`;
};

const procgenDungeon: TaskPromptHandler = (task, ctx) => {
  const pt = task as ProcgenDungeonTask;
  const header = buildProjectContextHeader(ctx);
  const cbId = registerCallback({
    url: `${pt.appOrigin}/api/level-design/procgen-result`,
    method: 'POST',
    staticFields: { moduleId: task.moduleId, seed: pt.seed },
    schemaHint: '  "roomCount": <number of rooms the generator reported>',
  });
  return `${header}

## Task: Generate a procedural dungeon with ARPGLevelGenerator

Run the existing placement script \`build_procgen_dungeon.py\` to bake a fresh
multi-room dungeon into \`/Game/Maps/ProcGenDungeon\` with these parameters:
- Room count: **${pt.roomCount}**
- Seed: **${pt.seed}**

Steps:
1. Find the \`.uproject\` under \`${ctx.projectPath}\` and the script at
   \`${ctx.projectPath}/Content/Python/build_procgen_dungeon.py\`.
2. Run it via the FULL editor with the params as environment variables — NOT
   \`-run=pythonscript\`. PowerShell:
   \`$env:PROCGEN_ROOMS=${pt.roomCount}; $env:PROCGEN_SEED=${pt.seed}; & "<UnrealEditor.exe>" "<.uproject>" -ExecutePythonScript="<the script path above>" -unattended -nopause -nosplash\`
3. The headless editor exits non-zero on a benign shutdown crash — judge success
   by the LOG, not the exit code. In the newest \`Saved/Logs/PoF*.log\`, find the
   line \`[LevelGenerator] ... Generated N rooms\` and \`Baked N BlockoutRoom actors\`.
4. Submit the generated room count via the callback below.

${buildCallbackSection(getCallback(cbId)!)}`;
};

const biomeScatter: TaskPromptHandler = (task, ctx) => {
  const st = task as BiomeScatterTask;
  const header = buildProjectContextHeader(ctx);
  const cbId = registerCallback({
    url: `${st.appOrigin}/api/level-design/scatter-result`,
    method: 'POST',
    staticFields: { moduleId: task.moduleId, seed: st.seed },
    schemaHint: '  "instanceCount": <number of instances the scatter reported>',
  });
  return `${header}

## Task: Scatter the arena floor with props (AARPGVegetationScatter)

Run the placement script \`scatter_biome_ue.py\` to author the biome + scatter
greybox props onto \`/Game/Maps/VerticalSlice\`'s arena floor, with:
- Density multiplier: **${st.density}**
- Seed: **${st.seed}**

Steps:
1. Find the \`.uproject\` under \`${ctx.projectPath}\` and the script at
   \`${ctx.projectPath}/Content/Python/scatter_biome_ue.py\`.
2. Run it via the FULL editor with the params as environment variables — NOT
   \`-run=pythonscript\`. PowerShell:
   \`$env:SCATTER_DENSITY=${st.density}; $env:SCATTER_SEED=${st.seed}; & "<UnrealEditor.exe>" "<.uproject>" -ExecutePythonScript="<the script path above>" -unattended -nopause -nosplash\`
3. The headless editor exits non-zero on a benign shutdown crash — judge by the
   LOG. In the newest \`Saved/Logs/PoF*.log\`, find \`[scatter_biome] Scattered N instances\`.
4. Submit the instance count via the callback below.

${buildCallbackSection(getCallback(cbId)!)}`;
};

const mixamoImport: TaskPromptHandler = (task, ctx) => {
  const mt = task as MixamoImportTask;
  const header = buildProjectContextHeader(ctx);
  const cbId = registerCallback({
    url: `${mt.appOrigin}/api/animations/mixamo-result`,
    method: 'POST',
    staticFields: { moduleId: task.moduleId, importDir: mt.importDir },
    schemaHint: '  "importedCount": <number of animations imported + retargeted>',
  });
  return `${header}

## Task: Import + retarget Mixamo animations (mixamo_pipeline.py)

The operator has downloaded animations from Mixamo and dropped the FBX files into
a watched folder. Run the project's import/retarget pipeline over them.

**Manual-download contract (verify the FBX, do not re-download):**
- Files come from mixamo.com as **FBX Binary**, 30 FPS, one animation per file.
- The first/character download is "**With Skin**" (creates the mesh+skeleton);
  every animation is "**Without Skin**" to reuse one skeleton.
- Locomotion (idle/walk/run) is "**In Place**"; attacks/dodges keep root motion.
- Mixamo bones use the \`mixamorig:\` prefix — the pipeline strips/handles it on import.

**Run the pipeline:**
1. Find the \`.uproject\` under \`${ctx.projectPath}\` and the script at
   \`${ctx.projectPath}/Content/Python/mixamo_pipeline.py\`.
2. Run it via the FULL editor with the import dir + target skeleton as environment
   variables — NOT \`-run=pythonscript\` (the Interchange FBX path crashes there).
   PowerShell:
   \`$env:MIXAMO_IMPORT_DIR="${mt.importDir}"; $env:MIXAMO_TARGET_SKELETON="${mt.targetSkeleton}"; & "<UnrealEditor.exe>" "<.uproject>" -ExecutePythonScript="<the script path above>" -unattended -nopause -nosplash\`
3. The headless editor exits non-zero on a benign shutdown crash — judge by the
   LOG, not the exit code. In the newest \`Saved/Logs/PoF*.log\`, find the pipeline's
   \`unreal.ScopedSlowTask\` progress lines and the final imported/retargeted count.
4. Submit the imported animation count via the callback below.

${buildCallbackSection(getCallback(cbId)!)}`;
};

const characterSetup: TaskPromptHandler = (task, ctx, { knownAssetDomains }) => {
  const cst = task as CharacterSetupTask;
  const header = buildProjectContextHeader(ctx, { knownAssetDomains });
  const sourceNote =
    cst.source === 'mannequin'
      ? 'Source = **UE Mannequin** (MoverTests plugin — free, no download). Enable the `MoverTests` plugin if it is not already enabled, then trigger an asset-registry rescan of `/MoverTests` before referencing its assets (newly-enabled plugin content is invisible until rescanned).'
      : cst.source === 'mixamo'
        ? 'Source = **Mixamo**. The skeletal mesh + retargeted animations come from the Mixamo import step (see the Animations module). Use the imported mesh/skeleton paths if they differ from the defaults below.'
        : 'Source = **Custom (Blender)**. The skeletal mesh is the Blender-exported + UE-imported asset; ensure it imported at unit scale 1.0 before wiring.';

  return `${header}

## Task: Wire the slice characters (setup_characters_ue.py)

Assign the chosen rigged mesh + AnimBP to the player and enemy pawns, and apply
the enemy's contrast material — the wiring step of the character-source wizard.

${sourceNote}

**Assets to wire (use these EXACT paths — do not invent):**
- Player skeletal mesh: \`${cst.playerMesh}\`
- Enemy skeletal mesh: \`${cst.enemyMesh}\`
- Animation Blueprint: \`${cst.animBlueprint}\`
- Enemy material (strong contrast): \`${cst.enemyMaterial}\`

**Run the wiring script:**
1. Find the \`.uproject\` under \`${ctx.projectPath}\` and the script at
   \`${ctx.projectPath}/Content/Python/setup_characters_ue.py\`.
2. Run it via the FULL editor with the asset paths as environment variables —
   NOT \`-run=pythonscript\`. PowerShell:
   \`$env:CHAR_SOURCE="${cst.source}"; $env:CHAR_PLAYER_MESH="${cst.playerMesh}"; $env:CHAR_ENEMY_MESH="${cst.enemyMesh}"; $env:CHAR_ANIMBP="${cst.animBlueprint}"; $env:CHAR_ENEMY_MATERIAL="${cst.enemyMaterial}"; & "<UnrealEditor.exe>" "<.uproject>" -ExecutePythonScript="<the script path above>" -unattended -nopause -nosplash\`
3. Set the SkeletalMesh + AnimClass on the **placed instances** in the slice map,
   not only the Blueprint CDO — a Python session can bake the native default into
   the .umap and silently override the CDO at runtime. The standard mannequin
   mesh offset is (0,0,-90) with yaw -90.
4. Build if any C++ changed, then report what was wired. Verification is the
   separate "Verify character locomotes" step (an agentic screenshot + Gemini
   humanoid/pose check) — you do NOT need to add a callback here.`;
};

const audioImport: TaskPromptHandler = (task, ctx, { knownAssetDomains }) => {
  const at = task as AudioImportTask;
  const header = buildProjectContextHeader(ctx, { knownAssetDomains });
  const cbId = registerCallback({
    url: `${at.appOrigin}/api/audio/import-result`,
    method: 'POST',
    staticFields: {
      setName: at.setName,
      eventKey: at.eventKey,
      surface: at.surface,
    },
    schemaHint: '  "assetsImported": 3,\n  "cuePath": "/Game/Audio/footstep-stone/SC_footstep_stone",\n  "wiredEvent": "AnimNotify_FootstepEffect|stone"',
  });

  const assetsArg = at.assets.map((a) => a.srcAbsPath).join(';');
  const editorExe = 'C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor.exe';

  return `${header}

## Task: Import audio set into UE (import_audio_set.py)

Import the **${at.setName}** set into the UE project as USoundWaves + a
randomising USoundCue, and (best-effort) wire it to the corresponding
AnimNotify.

1. From the UE project root, set the env vars then run the FULL editor with
   \`-ExecutePythonScript\` (PowerShell):
   \`$env:AUDIO_SET_NAME="${at.setName}"; $env:AUDIO_EVENT_KEY="${at.eventKey ?? ''}"; $env:AUDIO_SURFACE="${at.surface ?? ''}"; $env:AUDIO_SOURCES="${assetsArg}"; & "${editorExe}" "<the .uproject>" -ExecutePythonScript="Content/Python/import_audio_set.py" -unattended -nopause -nosplash\`
2. Read the script's final \`[import_audio_set] DONE\` line: it prints
   \`assetsImported=N cuePath=/Game/Audio/<set>/SC_<set> wiredEvent=<name|null>\`.
3. Submit the result via @@CALLBACK:

${buildCallbackSection(getCallback(cbId)!)}`;
};

const generate: TaskPromptHandler = (task, ctx) => {
  const gt = task as GenerateTask;
  const recipe = getRecipe(gt.entity.catalogId);
  if (!recipe) return gt.entity.name; // no recipe registered — nothing to dispatch
  const base = recipe.buildStepPrompt(gt.entity, gt.step, ctx);
  const cbId = registerCallback({
    url: `${gt.appOrigin}/api/catalog`,
    method: 'POST',
    staticFields: {
      action: 'transition',
      catalogId: gt.entity.catalogId,
      entityId: gt.entity.id,
      nextLifecycle: STEP_TO_LIFECYCLE[gt.step],
    },
    schemaHint:
      '  "ueAssets": ["<UE asset path(s) you created/modified>"],\n' +
      '  "testResult": "pass|fail"  // only required for the verify step',
  });
  return `${base}\n\n${buildCallbackSection(getCallback(cbId)!)}`;
};

const evaluateTrack: TaskPromptHandler = (task, ctx) => {
  const et = task as EvaluateTrackTask;
  const label = trackLabel(et.trackId);
  const base =
    `Evaluate the "${label}" production track for the ${et.entity.catalogId} entity "${et.entity.name}".\n\n` +
    `Track scope: ${trackHint(et.trackId)}\n\n` +
    `Assess what exists today (in the UE project + this catalog entity's data), then judge ` +
    `whether the "${label}" track is not-started / in-progress / done / blocked, and list the ` +
    `concrete next steps to bring it to a playable "done" state. Be specific about file paths, ` +
    `asset names, and which existing PoF systems to reuse.`;
  const cbId = registerCallback({
    url: `${et.appOrigin}/api/pipeline`,
    method: 'POST',
    staticFields: {
      catalogId: et.entity.catalogId,
      entityId: et.entity.id,
      trackId: et.trackId,
    },
    schemaHint:
      '  "state": "not-started|in-progress|done|blocked",  // your assessed coverage of this track\n' +
      '  "note": "<one-line summary of current state / the key next step>"',
  });
  return `${base}\n\n${buildCallbackSection(getCallback(cbId)!)}`;
};

const draftAbilitySpec: TaskPromptHandler = (task, ctx) => {
  const dt = task as DraftAbilitySpecTask;
  const base = buildAbilitySpecDraftPrompt(dt.ref, dt.instruction);
  const cbId = registerCallback({
    url: `${dt.appOrigin}/api/ability-spec`,
    method: 'POST',
    staticFields: { catalogId: dt.catalogId, entityId: dt.entityId },
    schemaHint:
      '  "effects": [\n' +
      '    { "id": "<id>", "name": "GE_<Name>", "duration": "instant|duration|infinite", "durationSec": 0, "cooldownSec": 0, "color": "#rrggbb", "modifiers": [{ "attribute": "Health", "operation": "add|multiply", "magnitude": 0 }], "grantedTags": [] }\n' +
      '  ],\n' +
      '  "tagRules": [\n' +
      '    { "id": "<id>", "sourceTag": "<tag>", "targetTag": "State.Dead", "type": "blocks|cancels|requires" }\n' +
      '  ]',
  });
  return `${base}\n\n${buildCallbackSection(getCallback(cbId)!)}`;
};

const generateGasEffects: TaskPromptHandler = (task, ctx, { knownAssetDomains }) => {
  const gt = task as GenerateGasEffectsTask;
  const header = buildProjectContextHeader(ctx, { knownAssetDomains });
  const body = buildGenerateAbilityBundlePrompt(gt.ref, gt.effects, gt.tagRules, gt.scalars);
  return `${header}\n\n## Task\n${body}`;
};

const runAITests: TaskPromptHandler = (task, ctx) => {
  const rt = task as RunAITestsTask;
  const base = buildRunTestsPrompt(rt.suite, ctx);
  const cbId = registerCallback({
    url: `${rt.appOrigin}/api/ai-testing`,
    method: 'POST',
    staticFields: { action: 'record-run-results' },
    schemaHint:
      '  "results": [\n' +
      '    { "scenarioId": <id from the scenario list>, "status": "passed|failed|error", "output": "<pass summary or failure reason>" }\n' +
      '  ]',
  });
  return `${base}\n\n${buildCallbackSection(getCallback(cbId)!)}`;
};

const detectStimuli: TaskPromptHandler = (task, ctx) => {
  const dt = task as DetectStimuliTask;
  const base = buildMockStimuliPrompt(dt.scenarioDescription, dt.targetClass, ctx);
  const cbId = registerCallback({
    url: `${dt.appOrigin}/api/ai-testing`,
    method: 'POST',
    staticFields: { action: 'apply-stimuli', scenarioId: dt.scenarioId },
    schemaHint:
      '  "stimuli": [ { "id": "<unique-id>", "type": "<stimulus type>", "label": "<label>", "description": "<what it does>", "params": {} } ],\n' +
      '  "expectedActions": [ { "id": "<unique-id>", "action": "<what the BT should do>", "btNode": "", "timeoutSeconds": 5 } ]',
  });
  return `${base}\n\n${buildCallbackSection(getCallback(cbId)!)}`;
};

/**
 * Registry of per-task-type prompt builders, keyed by {@link CLITaskType}.
 *
 * `quick-action` and `ask-claude` share the same builder (they fused into one
 * `case` in the original switch). Any type not present here falls back to the
 * `default` branch in {@link buildTaskPrompt} (returns `task.prompt`).
 */
export const taskPromptHandlers: Record<CLITaskType, TaskPromptHandler> = {
  'checklist': checklist,
  'quick-action': quickActionOrAskClaude,
  'ask-claude': quickActionOrAskClaude,
  'feature-fix': featureFix,
  'feature-review': featureReview,
  'module-scan': moduleScan,
  'wbp-starter': wbpStarter,
  'procgen-dungeon': procgenDungeon,
  'biome-scatter': biomeScatter,
  'mixamo-import': mixamoImport,
  'character-setup': characterSetup,
  'audio-import': audioImport,
  'generate': generate,
  'evaluate-track': evaluateTrack,
  'draft-ability-spec': draftAbilitySpec,
  'generate-gas-effects': generateGasEffects,
  'run-ai-tests': runAITests,
  'detect-stimuli': detectStimuli,
};
