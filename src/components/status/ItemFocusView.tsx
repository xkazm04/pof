'use client';

/**
 * Item Focus tab — the entity-centric view. For one chosen entity it shows its origin
 * pipeline's REALIZATION (did this entity produce each step) plus a 1-hop, both-direction
 * dependency map: the presentation entries it binds (forward) and the loot/crafting/
 * bestiary rows that reference it (reverse). Every node is a mini-swimlane of its own
 * realization and is clickable to walk the graph.
 *
 * All aggregation is the pure resolveItemFocus(); this component only wires the client
 * data sources: catalog-store entities (with links), per-catalog artifacts, judge verdicts.
 */
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { useCatalogStore } from '@/stores/catalogStore';
import { fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import { tryApiFetch } from '@/lib/api-utils';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { StepMeta } from '@/lib/status/statusModel';
import {
  buildDependencyIndex,
  resolveItemFocus,
  entityKey,
  type ItemFocusCtx,
} from '@/lib/status/itemFocusModel';
import { MiniSwimlane } from './MiniSwimlane';
import { EntitySearch } from './EntitySearch';

function stepsFor(catalogId: string): StepMeta[] {
  const p = getCatalogPipeline(catalogId);
  return p ? p.steps.map((s) => ({ label: s.label, archetype: s.archetype, engine: s.engine })) : [];
}

/**
 * Group separator. A real `h2` (the page's only `h1` is the /status title) so the three
 * groups are screen-reader landmarks you can jump between, not styled divs. The direction
 * glyph is decorative — the heading text already names the direction — and the optional
 * `hint` carries the plain-language examples at a lower visual weight.
 * Text uses `--text-subtle`, not `--lab-muted` (3.7:1 on the Blueprint floor at 14px).
 */
function GroupHeading({ glyph, hint, children }: { glyph?: string; hint?: string; children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 'var(--lab-s4) 0 var(--lab-s2)' }}>
      {glyph && <span aria-hidden="true" style={{ marginRight: 6 }}>{glyph}</span>}
      {children}
      {hint && (
        <span style={{ marginLeft: 'var(--lab-s2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
          {hint}
        </span>
      )}
    </h2>
  );
}

export function ItemFocusView({
  focus,
  onFocus,
}: {
  focus: { catalogId: string; entityId: string } | null;
  onFocus: (catalogId: string, entityId: string) => void;
}) {
  const entitiesByCatalog = useCatalogStore(useShallow((s) => s.entitiesByCatalog));
  const index = useMemo(() => buildDependencyIndex(entitiesByCatalog), [entitiesByCatalog]);

  // The catalogs whose artifacts we must load: the focus catalog + every catalog a
  // 1-hop forward/reverse edge touches. Derived synchronously from the index.
  const involvedCatalogs = useMemo(() => {
    if (!focus) return [];
    const set = new Set<string>([focus.catalogId]);
    const key = entityKey(focus.catalogId, focus.entityId);
    for (const l of index.forward.get(key) ?? []) set.add(l.catalogId);
    for (const r of index.reverse.get(key) ?? []) set.add(r.catalogId);
    return [...set].sort();
  }, [focus, index]);

  const [artifacts, setArtifacts] = useState<Record<string, PipelineArtifact[]>>({});
  const [verdicts, setVerdicts] = useState<Record<string, JudgeVerdict[]>>({});
  // Which catalog set the loaded artifacts/verdicts actually cover. Compared against the
  // current set during render to derive `loading` — no set-state-in-effect reset needed
  // (this component is NOT remounted when the focus changes, unlike CategoryView).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (involvedCatalogs.length === 0) return;
    (async () => {
      const [artResults, verdictRes] = await Promise.all([
        Promise.all(involvedCatalogs.map((c) => fetchArtifacts(c))),
        tryApiFetch<JudgeVerdict[]>('/api/judge-verdicts'),
      ]);
      if (!alive) return;
      const artMap: Record<string, PipelineArtifact[]> = {};
      involvedCatalogs.forEach((c, i) => { artMap[c] = artResults[i]; });
      setArtifacts(artMap);
      const vMap: Record<string, JudgeVerdict[]> = {};
      for (const v of verdictRes.ok ? verdictRes.data : []) {
        (vMap[v.catalogId] ??= []).push(v);
      }
      setVerdicts(vMap);
      setLoadedKey(involvedCatalogs.join('|'));
    })();
    return () => { alive = false; };
  }, [involvedCatalogs]);

  const result = useMemo(() => {
    if (!focus) return null;
    const ctx: ItemFocusCtx = {
      entitiesByCatalog,
      index,
      stepsFor,
      artifactsFor: (c) => artifacts[c] ?? [],
      verdictsFor: (c) => verdicts[c] ?? [],
    };
    return resolveItemFocus(focus.catalogId, focus.entityId, ctx);
  }, [focus, entitiesByCatalog, index, artifacts, verdicts]);

  // Until this focus's artifacts + verdicts land, every cell would grade as unwired/0% —
  // a lie, not a blank. Names/links are store-local and correct immediately, so the rows
  // stay up but read as provisional (dimmed + aria-busy) until the evidence arrives.
  const loading = result !== null && loadedKey !== involvedCatalogs.join('|');

  return (
    <div>
      <EntitySearch onFocus={onFocus} />

      {!focus && (
        <div style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--text-subtle)', maxWidth: 620 }}>
          Search an entity above (a sword, a loot table, a character…) to see its pipeline
          realization and the pipelines it connects to. You can also open one by clicking a
          pipeline on the <strong>Pipelines</strong> tab.
        </div>
      )}

      {/* Load / not-found transitions are announced, not just drawn. */}
      <div role="status" aria-live="polite">
        {focus && !result && (
          <div style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-bad)', maxWidth: 620 }}>
            Entity <code>{focus.catalogId}:{focus.entityId}</code> is not in the catalog store — it may
            have been renamed or removed. Search for another entity above.
          </div>
        )}
        {loading && (
          <div style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--text-subtle)' }}>
            Loading gate evidence for {involvedCatalogs.length} {involvedCatalogs.length === 1 ? 'pipeline' : 'pipelines'} — the grades below are not final yet…
          </div>
        )}
      </div>

      {result && (
        <div
          aria-busy={loading}
          style={{ overflowX: 'auto', opacity: loading ? 0.5 : 1, transition: 'opacity var(--lab-dur-fast) var(--lab-ease)' }}
        >
          <GroupHeading>Origin pipeline · realization</GroupHeading>
          <MiniSwimlane node={result.focus} emphasis onFocus={onFocus} />

          {result.reverse.length > 0 && (
            <>
              <GroupHeading glyph="◂" hint="e.g. loot tables, crafting, owners">
                Referenced by ({result.reverse.length})
              </GroupHeading>
              {result.reverse.map((n) => (
                <MiniSwimlane key={entityKey(n.catalogId, n.entityId)} node={n} direction="reverse" onFocus={onFocus} />
              ))}
            </>
          )}

          {result.forward.length > 0 && (
            <>
              <GroupHeading glyph="▸" hint="e.g. icon, vfx, audio, loot">
                Links to ({result.forward.length})
              </GroupHeading>
              {result.forward.map((n) => (
                <MiniSwimlane key={entityKey(n.catalogId, n.entityId)} node={n} direction="forward" onFocus={onFocus} />
              ))}
            </>
          )}

          {result.reverse.length === 0 && result.forward.length === 0 && (
            <div style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--text-subtle)', marginTop: 'var(--lab-s3)' }}>
              No cross-pipeline links recorded for this entity — nothing binds it, and nothing references it yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
