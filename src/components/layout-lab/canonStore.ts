'use client';

import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import { allShippedRules } from '@/lib/catalog/canon/profiles';
import type { CanonDrift } from '@/lib/catalog/canon/canonSync';

interface CanonState {
  rules: ProjectRule[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (rule: ProjectRule) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Shipped-vs-DB canon drift (GET ?view=drift); null until loaded or when unreachable. */
  drift: CanonDrift | null;
  loadDrift: () => Promise<void>;
  /** Drift review acts — each POSTs, then re-reads the rules and the drift. */
  adopt: (ids: string[]) => Promise<void>;
  keep: (ids: string[]) => Promise<void>;
  undoAdopt: (ids: string[]) => Promise<void>;
  /** Why the last review act failed (e.g. 403 from requireOperator); null after a success. */
  reviewError: string | null;
}

const postIds = (action: string, ids: string[]) => tryApiFetch(`/api/project-rules?action=${action}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
});

/** Client cache of the project_rules table. Initialised with the seed so canon is available
 *  (and injectable) offline; hydrate() replaces it from the server when reachable. */
export const useCanonStore = create<CanonState>((set, get) => {
  const review = (action: string) => async (ids: string[]) => {
    const r = await postIds(action, ids);
    set({ reviewError: r.ok ? null : `${action} failed: ${r.error}` });
    await Promise.all([get().hydrate(), get().loadDrift()]);
  };
  return {
    // Every profile's shipped rules, so an ingested entity's canon is available offline too.
    rules: allShippedRules(CANON_SEED),
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
      void get().loadDrift();
    },
    drift: null,
    reviewError: null,
    loadDrift: async () => {
      const r = await tryApiFetch<CanonDrift>('/api/project-rules?view=drift');
      if (r.ok) set({ drift: r.data });
    },
    adopt: review('adopt-shipped'),
    keep: review('keep-mine'),
    undoAdopt: review('undo-adopt'),
  };
});
