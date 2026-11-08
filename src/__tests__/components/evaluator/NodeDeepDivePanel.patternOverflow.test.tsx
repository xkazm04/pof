/**
 * scan-sweep night 2026-11-08 (module-topology-graph): Matching Patterns badged the full
 * count but listed only the first five, with no sign the rest existed.
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

const pattern = (i: number) => ({ id: `p${i}`, title: `Pattern ${i}`, successRate: 0.8, sessionCount: 3 }) as never;

function open(count: number) {
  render(
    <NodeDeepDivePanel
      node={NODE}
      patterns={Array.from({ length: count }, (_, i) => pattern(i))}
      recommendations={[]}
      sessions={{ state: 'loading', retry: () => {} }}
      onClose={() => {}}
    />,
  );
  const toggle = screen.getByRole('button', { name: /Matching Patterns/ });
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
}

describe('NodeDeepDivePanel — pattern list truncation', () => {
  it('discloses how many patterns sit behind the first five', () => {
    open(7);
    expect(screen.getAllByText(/^Pattern \d+$/)).toHaveLength(5);
    expect(screen.getByText('+2 more')).toBeTruthy();
  });

  it('shows no disclosure when everything fits', () => {
    open(5);
    expect(screen.queryByText(/more$/)).toBeNull();
  });
});
