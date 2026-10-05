/**
 * ComboChainGraphSvg's edge group is keyboard-accessible (role=button,
 * tabIndex, Enter/Space onKeyDown) but the node group, in the same file, had
 * none of that — a mouse-only onClick with no keyboard alternative. Pins the
 * node group to the same affordance the edge group already has.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ComboChainGraphSvg } from '@/components/modules/core-engine/sub_animation/combos-montages/ComboChainGraphSvg';
import type { ComboGraph } from '@/components/modules/core-engine/sub_animation/combos-montages/useComboChains';

afterEach(cleanup);

const graph: ComboGraph = {
  id: 'g1',
  title: 'Test chain',
  nodes: [
    { id: 'n1', name: 'Slash1', sub: '0.30s', detail: ['Montage: AM_Slash1'] },
    { id: 'n2', name: 'Slash2', sub: '0.35s', detail: ['Montage: AM_Slash2'] },
  ],
  edges: [{ id: 'e1', from: 'n1', to: 'n2', label: '0.10–0.40s' }],
};

describe('ComboChainGraphSvg node selection is keyboard-accessible', () => {
  it('gives each node role=button, tabIndex=0, and an Enter/Space handler', () => {
    const onSelectNode = vi.fn();
    const { getByText } = render(
      <ComboChainGraphSvg graph={graph} onSelectNode={onSelectNode} />,
    );

    const nodeGroup = getByText('Slash1').closest('g')!;
    expect(nodeGroup.getAttribute('role')).toBe('button');
    expect(nodeGroup.getAttribute('tabindex')).toBe('0');

    fireEvent.keyDown(nodeGroup, { key: 'Enter' });
    expect(onSelectNode).toHaveBeenCalledWith('n1');
  });
});
