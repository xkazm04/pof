'use client';
/* eslint-disable no-restricted-syntax -- identity-lab prototype: bespoke palette by design, not the app's chart-color tokens */

import { useState } from 'react';
import { inter, jetbrainsMono } from '../fonts';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import { labStepsDone } from '../labPipelines';
import type { LabGroup, LabDetail } from '../useLabCatalogData';

const BG = '#0a0e14';
const TEXT = '#e2e8f0';
const MUTED = '#8c9aae';
const CYAN = '#22d3ee';
const EMERALD = '#34d399';
const GLASS = 'rgba(255,255,255,0.05)';
const GLASS_BORDER = 'rgba(255,255,255,0.10)';
const ELEV3 = '0 4px 8px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.25)';

interface Props { groups: LabGroup[]; detail: LabDetail | null; onSelect: (id: string) => void; onBack: () => void }

/** Variant E — "Studio": cyan glass, elevation, semantic type. Detail = segmented progress stepper. */
export function Studio({ groups, detail, onSelect, onBack }: Props) {
  return (
    <div className={inter.className} style={{ background: BG, color: TEXT, minHeight: '100%', padding: '40px 40px 80px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {detail ? <StudioDetail detail={detail} onBack={onBack} /> : <StudioHub groups={groups} onSelect={onSelect} />}
      </div>
    </div>
  );
}

function StudioHub({ groups, onSelect }: { groups: LabGroup[]; onSelect: (id: string) => void }) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: CYAN }}>Asset Studio</div>
      <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.015em', margin: '8px 0 18px' }}>Catalogs</h1>
      {groups.map((g) => (
        <section key={g.category} style={{ marginTop: 30 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: MUTED, marginBottom: 14, borderBottom: `1px solid ${GLASS_BORDER}`, paddingBottom: 8 }}>{g.category}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {g.catalogs.map((c) => (
              <button key={c.catalogId} onClick={() => onSelect(c.catalogId)}
                style={{ textAlign: 'left', cursor: 'pointer', padding: 18, borderRadius: 12, background: GLASS, border: `1px solid ${GLASS_BORDER}`, boxShadow: ELEV3, backdropFilter: 'blur(12px)', transition: 'border-color 150ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(34,211,238,0.4)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = GLASS_BORDER)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{c.label}</div>
                  <span className={jetbrainsMono.className} style={{ flexShrink: 0, fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.20)', color: CYAN }}>{c.total}</span>
                </div>
                <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.55, margin: '8px 0 14px', minHeight: 42 }}>{c.description}</div>
                <div className={jetbrainsMono.className} style={{ fontSize: 11, color: c.verified > 0 ? EMERALD : MUTED }}>● {c.verified} verified</div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function StudioDetail({ detail, onBack }: { detail: LabDetail; onBack: () => void }) {
  const [sel, setSel] = useState(detail.entities[0]?.id ?? null);
  const entity = detail.entities.find((e) => e.id === sel) ?? detail.entities[0] ?? null;
  const done = entity ? labStepsDone(entity.lifecycle, detail.steps.length) : 0;
  const fields = summarizeEntityData(entity?.data);
  const pct = detail.steps.length ? Math.round((done / detail.steps.length) * 100) : 0;

  return (
    <>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: CYAN, cursor: 'pointer', fontSize: 13, marginBottom: 14, padding: 0 }}>← Catalogs</button>
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.015em', margin: '0 0 4px' }}>{detail.catalog.label}</h1>
      <p style={{ fontSize: 14, color: MUTED, margin: '0 0 24px' }}>{detail.catalog.description}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
        {/* glass sidebar list */}
        <div style={{ borderRadius: 12, background: GLASS, border: `1px solid ${GLASS_BORDER}`, backdropFilter: 'blur(12px)', overflow: 'hidden', maxHeight: 560 }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${GLASS_BORDER}`, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>{detail.entities.length} entities</div>
          <div style={{ overflow: 'auto', maxHeight: 510 }}>
            {detail.entities.map((e) => {
              const on = e.id === sel;
              return (
                <button key={e.id} onClick={() => setSel(e.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', cursor: 'pointer', border: 'none', background: on ? 'rgba(34,211,238,0.10)' : 'transparent', color: on ? TEXT : '#c3ccd9', borderLeft: on ? `2px solid ${CYAN}` : '2px solid transparent' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: e.lifecycle === 'verified' ? EMERALD : MUTED, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: on ? 600 : 400 }}>{e.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {/* segmented progress stepper */}
          <div style={{ borderRadius: 12, background: GLASS, border: `1px solid ${GLASS_BORDER}`, backdropFilter: 'blur(12px)', padding: 18, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED }}>Pipeline</span>
              <span className={jetbrainsMono.className} style={{ fontSize: 13, color: CYAN }}>{pct}% · {done}/{detail.steps.length}</span>
            </div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 18 }}>
              {detail.steps.map((s, i) => (
                <div key={s} title={s} style={{ flex: 1, height: 6, borderRadius: 3, background: i < done ? CYAN : 'rgba(255,255,255,0.10)', boxShadow: i < done ? `0 0 6px ${CYAN}66` : 'none' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
              {detail.steps.map((s, i) => {
                const isDone = i < done;
                const current = i === done;
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: isDone ? TEXT : current ? CYAN : MUTED }}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, background: isDone ? CYAN : 'transparent', color: isDone ? BG : MUTED, border: isDone ? 'none' : `1.5px solid ${current ? CYAN : 'rgba(255,255,255,0.2)'}` }}>{isDone ? '✓' : i + 1}</span>
                    <span style={{ lineHeight: 1.2 }}>{s}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* metadata stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
            <div style={{ borderRadius: 12, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>lifecycle</div>
              <div className={jetbrainsMono.className} style={{ fontSize: 18, fontWeight: 600, color: EMERALD }}>{entity?.lifecycle ?? '—'}</div>
            </div>
            {fields.map((f) => (
              <div key={f.label} style={{ borderRadius: 12, background: GLASS, border: `1px solid ${GLASS_BORDER}`, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.label}</div>
                <div className={jetbrainsMono.className} style={{ fontSize: 18, fontWeight: 600, color: TEXT }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
