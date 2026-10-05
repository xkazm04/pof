/**
 * MontageTimeline renders each section's notify windows sorted by
 * WINDOW_ORDER (MotionWarp, ComboWindow, HitDetection, SpawnVFX) regardless of
 * the order they arrive in, and uses safeDivide for each section's width so a
 * zero-duration combo never NaNs the layout.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MontageTimeline } from '@/components/modules/content/animations/AIComboChoreographer/MontageTimeline';
import type { ComboSection, NotifyWindow } from '@/components/modules/content/animations/AIComboChoreographer/types';

afterEach(cleanup);

function window(name: string, overrides: Partial<NotifyWindow> = {}): NotifyWindow {
  return { name, color: '#fff', start: 0, width: 0.1, ...overrides };
}

function section(overrides: Partial<ComboSection> = {}): ComboSection {
  return {
    label: 'Slash 1',
    duration: 0.3,
    damage: 10,
    windows: [],
    rootMotionDistance: 0,
    motionWarpTarget: false,
    description: '',
    ...overrides,
  };
}

describe('MontageTimeline', () => {
  it('reorders notify windows to MotionWarp, ComboWindow, HitDetection, SpawnVFX regardless of input order', () => {
    const sec = section({
      windows: [
        window('SpawnVFX'),
        window('HitDetection'),
        window('MotionWarp'),
        window('ComboWindow'),
      ],
    });
    const { container } = render(<MontageTimeline sections={[sec]} />);
    const labels = Array.from(container.querySelectorAll('span.text-\\[11px\\]')).map((el) => el.textContent);
    // "Detection"/"Spawn" are stripped from the rendered label (component behavior).
    expect(labels).toEqual(['MotionWarp', 'ComboWindow', 'Hit', 'VFX']);
  });

  it('never produces a NaN width when total duration is 0', () => {
    const sections = [section({ duration: 0 }), section({ label: 'Slash 2', duration: 0 })];
    const { container } = render(<MontageTimeline sections={sections} />);
    expect(container.innerHTML.includes('NaN')).toBe(false);
  });
});
