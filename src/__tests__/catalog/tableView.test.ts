import { describe, it, expect } from 'vitest';
import { resolveTableView } from '@/lib/catalog/tableView';

/**
 * The table View's shape resolution — the ONE place the renderer and the spec linter agree
 * on what a declared column can read. 99 of 451 fleet columns could never resolve because a
 * key·value table was pointed at a LIST or a KEYED GROUP of row records.
 */
const cols = (...keys: string[]) => keys.map((key) => ({ key }));

describe('resolveTableView', () => {
  it('reads a flat record as the classic key·value table', () => {
    const r = resolveTableView({ effect: { damageType: 'Fire', baseDamage: 35 } }, 'effect', cols('damageType', 'baseDamage'));
    expect(r.mode).toBe('kv');
    if (r.mode !== 'kv') return;
    expect(r.values.baseDamage).toBe(35);
    expect(r.missing).toEqual([]);
  });

  it('reads a LIST of row records as a multi-column table', () => {
    const data = { tiers: [{ tier: 'Neutral', minPoints: 0 }, { tier: 'Friendly', minPoints: 3000 }] };
    const r = resolveTableView(data, 'tiers', cols('tier', 'minPoints'));
    expect(r.mode).toBe('rows');
    if (r.mode !== 'rows') return;
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1].values.tier).toBe('Friendly');
    expect(r.missing).toEqual([]);
  });

  it('reads a KEYED GROUP of row records as rows, carrying the key as the row label', () => {
    const data = { layers: { bed: { name: 'Ashen Wind', gainDb: -6 }, top: { name: 'Ember Drift', gainDb: -12 } } };
    const r = resolveTableView(data, 'layers', cols('name', 'gainDb'));
    expect(r.mode).toBe('rows');
    if (r.mode !== 'rows') return;
    expect(r.rows.map((x) => x.label)).toEqual(['bed', 'top']);
    expect(r.missing).toEqual([]);
  });

  it('never turns a metadata sibling (wiringContract) into a blank row', () => {
    const data = {
      transitions: {
        combatEnter: { trigger: 'CombatStart', toLayer: 'combat-low' },
        beatSyncImplementation: 'BarClock',
        wiringContract: { grantedBy: 'x', activatedBy: 'y', verification: 'L0', dependencies: [] },
      },
    };
    const r = resolveTableView(data, 'transitions', cols('trigger', 'toLayer'));
    expect(r.mode).toBe('rows');
    if (r.mode !== 'rows') return;
    expect(r.rows.map((x) => x.label)).toEqual(['combatEnter']);
  });

  it('follows rowsKey to a nested row container', () => {
    const data = { hazards: { hazardList: [{ kind: 'fire-floor', ge: 'GE_Hazard_FireFloor' }], note: 'x' } };
    const r = resolveTableView(data, 'hazards', cols('kind', 'ge'), 'hazardList');
    expect(r.mode).toBe('rows');
    if (r.mode !== 'rows') return;
    expect(r.rows[0].values.kind).toBe('fire-floor');
  });

  it('reports absent data and shape mismatches instead of a grid of "— missing"', () => {
    expect(resolveTableView({}, 'nope', cols('a')).mode).toBe('absent');
    expect(resolveTableView({ x: { y: 1 } }, 'x', cols('a'), 'missingKey').mode).toBe('absent');
    const mismatch = resolveTableView({ x: ['a', 'b'] }, 'x', cols('a'));
    expect(mismatch.mode).toBe('mismatch');
    const scalar = resolveTableView({ x: 42 }, 'x', cols('a'));
    expect(scalar).toEqual({ mode: 'mismatch', actual: 'a number' });
  });

  it('reports the columns that no row carries', () => {
    const r = resolveTableView({ rows: [{ a: 1 }, { a: 2 }] }, 'rows', cols('a', 'b'));
    expect(r.mode).toBe('rows');
    if (r.mode !== 'rows') return;
    expect(r.missing).toEqual(['b']);
  });

  it('treats false and 0 as present values (not missing)', () => {
    const r = resolveTableView({ p: { currentState: { saved: false, depth: 0 } } }, 'p', cols('saved', 'depth'));
    expect(r.mode).toBe('rows');
    if (r.mode !== 'rows') return;
    expect(r.missing).toEqual([]);
  });
});
