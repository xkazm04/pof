'use client';

import { useState, useCallback, useMemo } from 'react';
import { Coins, LayoutGrid } from 'lucide-react';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, LoadingSpinner, SubTabNavigation, type SubTab } from '../unique-tabs/_shared';
import { ACCENT, RARITY_TIERS, LOOT_SUBTABS, type LootSubtab } from './_shared/data';
import { DUMMY_ITEMS } from '../sub_inventory/_shared/data';
import { ARCHETYPES } from '../sub_bestiary/_shared/data';
import { LootFilters } from './LootFilters';
import { NarrativeBreadcrumb } from './NarrativeBreadcrumb';
import { LootTabPanels } from './LootTabPanels';
import type { SubModuleId } from '@/types/modules';

/* ── Cross-reference lookup maps (used by sub-components) ───────────────── */
export const itemMap = new Map(DUMMY_ITEMS.map(i => [i.name, i]));
export const enemyMap = new Map(ARCHETYPES.map(a => [a.id, a]));

type RarityFilter = 'All' | (typeof RARITY_TIERS)[number]['name'];

/* ── Active tab subtitle ─────────────────────────────────────────────────── */

function getActiveSubtitle(tab: LootSubtab): string | null {
  if (tab === 'features') return 'Feature implementation status & metrics';
  const def = LOOT_SUBTABS.find(t => t.key === tab);
  return def?.subtitle ?? null;
}

/* ── Component ───────────────────────────────────────────────────────────── */

interface LootTableVisualizerProps {
  moduleId: SubModuleId;
}

export function LootTableVisualizer({ moduleId }: LootTableVisualizerProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('All');
  const [enemyFilter, setEnemyFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<LootSubtab>('core');

  const tabs: SubTab[] = useMemo(() => [
    { id: 'features', label: 'Features', icon: LayoutGrid },
    ...LOOT_SUBTABS.map(t => ({ id: t.key, label: t.label, icon: t.icon })),
  ], []);

  /* Shared pity threshold: used by PityTimerSection and DroughtCalculator */
  const [pityThreshold, setPityThreshold] = useState(20);

  const activeRarityColor = useMemo(() => {
    if (rarityFilter === 'All') return ACCENT;
    return RARITY_TIERS.find(t => t.name === rarityFilter)?.color ?? ACCENT;
  }, [rarityFilter]);

  const toggleExpand = useCallback(
    (name: string) => setExpanded((prev) => (prev === name ? null : name)),
    [],
  );

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  const subtitle = getActiveSubtitle(activeTab);

  return (
    <div className="space-y-3">
      {/* Header */}
      <TabHeader
        icon={Coins}
        title="Loot Table Visualizer"
        implemented={stats.implemented}
        total={stats.total}
        accent={ACCENT}
      />

      {/* ── Narrative Breadcrumb ──────────────────────────────────────────── */}
      <NarrativeBreadcrumb activeTab={activeTab} onNavigate={setActiveTab} />

      {/* ── Sub-Tab Navigation ────────────────────────────────────────────── */}
      <SubTabNavigation tabs={tabs} activeTabId={activeTab} onChange={(id) => setActiveTab(id as LootSubtab)} accent={ACCENT} />

      {/* ── Active Tab Subtitle ───────────────────────────────────────────── */}
      {subtitle && <p className="text-xs font-mono text-text-muted/70 -mt-1 mb-1 pl-0.5">{subtitle}</p>}

      {/* Rarity + Enemy filters */}
      <LootFilters
        rarityFilter={rarityFilter}
        setRarityFilter={setRarityFilter}
        enemyFilter={enemyFilter}
        setEnemyFilter={setEnemyFilter}
        activeRarityColor={activeRarityColor}
      />

      {/* ── Tab Content with Animated Transitions ─────────────────────────── */}
      <LootTabPanels
        activeTab={activeTab}
        moduleId={moduleId}
        featureMap={featureMap}
        defs={defs}
        expanded={expanded}
        toggleExpand={toggleExpand}
        pityThreshold={pityThreshold}
        setPityThreshold={setPityThreshold}
      />
    </div>
  );
}
