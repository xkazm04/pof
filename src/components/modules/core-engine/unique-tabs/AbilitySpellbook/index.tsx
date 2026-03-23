'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, Cpu, Sparkles, Flame, Tags, Swords, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODULE_COLORS, STATUS_SUCCESS } from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { useUE5SourceSync } from '@/hooks/useUE5SourceSync';
import type { SubModuleId } from '@/types/modules';
import {
  TabHeader, LoadingSpinner, SubTabNavigation, SubTab,
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

import { SpellbookDataCtx, useSpellbookData } from './context';
import { ACCENT } from './constants';
import type { SpellbookLiveData } from './types';
import { CoreSection } from './CoreSection';
import { AttributesSection } from './AttributesSection';
import { TagsSection } from './TagsSection';
import { AbilitiesSection } from './AbilitiesSection';
import { EffectsSection } from './EffectsSection';
import { TagDepsSection } from './TagDepsSection';
import { EffectsTimelineSection } from './EffectsTimelineSection';
import { DamageCalcSection } from './DamageCalcSection';
import { TagAuditSection } from './TagAuditSection';
import { LoadoutSection } from './LoadoutSection';
import { SpellbookSearch } from './SpellbookSearch';

/* ── Component ─────────────────────────────────────────────────────────── */

interface AbilitySpellbookProps {
  moduleId: SubModuleId;
}

export function AbilitySpellbook({ moduleId }: AbilitySpellbookProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState('core');
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const { data: liveData, isLoading: isSyncing, refresh } = useUE5SourceSync();

  const tabs: SubTab[] = useMemo(() => [
    { id: 'core', label: 'Core & Architecture', icon: Cpu },
    { id: 'abilities', label: 'Abilities', icon: Sparkles },
    { id: 'combos', label: 'Combos', icon: Swords },
    { id: 'effects', label: 'Effects', icon: Flame },
    { id: 'tags', label: 'Tags & Attributes', icon: Tags },
  ], []);

  const contentRef = useRef<HTMLDivElement>(null);

  const toggleFeature = useCallback((name: string) => {
    setExpandedFeature((prev) => (prev === name ? null : name));
  }, []);

  const handleSearchNavigate = useCallback((tab: string, sectionId: string) => {
    setActiveTab(tab);
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

  if (isLoading) {
    return <LoadingSpinner accent={ACCENT} />;
  }

  return (
    <SpellbookDataCtx.Provider value={spellbookData}>
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <TabHeader icon={BookOpen} title="Ability Spellbook" implemented={stats.implemented} total={stats.total} accent={ACCENT} />
        <div className="flex items-center gap-3">
          <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={setActiveTab} accent={ACCENT} />
          <SpellbookSearch onNavigate={handleSearchNavigate} />
          <SyncStatusBadge />
        </div>
      </div>

      <div ref={contentRef} className="mt-4 relative min-h-[300px]">
        <AnimatePresence mode="sync">
          {activeTab === 'core' && (
            <motion.div key="core" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div data-section-id="core"><CoreSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
                <div data-section-id="loadout"><LoadoutSection /></div>
              </div>
            </motion.div>
          )}
          {activeTab === 'abilities' && (
            <motion.div key="abilities" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div data-section-id="abilities"><AbilitiesSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
                <div data-section-id="damage-calc"><DamageCalcSection /></div>
              </div>
            </motion.div>
          )}
          {activeTab === 'combos' && (
            <motion.div key="combos" data-section-id="combos" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <ComboChainBuilder />
            </motion.div>
          )}
          {activeTab === 'effects' && (
            <motion.div key="effects" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div data-section-id="effects"><EffectsSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
                <div data-section-id="effects-timeline"><EffectsTimelineSection /></div>
              </div>
            </motion.div>
          )}
          {activeTab === 'tags' && (
            <motion.div key="tags" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div data-section-id="attributes"><AttributesSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div data-section-id="tags"><TagsSection featureMap={featureMap} defs={defs} expanded={expandedFeature} onToggle={toggleFeature} /></div>
                <div className="space-y-4">
                  <div data-section-id="tag-deps"><TagDepsSection /></div>
                  <div data-section-id="tag-audit"><TagAuditSection /></div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </SpellbookDataCtx.Provider>
  );
}

/* ── Sync Status Badge ─────────────────────────────────────────────────── */

function SyncStatusBadge() {
  const { isLive, isSyncing, parsedAt, refresh } = useSpellbookData();

  if (isSyncing) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-text-muted px-2 py-1 rounded-full bg-surface-deep/50 border border-border/30 whitespace-nowrap">
        <RefreshCw className="w-3 h-3 animate-spin" /> Syncing UE5 source...
      </span>
    );
  }

  if (isLive) {
    return (
      <button
        onClick={refresh}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border whitespace-nowrap transition-colors hover:bg-surface-deep/80"
        style={{ color: STATUS_SUCCESS, borderColor: `${STATUS_SUCCESS}40`, backgroundColor: `${STATUS_SUCCESS}08` }}
        title={`Synced from C++ source at ${parsedAt ? new Date(parsedAt).toLocaleTimeString() : 'unknown'}`}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_SUCCESS, boxShadow: `0 0 6px ${STATUS_SUCCESS}` }} />
        Live from UE5
        <RefreshCw className="w-3 h-3 opacity-50" />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-text-muted px-2 py-1 rounded-full bg-surface-deep/50 border border-border/30 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-text-muted/50" />
      Static data
    </span>
  );
}
