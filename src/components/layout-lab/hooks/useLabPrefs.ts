'use client';
import { useCallback, useState, useSyncExternalStore } from 'react';
import type { LabDensity } from '../theme';

export interface LabPrefs {
  themeId: 'light' | 'dark';
  density: LabDensity;
  lastCatalogId?: string;
  lastEntityId?: string | null;
}

const KEY = 'pof-lab-prefs';
const DEFAULTS: LabPrefs = { themeId: 'light', density: 'comfortable' };

function read(): LabPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<LabPrefs>;
    return {
      themeId: parsed.themeId === 'dark' ? 'dark' : 'light',
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
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

  // First post-hydration pass: adopt stored prefs once, via a render-phase bail-out
  // (NOT an effect — keeps clear of react-hooks/set-state-in-effect).
  if (hydrated && prefs === DEFAULTS) {
    const stored = read();
    if (
      stored.themeId !== DEFAULTS.themeId ||
      stored.density !== DEFAULTS.density ||
      stored.lastCatalogId
    ) {
      setLocal(stored);
    }
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
