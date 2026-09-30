import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { PromptVariantFitness } from '@/types/prompt-evolution';

const testDb = new Database(':memory:');
vi.mock('@/lib/db', () => ({ getDb: () => testDb }));

const { fitness } = vi.hoisted(() => ({ fitness: { rows: [] as PromptVariantFitness[] } }));
vi.mock('@/lib/prompt-evolution/judge-fitness', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/prompt-evolution/judge-fitness')>()),
  getPromptVariantFitness: () => fitness.rows,
}));

import { createVariant, startABTest } from '@/lib/prompt-evolution/engine';
import { POST } from '@/app/api/prompt-evolution/route';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;
const ITEM = 'ac-1';
const BANDS = ['strong', 'moderate', 'weak', 'none'];

beforeEach(() => {
  testDb.exec('DROP TABLE IF EXISTS prompt_variants');
  testDb.exec('DROP TABLE IF EXISTS prompt_ab_tests');
  fitness.rows = [];
});

function post(body: unknown) {
  return POST(new Request('http://test/api/prompt-evolution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never);
}

function row(variantId: string, passRate: number, verdicts: number): PromptVariantFitness {
  return { variantId, producedArtifacts: verdicts, judgedArtifacts: verdicts, verdicts, avgScore: passRate * 100, passRate };
}

type TestJson = { id: string; verdict?: { basis: string; band: string } };

describe('get-tests carries the verdict reading', () => {
  it('reads every test on the judge basis when both arms hold enough verdicts', async () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = createVariant(MOD, ITEM, 'Add a melee combo with verification steps.');
    startABTest(MOD, ITEM, a.id, b.id);
    fitness.rows = [row(a.id, 0.8, 5), row(b.id, 0.2, 5)];

    const json = await (await post({ action: 'get-tests' })).json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    for (const t of json.data as TestJson[]) {
      expect(t.verdict?.basis).toBe('judge');
      expect(BANDS).toContain(t.verdict?.band);
    }
  });

  it('falls back to the self-reported basis with no verdicts', async () => {
    const a = createVariant(MOD, ITEM, 'Implement a melee attack for the character.');
    const b = createVariant(MOD, ITEM, 'Add a melee combo with verification steps.');
    startABTest(MOD, ITEM, a.id, b.id);

    const json = await (await post({ action: 'get-tests' })).json();
    for (const t of json.data as TestJson[]) expect(t.verdict?.basis).toBe('self-reported');
  });
});
