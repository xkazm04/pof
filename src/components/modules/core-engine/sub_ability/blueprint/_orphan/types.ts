import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE,
  MODULE_COLORS,
} from '@/lib/chart-colors';
import type { AttrCategory } from '@/lib/gas-codegen';

export const ACCENT = MODULE_COLORS.systems;

export interface AttrRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'scale' | 'clamp' | 'regen';
  formula: string;
}

export interface EditorState {
  attributes: EditorAttribute[];
  relationships: AttrRelationship[];
  effects: EditorEffect[];
  tagRules: TagRule[];
  loadout: GASLoadoutSlot[];
}

export type PinKind = 'attr-out' | 'effect-in' | 'effect-out' | 'tag-in';

export interface GASGraphNode {
  id: string;
  label: string;
  type: 'attribute' | 'effect' | 'tag-rule';
  x: number;
  y: number;
  color: string;
  pins: { id: string; kind: PinKind; label: string; side: 'left' | 'right' }[];
}

export interface GraphWire {
  id: string;
  fromNode: string;
  fromPin: string;
  toNode: string;
  toPin: string;
  color: string;
  animated: boolean;
}

export interface TagValidation {
  srcUnmatched: boolean;
  tgtUnmatched: boolean;
  conflict: string | null;
}

export type EditorPanel = 'wiring' | 'relationships' | 'effects' | 'tags' | 'loadout' | 'codegen';

export const CAT_COLORS: Record<AttrCategory, string> = {
  meta: ACCENT_CYAN,
  vital: STATUS_SUCCESS,
  primary: ACCENT_VIOLET,
  combat: ACCENT_ORANGE,
  progression: MODULE_COLORS.core,
};

export const DURATION_OPTIONS = [
  { id: 'instant', label: 'Instant' },
  { id: 'duration', label: 'Duration' },
  { id: 'infinite', label: 'Infinite' },
];

export const NODE_W_GRAPH = 140;
export const NODE_H_GRAPH = 28;
export const PIN_R = 3.5;

/** Breadcrumb path per panel — maps to UE5 class hierarchy */
export const PANEL_BREADCRUMBS: Record<EditorPanel, string[]> = {
  wiring: ['AARPGCharacterBase', 'UAbilitySystemComponent', 'Data Pipeline'],
  relationships: ['AARPGCharacterBase', 'UARPGAttributeSet', 'Dependencies'],
  effects: ['AARPGCharacterBase', 'UAbilitySystemComponent', 'UGameplayEffect'],
  tags: ['AARPGCharacterBase', 'FGameplayTagContainer', 'Rules'],
  loadout: ['AARPGCharacterBase', 'UAbilitySystemComponent', 'Loadout Slots'],
  codegen: ['AARPGCharacterBase', 'Generated C++'],
};

// Re-export gas-codegen types used across sub-editors
import type { EditorAttribute, EditorEffect, TagRule, GASLoadoutSlot } from '@/lib/gas-codegen';
export type { EditorAttribute, EditorEffect, TagRule, GASLoadoutSlot };
