'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';

/** The findings of the most recent deep-eval scan, kept so the next scan can be diffed against it. */
export interface StoredScan {
  scanId: string;
  /** Scan completion time (ms epoch) — used as the `--since` window for git attribution. */
  timestamp: number;
  /**
   * Which project this baseline was scanned FROM (the project path; `''` when no
   * project is open — the same identity the server stores as `project_id`).
   *
   * The regression diff (NEW / PERSISTING / RESOLVED) is a verdict surface, so a
   * baseline may only ever be compared against a scan of the *same* project. Without
   * this field, switching projects made every finding of the new project read NEW,
   * every finding of the old one read RESOLVED, and git attribution blame the new
   * project's commits for the old project's findings.
   */
  projectPath: string;
  findings: EvalFinding[];
}

/** Normalize a project identity: an unset project is `''`, matching the server's `project_id`. */
export function projectIdOf(projectPath: string | null | undefined): string {
  return projectPath ?? '';
}

/**
 * A cached baseline with no `projectPath` predates project scoping, so which project
 * it describes is unknowable — unscoped ⇒ discard, never guess. One re-scan is cheaper
 * than a diff that blames the wrong project.
 */
function isScoped(scan: StoredScan | null | undefined): scan is StoredScan {
  return !!scan && typeof scan.projectPath === 'string';
}

interface DeepEvalState {
  /** The previous scan's findings, persisted so regression diffing survives reloads. */
  lastScan: StoredScan | null;
  /**
   * The baseline **only** when it belongs to `projectPath`; `null` otherwise. Every
   * diff/merge consumer must read the baseline through here — reading `lastScan`
   * directly is what let one project's findings be diffed against another's.
   */
  baselineFor: (projectPath: string | null | undefined) => StoredScan | null;
  recordScan: (scan: StoredScan) => void;
  clearBaseline: () => void;
}

/**
 * Persists the last deep-eval scan so a fresh scan can be diffed against it
 * (NEW / RESOLVED / PERSISTING). Only the single most-recent baseline is kept to
 * bound localStorage size, and it is stamped with the project it came from so a
 * project switch replaces it instead of silently diffing across projects.
 */
export const useDeepEvalStore = create<DeepEvalState>()(
  persist(
    (set, get) => ({
      lastScan: null,
      baselineFor: (projectPath) => {
        const scan = get().lastScan;
        if (!isScoped(scan)) return null;
        return scan.projectPath === projectIdOf(projectPath) ? scan : null;
      },
      recordScan: (scan) => set({ lastScan: scan }),
      clearBaseline: () => set({ lastScan: null }),
    }),
    {
      name: 'pof-deep-eval',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lastScan: state.lastScan }),
      // Drop an unscoped (pre-scoping) cache on rehydrate rather than leaving it in
      // localStorage to be adopted by whatever project happens to be open.
      merge: (persisted, current) => {
        const p = (persisted as { lastScan?: StoredScan | null } | null | undefined) ?? {};
        return { ...current, ...p, lastScan: isScoped(p.lastScan) ? p.lastScan : null };
      },
    },
  ),
);
