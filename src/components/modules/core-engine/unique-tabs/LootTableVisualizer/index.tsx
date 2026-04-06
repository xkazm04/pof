'use client';

import { useState, useCallback, useMemo } from 'react';
import { Coins, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, PipelineFlow, FeatureCard, LoadingSpinner, SubTabNavigation, type SubTab } from '../_shared';
import { BlueprintPanel } from './design';
import { ACCENT, LOOT_FEATURES, RARITY_TIERS, LOOT_SUBTABS, type LootSubtab } from './data';
import { DUMMY_ITEMS } from '../ItemCatalog/data';
import { ARCHETYPES } from '../EnemyBestiary/data';
import { LootFilters } from './LootFilters';
import type { SubModuleId } from '@/types/modules';
import FeatureMapTab from '../FeatureMapTab';
import { renderLootMetric } from './metrics';
import { VisibleSection } from '../VisibleSection';

/* ── Cross-reference lookup maps (used by sub-components) ───────────────── */
export const itemMap = new Map(DUMMY_ITEMS.map(i => [i.name, i]));
export const enemyMap = new Map(ARCHETYPES.map(a => [a.id, a]));

type RarityFilter = 'All' | (typeof RARITY_TIERS)[number]['name'];

import { WeightDistribution } from './core/WeightDistribution';
import { DropSimulator } from './simulation/DropSimulator';
import { WorldItemPreview } from './core/WorldItemPreview';
import { DropTreemap } from './simulation/DropTreemap';
import { MonteCarloSim } from './simulation/MonteCarloSim';
import { LootDiffSection } from './simulation/LootDiffSection';
import { DropsPerHour } from './simulation/DropsPerHour';
import { AffixRollSimulator } from './affix/AffixRollSimulator';
import { LootTableEditor } from './affix/LootTableEditor';
import { PityTimerSection } from './pity/PityTimerSection';
import { DroughtCalculator } from './pity/DroughtCalculator';
import { BeaconVisualizer } from './economy/BeaconVisualizer';
import { EconomyImpact } from './economy/EconomyImpact';
import { SmartLoot } from './economy/SmartLoot';
import { EnemyLootBindingSection } from './core/EnemyLootBinding';
import { EVCalculator } from './core/EVCalculator';

/* ── Pipeline steps ──────────────────────────────────────────────────────── */

const PIPELINE_STEPS = [
  'LootTable', 'WeightedRandom', 'WorldItem', 'Pickup', 'Inventory',
];

/* ── Narrative Breadcrumb ────────────────────────────────────────────────── */

const FEATURES_STEP = { key: 'features' as LootSubtab, narrative: 'Catalog' };
const NARRATIVE_STEPS = [FEATURES_STEP, ...LOOT_SUBTABS.map(t => ({ key: t.key, narrative: t.narrative }))];

function NarrativeBreadcrumb({ activeTab, onNavigate }: { activeTab: LootSubtab; onNavigate: (tab: LootSubtab) => void }) {
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
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'features' && <FeatureMapTab moduleId={moduleId} renderMetric={renderLootMetric} />}

          {activeTab === 'core' && (
            <VisibleSection moduleId={moduleId} sectionId="pipeline">
              <BlueprintPanel className="p-3">
                <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
                  Pipeline
                </div>
                <PipelineFlow steps={PIPELINE_STEPS} accent={ACCENT} />
              </BlueprintPanel>

              <WeightDistribution />
              <WorldItemPreview />

              {/* Enemy binding & EV */}
              <EnemyLootBindingSection />
              <EVCalculator />

              {/* Feature status list */}
              <div className="space-y-1.5">
                {LOOT_FEATURES.map((name) => (
                  <FeatureCard
                    key={name}
                    name={name}
                    featureMap={featureMap}
                    defs={defs}
                    expanded={expanded}
                    onToggle={toggleExpand}
                    accent={ACCENT}
                  />
                ))}
              </div>
            </VisibleSection>
          )}

          {activeTab === 'simulation' && (
            <VisibleSection moduleId={moduleId} sectionId="treemap">
              <DropTreemap />
              <MonteCarloSim />
              <DropSimulator />
              <LootDiffSection />
              <DropsPerHour />
            </VisibleSection>
          )}

          {activeTab === 'affix' && (
            <VisibleSection moduleId={moduleId} sectionId="simulator">
              <AffixRollSimulator />
              <LootTableEditor />
            </VisibleSection>
          )}

          {activeTab === 'pity' && (
            <VisibleSection moduleId={moduleId} sectionId="timer">
              <PityTimerSection
                pityThreshold={pityThreshold}
                setPityThreshold={setPityThreshold}
              />
              <DroughtCalculator pityThreshold={pityThreshold} />
            </VisibleSection>
          )}

          {activeTab === 'economy' && (
            <VisibleSection moduleId={moduleId} sectionId="beacon">
              <BeaconVisualizer />
              <EconomyImpact />
              <SmartLoot />
            </VisibleSection>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
