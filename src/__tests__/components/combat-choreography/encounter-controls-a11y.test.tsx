import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { simulateEncounter } from '@/lib/combat/choreography-sim';
import { WaveManager, TimelineSection } from '@/components/modules/core-engine/sub_combat/choreography/panels';
import { ArchetypePalette } from '@/components/modules/core-engine/sub_combat/choreography/GridPanels';
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

/** Controls with no accessible name: no aria-label, aria-labelledby, title or text. */
function unnamed(root: HTMLElement, selector: string): string[] {
  return [...root.querySelectorAll<HTMLElement>(selector)]
    .filter((el) => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')
      && !el.getAttribute('title') && !(el.textContent ?? '').trim()
      && !(el.id && root.querySelector(`label[for="${el.id}"]`)) && !el.closest('label'))
    .map((el) => el.outerHTML.slice(0, 60));
}

describe('Encounter editor controls have accessible names', () => {
  const s = initialEncounterState();

  it('WaveManager: add / remove wave buttons and spawn-time inputs', () => {
    const { container } = render(
      <WaveManager waves={s.waves} selectedWave={0} waveEnemyCounts={[3, 1, 1]} totalEnemies={5} totalDuration={20}
        onSelect={noop} onAdd={noop} onRemove={noop} onUpdateTime={noop} />,
    );
    expect(unnamed(container, 'button')).toEqual([]);
    expect(unnamed(container, 'input')).toEqual([]);
  });

  it('TimelineSection: play/pause and reset buttons', () => {
    const sim = simulateEncounter(s.enemies, s.waves, s.tuning, s.playerLevel, FEEDBACK_CHANNEL_COLORS);
    const { container } = render(
      <TimelineSection simResult={sim} waves={s.waves} scrubTime={0} isPlaying={false}
        onScrub={noop} onTogglePlay={noop} onReset={noop} />,
    );
    expect(unnamed(container, 'button')).toEqual([]);
  });

  it('ArchetypePalette: level sliders are named and archetype choice exposes its state', () => {
    const { container } = render(
      <ArchetypePalette selectedArchetype="melee-grunt" onSelectArchetype={noop}
        placeLevel={5} onPlaceLevel={noop} playerLevel={5} onPlayerLevel={noop} />,
    );
    expect(unnamed(container, 'input')).toEqual([]);
    const pressed = [...container.querySelectorAll('button')].map((b) => b.getAttribute('aria-pressed'));
    expect(pressed.filter((p) => p === 'true')).toHaveLength(1);
    expect(pressed.every((p) => p === 'true' || p === 'false')).toBe(true);
  });
});
