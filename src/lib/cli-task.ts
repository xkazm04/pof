/**
 * Unified CLI task abstraction.
 *
 * Every CLI invocation — checklist run, quick action, ask-claude, feature fix,
 * feature review — is represented as a CLITask. The TaskFactory methods handle
 * context injection and prompt assembly so callers never build prompts manually.
 */

import type { SubModuleId } from '@/types/modules';
import type { ProjectContext } from '@/lib/prompt-context';
import {
  buildProjectContextHeader,
  getModuleDomainContext,
  getModuleName,
} from '@/lib/prompt-context';
import { type FeatureDefinition, getWiringAssets } from '@/lib/feature-definitions';
import { formatWiringRequirements } from '@/lib/knowledge/wiring-requirements';
import { buildEvalPrompt, type EvalPass } from '@/lib/evaluator/module-eval-prompts';
import { getModuleChecklist } from '@/lib/module-registry';
import { buildVisualCheckSection } from '@/lib/prompts/visual-check';
import { knownAssetDomainsForModule } from '@/lib/knowledge/ue-known-assets';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { getRecipe, STEP_TO_LIFECYCLE, type GenerationStep } from '@/lib/catalog/recipe';
import { trackLabel, trackHint, type PipelineTrackId } from '@/lib/pipeline/tracks';
import { buildAbilitySpecDraftPrompt, type AbilityRef } from '@/lib/ability/logic-prompts';
import { buildGenerateAbilityBundlePrompt } from '@/lib/ability/effect-codegen-prompt';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';

// ── Task callback system ────────────────────────────────────────────────────

/**
 * Structured callback descriptor — replaces embedded curl commands.
 *
 * When a task has a callback, the prompt tells Claude to emit a JSON block
 * wrapped in a `@@CALLBACK:<id>` marker. The terminal intercepts the output,
 * validates the JSON, merges `staticFields`, and POSTs it to `url`.
 */
export interface TaskCallback {
  /** Unique callback ID (auto-generated) */
  id: string;
  /** API endpoint to POST results to */
  url: string;
  /** HTTP method (default POST) */
  method: 'POST' | 'PATCH';
  /** Static fields merged into the payload before submission (e.g. moduleId) */
  staticFields: Record<string, unknown>;
  /** Human-readable description of the expected JSON shape for the prompt */
  schemaHint: string;
}

let _callbackCounter = 0;

/** In-memory callback registry — keyed by callback ID */
const _callbackRegistry = new Map<string, TaskCallback>();

/** Register a callback and return its ID. */
export function registerCallback(cb: Omit<TaskCallback, 'id'>): string {
  const id = `cb-${Date.now()}-${++_callbackCounter}`;
  const entry: TaskCallback = { ...cb, id };
  _callbackRegistry.set(id, entry);
  return id;
}

/** Look up a registered callback by ID. Returns undefined if not found. */
export function getCallback(id: string): TaskCallback | undefined {
  return _callbackRegistry.get(id);
}

/** Remove a callback after it has been resolved. */
export function removeCallback(id: string): void {
  _callbackRegistry.delete(id);
}

/**
 * Build the prompt section that tells Claude how to submit structured results.
 * Replaces the old embedded curl commands with a marker-based system.
 */
function buildCallbackSection(cb: TaskCallback): string {
  const staticNote = Object.keys(cb.staticFields).length > 0
    ? `\nThe following fields will be added automatically — do NOT include them:\n${Object.entries(cb.staticFields).map(([k, v]) => `- \`${k}\`: \`${JSON.stringify(v)}\``).join('\n')}`
    : '';

  return `## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
\`\`\`
@@CALLBACK:${cb.id}
{
${cb.schemaHint}
}
@@END_CALLBACK
\`\`\`
${staticNote}

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds`;
}

/**
 * Extract a callback payload from assistant output text.
 * Returns { callbackId, payload } if found, or null.
 */
export function extractCallbackPayload(text: string): { callbackId: string; payload: string } | null {
  const match = text.match(/@@CALLBACK:(cb-[^\s\n]+)\s*\n([\s\S]*?)\n\s*@@END_CALLBACK/);
  if (!match) return null;
  return { callbackId: match[1], payload: match[2].trim() };
}

/**
 * Resolve a callback: parse the payload, merge static fields, POST to the URL.
 * Returns the API response. Removes the callback from the registry on success.
 */
export async function resolveCallback(
  callbackId: string,
  rawPayload: string,
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const cb = _callbackRegistry.get(callbackId);
  if (!cb) return { success: false, error: `Unknown callback: ${callbackId}` };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return { success: false, error: 'Invalid JSON in callback payload' };
  }

  // Merge static fields (they take precedence — prevents prompt injection overriding moduleId etc.)
  const body = { ...parsed, ...cb.staticFields };

  try {
    const res = await fetch(cb.url, {
      method: cb.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.success) {
      _callbackRegistry.delete(callbackId);
      return { success: true, data: json.data };
    }
    return { success: false, error: json.error || 'API returned failure' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

// ── Task types ──────────────────────────────────────────────────────────────

export type CLITaskType =
  | 'checklist'
  | 'quick-action'
  | 'ask-claude'
  | 'feature-fix'
  | 'feature-review'
  | 'module-scan'
  | 'wbp-starter'
  | 'procgen-dungeon'
  | 'biome-scatter'
  | 'mixamo-import'
  | 'character-setup'
  | 'audio-import'
  | 'generate'
  | 'evaluate-track'
  | 'draft-ability-spec'
  | 'generate-gas-effects';

/** Task types that generate or modify UE code and therefore get a Wiring Requirements section. */
const WIRING_TASK_TYPES = new Set<CLITaskType>(['checklist', 'quick-action', 'feature-fix']);

export interface CLITask {
  type: CLITaskType;
  /** The raw user/system prompt (before context injection) */
  prompt: string;
  /** Module this task belongs to */
  moduleId: SubModuleId;
  /** Human-readable label for the CLI tab */
  label: string;
  /** Called when the task stream completes */
  onComplete?: (success: boolean) => void;
}

/**
 * Extended checklist task — carries the checklist item id for progress tracking.
 */
export interface ChecklistTask extends CLITask {
  type: 'checklist';
  itemId: string;
  appOrigin: string;
}

/**
 * Extended feature-fix task — carries file paths and quality metadata.
 */
export interface FeatureFixTask extends CLITask {
  type: 'feature-fix';
  featureName: string;
  status: string;
  nextSteps: string;
  filePaths: string[];
  qualityScore: number | null;
  appOrigin: string;
}

/**
 * Extended feature-review task — carries feature definitions and callback URL.
 */
export interface FeatureReviewTask extends CLITask {
  type: 'feature-review';
  moduleLabel: string;
  features: FeatureDefinition[];
  appOrigin: string;
}

/**
 * Extended module-scan task — runs eval passes (structure/quality/performance).
 */
export interface ModuleScanTask extends CLITask {
  type: 'module-scan';
  passes: EvalPass[];
  previousFindings?: string;
  appOrigin: string;
}

/**
 * Extended WBP-starter task — scaffolds a stub Widget Blueprint + a wiring README
 * for a BindWidget-coupled C++ widget class (folder-04 §6 / Phase 2b).
 */
export interface WBPStarterTask extends CLITask {
  type: 'wbp-starter';
  /** The C++ UUserWidget subclass to scaffold a companion WBP for (e.g. UARPGHUDWidget). */
  targetClass: string;
  appOrigin: string;
}

/**
 * Procgen-dungeon task — runs the env-parameterized build_procgen_dungeon.py via
 * the full editor and reports the generated room count through a callback.
 */
export interface ProcgenDungeonTask extends CLITask {
  type: 'procgen-dungeon';
  roomCount: number;
  seed: number;
  appOrigin: string;
}

/**
 * Biome-scatter task — runs scatter_biome_ue.py via the full editor to populate
 * the arena floor with props and reports the instance count through a callback.
 */
export interface BiomeScatterTask extends CLITask {
  type: 'biome-scatter';
  density: number;
  seed: number;
  appOrigin: string;
}

/**
 * Generation task (folder-09) — drives one recipe step for a catalog entity and
 * reports the produced UE assets + lifecycle transition back to /api/catalog.
 */
export interface GenerateTask extends CLITask {
  type: 'generate';
  entity: StoredCatalogEntity;
  step: GenerationStep;
  appOrigin: string;
}

/**
 * Evaluate-track task (ECW Phase 13b) — asks Claude to assess one production
 * track (logic/ai/art/animation/audio/vfx/test) of a catalog entity, then
 * writes the assessed state back to /api/pipeline via @@CALLBACK so the
 * pipeline node updates without the operator setting it by hand.
 */
export interface EvaluateTrackTask extends CLITask {
  type: 'evaluate-track';
  entity: StoredCatalogEntity;
  trackId: PipelineTrackId;
  appOrigin: string;
}

/**
 * Draft-ability-spec task (ECW Option B2) — asks Claude to propose a starter
 * EnrichedAbilitySpec (GameplayEffects + tag rules) for a catalog ability, then
 * writes effects[]/tagRules[] back to /api/ability-spec via @@CALLBACK so the
 * rich editors populate. App-side only; no UE files touched.
 */
export interface DraftAbilitySpecTask extends CLITask {
  type: 'draft-ability-spec';
  catalogId: string;
  entityId: string;
  ref: AbilityRef;
  instruction: string;
  appOrigin: string;
}

/**
 * Generate-gas-effects task (ECW Option B3a) — hands Claude an ability's authored
 * effects + an authoring contract; Claude writes buildable UGameplayEffect
 * subclasses additively into the UE project's Effects/Generated/, then builds the
 * PoF module and reports. Callback-free (verification is the build/-abslog, like
 * character-setup). No UE files are authored app-side.
 */
export interface GenerateGasEffectsTask extends CLITask {
  type: 'generate-gas-effects';
  ref: AbilityRef;
  effects: EditorEffect[];
  tagRules: TagRule[];
  appOrigin: string;
}

/**
 * Mixamo-import task — runs the project's mixamo_pipeline.py via the FULL editor
 * to import + retarget the FBX files the operator dropped into a watched folder,
 * and reports how many animations landed through a callback.
 */
export interface MixamoImportTask extends CLITask {
  type: 'mixamo-import';
  /** Absolute path to the watched folder the operator dropped Mixamo FBX into. */
  importDir: string;
  /** Target skeleton content path to retarget onto (default SK_Mannequin). */
  targetSkeleton: string;
  appOrigin: string;
}

/** A rigged-character source PoF knows how to wire (character-source wizard, §1). */
export type CharacterSource = 'mannequin' | 'mixamo' | 'blender';

/**
 * Character-setup task — the wiring step of the character-source wizard (§1).
 * Runs the project's setup_characters_ue.py via the FULL editor to assign the
 * chosen skeletal mesh + AnimBP to the player/enemy and apply the enemy's
 * contrast material. No callback — verification is the separate §6 character
 * Gemini gate (the ac-6 checklist item).
 */
export interface CharacterSetupTask extends CLITask {
  type: 'character-setup';
  source: CharacterSource;
  playerMesh: string;
  enemyMesh: string;
  animBlueprint: string;
  enemyMaterial: string;
  appOrigin: string;
}

/**
 * Reference to one source clip on disk for the audio-import dispatch (folder-05 §7).
 */
export interface AudioImportAssetRef {
  filename: string;
  srcAbsPath: string;
}

/**
 * Audio-import task — runs Content/Python/import_audio_set.py to create
 * USoundWaves + a randomising USoundCue under /Game/Audio/<setName>/ from a
 * set's variation clips. Callback POSTs { assetsImported, cuePath, wiredEvent }
 * to /api/audio/import-result.
 */
export interface AudioImportTask extends CLITask {
  type: 'audio-import';
  setName: string;
  eventKey: string | null;
  surface: string | null;
  assets: AudioImportAssetRef[];
  appOrigin: string;
}

// ── Prompt assembly ─────────────────────────────────────────────────────────

/**
 * Assembles the final enriched prompt for a CLITask.
 *
 * This is the single code path for all prompt building. Every task type
 * gets the project context header + domain context. Specialised task types
 * add their own sections.
 */
export function buildTaskPrompt(task: CLITask, ctx: ProjectContext): string {
  const isUE5 = !ctx.dynamicContext?.projectType || ctx.dynamicContext.projectType === 'ue5';

  const knownAssetDomains = isUE5 ? knownAssetDomainsForModule(task.moduleId) : [];

  const wiringBlock =
    isUE5 && WIRING_TASK_TYPES.has(task.type)
      ? `\n\n${formatWiringRequirements({ moduleAssets: getWiringAssets(task.moduleId) })}`
      : '';

  switch (task.type) {
    case 'checklist': {
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
    }

    case 'quick-action':
    case 'ask-claude': {
      const header = buildProjectContextHeader(ctx, { knownAssetDomains });
      const domainContext = isUE5 ? getModuleDomainContext(task.moduleId) : undefined;
      const domainSection = domainContext
        ? `\n\n## Domain Context\n${domainContext}`
        : '';
      return `${header}${domainSection}\n\n## Task\n${task.prompt}${wiringBlock}`;
    }

    case 'feature-fix': {
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
    }

    case 'feature-review': {
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
    }

    case 'module-scan': {
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
    }

    case 'wbp-starter': {
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
    }

    case 'procgen-dungeon': {
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
    }

    case 'biome-scatter': {
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
    }

    case 'mixamo-import': {
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
    }

    case 'character-setup': {
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
    }

    case 'audio-import': {
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
    }

    case 'generate': {
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
    }

    case 'evaluate-track': {
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
    }

    case 'draft-ability-spec': {
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
    }

    case 'generate-gas-effects': {
      const gt = task as GenerateGasEffectsTask;
      const header = buildProjectContextHeader(ctx, { knownAssetDomains });
      const body = buildGenerateAbilityBundlePrompt(gt.ref, gt.effects, gt.tagRules);
      return `${header}\n\n## Task\n${body}`;
    }

    default:
      return task.prompt;
  }
}

// ── Task factory ────────────────────────────────────────────────────────────

export const TaskFactory = {
  /** Create a task from a roadmap checklist "Run" button */
  checklist(moduleId: SubModuleId, itemId: string, prompt: string, label: string, appOrigin: string): ChecklistTask {
    return { type: 'checklist', moduleId, itemId, prompt, label, appOrigin };
  },

  /** Create a task from a quick-action button click */
  quickAction(moduleId: SubModuleId, prompt: string, label: string): CLITask {
    return { type: 'quick-action', moduleId, prompt, label };
  },

  /** Create a task from the "Ask Claude" free-text input */
  askClaude(moduleId: SubModuleId, prompt: string, label: string): CLITask {
    return { type: 'ask-claude', moduleId, prompt, label };
  },

  /** Create a task from a feature review "Fix" button */
  featureFix(
    moduleId: SubModuleId,
    feature: { featureName: string; status: string; nextSteps: string; filePaths: string[]; qualityScore: number | null },
    label: string,
    appOrigin: string,
  ): FeatureFixTask {
    return {
      type: 'feature-fix',
      moduleId,
      prompt: feature.nextSteps,
      label,
      featureName: feature.featureName,
      status: feature.status,
      nextSteps: feature.nextSteps,
      filePaths: feature.filePaths,
      qualityScore: feature.qualityScore,
      appOrigin,
    };
  },

  /** Create a task for feature review (single module or batch) */
  featureReview(
    moduleId: SubModuleId,
    moduleLabel: string,
    features: FeatureDefinition[],
    appOrigin: string,
    label: string,
  ): FeatureReviewTask {
    return {
      type: 'feature-review',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      moduleLabel,
      features,
      appOrigin,
    };
  },

  /** Create a task for module scan (structure/quality/performance eval) */
  moduleScan(
    moduleId: SubModuleId,
    passes: EvalPass[],
    appOrigin: string,
    label: string,
    previousFindings?: string,
  ): ModuleScanTask {
    return {
      type: 'module-scan',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      passes,
      appOrigin,
      previousFindings,
    };
  },

  /** Create a task for the WBP-starter tool (scaffold a stub WBP for a BindWidget C++ class) */
  wbpStarter(moduleId: SubModuleId, targetClass: string, appOrigin: string, label: string): WBPStarterTask {
    return {
      type: 'wbp-starter',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      targetClass,
      appOrigin,
    };
  },

  /** Create a task that runs the parameterized build_procgen_dungeon.py via the editor */
  procgenDungeon(
    moduleId: SubModuleId,
    params: { roomCount: number; seed: number },
    appOrigin: string,
    label: string,
  ): ProcgenDungeonTask {
    return {
      type: 'procgen-dungeon',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      roomCount: params.roomCount,
      seed: params.seed,
      appOrigin,
    };
  },

  /** Create a task that runs scatter_biome_ue.py via the editor */
  scatterBiome(
    moduleId: SubModuleId,
    params: { density: number; seed: number },
    appOrigin: string,
    label: string,
  ): BiomeScatterTask {
    return {
      type: 'biome-scatter',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      density: params.density,
      seed: params.seed,
      appOrigin,
    };
  },

  /** Create a task that imports + retargets dropped Mixamo FBX via mixamo_pipeline.py */
  mixamoImport(
    moduleId: SubModuleId,
    params: { importDir: string; targetSkeleton: string },
    appOrigin: string,
    label: string,
  ): MixamoImportTask {
    return {
      type: 'mixamo-import',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      importDir: params.importDir,
      targetSkeleton: params.targetSkeleton,
      appOrigin,
    };
  },

  /** Create the wiring-step task of the character-source wizard (setup_characters_ue.py) */
  characterSetup(
    moduleId: SubModuleId,
    params: {
      source: CharacterSource;
      playerMesh: string;
      enemyMesh: string;
      animBlueprint: string;
      enemyMaterial: string;
    },
    appOrigin: string,
    label: string,
  ): CharacterSetupTask {
    return {
      type: 'character-setup',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      source: params.source,
      playerMesh: params.playerMesh,
      enemyMesh: params.enemyMesh,
      animBlueprint: params.animBlueprint,
      enemyMaterial: params.enemyMaterial,
      appOrigin,
    };
  },

  /**
   * Create an audio-import task — wires a set's variation clips into UE as
   * USoundWaves + a randomising USoundCue under /Game/Audio/<setName>/.
   */
  importAudioSet(
    params: { setName: string; eventKey?: string | null; surface?: string | null; assets: AudioImportAssetRef[] },
    appOrigin: string,
    label = 'Audio Import',
  ): AudioImportTask {
    return {
      type: 'audio-import',
      moduleId: 'audio',
      prompt: '',
      label,
      setName: params.setName,
      eventKey: params.eventKey ?? null,
      surface: params.surface ?? null,
      assets: params.assets,
      appOrigin,
    };
  },

  /** Create a generation task for one recipe step of a catalog entity (folder-09). */
  generate(
    moduleId: SubModuleId,
    entity: StoredCatalogEntity,
    step: GenerationStep,
    appOrigin: string,
    label: string,
  ): GenerateTask {
    return { type: 'generate', moduleId, prompt: '', label, entity, step, appOrigin };
  },

  /** Create a track-evaluation task (ECW Phase 13b) — assesses one production
   *  track and writes the assessed state back to /api/pipeline via callback. */
  evaluateTrack(
    moduleId: SubModuleId,
    entity: StoredCatalogEntity,
    trackId: PipelineTrackId,
    appOrigin: string,
    label: string,
  ): EvaluateTrackTask {
    return { type: 'evaluate-track', moduleId, prompt: '', label, entity, trackId, appOrigin };
  },

  /** Create a draft-ability-spec task (ECW B2) — proposes a starter GAS spec and
   *  writes effects[]/tagRules[] back to /api/ability-spec via callback. */
  draftAbilitySpec(
    moduleId: SubModuleId,
    params: { catalogId: string; entityId: string; ref: AbilityRef; instruction?: string },
    appOrigin: string,
    label: string,
  ): DraftAbilitySpecTask {
    return {
      type: 'draft-ability-spec',
      moduleId,
      prompt: '',
      label,
      catalogId: params.catalogId,
      entityId: params.entityId,
      ref: params.ref,
      instruction: params.instruction ?? '',
      appOrigin,
    };
  },

  /** Create a generate-gas-effects task (ECW B3a) — Claude writes buildable
   *  UGameplayEffect C++ from the ability's effects into Effects/Generated/. */
  generateGasEffects(
    moduleId: SubModuleId,
    params: { ref: AbilityRef; effects: EditorEffect[]; tagRules: TagRule[] },
    appOrigin: string,
    label: string,
  ): GenerateGasEffectsTask {
    return {
      type: 'generate-gas-effects',
      moduleId,
      prompt: '',
      label,
      ref: params.ref,
      effects: params.effects,
      tagRules: params.tagRules,
      appOrigin,
    };
  },
};
