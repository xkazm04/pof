/**
 * The derive-side twin of `Baseline.stepCrash.test.tsx`.
 *
 * That suite proves a step RENDERER that throws is contained by `StepCrashBoundary`. This one
 * proves the case the boundary structurally cannot help with: an Acceptance CHECKER that
 * throws while `useBaseline` derives the entity's artifacts — before any component renders.
 * Without the guard in `gradeStepGuarded` this render throws straight past every boundary in
 * the lab and is caught only by `src/app/error.tsx`, which replaces the entire app shell.
 *
 * So the assertions are: the canvas is still there, the rail still navigates, and the one
 * step whose grade could not be computed reads as such — never as a pass.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([]),
  fetchArtifactsResult: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  postArtifact: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  drainGates: vi.fn().mockResolvedValue(null),
  deleteEntityArtifacts: vi.fn().mockResolvedValue({ ok: true, data: 0 }),
}));

// The step renderer is not what is under test here — keep it trivial so the ONLY throw in
// the run comes from the checker during derivation.
vi.mock('@/components/layout-lab/steps', () => ({
  getStepComponent: () => function OkStep() { return <div data-testid="step-ok">step rendered</div>; },
}));

import { registerCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { UNGRADED_PREFIX } from '@/components/layout-lab/hooks/useEntityArtifacts';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const CATALOG = 'ungraded-lab';
const BOOM_MESSAGE = 'data.rows.map is not a function';

const spec = (label: string, accept: StepSpec['accept']): StepSpec => ({
  archetype: 'brief',
  label,
  view: { kind: 'prose', field: 'brief', emptyText: 'Nothing yet' },
  produce: () => ({ data: {} }),
  accept,
});

registerCatalogPipeline({
  catalogId: CATALOG,
  steps: [
    spec('Boom', (data) => {
      (data.rows as string[]).map((r) => r);
      return { label: 'Boom', status: 'pass', tier: 'L0', detail: '' };
    }),
    spec('Fine', () => ({ label: 'Fine', status: 'pass', tier: 'L0', detail: 'ok' })),
  ],
  packagingExempt: 'test fixture — never packaged',
});

const groups = [{ category: 'Core', catalogs: [{ catalogId: CATALOG, label: 'Probe', description: '', verified: 0, total: 1 }] }];
const detail = {
  catalog: { catalogId: CATALOG, label: 'Probe', description: 'Probe', total: 1, verified: 0 },
  entities: [{ id: 'e1', name: 'Sword', lifecycle: 'planned' as const, data: {} }],
  steps: ['Boom', 'Fine'],
};

const renderBaseline = () =>
  render(<Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="e1" onSelectEntity={() => {}} />);

const railStatuses = () =>
  [...document.querySelectorAll('[data-step-status]')].map((el) => el.getAttribute('data-step-status'));

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  useLabPipelineStore.setState({
    byEntity: {
      e1: {
        // A row another session wrote: `rows` is a string where the checker assumed an array.
        Boom: { done: true, data: { rows: 'not-an-array' }, ueAssets: ['/Game/Probe/Boom'], at: '2026-08-18T10:00:00.000Z', status: 'pass', tier: 'L0' },
        Fine: { done: true, data: { brief: 'ok' }, ueAssets: [], at: '2026-08-18T10:00:00.000Z', status: 'pass', tier: 'L0' },
      },
    },
  });
});
afterEach(() => {
  cleanup();
  consoleError.mockRestore();
  useLabPipelineStore.setState({ byEntity: {} });
});

describe('Baseline — a checker that throws during derivation cannot take down the canvas', () => {
  it('renders the entity shell instead of escalating to the app-level error page', () => {
    expect(() => renderBaseline()).not.toThrow();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sword');
    expect(screen.getByTestId(`harness-catalog-${CATALOG}`)).toBeTruthy();
    expect(screen.getByTestId('step-ok')).toBeTruthy();
  });

  it('degrades only the throwing step; the sibling still reads its real verdict', () => {
    renderBaseline();
    expect(railStatuses()).toEqual(['fail', 'pass']);
  });

  it('never reads as a pass, and the rail still navigates past it', () => {
    renderBaseline();
    expect(railStatuses()[0]).not.toBe('pass');
    fireEvent.click(screen.getByTestId('step-dot-stamp-1'));
    expect(screen.getByTestId('step-ok')).toBeTruthy();
  });

  it('surfaces the UNGRADED reason on the step itself, naming the thrown message', () => {
    renderBaseline();
    // The rail's own tooltip carries the derived artifact's `reason` verbatim, so the user
    // reads WHY the step has no grade rather than an unexplained red dot.
    const titles = [...document.querySelectorAll('button[title]')].map((el) => el.getAttribute('title') ?? '');
    const ungraded = titles.find((t) => t.includes(UNGRADED_PREFIX));
    expect(ungraded).toBeTruthy();
    expect(ungraded).toContain(BOOM_MESSAGE);
    expect(ungraded).toContain('not a verdict');
  });

  it('reports the throw rather than swallowing it', () => {
    renderBaseline();
    const logged = consoleError.mock.calls.flat().map(String).join(' ');
    expect(logged).toContain(CATALOG);
    expect(logged).toContain('Boom');
  });
});
