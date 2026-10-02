import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { ExecutionBreakdownPanel } from '@/components/modules/core-engine/sub_combat/damage-pipeline/ExecutionBreakdownPanel';
import { UE_EXECUTION_STEPS } from '@/lib/combat/ue-damage-execution';
import { COMBAT_SUBTABS } from '@/components/modules/core-engine/sub_combat/_shared/data';
import { getSections } from '@/components/modules/core-engine/unique-tabs/feature-map-config';
import { CombatActionMap } from '@/components/modules/core-engine/sub_combat';

// The Execution breakdown renders from the declared UE step table, labels the shipped
// armour curve as retired, and puts the canon kernel's figure beside it. The diagram that
// hosts it is mounted as the Combat 'Damage Pipeline' tab (scan-sweep --challenge
// combat-damage-pipeline/A).

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

vi.mock('@/hooks/useTabFeatures', () => ({
  useTabFeatures: () => ({
    featureMap: new Map(),
    stats: { total: 0, implemented: 0, partial: 0, missing: 0 },
    features: [],
    defs: [],
    isLoading: false,
  }),
}));

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('ExecutionBreakdownPanel — rendered from the step table', () => {
  it('case 7: one row per declared step; CritRoll 0.1 shows shipped 134.62 beside canon 169.20', () => {
    const { container } = render(<ExecutionBreakdownPanel />);
    const rows = container.querySelectorAll('[data-testid^="exec-row-"]');
    expect(rows).toHaveLength(UE_EXECUTION_STEPS.length);
    for (const s of UE_EXECUTION_STEPS) expect(screen.getByTestId(`exec-row-${s.id}`)).toBeTruthy();

    // The retired curve is labelled as such and the panel is framed as shipped C++, not canon.
    expect(screen.getByTestId('exec-row-ar').textContent).toMatch(/retired/i);
    expect(screen.getByTestId('execution-breakdown-panel').textContent).toMatch(/as shipped/i);

    fireEvent.click(screen.getByTestId('calc-toggle'));
    fireEvent.change(screen.getByLabelText('CritRoll'), { target: { value: '0.1' } });

    expect(within(screen.getByTestId('exec-row-final')).getByText('134.62')).toBeTruthy();
    const canon = screen.getByTestId('exec-canon-row');
    expect(canon.textContent).toMatch(/Canon kernel/);
    expect(canon.textContent).toContain('169.20');
  });
});

describe('Combat > Damage Pipeline tab mount', () => {
  it("case 8: COMBAT_SUBTABS has 'damage', its gate is declared, and the tab mounts the diagram + panel", () => {
    expect(COMBAT_SUBTABS.map((t) => t.key)).toContain('damage');
    expect(getSections('arpg-combat').find((s) => s.id === 'damage-pipeline')).toMatchObject({ gated: true });

    window.history.replaceState(null, '', '/?combatTab=damage');
    render(<CombatActionMap moduleId="arpg-combat" />);
    expect(screen.getByTestId('damage-pipeline-diagram')).toBeTruthy();
    // The execution section is collapsed by default; opening it renders the panel.
    fireEvent.click(screen.getByTestId('pipeline-section-execution-toggle'));
    expect(screen.getByTestId('execution-breakdown-panel')).toBeTruthy();
  });
});
