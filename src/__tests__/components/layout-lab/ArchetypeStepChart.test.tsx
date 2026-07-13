import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { withinPercent } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const t = LAB_THEMES[0];
const entity: LabEntity = { id: 'c1', name: 'Surface', lifecycle: 'planned', data: {} };

// A balance-archetype step that declares the `chart` view kind (bars) — mirrors the
// materials LOD/Perf Budget step: instruction count vs its target cap.
const spec: StepSpec = {
  archetype: 'balance', label: 'LOD/Perf Budget',
  view: {
    kind: 'chart', variant: 'bars', field: 'perfBudget',
    rows: [
      { key: 'instructionCount', label: 'Instructions', unit: 'instr' },
      { key: 'target', label: 'Budget cap', unit: 'instr' },
    ],
    highlightKey: 'instructionCount', max: 240,
  },
  produce: () => ({ data: { perfBudget: { instructionCount: 180, target: 200 }, instructionCount: 180 } }),
  accept: withinPercent('instructionCount', 'Within ±20% of target (200)', 200, 20),
};

describe('ArchetypeStep chart view', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  afterEach(cleanup);

  it('shows the no-data placeholder before Produce', () => {
    render(<ArchetypeStep t={t} entity={entity} step="LOD/Perf Budget" spec={spec} />);
    expect(screen.getByText(/No data yet/)).toBeTruthy();
    expect(screen.queryByRole('figure')).toBeNull();
  });

  it('renders a real ChartPanel bars figure from artifact data after Produce', () => {
    render(<ArchetypeStep t={t} entity={entity} step="LOD/Perf Budget" spec={spec} />);
    fireEvent.click(screen.getByRole('button', { name: /Produce LOD\/Perf Budget/ }));
    // ChartPanel bars renders role="figure" with one labelled bar row per spec row.
    const fig = screen.getByRole('figure', { name: /perfBudget budget/ });
    expect(fig).toBeTruthy();
    expect(fig.textContent).toContain('Instructions');
    expect(fig.textContent).toContain('180instr');
    expect(fig.textContent).toContain('Budget cap');
    expect(fig.textContent).toContain('200instr');
    // acceptance derives from the top-level field, unchanged by the view swap.
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
  });

  it('names an unsupported view kind instead of silently showing a gallery count', () => {
    // A spec with an unknown view kind must render an honest placeholder.
    const bad = { ...spec, view: { kind: 'bogus', field: 'x' } } as unknown as StepSpec;
    render(<ArchetypeStep t={t} entity={entity} step="LOD/Perf Budget" spec={bad} />);
    expect(screen.getByText(/Unsupported view kind: bogus/)).toBeTruthy();
  });
});
