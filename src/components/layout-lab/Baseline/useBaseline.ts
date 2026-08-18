import { useState, useEffect, useMemo, useCallback } from 'react';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import { useLabPipelineStore, useEntitySteps, setLabSync } from '../labPipelineStore';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { catalogManifest } from '../catalogManifest';
import { postArtifact, drainGates, deleteEntityArtifacts } from '../labArtifactClient';
import { useCachedArtifacts, invalidateArtifacts, retryArtifacts, refreshArtifacts } from '../labArtifactCache';
import { toLabArtifacts } from '../labCatalogRefresh';
import type { RefreshOutcome } from '../labPipelineStore';
import { labGrade } from '../labCheckerContext';
import { useEntityArtifacts } from '../hooks/useEntityArtifacts';
import { useCatalogStore } from '@/stores/catalogStore';
import { useViewportAtLeast } from '@/hooks/useViewportWidth';
import { useLabRunnerStore } from '../labRunnerStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import { COLLAPSE_BREAKPOINT } from './constants';
import type { Props } from './types';

/**
 * Normalize whatever the write-through threw into an actionable reason string.
 * The thrown message IS the actionable part (which checker, on which field), so it is
 * never replaced by a generic label — only backfilled when the throw carried no message.
 */
function thrownReason(e: unknown): string {
  if (e instanceof Error) return e.message.trim() || e.name || 'Error';
  if (typeof e === 'string' && e.trim()) return e.trim();
  return String(e).trim() || 'unknown error';
}

/**
 * The step's Acceptance checker THREW while grading the produced data, so the write-through
 * stopped before it sent anything.
 *
 * Deliberately its OWN failure mode, not merged into the network one below: there is no
 * server message to quote (nothing was sent), and retrying the POST cannot help until the
 * data or the checker is fixed. Checkers are arbitrary functions over untrusted artifact
 * `data` (produce bodies, the MCP submit path, headless drains) — this is a real failure
 * mode, which is why `StepCrashBoundary` exists for the render side of the same hazard.
 */
export const gradeThrewReason = (reason: string): string =>
  "Not saved to the server: this step's Acceptance checker THREW while grading the produced data, "
  + `so nothing was sent — ${reason}`;

/** Last-resort net: something else in the write-through threw, so the write is unconfirmed. */
export const writeThroughThrewReason = (reason: string): string =>
  `Not saved to the server: the write-through threw before the server write could be confirmed — ${reason}`;

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
  // Reset (local + server) state — a failed server delete must be reported, never swallowed.
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  // Explicit refresh-from-server state. A refresh RECONCILES (it can adopt content and drop
  // steps the server no longer has), so what it did is reported, never applied silently.
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshOutcome, setRefreshOutcome] = useState<RefreshOutcome | null>(null);

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
  const clearError = useLabPipelineStore((s) => s.clearError);
  const hydrateEntity = useLabPipelineStore((s) => s.hydrateEntity);
  const adoptServer = useLabPipelineStore((s) => s.adoptServer);
  const ueAssetCount = entitySteps ? Object.values(entitySteps).reduce((n, a) => n + (a.ueAssets?.length ?? 0), 0) : 0;

  // Server verdicts via the shared artifact cache (keyed catalog|entity, deduped, and
  // invalidated on produce/drain below) — so Baseline and the Matrix share one fetch
  // path and an entity switch surfaces an honest LOADING state instead of momentarily
  // rendering every step "pending". `artsLoading` is true only while a fetch is in
  // flight for this entity with nothing cached yet.
  const entityKey = entity?.id;
  // `artsError` is the third state: the GET failed, so an absent artifact means UNKNOWN,
  // not "never produced" — the rail and the coach must say so rather than invite a
  // re-produce over server truth.
  const { arts: entityArts, loading: artsLoading, error: artsError } = useCachedArtifacts(catalogId, entityKey);
  const retryArts = useCallback(
    () => { if (catalogId) retryArtifacts(catalogId, entityKey); },
    [catalogId, entityKey],
  );
  const serverArts = useMemo(
    () => Object.fromEntries(entityArts.map((a) => [a.step, a])) as Record<string, PipelineArtifact>,
    [entityArts],
  );

  // Derived pipeline artifacts + display status (incl. the server `deferred`→pass/fail
  // overlay rule) live in a pure, unit-testable hook so this component stays layout-focused.
  // The live entity index feeds the shared CheckerContext's `has` (cross-catalog link
  // resolution) — the same source the step banner uses, so the rail can't grade links
  // against a pessimistic `() => false`.
  const entitiesByCatalog = useCatalogStore((s) => s.entitiesByCatalog);
  const { artifacts, artifactByStep, displayStatus, stepDone, done, driftByStep } = useEntityArtifacts(catalogId, entity, steps, entitySteps, serverArts, entitiesByCatalog);

  // Adopt the server's verdict for a drifted step (preserving the local candidate
  // history unless the user confirms replacement) — the explicit escape from add-only.
  const adoptServerStep = (step: string, opts?: { replaceHistory?: boolean }) => {
    if (!entityKey) return;
    const srv = serverArts[step];
    if (!srv) return;
    adoptServer(entityKey, step, {
      done: true, data: srv.data, ueAssets: srv.ueAssets, at: srv.updatedAt ?? new Date().toISOString(),
      status: srv.status,
      ...(srv.tier ? { tier: srv.tier } : {}),
      ...(srv.reason ? { reason: srv.reason } : {}),
    }, opts);
  };

  // Write-through: register sync bound to the active catalogId so produce() fires
  // postArtifact, then invalidate the cache so the server-graded verdict is re-read.
  // Failures record the SERVER'S OWN REASON (bad-payload field names / server message),
  // never a bare flag — an operator can't act on "not synced".
  const syncStep = useCallback(async (entityIdArg: string, step: string, art: { data: Record<string, unknown>; ueAssets: string[] }) => {
    if (!catalogId) return;
    const { setSyncError } = useLabPipelineStore.getState();
    // ONE grading path: `labGrade` runs the step's checker under the SAME CheckerContext
    // the on-screen banner uses (real siblings + a live `has`), so the status we persist
    // is by construction the status the user is looking at.
    //
    // The CALLER guards the checker call, not `labGrade` — deliberately, and for two
    // reasons. (1) `labGrade` returns `null` to mean "this (catalog, step) has no
    // resolvable checker", and the POST below then falls back to `pass`; folding a THROW
    // into that same `null` would persist a FABRICATED pass for data the checker could not
    // even read. (2) `labGrade` must stay the single grading path the on-screen banner
    // shares — a second, guarded copy is exactly the drift this module was built to remove.
    // So `labGrade` stays throw-transparent and the write-through, the only path that
    // PERSISTS, decides what a throw means.
    let res: AcceptanceResult | null;
    try {
      res = labGrade(catalogId, entityIdArg, step, art.data);
    } catch (e) {
      // Nothing was sent. The optimistic local artifact stays (add-only UX preserved), but
      // it is on record as unsynced with the checker's own reason — never a clean success.
      setSyncError(entityIdArg, step, gradeThrewReason(thrownReason(e)));
      return;
    }
    const written = await postArtifact({
      catalogId, entityId: entityIdArg, step, data: art.data, ueAssets: art.ueAssets,
      status: res?.status ?? 'pass', tier: res?.tier ?? 'L0', reason: res?.reason,
    });
    if (written.ok) {
      // Server accepted the write — clear any stale not-synced flag and re-read the
      // server-graded verdict through the shared fetch path.
      setSyncError(entityIdArg, step, null);
      invalidateArtifacts(catalogId, entityIdArg);
    } else {
      // The POST was rejected or never arrived. The optimistic local artifact stays
      // (add-only UX preserved), but the reason is recorded verbatim so the rail and the
      // work canvas can say WHY, and offer a retry.
      setSyncError(entityIdArg, step, `Not saved to the server: ${written.error}`);
    }
  }, [catalogId]);

  /**
   * The ONE launcher for the write-through — and the reason it can no longer fail silently.
   *
   * `syncStep` is async, so a throw anywhere inside it (the checker, the client, the store
   * update) surfaces as a REJECTED PROMISE, not a synchronous throw. The old sink discarded
   * that promise (`void syncStep(...)`), so the rejection became an unhandled rejection and
   * the artifact carried neither `error` nor `syncError`: it rendered as a clean success
   * that never left the browser. `syncStep` already reports a thrown GRADE precisely; this
   * catch is the net for everything else, so no path can end in silence.
   */
  const runSync = useCallback(
    (entityIdArg: string, step: string, art: { data: Record<string, unknown>; ueAssets: string[] }) => {
      syncStep(entityIdArg, step, art).catch((e: unknown) => {
        useLabPipelineStore.getState().setSyncError(entityIdArg, step, writeThroughThrewReason(thrownReason(e)));
      });
    },
    [syncStep],
  );

  useEffect(() => {
    if (!catalogId) { setLabSync(null); return; }
    setLabSync(runSync);
    return () => setLabSync(null);
  }, [catalogId, runSync]);

  /** Re-attempt the server write for a step whose write-through failed (the banner's Retry). */
  const retryStepSync = useCallback((step: string) => {
    if (!entityKey) return;
    const art = useLabPipelineStore.getState().byEntity[entityKey]?.[step];
    if (!art) return;
    runSync(entityKey, step, { data: art.data, ueAssets: art.ueAssets });
  }, [entityKey, runSync]);

  /** Dismiss a step's recorded sync failure without retrying (operator acknowledgement). */
  const dismissStepSyncError = useCallback((step: string) => {
    if (entityKey) useLabPipelineStore.getState().setSyncError(entityKey, step, null);
  }, [entityKey]);

  // Hydrate the local store from the cached server artifacts (add-only — never wipes
  // local state). Runs when a fetch resolves; entityKey is the stable identity key.
  useEffect(() => {
    if (!entityKey || !entityArts.length) return;
    // The server's VERDICT (status/tier/reason) rides along: a gate drain resolves L3/L4
    // server-side, and `serverVerdictOverlay` lets that outcome reach the step banner
    // (content stays add-only — see `hydrateEntity`).
    hydrateEntity(entityKey, entityArts.map((a) => ({
      step: a.step,
      artifact: {
        done: true, data: a.data, ueAssets: a.ueAssets, at: a.updatedAt ?? new Date().toISOString(),
        status: a.status,
        ...(a.tier ? { tier: a.tier } : {}),
        ...(a.reason ? { reason: a.reason } : {}),
      },
    })));
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

  /** Dismiss a recorded produce failure for one step (see `labPipelineStore.clearError`). */
  const clearStepError = useCallback(
    (step: string) => { if (entityKey) clearError(entityKey, step); },
    [entityKey, clearError],
  );

  // ── Reset: local AND server ────────────────────────────────────────────────
  // The old Reset cleared the local store only. Because hydration is add-only, the
  // surviving server artifacts were re-adopted on the next load and the reset silently
  // un-did itself. Reset now deletes the server rows FIRST and only clears local state
  // when that succeeded — a reset that reports "done" is a reset that stuck.
  const resetEntityEverywhere = useCallback(async () => {
    if (!catalogId || !entityKey) return;
    setResetError(null);
    setResetting(true);
    try {
      const res = await deleteEntityArtifacts(catalogId, entityKey);
      if (!res.ok) { setResetError(res.error); return; }
      useLabPipelineStore.getState().resetEntity(entityKey);
      invalidateArtifacts(catalogId, entityKey);
    } finally {
      setResetting(false);
    }
  }, [catalogId, entityKey]);

  // ── Refresh from server ────────────────────────────────────────────────────
  // The lab could only ever ADD server truth: hydration merges verdicts but never content,
  // never drops a step the server dropped, and the only adopt path was buried behind the
  // drift banner (which needs a concrete pass-vs-fail disagreement to appear at all). So a
  // catalog changed by another session, by the MCP submit path or by a headless judge run
  // stayed stale until you happened to produce, drain, reset or hard-reload.
  //
  // This is the explicit ask. NOT a poll: the modules are LRU-suspended and a background
  // timer would fight `useSuspendableEffect` — freshness is requested, never scheduled.
  // It force-refetches through the shared cache (so every surface sees the same rows) and
  // reconciles the local store against exactly that response — non-destructively: any step
  // holding local work the server has not got is KEPT and reported.
  const refreshFromServer = useCallback(async () => {
    if (!catalogId || !entityKey) return;
    setRefreshError(null);
    setRefreshOutcome(null);
    setRefreshing(true);
    try {
      const res = await refreshArtifacts(catalogId, entityKey);
      if (!res.ok) { setRefreshError(res.error); return; }
      // ONE server-row → local-artifact projection, shared with the catalog-wide refresh
      // (`labCatalogRefresh.ts`) so the two scopes cannot reconcile against different shapes.
      setRefreshOutcome(useLabPipelineStore.getState().refreshEntity(entityKey, toLabArtifacts(res.data)));
    } finally {
      setRefreshing(false);
    }
  }, [catalogId, entityKey]);

  // A different entity's result must never be read as this one's.
  useEffect(() => { setRefreshOutcome(null); setRefreshError(null); }, [entityKey]);

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
    produce,
    resetEntityEverywhere, resetting, resetError, dismissResetError: () => setResetError(null),
    ueAssetCount,
    clearStepError,
    retryStepSync, dismissStepSyncError,
    artifacts, artifactByStep, displayStatus, stepDone, done,
    artsLoading, artsError, retryArts,
    refreshFromServer, refreshing, refreshError, refreshOutcome,
    dismissRefresh: () => { setRefreshOutcome(null); setRefreshError(null); },
    driftByStep, adoptServerStep, entitySteps,
    runDrain,
    handleSelectCatalog, handleSelectEntity, selectStep,
  };
}
