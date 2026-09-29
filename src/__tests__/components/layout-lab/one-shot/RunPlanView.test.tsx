/**
 * catalog-pipelines/B — the run plan rendered above 'Run pipeline': totals copy, one row per
 * step naming its author, and an 'Author with model' toggle on model-authorable rows only.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import '@/lib/catalog/pipelines/registry.generated';
import { RunPlanView } from '@/components/layout-lab/one-shot/RunPlanView';
import { planRun, stepRefsFor } from '@/lib/one-shot/runPlan';
import { LIGHT } from '@/components/layout-lab/theme';

const PLAN = planRun(stepRefsFor('characters'), {});

describe('RunPlanView', () => {
  afterEach(() => cleanup());

  it('shows the totals line for the characters plan', () => {
    render(<RunPlanView t={LIGHT} plan={PLAN} onSetMode={vi.fn()} />);
    expect(screen.getByText('1 model · 7 built-in · 4 need art · 0 deferred')).toBeTruthy();
  });

  it("clicking 'Author with model' on Behavior (NPC) sets its mode to cli", () => {
    const onSetMode = vi.fn();
    render(<RunPlanView t={LIGHT} plan={PLAN} onSetMode={onSetMode} />);
    const row = screen.getByTestId('run-plan-row-Behavior (NPC)');
    fireEvent.click(within(row).getByRole('button', { name: /author with model/i }));
    expect(onSetMode).toHaveBeenCalledWith('Behavior (NPC)', 'cli');
  });

  it('a non-authorable row renders no toggle', () => {
    render(<RunPlanView t={LIGHT} plan={PLAN} onSetMode={vi.fn()} />);
    expect(within(screen.getByTestId('run-plan-row-Stat Block')).queryByRole('button')).toBeNull();
    expect(within(screen.getByTestId('run-plan-row-Concept 2D Art')).queryByRole('button')).toBeNull();
  });
});
