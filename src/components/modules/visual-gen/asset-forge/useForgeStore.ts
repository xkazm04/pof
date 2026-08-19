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
import type { ForgeCritique, ForgeStatusResponse } from './forgeJobStatus';
import type { StyleDnaProfile } from '@/lib/visual-gen/style-dna-db';
import { getOfficialProvider, getProviderById, providerExecution } from '@/lib/visual-gen/providers';

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
  /** Why the regeneration loop stopped — the reason behind `accepted: false`. */
  gateReason?: string;
  /** Paid generations spent on this job (best-of-n retries each cost one). */
  attempts?: number;
  /** Set when the delivered container does not match the extension it was written to. */
  formatMismatch?: string;
  /** The provider's own render of the mesh (cloud Tripo only) — an image URL. */
  renderUrl?: string;
  /** Server-side path of the delivered mesh (may not be servable — see `meshPreview`). */
  meshPath?: string;
}

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
   *  outlives the forge module (see `pollingIntervals` below), so it must be
   *  visible and stoppable from the UI rather than being an invisible daemon. */
  activePolls: string[];

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
  /** Runner-backed generation: POST to /api/visual-gen/generate, then poll /status.
   *  Serves BOTH modes — image-to-3d (TripoSR / Hunyuan3D / Tripo3D, `imageDataUrl`)
   *  and text-to-3d (Tripo3D, `prompt`). The prompt used to be dropped here, which
   *  is why Tripo3D text-to-3d — fully implemented server-side — was unreachable
   *  from the UI. */
  submitLocalJob: (
    providerId: string,
    mode: GenerationMode,
    imageDataUrl?: string,
    prompt?: string,
  ) => Promise<void>;
}

let jobCounter = 0;

/** Maps forge provider id to the MCP generation provider name. */
const MCP_PROVIDER_MAP: Record<string, McpProvider> = {
  rodin: 'hyper3d',
  hunyuan3d: 'hunyuan3d',
};

/**
 * Track active pollers so they can be cancelled. A poller is a self-scheduling
 * `setTimeout` recursion (NOT a `setInterval`): the next tick is only scheduled
 * after the current async body settles, so polls can never overlap. `stop()`
 * sets `stopped` (so any in-flight body bails before mutating state) and clears
 * the pending timeout (so no further tick fires).
 *
 * DELIBERATE LIFETIME — READ BEFORE "FIXING": these polls live in a store action,
 * not a React effect, so neither `SuspendContext` nor the module LRU's unmount
 * reaches them. That is INTENTIONAL: a remote 3D generation runs for minutes and
 * is already paid for, so navigating to another module must not abandon it. What
 * was missing — and what the three mechanisms below supply — is a guarantee that
 * it ENDS:
 *   1. terminal remote status (`completed` / `failed`) — the normal exit;
 *   2. `MAX_CONSECUTIVE_POLL_FAILURES` transport misses in a row;
 *   3. `FORGE_POLL_MAX_DURATION_MS` wall-clock deadline — the backstop for a
 *      remote job that never reaches a terminal status at all;
 *   plus an explicit operator stop (`stopPolling` / `stopAllPolling`).
 * Every running poll is mirrored into `activePolls` so the queue UI can show
 * that background work is still in flight and offer that stop.
 */
interface Poller {
  stop: () => void;
}
const pollingIntervals = new Map<string, Poller>();

/**
 * Hard ceiling on how long ONE job may be polled (30 min). Provider generations
 * are minutes, not tens of minutes, so this only ever fires on a remote job that
 * is stuck — it cannot cut a healthy generation short. Exported so the test can
 * assert the poll terminates at exactly this deadline.
 */
export const FORGE_POLL_MAX_DURATION_MS = 30 * 60_000;

/** Register a running poll: cancellable via the map, visible via `activePolls`. */
function trackPoller(id: string, stop: () => void): void {
  pollingIntervals.set(id, { stop });
  useForgeStore.setState((s) =>
    s.activePolls.includes(id) ? s : { activePolls: [...s.activePolls, id] },
  );
}

/** De-register a finished/stopped poll. Safe to call for an id that isn't tracked. */
function untrackPoller(id: string): void {
  pollingIntervals.delete(id);
  useForgeStore.setState((s) =>
    s.activePolls.includes(id) ? { activePolls: s.activePolls.filter((p) => p !== id) } : s,
  );
}

export const useForgeStore = create<ForgeState>((set, get) => ({
  jobs: [],
  activeProviderId: getOfficialProvider().id,
  promptHistory: [],
  activeStyleDna: null,
  applyStyleDna: true,
  activePolls: [],

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
    const poller = pollingIntervals.get(id);
    if (poller) {
      poller.stop();
      untrackPoller(id);
    }
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
      if (job.mode === 'image-to-3d' && job.imageUrl?.startsWith('data:')) {
        return () => void get().submitLocalJob(job.providerId, job.mode, job.imageUrl, job.prompt);
      }
      // Runner-backed text-to-3D: the prompt is the whole input.
      if (job.mode === 'text-to-3d' && job.prompt.trim()) {
        return () => void get().submitLocalJob(job.providerId, job.mode, undefined, job.prompt);
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
      if (job.status === 'completed' || job.status === 'failed') {
        const poller = pollingIntervals.get(job.id);
        if (poller) {
          poller.stop();
          untrackPoller(job.id);
        }
      }
    }
    set((s) => ({
      jobs: s.jobs.filter((j) => j.status !== 'completed' && j.status !== 'failed'),
    }));
  },

  stopPolling: (id) => {
    const poller = pollingIntervals.get(id);
    if (!poller) return;
    poller.stop();
    untrackPoller(id);
    const job = get().jobs.find((j) => j.id === id);
    // A stopped poll must not leave the job reading as still-in-progress: state
    // the truth — tracking ended here, the provider may still be working.
    if (job && job.status !== 'completed' && job.status !== 'failed') {
      get().updateJob(id, {
        status: 'failed',
        error: 'Tracking stopped by operator — the remote generation may still be running.',
        completedAt: Date.now(),
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
    });

    // Save prompt to history
    if (prompt.trim()) {
      get().addToHistory(prompt.trim());
    }

    // Start polling for status. A poll miss is a TRANSPORT failure (dev-server
    // restart, Wi-Fi blip, one 502) — the multi-minute remote generation is
    // still running and already paid for. Only consecutive misses, or an
    // explicit remote 'failed', terminate the job.
    const MAX_CONSECUTIVE_POLL_FAILURES = 3;
    let pollFailures = 0;

    // Self-scheduling poll loop. We use a recursive `setTimeout` rather than a
    // `setInterval` with an async body so that the next tick is only scheduled
    // AFTER the current poll (and its trailing awaits) settle — overlapping
    // in-flight polls for the same job are therefore impossible. `stopped`
    // guards every post-await branch so a late-resolving body can't mutate a job
    // that has already finished or been torn down (prevents the importing →
    // generating state-flip race), and `timer` is nulled/cleared on stop.
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pollStartedAt = Date.now();

    const stop = () => {
      stopped = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleNext = () => {
      if (stopped) return;
      timer = setTimeout(tick, UI_TIMEOUTS.blenderGenPollInterval);
    };

    async function tick() {
      // The timeout has fired; this poll is now the only in-flight tick.
      timer = null;
      if (stopped) return;

      // Terminal condition 3: wall-clock deadline. A remote job that never
      // reaches `completed`/`failed` would otherwise be polled forever.
      if (Date.now() - pollStartedAt >= FORGE_POLL_MAX_DURATION_MS) {
        stop();
        untrackPoller(localId);
        get().updateJob(localId, {
          status: 'failed',
          error: `Gave up tracking after ${Math.round(FORGE_POLL_MAX_DURATION_MS / 60_000)} min without a terminal status from the provider.`,
          completedAt: Date.now(),
        });
        return;
      }

      const statusResult = await tryApiFetch<JobStatusResult>(
        `/api/blender-mcp/generate/status?jobId=${encodeURIComponent(mcpJobId)}&provider=${encodeURIComponent(mcpProvider)}`,
      );
      if (stopped) return;

      if (!statusResult.ok) {
        pollFailures++;
        if (pollFailures < MAX_CONSECUTIVE_POLL_FAILURES) {
          scheduleNext(); // transient — keep polling
          return;
        }
        stop();
        untrackPoller(localId);
        get().updateJob(localId, {
          status: 'failed',
          error: `Status polling failed ${pollFailures} times in a row: ${statusResult.error}`,
          completedAt: Date.now(),
        });
        return;
      }
      pollFailures = 0;

      const { status, progress, resultUrl } = statusResult.data;

      if (status === 'completed') {
        // Stop scheduling BEFORE the long /import await so no poll fires during
        // import; `stopped` is now set, so any race that re-enters this body
        // bails immediately.
        stop();
        untrackPoller(localId);

        // Auto-import into Blender
        get().updateJob(localId, {
          status: 'importing',
          progress: 100,
          resultUrl,
        });

        const importResult = await tryApiFetch<ImportedObject>(
          '/api/blender-mcp/generate/import',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: mcpJobId, provider: mcpProvider }),
          },
        );

        if (importResult.ok) {
          get().updateJob(localId, {
            status: 'completed',
            completedAt: Date.now(),
          });
        } else {
          get().updateJob(localId, {
            status: 'failed',
            error: `Import failed: ${importResult.error}`,
            completedAt: Date.now(),
          });
        }
        return;
      }

      if (status === 'failed') {
        stop();
        untrackPoller(localId);
        get().updateJob(localId, {
          status: 'failed',
          error: 'Generation failed on remote provider',
          completedAt: Date.now(),
        });
        return;
      }

      // Still processing — update progress, then schedule the next poll.
      get().updateJob(localId, { progress });
      scheduleNext();
    }

    trackPoller(localId, stop);
    scheduleNext();
  },

  submitLocalJob: async (providerId, mode, imageDataUrl, prompt) => {
    const localId = get().addJob({ mode, prompt: prompt ?? '', providerId, imageUrl: imageDataUrl });

    const submit = await tryApiFetch<{ jobId: string }>('/api/visual-gen/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `prompt` is what makes text-to-3d reach the real route (the handler refuses
      // a text-to-3d submit without one) — it was never sent before.
      body: JSON.stringify({ mode, providerId, imageDataUrl, prompt }),
    });
    if (!submit.ok) {
      get().updateJob(localId, { status: 'failed', error: submit.error, completedAt: Date.now() });
      return;
    }
    const { jobId } = submit.data;
    get().updateJob(localId, { status: 'generating', mcpJobId: jobId });
    if (prompt?.trim()) get().addToHistory(prompt.trim());

    // Self-scheduling poll loop (same discipline as submitMcpJob: no overlapping
    // ticks, `stopped` guards every post-await branch). A poll miss is a TRANSPORT
    // failure — keep retrying — but cap consecutive misses so a persistent status
    // endpoint outage fails the job cleanly instead of retrying forever.
    const MAX_CONSECUTIVE_POLL_FAILURES = 3;
    let pollFailures = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pollStartedAt = Date.now();
    const stop = () => { stopped = true; if (timer !== null) { clearTimeout(timer); timer = null; } };
    const scheduleNext = () => { if (!stopped) timer = setTimeout(tick, UI_TIMEOUTS.blenderGenPollInterval); };

    async function tick() {
      timer = null;
      if (stopped) return;
      // Terminal condition 3: wall-clock deadline (see the poller doc block).
      if (Date.now() - pollStartedAt >= FORGE_POLL_MAX_DURATION_MS) {
        stop();
        untrackPoller(localId);
        get().updateJob(localId, {
          status: 'failed',
          error: `Gave up tracking after ${Math.round(FORGE_POLL_MAX_DURATION_MS / 60_000)} min without a terminal status from the local runner.`,
          completedAt: Date.now(),
        });
        return;
      }
      // The client type IS the route's projection (`ForgeStatusResponse`), so the
      // honesty signals the server computes cannot be silently dropped here again.
      const res = await tryApiFetch<ForgeStatusResponse>(
        `/api/visual-gen/generate/status?jobId=${encodeURIComponent(jobId)}`,
      );
      if (stopped) return;
      if (!res.ok) {
        pollFailures++;
        if (pollFailures < MAX_CONSECUTIVE_POLL_FAILURES) {
          scheduleNext(); // transient transport miss — keep polling
          return;
        }
        stop();
        untrackPoller(localId);
        get().updateJob(localId, {
          status: 'failed',
          error: `Status polling failed ${pollFailures} times in a row: ${res.error}`,
          completedAt: Date.now(),
        });
        return;
      }
      pollFailures = 0;
      const {
        status, meshPath, error, critique, fidelity,
        accepted, gateReason, attempts, formatMismatch, renderUrl,
      } = res.data;
      if (status === 'done') {
        stop();
        untrackPoller(localId);
        // `done` is a TRANSPORT outcome. `accepted`/`gateReason` are the verdict,
        // and both ride onto the job so the card can tell them apart.
        get().updateJob(localId, {
          status: 'completed', progress: 100, resultUrl: meshPath, meshPath,
          critique, fidelity, accepted, gateReason, attempts, formatMismatch, renderUrl,
          completedAt: Date.now(),
        });
        return;
      }
      if (status === 'error') {
        stop();
        untrackPoller(localId);
        get().updateJob(localId, { status: 'failed', error: error ?? 'generation failed', completedAt: Date.now() });
        return;
      }
      scheduleNext();
    }
    trackPoller(localId, stop);
    scheduleNext();
  },
}));
