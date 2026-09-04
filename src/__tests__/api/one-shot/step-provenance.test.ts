/**
 * Every produced artifact must say who made it (`data._provenance`). The stamp was
 * designed, typed, documented and READ by the Evidence modal — and never written: measured
 * read-only on the real DB on 2026-09-04, 805 of 817 rows carried `engine:'unknown'` and the
 * other 12 carried no stamp at all (100% not recorded).
 *
 * This route is the one write path that can PROVE what ran: it resolves `{model, effort}`
 * from the model policy two lines before the dispatch, and it knows whether the step body
 * (deterministic code) or a Claude CLI session authored the payload.
 *
 * Standard: catalog-pipeline-authoring / direction-is-an-input-not-a-text-box — stamp EVERY
 * artifact, deterministic authors included.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-oneshot-provenance-${process.pid}.db`;
});

import { POST } from '@/app/api/one-shot/step/route';
import { upsertArtifact } from '@/lib/pipeline-artifacts-db';
import { resolveDispatchModelChoice, MODEL_IDS } from '@/lib/model-policy';
import { ONE_SHOT_STEP_TASK_TYPE } from '@/lib/cli-spend/dispatchPlan';
import { readProvenance } from '@/lib/provenance';

vi.mock('@/lib/catalog/seed', () => ({
  seededEntities: vi.fn().mockReturnValue([
    { id: 'e1', catalogId: 'items', name: 'Iron Sword', categoryPath: [], tags: [], lifecycle: 'planned', data: { type: 'Weapon' } },
  ]),
}));

vi.mock('@/lib/catalog/pipeline-registry', () => ({
  registerCatalogPipeline: vi.fn(),
  getCatalogPipeline: vi.fn().mockReturnValue({
    catalogId: 'items',
    steps: [{
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: '' },
      produce: () => ({ data: { brief: 'A solid iron sword.' }, ueAssets: [] }),
      accept: () => ({ tier: 'L0', status: 'pass', label: 'Brief', detail: 'ok' }),
    }],
  }),
}));

vi.mock('@/lib/pipeline-artifacts-db', () => ({
  upsertArtifact: vi.fn().mockImplementation((a) => a),
  listArtifacts: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/claude-terminal/cli-service', () => ({
  startExecution: vi.fn().mockReturnValue('exec-1'),
  awaitCallback: vi.fn().mockResolvedValue({ brief: 'cli-produced brief content' }),
}));

afterEach(() => { vi.clearAllMocks(); });

const post = (body: unknown) => new NextRequest('http://localhost/api/one-shot/step', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

/** The data actually handed to `upsertArtifact` (what is persisted, not what is returned). */
function persistedData(): Record<string, unknown> {
  const calls = vi.mocked(upsertArtifact).mock.calls;
  expect(calls.length).toBe(1);
  return (calls[0][0] as { data: Record<string, unknown> }).data;
}

describe('POST /api/one-shot/step — the produced artifact records its engine', () => {
  it('cli mode stamps engine Claude with the POLICY-resolved model and effort', async () => {
    const res = await POST(post({ catalogId: 'items', entityId: 'e1', stepLabel: 'Concept Brief', mode: 'cli' }));
    expect(res.status).toBe(200);

    const p = readProvenance(persistedData());
    const { model, effort } = resolveDispatchModelChoice({ taskType: ONE_SHOT_STEP_TASK_TYPE });
    expect(p?.engine).toBe('Claude');
    expect(p?.model).toBe(model);
    expect(p?.effort).toBe(effort);
    expect(p?.modelId).toBe(model ? MODEL_IDS[model] : undefined);
  });

  it('the response body carries the same stamp the row got (no split truth)', async () => {
    const res = await POST(post({ catalogId: 'items', entityId: 'e1', stepLabel: 'Concept Brief', mode: 'cli' }));
    const body = await res.json();
    expect(readProvenance(body.data.artifactData)?.engine).toBe('Claude');
  });

  it('deterministic mode stamps engine Code — a step body is an author, not an absence', async () => {
    const res = await POST(post({ catalogId: 'items', entityId: 'e1', stepLabel: 'Concept Brief', mode: 'deterministic' }));
    expect(res.status).toBe(200);
    const p = readProvenance(persistedData());
    expect(p?.engine).toBe('Code');
    // A deterministic body ran no model: claiming one would be the fabrication this stamp exists to stop.
    expect(p?.model).toBeUndefined();
  });

  it('keeps the promptVersion stamp the fitness join reads', async () => {
    await POST(post({ catalogId: 'items', entityId: 'e1', stepLabel: 'Concept Brief', mode: 'deterministic' }));
    expect(readProvenance(persistedData())?.promptVersion).toBeTruthy();
  });

  it('never persists the placeholder engine that made the proof surface useless', async () => {
    await POST(post({ catalogId: 'items', entityId: 'e1', stepLabel: 'Concept Brief', mode: 'deterministic' }));
    expect(readProvenance(persistedData())?.engine).not.toBe('unknown');
  });
});
