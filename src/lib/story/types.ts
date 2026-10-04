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
}

export interface StoryEnding {
  node: string;
  precedence?: number;
  label?: string;
  when?: Cond;
  witness?: readonly string[];
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
  /** nodeId -> cohort -> percent. A node absent here is UNMEASURED, not zero. */
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
  'SOFTLOCK_LEAD',
  'GUARD_UNSATISFIABLE',
  'OPTION_NEVER_OFFERED',
  'NODE_NEVER_REACHED',
  'ENDING_BELOW_FLOOR',
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
}

export interface StoryFinding {
  code: StoryFindingCode;
  altitude: FindingAltitude;
  severity: FindingSeverity;
  nodes: readonly string[];
  variables?: readonly string[];
  detail: string;
  /** Present only on state-altitude findings. */
  lead?: StoryLead;
}

/** What a revision change invalidates. See the standard, section 10. */
export type RevisionChangeClass = 'cosmetic' | 'topological' | 'contract';
