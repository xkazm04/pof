import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import {
  createVariant,
  mutateVariant,
  getVariant,
  startABTest,
  recordTestTrial,
  concludeTest,
  getVersionHistory,
  restoreVariant,
} from '@/lib/prompt-evolution/engine';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;
const ITEM = 'ac-1';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS prompt_variants');
  testDb.exec('DROP TABLE IF EXISTS prompt_ab_tests');
});

describe('engine — variant lineage & active version', () => {
  it('first variant created for an item is the active/current one', () => {
    const v = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    expect(v.active).toBe(true);
    expect(getVariant(v.id)!.active).toBe(true);
  });

  it('mutations descend from their parent and are not auto-active', () => {
    const root = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const mutated = mutateVariant(root.id, 'add-verification');
    expect(mutated).not.toBeNull();
    expect(mutated!.parentId).toBe(root.id);
    expect(mutated!.mutationType).toBe('add-verification');
    expect(mutated!.active).toBe(false);
  });

  it('builds a lineage forest with depths', () => {
    const root = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const child = mutateVariant(root.id, 'add-verification')!;
    const grandchild = mutateVariant(child.id, 'imperative-rewrite')!;

    const history = getVersionHistory(MOD, ITEM);
    expect(history.versions).toHaveLength(3);
    expect(history.roots).toHaveLength(1);

    const rootNode = history.roots[0];
    expect(rootNode.variant.id).toBe(root.id);
    expect(rootNode.depth).toBe(0);
    expect(rootNode.children).toHaveLength(1);

    const childNode = rootNode.children[0];
    expect(childNode.variant.id).toBe(child.id);
    expect(childNode.depth).toBe(1);
    expect(childNode.children[0].variant.id).toBe(grandchild.id);
    expect(childNode.children[0].depth).toBe(2);

    expect(history.activeVariantId).toBe(root.id);
  });
});

describe('engine — A/B success rate annotation', () => {
  it('aggregates trials/success rate per variant from its A/B tests', () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = mutateVariant(a.id, 'imperative-rewrite')!;
    const test = startABTest(MOD, ITEM, a.id, b.id);

    // A: 3 wins of 4; B: 1 win of 4
    recordTestTrial(test.id, 'A', true, 100);
    recordTestTrial(test.id, 'A', true, 100);
    recordTestTrial(test.id, 'A', true, 100);
    recordTestTrial(test.id, 'A', false, 100);
    recordTestTrial(test.id, 'B', true, 100);
    recordTestTrial(test.id, 'B', false, 100);
    recordTestTrial(test.id, 'B', false, 100);
    recordTestTrial(test.id, 'B', false, 100);

    const history = getVersionHistory(MOD, ITEM);
    const statsA = history.versions.find((v) => v.variant.id === a.id)!.stats;
    const statsB = history.versions.find((v) => v.variant.id === b.id)!.stats;

    expect(statsA.trials).toBe(4);
    expect(statsA.successes).toBe(3);
    expect(statsA.successRate).toBeCloseTo(0.75);
    expect(statsA.testCount).toBe(1);

    expect(statsB.trials).toBe(4);
    expect(statsB.successRate).toBeCloseTo(0.25);
  });

  it('counts wins from concluded tests', () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = mutateVariant(a.id, 'shorten')!;
    const test = startABTest(MOD, ITEM, a.id, b.id);
    recordTestTrial(test.id, 'A', true, 50);
    recordTestTrial(test.id, 'B', false, 50);
    concludeTest(test.id);

    const history = getVersionHistory(MOD, ITEM);
    const statsA = history.versions.find((v) => v.variant.id === a.id)!.stats;
    expect(statsA.wins).toBe(1);
  });

  it('untested variants report a zero success rate', () => {
    const v = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const stats = getVersionHistory(MOD, ITEM).versions.find((e) => e.variant.id === v.id)!.stats;
    expect(stats.trials).toBe(0);
    expect(stats.successRate).toBe(0);
  });
});

describe('engine — restore / rollback', () => {
  it('restoreVariant makes the chosen version active and clears siblings', () => {
    const root = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const child = mutateVariant(root.id, 'add-verification')!;
    expect(getVersionHistory(MOD, ITEM).activeVariantId).toBe(root.id);

    const restored = restoreVariant(child.id);
    expect(restored!.active).toBe(true);

    const history = getVersionHistory(MOD, ITEM);
    expect(history.activeVariantId).toBe(child.id);
    expect(history.versions.find((v) => v.variant.id === root.id)!.isActive).toBe(false);
    expect(history.versions.find((v) => v.variant.id === child.id)!.isActive).toBe(true);
  });

  it('returns null for an unknown variant', () => {
    expect(restoreVariant('nope')).toBeNull();
  });
});
