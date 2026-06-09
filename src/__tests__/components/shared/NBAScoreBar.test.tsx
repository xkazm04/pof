import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { NBAScoreBar } from '@/components/modules/shared/NBAScoreBar';
import type { NBARecommendation } from '@/lib/nba-engine';

function makeRec(breakdown: Partial<NBARecommendation['breakdown']>, extra: Partial<NBARecommendation> = {}): NBARecommendation {
  const full = { urgency: 0, successProb: 0, impact: 0, recency: 0, readiness: 0, ...breakdown };
  const score = Math.round(full.urgency + full.successProb + full.impact + full.recency + full.readiness);
  return {
    item: { id: 'i1', label: 'Test item', description: '', prompt: '' },
    moduleId: 'arpg-combat',
    score,
    reason: 'Test reason',
    pitfalls: [],
    successProbability: 0.5,
    breakdown: full,
    ...extra,
  };
}

afterEach(cleanup);

describe('NBAScoreBar', () => {
  it('renders one width-weighted segment per non-zero factor', () => {
    const { container } = render(<NBAScoreBar rec={makeRec({ urgency: 18, impact: 8 })} />);
    const segments = container.querySelectorAll('.meter-fill-grow');
    expect(segments.length).toBe(2);
    // points double as percent width
    expect((segments[0] as HTMLElement).style.width).toBe('18%');
    expect((segments[1] as HTMLElement).style.width).toBe('8%');
  });

  it('staggers the grow-in delay per segment', () => {
    const { container } = render(<NBAScoreBar rec={makeRec({ urgency: 10, successProb: 10 })} />);
    const segments = container.querySelectorAll('.meter-fill-grow');
    expect((segments[0] as HTMLElement).style.getPropertyValue('--meter-grow-delay')).toBe('0ms');
    expect((segments[1] as HTMLElement).style.getPropertyValue('--meter-grow-delay')).toBe('70ms');
  });

  it('exposes a plain-language legend and a screen-reader summary', () => {
    const { container } = render(
      <NBAScoreBar rec={makeRec({ successProb: 17, impact: 12 }, { successProbability: 0.82 })} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Why recommended');
    expect(text).toContain('82% past success on similar work');
    expect(text).toContain('Unblocks 3 downstream features');

    const label = container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('score 29 of 100');
  });

  it('is keyboard reachable for the focus-revealed legend', () => {
    const { container } = render(<NBAScoreBar rec={makeRec({ urgency: 18 })} />);
    expect(container.querySelector('[role="img"]')?.getAttribute('tabindex')).toBe('0');
  });

  it('renders nothing when no factor contributed points', () => {
    const { container } = render(<NBAScoreBar rec={makeRec({})} />);
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.querySelectorAll('.meter-fill-grow').length).toBe(0);
  });
});
