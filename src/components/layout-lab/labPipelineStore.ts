'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CatalogLinkRef } from '@/lib/catalog/acceptance/linkCheckers';

/** The key under `data` holding a generative step's candidate-batch archive
 *  (mirrors `steps/shared/genHistory.ts`'s `GEN_HISTORY_KEY`). Inlined so this store
 *  doesn't couple to the step-UI tree; adopting server truth preserves it by default. */
const GEN_HISTORY_KEY = 'genHistory';

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
  /**
   * Set when the write-through POST to the server FAILED (offline/500) for this step's
   * last produce. The local store still holds the optimistic artifact (add-only UX is
   * preserved), but this flag makes the gap honest — the rail renders a persistent
   * "not synced to server" indicator instead of a clean pass. Cleared once a later
   * write-through for the same step succeeds.
   */
  syncError?: string;
  /**
   * The SERVER's persisted verdict for this step, carried back by `hydrateEntity` (the
   * artifact-cache read). Additive + optional: a freshly produced local artifact has none,
   * and every existing persisted store rehydrates unchanged.
   *
   * It exists because an L3/L4 gate DRAIN resolves server-side: the runner flips the row to
   * `pass`/`fail` with a tier + reason that the pure local Checker can only ever call
   * `deferred`. Without these fields a drain changed nothing on screen. `serverVerdictOverlay`
   * (labCheckerContext.ts) is the ONE place that decides when they win.
   */
  status?: string;
  tier?: string;
  reason?: string;
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
  /**
   * Mark (or clear, with `null`) a produced step's server write-through failure. The
   * write-through calls this after `postArtifact` resolves so a POST that never reached
   * the server surfaces as a persistent "not synced" state instead of a silent success.
   */
  setSyncError: (entityId: string, step: string, error: string | null) => void;
  /** Clear every step for one entity. */
  resetEntity: (entityId: string) => void;
  /** Merge server artifacts into the cache (add-only: never overwrites/clears local steps). */
  hydrateEntity: (entityId: string, steps: { step: string; artifact: LabStepArtifact }[]) => void;
  /**
   * Adopt the server's artifact for ONE step, overwriting the local one so the derived
   * status matches server truth (the operator-triggered escape from the add-only default
   * when server and local have drifted). Preserves the local candidate history
   * (`data.genHistory`) by default so a re-roll archive is never silently destroyed;
   * pass `replaceHistory: true` (an explicit user confirmation) to take the server's
   * data wholesale, history included.
   */
  adoptServer: (entityId: string, step: string, artifact: LabStepArtifact, opts?: { replaceHistory?: boolean }) => void;
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

      setSyncError: (entityId, step, error) =>
        set((s) => {
          const art = s.byEntity[entityId]?.[step];
          if (!art) return s; // only a produced step can be out of sync
          const next = error ?? undefined;
          if (art.syncError === next) return s; // no-op guard (avoids needless re-render)
          const nextArt = { ...art };
          if (next === undefined) delete nextArt.syncError;
          else nextArt.syncError = next;
          return { byEntity: { ...s.byEntity, [entityId]: { ...s.byEntity[entityId], [step]: nextArt } } };
        }),

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
            const cur = merged[step];
            if (!cur) { merged[step] = artifact; changed = true; continue; }
            // ADD-ONLY still holds for CONTENT (data/ueAssets are never overwritten here —
            // that stays an explicit `adoptServer`). The server's VERDICT is a different
            // thing: a gate drain resolves L3/L4 server-side, so its status/tier/reason are
            // merged onto the existing local artifact — otherwise a drain would leave the
            // step's banner frozen at `deferred` forever.
            if (cur.status !== artifact.status || cur.tier !== artifact.tier || cur.reason !== artifact.reason) {
              const next: LabStepArtifact = { ...cur };
              if (artifact.status === undefined) delete next.status; else next.status = artifact.status;
              if (artifact.tier === undefined) delete next.tier; else next.tier = artifact.tier;
              if (artifact.reason === undefined) delete next.reason; else next.reason = artifact.reason;
              merged[step] = next;
              changed = true;
            }
          }
          return changed ? { byEntity: { ...s.byEntity, [entityId]: merged } } : s;
        }),

      adoptServer: (entityId, step, artifact, opts) =>
        set((s) => {
          const prev = s.byEntity[entityId]?.[step];
          // Preserve the local candidate history unless the user confirmed replacement.
          const prevHistory = (prev?.data as Record<string, unknown> | undefined)?.[GEN_HISTORY_KEY];
          const data = !opts?.replaceHistory && prevHistory !== undefined
            ? { ...artifact.data, [GEN_HISTORY_KEY]: prevHistory }
            : artifact.data;
          return { byEntity: { ...s.byEntity, [entityId]: { ...s.byEntity[entityId], [step]: { ...artifact, data } } } };
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
