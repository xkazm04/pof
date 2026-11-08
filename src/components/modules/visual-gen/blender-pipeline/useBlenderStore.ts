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
  /** How many older rows were evicted by the retention cap this session. */
  droppedCount: number;

  addScript: (scriptName: string, args: string[]) => string;
  updateScript: (id: string, updates: Partial<ScriptJob>) => void;
  removeScript: (id: string) => void;
  clearCompleted: () => void;
}

/** Retention cap: newest N rows are kept so a long session keeps a bounded heap and DOM. */
export const SCRIPT_HISTORY_CAP = 100;

let scriptCounter = 0;

export const useBlenderStore = create<BlenderState>((set) => ({
  scripts: [],
  droppedCount: 0,

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
    set((s) => {
      const next = [job, ...s.scripts];
      const dropped = Math.max(0, next.length - SCRIPT_HISTORY_CAP);
      return {
        scripts: dropped > 0 ? next.slice(0, SCRIPT_HISTORY_CAP) : next,
        droppedCount: s.droppedCount + dropped,
      };
    });
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
