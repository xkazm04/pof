import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'c1', name: 'Surface', lifecycle: 'planned', data: {} };
const STEP = 'LOD/Perf Budget';

/**
 * A bars chart descriptor with NO `rows` — the shape a half-written spec or a hand-edited
 * `pipeline_artifacts` row produces. `ViewPanel` reaches `view.rows.flatMap(...)` and throws,
 * which is exactly the class of failure that used to take the whole homepage down.
 */
const brokenViewSpec = {
  archetype: 'balance', label: STEP,
  view: { kind: 'chart', variant: 'bars', field: 'perfBudget' },
  produce: () => ({ data: { perfBudget: { instructionCount: 260, target: 200 } } }),
  // A genuine, concrete FAIL beside the crashing panel — the boundary must not eat it.
  accept: () => ({ label: 'Within budget', status: 'fail' as const, tier: 'L0', detail: '260 / 200 instr', reason: 'over the instruction cap' }),
} as unknown as StepSpec;

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  useLabPipelineStore.setState({
    byEntity: { c1: { [STEP]: { done: true, data: { perfBudget: { instructionCount: 260, target: 200 } }, ueAssets: [], at: '2026-08-17T10:00:00.000Z' } } },
  });
});
afterEach(() => { cleanup(); consoleError.mockRestore(); useLabPipelineStore.setState({ byEntity: {} }); });

describe('ArchetypeStep — a crashing View panel is contained inside the step', () => {
  it('replaces only the panel, and says what crashed and where to look', () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={brokenViewSpec} />);
    const note = screen.getByTestId('panel-crash-note');
    expect(note.getAttribute('data-crash-panel')).toBe('View');
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toContain('TypeError');
    expect(note.textContent).toContain('Raw artifact');
  });

  it('does NOT hide the step’s genuine acceptance fail', () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={brokenViewSpec} />);
    const banner = screen.getByTestId('acceptance-banner');
    expect(banner.getAttribute('data-status')).toBe('fail');
    expect(banner.textContent).toContain('over the instruction cap');
  });

  it('keeps the rest of the step usable — Produce and the Raw artifact window', () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={brokenViewSpec} />);
    expect(screen.getByTestId('cli-produce-run')).toBeTruthy();
    expect(screen.getByTestId('raw-artifact')).toBeTruthy();
  });
});
