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

  it('renders ROW mode as a real multi-column table with a header and row labels', () => {
    render(
      <DataTable
        t={t}
        columns={[{ key: 'tier' }, { key: 'minPoints', label: 'min' }]}
        rows={[{ label: 'a', values: { tier: 'Neutral', minPoints: 0 } }, { label: 'b', values: { tier: 'Friendly', minPoints: 3000 } }]}
      />,
    );
    // Column keys become the header, not one row per column.
    expect(screen.getByText('tier')).toBeTruthy();
    expect(screen.getByText('min')).toBeTruthy();
    expect(screen.getByText('Neutral')).toBeTruthy();
    expect(screen.getByText('3000')).toBeTruthy();
    // Group keys render as row labels.
    expect(screen.getByText('a')).toBeTruthy();
  });

  it('formats list and record cells instead of printing [object Object]', () => {
    render(
      <DataTable t={t} columns={[{ key: 'tags' }, { key: 'payload' }]}
        rows={[{ values: { tags: ['x', 'y'], payload: { level: 'int' } } }]} />,
    );
    expect(screen.getByText('x · y')).toBeTruthy();
    expect(screen.getByText('{"level":"int"}')).toBeTruthy();
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

  it('renders a LIST-shaped produce as rows (what used to be a column of "— missing")', () => {
    const listSpec: StepSpec = {
      archetype: 'rules', label: 'Rep Tiers',
      view: { kind: 'table', field: 'tiers', columns: [{ key: 'tier' }, { key: 'minPoints' }] },
      produce: () => ({ data: { tiers: [{ tier: 'Neutral', minPoints: 0 }, { tier: 'Friendly', minPoints: 3000 }] } }),
      accept: minLength('tiers', 'Tiers set', 1),
    };
    render(<ArchetypeStep t={t} entity={entity} step="Rep Tiers" spec={listSpec} />);
    fireEvent.click(screen.getByRole('button', { name: /Produce Rep Tiers/ }));
    expect(screen.getByText('Friendly')).toBeTruthy();
    expect(screen.queryByText('— missing')).toBeNull();
  });

  it('follows rowsKey into a nested row container', () => {
    const nested: StepSpec = {
      archetype: 'rules', label: 'Hazards',
      view: { kind: 'table', field: 'hazards', rowsKey: 'hazardList', columns: [{ key: 'kind' }, { key: 'ge' }] },
      produce: () => ({ data: { hazards: { hazardList: [{ kind: 'fire-floor', ge: 'GE_Hazard_FireFloor' }] } } }),
      accept: minLength('hazards', 'Hazards set', 1),
    };
    render(<ArchetypeStep t={t} entity={entity} step="Hazards" spec={nested} />);
    fireEvent.click(screen.getByRole('button', { name: /Produce Hazards/ }));
    expect(screen.getByText('fire-floor')).toBeTruthy();
  });

  it('names a shape mismatch instead of rendering blank cells', () => {
    const bad: StepSpec = {
      archetype: 'rules', label: 'Bad Table',
      view: { kind: 'table', field: 'rows', columns: [{ key: 'a' }] },
      produce: () => ({ data: { rows: ['just', 'strings'] } }),
      accept: minLength('rows', 'Rows set', 1),
    };
    render(<ArchetypeStep t={t} entity={entity} step="Bad Table" spec={bad} />);
    fireEvent.click(screen.getByRole('button', { name: /Produce Bad Table/ }));
    expect(screen.getByTestId('view-shape-mismatch')).toBeTruthy();
    expect(screen.queryByText('— missing')).toBeNull();
  });
});
