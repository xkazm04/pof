import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { D1_AI_ROUTINES } from '@/lib/catalog/reference/aiRoutines';

const laws = new Map(DIABLO1_CANON.map((law) => [law.id, law]));

describe('D1_AI_ROUTINES', () => {
  it('covers the 33 table-used identifiers with 28 engine-derived laws', () => {
    expect(Object.keys(D1_AI_ROUTINES)).toHaveLength(33);
    expect(new Set(Object.values(D1_AI_ROUTINES).map((routine) => routine.lawId))).toHaveLength(28);
    for (const routine of Object.values(D1_AI_ROUTINES)) expect(laws.has(routine.lawId)).toBe(true);
  });

  it('keeps linear roll and distance numbers visible in the corresponding canon law', () => {
    const mismatches: string[] = [];
    for (const [ai, routine] of Object.entries(D1_AI_ROUTINES)) {
      const body = laws.get(routine.lawId)!.body;
      for (const roll of routine.rolls) {
        if (!('linear' in roll.chance)) continue;
        for (const number of [roll.chance.linear.perIntelligence, roll.chance.linear.base]) {
          if (!body.includes(String(number))) mismatches.push(`${ai} linear ${number}`);
        }
      }
      for (const entry of routine.distances) {
        for (const number of entry.tiles.match(/\d+/g) ?? []) {
          if (!body.includes(number)) mismatches.push(`${ai} distance ${number}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('marks only the two table-used Hellfire routines and uses only pinned remote refs', () => {
    expect(Object.entries(D1_AI_ROUTINES).filter(([, routine]) => routine.hellfire).map(([ai]) => ai)).toEqual(['FireMan', 'HorkDemon']);
    for (const lawId of new Set(Object.values(D1_AI_ROUTINES).map((routine) => routine.lawId))) {
      const law = laws.get(lawId)!;
      expect(law.body.length).toBeLessThanOrEqual(450);
      expect(law.refs?.every((ref) => ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/monster.cpp'))).toBe(true);
    }
  });

  it('matches the real table AI vocabulary when the pinned tables are present', () => {
    const files = ['monstdat.tsv', 'unique_monstdat.tsv'].map((name) => resolve('.reference/devilutionX/assets/txtdata/monsters', name));
    if (files.some((file) => !existsSync(file))) return;
    const vocabulary = new Set<string>();
    for (const file of files) {
      const [header, ...rows] = readFileSync(file, 'utf8').trim().split(/\r?\n/);
      const aiColumn = header.split('\t').indexOf('ai');
      expect(aiColumn).toBeGreaterThanOrEqual(0);
      for (const row of rows) {
        const ai = row.split('\t')[aiColumn];
        if (ai) vocabulary.add(ai);
      }
    }
    expect([...vocabulary].sort()).toEqual(Object.keys(D1_AI_ROUTINES).sort());
  });

  it('retains the corrected history-sensitive and long-range branches structurally', () => {
    expect(D1_AI_ROUTINES.Zombie.rolls[1].chance).toEqual({ linear: { perIntelligence: 2, base: 20 } });
    expect(D1_AI_ROUTINES.SkeletonRanged.rolls.map((entry) => entry.chance)).toEqual([
      { linear: { perIntelligence: 2, base: 13 } },
      { linear: { perIntelligence: 2, base: 63 } },
      { linear: { perIntelligence: 2, base: 3 } },
    ]);
  });
});
