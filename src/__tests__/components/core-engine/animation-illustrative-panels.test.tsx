/**
 * Six sibling panels across the Budget and Retargeting/State-graph tabs render
 * hardcoded design-time fixture data (montage catalog, state-duration
 * box-whiskers, blend-space demo clips, retarget pipeline status, root motion
 * trajectory, the AnimBP state graph shape) with no indication it is not a
 * read of the user's actual UE5 project — unlike AnimationRealityLedger and
 * BudgetTracker in the same tabs, which already disclose "not measured"
 * explicitly.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MontageAssetBrowser } from '@/components/modules/core-engine/sub_animation/budget/MontageAssetBrowser';
import { StateDurationPanel } from '@/components/modules/core-engine/sub_animation/budget/StateDurationPanel';
import { BlendSpacePanel } from '@/components/modules/core-engine/sub_animation/budget/BlendSpacePanel';
import { RetargetingTab } from '@/components/modules/core-engine/sub_animation/retargeting/RetargetingTab';
import { StateMachinePanel } from '@/components/modules/core-engine/sub_animation/state-graph/StateMachinePanel';

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

  it('RetargetingTab labels both its panels illustrative', () => {
    const { container } = render(<RetargetingTab />);
    expect(container.querySelector('[data-testid="retarget-pipeline-status-measured"]')?.getAttribute('data-measured')).toBe('false');
    expect(container.querySelector('[data-testid="root-motion-trajectory-measured"]')?.getAttribute('data-measured')).toBe('false');
  });

  it('StateMachinePanel labels itself illustrative', () => {
    const { container } = render(<StateMachinePanel featureMap={new Map()} />);
    expect(container.querySelector('[data-testid="state-machine-panel-measured"]')?.getAttribute('data-measured')).toBe('false');
  });
});
