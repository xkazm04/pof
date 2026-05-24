import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EntityLifecyclePanel } from '@/components/ecw/inspector/EntityLifecyclePanel';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const base: StoredCatalogEntity = {
  id: 'ga-fireball', catalogId: 'spellbook', name: 'Fireball',
  categoryPath: ['Offensive', 'Fire'], tags: [], lifecycle: 'verified',
};

describe('EntityLifecyclePanel', () => {
  afterEach(cleanup);

  it('renders the lifecycle label', () => {
    render(<EntityLifecyclePanel entity={base} />);
    // The panel section title is "Lifecycle & UE Assets".
    expect(screen.getByText(/Lifecycle/i)).toBeTruthy();
  });

  it('renders "No UE assets" when ueAssets is empty', () => {
    render(<EntityLifecyclePanel entity={base} />);
    expect(screen.getByText(/no UE assets generated/i)).toBeTruthy();
  });

  it('renders each ueAssets path with a copy button', () => {
    const e = { ...base, ueAssets: ['/Script/PoF.GA_Fireball', '/Game/Abilities/BP_Fireball'] };
    render(<EntityLifecyclePanel entity={e} />);
    expect(screen.getByText('/Script/PoF.GA_Fireball')).toBeTruthy();
    expect(screen.getByText('/Game/Abilities/BP_Fireball')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /copy /i })).toHaveLength(2);
  });

  it('renders the last-test verdict when present', () => {
    const e = { ...base, lastTestResult: 'pass' as const, lastVerifiedAt: '2026-05-24T12:39:00Z' };
    render(<EntityLifecyclePanel entity={e} />);
    expect(screen.getByText(/pass/i)).toBeTruthy();
  });
});
