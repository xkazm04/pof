import type { Checker } from './types';

/**
 * Server-importable checkers for the BESPOKE Items step labels — the seven steps whose
 * UI was authored in `src/components/layout-lab/steps/itemsSteps.ts` before the registered
 * pipeline (`src/lib/catalog/pipelines/items.ts`) existed, and which the registered pipeline
 * therefore never declares.
 *
 * Why this file exists at all: `gradeArtifact` re-grades every submitted artifact so a
 * fabricated `pass` is impossible — but only when `serverCheckerFor(catalogId, step)` finds
 * a checker. A persisted step label the server cannot resolve keeps whatever status the
 * PRODUCER wrote, which is the exact door the server re-grade was built to close. Measured
 * against the real DB on 2026-08-18, 15 of the `items` catalog's 90 rows sat behind that
 * door (`Attributes` ×9, plus `3D Generation`, `Animations`, `Inventory UI Integration`,
 * `Material / Texture`, `SFX`, `VFX` ×1 each).
 *
 * The fix is deliberately NOT a rename. A step label is a DB key — `pipeline_artifacts` is
 * upserted on `(catalog_id, entity_id, step)` — so aligning the bespoke labels onto the
 * registered ones would orphan every existing row. Instead the server learns the bespoke
 * labels' checkers, and the rows stay exactly where they are.
 *
 * SINGLE SOURCE: `itemsSteps.ts` builds its `ITEM_STEP_SPECS[…].accept` from these very
 * functions (wrapping them in plain-language copy), so the on-screen verdict and the
 * server's re-grade cannot drift apart. This module is pure — no React, no store, no DB —
 * so it imports cleanly on the server.
 *
 * Every checker here grades DATA SHAPE only (tier L0). None of them observes a rendered
 * mesh, an audible cue, or a running game; claiming a higher tier would be the shape-only
 * overclaim `/status` exists to expose.
 */

/** One row of the Weapon attribute schema: the key, its display unit, its produce default. */
export interface ItemAttr {
  key: string;
  unit: string;
  value: number;
}

/**
 * The Weapon attribute schema — the single source of truth for the attribute key list,
 * display units, and Produce's default values. The Attributes View (`ItemAttributes`)
 * renders it, the bespoke Produce writes it, and `itemsAttributesPopulated` grades against
 * it, so the preview, the artifact and the gate can never drift.
 */
export const ITEM_ATTR_SCHEMA: ItemAttr[] = [
  { key: 'Damage', unit: 'hp', value: 34 },
  { key: 'Attack Speed', unit: '/s', value: 1.1 },
  { key: 'Weight', unit: 'kg', value: 3.4 },
  { key: 'Durability', unit: 'pt', value: 180 },
  { key: 'Crit Chance', unit: '%', value: 5 },
  { key: 'Range', unit: 'm', value: 1.8 },
  { key: 'Stagger', unit: 'pt', value: 22 },
  { key: 'Value', unit: 'g', value: 120 },
];

/** Attribute key list derived from the schema. */
export const ITEM_ATTR_KEYS: string[] = ITEM_ATTR_SCHEMA.map((a) => a.key);

/** PBR maps a material artifact must carry before the surface is authorable in UE. */
export const REQUIRED_PBR_MAPS = ['Albedo', 'Normal', 'ORM'] as const;

/** Minimum animation clips (Pickup + Equip) an item must bind. */
export const MIN_ANIM_CLIPS = 2;
/** Minimum SFX cues (pickup · equip · use) an item must cover. */
export const MIN_SFX_CUES = 3;
/** Default LOD0 triangle budget when an artifact does not state its own. */
export const DEFAULT_TRI_CAP = 6000;
/** Default per-item VFX GPU budget (ms) when an artifact does not state its own. */
export const DEFAULT_VFX_MS_CAP = 0.8;

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Every attribute in the Weapon schema carries a value. */
export const itemsAttributesPopulated: Checker = (data) => {
  const stats = (data.stats ?? {}) as Record<string, unknown>;
  const missing = ITEM_ATTR_KEYS.filter((k) => stats[k] == null);
  const ok = missing.length === 0;
  return {
    label: 'All attributes populated per schema (Weapon)',
    tier: 'L0',
    status: ok ? 'pass' : 'pending',
    detail: `${ITEM_ATTR_KEYS.length - missing.length} / ${ITEM_ATTR_KEYS.length} populated`,
    ...(ok ? {} : { reason: `attribute(s) not set: ${missing.join(', ')}` }),
  };
};

/** A mesh was generated and its triangle count fits the LOD0 budget it declares. */
export const itemsMeshWithinTriBudget: Checker = (data) => {
  const tris = Number(data.tris ?? 0);
  const cap = Number(data.cap ?? DEFAULT_TRI_CAP);
  const ok = tris > 0 && tris <= cap;
  return {
    label: 'Mesh generated · tri count under LOD0 budget',
    tier: 'L0',
    status: ok ? 'pass' : 'pending',
    detail: tris > 0 ? `${tris} / ${cap} tris` : 'no mesh',
    ...(ok
      ? {}
      : {
          reason: tris > 0
            ? `mesh is ${tris} triangles, over the ${cap}-triangle LOD0 budget`
            : 'no mesh recorded (data.tris is 0 / unset)',
        }),
  };
};

/** Albedo + Normal + ORM are all present in the material artifact. */
export const itemsPbrMapsPresent: Checker = (data) => {
  const maps = list(data.maps).map(String);
  const missing = REQUIRED_PBR_MAPS.filter((m) => !maps.includes(m));
  const ok = missing.length === 0;
  return {
    label: 'Required PBR maps present (Albedo · Normal · ORM)',
    tier: 'L0',
    status: ok ? 'pass' : 'pending',
    detail: maps.length ? `${maps.length} maps` : '0 maps',
    ...(ok ? {} : { reason: `missing PBR map(s): ${missing.join(', ')}` }),
  };
};

/** At least Pickup + Equip clips are bound. */
export const itemsAnimClipsPresent: Checker = (data) => {
  const clips = list(data.clips);
  const ok = clips.length >= MIN_ANIM_CLIPS;
  return {
    label: 'Required clips present (Pickup · Equip)',
    tier: 'L0',
    status: ok ? 'pass' : 'pending',
    detail: clips.length ? `${clips.length} clips` : '0 clips',
    ...(ok ? {} : { reason: `${clips.length} clip(s) bound, needs ≥ ${MIN_ANIM_CLIPS} (Pickup · Equip)` }),
  };
};

/** ≥1 VFX variant is bound and the declared GPU cost fits its budget. */
export const itemsVfxWithinBudget: Checker = (data) => {
  const variants = list(data.variants);
  const cost = Number(data.cost ?? 0);
  const cap = Number(data.cap ?? DEFAULT_VFX_MS_CAP);
  const ok = variants.length >= 1 && cost <= cap;
  return {
    label: 'At least one VFX bound · GPU cost under budget',
    tier: 'L0',
    status: ok ? 'pass' : 'pending',
    detail: variants.length ? `${cost.toFixed(1)} / ${cap} ms` : 'no vfx',
    ...(ok
      ? {}
      : {
          reason: variants.length
            ? `VFX cost ${cost.toFixed(1)} ms exceeds the ${cap} ms budget`
            : 'no VFX variant bound',
        }),
  };
};

/** The pickup · equip · use SFX cues are all covered. */
export const itemsSfxCuesCovered: Checker = (data) => {
  const cues = list(data.cues);
  const ok = cues.length >= MIN_SFX_CUES;
  return {
    label: 'Required SFX events covered (pickup · equip · use)',
    tier: 'L0',
    status: ok ? 'pass' : 'pending',
    detail: cues.length ? `${cues.length} cues` : '0 cues',
    ...(ok ? {} : { reason: `${cues.length} cue(s) recorded, needs ≥ ${MIN_SFX_CUES} (pickup · equip · use)` }),
  };
};

/** The item is wired into the inventory grid with a slot category. */
export const itemsInventoryWired: Checker = (data) => {
  const wired = data.wired === true;
  const slot = data.slot != null && String(data.slot).length > 0;
  const ok = wired && slot;
  return {
    label: 'Item renders in the inventory grid · slot category set',
    tier: 'L0',
    status: ok ? 'pass' : 'pending',
    detail: wired ? `slot: ${String(data.slot ?? '—')}` : 'not wired',
    ...(ok
      ? {}
      : { reason: !wired ? 'item is not wired into the inventory grid' : 'no slot category set' }),
  };
};

/**
 * The bespoke Items step labels the registered pipeline does not declare, mapped to the
 * checker that grades each. Keys are the LIVE DB step labels — never rename one here
 * without migrating `pipeline_artifacts` rows for the same `(catalog_id, entity_id, step)`.
 */
export const ITEMS_BESPOKE_CHECKERS: Readonly<Record<string, Checker>> = {
  'Attributes': itemsAttributesPopulated,
  '3D Generation': itemsMeshWithinTriBudget,
  'Material / Texture': itemsPbrMapsPresent,
  'Animations': itemsAnimClipsPresent,
  'VFX': itemsVfxWithinBudget,
  'SFX': itemsSfxCuesCovered,
  'Inventory UI Integration': itemsInventoryWired,
};
