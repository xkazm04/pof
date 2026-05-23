import { describe, it, expect } from 'vitest';
import { computeDispatchHealth } from './dispatchHealth';
import type { BusEvent, EventChannel } from '@/types/event-bus';

let seq = 0;
function ev<C extends EventChannel>(channel: C, payload: unknown, timestamp: number): BusEvent {
  return { id: `e-${++seq}`, channel, payload, timestamp } as BusEvent;
}

describe('computeDispatchHealth', () => {
  it('counts sent / acknowledged / succeeded / failed from cli.task events', () => {
    const events: BusEvent[] = [
      ev('cli.task.started', { tabId: 't1', sessionLabel: 'A' }, 1000),
      ev('cli.task.completed', { tabId: 't1', sessionLabel: 'A', success: true }, 2000),
      ev('cli.task.started', { tabId: 't2', sessionLabel: 'B' }, 3000),
      ev('cli.task.completed', { tabId: 't2', sessionLabel: 'B', success: false }, 4000),
    ];
    const h = computeDispatchHealth(events, { now: 5000 });
    expect(h.sent).toBe(2);
    expect(h.acknowledged).toBe(2);
    expect(h.succeeded).toBe(1);
    expect(h.failed).toBe(1);
    expect(h.inFlight).toBe(0);
    expect(h.stuck).toBe(0);
  });

  it('flags a started-but-never-completed dispatch as in-flight, and stuck past the threshold', () => {
    const events: BusEvent[] = [
      ev('cli.task.started', { tabId: 't1', sessionLabel: 'slow' }, 0),
    ];
    const fresh = computeDispatchHealth(events, { now: 60_000, stuckThresholdMs: 15 * 60_000 });
    expect(fresh.inFlight).toBe(1);
    expect(fresh.stuck).toBe(0);

    const old = computeDispatchHealth(events, { now: 20 * 60_000, stuckThresholdMs: 15 * 60_000 });
    expect(old.inFlight).toBe(1);
    expect(old.stuck).toBe(1);
  });

  it('a re-dispatch on the same tab does not leave the prior start permanently in-flight', () => {
    const events: BusEvent[] = [
      ev('cli.task.started', { tabId: 't1', sessionLabel: 'A' }, 1000),
      ev('cli.task.completed', { tabId: 't1', sessionLabel: 'A', success: true }, 2000),
      ev('cli.task.started', { tabId: 't1', sessionLabel: 'A' }, 3000),
    ];
    const h = computeDispatchHealth(events, { now: 3500 });
    expect(h.sent).toBe(2);
    expect(h.acknowledged).toBe(1);
    expect(h.inFlight).toBe(1);
  });

  it('tracks active sessions from created/removed', () => {
    const events: BusEvent[] = [
      ev('cli.session.created', { tabId: 't1', sessionLabel: 'A' }, 1),
      ev('cli.session.created', { tabId: 't2', sessionLabel: 'B' }, 2),
      ev('cli.session.removed', { tabId: 't1' }, 3),
    ];
    const h = computeDispatchHealth(events);
    expect(h.sessionsCreated).toBe(2);
    expect(h.sessionsRemoved).toBe(1);
    expect(h.activeSessions).toBe(1);
  });

  it('orders recent newest-first and respects recentLimit', () => {
    const events: BusEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(ev('cli.task.started', { tabId: `t${i}`, sessionLabel: `S${i}` }, i * 10));
      events.push(ev('cli.task.completed', { tabId: `t${i}`, sessionLabel: `S${i}`, success: true }, i * 10 + 5));
    }
    const h = computeDispatchHealth(events, { recentLimit: 3, now: 1000 });
    expect(h.recent).toHaveLength(3);
    expect(h.recent[0].sessionLabel).toBe('S4');
    expect(h.recent[2].sessionLabel).toBe('S2');
  });

  it('handles an empty event list', () => {
    const h = computeDispatchHealth([]);
    expect(h).toMatchObject({ sent: 0, acknowledged: 0, inFlight: 0, stuck: 0, activeSessions: 0 });
    expect(h.recent).toEqual([]);
  });
});
