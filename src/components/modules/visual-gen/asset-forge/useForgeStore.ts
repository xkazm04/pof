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
import type { CritiqueCard } from '@/lib/visual-gen/mesh-critique';

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
  /** Tier-1 quality-gate scorecard (local subprocess providers, e.g. TripoSR). */
  critique?: CritiqueCard;
  /** Tier-2 CLIP fidelity (0–1) of the generated mesh vs the input image. */
  fidelity?: number;
}

interface ForgeState {
  jobs: GenerationJob[];
  activeProviderId: string;
  promptHistory: string[];

  addJob: (job: Omit<GenerationJob, 'id' | 'status' | 'progress' | 'createdAt'>) => string;
  updateJob: (id: string, updates: Partial<GenerationJob>) => void;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
  setActiveProvider: (id: string) => void;
  addToHistory: (prompt: string) => void;
  submitMcpJob: (providerId: string, prompt: string, mode: GenerationMode) => Promise<void>;
  /** Local-subprocess generation (e.g. TripoSR image-to-3d): POST the image to
   *  /api/visual-gen/generate, then poll /status. The runner-backed counterpart to
   *  submitMcpJob. */
  submitLocalJob: (providerId: string, mode: GenerationMode, imageDataUrl: string) => Promise<void>;
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
 */
interface Poller {
  stop: () => void;
}
const pollingIntervals = new Map<string, Poller>();

export const useForgeStore = create<ForgeState>((set, get) => ({
  jobs: [],
  activeProviderId: 'triposr',
  promptHistory: [],

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
      pollingIntervals.delete(id);
    }
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
  },

  clearCompleted: () => {
    const { jobs } = get();
    // Stop polling for any completed/failed jobs being removed
    for (const job of jobs) {
      if (job.status === 'completed' || job.status === 'failed') {
        const poller = pollingIntervals.get(job.id);
        if (poller) {
          poller.stop();
          pollingIntervals.delete(job.id);
        }
      }
    }
    set((s) => ({
      jobs: s.jobs.filter((j) => j.status !== 'completed' && j.status !== 'failed'),
    }));
  },

  setActiveProvider: (id) => set({ activeProviderId: id }),

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
        pollingIntervals.delete(localId);
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
        pollingIntervals.delete(localId);

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
        pollingIntervals.delete(localId);
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

    pollingIntervals.set(localId, { stop });
    scheduleNext();
  },

  submitLocalJob: async (providerId, mode, imageDataUrl) => {
    const localId = get().addJob({ mode, prompt: '', providerId, imageUrl: imageDataUrl });

    const submit = await tryApiFetch<{ jobId: string }>('/api/visual-gen/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, providerId, imageDataUrl }),
    });
    if (!submit.ok) {
      get().updateJob(localId, { status: 'failed', error: submit.error, completedAt: Date.now() });
      return;
    }
    const { jobId } = submit.data;
    get().updateJob(localId, { status: 'generating', mcpJobId: jobId });

    // Self-scheduling poll loop (same discipline as submitMcpJob: no overlapping
    // ticks, `stopped` guards every post-await branch).
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => { stopped = true; if (timer !== null) { clearTimeout(timer); timer = null; } };
    const scheduleNext = () => { if (!stopped) timer = setTimeout(tick, UI_TIMEOUTS.blenderGenPollInterval); };

    async function tick() {
      timer = null;
      if (stopped) return;
      const res = await tryApiFetch<{ status: string; meshPath?: string; error?: string; critique?: CritiqueCard; fidelity?: number }>(
        `/api/visual-gen/generate/status?jobId=${encodeURIComponent(jobId)}`,
      );
      if (stopped) return;
      if (!res.ok) { scheduleNext(); return; } // transient transport miss — keep polling
      const { status, meshPath, error, critique, fidelity } = res.data;
      if (status === 'done') {
        stop();
        pollingIntervals.delete(localId);
        get().updateJob(localId, { status: 'completed', progress: 100, resultUrl: meshPath, critique, fidelity, completedAt: Date.now() });
        return;
      }
      if (status === 'error') {
        stop();
        pollingIntervals.delete(localId);
        get().updateJob(localId, { status: 'failed', error: error ?? 'generation failed', completedAt: Date.now() });
        return;
      }
      scheduleNext();
    }
    pollingIntervals.set(localId, { stop });
    scheduleNext();
  },
}));
