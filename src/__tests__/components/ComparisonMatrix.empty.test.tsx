import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ComparisonMatrix } from '@/components/modules/core-engine/sub_character/simulator/ComparisonMatrix';
import { COMPARISON_CHARACTERS } from '@/components/modules/core-engine/sub_character/_shared/data';

afterEach(cleanup);

const HINT = 'Pick at least two characters to compare';

describe('ComparisonMatrix empty state', () => {
  it('shows the hint and no stat table when selection is cleared', () => {
    const { container } = render(<ComparisonMatrix selected={[]} onSelectionChange={() => {}} />);
    expect(container.querySelector('[data-testid="comparison-empty"]')?.textContent).toBe(HINT);
    expect(container.querySelector('table')).toBeNull();
  });

  it('shows the hint with one character, and none with two', () => {
    const ids = COMPARISON_CHARACTERS.slice(0, 2).map(c => c.id);
    const one = render(<ComparisonMatrix selected={ids.slice(0, 1)} onSelectionChange={() => {}} />);
    expect(one.container.querySelector('[data-testid="comparison-empty"]')?.textContent).toBe(HINT);
    expect(one.container.querySelector('table')).not.toBeNull();
    one.unmount();
    const two = render(<ComparisonMatrix selected={ids} onSelectionChange={() => {}} />);
    expect(two.container.querySelector('[data-testid="comparison-empty"]')).toBeNull();
  });
});
