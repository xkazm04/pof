'use client';

import { useState } from 'react';
import { User, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabFeatures } from '@/hooks/useTabFeatures';
import {
  TabHeader, LoadingSpinner, SubTabNavigation, NarrativeBreadcrumb,
  type SubTab, type NarrativeBreadcrumbStep,
} from '../unique-tabs/_shared';
import type { SubModuleId } from '@/types/modules';
import { ACCENT, SUBTABS, type BlueprintSubtab } from './_shared/data';
import { FeaturesTab } from './features/FeaturesTab';
import { OverviewTab } from './overview/OverviewTab';
import { InputTab } from './input/InputTab';
import { MovementTab } from './movement/MovementTab';
import { SimulatorTab } from './simulator/SimulatorTab';
import { CharacterFeelPlayground } from './playground/PlaygroundTab';
import { CharacterFeelOptimizer } from './ai-feel/AIFeelTab';

/* ── Narrative Breadcrumb steps ───────────────────────────────────────────── */

const NARRATIVE_STEPS: ReadonlyArray<NarrativeBreadcrumbStep<BlueprintSubtab>> = [
  { key: 'features', narrative: 'Catalog' },
  ...SUBTABS.map((t) => ({ key: t.key, narrative: t.narrative })),
];

/* ── Active tab subtitle ──────────────────────────────────────────────────── */

function getActiveSubtitle(tab: BlueprintSubtab): string | null {
  if (tab === 'features') return 'Feature implementation status & metrics';
  const def = SUBTABS.find((t) => t.key === tab);
  return def?.subtitle ?? null;
}

interface CharacterBlueprintProps {
  moduleId: SubModuleId;
}

export function CharacterBlueprint({ moduleId }: CharacterBlueprintProps) {
  const { featureMap, stats, defs, isLoading } = useTabFeatures(moduleId);
  const [activeTab, setActiveTab] = useState<BlueprintSubtab>('overview');

  if (isLoading) return <LoadingSpinner accent={ACCENT} />;

  const subtitle = getActiveSubtitle(activeTab);

  return (
    <div className="space-y-5">
      <TabHeader
        icon={User}
        title="Character Blueprint"
        implemented={stats.implemented}
        total={stats.total}
        accent={ACCENT}
      />

      <NarrativeBreadcrumb
        steps={NARRATIVE_STEPS}
        activeKey={activeTab}
        accent={ACCENT}
        onNavigate={setActiveTab}
      />

      <SubTabNavigation
        tabs={[
          { id: 'features', label: 'Features', icon: LayoutGrid } as SubTab,
          ...SUBTABS.map((t) => ({ id: t.key, label: t.label, icon: t.icon } as SubTab)),
        ]}
        activeTabId={activeTab}
        onChange={(id) => setActiveTab(id as BlueprintSubtab)}
        accent={ACCENT}
      />

      {subtitle && (
        <p className="text-xs font-mono text-text-muted/70 -mt-1 mb-1 pl-0.5">{subtitle}</p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'features' && <FeaturesTab moduleId={moduleId} />}
          {activeTab === 'overview' && (
            <OverviewTab moduleId={moduleId} featureMap={featureMap} defs={defs} />
          )}
          {activeTab === 'input' && <InputTab moduleId={moduleId} featureMap={featureMap} />}
          {activeTab === 'movement' && <MovementTab moduleId={moduleId} />}
          {activeTab === 'playground' && <CharacterFeelPlayground />}
          {activeTab === 'ai-feel' && <CharacterFeelOptimizer moduleId={moduleId} />}
          {activeTab === 'simulator' && <SimulatorTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
