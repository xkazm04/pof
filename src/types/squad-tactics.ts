// ── Squad Tactics Types ───────────────────────────────────────────────────────
// Types for the AI Director: Emergent Squad Tactics via EQS Composition system.
// Models squad roles, formations, EQS composition, and simulation results.

/** Role a squad member can be assigned by the AI Director. */
export type SquadRole =
  | 'flanker'
  | 'aggressor'
  | 'support'
  | 'tank'
  | 'ambusher';

/** Describes a squad role's EQS composition and behavior. */
export interface SquadRoleDefinition {
  role: SquadRole;
  label: string;
  description: string;
  /** EQS generators used by this role. */
  generators: string[];
  /** EQS tests applied to score positions. */
  tests: string[];
  /** Preferred engagement distance range [min, max] in UU. */
  engagementRange: [number, number];
  /** Priority weight when allocating positions (higher = allocated first). */
  priority: number;
}

/** A single member within a squad. */
export interface SquadMember {
  id: string;
  label: string;
  role: SquadRole;
  /** Position relative to target (x, y) in UU. */
  position: { x: number; y: number };
  /** Flank angle in degrees from target forward. */
  flankAngle: number;
  /** Distance from target center in UU. */
  distance: number;
  /** EQS score for this member's chosen position. */
  score: number;
}

/** A preset squad formation template. */
export interface SquadFormation {
  id: string;
  name: string;
  description: string;
  /** Role distribution: which roles and how many of each. */
  roles: { role: SquadRole; count: number }[];
  /** Total squad size. */
  size: number;
}

/** Configuration for the AI Director simulation. */
export interface DirectorConfig {
  formation: SquadFormation;
  /** Target forward direction in radians. */
  targetForwardAngle: number;
  /** Attack distance ring radius in UU. */
  attackDistance: number;
  /** Minimum separation between squad members in UU. */
  minSeparation: number;
  /** Weight for flank angle in scoring. */
  flankWeight: number;
  /** Weight for ally separation in scoring. */
  separationWeight: number;
  /** Weight for distance-to-preferred-range in scoring. */
  rangeWeight: number;
  /** Seed for deterministic simulation. */
  seed: number;
}

/** Result of running the AI Director's position allocation. */
export interface DirectorResult {
  members: SquadMember[];
  /** Overall formation quality score 0-1. */
  formationScore: number;
  /** Angular coverage of the target (0-360 degrees covered). */
  angularCoverage: number;
  /** Average separation between members in UU. */
  avgSeparation: number;
  /** Whether any members are too close (< minSeparation). */
  hasCollisions: boolean;
  /** The composed EQS pipeline description. */
  composedPipeline: ComposedEQSStep[];
}

/** A step in the composed EQS pipeline visualization. */
export interface ComposedEQSStep {
  label: string;
  cppClass: string;
  kind: 'context' | 'generator' | 'test-score' | 'test-filter' | 'director' | 'result';
  description: string;
}
