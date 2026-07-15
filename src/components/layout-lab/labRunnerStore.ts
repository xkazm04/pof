'use client';

import { create } from 'zustand';

/**
 * Lab-local view of THIS session's own drain activity. The single-entity coach drain
 * (`useBaseline.runDrain`) and the catalog batch drain (`useBatchDrain`) both write a
 * human scope here while running and clear it when done. The runner chip reads it so a
 * drain the lab itself launched shows as "draining <scope>" — and can be told apart from
 * a lease held by ANOTHER session (which the chip learns from the drain status API).
 */
export interface LabRunnerState {
  /** Non-null while this lab session is running a drain; the human scope being drained. */
  localDrain: string | null;
  setLocalDrain: (scope: string | null) => void;
}

export const useLabRunnerStore = create<LabRunnerState>((set) => ({
  localDrain: null,
  setLocalDrain: (scope) => set({ localDrain: scope }),
}));
