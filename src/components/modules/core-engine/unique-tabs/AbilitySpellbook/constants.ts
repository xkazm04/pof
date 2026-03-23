import {
  Cpu, BarChart3, Tags, Sparkles, Flame,
  Network, Clock, Calculator, ClipboardCheck, Layers,
} from 'lucide-react';
import {
  MODULE_COLORS, ACCENT_EMERALD_DARK, ACCENT_PURPLE_BOLD,
  ACCENT_RED, ACCENT_ORANGE, STATUS_WARNING,
} from '@/lib/chart-colors';
import type { SectionConfig } from './types';

export const ACCENT = MODULE_COLORS.systems;

export const SECTIONS: SectionConfig[] = [
  {
    id: 'core',
    label: 'Core',
    icon: Cpu,
    color: MODULE_COLORS.core,
    featureNames: ['AbilitySystemComponent'],
  },
  {
    id: 'attributes',
    label: 'Attributes',
    icon: BarChart3,
    color: ACCENT_EMERALD_DARK,
    featureNames: ['Core AttributeSet', 'Default attribute initialization'],
  },
  {
    id: 'tags',
    label: 'Tags',
    icon: Tags,
    color: MODULE_COLORS.content,
    featureNames: ['Gameplay Tags hierarchy'],
  },
  {
    id: 'abilities',
    label: 'Abilities',
    icon: Sparkles,
    color: ACCENT_PURPLE_BOLD,
    featureNames: ['Base GameplayAbility'],
  },
  {
    id: 'effects',
    label: 'Effects',
    icon: Flame,
    color: ACCENT_RED,
    featureNames: ['Core Gameplay Effects', 'Damage execution calculation'],
  },
  {
    id: 'tag-deps',
    label: 'Tag Deps',
    icon: Network,
    color: MODULE_COLORS.content,
    featureNames: [],
  },
  {
    id: 'effects-timeline',
    label: 'Effect Timeline',
    icon: Clock,
    color: ACCENT_RED,
    featureNames: [],
  },
  {
    id: 'damage-calc',
    label: 'Damage Calc',
    icon: Calculator,
    color: ACCENT_ORANGE,
    featureNames: [],
  },
  {
    id: 'tag-audit',
    label: 'Tag Audit',
    icon: ClipboardCheck,
    color: STATUS_WARNING,
    featureNames: [],
  },
  {
    id: 'loadout',
    label: 'Loadout',
    icon: Layers,
    color: ACCENT_PURPLE_BOLD,
    featureNames: [],
  },
];
