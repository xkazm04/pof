/**
 * Provenance — the audit stamp attached to a produced artifact's data (Quality Program WS0).
 * Answers "who/how made this output" so /status can show it and the prompt-improvement loop
 * can attribute scores to a specific model + effort + prompt version.
 *
 * Stamped additively as `data._provenance` at Produce time; the artifact re-grade ignores
 * unknown keys, so this never affects acceptance (the verified additive-key pattern).
 *
 * This module is PURE + client-safe (no DB). The DB-coupled `claudeProvenance` (which reads
 * the model policy) lives in the server-only `model-policy.ts`.
 */
export interface Provenance {
  /** Producing engine — 'Claude' | 'Leonardo (Lucid Origin)' | 'Tripo' | 'ElevenLabs' | 'Code' | … */
  engine: string;
  /** Claude model alias, when the engine is Claude (from the model policy). */
  model?: string;
  /** Full CLI model id, when known. */
  modelId?: string;
  /** Thinking effort, when the engine is Claude. */
  effort?: string;
  /** Version of the quality prompt pack used (WS1). */
  promptVersion?: string;
  /**
   * The prompt-evolution VARIANT that was served for the dispatch which produced this
   * artifact (`'static'` when the run used the registry/recipe prompt). Sits beside
   * `promptVersion` because it is the finer-grained half of the same join: the pack
   * version says which prompt GENERATION ran, this says which phrasing under test did —
   * so judge verdicts become per-variant fitness, not just per-pack.
   */
  promptVariantId?: string;
  /** ISO stamp (caller supplies; keeps this pure/test-stable). */
  at?: string;
}

/** Build a provenance stamp for a non-Claude engine (Leonardo/Tripo/ElevenLabs/Code). */
export function engineProvenance(engine: string, opts: { model?: string; promptVersion?: string; at?: string } = {}): Provenance {
  return {
    engine,
    ...(opts.model ? { model: opts.model } : {}),
    ...(opts.promptVersion ? { promptVersion: opts.promptVersion } : {}),
    ...(opts.at ? { at: opts.at } : {}),
  };
}

/** Read a provenance stamp off an artifact's data, if present. */
export function readProvenance(data: Record<string, unknown> | undefined): Provenance | null {
  const p = data?._provenance;
  return p && typeof p === 'object' ? (p as Provenance) : null;
}
