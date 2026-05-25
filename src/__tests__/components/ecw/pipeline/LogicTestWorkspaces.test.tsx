import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LogicWorkspace } from '@/components/ecw/pipeline/workspaces/LogicWorkspace';
import { TestWorkspace } from '@/components/ecw/pipeline/workspaces/TestWorkspace';
import { registerFacet } from '@/components/ecw/inspector/facetRegistry';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

vi.mock('@/hooks/useEntityTrackHelp', () => ({ useEntityTrackHelp: () => ({ evaluate: vi.fn(), isRunning: false }) }));
vi.stubGlobal('fetch', vi.fn((..._a: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) })));

const FakeFacet = ({ entity }: { entity: StoredCatalogEntity }) => <div data-testid="fake-facet">facet:{entity.name}</div>;
registerFacet('test-logic-cat', { id: 'fake', label: 'Fake', Component: FakeFacet });

const entity: StoredCatalogEntity = {
  id: 'x', catalogId: 'test-logic-cat', name: 'Widget', categoryPath: [], tags: [], lifecycle: 'planned',
  data: { manaCost: 20 },
};

describe('LogicWorkspace', () => {
  beforeEach(() => usePipelineStore.setState({ tracksByEntity: {} }));
  afterEach(cleanup);

  it('renders the logic track state setters, the spec, and the catalog facets', () => {
    render(<LogicWorkspace entity={entity} trackId="logic" />);
    expect(screen.getByRole('button', { name: /^Done$/i })).toBeTruthy(); // PipelineTrackDetail
    expect(screen.getByTestId('fake-facet')).toBeTruthy();                 // absorbed facet
    expect(screen.getByText('Spec')).toBeTruthy();                          // spec panel label
  });
});

describe('TestWorkspace', () => {
  beforeEach(() => usePipelineStore.setState({ tracksByEntity: {} }));
  afterEach(cleanup);

  it('renders the test track state setters + the functional test panel', () => {
    render(<TestWorkspace entity={entity} trackId="test" />);
    expect(screen.getByRole('button', { name: /^Done$/i })).toBeTruthy();
    // EntityFunctionalTestPanel renders a functional-test affordance for the entity
    expect(screen.getAllByText(/functional test/i).length).toBeGreaterThan(0);
  });
});
