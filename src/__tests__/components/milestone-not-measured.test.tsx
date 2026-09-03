/**
 * Every `Milestone.currentProgress` consumer must render `null` as an explicit
 * "not measured" state — never a 0, never a dash that reads as zero, never an
 * empty progress bar. `null` is the honest answer for the vertical slice (see
 * health-engine-vertical-slice.test.ts) and a UI that silently prints 0% turns
 * the honest null straight back into a false measurement.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { Milestone } from '@/types/project-health';
import { MilestoneRow } from '@/components/modules/evaluator/HolisticHealthView/MilestoneRow';
import { MilestoneDetailCard } from '@/components/modules/evaluator/HolisticHealthView/MilestoneDetailCard';
import { MilestoneCards } from '@/components/modules/evaluator/CalendarRoadmapView/MilestoneCards';
import { GanttTimeline } from '@/components/modules/evaluator/CalendarRoadmapView/GanttTimeline';
import { MILESTONE_NOT_MEASURED_LABEL } from '@/lib/roadmap/milestone-progress';

// setup.ts installs no auto-cleanup — see reference_test_no_autocleanup.
afterEach(cleanup);

const UNMEASURED: Milestone = {
  id: 'vertical-slice',
  name: 'Playable Vertical Slice',
  targetCompletion: 30,
  predictedDate: '2026-10-01T00:00:00.000Z',
  predictedWeeks: 4,
  currentProgress: null,
  progressNote: 'No vertical slice is declared, so its depth is unmeasured.',
  color: 'var(--color-module-core)',
};

const MEASURED: Milestone = {
  ...UNMEASURED,
  id: 'feature-complete',
  name: 'Feature Complete',
  targetCompletion: 75,
  currentProgress: 42,
  progressNote: null,
};

/** No consumer may print a zero-ish reading for an unmeasured milestone. */
function assertNoFakeZero(text: string) {
  expect(text).toContain(MILESTONE_NOT_MEASURED_LABEL);
  expect(text).not.toMatch(/\b0\s*%/);
  expect(text).not.toContain('—%');
}

describe('MilestoneRow', () => {
  it('renders "not measured" and no progress bar when currentProgress is null', () => {
    const { container } = render(<MilestoneRow milestone={UNMEASURED} />);
    assertNoFakeZero(container.textContent ?? '');
    // No filled progress bar may be drawn — an empty bar reads as 0%.
    expect(container.querySelector('[data-testid="milestone-progress-bar"]')).toBeNull();
  });

  it('still renders a percentage bar for a measured milestone', () => {
    const { container } = render(<MilestoneRow milestone={MEASURED} />);
    expect(container.textContent).toContain('42%');
    expect(container.textContent).not.toContain(MILESTONE_NOT_MEASURED_LABEL);
    expect(container.querySelector('[data-testid="milestone-progress-bar"]')).not.toBeNull();
  });
});

describe('MilestoneDetailCard', () => {
  it('renders "not measured" and no progress bar when currentProgress is null', () => {
    const { container } = render(<MilestoneDetailCard milestone={UNMEASURED} />);
    assertNoFakeZero(container.textContent ?? '');
    expect(container.querySelector('[data-testid="milestone-progress-bar"]')).toBeNull();
  });

  it('still renders a percentage bar for a measured milestone', () => {
    const { container } = render(<MilestoneDetailCard milestone={MEASURED} />);
    expect(container.textContent).toContain('42% progress');
    expect(container.querySelector('[data-testid="milestone-progress-bar"]')).not.toBeNull();
  });
});

describe('MilestoneCards (calendar roadmap)', () => {
  const noop = () => {};
  const props = {
    deadlines: {},
    getVariance: () => null,
    editingId: null,
    setEditingId: noop as never,
    editDate: '',
    setEditDate: noop as never,
    saveDeadline: async () => {},
  };

  it('renders "not measured" and no progress bar when currentProgress is null', () => {
    const { container } = render(<MilestoneCards milestones={[UNMEASURED]} {...props} />);
    assertNoFakeZero(container.textContent ?? '');
    expect(container.querySelector('[data-testid="milestone-progress-bar"]')).toBeNull();
  });

  it('still renders a percentage bar for a measured milestone', () => {
    const { container } = render(<MilestoneCards milestones={[MEASURED]} {...props} />);
    expect(container.textContent).toContain('42%');
    expect(container.querySelector('[data-testid="milestone-progress-bar"]')).not.toBeNull();
  });
});

describe('GanttTimeline', () => {
  const props = {
    svgRef: { current: null },
    svgWidth: 600,
    svgHeight: 200,
    weeks: [new Date('2026-09-01T00:00:00.000Z')],
    monthHeaders: [],
    deadlines: {},
    todayX: 100,
    dateToX: () => 300,
    getVariance: () => null,
    handleDragStart: () => {},
  };

  it('labels the gutter "not measured" and draws no filled progress portion', () => {
    const { container } = render(<GanttTimeline milestones={[UNMEASURED]} {...props} />);
    assertNoFakeZero(container.textContent ?? '');
    expect(container.querySelector('[data-testid="gantt-progress-fill-vertical-slice"]')).toBeNull();
  });

  it('still draws the filled portion for a measured milestone', () => {
    const { container } = render(<GanttTimeline milestones={[MEASURED]} {...props} />);
    expect(container.textContent).toContain('42%');
    expect(container.querySelector('[data-testid="gantt-progress-fill-feature-complete"]')).not.toBeNull();
  });
});
