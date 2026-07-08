import type {
  AssetRecommendation,
  AcquiredAsset,
  IntegrationDifficulty,
} from '@/types/marketplace';

// ── Constants for stable Zustand selectors ──────────────────────────────────

export const EMPTY_ACQUIRED: Record<string, AcquiredAsset> = {};
export const EMPTY_RECS: AssetRecommendation[] = [];

// ── Difficulty styling ──────────────────────────────────────────────────────

export const DIFFICULTY_COLORS: Record<IntegrationDifficulty, { bg: string; text: string; label: string }> = {
  'drop-in': { bg: 'bg-green-400/10', text: 'text-green-400', label: 'Drop-in' },
  'adapter': { bg: 'bg-amber-400/10', text: 'text-amber-400', label: 'Adapter' },
  'deep-rewrite': { bg: 'bg-red-400/10', text: 'text-red-400', label: 'Deep Rewrite' },
};

export const SOURCE_LABELS = {
  'fab': 'Fab.com',
  'ue-marketplace': 'UE Marketplace',
} as const;
