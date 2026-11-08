/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, parity-auditor): the
 * plan map's legend must describe the canvas it sits on.
 *  - It said "X = effort · Y = impact", but computeCanvasLayout puts one ROW per
 *    category and orders each row by impact (highest on the left); node size is
 *    impact. Effort is not an axis at all.
 *  - It listed "Implemented", which no node can be — done features are not plan
 *    items — from a local STATUS_DOT_COLORS copy, while nodes are painted from
 *    PLAN_STATUS_COLORS (two colour authorities for one vocabulary).
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';
import { computeCanvasLayout } from '@/lib/implementation-planner/layout-engine';
import { PLAN_STATUS_COLORS } from '@/lib/chart-colors';
import { FEATURE_STATUSES } from '@/types/feature-matrix';
import { isFeatureDone } from '@/lib/feature-done';

const plan = generatePlan(new Map());

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(async () => undefined), sendPrompt: vi.fn(), isRunning: false }),
}));
vi.mock('@/hooks/useImplementationPlan', () => ({
  useImplementationPlan: () => ({ plan, loading: false, error: null }),
}));

import { PlanMatrixMap } from '@/components/modules/core-engine/PlanMatrixMap';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
  }
});
afterEach(cleanup);

function rgbOf(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

describe('PlanMatrixMap legend', () => {
  it('the layout really is rows-by-category, impact-descending left to right', () => {
    const layout = computeCanvasLayout(plan.items);
    let rowsChecked = 0;
    for (const cluster of layout.clusters) {
      const rows = new Map<number, typeof cluster.nodes>();
      for (const n of cluster.nodes) rows.set(n.y, [...(rows.get(n.y) ?? []), n]);
      for (const row of rows.values()) {
        const cats = new Set(row.map((n) => n.item.category));
        // jitter is +-2 on x only; y is per category row
        expect(cats.size).toBe(1);
        const byX = [...row].sort((a, b) => a.x - b.x);
        for (let i = 1; i < byX.length; i++) {
          expect(byX[i - 1].item.impact.score).toBeGreaterThanOrEqual(byX[i].item.impact.score);
        }
        rowsChecked++;
      }
    }
    expect(rowsChecked).toBeGreaterThan(10);
  });

  it('states the real encoding and only the statuses a plan node can have, in the node colours', () => {
    render(<PlanMatrixMap />);
    const legend = screen.getByText('Status').parentElement!.parentElement!;
    const text = legend.textContent ?? '';
    expect(text).not.toMatch(/X = effort/);
    expect(text).toMatch(/row = category/i);
    expect(text).toMatch(/left = higher impact/i);

    const reachable = FEATURE_STATUSES.filter((s) => !isFeatureDone(s));
    const drawn = new Set(plan.items.map((i) => i.status));
    for (const s of drawn) expect(reachable).toContain(s);

    expect(text).not.toMatch(/Implemented/);
    for (const s of reachable) {
      const label = s.charAt(0).toUpperCase() + s.slice(1);
      const entry = [...legend.querySelectorAll('span')].find((el) => el.textContent === label)!;
      expect(entry).toBeTruthy();
      const dot = entry.querySelector('span') as HTMLElement;
      expect(dot.style.backgroundColor).toBe(rgbOf(PLAN_STATUS_COLORS[s]));
    }
  });
});
