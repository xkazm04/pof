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
import { TravelProgressionGroup } from '@/components/modules/core-engine/sub_world/travel/TravelProgressionGroup';

afterEach(cleanup);

describe('world module control names', () => {
  it('the player level slider has an accessible name', () => {
    render(<ZoneMap moduleId="arpg-world" />);
    expect(screen.getByRole('slider', { name: 'Player level filter' })).toBeTruthy();
  });
  it('both zone comparison selects are named and keep a focus indicator', () => {
    render(<TravelProgressionGroup />);
    for (const name of ['Zone A', 'Zone B']) {
      const select = screen.getByRole('combobox', { name });
      expect(select.className).toContain('focus-ring');
      expect(select.className).not.toContain('focus:outline-none');
    }
  });
});
