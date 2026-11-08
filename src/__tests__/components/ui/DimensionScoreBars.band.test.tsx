import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DimensionScoreBars } from '@/components/ui/DimensionScoreBars';
import { scoreBandToken } from '@/lib/chart-colors';
import { hexToRgb } from '@/lib/contrast';

afterEach(cleanup);

const rgbOf = (hex: string) => `rgb(${hexToRgb(hex).join(', ')})`;

// Dimensions are 0-100; qualityColor is a 1-5 scale, so anything above 5 read muted.
describe('DimensionScoreBars colours a 0-100 score by its band', () => {
  it.each([95, 65, 20])('score %i', (score) => {
    render(<DimensionScoreBars dimensions={{ silhouette: score }} />);
    const expected = rgbOf(scoreBandToken(score).color);
    expect(screen.getByText(String(score)).style.color).toBe(expected);
    const fill = screen.getByRole('progressbar').firstElementChild as HTMLElement;
    expect(fill.style.backgroundColor).toBe(expected);
  });
});
