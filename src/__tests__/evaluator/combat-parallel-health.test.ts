import { describe, it, expect } from 'vitest';
import { buildEvalPrompt } from '@/lib/evaluator/module-eval-prompts';

describe('combat parallel-Health detector', () => {
  it('the quality pass flags the two-Health-systems pitfall', () => {
    const out = buildEvalPrompt({
      moduleId: 'arpg-combat', pass: 'quality',
      projectName: 'PoF', moduleName: 'PoF', sourcePath: 'Source/PoF',
    });
    const lower = out.toLowerCase();
    expect(lower).toContain('two health');
    expect(lower).toContain('plain float');
    expect(lower).toContain('postgameplayeffectexecute');
  });
});
