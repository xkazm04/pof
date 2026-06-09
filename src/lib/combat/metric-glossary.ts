/**
 * Plain-language dictionary for the jargon used by the Combat Balance Simulator.
 *
 * The simulator is the most acronym-dense screen in the product — it surfaces
 * terms like "DPS", "Monte Carlo", "GAS", "One-Shot Rate", "Armor Weight" and
 * "kill share" that a day-to-day, non-technical user cannot parse. This map is
 * the single source of truth behind the inline {@link MetricLabel} tooltips, so
 * every panel (KPI cards, mini-stats, the ability heatmap, the tuning sliders)
 * defines a term the same way and is trivial to extend as new metrics appear.
 *
 * Keyed by **metric id** — usually the literal `CombatSummary` / `TuningOverrides`
 * field name (e.g. `avgDPS`, `armorEffectivenessWeight`) so callers can pass the
 * raw key they already hold. Acronym entries (`gas`, `monteCarlo`, `dps`) use a
 * short slug.
 *
 * Keep entries terse: one jargon-free sentence for `plain`, one concrete
 * `example`. Mirrors the shape of `prompt-evolution/stats-glossary.ts`.
 */

export interface MetricGlossaryEntry {
  /** Stable key — the same string passed to `lookupMetric`. */
  id: string;
  /** Canonical display term (e.g. "Player DPS", "One-Shot Rate"). */
  term: string;
  /** One jargon-free sentence describing what the metric means. */
  plain: string;
  /** One concrete worked example that grounds the definition. */
  example: string;
}

const COMBAT_METRICS: Record<string, MetricGlossaryEntry> = {
  // ── Headline KPIs (CombatSummary) ──────────────────────────────────────────
  survivalRate: {
    id: 'survivalRate',
    term: 'Survival',
    plain: 'The share of simulated fights the player lives through.',
    example: '70% means the player wins 7 of every 10 fights against this encounter.',
  },
  avgFightDurationSec: {
    id: 'avgFightDurationSec',
    term: 'Avg Duration',
    plain: 'How long a single fight lasts on average, in seconds.',
    example: 'An 8.0s average means most fights are over before a real-time minute passes.',
  },
  medianFightDurationSec: {
    id: 'medianFightDurationSec',
    term: 'Median Duration',
    plain: 'The middle fight length — half of fights are shorter and half are longer.',
    example: 'A 6s median with a 9s average means a few long fights are pulling the average up.',
  },
  avgDPS: {
    id: 'avgDPS',
    term: 'Player DPS',
    plain: 'Damage Per Second — how much damage the player deals on average each second.',
    example: '120 DPS against a 600-HP enemy clears it in about 5 seconds.',
  },
  avgEnemyDPS: {
    id: 'avgEnemyDPS',
    term: 'Enemy DPS',
    plain: 'How much damage the enemies deal to the player on average each second.',
    example: 'If enemy DPS (40) outpaces the player’s healing, the player slowly loses the war of attrition.',
  },
  avgCritRate: {
    id: 'avgCritRate',
    term: 'Avg Crit Rate',
    plain: 'How often the player’s hits land as critical (extra-damage) hits.',
    example: 'A 25% crit rate means roughly 1 in 4 swings deals bonus damage.',
  },
  oneShotRate: {
    id: 'oneShotRate',
    term: 'One-Shot Rate',
    plain: 'The share of deaths where the player was killed by a single blow from near-full health.',
    example: 'Anything above ~5% feels unfair — players die before they can react.',
  },
  avgPlayerHealthRemaining: {
    id: 'avgPlayerHealthRemaining',
    term: 'Avg HP Left',
    plain: 'On average, how much health the player has left after winning a fight.',
    example: 'A low leftover (e.g. 15 HP) signals close calls even on wins — the encounter is on the edge.',
  },
  abilityHeatmap: {
    id: 'abilityHeatmap',
    term: 'Ability Usage',
    plain: 'How many times, on average, each ability gets used per fight.',
    example: 'An ability at 0.1 uses/fight is almost never worth pressing — buff it or cut it.',
  },

  // ── Threat breakdown ───────────────────────────────────────────────────────
  killShare: {
    id: 'killShare',
    term: 'Kill Share',
    plain: 'Of all the player’s deaths, the share caused by this one enemy or ability.',
    example: 'A 40% kill share means this single source lands 4 of every 10 killing blows — the prime nerf target.',
  },
  damageShare: {
    id: 'damageShare',
    term: 'Damage Share',
    plain: 'The share of all damage the player takes that comes from this one enemy or ability.',
    example: '30% damage share means nearly a third of incoming damage flows through this one source.',
  },

  // ── Tuning sliders (TuningOverrides) ───────────────────────────────────────
  playerHealthMul: {
    id: 'playerHealthMul',
    term: 'Player HP',
    plain: 'A multiplier on the player’s health pool for what-if balancing.',
    example: 'Setting it to 1.5× gives the player 50% more health to test a survivability buff.',
  },
  playerDamageMul: {
    id: 'playerDamageMul',
    term: 'Player Dmg',
    plain: 'A multiplier on the damage the player deals.',
    example: '0.8× weakens the player by 20% to see whether the fight turns into a grind.',
  },
  playerArmorMul: {
    id: 'playerArmorMul',
    term: 'Player Armor',
    plain: 'A multiplier on the player’s armor, which reduces incoming damage.',
    example: '2× armor roughly halves how much damage the harder hits get through.',
  },
  enemyHealthMul: {
    id: 'enemyHealthMul',
    term: 'Enemy HP',
    plain: 'A multiplier on every enemy’s health pool.',
    example: '1.5× makes enemies take 50% longer to kill — useful for testing pacing.',
  },
  enemyDamageMul: {
    id: 'enemyDamageMul',
    term: 'Enemy Dmg',
    plain: 'A multiplier on the damage enemies deal to the player.',
    example: '1.2× makes the encounter 20% deadlier without changing anything else.',
  },
  critMultiplierMul: {
    id: 'critMultiplierMul',
    term: 'Crit Multi',
    plain: 'A multiplier on how much extra damage critical hits deal.',
    example: '1.5× makes crits hit much harder, raising the player’s damage spikes.',
  },
  armorEffectivenessWeight: {
    id: 'armorEffectivenessWeight',
    term: 'Armor Weight',
    plain: 'How strongly each point of armor reduces incoming damage in the simulation’s formula.',
    example: 'A higher weight makes armor matter more, favoring tanky builds over glass cannons.',
  },

  // ── Acronyms ───────────────────────────────────────────────────────────────
  dps: {
    id: 'dps',
    term: 'DPS',
    plain: 'Damage Per Second — the average damage dealt each second.',
    example: 'A weapon doing 300 damage every 2.5s is 120 DPS.',
  },
  monteCarlo: {
    id: 'monteCarlo',
    term: 'Monte Carlo',
    plain: 'Running the same fight thousands of times with randomness to reveal the range of likely outcomes.',
    example: '1,000 simulated fights turn lucky and unlucky runs into one stable average survival rate.',
  },
  gas: {
    id: 'gas',
    term: 'GAS',
    plain: 'Gameplay Ability System — Unreal Engine’s framework for abilities, attributes, and effects.',
    example: 'Each ability here maps to a GAS GameplayAbility, the same system the shipped game runs on.',
  },
};

/**
 * Return the plain-language entry for a combat metric id, or `undefined` if we
 * have no translation. Exact key match — callers pass the raw metric id they
 * already hold (e.g. a `CombatSummary` / `TuningOverrides` field name).
 */
export function lookupMetric(id: string): MetricGlossaryEntry | undefined {
  return COMBAT_METRICS[id];
}

/** All metric ids that have a glossary entry (handy for tests/iteration). */
export function metricIds(): string[] {
  return Object.keys(COMBAT_METRICS);
}
