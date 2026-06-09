import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { DamagePipelineFlow } from '@/components/modules/core-engine/sub_combat/damage-pipeline/DamagePipelineFlow';

// ResponsiveSvgContainer wires a ResizeObserver, which jsdom doesn't provide.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => cleanup());

describe('DamagePipelineFlow — branch legend', () => {
  it('labels every branch-arrow color so the death/alive paths are not color-only', () => {
    render(<DamagePipelineFlow />);
    const legend = screen.getByRole('list', { name: 'Damage pipeline branch legend' });
    expect(within(legend).getByText('Dead')).toBeTruthy();
    expect(within(legend).getByText('Alive')).toBeTruthy();
    expect(within(legend).getByText('Not dead yet')).toBeTruthy();
  });
});
