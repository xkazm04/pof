import { create } from 'zustand';
import type { DodgeParams } from '@/components/modules/core-engine/sub_combat/_shared/dodge-types';

/* ── Local Heuristic Tuning Store Factory ────────────────────────────────────
 *
 * IMPORTANT — this store backs a LOCAL, deterministic heuristic. It does NOT spawn
 * a Claude CLI process, call any model, or run any AI. `startOptimization` /
 * `finishOptimization` bracket a synchronous local computation; the `log` is a
 * plain in-memory activity trail for the review sidebar. Named "heuristic" (not
 * "cli") on purpose so the naming can never imply an AI/CLI run that isn't there.
 * If a real AI tuning pass is ever wired, dispatch it through the standard CLI
 * task path (TaskFactory / useModuleCLI) rather than repurposing this store.
 */

export interface HeuristicLogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'change' | 'result' | 'error';
  message: string;
  detail?: string;
}

interface HeuristicTuningState<T = unknown> {
  log: HeuristicLogEntry[];
  isOptimizing: boolean;
  sidebarOpen: boolean;
  pendingResult: T | null;
  addLogEntry: (entry: Omit<HeuristicLogEntry, 'id' | 'timestamp'>) => void;
  clearLog: () => void;
  startOptimization: () => void;
  finishOptimization: (result?: T) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  applyPendingResult: () => T | null;
}

export function createHeuristicTuningStore<T = unknown>() {
  return create<HeuristicTuningState<T>>((set, get) => ({
    log: [],
    isOptimizing: false,
    sidebarOpen: false,
    pendingResult: null,
    addLogEntry: (entry) => set((s) => ({
      log: [...s.log, { ...entry, id: `heuristic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now() }],
    })),
    clearLog: () => set({ log: [], pendingResult: null }),
    startOptimization: () => set({ isOptimizing: true, log: [], pendingResult: null, sidebarOpen: true }),
    finishOptimization: (result) => set({ isOptimizing: false, pendingResult: result ?? null }),
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    applyPendingResult: () => { const r = get().pendingResult; set({ pendingResult: null }); return r; },
  }));
}

/* ── Store Instances ─────────────────────────────────────────────────────── */

/** Character Blueprint dodge local-heuristic tuning (deterministic, no AI). */
export const useCharacterHeuristicStore = createHeuristicTuningStore<DodgeParams>();

/** Animation state priority local-heuristic tuning (deterministic, no AI). */
interface PriorityResult {
  winner: string;
  flags: Record<string, boolean>;
  weights: Record<string, number>;
}
export const useAnimationHeuristicStore = createHeuristicTuningStore<PriorityResult>();
