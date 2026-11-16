import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ItemScalingChart } from '@/components/modules/core-engine/sub_inventory/economy/ItemScalingChart';

/** scan-sweep inventory-genome-economy: empty input must not render NaN / Infinity geometry. */

afterEach(cleanup);

function svgText(container: HTMLElement): string {
  return Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent).join(' ');
}

describe('ItemScalingChart empty input', () => {
  it('lines=[] renders an empty state with no NaN or Infinity', () => {
    const { container } = render(<ItemScalingChart lines={[]} width={400} height={200} />);
    expect(/NaN|Infinity/.test(svgText(container) + container.innerHTML)).toBe(false);
    expect(svgText(container)).toMatch(/no scaling data/i);
  });

  it('a line with no points renders an empty state too', () => {
    const { container } = render(<ItemScalingChart lines={[{ label: 'x', color: 'red', points: [] } as never]} width={400} height={200} />);
    expect(/NaN|Infinity/.test(svgText(container) + container.innerHTML)).toBe(false);
  });
});
