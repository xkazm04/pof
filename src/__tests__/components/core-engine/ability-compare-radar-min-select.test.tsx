/**
 * AbilityCompareRadar's own copy states "Select 2-6 abilities ... to compare on
 * radar" (MIN_COMPARE=2), but nothing enforced that floor: ScalableSelector has
 * no minimum-selection concept, so a user could pick 1 (silent single-ability
 * "radar" with zero overlays) or 0 (blank panel, no message at all) — both
 * states the stated contract denies but the code let happen unexplained.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { AbilityEntry } from '@/lib/catalog/types';

afterEach(cleanup);

vi.mock('@/hooks/useGeneration', () => ({
  useGeneration: () => ({ generate: () => {}, isRunning: false, nextStep: null }),
}));

const makeEntry = (id: string, name: string): AbilityEntry => ({
  id, catalogId: 'spellbook', name, categoryPath: ['Offensive'], tags: [], lifecycle: 'planned',
  data: {
    id, name, category: 'Offensive', element: 'Fire', tier: 'basic',
    damage: 10, manaCost: 0, cooldown: 0, radar: [0.5, 0.5, 0.5, 0.5, 0.5],
    description: '', color: '#fff', tag: `Ability.${id}`,
  },
});

const { entriesRef } = vi.hoisted(() => ({ entriesRef: { current: [] as AbilityEntry[] } }));

vi.mock('@/stores/catalogStore', () => ({
  useSpellbookEntries: () => entriesRef.current,
}));

import { AbilityCompareRadar } from '@/components/modules/core-engine/sub_ability/abilities/AbilityCompareRadar';

describe('AbilityCompareRadar honors its own 2-ability minimum', () => {
  it('shows an explicit message instead of a blank panel when 0 are selected', () => {
    entriesRef.current = [];
    render(<AbilityCompareRadar />);
    expect(screen.getByText(/select at least 2/i)).toBeTruthy();
  });

  it('shows the message instead of a zero-overlay single-ability radar when only 1 is selected', () => {
    entriesRef.current = [makeEntry('off-fire-01', 'Fireball')];
    render(<AbilityCompareRadar />);
    expect(screen.getByText(/select at least 2/i)).toBeTruthy();
  });
});
