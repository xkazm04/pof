import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

import { DensityLevelGroup } from '@/components/modules/core-engine/sub_world/density/DensityLevelGroup';
import { PlaytimeBreakdownTable } from '@/components/modules/core-engine/sub_world/playtime/PlaytimeBreakdownTable';
import { ProgressionTimeline } from '@/components/modules/core-engine/sub_world/travel/ProgressionTimeline';
import { ZONES, STATIC_WORLD } from '@/components/modules/core-engine/sub_world/_shared/data';

const widths = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>('.absolute.top-0.bottom-0.rounded-md')).map((e) => e.style.width);

describe('world module bars under reduced motion', () => {
  it('level range bars render at full width on first paint', () => {
    const { container } = render(<DensityLevelGroup />);
    const w = widths(container);
    expect(w.length).toBe(ZONES.length);
    for (const v of w) expect(parseFloat(v)).toBeGreaterThan(0);
  });
  it('playtime breakdown bars render at full width on first paint', () => {
    const { container } = render(<PlaytimeBreakdownTable mode="critical" world={STATIC_WORLD} />);
    const w = widths(container);
    expect(w.length).toBe(ZONES.length);
    expect(w.some((v) => parseFloat(v) > 0)).toBe(true);
  });
  it('progression bars render at full width on first paint', () => {
    const { container } = render(<ProgressionTimeline />);
    const w = widths(container);
    expect(w.length).toBeGreaterThan(0);
    expect(w.some((v) => parseFloat(v) > 0)).toBe(true);
  });
});
