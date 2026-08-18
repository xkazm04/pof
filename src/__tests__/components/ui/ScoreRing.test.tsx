import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ScoreRing, scoreToStatusColor } from '@/components/ui/ScoreRing';
import { ACCENT_VIOLET, STATUS_INFO, scoreBandToken } from '@/lib/chart-colors';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

/** The drawn arc (second circle) — absent entirely when unmeasured. */
function arc(container: HTMLElement): SVGCircleElement | null {
  const circles = container.querySelectorAll('circle');
  return circles.length > 1 ? (circles[1] as SVGCircleElement) : null;
}

describe('ScoreRing — unmeasured is a real state, not a zero', () => {
  it('renders no number and an honest accessible name', () => {
    const { container } = render(<ScoreRing value={0} measured={false} />);
    const ring = screen.getByRole('img');
    expect(ring.getAttribute('aria-label')).toMatch(/unmeasured/i);
    expect(ring.getAttribute('aria-label')).not.toMatch(/\d/);
    // No digit anywhere in the centre label.
    expect(container.textContent).not.toMatch(/\d/);
    // No progress arc at all — an empty ring cannot be read as a score of 0.
    expect(arc(container)).toBeNull();
  });

  it('cannot be talked into showing a number by a caller label', () => {
    const { container } = render(<ScoreRing value={82} measured={false} label={<span>82</span>} />);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('dashes the empty track so it reads as absent, not as zero progress', () => {
    const { container } = render(<ScoreRing value={0} measured={false} />);
    const track = container.querySelector('circle')!;
    expect(track.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('accepts an accessible-name override for measured rings', () => {
    render(<ScoreRing value={82} ariaLabel="Compliance score 82 out of 100" />);
    expect(screen.getByRole('img', { name: 'Compliance score 82 out of 100' })).toBeTruthy();
  });
});

describe('ScoreRing — one canonical band ladder', () => {
  it('colours every score through scoreBandToken', () => {
    for (const score of [0, 39, 40, 59, 60, 69, 70, 79, 80, 100]) {
      const { container } = render(<ScoreRing value={score} />);
      expect(arc(container)!.getAttribute('stroke')).toBe(scoreBandToken(score).color);
      cleanup();
    }
  });

  it('exposes the same ladder through scoreToStatusColor', () => {
    for (const score of [0, 45, 65, 75, 95]) {
      expect(scoreToStatusColor(score)).toBe(scoreBandToken(score).color);
    }
  });
});

/**
 * Consumer enumeration — every `ui/ScoreRing` call site in the app, with the
 * props it actually passes. Measured rendering (number, geometry, accessible
 * name) must be unchanged for all of them; the two that took the default colour
 * ladder in the 40–59 and 70–79 bands move to the canonical band token on
 * purpose (see the build record).
 */
const CONSUMERS: Array<{ where: string; props: React.ComponentProps<typeof ScoreRing>; score: number }> = [
  { where: 'TelemetryEvolution/PatternsList', score: 88, props: { value: 88, size: 28, strokeWidth: 2, labelClassName: 'text-2xs font-bold text-text' } },
  { where: 'TelemetryEvolution/SuggestionsList (explicit color)', score: 72, props: { value: 72, size: 32, strokeWidth: 2, color: STATUS_INFO, labelClassName: 'text-2xs font-bold text-text' } },
  { where: 'sub_ability/tags/TagAuditSection', score: 33, props: { value: 33, size: 48 } },
  { where: 'AssetCodeOracleView/ConsistencyHeroCard (explicit color + label)', score: 91, props: { value: 91, size: 96, strokeWidth: 8, color: ACCENT_VIOLET, labelClassName: 'leading-none', label: <span>A</span> } },
  { where: 'game-director/DirectorOverview (avg)', score: 64, props: { value: 64, size: 64, strokeWidth: 4 } },
  { where: 'game-director/DirectorOverview (session)', score: 52, props: { value: 52, size: 36, strokeWidth: 2.5, className: 'flex-shrink-0' } },
  { where: 'game-director/SessionDetail', score: 77, props: { value: 77, size: 40, strokeWidth: 3 } },
  { where: 'evaluator/GDDComplianceView (measured)', score: 82, props: { value: 82, size: 56, ariaLabel: 'Compliance score 82 out of 100' } },
];

describe('ScoreRing — every consumer still renders its measured score', () => {
  for (const { where, props, score } of CONSUMERS) {
    it(`${where} renders the value, a full ring, and an accessible name`, () => {
      const { container } = render(<ScoreRing {...props} />);
      const ring = screen.getByRole('img');
      expect(ring.getAttribute('aria-label')).toBe(props.ariaLabel ?? `Score: ${score} out of 100`);
      // Centre content: the caller's label if given, otherwise the number.
      expect(container.textContent).toContain(props.label ? 'A' : String(score));
      // Geometry is driven by size/strokeWidth exactly as before.
      const size = props.size ?? 64;
      const stroke = props.strokeWidth ?? 4;
      const track = container.querySelector('circle')!;
      expect(track.getAttribute('r')).toBe(String((size - stroke) / 2));
      expect(track.getAttribute('stroke-width')).toBe(String(stroke));
      // An explicit color still wins over the band ladder.
      expect(arc(container)!.getAttribute('stroke')).toBe(props.color ?? scoreBandToken(score).color);
    });
  }
});
