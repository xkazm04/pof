import type { StoredCatalogEntity } from '@/lib/catalog/types';

export interface Histogram { [value: string]: number }

export interface GapAnalysisPlugin {
  /** Attribute paths (dot-notation against `entity.data`) to histogram. */
  dimensions: string[];
  /** Per-attribute expected-share map for under-rep detection (sum should be ~1). */
  expectedShare?: Record<string, Record<string, number>>;
  /** Short deterministic summary of one entity's `data` for the proposal prompt. */
  summarize: (data: unknown) => string;
}

// Suppress the unused-import warning on StoredCatalogEntity (kept for downstream re-export ergonomics).
export type _Refs = StoredCatalogEntity;
