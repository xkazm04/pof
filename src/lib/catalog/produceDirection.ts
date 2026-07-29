import type { StepOutput } from '@/components/layout-lab/labPipelineStore';

/**
 * The user's typed art direction, made a FIRST-CLASS produce input.
 *
 * Before this module the direction a user typed into `CliProduce` was write-only: it was
 * handed to `buildPrompt`, shown in the "view prompt" disclosure, and then dropped on
 * dispatch for every non-gallery step (`ArchetypeStep` called `produce(...)` with a
 * zero-arg handler). Nothing about the produced artifact recorded WHAT the operator asked
 * for, so a step's provenance stopped at "someone clicked Produce".
 *
 * Two halves:
 *  1. `StepSpec.produce(entity, direction?)` — the optional second parameter every step
 *     may read (phase 1 wires the plumbing; making the ~205 entity-independent produce
 *     bodies direction-SENSITIVE is the follow-on per-catalog redesign).
 *  2. This stamp — `data.produceDirection = { direction, prompt }` — persisted on EVERY
 *     produced artifact (lab, one-shot route, headless), so `RawArtifactDisclosure` and
 *     the server row both show verbatim what drove the step.
 *
 * The stamp is namespaced under one key so it can never collide with a step's own fields,
 * and it is additive: a checker that never reads it is unaffected.
 */
export const PRODUCE_DIRECTION_KEY = 'produceDirection';

export interface ProduceDirection {
  /** Exactly what the operator typed (may be empty — they dispatched the default). */
  direction: string;
  /** The prompt the step's own `buildPrompt` produced from it. Empty when the produce
   *  was deterministic (no CLI prompt drove it) — honest, not a fabricated prompt. */
  prompt: string;
}

/** Stamp a produce output with the direction/prompt that drove it. `ctx` absent → unchanged. */
export function withProduceDirection(out: StepOutput, ctx?: { direction?: string; prompt?: string }): StepOutput {
  if (!ctx) return out;
  const stamp: ProduceDirection = { direction: ctx.direction ?? '', prompt: ctx.prompt ?? '' };
  return { ...out, data: { ...(out.data ?? {}), [PRODUCE_DIRECTION_KEY]: stamp } };
}

/** Read the stamp off a persisted artifact's data (null when the step predates it). */
export function readProduceDirection(data: unknown): ProduceDirection | null {
  if (data == null || typeof data !== 'object') return null;
  const raw = (data as Record<string, unknown>)[PRODUCE_DIRECTION_KEY];
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.direction !== 'string') return null;
  return { direction: r.direction, prompt: typeof r.prompt === 'string' ? r.prompt : '' };
}
