import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { renderLootMetric } from '@/components/modules/core-engine/sub_loot/metrics';
import { useLootTuningStore, resetLootTuning } from '@/components/modules/core-engine/sub_loot/_shared/lootTuningStore';

// The Feature Map glyphs render the live view: the Pity tab's threshold reaches the
// Timer/Drought glyphs, and fixture numbers say they are sample data.

beforeEach(() => resetLootTuning());
afterEach(cleanup);

const renderMetric = (id: string) => render(<>{renderLootMetric(id)}</>);

describe('loot Feature Map glyphs', () => {
  it('Timer reads the threshold set in the store', () => {
    act(() => useLootTuningStore.getState().setPityThreshold(35));
    renderMetric('timer');
    expect(screen.getByText('35')).toBeTruthy();
    expect(screen.queryByText('20')).toBeNull();
  });

  it('Drought glyph names the unpitied and the pitied p95, so it is not a copy of Timer', () => {
    act(() => useLootTuningStore.getState().setPityThreshold(35));
    const { container } = renderMetric('drought');
    const titled = Array.from(container.querySelectorAll('[title], title')).map((el) => el.getAttribute('title') ?? el.textContent ?? '');
    expect(titled.some((t) => t.includes('149') && t.includes('35 with pity'))).toBe(true);
  });

  it('a fixture glyph is marked as sample data', () => {
    const { container } = renderMetric('co-occurrence');
    expect(container.querySelector('[title*="sample data"]')).not.toBeNull();
  });

  it('a fixture glyph tells assistive tech it is sample data, not only a hover title', () => {
    // The glyph marks are aria-hidden and a title is not reliably announced, so the
    // disclosure must be in the text a screen reader reads.
    for (const id of ['pipeline', 'co-occurrence', 'beacon']) {
      const { container, unmount } = renderMetric(id);
      const srOnly = container.querySelector('.sr-only');
      expect(srOnly?.textContent ?? '', id).toMatch(/sample data/);
      unmount();
    }
  });

  it('a live glyph has no sample-data disclosure in its text either', () => {
    const { container } = renderMetric('drought');
    expect(container.textContent ?? '').not.toMatch(/sample data/);
  });

  it('a live glyph is not marked as sample data', () => {
    const { container } = renderMetric('timer');
    expect(container.querySelector('[title*="sample data"]')).toBeNull();
  });

  it('[guard] resetLootTuning restores pity 20 and the roster baseline', () => {
    act(() => {
      useLootTuningStore.getState().setPityThreshold(35);
      useLootTuningStore.getState().dispatch({ type: 'setField', id: 'MeleeGrunt', field: 'dropChance', value: 0.6 });
    });
    act(() => resetLootTuning());
    const s = useLootTuningStore.getState();
    expect(s.pityThreshold).toBe(20);
    expect(s.bindings).toBe(s.baseline);
    renderMetric('timer');
    expect(screen.getByText('20')).toBeTruthy();
  });
});
