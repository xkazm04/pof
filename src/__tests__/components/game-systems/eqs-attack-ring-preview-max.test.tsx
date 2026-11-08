/**
 * eqs-squad-combat-spatial — the AttackDistance slider's right-hand label must
 * read as a preview limit: the C++ property only declares ClampMin=50, the cap
 * exists so the ring fits the viewBox.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AttackRingVisualizer } from '@/components/modules/game-systems/AttackRingVisualizer';
import { MAX_DISTANCE } from '@/components/modules/game-systems/AttackRingVisualizer/constants';

afterEach(cleanup);

describe('AttackRingVisualizer distance slider bounds', () => {
  it('labels the unsourced upper bound as a preview max', () => {
    const { container } = render(<AttackRingVisualizer />);
    const slider = container.querySelector('[data-testid="attack-ring-distance"]')!;
    const labels = Array.from(slider.nextElementSibling!.children).map((c) => c.textContent);
    expect(labels).toHaveLength(3);
    expect(labels[1]).toContain('ClampMin=50');
    expect(labels[2]).toContain('preview');
    expect(labels[2]).toContain(String(MAX_DISTANCE));
  });
});
