/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, copy-auditor): the
 * module-scope toggle must describe the state it is in. With every module shown
 * it used to read "Filtered to module" — the opposite of what the table showed —
 * and it carried no pressed state for assistive tech.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(async () => undefined), sendPrompt: vi.fn(), isRunning: false }),
}));
vi.mock('@/hooks/useFeatureStatuses', () => ({
  useFeatureStatuses: () => ({
    statusMap: new Map<string, string>(), statuses: [], isLoading: false, loaded: true,
    failed: false, error: null, scope: null, refresh: () => {},
  }),
}));
vi.mock('@/components/modules/core-engine/PlanMatrixMap', () => ({ PlanMatrixMap: () => null }));

import { ImplementationPlan } from '@/components/modules/core-engine/ImplementationPlan';
import { getModuleLabel } from '@/lib/implementation-planner/plan-generator';

afterEach(cleanup);

describe('ImplementationPlan module-scope toggle', () => {
  it('names the scope it is in and exposes it as a pressed state', () => {
    const label = getModuleLabel('arpg-character');
    render(<ImplementationPlan moduleId="arpg-character" />);

    const toggle = screen.getByRole('button', { name: new RegExp(`${label} only`) });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle);
    // Now every module is shown: the label must not claim a filter is active.
    expect(toggle.textContent).not.toMatch(/filtered/i);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.textContent).toContain(label);
  });
});
