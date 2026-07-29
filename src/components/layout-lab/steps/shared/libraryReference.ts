/**
 * Referencing an asset the project ALREADY has from inside a pipeline step.
 *
 * PoF has a real local asset library — every asset downloaded through the browser is
 * recorded in `asset_library` with its source, license, tags and download URL — but a
 * pipeline step could not reach it. A step producing an environment, a material or a prop
 * therefore described assets in prose and the operator went hunting for them afterwards,
 * which is precisely the "you have to find the library somewhere" tax an integrated tool
 * removes.
 *
 * The license is not decoration here: it is the field that decides whether an asset can
 * ship in a game, the library already stores it, and a produce that cites an asset without
 * it hands downstream work a liability. An asset whose license the library never recorded
 * is therefore flagged as such rather than quietly omitted — silence would read as
 * unrestricted.
 *
 * Pure: no fetching, no persistence. The picker owns discovery; this owns what the picked
 * assets become in a prompt.
 */

import type { LibraryAsset } from '@/types/asset-library';

/** Shown when the library holds an asset with no recorded license. */
const NO_LICENSE = 'LICENSE NOT RECORDED — verify before shipping';

function licenseOf(a: LibraryAsset): string {
  return a.license.trim() || NO_LICENSE;
}

/** Prompt section listing the referenced assets, or '' when none are referenced. */
export function libraryBlock(assets: readonly LibraryAsset[]): string {
  if (!assets.length) return '';
  const lines = assets.map(
    (a) => `- ${a.name} (${a.source} · ${a.category}) — license: ${licenseOf(a)} — ${a.downloadUrl}`,
  );
  return [
    '## Referenced assets (already in the project’s asset library)',
    'These are already downloaded — use them rather than inventing or sourcing new assets,',
    'and carry each license through to whatever this step produces.',
    ...lines,
  ].join('\n');
}

/** One compact line per asset for the Produce panel's attachment list. */
export function libraryAttachmentLines(assets: readonly LibraryAsset[]): string[] {
  return assets.map((a) => `library · ${a.name} (${a.source}, ${licenseOf(a)})`);
}

/** Add an asset to the reference list (idempotent by id, insertion-ordered). */
export function addReference(assets: readonly LibraryAsset[], next: LibraryAsset): LibraryAsset[] {
  return assets.some((a) => a.id === next.id) ? [...assets] : [...assets, next];
}

/** Drop one asset by library id. */
export function removeReference(assets: readonly LibraryAsset[], id: string): LibraryAsset[] {
  return assets.some((a) => a.id === id) ? assets.filter((a) => a.id !== id) : [...assets];
}
