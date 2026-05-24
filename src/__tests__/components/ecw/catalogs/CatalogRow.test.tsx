import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CatalogRow } from '@/components/ecw/catalogs/CatalogRow';

describe('CatalogRow', () => {
  afterEach(cleanup);

  it('renders label + counts', () => {
    render(<CatalogRow catalogId="spellbook" label="Spellbook" total={62} verified={24} failingCount={0} onSelect={() => {}} />);
    expect(screen.getByText('Spellbook')).toBeTruthy();
    expect(screen.getByText(/62 entries/)).toBeTruthy();
    expect(screen.getByText(/24 verified/)).toBeTruthy();
  });

  it('progress bar width reflects verified/total ratio', () => {
    render(<CatalogRow catalogId="items" label="Items" total={100} verified={25} failingCount={0} onSelect={() => {}} />);
    const bar = screen.getByTestId('catalog-row-progress-fill');
    expect(bar.style.width).toBe('25%');
  });

  it('shows failing badge when failingCount > 0', () => {
    render(<CatalogRow catalogId="loot-tables" label="Loot Tables" total={18} verified={14} failingCount={1} onSelect={() => {}} />);
    expect(screen.getByText(/1 failing/i)).toBeTruthy();
  });

  it('hides failing badge when failingCount == 0', () => {
    render(<CatalogRow catalogId="bestiary" label="Bestiary" total={12} verified={2} failingCount={0} onSelect={() => {}} />);
    expect(screen.queryByText(/failing/i)).toBeNull();
  });

  it('invokes onSelect with catalogId on click', () => {
    const onSelect = vi.fn();
    render(<CatalogRow catalogId="bestiary" label="Bestiary" total={12} verified={2} failingCount={0} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Bestiary/ }));
    expect(onSelect).toHaveBeenCalledWith('bestiary');
  });
});
