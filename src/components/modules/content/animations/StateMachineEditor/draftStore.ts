/**
 * Session-scoped draft store for the visual state-machine editor.
 *
 * The editor holds unsaved canvas state (positions, renamed states, hand-drawn
 * transitions) that exists nowhere else — there is no write-to-project path by
 * design. Modules are LRU-cached: a hidden module is first SUSPENDED (still
 * mounted, state intact) and then, once evicted, UNMOUNTED — which silently
 * threw those edits away. This module-scope cache is the flush target: every
 * edit writes through, and a remount after eviction restores the draft and says
 * it did.
 *
 * Deliberately in-memory only. The draft is a work-in-progress graph, not a
 * project artefact; persisting it to disk/localStorage would resurrect a stale
 * machine days later and quietly contradict a fresh scan.
 */

import type { EditorState, EditorTransition } from './types';

export interface EditorDraft {
  states: EditorState[];
  transitions: EditorTransition[];
  /** Epoch ms of the write, so the UI can say how old the restored draft is. */
  savedAt: number;
}

const drafts = new Map<string, EditorDraft>();

export function saveDraft(key: string, draft: Omit<EditorDraft, 'savedAt'>, savedAt: number): void {
  drafts.set(key, { states: draft.states, transitions: draft.transitions, savedAt });
}

export function loadDraft(key: string): EditorDraft | null {
  return drafts.get(key) ?? null;
}

export function clearDraft(key: string): void {
  drafts.delete(key);
}

/** Test/reset hook — drops every draft. */
export function clearDrafts(): void {
  drafts.clear();
}
