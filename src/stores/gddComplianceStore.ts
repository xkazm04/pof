'use client';

import { create } from 'zustand';
import { apiFetch } from '@/lib/api-utils';
import type { SubModuleId } from '@/types/modules';
import type { ComplianceReport, ReconciliationSuggestion } from '@/types/gdd-compliance';

const EMPTY_MODULES: ComplianceReport['modules'] = [];
const EMPTY_SUGGESTIONS: ReconciliationSuggestion[] = [];

interface GDDComplianceState {
  report: ComplianceReport | null;
  modules: ComplianceReport['modules'];
  suggestions: ReconciliationSuggestion[];
  isAuditing: boolean;
  error: string | null;
  selectedModuleId: SubModuleId | null;

  runAudit: (checklistProgress?: Record<string, Record<string, boolean>>) => Promise<void>;
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

  runAudit: async (checklistProgress?: Record<string, Record<string, boolean>>) => {
    set({ isAuditing: true, error: null });
    try {
      const report = await apiFetch<ComplianceReport>('/api/gdd-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'audit', checklistProgress: checklistProgress ?? {} }),
      });
      set({
        report,
        modules: report.modules,
        suggestions: report.suggestions,
        isAuditing: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isAuditing: false });
    }
  },

  resolveGap: async (gapId: string) => {
    try {
      const report = await apiFetch<ComplianceReport>('/api/gdd-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve-gap', gapId }),
      });
      set({ report, modules: report.modules, suggestions: report.suggestions });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  selectModule: (moduleId) => set({ selectedModuleId: moduleId }),
}));
