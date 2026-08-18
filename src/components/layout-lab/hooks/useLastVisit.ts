'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useLabPrefs, setLabPrefs } from './useLabPrefs';

/**
 * "When was I last here?" for one catalog — the baseline the changed-since digest compares
 * against.
 *
 * ── The freeze ────────────────────────────────────────────────────────────────
 * Opening a catalog both READS the stored stamp and REPLACES it with now. If the digest
 * compared against the stored value it would compare against the visit currently happening
 * and always be empty, so the previous stamp is frozen for the life of the page in a small
 * external store. Re-opening the same catalog in one session therefore keeps answering "since
 * your last REAL visit", not "since ten seconds ago".
 *
 * The stamp is written from an effect and read through `useSyncExternalStore` — the same
 * discipline the artifact cache uses — because both halves are external systems
 * (localStorage, and the session-scoped freeze), not React state. Nothing here reads the
 * clock during render.
 */

/** catalogId → the stamp this page session compares against (`null` = no baseline). */
const frozen = new Map<string, string | null>();
let version = 0;
const listeners = new Set<() => void>();

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function emit(): void {
  version += 1;
  for (const l of listeners) l();
}

export interface LastVisit {
  /** The moment to compare against, or `null` when this catalog has no baseline yet. */
  since: string | null;
  /** Has this visit been recorded yet? False for the render before the effect runs. */
  recorded: boolean;
}

export function useLastVisit(catalogId: string): LastVisit {
  const { prefs, hydrated } = useLabPrefs();
  // Re-render when a visit is recorded (the freeze lives outside React).
  useSyncExternalStore(subscribe, () => version, () => 0);

  useEffect(() => {
    if (!hydrated || frozen.has(catalogId)) return;
    const visits = prefs.lastVisitByCatalog ?? {};
    // Freeze BEFORE stamping, or this visit would become its own baseline.
    frozen.set(catalogId, visits[catalogId] ?? null);
    setLabPrefs({ lastVisitByCatalog: { ...visits, [catalogId]: new Date().toISOString() } });
    emit();
  }, [catalogId, hydrated, prefs]);

  return { since: frozen.get(catalogId) ?? null, recorded: frozen.has(catalogId) };
}

/** Test-only: forget every frozen baseline. */
export function _resetLastVisits(): void {
  frozen.clear();
  version = 0;
  listeners.clear();
}
