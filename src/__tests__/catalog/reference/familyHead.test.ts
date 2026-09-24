// /diablo W07: a family member's head is DERIVED from the art-set key (monstdat `assetsSuffix`, mapped to
// `data.artSet` in W07) instead of typed on the command line (W06). The head is the member that owns its
// rigged mesh — every other member shares it.
import { describe, it, expect } from 'vitest';
import { familyHeadOf } from '@/lib/catalog/reference/familyHead';

const e = (id: string, artSet?: string) => ({ id, data: artSet ? { artSet } : {} });

describe('familyHeadOf', () => {
  const entities = [e('a', 'bones'), e('b', 'bones'), e('c', 'bones'), e('z', 'rot')];
  const owns = new Map([['a', { owned: true }], ['b', { owned: false }], ['z', { owned: true }]]);
  const rig = (id: string) => owns.get(id) ?? null;

  it('finds the member of the same art set that owns its rigged mesh', () => {
    expect(familyHeadOf(e('c', 'bones'), entities, rig)).toEqual({ ok: true, headId: 'a', artSet: 'bones' });
  });

  it('refuses an entity with no art set', () => {
    expect(familyHeadOf(e('q'), entities, rig)).toMatchObject({ ok: false, reason: expect.stringMatching(/art set/) });
  });

  it('refuses when no member of the set owns a rigged mesh yet', () => {
    expect(familyHeadOf(e('c', 'bones'), entities, () => null)).toMatchObject({ ok: false, reason: expect.stringMatching(/no member.*owns/) });
  });

  it('refuses an ambiguous family rather than picking one', () => {
    const two = new Map([['a', { owned: true }], ['b', { owned: true }]]);
    expect(familyHeadOf(e('c', 'bones'), entities, (id) => two.get(id) ?? null)).toMatchObject({ ok: false, reason: expect.stringMatching(/a, b/) });
  });

  it('never names the member itself as its own head', () => {
    expect(familyHeadOf(e('a', 'bones'), entities, rig)).toMatchObject({ ok: false });
  });
});
