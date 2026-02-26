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

interface BlenderState {
  blenderPath: string | null;
  blenderVersion: string | null;
  isDetecting: boolean;
  scripts: ScriptJob[];

  setBlenderPath: (path: string | null, version?: string | null) => void;
  setDetecting: (detecting: boolean) => void;
  addScript: (scriptName: string, args: string[]) => string;
  updateScript: (id: string, updates: Partial<ScriptJob>) => void;
  appendOutput: (id: string, text: string) => void;
  removeScript: (id: string) => void;
  clearCompleted: () => void;
}

let scriptCounter = 0;

export const useBlenderStore = create<BlenderState>((set) => ({
  blenderPath: null,
  blenderVersion: null,
  isDetecting: false,
  scripts: [],

  setBlenderPath: (path, version = null) => set({ blenderPath: path, blenderVersion: version }),
  setDetecting: (detecting) => set({ isDetecting: detecting }),

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

  appendOutput: (id, text) =>
    set((s) => ({
      scripts: s.scripts.map((j) =>
        j.id === id ? { ...j, output: j.output + text } : j,
      ),
    })),

  removeScript: (id) =>
    set((s) => ({ scripts: s.scripts.filter((j) => j.id !== id) })),

  clearCompleted: () =>
    set((s) => ({
      scripts: s.scripts.filter((j) => j.status === 'running' || j.status === 'idle'),
    })),
}));
