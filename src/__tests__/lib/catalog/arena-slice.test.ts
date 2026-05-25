import { describe, it, expect } from 'vitest';
import {
  RAVAGED_COURTYARD,
  validateArenaSlice,
  isArenaSlice,
  type ArenaSliceSpec,
} from '@/lib/catalog/arena-slice';
import { arenaSliceToEntry, seedArenaSliceEntries } from '@/lib/catalog/seed-combat-map';
import { seedBestiaryEntries } from '@/lib/catalog/seed-bestiary';
import { seedAllCatalogs } from '@/lib/catalog/sections';

/** Archetype ids the bestiary actually seeds (entry id is `bestiary-<archetype>`). */
const ARCHETYPE_IDS = seedBestiaryEntries().map((e) => e.id.replace(/^bestiary-/, ''));

describe('validateArenaSlice — the design/balance gate', () => {
  it('the seeded Ravaged Courtyard is well-formed against UE invariants', () => {
    expect(validateArenaSlice(RAVAGED_COURTYARD, ARCHETYPE_IDS)).toEqual([]);
    expect(isArenaSlice(RAVAGED_COURTYARD)).toBe(true);
  });

  it('flags an empty wave list (an arena needs at least one wave)', () => {
    const bad: ArenaSliceSpec = { ...RAVAGED_COURTYARD, waves: [] };
    expect(validateArenaSlice(bad)).toContain('an arena slice needs at least one wave');
  });

  it('flags a wave referencing an unknown bestiary archetype (cross-catalog integrity)', () => {
    const bad: ArenaSliceSpec = {
      ...RAVAGED_COURTYARD,
      waves: [{ enemyArchetype: 'not-a-real-creature', count: 1, spawnIntervalSec: 0, delayBeforeWaveSec: 0, difficultyMultiplier: 1 }],
    };
    const problems = validateArenaSlice(bad, ARCHETYPE_IDS);
    expect(problems.some((p) => p.includes("unknown bestiary archetype 'not-a-real-creature'"))).toBe(true);
  });

  it('flags cover placed outside the arena bounds and sub-minimum width', () => {
    const bad: ArenaSliceSpec = {
      ...RAVAGED_COURTYARD,
      cover: [{ location: [9999, 0, 0], kind: 'pillar', widthCm: 10 }],
    };
    const problems = validateArenaSlice(bad);
    expect(problems.some((p) => p.includes('outside the arena bounds'))).toBe(true);
    expect(problems.some((p) => p.includes('widthCm must be >= 50'))).toBe(true);
  });

  it('requires survivalSeconds when winCondition is survive-duration', () => {
    const bad: ArenaSliceSpec = { ...RAVAGED_COURTYARD, winCondition: 'survive-duration', survivalSeconds: undefined };
    expect(validateArenaSlice(bad)).toContain("winCondition 'survive-duration' requires a positive survivalSeconds");
  });

  it('flags a sub-minimum wave count and difficulty multiplier', () => {
    const bad: ArenaSliceSpec = {
      ...RAVAGED_COURTYARD,
      waves: [{ enemyArchetype: 'kath-hound', count: 0, spawnIntervalSec: 0, delayBeforeWaveSec: 0, difficultyMultiplier: 0.5 }],
    };
    const problems = validateArenaSlice(bad, ARCHETYPE_IDS);
    expect(problems.some((p) => p.includes('count must be >= 1'))).toBe(true);
    expect(problems.some((p) => p.includes('difficultyMultiplier must be >= 1.0'))).toBe(true);
  });
});

describe('arenaSliceToEntry / seedArenaSliceEntries', () => {
  it('prefixes the id, sets the Arenas category, tags by position, keeps the spec as data', () => {
    const e = arenaSliceToEntry(RAVAGED_COURTYARD);
    expect(e.id).toBe('arena-ravaged-courtyard');
    expect(e.catalogId).toBe('combat-map');
    expect(e.categoryPath).toEqual(['Combat Map', 'Arenas']);
    expect(e.tags).toEqual(['arena', 'middle']);
    expect(e.lifecycle).toBe('planned');
    expect(e.data).toBe(RAVAGED_COURTYARD);
  });

  it('wires each distinct wave archetype as a bestiary cross-catalog link that resolves', () => {
    const e = arenaSliceToEntry(RAVAGED_COURTYARD);
    const bestiaryIds = new Set(seedBestiaryEntries().map((b) => b.id));
    expect(e.links?.length).toBeGreaterThan(0);
    for (const link of e.links ?? []) {
      expect(link.catalogId).toBe('bestiary');
      expect(link.role).toBe('spawn');
      // The referenced bestiary entity must actually exist in the seed.
      expect(bestiaryIds.has(link.entityId)).toBe(true);
    }
  });

  it('seeds exactly the ARENA_SLICES, all valid', () => {
    const entries = seedArenaSliceEntries();
    expect(entries.length).toBeGreaterThanOrEqual(1);
    for (const e of entries) expect(validateArenaSlice(e.data, ARCHETYPE_IDS)).toEqual([]);
  });
});

describe('combat-map catalog composition', () => {
  it('the combat-map section now carries the arena slice alongside the combos', () => {
    const seeded = seedAllCatalogs();
    const combatMap = seeded['combat-map'];
    expect(combatMap['arena-ravaged-courtyard']).toBeDefined();
    expect(combatMap['arena-ravaged-courtyard'].lifecycle).toBe('planned');
    // The legacy combo entries are still present (regression guard).
    expect(Object.keys(combatMap).some((id) => id.startsWith('combo-'))).toBe(true);
  });
});
