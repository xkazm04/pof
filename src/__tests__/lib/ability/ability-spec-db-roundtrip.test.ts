import { describe, it, expect, beforeEach, vi } from 'vitest';

// Real better-sqlite3 against an in-memory DB — exercises the provenance column
// migration + upsert/read round-trip (not just the pure rowToSpec).
vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { upsertSpec, getSpec, setCodegenReport } from '@/lib/ability/ability-spec-db';
import { getDb } from '@/lib/db';
import { STATUS_NEUTRAL } from '@/lib/chart-colors';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';

beforeEach(() => {
  try { getDb().exec('DELETE FROM ability_specs'); } catch { /* table not yet created */ }
});

const withProv: EnrichedAbilitySpec = {
  catalogId: 'spellbook',
  entityId: 'off-fire-01',
  effects: [{ id: 'e', name: 'GE_X', duration: 'instant', durationSec: 0, cooldownSec: 3, color: STATUS_NEUTRAL, modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -35 }], grantedTags: [] }],
  tagRules: [{ id: 'r', sourceTag: 'Ability.Fire', targetTag: 'State.Dead', type: 'blocks' }],
  provenance: { source: 'forge', className: 'GA_Fireball', displayName: 'Fireball', damageType: 'Fire', prompt: 'a fireball', headerCode: '// h', cppCode: '// c' },
};

describe('ability-spec-db — provenance round-trip', () => {
  it('persists + reads back provenance (migration adds the column)', () => {
    const saved = upsertSpec(withProv);
    expect(saved.provenance?.className).toBe('GA_Fireball');
    const back = getSpec('spellbook', 'off-fire-01');
    expect(back?.provenance?.cppCode).toBe('// c');
    expect(back?.effects).toHaveLength(1);
    expect(back?.updatedAt).toBeTruthy();
  });

  it('a spec saved without provenance reads back undefined (additive, optional)', () => {
    upsertSpec({ catalogId: 'spellbook', entityId: 'off-ice-01', effects: [], tagRules: [] });
    expect(getSpec('spellbook', 'off-ice-01')?.provenance).toBeUndefined();
  });

  it('re-upsert without provenance clears the prior provenance', () => {
    upsertSpec(withProv);
    upsertSpec({ catalogId: 'spellbook', entityId: 'off-fire-01', effects: [], tagRules: [] });
    expect(getSpec('spellbook', 'off-fire-01')?.provenance).toBeUndefined();
  });
});

/* ── All five editor slices ─────────────────────────────────────────────── */

const allFive: EnrichedAbilitySpec = {
  ...withProv,
  entityId: 'off-arc-01',
  attributes: [
    { id: 'a1', name: 'Health', category: 'vital', defaultValue: 100, clampMin: 0, clampMax: 'MaxHealth' },
    { id: 'a2', name: 'Mana', category: 'vital', defaultValue: 50 },
  ],
  relationships: [
    { id: 'rel1', sourceId: 'a2', targetId: 'a1', type: 'scale', formula: 'Mana * 0.5' },
  ],
  loadout: [
    { id: 'l1', slot: 1, abilityName: 'Arcane Bolt', iconColor: STATUS_NEUTRAL, cooldownTag: 'Cooldown.ArcaneBolt' },
  ],
};

describe('ability-spec-db — five-slice round-trip', () => {
  it('persists + reads back attributes / relationships / loadout', () => {
    upsertSpec(allFive);
    const back = getSpec('spellbook', 'off-arc-01');
    expect(back?.attributes).toHaveLength(2);
    expect(back?.attributes?.[0].clampMax).toBe('MaxHealth');
    expect(back?.relationships?.[0]).toEqual(allFive.relationships![0]);
    expect(back?.loadout?.[0].cooldownTag).toBe('Cooldown.ArcaneBolt');
    // The original two slices are untouched.
    expect(back?.effects).toHaveLength(1);
    expect(back?.tagRules).toHaveLength(1);
  });

  it('legacy row (no new slices) reads back undefined, never an empty-array lie', () => {
    upsertSpec({ catalogId: 'spellbook', entityId: 'off-ice-02', effects: [], tagRules: [] });
    const back = getSpec('spellbook', 'off-ice-02');
    expect(back?.attributes).toBeUndefined();
    expect(back?.relationships).toBeUndefined();
    expect(back?.loadout).toBeUndefined();
  });

  it('upsertSpec still never writes the codegen column (audit trail survives a Save)', () => {
    setCodegenReport('spellbook', 'off-arc-01', {
      status: 'confirmed', filesWritten: ['GE_X.h'], buildOk: true, seedRan: true,
      dataTableRows: 3, missingTags: [], reportedAt: '2026-07-29T00:00:00.000Z',
    });
    upsertSpec(allFive);
    const back = getSpec('spellbook', 'off-arc-01');
    expect(back?.codegen?.status).toBe('confirmed');
    expect(back?.codegen?.filesWritten).toEqual(['GE_X.h']);
  });
});
