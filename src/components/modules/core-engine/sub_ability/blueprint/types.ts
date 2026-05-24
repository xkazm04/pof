/**
 * Editor-specific type definitions for the GAS Blueprint Editor.
 *
 * Types that are shared across sub-editor components live here.
 * Canonical GAS types (EditorAttribute, EditorEffect, etc.) are
 * re-exported from @/lib/gas-codegen via ./data.ts.
 */

export interface AttrRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'scale' | 'clamp' | 'regen';
  formula: string;
}

export interface EditorState {
  attributes: import('@/lib/gas-codegen').EditorAttribute[];
  relationships: AttrRelationship[];
  effects: import('@/lib/gas-codegen').EditorEffect[];
  tagRules: import('@/lib/gas-codegen').TagRule[];
  loadout: import('@/lib/gas-codegen').GASLoadoutSlot[];
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
