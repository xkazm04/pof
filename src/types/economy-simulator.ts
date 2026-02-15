// ── Economy Simulator Types ─────────────────────────────────────────────────

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'material' | 'gem' | 'recipe';
export type EconomyEventType = 'faucet' | 'sink';

/** A gold source (faucet) or drain (sink) in the economy */
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
  type: 'inflation' | 'deflation' | 'price-imbalance' | 'wealth-inequality' | 'dead-zone';
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
