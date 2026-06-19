import { describe, it, expect } from 'vitest';
import { MODULE_CONTEXTS } from '@/lib/evaluator/module-eval-prompts';

describe('arpg-world performance checks — asset polygon budget', () => {
  it('flags per-asset polygon budgets / mesh optimization (Nanite or LODs)', () => {
    const perf = MODULE_CONTEXTS['arpg-world'].performanceChecks;
    expect(perf).toMatch(/polygon|poly budget/i);
    expect(perf).toMatch(/Nanite|LOD/);
  });
});
