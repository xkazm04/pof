'use client';

import { useState, useMemo, useCallback } from 'react';
import { Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Rarity, AffixPoolEntry, DropSimConfig, DropSimResult, ItemDesign } from '@/lib/loot-designer/drop-simulator';
import { runDropSimulation, generateUE5Code } from '@/lib/loot-designer/drop-simulator';
import { TabHeader, SubTabNavigation } from '../_shared';
import { ACCENT, ITEM_PRESETS, BASE_AFFIX_POOL, SUB_TABS } from './constants';
import { DesignerPanel } from './DesignerPanel';
import { DistributionsPanel } from './DistributionsPanel';
import { CoOccurrencePanel } from './CoOccurrencePanel';
import { CodePanel } from './CodePanel';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AILootDesigner({ moduleId }: { moduleId: string }) {
  const [activeTab, setActiveTab] = useState('designer');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({});
  const [rarity, setRarity] = useState<Rarity>('Legendary');
  const [itemLevel, setItemLevel] = useState(20);
  const [rollCount, setRollCount] = useState(2000);
  const [seed, setSeed] = useState(42);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const concept = ITEM_PRESETS[selectedPreset];

  const affixPool = useMemo((): AffixPoolEntry[] => {
    const overrides = { ...concept.weightOverrides, ...customWeights };
    return BASE_AFFIX_POOL.map((a) => ({
      ...a,
      designerWeight: overrides[a.id] ?? a.baseWeight,
    }));
  }, [concept.weightOverrides, customWeights]);

  const simResult = useMemo((): DropSimResult => {
    const config: DropSimConfig = {
      affixPool,
      rarity,
      itemLevel,
      rollCount,
      seed,
    };
    return runDropSimulation(config);
  }, [affixPool, rarity, itemLevel, rollCount, seed]);

  const updateWeight = useCallback((affixId: string, value: number) => {
    setCustomWeights((prev) => ({ ...prev, [affixId]: value }));
  }, []);

  const resetWeights = useCallback(() => { setCustomWeights({}); }, []);
  const reseed = useCallback(() => { setSeed(Math.floor(Math.random() * 100000)); }, []);

  const ue5Code = useMemo(() => {
    const design: ItemDesign = {
      name: concept.name,
      displayName: concept.displayName,
      type: concept.type,
      rarity,
      description: concept.description,
      affixPool,
    };
    return generateUE5Code(design);
  }, [concept, rarity, affixPool]);

  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <TabHeader
        icon={Wand2}
        title="AI Loot Designer"
        implemented={4}
        total={4}
        accent={ACCENT}
      />

      <SubTabNavigation
        tabs={SUB_TABS}
        activeTabId={activeTab}
        onChange={setActiveTab}
        accent={ACCENT}
      />

      {activeTab === 'designer' && (
        <DesignerPanel
          concept={concept}
          presets={ITEM_PRESETS}
          selectedPreset={selectedPreset}
          onSelectPreset={setSelectedPreset}
          affixPool={affixPool}
          customWeights={customWeights}
          onUpdateWeight={updateWeight}
          onResetWeights={resetWeights}
          rarity={rarity}
          onRarityChange={setRarity}
          itemLevel={itemLevel}
          onItemLevelChange={setItemLevel}
          rollCount={rollCount}
          onRollCountChange={setRollCount}
          seed={seed}
          onReseed={reseed}
          simResult={simResult}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        />
      )}

      {activeTab === 'distributions' && (
        <DistributionsPanel simResult={simResult} affixPool={affixPool} />
      )}

      {activeTab === 'heatmap' && (
        <CoOccurrencePanel simResult={simResult} affixPool={affixPool} />
      )}

      {activeTab === 'code' && (
        <CodePanel code={ue5Code} concept={concept} />
      )}
    </motion.div>
  );
}
