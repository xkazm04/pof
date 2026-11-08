/**
 * Subscription handles on the event bus are resources: releasing one twice must
 * not touch anybody else's subscription.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus } from '@/lib/event-bus';
import type { EventChannel, EventPayload } from '@/types/event-bus';

const CHANNEL = 'oneshot.started' as EventChannel;
const PAYLOAD = {} as EventPayload<EventChannel>;

beforeEach(() => eventBus.reset());

describe('eventBus.on unsubscribe', () => {
  it('a repeated unsubscribe leaves a later subscriber on the same channel alone', () => {
    const first = vi.fn();
    const unsubFirst = eventBus.on(CHANNEL, first);
    unsubFirst(); // the channel's handler set empties and is dropped

    const second = vi.fn();
    eventBus.on(CHANNEL, second);

    unsubFirst(); // stale handle: must be a no-op
    eventBus.emit(CHANNEL, PAYLOAD);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(eventBus.subscriberCount).toBe(1);
  });

  it('still drops the channel once its last subscriber leaves', () => {
    const unsub = eventBus.on(CHANNEL, vi.fn());
    expect(eventBus.activeChannels).toEqual([CHANNEL]);
    unsub();
    expect(eventBus.activeChannels).toEqual([]);
  });
});
