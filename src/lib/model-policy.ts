import { getDb } from '@/lib/db';
import type { Provenance } from '@/lib/provenance';

/**
 * Model policy — the single source of truth for WHICH Claude model + thinking effort
 * powers each class of task (Quality Program WS0). Today the Claude engine rides the
 * session default blindly; this registry lets every spawn resolve `--model` + `--effort`
 * from its task class, seeded with sensible defaults and later overwritten by the WS3
 * benchmark winners (persisted as overrides). Surfaced on the /status Models panel.
 *
 * Model aliases map to the Claude Code CLI `--model` argument (it accepts these aliases);
 * effort maps to `--effort`.
 */
export type ClaudeModel = 'haiku' | 'sonnet' | 'opus' | 'fable';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type TaskClass =
  | 'produce-text'          // author a step's text/config content
  | 'produce-2d-prompt'     // author a Leonardo image prompt
  | 'produce-3d-prompt'     // author a Tripo/mesh concept prompt
  | 'produce-audio-prompt'  // author an ElevenLabs prompt
  | 'judge-content'         // strict LLM content judge (WS2)
  | 'judge-visual'          // strict visual judge (Opus vision, WS2)
  | 'fix-content'           // repair a failed content step
  | 'author-ue-test'        // author a UE automation test / C++ rules
  | 'benchmark';            // the WS3 benchmark harness itself

export interface ModelChoice {
  model: ClaudeModel;
  effort: Effort;
}

export interface PolicyEntry extends ModelChoice {
  taskClass: TaskClass;
  /** 'default' (seed) or 'benchmark' (WS3 winner) or 'manual'. */
  source: 'default' | 'benchmark' | 'manual';
  /** Benchmark median score (0-100) that justified a non-default choice, if any. */
  benchmarkScore?: number;
  updatedAt?: string;
}

/** Full CLI model id per alias (fallback if the CLI rejects the short alias). */
export const MODEL_IDS: Record<ClaudeModel, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-5',
  opus: 'claude-opus-4-8',
  fable: 'claude-fable-5',
};

/**
 * Seed defaults. Judging is deliberately the most expensive (Opus/high) — a strict
 * instrument is the point of the Quality Program; production is cheaper until WS3
 * benchmarks prove otherwise.
 */
export const DEFAULT_POLICY: Record<TaskClass, ModelChoice> = {
  'produce-text': { model: 'sonnet', effort: 'medium' },
  'produce-2d-prompt': { model: 'sonnet', effort: 'low' },
  'produce-3d-prompt': { model: 'sonnet', effort: 'low' },
  'produce-audio-prompt': { model: 'sonnet', effort: 'low' },
  'judge-content': { model: 'opus', effort: 'high' },
  'judge-visual': { model: 'opus', effort: 'high' },
  'fix-content': { model: 'sonnet', effort: 'medium' },
  'author-ue-test': { model: 'opus', effort: 'medium' },
  'benchmark': { model: 'sonnet', effort: 'medium' },
};

export const TASK_CLASSES = Object.keys(DEFAULT_POLICY) as TaskClass[];

let ensured = false;
function ensureTable() {
  if (ensured) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS model_policy (
      task_class TEXT PRIMARY KEY,
      model TEXT NOT NULL,
      effort TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      benchmark_score INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  ensured = true;
}

export function isModel(v: unknown): v is ClaudeModel {
  return v === 'haiku' || v === 'sonnet' || v === 'opus' || v === 'fable';
}
export function isEffort(v: unknown): v is Effort {
  return v === 'low' || v === 'medium' || v === 'high' || v === 'xhigh' || v === 'max';
}
export function isTaskClass(v: unknown): v is TaskClass {
  return typeof v === 'string' && (TASK_CLASSES as string[]).includes(v);
}

/**
 * Map a live-dispatch task type (a `CLITaskType`, or the `'interactive'` sentinel
 * for a free-typed terminal prompt) to the model-policy {@link TaskClass} that should
 * govern which model + effort powers it. Only task types that clearly correspond to a
 * policy class are mapped; everything else returns `null` so the caller pins nothing and
 * behaviour is identical to the pre-wiring default (session model, no `--model`/`--effort`).
 *
 * This is the ONLY bridge between the interactive/module dispatch vocabulary and the
 * Quality-Program policy classes — kept conservative on purpose (an unmapped type is a
 * no-op, never a surprise model swap).
 */
export function taskClassForDispatchType(taskType: string | undefined | null): TaskClass | null {
  switch (taskType) {
    case 'feature-fix':
      return 'fix-content';
    case 'module-scan':
    case 'feature-review':
    case 'evaluate-track':
      return 'judge-content';
    case 'generate':
    case 'draft-ability-spec':
    case 'detect-stimuli':
    // The lab's live-produce path (`POST /api/one-shot/step` with mode:'cli'). It was
    // unmapped, so the ONE real CLI produce in the catalog pipeline ran unpinned — the
    // Quality Program's policy governed every other dispatch and not this one. It is
    // gated to text archetypes (brief/graph/rules, `CLI_ELIGIBLE_ARCHETYPES`), which is
    // exactly what `produce-text` describes.
    case 'one-shot-step':
      return 'produce-text';
    case 'generate-gas-effects':
    case 'run-ai-tests':
      return 'author-ue-test';
    default:
      // checklist, quick-action, ask-claude, interactive, wbp-starter, procgen-dungeon,
      // biome-scatter, mixamo-import, character-setup, audio-import, unknown → no pin.
      return null;
  }
}

/**
 * Resolve the `{model, effort}` a live dispatch should pin, from an optional explicit
 * override plus an optional dispatch task type. Pure except for the DB read inside
 * {@link getModelPolicy}; server-only. Returns `{}` (pin nothing) when neither an explicit
 * valid override nor a mappable task type is present — the off-state that keeps the CLI
 * args byte-identical to before this wiring.
 *
 * Precedence: a valid explicit `model`/`effort` wins (used by scripts / autonomous
 * spawns); otherwise a valid explicit `taskClass`, otherwise the task type is mapped
 * through {@link taskClassForDispatchType}. Each explicit field is validated
 * independently — an unknown value is dropped, never forwarded.
 */
export function resolveDispatchModelChoice(input: {
  model?: unknown;
  effort?: unknown;
  taskClass?: unknown;
  taskType?: unknown;
}): { model?: ClaudeModel; effort?: Effort } {
  const explicitModel = isModel(input.model) ? input.model : undefined;
  const explicitEffort = isEffort(input.effort) ? input.effort : undefined;
  if (explicitModel || explicitEffort) {
    return { ...(explicitModel ? { model: explicitModel } : {}), ...(explicitEffort ? { effort: explicitEffort } : {}) };
  }
  const taskClass = isTaskClass(input.taskClass)
    ? input.taskClass
    : taskClassForDispatchType(typeof input.taskType === 'string' ? input.taskType : null);
  if (!taskClass) return {};
  const choice = getModelPolicy(taskClass);
  return { model: choice.model, effort: choice.effort };
}

/** Resolve the effective choice for a task class: DB override, else the seed default. */
export function getModelPolicy(taskClass: TaskClass): ModelChoice {
  ensureTable();
  const row = getDb().prepare('SELECT model, effort FROM model_policy WHERE task_class = ?').get(taskClass) as
    | { model: string; effort: string }
    | undefined;
  if (row && isModel(row.model) && isEffort(row.effort)) return { model: row.model, effort: row.effort };
  return DEFAULT_POLICY[taskClass];
}

/** Persist an override (WS3 benchmark winner or a manual pin). */
export function setModelPolicy(
  taskClass: TaskClass,
  choice: ModelChoice,
  source: PolicyEntry['source'] = 'manual',
  benchmarkScore?: number,
): void {
  ensureTable();
  getDb().prepare(`
    INSERT INTO model_policy (task_class, model, effort, source, benchmark_score, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT (task_class) DO UPDATE SET
      model = excluded.model, effort = excluded.effort, source = excluded.source,
      benchmark_score = excluded.benchmark_score, updated_at = excluded.updated_at
  `).run(taskClass, choice.model, choice.effort, source, benchmarkScore ?? null);
}

/** Every task class with its resolved choice + provenance (for the /status Models panel). */
export function listModelPolicy(): PolicyEntry[] {
  ensureTable();
  const overrides = new Map(
    (getDb().prepare('SELECT * FROM model_policy').all() as Record<string, unknown>[]).map((r) => [r.task_class as TaskClass, r]),
  );
  return TASK_CLASSES.map((taskClass) => {
    const o = overrides.get(taskClass);
    const choice = getModelPolicy(taskClass);
    return {
      taskClass,
      ...choice,
      source: (o?.source as PolicyEntry['source']) ?? 'default',
      ...(o?.benchmark_score != null ? { benchmarkScore: Number(o.benchmark_score) } : {}),
      ...(o?.updated_at ? { updatedAt: o.updated_at as string } : {}),
    };
  });
}

/**
 * Build a Claude-engine provenance stamp from a task class + the current policy.
 * Server-only (touches the DB via getModelPolicy); the produce path / scripts call this,
 * never a client component. `at` is caller-supplied to stay replay-stable.
 */
export function claudeProvenance(taskClass: TaskClass, opts: { promptVersion?: string; at?: string } = {}): Provenance {
  const { model, effort } = getModelPolicy(taskClass);
  return {
    engine: 'Claude',
    model,
    modelId: MODEL_IDS[model],
    effort,
    ...(opts.promptVersion ? { promptVersion: opts.promptVersion } : {}),
    ...(opts.at ? { at: opts.at } : {}),
  };
}
