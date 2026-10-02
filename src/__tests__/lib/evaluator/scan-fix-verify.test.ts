/**
 * Fix & verify — the pure core. A fix closes a finding only when a targeted
 * re-scan stops finding it: remediation does not close a finding, verification
 * does. One fix prompt, one verification plan (the targets' passes, the targets
 * named), one settlement over the re-scan's reconciled delta.
 */
import { describe, it, expect } from 'vitest';
import {
  buildScanFixPrompt,
  planFixVerification,
  settleFixVerification,
} from '@/lib/evaluator/scan-fix-verify';
import type { ScanFinding } from '@/types/scan';

function finding(id: string, over: Partial<ScanFinding> = {}): ScanFinding {
  return {
    id, pass: 'structure', category: `Cat ${id}`, severity: 'high', file: `Source/${id}.cpp`, line: null,
    description: `Issue ${id}`, suggestedFix: `do ${id}`, effort: 'small', foundAt: '2026-09-01T00:00:00.000Z', ...over,
  };
}

describe('buildScanFixPrompt — the one fix prompt', () => {
  it('is exactly the template the Scan tab hand-wrote three times', () => {
    const f = finding('f1', { category: 'Hit reaction', severity: 'critical', description: 'No hitstop', suggestedFix: 'Add hitstop' });
    expect(buildScanFixPrompt(f, 'Combat')).toBe(
      'Fix the following issue in the Combat module:\n\n**Hit reaction** (critical)\nNo hitstop\n\nFile: Source/f1.cpp\n\nSuggested fix: Add hitstop',
    );
    expect(buildScanFixPrompt({ ...f, file: null }, 'Combat')).toContain('\n\nFile: N/A\n\n');
  });
});

describe('planFixVerification — one scan over the targets\' passes', () => {
  it('unions the passes in EvalPass order, deduped, and names exactly the targets', () => {
    const plan = planFixVerification([
      finding('f1', { pass: 'structure' }),
      finding('f2', { pass: 'quality' }),
      finding('f3', { pass: 'structure' }),
    ]);
    expect(plan).not.toBeNull();
    expect(plan!.passes).toEqual(['structure', 'quality']);
    expect(plan!.targetIds).toEqual(['f1', 'f2', 'f3']);
    for (const id of ['f1', 'f2', 'f3']) expect(plan!.previousFindings).toContain(`Issue ${id}`);
    expect(plan!.previousFindings.match(/^- \[/gm)).toHaveLength(3);
  });

  it('orders by the pass vocabulary, not by selection order', () => {
    const plan = planFixVerification([
      finding('a', { pass: 'performance' }),
      finding('b', { pass: 'ground-truth' }),
    ]);
    expect(plan!.passes).toEqual(['ground-truth', 'performance']);
  });

  it('has nothing to verify for no targets', () => {
    expect(planFixVerification([])).toBeNull();
  });
});

describe('settleFixVerification — only what the re-scan no longer finds is verified', () => {
  it('cleared targets are verified, persisting still present, the rest unverified; a non-target is never included', () => {
    expect(settleFixVerification(['f1', 'f2', 'f3'], {
      cleared: ['f1', 'x'], persisting: ['f2'], notRescanned: [], new: ['n1'],
    })).toEqual({ verified: ['f1'], stillPresent: ['f2'], unverified: ['f3'] });
  });

  it('a target whose pass did not run is unverified, never verified', () => {
    expect(settleFixVerification(['f1'], { cleared: [], persisting: [], notRescanned: ['f1'], new: [] }))
      .toEqual({ verified: [], stillPresent: [], unverified: ['f1'] });
  });
});
