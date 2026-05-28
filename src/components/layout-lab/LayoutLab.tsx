'use client';
/* eslint-disable no-restricted-syntax -- identity-lab chrome: neutral monochrome bar, bespoke by design */

import { useState, useCallback, useEffect } from 'react';
import { useLabCatalogData, useLabDetail } from './useLabCatalogData';
import { Baseline } from './Baseline';
import { CanonView } from './CanonView';
import { CatalogMatrix } from './CatalogMatrix';
import { LAB_THEMES, LIGHT } from './theme';
import { LabBridgeStrip } from './LabBridgeStrip';
import { LabJobsChip } from './LabJobsChip';
import { OneShotPanel } from './one-shot/OneShotPanel';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { setupOneShotToastHandler } from './one-shot/toastHandler';
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
  const [entityId, setEntityId] = useState<string | null>(null);
  const [view, setView] = useState<'catalogs' | 'canon' | 'matrix'>('catalogs');
  // Step to open when jumping in from the catalog-wide matrix; cleared on a manual Catalogs click.
  const [focusStepIdx, setFocusStepIdx] = useState<number | undefined>(undefined);
  const detail = useLabDetail(catalogId);
  const theme = LAB_THEMES.find((t) => t.id === themeId) ?? LIGHT;
  const hydrate = useCanonStore((s) => s.hydrate);
  const setPanelOpen = useOneShotLabStore((s) => s.setPanelOpen);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    const dispose = setupOneShotToastHandler();
    return () => dispose();
  }, []);

  // Subscribe directly so state updates happen inside a store callback, not in the effect body.
  useEffect(() => {
    const unsub = useOneShotLabStore.subscribe((state, prev) => {
      if (state.pendingNavigation && state.pendingNavigation !== prev.pendingNavigation) {
        setCatalogId(state.pendingNavigation.catalogId);
        setEntityId(state.pendingNavigation.entityId);
        useOneShotLabStore.getState().setPendingNavigation(null);
      }
    });
    return unsub;
  }, []);

  // Jump straight from a matrix cell to that entity's step: Baseline remounts on the
  // view switch, so it reads focusStepIdx as its initial step.
  const openFromMatrix = useCallback((cid: string, eid: string, stepIdx: number) => {
    setCatalogId(cid);
    setEntityId(eid);
    setFocusStepIdx(stepIdx);
    setView('catalogs');
  }, []);

  const switchToLegacy = useCallback(() => {
    writeShellPref('legacy');
    const url = new URL(window.location.href);
    url.searchParams.set('legacy', '1');
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  return (
    <div data-testid="harness-lab-ready" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#0c0c0c', borderBottom: '1px solid #262626' }}>
        <span style={{ color: '#777', fontSize: 12, marginRight: 12, fontFamily: 'ui-monospace, monospace' }}>/layout · Blueprint baseline</span>
        <button
          onClick={() => { setView('catalogs'); setFocusStepIdx(undefined); }}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: '1px solid #333',
            background: view === 'catalogs' ? '#fff' : 'transparent', color: view === 'catalogs' ? '#000' : '#aaa',
            fontWeight: view === 'catalogs' ? 600 : 400,
          }}
        >
          Catalogs
        </button>
        <button
          onClick={() => setView('matrix')}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: '1px solid #333',
            background: view === 'matrix' ? '#fff' : 'transparent', color: view === 'matrix' ? '#000' : '#aaa',
            fontWeight: view === 'matrix' ? 600 : 400,
          }}
        >
          Matrix
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
          onClick={() => setPanelOpen(true)}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13,
            cursor: 'pointer', border: '1px solid #333', background: 'transparent',
            color: '#aaa', fontWeight: 400,
          }}
        >
          + One-shot
        </button>
        <LabJobsChip t={theme} />
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
          : view === 'matrix'
            ? <CatalogMatrix t={theme} groups={groups} catalogId={catalogId} onOpenStep={openFromMatrix} />
            : <Baseline theme={theme} groups={groups} detail={detail}
                onSelectCatalog={(id) => { setCatalogId(id); setEntityId(null); }}
                entityId={entityId}
                onSelectEntity={setEntityId}
                initialStepIdx={focusStepIdx}
              />
        }
      </div>
      <OneShotPanel t={theme} />
    </div>
  );
}
