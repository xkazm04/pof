/**
 * scan-sweep Lane B (holistic-quality-overview): the Summary's per-source surfaces
 * (quick-nav sub-labels, Q/D/A/S badges) must say a source FAILED, not that it is empty,
 * and the badges must carry an accessible name.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
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

function quickNavText(container: HTMLElement, label: string): string {
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
  if (!btn) throw new Error(`quick-nav card ${label} not rendered`);
  return btn.textContent ?? '';
}

describe('UnifiedSummaryView — failed source is not an empty source', () => {
  it('a failed analytics read does not read "No data" on the Session Analytics card or the A badge', async () => {
    h.fetch.mockResolvedValue({ ok: false, error: 'HTTP 500' });
    const { container } = render(<UnifiedSummaryView onNavigateTab={vi.fn()} />);
    await settle();
    expect(quickNavText(container, 'Session Analytics')).not.toContain('No data');
    expect(quickNavText(container, 'Session Analytics')).toContain('Load failed');
    const badgeA = container.querySelector('[title^="A:"]');
    expect(badgeA?.getAttribute('title')).toBe('A: Load failed');
  });

  it('an empty but successful analytics read is not reported as a failure', async () => {
    h.fetch.mockResolvedValue({ ok: true, data: { totalSessions: 0, moduleStats: [] } });
    const { container } = render(<UnifiedSummaryView onNavigateTab={vi.fn()} />);
    await settle();
    expect(quickNavText(container, 'Session Analytics')).not.toContain('Load failed');
    expect(container.querySelector('[title^="A:"]')?.getAttribute('title')).toBe('A: No data');
  });

  it('every source badge carries an accessible name stating its availability', async () => {
    h.fetch.mockResolvedValue({ ok: true, data: { totalSessions: 3, moduleStats: [] } });
    const { container } = render(<UnifiedSummaryView onNavigateTab={vi.fn()} />);
    await settle();
    const named = [...container.querySelectorAll('[role="img"]')].filter(
      (el) => (el.getAttribute('aria-label') ?? '').trim().length > 0,
    );
    const names = named.map((el) => el.getAttribute('aria-label'));
    expect(names).toEqual([
      'Quality: data available',
      'Dependencies: no data',
      'Analytics: data available',
      'Scanner: no data',
    ]);
  });
});

describe('UnifiedSummaryView — view-mode tablist keyboard model', () => {
  it('ArrowRight on Detailed selects Brief and focuses it; the panel is wired to the selected tab', async () => {
    h.fetch.mockResolvedValue({ ok: true, data: { totalSessions: 3, moduleStats: [] } });
    const { container } = render(<UnifiedSummaryView onNavigateTab={vi.fn()} />);
    await settle();
    const tabs = () => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Summary view mode"] [role="tab"]')];
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1]);
    fireEvent.keyDown(tabs()[0], { key: 'ArrowRight' });
    await settle();
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(document.activeElement).toBe(tabs()[1]);
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.getAttribute('aria-labelledby')).toBe(tabs()[1].id);
    expect(tabs()[1].getAttribute('aria-controls')).toBe(panel?.id);
  });
});
