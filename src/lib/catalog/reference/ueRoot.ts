/**
 * Where a Diablo-replication entity's UE content lives (/diablo W05). Under /Game/Diablo — which the
 * UE repo gitignores, so reference-game content stays local. One helper, so the import script's
 * destination and every step's declared `ueAssets` can never disagree (they did: W04 declared
 * /Game/Bestiary/<id>/..., which never existed).
 *
 * The folder is the display name — except that Diablo I reuses names across families (11 names on
 * 22 of 112 monsters: the axe and the bow "Skeleton", two "Burning Dead"...), which would put two
 * monsters in one folder (W07). A name another entity also carries gets its source key appended; a
 * unique name keeps its folder, so content already imported does not move.
 */
export function diabloUeRoot(name: string, id?: string, shared: ReadonlySet<string> = new Set()): { root: string; slug: string } {
  let slug = name.replace(/[^a-z0-9]+/gi, '');
  if (shared.has(name)) {
    if (!id) throw new Error(`"${name}" is shared by several source rows — its UE folder needs the entity id`);
    slug = `${slug}_${id.replace(/^d1-(MT_)?/, '')}`;
  }
  return { root: `/Game/Diablo/Bestiary/${slug}`, slug };
}

/** The names two or more entities carry — computed over the WHOLE source table, not the promoted slice. */
export function sharedNames(entities: readonly { name: string }[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const e of entities) (seen.has(e.name) ? dup : seen).add(e.name);
  return dup;
}
