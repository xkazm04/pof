import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DensityLevelGroup } from '@/components/modules/core-engine/sub_world/density/DensityLevelGroup';
import { LEVEL_RANGE_BARS } from '@/components/modules/core-engine/sub_world/_shared/data';

describe('DensityLevelGroup level axis scaling', () => {
  it('scales the axis to the highest zone level instead of the frozen MAX_LEVEL=7', () => {
    const dataMax = Math.max(...LEVEL_RANGE_BARS.map((b) => b.max)); // 50 with the KOTOR zones
    expect(dataMax).toBeGreaterThan(7); // guard: the regression only exists when zones exceed 7

    const { container } = render(<DensityLevelGroup playerLevel={50} />);
    const axisLabels = Array.from(container.querySelectorAll('span'))
      .map((s) => s.textContent?.trim())
      .filter((t) => t && /^\d+$/.test(t))
      .map(Number);

    // The axis must reach the data max — the old code topped out at 7.
    expect(Math.max(...axisLabels)).toBe(dataMax);
  });
});
