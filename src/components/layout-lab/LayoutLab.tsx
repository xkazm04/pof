'use client';
/* eslint-disable no-restricted-syntax -- identity-lab chrome: neutral monochrome bar, bespoke by design */

import { useState, useMemo } from 'react';
import { useLabCatalogData, useLabDetail } from './useLabCatalogData';
import { Baseline } from './Baseline';
import { LAB_THEMES, LIGHT } from './theme';

/**
 * UI identity lab (/layout). Consolidated to a single Blueprint baseline with a
 * Light (Blueprint drafting) / Dark (Studio palette + type) theme toggle. The
 * full-width, full-height composition screen: header + entity list + vertical
 * pipeline timeline (sidebar) + a roomy work canvas. Default catalog: spellbook.
 */
export function LayoutLab() {
  const groups = useLabCatalogData();
  const catalogs = useMemo(() => groups.flatMap((g) => g.catalogs), [groups]);
  const [themeId, setThemeId] = useState<'light' | 'dark'>('light');
  const [catalogId, setCatalogId] = useState('spellbook');
  const detail = useLabDetail(catalogId);
  const theme = LAB_THEMES.find((t) => t.id === themeId) ?? LIGHT;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#0c0c0c', borderBottom: '1px solid #262626' }}>
        <span style={{ color: '#777', fontSize: 12, marginRight: 12, fontFamily: 'ui-monospace, monospace' }}>/layout · Blueprint baseline</span>
        {LAB_THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setThemeId(t.id)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: '1px solid #333',
              background: themeId === t.id ? '#fff' : 'transparent', color: themeId === t.id ? '#000' : '#aaa',
              fontWeight: themeId === t.id ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Baseline theme={theme} catalogs={catalogs} detail={detail} onSelectCatalog={setCatalogId} />
      </div>
    </div>
  );
}
