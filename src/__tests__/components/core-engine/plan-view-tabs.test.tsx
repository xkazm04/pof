/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, accessibility-checker):
 * PlanView's Plan / Evolution switcher was two plain buttons with the active
 * state drawn as a coloured underline - no tablist, no role=tab, no
 * aria-selected. It now renders through the shared ui/TabBar.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/components/modules/core-engine/ImplementationPlan', () => ({
  ImplementationPlan: () => <div data-testid="plan-panel" />,
}));
vi.mock('@/components/modules/core-engine/TelemetryEvolution', () => ({
  TelemetryEvolution: () => <div data-testid="evolution-panel" />,
}));

import { PlanView } from '@/components/modules/core-engine/PlanView';

afterEach(cleanup);

describe('PlanView tab strip semantics', () => {
  it('exposes two tabs and announces the selected one as it changes', () => {
    render(<PlanView />);
    const tabs = screen.queryAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(screen.queryAllByRole('tablist')).toHaveLength(1);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(screen.queryByTestId('plan-panel')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /evolution/i }));
    expect(screen.queryAllByRole('tab').map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(screen.queryByTestId('evolution-panel')).toBeTruthy();
  });
});
