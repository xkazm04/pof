import { describe, it, expect } from 'vitest';
import {
  selectStaleModuleIds,
  resolveBatchModules,
  cellReviewState,
} from '@/lib/evaluator/stale-review-plan';
import type { BatchReviewState, ModuleProgress, ModuleReviewStatus } from '@/types/batch-review';
import type { SubModuleId } from '@/types/modules';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-28T12:00:00.000Z');
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

function progress(moduleId: string, status: ModuleReviewStatus): ModuleProgress {
  return {
    moduleId: moduleId as SubModuleId, label: moduleId, featureCount: 1, status,
    executionId: null, startedAt: null, completedAt: null, error: null,
  };
}

function batch(status: BatchReviewState['status'], mods: ModuleProgress[]): BatchReviewState {
  return { batchId: 'b', status, startedAt: ago(0), completedAt: null, modules: mods, currentIndex: 0 };
}

describe('selectStaleModuleIds', () => {
  it('keeps never-reviewed and older-than-threshold modules, in heatmap order', () => {
    const cells = [
      { moduleId: 'a', lastReviewedAt: null },
      { moduleId: 'b', lastReviewedAt: ago(3) },
      { moduleId: 'c', lastReviewedAt: ago(10) },
    ];
    expect(selectStaleModuleIds(cells, 7, NOW)).toEqual(['a', 'c']);
  });

  it('treats an unparseable timestamp as never reviewed', () => {
    expect(selectStaleModuleIds([{ moduleId: 'x', lastReviewedAt: 'not a date' }], 7, NOW)).toEqual(['x']);
  });
});

describe('cellReviewState', () => {
  const running = batch('running', [
    progress('p', 'pending'), progress('r', 'running'), progress('c', 'completed'), progress('e', 'error'),
  ]);

  it('maps pending/running/completed/error to queued/reviewing/reviewed/failed', () => {
    expect(cellReviewState(running, 'p')).toBe('queued');
    expect(cellReviewState(running, 'r')).toBe('reviewing');
    expect(cellReviewState(running, 'c')).toBe('reviewed');
    expect(cellReviewState(running, 'e')).toBe('failed');
  });

  it('is null for a module outside the batch, or with no batch', () => {
    expect(cellReviewState(running, 'zzz')).toBeNull();
    expect(cellReviewState(null, 'p')).toBeNull();
  });

  it('a module still pending when the batch ended is no longer queued', () => {
    expect(cellReviewState(batch('aborted', [progress('p', 'pending')]), 'p')).toBeNull();
  });
});

describe('resolveBatchModules', () => {
  const all = [{ moduleId: 'm1' }, { moduleId: 'm2' }, { moduleId: 'm3' }];

  it('omitted request = every module', () => {
    const r = resolveBatchModules(all, undefined);
    expect(r.ok && r.data.map((m) => m.moduleId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('a subset keeps the requested order and drops duplicates', () => {
    const r = resolveBatchModules(all, ['m3', 'm1', 'm3']);
    expect(r.ok && r.data.map((m) => m.moduleId)).toEqual(['m3', 'm1']);
  });

  it('names every unknown id and refuses an empty or malformed list', () => {
    const r = resolveBatchModules(all, ['m1', 'nope', 'gone']);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('nope');
      expect(r.error).toContain('gone');
    }
    expect(resolveBatchModules(all, []).ok).toBe(false);
    expect(resolveBatchModules(all, 'm1').ok).toBe(false);
    expect(resolveBatchModules(all, [1]).ok).toBe(false);
  });
});
