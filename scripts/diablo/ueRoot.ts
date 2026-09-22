/**
 * Where a Diablo-replication entity's UE content lives (/diablo W05). Under /Game/Diablo — which the
 * UE repo gitignores, so reference-game content stays local. One helper, so the import script's
 * destination and every step's declared `ueAssets` can never disagree (they did: W04 declared
 * /Game/Bestiary/<id>/..., which never existed).
 */
export function diabloUeRoot(name: string): { root: string; slug: string } {
  const slug = name.replace(/[^a-z0-9]+/gi, '');
  return { root: `/Game/Diablo/Bestiary/${slug}`, slug };
}
