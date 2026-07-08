import type {
  ImplementationPattern,
  PatternCategory,
} from '@/types/pattern-library';
import type { SubModuleId } from '@/types/modules';

export type LibraryTab = 'patterns' | 'anti-patterns';

// ── Constants for stable Zustand selectors ──────────────────────────────────

export const EMPTY_PATTERNS: ImplementationPattern[] = [];
export const EMPTY_MODULES: { moduleId: SubModuleId; patternCount: number }[] = [];
export const EMPTY_CATEGORIES: { category: PatternCategory; count: number }[] = [];

// ── Styling maps ────────────────────────────────────────────────────────────
// Confidence chip colors live in CONFIDENCE_TOKENS (chart-colors.ts) so they
// stay in lockstep with the rest of the evaluator's palette.

export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  'class-hierarchy': 'Class Hierarchy',
  'component-design': 'Component Design',
  'state-machine': 'State Machine',
  'data-flow': 'Data Flow',
  'gas-integration': 'GAS Integration',
  'animation-setup': 'Animation Setup',
  'ai-behavior': 'AI Behavior',
  'ui-architecture': 'UI Architecture',
  'save-system': 'Save System',
  optimization: 'Optimization',
  general: 'General',
};

export const SORT_LABELS: Record<string, string> = {
  'success-rate': 'Success Rate',
  usage: 'Most Used',
  recent: 'Most Recent',
  duration: 'Fastest',
};
