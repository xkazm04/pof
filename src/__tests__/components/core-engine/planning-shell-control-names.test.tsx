/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, accessibility-checker):
 * every control on the plan surfaces has a name, and every toggle exposes its
 * state. Before: 4 icon-only buttons had no name at all (plan Refresh, map
 * Navigator close, map module chevron, detail-panel close) and 5 toggles drew
 * their state in colour only (Table/Map view, Deps, Critical, row expand,
 * navigator module expand).
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';
import { computeCanvasLayout } from '@/lib/implementation-planner/layout-engine';

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(async () => undefined), sendPrompt: vi.fn(), isRunning: false }),
}));
vi.mock('@/hooks/useFeatureStatuses', () => ({
  useFeatureStatuses: () => ({
    statusMap: new Map<string, string>(), statuses: [], isLoading: false, loaded: true,
    failed: false, error: null, scope: null, refresh: () => {},
  }),
}));

import { ImplementationPlan } from '@/components/modules/core-engine/ImplementationPlan';
import { DetailPanel } from '@/components/modules/core-engine/PlanMatrixMap/DetailPanel';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
  }
});
afterEach(cleanup);

const nameOf = (b: Element) =>
  (b.getAttribute('aria-label') ?? '').trim() || (b.textContent ?? '').trim() || (b.getAttribute('title') ?? '').trim();
const nameless = (root: ParentNode) =>
  [...root.querySelectorAll('button')].filter((b) => nameOf(b) === '').map((b) => b.outerHTML.slice(0, 80));

describe('plan surfaces: every control is named, every toggle states its state', () => {
  it('table view', () => {
    const { container } = render(<ImplementationPlan />);
    expect(nameless(container)).toEqual([]);
    expect(screen.getByTitle('Table view').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTitle('Matrix map').getAttribute('aria-pressed')).toBe('false');

    const first = generatePlan(new Map()).items[0];
    const row = screen.getAllByText(first.featureName).map((el) => el.closest('button')).find(Boolean)!;
    expect(row.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });

  it('map view', () => {
    const { container } = render(<ImplementationPlan />);
    fireEvent.click(screen.getByTitle('Matrix map'));
    expect(nameless(container)).toEqual([]);
    const deps = screen.getByRole('button', { name: 'Deps' });
    expect(deps.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(deps);
    expect(deps.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Critical' }).getAttribute('aria-pressed')).toBe('false');
    const expanders = container.querySelectorAll('button[aria-expanded]');
    expect(expanders.length).toBeGreaterThan(0);
  });

  it('detail panel', () => {
    const layout = computeCanvasLayout(generatePlan(new Map()).items);
    const node = [...layout.allNodes.values()][0];
    const { container } = render(
      <DetailPanel node={node} allNodes={layout.allNodes} onClose={() => {}} onExecute={() => {}} onSelectNode={() => {}} />,
    );
    expect(nameless(container)).toEqual([]);
  });
});
