/**
 * Module-level transient drag state for the spatial stash.
 *
 * HTML5 drag-and-drop's `dataTransfer` is read-only during dragover (so we
 * can't peek at the payload while computing the live drop preview). A tiny
 * subscribable singleton lets the drop target read the in-flight intent
 * without going through React state (which would batch and lag the preview).
 */

import type { ItemFootprint } from '@/lib/spatial-inventory';

export type DragIntent =
  | { kind: 'new'; itemId: string; footprint: ItemFootprint; rotated: boolean }
  | { kind: 'move'; placementId: string; fromTabId: string; footprint: ItemFootprint; rotated: boolean }
  | null;

let _intent: DragIntent = null;
const _listeners = new Set<() => void>();

export function getDragIntent(): DragIntent {
  return _intent;
}

export function setDragIntent(next: DragIntent): void {
  _intent = next;
  for (const l of _listeners) l();
}

export function rotateDragIntent(): void {
  if (!_intent) return;
  _intent = { ..._intent, rotated: !_intent.rotated };
  for (const l of _listeners) l();
}

export function subscribeDragIntent(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
