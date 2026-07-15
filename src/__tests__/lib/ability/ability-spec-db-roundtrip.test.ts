import { describe, it, expect, beforeEach, vi } from 'vitest';

// Real better-sqlite3 against an in-memory DB — exercises the provenance column
// migration + upsert/read round-trip (not just the pure rowToSpec).
vi.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { upsertSpec, getSpec } from '@/lib/ability/ability-spec-db';
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
