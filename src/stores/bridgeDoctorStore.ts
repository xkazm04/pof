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
import type { ChannelId, DiagnosticsReport, ProbeConfig } from '@/lib/bridge-doctor/probes';

export interface KnownGoodConfig {
  host: string;
  pofPort: number;
  rcPort: number;
  wsPort: number;
  authToken: string;
  /** ISO timestamp of when the all-green probe captured this config. */
  capturedAt: string;
}

/** Live connection settings, as the restore flow reads and writes them. */
export interface LiveConfig {
  host: string;
  pofPort: number;
  rcPort: number;
  wsPort: number;
  authToken: string;
}

/** The existing settings setters; injected so the state machine is testable without rendering. */
export interface RestoreSetters {
  setHost: (v: string) => void;
  setPofPort: (v: number) => void;
  setRcPort: (v: number) => void;
  setWsPort: (v: number) => void;
  setPofAuthToken: (v: string) => void;
}

export type RestorePhase = 'idle' | 'previewing' | 'previewed' | 'applied';

export type RestorePreview =
  | { verdict: 'would-fix'; good: LiveConfig }
  | { verdict: 'still-failing'; good: LiveConfig; channels: ChannelId[] };

function writeConfig(setters: RestoreSetters, c: LiveConfig): void {
  setters.setHost(c.host);
  setters.setPofPort(c.pofPort);
  setters.setRcPort(c.rcPort);
  setters.setWsPort(c.wsPort);
  setters.setPofAuthToken(c.authToken);
}

interface BridgeDoctorState {
  // ── Persisted ────────────────────────────────────────────────────────────
  lastKnownGood: KnownGoodConfig | null;

  // ── Runtime ─────────────────────────────────────────────────────────────
  /** True while at least one channel probe is in flight. */
  running: boolean;
  /** Latest diagnostics result, or null if none has been run this session. */
  latest: DiagnosticsReport | null;

  // ── Restore flow (non-persisted) ──────────────────────────────────────
  restorePhase: RestorePhase;
  restorePreview: RestorePreview | null;
  /** The live config captured when a restore was applied; Undo writes it back. */
  undoSnapshot: LiveConfig | null;

  // ── Actions ─────────────────────────────────────────────────────────────
  beginRun: () => void;
  endRun: (report: DiagnosticsReport) => void;
  clearLastKnownGood: () => void;
  /** Dry-probe a candidate config without touching settings or the main report. */
  previewRestore: (
    good: LiveConfig,
    probe: (cfg: ProbeConfig) => Promise<DiagnosticsReport>,
  ) => Promise<RestorePreview | null>;
  /** Write the previewed config through the setters. Returns false when gated or not previewed. */
  applyRestore: (live: LiveConfig, setters: RestoreSetters, force?: boolean) => boolean;
  /** Write the pre-restore config back. Returns false when there is nothing to undo. */
  undoRestore: (setters: RestoreSetters) => boolean;
  resetRestore: () => void;
}

export const useBridgeDoctorStore = create<BridgeDoctorState>()(
  persist(
    (set, get) => ({
      lastKnownGood: null,
      running: false,
      latest: null,
      restorePhase: 'idle',
      restorePreview: null,
      undoSnapshot: null,

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

      previewRestore: async (good, probe) => {
        const st = get();
        if (st.running || st.restorePhase === 'previewing') return null;
        set({ restorePhase: 'previewing', restorePreview: null });
        try {
          const candidate: LiveConfig = {
            host: good.host,
            pofPort: good.pofPort,
            rcPort: good.rcPort,
            wsPort: good.wsPort,
            authToken: good.authToken,
          };
          const report = await probe({ ...candidate, authToken: candidate.authToken || undefined });
          const failed = (Object.keys(report.channels) as ChannelId[]).filter((id) => !report.channels[id].ok);
          const preview: RestorePreview = report.allGreen
            ? { verdict: 'would-fix', good: candidate }
            : { verdict: 'still-failing', good: candidate, channels: failed };
          set({ restorePhase: 'previewed', restorePreview: preview });
          return preview;
        } catch {
          set({ restorePhase: 'idle', restorePreview: null });
          return null;
        }
      },

      applyRestore: (live, setters, force = false) => {
        const { restorePhase, restorePreview } = get();
        if (restorePhase !== 'previewed' || !restorePreview) return false;
        if (restorePreview.verdict === 'still-failing' && !force) return false;
        writeConfig(setters, restorePreview.good);
        set({ undoSnapshot: { ...live }, restorePhase: 'applied' });
        return true;
      },

      undoRestore: (setters) => {
        const snap = get().undoSnapshot;
        if (!snap) return false;
        writeConfig(setters, snap);
        set({ undoSnapshot: null, restorePhase: 'idle', restorePreview: null });
        return true;
      },

      resetRestore: () => set({ restorePhase: 'idle', restorePreview: null }),
    }),
    {
      name: 'pof-bridge-doctor',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lastKnownGood: state.lastKnownGood }),
    },
  ),
);
