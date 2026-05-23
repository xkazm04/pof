import { describe, it, expect } from 'vitest';
import { EVAL_PASSES, PASS_LABELS, buildEvalPrompt } from '@/lib/evaluator/module-eval-prompts';

describe('ground-truth evaluator pass', () => {
  it('is the first pass', () => {
    expect(EVAL_PASSES[0]).toBe('ground-truth');
  });

  it('has a label', () => {
    expect(PASS_LABELS['ground-truth']).toBe('Ground Truth');
  });

  it('produces a module-agnostic ground-truth instruction', () => {
    const out = buildEvalPrompt({
      moduleId: 'arpg-combat',
      pass: 'ground-truth',
      projectName: 'PoF',
      moduleName: 'PoF',
      sourcePath: 'Source/PoF',
    });
    const lower = out.toLowerCase();
    expect(lower).toContain('parent class');
    expect(lower).toContain('read-only inventory');
  });

  it('produces the same ground-truth checks for a module without a specific context', () => {
    const out = buildEvalPrompt({
      moduleId: 'core-engine-plan',
      pass: 'ground-truth',
      projectName: 'PoF',
      moduleName: 'PoF',
      sourcePath: 'Source/PoF',
    });
    expect(out.toLowerCase()).toContain('parent class');
  });
});
