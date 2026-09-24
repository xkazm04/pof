// /diablo W07: a monster's UE folder was keyed by its display NAME, and Diablo I reuses names across
// families (11 names on 22 of 112 monsters: the axe and the bow "Skeleton", two "Burning Dead"...).
// Two monsters would have written into one folder. A shared name is disambiguated by the source key;
// a unique name keeps its folder, so content already in UE (the zombies) does not move.
import { describe, it, expect } from 'vitest';
import { diabloUeRoot, sharedNames } from '@/lib/catalog/reference/ueRoot';

describe('diabloUeRoot', () => {
  const shared = sharedNames([{ name: 'Walker' }, { name: 'Bone Man' }, { name: 'Bone Man' }]);

  it('keeps a unique name as its folder (existing UE content never moves)', () => {
    expect(diabloUeRoot('Walker', 'd1-MT_WALK', shared)).toEqual({ root: '/Game/Diablo/Bestiary/Walker', slug: 'Walker' });
  });

  it('disambiguates a name another monster also carries, by the source key', () => {
    const a = diabloUeRoot('Bone Man', 'd1-MT_BONEA', shared);
    const b = diabloUeRoot('Bone Man', 'd1-MT_BONEB', shared);
    expect(a.slug).toBe('BoneMan_BONEA');
    expect(a.root).not.toBe(b.root);
  });

  it('refuses to place a shared name without its id rather than colliding', () => {
    expect(() => diabloUeRoot('Bone Man', undefined, shared)).toThrow(/shared/);
  });

  it('counts a name as shared only when two entities carry it', () => {
    expect([...sharedNames([{ name: 'A' }, { name: 'B' }, { name: 'A' }])]).toEqual(['A']);
  });
});
