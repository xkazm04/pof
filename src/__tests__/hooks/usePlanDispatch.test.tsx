/**
 * scan-sweep --challenge (core-engine-planning-shell/A): every plan dispatch goes
 * through ONE gated door — usePlanDispatch (planDispatch gate +
 * useModuleCLI.execute) — and a landed build refreshes the shared status cache so
 * every plan view re-derives. The plan map used to hand-build a prompt via
 * sendPrompt (no gate, no @@CALLBACK, "Dependencies (already implemented)" for
 * every item) and no dispatch site refreshed statuses on land.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { CallbackStatus } from '@/lib/cli-task';

const cli = vi.hoisted(() => ({
  execute: vi.fn(async () => undefined),
  sendPrompt: vi.fn(),
  onComplete: undefined as undefined | ((success: boolean, status?: CallbackStatus) => void),
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { onComplete?: (success: boolean, status?: CallbackStatus) => void }) => {
    cli.onComplete = opts.onComplete;
    return { execute: cli.execute, sendPrompt: cli.sendPrompt, isRunning: false };
  },
}));
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useModuleAggregates', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useModuleAggregates')>()),
  invalidateFeatureData: invalidate,
}));
vi.mock('@/hooks/useImplementationPlan', () => ({
  useImplementationPlan: () => ({ plan: null, loading: false, error: null }),
}));

import { usePlanDispatch } from '@/hooks/usePlanDispatch';
import { usePlanMatrixMap } from '@/components/modules/core-engine/PlanMatrixMap/usePlanMatrixMap';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';

const plan = generatePlan(new Map());
const readyItem = plan.items.find((i) => i.isReady)!;
const blockedItem = plan.items.find((i) => !i.isReady)!;

beforeEach(() => {
  cli.execute.mockClear();
  cli.sendPrompt.mockClear();
  invalidate.mockClear();
  cli.onComplete = undefined;
});
afterEach(cleanup);

describe('usePlanMatrixMap — the map builds through the gated door', () => {
  it('handleExecute(readyItem) executes one feature-fix task and never sends a hand-built prompt', () => {
    const { result } = renderHook(() => usePlanMatrixMap());
    act(() => { result.current.handleExecute(readyItem); });
    expect(cli.execute).toHaveBeenCalledTimes(1);
    const task = (cli.execute.mock.calls[0] as unknown[])[0] as { type: string; featureName: string };
    expect(task.type).toBe('feature-fix');
    expect(task.featureName).toBe(readyItem.featureName);
    expect(cli.sendPrompt).not.toHaveBeenCalled();
  });

  it('handleExecute(blockedItem) dispatches nothing', () => {
    const { result } = renderHook(() => usePlanMatrixMap());
    act(() => { result.current.handleExecute(blockedItem); });
    expect(cli.execute).not.toHaveBeenCalled();
    expect(cli.sendPrompt).not.toHaveBeenCalled();
  });
});

describe('usePlanDispatch — refresh on land', () => {
  const setup = () => renderHook(() => usePlanDispatch({ sessionKey: 'plan-test', label: 'Plan Test' }));

  it('a confirmed callback invalidates the shared feature data exactly once', () => {
    const { result } = setup();
    act(() => { result.current.dispatch(readyItem); });
    expect(cli.execute).toHaveBeenCalledTimes(1);
    act(() => { cli.onComplete?.(true, 'confirmed'); });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(result.current.lastError).toBeNull();
  });

  it('a failed run with a missing callback does not invalidate and names the item', () => {
    const { result } = setup();
    act(() => { result.current.dispatch(readyItem); });
    act(() => { cli.onComplete?.(false, 'missing'); });
    expect(invalidate).not.toHaveBeenCalled();
    expect(result.current.lastError).toContain(readyItem.featureName);
  });

  it('a blocked item is refused with its unmet prerequisites and nothing runs', () => {
    const { result } = setup();
    let outcome: ReturnType<typeof result.current.dispatch> | undefined;
    act(() => { outcome = result.current.dispatch(blockedItem); });
    expect(outcome).toEqual({ ok: false, error: { reason: 'blocked', unmet: blockedItem.unmetDeps } });
    expect(cli.execute).not.toHaveBeenCalled();
    expect(result.current.lastError).toContain(blockedItem.featureName);
  });
});
