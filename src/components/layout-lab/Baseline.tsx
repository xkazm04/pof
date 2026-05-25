'use client';

import { useState } from 'react';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import { labStepsDone } from './labPipelines';
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
  const [stepIdx, setStepIdx] = useState<number | null>(null);

  const entities = detail?.entities ?? [];
  const entity = entities.find((e) => e.id === entityId) ?? entities[0] ?? null;
  const steps = detail?.steps ?? [];
  const done = entity ? labStepsDone(entity.lifecycle, steps.length) : 0;
  const fields = summarizeEntityData(entity?.data);

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
          onChange={(e) => { onSelectCatalog(e.target.value); setEntityId(null); setStepIdx(null); }}
          className={t.fontMono}
          style={{ background: t.bg, color: t.ink, border: `1px solid ${t.line}`, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
        >
          {catalogs.map((c) => <option key={c.catalogId} value={c.catalogId}>{c.label}</option>)}
        </select>
        <div style={{ minWidth: 0 }}>
          <div className={t.fontMono} style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.muted }}>{detail?.catalog.label ?? '—'}</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: t.inkDeep, margin: 0, lineHeight: 1.1 }}>{entity?.name ?? '—'}</h1>
        </div>
        {/* stat strip (moved from the title block) */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <Stat t={t} label="lifecycle" value={entity?.lifecycle ?? '—'} accent />
          {fields.map((f) => <Stat key={f.label} t={t} label={f.label} value={f.value} />)}
        </div>
      </header>

      {/* ── Body: [ list + pipeline sidebar | main content ] ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '360px 1fr', minHeight: 0 }}>
        {/* left sidebar */}
        <aside style={{ borderRight: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* entity list */}
          <div style={{ flex: '0 0 auto', maxHeight: '42%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className={t.fontMono} style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink, padding: '12px 18px 8px' }}>Entities · {entities.length}</div>
            <div style={{ overflow: 'auto', padding: '0 10px 10px' }}>
              {entities.map((e) => {
                const on = e.id === entity?.id;
                return (
                  <button key={e.id} onClick={() => { setEntityId(e.id); setStepIdx(null); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 17, cursor: 'pointer', border: 'none', borderLeft: on ? `3px solid ${t.ink}` : '3px solid transparent', background: on ? t.accentBg : 'transparent', color: on ? t.inkDeep : t.text, fontWeight: on ? 600 : 400 }}>
                    {e.name}
                  </button>
                );
              })}
            </div>
          </div>
          {/* pipeline vertical timeline */}
          <div style={{ flex: 1, borderTop: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className={t.fontMono} style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink, padding: '12px 18px 8px' }}>Pipeline · {done}/{steps.length}</div>
            <div style={{ overflow: 'auto', padding: '4px 18px 18px', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 27, top: 12, bottom: 22, width: 2, background: t.line }} />
              {steps.map((step, i) => {
                const isDone = i < done;
                const current = i === stepIdx;
                return (
                  <button key={step} onClick={() => setStepIdx(i)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '7px 0', cursor: 'pointer', border: 'none', background: 'transparent', position: 'relative' }}>
                    <span style={{ width: 18, height: 18, flexShrink: 0, zIndex: 1, background: isDone ? t.ink : t.bg, border: `2px solid ${current ? t.ink : isDone ? t.ink : t.line}`, boxShadow: current ? `0 0 0 3px ${t.accentBg}` : 'none' }} />
                    <span style={{ fontSize: 16, lineHeight: 1.25, color: isDone ? t.text : current ? t.inkDeep : t.muted, fontWeight: current ? 700 : isDone ? 500 : 400 }}>
                      <span className={t.fontMono} style={{ color: t.muted, fontSize: 12, marginRight: 8 }}>{pad2(i + 1)}</span>{step}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* main content — roomy work canvas */}
        <main style={{ padding: '28px 36px', overflow: 'auto', minHeight: 0 }}>
          {stepIdx != null && steps[stepIdx] ? (
            <>
              <div className={t.fontMono} style={{ fontSize: 12, letterSpacing: '0.14em', color: t.muted, textTransform: 'uppercase' }}>Step {pad2(stepIdx + 1)} / {pad2(steps.length)}{stepIdx < done ? ' · complete' : ''}</div>
              <h2 style={{ fontSize: 30, fontWeight: 700, color: t.inkDeep, margin: '6px 0 18px' }}>{steps[stepIdx]}</h2>
              <div style={panel({ borderRadius: t.glass ? 12 : 0, padding: 28, minHeight: 360 })}>
                <div className={t.fontMono} style={{ fontSize: 12, color: t.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Compose</div>
                <p style={{ fontSize: 15, color: t.muted, maxWidth: 520, lineHeight: 1.6 }}>
                  This is the work canvas for <strong style={{ color: t.text }}>{steps[stepIdx]}</strong> on <strong style={{ color: t.text }}>{entity?.name}</strong>. The per-step composition UI (the &ldquo;golden rule&rdquo; example) lands here.
                </p>
              </div>
            </>
          ) : (
            <div style={{ maxWidth: 620 }}>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: t.inkDeep, margin: '0 0 10px' }}>{entity?.name ?? 'Select an entity'}</h2>
              <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.65 }}>{detail?.catalog.description}</p>
              <div style={panel({ borderRadius: t.glass ? 12 : 0, padding: 24, marginTop: 20 })}>
                <span className={t.fontMono} style={{ fontSize: 13, color: t.muted }}>← Select a pipeline step to compose it.</span>
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
      <div className={t.fontMono} style={{ fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted }}>{label}</div>
      <div className={t.fontMono} style={{ fontSize: 15, fontWeight: 600, color: accent ? t.ink : t.inkDeep }}>{value}</div>
    </div>
  );
}
