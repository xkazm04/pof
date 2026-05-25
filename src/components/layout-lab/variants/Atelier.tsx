'use client';
/* eslint-disable no-restricted-syntax -- identity-lab prototype: bespoke palette by design, not the app's chart-color tokens */

import { useState } from 'react';
import { fraunces, inter } from '../fonts';
import type { LabGroup } from '../useLabCatalogData';

const PAPER = '#faf7f2';
const INK = '#1a1714';
const MUTED = '#8a8076';
const RULE = '#e2dace';
const OXBLOOD = '#7c2d12';

/** Variant A — "Atelier": editorial / light. Serif display, hairline rules, whitespace. */
export function Atelier({ groups }: { groups: LabGroup[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = groups.reduce((s, g) => s + g.catalogs.length, 0);

  return (
    <div className={inter.className} style={{ background: PAPER, color: INK, minHeight: '100%', padding: '64px 0' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', color: OXBLOOD, fontWeight: 600 }}>
          Pillars of Fortune · Asset Atelier
        </div>
        <h1 className={fraunces.className} style={{ fontSize: 56, lineHeight: 1.04, fontWeight: 600, margin: '14px 0 10px', letterSpacing: '-0.02em' }}>
          The Catalog
        </h1>
        <p style={{ fontSize: 15, color: MUTED, maxWidth: 520, lineHeight: 1.6 }}>
          Every asset and system the game is composed from, kept as a curated index — {groups.length} collections, {total} catalogs.
        </p>
        <div style={{ height: 1, background: INK, margin: '32px 0 8px' }} />

        {groups.map((g) => (
          <section key={g.category} style={{ marginTop: 40 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: MUTED, fontWeight: 600, marginBottom: 14 }}>
              {g.category}
            </div>
            <div>
              {g.catalogs.map((c) => {
                const on = active === c.catalogId;
                return (
                  <button
                    key={c.catalogId}
                    onClick={() => setActive(on ? null : c.catalogId)}
                    style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24, width: '100%',
                      textAlign: 'left', padding: '16px 16px 16px', borderTop: `1px solid ${RULE}`, cursor: 'pointer',
                      background: on ? '#f1ece4' : 'transparent',
                      borderLeft: on ? `2px solid ${OXBLOOD}` : '2px solid transparent', transition: 'background 120ms',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className={fraunces.className} style={{ fontSize: 21, fontWeight: 500, marginBottom: 3 }}>{c.label}</div>
                      <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.5 }}>{c.description}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED }}>
                      <div className={fraunces.className} style={{ fontSize: 22, color: INK, letterSpacing: 0, fontWeight: 500 }}>{c.total}</div>
                      <div style={{ marginTop: 2 }}>{c.verified} verified</div>
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
