/**
 * The economy's node map must be able to say what each node IS, and the simulation
 * must actually run the node it declared.
 *
 * Standard: ai-registry `knowledge/game-production/systems-canon/game-economy-tuning`
 *   - source-drain-converter-trader-vocabulary — five node kinds; a node that cannot be
 *     named as one of them has not been audited; "a converter recorded on only one side
 *     is an unfunded faucet, and an unfunded faucet is inflation with no author".
 *   - structural-economy-simulation-before-numbers — a band is a statement about a
 *     window; a structural defect passes every band.
 *   - L13 declaring an input is not consuming it; L1 unmeasured is not a pass.
 *
 * Every fixture below is built from the SHIPPED definitions (DEFAULT_FAUCETS /
 * DEFAULT_SINKS), never from invented flows.
 */
import { describe, it, expect } from 'vitest';
import { runSimulation } from '@/lib/economy/simulation-engine';
import { DEFAULT_SINKS, getAllFlows, DECLARED_LOOPS } from '@/lib/economy/definitions';
import {
  ECONOMY_NODE_KINDS,
  nodeKindOf,
  auditEconomyNodes,
  evaluateBalanceBand,
} from '@/lib/economy/node-audit';
import { readCanonThresholds, checkFaucetSinkBalance } from '@/lib/balance/canon-conformance';
import type { EconomyFlow, EconomyMetrics, SimulationConfig } from '@/types/economy-simulator';

const T = readCanonThresholds();

const BASE: SimulationConfig = {
  agentCount: 12, maxLevel: 8, maxPlayHours: 20, philosophy: 'balanced', seed: 11,
};

/**
 * A tuned-sink stance built from the SHIPPED sinks (x7 on amount + scaling, death
 * penalty untouched because it is a percent-of-balance node). This is the only
 * purpose of the multiplier: it moves the shipped economy INTO the +/-15% band so the
 * band's blindness to the topology is observable rather than masked by the shipped
 * default's inflation.
 */
function tunedSinks(mul: number): Partial<EconomyFlow>[] {
  return DEFAULT_SINKS
    .filter((s) => s.id !== 'death-penalty')
    .map((s) => ({ id: s.id, baseAmount: s.baseAmount * mul, levelScaling: s.levelScaling * mul }));
}

function withVendorFrequency(freq: number): SimulationConfig {
  return { ...BASE, flowOverrides: [...tunedSinks(7), { id: 'loot-vendor-sell', frequencyPerHour: freq }] };
}

function lastMetric(m: EconomyMetrics[]) { return m[m.length - 1]; }

const balancedMetrics: EconomyMetrics[] = [{
  level: 8, hour: 19, avgGold: 500, medianGold: 400, minGold: 0, maxGold: 2000,
  totalGold: 6000, giniCoefficient: 0.3, inflowPerHour: 100, outflowPerHour: 98,
  netFlowPerHour: 2, velocity: 0.1,
}];

// -- 1. Vocabulary ----------------------------------------------------------

describe('economy node vocabulary — five kinds, none skipped, no sixth invented', () => {
  it('names every shipped flow as one of the five node kinds', () => {
    for (const flow of getAllFlows()) {
      expect(ECONOMY_NODE_KINDS).toContain(nodeKindOf(flow.type));
    }
  });

  it('the vendor loot sale is a CONVERTER with a declared input leg, not a plain source', () => {
    const vendor = getAllFlows().find((f) => f.id === 'loot-vendor-sell')!;
    expect(nodeKindOf(vendor.type)).toBe('converter');
    expect(vendor.input?.resource).toBe('items');
    expect(vendor.input?.unitsPerOccurrence).toBeGreaterThan(0);
  });

  it('the death penalty declares its percent-of-balance mechanism instead of being an id special case', () => {
    const death = getAllFlows().find((f) => f.id === 'death-penalty')!;
    expect(death.mechanism).toBe('percent-of-balance');
    expect(death.percentOfBalance).toBeGreaterThan(0);
  });
});

// -- 2. THE DECISIVE TEST ---------------------------------------------------

describe('the +/-15% band is blind to an unfunded converter', () => {
  it('DECISIVE — the band passes while vendor sales run against an item pool that cannot supply them', () => {
    const result = runSimulation(withVendorFrequency(50));

    // The band arithmetic itself is satisfied: this configuration is inside +/-15%.
    expect(checkFaucetSinkBalance(result.metrics, T)).toHaveLength(0);

    // ...and that is exactly why the band cannot be the verdict. 50 sales/hour are
    // scheduled against an item pool the model fills at ~12 items/hour, so most of
    // the gold has no metered input. The simulator must NOT report that as balanced.
    expect(result.balance.verdict).not.toBe('pass');
    expect(result.balance.verdict).toBe('unspecified');

    const starved = result.audit.starved.find((s) => s.id === 'loot-vendor-sell');
    expect(starved).toBeDefined();
    expect(starved!.starvedFraction).toBeGreaterThan(0.5);
  });
});

// -- 3. The converter consumes its input pool -------------------------------

describe('the vendor converter consumes the item pool it declares', () => {
  it('gold from vendor sales is bounded by the item supply, not by the declared frequency', () => {
    const at12 = lastMetric(runSimulation(withVendorFrequency(12)).metrics).inflowPerHour;
    const at50 = lastMetric(runSimulation(withVendorFrequency(50)).metrics).inflowPerHour;
    // A funded converter cannot out-produce its input. Quadrupling the sale frequency
    // above the drop rate must not meaningfully raise gold inflow.
    expect(at50).toBeLessThan(at12 * 1.15);
  });

  it('reads the item pool it writes — stock is decremented, not monotonic (L13)', () => {
    const result = runSimulation(BASE);
    expect(result.audit.ledger.itemsConsumed).toBeGreaterThan(0);
    const heldAtEnd = result.finalSnapshots.reduce(
      (sum, a) => sum + Object.values(a.inventory).reduce((x, y) => x + y, 0), 0);
    expect(heldAtEnd).toBeLessThan(result.audit.ledger.itemsProduced);
  });
});

// -- 4. No unnamed source ---------------------------------------------------

describe('the negative-gold clamp is not an unnamed source', () => {
  it('creates no gold and leaves no undeclared source in the ledger', () => {
    // A sink-heavy stance is where the old clamp fired: the death penalty was taken
    // from the START-of-hour balance, so it could push a spent-out agent negative.
    const result = runSimulation({ ...BASE, philosophy: 'scarcity-based', flowOverrides: tunedSinks(9) });
    expect(result.audit.ledger.mintedByClamp).toBe(0);
    expect(result.audit.undeclaredSources).toHaveLength(0);
    for (const snapshot of result.finalSnapshots) {
      expect(snapshot.gold).toBeGreaterThanOrEqual(0);
    }
  });
});

// -- 5. Declared loops ------------------------------------------------------

describe('the balancing loops are declared, not special-cased', () => {
  it('declares each loop with a polarity, a latency, a gain provenance and a job', () => {
    expect(DECLARED_LOOPS.length).toBeGreaterThanOrEqual(2);
    for (const loop of DECLARED_LOOPS) {
      expect(['reinforcing', 'balancing']).toContain(loop.polarity);
      expect(loop.latencyHours).toBeGreaterThan(0);
      // "A loop whose gain nobody has estimated reports as uncharacterised,
      //  never as weak and never as benign."
      expect(loop.gain).toBe('uncharacterised');
      expect(loop.job.length).toBeGreaterThan(0);
    }
    const ids = DECLARED_LOOPS.map((l) => l.id);
    expect(ids).toContain('death-penalty-drag');
    expect(ids).toContain('affordability-guard');
  });

  it('carries the declared topology on the simulation result', () => {
    expect(runSimulation(BASE).loops.map((l) => l.id)).toEqual(DECLARED_LOOPS.map((l) => l.id));
  });
});

// -- 6. Verdict honesty (pure) ----------------------------------------------

describe('an unaudited node map can never report as balanced', () => {
  it('reports not-measured with no metrics', () => {
    const audit = auditEconomyNodes(getAllFlows());
    expect(evaluateBalanceBand([], audit, T.faucetSinkTolerance).verdict).toBe('not-measured');
  });

  it('reports unclassified when a node kind is not one of the five', () => {
    const mystery = { ...getAllFlows()[0], id: 'mystery-rebate', type: 'rebate' as unknown as EconomyFlow['type'] };
    const audit = auditEconomyNodes([...getAllFlows(), mystery]);
    expect(audit.unclassified).toContain('mystery-rebate');
    expect(audit.clean).toBe(false);
    expect(evaluateBalanceBand(balancedMetrics, audit, T.faucetSinkTolerance).verdict).toBe('unclassified');
  });

  it('reports unclassified for a converter recorded on only one side (an unfunded faucet)', () => {
    const flows = getAllFlows().map((f) => (f.id === 'loot-vendor-sell' ? { ...f, input: undefined } : f));
    const audit = auditEconomyNodes(flows);
    expect(audit.unfunded).toContain('loot-vendor-sell');
    expect(evaluateBalanceBand(balancedMetrics, audit, T.faucetSinkTolerance).verdict).toBe('unclassified');
  });

  it('passes only when the map is clean AND the band holds', () => {
    const audit = auditEconomyNodes(getAllFlows());
    expect(audit.clean).toBe(true);
    expect(evaluateBalanceBand(balancedMetrics, audit, T.faucetSinkTolerance).verdict).toBe('pass');
  });
});
