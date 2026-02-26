import { create } from 'zustand';

export type JobStatus = 'pending' | 'generating' | 'completed' | 'failed';
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
}

let jobCounter = 0;

export const useForgeStore = create<ForgeState>((set) => ({
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

  removeJob: (id) =>
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),

  clearCompleted: () =>
    set((s) => ({ jobs: s.jobs.filter((j) => j.status !== 'completed' && j.status !== 'failed') })),

  setActiveProvider: (id) => set({ activeProviderId: id }),

  addToHistory: (prompt) =>
    set((s) => ({
      promptHistory: [prompt, ...s.promptHistory.filter((p) => p !== prompt)].slice(0, 50),
    })),
}));
