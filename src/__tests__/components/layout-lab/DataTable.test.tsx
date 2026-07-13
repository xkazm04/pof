import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { DataTable } from '@/components/layout-lab/steps/shared/DataTable';
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { minLength } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const t = LAB_THEMES[0];

describe('DataTable', () => {
  afterEach(cleanup);

  it('renders one row per column with label, unit, and header', () => {
    render(
      <DataTable
        t={t}
        columns={[{ key: 'Damage', unit: 'hp' }, { key: 'Range', label: 'Reach', unit: 'm' }]}
        values={{ Damage: 34, Range: 1.8 }}
        header={['Attribute', 'Value']}
      />,
    );
    expect(screen.getByText('Attribute')).toBeTruthy();
    expect(screen.getByText('Damage')).toBeTruthy();
    expect(screen.getByText('34 hp')).toBeTruthy();
    // label override + unit
    expect(screen.getByText('Reach')).toBeTruthy();
    expect(screen.getByText('1.8 m')).toBeTruthy();
  });

  it('flags a missing value with the missing text', () => {
    render(<DataTable t={t} columns={[{ key: 'Weight', unit: 'kg' }]} values={{}} />);
    expect(screen.getByText('— missing')).toBeTruthy();
  });
});

// The generic `table` view is now backed by DataTable — assert an ArchetypeStep table
// spec renders its persisted values through it (adoption proof).
describe('ArchetypeStep table view via DataTable', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  afterEach(cleanup);

  const entity: LabEntity = { id: 'tt1', name: 'Gold', lifecycle: 'planned', data: {} };
  const spec: StepSpec = {
    archetype: 'rules', label: 'Wallet UI',
    view: { kind: 'table', field: 'ui', columns: [{ key: 'widget' }, { key: 'format' }] },
    produce: () => ({ data: { ui: { widget: 'W_Wallet', format: '1,234' } } }),
    accept: minLength('widget', 'Widget set', 1),
  };

  it('renders the persisted table cells after Produce', () => {
    render(<ArchetypeStep t={t} entity={entity} step="Wallet UI" spec={spec} />);
    fireEvent.click(screen.getByRole('button', { name: /Produce Wallet UI/ }));
    expect(screen.getByText('widget')).toBeTruthy();
    expect(screen.getByText('W_Wallet')).toBeTruthy();
    expect(screen.getByText('1,234')).toBeTruthy();
  });
});
