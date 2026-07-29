import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskFactory, buildTaskPrompt, getCallback, resolveCallback } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';

const { mockSet } = vi.hoisted(() => ({ mockSet: vi.fn() }));
vi.mock('@/lib/ability/ability-spec-db', () => ({ setCodegenReport: mockSet }));

import { POST } from '@/app/api/ability-spec/codegen/route';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/proj/PoF', ueVersion: '5.8' } as ProjectContext;
const ref: AbilityRef = { name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced' };
const effects: EditorEffect[] = [{
  id: 'e1', name: 'Fire Strike', duration: 'instant', durationSec: 0, cooldownSec: 0,
  color: '#f87171', modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -40 }], grantedTags: [],
}];
const tagRules: TagRule[] = [{ id: 'r1', sourceTag: 'Ability.Fire.Fireball', targetTag: 'State.Dead', type: 'blocks' }];

function req(body: unknown): Request {
  return new Request('http://localhost/api/ability-spec/codegen', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const OK_BODY = {
  catalogId: 'spellbook',
  entityId: 'off-fire-01',
  filesWritten: ['Source/PoF/AbilitySystem/Effects/Generated/GE_Gen_Fireball_FireStrike.h'],
  buildOk: true,
  seedRan: true,
  dataTableRows: 4,
  missingTags: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSet.mockImplementation((catalogId: string, entityId: string, report: unknown) => ({
    catalogId, entityId, effects: [], tagRules: [], codegen: report,
  }));
});

describe('POST /api/ability-spec/codegen', () => {
  it('persists a confirmed report onto the spec', async () => {
    const res = await POST(req(OK_BODY) as never);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.codegen.status).toBe('confirmed');
    expect(mockSet).toHaveBeenCalledWith('spellbook', 'off-fire-01', expect.objectContaining({
      status: 'confirmed', dataTableRows: 4,
    }));
  });

  it('failure path: an unseeded run persists as failed WITH a reason', async () => {
    const res = await POST(req({ ...OK_BODY, seedRan: false, dataTableRows: 0 }) as never);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.codegen.status).toBe('failed');
    expect(json.data.codegen.reason).toContain('seeder did not run');
  });

  it('validates the raw LLM payload instead of casting it', async () => {
    const res = await POST(req({ ...OK_BODY, filesWritten: 'GE_Gen.h' }) as never);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('filesWritten');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('requires the spec identity', async () => {
    const res = await POST(req({ ...OK_BODY, entityId: '' }) as never);
    expect(res.status).toBe(400);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('generate-gas-effects callback wiring', () => {
  it('registers a codegen callback whose static fields win over the model payload', async () => {
    const task = TaskFactory.generateGasEffects(
      'arpg-gas',
      { ref, effects, tagRules, catalogId: 'spellbook', entityId: 'off-fire-01' },
      'http://localhost:3001',
      'Gen',
    );
    const prompt = buildTaskPrompt(task, ctx);
    const id = prompt.match(/@@CALLBACK:(\S+)/)?.[1];
    expect(id).toBeTruthy();

    const cb = getCallback(id!);
    expect(cb?.url).toBe('http://localhost:3001/api/ability-spec/codegen');
    expect(cb?.staticFields).toEqual({ catalogId: 'spellbook', entityId: 'off-fire-01' });

    // The terminal merges staticFields LAST — a spoofed entityId in the model's
    // JSON cannot redirect the report onto another entity.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }) as never,
    );
    const out = await resolveCallback(id!, JSON.stringify({
      entityId: 'someone-elses-ability', filesWritten: ['a.h'], buildOk: true, seedRan: true, dataTableRows: 1,
    }));
    expect(out.success).toBe(true);

    const sent = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.entityId).toBe('off-fire-01');
    expect(sent.catalogId).toBe('spellbook');
    expect(sent.filesWritten).toEqual(['a.h']);
    fetchSpy.mockRestore();
  });
});
