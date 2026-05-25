import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TrackTabStrip } from '@/components/ecw/pipeline/TrackTabStrip';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineForCatalog } from '@/lib/pipeline/tracks';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

vi.mock('@/hooks/useEntityTrackHelp', () => ({ useEntityTrackHelp: () => ({ evaluate: vi.fn(), isRunning: false }) }));
vi.stubGlobal('fetch', vi.fn((..._a: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) })));

const entity: StoredCatalogEntity = { id: 'brute', catalogId: 'bestiary', name: 'Brute', categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned' };

describe('TrackTabStrip', () => {
  beforeEach(() => usePipelineStore.setState({ tracksByEntity: {} }));
  afterEach(cleanup);

  it('renders one tab per catalog track in a tablist', () => {
    render(<TrackTabStrip entity={entity} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(pipelineForCatalog('bestiary').length);
  });

  it('selects the first track by default and renders its workspace (state setters)', () => {
    render(<TrackTabStrip entity={entity} />);
    expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: /^Done$/i })).toBeTruthy(); // a workspace rendered
  });

  it('clicking a different tab moves selection', () => {
    render(<TrackTabStrip entity={entity} />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[tabs.length - 1]);
    expect(tabs[tabs.length - 1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });
});
