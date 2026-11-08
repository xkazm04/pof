/**
 * "Check against disk" reads the project path when the click lands, then awaits the
 * verify-semantic POST. A project switch in that window clears the module store and
 * loads the NEXT project's progress — so writing the verdicts on arrival records
 * project A's headers as project B's verification (and auto-save persists them).
 * A verdict is only recorded while the project it was taken against is still open.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useDiskCheck } from '@/components/modules/shared/RoadmapChecklist/useDiskCheck';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import type { DiskResult } from '@/lib/checklist-disk-check';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const MODULE = 'arpg-character';
const RESULTS: DiskResult[] = [
  { moduleId: MODULE, itemId: 'ac-1', status: 'full', completeness: 1, missingMembers: [] },
];

const setVerification = vi.fn();
let release: () => void = () => {};

beforeEach(() => {
  setVerification.mockReset();
  useModuleStore.setState({ checklistProgress: {}, checklistVerification: {}, setVerification });
  useProjectStore.setState({ projectPath: 'C:/ProjA' });
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
    release = () => resolve(new Response(
      JSON.stringify({ success: true, data: { results: RESULTS, unreadable: [] } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
  })));
});

describe('useDiskCheck — project switch while checking', () => {
  it('records nothing when the open project changed before the verdicts arrived', async () => {
    const { result } = renderHook(() => useDiskCheck(MODULE));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.run(); });
    useProjectStore.setState({ projectPath: 'C:/ProjB' });
    await act(async () => { release(); await pending; });
    expect(setVerification).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('error');
  });

  it('still records when the project did not change', async () => {
    const { result } = renderHook(() => useDiskCheck(MODULE));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.run(); });
    await act(async () => { release(); await pending; });
    expect(setVerification).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe('done');
  });
});
