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

/**
 * A step renderer that throws exactly the way a malformed artifact makes one throw
 * (`data.x.map` on a row another session wrote). `mode` stands in for the state of the
 * stored artifact: 'always' = still broken, 'never' = repaired (adopted / re-produced).
 * It is never a first-render-only trick — React 19 retries a failed concurrent render
 * synchronously, so a one-shot throw would recover before the boundary was ever needed.
 */
let mode: 'always' | 'never' = 'always';
function BoomStep() {
  if (mode === 'always') {
    throw new Error('Cannot read properties of undefined (reading "map")');
  }
  return <div data-testid="step-ok">step rendered</div>;
}
vi.mock('@/components/layout-lab/steps', () => ({ getStepComponent: () => BoomStep }));

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';

const groups = [{ category: 'Core', catalogs: [{ catalogId: 'items', label: 'Items', description: '', verified: 0, total: 1 }] }];
const detail = {
  catalog: { catalogId: 'items', label: 'Items', description: 'Items', total: 1, verified: 0 },
  entities: [{ id: 'item-1', name: 'Sword', lifecycle: 'planned' as const, data: {} }],
  steps: ['Concept Brief', 'Economy'],
};

const renderBaseline = () =>
  render(<Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="item-1" onSelectEntity={() => {}} />);

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mode = 'always';
  // React reports every boundary-caught error through console.error; the crash itself is
  // the point of these tests, so keep the run readable without hiding real failures.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  useLabPipelineStore.setState({
    byEntity: {
      'item-1': {
        'Concept Brief': {
          done: true,
          data: { brief: 'a longsword', sectors: 'not-an-array' },
          ueAssets: ['/Game/Items/Sword'],
          at: '2026-08-17T10:00:00.000Z',
          status: 'pass',
          tier: 'L0',
        },
      },
    },
  });
});
afterEach(() => {
  cleanup();
  consoleError.mockRestore();
  useLabPipelineStore.setState({ byEntity: {} });
});

/**
 * The `/layout` lab IS the homepage, and step `data` is `unknown` hydrated straight from
 * SQLite — written by other sessions, the MCP submit path and headless drains. One throw
 * in one of ~350 step renderers used to take the whole application shell down with it.
 */
describe('Baseline — a crashing step is contained, not fatal', () => {
  it('renders a failure card that NAMES the step and its catalog/entity', () => {
    renderBaseline();
    const card = screen.getByTestId('step-crash-card');
    expect(card.getAttribute('data-crash-step')).toBe('Concept Brief');
    expect(card.textContent).toContain('Concept Brief');
    expect(card.textContent).toContain('Items');
    expect(card.textContent).toContain('Sword');
    // The real reason, verbatim — never a generic "something went wrong".
    expect(card.textContent).toContain('Cannot read properties of undefined');
  });

  it('keeps the rest of the lab mounted and interactive', () => {
    renderBaseline();
    // Header, catalog tree and pipeline rail all survive the crash…
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sword');
    expect(screen.getByTestId('harness-catalog-items')).toBeTruthy();
    expect(screen.getByTestId('step-dot-stamp-0')).toBeTruthy();
    // …and the rail still navigates: picking the next step re-scopes the containment.
    fireEvent.click(screen.getByTestId('step-dot-stamp-1'));
    expect(screen.getByTestId('step-crash-card').getAttribute('data-crash-step')).toBe('Economy');
  });

  it('stays loud: the card says a crash is NOT an acceptance verdict', () => {
    renderBaseline();
    const card = screen.getByTestId('step-crash-card');
    expect(card.getAttribute('role')).toBe('alert');
    expect(screen.getByTestId('step-crash-not-a-verdict').textContent).toContain('not an acceptance verdict');
    expect(card.textContent).toContain('unknown');
    // No acceptance banner is fabricated in its place (that is the silent-empty-panel lie).
    expect(screen.queryByTestId('acceptance-banner')).toBeNull();
  });

  it('exposes the offending artifact verbatim through the shared RawArtifactDisclosure', () => {
    renderBaseline();
    const card = screen.getByTestId('step-crash-card');
    const summary = card.querySelector('[data-testid="raw-artifact-summary"]')!;
    fireEvent.click(summary);
    const json = screen.getByTestId('raw-artifact-json').textContent ?? '';
    expect(json).toContain('a longsword');
    expect(json).toContain('not-an-array');
    expect(json).toContain('/Game/Items/Sword');
  });

  it('offers a re-render escape that remounts the step once its data is repaired', () => {
    renderBaseline();
    expect(screen.getByTestId('step-crash-card')).toBeTruthy();
    mode = 'never'; // the artifact was repaired (adopted / re-produced) behind the card
    fireEvent.click(screen.getByTestId('step-crash-retry'));
    expect(screen.queryByTestId('step-crash-card')).toBeNull();
    expect(screen.getByTestId('step-ok')).toBeTruthy();
  });

  it('re-rendering a still-broken step says so instead of looping quietly', () => {
    renderBaseline();
    fireEvent.click(screen.getByTestId('step-crash-retry'));
    const card = screen.getByTestId('step-crash-card');
    expect(card.textContent).toContain('re-rendered 1×');
    expect(card.textContent).toContain('the stored artifact is the problem');
  });

  it('reports that "adopt server truth" changed nothing when the server holds no row', () => {
    renderBaseline();
    fireEvent.click(screen.getByTestId('step-crash-adopt'));
    const outcome = screen.getByTestId('step-crash-adopt-outcome');
    expect(outcome.textContent).toContain('the server holds no artifact for this step');
    // The card must NOT clear on a no-op — a click that fixed nothing cannot look like a fix.
    expect(screen.getByTestId('step-crash-card')).toBeTruthy();
  });

  it('is invisible when the step renders fine', () => {
    mode = 'never';
    renderBaseline();
    expect(screen.queryByTestId('step-crash-card')).toBeNull();
    expect(screen.getByTestId('step-ok')).toBeTruthy();
  });
});
