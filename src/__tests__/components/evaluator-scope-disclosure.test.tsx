/**
 * Every surface that reads the feature matrix must say what the project scope let
 * it see — not just the module Feature Matrix.
 *
 * Wave 16 gave the matrix a four-state banner (`describeMatrixScope`), but
 * `useFeatureStatuses` / `useModuleAggregates` carry the SAME `scope` report and
 * the evaluator surfaces reading them disclosed nothing. So a project whose rows
 * another project owns rendered as "0% complete", "0/N lit" and a confident
 * "do this next" — all of it indistinguishable from a genuinely unreviewed project.
 *
 * Everything here is FIXTURE-driven. The live DB currently holds 165/165 rows
 * attributed to PoF (measured 2026-08-19 read-only), i.e. state `own` — the one
 * state that renders nothing — so any assertion against real counts would test
 * nothing today and break tomorrow. The contract is the four count-combinations.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, renderHook, act } from '@testing-library/react';
import type { ProjectScopeReport, ModuleAggregate } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';
import { mockFetch, mockFetchRoutes } from '@/__tests__/setup';
import { ACCENT_EMERALD } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PROJECT = 'c:/users/kazda/documents/unreal projects/pof';
const MODULE = 'arpg-character' as SubModuleId;

/** A PROJECT-WIDE report: `moduleId: null` is what `/all-statuses` and
 *  `/aggregate` return, and it is the shape these surfaces actually receive. */
function wideScope(over: Partial<ProjectScopeReport>): ProjectScopeReport {
  return {
    projectId: PROJECT,
    unscoped: false,
    moduleId: null,
    totalRows: 0,
    legacyRows: 0,
    ownedRows: 0,
    foreignRows: 0,
    projects: [],
    distinctProjects: 1,
    snapshots: { totalRows: 0, legacyRows: 0, ownedRows: 0, foreignRows: 0 },
    note: 'fixture note — verbatim from the report',
    ...over,
  };
}

const OWN = wideScope({ totalRows: 165, ownedRows: 165 });
const MIXED = wideScope({ totalRows: 165, ownedRows: 120, legacyRows: 45 });
const LEGACY = wideScope({ totalRows: 165, legacyRows: 165 });
/** The post-backfill reality for any SECOND project: every row belongs elsewhere. */
const FOREIGN_BLIND = wideScope({ totalRows: 165, foreignRows: 165, distinctProjects: 2 });

const STATE_FIXTURES: [string, ProjectScopeReport, boolean][] = [
  ['own', OWN, false],
  ['mixed', MIXED, true],
  ['legacy', LEGACY, true],
  ['foreign', FOREIGN_BLIND, true],
];

/** Flush the surfaces' own (mocked) fetches so a "no banner" assertion is made on
 *  a LOADED view, not on a spinner that would pass the check vacuously. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

function aggregate(moduleId: string, total: number): ModuleAggregate {
  return {
    moduleId: moduleId as SubModuleId,
    total,
    implemented: total,
    improved: 0,
    partial: 0,
    missing: 0,
    unknown: 0,
    avgQuality: 4,
    lastReviewedAt: '2026-08-01T00:00:00.000Z',
  };
}

// ── Hook mocks (the surfaces are rendered for real) ──────────────────────────

const h = vi.hoisted(() => ({
  statuses: vi.fn(),
  aggregates: vi.fn(),
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

function setStatuses(scope: ProjectScopeReport | null, rows: [string, string][] = []) {
  const statusMap = new Map(rows.map(([k, v]) => [k, v]));
  h.statuses.mockReturnValue({
    statusMap,
    statuses: rows.map(([k, status]) => {
      const [moduleId, featureName] = k.split('::');
      return { moduleId, featureName, status };
    }),
    isLoading: false,
    loaded: true,
    failed: false,
    error: null,
    scope,
    refresh: vi.fn(),
  });
}

function setAggregates(scope: ProjectScopeReport | null, rows: ModuleAggregate[] = []) {
  h.aggregates.mockReturnValue({
    aggregates: rows,
    byModule: new Map(rows.map((r) => [r.moduleId as string, r])),
    isLoading: false,
    loaded: true,
    failed: false,
    error: null,
    scope,
    refresh: vi.fn(),
  });
}

import { FeatureConstellation } from '@/components/modules/evaluator/FeatureConstellation';
import { AggregateQualityDashboard } from '@/components/modules/evaluator/AggregateQualityDashboard';
import { CrossModuleFeatureDashboard } from '@/components/modules/evaluator/CrossModuleFeatureDashboard';
import { UnifiedSummaryView } from '@/components/modules/evaluator/UnifiedSummaryView';
import { RoadmapChecklist } from '@/components/modules/shared/RoadmapChecklist';
import { useNBA } from '@/hooks/useNBA';
import {
  describeMatrixScope, countModuleRows, countAggregateRows,
} from '@/components/modules/shared/FeatureMatrix/matrixScope';

// ── The classifier, extended for project-wide reports ────────────────────────

describe('describeMatrixScope — subject derived from the report', () => {
  it('labels a project-wide report (`moduleId: null`) as a project, not a module', () => {
    const d = describeMatrixScope(FOREIGN_BLIND, 0)!;
    expect(d.subject).toBe('project');
    // It must NOT claim knowledge it does not have: a project-wide count says
    // nothing about how many of any ONE module's rows are foreign.
    expect(d.headline).not.toContain('this module');
    expect(d.headline).toContain('the feature matrix');
    expect(d.headline).toContain('not unreviewed');
    expect(d.level).toBe('bad');
  });

  it('keeps the module wording when the report IS module-scoped', () => {
    const moduleScoped = wideScope({ moduleId: 'arpg-combat', totalRows: 6, foreignRows: 6 });
    const d = describeMatrixScope(moduleScoped, 0)!;
    expect(d.subject).toBe('module');
    expect(d.headline).toContain('This module is not unreviewed');
  });

  it('says "a project nothing has reviewed" for a project-wide legacy set', () => {
    const d = describeMatrixScope(LEGACY, 165)!;
    expect(d.state).toBe('legacy');
    expect(d.headline).toContain('not the same as a project nothing has reviewed');
  });
});

describe('row counters', () => {
  it('counts only the rows of the named module', () => {
    const map = new Map([
      ['arpg-character::A', 'implemented'],
      ['arpg-character::B', 'missing'],
      ['arpg-combat::C', 'implemented'],
    ]);
    expect(countModuleRows(map, 'arpg-character')).toBe(2);
    expect(countModuleRows(map, 'animations')).toBe(0);
  });

  it('sums the roll-up rows the read actually returned', () => {
    expect(countAggregateRows([aggregate('a', 4), aggregate('b', 6)])).toBe(10);
    expect(countAggregateRows([])).toBe(0);
  });
});

// ── Per-surface disclosure ───────────────────────────────────────────────────

describe('FeatureConstellation scope disclosure', () => {
  it.each(STATE_FIXTURES)('%s → banner shown: %s', (state, scope, shows) => {
    setStatuses(scope, state === 'foreign' ? [] : [['arpg-character::AARPGCharacterBase', 'implemented']]);
    render(<FeatureConstellation />);
    const banner = screen.queryByTestId('pof-constellation-scope');
    expect(banner !== null).toBe(shows);
    if (banner) expect(banner.getAttribute('data-scope-state')).toBe(state);
  });

  it('denies the unreviewed reading when another project owns every row', () => {
    setStatuses(FOREIGN_BLIND, []);
    render(<FeatureConstellation />);
    const banner = screen.getByTestId('pof-constellation-scope');
    expect(banner.textContent).toContain('not unreviewed');
    expect(banner.textContent).toContain('165 rows');
    expect(banner.getAttribute('data-scope-subject')).toBe('project');
  });

  it('offers no claim/adopt action — attribution stays an operator decision', () => {
    setStatuses(FOREIGN_BLIND, []);
    render(<FeatureConstellation />);
    const banner = screen.getByTestId('pof-constellation-scope');
    expect(banner.querySelectorAll('button').length).toBe(0);
    expect(banner.textContent?.toLowerCase()).not.toContain('claim');
  });
});

describe('AggregateQualityDashboard scope disclosure', () => {
  beforeEach(() => {
    mockFetchRoutes([
      { match: '/api/judge-verdicts', response: { body: { success: true, data: [] } } },
      { match: '/api/feature-matrix/history', response: { body: { success: true, data: { history: {} } } } },
      { match: /./, response: { body: { success: true, data: {} } } },
    ]);
  });

  it.each(STATE_FIXTURES)('%s → banner shown: %s', async (state, scope, shows) => {
    setAggregates(scope, state === 'foreign' ? [] : [aggregate(MODULE, 6)]);
    render(<AggregateQualityDashboard />);
    await settle();
    const banner = screen.queryByTestId('pof-aggregate-quality-scope');
    expect(banner !== null).toBe(shows);
    if (banner) expect(banner.getAttribute('data-scope-state')).toBe(state);
  });

  it('escalates to `bad` when the roll-up read nothing because rows are foreign', async () => {
    setAggregates(FOREIGN_BLIND, []);
    render(<AggregateQualityDashboard />);
    await settle();
    const banner = screen.getByTestId('pof-aggregate-quality-scope');
    expect(banner.textContent).toContain('not unreviewed');
    expect(banner.textContent).toContain('165 rows');
  });
});

describe('CrossModuleFeatureDashboard scope disclosure', () => {
  beforeEach(() => {
    mockFetch({ body: { success: true, data: {} } });
    setStatuses(OWN, []);
  });

  it.each(STATE_FIXTURES)('%s → banner shown: %s', (state, scope, shows) => {
    // `hasData` gates the grid, so keep at least one aggregate row in every state
    // except the blind-foreign one, which is exactly the empty view under test.
    setAggregates(scope, [aggregate(MODULE, state === 'foreign' ? 0 : 6)]);
    render(<CrossModuleFeatureDashboard />);
    const banner = screen.queryByTestId('pof-cross-module-scope');
    expect(banner !== null).toBe(shows);
    if (banner) expect(banner.getAttribute('data-scope-state')).toBe(state);
  });

  it('says the 0% heatmap is a scope artefact, not an unreviewed project', () => {
    setAggregates(FOREIGN_BLIND, [aggregate(MODULE, 0)]);
    render(<CrossModuleFeatureDashboard />);
    const banner = screen.getByTestId('pof-cross-module-scope');
    expect(banner.textContent).toContain('owned by another project');
    expect(banner.textContent).toContain('165 rows');
  });
});

describe('UnifiedSummaryView scope disclosure', () => {
  beforeEach(() => {
    mockFetch({ body: { success: true, data: { totalSessions: 0 } } });
    setStatuses(OWN, []);
  });

  it.each(STATE_FIXTURES)('%s → banner shown: %s', async (state, scope, shows) => {
    setAggregates(scope, state === 'foreign' ? [] : [aggregate(MODULE, 6)]);
    render(<UnifiedSummaryView onNavigateTab={() => {}} />);
    await settle();
    const banner = screen.queryByTestId('pof-unified-summary-scope');
    expect(banner !== null).toBe(shows);
    if (banner) expect(banner.getAttribute('data-scope-state')).toBe(state);
  });

  it('qualifies the health composite when its matrix input is foreign-owned', async () => {
    setAggregates(FOREIGN_BLIND, []);
    render(<UnifiedSummaryView onNavigateTab={() => {}} />);
    await settle();
    const banner = screen.getByTestId('pof-unified-summary-scope');
    expect(banner.textContent).toContain('not unreviewed');
  });
});

describe('useNBA scope disclosure', () => {
  it('carries the scope report and the per-module row count', () => {
    setStatuses(FOREIGN_BLIND, [['arpg-combat::Other', 'implemented']]);
    const { result } = renderHook(() => useNBA(MODULE));
    expect(result.current.scope).toBe(FOREIGN_BLIND);
    // Rows of ANOTHER module do not count as this module being in view.
    expect(result.current.scopedRows).toBe(0);
  });

  it('counts this module’s own rows', () => {
    setStatuses(OWN, [['arpg-character::AARPGCharacterBase', 'implemented']]);
    const { result } = renderHook(() => useNBA(MODULE));
    expect(result.current.scopedRows).toBe(1);
  });
});

describe('RoadmapChecklist (NBA card) scope disclosure', () => {
  beforeEach(() => {
    mockFetch({ body: { success: true, data: {} } });
  });

  function renderChecklist() {
    return render(
      <RoadmapChecklist
        items={[{ id: 'x-1', label: 'Do a thing', description: 'd', prompt: 'p' }]}
        subModuleId={MODULE}
        onRunPrompt={() => {}}
        accentColor={ACCENT_EMERALD}
        isRunning={false}
      />,
    );
  }

  it.each(STATE_FIXTURES)('%s → banner shown: %s', (state, scope, shows) => {
    setStatuses(scope, state === 'foreign' ? [] : [['arpg-character::AARPGCharacterBase', 'implemented']]);
    renderChecklist();
    const banner = screen.queryByTestId('pof-nba-scope');
    expect(banner !== null).toBe(shows);
    if (banner) expect(banner.getAttribute('data-scope-state')).toBe(state);
  });

  it('qualifies the recommendation instead of presenting it as unconditioned advice', () => {
    setStatuses(FOREIGN_BLIND, []);
    renderChecklist();
    const banner = screen.getByTestId('pof-nba-scope');
    expect(banner.textContent).toContain('owned by another project');
  });
});

// ── One vocabulary, not five ─────────────────────────────────────────────────

describe('every surface says the SAME sentence', () => {
  beforeEach(() => {
    mockFetchRoutes([
      { match: '/api/judge-verdicts', response: { body: { success: true, data: [] } } },
      { match: /./, response: { body: { success: true, data: { history: {}, totalSessions: 0 } } } },
    ]);
  });

  it('renders one identical headline across the constellation, roll-ups and NBA card', async () => {
    const expected = describeMatrixScope(FOREIGN_BLIND, 0)!.headline;
    setStatuses(FOREIGN_BLIND, []);
    setAggregates(FOREIGN_BLIND, []);

    const seen: string[] = [];

    render(<FeatureConstellation />);
    seen.push(screen.getByTestId('pof-constellation-scope').querySelector('p')!.textContent!);
    cleanup();

    render(<AggregateQualityDashboard />);
    await settle();
    seen.push(screen.getByTestId('pof-aggregate-quality-scope').querySelector('p')!.textContent!);
    cleanup();

    render(<UnifiedSummaryView onNavigateTab={() => {}} />);
    await settle();
    seen.push(screen.getByTestId('pof-unified-summary-scope').querySelector('p')!.textContent!);
    cleanup();

    render(
      <RoadmapChecklist
        items={[{ id: 'x-1', label: 'Do a thing', description: 'd', prompt: 'p' }]}
        subModuleId={MODULE}
        onRunPrompt={() => {}}
        accentColor={ACCENT_EMERALD}
        isRunning={false}
      />,
    );
    seen.push(screen.getByTestId('pof-nba-scope').querySelector('p')!.textContent!);

    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toBe(expected);
  });
});
