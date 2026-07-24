'use client';

/**
 * /status shell — the Blueprint-themed page chrome hosting two tabs:
 *   • Pipelines  — the pipeline-centric health map (swimlanes across every catalog).
 *   • Item Focus — the entity-centric view (one entity's realization + its 1-hop
 *                  cross-pipeline dependency map).
 *
 * View state lives in the URL so it is deep-linkable and back/forward works:
 *   /status                                  → Pipelines
 *   /status?entity=<catalogId>:<entityId>    → Item Focus on that entity
 *   /status?tab=item                         → Item Focus (empty, prompts search)
 * The URL is read via useSyncExternalStore (SSR snapshot '' → no hydration mismatch)
 * and written with history.pushState + a 'status-nav' event to re-read.
 */
import { useSyncExternalStore } from 'react';
import { labFontVars } from '@/components/layout-lab/fonts';
import { StatusTabs, statusTabId, statusPanelId, type StatusTab } from './StatusTabs';
import { CapabilityView } from './CapabilityView';
import { PipelinesView } from './PipelinesView';
import { CategoryView } from './CategoryView';
import { ItemFocusView } from './ItemFocusView';
import { ModelsView } from './ModelsView';

const NAV_EVENT = 'status-nav';

function subscribe(cb: () => void): () => void {
  window.addEventListener('popstate', cb);
  window.addEventListener(NAV_EVENT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(NAV_EVENT, cb);
  };
}

function navigate(search: string) {
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
  window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(NAV_EVENT));
}

interface ViewState {
  tab: StatusTab;
  focus: { catalogId: string; entityId: string } | null;
  /** Selected catalog for the Category tab (null = show the catalog picker). */
  catalog: string | null;
  /** Active capability-class filter on the Pipelines tab (null = unfiltered). */
  filterClass: string | null;
}

function parse(search: string): ViewState {
  const p = new URLSearchParams(search);
  const entityRaw = p.get('entity');
  let focus: ViewState['focus'] = null;
  if (entityRaw) {
    const i = entityRaw.indexOf(':');
    if (i > 0) focus = { catalogId: entityRaw.slice(0, i), entityId: entityRaw.slice(i + 1) };
  }
  const catalogParam = p.get('catalog');
  const tabParam = p.get('tab');
  const classParam = p.get('class');
  let tab: StatusTab;
  if (focus || tabParam === 'item') tab = 'item';
  else if (catalogParam || tabParam === 'category') tab = 'category';
  else if (tabParam === 'models') tab = 'models';
  else if (tabParam === 'pipelines' || classParam) tab = 'pipelines';
  else tab = 'capability';
  return { tab, focus, catalog: catalogParam || null, filterClass: classParam || null };
}

/** The one-paragraph orientation line above a tab's view. Single source for the intro's
 *  measure/colour/spacing so every tab's lede sits on the same rhythm (CapabilityView and
 *  ModelsView render their own lede in this same shape). */
function TabIntro({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', maxWidth: 880, marginBottom: 'var(--lab-s3)' }}>
      {children}
    </p>
  );
}

export function StatusDashboard() {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => '');
  const { tab, focus, catalog, filterClass } = parse(search);

  const setTab = (t: StatusTab) => {
    if (t === 'item') navigate(focus ? `entity=${focus.catalogId}:${focus.entityId}` : 'tab=item');
    else if (t === 'category') navigate(focus ? `catalog=${focus.catalogId}` : catalog ? `catalog=${catalog}` : 'tab=category');
    else if (t === 'models') navigate('tab=models');
    else if (t === 'pipelines') navigate('tab=pipelines');
    else navigate('');
  };

  /** Capability row → Pipelines map filtered to that class. */
  const filterByClass = (klass: string) => navigate(`tab=pipelines&class=${encodeURIComponent(klass)}`);
  const clearFilter = () => navigate('tab=pipelines');

  const focusEntity = (catalogId: string, entityId: string) =>
    navigate(`entity=${encodeURIComponent(catalogId)}:${encodeURIComponent(entityId)}`);

  /** Open the Category overview for a catalog (empty string → the catalog picker). */
  const focusCatalog = (catalogId: string) =>
    navigate(catalogId ? `catalog=${encodeURIComponent(catalogId)}` : 'tab=category');

  return (
    // `labFontVars` defines --font-inter/--font-ibm-plex, which --lab-font-body/-mono resolve
    // to; without it every lab font-family here is invalid-at-computed-value-time and silently
    // falls back to the app shell's face. `data-lab-root` points --focus-accent at --lab-accent
    // so .focus-ring rings read against the light Blueprint floor (the generic #60a5fa fallback
    // is ~2:1 on --lab-bg, under the 3:1 WCAG 1.4.11 floor for focus indicators).
    <main
      data-theme="blueprint"
      data-lab-root=""
      className={labFontVars}
      style={{
        minHeight: '100vh',
        background: 'var(--lab-bg)',
        backgroundImage: 'var(--lab-grid-image)',
        backgroundSize: 'var(--lab-grid-size)',
        color: 'var(--lab-text)',
        fontFamily: 'var(--lab-font-body)',
        padding: 'var(--lab-s6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 'var(--lab-s2)', gap: 'var(--lab-s4)', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xl)', color: 'var(--lab-ink-deep)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Pipeline Status
        </h1>
        <StatusTabs tab={tab} onChange={setTab} />
        {/* Pushed right by auto margin rather than space-between, so when the header wraps the
            title and the tablist stay adjacent instead of being flung to opposite edges. */}
        <a
          href="/layout"
          className="focus-ring"
          aria-label="Back to the Blueprint layout lab"
          style={{ marginLeft: 'auto', fontSize: 'var(--lab-fs-xs)', fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-ink)', textDecoration: 'underline', textUnderlineOffset: 3, whiteSpace: 'nowrap' }}
        >
          ← Blueprint lab
        </a>
      </div>

      {/* One panel per tab view, named by its tab (WAI-ARIA tabs pattern). */}
      <div role="tabpanel" id={statusPanelId(tab)} aria-labelledby={statusTabId(tab)}>
        {tab === 'capability' && (
          <CapabilityView onFilterClass={filterByClass} />
        )}

        {tab === 'pipelines' && (
          <>
            <TabIntro>
              One row per pipeline, one cell per step — the cell names its engine, the background is the honest grade
              (green = gate/judge-proven), the left stripe is the acceptance tier. Click a tier or engine chip to highlight,
              or a pipeline to open its category overview.
            </TabIntro>
            <PipelinesView onFocusCatalog={focusCatalog} filterClass={filterClass} onClearFilter={clearFilter} />
          </>
        )}

        {tab === 'category' && (
          <>
            <TabIntro>
              Every entity in one catalog, ranked <strong>weakest first</strong> (least gate-verified coverage on top, ties
              broken by name). The overview for spotting where to focus — click a row to inspect that entity.
            </TabIntro>
            <CategoryView key={catalog ?? '__picker__'} catalogId={catalog} onFocusEntity={focusEntity} onPickCatalog={focusCatalog} />
          </>
        )}

        {tab === 'item' && (
          <>
            <TabIntro>
              One entity at a time — its origin pipeline coloured by <strong>realization</strong> (hollow = this entity never
              produced that step), plus the pipelines it connects to. Click any connected node to walk the graph.
            </TabIntro>
            <ItemFocusView focus={focus} onFocus={focusEntity} />
          </>
        )}

        {tab === 'models' && <ModelsView />}
      </div>
    </main>
  );
}
