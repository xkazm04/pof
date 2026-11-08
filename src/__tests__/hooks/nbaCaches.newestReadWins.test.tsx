/**
 * Newest read wins: when a refresh starts a second read while the first is still in
 * flight, the older answer must never land over the newer one. Reads are deferred
 * by hand and resolved out of order (B first, then A).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';

const { tryApiFetch } = vi.hoisted(() => ({ tryApiFetch: vi.fn() }));
vi.mock('@/lib/api-utils', async (orig) => ({ ...(await orig<typeof import('@/lib/api-utils')>()), tryApiFetch }));

import { useMilestoneDeadlines, invalidateMilestoneDeadlines, __resetMilestoneDeadlineCache } from '@/hooks/useMilestoneDeadlines';
import {
  useModuleRunEvidence, useProjectRunEvidence, invalidateRunEvidence, __resetRunEvidenceCache,
} from '@/hooks/useModuleRunEvidence';
import type { SubModuleId } from '@/types/modules';

type Resolver = (v: unknown) => void;
let pending: Resolver[] = [];

beforeEach(() => {
  pending = [];
  __resetMilestoneDeadlineCache();
  __resetRunEvidenceCache();
  tryApiFetch.mockReset();
  tryApiFetch.mockImplementation(() => new Promise((res) => { pending.push(res); }));
});
afterEach(cleanup);

const flush = () => act(async () => { await Promise.resolve(); });

describe('milestone deadlines', () => {
  it('a read started before an invalidation never overwrites the newer one', async () => {
    const { result } = renderHook(() => useMilestoneDeadlines());
    await flush();
    expect(pending).toHaveLength(1);
    act(() => { invalidateMilestoneDeadlines(); });
    expect(pending).toHaveLength(2);
    await act(async () => { pending[1]({ ok: true, data: { m1: { targetDate: 'NEW' } } }); });
    await act(async () => { pending[0]({ ok: true, data: { m1: { targetDate: 'OLD' } } }); });
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.deadlines?.m1?.targetDate).toBe('NEW');
  });
});

describe('run evidence', () => {
  const MODULE = 'arpg-combat' as SubModuleId;

  it('module: a read started before an invalidation never overwrites the newer one', async () => {
    const { result } = renderHook(() => useModuleRunEvidence(MODULE));
    await flush();
    expect(pending).toHaveLength(1);
    act(() => { invalidateRunEvidence(MODULE); });
    // module re-read is the first new request
    expect(pending.length).toBeGreaterThanOrEqual(2);
    const sessions = (n: number) => ({ ok: true, data: { sessions: Array.from({ length: n }, () => ({ success: true })) } });
    await act(async () => { pending[1](sessions(5)); });
    await act(async () => { pending[0](sessions(1)); });
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.evidence?.runs).toBe(5);
  });

  it('project: a read started before an invalidation never overwrites the newer one', async () => {
    const { result } = renderHook(() => useProjectRunEvidence());
    await flush();
    expect(pending).toHaveLength(1);
    act(() => { invalidateRunEvidence(MODULE); });
    expect(pending).toHaveLength(2);
    const dash = (n: number) => ({ ok: true, data: { moduleStats: [{ moduleId: MODULE, totalSessions: n, successCount: n }] } });
    await act(async () => { pending[1](dash(7)); });
    await act(async () => { pending[0](dash(2)); });
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.byModule.get(MODULE)?.runs).toBe(7);
  });
});
