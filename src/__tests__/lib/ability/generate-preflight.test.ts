import { describe, it, expect } from 'vitest';
import {
  preflightGenerate, applyPreflightFix, applyAllPreflightFixes, type PreflightFinding,
} from '@/lib/ability/generate-preflight';
import { buildGenerateAbilityBundlePrompt, resolveGenerateCooldown } from '@/lib/ability/effect-codegen-prompt';
import { deriveDefaultSpec } from '@/lib/ability/spec';
import type { EditorAttribute, EditorEffect } from '@/lib/gas-codegen';
import { MELEE_COMBO, GAS_TEMPLATES } from '@/components/modules/core-engine/sub_ability/blueprint/templates';
import { SEED_ATTRIBUTES } from '@/components/modules/core-engine/sub_ability/blueprint/data';
import { SPELLBOOK_ABILITIES } from '@/components/modules/core-engine/sub_ability/_shared/data';

/** Fireball's catalog scalars — the ones the binding sends with every generate. */
const FIREBALL_SCALARS = { damage: 35, manaCost: 20, cooldown: 3 };

const byKind = (findings: PreflightFinding[], kind: PreflightFinding['kind']) =>
  findings.filter((f) => f.kind === kind);

/** Case 2 / damage-override fixture: GE_X authors Health -50 next to other data. */
const GE_X: EditorEffect = {
  id: 'e-x', name: 'GE_X', duration: 'instant', durationSec: 0, cooldownSec: 0, color: 'var(--x)',
  modifiers: [
    { attribute: 'Health', operation: 'add', magnitude: -50 },
    { attribute: 'Mana', operation: 'add', magnitude: -5 },
  ],
  grantedTags: ['State.Burning'],
};
const GE_Y: EditorEffect = {
  id: 'e-y', name: 'GE_Y', duration: 'duration', durationSec: 2, cooldownSec: 0, color: 'var(--y)',
  modifiers: [{ attribute: 'Mana', operation: 'add', magnitude: 10 }], grantedTags: [],
};
const VITALS: EditorAttribute[] = [
  { id: 'a-hp', name: 'Health', category: 'vital', defaultValue: 100 },
  { id: 'a-mp', name: 'Mana', category: 'vital', defaultValue: 50 },
];

describe('preflightGenerate — damage pin (surface-only when unpinnable)', () => {
  it('case 1: MELEE_COMBO damages only through IncomingDamage -> damage-unpinned on GE_Slash1, no one-click fix', () => {
    const pf = preflightGenerate({ scalars: FIREBALL_SCALARS, effects: MELEE_COMBO.effects, attributes: MELEE_COMBO.attributes });
    const unpinned = byKind(pf.findings, 'damage-unpinned');
    expect(unpinned).toHaveLength(1);
    expect(unpinned[0]).toMatchObject({ kind: 'damage-unpinned', severity: 'override', effectName: 'GE_Slash1', fix: null });
    // Meta-attribute vs direct Health is a design call: fixing everything must NOT
    // invent a Health -35 beside IncomingDamage +15 (double damage).
    const fixed = applyAllPreflightFixes({ effects: MELEE_COMBO.effects, attributes: MELEE_COMBO.attributes }, pf.findings);
    expect(fixed.effects).toEqual(MELEE_COMBO.effects);
    expect(fixed.effects.some((e) => e.modifiers.some((m) => m.attribute === 'Health'))).toBe(false);
  });

  it('case 2: an authored Health -50 vs catalog 35 -> damage-override; its fix sets -35 and nothing else', () => {
    const effects = [GE_X, GE_Y];
    const pf = preflightGenerate({ scalars: FIREBALL_SCALARS, effects, attributes: VITALS });
    const over = byKind(pf.findings, 'damage-override');
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ kind: 'damage-override', severity: 'override', effectName: 'GE_X', authored: -50, catalog: -35 });
    expect(over[0].fix).not.toBeNull();

    const slices = { effects, attributes: VITALS };
    const out = applyPreflightFix(slices, over[0].fix!);
    expect(out.effects[0].modifiers[0]).toEqual({ attribute: 'Health', operation: 'add', magnitude: -35 });
    expect(out.effects[0]).toEqual({ ...GE_X, modifiers: [{ ...GE_X.modifiers[0], magnitude: -35 }, GE_X.modifiers[1]] });
    expect(out.effects[1]).toEqual(GE_Y);
    expect(out.attributes).toEqual(VITALS);
    // Pure: the input is untouched.
    expect(GE_X.modifiers[0].magnitude).toBe(-50);
  });
});

describe('preflightGenerate — cooldown, TODO and no-op predictions', () => {
  it('case 3: DoT per-effect cooldowns are replaced by the resolved catalog cooldown (never a GE Period)', () => {
    const dot = GAS_TEMPLATES.find((t) => t.id === 'damage-over-time')!;
    const scalars = { cooldown: 3 };
    const pf = preflightGenerate({ scalars, effects: dot.effects, attributes: dot.attributes });
    const cds = byKind(pf.findings, 'cooldown-override');
    expect(cds.map((f) => f.effectName)).toEqual(['GE_Poison_Stack', 'GE_Bleed_Stack']);
    const resolved = resolveGenerateCooldown(dot.effects, scalars);
    expect(resolved).toBe(3);
    for (const f of cds) {
      expect(f.severity).toBe('override');
      expect(f.resolvedSec).toBe(resolved);
      expect(f.message).toContain('3s');
      expect(f.message).toMatch(/NOT .*GE Period/);
    }
  });

  it('case 3b: the prompt writes exactly the cooldown the preflight predicts (one rule, not a copy)', () => {
    const ref = { name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'basic' };
    const dot = GAS_TEMPLATES.find((t) => t.id === 'damage-over-time')!;
    for (const scalars of [{ cooldown: 3 }, {}, { cooldown: 7.5 }]) {
      const sec = resolveGenerateCooldown(dot.effects, scalars);
      expect(buildGenerateAbilityBundlePrompt(ref, dot.effects, [], scalars)).toContain(`FScalableFloat(${sec}f)`);
    }
  });

  it('case 4: no effects -> exactly one blocking nothing-to-generate finding', () => {
    const pf = preflightGenerate({ scalars: FIREBALL_SCALARS, effects: [], attributes: SEED_ATTRIBUTES });
    expect(pf.findings).toHaveLength(1);
    expect(pf.findings[0]).toMatchObject({ kind: 'nothing-to-generate', severity: 'block' });
    expect(pf.canGenerate).toBe(false);
  });

  it('case 5: a modifier on an attribute outside the set -> unknown-attribute TODO; its fix appends it', () => {
    const effects: EditorEffect[] = [{
      ...GE_X, modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -35 }, { attribute: 'Stamina', operation: 'add', magnitude: -10 }],
    }];
    const pf = preflightGenerate({ scalars: FIREBALL_SCALARS, effects, attributes: VITALS });
    const unknown = byKind(pf.findings, 'unknown-attribute');
    expect(unknown).toHaveLength(1);
    expect(unknown[0]).toMatchObject({ kind: 'unknown-attribute', severity: 'todo', attribute: 'Stamina' });
    expect(unknown[0].message).toContain('TODO: unknown attribute');
    const out = applyPreflightFix({ effects, attributes: VITALS }, unknown[0].fix!);
    expect(out.attributes.map((a) => a.name)).toEqual(['Health', 'Mana', 'Stamina']);
    expect(out.effects).toEqual(effects);
    expect(preflightGenerate({ scalars: FIREBALL_SCALARS, ...out }).findings).toEqual([]);
  });

  it('case 6: the Fireball default spec with the seed attributes is clean', () => {
    const fireball = SPELLBOOK_ABILITIES.find((a) => a.id === 'off-fire-01')!;
    const spec = deriveDefaultSpec('spellbook', fireball);
    const pf = preflightGenerate({
      scalars: { damage: fireball.damage, manaCost: fireball.manaCost, cooldown: fireball.cooldown },
      effects: spec.effects, attributes: SEED_ATTRIBUTES,
    });
    expect(pf.findings).toEqual([]);
    expect(pf.canGenerate).toBe(true);
  });
});
