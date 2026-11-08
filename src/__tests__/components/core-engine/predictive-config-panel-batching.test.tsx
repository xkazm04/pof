import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ConfigPanel } from '@/components/modules/core-engine/sub_character/simulator/predictive/ConfigPanel';
import { DEFAULT_PREDICTIVE_CONFIG, type PredictiveBalanceConfig } from '@/lib/combat/predictive-balance';

afterEach(cleanup);

// Two edits land before React re-renders (a batch, or an edit racing applyTuning):
// the panel keeps its render-time `config` prop while the updaters queue up. The
// updaters must build on the state they are handed, not on that stale prop.
describe('ConfigPanel encounter edits under batching', () => {
  it('keeps every edit when several encounter rows change before a re-render', () => {
    let state: PredictiveBalanceConfig = DEFAULT_PREDICTIVE_CONFIG;
    const setConfig: React.Dispatch<React.SetStateAction<PredictiveBalanceConfig>> = next => {
      state = typeof next === 'function' ? next(state) : next;
    };
    const { container } = render(<ConfigPanel config={DEFAULT_PREDICTIVE_CONFIG} setConfig={setConfig} />);
    const q = (label: string) => container.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;

    fireEvent.change(q('Encounter 1 enemy count'), { target: { value: '5' } });
    fireEvent.change(q('Encounter 2 archetype'), { target: { value: 'brute' } });
    fireEvent.change(q('Encounter 3 enemy count'), { target: { value: '4' } });

    expect(state.enemyConfigs[0].count).toBe(5);
    expect(state.enemyConfigs[1].archetypeId).toBe('brute');
    expect(state.enemyConfigs[2].count).toBe(4);
  });
});
