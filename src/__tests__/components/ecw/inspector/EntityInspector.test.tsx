import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EntityInspector } from '@/components/ecw/inspector/EntityInspector';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const sample: StoredCatalogEntity = {
  id: 'brute',
  catalogId: 'bestiary',
  name: 'Brute',
  categoryPath: ['Bestiary', 'Tank'],
  tags: [],
  lifecycle: 'verified',
  ueAssets: ['/Script/PoF.BP_Brute'],
  lastTestResult: 'pass',
  lastVerifiedAt: '2026-05-24T12:39:00Z',
  links: [{ catalogId: 'loot-tables', entityId: 'lt-Brute', role: 'loot' }],
  data: { id: 'brute', label: 'Brute', power: 9000 },
};

describe('EntityInspector', () => {
  afterEach(cleanup);

  it('renders empty state when no entity', () => {
    render(<EntityInspector entity={null} />);
    expect(screen.getByText(/Select an entity from a catalog/i)).toBeTruthy();
  });

  it('renders all 5 generic panels + facets strip when entity present', () => {
    render(<EntityInspector entity={sample} />);
    // Header
    expect(screen.getByRole('heading', { level: 2, name: /Brute/ })).toBeTruthy();
    // Spec (open by default)
    expect(screen.getByText(/"power"/)).toBeTruthy();
    // Lifecycle & UE Assets
    expect(screen.getByText(/Lifecycle/i)).toBeTruthy();
    expect(screen.getByText('/Script/PoF.BP_Brute')).toBeTruthy();
    // Cross-links
    expect(screen.getByText(/Cross-links/i)).toBeTruthy();
    expect(screen.getByText('loot')).toBeTruthy();
    // Functional Test (bestiary recipe testPath)
    expect(screen.getByText(/VSEnemyAttackTest/)).toBeTruthy();
    // Facets strip: bestiary catalog has the Detail facet registered (Phase 7)
    expect(screen.getByRole('tab', { name: /Detail/ })).toBeTruthy();
  });
});
