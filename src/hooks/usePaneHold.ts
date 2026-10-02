'use client';

import { createContext, useContext, useEffect } from 'react';

/**
 * Pane holds — how a module tells the shell's keep-alive LRU "I have in-flight
 * work in this pane".
 *
 * The shell (`ModuleRenderer`) can observe CLI sessions and nothing else; a
 * module's own streams, polls and batch chains are invisible to it, so an LRU
 * eviction used to unmount (and cancel) them silently — the interactive UE cook
 * being the worst case (unmount → fetch abort → server `req.signal` → UAT process
 * tree killed). A hold is **positive evidence** folded into the same liveness key
 * as a running CLI session: the LRU prefers an un-held victim, and when every
 * candidate is held the cap still evicts one (memory stays bounded) and the report
 * names the hold's reason.
 *
 * Holds are released by the holder's own effect cleanup, so an unmounted pane can
 * never leave one behind — the registry is bounded by what is mounted.
 */

/** The id of the shell pane a subtree renders in. `null` outside the shell. */
export const PaneIdContext = createContext<string | null>(null);

interface HoldEntry {
  token: symbol;
  reason: string;
}

type PaneHolds = Readonly<Record<string, readonly string[]>>;

const EMPTY: PaneHolds = Object.freeze({});
const registry = new Map<string, HoldEntry[]>();
const listeners = new Set<() => void>();
let snapshot: PaneHolds = EMPTY;

function publish(): void {
  const next: Record<string, readonly string[]> = {};
  for (const [paneId, entries] of registry) next[paneId] = entries.map((e) => e.reason);
  snapshot = registry.size === 0 ? EMPTY : next;
  for (const l of listeners) l();
}

/**
 * The current holds, `{ paneId → reasons }` in registration order. The object is
 * replaced (never mutated) on every change, so it is a stable
 * `useSyncExternalStore` snapshot.
 */
export function getPaneHolds(): PaneHolds {
  return snapshot;
}

export function subscribePaneHolds(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Register one hold; returns its release. Prefer `usePaneHold` from components. */
export function addPaneHold(paneId: string, reason: string): () => void {
  const token = Symbol(reason);
  registry.set(paneId, [...(registry.get(paneId) ?? []), { token, reason }]);
  publish();
  return () => {
    const entries = registry.get(paneId);
    if (!entries?.some((e) => e.token === token)) return;
    const rest = entries.filter((e) => e.token !== token);
    if (rest.length === 0) registry.delete(paneId);
    else registry.set(paneId, rest);
    publish();
  };
}

/**
 * Hold the enclosing shell pane while `active` — the LRU will not choose it as an
 * eviction victim while an un-held candidate exists. `reason` is what the Activity
 * Feed shows if the cap tears it down anyway, so name the work ("UE cook running").
 *
 * A no-op outside a shell pane (the layout lab, previews, tests): there is no LRU
 * there to hold against.
 */
export function usePaneHold(active: boolean, reason: string): void {
  const paneId = useContext(PaneIdContext);
  useEffect(() => {
    if (!active || !paneId) return;
    return addPaneHold(paneId, reason);
  }, [active, paneId, reason]);
}
