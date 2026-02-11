import type { LucideIcon } from 'lucide-react';

export type CategoryId = 'project-setup' | 'core-engine' | 'content' | 'game-systems' | 'evaluator';

export type SubModuleId =
  // Core Engine — aRPG genre
  | 'arpg-character'
  | 'arpg-animation'
  | 'arpg-gas'
  | 'arpg-combat'
  | 'arpg-enemy-ai'
  | 'arpg-inventory'
  | 'arpg-loot'
  | 'arpg-ui'
  | 'arpg-progression'
  | 'arpg-world'
  | 'arpg-save'
  | 'arpg-polish'
  // Content
  | 'models'
  | 'animations'
  | 'materials'
  | 'level-design'
  | 'ui-hud'
  | 'audio'
  // Game Systems
  | 'ai-behavior'
  | 'physics'
  | 'multiplayer'
  | 'save-load'
  | 'input-handling'
  | 'dialogue-quests'
  | 'packaging';

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon?: LucideIcon;
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
