import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EntityInspector } from '@/components/ecw/inspector/EntityInspector';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

vi.mock('@/hooks/useEntityTrackHelp', () => ({ useEntityTrackHelp: () => ({ evaluate: vi.fn(), isRunning: false }) }));
vi.stubGlobal('fetch', vi.fn((..._a: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) })));

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

  it('renders header + the Overview tab (metadata/assets/cross-links) by default', () => {
    render(<EntityInspector entity={sample} />);
    // Header
    expect(screen.getByRole('heading', { level: 2, name: /Brute/ })).toBeTruthy();
    // Entity-views tab strip with Overview selected by default
    expect(screen.getByRole('tablist', { name: /entity views/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /overview/i }).getAttribute('aria-selected')).toBe('true');
    // Overview content: lifecycle + UE assets + cross-links + raw spec
    expect(screen.getByText(/Lifecycle/i)).toBeTruthy();
    expect(screen.getByText('/Script/PoF.BP_Brute')).toBeTruthy();
    expect(screen.getByText(/Cross-links/i)).toBeTruthy();
    expect(screen.getByText('loot')).toBeTruthy();
    expect(screen.getByText(/"power"/)).toBeTruthy();
  });

  it('switching to the Test track shows the functional test panel', () => {
    render(<EntityInspector entity={sample} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Test/i }));
    expect(screen.getByText(/VSEnemyAttackTest/)).toBeTruthy();
  });
});
