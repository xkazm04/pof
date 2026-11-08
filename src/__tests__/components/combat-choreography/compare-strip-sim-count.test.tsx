import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('@/lib/combat/choreography-sim', async (orig) => {
  const real = await orig<typeof import('@/lib/combat/choreography-sim')>();
  return { ...real, simulateEncounter: vi.fn(real.simulateEncounter) };
});

import { simulateEncounter } from '@/lib/combat/choreography-sim';
import { CompareStrip } from '@/components/modules/core-engine/sub_combat/choreography/CompareStrip';
import { initialEncounterState } from '@/components/modules/core-engine/sub_combat/choreography/encounterDraftStore';
import { FEEDBACK_CHANNEL_COLORS } from '@/components/modules/core-engine/sub_combat/choreography/types';

afterEach(cleanup);

describe('CompareStrip baseline sim', () => {
  it('simulates the pinned baseline once, not again on every tuning pass', () => {
    const s = initialEncounterState();
    const baseline = { enemies: s.enemies, waves: s.waves, tuning: s.tuning, playerLevel: s.playerLevel };
    const runA = simulateEncounter(s.enemies, s.waves, s.tuning, s.playerLevel, FEEDBACK_CHANNEL_COLORS);
    const runB = simulateEncounter(s.enemies, s.waves, { ...s.tuning, enemyHealthMul: 1.5 }, s.playerLevel, FEEDBACK_CHANNEL_COLORS);
    const runC = simulateEncounter(s.enemies, s.waves, { ...s.tuning, enemyHealthMul: 1.8 }, s.playerLevel, FEEDBACK_CHANNEL_COLORS);
    const noop = () => {};
    const spy = vi.mocked(simulateEncounter);
    spy.mockClear();

    const { rerender } = render(<CompareStrip baseline={baseline} current={runA} onPin={noop} onRevert={noop} onClear={noop} />);
    rerender(<CompareStrip baseline={baseline} current={runB} onPin={noop} onRevert={noop} onClear={noop} />);
    rerender(<CompareStrip baseline={baseline} current={runC} onPin={noop} onRevert={noop} onClear={noop} />);

    // three passes against one unchanged baseline -> one baseline sim
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
