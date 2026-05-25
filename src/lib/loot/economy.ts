/**
 * Loot economy (ECW Phase 10-L, ideas from the loot batch). Pure expected-value
 * math + a designer-facing economy linter over an enemy→loot binding. The
 * loot-tables catalog entity's `data` is an EnemyLootBinding; these functions
 * turn its drop chance + rarity weights + bonus gold into gold-per-kill and
 * sanity findings. Pure (facets render the output).
 */

import { DEFAULT_RARITY_GOLD } from '@/components/modules/core-engine/sub_loot/_shared/data-binding';

/** Rarity tiers in the order `rarityWeights` indices map to. */
export const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;

/** The fields of EnemyLootBinding the economy math needs (structurally compatible). */
export interface LootBindingLike {
  lootTableName: string;
  dropChance: number;
  rarityWeights: number[];
  bonusGold: number;
}

/** Narrow an arbitrary catalog entity's `data` to a loot binding, or null. */
export function asLootBinding(data: unknown): LootBindingLike | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.dropChance !== 'number' || !Array.isArray(d.rarityWeights) || typeof d.bonusGold !== 'number') return null;
  return {
    lootTableName: typeof d.lootTableName === 'string' ? d.lootTableName : '',
    dropChance: d.dropChance,
    rarityWeights: d.rarityWeights as number[],
    bonusGold: d.bonusGold,
  };
}

export interface RarityContribution {
  rarity: string;
  weightPct: number;
  goldValue: number;
  /** EV contribution of this rarity = dropChance · (weight / Σweights) · goldValue. */
  contribution: number;
}

export interface EconomyFinding {
  severity: 'ok' | 'warn' | 'error';
  rule: string;
  message: string;
}

type RarityGold = Record<string, number>;

const MIN_PEERS = 2;
const HIGH_FACTOR = 2.5;
const LOW_FACTOR = 0.4;
const WEIGHT_SUM_TOLERANCE = 5; // weights are percentages; accept 95–105

function weightSum(weights: number[]): number {
  return weights.reduce((s, w) => s + w, 0);
}

/** Expected item gold given a drop occurs (rarity-weighted average value). */
function expectedItemGold(binding: LootBindingLike, rarityGold: RarityGold): number {
  const total = weightSum(binding.rarityWeights);
  if (total <= 0) return 0;
  return binding.rarityWeights.reduce((sum, w, i) => {
    const rarity = RARITY_ORDER[i];
    const gold = rarity ? rarityGold[rarity] ?? 0 : 0;
    return sum + (w / total) * gold;
  }, 0);
}

/** Expected gold per kill = dropChance · expected item gold + bonus gold (rounded). */
export function computeExpectedValue(binding: LootBindingLike, rarityGold: RarityGold = DEFAULT_RARITY_GOLD): number {
  return Math.round(binding.dropChance * expectedItemGold(binding, rarityGold) + binding.bonusGold);
}

/** Per-rarity EV contribution (excludes bonus gold), in rarity order. */
export function rarityBreakdown(binding: LootBindingLike, rarityGold: RarityGold = DEFAULT_RARITY_GOLD): RarityContribution[] {
  const total = weightSum(binding.rarityWeights);
  return RARITY_ORDER.map((rarity, i) => {
    const w = binding.rarityWeights[i] ?? 0;
    const goldValue = rarityGold[rarity] ?? 0;
    const fraction = total > 0 ? w / total : 0;
    return {
      rarity,
      weightPct: total > 0 ? Math.round((w / total) * 100) : 0,
      goldValue,
      contribution: binding.dropChance * fraction * goldValue,
    };
  });
}

/**
 * Lint a loot binding: structural checks (weight count, sum, drop-chance range,
 * non-negative weights) plus a roster-aware EV-outlier check when enough peers
 * are provided. Returns an `ok` finding when nothing is wrong.
 */
export function lintLootEconomy(
  binding: LootBindingLike,
  peers: LootBindingLike[],
  rarityGold: RarityGold = DEFAULT_RARITY_GOLD,
): EconomyFinding[] {
  const findings: EconomyFinding[] = [];

  if (binding.rarityWeights.length !== RARITY_ORDER.length) {
    findings.push({
      severity: 'error',
      rule: 'weight-count',
      message: `rarityWeights must have ${RARITY_ORDER.length} entries (Common→Legendary), found ${binding.rarityWeights.length}.`,
    });
  } else {
    const sum = weightSum(binding.rarityWeights);
    if (Math.abs(sum - 100) > WEIGHT_SUM_TOLERANCE) {
      findings.push({
        severity: 'warn',
        rule: 'weight-sum',
        message: `Rarity weights sum to ${sum} (expected ~100). Drop distribution may not read as intended.`,
      });
    }
  }

  if (binding.rarityWeights.some((w) => w < 0)) {
    findings.push({ severity: 'error', rule: 'negative-weight', message: 'Rarity weights must not be negative.' });
  }

  if (binding.dropChance < 0 || binding.dropChance > 1) {
    findings.push({
      severity: 'error',
      rule: 'drop-chance-range',
      message: `Drop chance ${binding.dropChance} is outside 0–1.`,
    });
  }

  const others = peers.filter((p) => p.lootTableName !== binding.lootTableName);
  if (others.length >= MIN_PEERS) {
    const ev = computeExpectedValue(binding, rarityGold);
    const peerEvs = others.map((p) => computeExpectedValue(p, rarityGold)).sort((a, b) => a - b);
    const median = peerEvs[Math.floor(peerEvs.length / 2)];
    if (median > 0 && ev > median * HIGH_FACTOR) {
      findings.push({
        severity: 'warn',
        rule: 'ev-outlier-high',
        message: `Gold value (${ev}) is ${(ev / median).toFixed(1)}× the roster median (${median}) — may over-reward.`,
      });
    } else if (median > 0 && ev < median * LOW_FACTOR) {
      findings.push({
        severity: 'warn',
        rule: 'ev-outlier-low',
        message: `Gold value (${ev}) is well below the roster median (${median}) — may feel unrewarding.`,
      });
    }
  }

  if (findings.length === 0) {
    findings.push({ severity: 'ok', rule: 'economy', message: 'Loot economy looks well-formed.' });
  }
  return findings;
}
