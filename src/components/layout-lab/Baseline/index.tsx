'use client';

import '@/lib/catalog/pipelines/registry.generated';
import { getStepComponent } from '../steps';
import { ArchetypeStep } from '../steps/ArchetypeStep';
import { populateItemDemo } from '../steps/itemsSteps';
import { useLabPipelineStore } from '../labPipelineStore';
import { CatalogTree } from '../CatalogTree';
import { NextStepCoach } from '../NextStepCoach';
import { PipelineRail } from '../PipelineRail';
import { DriftBanner } from '../DriftBanner';
import { Button } from '../ui/Button';
import { Rail } from '../ui/Rail';
import { Stat } from '../ui/Stat';
import { LabDrawer, DrawerToggle } from '../LabDrawer';
import { statusAriaLabel } from '../statusLanguage';
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
    produce, resetEntity,
    ueAssetCount,
    artifacts, artifactByStep, displayStatus, stepDone, done,
    artsLoading,
    driftByStep, adoptServerStep, entitySteps,
    runDrain,
    handleSelectCatalog, handleSelectEntity, selectStep,
  } = useBaseline(props);

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
        loading={artsLoading}
        hasDrift={(step) => driftByStep.has(step)}
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
