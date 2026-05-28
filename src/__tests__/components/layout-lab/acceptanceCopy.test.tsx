import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { StepFrame, type Acceptance } from '@/components/layout-lab/steps/StepFrame';
import { ITEM_STEP_SPECS, ITEM_STEP_COPY } from '@/components/layout-lab/steps/itemsSteps';
import type { LabStepArtifact } from '@/components/layout-lab/labPipelineStore';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(cleanup);

const art = (data: Record<string, unknown>): LabStepArtifact => ({
  done: true, data, ueAssets: [], at: '2026-05-27T00:00:00Z',
});

/* ── StepFrame banner extensions ────────────────────────────────────────── */

describe('StepFrame plain-language banner', () => {
  it('does not render the explanation row when there is no `why`', () => {
    const acceptance: Acceptance = { label: 'Step ok', status: 'pass', detail: 'all good' };
    render(<StepFrame t={LIGHT} acceptance={acceptance} panels={[]} />);
    expect(screen.queryByTestId('acceptance-explanation')).toBeNull();
    expect(screen.queryByTestId('acceptance-produce-fix')).toBeNull();
  });

  it('renders why + suggestion in their own row when present', () => {
    const acceptance: Acceptance = {
      label: 'Power within ±10% of tier',
      status: 'fail',
      detail: 'price/power 1.34×',
      why: 'This item is priced ~34% too high for its power.',
      suggestion: 'Lower its gold cost.',
    };
    render(<StepFrame t={LIGHT} acceptance={acceptance} panels={[]} />);
    const row = screen.getByTestId('acceptance-explanation');
    expect(row.textContent).toContain('priced ~34% too high');
    expect(screen.getByTestId('acceptance-suggestion').textContent).toContain('Lower its gold cost');
  });

  it('shows the Produce fix button only when status !== pass and onFix is provided', () => {
    const baseFail: Acceptance = { label: 'L', status: 'fail', detail: 'd', why: 'because' };

    // With onFix on a fail — button rendered and clickable.
    const onFix = vi.fn();
    const { rerender } = render(<StepFrame t={LIGHT} acceptance={baseFail} panels={[]} onFix={onFix} />);
    const fix = screen.getByTestId('acceptance-produce-fix');
    fireEvent.click(fix);
    expect(onFix).toHaveBeenCalledTimes(1);

    // On pass, the button hides even with onFix.
    rerender(<StepFrame t={LIGHT} acceptance={{ label: 'L', status: 'pass', detail: 'd', why: 'all good' }} panels={[]} onFix={onFix} />);
    expect(screen.queryByTestId('acceptance-produce-fix')).toBeNull();
  });

  it('forwards the acceptance fixDirection to the onFix callback', () => {
    const onFix = vi.fn();
    const acceptance: Acceptance = {
      label: 'L', status: 'fail', detail: 'd',
      why: 'because', suggestion: 'do this',
      fixDirection: 'lower gold cost to land inside 0.8–1.2× the power curve',
    };
    render(<StepFrame t={LIGHT} acceptance={acceptance} panels={[]} onFix={onFix} />);
    fireEvent.click(screen.getByTestId('acceptance-produce-fix'));
    expect(onFix).toHaveBeenCalledWith('lower gold cost to land inside 0.8–1.2× the power curve');
  });
});

/* ── Per-step copy ───────────────────────────────────────────────────────── */

describe('Economy acceptance copy', () => {
  it('explains a price-too-high outlier in plain language with a fix direction', () => {
    const acceptance = ITEM_STEP_SPECS.Economy.accept(
      art({ power: 102, target: 100, cost: 200, rarity: 'Uncommon' }),
    );
    expect(acceptance.status).toBe('fail');
    expect(acceptance.why).toMatch(/priced .* too high for its power/i);
    expect(acceptance.suggestion).toMatch(/lower its gold cost/i);
    expect(acceptance.fixDirection).toMatch(/lower gold cost/i);
  });

  it('explains a price-too-low outlier with the opposite suggestion', () => {
    const acceptance = ITEM_STEP_SPECS.Economy.accept(
      art({ power: 100, target: 100, cost: 60, rarity: 'Uncommon' }),
    );
    expect(acceptance.status).toBe('fail');
    expect(acceptance.why).toMatch(/priced .* too low for its power/i);
    expect(acceptance.suggestion).toMatch(/raise its gold cost/i);
  });

  it('explains an out-of-band power case (not a price/ratio problem)', () => {
    const acceptance = ITEM_STEP_SPECS.Economy.accept(
      art({ power: 130, target: 100, cost: 140, rarity: 'Uncommon' }),
    );
    expect(acceptance.status).toBe('fail');
    expect(acceptance.why).toMatch(/power is/i);
    expect(acceptance.why).toMatch(/above|below/i);
  });

  it('drops why + fix when the gate passes', () => {
    const acceptance = ITEM_STEP_SPECS.Economy.accept(
      art({ power: 100, target: 100, cost: 140, rarity: 'Uncommon' }),
    );
    expect(acceptance.status).toBe('pass');
    expect(acceptance.why).toBeUndefined();
    expect(acceptance.fixDirection).toBeUndefined();
  });
});

describe('ITEM_STEP_COPY exports per-step plain-language', () => {
  it('every step name in the spec map has a matching copy entry', () => {
    for (const stepName of Object.keys(ITEM_STEP_SPECS)) {
      expect(ITEM_STEP_COPY[stepName]).toBeTypeOf('function');
    }
  });

  it('Concept Brief copy explains the missing-brief case', () => {
    const copy = ITEM_STEP_COPY['Concept Brief'](undefined);
    expect(copy.why.length).toBeGreaterThan(20);
    expect(copy.suggestion).toMatch(/run produce/i);
  });

  it('3D Generation copy gives a triangle-budget fix direction for overage', () => {
    const copy = ITEM_STEP_COPY['3D Generation'](art({ tris: 8000, cap: 6000 }));
    expect(copy.fixDirection).toMatch(/retopo under 6000 triangles/i);
  });
});
