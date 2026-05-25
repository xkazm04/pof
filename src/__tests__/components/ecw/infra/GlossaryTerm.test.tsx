import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { GlossaryTerm } from '@/components/ecw/infra/GlossaryTerm';

describe('GlossaryTerm', () => {
  afterEach(cleanup);

  it('renders the term text', () => {
    render(<GlossaryTerm term="PWR" definition="Total power score across all stats" />);
    expect(screen.getByText('PWR')).toBeTruthy();
  });

  it('exposes the definition via title attribute (native browser tooltip)', () => {
    render(<GlossaryTerm term="UARPGLootTable" definition="The UE5 data-asset class for weighted loot tables" />);
    const el = screen.getByText('UARPGLootTable');
    expect(el.getAttribute('title')).toBe('The UE5 data-asset class for weighted loot tables');
  });

  it('uses aria-label so screen readers announce the definition', () => {
    render(<GlossaryTerm term="bIsPrefix" definition="UPROPERTY bool — true if the affix attaches to the front of the item name" />);
    const el = screen.getByText('bIsPrefix');
    expect(el.getAttribute('aria-label')).toContain('UPROPERTY bool');
  });

  it('marks the element with role=note for assistive tech', () => {
    render(<GlossaryTerm term="GAS" definition="Gameplay Ability System" />);
    expect(screen.getByText('GAS').getAttribute('role')).toBe('note');
  });
});
