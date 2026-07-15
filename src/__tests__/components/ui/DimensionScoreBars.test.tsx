import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { DimensionScoreBars } from '@/components/ui/DimensionScoreBars';
import { VerdictDetailModal } from '@/components/modules/evaluator/JudgeVerdictsView/VerdictDetailModal';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

afterEach(cleanup);

describe('DimensionScoreBars', () => {
  it('renders one labeled progressbar per dimension with its score', () => {
    render(<DimensionScoreBars dimensions={{ silhouette: 95, edgeQuality: 70 }} />);
    const region = screen.getByTestId('verdict-dimensions');
    expect(within(region).getByText('silhouette')).toBeTruthy();
    expect(within(region).getByText('edgeQuality')).toBeTruthy();
    // Each dimension gets an accessible MeterBar (progressbar role).
    const bars = within(region).getAllByRole('progressbar');
    expect(bars.length).toBe(2);
    expect(within(region).getByText('95')).toBeTruthy();
    expect(within(region).getByText('70')).toBeTruthy();
  });

  it('renders nothing when there are no dimensions', () => {
    const { container } = render(<DimensionScoreBars dimensions={{}} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('VerdictDetailModal — dimensions', () => {
  function v(partial: Partial<JudgeVerdict>): JudgeVerdict {
    return {
      catalogId: 'items', entityId: 'sword', step: 'Icon 2D Art',
      judge: 'vlm', verdict: 'pass', score: 90, findings: 'ok', model: 'qwen', ...partial,
    };
  }

  it('shows dimension bars when the verdict carries them', () => {
    render(<VerdictDetailModal verdict={v({ dimensions: { silhouette: 91, contrast: 84 } })} onClose={() => {}} />);
    expect(screen.getByTestId('verdict-dimensions')).toBeTruthy();
    expect(screen.getByText('silhouette')).toBeTruthy();
  });

  it('omits the dimensions section when absent (back-compat)', () => {
    render(<VerdictDetailModal verdict={v({})} onClose={() => {}} />);
    expect(screen.queryByTestId('verdict-dimensions')).toBeNull();
  });
});
