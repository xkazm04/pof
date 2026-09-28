import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderHook, render, screen, cleanup, act } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment (the theme imports it).
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { ProduceLogPanel } from '@/components/layout-lab/ProduceLogPanel';
import { LIGHT } from '@/components/layout-lab/theme';
import {
  useLabPipelineStore, useLabStep, setLabSync, NO_SYNC_SINK_REASON, type LabStepArtifact,
} from '@/components/layout-lab/labPipelineStore';

/**
 * What `pof-lab-pipeline` writes to localStorage.
 *
 * The store used to persist its WHOLE in-memory map — every server row the operator ever
 * opened — into a ~5 MiB origin quota; once full, every `set()` threw before the produce
 * write-through ran, so nothing reached the server again. It now persists the OUTBOX: every
 * step except one PROVEN (by a server observation this session) to be an exact copy of its
 * server row. The guards pin the three shapes where a weaker predicate (`isServerDerived`)
 * would have dropped local work on upgrade.
 */

const KEY = 'pof-lab-pipeline';
const T = '2026-09-01T00:00:00.000Z';
const row = (data: Record<string, unknown>, at = T, extra: Partial<LabStepArtifact> = {}): LabStepArtifact =>
  ({ done: true, data, ueAssets: [], at, status: 'pass', ...extra });
const store = () => useLabPipelineStore.getState();
const persisted = (): Record<string, Record<string, LabStepArtifact>> =>
  JSON.parse(localStorage.getItem(KEY) ?? '{"state":{"byEntity":{}}}').state.byEntity;
const throwQuota = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException("Failed to execute 'setItem' on 'Storage': exceeded the quota.", 'QuotaExceededError');
  });

beforeEach(() => {
  setLabSync(null);
  localStorage.clear();
  useLabPipelineStore.setState({ byEntity: {}, persistError: null } as never);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); setLabSync(null); });

describe('labPipelineStore persistence — admission', () => {
  it('a hydrated server row lives in memory but is not written to localStorage', () => {
    store().hydrateEntity('e1', [{ step: 'S', artifact: { done: true, data: { v: 1 }, ueAssets: [], at: T, status: 'pass' } }]);
    expect(store().byEntity.e1.S).toBeDefined();
    expect(persisted()).not.toHaveProperty('e1');
  });

  it('300 hydrated entities of 12,000-char rows persist under 1,000 chars', () => {
    const blob = 'x'.repeat(12_000);
    for (let i = 0; i < 300; i += 1) store().hydrateEntity(`ent-${i}`, [{ step: 'S', artifact: row({ blob }) }]);
    expect(Object.keys(store().byEntity)).toHaveLength(300);
    expect((localStorage.getItem(KEY) ?? '').length).toBeLessThan(1_000);
  }, 60_000);

  it('[guard] a produce with no sink is local-only work and IS persisted', () => {
    store().produce('e2', 'S', { data: { v: 1 } });
    expect(persisted().e2.S.syncError).toBe(NO_SYNC_SINK_REASON);
  });

  it('[guard] a failure marker on a never-produced step is persisted', () => {
    store().fail('e3', 'S', 'boom');
    expect(persisted().e3.S.error).toBe('boom');
  });

  it('a produce later proven equal to its server row leaves storage but stays in memory', () => {
    setLabSync(() => {});
    store().produce('e4', 'S', { data: { v: 1 } });
    expect(persisted().e4.S.data).toEqual({ v: 1 });
    const later = new Date(Date.parse(store().byEntity.e4.S.at) + 5_000).toISOString();
    store().hydrateEntity('e4', [{ step: 'S', artifact: row({ v: 1 }, later) }]);
    expect(store().byEntity.e4.S.data).toEqual({ v: 1 });
    expect(persisted()).not.toHaveProperty('e4');
  });

  it('the server-stamped `_provenance` bookkeeping key does not block the proof', () => {
    setLabSync(() => {});
    store().produce('e4b', 'S', { data: { v: 1 } });
    store().hydrateEntity('e4b', [{ step: 'S', artifact: row({ v: 1, _provenance: { engine: 'Code' } }, '2099-01-01T00:00:00.000Z') }]);
    expect(persisted()).not.toHaveProperty('e4b');
  });
});

describe('labPipelineStore persistence — storage failure is non-fatal and reported', () => {
  it('a full quota does not stop the produce write-through', () => {
    const sink = vi.fn();
    setLabSync(sink);
    throwQuota();
    expect(() => store().produce('e5', 'S', { data: { v: 1 } })).not.toThrow();
    expect(sink).toHaveBeenCalledTimes(1);
    expect(store().byEntity.e5.S.error).toBeUndefined();
    expect((store() as unknown as { persistError: string | null }).persistError).toMatch(/quota/i);
  });

  it('a full quota does not throw out of hydrateEntity', () => {
    throwQuota();
    expect(() => store().hydrateEntity('e6', [{ step: 'S', artifact: row({ v: 1 }) }])).not.toThrow();
    expect(store().byEntity.e6.S.data).toEqual({ v: 1 });
  });

  it('the produce log reports the failed local save (even with an empty log), and clears once a write lands', () => {
    const spy = throwQuota();
    store().fail('e7', 'S', 'boom');
    render(createElement(ProduceLogPanel, { t: LIGHT, steps: ['S'], byStep: {}, onJump: () => {} }));
    expect(screen.getByTestId('produce-log-persist-error').textContent).toMatch(/quota/i);
    spy.mockRestore();
    act(() => store().clearError('e7', 'S'));
    expect((store() as unknown as { persistError: string | null }).persistError).toBeNull();
    expect(screen.queryByTestId('produce-log-persist-error')).toBeNull();
  });
});

describe('labPipelineStore persistence — upgrade never loses local work', () => {
  it('[guard] a legacy full-mirror blob rehydrates intact; a step leaves storage only once a hydrate proves it byte-equal', async () => {
    const legacy = {
      L: {
        Same: { ...row({ v: 1 }), serverSeen: T },
        Drift: { ...row({ v: 'local' }), serverSeen: T },
      },
    };
    localStorage.setItem(KEY, JSON.stringify({ state: { byEntity: legacy }, version: 0 }));
    await useLabPipelineStore.persist.rehydrate();
    const { result } = renderHook(() => [useLabStep('L', 'Same'), useLabStep('L', 'Drift')]);
    expect(result.current[0]?.data).toEqual({ v: 1 });
    expect(result.current[1]?.data).toEqual({ v: 'local' });
    store().resetEntity('unrelated'); // any write: nothing is proven yet, so nothing shrinks
    expect(Object.keys(persisted().L).sort()).toEqual(['Drift', 'Same']);
    store().hydrateEntity('L', [{ step: 'Same', artifact: row({ v: 1 }) }, { step: 'Drift', artifact: row({ v: 'server' }) }]);
    expect(Object.keys(persisted().L)).toEqual(['Drift']);
    expect(persisted().L.Drift.data).toEqual({ v: 'local' });
  });

  it('[guard] adoptServer keeping a local-only genHistory stays persisted', () => {
    const genHistory = { batches: [{ id: 'b1' }] };
    store().hydrateEntity('g', [{ step: 'Art', artifact: row({ pick: 1, genHistory }) }]);
    store().adoptServer('g', 'Art', row({ pick: 2 }, '2026-09-02T00:00:00.000Z'));
    expect(store().byEntity.g.Art.data).toEqual({ pick: 2, genHistory });
    expect(persisted().g.Art.data).toEqual({ pick: 2, genHistory });
  });

  it('[guard] a refresh that grafts local genHistory onto the server row stays persisted', () => {
    const genHistory = { batches: [{ id: 'b1' }] };
    store().hydrateEntity('g2', [{ step: 'Art', artifact: row({ pick: 1, genHistory }) }]);
    store().refreshEntity('g2', [{ step: 'Art', artifact: row({ pick: 2 }, '2026-09-02T00:00:00.000Z') }]);
    expect(persisted().g2.Art.data).toEqual({ pick: 2, genHistory });
  });

  it('[guard] a step whose syncError hydrate cleared, but whose data differs from the server row, stays persisted', () => {
    store().produce('s', 'S', { data: { v: 'mine' } });
    expect(store().byEntity.s.S.syncError).toBe(NO_SYNC_SINK_REASON);
    store().hydrateEntity('s', [{ step: 'S', artifact: row({ v: 'theirs' }, '2099-01-01T00:00:00.000Z') }]);
    expect(store().byEntity.s.S.syncError).toBeUndefined(); // hydrate cleared the claim
    expect(persisted().s.S.data).toEqual({ v: 'mine' });
  });

  it('[guard] local content drifted from the server row stays persisted (the DriftBanner choice survives reload)', () => {
    store().hydrateEntity('d', [{ step: 'S', artifact: row({ v: 1 }) }]);
    store().produce('d', 'S', { data: { v: 2 } });
    store().setSyncError('d', 'S', null);
    store().hydrateEntity('d', [{ step: 'S', artifact: row({ v: 1 }, '2099-01-01T00:00:00.000Z') }]);
    expect(store().byEntity.d.S.data).toEqual({ v: 2 });
    expect(persisted().d.S.data).toEqual({ v: 2 });
  });
});
