import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskFactory, buildTaskPrompt, getCallback } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import type { AbilityRef } from '@/lib/ability/logic-prompts';

const { mockUpsert } = vi.hoisted(() => ({ mockUpsert: vi.fn() }));
vi.mock('@/lib/ability/ability-spec-db', () => ({ upsertSpec: mockUpsert, getSpec: vi.fn() }));

import { POST } from '@/app/api/ability-spec/route';

/**
 * POST /api/ability-spec preserves key ABSENCE (keep) vs explicit `null`
 * (clear) on its way to upsertSpec — the route must not collapse the two.
 */

function req(body: unknown): Request {
  return new Request('http://localhost/api/ability-spec', { method: 'POST', body: JSON.stringify(body) });
}

const BASE = { catalogId: 'spellbook', entityId: 'off-arc-01', effects: [], tagRules: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockImplementation((rec: unknown) => rec);
});

describe('POST /api/ability-spec — absent vs null', () => {
  it('a body with no attributes/relationships/loadout/provenance keys hands upsertSpec ABSENT keys (keep)', async () => {
    const res = await POST(req(BASE) as never);
    expect((await res.json()).success).toBe(true);
    const rec = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    for (const k of ['attributes', 'relationships', 'loadout', 'provenance']) {
      expect(k in rec, `${k} must be absent`).toBe(false);
    }
  });

  it('an explicit null reaches upsertSpec as null (clear)', async () => {
    await POST(req({ ...BASE, attributes: null, relationships: null, loadout: null, provenance: null }) as never);
    const rec = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(rec.attributes).toBeNull();
    expect(rec.relationships).toBeNull();
    expect(rec.loadout).toBeNull();
    expect(rec.provenance).toBeNull();
  });

  it('a named array slice is passed through (replace)', async () => {
    const attributes = [{ id: 'a1', name: 'Health', category: 'vital', defaultValue: 100 }];
    await POST(req({ ...BASE, attributes }) as never);
    const rec = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(rec.attributes).toEqual(attributes);
  });

  it('a malformed slice value is treated as absent (never destroys the stored slice)', async () => {
    await POST(req({ ...BASE, loadout: 'oops' }) as never);
    const rec = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect('loadout' in rec).toBe(false);
  });
});

describe('draft-ability-spec callback — a redraft still clears forge provenance', () => {
  it("the registered callback's staticFields carry provenance: null", () => {
    const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/proj/PoF', ueVersion: '5.8' } as ProjectContext;
    const ref: AbilityRef = { name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced' };
    const task = TaskFactory.draftAbilitySpec(
      'arpg-gas', { catalogId: 'spellbook', entityId: 'off-fire-01', ref }, 'http://localhost:3001', 'Draft',
    );
    const id = buildTaskPrompt(task, ctx).match(/@@CALLBACK:(\S+)/)?.[1];
    expect(id).toBeTruthy();
    const cb = getCallback(id!);
    expect(cb?.url).toBe('http://localhost:3001/api/ability-spec');
    expect(cb?.staticFields).toEqual({ catalogId: 'spellbook', entityId: 'off-fire-01', provenance: null });
  });
});
