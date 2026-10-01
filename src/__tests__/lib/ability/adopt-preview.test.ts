import { describe, it, expect } from 'vitest';
import { suggestAdoptTargets, previewAdopt } from '@/lib/ability/adopt-preview';
import { forgedAbilityToSpec } from '@/lib/ability/forge-adopt';
import { deriveDefaultSpec, type EnrichedAbilitySpec, type CodegenReport } from '@/lib/ability/spec';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';
import { SPELLBOOK_ABILITIES } from '@/components/modules/core-engine/sub_ability/_shared/data';

const iceForged: ForgedAbility = {
  className: 'GA_IceLance',
  displayName: 'Ice Lance',
  description: 'A piercing lance of ice that slows',
  headerCode: '// header',
  cppCode: '// cpp',
  tags: { abilityTag: 'Ability.Ice.Lance', cooldownTag: 'Cooldown.IceLance', ownedTags: ['State.Casting'], blockedTags: ['State.Dead', 'State.Stunned'] },
  stats: { baseDamage: 30, manaCost: 15, cooldownSec: 2, damageType: 'Ice' },
  comboEntry: { animDuration: 1, damageWindow: [0.2, 0.5], recovery: 0.3, comboMultiplier: 1 },
  radarValues: [0.55, 0.8, 0.1, 0.7, 0.65],
};

const confirmed: CodegenReport = {
  status: 'confirmed', filesWritten: ['Source/X/GA_OldLance.h'], buildOk: true, seedRan: true,
  dataTableRows: 1, missingTags: [], reportedAt: '2026-10-01T00:00:00Z',
};

const iceShard = SPELLBOOK_ABILITIES.find((a) => a.id === 'off-ice-01')!;
const next = () => forgedAbilityToSpec('spellbook', 'off-ice-01', iceForged, 'an ice lance');

describe('suggestAdoptTargets — element first, then nearest radar', () => {
  it('an Ice forge with Ice Shard\'s radar ranks off-ice-01 first', () => {
    const s = suggestAdoptTargets({ damageType: 'Ice', radarValues: [0.55, 0.8, 0.1, 0.7, 0.65] }, SPELLBOOK_ABILITIES);
    expect(s[0].id).toBe('off-ice-01');
  });

  it('an Ice storm-shaped forge ranks Blizzard first and all top 3 are Ice', () => {
    const s = suggestAdoptTargets({ damageType: 'Ice', radarValues: [0.8, 0.6, 0.9, 0.2, 0.2] }, SPELLBOOK_ABILITIES);
    expect(s[0].id).toBe('off-ice-03');
    expect(s).toHaveLength(3);
    for (const x of s) expect(x.element).toBe('Ice');
  });

  it('damageType None ranks every element by radar only (Fire Storm radar -> off-fire-02)', () => {
    const s = suggestAdoptTargets({ damageType: 'None', radarValues: [0.8, 0.6, 0.9, 0.25, 0.2] }, SPELLBOOK_ABILITIES);
    expect(s[0].id).toBe('off-fire-02');
  });
});

describe('previewAdopt — what the slice-merge will replace', () => {
  it('no stored spec -> fresh: every forged effect added, nothing removed, no confirm', () => {
    const p = previewAdopt(null, next());
    expect(p.status).toBe('fresh');
    expect(p.effects).toEqual({ added: ['GE_IceLance_Impact', 'GE_IceLance_ManaCost'], removed: [], changed: [] });
    expect(p.supersedes).toBeNull();
    expect(p.codegenAtRisk).toBe(false);
    expect(p.needsConfirm).toBe(false);
  });

  it('a stored spec with 1 effect + 2 unshared tag rules + a prior forge -> replaces exactly those', () => {
    const base = deriveDefaultSpec('spellbook', iceShard);
    expect(base.effects.map((e) => e.name)).toEqual(['Ice Strike']);
    expect(base.tagRules).toHaveLength(2);
    const existing: EnrichedAbilitySpec = {
      ...base,
      provenance: { source: 'forge', className: 'GA_OldLance', displayName: 'Old Lance', damageType: 'Ice', headerCode: '', cppCode: '' },
    };
    const forgedNext = next();
    // Fixture premise: no stored rule shares an id or a sourceTag with the forged rules.
    for (const r of existing.tagRules) {
      expect(forgedNext.tagRules.some((n) => n.id === r.id || n.sourceTag === r.sourceTag)).toBe(false);
    }
    const p = previewAdopt(existing, forgedNext);
    expect(p.status).toBe('replaces');
    expect(p.effects.removed).toEqual(['Ice Strike']);
    expect(p.tagRules.removed.length).toBe(2);
    expect(p.tagRules.added.length).toBe(2);
    expect(p.supersedes).toEqual({ className: 'GA_OldLance', displayName: 'Old Lance' });
    expect(p.needsConfirm).toBe(true);
  });

  it('a confirmed codegen report on the replaced spec -> codegenAtRisk', () => {
    const existing: EnrichedAbilitySpec = { ...deriveDefaultSpec('spellbook', iceShard), codegen: confirmed };
    const p = previewAdopt(existing, next());
    expect(p.codegenAtRisk).toBe(true);
    expect(p.needsConfirm).toBe(true);
  });

  it('authored attributes/relationships/loadout are reported as kept (Adopt never names them)', () => {
    const existing: EnrichedAbilitySpec = {
      ...deriveDefaultSpec('spellbook', iceShard),
      attributes: [{ id: 'a1', name: 'Health', category: 'vital', baseValue: 100 } as never],
      loadout: [{ slot: 1 } as never],
    };
    const p = previewAdopt(existing, next());
    expect(p.keeps).toEqual(['attributes', 'loadout']);
  });

  it('an unloaded target (store slot undefined) -> unloaded and asks for confirmation', () => {
    const p = previewAdopt(undefined, next());
    expect(p.status).toBe('unloaded');
    expect(p.needsConfirm).toBe(true);
  });

  it('re-adopting the identical forge over its own row -> fresh, nothing at risk', () => {
    const own: EnrichedAbilitySpec = { ...next(), codegen: confirmed };
    const p = previewAdopt(own, next());
    expect(p.status).toBe('fresh');
    expect(p.supersedes).toBeNull();
    expect(p.codegenAtRisk).toBe(false);
  });
});
