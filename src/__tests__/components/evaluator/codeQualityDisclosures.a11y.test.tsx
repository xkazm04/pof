/**
 * scan-sweep 2026-11-08 (code-quality-evaluation): the context's expand/collapse rows conveyed
 * open/closed only by a chevron icon. A screen reader heard a plain button with no state
 * (WCAG 4.1.2). Each disclosure button now exposes aria-expanded and follows it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ModuleSection } from '@/components/modules/evaluator/DeepEvalResults/ModuleSection';
import { ViolationRow } from '@/components/modules/evaluator/AssetCodeOracleView/ViolationRow';
import { PatternCard } from '@/components/modules/evaluator/PatternLibraryView/PatternCard';
import { aggregateFindings, type EvalFinding } from '@/lib/evaluator/finding-collector';
import type { ConsistencyViolation } from '@/lib/asset-code-oracle';
import type { ImplementationPattern } from '@/types/pattern-library';

afterEach(cleanup);

const noop = () => {};

const finding: EvalFinding = {
  id: 'f1', scanId: 's', moduleId: 'arpg-combat', pass: 'structure', category: 'Naming',
  severity: 'high', file: 'A.cpp', line: 3, description: 'd', suggestedFix: 'x', effort: 'small', timestamp: 0,
};
const mod = aggregateFindings([finding], 's').modules[0];

function expandedOf(el: Element | null): string | null {
  return el ? el.getAttribute('aria-expanded') : 'missing-element';
}

describe('code-quality-evaluation disclosures expose aria-expanded', () => {
  it('deep-eval module header and category header', () => {
    const props = {
      module: mod, attribution: {}, taggingActive: false, onToggleModule: noop, onToggleCategory: noop,
      onFix: noop, onBatchFix: noop, onRunSingle: noop, isFixRunning: false, fixTargetId: null,
    };
    const { container, rerender } = render(<ModuleSection {...props} isExpanded={false} expandedCategories={new Set()} />);
    expect(expandedOf(container.querySelector('button'))).toBe('false');

    rerender(<ModuleSection {...props} isExpanded expandedCategories={new Set(['arpg-combat::Naming'])} />);
    const buttons = Array.from(container.querySelectorAll('button[aria-expanded]'));
    expect(buttons.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'true']);
  });

  it('oracle violation row', () => {
    const v = {
      id: 'naming-mismatch:A', type: 'naming-mismatch', severity: 'warning', title: 'T',
      description: 'd', subject: 'A', suggestion: 's',
    } as ConsistencyViolation;
    const { container, rerender } = render(<ViolationRow violation={v} expanded={false} onToggle={noop} />);
    expect(expandedOf(container.querySelector('button'))).toBe('false');
    rerender(<ViolationRow violation={v} expanded onToggle={noop} />);
    expect(expandedOf(container.querySelector('button'))).toBe('true');
  });

  it('pattern card header', () => {
    const p = {
      id: 'p1', title: 'Combo via montage', moduleId: 'arpg-combat', category: 'general', tags: [],
      description: 'd', approach: 'a', successRate: 0.8, sessionCount: 3, projectCount: 1, avgDurationMs: 1000,
      confidence: 'promising', involvedClasses: [], pitfalls: [], firstSeenAt: '', lastSuccessAt: '',
    } as unknown as ImplementationPattern;
    const { container } = render(<PatternCard pattern={p} />);
    expect(expandedOf(container.querySelector('button'))).toBe('false');
  });
});
