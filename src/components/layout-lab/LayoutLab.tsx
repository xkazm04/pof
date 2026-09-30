'use client';

import { useCallback, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useLabCatalogData } from './useLabCatalogData';
import { usePersistedEntityHydration } from './hooks/usePersistedEntityHydration';
import { Baseline } from './Baseline';
import { CanonView } from './CanonView';
import { CatalogMatrix } from './CatalogMatrix';
import { WorkQueueStrip, useLabWorkQueue } from './WorkQueueStrip';
import { GlobalCoach } from './GlobalCoach';
import { LabSearch, useLabSearchShortcut } from './LabSearch';
import { LabRouteLinks } from './LabRouteLinks';
import { LAB_THEMES, LIGHT, themeAttr } from './theme';
import { labFontVars } from './fonts';
import { LabBridgeStrip } from './LabBridgeStrip';
import { ActivityChip } from './ActivityChip';
import { OneShotPanel } from './one-shot/OneShotPanel';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { setupOneShotToastHandler } from './one-shot/toastHandler';
import { useCanonStore } from './canonStore';
import { switchShell } from '@/lib/ecw/shell-pref';
import { useLabPrefs } from './hooks/useLabPrefs';
import { useLabLocation } from './hooks/useLabLocation';
import { useLabAddress } from './hooks/useLabRouteSync';
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
  // Persisted entities (other sessions' one-shots, /diablo ingests) join the tree.
  usePersistedEntityHydration();
  const { prefs, setPrefs } = useLabPrefs();
  const themeId = prefs.themeId;
  // WHERE the lab is (catalog + entity + step + view) is ONE value behind ONE navigate door:
  // every writer — tree, rail, matrix cell/row/dropdown, LabSearch, work queue, coach jump and
  // the one-shot toast's "Open" — dispatches through `nav` (see `labLocation.ts`), so persistence
  // and step-reset are identical on every path and every "open" lands on the Catalogs view.
  // The location is owned HERE, not per-Baseline, so it survives the view toggles that remount
  // Baseline via AnimatePresence. `loc` is already resolved: a phantom entity and an out-of-range
  // step are derived away in render, never written back.
  const { loc, detail, nav } = useLabLocation();
  const { catalogId, entityId, stepIdx, view } = loc;
  // The location's ADDRESS (`/?legacy=0&c=&e=&s=<step label>&v=`): arrival opens it, section moves push,
  // step moves replace, Back/Forward re-apply through the same `nav` door (useLabRouteSync).
  useLabAddress(loc, detail, nav);
  // Lab-wide search (⌘/Ctrl+K or "/"), driving the SAME navigate door (`nav`).
  const [searchOpen, setSearchOpen] = useLabSearchShortcut();
  const theme = LAB_THEMES.find((t) => t.id === themeId) ?? LIGHT;
  const hydrate = useCanonStore((s) => s.hydrate);
  const setPanelOpen = useOneShotLabStore((s) => s.setPanelOpen);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    const dispose = setupOneShotToastHandler();
    return () => dispose();
  }, []);

  const workQueue = useLabWorkQueue(catalogId, entityId, nav.open); // Matrix queue: Next opens each stop like a cell

  // Names this entry as the lab (legacy=0) before pushing legacy=1, so Back returns here.
  const switchToLegacy = useCallback(() => switchShell('legacy'), []);

  // `data-lab-entity` publishes the RESOLVED entity (the same id LabSearch resolves step hits
  // against and Baseline renders), so "what is rendered" and "what the location says" stay
  // checkable rather than silently diverging.
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
            ariaLabel="Search catalogs, entities, pipeline steps and pages"
            title="Search (Ctrl+K)"
          >
            Search <span aria-hidden="true" style={{ color: 'var(--lab-muted)' }}>⌘K</span>
          </Button>
          <Button active={view === 'catalogs'} onClick={() => nav.view('catalogs')}>Catalogs</Button>
          <Button active={view === 'matrix'} onClick={() => nav.view('matrix')}>Matrix</Button>
          <Button active={view === 'canon'} onClick={() => nav.view('canon')}>Canon</Button>
          <Button onClick={() => setPanelOpen(true)}>+ One-shot</Button>
          {/* Full-page jumps to the app's other surfaces — derived from NAVIGABLE_SURFACES
              and drawn distinctly from the in-place view toggles above. */}
          <LabRouteLinks />
          <Button onClick={switchToLegacy}>Legacy shell</Button>
        </div>
        {/* Right zone: status + theme toggle in the corner */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--lab-s2)' }}>
          {/* ONE affordance for "what is running right now" — the UE drain lease, the
              one-shot orchestrator and the forge's background polls in one vocabulary.
              (Replaces the old RunnerChip + LabJobsChip pair, which shared nothing.) */}
          <ActivityChip t={theme} />
          <LabBridgeStrip t={theme} />
          <ThemeToggle themeId={themeId} onToggle={() => setPrefs({ themeId: themeId === 'light' ? 'dark' : 'light' })} />
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Lab-level cross-catalog coach — only over the composition (Baseline) view;
            the Matrix and Canon carry their own catalog-wide summaries. */}
        {view === 'catalogs' && <><GlobalCoach t={theme} /><WorkQueueStrip q={workQueue} /></>}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {view === 'canon' ? <CanonView t={theme} />
              : view === 'matrix' ? <CatalogMatrix t={theme} groups={groups} catalogId={catalogId} onSelectCatalog={nav.catalog} onOpenStep={nav.open} onOpenQueue={workQueue.open} />
              : <Baseline theme={theme} groups={groups} detail={detail}
                  onSelectCatalog={nav.catalog}
                  entityId={entityId}
                  onSelectEntity={nav.entity}
                  stepIdx={stepIdx}
                  onSelectStep={nav.step}
                />}
          </motion.div>
        </AnimatePresence>
      </div>
      <LabSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        currentEntityId={entityId}
        onSelectCatalog={nav.catalog}
        onNavigate={nav.open}
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
