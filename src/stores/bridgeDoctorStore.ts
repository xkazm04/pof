/**
 * Bridge Doctor store
 *
 * Tracks the most recent diagnostics run (non-persisted) and the
 * last-known-good configuration (persisted) that the user can restore with
 * one click when the live ports/auth drift out of sync.
 *
 * The "good" snapshot is captured on the first all-green diagnostics run and
 * refreshed on every subsequent all-green run, so it always represents a
 * configuration the app has actually verified end-to-end.
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DiagnosticsReport } from '@/lib/bridge-doctor/probes';

export interface KnownGoodConfig {
  host: string;
  pofPort: number;
  rcPort: number;
  wsPort: number;
  authToken: string;
  /** ISO timestamp of when the all-green probe captured this config. */
  capturedAt: string;
}

interface BridgeDoctorState {
  // ── Persisted ────────────────────────────────────────────────────────────
  lastKnownGood: KnownGoodConfig | null;

  // ── Runtime ─────────────────────────────────────────────────────────────
  /** True while at least one channel probe is in flight. */
  running: boolean;
  /** Latest diagnostics result, or null if none has been run this session. */
  latest: DiagnosticsReport | null;

  // ── Actions ─────────────────────────────────────────────────────────────
  beginRun: () => void;
  endRun: (report: DiagnosticsReport) => void;
  clearLastKnownGood: () => void;
}

export const useBridgeDoctorStore = create<BridgeDoctorState>()(
  persist(
    (set) => ({
      lastKnownGood: null,
      running: false,
      latest: null,

      beginRun: () => set({ running: true }),

      endRun: (report) =>
        set((state) => {
          const next: Partial<BridgeDoctorState> = { running: false, latest: report };
          if (report.allGreen) {
            next.lastKnownGood = {
              host: report.config.host,
              pofPort: report.config.pofPort,
              rcPort: report.config.rcPort,
              wsPort: report.config.wsPort,
              authToken: report.config.authToken ?? '',
              capturedAt: report.finishedAt,
            };
          } else if (state.lastKnownGood) {
            // Preserve the existing snapshot when the new run is red.
            next.lastKnownGood = state.lastKnownGood;
          }
          return next;
        }),

      clearLastKnownGood: () => set({ lastKnownGood: null }),
    }),
    {
      name: 'pof-bridge-doctor',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lastKnownGood: state.lastKnownGood }),
    },
  ),
);
