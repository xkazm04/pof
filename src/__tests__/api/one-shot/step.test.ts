import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/one-shot/step/route';

vi.mock('@/lib/catalog/seed', () => ({
  seededEntities: vi.fn().mockReturnValue([
    {
      id: 'e1', catalogId: 'items', name: 'Iron Sword',
      categoryPath: [], tags: [], lifecycle: 'planned',
      data: { type: 'Weapon', rarity: 'Common' },
    },
  ]),
}));

vi.mock('@/lib/catalog/pipeline-registry', () => ({
  getCatalogPipeline: vi.fn().mockReturnValue({
    catalogId: 'items',
    steps: [
      {
        archetype: 'brief',
        label: 'Concept Brief',
        view: { kind: 'prose', field: 'brief', emptyText: '' },
        produce: () => ({ data: { brief: 'A solid iron sword for early-game combat.' }, ueAssets: [] }),
        accept: () => ({ tier: 'L0', status: 'pass', label: 'Brief ≥ 300', detail: '41 / 300 chars' }),
      },
    ],
  }),
}));

vi.mock('@/lib/pipeline-artifacts-db', () => ({
  upsertArtifact: vi.fn().mockImplementation((a) => a),
}));

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: vi.fn().mockReturnValue('exec-789'),
  awaitCallback: vi.fn().mockResolvedValue({ brief: 'cli-produced brief content' }),
}));

afterEach(() => { vi.restoreAllMocks(); });

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/one-shot/step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/one-shot/step', () => {
  it('returns 400 when catalogId is missing', async () => {
    const res = await POST(makePost({ entityId: 'e1', stepLabel: 'Concept Brief', mode: 'deterministic' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 404 when entity is not found', async () => {
    const res = await POST(makePost({ catalogId: 'items', entityId: 'missing', stepLabel: 'Concept Brief', mode: 'deterministic' }));
    expect(res.status).toBe(404);
  });

  it('deterministic mode: runs produce+accept and returns outcome', async () => {
    const res = await POST(makePost({ catalogId: 'items', entityId: 'e1', stepLabel: 'Concept Brief', mode: 'deterministic' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.outcome).toBe('pass');
    expect(body.data.stepName).toBe('Concept Brief');
  });
});
