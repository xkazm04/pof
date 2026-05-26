import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/one-shot/refine/route';

const MOCK_DISTRIBUTION = {
  catalogId: 'items',
  total: 2,
  byAttribute: {},
  underrepresented: [],
  sample: [],
};

const MOCK_PRIOR = { name: 'Iron Sword', data: { type: 'Weapon', rarity: 'Common' }, rationale: 'basic weapon' };

vi.mock('@/lib/catalog/seed', () => ({
  seededEntities: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/one-shot/design-prompts', () => ({
  buildRefinePrompt: vi.fn().mockReturnValue('mock refine prompt'),
}));

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: vi.fn().mockReturnValue('exec-456'),
  awaitCallback: vi.fn().mockResolvedValue({ name: 'Silver Sword', data: { type: 'Weapon', rarity: 'Uncommon' }, rationale: 'improved design' }),
}));

afterEach(() => { vi.restoreAllMocks(); });

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/one-shot/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/one-shot/refine', () => {
  it('returns 400 when catalogId is missing', async () => {
    const res = await POST(makePost({ distribution: MOCK_DISTRIBUTION, prior: MOCK_PRIOR, userInput: 'make it rarer' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 when userInput is missing', async () => {
    const res = await POST(makePost({ catalogId: 'items', distribution: MOCK_DISTRIBUTION, prior: MOCK_PRIOR }));
    expect(res.status).toBe(400);
  });

  it('returns a refined proposal on success', async () => {
    const res = await POST(makePost({
      catalogId: 'items',
      distribution: MOCK_DISTRIBUTION,
      prior: MOCK_PRIOR,
      userInput: 'make it rarer',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Silver Sword');
    expect(Array.isArray(body.data.issues)).toBe(true);
  });
});
