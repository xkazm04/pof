import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

import { createVariant, startABTest } from '@/lib/prompt-evolution/engine';
import { POST } from '@/app/api/prompt-evolution/route';
import type { SubModuleId } from '@/types/modules';

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

describe('prompt-evolution get-tests route', () => {
  it('returns persisted A/B tests so they survive a reload', async () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = createVariant(MOD, ITEM, 'Add a melee combo with verification steps.');
    const test = startABTest(MOD, ITEM, a.id, b.id);

    const res = await post({ action: 'get-tests' });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.map((t: { id: string }) => t.id)).toContain(test!.id);
  });

  it('filters by moduleId when provided', async () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = createVariant(MOD, ITEM, 'Add a melee combo with verification steps.');
    startABTest(MOD, ITEM, a.id, b.id);

    const other = await post({ action: 'get-tests', moduleId: 'arpg-inventory' });
    const otherJson = await other.json();
    expect(otherJson.success).toBe(true);
    expect(otherJson.data).toHaveLength(0);
  });
});
