'use client';

import { useEffect, useRef } from 'react';
import { eventBus } from '@/lib/event-bus';
import type {
  EventChannel,
  EventHandler,
  WildcardHandler,
  BusEvent,
} from '@/types/event-bus';

/**
 * Subscribe to a specific event bus channel.
 * Automatically unsubscribes on unmount.
 *
 * @example
 * useEventBus('cli.task.completed', (event) => {
 *   console.log(event.payload.success);
 * });
 */
export function useEventBus<C extends EventChannel>(
  channel: C,
  handler: EventHandler<C>,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrappedHandler: EventHandler<C> = (event) => {
      handlerRef.current(event);
    };
    return eventBus.on(channel, wrappedHandler);
  }, [channel]);
}

/**
 * Subscribe to all events in a namespace (e.g., 'cli' for all cli.* events).
 * Automatically unsubscribes on unmount.
 *
 * @example
 * useEventBusNamespace('cli', (event) => {
 *   console.log(event.channel, event.payload);
 * });
 */
export function useEventBusNamespace(
  prefix: string,
  handler: WildcardHandler,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrappedHandler: WildcardHandler = (event) => {
      handlerRef.current(event);
    };
    return eventBus.onNamespace(prefix, wrappedHandler);
  }, [prefix]);
}

/**
 * Subscribe to all events (wildcard). Useful for devtools or analytics.
 * Automatically unsubscribes on unmount.
 */
export function useEventBusAll(handler: WildcardHandler): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrappedHandler: WildcardHandler = (event: BusEvent) => {
      handlerRef.current(event);
    };
    return eventBus.onAny(wrappedHandler);
  }, []);
}
