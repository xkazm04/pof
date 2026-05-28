/** ── Genome Checkpoint Schema ─────────────────────────────────────────────── *
 * Durable, named snapshot of a character genome at a moment in time. Unlike
 * the ephemeral undo/redo stack in `useGenomeHistory`, checkpoints persist
 * across reloads, are user-named (e.g. "v1.0 pre-nerf"), and form a vertical
 * changelog timeline diffed against the previous checkpoint.
 * ────────────────────────────────────────────────────────────────────────── */

import type { CharacterGenome } from './character-genome';

export interface GenomeCheckpoint {
  /** Unique id for this checkpoint */
  id: string;
  /** Genome this checkpoint belongs to (foreign key to CharacterGenome.id) */
  genomeId: string;
  /** User-given label (e.g. "v1.0 pre-nerf") */
  name: string;
  /** ISO timestamp the checkpoint was captured */
  createdAt: string;
  /** Optional free-form note */
  note?: string;
  /** Frozen full-genome snapshot — exact restore target */
  snapshot: CharacterGenome;
}
