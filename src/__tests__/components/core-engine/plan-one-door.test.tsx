/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, parity-auditor): the
 * Implementation Plan page promises ONE dispatch door (one CLI session) so a
 * running Build session sees every build the page starts. The embedded plan map
 * opened its own usePlanDispatch door ('plan-matrix-map'), so a map dispatch ran
 * in a second CLI session the Build session's isRunning never saw. The map now
 * builds through the door its host hands it.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook, act } from '@testing-library/react';

const cli = vi.hoisted(() => ({ sessionKeys: [] as string[], executedBy: [] as string[] }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string }) => {
    cli.sessionKeys.push(opts.sessionKey);
    return {
      execute: vi.fn(async () => { cli.executedBy.push(opts.sessionKey); }),
      sendPrompt: vi.fn(),
      isRunning: false,
    };
  },
}));
vi.mock('@/hooks/useFeatureStatuses', () => ({
  useFeatureStatuses: () => ({
    statusMap: new Map<string, string>(), statuses: [], isLoading: false, loaded: true,
    failed: false, error: null, scope: null, refresh: () => {},
  }),
}));

import { ImplementationPlan } from '@/components/modules/core-engine/ImplementationPlan';
import { usePlanMatrixMap } from '@/components/modules/core-engine/PlanMatrixMap/usePlanMatrixMap';
import { usePlanDispatch } from '@/hooks/usePlanDispatch';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
  }
});
afterEach(() => {
  cleanup();
  cli.sessionKeys = [];
  cli.executedBy = [];
});

describe('Implementation Plan page keeps ONE dispatch door', () => {
  it('switching to the map view opens no second CLI session', () => {
    render(<ImplementationPlan />);
    fireEvent.click(screen.getByTitle('Matrix map'));
    expect(screen.getByText('Project Map')).toBeTruthy();
    expect(new Set(cli.sessionKeys)).toEqual(new Set(['implementation-plan']));
  });

  it('the map executes through the door it is handed', () => {
    const ready = generatePlan(new Map()).items.find((i) => i.isReady)!;
    const { result } = renderHook(() => {
      const door = usePlanDispatch({ sessionKey: 'host-door', label: 'Host' });
      return usePlanMatrixMap(undefined, door.dispatch);
    });
    act(() => { result.current.handleExecute(ready); });
    expect(cli.executedBy).toEqual(['host-door']);
  });
});
