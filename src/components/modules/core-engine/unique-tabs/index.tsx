'use client';

import type { ExtraTab } from '../../shared/ReviewableModuleView';
import type { SubModuleId } from '@/types/modules';
import { Swords, BookOpen, Brain, Package, Coins, Monitor, TrendingUp, Map, Save, Wrench, User, Activity } from 'lucide-react';
import { CombatActionMap } from '../sub_combat';
import { AbilitySpellbook } from '../sub_ability';
import { LootTableVisualizer } from '../sub_loot';
import { CharacterBlueprint } from '../sub_character';
import { AnimationStateGraph } from '../sub_animation';
import { ScreenFlowMap } from '../sub_ui';
import { SaveDataSchema } from '../sub_save';
import { DebugDashboard } from '../sub_debug';
import { ProgressionCurve } from '../sub_progression';
import { ZoneMap } from '../sub_world';
import { EnemyBestiary } from '../sub_bestiary';
import { ItemCatalog } from '../sub_inventory';
import { WBPStarterPanel } from '../sub_ui/wbp-starter/WBPStarterPanel';

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
    render: (mid) => (
      <div className="flex flex-col gap-4">
        <WBPStarterPanel moduleId={mid} />
        <ScreenFlowMap moduleId={mid} />
      </div>
    ),
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
    label: 'Character',
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
