import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { scheduleCombo } from '@/components/modules/core-engine/sub_combat/combos/schedule';
import { TimelineBlock } from '@/components/modules/core-engine/sub_combat/combos/TimelineBlock';

// scan-sweep night 2026-11-08, combat-damage-pipeline: a remove must target the block the user
// clicked even when an unknown id was skipped by the schedule (cast.index counts resolved casts).

afterEach(() => cleanup());

describe('scheduled casts carry their raw chain position', () => {
  it('skips the unknown id but keeps each cast chainIndex into the raw chain', () => {
    const s = scheduleCombo(['melee1', 'ghost', 'slam']);
    expect(s.casts.map(c => c.index)).toEqual([0, 1]);
    expect(s.casts.map(c => c.chainIndex)).toEqual([0, 2]);
  });

  it('clicking remove on the cast after the unknown id passes its RAW chain index', () => {
    const chain = ['melee1', 'ghost', 'slam'];
    const cast = scheduleCombo(chain).casts[1];
    const onRemove = vi.fn();
    render(<TimelineBlock cast={cast} total={2} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /^Remove .+ from the combo/ }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    const removed = chain.filter((_, i) => i !== onRemove.mock.calls[0][0]);
    expect(removed).toEqual(['melee1', 'ghost']);
  });
});
