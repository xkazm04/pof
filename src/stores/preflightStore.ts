'use client';

import { create } from 'zustand';
import type { PreflightVerdict } from '@/lib/cli-spend/preflight';

/**
 * Global queue for the pre-flight budget-guard confirmation.
 *
 * When an expensive CLI task is about to launch under budget pressure,
 * {@link requestPreflightConfirm} opens the single global
 * `PreflightGuardDialog` and resolves to the user's decision. Kept as a tiny
 * standalone store (not tied to a component) so any dispatch path can await a
 * confirm without prop-drilling a modal.
 */
interface PreflightState {
  pending: PreflightVerdict | null;
  resolve: ((proceed: boolean) => void) | null;
  /** Open the dialog for `verdict`; resolves true (proceed) / false (cancel). */
  request: (verdict: PreflightVerdict) => Promise<boolean>;
  confirm: () => void;
  cancel: () => void;
}

export const usePreflightStore = create<PreflightState>((set, get) => ({
  pending: null,
  resolve: null,
  request: (verdict) =>
    new Promise<boolean>((resolve) => {
      // If a prior prompt is somehow still open, resolve it as cancelled first.
      const prev = get().resolve;
      if (prev) prev(false);
      set({ pending: verdict, resolve });
    }),
  confirm: () => {
    const { resolve } = get();
    resolve?.(true);
    set({ pending: null, resolve: null });
  },
  cancel: () => {
    const { resolve } = get();
    resolve?.(false);
    set({ pending: null, resolve: null });
  },
}));

/**
 * Run the pre-flight guardrail for an about-to-launch task. Returns whether the
 * dispatch should proceed. Never blocks on a guardrail error — only an explicit
 * user cancel (after a real warning) returns false.
 */
export async function requestPreflightConfirm(
  verdict: PreflightVerdict | null,
): Promise<boolean> {
  if (!verdict || !verdict.warn) return true;
  return usePreflightStore.getState().request(verdict);
}
