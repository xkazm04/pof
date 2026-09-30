'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiFetch } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';
import type {
  AcquiredAsset,
  AssetRecommendation,
  IntegrationSpec,
  RecommendationResponse,
  UnreviewedModule,
} from '@/types/marketplace';

/** One recorded run of the Asset-Code Consistency Oracle. */
export interface ConsistencyScanEntry {
  score: number;
  /** ISO timestamp of when the scan completed. */
  timestamp: string;
  /** Stable violation ids of this scan (for the since-last-scan diff); absent on older entries. */
  violationKeys?: string[];
}

/** Keep at most this many scans per project — enough for delta + future trends. */
const MAX_CONSISTENCY_SCANS = 30;

/** What the Scout knows about the project's feature matrix when it asks for recommendations. */
export interface FetchRecommendationsInput {
  /** `${moduleId}::${featureName}` → status (from useFeatureStatuses). */
  statusMap: Record<string, string>;
  /** The status load failed: fail closed — no request, a named error, no recommendations. */
  statusesFailed?: boolean;
  /** Why the status load failed (shown in the error). */
  statusesError?: string | null;
  moduleId?: string;
}

const NO_UNREVIEWED: UnreviewedModule[] = [];

/** Latest-wins sequencing: a response for an older request never overwrites a newer one. */
let fetchSeq = 0;

interface MarketplaceState {
  /** Cached recommendations from the API */
  recommendations: AssetRecommendation[];
  totalGaps: number;
  totalAssets: number;
  estimatedTimeSaved: number;
  /** Features with no review verdict, per module (never counted as gaps). */
  unreviewed: UnreviewedModule[];
  totalUnreviewed: number;

  /** Assets the user has acquired */
  acquiredAssets: Record<string, AcquiredAsset>;

  /** Loading state */
  isLoading: boolean;
  error: string | null;

  /** Active module filter */
  moduleFilter: SubModuleId | null;

  /** Per-project consistency-score scan history (oldest→newest), keyed by project path/name. */
  consistencyScans: Record<string, ConsistencyScanEntry[]>;

  /** Append a consistency score (and its violation keys) to a project's scan history (capped, persisted). */
  recordConsistencyScan: (projectKey: string, score: number, violationKeys?: string[]) => void;

  /** Fetch recommendations for the project's feature statuses (fails closed if they failed to load). */
  fetchRecommendations: (input: FetchRecommendationsInput) => Promise<void>;

  /** Mark an asset as acquired */
  acquireAsset: (assetId: string, assetName: string) => void;

  /** Remove an acquired asset */
  removeAcquiredAsset: (assetId: string) => void;

  /** Generate integration code for an acquired asset */
  generateIntegration: (assetId: string, moduleId: SubModuleId, projectName: string, apiMacro: string, existingClasses: string[]) => Promise<IntegrationSpec | null>;

  /** Set module filter */
  setModuleFilter: (moduleId: SubModuleId | null) => void;
}

export const useMarketplaceStore = create<MarketplaceState>()(
  persist(
    (set) => ({
      recommendations: [],
      totalGaps: 0,
      totalAssets: 0,
      estimatedTimeSaved: 0,
      unreviewed: NO_UNREVIEWED,
      totalUnreviewed: 0,
      acquiredAssets: {},
      isLoading: false,
      error: null,
      moduleFilter: null,
      consistencyScans: {},

      recordConsistencyScan: (projectKey, score, violationKeys) => set((state) => {
        const prev = state.consistencyScans[projectKey] ?? [];
        const entry: ConsistencyScanEntry = { score, timestamp: new Date().toISOString(), ...(violationKeys ? { violationKeys } : {}) };
        const next = [...prev, entry].slice(-MAX_CONSISTENCY_SCANS);
        return { consistencyScans: { ...state.consistencyScans, [projectKey]: next } };
      }),

      fetchRecommendations: async ({ statusMap, statusesFailed, statusesError, moduleId }) => {
        const seq = ++fetchSeq;
        const cleared = { recommendations: [], totalGaps: 0, estimatedTimeSaved: 0, unreviewed: NO_UNREVIEWED, totalUnreviewed: 0 };

        if (statusesFailed) {
          // Without statuses every feature would read as a gap — show the failure, not fiction.
          set({
            ...cleared,
            isLoading: false,
            error: `Feature statuses failed to load${statusesError ? ` (${statusesError})` : ''} — cannot tell gaps from built features.`,
          });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const result = await apiFetch<RecommendationResponse>('/api/marketplace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'recommend', statusMap, moduleId }),
          });
          if (seq !== fetchSeq) return;

          set({
            recommendations: result.recommendations,
            totalGaps: result.totalGaps,
            totalAssets: result.totalAssets,
            estimatedTimeSaved: result.estimatedTimeSaved,
            unreviewed: result.unreviewed ?? NO_UNREVIEWED,
            totalUnreviewed: result.totalUnreviewed ?? 0,
            isLoading: false,
          });
        } catch (err) {
          if (seq !== fetchSeq) return;
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch recommendations',
          });
        }
      },

      acquireAsset: (assetId, assetName) => set((state) => ({
        acquiredAssets: {
          ...state.acquiredAssets,
          [assetId]: {
            assetId,
            assetName,
            acquiredAt: new Date().toISOString(),
            integrationGenerated: false,
          },
        },
      })),

      removeAcquiredAsset: (assetId) => set((state) => {
        const { [assetId]: _, ...rest } = state.acquiredAssets;
        return { acquiredAssets: rest };
      }),

      generateIntegration: async (assetId, moduleId, projectName, apiMacro, existingClasses) => {
        try {
          const result = await apiFetch<{ integration: IntegrationSpec }>('/api/marketplace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'integrate',
              assetId,
              moduleId,
              projectName,
              apiMacro,
              existingClasses,
            }),
          });

          // Update the acquired asset with integration data
          set((state) => {
            const existing = state.acquiredAssets[assetId];
            if (!existing) return state;
            return {
              acquiredAssets: {
                ...state.acquiredAssets,
                [assetId]: {
                  ...existing,
                  integrationGenerated: true,
                  integration: result.integration,
                },
              },
            };
          });

          return result.integration;
        } catch {
          return null;
        }
      },

      setModuleFilter: (moduleId) => set({ moduleFilter: moduleId }),
    }),
    {
      name: 'pof-marketplace',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        acquiredAssets: state.acquiredAssets,
        consistencyScans: state.consistencyScans,
      }),
    },
  ),
);
