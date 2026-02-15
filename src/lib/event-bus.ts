import type {
  EventChannel,
  EventPayload,
  EventHandler,
  WildcardHandler,
  BusEvent,
} from '@/types/event-bus';

// ── Typed Event Bus ──
//
// A singleton pub/sub event bus with:
// - Fully typed namespaced channels
// - Namespace prefix subscriptions (e.g., 'cli.*')
// - Replay buffer for late subscribers
// - Wildcard listener for devtools / analytics

type Unsubscribe = () => void;

interface NamespaceSubscription {
  prefix: string;
  handler: WildcardHandler;
}

let _idCounter = 0;

class EventBus {
  private handlers = new Map<EventChannel, Set<EventHandler<never>>>();
  private namespaceHandlers: NamespaceSubscription[] = [];
  private wildcardHandlers = new Set<WildcardHandler>();
  private replayBuffer: BusEvent[] = [];
  private maxReplaySize = 200;

  // ── Publish ──

  emit<C extends EventChannel>(
    channel: C,
    payload: EventPayload<C>,
    source?: string,
  ): BusEvent<C> {
    const event: BusEvent<C> = {
      id: `bus-${Date.now()}-${++_idCounter}`,
      channel,
      payload,
      timestamp: Date.now(),
      source,
    };

    // Store in replay buffer
    this.replayBuffer.push(event as BusEvent);
    if (this.replayBuffer.length > this.maxReplaySize) {
      this.replayBuffer = this.replayBuffer.slice(-this.maxReplaySize);
    }

    // Notify exact channel subscribers
    const channelHandlers = this.handlers.get(channel);
    if (channelHandlers) {
      for (const handler of channelHandlers) {
        try {
          (handler as EventHandler<C>)(event);
        } catch (err) {
          console.error(`[EventBus] Handler error on ${channel}:`, err);
        }
      }
    }

    // Notify namespace subscribers (e.g., 'cli' matches 'cli.task.completed')
    for (const ns of this.namespaceHandlers) {
      if (channel.startsWith(ns.prefix + '.')) {
        try {
          ns.handler(event as BusEvent);
        } catch (err) {
          console.error(`[EventBus] Namespace handler error on ${ns.prefix}:`, err);
        }
      }
    }

    // Notify wildcard subscribers
    for (const handler of this.wildcardHandlers) {
      try {
        handler(event as BusEvent);
      } catch (err) {
        console.error('[EventBus] Wildcard handler error:', err);
      }
    }

    return event;
  }

  // ── Subscribe to exact channel ──

  on<C extends EventChannel>(
    channel: C,
    handler: EventHandler<C>,
  ): Unsubscribe {
    let channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) {
      channelHandlers = new Set();
      this.handlers.set(channel, channelHandlers);
    }
    channelHandlers.add(handler as EventHandler<never>);

    return () => {
      channelHandlers!.delete(handler as EventHandler<never>);
      if (channelHandlers!.size === 0) {
        this.handlers.delete(channel);
      }
    };
  }

  // ── Subscribe to a namespace prefix (e.g., 'cli' for all cli.* events) ──

  onNamespace(prefix: string, handler: WildcardHandler): Unsubscribe {
    const sub: NamespaceSubscription = { prefix, handler };
    this.namespaceHandlers.push(sub);

    return () => {
      this.namespaceHandlers = this.namespaceHandlers.filter((s) => s !== sub);
    };
  }

  // ── Subscribe to all events ──

  onAny(handler: WildcardHandler): Unsubscribe {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  // ── Replay buffer access ──

  /** Get all events in the replay buffer, optionally filtered by channel */
  getReplayBuffer(channel?: EventChannel): BusEvent[] {
    if (!channel) return [...this.replayBuffer];
    return this.replayBuffer.filter((e) => e.channel === channel);
  }

  /** Get replay events matching a namespace prefix */
  getReplayByNamespace(prefix: string): BusEvent[] {
    return this.replayBuffer.filter((e) => e.channel.startsWith(prefix + '.'));
  }

  /** Replay buffered events for a channel to a new subscriber */
  replayTo<C extends EventChannel>(
    channel: C,
    handler: EventHandler<C>,
  ): void {
    const matching = this.replayBuffer.filter((e) => e.channel === channel);
    for (const event of matching) {
      try {
        (handler as EventHandler<C>)(event as BusEvent<C>);
      } catch (err) {
        console.error(`[EventBus] Replay handler error on ${channel}:`, err);
      }
    }
  }

  /** Clear the replay buffer */
  clearReplayBuffer(): void {
    this.replayBuffer = [];
  }

  // ── Utilities ──

  /** Number of active subscriptions (for devtools) */
  get subscriberCount(): number {
    let count = this.wildcardHandlers.size + this.namespaceHandlers.length;
    for (const handlers of this.handlers.values()) {
      count += handlers.size;
    }
    return count;
  }

  /** List of channels with active subscribers */
  get activeChannels(): EventChannel[] {
    return Array.from(this.handlers.keys()).filter(
      (ch) => this.handlers.get(ch)!.size > 0,
    );
  }

  /** Remove all subscriptions (useful for testing) */
  reset(): void {
    this.handlers.clear();
    this.namespaceHandlers = [];
    this.wildcardHandlers.clear();
    this.replayBuffer = [];
  }
}

/** Singleton event bus instance */
export const eventBus = new EventBus();
