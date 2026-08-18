'use client';

import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { SubModuleId } from '@/types/modules';
import type { ComplianceReport, ReconciliationSuggestion } from '@/types/gdd-compliance';

const EMPTY_MODULES: ComplianceReport['modules'] = [];
const EMPTY_SUGGESTIONS: ReconciliationSuggestion[] = [];

type ChecklistProgress = Record<string, Record<string, boolean>>;

/** Canonical hash of the checked items, stable across key-order differences. */
function hashChecklist(cp: ChecklistProgress): string {
  return Object.keys(cp)
    .sort()
    .map((m) => `${m}:${Object.keys(cp[m]).filter((k) => cp[m][k]).sort().join(',')}`)
    .join('|');
}

/**
 * Flip one gap's resolved flag on a copy of the report and recompute the open-gap
 * counters. Pure, immutable transform — no nested mutation of the held report — so
 * the UI updates optimistically while the SQLite write (the source of truth, see
 * `@/lib/gdd-compliance`) is in flight. That module is not imported here: it pulls
 * in better-sqlite3, which cannot cross into a `'use client'` store.
 */
function applyGapResolution(
  report: ComplianceReport,
  gapId: string,
  resolved: boolean,
): ComplianceReport {
  const modules = report.modules.map((mod) => ({
    ...mod,
    gaps: mod.gaps.map((g) => (g.id === gapId ? { ...g, resolved } : g)),
  }));
  const allGaps = modules.flatMap((m) => m.gaps);
  return {
    ...report,
    modules,
    totalGaps: allGaps.filter((g) => !g.resolved).length,
    criticalGaps: allGaps.filter((g) => g.severity === 'critical' && !g.resolved).length,
  };
}

/**
 * Re-apply the user's manually-resolved gap markers onto a freshly audited
 * report and recompute the gap counters. Gap ids are deterministic across
 * audits (see `@/lib/gdd-compliance`), so a re-audit no longer silently
 * discards resolutions — the markers are merged back by id.
 *
 * The server now applies the persisted resolutions itself, so this is a
 * belt-and-braces merge for a resolution recorded since the request was sent;
 * it is kept because it also covers the optimistic window.
 */
function applyResolvedMarkers(
  report: ComplianceReport,
  resolvedIds: Record<string, true>,
): ComplianceReport {
  if (Object.keys(resolvedIds).length === 0) return report;
  const modules = report.modules.map((mod) => ({
    ...mod,
    gaps: mod.gaps.map((g) => (resolvedIds[g.id] ? { ...g, resolved: true } : g)),
  }));
  const allGaps = modules.flatMap((m) => m.gaps);
  return {
    ...report,
    modules,
    totalGaps: allGaps.filter((g) => !g.resolved).length,
    criticalGaps: allGaps.filter((g) => g.severity === 'critical' && !g.resolved).length,
  };
}

interface GDDComplianceState {
  report: ComplianceReport | null;
  modules: ComplianceReport['modules'];
  suggestions: ReconciliationSuggestion[];
  isAuditing: boolean;
  error: string | null;
  selectedModuleId: SubModuleId | null;
  /** Which project + checklist snapshot the current report was computed from. */
  reportProjectPath: string | null;
  reportChecklistHash: string | null;
  /**
   * Ids of gaps the user has manually marked resolved. Kept separately so a
   * re-audit (fresh server report) can re-apply them instead of wiping them.
   */
  resolvedGapIds: Record<string, true>;

  /**
   * True when the displayed report predates a FAILED refresh — the numbers on
   * screen are the last good audit, not current truth, and the view says so
   * instead of leaving the failure invisible behind a populated dashboard.
   */
  refreshFailed: boolean;

  runAudit: (checklistProgress?: ChecklistProgress, projectPath?: string) => Promise<void>;
  /** Audit only if the report is missing or stale vs. the given project/checklist. */
  ensureAudit: (checklistProgress: ChecklistProgress, projectPath: string) => Promise<void>;
  clearReport: () => void;
  resolveGap: (gapId: string, note?: string) => Promise<void>;
  /** Re-open a resolved gap; removes the durable resolution too. */
  unresolveGap: (gapId: string) => Promise<void>;
  selectModule: (moduleId: SubModuleId | null) => void;
}

type Setter = (partial: Partial<GDDComplianceState>) => void;
type Getter = () => GDDComplianceState;

/**
 * The one path for both directions of gap triage. The report updates
 * optimistically so the click feels instant, then the durable write goes to
 * SQLite; a failed write is ROLLED BACK and surfaced, because a triage decision
 * that did not persist must never sit on screen looking as if it did.
 */
async function mutateResolution(
  set: Setter,
  get: Getter,
  gapId: string,
  resolved: boolean,
  note?: string,
): Promise<void> {
  const current = get().report;
  if (!current) return;
  const gap = current.modules.flatMap((m) => m.gaps).find((g) => g.id === gapId);
  const previousResolvedIds = get().resolvedGapIds;

  const optimistic = applyGapResolution(current, gapId, resolved);
  const nextResolvedIds = { ...previousResolvedIds };
  if (resolved) nextResolvedIds[gapId] = true;
  else delete nextResolvedIds[gapId];
  set({
    report: optimistic,
    modules: optimistic.modules,
    suggestions: optimistic.suggestions,
    resolvedGapIds: nextResolvedIds,
    error: null,
  });

  try {
    await apiFetch('/api/gdd-compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: resolved ? 'resolve-gap' : 'unresolve-gap',
        gapId,
        moduleId: gap?.moduleId,
        note,
        projectPath: get().reportProjectPath ?? '',
      }),
    });
  } catch (err) {
    const message = (err as Error).message;
    logger.error(`[gddComplianceStore] gap ${resolved ? 'resolve' : 'un-resolve'} failed: ${message}`);
    const held = get().report ?? current;
    const rolledBack = applyGapResolution(held, gapId, !resolved);
    set({
      report: rolledBack,
      modules: rolledBack.modules,
      suggestions: rolledBack.suggestions,
      resolvedGapIds: previousResolvedIds,
      error: message,
    });
  }
}

export const useGDDComplianceStore = create<GDDComplianceState>((set, get) => ({
  report: null,
  modules: EMPTY_MODULES,
  suggestions: EMPTY_SUGGESTIONS,
  isAuditing: false,
  error: null,
  selectedModuleId: null,
  reportProjectPath: null,
  reportChecklistHash: null,
  resolvedGapIds: {},
  refreshFailed: false,

  runAudit: async (checklistProgress?: ChecklistProgress, projectPath?: string) => {
    const cp = checklistProgress ?? {};
    set({ isAuditing: true, error: null, refreshFailed: false });
    try {
      const scope = projectPath ?? get().reportProjectPath ?? '';
      const fresh = await apiFetch<ComplianceReport>('/api/gdd-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'audit', checklistProgress: cp, projectPath: scope }),
      });
      // A project switch starts with a clean slate (gap ids are only unique
      // within a project); a re-audit of the same project preserves the user's
      // manual resolutions by merging them back onto the fresh report. The server
      // already applied the persisted ones, so the fresh report's own resolved
      // flags seed the local mirror — that is the rehydration path after a reload.
      const projectChanged = !!projectPath && projectPath !== get().reportProjectPath;
      const local = projectChanged ? {} : get().resolvedGapIds;
      const resolvedGapIds: Record<string, true> = { ...local };
      for (const mod of fresh.modules) {
        for (const gap of mod.gaps) if (gap.resolved) resolvedGapIds[gap.id] = true;
      }
      const report = applyResolvedMarkers(fresh, resolvedGapIds);
      set({
        report,
        modules: report.modules,
        suggestions: report.suggestions,
        isAuditing: false,
        resolvedGapIds,
        reportProjectPath: projectPath ?? get().reportProjectPath,
        reportChecklistHash: hashChecklist(cp),
      });
    } catch (err) {
      // A failed refresh over an existing report used to vanish: the view gated
      // its error state on `!report`, so the stale numbers stayed on screen
      // looking current. Keep the report (it is the last thing we actually knew),
      // flag it stale, and log — never swallow the reason into state alone.
      const message = (err as Error).message;
      logger.error(`[gddComplianceStore] compliance audit failed: ${message}`);
      set({ error: message, isAuditing: false, refreshFailed: !!get().report });
    }
  },

  ensureAudit: async (checklistProgress, projectPath) => {
    if (!projectPath) return; // no project yet — don't audit an empty checklist
    const { isAuditing, report, reportProjectPath, reportChecklistHash } = get();
    if (isAuditing) return;
    const hash = hashChecklist(checklistProgress);
    // The report is a singleton with no project identity: a project switch (or
    // an audit that ran before the new project's checklist hydrated) otherwise
    // leaves project A's scores on screen for project B. Re-audit whenever the
    // project or the checklist snapshot differs from what the report was built
    // from. (runComplianceAudit is a cheap local compute.)
    if (report && reportProjectPath === projectPath && reportChecklistHash === hash) return;
    await get().runAudit(checklistProgress, projectPath);
  },

  clearReport: () =>
    set({
      report: null,
      modules: EMPTY_MODULES,
      suggestions: EMPTY_SUGGESTIONS,
      reportProjectPath: null,
      reportChecklistHash: null,
      resolvedGapIds: {},
      refreshFailed: false,
      error: null,
    }),

  resolveGap: async (gapId: string, note?: string) => {
    await mutateResolution(set, get, gapId, true, note);
  },

  unresolveGap: async (gapId: string) => {
    await mutateResolution(set, get, gapId, false);
  },

  selectModule: (moduleId) => set({ selectedModuleId: moduleId }),
}));
