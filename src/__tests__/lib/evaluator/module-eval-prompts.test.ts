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

describe('arpg-combat quality checks — real-time design semantics (T. Cain, RT-vs-TB)', () => {
  it('requires AoE/targeted abilities to define moving-target behavior (telegraph vs homing)', () => {
    const q = MODULE_CONTEXTS['arpg-combat'].qualityChecks;
    expect(q).toMatch(/telegraph/i);
    expect(q).toMatch(/homing|track/i);
    expect(q).toMatch(/turn-based/i);
  });
  it('requires timed effects to use real-time seconds with escapable, visible telegraphs', () => {
    const q = MODULE_CONTEXTS['arpg-combat'].qualityChecks;
    expect(q).toMatch(/real-time seconds|seconds, not turn/i);
    expect(q).toMatch(/escap/i);
  });
  it('requires active defenses to split player-timed trigger from stat-driven magnitude', () => {
    const q = MODULE_CONTEXTS['arpg-combat'].qualityChecks;
    expect(q).toMatch(/player-timed|player.s timing/i);
    expect(q).toMatch(/character stat|stat-driven/i);
  });
});

describe('arpg-world structure checks — PCG procedural placement', () => {
  it('recommends PCG for large-scale content with parameters/graph-instances', () => {
    const s = MODULE_CONTEXTS['arpg-world'].structureChecks;
    expect(s).toMatch(/PCG/);
    expect(s).toMatch(/graph instance|parameter|hierarchical/i);
  });
});
