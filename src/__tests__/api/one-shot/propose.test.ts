import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/one-shot/propose/route';

const MOCK_DISTRIBUTION = {
  catalogId: 'items',
  total: 2,
  byAttribute: { type: { Weapon: 1, Armor: 1 } },
  underrepresented: [],
  sample: [{ id: 'e1', catalogId: 'items', name: 'Iron Sword', categoryPath: [], tags: [], lifecycle: 'planned' as const, data: { type: 'Weapon', rarity: 'Common' } }],
};

vi.mock('@/lib/catalog/seed', () => ({
  seededEntities: vi.fn().mockReturnValue([
    { id: 'e1', catalogId: 'items', name: 'Iron Sword', categoryPath: [], tags: [], lifecycle: 'planned', data: {} },
  ]),
}));

vi.mock('@/lib/one-shot/design-prompts', () => ({
  buildProposalPrompt: vi.fn().mockReturnValue('mock prompt'),
}));

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: vi.fn().mockReturnValue('exec-123'),
  awaitCallback: vi.fn().mockResolvedValue({ name: 'Void Staff', data: { type: 'Weapon', rarity: 'Rare' }, rationale: 'fills a gap' }),
}));

afterEach(() => { vi.restoreAllMocks(); });

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/one-shot/propose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/one-shot/propose', () => {
  it('returns 400 when catalogId is missing', async () => {
    const res = await POST(makePost({ distribution: MOCK_DISTRIBUTION }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 when distribution is missing', async () => {
    const res = await POST(makePost({ catalogId: 'items' }));
    expect(res.status).toBe(400);
  });

  it('returns a proposal with name, data, rationale, issues on success', async () => {
    const res = await POST(makePost({ catalogId: 'items', distribution: MOCK_DISTRIBUTION }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Void Staff');
    expect(Array.isArray(body.data.issues)).toBe(true);
    expect(typeof body.data.rationale).toBe('string');
  });
});
