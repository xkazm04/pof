/**
 * The head of a monster's art-set family (/diablo W07): the member of the same `data.artSet` (monstdat
 * `assetsSuffix`) that OWNS its rigged mesh — every other member shares it (W06 family art sets). Derived,
 * so a family member no longer needs its head typed on the command line. Ambiguity is a refusal.
 */
export type FamilyHead = { ok: true; headId: string; artSet: string } | { ok: false; reason: string };

type Entity = { id: string; data?: unknown };
const artSetOf = (e: Entity): string => {
  const v = e.data && typeof e.data === 'object' ? (e.data as { artSet?: unknown }).artSet : undefined;
  return typeof v === 'string' ? v : '';
};

export function familyHeadOf(member: Entity, entities: readonly Entity[], rigOf: (id: string) => { owned: boolean } | null): FamilyHead {
  const artSet = artSetOf(member);
  if (!artSet) return { ok: false, reason: `${member.id} has no art set (data.artSet) — its family cannot be derived` };
  const heads = entities
    .filter((x) => x.id !== member.id && artSetOf(x) === artSet)
    .filter((x) => rigOf(x.id)?.owned === true)
    .map((x) => x.id);
  if (heads.length === 0) return { ok: false, reason: `no member of art set "${artSet}" owns a rigged mesh yet — produce the family head's 3D & Rig first` };
  if (heads.length > 1) return { ok: false, reason: `art set "${artSet}" has several mesh owners (${heads.join(', ')}) — name the head with --source` };
  return { ok: true, headId: heads[0], artSet };
}
