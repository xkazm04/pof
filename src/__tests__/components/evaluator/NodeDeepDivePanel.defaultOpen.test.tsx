/**
 * scan-sweep night 2026-11-08 (module-topology-graph): the deep-dive's default open id
 * was 'checklist', which none of its four sections uses, so it always opened fully
 * collapsed. It now opens the first section that is present.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NodeDeepDivePanel } from '@/components/modules/evaluator/NexusView/NodeDeepDivePanel';
import type { NexusNode } from '@/components/modules/evaluator/NexusView/types';

afterEach(cleanup);

const NODE = {
  moduleId: 'arpg-combat', label: 'Combat', cx: 0, cy: 0, featureCount: 4, implementedCount: 1, blockedCount: 0,
  genreItemCount: 0, checklistTotal: 0, checklistDone: 0,
  patternSuccessRate: null, criticalFindings: null, healthScore: null, sessionCount: null, runSuccessCount: null, avgDurationMs: null,
} as unknown as NexusNode;

const PATTERN = { id: 'p1', title: 'P', successRate: 0.9, sessionCount: 1 } as never;
const REC = { id: 'r1', title: 'Fix', description: 'd', priority: 'high' } as never;
const loading = { state: 'loading', retry: () => {} } as const;

const expanded = () =>
  screen.getAllByRole('button').filter((b) => b.getAttribute('aria-expanded') === 'true').map((b) => b.textContent ?? '');

describe('NodeDeepDivePanel — default open section', () => {
  it('opens Matching Patterns first when patterns exist', () => {
    render(<NodeDeepDivePanel node={NODE} patterns={[PATTERN]} recommendations={[REC]} sessions={loading} onClose={() => {}} />);
    const open = expanded();
    expect(open).toHaveLength(1);
    expect(open[0]).toMatch(/Matching Patterns/);
  });

  it('falls through to Recommendations when there are no patterns', () => {
    render(<NodeDeepDivePanel node={NODE} patterns={[]} recommendations={[REC]} sessions={loading} onClose={() => {}} />);
    expect(expanded()[0]).toMatch(/Recommendations/);
  });

  it('opens nothing, by intent, when no section is present', () => {
    render(<NodeDeepDivePanel node={NODE} patterns={[]} recommendations={[]} sessions={loading} onClose={() => {}} />);
    expect(expanded()).toEqual([]);
  });
});
