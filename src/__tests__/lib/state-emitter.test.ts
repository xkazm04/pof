import { describe, it, expect, vi } from 'vitest';
import { createStateEmitter } from '@/lib/state-emitter';
import { logger } from '@/lib/logger';

interface DemoState {
  status: string;
  count: number;
}

const initial: DemoState = { status: 'idle', count: 0 };

describe('createStateEmitter', () => {
  it('getState returns a defensive shallow clone of the current state', () => {
    const emitter = createStateEmitter<DemoState>({ label: '[demo]', initial });

    const snapshot = emitter.getState();
    expect(snapshot).toEqual({ status: 'idle', count: 0 });

    // Mutating the returned snapshot must not leak into internal state.
    snapshot.count = 99;
    expect(emitter.getState().count).toBe(0);
  });

  it('setState merges the partial into existing state', () => {
    const emitter = createStateEmitter<DemoState>({ label: '[demo]', initial });

    emitter.setState({ status: 'running' });
    expect(emitter.getState()).toEqual({ status: 'running', count: 0 });

    emitter.setState({ count: 5 });
    expect(emitter.getState()).toEqual({ status: 'running', count: 5 });
  });

  it('peek returns the live state without cloning (for internal reads)', () => {
    const emitter = createStateEmitter<DemoState>({ label: '[demo]', initial });
    emitter.setState({ count: 7 });

    expect(emitter.peek().count).toBe(7);
    // Same reference returned twice — no clone churn for hot internal reads.
    expect(emitter.peek()).toBe(emitter.peek());
  });

  it('setState notifies subscribers with a fresh snapshot', () => {
    const emitter = createStateEmitter<DemoState>({ label: '[demo]', initial });
    const received: DemoState[] = [];
    emitter.subscribe((s) => received.push(s));

    emitter.setState({ status: 'running' });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ status: 'running', count: 0 });
  });

  it('subscribe returns an unsubscribe that stops further notifications', () => {
    const emitter = createStateEmitter<DemoState>({ label: '[demo]', initial });
    const handler = vi.fn();
    const unsubscribe = emitter.subscribe(handler);

    emitter.setState({ count: 1 });
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitter.setState({ count: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isolates a throwing subscriber so siblings still run, and logs with the label', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const emitter = createStateEmitter<DemoState>({ label: '[demo]', initial });

    const after = vi.fn();
    emitter.subscribe(() => {
      throw new Error('boom');
    });
    emitter.subscribe(after);

    emitter.setState({ count: 1 });

    expect(after).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[demo] Subscriber error:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('uses a custom clone for getState and notifications (deep-clones a Map)', () => {
    interface MapState {
      items: Map<string, number>;
    }
    const emitter = createStateEmitter<MapState>({
      label: '[map]',
      initial: { items: new Map() },
      clone: (s) => ({ ...s, items: new Map(s.items) }),
    });

    const received: MapState[] = [];
    emitter.subscribe((s) => received.push(s));

    const next = new Map([['a', 1]]);
    emitter.setState({ items: next });

    // The snapshot's Map must be a distinct instance from the internal one.
    const snapshot = emitter.getState();
    expect(snapshot.items.get('a')).toBe(1);
    expect(snapshot.items).not.toBe(emitter.peek().items);
    expect(received[0].items).not.toBe(emitter.peek().items);
  });

  it('size reflects the number of active subscribers', () => {
    const emitter = createStateEmitter<DemoState>({ label: '[demo]', initial });
    expect(emitter.size).toBe(0);

    const off1 = emitter.subscribe(() => {});
    const off2 = emitter.subscribe(() => {});
    expect(emitter.size).toBe(2);

    off1();
    expect(emitter.size).toBe(1);
    off2();
    expect(emitter.size).toBe(0);
  });

  it('does not share state between two independently created emitters', () => {
    const a = createStateEmitter<DemoState>({ label: '[a]', initial });
    const b = createStateEmitter<DemoState>({ label: '[b]', initial });

    a.setState({ count: 1 });
    expect(a.getState().count).toBe(1);
    expect(b.getState().count).toBe(0);
  });
});
