'use client';

import { useState } from 'react';
import '@/lib/catalog/pipelines/registry.generated';
import { getStepComponent } from '../steps';
import { ArchetypeStep } from '../steps/ArchetypeStep';
import { populateItemDemo } from '../steps/itemsSteps';
import { useLabPipelineStore } from '../labPipelineStore';
import { CatalogTree } from '../CatalogTree';
import { useDerivedLifecycle } from '../useDerivedLifecycle';
import { NextStepCoach } from '../NextStepCoach';
import { PipelineRail } from '../PipelineRail';
import { DriftBanner } from '../DriftBanner';
import { ProduceErrorBanner } from '../ProduceErrorBanner';
import { ProduceLogPanel } from '../ProduceLogPanel';
import { RefreshFromServer } from '../RefreshFromServer';
import { StepCrashBoundary, type AdoptOutcome } from '../StepCrashBoundary';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { Button } from '../ui/Button';
import { Rail } from '../ui/Rail';
import { Stat } from '../ui/Stat';
import { LabDrawer, DrawerToggle } from '../LabDrawer';
import { statusAriaLabel } from '../statusLanguage';
import { summarizeDoneProvenance } from '../coachProvenance';
import { getStepFact } from '@/lib/status/statusModel';
import { summarizeEntity } from '@/lib/catalog/rollup';
import { labPanelStyle } from '../theme';
import { pad2 } from './constants';
import type { Props } from './types';
import { useBaseline } from './useBaseline';

/**
 * The single Blueprint baseline (light) / Studio (dark) composition screen. Full
 * width + height: header carries the title + entity stats (the old title block);
 * a left column holds the Category→Catalog→Entity tree; the pipeline column shows
 * the vertical step timeline; the main area is the roomy work canvas for the selected step.
 */
export function Baseline(props: Props) {
  const { theme: t, groups, detail } = props;
  const {
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
    resetEntityEverywhere, resetting, resetError, dismissResetError,
    ueAssetCount, clearStepError,
    retryStepSync, dismissStepSyncError,
    artifacts, artifactByStep, displayStatus, stepDone, done,
    artsLoading, artsError, retryArts,
    refreshFromServer, refreshing, refreshError, refreshOutcome, dismissRefresh,
    driftByStep, adoptServerStep, entitySteps,
    runDrain,
    handleSelectCatalog, handleSelectEntity, selectStep,
  } = useBaseline(props);
  // Reset is destructive on BOTH sides (local store + persisted server artifacts), so it
  // goes through the shared ConfirmDialog rather than firing on the click.
  const [confirmReset, setConfirmReset] = useState(false);

  // Entity lifecycle DERIVED from the persisted artifacts (server-side, read-only). Every
  // seed hardcodes `lifecycle: 'planned'`, so both the tree dot and this header used to
  // read "planned" for every entity in the product no matter what the pipeline proved.
  // Display only — it cannot move an Acceptance verdict, and `verified` is reachable only
  // via a drained L3/L4 gate (`deriveEntityLifecycle`).
  const derivedLifecycle = useDerivedLifecycle(detail?.catalog.catalogId ?? null);
  const entityLifecycle = (entity && derivedLifecycle.get(entity.id)) || null;

  /**
   * The crash card's "adopt server truth" escape, and the ONE thing `adoptServerStep`
   * cannot say for itself: it silently no-ops when the server holds no row for the step.
   * Comparing the stored artifact identity across the call reports which happened, so a
   * click that changed nothing says so instead of looking like a fix.
   */
  const adoptServerForStep = (step: string): AdoptOutcome => {
    if (!entity) return 'no-server-artifact';
    const read = () => useLabPipelineStore.getState().byEntity[entity.id]?.[step];
    const before = read();
    adoptServerStep(step);
    return read() === before ? 'no-server-artifact' : 'adopted';
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
      derivedLifecycle={derivedLifecycle}
    />
  );

  const pipelineBody = (
    <>
      {/* Always available (any catalog, any entity) — not conditional on a drift banner.
          Hydration is add-only, so without this the only routes to server truth are side
          effects of producing, draining, resetting or reloading. */}
      {entity && (
        <RefreshFromServer
          t={t}
          onRefresh={() => { void refreshFromServer(); }}
          refreshing={refreshing}
          error={refreshError}
          outcome={refreshOutcome}
          onDismiss={dismissRefresh}
        />
      )}
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
          <Button mono onClick={() => setConfirmReset(true)} disabled={resetting} data-testid="entity-reset">
            {resetting ? 'Resetting…' : 'Reset'}
          </Button>
        </div>
      )}
      {resetError && (
        <div style={{ padding: '0 18px 8px' }}>
          <InlineErrorRetry
            dense
            message={`Reset failed — server artifacts were NOT deleted: ${resetError}`}
            onRetry={() => { void resetEntityEverywhere(); }}
            onDismiss={dismissResetError}
          />
        </div>
      )}
      <PipelineRail
        steps={steps}
        stepIdx={stepIdx}
        displayStatus={displayStatus}
        loading={artsLoading}
        error={artsError}
        onRetryLoad={retryArts}
        hasDrift={(step) => driftByStep.has(step)}
        syncFailed={(step) => !!entitySteps?.[step]?.syncError}
        syncFailedReason={(step) => entitySteps?.[step]?.syncError}
        produceFailed={(step) => !!entitySteps?.[step]?.error}
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
      {/* What this pipeline has actually run, and anything that failed on a step nobody
          currently has open. Sits below the rail because it is entity-scoped history,
          not per-step state. Renders nothing until something has run. */}
      {entity && (
        <ProduceLogPanel t={t} steps={steps} byStep={entitySteps} onJump={selectStep} />
      )}
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
          {/* The state derived from this entity's own artifacts when the server has one,
              otherwise the seeded default — the wrapper's tooltip names which, and the
              evidence behind it, so a config-complete `wired` never reads as verified. */}
          <span
            data-testid="entity-lifecycle-stat"
            data-lifecycle={entityLifecycle?.lifecycle ?? entity?.lifecycle ?? ''}
            title={entityLifecycle?.summary || 'seeded default — no pipeline artifacts derived yet'}
          >
            <Stat label="lifecycle" value={entityLifecycle?.lifecycle ?? entity?.lifecycle ?? '—'} accent />
          </span>
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
            // What this entity's passes are actually standing on (audited step-facts), so
            // the coach's terminal state can't read as verified when nothing proved it.
            const catId = detail?.catalog.catalogId;
            const doneProvenance = catId
              ? summarizeDoneProvenance(steps, (s) => getStepFact(catId, s))
              : undefined;
            return (
              // Crash containment: one throw in any of the ~350 step renderers — or in the
              // coach/banners reading the same untrusted artifact `data` — used to take the
              // whole application shell down with it, because this lab IS the homepage.
              // Contained here it costs exactly this canvas: the tree, rail, header and
              // search stay mounted and interactive. Keyed on entity+step, so moving to
              // another step is itself an escape from a crashed one.
              <StepCrashBoundary
                key={`${entity?.id ?? 'none'}:${stepName}`}
                t={t}
                step={stepName}
                catalogId={catId}
                catalogLabel={detail?.catalog.label}
                entityName={entity?.name}
                artifact={entitySteps?.[stepName]}
                onAdoptServer={entity ? () => adoptServerForStep(stepName) : undefined}
              >
                {entity && (
                  <NextStepCoach
                    t={t}
                    steps={steps}
                    statusByStep={(s, i) => displayStatus(s, i)}
                    reasonForStep={(s) => artifactByStep.get(s)?.reason}
                    driftByStep={driftByStep}
                    rollup={rollupSummary}
                    onJump={(i) => setStepIdx(i)}
                    plainMode={plainMode}
                    onTogglePlainMode={() => setPlainMode((v) => !v)}
                    onDrain={runDrain}
                    draining={draining}
                    serverError={artsError}
                    onRetryLoad={retryArts}
                    doneProvenance={doneProvenance}
                  />
                )}
                <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.12em', color: t.muted, textTransform: 'uppercase' }}>Step {pad2(stepIdx + 1)} / {pad2(steps.length)}{stepDone(stepName, stepIdx) ? ' · complete' : ''}</div>
                <h2 style={{ fontSize: 30, fontWeight: 700, color: t.inkDeep, margin: '6px 0 18px' }}>{stepName}</h2>
                {entity && entitySteps?.[stepName]?.error && (
                  <ProduceErrorBanner
                    t={t}
                    step={stepName}
                    error={entitySteps[stepName].error!}
                    hasContent={!!entitySteps[stepName].done}
                    onDismiss={() => clearStepError(stepName)}
                  />
                )}
                {/* The write-through failed for THIS step: its Acceptance below is derived
                    from a local-only artifact the server never accepted. Sits directly above
                    the step's acceptance banner (and carries the server's own reason) so a
                    green banner can't be read as server-confirmed. */}
                {entity && entitySteps?.[stepName]?.syncError && (
                  <div data-testid="step-sync-error" style={{ marginBottom: 14 }}>
                    <InlineErrorRetry
                      message={`Acceptance below is LOCAL ONLY — ${entitySteps[stepName].syncError}`}
                      onRetry={() => retryStepSync(stepName)}
                      onDismiss={() => dismissStepSyncError(stepName)}
                    />
                  </div>
                )}
                {entity && driftByStep.has(stepName) && (
                  <DriftBanner
                    t={t}
                    step={stepName}
                    drift={driftByStep.get(stepName)!}
                    hasHistory={!!(entitySteps?.[stepName]?.data as Record<string, unknown> | undefined)?.genHistory}
                    onAdopt={(opts) => adoptServerStep(stepName, opts)}
                  />
                )}
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
              </StepCrashBoundary>
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

      {/* Reset confirmation — the copy states the FULL scope (local + server), because a
          local-only reset used to silently un-do itself on the next add-only hydration. */}
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { void resetEntityEverywhere(); }}
        title={`Reset ${entity?.name ?? 'this entity'}?`}
        description={`This deletes every produced step for this entity — in this browser AND the persisted artifacts on the server (${done} of ${steps.length} steps produced). It cannot be undone.`}
        confirmLabel="Reset everywhere"
      />

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
