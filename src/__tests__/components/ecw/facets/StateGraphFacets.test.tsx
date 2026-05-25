import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MontageAnalysisFacet } from '@/components/ecw/facets/state-graph/MontageAnalysisFacet';
import { MontageBaselineFacet } from '@/components/ecw/facets/state-graph/MontageBaselineFacet';
import { MontageAuthorFacet } from '@/components/ecw/facets/state-graph/MontageAuthorFacet';
import { useCatalogStore } from '@/stores/catalogStore';
import { useBaselineStore } from '@/stores/baselineStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({ useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }) }));

function montageEntity(id: string, category: string, memorySizeMB: number, hasRootMotion = true): CatalogEntityBase {
  return {
    id, catalogId: 'state-graph', name: id, categoryPath: ['Animations', category], tags: [], lifecycle: 'planned',
    data: { id, name: id, category, totalFrames: 30, fps: 30, memorySizeMB, hasRootMotion, blendInTime: 0.05 },
  } as CatalogEntityBase;
}

function seed(entities: CatalogEntityBase[]) {
  const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
  for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
  for (const e of entities) seeded['state-graph'][e.id] = e;
  useCatalogStore.setState({ entitiesByCatalog: seeded });
}

describe('MontageAnalysisFacet', () => {
  beforeEach(() => seed([]));
  afterEach(cleanup);

  it('renders duration + memory and a clean result for a normal montage', () => {
    const e = montageEntity('AM_Combo1', 'Attack', 1.2);
    seed([e, montageEntity('b', 'Attack', 1.3), montageEntity('c', 'Attack', 1.4)]);
    render(<MontageAnalysisFacet entity={e} />);
    expect(screen.getByText(/Montage Analysis/i)).toBeTruthy();
    expect(screen.getByText(/1\.00s · 1\.2 MB/)).toBeTruthy();
  });

  it('warns when an attack montage lacks root motion', () => {
    const e = montageEntity('AM_NoRoot', 'Attack', 1.2, false);
    seed([e]);
    render(<MontageAnalysisFacet entity={e} />);
    expect(screen.getByText(/root motion/i)).toBeTruthy();
  });
});

describe('MontageBaselineFacet', () => {
  beforeEach(() => {
    useBaselineStore.setState({ baselineByEntity: {} });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true, data: null }) })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('prompts to capture a memory baseline', () => {
    render(<MontageBaselineFacet entity={montageEntity('AM_Combo1', 'Attack', 1.2)} />);
    expect(screen.getByText(/Memory Baseline/i)).toBeTruthy();
    expect(screen.getByText(/No baseline captured/i)).toBeTruthy();
  });
});

describe('MontageAuthorFacet', () => {
  beforeEach(() => execute.mockClear());
  afterEach(cleanup);

  it('dispatches a quick-action carrying the montage name + instruction', () => {
    render(<MontageAuthorFacet entity={montageEntity('AM_Combo1', 'Attack', 1.2)} />);
    fireEvent.change(screen.getByPlaceholderText(/recovery window/i), { target: { value: 'shorten wind-up' } });
    fireEvent.click(screen.getByRole('button', { name: /author montage with claude/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.prompt).toContain('AM_Combo1');
    expect(task.prompt).toContain('shorten wind-up');
  });
});
