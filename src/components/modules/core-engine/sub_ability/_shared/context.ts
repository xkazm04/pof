'use client';

import { createContext, useContext } from 'react';
import { seedSpellbookEntries } from '@/lib/catalog/seed-spellbook';
import { buildSpellbookView } from './spellbookView';
import type { SpellbookLiveData } from './types';

export const SpellbookDataCtx = createContext<SpellbookLiveData | null>(null);

const noop = () => {};
let fallback: SpellbookLiveData | null = null;

/**
 * The ONE no-provider fallback: the same `buildSpellbookView` projection over the
 * seeded catalog with no live source. Built once, on first use, so every consumer
 * outside a provider gets the same object identity (stable memo deps).
 */
function staticFallback(): SpellbookLiveData {
  if (!fallback) {
    const view = buildSpellbookView({ live: null, appTags: [], entries: seedSpellbookEntries() });
    fallback = { ...view, isSyncing: false, refresh: noop };
  }
  return fallback;
}

export function useSpellbookData(): SpellbookLiveData {
  return useContext(SpellbookDataCtx) ?? staticFallback();
}
