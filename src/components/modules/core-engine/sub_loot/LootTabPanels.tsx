'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FeatureCard, PipelineFlow } from '../unique-tabs/_shared';
import { BlueprintPanel } from './_shared/design';
import { ACCENT, LOOT_FEATURES, type LootSubtab } from './_shared/data';
import type { SubModuleId } from '@/types/modules';
import FeatureMapTab from '../unique-tabs/FeatureMapTab';
import { renderLootMetric } from './metrics';
import { VisibleSection } from '../unique-tabs/VisibleSection';

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

const PIPELINE_STEPS = [
  'LootTable', 'WeightedRandom', 'WorldItem', 'Pickup', 'Inventory',
];

interface LootTabPanelsProps {
  activeTab: LootSubtab;
  moduleId: SubModuleId;
  featureMap: ReturnType<typeof import('@/hooks/useTabFeatures').useTabFeatures>['featureMap'];
  defs: ReturnType<typeof import('@/hooks/useTabFeatures').useTabFeatures>['defs'];
  expanded: string | null;
  toggleExpand: (name: string) => void;
  pityThreshold: number;
  setPityThreshold: (n: number) => void;
}

export function LootTabPanels({
  activeTab, moduleId, featureMap, defs, expanded, toggleExpand,
  pityThreshold, setPityThreshold,
}: LootTabPanelsProps) {
  return (
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
  );
}
