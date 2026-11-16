import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

/**
 * The one-shot completion toast must not paint a run with failed steps as a success. The
 * orchestrator emits `oneshot.completed` for every finished run that is not ALL failures, so a
 * run of 9 passed / 3 failed used to arrive as a green `toast.success` check mark.
 */
const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { eventBus } from '@/lib/event-bus';
import { setupOneShotToastHandler } from '@/components/layout-lab/one-shot/toastHandler';

const base = { jobId: 'j1', jobName: 'items', totalSteps: 12, ran: 12, skipped: 0, deferred: 0, catalogId: 'items', entityId: 'item-x' };
let teardown: () => void;

beforeEach(() => { vi.clearAllMocks(); teardown = setupOneShotToastHandler(); });
afterEach(() => teardown());

describe('one-shot completion toast', () => {
  it('a run with failed steps is a warning, not a success', () => {
    eventBus.emit('oneshot.completed', { ...base, passed: 9, failed: 3 });
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(String(toast.warning.mock.calls[0][0])).toContain('3 failed');
  });

  it('a run with no failed step stays a success', () => {
    eventBus.emit('oneshot.completed', { ...base, passed: 12, failed: 0 });
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});
