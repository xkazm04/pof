import { describe, it, expect } from 'vitest';
import { mergeSpecWrite, type EnrichedAbilitySpec, type SpecProvenance } from '@/lib/ability/spec';
import { STATUS_NEUTRAL } from '@/lib/chart-colors';

/**
 * One slice-merge rule for every POST /api/ability-spec writer:
 * effects/tagRules always replace; attributes/relationships/loadout/provenance
 * replace when the write names them, are KEPT when the key is absent, and are
 * cleared only by an explicit `null`; codegen is never written by a spec write.
 */

const prov = (className: string): SpecProvenance => ({
  source: 'forge', className, displayName: className, damageType: 'Fire',
  prompt: 'p', headerCode: '// h', cppCode: '// c',
});

const existing: EnrichedAbilitySpec = {
  catalogId: 'spellbook',
  entityId: 'off-arc-01',
  effects: [{ id: 'e1', name: 'GE_A', duration: 'instant', durationSec: 0, cooldownSec: 3, color: STATUS_NEUTRAL, modifiers: [], grantedTags: [] }],
  tagRules: [{ id: 'r1', sourceTag: 'Ability.Arcane', targetTag: 'State.Dead', type: 'blocks' }],
  attributes: [
    { id: 'a1', name: 'Health', category: 'vital', defaultValue: 100 },
    { id: 'a2', name: 'Mana', category: 'vital', defaultValue: 50 },
  ],
  relationships: [{ id: 'rel1', sourceId: 'a2', targetId: 'a1', type: 'scale', formula: 'Mana * 0.5' }],
  loadout: [{ id: 'l1', slot: 1, abilityName: 'Arcane Bolt', iconColor: STATUS_NEUTRAL, cooldownTag: 'Cooldown.ArcaneBolt' }],
  provenance: prov('GA_Fireball'),
  codegen: {
    status: 'confirmed', filesWritten: ['GE_A.h'], buildOk: true, seedRan: true,
    dataTableRows: 1, missingTags: [], reportedAt: '2026-07-29T00:00:00.000Z',
  },
};

const e2 = { id: 'e2', name: 'GE_Ice', duration: 'instant' as const, durationSec: 0, cooldownSec: 1, color: STATUS_NEUTRAL, modifiers: [], grantedTags: [] };
const r2 = { id: 'r2', sourceTag: 'Ability.Ice', targetTag: 'State.Stunned', type: 'blocks' as const };

describe('mergeSpecWrite — absent key keeps, explicit null clears', () => {
  it('forge Adopt shape (no attributes/relationships/loadout keys) keeps the three authored slices', () => {
    const merged = mergeSpecWrite(existing, {
      catalogId: 'spellbook', entityId: 'off-arc-01',
      effects: [e2], tagRules: [r2], provenance: prov('GA_IceLance'),
    });
    expect(merged.effects).toEqual([e2]);
    expect(merged.tagRules).toEqual([r2]);
    expect(merged.provenance?.className).toBe('GA_IceLance');
    expect(merged.attributes).toEqual(existing.attributes);
    expect(merged.relationships).toEqual(existing.relationships);
    expect(merged.loadout).toEqual(existing.loadout);
  });

  it('blueprint Save shape (no provenance key) keeps the adopted provenance server-side', () => {
    const merged = mergeSpecWrite(existing, {
      catalogId: 'spellbook', entityId: 'off-arc-01',
      effects: [e2], tagRules: [r2],
      attributes: [existing.attributes![0]], relationships: [], loadout: existing.loadout,
    });
    expect(merged.provenance?.className).toBe('GA_Fireball');
    // Named slices replace (an empty array is an authored "none", not absence).
    expect(merged.attributes).toHaveLength(1);
    expect(merged.relationships).toEqual([]);
  });

  it('explicit provenance: null is the only way to clear a slice', () => {
    const merged = mergeSpecWrite(existing, {
      catalogId: 'spellbook', entityId: 'off-arc-01', effects: [], tagRules: [], provenance: null,
    });
    expect(merged.provenance).toBeUndefined();
    expect(merged.attributes).toEqual(existing.attributes);
  });

  it('explicit null clears each additive editor slice too', () => {
    const merged = mergeSpecWrite(existing, {
      catalogId: 'spellbook', entityId: 'off-arc-01', effects: [], tagRules: [],
      attributes: null, relationships: null, loadout: null,
    });
    expect(merged.attributes).toBeUndefined();
    expect(merged.relationships).toBeUndefined();
    expect(merged.loadout).toBeUndefined();
    expect(merged.provenance?.className).toBe('GA_Fireball');
  });

  it('[guard] no existing row: absent slices stay undefined (legacy/no-slice semantics)', () => {
    const merged = mergeSpecWrite(null, {
      catalogId: 'spellbook', entityId: 'new-01', effects: [e2], tagRules: [],
    });
    expect(merged).toEqual({ catalogId: 'spellbook', entityId: 'new-01', effects: [e2], tagRules: [] });
  });

  it('[guard] codegen is never taken from a write (callback-only column)', () => {
    const write = {
      catalogId: 'spellbook', entityId: 'off-arc-01', effects: [], tagRules: [],
      codegen: { ...existing.codegen!, status: 'failed' as const },
    };
    const merged = mergeSpecWrite(existing, write);
    expect(merged.codegen?.status).toBe('confirmed');
  });
});
