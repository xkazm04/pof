'use client';
/* eslint-disable no-restricted-syntax -- identity-lab prototype: bespoke palette by design, not the app's chart-color tokens */

import { useState } from 'react';
import { oswald, inter, ibmPlexMono } from '../fonts';
import type { LabGroup } from '../useLabCatalogData';

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

/** Variant B — "Forge": thematic / dark. Condensed industrial type, ember, tactile cards. */
export function Forge({ groups }: { groups: LabGroup[] }) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className={inter.className} style={{ background: OBSIDIAN, color: TEXT, minHeight: '100%', padding: '48px 40px 80px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div className={ibmPlexMono.className} style={{ fontSize: 11, letterSpacing: '0.2em', color: EMBER, textTransform: 'uppercase' }}>
          ⛓ Pillars of Fortune
        </div>
        <h1 className={oswald.className} style={{ fontSize: 60, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.01em', margin: '6px 0 4px', lineHeight: 0.98 }}>
          Catalog <span style={{ color: EMBER }}>Forge</span>
        </h1>
        <div style={{ width: 120, height: 3, background: `linear-gradient(90deg, ${HOT}, ${EMBER})`, marginBottom: 36 }} />

        {groups.map((g) => {
          const hue = CAT_HUE[g.category] ?? EMBER;
          return (
            <section key={g.category} style={{ marginTop: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ width: 8, height: 8, background: hue, transform: 'rotate(45deg)' }} />
                <h2 className={oswald.className} style={{ fontSize: 20, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{g.category}</h2>
                <span className={ibmPlexMono.className} style={{ fontSize: 11, color: MUTED }}>{g.catalogs.length} catalogs</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {g.catalogs.map((c) => {
                  const on = active === c.catalogId;
                  return (
                    <button
                      key={c.catalogId}
                      onClick={() => setActive(on ? null : c.catalogId)}
                      style={{
                        textAlign: 'left', padding: '16px 16px 14px', background: on ? '#2a221a' : CARD, cursor: 'pointer',
                        borderRadius: 4, border: `1px solid ${on ? hue : '#33291f'}`, borderTop: `1px solid ${on ? hue : '#4a3c2c'}`,
                        boxShadow: on ? `0 0 0 1px ${hue}55, 0 8px 22px #0008` : '0 2px 8px #0006', transition: 'all 120ms',
                      }}
                    >
                      <div className={oswald.className} style={{ fontSize: 19, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: on ? hue : TEXT }}>{c.label}</div>
                      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45, margin: '6px 0 12px', minHeight: 36 }}>{c.description}</div>
                      <div className={ibmPlexMono.className} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED }}>
                        <span style={{ color: TEXT }}>{c.total} units</span>
                        <span style={{ color: c.verified > 0 ? EMBER : MUTED }}>{c.verified} forged</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
