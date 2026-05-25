import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScreenFlowDetailFacet } from '@/components/ecw/facets/screen-flow/ScreenFlowDetailFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const sample: StoredCatalogEntity = {
  id: 'screen-hud', catalogId: 'screen-flow', name: 'Main HUD',
  categoryPath: ['Screens', 'HUD'], tags: ['HUD'], lifecycle: 'planned',
  data: { id: 'hud-main', label: 'Main HUD', group: 'HUD' },
};

describe('ScreenFlowDetailFacet', () => {
  afterEach(cleanup);

  it('renders the screen label + group', () => {
    render(<ScreenFlowDetailFacet entity={sample} />);
    expect(screen.getByText('Main HUD')).toBeTruthy();
    // The group chip renders the exact group string "HUD"; the label "Main HUD"
    // also matches /HUD/ so we have to be precise to avoid a multi-match.
    expect(screen.getByText(/^HUD$/)).toBeTruthy();
  });

  it('shows fallback when no group', () => {
    render(<ScreenFlowDetailFacet entity={{ ...sample, data: { id: 'x', label: 'X' } }} />);
    expect(screen.getByText(/uncategorized/i)).toBeTruthy();
  });

  it('shows empty-data fallback', () => {
    render(<ScreenFlowDetailFacet entity={{ ...sample, data: undefined }} />);
    expect(screen.getByText(/no screen data/i)).toBeTruthy();
  });
});
