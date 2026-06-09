import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import {
  ensurePromptEvolutionTables,
  insertVariant,
  getVariantById,
  getVariantsForItem,
  getVariantsForModule,
  getAllVariants,
  hasActiveVariant,
  setActiveVariant,
  upsertABTest,
  getABTestById,
  getAllABTests,
  getABTestsForItem,
} from '@/lib/prompt-evolution/evolution-db';
import type { PromptVariant, ABTest } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;

function variant(over: Partial<PromptVariant> = {}): PromptVariant {
  return {
    id: 'v1',
    moduleId: MOD,
    checklistItemId: 'ac-1',
    label: 'default variant (descriptive)',
    prompt: 'Implement a melee attack.',
    origin: 'default',
    style: 'descriptive',
    parentId: null,
    mutationType: undefined,
    active: false,
    createdAt: '2026-06-01T10:00:00.000Z',
    ...over,
  };
}

function abTest(over: Partial<ABTest> = {}): ABTest {
  return {
    id: 't1',
    moduleId: MOD,
    checklistItemId: 'ac-1',
    variantAId: 'v1',
    variantBId: 'v2',
    variantATrials: 0,
    variantBTrials: 0,
    variantASuccesses: 0,
    variantBSuccesses: 0,
    variantATotalDurationMs: 0,
    variantBTotalDurationMs: 0,
    minTrials: 5,
    status: 'running',
    winnerId: null,
    confidence: 0,
    createdAt: '2026-06-01T11:00:00.000Z',
    concludedAt: null,
    ...over,
  };
}

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS prompt_variants');
  testDb.exec('DROP TABLE IF EXISTS prompt_ab_tests');
  ensurePromptEvolutionTables();
});

describe('evolution-db — variants', () => {
  it('round-trips every field through SQLite', () => {
    insertVariant(variant({
      id: 'v-mut',
      origin: 'mutation',
      style: 'imperative',
      parentId: 'v-root',
      mutationType: 'imperative-rewrite',
      active: true,
    }));

    const got = getVariantById('v-mut');
    expect(got).not.toBeNull();
    expect(got!.origin).toBe('mutation');
    expect(got!.style).toBe('imperative');
    expect(got!.parentId).toBe('v-root');
    expect(got!.mutationType).toBe('imperative-rewrite');
    expect(got!.active).toBe(true);
  });

  it('persists data durably — survives a fresh query (no in-memory map)', () => {
    insertVariant(variant({ id: 'v1' }));
    // A brand-new SELECT (the durability fix: data lives in SQLite, not a Map
    // that a server restart would wipe).
    const reread = testDb.prepare('SELECT id FROM prompt_variants WHERE id = ?').get('v1') as { id: string };
    expect(reread.id).toBe('v1');
    expect(getAllVariants()).toHaveLength(1);
  });

  it('filters by item and module', () => {
    insertVariant(variant({ id: 'a', checklistItemId: 'ac-1' }));
    insertVariant(variant({ id: 'b', checklistItemId: 'ac-2' }));
    insertVariant(variant({ id: 'c', moduleId: 'arpg-character' as SubModuleId, checklistItemId: 'ch-1' }));

    expect(getVariantsForItem(MOD, 'ac-1').map((v) => v.id)).toEqual(['a']);
    expect(getVariantsForModule(MOD).map((v) => v.id).sort()).toEqual(['a', 'b']);
    expect(getAllVariants()).toHaveLength(3);
  });

  it('setActiveVariant keeps exactly one active per item', () => {
    insertVariant(variant({ id: 'a', active: true }));
    insertVariant(variant({ id: 'b', active: false }));
    insertVariant(variant({ id: 'c', active: false }));
    expect(hasActiveVariant(MOD, 'ac-1')).toBe(true);

    setActiveVariant(MOD, 'ac-1', 'c');

    expect(getVariantById('a')!.active).toBe(false);
    expect(getVariantById('b')!.active).toBe(false);
    expect(getVariantById('c')!.active).toBe(true);
    expect(getVariantsForItem(MOD, 'ac-1').filter((v) => v.active)).toHaveLength(1);
  });

  it('active flags are scoped per checklist item', () => {
    insertVariant(variant({ id: 'a', checklistItemId: 'ac-1', active: true }));
    insertVariant(variant({ id: 'b', checklistItemId: 'ac-2', active: true }));

    setActiveVariant(MOD, 'ac-1', 'a'); // re-activating a doesn't touch ac-2
    expect(getVariantById('b')!.active).toBe(true);
  });
});

describe('evolution-db — A/B tests', () => {
  it('inserts then updates on conflict (upsert)', () => {
    upsertABTest(abTest({ id: 't1', variantATrials: 1 }));
    upsertABTest(abTest({ id: 't1', variantATrials: 5, status: 'concluded', winnerId: 'v1', concludedAt: '2026-06-02T00:00:00.000Z' }));

    const got = getABTestById('t1');
    expect(got!.variantATrials).toBe(5);
    expect(got!.status).toBe('concluded');
    expect(got!.winnerId).toBe('v1');
    expect(getAllABTests()).toHaveLength(1);
  });

  it('filters tests by checklist item', () => {
    upsertABTest(abTest({ id: 't1', checklistItemId: 'ac-1' }));
    upsertABTest(abTest({ id: 't2', checklistItemId: 'ac-2' }));
    expect(getABTestsForItem(MOD, 'ac-1').map((t) => t.id)).toEqual(['t1']);
  });
});
