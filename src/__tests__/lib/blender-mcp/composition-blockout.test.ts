/**
 * The composition manifest's first consumer: a Blender blockout of the placed plan.
 *
 * `generators/composition.ts` says its output is "a transform manifest an editor-side spawn
 * script consumes" — and nothing consumed it. This script does, at the one unit edge the
 * manifest crosses: composition-local CENTIMETRES with z at the prop's BASE, into Blender
 * METRES with the proxy cube's origin at its centre. It only ever ADDS (a new collection),
 * and it ends in a receipt the UI reads instead of trusting a transport OK.
 */
import { describe, it, expect } from 'vitest';
import { toDressPlan } from '@/lib/visual-gen/scene-dress-plan';
import {
  compositionBlockoutScript,
  readBlockoutReceipt,
} from '@/lib/blender-mcp/scripts/composition-blockout';
import { pyReceipt } from '@/lib/blender-mcp/receipt';
import { DRESS_FIXTURE } from '../visual-gen/sceneDressFixture';
import { printedReceipt } from './printedReceipt';

const ROW = /^ {4}\{"name": "(.+?)", "dims": \(([^)]*)\), "loc": \(([^)]*)\), "yaw": ([-\d.e]+), "tags": "([^"]*)"\},$/gm;

function rows(code: string) {
  return [...code.matchAll(ROW)].map((m) => ({
    name: m[1],
    dims: m[2].split(',').map(Number),
    loc: m[3].split(',').map(Number),
    yaw: Number(m[4]),
    tags: m[5],
  }));
}

describe('compositionBlockoutScript', () => {
  const plan = toDressPlan(DRESS_FIXTURE);
  const code = compositionBlockoutScript(plan);

  it('embeds exactly the placed rows — the unplaced bottle is not spawned', () => {
    expect(plan.placed).toHaveLength(4);
    expect(plan.unplaced).toHaveLength(1);
    expect(rows(code)).toHaveLength(4);
  });

  it('converts cm to m once: a 170 cm table is 1.7 m and rests its base on z', () => {
    const table = rows(code).find((r) => r.name.includes('trading-post-table_0'))!;
    expect(table.dims).toEqual([1.7, 1.7, 0.95]);
    // (x/100, y/100, (z + h/2)/100) — origin at the cube's centre, base on the floor.
    expect(table.loc).toEqual([0, 0, 0.475]);
    expect(table.yaw).toBeCloseTo((3 * Math.PI) / 180, 5);
  });

  it('puts a stacked prop on its support: base z 95 cm + half its 28 cm height', () => {
    const bottle = rows(code).find((r) => r.name.includes('clay-bottle_0'))!;
    expect(bottle.loc).toEqual([0.2, 0.1, 1.09]);
    const barrel = rows(code).find((r) => r.name.includes('wooden-barrel_0'))!;
    expect(barrel.loc).toEqual([-1.5, 0.4, 0.45]);
    expect(barrel.yaw).toBeCloseTo((-4 * Math.PI) / 180, 5);
  });

  it("carries the UE actor tags onto the object as obj['pof_tags']", () => {
    const table = rows(code).find((r) => r.name.includes('trading-post-table_0'))!;
    expect(table.tags).toBe('place_floor,stack_true,copy_1,max_stack_2,phys_wood,sim_false,mass_kg_120');
    expect(code).toMatch(/obj\["pof_tags"\] = r\["tags"\]/);
  });

  it('links into a NEW collection and never deletes or unlinks what is already there', () => {
    expect(code).toContain('bpy.data.collections.new(');
    expect(code).toContain('bpy.context.scene.collection.children.link(');
    expect(code).not.toContain('objects.remove');
    expect(code).not.toContain('read_factory_settings');
    expect(code).not.toMatch(/\.unlink\(/);
    expect(code).not.toContain('bpy.ops.object.delete');
  });

  it('ends with the placed-count receipt, on the shared POF_RESULT envelope', () => {
    const last = code.trim().split('\n').pop();
    expect(last).toBe(pyReceipt('blockout', { placed: 'n' }));
    expect(code).not.toContain('POF_BLOCKOUT_PLACED=');
  });

  it('[guard] what that line prints (n = 4) reads back as confirmed', () => {
    expect(readBlockoutReceipt(printedReceipt(code, { n: 4 }), 4)).toEqual({ state: 'confirmed', placed: 4 });
  });

  it('escapes names so a quote cannot break out of the Python literal', () => {
    const hostile = toDressPlan({
      ...DRESS_FIXTURE,
      composition: {
        props: [{ ...DRESS_FIXTURE.composition.props[0], id: 'evil"); import os #_0' }],
        unplaced: [],
      },
    });
    const out = compositionBlockoutScript(hostile);
    expect(out).toContain('evil\\"); import os #_0');
    expect(rows(out)).toHaveLength(1);
  });
});

describe('readBlockoutReceipt', () => {
  it('confirms only the count Blender printed', () => {
    expect(readBlockoutReceipt('POF_RESULT={"kind": "blockout", "placed": 4}', 4)).toEqual({ state: 'confirmed', placed: 4 });
  });

  it('the retired bespoke marker alone no longer confirms a build', () => {
    expect(readBlockoutReceipt('POF_BLOCKOUT_PLACED=4', 4)).toMatchObject({ state: 'unconfirmed' });
  });

  it('a blockout receipt with no numeric count is unconfirmed, not built', () => {
    expect(readBlockoutReceipt('POF_RESULT={"kind": "blockout"}', 4)).toMatchObject({ state: 'unconfirmed' });
  });

  it('a script that ran but printed no receipt is unconfirmed, not built', () => {
    expect(readBlockoutReceipt('Created 4 things', 4)).toMatchObject({ state: 'unconfirmed' });
  });

  it('a short count is a mismatch that names both numbers', () => {
    const r = readBlockoutReceipt('POF_RESULT={"kind": "blockout", "placed": 3}', 4);
    expect(r.state).toBe('mismatch');
    if (r.state !== 'mismatch') throw new Error('unreachable');
    expect(r.reason).toMatch(/3 of 4/);
    expect(r).toMatchObject({ placed: 3, expected: 4 });
  });
});
