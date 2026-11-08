import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

afterEach(cleanup);

// Re-point the shared cap and ranges: an axis that derives from them follows,
// one that restates the literals (50, 500, 1.1, 2.5) does not.
vi.mock('@/components/modules/core-engine/sub_progression/_shared/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/modules/core-engine/sub_progression/_shared/data')>();
  return {
    ...actual,
    MAX_LEVEL: 60,
    BASE_XP_RANGE: { min: 40, max: 640, step: 10 },
    CURVE_EXP_RANGE: { min: 1.2, max: 2.8, step: 0.05 },
  };
});

import { MultiCurveOverlay } from '@/components/modules/core-engine/sub_progression/curves/MultiCurveOverlay';
import { CurveParametersPanel } from '@/components/modules/core-engine/sub_progression/curves/CurveParametersPanel';

describe('Curves axes derive from the shared cap and ranges', () => {
  it('overlay x axis spans the cap: no point past 100% and the end label names the cap', () => {
    const { container } = render(<MultiCurveOverlay baseXp={100} curveExp={1.5} />);
    expect(screen.getByText('Lv 60')).toBeTruthy();
    expect(screen.getByText('Lv 30')).toBeTruthy();
    const xs = [...container.querySelectorAll('path[fill="none"]')]
      .flatMap((p) => [...(p.getAttribute('d') ?? '').matchAll(/[ML] ([\d.]+),/g)].map((m) => Number(m[1])));
    expect(xs.length).toBeGreaterThan(10);
    expect(Math.max(...xs)).toBeLessThanOrEqual(100.0001);
  });

  it('slider ticks restate the range constants, not literals', () => {
    const { container } = render(
      <CurveParametersPanel
        baseXp={100} curveExp={1.5} compareMode={false} snapshotBaseXp={100} snapshotCurveExp={1.5}
        previewing={false} onBaseXpChange={() => {}} onCurveExpChange={() => {}} onToggleCompare={() => {}}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('40Fast640');
    expect(text).toContain('Linear (1.2)');
    expect(text).toContain('Steep (2.8)');
    expect(text).not.toContain('Steep (2.5)');
    expect(text).not.toContain('Linear (1.1)');
  });
});
