import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

type Status = 'completed' | 'error' | 'skipped' | 'running';
let mockBatch: unknown = null;
vi.mock('@/hooks/useBatchReview', () => ({
  useBatchReview: () => ({
    batch: mockBatch, isRunning: false, isStarting: false, error: null,
    start: vi.fn(), abort: vi.fn(), clear: vi.fn(),
  }),
}));

import { BatchReviewPanel } from '@/components/modules/evaluator/BatchReviewPanel';

afterEach(cleanup);

function batchOf(statuses: Status[]) {
  return {
    batchId: 'b1', status: 'completed', startedAt: '2026-11-08T10:00:00Z', completedAt: '2026-11-08T10:05:00Z',
    currentIndex: statuses.length,
    modules: statuses.map((status, i) => ({
      moduleId: `m${i}`, label: `Module ${i}`, featureCount: 1, status,
      executionId: null, startedAt: null, completedAt: null, error: status === 'error' ? 'x' : null,
    })),
  };
}

const rep = (n: number, s: Status) => Array.from({ length: n }, () => s);

/** The header count "{n}/{total}" and the percentage beside the bar. */
function readProgress(container: HTMLElement) {
  const header = container.querySelector('h3')?.parentElement?.textContent ?? '';
  const m = /(\d+)\/(\d+)/.exec(header);
  const pct = Number(/(\d+)%/.exec(container.textContent ?? '')?.[1]);
  return { numerator: Number(m?.[1]), total: Number(m?.[2]), pct };
}

describe('BatchReviewPanel: one progress rule across header and bar', () => {
  const cases: Array<[string, Status[]]> = [
    ['all ok', rep(4, 'completed')],
    ['5 ok + 5 err', [...rep(5, 'completed'), ...rep(5, 'error')]],
    ['9 ok + 1 skipped', [...rep(9, 'completed'), 'skipped']],
  ];
  for (const [name, statuses] of cases) {
    it(`header count equals the pct numerator: ${name}`, () => {
      mockBatch = batchOf(statuses);
      const { container } = render(<BatchReviewPanel />);
      const { numerator, total, pct } = readProgress(container);
      expect(total).toBe(statuses.length);
      expect(Math.round((numerator / total) * 100)).toBe(pct);
    });
  }
});
