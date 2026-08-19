/**
 * The NBA card told every user "50% past success on similar work".
 *
 * `computeNBA` scored its success factor from `moduleStore.moduleHistory`, whose
 * only writer (`addHistoryEntry`) has ZERO non-test call sites in the app — the
 * real `~/.pof/pof.db` has `project_progress.history_json = {}`. So the module
 * rate always fell through to a hard-coded `0.5`, `breakdown.successProb` came
 * out at `round(0.5 × 25 × 0.5) = 6 > 0`, and the "Success odds" segment always
 * rendered with a confident percentage about work nothing had ever attempted.
 *
 * Every module CLI dispatch has meanwhile been recording its real outcome to
 * `session_analytics` (`useModuleCLI` → `recordSessionOutcome`), readable at
 * `/api/session-analytics?action=module` — an endpoint with zero client
 * consumers. These tests hold the wire from that endpoint to the card.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { RoadmapChecklist } from '@/components/modules/shared/RoadmapChecklist';
import { __resetModulePatternCache } from '@/components/modules/shared/RoadmapChecklist/useModulePatterns';
import { __resetRunEvidenceCache } from '@/hooks/useModuleRunEvidence';
import { invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useModuleStore } from '@/stores/moduleStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { SUB_MODULE_MAP } from '@/lib/module-registry';
import { mockFetchRoutes } from '@/__tests__/setup';
import { ACCENT_EMERALD } from '@/lib/chart-colors';
import type { ChecklistItem } from '@/types/modules';

afterEach(cleanup);

const MODULE = 'arpg-save';
const ONLY_UNCOMPLETED = 'as-3';

function items(): ChecklistItem[] {
  return SUB_MODULE_MAP[MODULE as keyof typeof SUB_MODULE_MAP]?.checklist ?? [];
}

/** Leave exactly one item open so the card's `top` is deterministic. */
function seedProgress() {
  const progress: Record<string, boolean> = {};
  for (const item of items()) progress[item.id] = item.id !== ONLY_UNCOMPLETED;
  useModuleStore.setState({
    checklistProgress: { [MODULE]: progress },
    checklistVerification: {},
    moduleHistory: {},
  });
}

function routes(sessions: Array<{ success: boolean }>) {
  return mockFetchRoutes([
    { match: 'action=module', response: { body: { success: true, data: { sessions } } } },
    { match: '/api/pattern-library', response: { body: { success: true, data: { patterns: [] } } } },
    { match: '/api/feature-matrix/all-statuses', response: { body: { success: true, data: { statuses: [] } } } },
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
  __resetRunEvidenceCache();
  invalidateFeatureStatuses();
  usePatternLibraryStore.setState({ patterns: [], suggestions: [] });
  seedProgress();
});

describe('NBA success odds', () => {
  it('reads the real recorded runs and names the sample size', async () => {
    const fetchMock = routes([{ success: true }, { success: false }, { success: true }]);
    renderChecklist();
    await settle();

    // The zero-consumer endpoint is actually consumed now, scoped to this module.
    const calls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('action=module') && u.includes(`moduleId=${MODULE}`))).toBe(true);

    const odds = screen.getByTestId('nba-success-odds');
    expect(odds.getAttribute('data-odds-source')).toBe('runs');
    expect(odds.textContent).toContain('2 of 3 past runs succeeded');
    expect(odds.textContent).toContain('67%');
  });

  it('says there is no record instead of printing a percentage', async () => {
    routes([]);
    renderChecklist();
    await settle();

    const odds = screen.getByTestId('nba-success-odds');
    expect(odds.getAttribute('data-odds-source')).toBe('none');
    expect(odds.textContent).toContain('No recorded runs for this module yet');
    expect(odds.textContent).not.toMatch(/\d+%/);
  });

  it('never claims "50% past success" anywhere on the card with no history', async () => {
    routes([]);
    const { container } = renderChecklist();
    await settle();

    const text = container.textContent ?? '';
    expect(text).not.toContain('past success on similar work');
    expect(text).not.toContain('50%');
  });

  it('reports an all-failed record honestly rather than as unknown', async () => {
    // The measured shape of the real DB: recorded runs exist, none succeeded.
    routes([{ success: false }, { success: false }, { success: false }, { success: false }]);
    renderChecklist();
    await settle();

    const odds = screen.getByTestId('nba-success-odds');
    expect(odds.getAttribute('data-odds-source')).toBe('runs');
    expect(odds.textContent).toContain('0 of 4 past runs succeeded');
  });
});
