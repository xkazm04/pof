import { describe, it, expect } from 'vitest';
import {
  columnMajorOrder,
  readinessMovement,
  craftMovement,
  overallMovement,
  itemSlug,
} from '@/lib/status/personalLoop';

const lane = (catalogId: string, ...steps: string[]) => ({ catalogId, cells: steps.map((label) => ({ label })) });

describe('columnMajorOrder', () => {
  it('walks every lane top-to-bottom per column, then moves one column right', () => {
    const order = columnMajorOrder([lane('a', 'Concept Brief', 'Stats'), lane('b', 'Concept Brief', 'Icon', 'Pack')]);
    expect(order.map((i) => `${i.catalogId}:${i.step}`)).toEqual([
      'a:Concept Brief',
      'b:Concept Brief',
      'a:Stats',
      'b:Icon',
      'b:Pack',
    ]);
  });

  it('skips lanes shorter than the column and numbers items from 1 with their lane rank', () => {
    const order = columnMajorOrder([lane('short', 'One'), lane('long', 'One', 'Two')]);
    expect(order[2]).toEqual({ n: 3, column: 2, laneRank: 2, catalogId: 'long', step: 'Two' });
  });

  it('returns nothing for no lanes', () => {
    expect(columnMajorOrder([])).toEqual([]);
  });
});

describe('readinessMovement', () => {
  it('compares rungs when both sides are reached', () => {
    expect(readinessMovement({ level: 'R3', state: 'reached' }, { level: 'R4', state: 'reached' })).toBe('improved');
    expect(readinessMovement({ level: 'R3', state: 'reached' }, { level: 'R3', state: 'reached' })).toBe('held');
    expect(readinessMovement({ level: 'R3', state: 'reached' }, { level: 'R2', state: 'reached' })).toBe('degraded');
  });

  it('never reads a newly waiting or blocked cell as progress', () => {
    expect(readinessMovement({ level: 'R3', state: 'reached' }, { level: 'R4', state: 'waiting' })).toBe('degraded');
    expect(readinessMovement({ level: 'R2', state: 'reached' }, { level: 'R3', state: 'blocked' })).toBe('degraded');
  });

  it('counts a lifted condemnation as improved only when the rung did not drop', () => {
    expect(readinessMovement({ level: 'R3', state: 'blocked' }, { level: 'R4', state: 'reached' })).toBe('improved');
    expect(readinessMovement({ level: 'R3', state: 'blocked' }, { level: 'R2', state: 'reached' })).toBe('degraded');
  });

  it('orders blocked below waiting', () => {
    expect(readinessMovement({ level: 'R4', state: 'waiting' }, { level: 'R4', state: 'blocked' })).toBe('degraded');
    expect(readinessMovement({ level: 'R4', state: 'blocked' }, { level: 'R4', state: 'waiting' })).toBe('improved');
  });
});

describe('craftMovement', () => {
  it('is unmeasured when the after-side is ungauged, stale or absent', () => {
    expect(craftMovement({ level: 'A2', state: 'gauged' }, { level: 'A0', state: 'gauged' })).toBe('unmeasured');
    expect(craftMovement({ level: 'A2', state: 'gauged' }, { level: 'A3', state: 'stale' })).toBe('unmeasured');
    expect(craftMovement({ level: 'A2', state: 'gauged' }, undefined)).toBe('unmeasured');
  });

  it('is baselined when only the after-side is a real gauge', () => {
    expect(craftMovement({ level: 'A0', state: 'gauged' }, { level: 'A2', state: 'gauged' })).toBe('baselined');
    expect(craftMovement({ level: 'A3', state: 'stale' }, { level: 'A2', state: 'gauged' })).toBe('baselined');
  });

  it('compares craft rank when both sides are real gauges (at-ceiling counts as gauged)', () => {
    expect(craftMovement({ level: 'A1', state: 'gauged' }, { level: 'A2', state: 'at-ceiling' })).toBe('improved');
    expect(craftMovement({ level: 'A2', state: 'at-ceiling' }, { level: 'A2', state: 'at-ceiling' })).toBe('held');
    expect(craftMovement({ level: 'A3', state: 'gauged' }, { level: 'A2', state: 'gauged' })).toBe('degraded');
  });
});

describe('overallMovement', () => {
  it('lets degraded dominate, then unmeasured, then improved', () => {
    expect(overallMovement('improved', 'degraded')).toBe('degraded');
    expect(overallMovement('improved', 'unmeasured')).toBe('unmeasured');
    expect(overallMovement('held', 'improved')).toBe('improved');
    expect(overallMovement('held', 'baselined')).toBe('baselined');
    expect(overallMovement('held', 'held')).toBe('held');
  });
});

describe('itemSlug', () => {
  it('is a stable filesystem-safe note name', () => {
    expect(itemSlug('bestiary', 'Concept Brief')).toBe('bestiary--concept-brief');
    expect(itemSlug('items', '3D Mesh / LODs')).toBe('items--3d-mesh-lods');
  });
});
