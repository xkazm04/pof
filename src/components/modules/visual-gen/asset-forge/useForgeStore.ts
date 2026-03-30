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
}

let jobCounter = 0;

/** Maps forge provider id to the MCP generation provider name. */
const MCP_PROVIDER_MAP: Record<string, McpProvider> = {
  rodin: 'hyper3d',
  hunyuan3d: 'hunyuan3d',
};

/** Track active polling intervals so they can be cleared. */
const pollingIntervals = new Map<string, ReturnType<typeof setInterval>>();

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
    // Clear any active polling for this job
    const interval = pollingIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      pollingIntervals.delete(id);
    }
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
  },

  clearCompleted: () => {
    const { jobs } = get();
    // Clear polling for any completed/failed jobs being removed
    for (const job of jobs) {
      if (job.status === 'completed' || job.status === 'failed') {
        const interval = pollingIntervals.get(job.id);
        if (interval) {
          clearInterval(interval);
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

    // Start polling for status
    const interval = setInterval(async () => {
      const statusResult = await tryApiFetch<JobStatusResult>(
        `/api/blender-mcp/generate/status?jobId=${encodeURIComponent(mcpJobId)}&provider=${encodeURIComponent(mcpProvider)}`,
      );

      if (!statusResult.ok) {
        clearInterval(interval);
        pollingIntervals.delete(localId);
        get().updateJob(localId, {
          status: 'failed',
          error: statusResult.error,
        });
        return;
      }

      const { status, progress, resultUrl } = statusResult.data;

      if (status === 'completed') {
        clearInterval(interval);
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
        clearInterval(interval);
        pollingIntervals.delete(localId);
        get().updateJob(localId, {
          status: 'failed',
          error: 'Generation failed on remote provider',
          completedAt: Date.now(),
        });
        return;
      }

      // Still processing — update progress
      get().updateJob(localId, { progress });
    }, UI_TIMEOUTS.blenderGenPollInterval);

    pollingIntervals.set(localId, interval);
  },
}));
