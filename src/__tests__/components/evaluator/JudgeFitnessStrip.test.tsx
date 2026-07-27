import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { JudgeFitnessStrip } from '@/components/modules/evaluator/PromptEvolutionView/JudgeFitnessStrip';
import type { PromptVersionFitness } from '@/types/prompt-evolution';

afterEach(cleanup);

function fitness(over: Partial<PromptVersionFitness> = {}): PromptVersionFitness {
  return {
    promptVersion: 'q1',
    producedArtifacts: 4,
    judgedArtifacts: 3,
    verdicts: 3,
    avgScore: 82.4,
    passRate: 0.667,
    isCurrent: true,
    ...over,
  };
}

describe('JudgeFitnessStrip', () => {
  it('renders nothing when there is no fitness data at all', () => {
    const { container } = render(<JudgeFitnessStrip fitness={[]} mode="advanced" />);
    expect(container.textContent).toBe('');
  });

  it('shows the rounded mean judge score with a progressbar meter', () => {
    render(<JudgeFitnessStrip fitness={[fitness()]} mode="advanced" />);
    const row = screen.getByTestId('judge-fitness-q1');
    expect(row.textContent).toContain('q1');
    expect(row.textContent).toContain('82');
    expect(row.textContent).toContain('3/4 judged');

    const meter = row.querySelector('[role="progressbar"]')!;
    expect(meter.getAttribute('aria-valuenow')).toBe('82');
    expect(meter.getAttribute('aria-valuetext')).toContain('3 verdicts');
  });

  it('renders an unjudged version honestly — no meter, no zero score', () => {
    render(
      <JudgeFitnessStrip
        fitness={[fitness({ promptVersion: 'q2', avgScore: null, passRate: null, judgedArtifacts: 0, verdicts: 0, producedArtifacts: 2 })]}
        mode="advanced"
      />,
    );
    const row = screen.getByTestId('judge-fitness-q2');
    expect(row.textContent).toContain('unjudged');
    expect(row.textContent).toContain('2 artifacts produced');
    // The critical honesty assertion: an unmeasured version draws no bar at all,
    // so it can never read as a 0% score the judges never gave.
    expect(row.querySelector('[role="progressbar"]')).toBeNull();
    expect(row.textContent).not.toMatch(/\b0\b/);
  });

  it('a genuine zero score still draws a meter (0 is a measurement, null is not)', () => {
    render(<JudgeFitnessStrip fitness={[fitness({ avgScore: 0, passRate: 0 })]} mode="advanced" />);
    const row = screen.getByTestId('judge-fitness-q1');
    expect(row.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(row.textContent).not.toContain('unjudged');
  });

  it('singularises the artifact count in the unjudged state', () => {
    render(
      <JudgeFitnessStrip
        fitness={[fitness({ avgScore: null, passRate: null, verdicts: 0, judgedArtifacts: 0, producedArtifacts: 1 })]}
        mode="advanced"
      />,
    );
    expect(screen.getByTestId('judge-fitness-q1').textContent).toContain('1 artifact produced');
  });

  it('marks the current pack version and hides the pass-rate detail in simple mode', () => {
    const rows = [fitness(), fitness({ promptVersion: 'q0', isCurrent: false })];
    const { unmount } = render(<JudgeFitnessStrip fitness={rows} mode="advanced" />);
    expect(screen.getByTestId('judge-fitness-q1').textContent).toContain('current');
    expect(screen.getByTestId('judge-fitness-q1').textContent).toContain('67% pass');
    expect(screen.getByTestId('judge-fitness-q0').textContent).not.toContain('current');
    unmount();

    render(<JudgeFitnessStrip fitness={rows} mode="simple" />);
    expect(screen.getByTestId('judge-fitness-q1').textContent).not.toContain('% pass');
  });
});
