/**
 * Naming every node in the gold economy, closing the books, and turning that into an
 * HONEST balance verdict.
 *
 * Standard: ai-registry `knowledge/game-production/systems-canon/game-economy-tuning`
 * — `source-drain-converter-trader-vocabulary`:
 *
 *   "A quantity in the economy that cannot be named as one of the five has not been
 *    audited, and an automated check cannot reason about it. An unclassified node
 *    reports as unclassified, and an economy containing one reports as unaudited —
 *    never as balanced."
 *
 *   "A converter recorded on only one side is an unfunded faucet, and an unfunded
 *    faucet is inflation with no author."
 *
 * and `structural-economy-simulation-before-numbers`: a band is a statement about a
 * window, so a band cannot see a topology defect. This module is what stops the band
 * from being quoted as if it could.
 *
 * Pure: classification + book-closing + verdict. No I/O, no randomness.
 */

import type {
  BalanceBandResult,
  EconomyAudit,
  EconomyFlow,
  EconomyLedger,
  EconomyMetrics,
  EconomyNodeKind,
  StarvedNode,
  UndeclaredSource,
} from '@/types/economy-simulator';

/** The five functional node kinds. No sixth is invented; none of the five is skipped. */
export const ECONOMY_NODE_KINDS: readonly EconomyNodeKind[] = [
  'source', 'drain', 'converter', 'trader', 'pool',
] as const;

/**
 * The legacy two-word vocabulary maps onto the functional one: `faucet` IS a source
 * and `sink` IS a drain. Persisted flows keep their old spelling and still classify.
 */
const LEGACY_KIND: Record<string, EconomyNodeKind> = {
  faucet: 'source',
  sink: 'drain',
  source: 'source',
  drain: 'drain',
  converter: 'converter',
  trader: 'trader',
  pool: 'pool',
};

/**
 * Name a node's functional kind. Returns `'unclassified'` for anything the vocabulary
 * does not cover — deliberately, and never a fallback to `'source'`/`'drain'`: "a
 * wrong classification is worse than a missing one because it is arithmetically
 * absorbed."
 */
export function nodeKindOf(type: string): EconomyNodeKind | 'unclassified' {
  return LEGACY_KIND[type] ?? 'unclassified';
}

/**
 * A converter is allowed to be starved a little — a stochastic model will always
 * schedule an occurrence against a momentarily empty pool. Beyond this fraction the
 * node's DECLARED frequency is not a rate the structure can supply, which makes the
 * rate unspecified rather than merely low: "an unestimated frequency is recorded as
 * unestimated... an economy containing one is reported as unspecified rather than as
 * balanced." Basis: fraction of scheduled occurrences, over the whole run.
 */
export const STARVATION_TOLERANCE = 0.05;

export const EMPTY_LEDGER: EconomyLedger = {
  itemsProduced: 0,
  itemsConsumed: 0,
  goldFromConversions: 0,
  mintedByClamp: 0,
};

export interface AuditRuntime {
  /** What the run actually moved. */
  ledger: EconomyLedger;
  /** Per-node scheduled vs fired occurrences, keyed by flow id. */
  starved: StarvedNode[];
  /** Quantities created with no declared node behind them. */
  undeclaredSources: UndeclaredSource[];
}

/**
 * Name every node, then close the books.
 *
 * Static call (no `runtime`): the shape audit only — is every node named, and does
 * every converter record both legs. That is what an authoring-time check can know.
 * With `runtime`: also carries the run's ledger, its starved nodes and any quantity
 * the model created that no node accounts for.
 */
export function auditEconomyNodes(flows: EconomyFlow[], runtime?: AuditRuntime): EconomyAudit {
  const nodes = flows.map((f) => ({ id: f.id, name: f.name, kind: nodeKindOf(f.type) }));
  const unclassified = nodes.filter((n) => n.kind === 'unclassified').map((n) => n.id);

  // A converter's output leg must be funded by an input leg. Both legs, or it is a
  // source wearing a converter's name.
  const unfunded = flows
    .filter((f) => nodeKindOf(f.type) === 'converter')
    .filter((f) => !f.input || !(f.input.unitsPerOccurrence > 0) || !f.input.resource)
    .map((f) => f.id);

  const ledger = runtime?.ledger ?? EMPTY_LEDGER;
  const starved = (runtime?.starved ?? []).filter((s) => s.starvedFraction > STARVATION_TOLERANCE);
  const undeclaredSources = runtime?.undeclaredSources ?? [];

  return {
    nodes,
    unclassified,
    unfunded,
    starved,
    undeclaredSources,
    ledger,
    clean:
      unclassified.length === 0 &&
      unfunded.length === 0 &&
      starved.length === 0 &&
      undeclaredSources.length === 0,
  };
}

/**
 * The faucet/sink band verdict, computed ONLY where it means something.
 *
 * Order matters: structure outranks arithmetic. A band measured over a map with an
 * unnamed node, an unfunded converter or an unaccounted source was computed over a
 * set the checker believes is complete and is not — "a verdict that is confidently
 * wrong rather than honestly absent".
 *
 * @param tolerance read from the canon seed by the caller; never hardcoded here, so
 *                  the law and its check keep one source.
 */
export function evaluateBalanceBand(
  metrics: EconomyMetrics[],
  audit: EconomyAudit,
  tolerance: number,
): BalanceBandResult {
  const basis = `endgame metric, cumulative gold/hr across all agents, band ±${(tolerance * 100).toFixed(0)}%`;

  if (metrics.length === 0) {
    return { verdict: 'not-measured', tolerance, basis, reason: 'No metrics were produced.' };
  }

  if (audit.unclassified.length > 0 || audit.unfunded.length > 0 || audit.undeclaredSources.length > 0) {
    const reasons: string[] = [];
    if (audit.unclassified.length > 0) {
      reasons.push(`unclassified node(s): ${audit.unclassified.join(', ')}`);
    }
    if (audit.unfunded.length > 0) {
      reasons.push(`converter(s) recorded on only one side: ${audit.unfunded.join(', ')}`);
    }
    for (const u of audit.undeclaredSources) {
      reasons.push(`${u.units} ${u.resource} created by an undeclared source (${u.id})`);
    }
    return {
      verdict: 'unclassified',
      tolerance,
      basis,
      reason: `The node map has not been audited — ${reasons.join('; ')}. A balance number over this map would be confidently wrong, not honestly absent.`,
    };
  }

  const last = metrics[metrics.length - 1];
  const denom = Math.max(last.inflowPerHour, last.outflowPerHour, 1);
  const imbalance = Math.abs(last.inflowPerHour - last.outflowPerHour) / denom;

  if (audit.starved.length > 0) {
    const worst = audit.starved
      .map((s) => `${s.id} fired ${s.fired}/${s.scheduled} (${Math.round(s.starvedFraction * 100)}% starved on ${s.resource})`)
      .join('; ');
    return {
      verdict: 'unspecified',
      tolerance,
      basis,
      imbalance,
      reason: `A declared frequency the structure cannot supply is an unspecified rate, not a low one — ${worst}. The band was measured over a specification that does not hold.`,
    };
  }

  return {
    verdict: imbalance <= tolerance ? 'pass' : 'fail',
    tolerance,
    basis,
    imbalance,
  };
}
