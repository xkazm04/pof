'use client';

import { useState } from 'react';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import { labStepsDone } from './labPipelines';
import { getStepComponent } from './steps';
import { populateItemDemo } from './steps/itemsSteps';
import { useLabPipelineStore, useEntitySteps } from './labPipelineStore';
import type { LabTheme } from './theme';
import type { LabCatalog, LabDetail } from './useLabCatalogData';

interface Props {
  theme: LabTheme;
  catalogs: LabCatalog[];
  detail: LabDetail | null;
  onSelectCatalog: (id: string) => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * The single Blueprint baseline (light) / Studio (dark) composition screen. Full
 * width + height: header carries the title + entity stats (the old title block);
 * a left sidebar holds the entity list + the vertical pipeline timeline; the main
 * area is the roomy work canvas for the selected pipeline step.
 */
export function Baseline({ theme: t, catalogs, detail, onSelectCatalog }: Props) {
  const [entityId, setEntityId] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState<number | null>(0);

  const entities = detail?.entities ?? [];
  const entity = entities.find((e) => e.id === entityId) ?? entities[0] ?? null;
  const steps = detail?.steps ?? [];
  const fields = summarizeEntityData(entity?.data);

  // Real per-step production state (Items pipeline is fully data-backed; others use pseudo-progress).
  const isItems = detail?.catalog.catalogId === 'items';
  const entitySteps = useEntitySteps(entity?.id ?? '');
  const produce = useLabPipelineStore((s) => s.produce);
  const resetEntity = useLabPipelineStore((s) => s.resetEntity);
  const stepDone = (step: string, i: number) =>
    isItems ? !!entitySteps?.[step]?.done : i < (entity ? labStepsDone(entity.lifecycle, steps.length) : 0);
  const done = steps.filter((s, i) => stepDone(s, i)).length;
  const ueAssetCount = entitySteps ? Object.values(entitySteps).reduce((n, a) => n + (a.ueAssets?.length ?? 0), 0) : 0;

  const panel = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: t.panel, border: `1px solid ${t.line}`, ...(t.glass ? { backdropFilter: 'blur(12px)' } : {}), ...extra,
  });

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
        <select
          value={detail?.catalog.catalogId ?? ''}
          onChange={(e) => { onSelectCatalog(e.target.value); setEntityId(null); setStepIdx(0); }}
          className={t.fontMono}
          style={{ background: t.bg, color: t.ink, border: `1px solid ${t.line}`, padding: '8px 10px', fontSize: 14, cursor: 'pointer' }}
        >
          {catalogs.map((c) => <option key={c.catalogId} value={c.catalogId}>{c.label}</option>)}
        </select>
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

      {/* ── Body: [ entity list | pipeline | main content ] ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '230px 320px 1fr', minHeight: 0 }}>
        {/* entity list column */}
        <aside style={{ borderRight: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink, padding: '14px 18px 8px' }}>Entities · {entities.length}</div>
          <div style={{ overflow: 'auto', padding: '0 10px 10px' }}>
            {entities.map((e) => {
              const on = e.id === entity?.id;
              return (
                <button key={e.id} onClick={() => setEntityId(e.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 17, cursor: 'pointer', border: 'none', borderLeft: on ? `3px solid ${t.ink}` : '3px solid transparent', background: on ? t.accentBg : 'transparent', color: on ? t.inkDeep : t.text, fontWeight: on ? 600 : 400 }}>
                  {e.name}
                </button>
              );
            })}
          </div>
        </aside>

        {/* pipeline column (right of the list) */}
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
            const StepComp = detail && entity ? getStepComponent(detail.catalog.catalogId, steps[stepIdx]) : null;
            return (
              <>
                <div className={t.fontMono} style={{ fontSize: 14, letterSpacing: '0.12em', color: t.muted, textTransform: 'uppercase' }}>Step {pad2(stepIdx + 1)} / {pad2(steps.length)}{stepDone(steps[stepIdx], stepIdx) ? ' · complete' : ''}</div>
                <h2 style={{ fontSize: 30, fontWeight: 700, color: t.inkDeep, margin: '6px 0 18px' }}>{steps[stepIdx]}</h2>
                {StepComp && entity ? (
                  <StepComp key={`${entity.id}:${steps[stepIdx]}`} t={t} entity={entity} step={steps[stepIdx]} />
                ) : (
                  <div style={panel({ borderRadius: t.glass ? 12 : 0, padding: 28, minHeight: 360 })}>
                    <div className={t.fontMono} style={{ fontSize: 14, color: t.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Compose</div>
                    <p style={{ fontSize: 15, color: t.muted, maxWidth: 520, lineHeight: 1.6 }}>
                      Work canvas for <strong style={{ color: t.text }}>{steps[stepIdx]}</strong> on <strong style={{ color: t.text }}>{entity?.name}</strong>. View / Produce / Acceptance UI for this step is not prototyped yet — see the Items · Concept Brief / Attributes / Economy steps for the pattern.
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
