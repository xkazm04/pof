import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

/* The "Trajectories" stat must count the data it draws, as MovementMetrics
 * already does (`DODGE_TRAJECTORIES.length`). A sixth trajectory is the
 * control: a hand-typed "5" cannot follow it. */
vi.mock('@/components/modules/core-engine/sub_character/_shared/data', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/modules/core-engine/sub_character/_shared/data')>();
  return {
    ...real,
    DODGE_TRAJECTORIES: [
      ...real.DODGE_TRAJECTORIES,
      { id: 6, path: 'M 50,80 Q 40,60 45,30', color: real.DODGE_TRAJECTORIES[0].color },
    ],
  };
});

afterEach(() => cleanup());

describe('DodgeTrajectorySection', () => {
  it('derives the Trajectories stat from the drawn trajectory list', async () => {
    const { DodgeTrajectorySection } = await import(
      '@/components/modules/core-engine/sub_character/movement/DodgeTrajectorySection'
    );
    render(<DodgeTrajectorySection />);
    const label = screen.getByText('Trajectories');
    const stat = label.parentElement?.querySelector('span.tabular-nums');
    expect(stat?.textContent).toBe('6');
  });
});
