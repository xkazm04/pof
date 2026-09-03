// ── Economy Simulator Types ─────────────────────────────────────────────────

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'material' | 'gem' | 'recipe';
/**
 * The five functional node kinds an economy is allowed to contain
 * (ai-registry `game-economy-tuning` / `source-drain-converter-trader-vocabulary`).
 *
 * - `source`    creates units from nothing.
 * - `drain`     destroys units, returning them to nothing.
 * - `converter` consumes units of one resource and produces units of another at a
 *               stated rate. Both legs must be recorded; a converter recorded on
 *               only one side is an unfunded faucet.
 * - `trader`    moves units between holders. Never enters a balance sum.
 * - `pool`      merely holds units; it is the stock the four flow kinds move.
 *
 * A node that cannot be named as one of the five has NOT been audited, and no
 * automated check can reason about it — it reports `unclassified`, never balanced.
 */
export type EconomyNodeKind = 'source' | 'drain' | 'converter' | 'trader' | 'pool';

/**
 * The wire/persistence spelling of a node's kind. `'faucet'` and `'sink'` are the
 * legacy two-word vocabulary and remain the canonical spellings of `source` and
 * `drain`, so every persisted `EconomyFlow` (stored runs, client `flowOverrides`)
 * stays valid — this union is purely ADDITIVE. Map to the functional vocabulary
 * with `nodeKindOf()` in `@/lib/economy/node-audit`.
 */
export type EconomyEventType = 'faucet' | 'sink' | 'converter' | 'trader' | 'pool';

/** One leg of a converter: which resource it consumes, and how much per occurrence. */
export interface EconomyConversionLeg {
  /** The resource pool this leg draws from (e.g. 'items'). */
  resource: string;
  /** Units of `resource` consumed per occurrence of the flow. */
  unitsPerOccurrence: number;
}

/**
 * How a flow's magnitude is derived. Declared on the node so the engine has no
 * anonymous id special cases:
 * - `flat` (default) — `baseAmount + levelScaling × level`, the authored rate.
 * - `percent-of-balance` — a fraction of the holder's CURRENT balance
 *   (`percentOfBalance`). This is a balancing loop through the gold pool and is
 *   declared as one in `DECLARED_LOOPS`.
 */
export type EconomyFlowMechanism = 'flat' | 'percent-of-balance';

/** A node in the gold economy: a source, drain, converter, trader or pool. */
export interface EconomyFlow {
  id: string;
  name: string;
  type: EconomyEventType;
  /** Base gold amount per occurrence */
  baseAmount: number;
  /** Level scaling factor (multiplied by player level) */
  levelScaling: number;
  /** How often this occurs per hour of play at the relevant level */
  frequencyPerHour: number;
  /** Minimum level this flow becomes active */
  minLevel: number;
  /** Maximum level (0 = uncapped) */
  maxLevel: number;
  category: string;
  /**
   * REQUIRED for `type: 'converter'` — the input leg that funds this node's output.
   * A converter without it is an unfunded faucet and the audit says so. Absent for
   * every other kind (a source has no input; a drain's input IS its magnitude).
   */
  input?: EconomyConversionLeg;
  /** Magnitude mechanism; omitted means `flat`. */
  mechanism?: EconomyFlowMechanism;
  /** For `mechanism: 'percent-of-balance'` — the fraction taken (0–1). */
  percentOfBalance?: number;
}

// ── Feedback-loop topology ──────────────────────────────────────────────────

/**
 * A declared closed path in the economy. Polarity, latency and gain are all
 * required before anything can be said about a loop; a loop whose gain nobody has
 * estimated reports as `'uncharacterised'`, never as weak and never as benign
 * (ai-registry `feedback-loop-topology-and-polarity`).
 */
export interface EconomyLoop {
  id: string;
  name: string;
  /** `reinforcing` = positive, `balancing` = negative. Neither word is praise or blame. */
  polarity: 'reinforcing' | 'balancing';
  /** Gain per traversal, or `'uncharacterised'` when nobody has estimated it. */
  gain: number | 'uncharacterised';
  /** Latency in the model's own step (hours of simulated play). */
  latencyHours: number;
  /** The nodes the path runs through, in order. */
  path: string[];
  /** One sentence: what this loop is there to do. */
  job: string;
}

// ── Node-map audit ──────────────────────────────────────────────────────────

/** A node whose declared throughput the structure could not supply. */
export interface StarvedNode {
  id: string;
  name: string;
  /** Occurrences the declared frequency scheduled. */
  scheduled: number;
  /** Occurrences that actually fired (input pool non-empty). */
  fired: number;
  /** `1 - fired/scheduled`. */
  starvedFraction: number;
  resource: string;
}

/** A quantity the model created that no declared node accounts for. */
export interface UndeclaredSource {
  id: string;
  name: string;
  resource: string;
  units: number;
}

/** What the simulation actually moved, per resource. Closes the books. */
export interface EconomyLedger {
  /** Units of `items` created by drops. */
  itemsProduced: number;
  /** Units of `items` destroyed by converter input legs. */
  itemsConsumed: number;
  /** Gold produced by converter output legs. */
  goldFromConversions: number;
  /**
   * Gold conjured by the negative-balance clamp. MUST be 0: underflow is prevented
   * at the point of spend. A non-zero value is an unnamed source and forces the
   * balance verdict to `unclassified`.
   */
  mintedByClamp: number;
}

/** Result of naming every node and closing the books. */
export interface EconomyAudit {
  /** Every flow, with the functional kind it was named as. */
  nodes: { id: string; name: string; kind: EconomyNodeKind | 'unclassified' }[];
  /** Flow ids whose `type` is not one of the five kinds. */
  unclassified: string[];
  /** Converter ids with no input leg — an unfunded faucet. */
  unfunded: string[];
  /** Nodes whose declared frequency the structure could not supply. */
  starved: StarvedNode[];
  /** Quantities created with no declared node behind them. */
  undeclaredSources: UndeclaredSource[];
  /** Ledger of what actually moved (zeroed for a static, pre-run audit). */
  ledger: EconomyLedger;
  /** True only when nothing above is outstanding. */
  clean: boolean;
}

/**
 * A balance verdict. `pass`/`fail` are only reachable over a clean, measured node
 * map: a structural problem is never reportable as "balanced".
 */
export type BalanceVerdict = 'pass' | 'fail' | 'unspecified' | 'unclassified' | 'not-measured';

export interface BalanceBandResult {
  verdict: BalanceVerdict;
  /** |inflow − outflow| / max(inflow, outflow); undefined when not measured. */
  imbalance?: number;
  /** The band this was judged against (read from canon, never hardcoded). */
  tolerance: number;
  /** What the verdict was computed over — a number carries its basis. */
  basis: string;
  /** Why the verdict is not pass/fail, when it is not. */
  reason?: string;
}

/** Item archetype for the economy model */
export interface EconomyItem {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  /** Base vendor buy price */
  buyPrice: number;
  /** Base vendor sell price */
  sellPrice: number;
  /** Level scaling for price */
  levelScaling: number;
  /** Drop weight (higher = more common) */
  dropWeight: number;
  /** Min level to appear */
  minLevel: number;
}

/** XP curve definition */
export interface XPCurvePoint {
  level: number;
  xpRequired: number;
  /** Cumulative XP to reach this level */
  cumulativeXP: number;
}

/** Snapshot of a simulated player at a point in time */
export interface PlayerSnapshot {
  level: number;
  gold: number;
  totalGoldEarned: number;
  totalGoldSpent: number;
  /** Items held, keyed by item ID with count */
  inventory: Record<string, number>;
  playTimeHours: number;
}

/** A single timestep result for one player */
export interface SimulationTick {
  hour: number;
  level: number;
  gold: number;
  goldEarned: number;
  goldSpent: number;
  netFlow: number;
}

/** Aggregated statistics at a given level or time */
export interface EconomyMetrics {
  level: number;
  hour: number;
  /** Average gold held across all agents */
  avgGold: number;
  medianGold: number;
  minGold: number;
  maxGold: number;
  /** Total gold in the economy */
  totalGold: number;
  /** Gini coefficient (0=equal, 1=all wealth in one player) */
  giniCoefficient: number;
  /** Gold entering the economy per hour */
  inflowPerHour: number;
  /** Gold leaving the economy per hour */
  outflowPerHour: number;
  /** Net flow (positive = inflationary) */
  netFlowPerHour: number;
  /** Gold velocity: transactions / total gold */
  velocity: number;
}

/** An inflation alert detected by the simulator */
export interface InflationAlert {
  level: number;
  hour: number;
  severity: 'info' | 'warning' | 'critical';
  type: 'inflation' | 'deflation' | 'price-imbalance' | 'wealth-inequality' | 'dead-zone' | 'canon-violation'
    /** A topology defect: an unclassified node, an unfunded converter, a starved node. */
    | 'structural';
  /** For canon-violation alerts: the canon rule id (canon-seed) that was violated. */
  lawId?: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
}

/** Supply/demand data for a single item category */
export interface SupplyDemandPoint {
  level: number;
  category: ItemCategory;
  /** Items entering the economy per hour */
  supplyRate: number;
  /** Items consumed/equipped per hour */
  demandRate: number;
  /** Average price at this level */
  avgPrice: number;
  /** Price relative to player income (affordability) */
  affordabilityIndex: number;
}

/** Full simulation result */
export interface SimulationResult {
  /** Simulation config used */
  config: SimulationConfig;
  /** Per-level economy metrics (aggregated across all agents) */
  metrics: EconomyMetrics[];
  /** Inflation/balance alerts */
  alerts: InflationAlert[];
  /** Supply/demand curves per item category */
  supplyDemand: SupplyDemandPoint[];
  /** Per-agent final snapshots (for distribution analysis) */
  finalSnapshots: PlayerSnapshot[];
  /**
   * The node map, closed books and structural findings for THIS run. A balance
   * number computed over an unaudited map is confidently wrong rather than
   * honestly absent, so the audit ships with the metrics, not beside them.
   */
  audit: EconomyAudit;
  /** The honest faucet/sink verdict — never `pass` over an unaudited structure. */
  balance: BalanceBandResult;
  /** The declared feedback-loop topology this economy was walked with. */
  loops: EconomyLoop[];
  /** Simulation duration in ms */
  durationMs: number;
  /** Timestamp */
  completedAt: string;
}

/** Configuration for running a simulation */
export interface SimulationConfig {
  /** Number of virtual players */
  agentCount: number;
  /** Max level in the game */
  maxLevel: number;
  /** Hours of play to simulate */
  maxPlayHours: number;
  /** Economy philosophy */
  philosophy: 'loot-driven' | 'scarcity-based' | 'balanced';
  /** Random seed for reproducibility */
  seed: number;
  /** Custom flow overrides */
  flowOverrides?: Partial<EconomyFlow>[];
  /** Custom item overrides */
  itemOverrides?: Partial<EconomyItem>[];
}

// ── API Types ───────────────────────────────────────────────────────────────

export interface RunSimulationRequest {
  config: SimulationConfig;
}

export interface RunSimulationResponse {
  result: SimulationResult;
}

export interface GetDefaultsResponse {
  flows: EconomyFlow[];
  items: EconomyItem[];
  xpCurve: XPCurvePoint[];
  defaultConfig: SimulationConfig;
}
