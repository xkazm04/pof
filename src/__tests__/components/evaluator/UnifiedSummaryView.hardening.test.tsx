/**
 * scan-sweep --optimize (holistic-quality-overview, night 2026-11-08): hardening of the
 * Evaluator Summary's own data source — a Refresh keeps the dashboard on screen, and
 * the latest analytics reply wins over a slower, older one.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';

afterEach(cleanup);

const h = vi.hoisted(() => ({
  statuses: vi.fn(),
  aggregates: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/hooks/useFeatureStatuses', () => ({
  useFeatureStatuses: h.statuses,
  invalidateFeatureStatuses: vi.fn(),
}));
vi.mock('@/hooks/useModuleAggregates', () => ({
  useModuleAggregates: h.aggregates,
  invalidateModuleAggregates: vi.fn(),
  invalidateFeatureData: vi.fn(),
}));
vi.mock('@/lib/api-utils', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-utils')>();
  return { ...actual, tryApiFetch: h.fetch };
});
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), sendPrompt: vi.fn(), isRunning: false }),
}));

import { UnifiedSummaryView } from '@/components/modules/evaluator/UnifiedSummaryView';

const lootAggregate = {
  moduleId: 'arpg-loot' as SubModuleId,
  total: 8, implemented: 4, improved: 0, partial: 0, missing: 4, unknown: 0,
  avgQuality: null, lastReviewedAt: null,
} as unknown as ModuleAggregate;

const OK = { ok: true, data: { totalSessions: 3, moduleStats: [] } };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  h.fetch.mockReset();
  h.statuses.mockReturnValue({
    statusMap: new Map(), statuses: [], isLoading: false, loaded: true, failed: false,
    error: null, scope: null, refresh: vi.fn(),
  });
  h.aggregates.mockReturnValue({
    aggregates: [lootAggregate], isLoading: false, loaded: true, failed: false,
    error: null, scope: null, refresh: vi.fn(),
  });
});

function refreshButton(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>('button[title="Refresh all data"]');
  if (!btn) throw new Error('refresh button not rendered');
  return btn;
}

describe('UnifiedSummaryView — own data source hardening', () => {
  it('a Refresh keeps the loaded dashboard on screen instead of blanking it to a spinner', async () => {
    const second = deferred<typeof OK>();
    h.fetch.mockResolvedValueOnce(OK).mockReturnValueOnce(second.promise);
    const { container } = render(<UnifiedSummaryView onNavigateTab={vi.fn()} />);
    await settle();
    expect(container.textContent).toContain('Combined Project Health');

    fireEvent.click(refreshButton(container));
    await settle();
    // The refetch is still in flight — the dashboard must not have been unmounted.
    expect(container.textContent).toContain('Combined Project Health');

    second.resolve(OK);
    await settle();
    expect(container.textContent).toContain('Combined Project Health');
  });

  it('a slow, older failed analytics reply cannot overwrite the newer successful one', async () => {
    const slow = deferred<{ ok: false; error: string }>();
    h.fetch
      .mockResolvedValueOnce(OK)            // mount
      .mockReturnValueOnce(slow.promise)    // refresh #1 — slow, fails
      .mockResolvedValueOnce(OK);           // refresh #2 — fast, succeeds
    const { container } = render(<UnifiedSummaryView onNavigateTab={vi.fn()} />);
    await settle();

    fireEvent.click(refreshButton(container));
    await settle();
    fireEvent.click(refreshButton(container));
    await settle();
    expect(container.textContent).not.toContain("couldn't be loaded");

    slow.resolve({ ok: false, error: 'HTTP 500' });
    await settle();
    // The superseded reply is inert: no error banner over a source that loaded.
    expect(container.textContent).not.toContain("couldn't be loaded");
    expect(container.textContent).not.toContain('HTTP 500');
  });
});
