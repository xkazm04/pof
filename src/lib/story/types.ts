/**
 * `pof.storygraph/1` — the TypeScript shape of the interchange standard.
 *
 * The normative document is `docs/architecture/storygraph-standard.md`; this file is its type
 * contract and must not drift from it. The zod schema in `./schema.ts` is the runtime reference
 * implementation and is the only thing permitted to accept an untrusted document.
 *
 * Absent-value convention (stated once, here and in the standard):
 *   - OMIT a key for "not applicable" — `profile.axis` absent means order topologically,
 *     `node.parent` absent means top level, `edge.when` absent means unguarded.
 *   - Use `null` ONLY where absence is itself a claim — `variable.initial: null` with
 *     `requiresWrite: true` means every read must be dominated by a write, and
 *     `run.graphHash: null` means the evidence is not pinned to a graph version.
 *   - A node ABSENT from `evidence.reach` is UNMEASURED, which is never 0. No consumer may
 *     coerce it to zero, and no surface may render it as a measured zero.
 */

/** The closed set. Anything project-specific is a `class` or a `lane`, never a kind. */
export type StoryNodeKind =
  | 'entry'
  | 'event'
  | 'choice'
  | 'gate'
  | 'container'
  | 'ending'
  | 'template';

/** `contains` and `influences` are NOT traversal and must be excluded from every reachability walk. */
export type StoryEdgeKind = 'then' | 'option' | 'gate' | 'contains' | 'influences';

export type StoryWriteOp = 'set' | 'add' | 'sub' | 'min' | 'max' | 'push';
export type StoryVarType = 'bool' | 'enum' | 'int' | 'float' | 'string';
export type StoryVarScope = 'conversation' | 'quest' | 'playthrough' | 'persistent';

export type CondOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in';

/** The typed guard grammar. `expr` is an escape hatch and is ALWAYS reported as a defect. */
export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { var: string; op: CondOp; value: unknown }
  | { flag: string }
  | { visited: string }
  | { axis: { op: CondOp; value: number } }
  | { ref: string }
  | { chance: number }
  | { expr: string };

export interface StoryWrite {
  var: string;
  op: StoryWriteOp;
  value: unknown;
}

export interface StoryVariableDomain {
  min?: number;
  max?: number;
  values?: readonly unknown[];
}

/**
 * The state-variable declaration contract — the keystone of the standard.
 *
 * `writers` is the field producers leave out and the field that pays most: it is one authority per
 * quantity applied to narrative state. A parse failure of this block is a LOUD error; a reader must
 * never degrade it to "unconstrained".
 */
export interface StoryVariable {
  name: string;
  type: StoryVarType;
  domain: StoryVariableDomain;
  initial: unknown;
  requiresWrite?: boolean;
  /** Node ids allowed to write it. Everything else only reads. */
  writers: readonly string[];
  scope: StoryVarScope;
  /** True when another system owns the value; reaching-write analysis is then skipped. */
  external: boolean;
  doc?: string;
}

export interface StoryNodeOption {
  id: string;
  label?: string;
}

export interface StoryRealises {
  catalogId: string;
  entityId: string;
  role?: string;
}

export interface StoryNode {
  id: string;
  kind: StoryNodeKind;
  class?: string;
  title?: string;
  axis?: number;
  lanes?: readonly string[];
  parent?: string;
  text?: string;
  options?: readonly StoryNodeOption[];
  realises?: readonly StoryRealises[];
  /** The producer's own status ladder. Opaque to validation. */
  status?: string;
  authoring?: 'authored' | 'hybrid' | 'generated' | string;
  source?: string;
}

/**
 * How several `then` edges out of ONE non-choice node combine (§5, wave 4 decision 2026-11-02).
 * `any` (the default — omit the key): the traversal takes ONE of them (a hub: "pick a quest").
 * `all`: every such edge is a parallel thread that is live at once (a season: "three threads run").
 */
export type StoryEdgeMode = 'any' | 'all';

export interface StoryEdge {
  id: string;
  from: string;
  to: string;
  kind: StoryEdgeKind;
  optionId?: string;
  label?: string;
  when?: Cond;
  writes?: readonly StoryWrite[];
  chance?: number;
  /** Omit for `any`. Only meaningful on `then` edges that share a non-choice source. */
  mode?: StoryEdgeMode;
}

export interface StoryEnding {
  node: string;
  precedence?: number;
  label?: string;
  when?: Cond;
  witness?: readonly string[];
  /**
   * Reach floor in PERCENT of a cohort's walks (state altitude, ENDING_BELOW_FLOOR). A number applies
   * to every cohort; a record names cohorts (`{ completionist: 5 }`) and a cohort it omits has no floor.
   */
  floor?: number | Readonly<Record<string, number>>;
}

export interface StoryProfileAxis {
  name: string;
  unit: string;
  min: number;
  max: number;
}

export interface StoryProfileLane {
  id: string;
  label: string;
}

export interface StoryProfileNodeClass {
  id: string;
  coreKind: StoryNodeKind;
  label: string;
}

export interface StoryProfile {
  /** Absent means the document declares no ordering dimension; order topologically. */
  axis?: StoryProfileAxis;
  lanes?: readonly StoryProfileLane[];
  nodeClasses?: readonly StoryProfileNodeClass[];
  languages?: readonly string[];
  voicedFraction?: number;
}

export interface StoryBudgets {
  unit: 'words' | 'characters';
  /** A number carries its unit AND its basis. This string is that basis. */
  basis: string;
  perClass: Readonly<Record<string, number>>;
}

export interface StoryRun {
  runId: string;
  engine: string;
  config?: string;
  seeds?: string;
  n: number;
  /** `null` means the evidence is NOT pinned to a graph version, therefore unverified. */
  graphHash: string | null;
  capturedAt?: string;
  cohorts: readonly string[];
  provisional?: boolean;
}

export interface StoryEvidence {
  runs: readonly StoryRun[];
  /**
   * nodeId -> cohort -> percent. Two different silences (wave 4, 2026-11-02):
   * an explicit `0` is a MEASURED zero — the run covered the node and none of its `n` walks reached it;
   * a node/cohort ABSENT here is UNMEASURED — the run did not cover it (orphan, unwalkable). Never coerce one into the other.
   */
  reach: Readonly<Record<string, Readonly<Record<string, number>>>>;
  unit?: string;
}

export interface StoryProducer {
  tool: string;
  version: string;
  generatedAt: string;
}

export interface StoryGraph {
  format: 'pof.storygraph/1';
  project: string;
  graphId: string;
  revision: number;
  contentHash?: string;
  producer?: StoryProducer;
  source?: Record<string, unknown>;
  profile: StoryProfile;
  variables: readonly StoryVariable[];
  entries: readonly string[];
  nodes: readonly StoryNode[];
  edges: readonly StoryEdge[];
  endings: readonly StoryEnding[];
  budgets: StoryBudgets;
  definitions?: Readonly<Record<string, Cond>>;
  evidence?: StoryEvidence;
}

/* ---------------------------------------------------------------- findings */

export type FindingAltitude = 'structural' | 'state';
export type FindingSeverity = 'error' | 'warn' | 'info';

export const STORY_FINDING_CODES = [
  'DANGLING_EDGE',
  'DUPLICATE_ID',
  'CONTAINMENT_CYCLE',
  'ORPHAN_NODE',
  'ENDING_UNREACHABLE',
  'NO_ENDING_REACHABLE',
  'UNDECLARED_TERMINAL',
  'VAR_UNDECLARED',
  'VAR_NO_REACHING_WRITE',
  'VAR_DOMAIN_VIOLATION',
  'VAR_WRITER_NOT_OWNER',
  'VAR_SINGLETON',
  'FALSE_CHOICE',
  'TEXT_BUDGET_EXCEEDED',
  'UNTYPED_CONDITION',
  // Structural codes for the section-5/3/4/6 MUSTs that had none (wave 4, 2026-11-02):
  'CHOICE_TOO_FEW_OPTIONS',
  'GATE_WITHOUT_CONDITION',
  'UNKNOWN_KIND',
  'PARENT_CONTAINS_MISMATCH',
  'STRING_VAR_NO_VALUES',
  'PRECEDENCE_NOT_TOTAL',
  /** A declared `influences` edge the data does not support: the source writes nothing the target's guard reads (section 5). */
  'INFLUENCES_UNSUPPORTED',
  'SOFTLOCK_LEAD',
  'GUARD_UNSATISFIABLE',
  'OPTION_NEVER_OFFERED',
  'NODE_NEVER_REACHED',
  'ENDING_BELOW_FLOOR',
  /** State altitude: from a reached (node, state) no ending can be reached, yet a way on exists. */
  'LIVELOCK_LEAD',
] as const;

export type StoryFindingCode = (typeof STORY_FINDING_CODES)[number];

/**
 * A state-altitude finding is a LEAD, never a proven defect: an automated walk reliably declares
 * unwinnable what is merely long or resource-gated, so the claim must stay falsifiable by carrying
 * the state it got stuck in.
 */
export interface StoryLead {
  seed: number;
  engine: string;
  samples: number;
  state: Readonly<Record<string, unknown>>;
  path: readonly string[];
  /**
   * Only when the walk forked (`mode: 'all'`): the thread that made each `path` step (same length;
   * thread 0 is the walk's first, each fork numbers its new threads in order). Absent = one thread.
   */
  threads?: readonly number[];
}

export interface StoryFinding {
  code: StoryFindingCode;
  altitude: FindingAltitude;
  severity: FindingSeverity;
  nodes: readonly string[];
  variables?: readonly string[];
  detail: string;
  /**
   * A witness path, entry first, when the claim is about a path rather than a node — today only
   * `VAR_NO_REACHING_WRITE` (§8: "reports the path, not just the node"). Container exits appear as
   * the container's own id. Structural, so it is a proof, not a lead.
   */
  path?: readonly string[];
  /** Present only on state-altitude findings. */
  lead?: StoryLead;
}

/** What a revision change invalidates. See the standard, section 10. */
export type RevisionChangeClass = 'cosmetic' | 'topological' | 'contract';

/* ---------------------------------------------------------------- the walker (WP3, state altitude) */

/**
 * A named sampling policy. `uniform` picks uniformly among the OFFERED options at a choice;
 * `weighted` scales each offered option by `weights[optionId]` (default 1; when every offered
 * option weighs 0 it falls back to uniform). Cohort ids key the report's reach exactly like
 * `StoryEvidence.reach`.
 */
export interface WalkerCohort {
  id: string;
  policy: 'uniform' | 'weighted';
  weights?: Readonly<Record<string, number>>;
}

export interface WalkerOptions {
  seed: number;
  /** Walks PER COHORT. Reach is a percent of the cohort's own walks. */
  samples: number;
  /** Default: one `uniform` cohort. */
  cohorts?: readonly WalkerCohort[];
  /** Step cap per walk. A walk that still has a way on at the cap is `truncated`, never a softlock. */
  maxSteps?: number;
  /** The `storyContentHash` of the graph walked; absent or null makes the sampled run unverified. */
  graphHash?: string | null;
  /** Ending reach floors in percent, by ending node id (beside any `endings[].floor`). */
  floors?: Readonly<Record<string, number>>;
}

export interface WalkerCohortOutcome {
  samples: number;
  /** Walks that arrived at each ending. An ending no walk arrived at is absent. */
  endings: Readonly<Record<string, number>>;
  /** Walks that stopped at a reached (node, state) with outgoing guards, none satisfiable. */
  stalled: number;
  /** Walks that stopped at a node with no traversal edge at all (structurally an undeclared terminal). */
  terminal: number;
  /** Walks still progressing when the step cap hit. NOT softlocks. */
  truncated: number;
  /**
   * Walks still moving at the step cap inside a closed loop from which no ending is reachable
   * (LIVELOCK_LEAD). Counted here INSTEAD of `truncated`; present only when some walk livelocked.
   */
  livelocked?: number;
}

/** A write the walker could not apply as written. It is never silently clamped. */
export interface WalkerDomainEvent {
  var: string;
  edge: string;
  kind: 'clamped' | 'rejected' | 'undeclared';
  /** The first value the write tried to produce. */
  attempted: unknown;
  count: number;
}

export interface WalkerReport {
  engine: string;
  graphId: string;
  project: string;
  revision: number;
  seed: number;
  samples: number;
  maxSteps: number;
  cohorts: readonly WalkerCohort[];
  /** What a reader such as the Orrery reads: reach per node per cohort, unmeasured nodes absent. */
  evidence: StoryEvidence;
  outcomes: Readonly<Record<string, WalkerCohortOutcome>>;
  /** State-altitude LEADS only, each carrying a `lead`. Never proven defects. */
  findings: readonly StoryFinding[];
  domainEvents: readonly WalkerDomainEvent[];
  /** Where truncated walks were when the cap hit: display node id -> walks. */
  truncatedAt: Readonly<Record<string, number>>;
  /** Where livelocked walks were when the cap hit (display node id -> walks); present only when some walk livelocked. */
  livelockedAt?: Readonly<Record<string, number>>;
  /** Where walks stopped with no traversal edge at all: display node id -> walks (WP2 reports these structurally). */
  terminalAt: Readonly<Record<string, number>>;
  /** False when a guard holds an `expr` atom (§6): such a graph is not gradeable at this altitude. */
  gradeable: boolean;
  /** Edges whose guard contains an untyped atom; the walker treats them optimistically. */
  untypedEdges: readonly string[];
  /** Total steps taken, all walks. */
  steps: number;
}
