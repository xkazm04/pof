'use client';

import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
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
 * Mark a gap resolved on a copy of the report and recompute the gap counters.
 * Pure, immutable transform — no nested mutation of the held report — so resolve
 * runs client-side against the report the store already holds, with no server
 * round-trip and no shared server-side cache. (Mirrors `resolveGap` in
 * `@/lib/gdd-compliance`, re-implemented here to avoid importing that module's
 * server-only DB dependencies into this `'use client'` store.)
 */
function applyResolveGap(report: ComplianceReport, gapId: string): ComplianceReport {
  const modules = report.modules.map((mod) => ({
    ...mod,
    gaps: mod.gaps.map((g) => (g.id === gapId ? { ...g, resolved: true } : g)),
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

  runAudit: (checklistProgress?: ChecklistProgress, projectPath?: string) => Promise<void>;
  /** Audit only if the report is missing or stale vs. the given project/checklist. */
  ensureAudit: (checklistProgress: ChecklistProgress, projectPath: string) => Promise<void>;
  clearReport: () => void;
  resolveGap: (gapId: string) => Promise<void>;
  selectModule: (moduleId: SubModuleId | null) => void;
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

  runAudit: async (checklistProgress?: ChecklistProgress, projectPath?: string) => {
    const cp = checklistProgress ?? {};
    set({ isAuditing: true, error: null });
    try {
      const report = await apiFetch<ComplianceReport>('/api/gdd-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'audit', checklistProgress: cp }),
      });
      set({
        report,
        modules: report.modules,
        suggestions: report.suggestions,
        isAuditing: false,
        reportProjectPath: projectPath ?? get().reportProjectPath,
        reportChecklistHash: hashChecklist(cp),
      });
    } catch (err) {
      set({ error: (err as Error).message, isAuditing: false });
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
    }),

  resolveGap: async (gapId: string) => {
    // Resolve against the report the store already holds — no server round-trip,
    // so there is no shared server-side cache to corrupt across clients/projects.
    // `reportProjectPath`/`reportChecklistHash` are left untouched (staleness
    // detection in `ensureAudit` keeps working).
    const current = get().report;
    if (!current) return;
    const report = applyResolveGap(current, gapId);
    set({ report, modules: report.modules, suggestions: report.suggestions });
  },

  selectModule: (moduleId) => set({ selectedModuleId: moduleId }),
}));
