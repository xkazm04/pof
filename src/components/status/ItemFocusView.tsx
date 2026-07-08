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

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 'var(--lab-s4) 0 var(--lab-s2)' }}>
      {children}
    </div>
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

  return (
    <div>
      <EntitySearch onFocus={onFocus} />

      {!focus && (
        <div style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-muted)', maxWidth: 620 }}>
          Search an entity above (a sword, a loot table, a character…) to see its pipeline
          realization and the pipelines it connects to. You can also open one by clicking a
          pipeline on the <strong>Pipelines</strong> tab.
        </div>
      )}

      {focus && !result && (
        <div style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-bad)' }}>
          Entity <code>{focus.catalogId}:{focus.entityId}</code> not found.
        </div>
      )}

      {result && (
        <div style={{ overflowX: 'auto' }}>
          <GroupHeading>Origin pipeline · realization</GroupHeading>
          <MiniSwimlane node={result.focus} emphasis onFocus={onFocus} />

          {result.reverse.length > 0 && (
            <>
              <GroupHeading>◂ Referenced by ({result.reverse.length}) · e.g. loot tables, crafting, owners</GroupHeading>
              {result.reverse.map((n) => (
                <MiniSwimlane key={entityKey(n.catalogId, n.entityId)} node={n} direction="reverse" onFocus={onFocus} />
              ))}
            </>
          )}

          {result.forward.length > 0 && (
            <>
              <GroupHeading>▸ Links to ({result.forward.length}) · e.g. icon, vfx, audio, loot</GroupHeading>
              {result.forward.map((n) => (
                <MiniSwimlane key={entityKey(n.catalogId, n.entityId)} node={n} direction="forward" onFocus={onFocus} />
              ))}
            </>
          )}

          {result.reverse.length === 0 && result.forward.length === 0 && (
            <div style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', marginTop: 'var(--lab-s3)' }}>
              No cross-pipeline links recorded for this entity.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
