/**
 * The D23 player anchors, loaded ONCE for every /diablo conversion (monster stat rows, W07; spell damage, W13): the
 * reference hero from the class tables under the data root, PoF's player from the UE source defaults. Both refuse a
 * missing number rather than default it (playerScale.ts). Values are read at run time, never stored in the repo.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseTsv } from '../../src/lib/catalog/ingest/tsv';
import { diabloReferencePlayer, uePlayerAnchor, type PlayerAnchor } from '../../src/lib/catalog/reference/playerScale';

export const UPROJECT = process.env.POF_UPROJECT ?? 'C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject';
export const UE_SRC = resolve(UPROJECT, '..', 'Source', 'PoF', 'AbilitySystem');

export function tsvRows(root: string, rel: string): Record<string, string>[] {
  const t = parseTsv(readFileSync(join(root, rel), 'utf8'));
  if (t.refusal) throw new Error(`${rel}: ${t.refusal.message}`);
  return t.rows;
}

/** A Variable/Value (or Attribute/Value) class table as a map. */
export const kv = (rows: Record<string, string>[], k: string, v: string): Record<string, string> =>
  Object.fromEntries(rows.map((r) => [r[k], r[v]]));

export function classNameOf(root: string, cls: string): string {
  return kv(tsvRows(root, 'classes/classdat.tsv'), 'folderName', 'className')[cls] ?? cls;
}

/** Reference hero (class `cls`, level 1, starting weapon = loadout item0) and PoF's player. */
export function loadHitAnchors(root: string, cls = 'warrior'): { from: PlayerAnchor; to: PlayerAnchor } {
  const attributes = kv(tsvRows(root, `classes/${cls}/attributes.tsv`), 'Attribute', 'Value');
  const item0 = kv(tsvRows(root, `classes/${cls}/starting_loadout.tsv`), 'Variable', 'Value').item0;
  const weaponRow = tsvRows(root, 'items/itemdat.tsv').find((r) => r.id === item0);
  if (!weaponRow) throw new Error(`REFUSED: starting weapon ${item0} is not in itemdat`);
  const from = diabloReferencePlayer({
    className: classNameOf(root, cls), attributes,
    weapon: { name: weaponRow.name, minDamage: Number(weaponRow.minDamage), maxDamage: Number(weaponRow.maxDamage) },
  });
  const to = uePlayerAnchor({
    attributeSetCpp: readFileSync(join(UE_SRC, 'ARPGAttributeSet.cpp'), 'utf8'),
    meleeHeader: readFileSync(join(UE_SRC, 'GA_MeleeAttack.h'), 'utf8'),
  });
  return { from, to };
}
