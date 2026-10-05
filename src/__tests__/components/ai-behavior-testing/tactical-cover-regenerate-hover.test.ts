/**
 * Regenerating cover positions rebuilds `points` with new x/y/scores at the
 * same indices. If `hoveredPoint` (an index) survives the regenerate, the
 * tooltip and "best point" glow re-attach to a different physical point than
 * the one the cursor is actually over, since the SVG circles moved under it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useTacticalCoverAnalysis } from '@/components/modules/game-systems/TacticalCoverAnalysis/useTacticalCoverAnalysis';

afterEach(cleanup);

describe('useTacticalCoverAnalysis regenerate', () => {
  it('clears hoveredPoint so a stale index never outlives the points it pointed at', () => {
    const { result } = renderHook(() => useTacticalCoverAnalysis());

    act(() => result.current.setHoveredPoint(2));
    expect(result.current.hoveredPoint).toBe(2);

    act(() => result.current.regenerate());
    expect(result.current.hoveredPoint).toBeNull();
  });
});
