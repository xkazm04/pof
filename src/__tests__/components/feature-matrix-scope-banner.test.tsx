/**
 * The feature matrix must be able to say WHY it is empty.
 *
 * Project scoping returns `ownedRows` / `legacyRows` / `foreignRows` on every read,
 * but until the scope banner existed nothing rendered them — so a module whose rows
 * another project holds looked exactly like a module nothing has ever reviewed.
 * These tests pin the three states apart.
 *
 * Everything here is driven by FIXTURES, never by the live SQLite DB: attribution is
 * being backfilled centrally, so any assertion against real counts would be a
 * time-bomb rather than a test.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ProjectScopeReport } from '@/lib/feature-matrix-db';
import type { FeatureRow } from '@/types/feature-matrix';
import type { SubModuleId } from '@/types/modules';
import { mockFetch } from '@/__tests__/setup';
import { ACCENT_EMERALD } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const h = vi.hoisted(() => ({ useFeatureMatrix: vi.fn() }));
vi.mock('@/hooks/useFeatureMatrix', () => ({ useFeatureMatrix: h.useFeatureMatrix }));

import { FeatureMatrix } from '@/components/modules/shared/FeatureMatrix';
import { describeMatrixScope, shortProjectLabel } from '@/components/modules/shared/FeatureMatrix/matrixScope';

const PROJECT = 'c:/users/kazda/documents/unreal projects/pof';

function scopeFixture(over: Partial<ProjectScopeReport>): ProjectScopeReport {
  return {
    projectId: PROJECT,
    unscoped: false,
    moduleId: 'arpg-combat',
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

function row(name: string, over: Partial<FeatureRow> = {}): FeatureRow {
  return {
    id: 1,
    moduleId: 'arpg-combat' as SubModuleId,
    featureName: name,
    category: 'Core',
    status: 'implemented',
    description: 'd',
    filePaths: [],
    reviewNotes: '',
    qualityScore: 4,
    nextSteps: '',
    lastReviewedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

const OWN = scopeFixture({ totalRows: 6, ownedRows: 6 });
const LEGACY = scopeFixture({ totalRows: 6, legacyRows: 6 });
const MIXED = scopeFixture({ totalRows: 6, ownedRows: 4, legacyRows: 2 });
const FOREIGN_EMPTY = scopeFixture({ totalRows: 6, foreignRows: 6, distinctProjects: 2 });
const FOREIGN_PARTIAL = scopeFixture({ totalRows: 6, ownedRows: 4, foreignRows: 2, distinctProjects: 2 });

// ── pure classifier ──────────────────────────────────────────────────────────

describe('describeMatrixScope', () => {
  it('says nothing when the scope hid nothing', () => {
    const d = describeMatrixScope(OWN, 6)!;
    expect(d.state).toBe('own');
    expect(d.show).toBe(false);
  });

  it('returns null before the first successful fetch (no scope yet)', () => {
    expect(describeMatrixScope(null, 0)).toBeNull();
  });

  it('names legacy-only rows as unattributed, NOT as unreviewed', () => {
    const d = describeMatrixScope(LEGACY, 6)!;
    expect(d.state).toBe('legacy');
    expect(d.show).toBe(true);
    expect(d.headline).toContain('6 rows');
    expect(d.headline).toContain('unattributed legacy rows');
    // The load-bearing disclaimer: existing-but-unowned ≠ never reviewed.
    expect(d.headline).toContain('not the same as a module nothing has reviewed');
  });

  it('states the legacy case differently when no project is open at all', () => {
    const d = describeMatrixScope(scopeFixture({ projectId: '', unscoped: true, totalRows: 3, legacyRows: 3 }), 3)!;
    expect(d.state).toBe('legacy');
    expect(d.headline).toContain('No project is open');
  });

  it('reports a partly-attributed module as mixed, naming both counts', () => {
    const d = describeMatrixScope(MIXED, 6)!;
    expect(d.state).toBe('mixed');
    expect(d.headline).toContain('4 rows');
    expect(d.headline).toContain('2 rows');
  });

  it('escalates to `bad` when the view is empty ONLY because another project owns the rows', () => {
    const d = describeMatrixScope(FOREIGN_EMPTY, 0)!;
    expect(d.state).toBe('foreign');
    expect(d.level).toBe('bad');
    expect(d.headline).toContain('6 rows');
    expect(d.headline).toContain('not unreviewed');
  });

  it('keeps foreign rows a warning when some rows ARE visible', () => {
    const d = describeMatrixScope(FOREIGN_PARTIAL, 4)!;
    expect(d.state).toBe('foreign');
    expect(d.level).toBe('warn');
    expect(d.headline).toContain('2 rows');
  });

  it('foreign attribution outranks legacy — the strongest claim is the headline', () => {
    const d = describeMatrixScope(scopeFixture({ legacyRows: 3, foreignRows: 2 }), 3)!;
    expect(d.state).toBe('foreign');
  });

  it('quotes the report note verbatim rather than paraphrasing it', () => {
    expect(describeMatrixScope(LEGACY, 6)!.note).toBe(LEGACY.note);
  });

  it('shortens a normalized project path to its last segment', () => {
    expect(shortProjectLabel(PROJECT)).toBe('pof');
    expect(shortProjectLabel('')).toBe('');
  });

  it('singularizes a one-row count', () => {
    expect(describeMatrixScope(scopeFixture({ totalRows: 1, foreignRows: 1 }), 0)!.headline).toContain('1 row ');
  });
});

// ── rendered through the real FeatureMatrix ──────────────────────────────────

function matrixState(features: FeatureRow[], scope: ProjectScopeReport | null) {
  return {
    features,
    summary: {
      total: features.length,
      implemented: features.length,
      improved: 0,
      partial: 0,
      missing: 0,
      unknown: 0,
    },
    isLoading: false,
    error: null,
    retry: vi.fn(),
    refetch: vi.fn(),
    seed: vi.fn(),
    runAutoVerify: vi.fn(),
    isVerifying: false,
    verificationResults: [],
    scope,
  };
}

function renderMatrix(features: FeatureRow[], scope: ProjectScopeReport | null) {
  h.useFeatureMatrix.mockReturnValue(matrixState(features, scope));
  return render(
    <FeatureMatrix
      moduleId={'arpg-combat' as SubModuleId}
      accentColor={ACCENT_EMERALD}
      onReview={() => {}}
      isReviewing={false}
    />,
  );
}

describe('FeatureMatrix scope banner', () => {
  beforeEach(() => {
    mockFetch({ body: { success: true, data: { statuses: [], snapshots: [] } } });
  });

  it('own rows: no banner, because the scope excluded nothing', () => {
    renderMatrix([row('Hit Detection')], OWN);
    expect(screen.queryByTestId('pof-feature-matrix-scope')).toBeNull();
  });

  it('legacy only: banner says the rows are unattributed', () => {
    renderMatrix([row('Hit Detection')], LEGACY);
    const banner = screen.getByTestId('pof-feature-matrix-scope');
    expect(banner.getAttribute('data-scope-state')).toBe('legacy');
    expect(banner.textContent).toContain('unattributed legacy rows');
    expect(banner.textContent).toContain('6 rows');
  });

  it('foreign present + nothing visible: banner denies the empty state and names the count', () => {
    renderMatrix([], FOREIGN_EMPTY);
    const banner = screen.getByTestId('pof-feature-matrix-scope');
    expect(banner.getAttribute('data-scope-state')).toBe('foreign');
    expect(banner.textContent).toContain('not unreviewed');
    expect(banner.textContent).toContain('6 rows');
    expect(banner.textContent).toContain('owned by another project');
  });

  it('the three states render distinguishably — not one shared empty state', () => {
    const texts = new Set<string>();
    const states: string[] = [];
    for (const [features, scope] of [
      [[row('Hit Detection')], OWN],
      [[row('Hit Detection')], LEGACY],
      [[], FOREIGN_EMPTY],
    ] as [FeatureRow[], ProjectScopeReport][]) {
      renderMatrix(features, scope);
      const banner = screen.queryByTestId('pof-feature-matrix-scope');
      states.push(banner?.getAttribute('data-scope-state') ?? 'none');
      texts.add(banner?.textContent ?? '<no banner>');
      cleanup();
    }
    expect(states).toEqual(['none', 'legacy', 'foreign']);
    expect(texts.size).toBe(3);
  });

  it('shows the banner above the "No review yet" state, so seeded rows cannot claim the module is unreviewed', () => {
    renderMatrix([row('Hit Detection', { status: 'unknown', lastReviewedAt: null, qualityScore: null })], FOREIGN_PARTIAL);
    // The unreviewed empty state is still there…
    expect(screen.getByText('No review yet')).toBeTruthy();
    // …but it is now qualified by the scope disclosure.
    expect(screen.getByTestId('pof-feature-matrix-scope').getAttribute('data-scope-state')).toBe('foreign');
  });

  it('exposes the report note verbatim behind a disclosure rather than paraphrasing it', () => {
    renderMatrix([row('Hit Detection')], LEGACY);
    expect(screen.getByTestId('pof-feature-matrix-scope').textContent).toContain(LEGACY.note);
  });

  it('offers no claim/adopt action — attribution is an operator decision', () => {
    renderMatrix([], FOREIGN_EMPTY);
    const banner = screen.getByTestId('pof-feature-matrix-scope');
    expect(banner.querySelectorAll('button').length).toBe(0);
    expect(banner.textContent?.toLowerCase()).not.toContain('claim');
  });

  it('renders nothing at all when the hook has no scope yet', () => {
    renderMatrix([row('Hit Detection')], null);
    expect(screen.queryByTestId('pof-feature-matrix-scope')).toBeNull();
  });
});
