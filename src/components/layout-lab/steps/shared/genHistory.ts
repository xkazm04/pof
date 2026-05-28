/**
 * Persistent generation-candidate history for the lab's generative pipeline steps
 * (Icon 2D, 3D, Material). Generative steps used to keep only the selected candidate
 * and discard every other re-roll; this model persists *every batch* a Produce run
 * creates so an artist can A/B-compare across re-rolls and re-select an older one —
 * the Midjourney/Leonardo "browse the generation history" loop.
 *
 * It lives inside the step artifact's `data` (under `genHistory`), so it rides the
 * existing local + SQLite persistence (labPipelineStore → postArtifact) and add-only
 * hydration with no schema change. Pure + framework-free so it is unit-testable.
 *
 * Acceptance stays DERIVED from truth: selecting a candidate projects its `payload`
 * onto the artifact's top-level data (via `historyData`), so each step's existing
 * `accept()` (which reads `selected` / `tris` / `maps`) keeps working unchanged.
 */

/** A single generated candidate within a batch. */
export interface GenCandidate {
  /** Stable id, unique within the step (e.g. `b0-c2`). */
  id: string;
  /** CSS background for the gallery thumbnail (gradient / color / url(...)). */
  swatch: string;
  /** Optional sub-label under the thumbnail (e.g. "4200 tris", "Albedo·Normal·ORM"). */
  caption?: string;
  /** Step-specific fields projected onto the artifact's top-level data when selected. */
  payload: Record<string, unknown>;
}

/** One Produce run: a batch of candidates stamped with the direction + full prompt. */
export interface GenBatch {
  /** Stable batch id (e.g. `b0`). */
  id: string;
  /** ISO timestamp the batch was generated. */
  at: string;
  /** The artist's free-text direction for this re-roll (the recoverable art direction). */
  direction: string;
  /** The full prompt dispatched — so the winning art direction is recoverable. */
  prompt: string;
  candidates: GenCandidate[];
}

/** The persisted generation history for one generative step. */
export interface GenHistory {
  /** Every re-roll, oldest first. Prior batches are never discarded. */
  batches: GenBatch[];
  /** Currently-selected candidate id across all batches, or null. */
  selectedId: string | null;
}

/** The key the history is stored under inside a step artifact's `data`. */
export const GEN_HISTORY_KEY = 'genHistory';

export function emptyHistory(): GenHistory {
  return { batches: [], selectedId: null };
}

/** Read history from an artifact's `data`, tolerant of absent/legacy shapes. */
export function readHistory(data: Record<string, unknown> | undefined): GenHistory {
  const raw = data?.[GEN_HISTORY_KEY];
  if (raw && typeof raw === 'object' && Array.isArray((raw as GenHistory).batches)) {
    const h = raw as GenHistory;
    return { batches: h.batches, selectedId: h.selectedId ?? null };
  }
  return emptyHistory();
}

/** Every candidate across all batches (oldest batch first). */
export function allCandidates(h: GenHistory): GenCandidate[] {
  return h.batches.flatMap((b) => b.candidates);
}

/** The currently-selected candidate, or null. */
export function selectedCandidate(h: GenHistory): GenCandidate | null {
  if (h.selectedId == null) return null;
  return allCandidates(h).find((c) => c.id === h.selectedId) ?? null;
}

/** The batch a candidate belongs to (for surfacing its direction/prompt), or null. */
export function batchOf(h: GenHistory, candidateId: string): GenBatch | null {
  return h.batches.find((b) => b.candidates.some((c) => c.id === candidateId)) ?? null;
}

/**
 * Build a stamped batch. `seq` (the count of existing batches) makes candidate ids
 * stable + unique within the step; `at` is supplied by the caller (an event handler,
 * never render — keeps this pure and keeps `Date.now()` out of render per react purity).
 */
export function makeBatch(opts: {
  seq: number;
  at: string;
  direction: string;
  prompt: string;
  candidates: Omit<GenCandidate, 'id'>[];
}): GenBatch {
  const id = `b${opts.seq}`;
  return {
    id,
    at: opts.at,
    direction: opts.direction,
    prompt: opts.prompt,
    candidates: opts.candidates.map((c, i) => ({ ...c, id: `${id}-c${i}` })),
  };
}

/** Append a batch (kept, never discarding prior re-rolls) and auto-select its first candidate. */
export function appendBatch(h: GenHistory, batch: GenBatch): GenHistory {
  return {
    batches: [...h.batches, batch],
    selectedId: batch.candidates[0]?.id ?? h.selectedId,
  };
}

/** Re-select an existing candidate by id. No-op (same reference) for unknown/already-selected ids. */
export function selectCandidate(h: GenHistory, candidateId: string): GenHistory {
  if (h.selectedId === candidateId) return h;
  if (!allCandidates(h).some((c) => c.id === candidateId)) return h;
  return { ...h, selectedId: candidateId };
}

/**
 * Project the selected candidate's `payload` plus the history into a StepOutput `data`.
 * `extra` fields (e.g. a fixed `cap`) are applied first so a candidate payload can
 * override them, and the history is always carried so it persists + re-hydrates.
 */
export function historyData(h: GenHistory, extra?: Record<string, unknown>): Record<string, unknown> {
  const sel = selectedCandidate(h);
  return { ...(extra ?? {}), ...(sel?.payload ?? {}), [GEN_HISTORY_KEY]: h };
}
