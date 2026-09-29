'use client';

/**
 * On-demand "Check against disk" for one module's checklist.
 *
 * idle -> checking -> done | error | unavailable. Nothing runs on mount: `run()` sends
 * ONE `POST /api/filesystem/verify-semantic` for the module's owner-scoped items and
 * records each verdict as verification (`setVerification`). It never ticks. Ticks
 * change only through `apply(ids)` (built rows -> ticked) and `untick(id)` (a regressed
 * row -> unticked), each an explicit click. A failed check writes nothing.
 */

import { useCallback, useMemo, useState } from 'react';
import { useModuleStore, type VerificationInfo, type VerificationStatus } from '@/stores/moduleStore';
import { useProjectStore } from '@/stores/projectStore';
import { getModuleChecklist } from '@/lib/module-registry';
import { tryApiFetch } from '@/lib/api-utils';
import {
  diskVerifiableItems, planDiskReconcile, type DiskPlan, type DiskResult,
} from '@/lib/checklist-disk-check';
import type { ChecklistItem, SubModuleId } from '@/types/modules';
import { EMPTY_PROGRESS } from './constants';

export type DiskCheckState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'done'; results: DiskResult[]; unreadable: string[] }
  | { phase: 'error'; reason: string }
  | { phase: 'unavailable' };

const IDLE: DiskCheckState = { phase: 'idle' };
const RECORDED: ReadonlySet<string> = new Set<VerificationStatus>(['full', 'partial', 'stub', 'missing']);

export function useDiskCheck(moduleId: string, items?: ChecklistItem[]) {
  const checklist = useMemo(() => items ?? getModuleChecklist(moduleId as SubModuleId), [items, moduleId]);
  const verifiableIds = useMemo(() => diskVerifiableItems(moduleId, checklist), [moduleId, checklist]);
  const progress = useModuleStore((s) => s.checklistProgress[moduleId] ?? EMPTY_PROGRESS);

  // Keyed by module: a kept-alive checklist switching modules never shows another's verdicts.
  const [slot, setSlot] = useState<{ moduleId: string; state: DiskCheckState }>({ moduleId, state: IDLE });
  const state = slot.moduleId === moduleId ? slot.state : IDLE;

  const run = useCallback(async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath) {
      setSlot({ moduleId, state: { phase: 'unavailable' } });
      return;
    }
    if (verifiableIds.length === 0) return;
    setSlot({ moduleId, state: { phase: 'checking' } });
    const res = await tryApiFetch<{ results: DiskResult[]; unreadable?: string[] }>('/api/filesystem/verify-semantic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, items: verifiableIds.map((itemId) => ({ moduleId, itemId })) }),
    });
    if (!res.ok) {
      setSlot({ moduleId, state: { phase: 'error', reason: res.error } });
      return;
    }
    const asked = new Set(verifiableIds);
    const results = (res.data.results ?? []).filter((r) => r.moduleId === moduleId && asked.has(r.itemId));
    const { setVerification } = useModuleStore.getState();
    const verifiedAt = Date.now();
    for (const r of results) {
      if (!RECORDED.has(r.status)) continue;
      const info: VerificationInfo = {
        status: r.status as VerificationStatus,
        completeness: r.completeness,
        missingMembers: r.missingMembers ?? [],
        verifiedAt,
      };
      setVerification(moduleId as SubModuleId, r.itemId, info);
    }
    setSlot({ moduleId, state: { phase: 'done', results, unreadable: res.data.unreadable ?? [] } });
  }, [moduleId, verifiableIds]);

  // Re-derived from live progress: a row applied elsewhere stops proposing its action.
  const plan: DiskPlan | null = useMemo(
    () => (state.phase === 'done' ? planDiskReconcile(state.results, progress) : null),
    [state, progress],
  );

  /** Tick the given ids — only those the plan reports as built (on disk, unticked). */
  const apply = useCallback((ids: string[]) => {
    if (!plan) return;
    const { setChecklistItem } = useModuleStore.getState();
    for (const id of ids) {
      if (plan.rows.some((r) => r.itemId === id && r.action === 'tick')) {
        setChecklistItem(moduleId as SubModuleId, id, true);
      }
    }
  }, [plan, moduleId]);

  /** Untick one regressed row (ticked, but its class is not on disk). */
  const untick = useCallback((id: string) => {
    if (!plan?.rows.some((r) => r.itemId === id && r.action === 'untick')) return;
    useModuleStore.getState().setChecklistItem(moduleId as SubModuleId, id, false);
  }, [plan, moduleId]);

  return { state, plan, verifiableIds, run, apply, untick };
}
