/**
 * Combo analysis (ECW Phase 10-C — ideas 01131c98 tension / 7b5e0a4a pacing /
 * 0545ec6c balance audit). Pure metrics + a designer-facing lint over a combat
 * combo sequence (the combat-map catalog entity's `data` is a ComboSequence).
 * Turns dps/hits/totalTime/chain into cadence + per-hit damage and same-weapon
 * outlier findings. Pure (facets render the output).
 */

export interface ComboLike {
  id: string;
  name: string;
  weaponCategory: string;
  hits: number;
  totalTime: string;
  dps: number;
  chain: string[];
}

export interface ComboMetrics {
  timeSec: number;
  hits: number;
  dps: number;
  /** dps · time — total damage dealt across the combo. */
  totalDamage: number;
  /** hits / time — attack cadence. */
  hitsPerSecond: number;
  /** totalDamage / hits — average damage per hit. */
  damagePerHit: number;
}

export interface ComboFinding {
  severity: 'ok' | 'warn' | 'error';
  rule: string;
  message: string;
}

const MIN_PEERS = 2;
const HIGH_FACTOR = 1.5;
const LOW_FACTOR = 0.6;
const LONG_COMBO_SEC = 2.8;

/** Parse a "1.5s" / "2s" duration string to seconds; 0 if unparseable. */
export function parseSeconds(totalTime: string): number {
  const n = parseFloat(totalTime);
  return Number.isFinite(n) ? n : 0;
}

export function comboMetrics(combo: ComboLike): ComboMetrics {
  const timeSec = parseSeconds(combo.totalTime);
  const totalDamage = combo.dps * timeSec;
  return {
    timeSec,
    hits: combo.hits,
    dps: combo.dps,
    totalDamage,
    hitsPerSecond: timeSec > 0 ? combo.hits / timeSec : 0,
    damagePerHit: combo.hits > 0 ? totalDamage / combo.hits : 0,
  };
}

/** Narrow arbitrary catalog entity `data` to a combo, or null. */
export function asCombo(data: unknown): ComboLike | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.weaponCategory !== 'string' || typeof d.dps !== 'number' || !Array.isArray(d.chain)) return null;
  return {
    id: typeof d.id === 'string' ? d.id : '',
    name: typeof d.name === 'string' ? d.name : '',
    weaponCategory: d.weaponCategory,
    hits: typeof d.hits === 'number' ? d.hits : (d.chain as unknown[]).length,
    totalTime: typeof d.totalTime === 'string' ? d.totalTime : '',
    dps: d.dps,
    chain: d.chain as string[],
  };
}

/**
 * Lint a combo: a chain-length/hit-count consistency check, a same-weapon DPS
 * outlier check (needs enough peers), and a long-commitment warning. Returns an
 * `ok` finding when nothing is wrong.
 */
export function lintCombo(combo: ComboLike, peers: ComboLike[]): ComboFinding[] {
  const findings: ComboFinding[] = [];

  if (combo.chain.length !== combo.hits) {
    findings.push({
      severity: 'warn',
      rule: 'chain-hits',
      message: `Chain has ${combo.chain.length} steps but hits = ${combo.hits}; the chain diagram won't match the hit count.`,
    });
  }

  const sameWeapon = peers.filter((p) => p.id !== combo.id && p.weaponCategory === combo.weaponCategory);
  if (sameWeapon.length >= MIN_PEERS) {
    const dpsList = sameWeapon.map((p) => p.dps).sort((a, b) => a - b);
    const median = dpsList[Math.floor(dpsList.length / 2)];
    if (median > 0 && combo.dps > median * HIGH_FACTOR) {
      findings.push({
        severity: 'warn',
        rule: 'dps-outlier-high',
        message: `DPS (${combo.dps}) is ${(combo.dps / median).toFixed(1)}× the ${combo.weaponCategory} median (${median}) — may overshadow other ${combo.weaponCategory} combos.`,
      });
    } else if (median > 0 && combo.dps < median * LOW_FACTOR) {
      findings.push({
        severity: 'warn',
        rule: 'dps-outlier-low',
        message: `DPS (${combo.dps}) is well below the ${combo.weaponCategory} median (${median}) — may feel weak.`,
      });
    }
  }

  if (parseSeconds(combo.totalTime) > LONG_COMBO_SEC) {
    findings.push({
      severity: 'warn',
      rule: 'long-commitment',
      message: `Combo runs ${combo.totalTime} — a long commitment window; ensure it's cancellable or high-reward.`,
    });
  }

  if (findings.length === 0) {
    findings.push({ severity: 'ok', rule: 'combo', message: 'Combo looks well-formed for its weapon class.' });
  }
  return findings;
}
