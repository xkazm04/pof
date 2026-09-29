/**
 * scan-sweep --challenge (core-engine-planning-shell/B): the Implementation Plan
 * gains a Build session — pick a budget, review the proposed dependency-safe
 * run, deselect steps, and ONE Start commits it. Dispatch is pinned to explicit
 * clicks: editing the budget or the selection runs nothing; Start runs exactly
 * steps[0]; the run advances only on a confirmed landing and stops, named, on a
 * failure. The single-row 'Build this' keeps working when no session is running.
 * Every dispatch goes through the page's ONE usePlanDispatch door
 * (session 'implementation-plan').
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { CallbackStatus } from '@/lib/cli-task';

const cli = vi.hoisted(() => ({
  execute: vi.fn(async () => undefined),
  sessionKeys: [] as string[],
  onComplete: undefined as undefined | ((success: boolean, status?: CallbackStatus) => void),
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string; onComplete?: (success: boolean, status?: CallbackStatus) => void }) => {
    cli.sessionKeys.push(opts.sessionKey);
    cli.onComplete = opts.onComplete;
    return { execute: cli.execute, sendPrompt: vi.fn(), isRunning: false };
  },
}));
const fs = vi.hoisted(() => ({ statusMap: new Map<string, string>() }));
vi.mock('@/hooks/useFeatureStatuses', () => ({
  useFeatureStatuses: () => ({
    statusMap: fs.statusMap, statuses: [], isLoading: false, loaded: true,
    failed: false, error: null, scope: null, refresh: () => {},
  }),
}));
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useModuleAggregates', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useModuleAggregates')>()),
  invalidateFeatureData: invalidate,
}));
vi.mock('@/components/modules/core-engine/PlanMatrixMap', () => ({ PlanMatrixMap: () => null }));

import { ImplementationPlan } from '@/components/modules/core-engine/ImplementationPlan';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';
import { planBuildSession } from '@/lib/implementation-planner/build-session';

type Task = { type: string; featureName: string };
const executed = () => cli.execute.mock.calls.map((c) => (c as unknown[])[0] as Task);

beforeEach(() => {
  cli.execute.mockClear();
  cli.sessionKeys = [];
  cli.onComplete = undefined;
  invalidate.mockClear();
  fs.statusMap = new Map();
});
afterEach(cleanup);

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: /plan a session/i }));
  return screen.getByRole('region', { name: /build session/i });
}

describe('Build session — dispatch only on explicit clicks', () => {
  it('[guard] budget + deselect run nothing; Start runs exactly steps[0]; no session -> Build this runs one task', () => {
    render(<ImplementationPlan />);

    // No session: the single-row Build still dispatches exactly one feature-fix task.
    const first = generatePlan(new Map()).items[0];
    const rowLabel = screen.getAllByText(first.featureName).find((el) => el.closest('button'))!;
    fireEvent.click(rowLabel);
    fireEvent.click(screen.getByRole('button', { name: /build this/i }));
    expect(executed()).toHaveLength(1);
    expect(executed()[0]).toMatchObject({ type: 'feature-fix', featureName: first.featureName });
    act(() => { cli.onComplete?.(true, 'confirmed'); });
    cli.execute.mockClear();

    // Session: editing the budget and the selection dispatches nothing.
    const panel = openPanel();
    fireEvent.click(screen.getByRole('button', { name: '4h' }));
    const proposed = planBuildSession(fs.statusMap, { budgetMinutes: 240 });
    const dropped = proposed.steps[1];
    fireEvent.click(screen.getByRole('checkbox', { name: `Include ${dropped.featureName}` }));
    expect(cli.execute).toHaveBeenCalledTimes(0);
    expect(panel).toBeTruthy();

    // One explicit Start: exactly one task, steps[0] of the edited selection.
    const edited = planBuildSession(fs.statusMap, { budgetMinutes: 240, exclude: [dropped.key] });
    fireEvent.click(screen.getByRole('button', { name: /start session/i }));
    expect(executed()).toHaveLength(1);
    expect(executed()[0]).toMatchObject({ type: 'feature-fix', featureName: edited.steps[0].featureName });
    // One CLI session for the whole page — the session reuses the plan's door.
    expect(new Set(cli.sessionKeys)).toEqual(new Set(['implementation-plan']));
  });

  it('advances on a confirmed landing (after statuses refresh) and stops, named, on a failure', () => {
    const { rerender } = render(<ImplementationPlan />);
    openPanel();
    const steps = planBuildSession(fs.statusMap, { budgetMinutes: 120 }).steps;
    fireEvent.click(screen.getByRole('button', { name: /start session/i }));
    expect(executed()).toHaveLength(1);

    // Step 0 lands: the shared cache is invalidated, statuses refresh, step 1 runs.
    act(() => { cli.onComplete?.(true, 'confirmed'); });
    expect(invalidate).toHaveBeenCalledTimes(1);
    fs.statusMap = new Map([[steps[0].key, 'improved']]);
    rerender(<ImplementationPlan />);
    expect(executed()).toHaveLength(2);
    expect(executed()[1].featureName).toBe(steps[1].featureName);

    // Step 1's callback is missing: the run stops there and says why.
    act(() => { cli.onComplete?.(true, 'missing'); });
    expect(executed()).toHaveLength(2);
    expect(screen.getByText(`Stopped at ${steps[1].featureName}: callback missing`)).toBeTruthy();
  });
});
