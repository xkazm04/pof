import type {
  SimulationConfig,
  SimulationResult,
  EconomyFlow,
  EconomyItem,
  EconomyMetrics,
  InflationAlert,
  SupplyDemandPoint,
  PlayerSnapshot,
  SimulationTick,
  XPCurvePoint,
  ItemCategory,
} from '@/types/economy-simulator';
import { DEFAULT_FAUCETS, DEFAULT_SINKS, DEFAULT_ITEMS, generateXPCurve } from './definitions';

// ── Seeded RNG (mulberry32) ─────────────────────────────────────────────────

function createRNG(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Philosophy modifiers ────────────────────────────────────────────────────

const PHILOSOPHY_MODS: Record<string, { faucetMul: number; sinkMul: number; dropMul: number }> = {
  'loot-driven': { faucetMul: 1.2, sinkMul: 0.8, dropMul: 1.3 },
  'scarcity-based': { faucetMul: 0.7, sinkMul: 1.3, dropMul: 0.6 },
  'balanced': { faucetMul: 1.0, sinkMul: 1.0, dropMul: 1.0 },
};

// ── Simulation Engine ───────────────────────────────────────────────────────

export function runSimulation(config: SimulationConfig): SimulationResult {
  const startTime = Date.now();
  const rng = createRNG(config.seed);
  const mods = PHILOSOPHY_MODS[config.philosophy] ?? PHILOSOPHY_MODS['balanced'];

  const xpCurve = generateXPCurve(config.maxLevel);
  const faucets = applyFlowOverrides(DEFAULT_FAUCETS, config.flowOverrides, mods.faucetMul);
  const sinks = applyFlowOverrides(DEFAULT_SINKS, config.flowOverrides, mods.sinkMul);
  const items = DEFAULT_ITEMS;

  // Initialize agents
  const agents: AgentState[] = [];
  for (let i = 0; i < config.agentCount; i++) {
    agents.push({
      id: i,
      level: 1,
      xp: 0,
      gold: 0,
      totalGoldEarned: 0,
      totalGoldSpent: 0,
      inventory: {},
      playTimeHours: 0,
      // Per-agent variance: ±20% play efficiency
      efficiencyMul: 0.8 + rng() * 0.4,
      // Spending behavior: 0=frugal, 1=spender
      spendBias: rng(),
    });
  }

  // Simulation loop: tick every hour
  const metricsMap = new Map<number, EconomyMetrics>();
  const allTicks: SimulationTick[][] = agents.map(() => []);
  const supplyDemandAccum = new Map<string, { supply: number; demand: number; priceSum: number; count: number }>();

  for (let hour = 0; hour < config.maxPlayHours; hour++) {
    for (let a = 0; a < agents.length; a++) {
      const agent = agents[a];
      if (agent.level >= config.maxLevel && hour > config.maxPlayHours * 0.9) continue;

      const tick = simulateAgentHour(agent, hour, faucets, sinks, items, xpCurve, config, rng, mods);
      allTicks[a].push(tick);

      // Track supply/demand
      trackSupplyDemand(agent, items, supplyDemandAccum, mods, rng);
    }

    // Compute aggregate metrics for this hour
    const level = Math.round(agents.reduce((sum, a) => sum + a.level, 0) / agents.length);
    const metrics = computeMetrics(agents, hour, level);
    metricsMap.set(hour, metrics);
  }

  // Build metrics array (sample every level transition + every 5 hours)
  const metrics = buildMetricsArray(metricsMap, config.maxPlayHours);

  // Detect alerts
  const alerts = detectAlerts(metrics, items, config);

  // Build supply/demand curves
  const supplyDemand = buildSupplyDemand(supplyDemandAccum, agents, config);

  // Final snapshots
  const finalSnapshots: PlayerSnapshot[] = agents.map((a) => ({
    level: a.level,
    gold: a.gold,
    totalGoldEarned: a.totalGoldEarned,
    totalGoldSpent: a.totalGoldSpent,
    inventory: { ...a.inventory },
    playTimeHours: a.playTimeHours,
  }));

  return {
    config,
    metrics,
    alerts,
    supplyDemand,
    finalSnapshots,
    durationMs: Date.now() - startTime,
    completedAt: new Date().toISOString(),
  };
}

// ── Agent State ─────────────────────────────────────────────────────────────

interface AgentState {
  id: number;
  level: number;
  xp: number;
  gold: number;
  totalGoldEarned: number;
  totalGoldSpent: number;
  inventory: Record<string, number>;
  playTimeHours: number;
  efficiencyMul: number;
  spendBias: number;
}

// ── Simulate One Hour for One Agent ─────────────────────────────────────────

function simulateAgentHour(
  agent: AgentState,
  hour: number,
  faucets: EconomyFlow[],
  sinks: EconomyFlow[],
  items: EconomyItem[],
  xpCurve: XPCurvePoint[],
  config: SimulationConfig,
  rng: () => number,
  mods: { faucetMul: number; sinkMul: number; dropMul: number },
): SimulationTick {
  let goldEarned = 0;
  let goldSpent = 0;

  // Gold faucets
  for (const flow of faucets) {
    if (agent.level < flow.minLevel) continue;
    if (flow.maxLevel > 0 && agent.level > flow.maxLevel) continue;

    const amount = flow.baseAmount + flow.levelScaling * agent.level;
    const occurrences = Math.floor(flow.frequencyPerHour * agent.efficiencyMul + rng());

    for (let i = 0; i < occurrences; i++) {
      const variance = 0.7 + rng() * 0.6; // ±30% variance
      const earned = Math.round(amount * variance);
      goldEarned += earned;
    }
  }

  // Gold sinks
  for (const flow of sinks) {
    if (agent.level < flow.minLevel) continue;
    if (flow.maxLevel > 0 && agent.level > flow.maxLevel) continue;

    // Death penalty is special: percentage of held gold
    if (flow.id === 'death-penalty') {
      const deathChance = 0.15 - agent.level * 0.003; // Decreases with level
      if (rng() < Math.max(deathChance, 0.02) * agent.efficiencyMul) {
        const penalty = Math.round(agent.gold * 0.05); // 5% gold loss
        goldSpent += penalty;
      }
      continue;
    }

    const amount = flow.baseAmount + flow.levelScaling * agent.level;
    const spendFreq = flow.frequencyPerHour * (0.5 + agent.spendBias * 0.5);
    const occurrences = Math.floor(spendFreq * agent.efficiencyMul + rng());

    for (let i = 0; i < occurrences; i++) {
      const cost = Math.round(amount * (0.8 + rng() * 0.4));
      // Only spend if agent can afford it
      if (agent.gold + goldEarned - goldSpent >= cost) {
        goldSpent += cost;
      }
    }
  }

  // Item drops (simplified: accumulate in inventory for vendor sale tracking)
  const availableItems = items.filter((it) => agent.level >= it.minLevel);
  const totalWeight = availableItems.reduce((sum, it) => sum + it.dropWeight * mods.dropMul, 0);
  const dropsPerHour = Math.round(12 * agent.efficiencyMul + rng() * 4);

  for (let i = 0; i < dropsPerHour; i++) {
    let roll = rng() * totalWeight;
    for (const item of availableItems) {
      roll -= item.dropWeight * mods.dropMul;
      if (roll <= 0) {
        agent.inventory[item.id] = (agent.inventory[item.id] ?? 0) + 1;
        break;
      }
    }
  }

  // XP gain (simplified: based on kills/hour scaled by level)
  const xpPerHour = Math.round(
    (50 + agent.level * 30) * agent.efficiencyMul * (0.8 + rng() * 0.4),
  );
  agent.xp += xpPerHour;

  // Level up check
  while (agent.level < config.maxLevel) {
    const nextLevelData = xpCurve[agent.level]; // xpCurve[level] = XP needed for next level
    if (!nextLevelData || agent.xp < nextLevelData.xpRequired) break;
    agent.xp -= nextLevelData.xpRequired;
    agent.level++;
  }

  // Apply gold changes
  agent.gold += goldEarned - goldSpent;
  if (agent.gold < 0) agent.gold = 0;
  agent.totalGoldEarned += goldEarned;
  agent.totalGoldSpent += goldSpent;
  agent.playTimeHours = hour + 1;

  return {
    hour,
    level: agent.level,
    gold: agent.gold,
    goldEarned,
    goldSpent,
    netFlow: goldEarned - goldSpent,
  };
}

// ── Flow Overrides ──────────────────────────────────────────────────────────

function applyFlowOverrides(
  defaults: EconomyFlow[],
  overrides: Partial<EconomyFlow>[] | undefined,
  multiplier: number,
): EconomyFlow[] {
  const flows = defaults.map((f) => ({
    ...f,
    baseAmount: Math.round(f.baseAmount * multiplier),
    levelScaling: f.levelScaling * multiplier,
  }));

  if (!overrides) return flows;
  for (const ov of overrides) {
    const idx = flows.findIndex((f) => f.id === ov.id);
    if (idx >= 0) {
      flows[idx] = { ...flows[idx], ...ov };
    }
  }
  return flows;
}

// ── Supply/Demand Tracking ──────────────────────────────────────────────────

function trackSupplyDemand(
  agent: AgentState,
  items: EconomyItem[],
  accum: Map<string, { supply: number; demand: number; priceSum: number; count: number }>,
  mods: { dropMul: number },
  rng: () => number,
) {
  for (const item of items) {
    if (agent.level < item.minLevel) continue;
    const key = `${agent.level}-${item.category}`;
    const entry = accum.get(key) ?? { supply: 0, demand: 0, priceSum: 0, count: 0 };
    const price = item.sellPrice + item.levelScaling * agent.level;

    entry.supply += item.dropWeight * mods.dropMul * 0.1;
    entry.demand += (item.category === 'consumable' ? 3 : 0.5) * (0.5 + rng() * 0.5);
    entry.priceSum += price;
    entry.count++;
    accum.set(key, entry);
  }
}

// ── Metrics Computation ─────────────────────────────────────────────────────

function computeMetrics(agents: AgentState[], hour: number, avgLevel: number): EconomyMetrics {
  const golds = agents.map((a) => a.gold).sort((a, b) => a - b);
  const totalGold = golds.reduce((sum, g) => sum + g, 0);
  const avgGold = totalGold / agents.length;
  const medianGold = golds[Math.floor(golds.length / 2)];

  // Gini coefficient
  const gini = computeGini(golds);

  // Estimate flows from last hour
  const inflowPerHour = agents.reduce((sum, a) => sum + a.totalGoldEarned, 0) / Math.max(hour, 1);
  const outflowPerHour = agents.reduce((sum, a) => sum + a.totalGoldSpent, 0) / Math.max(hour, 1);
  const velocity = totalGold > 0 ? (inflowPerHour + outflowPerHour) / totalGold : 0;

  return {
    level: avgLevel,
    hour,
    avgGold: Math.round(avgGold),
    medianGold,
    minGold: golds[0],
    maxGold: golds[golds.length - 1],
    totalGold,
    giniCoefficient: Math.round(gini * 1000) / 1000,
    inflowPerHour: Math.round(inflowPerHour),
    outflowPerHour: Math.round(outflowPerHour),
    netFlowPerHour: Math.round(inflowPerHour - outflowPerHour),
    velocity: Math.round(velocity * 1000) / 1000,
  };
}

function computeGini(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const total = sorted.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;

  let sumOfDiffs = 0;
  for (let i = 0; i < n; i++) {
    sumOfDiffs += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return sumOfDiffs / (n * total);
}

// ── Metrics Array Builder ───────────────────────────────────────────────────

function buildMetricsArray(
  metricsMap: Map<number, EconomyMetrics>,
  maxHours: number,
): EconomyMetrics[] {
  const result: EconomyMetrics[] = [];
  // Sample every hour for small sims, or every N hours for large ones
  const step = maxHours <= 100 ? 1 : Math.max(1, Math.floor(maxHours / 100));
  for (let h = 0; h < maxHours; h += step) {
    const m = metricsMap.get(h);
    if (m) result.push(m);
  }
  return result;
}

// ── Alert Detection ─────────────────────────────────────────────────────────

function detectAlerts(
  metrics: EconomyMetrics[],
  items: EconomyItem[],
  config: SimulationConfig,
): InflationAlert[] {
  const alerts: InflationAlert[] = [];

  for (let i = 1; i < metrics.length; i++) {
    const m = metrics[i];
    const prev = metrics[i - 1];

    // Inflation: net flow consistently positive and growing
    if (m.netFlowPerHour > 0 && m.netFlowPerHour > prev.netFlowPerHour * 1.2) {
      const severity = m.netFlowPerHour > m.outflowPerHour * 2 ? 'critical'
        : m.netFlowPerHour > m.outflowPerHour ? 'warning' : 'info';
      alerts.push({
        level: m.level,
        hour: m.hour,
        severity,
        type: 'inflation',
        message: `Gold inflow exceeds sinks by ${Math.round(m.netFlowPerHour)} gold/hr at level ${m.level}`,
        metric: 'netFlowPerHour',
        value: m.netFlowPerHour,
        threshold: 0,
      });
    }

    // Deflation: net flow heavily negative
    if (m.netFlowPerHour < 0 && Math.abs(m.netFlowPerHour) > m.inflowPerHour * 0.5) {
      alerts.push({
        level: m.level,
        hour: m.hour,
        severity: 'warning',
        type: 'deflation',
        message: `Gold sinks drain ${Math.abs(m.netFlowPerHour)} gold/hr more than income at level ${m.level}`,
        metric: 'netFlowPerHour',
        value: m.netFlowPerHour,
        threshold: 0,
      });
    }

    // Wealth inequality
    if (m.giniCoefficient > 0.6) {
      alerts.push({
        level: m.level,
        hour: m.hour,
        severity: m.giniCoefficient > 0.8 ? 'critical' : 'warning',
        type: 'wealth-inequality',
        message: `Gini coefficient ${m.giniCoefficient} indicates severe wealth disparity at level ${m.level}`,
        metric: 'giniCoefficient',
        value: m.giniCoefficient,
        threshold: 0.6,
      });
    }
  }

  // Price imbalance checks
  for (const item of items) {
    const levelPrice = item.buyPrice + item.levelScaling * Math.round(config.maxLevel * 0.5);
    // Check if health potions are < 1% of hourly income at mid-level
    if (item.id === 'health-potion') {
      const midMetrics = metrics[Math.floor(metrics.length / 2)];
      if (midMetrics) {
        const hourlyIncome = midMetrics.inflowPerHour / config.agentCount;
        if (levelPrice < hourlyIncome * 0.01) {
          alerts.push({
            level: midMetrics.level,
            hour: midMetrics.hour,
            severity: 'info',
            type: 'price-imbalance',
            message: `Health potions too cheap (${levelPrice}g) relative to income (${Math.round(hourlyIncome)}g/hr) — trivializes resource management`,
            metric: 'potionAffordability',
            value: levelPrice,
            threshold: hourlyIncome * 0.01,
          });
        }
      }
    }

    // Legendary items unobtainable check
    if (item.rarity === 'legendary') {
      const endMetrics = metrics[metrics.length - 1];
      if (endMetrics) {
        const endPrice = item.buyPrice + item.levelScaling * config.maxLevel;
        const avgEndGold = endMetrics.avgGold;
        if (endPrice > avgEndGold * 3) {
          alerts.push({
            level: endMetrics.level,
            hour: endMetrics.hour,
            severity: 'warning',
            type: 'price-imbalance',
            message: `${item.name} costs ${endPrice}g but avg player has ${Math.round(avgEndGold)}g at endgame — may be unobtainable`,
            metric: 'legendaryAffordability',
            value: endPrice,
            threshold: avgEndGold * 3,
          });
        }
      }
    }
  }

  // Deduplicate similar alerts (keep highest severity per type per level range)
  return deduplicateAlerts(alerts);
}

function deduplicateAlerts(alerts: InflationAlert[]): InflationAlert[] {
  const seen = new Map<string, InflationAlert>();
  const severityRank = { info: 0, warning: 1, critical: 2 };

  for (const alert of alerts) {
    // Group by type and level bucket (every 5 levels)
    const bucket = Math.floor(alert.level / 5);
    const key = `${alert.type}-${bucket}`;
    const existing = seen.get(key);
    if (!existing || severityRank[alert.severity] > severityRank[existing.severity]) {
      seen.set(key, alert);
    }
  }
  return [...seen.values()].sort((a, b) => a.hour - b.hour);
}

// ── Supply/Demand Builder ───────────────────────────────────────────────────

function buildSupplyDemand(
  accum: Map<string, { supply: number; demand: number; priceSum: number; count: number }>,
  agents: AgentState[],
  config: SimulationConfig,
): SupplyDemandPoint[] {
  const points: SupplyDemandPoint[] = [];
  const categories: ItemCategory[] = ['weapon', 'armor', 'consumable', 'material', 'gem'];

  for (let level = 1; level <= config.maxLevel; level++) {
    for (const cat of categories) {
      const key = `${level}-${cat}`;
      const data = accum.get(key);
      if (!data || data.count === 0) continue;

      const avgPrice = data.priceSum / data.count;
      // Estimate hourly income at this level from metrics
      const avgGold = agents
        .filter((a) => a.level >= level)
        .reduce((sum, a) => sum + a.totalGoldEarned, 0) / Math.max(agents.length, 1) / Math.max(level, 1);

      points.push({
        level,
        category: cat,
        supplyRate: Math.round(data.supply * 10) / 10,
        demandRate: Math.round(data.demand * 10) / 10,
        avgPrice: Math.round(avgPrice),
        affordabilityIndex: avgGold > 0 ? Math.round((avgPrice / avgGold) * 100) / 100 : 999,
      });
    }
  }
  return points;
}
