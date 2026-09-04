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

/**
 * The engine recorded when nobody could say who produced the artifact. It is a STATED
 * absence, not a producer: every surface that renders it must read it as "not recorded".
 */
export const UNKNOWN_ENGINE = 'unknown';

/**
 * Engines a CLIENT is allowed to declare on `POST /api/pipeline-artifacts`.
 *
 * `Code` is the only honest one: it says "a deterministic produce body in this app wrote
 * this", which is a claim about the caller itself and costs nothing to fake because it
 * asserts no external work. Everything else — `Claude`, `Leonardo`, `Tripo`, `ElevenLabs` —
 * is an attestation that a paid/remote engine RAN, and only the server that ran it may make
 * it. Accepting such a claim from a browser would open a fabricated-provenance hole of
 * exactly the shape as the fabricated-`pass` hole the server re-grade closed.
 */
export const CLIENT_DECLARABLE_ENGINES = ['Code'] as const;
export type ClientDeclarableEngine = (typeof CLIENT_DECLARABLE_ENGINES)[number];

/** The engine the lab's own write-through declares for a deterministic browser produce. */
export const LAB_PRODUCE_ENGINE: ClientDeclarableEngine = 'Code';

export function isClientDeclarableEngine(v: unknown): v is ClientDeclarableEngine {
  return typeof v === 'string' && (CLIENT_DECLARABLE_ENGINES as readonly string[]).includes(v);
}

/**
 * Which engine to PERSIST for a client-submitted artifact. Pure and total — the four
 * states, in order:
 *
 * - `declared` in the allow-list → taken (the client asserted only about itself).
 * - `claimed` (found in the submitted `data._provenance`) in the allow-list → taken.
 * - `claimed` equal to what the SERVER already recorded on that row → kept. The lab
 *   re-POSTs what `POST /api/one-shot/step` persisted after a live CLI produce; sanitising
 *   that round trip would destroy real provenance to defend against a claim nobody made.
 *   A DIFFERENT claim never launders through a prior record.
 * - anything else → {@link UNKNOWN_ENGINE}. Not a rejection of the artifact, a refusal of
 *   the claim: the row is persisted saying that its producer is not recorded.
 */
export function resolvePersistedEngine(input: { declared?: unknown; claimed?: unknown; attested?: unknown }): string {
  if (isClientDeclarableEngine(input.declared)) return input.declared;
  if (isClientDeclarableEngine(input.claimed)) return input.claimed;
  if (
    typeof input.claimed === 'string' && input.claimed !== UNKNOWN_ENGINE &&
    typeof input.attested === 'string' && input.attested === input.claimed
  ) return input.claimed;
  return UNKNOWN_ENGINE;
}

/**
 * Merge a provenance stamp into an artifact payload's `data`, additively — the input is
 * never mutated and no other key is touched. `_provenance` is a NON-CONTENT key (see
 * `judge/payload.ts`), so this provably cannot move a verdict or trip the drift banner.
 */
export function withProvenance(data: Record<string, unknown>, provenance: Provenance): Record<string, unknown> {
  const existing = readProvenance(data);
  return { ...data, _provenance: { ...(existing ?? {}), ...provenance } };
}

/**
 * One sentence for "how was this made?", for any surface that shows provenance.
 * An unrecorded producer says so in words — it never renders `unknown` in the slot where
 * a producer name goes, because a placeholder in an answer's position reads as an answer.
 */
export function describeProducer(p: Provenance | null): string {
  if (!p || !p.engine || p.engine === UNKNOWN_ENGINE) {
    const version = p?.promptVersion ? ` (prompt ${p.promptVersion})` : '';
    return `producer: not recorded — this artifact was written before produce paths stamped their engine${version}`;
  }
  const parts = [p.engine, p.model, p.effort, p.promptVersion ? `prompt ${p.promptVersion}` : null].filter(Boolean);
  return `produced by: ${parts.join(' · ')}`;
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
