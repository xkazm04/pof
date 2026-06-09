'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CatalogLinkRef } from '@/lib/catalog/acceptance/linkCheckers';

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

export type StepOutput = { data?: Record<string, unknown>; ueAssets?: string[]; links?: CatalogLinkRef[] };

interface LabPipelineState {
  /** byEntity[entityId][stepName] → artifact. */
  byEntity: Record<string, Record<string, LabStepArtifact>>;
  /** Run a step: persist its produced data + assets and mark it done. */
  produce: (entityId: string, step: string, out?: StepOutput) => void;
  /** Like `produce`, but derives the output from the step's CURRENT persisted data inside the
   *  state updater, so concurrent dispatches (a double-click) serialize instead of both building
   *  from the same stale render-closure snapshot and overwriting each other (dropping a batch). */
  produceFrom: (entityId: string, step: string, build: (prevData: Record<string, unknown>) => StepOutput) => void;
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
        const data = { ...(out?.data ?? {}), ...(out?.links ? { links: out.links } : {}) };
        const artifact: LabStepArtifact = { done: true, data, ueAssets: out?.ueAssets ?? [], at: new Date().toISOString() };
        set((s) => ({ byEntity: { ...s.byEntity, [entityId]: { ...s.byEntity[entityId], [step]: artifact } } }));
        _labSync?.(entityId, step, artifact);
      },

      produceFrom: (entityId, step, build) => {
        let written: LabStepArtifact | null = null;
        set((s) => {
          // Read the step's LIVE persisted data so two dispatches in the same render frame
          // serialize: the second sees the first's appended batch and mints the next seq,
          // instead of both reading the stale closure and clobbering one batch.
          const prev = s.byEntity[entityId]?.[step];
          const out = build(prev?.data ?? {}) ?? {};
          const data = { ...(out.data ?? {}), ...(out.links ? { links: out.links } : {}) };
          written = { done: true, data, ueAssets: out.ueAssets ?? [], at: new Date().toISOString() };
          return { byEntity: { ...s.byEntity, [entityId]: { ...s.byEntity[entityId], [step]: written } } };
        });
        if (written) _labSync?.(entityId, step, written);
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
