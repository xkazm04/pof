import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import { createVariant, startABTest, getAllTests } from '@/lib/prompt-evolution/engine';
import { POST } from '@/app/api/prompt-evolution/route';
import type { SubModuleId } from '@/types/modules';

/**
 * One running A/B test per (module, item). Serving reads the NEWEST running test
 * while trial booking takes the FIRST one the served variant is an arm of, so two
 * concurrent tests sharing a baseline corrupt each other. Starting a second one is
 * refused at the server.
 */

const MOD = 'arpg-combat' as SubModuleId;
const ITEM = 'ac-1';

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS prompt_variants');
  testDb.exec('DROP TABLE IF EXISTS prompt_ab_tests');
});

function post(body: unknown) {
  return POST(new Request('http://test/api/prompt-evolution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never);
}

function threeVariants() {
  const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
  const b = createVariant(MOD, ITEM, 'Add a melee combo with verification steps.');
  const c = createVariant(MOD, ITEM, 'Add a melee combo, then verify it compiles.');
  return { a, b, c };
}

describe('engine.startABTest — one running test per item', () => {
  it('refuses a second running test on the same item, naming the running one, and creates nothing', () => {
    const { a, b, c } = threeVariants();
    const first = startABTest(MOD, ITEM, a.id, b.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const before = getAllTests().length;

    const second = startABTest(MOD, ITEM, a.id, c.id);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toContain(first.data.id);
    expect(getAllTests().length).toBe(before);
  });
});

describe('POST start-ab-test', () => {
  it('answers 409 with the reason while a test is running on the item, 200 and the test otherwise', async () => {
    const { a, b, c } = threeVariants();
    const okRes = await post({ action: 'start-ab-test', moduleId: MOD, checklistItemId: ITEM, variantId: a.id, testId: b.id });
    expect(okRes.status).toBe(200);
    const okJson = await okRes.json();
    expect(okJson.success).toBe(true);
    expect(okJson.data).toMatchObject({ variantAId: a.id, variantBId: b.id, status: 'running' });

    const refused = await post({ action: 'start-ab-test', moduleId: MOD, checklistItemId: ITEM, variantId: a.id, testId: c.id });
    expect(refused.status).toBe(409);
    const refusedJson = await refused.json();
    expect(refusedJson.success).toBe(false);
    expect(refusedJson.error).toContain(okJson.data.id);
  });
});
