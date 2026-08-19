/**
 * The NBA banner's red "known pitfalls" warning was structurally unreachable in
 * production.
 *
 * Its two inputs are `matchedPattern.pitfalls` and failed-run history.
 * `usePatternLibraryStore` is a plain `create(...)` store with NO persist
 * middleware, and its `patterns` slice is written by exactly two call sites —
 * both inside the *Pattern Library* Evaluator tab (`fetchDashboard` /
 * `searchPatterns`). `useRoadmapChecklist` pulls `suggestions` from the same
 * store, which is a DIFFERENT field. Failure history is worse: `addHistoryEntry`
 * (moduleStore) has zero non-test call sites in the whole app, so
 * `moduleHistory` only ever holds what the project-progress hydrate loaded.
 *
 * So the warning that would say "this approach failed last time" could not
 * render before pressing Run, no matter what the server held.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { RoadmapChecklist } from '@/components/modules/shared/RoadmapChecklist';
import { __resetModulePatternCache } from '@/components/modules/shared/RoadmapChecklist/useModulePatterns';
import { invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { mockFetchRoutes } from '@/__tests__/setup';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import type { ImplementationPattern } from '@/types/pattern-library';
import type { ChecklistItem } from '@/types/modules';

// setup.ts installs no auto-cleanup.
afterEach(cleanup);

const MODULE = 'arpg-save';
const ONLY_UNCOMPLETED = 'as-3'; // "Implement Save function"

/** A pattern whose title first-word ("save") matches the one open item's label. */
const PATTERN: ImplementationPattern = {
  id: 'p-save-1',
  title: 'Save gathering via a single GatherSaveData pass',
  moduleId: MODULE,
  category: 'save-system',
  tags: [],
  description: 'One pass collects state from every system.',
  approach: 'composition',
  successRate: 0.8,
  sessionCount: 4,
  projectCount: 1,
  avgDurationMs: 120_000,
  confidence: 'promising',
  involvedClasses: ['UARPGSaveGame'],
  pitfalls: ['AsyncSaveGameToSlot races with level unload — flush before streaming out'],
  firstSeenAt: '2026-01-01T00:00:00.000Z',
  lastSuccessAt: '2026-02-01T00:00:00.000Z',
  source: 'mined',
  verified: false,
  pinned: false,
};

function items(): ChecklistItem[] {
  return SUB_MODULE_MAP[MODULE as keyof typeof SUB_MODULE_MAP]?.checklist ?? [];
}

/** Leave exactly one item open so the NBA card's `top` is deterministic. */
function seedProgress() {
  const progress: Record<string, boolean> = {};
  for (const item of items()) progress[item.id] = item.id !== ONLY_UNCOMPLETED;
  useModuleStore.setState({
    checklistProgress: { [MODULE]: progress },
    checklistVerification: {},
    moduleHistory: {},
  });
}

function routes(patterns: ImplementationPattern[] | { fail: true }) {
  return mockFetchRoutes([
    {
      match: '/api/pattern-library',
      response: Array.isArray(patterns)
        ? { body: { success: true, data: { patterns } } }
        : { status: 500, body: { success: false, error: 'pattern_library table is locked' } },
    },
    { match: '/api/feature-matrix/all-statuses', response: { body: { success: true, data: { statuses: [] } } } },
    { match: '/api/checklist-metadata', response: { body: { success: true, data: {} } } },
    { match: '/api/', response: { body: { success: true, data: {} } } },
  ]);
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}

function renderChecklist() {
  return render(
    <RoadmapChecklist
      items={items()}
      subModuleId={MODULE}
      onRunPrompt={() => {}}
      accentColor={ACCENT_EMERALD}
      isRunning={false}
    />,
  );
}

beforeEach(() => {
  __resetModulePatternCache();
  invalidateFeatureStatuses();
  // The store slice the old engine read stays EMPTY on purpose: this is what a
  // real page load looks like until someone opens the Pattern Library tab.
  usePatternLibraryStore.setState({ patterns: [], suggestions: [] });
  seedProgress();
});

describe('NBA pitfalls warning', () => {
  it('renders the pitfall for a matching server-side pattern without visiting the Pattern Library tab', async () => {
    const fetchMock = routes([PATTERN]);
    renderChecklist();
    await settle();

    // The per-module read actually happened…
    const calls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(
      calls.some((u) => u.includes('/api/pattern-library?action=search') && u.includes(`moduleId=${MODULE}`)),
    ).toBe(true);
    // …and the store slice was NOT hijacked to carry it.
    expect(usePatternLibraryStore.getState().patterns).toEqual([]);

    // …and the warning is on screen.
    expect(screen.getByTestId('nba-pitfalls').textContent).toContain('AsyncSaveGameToSlot races');
  });

  it('surfaces the matched pattern metrics row that the same input gated', async () => {
    routes([PATTERN]);
    renderChecklist();
    await settle();
    expect(screen.getByText(/composition approach/)).toBeTruthy();
    expect(screen.getByText(/4 sessions/)).toBeTruthy();
  });

  it('says the library is empty rather than rendering nothing', async () => {
    routes([]);
    renderChecklist();
    await settle();
    expect(screen.queryByTestId('nba-pitfalls')).toBeNull();
    expect(screen.getByTestId('nba-pitfalls-empty').textContent)
      .toContain('not a clean bill of health');
  });

  it('says the check could not run when the read fails, and offers a retry', async () => {
    routes({ fail: true });
    renderChecklist();
    await settle();
    const note = screen.getByTestId('nba-pitfalls-unchecked');
    expect(note.textContent).toContain('Pitfalls not checked');
    expect(note.textContent).toContain('pattern_library table is locked');
    expect(note.querySelector('button')).toBeTruthy();
  });

  it('reads the pattern library once per module, not once per mount', async () => {
    const fetchMock = routes([PATTERN]);
    const first = renderChecklist();
    await settle();
    first.unmount();
    renderChecklist();
    await settle();
    const patternCalls = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('/api/pattern-library?action=search'));
    expect(patternCalls).toHaveLength(1);
  });
});
