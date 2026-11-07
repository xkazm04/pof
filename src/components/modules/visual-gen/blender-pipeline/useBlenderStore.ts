import { create } from 'zustand';

export type ScriptStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface ScriptJob {
  id: string;
  scriptName: string;
  args: string[];
  status: ScriptStatus;
  output: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

/**
 * The Script History record: every script PoF dispatched through `executeViaMCP` this
 * session. Blender path/version live elsewhere (GET /api/visual-gen/blender/detect).
 */
interface BlenderState {
  scripts: ScriptJob[];

  addScript: (scriptName: string, args: string[]) => string;
  updateScript: (id: string, updates: Partial<ScriptJob>) => void;
  removeScript: (id: string) => void;
  clearCompleted: () => void;
}

let scriptCounter = 0;

export const useBlenderStore = create<BlenderState>((set) => ({
  scripts: [],

  addScript: (scriptName, args) => {
    const id = `script-${Date.now()}-${++scriptCounter}`;
    const job: ScriptJob = {
      id,
      scriptName,
      args,
      status: 'running',
      output: '',
      startedAt: Date.now(),
    };
    set((s) => ({ scripts: [job, ...s.scripts] }));
    return id;
  },

  updateScript: (id, updates) =>
    set((s) => ({
      scripts: s.scripts.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    })),

  removeScript: (id) =>
    set((s) => ({ scripts: s.scripts.filter((j) => j.id !== id) })),

  clearCompleted: () =>
    set((s) => ({
      scripts: s.scripts.filter((j) => j.status === 'running' || j.status === 'idle'),
    })),
}));
