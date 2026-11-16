'use client';

import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import type { Result } from '@/types/result';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import { allShippedRules } from '@/lib/catalog/canon/profiles';
import type { CanonDrift } from '@/lib/catalog/canon/canonSync';

interface CanonState {
  rules: ProjectRule[];
  hydrated: boolean;
  /** Why the last hydrate could not read the DB rules (the cache is then the offline seed); null after a good read. */
  hydrateError: string | null;
  hydrate: () => Promise<void>;
  /** POSTs, and commits locally ONLY when the server stored it — lab prompts read these rules, so an
   *  optimistic write would cite a law the dispatch (which reads the DB) never carries. A refusal is
   *  returned (the server's reason), never swallowed. */
  upsert: (rule: ProjectRule) => Promise<Result<ProjectRule, string>>;
  /** DELETEs, and drops the rule locally ONLY when the server did - a refusal keeps the law in the cache
   *  (the DB, which prompts read, still holds it) and is returned for the confirm dialog to show. */
  remove: (id: string) => Promise<Result<void, string>>;
  /** Shipped-vs-DB canon drift (GET ?view=drift); null until loaded or when unreachable. */
  drift: CanonDrift | null;
  loadDrift: () => Promise<void>;
  /** Drift review acts — each POSTs, then re-reads the rules and the drift. */
  adopt: (ids: string[]) => Promise<void>;
  keep: (ids: string[]) => Promise<void>;
  undoAdopt: (ids: string[]) => Promise<void>;
  /** Why the last review act failed (e.g. 403 from requireOperator); null after a success. */
  reviewError: string | null;
  /** The profile `reviewError` happened on (looked up from the acted ids), so only that profile's review shows it; null = unattributable, shown everywhere. */
  reviewErrorProfile: string | null;
}

/** The profile a review act ran on: the profile of the first acted id in the drift read, else null. */
function profileOfIds(drift: CanonDrift | null, ids: string[]): string | null {
  if (!drift) return null;
  for (const id of ids) {
    const adopted = drift.adopted.find((a) => a.id === id);
    if (adopted) return adopted.profile;
    for (const [profile, byVerdict] of Object.entries(drift.byProfile)) {
      if (Object.values(byVerdict).some((fs) => fs?.some((f) => f.id === id))) return profile;
    }
  }
  return null;
}

const postIds = (action: string, ids: string[]) => tryApiFetch(`/api/project-rules?action=${action}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
});

/** Client cache of the project_rules table. Initialised with the seed so canon is available
 *  (and injectable) offline; hydrate() replaces it from the server when reachable. */
export const useCanonStore = create<CanonState>((set, get) => {
  const review = (action: string) => async (ids: string[]) => {
    const profile = profileOfIds(get().drift, ids);
    const r = await postIds(action, ids);
    set({ reviewError: r.ok ? null : `${action} failed: ${r.error}`, reviewErrorProfile: r.ok ? null : profile });
    await Promise.all([get().hydrate(), get().loadDrift()]);
  };
  return {
    // Every profile's shipped rules, so an ingested entity's canon is available offline too.
    rules: allShippedRules(CANON_SEED),
    hydrated: false,
    hydrateError: null,
    hydrate: async () => {
      const r = await tryApiFetch<ProjectRule[]>('/api/project-rules');
      if (!r.ok) set({ hydrated: true, hydrateError: r.error });
      else if (r.data.length) set({ rules: r.data, hydrated: true, hydrateError: null });
      else set({ hydrated: true, hydrateError: null });
    },
    upsert: async (rule) => {
      const r = await tryApiFetch<ProjectRule>('/api/project-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rule) });
      if (!r.ok) return r;
      set((s) => ({ rules: [...s.rules.filter((x) => x.id !== rule.id), rule] }));
      return { ok: true, data: rule };
    },
    remove: async (id) => {
      const r = await tryApiFetch(`/api/project-rules?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) return { ok: false, error: r.error };
      set((s) => ({ rules: s.rules.filter((x) => x.id !== id) }));
      void get().loadDrift();
      return { ok: true, data: undefined };
    },
    drift: null,
    reviewError: null,
    reviewErrorProfile: null,
    loadDrift: async () => {
      const r = await tryApiFetch<CanonDrift>('/api/project-rules?view=drift');
      if (r.ok) set({ drift: r.data });
    },
    adopt: review('adopt-shipped'),
    keep: review('keep-mine'),
    undoAdopt: review('undo-adopt'),
  };
});
