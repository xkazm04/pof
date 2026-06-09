'use client';
import { useCallback, useState, useSyncExternalStore } from 'react';

export interface LabPrefs {
  themeId: 'light' | 'dark';
  lastCatalogId?: string;
  lastEntityId?: string | null;
}

const KEY = 'pof-lab-prefs';
const DEFAULTS: LabPrefs = { themeId: 'light' };

function read(): LabPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<LabPrefs>;
    return {
      themeId: parsed.themeId === 'dark' ? 'dark' : 'light',
      lastCatalogId: typeof parsed.lastCatalogId === 'string' ? parsed.lastCatalogId : undefined,
      lastEntityId: typeof parsed.lastEntityId === 'string' ? parsed.lastEntityId : null,
    };
  } catch {
    return DEFAULTS;
  }
}

/** True only after hydration — gates reading localStorage so SSR + first client render agree. */
const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export function useLabPrefs() {
  const hydrated = useHydrated();
  const [prefs, setLocal] = useState<LabPrefs>(DEFAULTS);

  // Adopt stored prefs once after hydration. read() returns the DEFAULTS constant
  // (by reference) only on empty/corrupt storage, and a fresh object otherwise — so
  // `stored !== DEFAULTS` covers every field (incl. lastEntityId) and any future ones.
  if (hydrated && prefs === DEFAULTS) {
    const stored = read();
    if (stored !== DEFAULTS) setLocal(stored);
  }

  const effective = hydrated ? prefs : DEFAULTS;

  const setPrefs = useCallback((patch: Partial<LabPrefs>) => {
    setLocal((p) => {
      const next = { ...p, ...patch };
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage full/blocked — keep in-memory */ }
      return next;
    });
  }, []);

  return { prefs: effective, setPrefs, hydrated };
}
