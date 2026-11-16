import { describe, expect, it } from 'vitest';
import { isGroupedMelee, meleeRecords } from '@/lib/games/combatLab/meleeRecords';
import { parseTable } from '@/lib/games/combatLab/parseTable';

/** The shape of rivet-motion's real rivet_melee.json (gtai.rivet-melee/1), trimmed. */
const REAL = {
  claw: {
    cancel_ticks: 4,
    combo_window_ticks: 12,
    hits: [
      { id: 'claw_1', damage: 1, windup_ticks: 5, active_ticks: 3, recovery_ticks: 10, reach_m: 1.4, knockback_m: 0.4, doc: 'jab' },
      { id: 'claw_3', damage: 2, windup_ticks: 9, active_ticks: 4, recovery_ticks: 20, reach_m: 1.6, knockback_m: 2.5, doc: 'finisher' },
    ],
  },
  doc: 'Rivet melee as timing data',
  schema: 'gtai.rivet-melee/1',
  shock: { chain_hops: 3, reach_m: 1.6, recovery_ticks: 18, doc: 'charge and release' },
};

describe('rivet_melee.json (grouped, 60 Hz ticks)', () => {
  it('is recognised by its hits arrays, a flat table is not', () => {
    expect(isGroupedMelee(REAL)).toBe(true);
    expect(isGroupedMelee({ melee_weapons: [{ id: 'baton' }] })).toBe(false);
    expect(isGroupedMelee([{ id: 'x' }])).toBe(false);
  });

  it('gives one row per hit and one per hit-less group, with derived seconds', () => {
    const rows = meleeRecords(REAL).map((r) => r.rec);
    expect(rows.map((r) => r.id)).toEqual(['claw_1', 'claw_3', 'shock']);
    expect(rows[0]).toMatchObject({ group: 'claw', windup_s: 0.083, cycle_s: 0.3, cancel_ticks: 4 });
    expect(rows[2]).toMatchObject({ group: 'shock', chain_hops: 3 });
    expect(rows[2]).not.toHaveProperty('cycle_s');
  });

  it('parseTable lists id, group, damage, reach, windup, cycle first and prose last', () => {
    const t = parseTable('melee', 'rivet_melee.json', REAL);
    expect(t.state).toBe('ok');
    expect(t.rows).toHaveLength(3);
    expect(t.columns.slice(0, 7)).toEqual(['id', 'group', 'damage', 'reach_m', 'windup_s', 'cycle_s', 'knockback_m']);
    expect(t.columns[t.columns.length - 1]).toBe('doc');
  });
});
