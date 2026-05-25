'use client';
/* eslint-disable no-restricted-syntax -- identity-lab prototype: bespoke palette by design, not the app's chart-color tokens */

import { useState } from 'react';
import { ibmPlexMono, inter } from '../fonts';
import type { LabGroup } from '../useLabCatalogData';

const GROUND = '#eef2f7';
const INK = '#1b4f9c';
const INK_DEEP = '#10325f';
const TEXT = '#243446';
const MUTED = '#6b7a8d';
const GRID = 'rgba(27,79,156,0.06)';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Variant C — "Blueprint": technical drafting / light. Mono labels, schematic frames, grid. */
export function Blueprint({ groups }: { groups: LabGroup[] }) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div
      className={inter.className}
      style={{
        background: GROUND, color: TEXT, minHeight: '100%', padding: '48px 40px 80px',
        backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ border: `2px solid ${INK}`, background: 'rgba(255,255,255,0.7)', padding: '20px 24px', marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className={ibmPlexMono.className} style={{ fontSize: 11, letterSpacing: '0.18em', color: INK, textTransform: 'uppercase' }}>Pillars of Fortune — Asset Schematic</div>
            <h1 className={ibmPlexMono.className} style={{ fontSize: 34, fontWeight: 600, color: INK_DEEP, margin: '6px 0 0', letterSpacing: '-0.01em' }}>CATALOG INDEX</h1>
          </div>
          <div className={ibmPlexMono.className} style={{ fontSize: 11, color: MUTED, textAlign: 'right', lineHeight: 1.7 }}>
            <div>SHEET 1 / 1</div>
            <div>SECTIONS {pad2(groups.length)}</div>
          </div>
        </div>

        {groups.map((g, gi) => (
          <section key={g.category} style={{ marginBottom: 28 }}>
            <div className={ibmPlexMono.className} style={{ fontSize: 12, color: INK, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>
              [ {pad2(gi + 1)} ] {g.category}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 10 }}>
              {g.catalogs.map((c, ci) => {
                const on = active === c.catalogId;
                return (
                  <button
                    key={c.catalogId}
                    onClick={() => setActive(on ? null : c.catalogId)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', background: on ? '#dfeaf7' : 'rgba(255,255,255,0.72)',
                      border: `1px solid ${on ? INK : '#b9cae0'}`, borderWidth: on ? 2 : 1, padding: 0, transition: 'all 110ms',
                    }}
                  >
                    <div className={ibmPlexMono.className} style={{ background: on ? INK : '#dbe5f2', color: on ? '#fff' : INK_DEEP, fontSize: 10.5, letterSpacing: '0.08em', padding: '5px 10px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{pad2(gi + 1)}.{pad2(ci + 1)}</span>
                      <span>{c.verified}/{c.total} VFD</span>
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
      </div>
    </div>
  );
}
