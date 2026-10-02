import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { LevelUpRewardPreview } from '@/components/modules/core-engine/sub_progression/rewards/LevelUpRewardPreview';
import { LEVEL_REWARDS } from '@/components/modules/core-engine/sub_progression/_shared/data';
import {
  evenSpacingSuggestion, pacingModel, rewardSchedule, type RewardGroup,
} from '@/components/modules/core-engine/sub_progression/_shared/rewardPacing';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LevelUpRewardPreview puts rewards on the clock', () => {
  it('case 4: all 15 reward names render with no duplicate-key console.error', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<LevelUpRewardPreview baseXp={100} curveExp={1.5} />);
    const names = [...container.querySelectorAll('[data-reward-name]')].map((el) => el.textContent);
    expect(names).toHaveLength(15);
    expect([...names].sort()).toEqual(LEVEL_REWARDS.map((r) => r.name).sort());
    expect(err).toHaveBeenCalledTimes(0);
    // cadence diagnosis surfaces: 2 droughts (L40, L50), 7 clumps
    expect(screen.getAllByText('Drought')).toHaveLength(2);
    expect(screen.getAllByText('Clump')).toHaveLength(7);
  });

  it('case 7: "Apply even spacing" calls onScheduleChange once with groups at the suggested levels', () => {
    const spy = vi.fn<(s: RewardGroup[]) => void>();
    render(<LevelUpRewardPreview baseXp={100} curveExp={1.5} onScheduleChange={spy} />);
    fireEvent.click(screen.getByRole('button', { name: /apply even spacing/i }));
    expect(spy).toHaveBeenCalledTimes(1);
    const next = spy.mock.calls[0][0];
    const suggested = evenSpacingSuggestion(pacingModel(100, 1.5), rewardSchedule(LEVEL_REWARDS));
    expect(suggested).toEqual([12, 20, 26, 31, 36, 41, 46, 50]);
    expect(next.map((g) => g.level)).toEqual(suggested);
    next.forEach((g) => g.rewards.forEach((r) => expect(r.level).toBe(g.level)));
    expect(next.flatMap((g) => g.rewards.map((r) => r.name)).sort())
      .toEqual(LEVEL_REWARDS.map((r) => r.name).sort());
  });
});
