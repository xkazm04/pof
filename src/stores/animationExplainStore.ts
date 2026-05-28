'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * User preference for the "Explain" toggle on the Animations module.
 *
 * Off by default to keep the existing dense UI untouched; the user opts in
 * once and it sticks across reloads. Persisted in localStorage so it survives
 * a refresh without a round-trip to SQLite.
 */
interface AnimationExplainState {
  /** When true, animation views show jargon tooltips + plain-English summaries. */
  explainEnabled: boolean;
  setExplainEnabled: (next: boolean) => void;
  toggleExplain: () => void;
}

export const useAnimationExplainStore = create<AnimationExplainState>()(
  persist(
    (set) => ({
      explainEnabled: false,
      setExplainEnabled: (next) => set({ explainEnabled: next }),
      toggleExplain: () => set((s) => ({ explainEnabled: !s.explainEnabled })),
    }),
    {
      name: 'pof-animation-explain',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
