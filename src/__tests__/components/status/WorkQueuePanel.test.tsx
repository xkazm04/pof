import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { WorkQueuePanel } from '@/components/status/WorkQueuePanel';
import type { WorkItem } from '@/lib/status/workQueue';

afterEach(cleanup);

const item = (state: WorkItem['state'], level: WorkItem['level']): WorkItem => ({
  catalogId: 'c', step: 'S', cell: { label: 'S', engine: 'Claude', grade: 'deferred', counts: { pass: 0, deferred: 1, fail: 0, pending: 0 } },
  route: 'other-gate', level, state, because: 'x', parked: false, readyPct: 0,
});

describe('WorkQueuePanel headline', () => {
  it('counts steps that are not yet at R3, because waiting R4 and blocked R3 cells are in the queue', () => {
    const { container } = render(<WorkQueuePanel items={[item('waiting', 'R4')]} onOpen={() => {}} />);
    expect(container.textContent).toContain('not yet at R3');
    expect(container.textContent).not.toContain('below R3');
  });
});
