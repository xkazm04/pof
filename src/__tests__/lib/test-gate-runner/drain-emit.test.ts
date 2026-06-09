import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

// In-memory store backing the mocked artifacts DB (mirrors drain.test.ts).
const store = new Map<string, PipelineArtifact>();
const key = (c: string, e: string, s: string) => `${c}|${e}|${s}`;

vi.mock('@/lib/pipeline-artifacts-db', () => ({
  getArtifact: (c: string, e: string, s: string) => store.get(key(c, e, s)) ?? null,
  listDeferredArtifacts: () => [...store.values()].filter((a) => a.status === 'deferred'),
  upsertArtifact: (a: PipelineArtifact) => { store.set(key(a.catalogId, a.entityId, a.step), a); return a; },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { drainOne } from '@/lib/test-gate-runner/drain';
import { eventBus } from '@/lib/event-bus';
import type { GateExecutor, GateJob, GateVerdict } from '@/lib/test-gate-runner/types';
import type { EventMap } from '@/types/event-bus';

function seed(a: Partial<PipelineArtifact> & { catalogId: string; entityId: string; step: string }) {
  store.set(key(a.catalogId, a.entityId, a.step), { data: {}, ueAssets: [], status: 'deferred', ...a } as PipelineArtifact);
}
function exec(status: GateVerdict['status'], detail = 'd'): GateExecutor {
  return { id: 'fake', tier: 'L3', available: async () => true, run: async () => ({ status, detail }) };
}

let received: Array<EventMap['gate.verdict.changed']>;
let unsub: () => void;

beforeEach(() => {
  store.clear();
  received = [];
  unsub = eventBus.on('gate.verdict.changed', (e) => received.push(e.payload));
});
afterEach(() => unsub());

const job = (over: Partial<GateJob> = {}): GateJob => ({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', ...over });

describe('drainOne — gate.verdict.changed emit', () => {
  it('emits deferred→fail as a failure (regression=false)', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', status: 'deferred' });
    await drainOne(job(), exec('fail', 'VSTest: 1 failed'));
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3',
      from: 'deferred', to: 'fail', regression: false, detail: 'VSTest: 1 failed',
    });
  });

  it('emits pass→fail as a regression', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', status: 'pass' });
    await drainOne(job(), exec('fail'));
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ from: 'pass', to: 'fail', regression: true });
  });

  it('does NOT emit when the verdict is unchanged (pass→pass)', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', status: 'pass' });
    await drainOne(job(), exec('pass'));
    expect(received).toHaveLength(0);
  });

  it('emits deferred→pass as a recovery (regression=false)', async () => {
    seed({ catalogId: 'items', entityId: 'a', step: 'g', tier: 'L3', status: 'deferred' });
    await drainOne(job(), exec('pass'));
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ from: 'deferred', to: 'pass', regression: false });
  });
});
