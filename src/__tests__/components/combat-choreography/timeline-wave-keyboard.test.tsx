import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { simulateEncounter } from '@/lib/combat/choreography-sim';
import { WaveManager, TimelineSection } from '@/components/modules/core-engine/sub_combat/choreography/panels';
import { initialEncounterState } from '@/components/modules/core-engine/sub_combat/choreography/encounterDraftStore';
import { FEEDBACK_CHANNEL_COLORS } from '@/components/modules/core-engine/sub_combat/choreography/types';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});
afterEach(cleanup);

const noop = () => {};

describe('timeline scrub and wave selection are keyboard operable', () => {
  const s = initialEncounterState();

  it('the timeline is one slider that arrow keys scrub', () => {
    const onScrub = vi.fn();
    const sim = simulateEncounter(s.enemies, s.waves, s.tuning, s.playerLevel, FEEDBACK_CHANNEL_COLORS);
    const { container } = render(
      <TimelineSection simResult={sim} waves={s.waves} scrubTime={2} isPlaying={false}
        onScrub={onScrub} onTogglePlay={noop} onReset={noop} />,
    );
    const sliders = container.querySelectorAll<HTMLElement>('[role="slider"]');
    expect(sliders).toHaveLength(1);
    const slider = sliders[0];
    expect(slider.tabIndex).toBe(0);
    expect(slider.getAttribute('aria-valuenow')).toBe('2');
    expect(slider.getAttribute('aria-label')).toBeTruthy();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onScrub).toHaveBeenLastCalledWith(2.5);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onScrub).toHaveBeenLastCalledWith(1.5);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onScrub).toHaveBeenLastCalledWith(0);
  });

  it('every wave row has a focusable select control that selects that wave', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <WaveManager waves={s.waves} selectedWave={0} waveEnemyCounts={[3, 1, 1]} totalEnemies={5} totalDuration={20}
        onSelect={onSelect} onAdd={noop} onRemove={noop} onUpdateTime={noop} />,
    );
    const selectors = [...container.querySelectorAll<HTMLElement>('button[aria-pressed]')];
    expect(selectors).toHaveLength(s.waves.length);
    expect(selectors.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    fireEvent.click(selectors[1]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
