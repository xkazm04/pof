'use client';

/**
 * Category tab — the middle drill layer between Pipelines (all catalogs) and Item Focus
 * (one entity). For one catalog it aggregates EVERY entity using the same per-entity
 * realization logic as Item Focus, and floats the weakest to the top: sorted by
 * gate-verified coverage ascending, then name ascending. This is the "where are the
 * weakest links" overview — max 20 rows per page.
 *
 * With no catalog selected it shows a picker of every pipeline catalog.
 */
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { useCatalogStore } from '@/stores/catalogStore';
import { fetchArtifacts } from '@/components/layout-lab/labArtifactClient';
import { tryApiFetch } from '@/lib/api-utils';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { StepMeta } from '@/lib/status/statusModel';
import { buildCategoryNodes, type SwimlaneCtx } from '@/lib/status/itemFocusModel';
import { MiniSwimlane } from './MiniSwimlane';

const PAGE_SIZE = 20;

function stepsFor(catalogId: string): StepMeta[] {
  const p = getCatalogPipeline(catalogId);
  return p ? p.steps.map((s) => ({ label: s.label, archetype: s.archetype, engine: s.engine })) : [];
}

const LABELS = new Map(CATALOG_SECTIONS.map((s) => [s.catalogId, s.label]));
function catalogLabel(catalogId: string): string {
  return LABELS.get(catalogId) ?? catalogId;
}

/** Picker shown when the Category tab has no catalog selected. */
function CatalogPicker({ onPick }: { onPick: (catalogId: string) => void }) {
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const catalogs = useMemo(
    () => allCatalogPipelines().map((p) => p.catalogId).sort((a, b) => catalogLabel(a).localeCompare(catalogLabel(b))),
    [],
  );
  return (
    <div>
      <div style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', marginBottom: 'var(--lab-s3)', maxWidth: 620 }}>
        Pick a catalog to see every entity ranked weakest-first (least gate-verified coverage on top).
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--lab-s2)' }}>
        {catalogs.map((c) => {
          const count = Object.keys(entitiesByCatalog[c] ?? {}).length;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onPick(c)}
              className="focus-ring"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: 'var(--lab-s2) var(--lab-s3)',
                textAlign: 'left',
                minWidth: 160,
                background: 'color-mix(in srgb, var(--lab-ink) 6%, transparent)',
                border: '1px solid var(--lab-line)',
                borderRadius: 'var(--lab-r-sm)',
                cursor: 'pointer',
                color: 'var(--lab-text)',
              }}
            >
              <span style={{ fontFamily: 'var(--lab-font-mono)', fontWeight: 700, fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-ink)' }}>{catalogLabel(c)}</span>
              <span style={{ fontSize: 'var(--lab-fs-2xs, 10px)', color: 'var(--lab-muted)' }}>{count} {count === 1 ? 'entity' : 'entities'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryView({
  catalogId,
  onFocusEntity,
  onPickCatalog,
}: {
  catalogId: string | null;
  onFocusEntity: (catalogId: string, entityId: string) => void;
  onPickCatalog: (catalogId: string) => void;
}) {
  const entitiesByCatalog = useCatalogStore(useShallow((s) => s.entitiesByCatalog));
  const [artifacts, setArtifacts] = useState<PipelineArtifact[]>([]);
  const [verdicts, setVerdicts] = useState<JudgeVerdict[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!catalogId) return;
    (async () => {
      const [art, verdictRes] = await Promise.all([
        fetchArtifacts(catalogId),
        tryApiFetch<JudgeVerdict[]>('/api/judge-verdicts'),
      ]);
      if (!alive) return;
      setArtifacts(art);
      setVerdicts((verdictRes.ok ? verdictRes.data : []).filter((v) => v.catalogId === catalogId));
    })();
    return () => { alive = false; };
  }, [catalogId]);

  const nodes = useMemo(() => {
    if (!catalogId) return [];
    const ctx: SwimlaneCtx = {
      stepsFor,
      artifactsFor: (c) => (c === catalogId ? artifacts : []),
      verdictsFor: (c) => (c === catalogId ? verdicts : []),
    };
    return buildCategoryNodes(catalogId, entitiesByCatalog, ctx);
  }, [catalogId, entitiesByCatalog, artifacts, verdicts]);

  if (!catalogId) return <CatalogPicker onPick={onPickCatalog} />;

  const pageCount = Math.max(1, Math.ceil(nodes.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const rows = nodes.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--lab-s3)', flexWrap: 'wrap', marginBottom: 'var(--lab-s3)' }}>
        <button
          type="button"
          onClick={() => onPickCatalog('')}
          className="focus-ring"
          style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-ink)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          ← all catalogs
        </button>
        <h2 style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-lg, 18px)', color: 'var(--lab-ink-deep)', fontWeight: 700 }}>
          {catalogLabel(catalogId)}
        </h2>
        <span style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)' }}>
          {nodes.length} {nodes.length === 1 ? 'entity' : 'entities'} · weakest first (verified % asc, then name)
        </span>
      </div>

      {nodes.length === 0 && (
        <div style={{ fontSize: 'var(--lab-fs-sm)', color: 'var(--lab-muted)' }}>No entities seeded in this catalog.</div>
      )}

      <div style={{ overflowX: 'auto' }}>
        {rows.map((n) => (
          <MiniSwimlane key={n.entityId} node={n} onFocus={onFocusEntity} />
        ))}
      </div>

      {pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--lab-s3)', marginTop: 'var(--lab-s3)' }}>
          <button
            type="button"
            disabled={clampedPage === 0}
            onClick={() => setPage(clampedPage - 1)}
            className="focus-ring"
            style={{ padding: 'var(--lab-s1) var(--lab-s3)', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-text)', background: 'transparent', border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)', cursor: clampedPage === 0 ? 'default' : 'pointer', opacity: clampedPage === 0 ? 0.4 : 1 }}
          >
            ← prev
          </button>
          <span style={{ fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)' }}>
            page {clampedPage + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={clampedPage >= pageCount - 1}
            onClick={() => setPage(clampedPage + 1)}
            className="focus-ring"
            style={{ padding: 'var(--lab-s1) var(--lab-s3)', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-text)', background: 'transparent', border: '1px solid var(--lab-line)', borderRadius: 'var(--lab-r-sm)', cursor: clampedPage >= pageCount - 1 ? 'default' : 'pointer', opacity: clampedPage >= pageCount - 1 ? 0.4 : 1 }}
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}
