/**
 * `pof.godot-evidence/1` — the wire contract a Godot game repo writes and PoF reads (spark
 * gtai-phase-2, WP2). Pure types + constants (no Node), so a client view may import them later.
 *
 * Location: `<gameRoot>/build/evidence/<kind>.json`; frames under `<gameRoot>/build/evidence/frames/`.
 * `build/` is git-ignored in the game repo. The game writes these files; PoF never observes the run,
 * which is why the verdict carries the commit-staleness rule (see `readEvidence.ts`).
 *
 * Absent values: optional keys are OMITTED, never `null`. A `null` optional key is a malformed envelope.
 * See docs/architecture/game-workspaces.md, "Engine evidence (Godot)".
 */

export const GODOT_EVIDENCE_SCHEMA = 'pof.godot-evidence/1' as const;

/** Repo-relative (to the game root) folder holding the evidence files. */
export const GODOT_EVIDENCE_DIR = 'build/evidence';

export type GodotEvidenceKind =
  | 'lint'
  | 'unit-tests'
  | 'scenario-tests'
  | 'parity'
  | 'selftest'
  | 'bench'
  | 'export-audit'
  | 'achievements';

export const GODOT_EVIDENCE_KINDS: readonly GodotEvidenceKind[] = [
  'lint', 'unit-tests', 'scenario-tests', 'parity', 'selftest', 'bench', 'export-audit', 'achievements',
];

export function isGodotEvidenceKind(v: unknown): v is GodotEvidenceKind {
  return typeof v === 'string' && (GODOT_EVIDENCE_KINDS as readonly string[]).includes(v);
}

/** The bench metric keys the contract names (other keys are allowed; these are the ones PoF reads). */
export type GodotBenchMetric = 'p99CpuMs' | 'low1Fps' | 'worstSwapMs' | 'worstFrameMs';

export interface GodotEvidenceCounts {
  passed: number;
  failed: number;
  skipped: number;
}

/** One evidence file, as written by the game. */
export interface GodotEvidence {
  schema: typeof GODOT_EVIDENCE_SCHEMA;
  kind: GodotEvidenceKind;
  /** The game's id in PoF's registry, e.g. `'gtai'`. */
  gameId: string;
  /** Full SHA of the game repo HEAD at run time. */
  commit: string;
  /** ISO timestamp of the run. */
  builtAt: string;
  godotVersion: string;
  status: 'pass' | 'fail';
  summary: string;
  counts?: GodotEvidenceCounts;
  /** Bench keys: `p99CpuMs`, `low1Fps`, `worstSwapMs`, `worstFrameMs`. */
  metrics?: Record<string, number>;
  /** Paths relative to the evidence dir. */
  artifacts?: string[];
}

/** PoF's reading of one evidence file. `evidence` is present whenever the file parsed as a valid envelope. */
export interface GodotEvidenceVerdict {
  status: 'pass' | 'fail' | 'deferred';
  detail: string;
  reason?: string;
  evidence?: GodotEvidence;
}

/** The two kinds whose pass is the L2 (static) verdict for a godot game. */
export const GODOT_L2_KINDS: readonly GodotEvidenceKind[] = ['lint', 'unit-tests'];
