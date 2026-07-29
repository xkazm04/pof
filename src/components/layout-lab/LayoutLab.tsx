'use client';

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useLabCatalogData, useLabDetail } from './useLabCatalogData';
import { Baseline } from './Baseline';
import { CanonView } from './CanonView';
import { CatalogMatrix } from './CatalogMatrix';
import { GlobalCoach } from './GlobalCoach';
import { LabSearch, useLabSearchShortcut } from './LabSearch';
import { LAB_THEMES, LIGHT, themeAttr } from './theme';
import { labFontVars } from './fonts';
import { LabBridgeStrip } from './LabBridgeStrip';
import { LabJobsChip } from './LabJobsChip';
import { RunnerChip } from './RunnerChip';
import { OneShotPanel } from './one-shot/OneShotPanel';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { setupOneShotToastHandler } from './one-shot/toastHandler';
import { useCanonStore } from './canonStore';
import { writeShellPref } from '@/lib/ecw/shell-pref';
import { useLabPrefs } from './hooks/useLabPrefs';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

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
  const [catalogId, setCatalogId] = useState('items');
  const [entityId, setEntityId] = useState<string | null>(null);
  // The pipeline step position is OWNED here (single source of truth) so it survives
  // the view toggles that remount Baseline via AnimatePresence — the old per-Baseline
  // `stepIdx` reset to 0 on every catalogs↔matrix↔canon switch (navigation amnesia).
  // Keeping it in the parent also makes a matrix/coach jump a plain state write instead
  // of a fragile "remount reads the initial focus" channel — so there is no lingering
  // focus value to replay stale (it is consumed exactly once, when set).
  const [stepIdx, setStepIdx] = useState(0);
  const [view, setView] = useState<'catalogs' | 'canon' | 'matrix'>('catalogs');
  // Adopt persisted last-location once after hydration (React-sanctioned
  // adjust-state-during-render bail-out; StrictMode-safe, no ref mutation).
  const [navAdopted, setNavAdopted] = useState(false);
  if (hydrated && !navAdopted) {
    setNavAdopted(true);
    if (prefs.lastCatalogId) setCatalogId(prefs.lastCatalogId);
    if (prefs.lastEntityId) setEntityId(prefs.lastEntityId);
  }
  const detail = useLabDetail(catalogId);
  // Reconcile the selected entity in STATE, not just at render. Baseline falls back to
  // `entities[0]` when `entityId` is missing or names an entity that no longer exists —
  // but the state stayed wrong, so the app RENDERED one entity while every state consumer
  // (LabSearch's `currentEntityId`, step-hit resolution) pointed at a phantom. Adjusting
  // state during render is the React-sanctioned bail-out (no effect, StrictMode-safe);
  // the next render finds the id and the branch is skipped.
  const labEntities = detail?.entities;
  if (navAdopted && labEntities && labEntities.length > 0 && !labEntities.some((e) => e.id === entityId)) {
    setEntityId(labEntities[0].id);
  }
  // Lab-wide search (⌘/Ctrl+K or "/"), driving the SAME lifted nav callbacks below.
  const [searchOpen, setSearchOpen] = useLabSearchShortcut();
  const theme = LAB_THEMES.find((t) => t.id === themeId) ?? LIGHT;
  const hydrate = useCanonStore((s) => s.hydrate);
  const setPanelOpen = useOneShotLabStore((s) => s.setPanelOpen);

  // ── Single source of truth for navigation ──────────────────────────────────
  // Every catalog/entity/step mutation flows through these so persistence (last
  // location) and step-reset behaviour are identical on ALL paths — tree click,
  // matrix dropdown, matrix cell, and GlobalCoach jump (no more path-dependent amnesia).
  const selectCatalog = useCallback((id: string) => {
    setCatalogId(id);
    setEntityId(null);
    setStepIdx(0);
    setPrefs({ lastCatalogId: id, lastEntityId: null });
  }, [setPrefs]);
  const selectEntity = useCallback((id: string) => {
    setEntityId(id);
    setStepIdx(0);
    setPrefs({ lastEntityId: id });
  }, [setPrefs]);
  // Jump to a specific entity+step (matrix cell / coach), persisting the location the
  // same way a tree click does — so the daily driver reopens where you left off.
  const navigateTo = useCallback((cid: string, eid: string, step: number) => {
    setCatalogId(cid);
    setEntityId(eid);
    setStepIdx(step);
    setPrefs({ lastCatalogId: cid, lastEntityId: eid });
  }, [setPrefs]);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    const dispose = setupOneShotToastHandler();
    return () => dispose();
  }, []);

  // Subscribe directly so state updates happen inside a store callback, not in the effect body.
  useEffect(() => {
    const unsub = useOneShotLabStore.subscribe((state, prev) => {
      if (state.pendingNavigation && state.pendingNavigation !== prev.pendingNavigation) {
        // A GlobalCoach jump writes catalog+entity+step straight into the lifted nav
        // state (consumed once here) — no separate focus channel that could replay stale.
        navigateTo(state.pendingNavigation.catalogId, state.pendingNavigation.entityId, state.pendingNavigation.stepIndex ?? 0);
        useOneShotLabStore.getState().setPendingNavigation(null);
      }
    });
    return unsub;
  }, [navigateTo]);

  // Jump straight from a matrix cell to that entity's step, then surface the composition view.
  const openFromMatrix = useCallback((cid: string, eid: string, step: number) => {
    navigateTo(cid, eid, step);
    setView('catalogs');
  }, [navigateTo]);

  const switchToLegacy = useCallback(() => {
    writeShellPref('legacy');
    const url = new URL(window.location.href);
    url.searchParams.set('legacy', '1');
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  // `data-lab-entity` publishes the entity the lab's STATE points at (the same id
  // LabSearch resolves step hits against), so "what is rendered" and "what state says"
  // stay checkable rather than silently diverging.
  return (
    <div
      data-testid="harness-lab-ready"
      data-lab-root=""
      data-lab-entity={entityId ?? ''}
      data-theme={themeAttr(themeId)}
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
        {/* Left zone: brand. flex:1 balances the right zone so the center group is truly centered. */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)' }}>
          <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            PoF·LAB <span style={{ color: 'var(--lab-ink)' }}>sheet · {detail?.catalog.catalogId ?? '—'}</span>
          </span>
        </div>
        {/* Center zone: primary actions */}
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)' }}>
          <Button
            onClick={() => setSearchOpen(true)}
            data-testid="lab-search-open"
            ariaLabel="Search catalogs, entities and pipeline steps"
            title="Search (Ctrl+K)"
          >
            Search <span aria-hidden="true" style={{ color: 'var(--lab-muted)' }}>⌘K</span>
          </Button>
          <Button active={view === 'catalogs'} onClick={() => setView('catalogs')}>Catalogs</Button>
          <Button active={view === 'matrix'} onClick={() => setView('matrix')}>Matrix</Button>
          <Button active={view === 'canon'} onClick={() => setView('canon')}>Canon</Button>
          <Button onClick={() => setPanelOpen(true)}>+ One-shot</Button>
          <Button onClick={() => { window.location.href = '/status'; }}>Status</Button>
          <Button onClick={() => { window.location.href = '/3d'; }}>3D Studio</Button>
          <Button onClick={switchToLegacy}>Legacy shell</Button>
        </div>
        {/* Right zone: status + theme toggle in the corner */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--lab-s2)' }}>
          <LabJobsChip />
          <RunnerChip t={theme} />
          <LabBridgeStrip t={theme} />
          <ThemeToggle themeId={themeId} onToggle={() => setPrefs({ themeId: themeId === 'light' ? 'dark' : 'light' })} />
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Lab-level cross-catalog coach — only over the composition (Baseline) view;
            the Matrix and Canon carry their own catalog-wide summaries. */}
        {view === 'catalogs' && <GlobalCoach t={theme} />}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {view === 'canon' ? <CanonView t={theme} />
              : view === 'matrix' ? <CatalogMatrix t={theme} groups={groups} catalogId={catalogId} onSelectCatalog={selectCatalog} onOpenStep={openFromMatrix} />
              : <Baseline theme={theme} groups={groups} detail={detail}
                  onSelectCatalog={selectCatalog}
                  entityId={entityId}
                  onSelectEntity={selectEntity}
                  stepIdx={stepIdx}
                  onSelectStep={setStepIdx}
                />}
          </motion.div>
        </AnimatePresence>
      </div>
      <LabSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        currentEntityId={entityId}
        onSelectCatalog={selectCatalog}
        onNavigate={(cid, eid, step) => { navigateTo(cid, eid, step); setView('catalogs'); }}
      />
      <OneShotPanel t={theme} />
    </div>
  );
}

/**
 * Light/Dark theme switch as a single icon button parked in the header's right
 * corner. Shows the icon of the theme you'd switch *to* (Moon → Studio Dark,
 * Sun → Blueprint); the aria-label names that target theme.
 */
function ThemeToggle({ themeId, onToggle }: { themeId: 'light' | 'dark'; onToggle: () => void }) {
  const toDark = themeId === 'light';
  const Icon = toDark ? Moon : Sun;
  const label = toDark ? 'Switch to Studio Dark theme' : 'Switch to Blueprint theme';
  return (
    <IconButton ariaLabel={label} onClick={onToggle}>
      <Icon size={16} aria-hidden style={{ display: 'block' }} />
    </IconButton>
  );
}
