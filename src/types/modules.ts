import type { LucideIcon } from 'lucide-react';

export type CategoryId = 'project-setup' | 'core-engine' | 'content' | 'game-systems' | 'evaluator' | 'game-director';

/** Canonical list of all sub-module IDs — add new modules here and the type updates automatically. */
export const SUB_MODULE_IDS = [
  // Core Engine — aRPG genre
  'arpg-character',
  'arpg-animation',
  'arpg-gas',
  'arpg-combat',
  'arpg-enemy-ai',
  'arpg-inventory',
  'arpg-loot',
  'arpg-ui',
  'arpg-progression',
  'arpg-world',
  'arpg-save',
  'arpg-polish',
  'core-engine-plan',
  // Content
  'models',
  'animations',
  'materials',
  'level-design',
  'ui-hud',
  'audio',
  // Game Systems
  'ai-behavior',
  'physics',
  'multiplayer',
  'save-load',
  'input-handling',
  'dialogue-quests',
  'packaging',
  'blueprint-transpiler',
  // Evaluator
  'game-design-doc',
] as const;

export type SubModuleId = (typeof SUB_MODULE_IDS)[number];

export type ActionComplexity = 'beginner' | 'intermediate' | 'advanced';

export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  prompt: string;
  icon?: LucideIcon;
  complexity?: ActionComplexity;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

export interface KnowledgeTip {
  title: string;
  content: string;
  source: 'feasibility' | 'best-practice';
}

export interface SubModuleDefinition {
  id: SubModuleId;
  label: string;
  description: string;
  categoryId: CategoryId;
  icon: LucideIcon;
  isSpecialItem?: boolean;
  quickActions: QuickAction[];
  knowledgeTips: KnowledgeTip[];
  feasibilityRating?: 'strong' | 'moderate' | 'challenging';
  checklist?: ChecklistItem[];
}

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  accentColor: string;
  accentColorVar: string;
  subModules: SubModuleId[];
}

export interface ModuleHealth {
  score: number; // 0-100
  tasksCompleted: number;
  lastActivity?: number;
  status: 'not-started' | 'in-progress' | 'healthy' | 'needs-attention';
}

export interface TaskHistoryEntry {
  id: string;
  moduleId: SubModuleId;
  prompt: string;
  status: 'completed' | 'failed';
  timestamp: number;
  duration?: number;
}

// ─── Canonical Module Schema ─────────────────────────────────────────────────
//
// "Module" means 5 things in this codebase:
//   1. Type identity      — SubModuleId union (this file)
//   2. Registry entry     — SubModuleDefinition with checklist + quick actions (module-registry.ts)
//   3. Feature graph      — FeatureDefinition[] per module (feature-definitions.ts)
//   4. Storage key        — moduleStore keys for progress/health/scan data (moduleStore.ts)
//   5. Component factory  — React component per module (ModuleRenderer.tsx)
//
// ModuleSchema ties these together with compile-time constraints so that
// adding a new SubModuleId forces updates across all domains.

/**
 * Canonical schema connecting all 5 module domains.
 * Used as a compile-time anchor — not instantiated at runtime.
 */
export interface ModuleSchema {
  /** The SubModuleId — type identity (domain 1) */
  id: SubModuleId;
  /** Human-readable label — single source of truth */
  label: string;
  /** Category this module belongs to */
  categoryId: CategoryId;
}

/**
 * Requires a value for EVERY SubModuleId — compile error on omission.
 * Use for maps that must be exhaustive (component factory, labels).
 */
export type ExhaustiveModuleMap<T> = Record<SubModuleId, T>;

/**
 * Allows a value for any SubModuleId — no compile error on omission.
 * Use for maps where not every module has data (features, prerequisites).
 */
export type PartialModuleMap<T> = Partial<Record<SubModuleId, T>>;
