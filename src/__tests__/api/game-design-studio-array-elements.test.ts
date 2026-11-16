/**
 * POST /api/ability-spec and /api/balance-baseline used to check only Array.isArray on
 * their array fields, so `effects:[null]` / `stats:[1]` were persisted and then
 * dereferenced by the GAS codegen / threat-score readers. Each element must now be an
 * object carrying the fields the consumers read (400 naming the index).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { upsertSpec, upsertBaseline } = vi.hoisted(() => ({ upsertSpec: vi.fn(), upsertBaseline: vi.fn() }));
vi.mock('@/lib/ability/ability-spec-db', () => ({ getSpec: () => null, upsertSpec: (w: unknown) => upsertSpec(w) }));
vi.mock('@/lib/balance/baseline-db', () => ({ getBaseline: () => null, upsertBaseline: (r: unknown) => upsertBaseline(r) }));

import { POST as specPost } from '@/app/api/ability-spec/route';
import { POST as basePost } from '@/app/api/balance-baseline/route';

beforeEach(() => {
  vi.clearAllMocks();
  upsertSpec.mockReturnValue({});
  upsertBaseline.mockReturnValue({});
});

function req(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body) });
}
const effect = { id: 'e1', name: 'Hit', duration: 'instant', durationSec: 0, cooldownSec: 1, color: 'c', modifiers: [], grantedTags: [] };
const rule = { id: 'r1', sourceTag: 'A', targetTag: 'B', type: 'blocks' };
const spec = (over: Record<string, unknown> = {}) => ({ catalogId: 'c', entityId: 'e', effects: [effect], tagRules: [rule], ...over });

describe('ability-spec element shape', () => {
  it('stores a well-formed spec', async () => {
    expect((await specPost(req('/api/ability-spec', spec()))).status).toBe(200);
    expect(upsertSpec).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['effects', { effects: [null] }],
    ['effects', { effects: [1, 'x'] }],
    ['tagRules', { tagRules: [{ id: 'r' }] }],
    ['attributes', { attributes: [null] }],
    ['relationships', { relationships: ['x'] }],
    ['loadout', { loadout: [[]] }],
  ])('refuses a malformed %s element with 400 and stores nothing', async (key, over) => {
    const res = await specPost(req('/api/ability-spec', spec(over)));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(`${key}[`);
    expect(upsertSpec).not.toHaveBeenCalled();
  });
  it('still lets an optional slice be cleared with null', async () => {
    expect((await specPost(req('/api/ability-spec', spec({ attributes: null })))).status).toBe(200);
  });
});

describe('balance-baseline stats element shape', () => {
  const body = (stats: unknown) => ({ catalogId: 'c', entityId: 'e', threatScore: 10, stats });
  it('stores well-formed rows', async () => {
    expect((await basePost(req('/api/balance-baseline', body([{ label: 'Damage', value: 5 }])))).status).toBe(200);
  });
  it.each([[[null]], [[1]], [[{ label: 'x' }]], [[{ label: 'x', value: 'NaN' }]]])('refuses %j with 400', async (stats) => {
    const res = await basePost(req('/api/balance-baseline', body(stats)));
    expect(res.status).toBe(400);
    expect(upsertBaseline).not.toHaveBeenCalled();
  });
});
