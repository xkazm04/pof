import { describe, it, expect, afterEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/hooks/useTabFeatures', () => ({
  useTabFeatures: () => ({ featureMap: new Map(), stats: { total: 0, implemented: 0, partial: 0, missing: 0 }, defs: [], features: [], isLoading: false }),
}));
vi.mock('@/stores/catalogStore', () => ({ useCatalogEntities: () => [] }));
vi.mock('@/hooks/useGeneration', () => ({ useGeneration: () => ({ generate: vi.fn(), nextStep: null, isRunning: false }) }));
vi.mock('@/hooks/useCRUD', () => ({ useCRUD: () => ({ data: [], mutate: vi.fn(), mutationError: null, clearMutationError: vi.fn() }) }));
vi.mock('@/components/modules/core-engine/unique-tabs/FeatureMapTab', () => ({ default: () => null }));
vi.mock('@/components/modules/core-engine/unique-tabs/VisibleSection', () => ({ VisibleSection: ({ children }: { children: ReactNode }) => children }));

import { ZoneMap } from '@/components/modules/core-engine/sub_world';

afterEach(cleanup);

describe('Map and Topology group badge', () => {
  it('counts the panels the group renders', () => {
    render(<ZoneMap moduleId="arpg-world" />);
    const header = screen.getByRole('button', { name: /Map & Topology/ });
    expect(header.textContent).toContain('6');
    // World map, partition flow, region details, environment tech, topology, generator.
    expect(screen.getByText('World Partition Flow')).toBeTruthy();
    expect(screen.getByText('Procedural Zone Generator')).toBeTruthy();
  });
});
