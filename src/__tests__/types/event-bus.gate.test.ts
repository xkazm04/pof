import { describe, it, expect } from 'vitest';
import { eventBus } from '@/lib/event-bus';
import type { EventMap } from '@/types/event-bus';

describe('GateEvents', () => {
  it('typed emit + on round-trip for gate.verdict.changed', () => {
    const received: Array<EventMap['gate.verdict.changed']> = [];
    const unsub = eventBus.on('gate.verdict.changed', (e) => { received.push(e.payload); });
    const payload: EventMap['gate.verdict.changed'] = {
      catalogId: 'items', entityId: 'sword-01', step: 'L3 Runtime Gate', tier: 'L3',
      from: 'deferred', to: 'fail', regression: false, detail: 'VSItemsTest: 1 failed',
    };
    eventBus.emit('gate.verdict.changed', payload, 'test-gate-runner');
    unsub();
    expect(received).toEqual([payload]);
  });

  it('the gate namespace is reachable via onNamespace', () => {
    const got: string[] = [];
    const unsub = eventBus.onNamespace('gate', (e) => got.push(e.channel));
    eventBus.emit('gate.verdict.changed', {
      catalogId: 'c', entityId: 'e', step: 's', tier: 'L4',
      from: 'pass', to: 'fail', regression: true, detail: 'd',
    });
    unsub();
    expect(got).toEqual(['gate.verdict.changed']);
  });
});
