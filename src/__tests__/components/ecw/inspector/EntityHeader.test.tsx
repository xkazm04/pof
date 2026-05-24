import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EntityHeader } from '@/components/ecw/inspector/EntityHeader';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

// Spy useGeneration so we can assert dispatch without booting the CLI session.
const { generate, useGenerationSpy } = vi.hoisted(() => ({
  generate: vi.fn(),
  useGenerationSpy: vi.fn(),
}));
vi.mock('@/hooks/useGeneration', () => ({
  useGeneration: (entity: unknown) => {
    useGenerationSpy(entity);
    return { generate, isRunning: false };
  },
}));

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

  it('renders a (Re)generate button labeled with the next step', () => {
    render(<EntityHeader entity={sample} />);
    // verified → loops back to author-python (the planned→author-python rung)
    expect(screen.getByRole('button', { name: /\(Re\)generate · author-python/i })).toBeTruthy();
  });

  it('chooses wire as next step from generated lifecycle', () => {
    render(<EntityHeader entity={{ ...sample, lifecycle: 'generated' }} />);
    expect(screen.getByRole('button', { name: /\(Re\)generate · wire/i })).toBeTruthy();
  });

  it('chooses verify as next step from wired lifecycle', () => {
    render(<EntityHeader entity={{ ...sample, lifecycle: 'wired' }} />);
    expect(screen.getByRole('button', { name: /\(Re\)generate · verify/i })).toBeTruthy();
  });

  it('clicking the button dispatches useGeneration.generate with the next step', () => {
    generate.mockClear();
    render(<EntityHeader entity={{ ...sample, lifecycle: 'wired' }} />);
    fireEvent.click(screen.getByRole('button', { name: /\(Re\)generate · verify/i }));
    expect(generate).toHaveBeenCalledWith('verify');
  });
});
