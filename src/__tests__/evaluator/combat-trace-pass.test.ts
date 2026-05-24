import { describe, it, expect } from 'vitest';
import {
  buildEvalPrompt, PASS_LABELS, EVAL_PASSES, getPassesForModule,
} from '@/lib/evaluator/module-eval-prompts';

describe('combat-trace evaluator pass', () => {
  it('is not part of the global default passes', () => {
    expect(EVAL_PASSES).not.toContain('combat-trace');
  });

  it('is appended only for arpg-combat', () => {
    expect(getPassesForModule('arpg-combat')).toContain('combat-trace');
    expect(getPassesForModule('arpg-loot')).not.toContain('combat-trace');
  });

  it('has a label', () => {
    expect(PASS_LABELS['combat-trace']).toBe('Combat Trace');
  });

  it('produces a one-hit call-graph prompt for arpg-combat', () => {
    const out = buildEvalPrompt({
      moduleId: 'arpg-combat', pass: 'combat-trace',
      projectName: 'PoF', moduleName: 'PoF', sourcePath: 'Source/PoF',
    });
    const lower = out.toLowerCase();
    expect(lower).toContain('trace one hit');
    expect(lower).toContain('call graph');
    expect(lower).toContain('attributes read');
    expect(lower).toContain('binary asset');
    expect(out).toMatchSnapshot();
  });
});
