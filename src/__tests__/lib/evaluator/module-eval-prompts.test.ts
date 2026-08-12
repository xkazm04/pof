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

describe('arpg-world — level design guidelines (T. Cain, 8 rules)', () => {
  it('classifies encounters as anchored vs non-anchored with a small wander cap', () => {
    const s = MODULE_CONTEXTS['arpg-world'].structureChecks;
    expect(s).toMatch(/anchored/i);
    expect(s).toMatch(/wander/i);
    expect(s).toMatch(/one or two|conga/i);
  });
  it('requires a visible POI landmark from any point of an outdoor map', () => {
    const s = MODULE_CONTEXTS['arpg-world'].structureChecks;
    expect(s).toMatch(/point of interest|POI|landmark/i);
    expect(s).toMatch(/orient/i);
  });
});

describe('dialogue-quests — dedicated eval context (was generic fallback)', () => {
  it('has a context with a dialog/quest focus', () => {
    const ctx = MODULE_CONTEXTS['dialogue-quests'];
    expect(ctx).toBeDefined();
    expect(ctx.focus).toMatch(/dialog|quest/i);
  });
  it('bans one-shot dialog solutions in favor of multi-stage setups', () => {
    const q = MODULE_CONTEXTS['dialogue-quests'].qualityChecks;
    expect(q).toMatch(/one-shot/i);
    expect(q).toMatch(/multi-stage|gathered elsewhere/i);
  });
  it('demands playthrough-build solution coverage balance', () => {
    const q = MODULE_CONTEXTS['dialogue-quests'].qualityChecks;
    expect(q).toMatch(/playthrough build|build coverage/i);
    expect(q).toMatch(/main (story )?quest/i);
  });
});

describe('ai-behavior quality checks — melee reservation slots (T. Cain, WildStar)', () => {
  it('names the positional reservation/slot pattern with its lifecycle', () => {
    const q = MODULE_CONTEXTS['ai-behavior'].qualityChecks;
    expect(q).toMatch(/reservation|attack slot/i);
    expect(q).toMatch(/confirm/i);
    expect(q).toMatch(/cancel/i);
  });
});

describe('arpg-progression quality checks — trait economy (GURPS Fallout)', () => {
  it('describes point-symmetric advantages/disadvantages and cheap quirk hooks', () => {
    const q = MODULE_CONTEXTS['arpg-progression'].qualityChecks;
    expect(q).toMatch(/disadvantage|drawback/i);
    expect(q).toMatch(/quirk/i);
    expect(q).toMatch(/reputation traits per faction|faction reputation/i);
  });
});

describe('arpg-world structure checks — PCG procedural placement', () => {
  it('recommends PCG for large-scale content with parameters/graph-instances', () => {
    const s = MODULE_CONTEXTS['arpg-world'].structureChecks;
    expect(s).toMatch(/PCG/);
    expect(s).toMatch(/graph instance|parameter|hierarchical/i);
  });
});
