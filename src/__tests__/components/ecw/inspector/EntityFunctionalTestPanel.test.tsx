import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EntityFunctionalTestPanel } from '@/components/ecw/inspector/EntityFunctionalTestPanel';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const base: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute',
  categoryPath: ['Brute'], tags: [], lifecycle: 'planned',
};

describe('EntityFunctionalTestPanel', () => {
  afterEach(cleanup);

  it('renders the recipe testPath for a known catalog', () => {
    render(<EntityFunctionalTestPanel entity={base} />);
    // bestiary recipe.testPath = "Project.Functional Tests.Maps.VSEnemyAttack.VSEnemyAttackTest"
    expect(screen.getByText(/VSEnemyAttackTest/)).toBeTruthy();
  });

  it('shows "no test wired" when no recipe matches', () => {
    const unknown = { ...base, catalogId: 'not-a-catalog' };
    render(<EntityFunctionalTestPanel entity={unknown} />);
    expect(screen.getByText(/no functional test wired/i)).toBeTruthy();
  });

  it('renders the last verdict when present', () => {
    const e = { ...base, lastTestResult: 'pass' as const, lastVerifiedAt: '2026-05-24T12:39:00Z' };
    render(<EntityFunctionalTestPanel entity={e} />);
    expect(screen.getByText(/pass/i)).toBeTruthy();
  });

  it('renders a disabled "Run again" button (wired in Phase 4)', () => {
    render(<EntityFunctionalTestPanel entity={base} />);
    const btn = screen.getByRole('button', { name: /run again/i });
    expect(btn.hasAttribute('disabled')).toBe(true);
  });
});
