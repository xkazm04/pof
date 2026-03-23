'use client';

import { useState, useCallback } from 'react';
import { Coins } from 'lucide-react';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import { TabHeader, PipelineFlow, FeatureCard, LoadingSpinner } from '../_shared';
import { BlueprintPanel } from './design';
import { ACCENT, LOOT_FEATURES } from './data';
import type { SubModuleId } from '@/types/modules';

import { WeightDistribution } from './WeightDistribution';
import { DropSimulator } from './DropSimulator';
import { WorldItemPreview } from './WorldItemPreview';
import { DropTreemap } from './DropTreemap';
import { MonteCarloSim } from './MonteCarloSim';
import { LootDiffSection } from './LootDiffSection';
import { DropsPerHour } from './DropsPerHour';
import { AffixRollSimulator } from './AffixRollSimulator';
import { LootTableEditor } from './LootTableEditor';
import { PityTimerSection } from './PityTimerSection';
import { DroughtCalculator } from './DroughtCalculator';
import { BeaconVisualizer } from './BeaconVisualizer';
import { EconomyImpact } from './EconomyImpact';
import { SmartLoot } from './SmartLoot';
import { EnemyLootBindingSection } from './EnemyLootBinding';
import { EVCalculator } from './EVCalculator';

/* ── Pipeline steps ──────────────────────────────────────────────────────── */

const PIPELINE_STEPS = [
  'LootTable', 'WeightedRandom', 'WorldItem', 'Pickup', 'Inventory',
];

/* ── Component ───────────────────────────────────────────────────────────── */

interface LootTableVisualizerProps {
  moduleId: SubModuleId;
}

export function LootTableVisualizer({ moduleId }: LootTableVisualizerProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [expanded, setExpanded] = useState<string | null>(null);

  /* Shared pity threshold: used by PityTimerSection and DroughtCalculator */
  const [pityThreshold, setPityThreshold] = useState(20);

  const toggleExpand = useCallback(
    (name: string) => setExpanded((prev) => (prev === name ? null : name)),
    [],
  );

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  return (
    <div className="space-y-3">
      {/* Header + pipeline */}
      <TabHeader
        icon={Coins}
        title="Loot Table Visualizer"
        implemented={stats.implemented}
        total={stats.total}
        accent={ACCENT}
      />

      <BlueprintPanel className="p-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
          Pipeline
        </div>
        <PipelineFlow steps={PIPELINE_STEPS} accent={ACCENT} />
      </BlueprintPanel>

      {/* Core visualizations */}
      <WeightDistribution />
      <DropSimulator />
      <WorldItemPreview />

      {/* Probability & simulation */}
      <DropTreemap />
      <MonteCarloSim />
      <LootDiffSection />
      <DropsPerHour />

      {/* Affix & editor */}
      <AffixRollSimulator />
      <LootTableEditor />

      {/* Pity & drought -- share pityThreshold */}
      <PityTimerSection
        pityThreshold={pityThreshold}
        setPityThreshold={setPityThreshold}
      />
      <DroughtCalculator pityThreshold={pityThreshold} />

      {/* Beacon & economy */}
      <BeaconVisualizer />
      <EconomyImpact />
      <SmartLoot />

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
    </div>
  );
}
