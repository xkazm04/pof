/* ══════════════════════════════════════════════════════════════════════════
   TYPES — re-declared locally to avoid circular imports from parent
   ══════════════════════════════════════════════════════════════════════════ */

export type AttrCategory = 'meta' | 'vital' | 'primary' | 'combat' | 'progression';

export interface EditorAttribute {
  id: string;
  name: string;
  category: AttrCategory;
  defaultValue: number;
  clampMin?: number;
  clampMax?: string;
}

export interface AttrRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'scale' | 'clamp' | 'regen';
  formula: string;
}

export type EffectDuration = 'instant' | 'duration' | 'infinite';

export interface EditorEffect {
  id: string;
  name: string;
  duration: EffectDuration;
  durationSec: number;
  cooldownSec: number;
  color: string;
  modifiers: { attribute: string; operation: 'add' | 'multiply'; magnitude: number }[];
  grantedTags: string[];
}

/* ── Simulation-specific types ─────────────────────────────────────────── */

export interface QueuedEffect {
  id: string;
  effectId: string;
  triggerTime: number; // seconds
}

export interface SimSnapshot {
  time: number;
  values: Record<string, number>; // attrName → value
  activeTags: string[];
  events: string[]; // short labels like "GE_Damage applied"
}

export interface SimulationSandboxProps {
  attributes: EditorAttribute[];
  effects: EditorEffect[];
  relationships: AttrRelationship[];
  accent: string;
}
