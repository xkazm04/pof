'use client';
/* eslint-disable no-restricted-syntax -- identity-lab prototype: bespoke palette by design, not the app's chart-color tokens */

import { useState } from 'react';
import { inter, jetbrainsMono } from '../fonts';
import type { LabGroup } from '../useLabCatalogData';

const BG = '#0a0e14';
const TEXT = '#e2e8f0';
const MUTED = '#8c9aae';
const CYAN = '#22d3ee';
const EMERALD = '#34d399';
const GLASS = 'rgba(255,255,255,0.05)';
const GLASS_BORDER = 'rgba(255,255,255,0.10)';
const ELEV3 = '0 4px 8px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.25)';
const ELEV4 = '0 8px 16px rgba(0,0,0,0.5), 0 16px 32px rgba(0,0,0,0.3)';

/** Variant E — "Studio": personas-derived / dark. Cyan, glass cards, elevation, semantic type. */
export function Studio({ groups }: { groups: LabGroup[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = groups.reduce((s, g) => s + g.catalogs.length, 0);

  return (
    <div className={inter.className} style={{ background: BG, color: TEXT, minHeight: '100%', padding: '48px 40px 80px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: CYAN }}>Asset Studio</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.015em', margin: '8px 0 6px' }}>Catalogs</h1>
        <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.7 }}>
          {total} catalogs across {groups.length} domains. Compose, generate, and verify game content.
        </p>

        {groups.map((g) => (
          <section key={g.category} style={{ marginTop: 36 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: MUTED, marginBottom: 14, borderBottom: `1px solid ${GLASS_BORDER}`, paddingBottom: 8 }}>
              {g.category}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {g.catalogs.map((c) => {
                const on = active === c.catalogId;
                return (
                  <button
                    key={c.catalogId}
                    onClick={() => setActive(on ? null : c.catalogId)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', padding: 18, borderRadius: 12,
                      background: on ? 'rgba(34,211,238,0.08)' : GLASS,
                      border: `1px solid ${on ? 'rgba(34,211,238,0.4)' : GLASS_BORDER}`,
                      boxShadow: on ? ELEV4 : ELEV3, backdropFilter: 'blur(12px)',
                      transition: 'transform 100ms, box-shadow 150ms, border-color 150ms',
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{c.label}</div>
                      <span className={jetbrainsMono.className} style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 999, background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.20)', color: CYAN }}>
                        {c.total}
                      </span>
                    </div>
                    <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.55, margin: '8px 0 14px', minHeight: 42 }}>{c.description}</div>
                    <div className={jetbrainsMono.className} style={{ fontSize: 11, color: c.verified > 0 ? EMERALD : MUTED }}>
                      ● {c.verified} verified
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
