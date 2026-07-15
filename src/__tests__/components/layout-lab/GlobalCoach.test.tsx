import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// The aggregation hook is unit-tested via globalCoach.test.ts; here we mock it so the
// component test drives a fixed, ranked candidate list deterministically.
const coachMock = vi.fn();
vi.mock('@/components/layout-lab/hooks/useGlobalCoach', () => ({
  useGlobalCoach: () => coachMock(),
  GLOBAL_COACH_TOP_N: 5,
}));

import { GlobalCoach } from '@/components/layout-lab/GlobalCoach';
import { LIGHT } from '@/components/layout-lab/theme';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import type { CoachCandidate } from '@/components/layout-lab/globalCoachModel';

const cand = (over: Partial<CoachCandidate>): CoachCandidate => ({
  catalogId: 'items', catalogLabel: 'Items', entityId: 'e1', entityName: 'Sword', step: 'Economy', stepIndex: 3, priority: 'fail', ...over,
});

beforeEach(() => { coachMock.mockReset(); useOneShotLabStore.setState({ pendingNavigation: null }); });
afterEach(cleanup);

describe('<GlobalCoach />', () => {
  it('renders nothing when there is no actionable step project-wide', () => {
    coachMock.mockReturnValue([]);
    const { container } = render(<GlobalCoach t={LIGHT} />);
    expect(container.querySelector('[data-testid="global-coach"]')).toBeNull();
  });

  it('shows the single most-urgent move by default and reveals the rest on expand (ranked order)', () => {
    coachMock.mockReturnValue([
      cand({ entityId: 'e1', entityName: 'Sword', priority: 'fail' }),
      cand({ entityId: 'e2', entityName: 'Shield', catalogId: 'armor', catalogLabel: 'Armor', priority: 'drift' }),
      cand({ entityId: 'e3', entityName: 'Potion', catalogId: 'consumables', catalogLabel: 'Consumables', priority: 'pending' }),
    ]);
    const { container } = render(<GlobalCoach t={LIGHT} />);

    // Default: only the top item is shown; the expandable list is collapsed.
    expect(container.querySelector('[data-testid="global-coach-item-0-entity"]')?.textContent).toBe('Sword');
    expect(container.querySelector('[data-testid="global-coach-list"]')).toBeNull();

    // The disclosure counts the remaining items.
    const toggle = container.querySelector('[data-testid="global-coach-toggle"]') as HTMLElement;
    expect(toggle.textContent).toContain('2 more');

    fireEvent.click(toggle);
    const items = container.querySelectorAll('[data-testid="global-coach-list"] [data-entity]');
    expect(Array.from(items).map((n) => n.getAttribute('data-entity'))).toEqual(['e2', 'e3']);
    // rank order preserved: drift before pending
    expect(Array.from(items).map((n) => n.getAttribute('data-priority'))).toEqual(['drift', 'pending']);
  });

  it('clicking an entry dispatches pendingNavigation to the exact catalog + entity + flagged step', () => {
    coachMock.mockReturnValue([
      cand({ entityId: 'e1', catalogId: 'items', stepIndex: 3 }),
      cand({ entityId: 'e2', catalogId: 'armor', catalogLabel: 'Armor', priority: 'pending', stepIndex: 1 }),
    ]);
    const { container } = render(<GlobalCoach t={LIGHT} />);

    // top item — the payload carries the flagged step so Baseline opens ON it (not step 0).
    fireEvent.click(container.querySelector('[data-testid="global-coach-item-0"]') as HTMLElement);
    expect(useOneShotLabStore.getState().pendingNavigation).toEqual({ catalogId: 'items', entityId: 'e1', stepIndex: 3 });

    // expand + click the second
    fireEvent.click(container.querySelector('[data-testid="global-coach-toggle"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-testid="global-coach-item-1"]') as HTMLElement);
    expect(useOneShotLabStore.getState().pendingNavigation).toEqual({ catalogId: 'armor', entityId: 'e2', stepIndex: 1 });
  });

  it('shows the concrete checker reason on a candidate that carries one (and falls back to the generic hint otherwise)', () => {
    coachMock.mockReturnValue([
      cand({ entityId: 'e1', priority: 'fail', reason: 'price/power 1.43x out of band' }),
      cand({ entityId: 'e2', catalogId: 'armor', catalogLabel: 'Armor', priority: 'pending' }), // no reason
    ]);
    const { container } = render(<GlobalCoach t={LIGHT} />);

    // top item (fail) surfaces the verbatim reason.
    expect(container.querySelector('[data-testid="global-coach-item-0-reason"]')?.textContent).toContain('price/power 1.43x out of band');

    // the pending item (no reason) renders no reason node — the generic hint stays in aria-label.
    fireEvent.click(container.querySelector('[data-testid="global-coach-toggle"]') as HTMLElement);
    expect(container.querySelector('[data-testid="global-coach-item-1-reason"]')).toBeNull();
    const item1 = container.querySelector('[data-testid="global-coach-item-1"]') as HTMLElement;
    expect(item1.getAttribute('aria-label')).toContain('not been produced');
  });
});
