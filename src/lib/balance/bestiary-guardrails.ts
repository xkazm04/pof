/**
 * Cross-archetype balance guardrails (ECW Phase 10-B, idea 40a97970).
 *
 * Pure linter: given one archetype + the full bestiary roster, flag balance
 * issues — missing core data, and stats that fall far outside the same-tier
 * peer band. Powers the BestiaryBalanceFacet. No React, no store.
 */

export type BalanceSeverity = 'ok' | 'warn' | 'error';

export interface BalanceFinding {
  severity: BalanceSeverity;
  rule: string;
  message: string;
}

/** The subset of ArchetypeConfig the linter needs (kept minimal + structural). */
export interface ArchetypeLintInput {
  id: string;
  tier: string;
  stats: { label: string; value: number }[];
  abilities: string[];
}

/** Minimum same-tier peers (excluding self) before tier-band checks are meaningful. */
const MIN_PEERS = 2;
/** A stat this many× the peer mean (or 1/this below) trips a warning. */
const HIGH_FACTOR = 2.5;
const LOW_FACTOR = 0.4;

function findStat(stats: ArchetypeLintInput['stats'], keywords: string[]): number | null {
  const hit = stats.find((s) => keywords.some((k) => s.label.toLowerCase().includes(k)));
  return hit ? hit.value : null;
}

function tierBandFinding(
  rule: string,
  statName: string,
  value: number | null,
  peerValues: number[],
): BalanceFinding | null {
  if (value === null || peerValues.length < MIN_PEERS) return null;
  const mean = peerValues.reduce((s, v) => s + v, 0) / peerValues.length;
  if (mean <= 0) return null;
  const ratio = value / mean;
  if (ratio >= HIGH_FACTOR) {
    return {
      severity: 'warn',
      rule,
      message: `${statName} ${value} is ${ratio.toFixed(1)}× the same-tier average (${mean.toFixed(0)}). Verify this is intentional.`,
    };
  }
  if (ratio <= LOW_FACTOR) {
    return {
      severity: 'warn',
      rule,
      message: `${statName} ${value} is well below the same-tier average (${mean.toFixed(0)}). May be under-tuned.`,
    };
  }
  return null;
}

export function lintArchetypeBalance(
  entity: ArchetypeLintInput,
  roster: ArchetypeLintInput[],
): BalanceFinding[] {
  const findings: BalanceFinding[] = [];

  // Presence checks (errors).
  if (!entity.abilities || entity.abilities.length === 0) {
    findings.push({ severity: 'error', rule: 'has-abilities', message: 'No abilities defined — the enemy has no way to act.' });
  }
  if (!entity.stats || entity.stats.length === 0) {
    findings.push({ severity: 'error', rule: 'has-core-stats', message: 'No stats defined — cannot balance or spawn.' });
  }

  // Cross-archetype tier-band checks (warnings).
  const peers = roster.filter((a) => a.tier === entity.tier && a.id !== entity.id);
  const peerHealth = peers.map((a) => findStat(a.stats, ['health', 'hp'])).filter((v): v is number => v !== null);
  const peerDamage = peers.map((a) => findStat(a.stats, ['damage', 'dmg', 'atk'])).filter((v): v is number => v !== null);

  const healthFinding = tierBandFinding('tier-health-band', 'Health', findStat(entity.stats, ['health', 'hp']), peerHealth);
  if (healthFinding) findings.push(healthFinding);
  const damageFinding = tierBandFinding('tier-damage-band', 'Damage', findStat(entity.stats, ['damage', 'dmg', 'atk']), peerDamage);
  if (damageFinding) findings.push(damageFinding);

  if (findings.length === 0) {
    findings.push({
      severity: 'ok',
      rule: 'balanced',
      message: peers.length >= MIN_PEERS
        ? `Balance looks consistent with ${peers.length} same-tier peers.`
        : 'Core data present. Too few same-tier peers to compare bands.',
    });
  }

  return findings;
}
