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
 *
 * ── History is BOUNDED ───────────────────────────────────────────────────────
 * Re-roll-heavy steps used to grow `batches` without limit — every re-roll kept its
 * full prompt string, so a busy generative step could bloat the artifact and blow the
 * browser's localStorage quota. `appendBatch` now prunes to the last
 * `MAX_KEPT_BATCHES` (12) re-rolls, with one invariant: the batch that owns the
 * SELECTED candidate is never pruned (re-selecting it keeps working even if it aged
 * out of the window). Older batches — and their prompt strings — are dropped, which
 * only costs the ability to re-select a very old candidate. The persisted SHAPE is
 * unchanged (`{ batches, selectedId }`), so existing stored histories still read
 * back; batch ids stay unique across pruning because the next seq is derived from the
 * max surviving `bN` id (`nextSeq`), never the (now-shrinking) `batches.length`.
 */

/** A single generated candidate within a batch. */
export interface GenCandidate {
  /** Stable id, unique within the step (e.g. `b0-c2`). */
  id: string;
  /** CSS background for the gallery thumbnail (gradient / color). Always present so a
   *  candidate has a visible surface even while an `imageUrl` loads or when none exists. */
  swatch: string;
  /** Optional URL of a REAL generated thumbnail image (served via /api/visual-gen/asset/…).
   *  When set the gallery renders the image over `swatch`; absent → the swatch is a
   *  deterministic seed preview, not a real asset. */
  imageUrl?: string;
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

/**
 * Cap on kept re-roll batches. Bounds the artifact so a re-roll-heavy step can't
 * grow `genHistory` (and its stored prompt strings) without limit and hit the
 * localStorage quota. The batch owning the selected candidate is exempt (see
 * `pruneHistory`). 12 ≈ a generous browse window while staying small in storage.
 */
export const MAX_KEPT_BATCHES = 12;

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
 * The next batch sequence number: one past the highest surviving `bN` id, or 0 when
 * empty. Derived from the ids (not `batches.length`) so it stays MONOTONIC across
 * pruning — otherwise a pruned history would remint an id already in use and two
 * batches would collide. Callers pass this to `makeBatch({ seq })`.
 */
export function nextSeq(h: GenHistory): number {
  let max = -1;
  for (const b of h.batches) {
    const n = Number.parseInt(b.id.slice(1), 10); // 'b7' → 7
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/**
 * Build a stamped batch. `seq` makes candidate ids stable + unique within the step
 * (use `nextSeq(history)` so ids stay unique across pruning); `at` is supplied by the
 * caller (an event handler, never render — keeps this pure and keeps `Date.now()` out
 * of render per react purity).
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

/**
 * Prune to at most `cap` batches, keeping the most recent ones. The batch that owns
 * the currently-selected candidate is always retained (even if it aged out of the
 * window) so re-selecting it keeps working. Returns the same reference when nothing
 * is dropped. Pure; the shape (`{ batches, selectedId }`) is unchanged.
 */
export function pruneHistory(h: GenHistory, cap = MAX_KEPT_BATCHES): GenHistory {
  if (h.batches.length <= cap) return h;
  const kept = h.batches.slice(-cap);
  const selBatch = h.selectedId ? batchOf(h, h.selectedId) : null;
  if (selBatch && !kept.some((b) => b.id === selBatch.id)) {
    // Selected batch aged out of the window — keep it too (oldest slot), preserving order.
    return { ...h, batches: [selBatch, ...kept] };
  }
  return { ...h, batches: kept };
}

/**
 * Append a batch (kept, never discarding recent re-rolls) and auto-select its first
 * candidate, then prune to `MAX_KEPT_BATCHES` so the history stays bounded.
 */
export function appendBatch(h: GenHistory, batch: GenBatch): GenHistory {
  const grown: GenHistory = {
    batches: [...h.batches, batch],
    selectedId: batch.candidates[0]?.id ?? h.selectedId,
  };
  return pruneHistory(grown);
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
