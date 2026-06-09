import { describe, it, expect } from 'vitest';
import { lookupMetric, metricIds } from '@/lib/combat/metric-glossary';

describe('combat metric glossary', () => {
  it('returns undefined for an unknown metric id (fail-soft contract)', () => {
    expect(lookupMetric('totallyMadeUp')).toBeUndefined();
    expect(lookupMetric('')).toBeUndefined();
  });

  it('defines every metric wired into the simulator panels', () => {
    const wired = [
      // KPI cards
      'survivalRate', 'avgFightDurationSec', 'avgDPS', 'avgEnemyDPS',
      // mini-stats
      'avgCritRate', 'oneShotRate', 'avgPlayerHealthRemaining', 'medianFightDurationSec',
      // heatmap
      'abilityHeatmap',
      // threat breakdown
      'killShare', 'damageShare',
      // tuning sliders
      'playerHealthMul', 'playerDamageMul', 'playerArmorMul',
      'enemyHealthMul', 'enemyDamageMul', 'critMultiplierMul', 'armorEffectivenessWeight',
      // acronyms the description calls out
      'dps', 'monteCarlo', 'gas',
    ];
    for (const id of wired) {
      expect(lookupMetric(id), `missing glossary entry: ${id}`).toBeDefined();
    }
  });

  it('gives every entry a term, a plain definition, a worked example, and a matching id', () => {
    for (const id of metricIds()) {
      const entry = lookupMetric(id)!;
      expect(entry.id).toBe(id);
      expect(entry.term.trim().length).toBeGreaterThan(0);
      // A one-sentence plain definition + a concrete example are the contract.
      expect(entry.plain.trim().length).toBeGreaterThan(10);
      expect(entry.example.trim().length).toBeGreaterThan(10);
      // The definition should read as plain language, not echo the raw camelCase id.
      expect(entry.plain).not.toContain(id);
    }
  });

  it('decodes the specifically-flagged jargon in plain English', () => {
    expect(lookupMetric('dps')!.plain.toLowerCase()).toContain('damage per second');
    expect(lookupMetric('gas')!.plain.toLowerCase()).toContain('ability system');
    expect(lookupMetric('monteCarlo')!.plain.toLowerCase()).toContain('thousands');
    expect(lookupMetric('oneShotRate')!.term).toBe('One-Shot Rate');
    expect(lookupMetric('armorEffectivenessWeight')!.term).toBe('Armor Weight');
  });
});
