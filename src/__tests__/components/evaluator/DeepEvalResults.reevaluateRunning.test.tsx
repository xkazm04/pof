/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): ModuleSection's Re-evaluate button stayed
 * enabled while a deep-eval job ran, and startJob returns early on isRunning, so the click was a
 * silent no-op (the header Run button is swapped for Cancel while running).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ResultsSection } from '@/components/modules/evaluator/DeepEvalResults/ResultsSection';
import { aggregateFindings } from '@/lib/evaluator/finding-collector';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { DeepEvalResult } from '@/lib/evaluator/deep-eval-engine';
import type { SubModuleId } from '@/types/modules';

afterEach(cleanup);

const finding: EvalFinding = {
  id: 'f1', scanId: 's', moduleId: 'arpg-combat' as SubModuleId, pass: 'structure', category: 'General',
  severity: 'medium', file: 'a.cpp', line: 1, description: 'finding f1', suggestedFix: '', effort: 'small', timestamp: 0,
};

function renderSection(isRunning: boolean) {
  const findings = aggregateFindings([finding], 's');
  const result: DeepEvalResult = {
    scanId: 's', findings, duration: 1, modulesEvaluated: ['arpg-combat'], passesRun: ['structure'],
    failedModules: [], passStatuses: {} as DeepEvalResult['passStatuses'], passErrors: {},
  };
  const props = {
    result, diff: null, view: 'all' as const, setView: vi.fn(), attribution: {},
    expandedModules: new Set(['arpg-combat']), expandedCategories: new Set<string>(),
    taggingActive: false, discardedBaselineProject: null, activeFindings: findings,
    toggleModule: vi.fn(), toggleCategory: vi.fn(), onFix: vi.fn(), onBatchFix: vi.fn(), onRunSingle: vi.fn(),
    isFixRunning: false, fixTargetId: null, isRunning,
  };
  return render(<ResultsSection {...props} />);
}

describe('DeepEvalResults - Re-evaluate during a running scan', () => {
  it('is disabled with an explanation while a job runs', () => {
    renderSection(true);
    const btn = screen.getByRole('button', { name: /re-evaluate/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('title')).toMatch(/running/i);
  });

  it('is enabled when idle', () => {
    renderSection(false);
    expect((screen.getByRole('button', { name: /re-evaluate/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
