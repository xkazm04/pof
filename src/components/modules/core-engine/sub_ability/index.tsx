'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { useTabParam } from '@/hooks/useTabParam';
import { useUE5SourceSync } from '@/hooks/useUE5SourceSync';
import type { SubModuleId } from '@/types/modules';
import {
  TabHeader, LoadingSpinner, SubTabNavigation, type SubTab,
} from '../unique-tabs/_shared';
import {
  CORE_ATTRIBUTES as STATIC_CORE_ATTRIBUTES,
  DERIVED_ATTRIBUTES as STATIC_DERIVED_ATTRIBUTES,
  TAG_TREE as STATIC_TAG_TREE,
  ABILITY_RADAR_DATA as STATIC_ABILITY_RADAR_DATA,
  TAG_DEP_NODES as STATIC_TAG_DEP_NODES,
  TAG_DEP_EDGES as STATIC_TAG_DEP_EDGES,
  COOLDOWN_ABILITIES as STATIC_COOLDOWN_ABILITIES,
  TAG_AUDIT_CATEGORIES as STATIC_TAG_AUDIT_CATEGORIES,
  TAG_USAGE_FREQUENCY as STATIC_TAG_USAGE_FREQUENCY,
  TAG_AUDIT_SCORE as STATIC_TAG_AUDIT_SCORE,
  TAG_DETAIL_MAP as STATIC_TAG_DETAIL_MAP,
  buildLiveTagTree, buildLiveCooldownAbilities, buildLiveAbilityRadar,
  buildLiveTagDeps, buildLiveTagDetailMap, buildLiveTagUsageFrequency,
  buildLiveAttributes,
} from './_shared/data';

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

  const tabs: SubTab[] = useMemo(() => [
    { id: 'features', label: 'Features', icon: LayoutGrid },
    ...SUBTABS.map(t => ({ id: t.key, label: t.label, icon: t.icon })),
  ], []);

  const contentRef = useRef<HTMLDivElement>(null);

  const toggleFeature = useCallback((name: string) => {
    setExpandedFeature((prev) => (prev === name ? null : name));
  }, []);

  const handleSearchNavigate = useCallback((tab: string, sectionId: string) => {
    setActiveTab(tab as SpellbookSubtab);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = contentRef.current?.querySelector(`[data-section-id="${sectionId}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    });
  }, [setActiveTab]);

  /* ── Compute live-synced data (falls back to static when unavailable) ── */
  const spellbookData = useMemo<SpellbookLiveData>(() => {
    if (!liveData || liveData.tags.length === 0) {
      return {
        isLive: false, isSyncing, parsedAt: null, refresh,
        CORE_ATTRIBUTES: STATIC_CORE_ATTRIBUTES,
        DERIVED_ATTRIBUTES: STATIC_DERIVED_ATTRIBUTES,
        TAG_TREE: STATIC_TAG_TREE,
        ABILITY_RADAR_DATA: STATIC_ABILITY_RADAR_DATA,
        TAG_DEP_NODES: STATIC_TAG_DEP_NODES,
        TAG_DEP_EDGES: STATIC_TAG_DEP_EDGES,
        COOLDOWN_ABILITIES: STATIC_COOLDOWN_ABILITIES,
        TAG_AUDIT_CATEGORIES: STATIC_TAG_AUDIT_CATEGORIES,
        TAG_USAGE_FREQUENCY: STATIC_TAG_USAGE_FREQUENCY,
        TAG_AUDIT_SCORE: STATIC_TAG_AUDIT_SCORE,
        TAG_DETAIL_MAP: STATIC_TAG_DETAIL_MAP,
      };
    }

    const attrs = buildLiveAttributes(liveData.tags);
    const tagDeps = buildLiveTagDeps(liveData.abilities, liveData.tags);
    const usageFreq = buildLiveTagUsageFrequency(liveData.abilities, liveData.tags);

    return {
      isLive: true, isSyncing, parsedAt: liveData.parsedAt, refresh,
      CORE_ATTRIBUTES: attrs.core,
      DERIVED_ATTRIBUTES: attrs.derived,
      TAG_TREE: buildLiveTagTree(liveData.tags),
      ABILITY_RADAR_DATA: buildLiveAbilityRadar(liveData.abilities),
      TAG_DEP_NODES: tagDeps.nodes,
      TAG_DEP_EDGES: tagDeps.edges,
      COOLDOWN_ABILITIES: buildLiveCooldownAbilities(liveData.abilities),
      TAG_AUDIT_CATEGORIES: STATIC_TAG_AUDIT_CATEGORIES,
      TAG_USAGE_FREQUENCY: usageFreq,
      TAG_AUDIT_SCORE: STATIC_TAG_AUDIT_SCORE,
      TAG_DETAIL_MAP: buildLiveTagDetailMap(liveData.abilities, liveData.tags),
    };
  }, [liveData, isSyncing, refresh]);

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
