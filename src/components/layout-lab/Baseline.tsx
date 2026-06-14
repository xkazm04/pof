'use client';

import '@/lib/catalog/pipelines/registry.generated';
import { useState, useEffect, useMemo } from 'react';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import { getStepComponent } from './steps';
import { ArchetypeStep } from './steps/ArchetypeStep';
import { populateItemDemo } from './steps/itemsSteps';
import { useLabPipelineStore, useEntitySteps, setLabSync } from './labPipelineStore';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { fetchArtifacts, postArtifact, drainGates } from './labArtifactClient';
import { resolveAccept } from './labAcceptance';
import { useEntityArtifacts } from './hooks/useEntityArtifacts';
import { CatalogTree } from './CatalogTree';
import { NextStepCoach } from './NextStepCoach';
import { PipelineRail } from './PipelineRail';
import { Button } from './ui/Button';
import { Rail } from './ui/Rail';
import { Stat } from './ui/Stat';
import { LabDrawer, DrawerToggle } from './LabDrawer';
import { statusAriaLabel } from './statusLanguage';
import { summarizeEntity } from '@/lib/catalog/rollup';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { labPanelStyle, type LabTheme } from './theme';
import type { LabDetail, LabGroup } from './useLabCatalogData';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

interface Props {
  theme: LabTheme;
  groups: LabGroup[];
  detail: LabDetail | null;
  onSelectCatalog: (id: string) => void;
  entityId: string | null;
  onSelectEntity: (id: string) => void;
  /** Step to open on mount (e.g. jumped to from the catalog-wide matrix). Defaults to 0. */
  initialStepIdx?: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Below this viewport width the catalog tree (260px) + pipeline (320px) columns
// crowd the work canvas, so they collapse into toggled slide-over drawers.
const COLLAPSE_BREAKPOINT = 1100;


/**
 * The single Blueprint baseline (light) / Studio (dark) composition screen. Full
 * width + height: header carries the title + entity stats (the old title block);
 * a left column holds the Category→Catalog→Entity tree; the pipeline column shows
 * the vertical step timeline; the main area is the roomy work canvas for the selected step.
 */
export function Baseline({ theme: t, groups, detail, onSelectCatalog, entityId, onSelectEntity, initialStepIdx }: Props) {
  const [stepIdx, setStepIdx] = useState<number | null>(initialStepIdx ?? 0);
  const [draining, setDraining] = useState(false);
  const [plainMode, setPlainMode] = useState(false);
  // Server-stored verdicts, keyed by step — used to overlay the runner's L3/L4 pass/fail
  // onto the local recompute (which can only ever yield `deferred` for a Test Gate).
  const [serverArts, setServerArts] = useState<Record<string, PipelineArtifact>>({});

  // Responsive shell: below COLLAPSE_BREAKPOINT the 580px of catalog+pipeline chrome
  // is hidden and surfaced as left slide-over drawers, leaving the canvas full-width.
  const viewportWidth = useViewportWidth();
  const wide = viewportWidth >= COLLAPSE_BREAKPOINT;
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

  // Column bodies, factored so they render either inline (wide) or inside a
  // slide-over drawer (narrow) without duplicating the tree/timeline markup.
  const treeBody = (
    <CatalogTree
      t={t}
      groups={groups}
      selectedCatalogId={detail?.catalog.catalogId ?? ''}
      entities={entities}
      selectedEntityId={entity?.id ?? null}
      onSelectCatalog={handleSelectCatalog}
      onSelectEntity={handleSelectEntity}
    />
  );

  const pipelineBody = (
    <>
      {isItems && entity && (
        <div style={{ display: 'flex', gap: 8, padding: '0 18px 8px' }}>
          <Button
            variant="accent" mono style={{ flex: 1 }}
            onClick={() => populateItemDemo(entity, produce,
              // Fill gaps only — overwriting an existing artifact would wipe
              // the generative steps' kept batch history (and sync the wipe).
              (id, step) => !!useLabPipelineStore.getState().byEntity[id]?.[step])}
          >
            Populate demo
          </Button>
          <Button mono onClick={() => resetEntity(entity.id)}>
            Reset
          </Button>
        </div>
      )}
      <PipelineRail
        steps={steps}
        stepIdx={stepIdx}
        displayStatus={displayStatus}
        isLive={(step) => !!(detail && getStepComponent(detail.catalog.catalogId, step))}
        tooltipFor={(step, i) => {
          const a = artifactByStep.get(step);
          const status = displayStatus(step, i);
          const live = !!(detail && getStepComponent(detail.catalog.catalogId, step));
          return [
            live ? 'Prototyped step' : 'Placeholder (not yet built)',
            status !== 'pending' || a
              ? `status: ${status}${a?.tier ? ` · ${a.tier}` : ''}${a?.reason ? ` — ${a.reason}` : ''}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ');
        }}
        ariaFor={(step, i) => statusAriaLabel(step, displayStatus(step, i), artifactByStep.get(step)?.tier)}
        onSelectStep={selectStep}
      />
    </>
  );

  return (
    <div
      className={t.fontBody}
      style={{
        background: t.bg, color: t.text, minHeight: '100%', display: 'flex', flexDirection: 'column',
        backgroundImage: 'var(--lab-grid-image), var(--lab-canvas-ambient)',
        backgroundSize: 'var(--lab-grid-size), auto',
      }}
    >
      {/* ── Header: title + moved title-block stats ── */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 28px', borderBottom: `2px solid ${t.ink}`, ...labPanelStyle(t, { borderTop: 'none', borderLeft: 'none', borderRight: 'none' }) }}>
        {/* persistent drawer toggles — only in the collapsed (narrow) shell */}
        {!wide && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <DrawerToggle t={t} label="Catalogs" glyph="☰" open={showTreeDrawer} controls="lab-tree-drawer"
              onClick={() => setOpenDrawer((d) => (d === 'tree' ? null : 'tree'))} />
            <DrawerToggle t={t} label={`Pipeline · ${done}/${steps.length}`} glyph="◫" open={showPipelineDrawer} controls="lab-pipeline-drawer"
              onClick={() => setOpenDrawer((d) => (d === 'pipeline' ? null : 'pipeline'))} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.muted }}>{detail?.catalog.label ?? '—'}</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: t.inkDeep, margin: 0, lineHeight: 1.1 }}>{entity?.name ?? '—'}</h1>
        </div>
        {/* stat strip (moved from the title block) */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <Stat label="lifecycle" value={entity?.lifecycle ?? '—'} accent />
          {isItems && <Stat label="pipeline" value={`${done}/${steps.length}`} accent />}
          {isItems && ueAssetCount > 0 && <Stat label="ue assets" value={String(ueAssetCount)} />}
          {fields.map((f) => <Stat key={f.label} label={f.label} value={f.value} />)}
        </div>
      </header>

      {/* ── Body: [ catalog tree | pipeline | main content ] — the two left columns
            collapse into toggled slide-over drawers below COLLAPSE_BREAKPOINT so the
            work canvas stays full-width (mirrors StepFrame's auto-fit instinct). ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: wide ? '260px 320px 1fr' : '1fr', minHeight: 0 }}>
        {/* catalog tree column — inline when wide, otherwise a drawer (below) */}
        {wide && <Rail title="Catalogs">{treeBody}</Rail>}

        {/* pipeline column — inline when wide, otherwise a drawer (below) */}
        {wide && <Rail title={`Pipeline · ${done}/${steps.length}`}>{pipelineBody}</Rail>}

        {/* main content — roomy work canvas */}
        <main id="lab-canvas" tabIndex={-1} style={{ padding: '28px 36px', overflow: 'auto', minHeight: 0 }}>
          {stepIdx != null && steps[stepIdx] ? (() => {
            const stepName = steps[stepIdx];
            const Bespoke = detail && entity ? getStepComponent(detail.catalog.catalogId, stepName) : null;
            const spec = pipeline?.steps.find((s) => s.label === stepName) ?? null;
            const rollupSummary = summarizeEntity(artifacts, steps.length);
            return (
              <>
                {entity && (
                  <NextStepCoach
                    t={t}
                    steps={steps}
                    statusByStep={(s, i) => displayStatus(s, i)}
                    rollup={rollupSummary}
                    onJump={(i) => setStepIdx(i)}
                    plainMode={plainMode}
                    onTogglePlainMode={() => setPlainMode((v) => !v)}
                    onDrain={runDrain}
                    draining={draining}
                  />
                )}
                <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.12em', color: t.muted, textTransform: 'uppercase' }}>Step {pad2(stepIdx + 1)} / {pad2(steps.length)}{stepDone(stepName, stepIdx) ? ' · complete' : ''}</div>
                <h2 style={{ fontSize: 30, fontWeight: 700, color: t.inkDeep, margin: '6px 0 18px' }}>{stepName}</h2>
                {Bespoke && entity ? (
                  <Bespoke key={`${entity.id}:${stepName}`} t={t} entity={entity} step={stepName} />
                ) : spec && entity ? (
                  <ArchetypeStep key={`${entity.id}:${stepName}`} t={t} entity={entity} step={stepName} spec={spec} catalogId={detail?.catalog.catalogId} />
                ) : (
                  <div style={labPanelStyle(t, { borderRadius: t.glass ? 12 : 0, padding: 28, minHeight: 360 })}>
                    <div className={t.fontMono} style={{ fontSize: 14, color: t.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Compose</div>
                    <p style={{ fontSize: 15, color: t.muted, maxWidth: 520, lineHeight: 1.6 }}>
                      Work canvas for <strong style={{ color: t.text }}>{stepName}</strong> on <strong style={{ color: t.text }}>{entity?.name}</strong>. View / Produce / Acceptance UI for this step is not prototyped yet — see the Items · Concept Brief / Attributes / Economy steps for the pattern.
                    </p>
                  </div>
                )}
              </>
            );
          })() : (
            <div style={{ maxWidth: 620 }}>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: t.inkDeep, margin: '0 0 10px' }}>{entity?.name ?? 'Select an entity'}</h2>
              <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.65 }}>{detail?.catalog.description}</p>
              <div style={labPanelStyle(t, { borderRadius: t.glass ? 12 : 0, padding: 24, marginTop: 20 })}>
                <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>← Select a pipeline step to compose it.</span>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* collapsed-shell slide-over drawers (narrow only) */}
      {!wide && (
        <>
          <LabDrawer t={t} open={showTreeDrawer} onClose={() => setOpenDrawer(null)} id="lab-tree-drawer" title="Catalogs" width={300}>
            {treeBody}
          </LabDrawer>
          <LabDrawer t={t} open={showPipelineDrawer} onClose={() => setOpenDrawer(null)} id="lab-pipeline-drawer" title={`Pipeline · ${done}/${steps.length}`} width={360}>
            {pipelineBody}
          </LabDrawer>
        </>
      )}
    </div>
  );
}
