import { create } from 'zustand';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import type {
  GenerationProvider as McpProvider,
  JobResult,
  JobStatusResult,
  ImportedObject,
} from '@/lib/blender-mcp/types';
import type { ForgeCritique, ForgeFinishState, ForgeGateProjection, ForgeStatusResponse } from './forgeJobStatus';
import type { DeliveryRemedy } from '@/lib/visual-gen/delivery-remedy';
import type { StyleDnaProfile } from '@/lib/visual-gen/style-dna-db';
import { getOfficialProvider, getProviderById, providerExecution } from '@/lib/visual-gen/providers';
import type { CollisionPlan, CollisionUse } from '@/lib/visual-gen/ue-import';
import type { CollisionPlanBasis } from '@/lib/visual-gen/ue-import-job-store';
import { isTracked, onTrackedChange, startTrackedPoll, stopTracked } from './forgePoller';

export type JobStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'importing';
export type GenerationMode = 'text-to-3d' | 'image-to-3d';

export interface GenerationJob {
  id: string;
  mode: GenerationMode;
  prompt: string;
  imageUrl?: string;
  providerId: string;
  status: JobStatus;
  progress: number;
  resultUrl?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
  /** Remote job id returned by the MCP generation API */
  mcpJobId?: string;
  /** The Blender-MCP provider `mcpJobId` belongs to — set on the MCP path only, so a
   *  runner job (which reuses `mcpJobId` for its runner id) is never re-attached as MCP. */
  mcpProvider?: McpProvider;
  /** Tier-1 quality-gate outcome — a scorecard, or a stated "did not run" reason. */
  critique?: ForgeCritique;
  /** Tier-2 CLIP fidelity (0–1) of the generated mesh vs the input image. */
  fidelity?: number;
  /**
   * The server's VERDICT axis, deliberately orthogonal to `status`. A job can be
   * `completed` with `accepted: false` — the mesh is real and was handed over, it
   * just never cleared the Tier-1 gate. Carrying only `status` is what let that
   * render as a green "Complete".
   */
  accepted?: boolean;
  /**
   * The mesh was delivered with NOTHING having graded it — distinct from
   * `accepted: false`, which means a gate ran and rejected it. Both are "not a pass",
   * and only this tells the operator whether the problem is the mesh or the missing gate.
   */
  ungated?: boolean;
  /** Why the regeneration loop stopped — the reason behind `accepted: false`. */
  gateReason?: string;
  /** The asset-class budget this job was SUBMITTED with (undefined = class-blind). */
  assetClass?: string;
  /**
   * The server's own sentence naming what this mesh is graded against — the class budget
   * or the stated class-blind default. Read verbatim from the generate 202 (and refreshed
   * by the status poll) so the default is visible rather than assumed.
   */
  gradedAs?: string;
  /** Paid generations spent on this job (best-of-n retries each cost one). */
  attempts?: number;
  /** Set when the delivered container does not match the extension it was written to. */
  formatMismatch?: string;
  /** The provider's own render of the mesh (cloud Tripo only) — an image URL. */
  renderUrl?: string;
  /** Server-side path of the delivered mesh (may not be servable — see `meshPreview`). */
  meshPath?: string;
  /**
   * The Tier-0 INPUT gate's own sentence about the reference image this job was submitted
   * with, read verbatim from the generate 202. Present for every image-to-3d submit —
   * including when the gate could NOT run, which is the state that must never round to a
   * silent pass. A `fail` verdict never reaches here: the route refuses with it instead,
   * before any provider call, and the reason lands on `error`.
   */
  inputGateNote?: string;
  /** The delivery's next step, as the status poll projected it (see `remedyFor`). */
  remedy?: DeliveryRemedy;
  /** Where the $0 local finish this card offered stands — set only by `finishJob`. */
  finish?: ForgeFinishState;
  /**
   * The provider-side task this runner job paid for (cloud Tripo), kept from EVERY status
   * poll — so a job the server later forgets (a restart 404s it) still holds the handle
   * `recoverJob` re-collects for free.
   */
  providerTaskId?: string;
  /** The server's word on an errored job: may its paid task still deliver? */
  recoverable?: boolean;
  /** The forge 2D image this image-to-3d job was made from (its served name), recorded at
   *  submit and carried by `retryJob`. Client-side provenance: never sent in the request. */
  sourceImage?: string;
}

/**
 * The image-to-3D reference the Generate tab submits — in the store, not panel state, so a
 * forge tab switch (which unmounts the panel) cannot drop it. Memory-only. `image-2d` is a
 * 2D forge result staged by "Make 3D from this image" (`./referenceHandoff`); `upload` is a
 * file the operator picked. `subject` seeds the prompt builder.
 */
export interface ForgeReference {
  dataUrl: string;
  source: 'upload' | 'image-2d';
  sourceName: string;
  subject?: string;
}

/** GET /api/visual-gen/ue-import/status — requested collision, its basis, and what was OBSERVED. */
export interface UeImportStatus {
  status: 'running' | 'done' | 'error';
  glbPath: string;
  use: CollisionUse;
  assetPath?: string;
  collision: CollisionPlan | null;
  planBasis: CollisionPlanBasis | null;
  shells: number | null;
  /** Read back from `body_setup` — null means nothing counted it. */
  collisionElements: number | null;
  critiqueUnavailable?: boolean;
  critiqueError?: string;
  error?: string;
}

/** Exactly the previewed tuple a Send posts, into the delivery's own folder. */
export interface UeImportRequest {
  glbPath: string;
  use: CollisionUse;
  assetName: string;
  assetClass?: string;
  destPath: string;
}

/** The forge's one UE import — in the store so a tab switch (panel unmount) cannot lose it. */
export interface UeImportState {
  /** The tracked-poll id while the rail is following it; null once it ended or was stopped. */
  trackId: string | null;
  jobId: string | null;
  status: 'idle' | 'sending' | 'running' | 'done' | 'error';
  /** The last status the server answered — its collision count is the verdict. */
  result: UeImportStatus | null;
  error: string | null;
}

export const UE_IMPORT_IDLE: UeImportState = { trackId: null, jobId: null, status: 'idle', result: null, error: null };

/** The client's patience for a UE import, derived from the server's settle ceiling — never invented. */
export const UE_IMPORT_POLL_BUDGET_MS = 180_000 + UI_TIMEOUTS.experimentBudgetMargin;

interface ForgeState {
  jobs: GenerationJob[];
  activeProviderId: string;
  promptHistory: string[];
  /** Active project Style DNA profile (loaded/saved by StyleDnaPanel). */
  activeStyleDna: StyleDnaProfile | null;
  /** When true (default), the active style fragment is appended to generation prompts. */
  applyStyleDna: boolean;
  /** Local job ids whose background status poll is currently running. This is the
   *  OPERATOR-VISIBLE mirror of the module-level poller map: the poll deliberately
   *  outlives the forge module (see `./forgePoller`), so it must be
   *  visible and stoppable from the UI rather than being an invisible daemon. */
  activePolls: string[];
  /** The current (or last) Send to UE — see `startUeImport`. */
  ueImport: UeImportState;
  /** The staged image-to-3D reference, or null. */
  reference: ForgeReference | null;
  stageReference: (reference: ForgeReference) => void;
  clearReference: () => void;

  /** POST /api/visual-gen/ue-import, then follow its status on the tracked rail (listed in
   *  `activePolls`, stoppable, surviving the panel's unmount). One import at a time. */
  startUeImport: (request: UeImportRequest) => Promise<void>;
  /** Enqueue a `pending` job. ONLY for a caller that immediately drives it to a
   *  terminal state (`submitMcpJob` / `submitLocalJob` do). A `pending` job with no
   *  poller behind it is a phantom: no update, no error, no timeout, and a live
   *  elapsed clock for the rest of the session. */
  addJob: (job: Omit<GenerationJob, 'id' | 'status' | 'progress' | 'createdAt'>) => string;
  updateJob: (id: string, updates: Partial<GenerationJob>) => void;
  removeJob: (id: string) => void;
  /** Re-run a terminally-failed job through its original path (MCP / local-runner /
   *  placeholder), reusing the inputs already stored on the job. The old failed
   *  entry is dropped so the queue shows the fresh attempt, not a stale twin. */
  retryJob: (id: string) => void;
  clearCompleted: () => void;
  /** Explicit operator stop for ONE background poll. The remote generation may
   *  still be running on the provider — the job is marked failed with that stated
   *  in its error, never silently left in a forever-"generating" limbo. */
  stopPolling: (id: string) => void;
  /** Explicit operator stop for every background poll (the queue's "Stop" button). */
  stopAllPolling: () => void;
  setActiveProvider: (id: string) => void;
  addToHistory: (prompt: string) => void;
  setActiveStyleDnaProfile: (profile: StyleDnaProfile | null) => void;
  setApplyStyleDna: (apply: boolean) => void;
  submitMcpJob: (providerId: string, prompt: string, mode: GenerationMode) => Promise<void>;
  /** Re-adopt the paid Blender-MCP jobs the SERVER ledger still holds (GET
   *  /api/blender-mcp/generate/jobs) — after a reload the queue is empty but the provider
   *  jobs are not. Never submits: a job already in the queue is skipped (or, if nothing is
   *  polling it, adopted). Returns the ledger's `ownerEpoch` (null when unreadable) so the
   *  queue can state a server restart instead of reading an empty list as "nothing ran". */
  resumeMcpJobs: () => Promise<{ ownerEpoch: string | null }>;
  /** Re-poll a transport-failed MCP job's EXISTING provider job id — the paid generation
   *  may well have finished. Unlike `retryJob`, this never pays for a new generation.
   *  No-op for a job `mcpReattachable` refuses. */
  reattachJob: (id: string) => void;
  /** Explicit operator click on a `remedy.kind === 'finish'` card: POST the EXISTING $0
   *  critique -> mesh-finish route (basename + dir, never a path), then poll its status on
   *  the same tracked-poller rail as a generation. Never calls a generation route — the
   *  only paid path stays `retryJob`, which still runs on `failed` jobs only. */
  finishJob: (id: string) => Promise<void>;
  /** Explicit operator click on a `runnerRecoverable` card: POST the job's EXISTING provider
   *  task id to /api/visual-gen/generate/recover and poll the returned job on the same
   *  runner rail. Never calls /api/visual-gen/generate — recovery polls and downloads the
   *  task it already paid for; only `retryJob` buys a new one. */
  recoverJob: (id: string) => Promise<void>;
  /** Runner-backed generation: POST to /api/visual-gen/generate, then poll /status.
   *  Serves BOTH modes — image-to-3d (TripoSR / Hunyuan3D / Tripo3D, `imageDataUrl`)
   *  and text-to-3d (Tripo3D, `prompt`). The prompt used to be dropped here, which
   *  is why Tripo3D text-to-3d — fully implemented server-side — was unreachable
   *  from the UI.
   *
   *  `assetClass` is OPTIONAL and omitting it is legitimate: the route then grades
   *  class-blind and says so in the 202's `gradedAs`, which is stored on the job. It was
   *  never sent from the app at all until now, so class-aware grading — fully implemented
   *  server-side — was unreachable exactly the way text-to-3d had been.
   *
   *  `origin.sourceImage` names the 2D forge image the reference came from; it is stored
   *  on the job only, so the request body is the same for an upload and a staged image. */
  submitLocalJob: (
    providerId: string,
    mode: GenerationMode,
    imageDataUrl?: string,
    prompt?: string,
    assetClass?: string,
    origin?: { sourceImage?: string },
  ) => Promise<void>;
}

let jobCounter = 0;

/** Maps forge provider id to the MCP generation provider name. */
const MCP_PROVIDER_MAP: Record<string, McpProvider> = {
  rodin: 'hyper3d',
  hunyuan3d: 'hunyuan3d',
};

/** The forge provider id a ledger's MCP provider name came from (inverse of the map). */
function forgeProviderFor(mcp: unknown): string | undefined {
  return Object.keys(MCP_PROVIDER_MAP).find((id) => MCP_PROVIDER_MAP[id] === mcp);
}

/** The error a REMOTE failure writes — the one failure re-attaching cannot help. */
export const MCP_REMOTE_FAILED_ERROR = 'Generation failed on remote provider';

/** The MCP provider a job's `mcpJobId` belongs to, or undefined for a non-MCP job. Jobs
 *  queued before `mcpProvider` existed fall back to the provider's execution path. */
function mcpProviderOf(job: GenerationJob): McpProvider | undefined {
  if (job.mcpProvider) return job.mcpProvider;
  const provider = getProviderById(job.providerId);
  if (!provider || providerExecution(provider, job.mode).path !== 'mcp') return undefined;
  return MCP_PROVIDER_MAP[job.providerId];
}

/** A failed MCP job whose PAID provider job may still be alive: it has a provider job id,
 *  nothing is polling it, and the provider itself did not report the failure (a transport
 *  miss, an operator stop, the tracking deadline, or a failed import). */
export function mcpReattachable(job: GenerationJob): boolean {
  return job.status === 'failed'
    && !!job.mcpJobId
    && !!mcpProviderOf(job)
    && job.error !== MCP_REMOTE_FAILED_ERROR
    && !isTracked(job.id);
}

/**
 * Runner providers whose task lives PROVIDER-side and can be re-collected by id — the forge
 * mirror of the dispatch entries that carry `recover` (a test pins the two sets equal; the
 * server table is server-only, so it cannot be imported here).
 */
export const RECOVERABLE_RUNNER_PROVIDERS: readonly string[] = ['tripo3d'];

/** A failed runner job whose PAID provider task may still deliver: it holds the task id,
 *  the server did not report a terminal provider verdict, and nothing is polling it. */
export function runnerRecoverable(job: GenerationJob): boolean {
  return job.status === 'failed'
    && RECOVERABLE_RUNNER_PROVIDERS.includes(job.providerId)
    && !!job.providerTaskId
    && job.recoverable !== false
    && !isTracked(job.id);
}

/** The ledger row shape GET /api/blender-mcp/generate/jobs lists (read defensively). */
interface LedgerJobView {
  jobId?: unknown;
  provider?: unknown;
  prompt?: unknown;
  createdAt?: unknown;
}

/**
 * Every background poll rides ONE rail — `startTrackedPoll` in `./forgePoller`, which owns
 * the tracked registry (formerly `pollingIntervals` here) and the skeleton the three store
 * loops used to copy: no overlapping ticks, a stop that wins over a late response, and a
 * guarantee that the poll ENDS.
 *
 * DELIBERATE LIFETIME — READ BEFORE "FIXING": these polls live in a store action,
 * not a React effect, so neither `SuspendContext` nor the module LRU's unmount
 * reaches them. That is INTENTIONAL: a remote 3D generation runs for minutes and
 * is already paid for, so navigating to another module must not abandon it — and a
 * UE import boots the editor, so a forge tab switch must not lose its verdict. It ENDS on:
 *   1. terminal remote status (`completed` / `failed`) — the normal exit;
 *   2. `MAX_CONSECUTIVE_POLL_FAILURES` transport misses in a row;
 *   3. `FORGE_POLL_MAX_DURATION_MS` wall-clock deadline — the backstop for a
 *      remote job that never reaches a terminal status at all;
 *   plus an explicit operator stop (`stopPolling` / `stopAllPolling`).
 * Every running poll is mirrored into `activePolls` so the queue UI can show
 * that background work is still in flight and offer that stop.
 */

/**
 * Hard ceiling on how long ONE job may be polled (30 min). Provider generations
 * are minutes, not tens of minutes, so this only ever fires on a remote job that
 * is stuck — it cannot cut a healthy generation short. Exported so the test can
 * assert the poll terminates at exactly this deadline.
 */
export const FORGE_POLL_MAX_DURATION_MS = 30 * 60_000;

/** The tracked-poll id of a UE import — namespaced so it never collides with a queue card. */
const ueImportTrackId = (jobId: string) => `ue-import:${jobId}`;

export const useForgeStore = create<ForgeState>((set, get) => ({
  jobs: [],
  activeProviderId: getOfficialProvider().id,
  promptHistory: [],
  activeStyleDna: null,
  applyStyleDna: true,
  activePolls: [],
  ueImport: UE_IMPORT_IDLE,
  reference: null,

  stageReference: (reference) => set({ reference }),
  clearReference: () => set({ reference: null }),

  startUeImport: async (request) => {
    const { status, trackId } = get().ueImport;
    if (status === 'sending' || trackId !== null) return;
    set({ ueImport: { ...UE_IMPORT_IDLE, status: 'sending' } });
    const res = await tryApiFetch<{ jobId: string }>('/api/visual-gen/ue-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      set({ ueImport: { ...UE_IMPORT_IDLE, status: 'error', error: res.error } });
      return;
    }
    trackUeImport(res.data.jobId);
  },

  addJob: (jobData) => {
    const id = `forge-${Date.now()}-${++jobCounter}`;
    const job: GenerationJob = {
      ...jobData,
      id,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
    };
    set((s) => ({ jobs: [job, ...s.jobs] }));
    return id;
  },

  updateJob: (id, updates) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    })),

  removeJob: (id) => {
    // Stop any active polling for this job
    stopTracked(id);
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
  },

  retryJob: (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job || job.status !== 'failed') return;

    const provider = getProviderById(job.providerId);
    const exec = provider
      ? providerExecution(provider, job.mode)
      : { executable: false, reason: `Unknown provider "${job.providerId}".` };

    // Resolve the retry BEFORE dropping the stale entry. A retry that cannot run
    // must not re-queue a job nothing will ever update — the old fallback did
    // exactly that, minting a fresh `pending` twin for unwired providers.
    const rerun: (() => void) | null = (() => {
      if (!exec.executable) return null;
      // MCP-backed (Blender) providers. A disconnected bridge simply re-fails the
      // fresh job with the transport error — honest, not silently swallowed.
      if (exec.path === 'mcp') return () => void get().submitMcpJob(job.providerId, job.prompt, job.mode);
      // Runner-backed image-to-3D: the reference image was stored as a data URL on
      // the job, so the retry can reuse it verbatim. (A `blob:` URL cannot — it
      // belongs to a revoked object URL, not to bytes we can re-POST.)
      // The `assetClass` rides along too: a retry graded against a different budget than
      // the original submission would report a verdict about a job nobody asked for.
      if (job.mode === 'image-to-3d' && job.imageUrl?.startsWith('data:')) {
        // The 2D origin rides along too, so the fresh card still says where its image came from.
        const origin = job.sourceImage ? { sourceImage: job.sourceImage } : undefined;
        return () => void get().submitLocalJob(job.providerId, job.mode, job.imageUrl, job.prompt, job.assetClass, origin);
      }
      // Runner-backed text-to-3D: the prompt is the whole input.
      if (job.mode === 'text-to-3d' && job.prompt.trim()) {
        return () => void get().submitLocalJob(job.providerId, job.mode, undefined, job.prompt, job.assetClass);
      }
      return null;
    })();

    if (!rerun) {
      get().updateJob(id, {
        error: `${job.error ?? 'Generation failed.'} Retry unavailable: ${
          exec.reason ?? 'the original inputs are no longer available on this job.'
        }`,
      });
      return;
    }

    get().removeJob(id);
    rerun();
  },

  clearCompleted: () => {
    const { jobs } = get();
    // Stop polling for any completed/failed jobs being removed
    for (const job of jobs) {
      if (job.status === 'completed' || job.status === 'failed') stopTracked(job.id);
    }
    set((s) => ({
      jobs: s.jobs.filter((j) => j.status !== 'completed' && j.status !== 'failed'),
    }));
  },

  stopPolling: (id) => {
    if (!stopTracked(id)) return;
    if (id === get().ueImport.trackId) {
      // Stop ends the POLL only: the editor boot is already under way and may still land.
      set((s) => ({
        ueImport: { ...s.ueImport, trackId: null, error: 'Tracking stopped by operator — the editor import may still be running.' },
      }));
      return;
    }
    const job = get().jobs.find((j) => j.id === id);
    // A stopped poll must not leave the job reading as still-in-progress: state
    // the truth — tracking ended here, the provider may still be working.
    if (job && job.status !== 'completed' && job.status !== 'failed') {
      get().updateJob(id, {
        status: 'failed',
        error: 'Tracking stopped by operator — the remote generation may still be running.',
        completedAt: Date.now(),
      });
    } else if (job?.finish?.state === 'running') {
      // A stopped FINISH poll: the delivered mesh is untouched, the Blender run may not be.
      get().updateJob(id, {
        finish: { state: 'failed', error: 'Tracking stopped by operator — the Blender finish may still be running.' },
      });
    }
  },

  stopAllPolling: () => {
    for (const id of [...get().activePolls]) get().stopPolling(id);
  },

  setActiveProvider: (id) => set({ activeProviderId: id }),

  setActiveStyleDnaProfile: (profile) => set({ activeStyleDna: profile }),

  setApplyStyleDna: (apply) => set({ applyStyleDna: apply }),

  addToHistory: (prompt) =>
    set((s) => ({
      promptHistory: [prompt, ...s.promptHistory.filter((p) => p !== prompt)].slice(0, 50),
    })),

  submitMcpJob: async (providerId, prompt, mode) => {
    const mcpProvider = MCP_PROVIDER_MAP[providerId];
    if (!mcpProvider) {
      logger.warn(`[forge] No MCP provider mapping for ${providerId}`);
      return;
    }

    // Add the job to the store
    const localId = get().addJob({
      mode,
      prompt,
      providerId,
    });

    // Submit to the generate endpoint
    const submitResult = await tryApiFetch<JobResult>('/api/blender-mcp/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: mcpProvider, prompt }),
    });

    if (!submitResult.ok) {
      get().updateJob(localId, { status: 'failed', error: submitResult.error });
      return;
    }

    const { jobId: mcpJobId } = submitResult.data;

    get().updateJob(localId, {
      status: 'generating',
      mcpJobId,
      mcpProvider,
    });

    // Save prompt to history
    if (prompt.trim()) {
      get().addToHistory(prompt.trim());
    }

    trackMcpJob(localId, mcpJobId, mcpProvider);
  },

  resumeMcpJobs: async () => {
    const res = await tryApiFetch<{ jobs?: unknown; ownerEpoch?: unknown }>('/api/blender-mcp/generate/jobs');
    if (!res.ok || !Array.isArray(res.data?.jobs)) return { ownerEpoch: null };
    const ownerEpoch = typeof res.data.ownerEpoch === 'string' ? res.data.ownerEpoch : null;

    // Everything below is synchronous after the one await, so two concurrent resumes
    // cannot both miss a job the other just added.
    for (const row of res.data.jobs as LedgerJobView[]) {
      if (!row || typeof row.jobId !== 'string') continue;
      const providerId = forgeProviderFor(row.provider);
      if (!providerId) continue;
      const mcpJobId = row.jobId;
      const mcpProvider = row.provider as McpProvider;

      const held = get().jobs.find((j) => j.mcpJobId === mcpJobId);
      if (held) {
        // Already queued. Adopt it only if it is in flight with nothing polling it.
        const inFlight = held.status === 'pending' || held.status === 'generating';
        if (inFlight && !isTracked(held.id)) trackMcpJob(held.id, mcpJobId, mcpProvider);
        continue;
      }

      const job: GenerationJob = {
        id: `forge-${Date.now()}-${++jobCounter}`,
        // The MCP submit carries only a prompt, so every ledger job is text-to-3d.
        mode: 'text-to-3d',
        prompt: typeof row.prompt === 'string' ? row.prompt : '',
        providerId,
        status: 'generating',
        progress: 0,
        // The SERVER's submit time, so the elapsed clock tells the truth after a reload.
        createdAt: typeof row.createdAt === 'number' ? row.createdAt : Date.now(),
        mcpJobId,
        mcpProvider,
      };
      set((s) => ({ jobs: [job, ...s.jobs] }));
      trackMcpJob(job.id, mcpJobId, mcpProvider);
    }
    return { ownerEpoch };
  },

  reattachJob: (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job || !mcpReattachable(job)) return;
    const mcpProvider = mcpProviderOf(job)!;
    get().updateJob(id, { status: 'generating', mcpProvider, error: undefined, completedAt: undefined });
    trackMcpJob(id, job.mcpJobId!, mcpProvider);
  },

  finishJob: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job || job.status !== 'completed' || job.remedy?.kind !== 'finish') return;
    // One finish at a time per card, and never on top of a live poll.
    if (job.finish?.state === 'running' || isTracked(id)) return;
    const { name, dir } = job.remedy;
    get().updateJob(id, { finish: { state: 'running' } });

    const res = await tryApiFetch<{ routed?: boolean; jobId?: string; reason?: string; note?: string }>(
      '/api/visual-gen/mesh-finish/remediate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, dir, assetClass: job.assetClass }),
      },
    );
    // The card was removed while the POST was in flight: nothing is left to report to,
    // so no orphan poll is started (the routed run itself is local and $0).
    if (!get().jobs.some((j) => j.id === id)) return;
    if (!res.ok) {
      get().updateJob(id, { finish: { state: 'failed', error: res.error } });
      return;
    }
    if (!res.data.routed || !res.data.jobId) {
      get().updateJob(id, { finish: { state: 'refused', reason: res.data.reason ?? 'the finish route declined without a reason' } });
      return;
    }
    get().updateJob(id, { finish: { state: 'running', note: res.data.note } });
    trackFinishJob(id, res.data.jobId);
  },

  recoverJob: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job || !runnerRecoverable(job)) return;
    const taskId = job.providerTaskId!;
    // Leave `failed` BEFORE the await, so a second click cannot start a second recovery.
    get().updateJob(id, { status: 'generating', progress: 0, error: undefined, recoverable: undefined, completedAt: undefined });
    const res = await tryApiFetch<{ jobId: string; gradedAs?: string }>('/api/visual-gen/generate/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: job.providerId, taskId, assetClass: job.assetClass }),
    });
    if (!get().jobs.some((j) => j.id === id)) return;
    if (!res.ok) {
      get().updateJob(id, {
        status: 'failed',
        error: `Recover failed: ${res.error} (task ${taskId} was not paid for again)`,
        completedAt: Date.now(),
      });
      return;
    }
    get().updateJob(id, {
      mcpJobId: res.data.jobId,
      ...(res.data.gradedAs !== undefined ? { gradedAs: res.data.gradedAs } : {}),
    });
    trackRunnerJob(id, res.data.jobId);
  },

  submitLocalJob: async (providerId, mode, imageDataUrl, prompt, assetClass, origin) => {
    const localId = get().addJob({
      mode, prompt: prompt ?? '', providerId, imageUrl: imageDataUrl, assetClass,
      ...(origin?.sourceImage ? { sourceImage: origin.sourceImage } : {}),
    });

    const submit = await tryApiFetch<{
      jobId: string;
      gradedAs?: string;
      /** Tier-0 input-gate outcome (image-to-3d only) — see `inputGateNote`. */
      inputGate?: { note: string };
    }>('/api/visual-gen/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `prompt` is what makes text-to-3d reach the real route (the handler refuses
      // a text-to-3d submit without one) — it was never sent before. `assetClass` is
      // the same shape of gap: the route has graded class-aware since wave 12 and this
      // body never carried the class, so every app-submitted mesh was graded class-blind.
      body: JSON.stringify({ mode, providerId, imageDataUrl, prompt, assetClass }),
    });
    if (!submit.ok) {
      get().updateJob(localId, { status: 'failed', error: submit.error, completedAt: Date.now() });
      return;
    }
    const { jobId, gradedAs, inputGate } = submit.data;
    // `gradedAs` is the server's own sentence about the budget in force — stored at
    // SUBMIT time so the class-blind default is visible before any poll returns.
    // `inputGate.note` is the same discipline for the Tier-0 INPUT gate: a submit whose
    // image nothing could check says so here rather than reading as a checked one. (A
    // refusal never gets this far — it arrives as `!submit.ok` above, with its reasons.)
    get().updateJob(localId, { status: 'generating', mcpJobId: jobId, gradedAs, inputGateNote: inputGate?.note });
    if (prompt?.trim()) get().addToHistory(prompt.trim());

    trackRunnerJob(localId, jobId);
  },
}));

/** Mirror the rail's tracked set into the operator-visible `activePolls`. */
onTrackedChange((id, on) => {
  useForgeStore.setState((s) => {
    if (on) return s.activePolls.includes(id) ? s : { activePolls: [...s.activePolls, id] };
    return s.activePolls.includes(id) ? { activePolls: s.activePolls.filter((p) => p !== id) } : s;
  });
});

/** The rail's settings every generation/finish poll shares. */
const FORGE_RAIL = { deadlineMs: FORGE_POLL_MAX_DURATION_MS, intervalMs: UI_TIMEOUTS.blenderGenPollInterval } as const;

/**
 * The status poll for ONE runner job (`/api/visual-gen/generate/status`), bound to one queue
 * card — shared by `submitLocalJob` and `recoverJob`. Every poll keeps the provider task id,
 * so even a job that then 404s (server restart) stays recoverable.
 */
function trackRunnerJob(localId: string, jobId: string): void {
  const get = useForgeStore.getState;
  // Kept from EVERY poll: once Tripo accepts the task the handle is here, so a later
  // 404 (server restart) or give-up still leaves a card that can recover it for free.
  const keepTaskId = ({ providerTaskId }: ForgeStatusResponse) => {
    if (providerTaskId && get().jobs.find((j) => j.id === localId)?.providerTaskId !== providerTaskId) {
      get().updateJob(localId, { providerTaskId });
    }
  };
  startTrackedPoll<ForgeStatusResponse>({
    id: localId,
    ...FORGE_RAIL,
    // The client type IS the route's projection (`ForgeStatusResponse`), so the
    // honesty signals the server computes cannot be silently dropped here again.
    fetchStatus: () => tryApiFetch<ForgeStatusResponse>(`/api/visual-gen/generate/status?jobId=${encodeURIComponent(jobId)}`),
    isTerminal: (d) => d.status === 'done' || d.status === 'error',
    onTick: keepTaskId,
    onTerminal: (d) => {
      keepTaskId(d);
      if (d.status === 'error') {
        // `recoverable` is the server's verdict on the paid task: absent means "no".
        get().updateJob(localId, {
          status: 'failed', error: d.error ?? 'generation failed', recoverable: d.recoverable === true, completedAt: Date.now(),
        });
        return;
      }
      // `done` is a TRANSPORT outcome. `accepted`/`ungated`/`gateReason` are the verdict, and
      // all of them ride onto the job so the card can tell apart a mesh a gate rejected from
      // one nothing ever measured.
      const { meshPath, critique, fidelity, accepted, ungated, gateReason, attempts, formatMismatch, renderUrl, remedy } = d;
      get().updateJob(localId, {
        status: 'completed', progress: 100, resultUrl: meshPath, meshPath,
        critique, fidelity, accepted, ungated, gateReason, attempts, formatMismatch, renderUrl, remedy,
        // Refreshed from the store's own record; falls back to the 202's sentence
        // rather than blanking a line the operator has already read.
        ...(d.gradedAs !== undefined ? { gradedAs: d.gradedAs } : {}),
        completedAt: Date.now(),
      });
    },
    onGiveUp: (g) => get().updateJob(localId, {
      status: 'failed',
      error: g.reason === 'deadline' ? `${g.message} without a terminal status from the local runner.` : g.message,
      completedAt: Date.now(),
    }),
  });
}

/**
 * The MCP status poll for ONE provider job, bound to one local queue entry — shared by
 * `submitMcpJob`, a re-adopted job (`resumeMcpJobs`) and a re-attached one (`reattachJob`):
 * same terminal conditions, same auto-import (which the import route makes idempotent).
 */
function trackMcpJob(localId: string, mcpJobId: string, mcpProvider: McpProvider): void {
  const get = useForgeStore.getState;
  startTrackedPoll<JobStatusResult & ForgeGateProjection>({
    id: localId,
    ...FORGE_RAIL,
    // The MCP status route projects the SAME verdict axis as the runner route, so an MCP
    // delivery can never arrive here as a bare status and render as a passed gate.
    fetchStatus: () => tryApiFetch<JobStatusResult & ForgeGateProjection>(
      `/api/blender-mcp/generate/status?jobId=${encodeURIComponent(mcpJobId)}&provider=${encodeURIComponent(mcpProvider)}`,
    ),
    isTerminal: (d) => d.status === 'completed' || d.status === 'failed',
    onTick: (d) => get().updateJob(localId, { progress: d.progress }),
    onTerminal: async ({ status, resultUrl, accepted, ungated, gateReason }) => {
      if (status === 'failed') {
        get().updateJob(localId, { status: 'failed', error: MCP_REMOTE_FAILED_ERROR, completedAt: Date.now() });
        return;
      }
      // The poll is already stopped, so none fires during the long import await.
      get().updateJob(localId, { status: 'importing', progress: 100, resultUrl });
      const importResult = await tryApiFetch<ImportedObject>('/api/blender-mcp/generate/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: mcpJobId, provider: mcpProvider }),
      });
      get().updateJob(localId, importResult.ok
        // The server's verdict rides onto the job exactly as for a runner job, so ONE card
        // code path serves both: "delivered, ungated, and here is why nothing measured it".
        ? { status: 'completed', accepted, ungated, gateReason, completedAt: Date.now() }
        : { status: 'failed', error: `Import failed: ${importResult.error}`, completedAt: Date.now() });
    },
    onGiveUp: (g) => get().updateJob(localId, {
      status: 'failed',
      error: g.reason === 'deadline' ? `${g.message} without a terminal status from the provider.` : g.message,
      completedAt: Date.now(),
    }),
  });
}

/** What GET /api/visual-gen/mesh-finish/status returns (the fields the card reads). */
interface FinishStatusView {
  status?: string;
  meshPath?: string;
  error?: string;
  remediation?: { improved?: boolean; summary?: string };
}

/**
 * The poll for ONE routed mesh-finish job, bound to the queue card that asked for it,
 * registered under the card's id so the queue's "Stop tracking" reaches it. It only ever
 * GETs the finish status.
 */
function trackFinishJob(localId: string, finishJobId: string): void {
  const end = (finish: ForgeFinishState) => useForgeStore.getState().updateJob(localId, { finish });
  startTrackedPoll<FinishStatusView>({
    id: localId,
    ...FORGE_RAIL,
    fetchStatus: () => tryApiFetch<FinishStatusView>(`/api/visual-gen/mesh-finish/status?jobId=${encodeURIComponent(finishJobId)}`),
    isTerminal: (d) => d.status === 'done' || d.status === 'error',
    onTerminal: ({ status, meshPath, error, remediation }) => end(status === 'done'
      ? {
        state: 'done',
        // The strict before -> after line; absent only if the job was not routed, which
        // this path never starts — so its absence is stated, not papered over.
        summary: remediation?.summary ?? 'finished, but no before -> after re-grade was reported',
        improved: remediation?.improved === true,
        meshPath,
      }
      : { state: 'failed', error: error ?? 'the Blender finish failed' }),
    onGiveUp: (g) => end({
      state: 'failed',
      error: g.reason === 'deadline'
        ? `Gave up tracking the finish after ${g.minutes} min without a terminal status.`
        : `Finish status polling failed ${g.misses} times in a row: ${g.lastError}`,
    }),
  });
}

/**
 * The UE import's poll (`/api/visual-gen/ue-import/status`) — on the same rail, so it is
 * listed in `activePolls`, forgives transport misses, and outlives the panel (a forge tab
 * switch unmounts it). Its deadline is the panel's derived budget, never a new clock.
 */
function trackUeImport(jobId: string): void {
  const set = useForgeStore.setState;
  const trackId = ueImportTrackId(jobId);
  // Only the import that is still current may write — a newer Send owns the slice.
  const settle = (patch: Partial<UeImportState>) => set((s) =>
    s.ueImport.trackId === trackId ? { ueImport: { ...s.ueImport, trackId: null, ...patch } } : s);
  set({ ueImport: { trackId, jobId, status: 'running', result: null, error: null } });
  startTrackedPoll<UeImportStatus>({
    id: trackId,
    deadlineMs: UE_IMPORT_POLL_BUDGET_MS,
    intervalMs: UI_TIMEOUTS.experimentPoll,
    fetchStatus: () => tryApiFetch<UeImportStatus>(`/api/visual-gen/ue-import/status?jobId=${encodeURIComponent(jobId)}`),
    isTerminal: (d) => d.status !== 'running',
    onTick: (d) => set((s) => (s.ueImport.trackId === trackId ? { ueImport: { ...s.ueImport, result: d } } : s)),
    onTerminal: (d) => settle({ status: d.status, result: d }),
    onGiveUp: (g) => settle({
      error: g.reason === 'deadline'
        ? 'gave up polling — the editor is still running past the budget; the job may still finish'
        : g.message,
    }),
  });
}
