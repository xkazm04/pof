import { create } from 'zustand';
import type { DodgeParams } from '@/components/modules/core-engine/unique-tabs/dodge-types';

/* ── Generic CLI Optimization Store Factory ──────────────────────────────── */

export interface CLILogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'change' | 'result' | 'error';
  message: string;
  detail?: string;
}

interface CliOptimizationState<T = unknown> {
  log: CLILogEntry[];
  isOptimizing: boolean;
  sidebarOpen: boolean;
  pendingResult: T | null;
  addLogEntry: (entry: Omit<CLILogEntry, 'id' | 'timestamp'>) => void;
  clearLog: () => void;
  startOptimization: () => void;
  finishOptimization: (result?: T) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  applyPendingResult: () => T | null;
}

export function createCliOptimizationStore<T = unknown>() {
  return create<CliOptimizationState<T>>((set, get) => ({
    log: [],
    isOptimizing: false,
    sidebarOpen: false,
    pendingResult: null,
    addLogEntry: (entry) => set((s) => ({
      log: [...s.log, { ...entry, id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now() }],
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

/** Character Blueprint dodge optimization */
export const useCharacterCliStore = createCliOptimizationStore<DodgeParams>();

/** Animation state priority optimization */
interface PriorityResult {
  winner: string;
  flags: Record<string, boolean>;
  weights: Record<string, number>;
}
export const useAnimationCliStore = createCliOptimizationStore<PriorityResult>();
