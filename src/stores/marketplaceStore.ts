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
} from '@/types/marketplace';
import type { FeatureStatus } from '@/types/feature-matrix';

/** One recorded run of the Asset-Code Consistency Oracle. */
export interface ConsistencyScanEntry {
  score: number;
  /** ISO timestamp of when the scan completed. */
  timestamp: string;
}

/** Keep at most this many scans per project — enough for delta + future trends. */
const MAX_CONSISTENCY_SCANS = 30;

interface MarketplaceState {
  /** Cached recommendations from the API */
  recommendations: AssetRecommendation[];
  totalGaps: number;
  totalAssets: number;
  estimatedTimeSaved: number;

  /** Assets the user has acquired */
  acquiredAssets: Record<string, AcquiredAsset>;

  /** Loading state */
  isLoading: boolean;
  error: string | null;

  /** Active module filter */
  moduleFilter: SubModuleId | null;

  /** Per-project consistency-score scan history (oldest→newest), keyed by project path/name. */
  consistencyScans: Record<string, ConsistencyScanEntry[]>;

  /** Append a consistency score to a project's scan history (capped, persisted). */
  recordConsistencyScan: (projectKey: string, score: number) => void;

  /** Fetch recommendations from the API */
  fetchRecommendations: (statusMap?: Record<string, FeatureStatus>, moduleId?: string) => Promise<void>;

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
    (set, get) => ({
      recommendations: [],
      totalGaps: 0,
      totalAssets: 0,
      estimatedTimeSaved: 0,
      acquiredAssets: {},
      isLoading: false,
      error: null,
      moduleFilter: null,
      consistencyScans: {},

      recordConsistencyScan: (projectKey, score) => set((state) => {
        const prev = state.consistencyScans[projectKey] ?? [];
        const next = [...prev, { score, timestamp: new Date().toISOString() }].slice(-MAX_CONSISTENCY_SCANS);
        return { consistencyScans: { ...state.consistencyScans, [projectKey]: next } };
      }),

      fetchRecommendations: async (statusMap, moduleId) => {
        const { isLoading } = get();
        if (isLoading) return;

        set({ isLoading: true, error: null });

        try {
          const result = await apiFetch<RecommendationResponse>('/api/marketplace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'recommend',
              statusMap: statusMap ?? {},
              moduleId,
            }),
          });

          set({
            recommendations: result.recommendations,
            totalGaps: result.totalGaps,
            totalAssets: result.totalAssets,
            estimatedTimeSaved: result.estimatedTimeSaved,
            isLoading: false,
          });
        } catch (err) {
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
