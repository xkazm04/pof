/**
 * scan-sweep night 2026-11-08 (module-topology-graph): the Nexus deep-dive's close
 * button was an icon-only `<button>` with no accessible name, and its collapsible
 * sections never exposed whether they were open (no aria-expanded) — the state was
 * carried only by swapping an X / Zap glyph.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NodeDeepDivePanel } from '@/components/modules/evaluator/NexusView/NodeDeepDivePanel';
import type { NexusNode } from '@/components/modules/evaluator/NexusView/types';

afterEach(cleanup);

const NODE = {
  moduleId: 'arpg-combat', label: 'Combat', cx: 0, cy: 0, featureCount: 4, implementedCount: 1, blockedCount: 0,
  genreItemCount: 0, checklistTotal: 0, checklistDone: 0,
  patternSuccessRate: null, criticalFindings: null, healthScore: null, sessionCount: null, runSuccessCount: null, avgDurationMs: null,
} as unknown as NexusNode;

const REC = { id: 'r1', title: 'Fix the combo window', description: 'd', priority: 'high' } as never;

describe('NodeDeepDivePanel a11y', () => {
  it('names its close button after the module', () => {
    let closed = 0;
    render(
      <NodeDeepDivePanel node={NODE} patterns={[]} recommendations={[]} sessions={{ state: 'loading', retry: () => {} }} onClose={() => closed++} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close Combat details' }));
    expect(closed).toBe(1);
  });

  it('collapsible sections report aria-expanded and flip it on toggle', () => {
    render(
      <NodeDeepDivePanel node={NODE} patterns={[{ id: 'p1', title: 'P', successRate: 0.9, sessionCount: 1 } as never]} recommendations={[REC]} sessions={{ state: 'loading', retry: () => {} }} onClose={() => {}} />,
    );
    // The first present section (patterns) opens on arrival; Recommendations starts collapsed.
    const toggle = screen.getByRole('button', { name: /Recommendations/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /Recommendations/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Fix the combo window')).toBeTruthy();
  });
});
