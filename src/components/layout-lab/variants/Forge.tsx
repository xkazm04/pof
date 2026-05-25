'use client';
/* eslint-disable no-restricted-syntax -- identity-lab prototype: bespoke palette by design, not the app's chart-color tokens */

import { useState } from 'react';
import { oswald, inter, ibmPlexMono } from '../fonts';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';
import { labStepsDone } from '../labPipelines';
import type { LabGroup, LabDetail } from '../useLabCatalogData';

const OBSIDIAN = '#16130f';
const CARD = '#211c16';
const TEXT = '#ece6dd';
const MUTED = '#9a8f80';
const EMBER = '#f59e42';
const HOT = '#e2502a';

const CAT_HUE: Record<string, string> = {
  'Core / Existing': '#f59e42', 'Game Assets': '#e2502a', 'Quests & Narrative': '#d98a3d',
  'Systems': '#c2783a', 'Audio & FX': '#e0a64b', 'UI': '#cf9b56', 'Input & Platform': '#b88747',
  'Onboarding': '#d4853a', 'Economy / Meta': '#e8b54e',
};

interface Props { groups: LabGroup[]; detail: LabDetail | null; onSelect: (id: string) => void; onBack: () => void }

/** Variant B — "Forge": condensed industrial, ember, tactile. Detail = vertical molten timeline. */
export function Forge({ groups, detail, onSelect, onBack }: Props) {
  return (
    <div className={inter.className} style={{ background: OBSIDIAN, color: TEXT, minHeight: '100%', padding: '40px 40px 80px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {detail ? <ForgeDetail detail={detail} onBack={onBack} /> : <ForgeHub groups={groups} onSelect={onSelect} />}
      </div>
    </div>
  );
}

function ForgeHub({ groups, onSelect }: { groups: LabGroup[]; onSelect: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <>
      <div className={ibmPlexMono.className} style={{ fontSize: 11, letterSpacing: '0.2em', color: EMBER, textTransform: 'uppercase' }}>⛓ Pillars of Fortune</div>
      <h1 className={oswald.className} style={{ fontSize: 56, fontWeight: 700, textTransform: 'uppercase', margin: '6px 0 4px', lineHeight: 0.98 }}>Catalog <span style={{ color: EMBER }}>Forge</span></h1>
      <div style={{ width: 120, height: 3, background: `linear-gradient(90deg, ${HOT}, ${EMBER})`, marginBottom: 32 }} />
      {groups.map((g) => {
        const hue = CAT_HUE[g.category] ?? EMBER;
        return (
          <section key={g.category} style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ width: 8, height: 8, background: hue, transform: 'rotate(45deg)' }} />
              <h2 className={oswald.className} style={{ fontSize: 19, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{g.category}</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {g.catalogs.map((c) => {
                const on = active === c.catalogId;
                return (
                  <button key={c.catalogId} onClick={() => onSelect(c.catalogId)} onMouseEnter={() => setActive(c.catalogId)} onMouseLeave={() => setActive(null)}
                    style={{ textAlign: 'left', padding: '16px 16px 14px', background: on ? '#2a221a' : CARD, cursor: 'pointer', borderRadius: 4, border: `1px solid ${on ? hue : '#33291f'}`, borderTop: `1px solid ${on ? hue : '#4a3c2c'}`, boxShadow: on ? `0 0 0 1px ${hue}55, 0 8px 22px #0008` : '0 2px 8px #0006', transition: 'all 120ms' }}>
                    <div className={oswald.className} style={{ fontSize: 19, fontWeight: 600, textTransform: 'uppercase', color: on ? hue : TEXT }}>{c.label}</div>
                    <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45, margin: '6px 0 12px', minHeight: 36 }}>{c.description}</div>
                    <div className={ibmPlexMono.className} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED }}>
                      <span style={{ color: TEXT }}>{c.total} units</span><span style={{ color: c.verified > 0 ? EMBER : MUTED }}>{c.verified} forged →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

function ForgeDetail({ detail, onBack }: { detail: LabDetail; onBack: () => void }) {
  const [sel, setSel] = useState(detail.entities[0]?.id ?? null);
  const entity = detail.entities.find((e) => e.id === sel) ?? detail.entities[0] ?? null;
  const done = entity ? labStepsDone(entity.lifecycle, detail.steps.length) : 0;
  const fields = summarizeEntityData(entity?.data);

  return (
    <>
      <button onClick={onBack} className={ibmPlexMono.className} style={{ background: 'none', border: 'none', color: EMBER, cursor: 'pointer', fontSize: 12, marginBottom: 14 }}>← CATALOG FORGE</button>
      <h1 className={oswald.className} style={{ fontSize: 40, fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>{detail.catalog.label}</h1>
      <div className={ibmPlexMono.className} style={{ fontSize: 11, color: MUTED, marginBottom: 24 }}>{detail.entities.length} units · {detail.catalog.verified} forged</div>

      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr 250px', gap: 24, alignItems: 'start' }}>
        {/* spell selection rail */}
        <div style={{ borderRight: '1px solid #33291f', paddingRight: 16, maxHeight: 560, overflow: 'auto' }}>
          {detail.entities.map((e) => {
            const on = e.id === sel;
            return (
              <button key={e.id} onClick={() => setSel(e.id)} className={oswald.className}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.02em', cursor: 'pointer', border: 'none', borderLeft: on ? `3px solid ${EMBER}` : '3px solid transparent', background: on ? '#2a221a' : 'transparent', color: on ? EMBER : TEXT }}>
                {e.name}
              </button>
            );
          })}
        </div>

        {/* vertical molten timeline */}
        <div style={{ position: 'relative', paddingLeft: 8 }}>
          <div className={ibmPlexMono.className} style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 18 }}>Forge Pipeline · {done}/{detail.steps.length}</div>
          <div style={{ position: 'absolute', left: 17, top: 44, bottom: 8, width: 2, background: '#33291f' }} />
          <div style={{ position: 'absolute', left: 17, top: 44, height: `calc((100% - 52px) * ${detail.steps.length ? done / detail.steps.length : 0})`, width: 2, background: `linear-gradient(${HOT}, ${EMBER})`, boxShadow: `0 0 8px ${EMBER}` }} />
          {detail.steps.map((step, i) => {
            const isDone = i < done;
            return (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '7px 0', position: 'relative' }}>
                <span style={{ width: 20, height: 20, borderRadius: 3, transform: 'rotate(45deg)', flexShrink: 0, zIndex: 1, background: isDone ? EMBER : OBSIDIAN, border: `2px solid ${isDone ? EMBER : '#4a3c2c'}`, boxShadow: isDone ? `0 0 10px ${EMBER}99` : 'none' }} />
                <span style={{ fontSize: 14, color: isDone ? TEXT : MUTED, fontWeight: isDone ? 500 : 400 }}>
                  <span className={ibmPlexMono.className} style={{ color: MUTED, fontSize: 11, marginRight: 8 }}>{String(i + 1).padStart(2, '0')}</span>{step}
                </span>
              </div>
            );
          })}
        </div>

        {/* stat plates */}
        <div>
          <div className={ibmPlexMono.className} style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14 }}>Stats</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {fields.map((f) => (
              <div key={f.label} style={{ background: CARD, border: '1px solid #33291f', borderTop: '1px solid #4a3c2c', borderRadius: 4, padding: '10px 12px' }}>
                <div className={ibmPlexMono.className} style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{f.label}</div>
                <div className={oswald.className} style={{ fontSize: 22, fontWeight: 600, color: EMBER }}>{f.value}</div>
              </div>
            ))}
            {fields.length === 0 && <div style={{ fontSize: 12, color: MUTED }}>No metadata authored yet.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
