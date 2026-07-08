import { useState, useEffect, useMemo } from 'react';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import { useLabPipelineStore, useEntitySteps, setLabSync } from '../labPipelineStore';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { fetchArtifacts, postArtifact, drainGates } from '../labArtifactClient';
import { resolveAccept } from '../labAcceptance';
import { useEntityArtifacts } from '../hooks/useEntityArtifacts';
import { useViewportAtLeast } from '@/hooks/useViewportWidth';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { COLLAPSE_BREAKPOINT } from './constants';
import type { Props } from './types';

export function useBaseline({ detail, onSelectCatalog, entityId, onSelectEntity, initialStepIdx }: Props) {
  const [stepIdx, setStepIdx] = useState<number | null>(initialStepIdx ?? 0);
  const [draining, setDraining] = useState(false);
  const [plainMode, setPlainMode] = useState(false);
  // Server-stored verdicts, keyed by step — used to overlay the runner's L3/L4 pass/fail
  // onto the local recompute (which can only ever yield `deferred` for a Test Gate).
  const [serverArts, setServerArts] = useState<Record<string, PipelineArtifact>>({});

  // Responsive shell: below COLLAPSE_BREAKPOINT the 580px of catalog+pipeline chrome
  // is hidden and surfaced as left slide-over drawers, leaving the canvas full-width.
  // Only the breakpoint boolean matters here, so subscribe to the threshold — a
  // resize that doesn't cross COLLAPSE_BREAKPOINT re-renders nothing.
  const wide = useViewportAtLeast(COLLAPSE_BREAKPOINT);
  const [openDrawer, setOpenDrawer] = useState<'tree' | 'pipeline' | null>(null);
  // Drawers only exist in the narrow shell; in wide mode the columns are inline.
  const showTreeDrawer = !wide && openDrawer === 'tree';
  const showPipelineDrawer = !wide && openDrawer === 'pipeline';

  const entities = detail?.entities ?? [];
  const entity = entities.find((e) => e.id === entityId) ?? entities[0] ?? null;

  // Hybrid step source. Items is the bespoke REFERENCE pipeline (rich
  // ItemConceptBrief/ItemAttributes/ItemArt… components + populateItemDemo, all keyed
  // to its curated labPipelineSteps names), so it renders that list (detail.steps).
  // Every other catalog uses its registry StepSpec labels, which the generic
  // ArchetypeStep renderer drives.
  const pipeline = detail ? getCatalogPipeline(detail.catalog.catalogId) : null;
  // Memoized so the `steps` array identity is stable across renders that don't change
  // the pipeline/items list. A fresh `pipeline.steps.map(...)` array every render would
  // otherwise bust useEntityArtifacts' memo (it keys on `steps`), forcing a full
  // per-step acceptance rollup recompute on every unrelated re-render.
  const steps = useMemo(
    () =>
      detail?.catalog.catalogId !== 'items' && pipeline
        ? pipeline.steps.map((s) => s.label)
        : (detail?.steps ?? []),
    [detail?.catalog.catalogId, pipeline, detail?.steps],
  );

  const catalogId = detail?.catalog.catalogId;

  const fields = summarizeEntityData(entity?.data);

  // Real per-step production state (Items pipeline is fully data-backed; others use pseudo-progress).
  const isItems = catalogId === 'items';
  const entitySteps = useEntitySteps(entity?.id ?? '');
  const produce = useLabPipelineStore((s) => s.produce);
  const resetEntity = useLabPipelineStore((s) => s.resetEntity);
  const hydrateEntity = useLabPipelineStore((s) => s.hydrateEntity);
  const ueAssetCount = entitySteps ? Object.values(entitySteps).reduce((n, a) => n + (a.ueAssets?.length ?? 0), 0) : 0;

  // Derived pipeline artifacts + display status (incl. the server `deferred`→pass/fail
  // overlay rule) live in a pure, unit-testable hook so this component stays layout-focused.
  const { artifacts, artifactByStep, displayStatus, stepDone, done } = useEntityArtifacts(catalogId, entity, steps, entitySteps, serverArts);

  // Write-through: register sync bound to the active catalogId so produce() fires postArtifact.
  useEffect(() => {
    if (!catalogId) { setLabSync(null); return; }
    setLabSync((entityId, step, art) => {
      const accept = resolveAccept(catalogId, step);
      const res = accept ? accept(art.data) : null;
      void postArtifact({ catalogId, entityId, step, data: art.data, ueAssets: art.ueAssets, status: res?.status ?? 'pass', tier: res?.tier ?? 'L0', reason: res?.reason });
    });
    return () => setLabSync(null);
  }, [catalogId]);

  // Hydrate: load server artifacts into the cache (add-only — never wipes local state)
  // and record their stored verdicts so the runner's L3/L4 outcomes can overlay.
  useEffect(() => {
    if (!catalogId || !entity) { setServerArts({}); return; }
    let cancelled = false;
    setServerArts({});
    fetchArtifacts(catalogId, entity.id).then((arts) => {
      if (cancelled || !arts.length) return;
      setServerArts(Object.fromEntries(arts.map((a) => [a.step, a])));
      hydrateEntity(entity.id, arts.map((a) => ({ step: a.step, artifact: { done: true, data: a.data, ueAssets: a.ueAssets, at: a.updatedAt ?? new Date().toISOString() } })));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogId, entity?.id, hydrateEntity]); // entity?.id is the stable identity key; full entity ref changes on every render

  // Close an open drawer on Escape (narrow shell only).
  useEffect(() => {
    if (!openDrawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenDrawer(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDrawer]);

  // Operator-triggered drain of this entity's deferred L3/L4 gates, then refresh verdicts.
  const runDrain = async () => {
    if (!catalogId || !entity || draining) return;
    setDraining(true);
    try {
      await drainGates(catalogId, entity.id);
      const arts = await fetchArtifacts(catalogId, entity.id);
      setServerArts(Object.fromEntries(arts.map((a) => [a.step, a])));
    } finally {
      setDraining(false);
    }
  };

  const handleSelectCatalog = (id: string) => {
    onSelectCatalog(id);
    setStepIdx(0);
    setOpenDrawer(null); // dismiss the tree drawer after a pick (no-op when wide)
  };

  const handleSelectEntity = (id: string) => {
    onSelectEntity(id);
    setStepIdx(0);
    setOpenDrawer(null);
  };

  const selectStep = (i: number) => {
    setStepIdx(i);
    setOpenDrawer(null); // dismiss the pipeline drawer after picking a step
  };

  return {
    stepIdx, setStepIdx,
    draining,
    plainMode, setPlainMode,
    wide,
    setOpenDrawer,
    showTreeDrawer, showPipelineDrawer,
    entities, entity,
    pipeline,
    steps,
    fields,
    isItems,
    produce, resetEntity,
    ueAssetCount,
    artifacts, artifactByStep, displayStatus, stepDone, done,
    runDrain,
    handleSelectCatalog, handleSelectEntity, selectStep,
  };
}
