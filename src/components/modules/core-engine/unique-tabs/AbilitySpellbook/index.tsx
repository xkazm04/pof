'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { useUE5SourceSync } from '@/hooks/useUE5SourceSync';
import { withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import type { SubModuleId } from '@/types/modules';
import {
  TabHeader, LoadingSpinner, SubTabNavigation, type SubTab,
} from '../_shared';
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
} from './data';
import { ComboChainBuilder } from '../ComboChainBuilder';

import { SpellbookDataCtx } from './context';
import { ACCENT, SUBTABS } from './constants';
import type { SpellbookLiveData, SpellbookSubtab } from './types';
import { CoreSection } from './core/CoreSection';
import { AttributesSection } from './tags/AttributesSection';
import { TagsSection } from './tags/TagsSection';
import { AbilitiesSection } from './abilities/AbilitiesSection';
import { EffectsSection } from './effects/EffectsSection';
import { TagDepsSection } from './tags/TagDepsSection';
import { EffectsTimelineSection } from './effects/EffectsTimelineSection';
import { DamageCalcSection } from './abilities/DamageCalcSection';
import { TagAuditSection } from './tags/TagAuditSection';
import { LoadoutSection } from './abilities/LoadoutSection';
import { SpellbookSearch } from './SpellbookSearch';
import { SyncStatusBadge } from './SpellbookHeader';
import FeatureMapTab from '../FeatureMapTab';
import { VisibleSection } from '../VisibleSection';
import { useGASFeatureMetrics } from './FeatureMetrics';

/* ── Narrative Breadcrumb ─────────────────────────────────────────────── */

const FEATURES_STEP = { key: 'features' as SpellbookSubtab, narrative: 'Catalog' };
const NARRATIVE_STEPS = [FEATURES_STEP, ...SUBTABS.map(t => ({ key: t.key, narrative: t.narrative }))];

function NarrativeBreadcrumb({ activeTab, onNavigate }: { activeTab: SpellbookSubtab; onNavigate: (tab: SpellbookSubtab) => void }) {
  const activeIdx = NARRATIVE_STEPS.findIndex(s => s.key === activeTab);
  return (
    <div className="flex items-center gap-0.5 text-[10px] font-mono tracking-wide overflow-x-auto custom-scrollbar pb-0.5">
      {NARRATIVE_STEPS.map((step, i) => {
        const isPast = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center gap-0.5 flex-shrink-0">
            {i > 0 && <span className="text-text-muted/40 mx-0.5">{'>'}</span>}
            <button
              onClick={() => onNavigate(step.key)}
              className="px-1.5 py-0.5 rounded transition-all cursor-pointer"
              style={{
                color: isActive ? ACCENT : isPast ? withOpacity(ACCENT, '99') : 'var(--text-muted)',
                backgroundColor: isActive ? withOpacity(ACCENT, OPACITY_10) : 'transparent',
                fontWeight: isActive ? 700 : isPast ? 600 : 400,
                opacity: !isActive && !isPast ? 0.5 : 1,
              }}
            >
              {step.narrative}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ── Active tab subtitle ──────────────────────────────────────────────── */

function getActiveSubtitle(tab: SpellbookSubtab): string | null {
  if (tab === 'features') return 'Feature implementation status & metrics';
  const def = SUBTABS.find(t => t.key === tab);
  return def?.subtitle ?? null;
}

/* ── Component ─────────────────────────────────────────────────────────── */

interface AbilitySpellbookProps {
  moduleId: SubModuleId;
}

export function AbilitySpellbook({ moduleId }: AbilitySpellbookProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState<SpellbookSubtab>('core');
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
  }, []);

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
      {subtitle && <p className="text-xs font-mono text-text-muted/70 -mt-1 mb-1 pl-0.5">{subtitle}</p>}

      <div ref={contentRef} className="mt-4 relative min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
          {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} renderMetric={renderMetric} />}
          {activeTab === 'core' && (
            <VisibleSection moduleId={moduleId} sectionId="architecture">
            <div className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div data-section-id="core"><CoreSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
                <div data-section-id="loadout"><LoadoutSection /></div>
              </div>
            </div>
            </VisibleSection>
          )}
          {activeTab === 'abilities' && (
            <VisibleSection moduleId={moduleId} sectionId="radar">
            <div className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div data-section-id="abilities"><AbilitiesSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
                <div data-section-id="damage-calc"><DamageCalcSection /></div>
              </div>
            </div>
            </VisibleSection>
          )}
          {activeTab === 'effects' && (
            <VisibleSection moduleId={moduleId} sectionId="effects-timeline">
            <div className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div data-section-id="effects"><EffectsSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
                <div data-section-id="effects-timeline"><EffectsTimelineSection /></div>
              </div>
            </div>
            </VisibleSection>
          )}
          {activeTab === 'tags' && (
            <VisibleSection moduleId={moduleId} sectionId="hierarchy">
            <div className="space-y-4">
              <div data-section-id="attributes"><AttributesSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div data-section-id="tags"><TagsSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
                <div className="space-y-4">
                  <div data-section-id="tag-deps"><TagDepsSection /></div>
                  <div data-section-id="tag-audit"><TagAuditSection /></div>
                </div>
              </div>
            </div>
            </VisibleSection>
          )}
          {activeTab === 'combos' && (
            <VisibleSection moduleId={moduleId} sectionId="timeline">
            <div data-section-id="combos">
              <ComboChainBuilder />
            </div>
            </VisibleSection>
          )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    </SpellbookDataCtx.Provider>
  );
}

