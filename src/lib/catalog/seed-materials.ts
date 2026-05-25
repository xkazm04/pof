import type { MaterialCatalogEntry } from './types';

/**
 * Materials catalog seed.
 *
 * Phase 8 registered the catalog as a substrate proof (seeded empty). The
 * catalog-pipeline Material row (docs/catalog/core-existing/material) lifts in
 * the first real entity — **Weathered Stone** — a `MaterialInstanceConstant` of
 * the shared surface master `M_ARPG_Surface_Master`, built + config-gated by
 * `Content/Python/build_weathered_stone.py` (the app is the SYNC SOURCE for that
 * script's parameter set).
 *
 * Per the seed convention, the static entity is `planned` and owns only the
 * design `data`; the real generation lifecycle (`verified` + `ueAssets` +
 * test verdict) is DB-owned and merged at load. The headless build+gate has
 * already passed (`[gate] RESULT=PASS` in the -abslog) — recording that DB
 * transition is the remaining wire-up step (see the row's Session Findings).
 */
export function seedMaterialEntries(): MaterialCatalogEntry[] {
  return [
    {
      id: 'mat-weathered-stone',
      catalogId: 'materials',
      name: 'Weathered Stone',
      categoryPath: ['Surfaces', 'Stone'],
      tags: ['stone', 'environment', 'weathered', 'pbr'],
      lifecycle: 'planned',
      data: {
        displayName: 'Weathered Stone',
        surfaceType: 'stone',
        // Material design data (a representative aged-stone swatch), not a UI
        // style token — the chart-colors rule targets the latter.
        // eslint-disable-next-line no-restricted-syntax
        baseColor: '#8a857a',
        parentMaterial: '/Game/Materials/M_ARPG_Surface_Master',
        instancePath: '/Game/Materials/MI_WeatheredStone',
        textures: {
          albedo: '/Game/ArenaBuild/Textures/T_wall_albedo',
          normal: '/Game/ArenaBuild/Textures/T_wall_normal',
          roughness: '/Game/ArenaBuild/Textures/T_wall_rough',
          detailNormal: '/Game/ArenaBuild/Textures/T_wall_normal',
        },
        baseColorTint: [0.72, 0.7, 0.64],
        scalars: { tilingScale: 1.0, detailTiling: 8.0, emissiveStrength: 0.0 },
      },
    },
  ];
}
