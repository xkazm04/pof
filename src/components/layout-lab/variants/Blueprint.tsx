'use client';
/* eslint-disable no-restricted-syntax -- identity-lab prototype: bespoke palette by design, not the app's chart-color tokens */

import { useState } from 'react';
import { ibmPlexMono, inter } from '../fonts';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import { labStepsDone } from '../labPipelines';
import type { LabGroup, LabDetail } from '../useLabCatalogData';

const GROUND = '#dde3ec';        // darker than the first pass — shines less
const PANEL = 'rgba(255,255,255,0.55)';
const INK = '#1b4f9c';
const INK_DEEP = '#10325f';
const TEXT = '#243446';
const MUTED = '#647488';
const GRID = 'rgba(27,79,156,0.07)';
const LINE = '#aebfd6';

const pad2 = (n: number) => String(n).padStart(2, '0');
interface Props { groups: LabGroup[]; detail: LabDetail | null; onSelect: (id: string) => void; onBack: () => void }

/** Variant C — "Blueprint": drafting, mono, schematic. Detail = horizontal flow diagram + title block. */
export function Blueprint({ groups, detail, onSelect, onBack }: Props) {
  return (
    <div className={inter.className} style={{ background: GROUND, color: TEXT, minHeight: '100%', padding: '40px 40px 80px', backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`, backgroundSize: '24px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        {detail ? <BlueprintDetail detail={detail} onBack={onBack} /> : <BlueprintHub groups={groups} onSelect={onSelect} />}
      </div>
    </div>
  );
}

function BlueprintHub({ groups, onSelect }: { groups: LabGroup[]; onSelect: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <>
      <div style={{ border: `2px solid ${INK}`, background: PANEL, padding: '20px 24px', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className={ibmPlexMono.className} style={{ fontSize: 11, letterSpacing: '0.18em', color: INK, textTransform: 'uppercase' }}>Pillars of Fortune — Asset Schematic</div>
          <h1 className={ibmPlexMono.className} style={{ fontSize: 34, fontWeight: 600, color: INK_DEEP, margin: '6px 0 0' }}>CATALOG INDEX</h1>
        </div>
        <div className={ibmPlexMono.className} style={{ fontSize: 11, color: MUTED, textAlign: 'right', lineHeight: 1.7 }}><div>SHEET 1 / 1</div><div>SECTIONS {pad2(groups.length)}</div></div>
      </div>
      {groups.map((g, gi) => (
        <section key={g.category} style={{ marginBottom: 26 }}>
          <div className={ibmPlexMono.className} style={{ fontSize: 12, color: INK, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>[ {pad2(gi + 1)} ] {g.category}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 10 }}>
            {g.catalogs.map((c, ci) => {
              const on = active === c.catalogId;
              return (
                <button key={c.catalogId} onClick={() => onSelect(c.catalogId)} onMouseEnter={() => setActive(c.catalogId)} onMouseLeave={() => setActive(null)}
                  style={{ textAlign: 'left', cursor: 'pointer', background: on ? '#d2deef' : PANEL, border: `${on ? 2 : 1}px solid ${on ? INK : LINE}`, padding: 0, transition: 'all 110ms' }}>
                  <div className={ibmPlexMono.className} style={{ background: on ? INK : '#cdd9ea', color: on ? '#fff' : INK_DEEP, fontSize: 10.5, letterSpacing: '0.08em', padding: '5px 10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{pad2(gi + 1)}.{pad2(ci + 1)}</span><span>{c.verified}/{c.total} VFD</span>
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: INK_DEEP, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.45 }}>{c.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

function BlueprintDetail({ detail, onBack }: { detail: LabDetail; onBack: () => void }) {
  const [sel, setSel] = useState(detail.entities[0]?.id ?? null);
  const entity = detail.entities.find((e) => e.id === sel) ?? detail.entities[0] ?? null;
  const done = entity ? labStepsDone(entity.lifecycle, detail.steps.length) : 0;
  const fields = summarizeEntityData(entity?.data);

  return (
    <>
      <button onClick={onBack} className={ibmPlexMono.className} style={{ background: 'none', border: 'none', color: INK, cursor: 'pointer', fontSize: 12, marginBottom: 12 }}>← SHEET 1 / CATALOG INDEX</button>
      <div style={{ border: `2px solid ${INK}`, background: PANEL, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <h1 className={ibmPlexMono.className} style={{ fontSize: 26, fontWeight: 600, color: INK_DEEP, margin: 0 }}>{detail.catalog.label.toUpperCase()}</h1>
        <div className={ibmPlexMono.className} style={{ fontSize: 11, color: MUTED }}>{detail.entities.length} PARTS · {detail.catalog.verified} VFD</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 20, alignItems: 'start' }}>
        {/* parts list */}
        <div style={{ border: `1px solid ${LINE}`, background: PANEL }}>
          <div className={ibmPlexMono.className} style={{ fontSize: 10, color: INK, padding: '6px 10px', borderBottom: `1px solid ${LINE}`, letterSpacing: '0.1em' }}>PARTS LIST</div>
          <div style={{ maxHeight: 520, overflow: 'auto' }}>
            {detail.entities.map((e, i) => {
              const on = e.id === sel;
              return (
                <button key={e.id} onClick={() => setSel(e.id)} className={ibmPlexMono.className}
                  style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, cursor: 'pointer', border: 'none', background: on ? INK : 'transparent', color: on ? '#fff' : TEXT }}>
                  <span>{pad2(i + 1)} {e.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {/* horizontal connected flow diagram */}
          <div className={ibmPlexMono.className} style={{ fontSize: 11, color: INK, letterSpacing: '0.12em', marginBottom: 12 }}>PROCESS FLOW — {done}/{detail.steps.length} COMPLETE</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, marginBottom: 24 }}>
            {detail.steps.map((step, i) => {
              const isDone = i < done;
              return (
                <div key={step} style={{ display: 'flex', alignItems: 'stretch' }}>
                  <div style={{ width: 120, border: `1.5px solid ${isDone ? INK : LINE}`, background: isDone ? INK : PANEL, color: isDone ? '#fff' : TEXT, padding: '8px 9px', minHeight: 58 }}>
                    <div className={ibmPlexMono.className} style={{ fontSize: 10, opacity: 0.8 }}>{pad2(i + 1)}</div>
                    <div style={{ fontSize: 11, lineHeight: 1.25, fontWeight: 500 }}>{step}</div>
                  </div>
                  {i < detail.steps.length - 1 && <div style={{ width: 14, alignSelf: 'center', height: 1.5, background: i < done - 1 ? INK : LINE }} />}
                </div>
              );
            })}
          </div>

          {/* title-block metadata table */}
          <div style={{ border: `1.5px solid ${INK}` }}>
            <div className={ibmPlexMono.className} style={{ background: INK, color: '#fff', fontSize: 11, letterSpacing: '0.1em', padding: '6px 12px' }}>TITLE BLOCK — {entity?.name?.toUpperCase() ?? '—'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <Field label="LIFECYCLE" value={entity?.lifecycle ?? '—'} />
              {fields.map((f) => <Field key={f.label} label={f.label.toUpperCase()} value={f.value} />)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderTop: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, padding: '8px 12px', background: PANEL }}>
      <div className={ibmPlexMono.className} style={{ fontSize: 9.5, color: MUTED, letterSpacing: '0.08em' }}>{label}</div>
      <div className={ibmPlexMono.className} style={{ fontSize: 15, color: INK_DEEP, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
