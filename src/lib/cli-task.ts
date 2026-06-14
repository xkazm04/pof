/**
 * Unified CLI task abstraction.
 *
 * Every CLI invocation — checklist run, quick action, ask-claude, feature fix,
 * feature review — is represented as a CLITask. The TaskFactory methods handle
 * context injection and prompt assembly so callers never build prompts manually.
 */

import type { SubModuleId } from '@/types/modules';
import type { ProjectContext } from '@/lib/prompt-context';
import { type FeatureDefinition, getWiringAssets } from '@/lib/feature-definitions';
import { formatWiringRequirements } from '@/lib/knowledge/wiring-requirements';
import type { EvalPass } from '@/lib/evaluator/module-eval-prompts';
import { knownAssetDomainsForModule } from '@/lib/knowledge/ue-known-assets';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { GenerationStep } from '@/lib/catalog/recipe';
import type { PipelineTrackId } from '@/lib/pipeline/tracks';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';
import type { TestSuite } from '@/types/ai-testing';
import { taskPromptHandlers } from '@/lib/cli-task-handlers';

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
 *
 * Exported for the per-task-type handlers in `cli-task-handlers.ts`, which
 * assemble the callback section the same way the inline `switch` cases did.
 */
export function buildCallbackSection(cb: TaskCallback): string {
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
 * The wire format of a task callback: a `@@CALLBACK:<id>` line, a JSON body, and
 * a closing `@@END_CALLBACK` line (see {@link buildCallbackSection}). This single
 * regex is the **one source of truth** for the marker format — both the client
 * terminal (here) and the server-side `awaitCallback` (cli-service) parse through
 * {@link parseCallbackMarker}, so the format can never drift between the two paths.
 *
 * - `<id>` is any non-whitespace run — `cb-…` from {@link registerCallback}, or
 *   `step-…` from the one-shot routes — so the prefix is intentionally unconstrained.
 * - The body is everything up to the closing marker; surrounding whitespace and the
 *   trailing newline are tolerated and trimmed off.
 */
const CALLBACK_MARKER_RE = /@@CALLBACK:(\S+)\s*\n([\s\S]*?)\s*@@END_CALLBACK/;

/** A parsed `@@CALLBACK…@@END_CALLBACK` marker. */
export interface ParsedCallbackMarker {
  /** The callback id from the marker line (e.g. `cb-…`, `step-…`). */
  callbackId: string;
  /** The raw JSON text between the markers, trimmed. */
  payload: string;
  /** The parsed JSON body, or `null` if `payload` was not valid JSON. */
  data: unknown;
}

/**
 * Parse a `@@CALLBACK…@@END_CALLBACK` marker out of assistant output text.
 *
 * The single shared marker parser (regex + `JSON.parse`). Returns `null` when no
 * marker is present; on a marker whose body is malformed JSON, returns the marker
 * with `data: null` (callers that only need the raw `payload` are unaffected).
 */
export function parseCallbackMarker(text: string): ParsedCallbackMarker | null {
  const match = text.match(CALLBACK_MARKER_RE);
  if (!match) return null;
  const payload = match[2].trim();
  let data: unknown = null;
  try {
    data = JSON.parse(payload);
  } catch {
    data = null;
  }
  return { callbackId: match[1], payload, data };
}

/**
 * Extract a callback payload from assistant output text.
 * Returns { callbackId, payload } if found, or null. Thin projection over
 * {@link parseCallbackMarker} for callers that re-parse the raw payload
 * themselves (e.g. {@link resolveCallback}, which merges static fields first).
 */
export function extractCallbackPayload(text: string): { callbackId: string; payload: string } | null {
  const marker = parseCallbackMarker(text);
  if (!marker) return null;
  return { callbackId: marker.callbackId, payload: marker.payload };
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
  | 'generate-gas-effects'
  | 'run-ai-tests'
  | 'detect-stimuli';

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
  /** Optional entity scalars (catalog data) — AbilityManaCost + the canonical-damage guard. */
  scalars?: { manaCost?: number; cooldown?: number; damage?: number };
  appOrigin: string;
}

/**
 * Run-AI-tests task — builds + runs the suite's UE automation tests, then
 * writes per-scenario pass/fail/error results back to /api/ai-testing via
 * @@CALLBACK so scenario statuses, the pass-rate ring, and Last Run Output
 * reflect real runs.
 */
export interface RunAITestsTask extends CLITask {
  type: 'run-ai-tests';
  suite: TestSuite;
  appOrigin: string;
}

/**
 * Detect-stimuli task — parses a scenario's natural-language description into
 * MockStimulus/ExpectedAction arrays and writes them back to the scenario via
 * @@CALLBACK (the "Auto-detect" sparkles button).
 */
export interface DetectStimuliTask extends CLITask {
  type: 'detect-stimuli';
  scenarioId: number;
  scenarioDescription: string;
  targetClass: string;
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

  const handler = taskPromptHandlers[task.type];
  if (!handler) return task.prompt;
  return handler(task, ctx, { isUE5, knownAssetDomains, wiringBlock });
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

  /** Create a run-ai-tests task — runs the suite's automation tests and writes
   *  per-scenario results back to /api/ai-testing via callback. */
  runAITests(moduleId: SubModuleId, suite: TestSuite, appOrigin: string, label: string): RunAITestsTask {
    return { type: 'run-ai-tests', moduleId, prompt: '', label, suite, appOrigin };
  },

  /** Create a detect-stimuli task — parses a scenario description into
   *  stimuli/expectedActions and writes them back via callback. */
  detectStimuli(
    moduleId: SubModuleId,
    params: { scenarioId: number; scenarioDescription: string; targetClass: string },
    appOrigin: string,
    label: string,
  ): DetectStimuliTask {
    return {
      type: 'detect-stimuli',
      moduleId,
      prompt: '',
      label,
      scenarioId: params.scenarioId,
      scenarioDescription: params.scenarioDescription,
      targetClass: params.targetClass,
      appOrigin,
    };
  },

  /** Create a generate-gas-effects task (ECW B3a/B3b) — Claude writes buildable
   *  UGameplayEffect C++ + a UGA_Gen_* wiring ability into the additive Generated/ folders. */
  generateGasEffects(
    moduleId: SubModuleId,
    params: { ref: AbilityRef; effects: EditorEffect[]; tagRules: TagRule[]; scalars?: { manaCost?: number; cooldown?: number; damage?: number } },
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
      scalars: params.scalars,
      appOrigin,
    };
  },
};
