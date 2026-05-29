'use client';

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLabCatalogData, useLabDetail } from './useLabCatalogData';
import { Baseline } from './Baseline';
import { CanonView } from './CanonView';
import { CatalogMatrix } from './CatalogMatrix';
import { LAB_THEMES, LIGHT, themeAttr, type LabDensity } from './theme';
import { labFontVars } from './fonts';
import { LabBridgeStrip } from './LabBridgeStrip';
import { LabJobsChip } from './LabJobsChip';
import { OneShotPanel } from './one-shot/OneShotPanel';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { setupOneShotToastHandler } from './one-shot/toastHandler';
import { useCanonStore } from './canonStore';
import { writeShellPref } from '@/lib/ecw/shell-pref';
import { useLabPrefs } from './hooks/useLabPrefs';
import { Button } from './ui/Button';

/**
 * UI identity lab (/layout). Consolidated to a single Blueprint baseline with a
 * Light (Blueprint drafting) / Dark (Studio palette + type) theme toggle. The
 * full-width, full-height composition screen: header + entity list + vertical
 * pipeline timeline (sidebar) + a roomy work canvas. Default catalog: spellbook.
 */
export function LayoutLab() {
  const reduce = useReducedMotion();
  const groups = useLabCatalogData();
  const { prefs, setPrefs, hydrated } = useLabPrefs();
  const themeId = prefs.themeId;
  const density = prefs.density;
  const [catalogId, setCatalogId] = useState('items');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [view, setView] = useState<'catalogs' | 'canon' | 'matrix'>('catalogs');
  // Step to open when jumping in from the catalog-wide matrix; cleared on a manual Catalogs click.
  const [focusStepIdx, setFocusStepIdx] = useState<number | undefined>(undefined);
  // Adopt persisted last-location once after hydration (React-sanctioned
  // adjust-state-during-render bail-out; StrictMode-safe, no ref mutation).
  const [navAdopted, setNavAdopted] = useState(false);
  if (hydrated && !navAdopted) {
    setNavAdopted(true);
    if (prefs.lastCatalogId) setCatalogId(prefs.lastCatalogId);
    if (prefs.lastEntityId) setEntityId(prefs.lastEntityId);
  }
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
    <div
      data-testid="harness-lab-ready"
      data-lab-root=""
      data-theme={themeAttr(themeId)}
      data-density={density}
      className={labFontVars}
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--lab-bg)' }}
    >
      <a href="#lab-canvas" className="focus-ring"
         style={{ position: 'fixed', left: 'var(--lab-s2)', top: 'var(--lab-s2)', zIndex: 50,
                  padding: 'var(--lab-s2) var(--lab-s3)', background: 'var(--lab-panel)',
                  border: '1px solid var(--lab-line)', color: 'var(--lab-ink)',
                  transform: 'translateY(-200%)', transition: 'transform var(--lab-dur) var(--lab-ease)' }}
         onFocus={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
         onBlur={(e) => { e.currentTarget.style.transform = 'translateY(-200%)'; }}>
        Skip to canvas
      </a>
      {/* ── Title-block (Blueprint) / glass command bar (Studio) chrome ── */}
      <header
        style={{
          flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)',
          padding: 'var(--lab-s2) var(--lab-s4)', background: 'var(--lab-panel)',
          borderBottom: '1px solid var(--lab-line)', boxShadow: 'var(--lab-elev-1)',
          ...(theme.glass ? { backdropFilter: 'blur(var(--lab-glass-blur))' } : {}),
        }}
      >
        <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', marginRight: 'var(--lab-s3)', whiteSpace: 'nowrap' }}>
          PoF·LAB <span style={{ color: 'var(--lab-ink)' }}>sheet · {detail?.catalog.catalogId ?? '—'}</span>
        </span>
        <Button active={view === 'catalogs'} onClick={() => { setView('catalogs'); setFocusStepIdx(undefined); }}>Catalogs</Button>
        <Button active={view === 'matrix'} onClick={() => setView('matrix')}>Matrix</Button>
        <Button active={view === 'canon'} onClick={() => setView('canon')}>Canon</Button>
        {LAB_THEMES.map((t) => (
          <Button key={t.id} active={themeId === t.id} onClick={() => setPrefs({ themeId: t.id })}>{t.label}</Button>
        ))}
        <Button mono ariaLabel={`density: ${density}`} onClick={() => setPrefs({ density: nextDensity(density) })}>
          density · {density === 'compact' ? '▮' : '▯'}
        </Button>
        <Button onClick={() => setPanelOpen(true)}>+ One-shot</Button>
        <LabJobsChip />
        <Button style={{ marginLeft: 'auto' }} onClick={switchToLegacy}>Legacy shell</Button>
        <LabBridgeStrip t={theme} />
      </header>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {view === 'canon' ? <CanonView t={theme} />
              : view === 'matrix' ? <CatalogMatrix t={theme} groups={groups} catalogId={catalogId} onOpenStep={openFromMatrix} />
              : <Baseline theme={theme} groups={groups} detail={detail}
                  onSelectCatalog={(id) => { setCatalogId(id); setEntityId(null); setPrefs({ lastCatalogId: id, lastEntityId: null }); }}
                  entityId={entityId}
                  onSelectEntity={(id) => { setEntityId(id); setPrefs({ lastEntityId: id }); }}
                  initialStepIdx={focusStepIdx}
                />}
          </motion.div>
        </AnimatePresence>
      </div>
      <OneShotPanel t={theme} />
    </div>
  );
}

const nextDensity = (d: LabDensity): LabDensity => (d === 'compact' ? 'comfortable' : 'compact');
