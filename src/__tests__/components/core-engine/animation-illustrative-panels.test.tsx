/**
 * Three sibling panels in the same Budget tab as `AnimationRealityLedger` and
 * `BudgetTracker` render hardcoded design-time fixture data (montage catalog,
 * state-duration box-whiskers, blend-space demo clips) with no indication it
 * is not a read of the user's actual UE5 project — unlike their siblings,
 * which already disclose "not measured" explicitly.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MontageAssetBrowser } from '@/components/modules/core-engine/sub_animation/budget/MontageAssetBrowser';
import { StateDurationPanel } from '@/components/modules/core-engine/sub_animation/budget/StateDurationPanel';
import { BlendSpacePanel } from '@/components/modules/core-engine/sub_animation/budget/BlendSpacePanel';

afterEach(cleanup);

describe('illustrative animation panels disclose they are unmeasured', () => {
  it('MontageAssetBrowser labels itself a seed catalog', () => {
    const { container } = render(<MontageAssetBrowser />);
    expect(container.querySelector('[data-testid="montage-browser-measured"]')?.getAttribute('data-measured')).toBe('false');
  });

  it('StateDurationPanel labels itself illustrative', () => {
    const { container } = render(<StateDurationPanel />);
    expect(container.querySelector('[data-testid="state-duration-measured"]')?.getAttribute('data-measured')).toBe('false');
  });

  it('BlendSpacePanel labels itself illustrative', () => {
    const { container } = render(<BlendSpacePanel />);
    expect(container.querySelector('[data-testid="blend-space-measured"]')?.getAttribute('data-measured')).toBe('false');
  });
});
