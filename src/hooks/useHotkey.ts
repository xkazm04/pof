'use client';

/**
 * Suspend-aware doors onto the keyboard registry (`@/lib/hotkeys/hotkeyRegistry`).
 *
 * Every hook here registers only while its tree is NOT suspended
 * (`SuspendContext`), so a module pane hidden in the keep-alive LRU is
 * keyboard-inert: the condition that sets `display:none` (ModuleRenderer's
 * `!isVisible`) is the condition that unregisters its keys. Handlers are read
 * through a ref — a new handler identity never re-registers (and never
 * re-orders an Escape layer).
 */
import { useContext, useEffect, useRef } from 'react';
import { useIsSuspended } from '@/hooks/useSuspend';
import { PaneIdContext } from '@/hooks/usePaneHold';
import { hotkeys, type HotkeyHandler, type HotkeyOptions, type HotkeyScope } from '@/lib/hotkeys/hotkeyRegistry';

export interface UseHotkeyOptions extends HotkeyOptions {
  /** Register only while true. Default true. */
  enabled?: boolean;
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return ref;
}

/**
 * Own one chord (or several, sharing one handler). Scope defaults to
 * `module:<paneId>` inside a shell pane (`PaneIdContext`) and `shell` outside
 * one, so a module's binding outranks the shell's while the module is visible.
 */
export function useHotkey(
  chords: string | readonly string[],
  handler: HotkeyHandler,
  opts: UseHotkeyOptions = {},
): void {
  const suspended = useIsSuspended();
  const paneId = useContext(PaneIdContext);
  const handlerRef = useLatest(handler);
  const scope: HotkeyScope = opts.scope ?? (paneId ? `module:${paneId}` : 'shell');
  const { id, allowInInput = false, enabled = true } = opts;
  const chordKey = typeof chords === 'string' ? chords : chords.join('\u0000');

  useEffect(() => {
    if (suspended || !enabled) return;
    const offs = chordKey.split('\u0000').map((chord) =>
      hotkeys.register(chord, (e) => handlerRef.current(e), { scope, id, allowInInput }));
    return () => offs.forEach((off) => off());
  }, [suspended, enabled, chordKey, scope, id, allowInInput, handlerRef]);
}

/**
 * Declare a dismissible layer while `active`: Escape closes the TOPMOST active
 * layer only (LIFO). Escape pops the layer before calling `close`, so `close`
 * must actually close it (turn `active` false).
 */
export function useEscapeLayer(id: string, active: boolean, close: () => void): void {
  const suspended = useIsSuspended();
  const closeRef = useLatest(close);

  useEffect(() => {
    if (suspended || !active) return;
    return hotkeys.pushLayer(id, () => closeRef.current());
  }, [suspended, active, id, closeRef]);
}

/**
 * While `active`, take the next keydown exclusively (capture phase, nothing
 * else sees it) — one-shot; `handler` should end the capturing state. Released
 * when `active` turns false, on unmount, and when the pane is hidden.
 */
export function useCaptureNext(active: boolean, handler: HotkeyHandler): void {
  const suspended = useIsSuspended();
  const handlerRef = useLatest(handler);

  useEffect(() => {
    if (suspended || !active) return;
    return hotkeys.captureNext((e) => handlerRef.current(e));
  }, [suspended, active, handlerRef]);
}
