// ─── Blueprint Node Graph Types ──────────────────────────────────────────────

/** A single pin (input or output) on a Blueprint node. */
export interface BlueprintPin {
  /**
   * Stable id for this pin, unique within a parsed Blueprint. Sourced from the
   * UE5 export's `PinId` when present, otherwise synthesised by the parser
   * (`<nodeId>::<pinName>#<n>`). Used to resolve `linkedTo` edges to their
   * owning node via the parser's pin-id index.
   */
  id?: string;
  name: string;
  type: string;           // e.g. 'exec', 'float', 'FVector', 'bool'
  direction: 'input' | 'output';
  /**
   * Endpoints this pin connects to. UE5 commandlet exports put **pin ids**
   * here; the bundled samples / copy-paste exports use **node ids**. Either is
   * resolved to the owning node by the codegen walker (pin-id index first,
   * node-id fallback).
   */
  linkedTo?: string[];
  defaultValue?: string;
}

/** A single node in a Blueprint graph. */
export interface BlueprintNode {
  id: string;
  type: string;           // e.g. 'K2Node_CallFunction', 'K2Node_IfThenElse', 'K2Node_VariableGet'
  name: string;           // display name
  comment?: string;       // user comment annotation
  memberParent?: string;  // owning class for function calls
  memberName?: string;    // function or property name
  pins: BlueprintPin[];
  posX: number;
  posY: number;
}

/** A complete Blueprint graph (event graph, function graph, etc). */
export interface BlueprintGraph {
  name: string;           // e.g. 'EventGraph', 'MyCustomFunction'
  graphType: 'event' | 'function' | 'macro';
  nodes: BlueprintNode[];
}

/** Top-level Blueprint asset parsed from JSON export. */
export interface BlueprintAsset {
  className: string;          // e.g. 'BP_PlayerCharacter'
  parentClass: string;        // e.g. 'ACharacter'
  variables: BlueprintVariable[];
  functions: BlueprintGraph[];
  eventGraph: BlueprintGraph;
}

/** A variable declared in a Blueprint. */
export interface BlueprintVariable {
  name: string;
  type: string;
  category?: string;
  defaultValue?: string;
  isExposedToEditor: boolean;
  isReplicated: boolean;
  /** RepNotify — replicated *and* fires an OnRep_ handler (CPF_RepNotify). Implies isReplicated. */
  isRepNotify: boolean;
  tooltip?: string;
}

// ─── Transpilation Types ─────────────────────────────────────────────────────

/** A single replicated property and how it is wired for network replication. */
export interface ReplicatedPropertyInfo {
  /** Property name as it appears in C++ (matches the Blueprint variable name). */
  name: string;
  /** Resolved C++ type, e.g. 'float', 'int32', 'FVector'. */
  cppType: string;
  /** True when the property uses ReplicatedUsing (RepNotify) and an OnRep_ handler. */
  repNotify: boolean;
  /** OnRep handler name (e.g. 'OnRep_Health') — only present when repNotify is true. */
  onRepHandler?: string;
}

/** Replication scaffolding derived from a Blueprint's replicated properties. */
export interface ReplicationInfo {
  /** True when the class has at least one replicated property. */
  hasReplication: boolean;
  /** Every replicated property and its RepNotify status. */
  properties: ReplicatedPropertyInfo[];
}

/** Result of transpiling a Blueprint graph to C++. */
export interface TranspileResult {
  headerCode: string;
  sourceCode: string;
  className: string;
  parentClass: string;
  includes: string[];
  warnings: TranspileWarning[];
  nodeCount: number;
  functionCount: number;
  /** Replication scaffolding metadata (GetLifetimeReplicatedProps, RepNotify fields). */
  replication: ReplicationInfo;
}

export interface TranspileWarning {
  nodeId?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

// ─── Semantic Diff Types ─────────────────────────────────────────────────────

export type DiffChangeType = 'add' | 'remove' | 'modify' | 'move' | 'rename';
export type DiffConflictLevel = 'none' | 'compatible' | 'conflict';

/** A single semantic change detected between two versions. */
export interface SemanticChange {
  id: string;
  type: DiffChangeType;
  scope: 'variable' | 'function' | 'event' | 'logic' | 'binding';
  name: string;
  description: string;
  blueprintSide?: string;  // summary of Blueprint change
  cppSide?: string;        // summary of C++ change
  conflictLevel: DiffConflictLevel;
  resolution?: string;     // AI-suggested resolution
}

/**
 * Rung of the transpilation fidelity ladder a surface has actually proven.
 * (ai-registry `game-production/visual-script-to-code-transpilation`.) A claim
 * is only ever stated at the rung it was proven at — never above.
 */
export type FidelityRung =
  | 'parsed'
  | 'compiles'
  | 'declared-and-defined'
  | 'structurally-equivalent'
  | 'behaviourally-equivalent';

/** Full result of a semantic diff between Blueprint and C++. */
export interface SemanticDiffResult {
  changes: SemanticChange[];
  blueprintSummary: string;
  cppSummary: string;
  overallConflict: DiffConflictLevel;
  timestamp: number;
  /**
   * The highest rung this comparison can support. A declaration-level diff can
   * never reach structural or behavioural equivalence, so a change-free result
   * means "nothing diverged in what was inspected", not "in sync".
   */
  fidelityRung: FidelityRung;
  /** Dimensions this diff actually inspected. */
  comparedDimensions: string[];
  /** Dimensions it did NOT inspect — surfaced so the empty state stays honest. */
  notCompared: string[];
}

// ─── Session State ───────────────────────────────────────────────────────────

export type TranspilerTab = 'transpile' | 'diff' | 'history';

export interface TranspileSession {
  id: string;
  blueprintPath: string;
  blueprintAsset: BlueprintAsset | null;
  transpileResult: TranspileResult | null;
  diffResult: SemanticDiffResult | null;
  existingCpp: string | null;   // existing C++ if found on disk
  createdAt: number;
}
