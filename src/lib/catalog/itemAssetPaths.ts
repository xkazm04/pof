/**
 * THE Items asset-path table — every UE path the Items pipeline declares, in one place.
 *
 * Both Items specs read it: the registered pipeline (`pipelines/items.ts`, which the server,
 * /status and the drains grade) and the bespoke lab specs (`layout-lab/steps/itemsSteps.ts`).
 * Before it existed they disagreed — the mesh was `/Game/Items/<slug>/SM_<slug>` on one side and
 * `/Game/Items/Meshes/SM_<slug>_LOD0` on the other — and UE Packaging hand-typed a manifest that
 * matched neither (10 of its 12 paths declared by no producing step, one a data-table ROW written
 * as a path). Now:
 *  • the slug is collision-safe on both halves (siblings injected; default = the items seed);
 *  • each producing step declares exactly its slice ({@link itemDeclaredAssets});
 *  • UE Packaging claims only paths some sibling declares ({@link itemPackagingClaim}) — its
 *    `ueAssets` ARE the claim the packaging drain verifies on disk, and a DT row is never a file.
 *
 * Pure and server-safe (no store, no React).
 */
import { seedItemEntries } from '@/lib/catalog/seed-items';

/** The minimum an entity needs to be addressed: identity, display name, optional seed data. */
export interface ItemRef { id: string; name: string; data?: unknown }

/** The four rarity frames the Icon 2D Art step renders (one icon texture each). */
export const ITEM_ICON_TIERS = ['Common', 'Magic', 'Rare', 'Unique'] as const;
export type ItemIconTier = (typeof ITEM_ICON_TIERS)[number];

/** PascalCase, space-free readable slug (Iron Longsword → IronLongsword). LOSSY: "Iron Sword",
 *  "Iron-Sword" and "Iron_Sword" all collapse to "IronSword" — {@link itemSlug} disambiguates. */
export function readableItemSlug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '');
}

/** Short, stable, path-safe token derived from an entity id (base-36 of a 32-bit string hash). */
function idToken(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

let seedRefs: ItemRef[] | null = null;
/** The items seed as sibling refs — the default collision universe (read once). */
function seedSiblings(): ItemRef[] {
  seedRefs ??= seedItemEntries().map((e) => ({ id: e.id, name: e.name }));
  return seedRefs;
}

/**
 * The asset-path slug for one entity. Readable when unique among `siblings`; when a DISTINCT
 * sibling sanitizes to the same readable slug, a stable id token is appended (`IronSword_<tok>`)
 * so the two never share a UE path. `_` (not `-`) keeps every path a valid UE object path.
 */
export function itemSlug(entity: ItemRef, siblings: readonly ItemRef[] = seedSiblings()): string {
  const readable = readableItemSlug(entity.name);
  if (!readable) return `Item_${idToken(entity.id)}`;
  const collides = siblings.some((s) => s.id !== entity.id && readableItemSlug(s.name) === readable);
  return collides ? `${readable}_${idToken(entity.id)}` : readable;
}

/** Every UE path one item owns. `dataTableRow` is a ROW NAME inside `dataTable`, not a path. */
export interface ItemAssetPaths {
  slug: string;
  da: string;
  dataTable: string;
  dataTableRow: string;
  icons: Record<ItemIconTier, string>;
  meshLods: string[];
  /** LOD0 — the mesh both specs declare. */
  mesh: string;
  materialInstance: string;
  textures: { albedo: string; normal: string; orm: string };
  anim: string;
  vfx: string;
  sfx: string;
}

const DATA_ROOT = '/Game/Data/Items';
const ITEMS_ROOT = '/Game/Items';

export function itemAssetPaths(entity: ItemRef, siblings?: readonly ItemRef[]): ItemAssetPaths {
  const s = itemSlug(entity, siblings);
  const meshLods = [0, 1, 2].map((i) => `${ITEMS_ROOT}/Meshes/SM_${s}_LOD${i}`);
  return {
    slug: s,
    da: `${DATA_ROOT}/DA_${s}`,
    dataTable: `${DATA_ROOT}/DT_Items`,
    dataTableRow: s,
    icons: Object.fromEntries(ITEM_ICON_TIERS.map((t) => [t, `/Game/UI/Icons/T_${s}_Icon_${t}`])) as Record<ItemIconTier, string>,
    meshLods,
    mesh: meshLods[0],
    materialInstance: `${ITEMS_ROOT}/Materials/MI_${s}_Blade`,
    textures: {
      albedo: `${ITEMS_ROOT}/Textures/T_${s}_Albedo`,
      normal: `${ITEMS_ROOT}/Textures/T_${s}_Normal`,
      orm: `${ITEMS_ROOT}/Textures/T_${s}_ORM`,
    },
    anim: `${ITEMS_ROOT}/Animations/A_${s}_Equip`,
    vfx: `${ITEMS_ROOT}/VFX/NS_${s}_Use`,
    sfx: `${ITEMS_ROOT}/Audio/SC_${s}`,
  };
}

/** The item's authoritative rarity: a declared power list makes it Unique, else its seeded rarity. */
export function itemRarity(entity: Pick<ItemRef, 'data'>): string {
  const d = (entity.data as Record<string, unknown> | null | undefined) ?? {};
  return Array.isArray(d.powers) ? 'Unique' : (d.rarity as string | undefined) ?? 'Common';
}

/** Which of the four icon frames a rarity wears (ladder position; Epic and above → Unique). */
export function iconTierFor(rarity: string | undefined): ItemIconTier {
  switch (rarity) {
    case 'Uncommon': case 'Magic': return 'Magic';
    case 'Rare': return 'Rare';
    case 'Epic': case 'Set': case 'Legendary': case 'Unique': return 'Unique';
    default: return 'Common';
  }
}

/** The powers the Affixes step declares: the entity's own list, else the sword implicit. */
export function itemDeclaredPowers(entity: Pick<ItemRef, 'data'>): { power: unknown; min: unknown; max: unknown }[] {
  const d = (entity.data as Record<string, unknown> | null | undefined) ?? {};
  return Array.isArray(d.powers)
    ? (d.powers as Record<string, unknown>[]).map((p) => ({ power: p.power, min: p.min ?? 0, max: p.max ?? p.min ?? 0 }))
    : [{ power: 'implicit-sword-accuracy', min: 30, max: 30 }];
}

const pascal = (s: string) => s.split(/[^a-z0-9]+/i).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');

/** The GameplayEffect a declared power realizes as (canon arpg-affix-is-ge). */
export function itemEffectName(power: unknown): string {
  const id = String(power ?? '');
  return id.startsWith('implicit-') ? `GE_Implicit_${pascal(id.slice('implicit-'.length))}` : `GE_Affix_${pascal(id)}`;
}

/** Each producing step's slice of the table, keyed by its (never renamed) step label. */
export function itemDeclaredAssets(entity: ItemRef, siblings?: readonly ItemRef[]): Record<string, string[]> {
  const p = itemAssetPaths(entity, siblings);
  const effects = [...new Set(itemDeclaredPowers(entity).map((x) => `${DATA_ROOT}/${itemEffectName(x.power)}`))];
  return {
    'Base Type & Rarity': [p.da],
    'Affixes': effects,
    'Material': [p.materialInstance, p.textures.albedo, p.textures.normal, p.textures.orm],
    'Icon 2D Art': ITEM_ICON_TIERS.map((t) => p.icons[t]),
    '3D Mesh': p.meshLods,
    '3D Generation': [p.mesh],
    'Material / Texture': [p.materialInstance],
    'Animations': [p.anim],
    'VFX': [p.vfx],
    'SFX': [p.sfx],
  };
}

export interface ItemPackagingClaim {
  /** The UE paths UE Packaging claims — every one declared by a producing sibling. */
  assets: string[];
  /** Human-readable manifest for the step's view: asset names, plus the DT row as a row reference. */
  names: string[];
  /** path → the step that declares it (the package ledger's owner for a blocker). */
  declaredBy: Record<string, string>;
  /** The DT_Items row the item is realized as — data, never a path. */
  dataTableRow: { table: string; row: string };
}

/**
 * UE Packaging's claim: the item's primary Content assets, each kept only if a sibling declares it.
 *
 * It reads the entity's IDENTITY only (id + name), never its data, on purpose:
 *  • every icon frame the Icon step declares is claimed, not only the item's own rarity;
 *  • no GameplayEffect is claimed — the Affixes step declares them, and they are verified by the
 *    step's static compile checks ("every GameplayEffect THIS item declares compiles in Source/"),
 *    not as `.uasset`s under Content/.
 * A claim that read `data.powers`/`data.rarity` would make the packaging body entity-reading while
 * its wiring-contract prose is still the exemplar's, lifting the template hold
 * (`produceTemplate.ts`) off every non-exemplar item — 90 ingested uniques graded pass with no new
 * evidence (measured 2026-09-30). Data-blind, the hold applies exactly as it did before the table.
 */
export function itemPackagingClaim(entity: ItemRef, siblings?: readonly ItemRef[]): ItemPackagingClaim {
  const p = itemAssetPaths(entity, siblings);
  const declared = itemDeclaredAssets(entity, siblings);
  const owner = new Map<string, string>();
  for (const [step, paths] of Object.entries(declared)) for (const path of paths) if (!owner.has(path)) owner.set(path, step);
  const wanted = [p.da, p.materialInstance, p.mesh, ...declared['Icon 2D Art'], p.anim, p.vfx, p.sfx];
  const assets = wanted.filter((path) => owner.has(path));
  const names = assets.map((path) => path.slice(path.lastIndexOf('/') + 1));
  return {
    assets,
    // DA first, then the DT row it is realized as (a row reference, never a path), then the rest.
    names: [names[0], `DT_Items :: ${p.dataTableRow}`, ...names.slice(1)],
    declaredBy: Object.fromEntries(assets.map((path) => [path, owner.get(path)!])),
    dataTableRow: { table: p.dataTable, row: p.dataTableRow },
  };
}
