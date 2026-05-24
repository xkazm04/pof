import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EntityHeader } from '@/components/ecw/inspector/EntityHeader';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const sample: StoredCatalogEntity = {
  id: 'ga-fireball',
  catalogId: 'spellbook',
  name: 'Fireball',
  categoryPath: ['Offensive', 'Fire'],
  tags: ['basic'],
  lifecycle: 'verified',
  data: undefined,
};

describe('EntityHeader', () => {
  afterEach(cleanup);

  it('renders the entity name as a heading', () => {
    render(<EntityHeader entity={sample} />);
    expect(screen.getByRole('heading', { level: 2, name: /Fireball/ })).toBeTruthy();
  });

  it('renders the categoryPath breadcrumb', () => {
    render(<EntityHeader entity={sample} />);
    expect(screen.getByText('Offensive')).toBeTruthy();
    expect(screen.getByText('Fire')).toBeTruthy();
  });

  it('renders the lifecycle badge text', () => {
    render(<EntityHeader entity={sample} />);
    // LifecycleBadge renders the state text "verified" inside its span.
    expect(screen.getByText(/verified/i)).toBeTruthy();
  });
});
