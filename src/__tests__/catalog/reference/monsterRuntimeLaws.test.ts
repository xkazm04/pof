import { describe, expect, it } from 'vitest';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { DIABLO1_MONSTER_RUNTIME_LAWS } from '@/lib/catalog/reference/monsterRuntimeLawsData';

const EXPECTED_IDS = [
  'd1-monster-targeting-law',
  'd1-monster-animation-timing-law',
  'd1-special-attack-floor-law',
] as const;

describe('Diablo I monster runtime laws', () => {
  it('exports exactly the three concise bestiary laws and includes them in the canon', () => {
    expect(DIABLO1_MONSTER_RUNTIME_LAWS.map((law) => law.id)).toEqual(EXPECTED_IDS);
    for (const law of DIABLO1_MONSTER_RUNTIME_LAWS) {
      expect(law.scope).toBe('bestiary');
      expect(law.body.length, law.id).toBeLessThanOrEqual(450);
      expect(DIABLO1_CANON.some((candidate) => candidate.id === law.id), law.id).toBe(true);
    }
  });

  it('cites pinned monster.cpp lines for every law', () => {
    const pinnedMonsterSource = 'https://github.com/diasurgical/devilutionX/blob/4138a82/Source/monster.cpp#L';
    for (const law of DIABLO1_MONSTER_RUNTIME_LAWS) {
      expect(law.refs?.some((ref) => ref.startsWith(pinnedMonsterSource)), law.id).toBe(true);
    }
  });
});
