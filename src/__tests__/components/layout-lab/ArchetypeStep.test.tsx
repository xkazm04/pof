import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { minLength } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';

const t = LAB_THEMES[0];
const entity = { id: 'e1', name: 'Sword', lifecycle: 'planned' as const, data: {} };
const spec: StepSpec = {
  archetype: 'brief', label: 'Concept Brief',
  view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
  produce: (e) => ({ data: { brief: `${e.name} `.repeat(120) } }),
  accept: minLength('brief', 'Brief ≥ 300 chars', 300),
};

describe('ArchetypeStep', () => {
  afterEach(cleanup);
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });

  it('renders empty state + pending, then persists + passes on Produce', () => {
    render(<ArchetypeStep t={t} entity={entity} step="Concept Brief" spec={spec} />);
    expect(screen.getByText('No brief yet')).toBeTruthy();
    fireEvent.click(screen.getByText(/Generate/));
    expect(screen.queryByText('No brief yet')).toBeNull();
    expect(screen.getAllByText(/PASS/).length).toBeGreaterThan(0);
  });
});
