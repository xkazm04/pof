import { describe, it, expect } from 'vitest';
import { diffGenomes, groupDeltas, type DiffFieldSpec } from '@/lib/genome/genome-diff';

interface Toy {
  group: string;
  walkSpeed: number;
  critChance: number; // 0..1
  cooldown: number;
  itemType: string;
  wild: boolean;
}

const base: Toy = { group: 'a', walkSpeed: 400, critChance: 0.05, cooldown: 0.8, itemType: 'Weapon', wild: false };

const specs: DiffFieldSpec<Toy>[] = [
  { group: 'Movement', label: 'Walk Speed', get: (g) => g.walkSpeed, unit: 'cm/s' },
  { group: 'Combat', label: 'Crit Chance', get: (g) => g.critChance, percent: true },
  { group: 'Combat', label: 'Cooldown', get: (g) => g.cooldown, unit: 's' },
  { group: 'Meta', label: 'Item Type', get: (g) => g.itemType },
  { group: 'Meta', label: 'Wild', get: (g) => g.wild },
];

describe('diffGenomes', () => {
  it('reports a numeric increase with signed delta and up direction', () => {
    const deltas = diffGenomes(base, { ...base, walkSpeed: 600 }, specs);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({
      group: 'Movement', label: 'Walk Speed',
      from: '400 cm/s', to: '600 cm/s', delta: '+200 cm/s', direction: 'up',
    });
  });

  it('reports a numeric decrease with negative delta and down direction', () => {
    const deltas = diffGenomes(base, { ...base, cooldown: 0.5 }, specs);
    expect(deltas[0]).toMatchObject({ from: '0.8 s', to: '0.5 s', delta: '-0.3 s', direction: 'down' });
  });

  it('formats percent fields as whole percentages with point delta', () => {
    const deltas = diffGenomes(base, { ...base, critChance: 0.12 }, specs);
    expect(deltas[0]).toMatchObject({ label: 'Crit Chance', from: '5%', to: '12%', delta: '+7%', direction: 'up' });
  });

  it('treats string changes as neutral with no delta', () => {
    const deltas = diffGenomes(base, { ...base, itemType: 'Armor' }, specs);
    expect(deltas[0]).toMatchObject({ label: 'Item Type', from: 'Weapon', to: 'Armor', delta: null, direction: 'neutral' });
  });

  it('renders booleans as on/off', () => {
    const deltas = diffGenomes(base, { ...base, wild: true }, specs);
    expect(deltas[0]).toMatchObject({ label: 'Wild', from: 'off', to: 'on', delta: null });
  });

  it('skips unchanged fields', () => {
    expect(diffGenomes(base, { ...base }, specs)).toHaveLength(0);
  });

  it('ignores sub-epsilon float noise', () => {
    expect(diffGenomes(base, { ...base, walkSpeed: 400 + 1e-12 }, specs)).toHaveLength(0);
  });

  it('reports every field as changed-from-dash when baseline is undefined', () => {
    const deltas = diffGenomes(undefined, base, specs);
    expect(deltas).toHaveLength(specs.length);
    expect(deltas.every((d) => d.from === '—')).toBe(true);
  });

  it('groups deltas by section in first-seen order', () => {
    const deltas = diffGenomes(base, { ...base, walkSpeed: 500, critChance: 0.1, itemType: 'Armor' }, specs);
    const grouped = groupDeltas(deltas);
    expect(grouped.map((g) => g.group)).toEqual(['Movement', 'Combat', 'Meta']);
    expect(grouped[1].items).toHaveLength(1); // only Crit Chance changed in Combat
  });
});
