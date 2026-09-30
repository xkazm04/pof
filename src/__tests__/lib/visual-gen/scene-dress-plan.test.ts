/**
 * The scene-decompose manifest, projected into what an operator reviews before a blockout.
 *
 * The route returns three parallel lists (props, assets, composition) plus a per-ASSET crop
 * gate; nothing joined them, so a placed instance could not say its size, material, mass or
 * whether its crop passed. `toDressPlan` is that join, and it must never invent a verdict:
 * a gate row that did not run is 'not run' (with its note), an asset with no gate row at all
 * is 'not gated'.
 */
import { describe, it, expect } from 'vitest';
import { toDressPlan, type SceneDecomposeData } from '@/lib/visual-gen/scene-dress-plan';
import { DRESS_FIXTURE } from './sceneDressFixture';

describe('toDressPlan', () => {
  it('keeps every instance: placed + unplaced equals the decomposed count', () => {
    const plan = toDressPlan(DRESS_FIXTURE);
    // 1 table + 2 barrels + 2 bottles
    expect(plan.placed.length + plan.unplaced.length).toBe(5);
    expect(plan.placed).toHaveLength(4);
  });

  it('joins size from assets, material from phys_ and mass from mass_kg_', () => {
    const plan = toDressPlan(DRESS_FIXTURE);
    const table = plan.placed.find((r) => r.instanceId === 'trading-post-table_0')!;
    expect(table.sizeCm).toEqual([170, 170, 95]);
    expect(table.material).toBe('wood');
    expect(table.massKg).toBe(120);
    expect(table.name).toBe('trading post table');

    const bottle = plan.placed.find((r) => r.instanceId === 'clay-bottle_0')!;
    expect(bottle.sizeCm).toEqual([10, 10, 28]);
    expect(bottle.material).toBe('glass');
    expect(bottle.massKg).toBe(0.4);
    expect(bottle.supportedBy).toBe('trading-post-table_0');
    expect(bottle.stackIndex).toBe(1);
  });

  it("keeps the solver's reason on an unplaced row", () => {
    const plan = toDressPlan(DRESS_FIXTURE);
    expect(plan.unplaced).toEqual([
      expect.objectContaining({
        assetId: 'clay-bottle',
        name: 'clay bottle',
        reason: 'no support surface with room left',
      }),
    ]);
  });

  it('labels each instance by its asset gate row and never invents a verdict', () => {
    const data: SceneDecomposeData = {
      ...DRESS_FIXTURE,
      gate: [
        { id: 'wooden-barrel', ran: true, verdict: 'fail', score: 20, note: 'input gate FAIL (score 20/100)' },
        { id: 'clay-bottle', ran: false, unavailable: true, note: 'crop gate error: sharp exploded' },
      ],
    };
    const plan = toDressPlan(data);
    const byId = (id: string) => plan.placed.find((r) => r.instanceId === id)!;

    expect(byId('wooden-barrel_0').gate.label).toBe('fail');
    expect(byId('wooden-barrel_1').gate.label).toBe('fail');
    expect(byId('clay-bottle_0').gate).toMatchObject({ label: 'not run', note: 'crop gate error: sharp exploded' });
    expect(plan.unplaced[0].gate).toMatchObject({ label: 'not run', note: 'crop gate error: sharp exploded' });
    expect(byId('trading-post-table_0').gate.label).toBe('not gated');

    // Counted per ASSET (one gate call per asset), not per instance.
    expect(plan.gateSummary).toEqual({ pass: 0, warn: 0, fail: 1, notRun: 1, notGated: 1 });
  });

  it('an empty honest answer carries the route note', () => {
    const plan = toDressPlan({
      props: [],
      assets: [],
      composition: { props: [], unplaced: [] },
      gate: [],
      note: 'no movable props in this image',
    });
    expect(plan.placed).toEqual([]);
    expect(plan.unplaced).toEqual([]);
    expect(plan.note).toBe('no movable props in this image');
  });
});
