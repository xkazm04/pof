import { describe, it, expect } from 'vitest';
import { eventBus } from '@/lib/event-bus';
import type { EventMap } from '@/types/event-bus';

describe('OneShotJobEvents', () => {
  it('typed emit + on round-trip for oneshot.started', () => {
    const received: Array<EventMap['oneshot.started']> = [];
    const unsub = eventBus.on('oneshot.started', (e) => { received.push(e.payload); });
    eventBus.emit('oneshot.started', { jobId: 'j1', jobName: 'Items', totalSteps: 13, catalogId: 'items', entityId: 'draft-items-1' });
    unsub();
    expect(received).toEqual([{ jobId: 'j1', jobName: 'Items', totalSteps: 13, catalogId: 'items', entityId: 'draft-items-1' }]);
  });

  it('typed emit + on for the four channels', () => {
    const got: string[] = [];
    const unsubs = [
      eventBus.on('oneshot.started', () => got.push('started')),
      eventBus.on('oneshot.step-completed', () => got.push('step')),
      eventBus.on('oneshot.completed', () => got.push('completed')),
      eventBus.on('oneshot.failed', () => got.push('failed')),
    ];
    eventBus.emit('oneshot.started', { jobId: 'j', jobName: 'n', totalSteps: 1, catalogId: 'c', entityId: 'e' });
    eventBus.emit('oneshot.step-completed', { jobId: 'j', stepIndex: 0, totalSteps: 1, stepName: 's', outcome: 'pass' });
    eventBus.emit('oneshot.completed', { jobId: 'j', jobName: 'n', totalSteps: 1, ran: 1, passed: 1, failed: 0, skipped: 0, deferred: 0, catalogId: 'c', entityId: 'e' });
    eventBus.emit('oneshot.failed', { jobId: 'j', jobName: 'n', stepIndex: 0, totalSteps: 1, error: 'x' });
    unsubs.forEach((u) => u());
    expect(got).toEqual(['started', 'step', 'completed', 'failed']);
  });
});
