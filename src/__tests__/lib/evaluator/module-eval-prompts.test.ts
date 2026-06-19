import { describe, it, expect } from 'vitest';
import { MODULE_CONTEXTS } from '@/lib/evaluator/module-eval-prompts';

describe('arpg-world performance checks — asset polygon budget', () => {
  it('flags per-asset polygon budgets / mesh optimization (Nanite or LODs)', () => {
    const perf = MODULE_CONTEXTS['arpg-world'].performanceChecks;
    expect(perf).toMatch(/polygon|poly budget/i);
    expect(perf).toMatch(/Nanite|LOD/);
  });
});

describe('arpg-animation quality checks — generated / AI motion sources', () => {
  it('flags AI mocap cleanup + coverage beyond the Mixamo library', () => {
    const q = MODULE_CONTEXTS['arpg-animation'].qualityChecks;
    expect(q).toMatch(/mocap|video-to-motion|generated motion/i);
    expect(q).toMatch(/cleanup|foot slid|jitter/i);
  });
});
