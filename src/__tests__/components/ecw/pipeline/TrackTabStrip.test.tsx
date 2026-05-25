import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TrackTabStrip } from '@/components/ecw/pipeline/TrackTabStrip';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineForCatalog } from '@/lib/pipeline/tracks';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

vi.mock('@/hooks/useEntityTrackHelp', () => ({ useEntityTrackHelp: () => ({ evaluate: vi.fn(), isRunning: false }) }));
vi.stubGlobal('fetch', vi.fn((..._a: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) })));

const entity: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute', categoryPath: ['Bestiary'], tags: ['Boss'], lifecycle: 'planned',
  links: [{ catalogId: 'loot-tables', entityId: 'lt-Brute', role: 'loot' }],
  data: { id: 'brute', power: 9000 },
};

describe('TrackTabStrip', () => {
  beforeEach(() => usePipelineStore.setState({ tracksByEntity: {} }));
  afterEach(cleanup);

  it('renders an Overview tab + one tab per catalog track', () => {
    render(<TrackTabStrip entity={entity} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /overview/i })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(pipelineForCatalog('bestiary').length + 1); // + Overview
  });

  it('selects Overview by default and renders its content (cross-links + summary)', () => {
    render(<TrackTabStrip entity={entity} />);
    expect(screen.getByRole('tab', { name: /overview/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/Cross-links/i)).toBeTruthy();
    expect(screen.getByText('power')).toBeTruthy(); // summary field
    expect(screen.queryByRole('button', { name: /^Done$/i })).toBeNull(); // not a track workspace
  });

  it('clicking a track tab switches to its workspace; clicking Overview returns', () => {
    render(<TrackTabStrip entity={entity} />);
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[1]); // first production track (Overview is tabs[0])
    expect(screen.getByRole('button', { name: /^Done$/i })).toBeTruthy(); // track workspace rendered
    expect(screen.getByRole('tab', { name: /overview/i }).getAttribute('aria-selected')).toBe('false');

    fireEvent.click(screen.getByRole('tab', { name: /overview/i }));
    expect(screen.getByText(/Cross-links/i)).toBeTruthy();
  });
});
