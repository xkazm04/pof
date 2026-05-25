import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OverviewWorkspace } from '@/components/ecw/inspector/OverviewWorkspace';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const entity: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute', categoryPath: ['Bestiary', 'Tank'],
  tags: ['Boss', 'Humanoid'], lifecycle: 'verified',
  ueAssets: ['/Script/PoF.BP_Brute'],
  links: [{ catalogId: 'loot-tables', entityId: 'lt-Brute', role: 'loot' }],
  data: { id: 'brute', damage: 40, manaCost: 20 },
};

describe('OverviewWorkspace', () => {
  afterEach(cleanup);

  it('renders tags, the data summary, and the cross-links + assets panels', () => {
    render(<OverviewWorkspace entity={entity} />);
    expect(screen.getByText('Boss')).toBeTruthy();          // tag chip
    expect(screen.getByText('damage')).toBeTruthy();         // summary field label
    expect(screen.getByText('40')).toBeTruthy();             // summary field value
    expect(screen.getByText(/Cross-links/i)).toBeTruthy();   // EntityCrossLinksPanel
    expect(screen.getByText('loot')).toBeTruthy();
    expect(screen.getByText('/Script/PoF.BP_Brute')).toBeTruthy(); // EntityLifecyclePanel assets
  });
});
