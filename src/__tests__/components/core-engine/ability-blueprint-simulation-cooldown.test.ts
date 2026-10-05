/**
 * The Simulation Sandbox must preview what the generator actually wires, not a
 * different reading of the same field.
 *
 * `cooldownSec` is documented in `codegen.ts` (and drawn that way in
 * `EffectTimelineEditor`'s timeline, where the cooldown block renders AFTER the
 * duration block) as the ABILITY's cooldown — never a GameplayEffect Period.
 * `generateEffectsCode` never wires it as a Period; it is emitted only as a
 * comment about a separate Cooldown GE. The simulator previously treated the
 * same field as a tick interval and re-applied a duration effect's modifiers
 * every `cooldownSec`, so the sandbox showed repeated ticks (e.g. a 10s regen
 * applying five times) for an effect the generated C++ applies exactly once.
 *
 * Standard: ai-registry `game-production/ability-authoring-to-engine` —
 * "declared-vs-referenced-tag-audit" / the coherence layer: two readings of one
 * field that must agree, where only one matched the documented contract.
 */
import { describe, it, expect } from 'vitest';
import { runSimulation } from '@/components/modules/core-engine/sub_ability/blueprint/SimulationSandbox/simulation';
import type { EditorAttribute, EditorEffect, AttrRelationship, QueuedEffect } from '@/components/modules/core-engine/sub_ability/blueprint/SimulationSandbox/types';

const health: EditorAttribute = { id: 'a-hp', name: 'Health', category: 'vital', defaultValue: 0, clampMin: 0 };

const regen: EditorEffect = {
  id: 'e-regen',
  name: 'GE_Regen_Health',
  duration: 'duration',
  durationSec: 10,
  cooldownSec: 2,
  color: '#fff',
  modifiers: [{ attribute: 'Health', operation: 'add', magnitude: 5 }],
  grantedTags: [],
};

describe('runSimulation never reads cooldownSec as a tick period', () => {
  it('applies a duration effect\'s modifier once, not every cooldownSec', () => {
    const queue: QueuedEffect[] = [{ id: 'q1', effectId: 'e-regen', triggerTime: 0 }];
    const snapshots = runSimulation([health], [regen], [] as AttrRelationship[], queue, {}, 10);

    const final = snapshots[snapshots.length - 1];
    // Exactly one application of +5 (not five, which the old tick-every-2s read produced).
    expect(final.values.Health).toBe(5);
    expect(snapshots.some((s) => s.events.some((e) => e.includes('tick')))).toBe(false);
  });
});
