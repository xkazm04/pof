import { useState, useEffect, useMemo, useCallback } from 'react';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import { useLabPipelineStore, useEntitySteps, setLabSync } from '../labPipelineStore';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { catalogManifest } from '../catalogManifest';
import { postArtifact, drainGates } from '../labArtifactClient';
import { useCachedArtifacts, invalidateArtifacts } from '../labArtifactCache';
import { resolveAccept } from '../labAcceptance';
import { useEntityArtifacts } from '../hooks/useEntityArtifacts';
import { useViewportAtLeast } from '@/hooks/useViewportWidth';
import { useLabRunnerStore } from '../labRunnerStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import { COLLAPSE_BREAKPOINT } from './constants';
import type { Props } from './types';

export function useBaseline({ detail, onSelectCatalog, entityId, onSelectEntity, stepIdx: controlledStepIdx, onSelectStep }: Props) {
  // Controlled step position when the parent owns it (LayoutLab, so it survives the
  // AnimatePresence view-toggle remount); otherwise fall back to local state so a
  // direct-render (test/legacy) still works uncontrolled.
  const isControlled = onSelectStep !== undefined;
  const [localStepIdx, setLocalStepIdx] = useState(0);
  const stepIdx = isControlled ? controlledStepIdx ?? 0 : localStepIdx;
  const setStepIdx = useCallback(
    (i: number) => { if (onSelectStep) onSelectStep(i); else setLocalStepIdx(i); },
    [onSelectStep],
  );
  // Drain state is keyed by `${catalogId}/${entityId}` — NOT a single instance-scoped
  // boolean — so switching entities mid-drain neither blocks the new entity's drain nor
  // attaches the "draining…" affordance to the wrong entity (each entity is tracked
  // independently, and the `draining` flag below reflects only the SELECTED entity).
  const [drainingKeys, setDrainingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [plainMode, setPlainMode] = useState(false);

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

  const catalogId = detail?.catalog.catalogId;

  // The per-entity drain key for the CURRENTLY selected entity, and whether it is the
  // one in flight — the value surfaced to the drain button + NextStepCoach, so the
  // "draining…" affordance only ever attaches to the entity actually draining.
  const drainKey = catalogId && entity ? `${catalogId}/${entity.id}` : null;
  const draining = drainKey ? drainingKeys.has(drainKey) : false;

  // Single step-source lookup, collapsed behind the manifest resolver: the old
  // FINE_STEPS-vs-registry hybrid branch is gone. `detail.steps` is already the
  // manifest's `resolveCatalogSteps(catalogId)` output (useLabCatalogData), and it is
  // referentially stable per catalogId+entities — so it's safe to read directly
  // (useEntityArtifacts keys its memo on this array). The manifest's `bespoke` flag
  // replaces the `catalogId === 'items'` special-case.
  const manifest = useMemo(() => (catalogId ? catalogManifest(catalogId) : null), [catalogId]);
  const steps = detail?.steps ?? [];
  // The generic ArchetypeStep still needs the raw StepSpec (for its `spec` prop).
  const pipeline = detail ? getCatalogPipeline(detail.catalog.catalogId) : null;

  const fields = summarizeEntityData(entity?.data);

  // Real per-step production state (Items pipeline is fully data-backed; others use pseudo-progress).
  const isItems = manifest?.bespoke ?? false;
  const entitySteps = useEntitySteps(entity?.id ?? '');
  const produce = useLabPipelineStore((s) => s.produce);
  const resetEntity = useLabPipelineStore((s) => s.resetEntity);
  const hydrateEntity = useLabPipelineStore((s) => s.hydrateEntity);
  const adoptServer = useLabPipelineStore((s) => s.adoptServer);
  const ueAssetCount = entitySteps ? Object.values(entitySteps).reduce((n, a) => n + (a.ueAssets?.length ?? 0), 0) : 0;

  // Server verdicts via the shared artifact cache (keyed catalog|entity, deduped, and
  // invalidated on produce/drain below) — so Baseline and the Matrix share one fetch
  // path and an entity switch surfaces an honest LOADING state instead of momentarily
  // rendering every step "pending". `artsLoading` is true only while a fetch is in
  // flight for this entity with nothing cached yet.
  const entityKey = entity?.id;
  const { arts: entityArts, loading: artsLoading } = useCachedArtifacts(catalogId, entityKey);
  const serverArts = useMemo(
    () => Object.fromEntries(entityArts.map((a) => [a.step, a])) as Record<string, PipelineArtifact>,
    [entityArts],
  );

  // Derived pipeline artifacts + display status (incl. the server `deferred`→pass/fail
  // overlay rule) live in a pure, unit-testable hook so this component stays layout-focused.
  const { artifacts, artifactByStep, displayStatus, stepDone, done, driftByStep } = useEntityArtifacts(catalogId, entity, steps, entitySteps, serverArts);

  // Adopt the server's verdict for a drifted step (preserving the local candidate
  // history unless the user confirms replacement) — the explicit escape from add-only.
  const adoptServerStep = (step: string, opts?: { replaceHistory?: boolean }) => {
    if (!entityKey) return;
    const srv = serverArts[step];
    if (!srv) return;
    adoptServer(entityKey, step, { done: true, data: srv.data, ueAssets: srv.ueAssets, at: srv.updatedAt ?? new Date().toISOString() }, opts);
  };

  // Write-through: register sync bound to the active catalogId so produce() fires
  // postArtifact, then invalidate the cache so the server-graded verdict is re-read.
  useEffect(() => {
    if (!catalogId) { setLabSync(null); return; }
    setLabSync((entityId, step, art) => {
      const accept = resolveAccept(catalogId, step);
      // Feed sibling artifacts so derived checkers (Items Test Gate) grade the
      // posted status from upstream acceptance, matching the on-screen badge.
      const entitySteps = useLabPipelineStore.getState().byEntity[entityId] ?? {};
      const siblings: Record<string, Record<string, unknown>> = {};
      for (const [s, a] of Object.entries(entitySteps)) siblings[s] = a.data;
      const res = accept ? accept(art.data, { catalog: catalogId, siblings, has: () => false }) : null;
      void postArtifact({ catalogId, entityId, step, data: art.data, ueAssets: art.ueAssets, status: res?.status ?? 'pass', tier: res?.tier ?? 'L0', reason: res?.reason })
        .then((synced) => {
          const { setSyncError } = useLabPipelineStore.getState();
          if (synced) {
            // Server accepted the write — clear any stale not-synced flag and re-read the
            // server-graded verdict through the shared fetch path.
            setSyncError(entityId, step, null);
            invalidateArtifacts(catalogId, entityId);
          } else {
            // The POST never reached the server (offline/500). The optimistic local
            // artifact stays (add-only UX preserved), but flag it so the rail shows an
            // honest "not synced to server" indicator instead of a clean success.
            setSyncError(entityId, step, 'Not synced to server');
          }
        });
    });
    return () => setLabSync(null);
  }, [catalogId]);

  // Hydrate the local store from the cached server artifacts (add-only — never wipes
  // local state). Runs when a fetch resolves; entityKey is the stable identity key.
  useEffect(() => {
    if (!entityKey || !entityArts.length) return;
    hydrateEntity(entityKey, entityArts.map((a) => ({ step: a.step, artifact: { done: true, data: a.data, ueAssets: a.ueAssets, at: a.updatedAt ?? new Date().toISOString() } })));
  }, [entityKey, entityArts, hydrateEntity]);

  // Close an open drawer on Escape (narrow shell only).
  useEffect(() => {
    if (!openDrawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenDrawer(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDrawer]);

  // Operator-triggered drain of this entity's deferred L3/L4 gates, then invalidate
  // the cache so the refreshed verdicts are re-read through the shared fetch path.
  const runDrain = async () => {
    if (!catalogId || !entity) return;
    // Guard + track per entity: a drain already in flight for THIS entity is ignored,
    // but a different entity can drain concurrently without being silently swallowed.
    const key = `${catalogId}/${entity.id}`;
    if (drainingKeys.has(key)) return;
    setDrainingKeys((prev) => { const next = new Set(prev); next.add(key); return next; });
    // Publish this session's drain scope so the header runner chip shows "draining …"
    // (and never mistakes our own lease for another session's).
    useLabRunnerStore.getState().setLocalDrain(key);
    try {
      await drainGates(catalogId, entity.id);
      invalidateArtifacts(catalogId, entity.id);
    } finally {
      setDrainingKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
      // Only clear the header lease if it's still OURS (a later drain for another entity
      // may have taken it over while this one was in flight).
      const runner = useLabRunnerStore.getState();
      if (runner.localDrain === key) runner.setLocalDrain(null);
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
    artsLoading,
    driftByStep, adoptServerStep, entitySteps,
    runDrain,
    handleSelectCatalog, handleSelectEntity, selectStep,
  };
}
