'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { contentDiverges } from './labContentDrift';
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
  /**
   * Rule 4 — the reason the LAST produce attempt failed, if it did. Written by
   * {@link LabPipelineState.fail}, which `produce`/`produceFrom` call automatically when
   * a dispatch throws, so a failed produce always leaves an artifact-level trace (the
   * step banner + the rail badge read it). Recording it is NON-destructive: previously
   * produced `data`/`ueAssets`/`done` survive, because a re-produce that blew up must not
   * erase the content that DID land. Cleared by the next successful produce (or by the
   * operator dismissing it via `clearError`).
   */
  error?: string;
  /**
   * WHEN the failure recorded in {@link LabStepArtifact.error} happened (ISO).
   *
   * It exists because `markFailure` deliberately does NOT touch `at`: the content from the
   * last successful produce survives a failed re-produce, so `at` must keep pointing at the
   * run that produced it. That leaves the failure with no time of its own, and anything
   * ordering events (the produce log) would sort it by a moment it did not occur. Absent on
   * artifacts that failed before this field existed — readers fall back to `at` rather than
   * inventing a timestamp. Cleared with the error.
   */
  errorAt?: string;
  /**
   * The REASON this step's last produce failed to reach the server — a rejected payload's
   * offending fields, the server's own message, or {@link NO_SYNC_SINK_REASON} when there
   * was no write-through sink at all. The local store still holds the optimistic artifact
   * (add-only UX is preserved), but this makes the gap honest: the rail flags the step and
   * the work canvas states that this step's Acceptance is local-only.
   *
   * It carries a sentence, not a flag, because "not synced" alone is unactionable — the
   * operator cannot tell a malformed payload (fix the produce) from a dead server (retry).
   *
   * Cleared by a later successful write-through for the same step, by the operator, or by
   * hydration proving the server holds a row at least as new as the local one.
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
  /**
   * The `at` of the NEWEST server row this local artifact has been reconciled against —
   * written by `hydrateEntity` / `refreshEntity` whenever the server is observed to hold a
   * row for this step. Absent means "the server has never been seen holding this step".
   *
   * It exists so a refresh can tell the two reasons a step can be missing from the server
   * apart, which no timestamp alone can do: content that came FROM the server and has since
   * been deleted there (safe to reconcile away) versus local work that never reached it
   * (must survive, and be flagged). Without it the only options were "keep every dropped
   * step green forever" or "destroy unsynced local work" — the lab did the former.
   */
  serverSeen?: string;
}

/**
 * What a {@link LabPipelineState.refreshEntity} pass actually did, so the UI can REPORT it
 * rather than silently mutate the operator's work. Every step is accounted for in exactly
 * one bucket.
 */
export interface RefreshOutcome {
  /** Steps whose content + verdict were taken from the server (local differed). */
  adopted: string[];
  /** Steps the server no longer has, and which were provably server-derived — reconciled away. */
  removed: string[];
  /** Steps deliberately left alone because they hold local work the server does not have. */
  kept: string[];
  /** Steps already identical to the server (the happy path). */
  unchanged: number;
}

/**
 * Recorded on a step the SERVER has no row for, when the local artifact holds work that
 * never reached it. The step keeps its content (nothing is destroyed) but stops reading as
 * server-confirmed, and the existing sync-error affordances — the rail badge, the work
 * canvas banner, and its "Retry" (which re-POSTs the artifact) — become the recovery path.
 */
export const SERVER_MISSING_REASON =
  'Not saved to the server: a refresh found no artifact for this step on the server, ' +
  'so this result exists only in this browser.';

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
  /**
   * Record a failed produce with its reason (Rule 4). Called automatically by
   * `produce`/`produceFrom` when the dispatch throws — a caller only needs it for a
   * failure it detects itself. Non-destructive (see {@link LabStepArtifact.error}).
   */
  fail: (entityId: string, step: string, error: string) => void;
  /** Clear a recorded produce error. A step that has ONLY the failure marker (nothing
   *  was ever produced) is removed entirely, so it goes back to honest `unproduced`
   *  and stays open to server hydration. */
  clearError: (entityId: string, step: string) => void;
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
   * EXPLICIT, operator-triggered reconciliation with the server — the escape from add-only
   * for a whole entity at once (`hydrateEntity` can only ever ADD).
   *
   * `serverSteps` is the COMPLETE set of rows the server holds for the entity, so absence is
   * information: a step missing from it was deleted server-side. Rules, in order:
   *  1. server has it, local doesn't → adopt it.
   *  2. both have it, content+verdict identical → nothing (`unchanged`).
   *  3. both have it, but local holds work the server hasn't got (a recorded `syncError`,
   *     or a local produce STRICTLY newer than the server row) → keep local, report `kept`.
   *     This is the "never silently overwrite unsaved produce output" guarantee.
   *  4. both have it and differ otherwise → adopt the server's content + verdict, preserving
   *     the local candidate history (`data.genHistory`) exactly as `adoptServer` does.
   *  5. only local has it, and it is provably server-derived ({@link LabStepArtifact.serverSeen}
   *     with no newer local produce) → remove it, so a step deleted server-side stops reading
   *     green forever.
   *  6. only local has it, and it is local work → keep it and stamp
   *     {@link SERVER_MISSING_REASON} on it, so it is honest rather than destroyed.
   *
   * Returns the {@link RefreshOutcome} so the caller can SHOW what happened.
   */
  refreshEntity: (entityId: string, serverSteps: { step: string; artifact: LabStepArtifact }[]) => RefreshOutcome;
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

/**
 * Recorded when a produce runs with NO write-through sink registered.
 *
 * `setLabSync` is a module singleton the Baseline shell installs on mount and nulls on
 * unmount, so anything that produces while the lab shell is not mounted (a background
 * populate, a step rendered outside Baseline, a produce racing the unmount) wrote to
 * localStorage only — and said nothing at all. Silence is the worst possible answer there:
 * the step shows a derived `pass` that exists on exactly one machine.
 */
export const NO_SYNC_SINK_REASON =
  'Not saved to the server: no write-through sink was registered when this step was produced ' +
  '(the lab shell was not mounted). The result exists only in this browser.';

/** Attach a sync failure to an already-written artifact (no-op if the step vanished). */
function markSyncError(
  s: { byEntity: Record<string, Record<string, LabStepArtifact>> },
  entityId: string,
  step: string,
  error: string,
): { byEntity: Record<string, Record<string, LabStepArtifact>> } {
  const prev = s.byEntity[entityId]?.[step];
  if (!prev || prev.syncError === error) return s;
  return {
    byEntity: { ...s.byEntity, [entityId]: { ...s.byEntity[entityId], [step]: { ...prev, syncError: error } } },
  };
}

/** Normalize whatever was thrown into a reason string (never an empty message). */
function reasonOf(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return msg.trim() || 'Produce failed';
}

/**
 * Attach a produce failure to a step WITHOUT destroying what it had produced before:
 * an existing artifact keeps its `data`/`ueAssets`/`done`/`at` and only gains `error`,
 * so a re-produce that throws can never erase content that did land. When the step has
 * no artifact at all, a not-done failure marker is created so the failure is still
 * visible (and `clearError` removes it again).
 */
function markFailure(
  s: { byEntity: Record<string, Record<string, LabStepArtifact>> },
  entityId: string,
  step: string,
  error: string,
): { byEntity: Record<string, Record<string, LabStepArtifact>> } {
  const prev = s.byEntity[entityId]?.[step];
  // `at` is left alone on an existing artifact (it dates the content that survived), so the
  // failure carries its OWN stamp — otherwise nothing records when it actually happened.
  const errorAt = new Date().toISOString();
  const next: LabStepArtifact = prev
    ? { ...prev, error, errorAt }
    : { done: false, data: {}, ueAssets: [], at: errorAt, error, errorAt };
  return { byEntity: { ...s.byEntity, [entityId]: { ...s.byEntity[entityId], [step]: next } } };
}

/** Parse an ISO stamp defensively — an unparseable one must never look NEWER than the server. */
function ms(at: string | undefined): number {
  const n = at ? Date.parse(at) : NaN;
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Does this local artifact hold work the server has not got? True when its write-through is
 * on record as failed, or when it was produced STRICTLY after the server's row. Either way an
 * adoption would destroy something that exists nowhere else, so a refresh keeps it.
 */
function hasUnsyncedLocalWork(cur: LabStepArtifact, server: LabStepArtifact | undefined): boolean {
  if (cur.syncError !== undefined) return true;
  return ms(cur.at) > ms(server?.at ?? cur.serverSeen);
}

/**
 * Is this local artifact provably a COPY of a server row (rather than local-only work)? Only
 * such a step may be reconciled away when the server drops it. An artifact from before
 * `serverSeen` existed has no proof either way, so it is never removed.
 */
function isServerDerived(cur: LabStepArtifact): boolean {
  return cur.serverSeen !== undefined && cur.syncError === undefined && ms(cur.at) <= ms(cur.serverSeen);
}

/** Take the server's artifact while preserving the local candidate archive (see `adoptServer`). */
function withLocalHistory(server: LabStepArtifact, cur: LabStepArtifact | undefined): LabStepArtifact {
  const prevHistory = (cur?.data as Record<string, unknown> | undefined)?.[GEN_HISTORY_KEY];
  const data = prevHistory !== undefined && server.data?.[GEN_HISTORY_KEY] === undefined
    ? { ...server.data, [GEN_HISTORY_KEY]: prevHistory }
    : server.data;
  return { ...server, data, serverSeen: server.at };
}

export const useLabPipelineStore = create<LabPipelineState>()(
  persist(
    (set) => ({
      byEntity: {},

      produce: (entityId, step, out) => {
        const data = { ...(out?.data ?? {}), ...(out?.links ? { links: out.links } : {}) };
        const artifact: LabStepArtifact = { done: true, data, ueAssets: out?.ueAssets ?? [], at: new Date().toISOString() };
        // Rule 4: a produce that blows up (a throwing write-through sink, a bad payload)
        // must leave a trace on the artifact, not only an inline message in the panel it
        // was dispatched from. The throw is re-raised so `CliProduce` still reports the
        // reason inline and offers "Retry with same prompt".
        try {
          set((s) => ({ byEntity: { ...s.byEntity, [entityId]: { ...s.byEntity[entityId], [step]: artifact } } }));
          if (_labSync) _labSync(entityId, step, artifact);
          // A produce with no sink reached no server — say so on the artifact instead of
          // letting the optimistic local write pass for a persisted one.
          else set((s) => markSyncError(s, entityId, step, NO_SYNC_SINK_REASON));
        } catch (e) {
          set((s) => markFailure(s, entityId, step, reasonOf(e)));
          throw e;
        }
      },

      produceFrom: (entityId, step, build) => {
        let written: LabStepArtifact | null = null;
        try {
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
          if (written) {
            if (_labSync) _labSync(entityId, step, written);
            else set((s) => markSyncError(s, entityId, step, NO_SYNC_SINK_REASON));
          }
        } catch (e) {
          // The step's OWN build logic threw (candidate generation, payload assembly) —
          // the most common real produce failure. Record it, then re-raise (see `produce`).
          set((s) => markFailure(s, entityId, step, reasonOf(e)));
          throw e;
        }
      },

      fail: (entityId, step, error) => set((s) => markFailure(s, entityId, step, error)),

      clearError: (entityId, step) =>
        set((s) => {
          const art = s.byEntity[entityId]?.[step];
          if (!art?.error) return s; // no-op guard
          const row = { ...s.byEntity[entityId] };
          if (art.done) {
            const next = { ...art };
            delete next.error;
            delete next.errorAt; // the stamp belongs to the error; it must not outlive it
            row[step] = next;
          } else {
            // Failure-marker only: drop it so the step reads as honestly `unproduced`
            // again (and add-only hydration can adopt the server's artifact for it).
            delete row[step];
          }
          return { byEntity: { ...s.byEntity, [entityId]: row } };
        }),

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
            // A first sighting is adopted whole, and STAMPED with the server row it came
            // from (`serverSeen`) — that stamp is what later lets `refreshEntity` tell a
            // server-derived step from local-only work when the server drops the row.
            if (!cur) { merged[step] = { ...artifact, serverSeen: artifact.at }; changed = true; continue; }
            // ADD-ONLY still holds for CONTENT (data/ueAssets are never overwritten here —
            // that stays an explicit `adoptServer`). The server's VERDICT is a different
            // thing: a gate drain resolves L3/L4 server-side, so its status/tier/reason are
            // merged onto the existing local artifact — otherwise a drain would leave the
            // step's banner frozen at `deferred` forever.
            // A recorded sync failure is a claim about the SERVER ("your work never got
            // there"). Hydration is the server answering — and if it holds a row at least
            // as new as the local artifact, the claim is now false and keeping it would
            // nag about a write that did land (a POST whose RESPONSE was lost, a retry
            // from another tab). Strictly older server content leaves the flag alone: that
            // row is a PREVIOUS produce and proves nothing about the failed one.
            const staleSyncError =
              cur.syncError !== undefined && Date.parse(artifact.at) >= Date.parse(cur.at);
            const verdictChanged =
              cur.status !== artifact.status || cur.tier !== artifact.tier || cur.reason !== artifact.reason;
            // Record the server row we just observed, even when nothing else moved: it is
            // pure provenance (never content, never a verdict) and it is what makes a later
            // refresh able to reconcile a server-side deletion instead of guessing.
            const seenChanged = cur.serverSeen !== artifact.at;
            if (verdictChanged || staleSyncError || seenChanged) {
              const next: LabStepArtifact = { ...cur };
              if (artifact.status === undefined) delete next.status; else next.status = artifact.status;
              if (artifact.tier === undefined) delete next.tier; else next.tier = artifact.tier;
              if (artifact.reason === undefined) delete next.reason; else next.reason = artifact.reason;
              if (staleSyncError) delete next.syncError;
              next.serverSeen = artifact.at;
              merged[step] = next;
              changed = true;
            }
          }
          return changed ? { byEntity: { ...s.byEntity, [entityId]: merged } } : s;
        }),

      refreshEntity: (entityId, serverSteps) => {
        const outcome: RefreshOutcome = { adopted: [], removed: [], kept: [], unchanged: 0 };
        set((s) => {
          const existing = s.byEntity[entityId] ?? {};
          const next: Record<string, LabStepArtifact> = {};
          const serverByStep = new Map(serverSteps.map((x) => [x.step, x.artifact]));
          let changed = false;

          for (const { step, artifact } of serverSteps) {
            const cur = existing[step];
            if (!cur) { next[step] = { ...artifact, serverSeen: artifact.at }; changed = true; outcome.adopted.push(step); continue; }
            const adopted = withLocalHistory(artifact, cur);
            const sameVerdict = cur.status === adopted.status && cur.tier === adopted.tier && cur.reason === adopted.reason;
            if (sameVerdict && !contentDiverges(cur, adopted)) {
              // Already the server's truth. Only the provenance stamp may need refreshing.
              outcome.unchanged += 1;
              if (cur.serverSeen !== artifact.at || cur.syncError !== undefined) {
                const stamped = { ...cur, serverSeen: artifact.at };
                delete stamped.syncError; // the server demonstrably holds this exact content
                next[step] = stamped;
                changed = true;
              } else next[step] = cur;
              continue;
            }
            if (hasUnsyncedLocalWork(cur, artifact)) {
              // Local work the server has not got — a refresh must never destroy it.
              outcome.kept.push(step);
              next[step] = cur;
              continue;
            }
            next[step] = adopted;
            outcome.adopted.push(step);
            changed = true;
          }

          for (const step of Object.keys(existing)) {
            if (serverByStep.has(step)) continue;
            const cur = existing[step];
            if (isServerDerived(cur)) { outcome.removed.push(step); changed = true; continue; }
            outcome.kept.push(step);
            next[step] = cur.syncError === SERVER_MISSING_REASON ? cur : { ...cur, syncError: SERVER_MISSING_REASON };
            if (next[step] !== cur) changed = true;
          }

          return changed ? { byEntity: { ...s.byEntity, [entityId]: next } } : s;
        });
        return outcome;
      },

      adoptServer: (entityId, step, artifact, opts) =>
        set((s) => {
          const prev = s.byEntity[entityId]?.[step];
          // Preserve the local candidate history unless the user confirmed replacement.
          const prevHistory = (prev?.data as Record<string, unknown> | undefined)?.[GEN_HISTORY_KEY];
          const data = !opts?.replaceHistory && prevHistory !== undefined
            ? { ...artifact.data, [GEN_HISTORY_KEY]: prevHistory }
            : artifact.data;
          // Stamp the server row this adoption came from, so a later refresh can tell the
          // step apart from local-only work if the server ever drops it.
          return { byEntity: { ...s.byEntity, [entityId]: { ...s.byEntity[entityId], [step]: { ...artifact, data, serverSeen: artifact.at } } } };
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
