'use client';

import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

interface CanonState {
  rules: ProjectRule[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (rule: ProjectRule) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** Client cache of the project_rules table. Initialised with the seed so canon is available
 *  (and injectable) offline; hydrate() replaces it from the server when reachable. */
export const useCanonStore = create<CanonState>((set) => ({
  rules: CANON_SEED,
  hydrated: false,
  hydrate: async () => {
    const r = await tryApiFetch<ProjectRule[]>('/api/project-rules');
    if (r.ok && r.data.length) set({ rules: r.data, hydrated: true });
    else set({ hydrated: true });
  },
  upsert: async (rule) => {
    set((s) => ({ rules: [...s.rules.filter((x) => x.id !== rule.id), rule] }));
    await tryApiFetch('/api/project-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) });
  },
  remove: async (id) => {
    set((s) => ({ rules: s.rules.filter((x) => x.id !== id) }));
    await tryApiFetch(`/api/project-rules?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
}));
