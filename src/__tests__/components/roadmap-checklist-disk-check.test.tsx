/**
 * "Check against disk" — the hook and the panel. Verification of a checklist used to
 * run only when the file watcher saw a header saved with the app open. The check is
 * on demand: nothing runs on mount, one click sends ONE verify-semantic POST for the
 * module's owner-scoped items, verdicts are recorded as verification, and checklist
 * ticks change only through an explicit apply (Mark built) or a per-row Untick.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, act, cleanup, fireEvent, within } from '@testing-library/react';
import { RoadmapChecklist } from '@/components/modules/shared/RoadmapChecklist';
import { useDiskCheck } from '@/components/modules/shared/RoadmapChecklist/useDiskCheck';
import { DiskCheckPanel } from '@/components/modules/shared/RoadmapChecklist/DiskCheckPanel';
import { __resetModulePatternCache } from '@/components/modules/shared/RoadmapChecklist/useModulePatterns';
import { buildFinishPrompt, planDiskReconcile, type DiskResult } from '@/lib/checklist-disk-check';
import { invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { useModuleStore } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { getModuleChecklist } from '@/lib/module-registry';
import { mockFetchRoutes } from '@/__tests__/setup';
import { ACCENT_EMERALD } from '@/lib/chart-colors';

afterEach(cleanup);

const MODULE = 'arpg-character';
const ITEMS = getModuleChecklist(MODULE);

const RESULTS: DiskResult[] = [
  { moduleId: MODULE, itemId: 'ac-1', status: 'full', completeness: 1, missingMembers: [] },
  { moduleId: MODULE, itemId: 'ac-2', status: 'full', completeness: 1, missingMembers: [] },
  { moduleId: MODULE, itemId: 'ac-3', status: 'partial', completeness: 0.5, missingMembers: ['MaxWalkSpeed'] },
  { moduleId: MODULE, itemId: 'ac-4', status: 'missing', completeness: 0, missingMembers: ['DefaultPawnClass'] },
];

const setChecklistItem = vi.fn();
const setVerification = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;

function routes(verify: { status?: number; body: unknown }) {
  fetchMock = mockFetchRoutes([
    { match: '/api/filesystem/verify-semantic', response: verify },
    { match: '/api/feature-matrix/all-statuses', response: { body: { success: true, data: { statuses: [] } } } },
    { match: '/api/', response: { body: { success: true, data: {} } } },
  ]);
}

const ok = () => routes({ body: { success: true, data: { results: RESULTS, unreadable: [] } } });
const verifyCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('verify-semantic'));

async function settle() {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  __resetModulePatternCache();
  invalidateFeatureStatuses();
  usePatternLibraryStore.setState({ patterns: [], suggestions: [] });
  setChecklistItem.mockReset();
  setVerification.mockReset();
  useModuleStore.setState({
    checklistProgress: { [MODULE]: { 'ac-2': true, 'ac-4': true } },
    checklistVerification: {},
    moduleHistory: {},
    setChecklistItem,
    setVerification,
  });
  useProjectStore.setState({ projectPath: 'C:/Proj' });
  ok();
});

describe('RoadmapChecklist — no auto-run', () => {
  it('mounting with a project path fires no verification and writes nothing until the click', async () => {
    render(
      <RoadmapChecklist items={ITEMS} subModuleId={MODULE} onRunPrompt={() => {}} accentColor={ACCENT_EMERALD} isRunning={false} />,
    );
    await settle();
    expect(verifyCalls()).toHaveLength(0);
    expect(setVerification).not.toHaveBeenCalled();
    expect(setChecklistItem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /check against disk/i }));
    await settle();
    expect(verifyCalls()).toHaveLength(1);
    expect(setChecklistItem).not.toHaveBeenCalled();
  });
});

describe('useDiskCheck', () => {
  it('run() sends exactly one POST for the owner-scoped items and records, never ticks', async () => {
    const { result } = renderHook(() => useDiskCheck(MODULE));
    expect(verifyCalls()).toHaveLength(0);
    await act(async () => { await result.current.run(); });
    expect(verifyCalls()).toHaveLength(1);
    const [, init] = verifyCalls()[0];
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      projectPath: 'C:/Proj',
      items: ['ac-1', 'ac-2', 'ac-3', 'ac-4'].map((itemId) => ({ moduleId: MODULE, itemId })),
    });
    expect(setVerification).toHaveBeenCalledTimes(4);
    expect(setVerification).toHaveBeenCalledWith(MODULE, 'ac-3', expect.objectContaining({ status: 'partial', missingMembers: ['MaxWalkSpeed'] }));
    expect(setChecklistItem).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe('done');
  });

  it('a refused check is an error state and writes nothing; no project path is unavailable and fetches nothing', async () => {
    routes({ status: 500, body: { success: false, error: 'EACCES' } });
    const { result } = renderHook(() => useDiskCheck(MODULE));
    await act(async () => { await result.current.run(); });
    expect(result.current.state).toEqual({ phase: 'error', reason: 'EACCES' });
    expect(setVerification).not.toHaveBeenCalled();
    expect(setChecklistItem).not.toHaveBeenCalled();

    fetchMock.mockClear();
    useProjectStore.setState({ projectPath: '' });
    const second = renderHook(() => useDiskCheck(MODULE));
    await act(async () => { await second.result.current.run(); });
    expect(second.result.current.state).toEqual({ phase: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('apply ticks only the clicked built rows', async () => {
    const { result } = renderHook(() => useDiskCheck(MODULE));
    await act(async () => { await result.current.run(); });
    act(() => { result.current.apply(['ac-1']); });
    expect(setChecklistItem).toHaveBeenCalledTimes(1);
    expect(setChecklistItem).toHaveBeenCalledWith(MODULE, 'ac-1', true);
    // ac-4 is regressed, not built: apply never touches it
    act(() => { result.current.apply(['ac-4']); });
    expect(setChecklistItem).toHaveBeenCalledTimes(1);
  });
});

describe('DiskCheckPanel', () => {
  it('offers Mark built (n), a per-row Untick and a Finish that names the members', () => {
    const plan = planDiskReconcile(RESULTS, { 'ac-2': true, 'ac-4': true });
    const onApply = vi.fn();
    const onUntick = vi.fn();
    const onRunPrompt = vi.fn();
    render(
      <DiskCheckPanel
        items={ITEMS}
        verifiableCount={4}
        state={{ phase: 'done', results: RESULTS, unreadable: [] }}
        plan={plan}
        isRunning={false}
        accentColor={ACCENT_EMERALD}
        onCheck={() => {}}
        onApply={onApply}
        onUntick={onUntick}
        onRunPrompt={onRunPrompt}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark built (1)' }));
    expect(onApply).toHaveBeenCalledWith(['ac-1']);

    fireEvent.click(within(screen.getByTestId('pof-disk-row-ac-4')).getByRole('button', { name: 'Untick' }));
    expect(onUntick).toHaveBeenCalledWith('ac-4');
    expect(within(screen.getByTestId('pof-disk-row-ac-1')).queryByRole('button', { name: 'Untick' })).toBeNull();

    fireEvent.click(within(screen.getByTestId('pof-disk-row-ac-3')).getByRole('button', { name: 'Finish' }));
    const ac3 = ITEMS.find((i) => i.id === 'ac-3')!;
    expect(onRunPrompt).toHaveBeenCalledWith(
      'ac-3',
      buildFinishPrompt(ac3, { className: 'AARPGCharacterBase', missingMembers: ['MaxWalkSpeed'] }),
    );
  });
});
