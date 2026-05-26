'use client';
/* eslint-disable no-restricted-syntax -- identity-lab chrome: neutral monochrome bar, bespoke by design */

import { useState, useCallback, useEffect } from 'react';
import { useLabCatalogData, useLabDetail } from './useLabCatalogData';
import { Baseline } from './Baseline';
import { CanonView } from './CanonView';
import { LAB_THEMES, LIGHT } from './theme';
import { LabBridgeStrip } from './LabBridgeStrip';
import { useCanonStore } from './canonStore';
import { writeShellPref } from '@/lib/ecw/shell-pref';

/**
 * UI identity lab (/layout). Consolidated to a single Blueprint baseline with a
 * Light (Blueprint drafting) / Dark (Studio palette + type) theme toggle. The
 * full-width, full-height composition screen: header + entity list + vertical
 * pipeline timeline (sidebar) + a roomy work canvas. Default catalog: spellbook.
 */
export function LayoutLab() {
  const groups = useLabCatalogData();
  const [themeId, setThemeId] = useState<'light' | 'dark'>('light');
  const [catalogId, setCatalogId] = useState('items');
  const [view, setView] = useState<'catalogs' | 'canon'>('catalogs');
  const detail = useLabDetail(catalogId);
  const theme = LAB_THEMES.find((t) => t.id === themeId) ?? LIGHT;
  const hydrate = useCanonStore((s) => s.hydrate);

  useEffect(() => { hydrate(); }, [hydrate]);

  const switchToLegacy = useCallback(() => {
    writeShellPref('legacy');
    const url = new URL(window.location.href);
    url.searchParams.set('legacy', '1');
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#0c0c0c', borderBottom: '1px solid #262626' }}>
        <span style={{ color: '#777', fontSize: 12, marginRight: 12, fontFamily: 'ui-monospace, monospace' }}>/layout · Blueprint baseline</span>
        <button
          onClick={() => setView('catalogs')}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: '1px solid #333',
            background: view === 'catalogs' ? '#fff' : 'transparent', color: view === 'catalogs' ? '#000' : '#aaa',
            fontWeight: view === 'catalogs' ? 600 : 400,
          }}
        >
          Catalogs
        </button>
        <button
          onClick={() => setView('canon')}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: '1px solid #333',
            background: view === 'canon' ? '#fff' : 'transparent', color: view === 'canon' ? '#000' : '#aaa',
            fontWeight: view === 'canon' ? 600 : 400,
          }}
        >
          Canon
        </button>
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
        <button
          onClick={switchToLegacy}
          style={{
            marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, fontSize: 13,
            cursor: 'pointer', border: '1px solid #333', background: 'transparent',
            color: '#aaa', fontWeight: 400,
          }}
        >
          Legacy shell
        </button>
        <LabBridgeStrip t={theme} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'canon'
          ? <CanonView t={theme} />
          : <Baseline theme={theme} groups={groups} detail={detail} onSelectCatalog={setCatalogId} />
        }
      </div>
    </div>
  );
}
