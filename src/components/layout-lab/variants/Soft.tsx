'use client';
/* eslint-disable no-restricted-syntax -- identity-lab prototype: bespoke palette by design, not the app's chart-color tokens */

import { useState } from 'react';
import { nunito } from '../fonts';
import type { LabGroup } from '../useLabCatalogData';

const BG = '#fbfaf7';
const TEXT = '#3a3633';
const MUTED = '#8c857d';

// Pastel {tint background, ink} per category.
const PASTEL: Record<string, { bg: string; ink: string; chip: string }> = {
  'Core / Existing': { bg: '#eaf3ff', ink: '#2f5fa6', chip: '#d2e6ff' },
  'Game Assets': { bg: '#fdeef0', ink: '#b15968', chip: '#fbd9de' },
  'Quests & Narrative': { bg: '#f1ecff', ink: '#6d57b0', chip: '#e2d8ff' },
  'Systems': { bg: '#eafaf1', ink: '#3f9168', chip: '#d2f1e0' },
  'Audio & FX': { bg: '#fff4e6', ink: '#bf8230', chip: '#ffe6c4' },
  'UI': { bg: '#fdeefb', ink: '#a857a0', chip: '#f8dcf3' },
  'Input & Platform': { bg: '#eef6ff', ink: '#4079b3', chip: '#d9ecff' },
  'Onboarding': { bg: '#eafcf8', ink: '#37947f', chip: '#d0f2ea' },
  'Economy / Meta': { bg: '#fdf6e3', ink: '#b59224', chip: '#fbecc0' },
};
const fallback = { bg: '#f0eeea', ink: '#6b655d', chip: '#e3ded6' };

/** Variant D — "Soft": consumer / light. Rounded Nunito, pastel per-category, friendly cards. */
export function Soft({ groups }: { groups: LabGroup[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = groups.reduce((s, g) => s + g.catalogs.length, 0);
  const verified = groups.reduce((s, g) => s + g.catalogs.reduce((a, c) => a + c.verified, 0), 0);

  return (
    <div className={nunito.className} style={{ background: BG, color: TEXT, minHeight: '100%', padding: '56px 40px 90px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Your Catalogs ✨</h1>
        <p style={{ fontSize: 16, color: MUTED, marginTop: 8, fontWeight: 600 }}>
          {total} catalogs to build &amp; play with across {groups.length} families · {verified} verified so far
        </p>

        {groups.map((g) => {
          const p = PASTEL[g.category] ?? fallback;
          return (
            <section key={g.category} style={{ marginTop: 36 }}>
              <span style={{ display: 'inline-block', background: p.chip, color: p.ink, fontWeight: 800, fontSize: 13, padding: '6px 16px', borderRadius: 999, marginBottom: 16 }}>
                {g.category}
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(244px, 1fr))', gap: 16 }}>
                {g.catalogs.map((c) => {
                  const on = active === c.catalogId;
                  const pct = c.total ? Math.round((c.verified / c.total) * 100) : 0;
                  return (
                    <button
                      key={c.catalogId}
                      onClick={() => setActive(on ? null : c.catalogId)}
                      style={{
                        textAlign: 'left', cursor: 'pointer', background: '#fff', borderRadius: 18, padding: 18,
                        border: on ? `2px solid ${p.ink}` : '2px solid transparent',
                        boxShadow: on ? `0 10px 28px ${p.ink}22` : '0 6px 20px rgba(0,0,0,0.06)',
                        transform: on ? 'translateY(-2px)' : 'none', transition: 'all 140ms',
                      }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: p.bg, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.ink, fontWeight: 800, fontSize: 18 }}>
                        {c.label.charAt(0)}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{c.label}</div>
                      <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, fontWeight: 600, minHeight: 38 }}>{c.description}</div>
                      <div style={{ marginTop: 12, height: 8, borderRadius: 999, background: p.bg, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: p.ink, borderRadius: 999 }} />
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: p.ink }}>{c.verified}/{c.total} ready</div>
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
