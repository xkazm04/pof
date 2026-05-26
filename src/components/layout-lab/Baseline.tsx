'use client';

import '@/lib/catalog/pipelines/registry.generated';
import { useState, useEffect } from 'react';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import { labStepsDone } from './labPipelines';
import { getStepComponent } from './steps';
import { ArchetypeStep } from './steps/ArchetypeStep';
import { populateItemDemo } from './steps/itemsSteps';
import { useLabPipelineStore, useEntitySteps, setLabSync } from './labPipelineStore';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { fetchArtifacts, postArtifact, drainGates } from './labArtifactClient';
import { resolveAccept } from './labAcceptance';
import { PipelineRollup } from './PipelineRollup';
import { CatalogTree } from './CatalogTree';
import type { LabTheme } from './theme';
import type { LabDetail, LabGroup } from './useLabCatalogData';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';

interface Props {
  theme: LabTheme;
  groups: LabGroup[];
  detail: LabDetail | null;
  onSelectCatalog: (id: string) => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * The single Blueprint baseline (light) / Studio (dark) composition screen. Full
 * width + height: header carries the title + entity stats (the old title block);
 * a left column holds the Category→Catalog→Entity tree; the pipeline column shows
 * the vertical step timeline; the main area is the roomy work canvas for the selected step.
 */
export function Baseline({ theme: t, groups, detail, onSelectCatalog }: Props) {
  const [entityId, setEntityId] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState<number | null>(0);
  const [draining, setDraining] = useState(false);
  // Server-stored verdicts, keyed by step — used to overlay the runner's L3/L4 pass/fail
  // onto the local recompute (which can only ever yield `deferred` for a Test Gate).
  const [serverArts, setServerArts] = useState<Record<string, PipelineArtifact>>({});

  const entities = detail?.entities ?? [];
  const entity = entities.find((e) => e.id === entityId) ?? entities[0] ?? null;

  // Hybrid step source: registry pipeline wins if present, else detail.steps fallback
  const pipeline = detail ? getCatalogPipeline(detail.catalog.catalogId) : null;
  const steps = pipeline ? pipeline.steps.map((s) => s.label) : (detail?.steps ?? []);

  const catalogId = detail?.catalog.catalogId;

  const fields = summarizeEntityData(entity?.data);

  // Real per-step production state (Items pipeline is fully data-backed; others use pseudo-progress).
  const isItems = catalogId === 'items';
  const entitySteps = useEntitySteps(entity?.id ?? '');
  const produce = useLabPipelineStore((s) => s.produce);
  const resetEntity = useLabPipelineStore((s) => s.resetEntity);
  const hydrateEntity = useLabPipelineStore((s) => s.hydrateEntity);
  const stepDone = (step: string, i: number) =>
    isItems ? !!entitySteps?.[step]?.done : i < (entity ? labStepsDone(entity.lifecycle, steps.length) : 0);
  const done = steps.filter((s, i) => stepDone(s, i)).length;
  const ueAssetCount = entitySteps ? Object.values(entitySteps).reduce((n, a) => n + (a.ueAssets?.length ?? 0), 0) : 0;

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

  // Server-faithful rollup: derives config-complete/tier using the same accept logic the server stored.
  const artifacts: PipelineArtifact[] = catalogId
    ? steps.filter((s) => entitySteps?.[s]).map((s) => {
        const art = entitySteps![s];
        const accept = resolveAccept(catalogId, s);
        const res = accept ? accept(art.data) : null;
        const localStatus = res?.status ?? 'pass';
        // Overlay the runner's verdict: when the local recompute is still `deferred`
        // (an unrun L3/L4 gate) but the server has a real pass/fail, the server wins.
        const srv = serverArts[s];
        const status = localStatus === 'deferred' && srv && srv.status !== 'deferred' && srv.status !== 'pending' ? srv.status : localStatus;
        return { catalogId, entityId: entity?.id ?? '', step: s, data: art.data, ueAssets: art.ueAssets, status, ...(res?.tier ? { tier: res.tier } : {}) };
      })
    : [];
  const panel = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: t.panel, border: `1px solid ${t.line}`, ...(t.glass ? { backdropFilter: 'blur(12px)' } : {}), ...extra,
  });

  const handleSelectCatalog = (id: string) => {
    onSelectCatalog(id);
    setEntityId(null);
    setStepIdx(0);
  };

  const handleSelectEntity = (id: string) => {
    setEntityId(id);
    setStepIdx(0);
  };

  return (
    <div
      className={t.fontBody}
      style={{
        background: t.bg, color: t.text, minHeight: '100%', display: 'flex', flexDirection: 'column',
        ...(t.gridLine ? { backgroundImage: `linear-gradient(${t.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${t.gridLine} 1px, transparent 1px)`, backgroundSize: '24px 24px' } : {}),
      }}
    >
      {/* ── Header: title + moved title-block stats ── */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 28px', borderBottom: `2px solid ${t.ink}`, ...panel({ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }) }}>
        <div style={{ minWidth: 0 }}>
          <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.muted }}>{detail?.catalog.label ?? '—'}</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: t.inkDeep, margin: 0, lineHeight: 1.1 }}>{entity?.name ?? '—'}</h1>
        </div>
        {/* stat strip (moved from the title block) */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <Stat t={t} label="lifecycle" value={entity?.lifecycle ?? '—'} accent />
          {isItems && <Stat t={t} label="pipeline" value={`${done}/${steps.length}`} accent />}
          {isItems && ueAssetCount > 0 && <Stat t={t} label="ue assets" value={String(ueAssetCount)} />}
          {fields.map((f) => <Stat key={f.label} t={t} label={f.label} value={f.value} />)}
        </div>
      </header>

      {/* ── Body: [ catalog tree | pipeline | main content ] ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 320px 1fr', minHeight: 0 }}>
        {/* catalog tree column */}
        <aside style={{ borderRight: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink, padding: '14px 18px 8px' }}>Catalogs</div>
          <CatalogTree
            t={t}
            groups={groups}
            selectedCatalogId={detail?.catalog.catalogId ?? ''}
            entities={entities}
            selectedEntityId={entity?.id ?? null}
            onSelectCatalog={handleSelectCatalog}
            onSelectEntity={handleSelectEntity}
          />
        </aside>

        {/* pipeline column (right of the tree) */}
        <aside style={{ borderRight: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink, padding: '14px 18px 8px' }}>Pipeline · {done}/{steps.length}</div>
          {isItems && entity && (
            <div style={{ display: 'flex', gap: 8, padding: '0 18px 8px' }}>
              <button onClick={() => populateItemDemo(entity, produce)} className={t.fontMono}
                style={{ flex: 1, fontSize: 14, padding: '6px 8px', cursor: 'pointer', background: t.glass ? t.accentBg : t.ink, color: t.glass ? t.ink : t.onAccent, border: `1px solid ${t.ink}`, borderRadius: t.glass ? 6 : 0, fontWeight: 600 }}>
                Populate demo
              </button>
              <button onClick={() => resetEntity(entity.id)} className={t.fontMono}
                style={{ fontSize: 14, padding: '6px 10px', cursor: 'pointer', background: 'transparent', color: t.muted, border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0 }}>
                Reset
              </button>
            </div>
          )}
          <div style={{ overflow: 'auto', padding: '4px 18px 18px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 27, top: 12, bottom: 22, width: 2, background: t.line }} />
            {steps.map((step, i) => {
              const isDone = stepDone(step, i);
              const current = i === stepIdx;
              const live = !!(detail && getStepComponent(detail.catalog.catalogId, step)); // has a prototyped V/P/A UI
              return (
                <button key={step} onClick={() => setStepIdx(i)} title={live ? 'Prototyped step' : 'Placeholder (not yet built)'}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '7px 0', cursor: 'pointer', border: 'none', background: 'transparent', position: 'relative' }}>
                  <span style={{ width: 20, height: 20, flexShrink: 0, zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: isDone ? t.ink : t.bg, border: `2px solid ${current ? t.ink : isDone ? t.ink : t.line}`, boxShadow: current ? `0 0 0 3px ${t.accentBg}` : 'none', color: t.onAccent, fontSize: 14, fontWeight: 700 }}>{isDone ? '✓' : ''}</span>
                  <span style={{ fontSize: 16, lineHeight: 1.25, color: live ? (current ? t.inkDeep : t.text) : t.muted, fontWeight: current ? 700 : live ? 500 : 400, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className={t.fontMono} style={{ color: t.muted, fontSize: 14 }}>{pad2(i + 1)}</span>{step}
                    {live && <span style={{ width: 6, height: 6, borderRadius: 999, background: t.ok, flexShrink: 0 }} title="Prototyped" />}
                  </span>
                  </button>
                );
              })}
            </div>
        </aside>

        {/* main content — roomy work canvas */}
        <main style={{ padding: '28px 36px', overflow: 'auto', minHeight: 0 }}>
          {stepIdx != null && steps[stepIdx] ? (() => {
            const stepName = steps[stepIdx];
            const Bespoke = detail && entity ? getStepComponent(detail.catalog.catalogId, stepName) : null;
            const spec = pipeline?.steps.find((s) => s.label === stepName) ?? null;
            return (
              <>
                {entity && <div style={{ marginBottom: 16 }}><PipelineRollup t={t} steps={steps} artifacts={artifacts} onDrain={runDrain} draining={draining} /></div>}
                <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.12em', color: t.muted, textTransform: 'uppercase' }}>Step {pad2(stepIdx + 1)} / {pad2(steps.length)}{stepDone(stepName, stepIdx) ? ' · complete' : ''}</div>
                <h2 style={{ fontSize: 30, fontWeight: 700, color: t.inkDeep, margin: '6px 0 18px' }}>{stepName}</h2>
                {Bespoke && entity ? (
                  <Bespoke key={`${entity.id}:${stepName}`} t={t} entity={entity} step={stepName} />
                ) : spec && entity ? (
                  <ArchetypeStep key={`${entity.id}:${stepName}`} t={t} entity={entity} step={stepName} spec={spec} catalogId={detail?.catalog.catalogId} />
                ) : (
                  <div style={panel({ borderRadius: t.glass ? 12 : 0, padding: 28, minHeight: 360 })}>
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
              <div style={panel({ borderRadius: t.glass ? 12 : 0, padding: 24, marginTop: 20 })}>
                <span className={t.fontMono} style={{ fontSize: 14, color: t.muted }}>← Select a pipeline step to compose it.</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({ t, label, value, accent }: { t: LabTheme; label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ padding: '4px 12px', border: `1px solid ${t.line}`, background: t.panel, ...(t.glass ? { borderRadius: 8 } : {}) }}>
      <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted }}>{label}</div>
      <div className={t.fontMono} style={{ fontSize: 16, fontWeight: 600, color: accent ? t.ink : t.inkDeep }}>{value}</div>
    </div>
  );
}
