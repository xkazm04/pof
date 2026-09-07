/**
 * Physical properties — the half of a spawnable prop the placement contract never carried.
 *
 * `placement-tags.ts` answers "where may this prop go"; nothing answers "what is it made of
 * and what does it weigh". That gap is load-bearing, not cosmetic: the `prop-placement-
 * affordances-not-bounds` gotcha's own recommended finish is a PHYSICS SETTLE ("enable
 * simulate physics on the spawned actors, let them fall, then bake the transforms back"),
 * and a settle is undefined without a mass and a simulate flag per actor.
 *
 * Mass is DERIVED from real material densities times the prop's own bounds, not invented
 * per prop, so the numbers are reproducible and arguable.
 */
import { describe, it, expect } from 'vitest';
import {
  MATERIAL_DENSITIES,
  DEFAULT_PHYSICAL,
  physicalForSize,
  massForSize,
  toPhysicsActorTags,
  parsePhysicsActorTags,
  type PhysicsMaterial,
} from '@/lib/visual-gen/generators/physical-tags';

describe('MATERIAL_DENSITIES', () => {
  it('orders the way real materials do', () => {
    expect(MATERIAL_DENSITIES.stone.densityKgM3).toBeGreaterThan(MATERIAL_DENSITIES.wood.densityKgM3);
    expect(MATERIAL_DENSITIES.metal.densityKgM3).toBeGreaterThan(MATERIAL_DENSITIES.stone.densityKgM3);
    expect(MATERIAL_DENSITIES.fabric.densityKgM3).toBeLessThan(MATERIAL_DENSITIES.wood.densityKgM3);
  });

  it('states a solid fraction below 1 for the hollow classes', () => {
    // A generated barrel or crate is a shell; billing it as a solid block of oak gives a
    // 600kg barrel that no settle will ever move believably.
    expect(MATERIAL_DENSITIES.wood.solidFraction).toBeLessThan(1);
    expect(MATERIAL_DENSITIES.stone.solidFraction).toBe(1);
  });

  it('carries a rationale for every material, the way AFFORDANCE_PRESETS does', () => {
    for (const m of Object.values(MATERIAL_DENSITIES)) {
      expect(m.rationale.length).toBeGreaterThan(20);
    }
  });
});

describe('massForSize', () => {
  it('computes density x volume x solid fraction, in kg', () => {
    // 100 x 100 x 100 cm = 1 m^3 of stone at 2400 kg/m^3, solid.
    expect(massForSize([100, 100, 100], 'stone')).toBeCloseTo(2400, 0);
  });

  it('scales with the cube of the linear size', () => {
    const small = massForSize([50, 50, 50], 'stone');
    const big = massForSize([100, 100, 100], 'stone');
    expect(big / small).toBeCloseTo(8, 1);
  });

  it('applies the hollow solid fraction for shell materials', () => {
    const solidM3 = MATERIAL_DENSITIES.wood.densityKgM3;
    expect(massForSize([100, 100, 100], 'wood')).toBeCloseTo(
      solidM3 * MATERIAL_DENSITIES.wood.solidFraction,
      0,
    );
  });

  it('never returns zero or a negative mass for a degenerate box', () => {
    expect(massForSize([0, 0, 0], 'wood')).toBeGreaterThan(0);
    expect(massForSize([-10, 5, 5], 'wood')).toBeGreaterThan(0);
  });

  it('rounds to a sane precision rather than emitting float noise', () => {
    const m = massForSize([37, 23, 61], 'metal');
    expect(m).toBe(Number(m.toFixed(2)));
  });
});

describe('physicalForSize', () => {
  it('marks a prop light enough to be knocked around as simulate:true', () => {
    // A 30cm wooden bottle-sized prop is dynamic clutter.
    expect(physicalForSize([30, 30, 30], 'wood').simulate).toBe(true);
  });

  it('marks heavy furniture as static so a settle does not shove the room around', () => {
    const table = physicalForSize([160, 90, 75], 'wood');
    expect(table.simulate).toBe(false);
    expect(table.massKg).toBeGreaterThan(0);
  });

  it('carries the material through', () => {
    expect(physicalForSize([30, 30, 30], 'metal').material).toBe('metal');
  });

  it('defaults to the default material when none is given', () => {
    expect(physicalForSize([30, 30, 30]).material).toBe(DEFAULT_PHYSICAL.material);
  });
});

describe('UE actor tag round-trip', () => {
  const p = { massKg: 12.5, simulate: true, material: 'wood' as PhysicsMaterial };

  it('emits parseable tags that do not collide with the placement vocabulary', () => {
    const tags = toPhysicsActorTags(p);
    expect(tags).toContain('phys_wood');
    expect(tags).toContain('sim_true');
    expect(tags.some((t) => t.startsWith('mass_kg_'))).toBe(true);
    // `place_`, `stack_`, `copy_`, `max_stack_` belong to placement-tags.
    expect(tags.some((t) => /^(place_|stack_|copy_|max_stack_)/.test(t))).toBe(false);
  });

  it('round-trips through parse', () => {
    expect(parsePhysicsActorTags(toPhysicsActorTags(p))).toEqual(p);
  });

  it('survives being mixed with placement tags on one actor', () => {
    const mixed = ['place_floor', 'stack_true', 'copy_3', 'max_stack_2', ...toPhysicsActorTags(p)];
    expect(parsePhysicsActorTags(mixed)).toEqual(p);
  });

  it('falls back to the safe default for an untagged actor', () => {
    expect(parsePhysicsActorTags([])).toEqual(DEFAULT_PHYSICAL);
  });

  it('reads a fractional mass back without losing it to an integer parse', () => {
    const back = parsePhysicsActorTags(toPhysicsActorTags({ ...p, massKg: 0.75 }));
    expect(back.massKg).toBeCloseTo(0.75, 2);
  });

  it('treats an unknown material tag as the default rather than throwing', () => {
    expect(parsePhysicsActorTags(['phys_unobtanium']).material).toBe(DEFAULT_PHYSICAL.material);
  });

  it('defaults simulate to false — a prop that never asked to move must not move', () => {
    expect(DEFAULT_PHYSICAL.simulate).toBe(false);
  });
});
