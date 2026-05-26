'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Real (persisted) per-step production state for the /layout lab — the data the
 * pipeline actually writes when a Produce step runs. Kept lab-scoped on purpose:
 * the shared `catalogStore` / `CatalogEntityBase` type is a multi-session
 * entanglement point, so the prototype proves the View→Produce→Acceptance loop
 * against its own store. Acceptance is DERIVED from these artifacts, never toggled.
 */
export interface LabStepArtifact {
  /** True once the step's Produce has run successfully. */
  done: boolean;
  /** Step-specific produced payload (brief text, stats, costs, selected icon…). */
  data: Record<string, unknown>;
  /** UE asset paths this step produced. */
  ueAssets: string[];
  /** ISO timestamp of the last successful produce. */
  at: string;
  /** Rule 4 — the reason the last produce failed, if it did. */
  error?: string;
}

export type StepOutput = { data?: Record<string, unknown>; ueAssets?: string[] };

interface LabPipelineState {
  /** byEntity[entityId][stepName] → artifact. */
  byEntity: Record<string, Record<string, LabStepArtifact>>;
  /** Run a step: persist its produced data + assets and mark it done. */
  produce: (entityId: string, step: string, out?: StepOutput) => void;
  /** Record a failed produce with its reason (Rule 4). */
  fail: (entityId: string, step: string, error: string) => void;
  /** Clear every step for one entity. */
  resetEntity: (entityId: string) => void;
  /** Merge server artifacts into the cache (add-only: never overwrites/clears local steps). */
  hydrateEntity: (entityId: string, steps: { step: string; artifact: LabStepArtifact }[]) => void;
}

export const useLabPipelineStore = create<LabPipelineState>()(
  persist(
    (set) => ({
      byEntity: {},

      produce: (entityId, step, out) => {
        const artifact: LabStepArtifact = { done: true, data: out?.data ?? {}, ueAssets: out?.ueAssets ?? [], at: new Date().toISOString() };
        set((s) => ({ byEntity: { ...s.byEntity, [entityId]: { ...s.byEntity[entityId], [step]: artifact } } }));
        _labSync?.(entityId, step, artifact);
      },

      fail: (entityId, step, error) =>
        set((s) => ({
          byEntity: {
            ...s.byEntity,
            [entityId]: {
              ...s.byEntity[entityId],
              [step]: { done: false, data: {}, ueAssets: [], at: new Date().toISOString(), error },
            },
          },
        })),

      resetEntity: (entityId) =>
        set((s) => {
          if (!s.byEntity[entityId]) return s;
          const next = { ...s.byEntity };
          delete next[entityId];
          return { byEntity: next };
        }),

      hydrateEntity: (entityId, steps) =>
        set((s) => {
          if (!steps.length) return s; // no-op (avoids needless re-render)
          const existing = s.byEntity[entityId] ?? {};
          let changed = false;
          const merged = { ...existing };
          for (const { step, artifact } of steps) {
            if (!merged[step]) { merged[step] = artifact; changed = true; }
          }
          return changed ? { byEntity: { ...s.byEntity, [entityId]: merged } } : s;
        }),
    }),
    { name: 'pof-lab-pipeline', storage: createJSONStorage(() => localStorage) },
  ),
);

/** Optional write-through sink, set by the shell (bound to the active catalogId) to persist produces. */
export type LabSyncFn = (entityId: string, step: string, artifact: LabStepArtifact) => void;
let _labSync: LabSyncFn | null = null;
export function setLabSync(fn: LabSyncFn | null): void { _labSync = fn; }

/** Subscribe to one step's artifact (undefined until produced). */
export function useLabStep(entityId: string, step: string): LabStepArtifact | undefined {
  return useLabPipelineStore((s) => s.byEntity[entityId]?.[step]);
}

/** Subscribe to an entity's whole pipeline map (for progress + checkmarks). */
export function useEntitySteps(entityId: string): Record<string, LabStepArtifact> | undefined {
  return useLabPipelineStore((s) => s.byEntity[entityId]);
}
