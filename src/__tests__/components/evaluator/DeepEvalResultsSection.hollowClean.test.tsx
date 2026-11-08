/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): the green "No Issues Found" panel may only
 * speak for modules whose passes actually finished. A run where every module errored has zero
 * findings because nothing was measured, and it must not render as a clean pass beside the
 * failed-modules banner (quality-gates / unmeasurable-criteria: REFUSE, never a clean verdict).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ResultsSection } from '@/components/modules/evaluator/DeepEvalResults/ResultsSection';
import { aggregateFindings } from '@/lib/evaluator/finding-collector';
import type { DeepEvalResult } from '@/lib/evaluator/deep-eval-engine';

afterEach(cleanup);

function result(modules: string[], failed: string[]): DeepEvalResult {
  return {
    scanId: 's1',
    findings: aggregateFindings([], 's1'),
    duration: 1000,
    modulesEvaluated: modules,
    passesRun: ['structure'],
    failedModules: failed,
    passStatuses: {},
    passErrors: Object.fromEntries(failed.map((m) => [m, { structure: 'cli-error: boom' }])),
  };
}

function renderSection(r: DeepEvalResult) {
  const noop = () => {};
  return render(
    <ResultsSection
      result={r} diff={null} view="all" setView={noop} attribution={{}}
      expandedModules={new Set()} expandedCategories={new Set()} taggingActive={false}
      discardedBaselineProject={null} activeFindings={r.findings}
      toggleModule={noop} toggleCategory={noop} onFix={noop} onBatchFix={noop} onRunSingle={noop}
      isFixRunning={false} fixTargetId={null}
    />,
  );
}

describe('ResultsSection - zero findings is not a clean pass unless something was measured', () => {
  it('every module failed: no green "No Issues Found" panel', () => {
    renderSection(result(['arpg-combat', 'arpg-loot'], ['arpg-combat', 'arpg-loot']));
    expect(screen.queryByText('No Issues Found')).toBeNull();
    expect(screen.getByTestId('pof-deep-eval-failed-modules')).toBeTruthy();
  });

  it('some modules failed: the clean panel names only the modules that completed', () => {
    renderSection(result(['arpg-combat', 'arpg-loot', 'arpg-character'], ['arpg-loot']));
    expect(screen.getByText('No Issues Found')).toBeTruthy();
    expect(screen.getByTestId('pof-deep-eval-clean').textContent).toContain('2 of 3');
  });

  it('every module completed clean: the clean panel shows', () => {
    renderSection(result(['arpg-combat'], []));
    expect(screen.getByText('No Issues Found')).toBeTruthy();
    expect(screen.getByTestId('pof-deep-eval-clean').textContent).toContain('All 1 evaluated module');
  });
});
