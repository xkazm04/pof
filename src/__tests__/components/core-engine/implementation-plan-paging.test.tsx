/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, state-coverage):
 * narrowing the plan while on a later page must not strand the table on a page
 * that no longer exists. The table used to keep `page` across filter changes,
 * slice past the end and print "No features match the current filters." over a
 * plan that had matching features.
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
import { generatePlan } from '@/lib/implementation-planner/plan-generator';

afterEach(cleanup);

describe('ImplementationPlan paging under a filter change', () => {
  it('a module filter applied on page 2 shows that module\'s features, not the empty state', () => {
    const all = generatePlan(new Map());
    const moduleId = 'arpg-character';
    const expected = generatePlan(new Map(), { moduleId }).items;
    expect(all.items.length).toBeGreaterThan(25);
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThanOrEqual(25);

    const { container } = render(<ImplementationPlan />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(container.textContent).toContain('2 / ');

    const moduleSelect = container.querySelectorAll('select')[0] as HTMLSelectElement;
    fireEvent.change(moduleSelect, { target: { value: moduleId } });

    expect(container.textContent).not.toContain('No features match the current filters.');
    expect(container.textContent).toContain(expected[0].featureName);
  });
});
