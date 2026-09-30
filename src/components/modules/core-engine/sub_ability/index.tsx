'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { BookOpen, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { useTabParam } from '@/hooks/useTabParam';
import { useUE5SourceSync } from '@/hooks/useUE5SourceSync';
import type { SubModuleId } from '@/types/modules';
import {
  TabHeader, LoadingSpinner, SubTabNavigation, type SubTab,
} from '../unique-tabs/_shared';
import { useSpellbookEntries } from '@/stores/catalogStore';
import { buildSpellbookView } from './_shared/spellbookView';
import { useAbilitySpecTags } from './_shared/useAbilitySpecTags';

import { SpellbookDataCtx } from './_shared/context';
import { ACCENT, SUBTABS } from './_shared/constants';
import type { SpellbookLiveData, SpellbookSubtab } from './_shared/types';
import { SpellbookSearch } from './SpellbookSearch';
import { SyncStatusBadge } from './SpellbookHeader';
import { useGASFeatureMetrics } from './FeatureMetrics';
import { NarrativeBreadcrumb, getActiveSubtitle } from './NarrativeBreadcrumb';
import { SpellbookTabContent } from './SpellbookTabContent';

/* ── Component ─────────────────────────────────────────────────────────── */

const SPELLBOOK_TAB_IDS = ['features', ...SUBTABS.map((t) => t.key)] as SpellbookSubtab[];

interface AbilitySpellbookProps {
  moduleId: SubModuleId;
}

export function AbilitySpellbook({ moduleId }: AbilitySpellbookProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useTabParam<SpellbookSubtab>('abilityTab', 'core', SPELLBOOK_TAB_IDS);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const { data: liveData, isLoading: isSyncing, refresh } = useUE5SourceSync();
  // Third audit source: the tags app-authored ability specs reference.
  const appTags = useAbilitySpecTags();

  const tabs: SubTab[] = useMemo(() => [
    { id: 'features', label: 'Features', icon: LayoutGrid },
    ...SUBTABS.map(t => ({ id: t.key, label: t.label, icon: t.icon })),
  ], []);

  const contentRef = useRef<HTMLDivElement>(null);

  const toggleFeature = useCallback((name: string) => {
    setExpandedFeature((prev) => (prev === name ? null : name));
  }, []);

  /* Search navigation: the target section lives on another tab whose mount is
     gated by the AnimatePresence mode="wait" exit transition, so its element
     may not exist yet when we navigate. Instead of racing a magic timeout
     against the animation, poll each animation frame (bounded) until the
     target element actually exists, then scroll to it. */
  const pendingScrollRafRef = useRef<number | null>(null);

  const cancelPendingScroll = useCallback(() => {
    if (pendingScrollRafRef.current !== null) {
      cancelAnimationFrame(pendingScrollRafRef.current);
      pendingScrollRafRef.current = null;
    }
  }, []);

  useEffect(() => cancelPendingScroll, [cancelPendingScroll]);

  const handleSearchNavigate = useCallback((tab: string, sectionId: string) => {
    setActiveTab(tab as SpellbookSubtab);
    cancelPendingScroll();

    // Bounded retry: generous headroom over the 300ms exit + enter transitions,
    // then give up silently (e.g. section removed from the target tab).
    // NOT suspend-gated, deliberately: this loop is already deadline-bounded to
    // 2s and only ever runs as the tail of a click the user just made in the
    // VISIBLE pane — it cannot still be alive by the time the pane is hidden.
    const deadline = performance.now() + 2000;
    const tryScroll = () => {
      pendingScrollRafRef.current = null;
      // Scope to the target tab's panel so we never scroll to a same-id
      // section in the still-exiting previous tab.
      const el = contentRef.current?.querySelector(
        `[data-spellbook-tab="${tab}"] [data-section-id="${sectionId}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (performance.now() < deadline) {
        pendingScrollRafRef.current = requestAnimationFrame(tryScroll);
      }
    };
    pendingScrollRafRef.current = requestAnimationFrame(tryScroll);
  }, [setActiveTab, cancelPendingScroll]);

  /* ── One projection: catalog numbers + C++ vocabulary (see _shared/spellbookView.ts) ──
     Heavy transforms depend only on [liveData, appTags, entries]; `refresh` and the
     presentational `isSyncing` flag are merged in separately below so a sync toggle
     never re-runs the derivation or recreates the derived identity. */
  const entries = useSpellbookEntries();
  const view = useMemo(
    () => buildSpellbookView({ live: liveData, appTags, entries }),
    [liveData, appTags, entries],
  );

  const spellbookData = useMemo<SpellbookLiveData>(
    () => ({ ...view, isSyncing, refresh }),
    [view, isSyncing, refresh],
  );

  const renderMetric = useGASFeatureMetrics(spellbookData);

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  const subtitle = getActiveSubtitle(activeTab);

  return (
    <SpellbookDataCtx.Provider value={spellbookData}>
    <div className="space-y-4">
      <TabHeader icon={BookOpen} title="Ability Spellbook" implemented={stats.implemented} total={stats.total} accent={ACCENT} />

      {/* ── Narrative Breadcrumb ──────────────────────────────────────────── */}
      <NarrativeBreadcrumb activeTab={activeTab} onNavigate={setActiveTab} />

      {/* ── Sub-Tab Navigation ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={(id) => setActiveTab(id as SpellbookSubtab)} accent={ACCENT} />
        <SpellbookSearch onNavigate={handleSearchNavigate} />
        <SyncStatusBadge />
      </div>

      {/* ── Active Tab Subtitle ───────────────────────────────────────────── */}
      {subtitle && <p className="text-xs font-mono text-text-muted -mt-1 mb-1 pl-0.5">{subtitle}</p>}

      <div ref={contentRef} className="mt-4 relative min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            data-spellbook-tab={activeTab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <SpellbookTabContent
              activeTab={activeTab}
              moduleId={moduleId}
              featureMap={featureMap}
              defs={defs}
              expandedFeature={expandedFeature}
              toggleFeature={toggleFeature}
              renderMetric={renderMetric}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    </SpellbookDataCtx.Provider>
  );
}
