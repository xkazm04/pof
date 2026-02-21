'use client';

import type { ExtraTab } from '../../shared/ReviewableModuleView';
import type { SubModuleId } from '@/types/modules';
import { Swords, BookOpen, Brain, Package, Coins, Monitor, TrendingUp, Map, Save, Wrench, User, Activity } from 'lucide-react';
import { CombatActionMap } from './CombatActionMap';
import { AbilitySpellbook } from './AbilitySpellbook';
import { LootTableVisualizer } from './LootTableVisualizer';
import { CharacterBlueprint } from './CharacterBlueprint';
import { AnimationStateGraph } from './AnimationStateGraph';
import { ScreenFlowMap } from './ScreenFlowMap';
import { SaveDataSchema } from './SaveDataSchema';
import { DebugDashboard } from './DebugDashboard';
import { ProgressionCurve } from './ProgressionCurve';
import { ZoneMap } from './ZoneMap';
import { EnemyBestiary } from './EnemyBestiary';
import { ItemCatalog } from './ItemCatalog';

/**
 * Registry of unique domain-specific tabs for each core engine submodule.
 * Each tab provides a specialized visualization tailored to the module's domain.
 */
const UNIQUE_TAB_MAP: Partial<Record<SubModuleId, ExtraTab>> = {
  'arpg-combat': {
    id: 'combat-map',
    label: 'Combat Map',
    icon: Swords,
    render: (mid) => <CombatActionMap moduleId={mid} />,
  },
  'arpg-gas': {
    id: 'spellbook',
    label: 'Spellbook',
    icon: BookOpen,
    render: (mid) => <AbilitySpellbook moduleId={mid} />,
  },
  'arpg-enemy-ai': {
    id: 'bestiary',
    label: 'Bestiary',
    icon: Brain,
    render: (mid) => <EnemyBestiary moduleId={mid} />,
  },
  'arpg-inventory': {
    id: 'item-catalog',
    label: 'Items',
    icon: Package,
    render: (mid) => <ItemCatalog moduleId={mid} />,
  },
  'arpg-loot': {
    id: 'loot-tables',
    label: 'Loot Tables',
    icon: Coins,
    render: (mid) => <LootTableVisualizer moduleId={mid} />,
  },
  'arpg-ui': {
    id: 'screen-flow',
    label: 'Screen Flow',
    icon: Monitor,
    render: (mid) => <ScreenFlowMap moduleId={mid} />,
  },
  'arpg-progression': {
    id: 'progression',
    label: 'Curves',
    icon: TrendingUp,
    render: (mid) => <ProgressionCurve moduleId={mid} />,
  },
  'arpg-world': {
    id: 'zone-map',
    label: 'Zone Map',
    icon: Map,
    render: (mid) => <ZoneMap moduleId={mid} />,
  },
  'arpg-save': {
    id: 'save-schema',
    label: 'Save Schema',
    icon: Save,
    render: (mid) => <SaveDataSchema moduleId={mid} />,
  },
  'arpg-polish': {
    id: 'debug',
    label: 'Debug',
    icon: Wrench,
    render: (mid) => <DebugDashboard moduleId={mid} />,
  },
  'arpg-character': {
    id: 'blueprint',
    label: 'Blueprint',
    icon: User,
    render: (mid) => <CharacterBlueprint moduleId={mid} />,
  },
  'arpg-animation': {
    id: 'state-graph',
    label: 'State Graph',
    icon: Activity,
    render: (mid) => <AnimationStateGraph moduleId={mid} />,
  },
};

export function getUniqueTab(moduleId: SubModuleId): ExtraTab | null {
  return UNIQUE_TAB_MAP[moduleId] ?? null;
}

import { motion } from 'framer-motion';

function ComingSoon({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 gap-4"
    >
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-xl border border-dashed border-border/60"
        />
        <div className="w-14 h-14 rounded-xl bg-surface-deep/50 backdrop-blur-sm border border-border/40 flex items-center justify-center relative z-10 shadow-inner">
          <Wrench className="w-6 h-6 text-text-muted opacity-70" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-base font-bold text-text tracking-wide">{name}</p>
        <p className="text-xs text-text-muted max-w-[200px] leading-relaxed">
          This advanced visualization is currently under construction.
        </p>
      </div>
    </motion.div>
  );
}
