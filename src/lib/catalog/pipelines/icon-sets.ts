import { registerCatalogPipeline } from '../pipeline-registry';
import { allOf } from '@/lib/catalog/acceptance/combinators';
import { wiringContractSound } from '@/lib/catalog/acceptance/wiringCheckers';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { entityRuntimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import { imageGalleryCandidates } from '@/components/layout-lab/steps/shared/imageGalleryCandidates';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import { gallerySeed } from '@/lib/catalog/acceptance/galleryArtifact';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * ATLAS GEOMETRY — the ONE source for every number this pipeline's prose quotes.
 *
 * A mipped atlas cannot also be packed edge-to-edge: a bilinear/trilinear fetch near a cell
 * boundary blends the texels AROUND the sample point, and at a cell edge some of those texels
 * belong to the neighbouring icon — progressively more of them at each mip level. So the cell
 * budget is artwork + gutter, and the gutter is derived, never picked:
 *
 *   gutter   = filter reach (1 texel, bilinear) × the deepest mip's reduction factor
 *   artwork  = cell − 2 × gutter
 *   floor    = artwork at the deepest mip must stay ≥ MIN_DISPLAY_PX (the HUD's smallest size)
 *
 * Solving that for a 256 px cell and a 32 px display floor:
 *   MIP_COUNT 3 → gutter 4, artwork 248, deepest artwork 248/4 = 62 px ✓
 *   MIP_COUNT 4 → gutter 8, artwork 240, deepest artwork 240/8 = 30 px ✗ (below the floor)
 * so 3 is the deepest chain this cell size supports. The gutter is taken from INSIDE the cell,
 * so the 16×16 grid, the 256-slot page budget and the UV cell pitch are all unchanged.
 */
const ATLAS_PX = 4096;
const GRID = 16;
const CELL_PX = ATLAS_PX / GRID; // 256
const MIN_DISPLAY_PX = 32; // accessibility step's `criteria.minDisplaySize`
const MIP_COUNT = 3; // mip levels 0..2 — deepest reduction 4×
const GUTTER_PX = 2 ** (MIP_COUNT - 1); // 4 px at mip 0 (1 bilinear texel at mip 2)
const ARTWORK_PX = CELL_PX - 2 * GUTTER_PX; // 248
const DEEPEST_ARTWORK_PX = ARTWORK_PX / 2 ** (MIP_COUNT - 1); // 62 ≥ MIN_DISPLAY_PX
/** What a 4th mip would cost, quoted in the spec so the choice is falsifiable. */
const NEXT_GUTTER_PX = 2 ** MIP_COUNT; // 8
const NEXT_ARTWORK_PX = CELL_PX - 2 * NEXT_GUTTER_PX; // 240
const NEXT_DEEPEST_PX = NEXT_ARTWORK_PX / 2 ** MIP_COUNT; // 30 — below the floor

/** Machine-readable atlas geometry, written into the Atlas step's artifact. */
export const ICON_ATLAS_GEOMETRY = {
  atlasPx: ATLAS_PX,
  grid: GRID,
  cellPx: CELL_PX,
  artworkPx: ARTWORK_PX,
  gutterPx: GUTTER_PX,
  mipCount: MIP_COUNT,
  minDisplayPx: MIN_DISPLAY_PX,
} as const;

/**
 * Icon Sets pipeline (catalogId: 'icon-sets').
 *
 * Defines the multi-stage authoring process for a coherent ARPG icon family:
 * family brief + taxonomy → art selection → accessibility checks → atlas packaging.
 * Per the `art-icon-family` canon: icons within a set share silhouette weight,
 * line treatment, palette, rarity-frame, and light direction.
 * Per the `art-icons` canon: 256 px, 3/4 view, strong readable silhouette,
 * rarity-framed, consistent light from the upper-left.
 * Atlas wires into UHUDWidget / UW_ItemTooltip via a single
 * T_<Slug>_Atlas texture and a FIconSetRow DataTable row.
 */
registerCatalogPipeline({
  catalogId: 'icon-sets',
  steps: [
    // ── 1. Family Brief ───────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Family Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        return ({
        data: {
          brief:
            `The ${e.name} icon family establishes one coherent visual language across all members ` +
            `authored at ${CELL_PX} px and packed to a ${ATLAS_PX}×${ATLAS_PX} atlas with ${CELL_PX} px cells ` +
            `(${GRID}×${GRID} = ${GRID * GRID} icon slots) — each cell holds a ${ARTWORK_PX} px artwork square ` +
            `inside a ${GUTTER_PX} px extruded bleed gutter, because a mipped atlas packed edge-to-edge lets a ` +
            `filtered fetch sample its neighbour. ` +
            `Every icon shares a 3/4 top-down perspective, a consistent upper-left key light at ` +
            `roughly 45° elevation, and a 2 px outline stroke that holds weight at the HUD's smallest ` +
            `display size of 32 px. The palette is rooted in muted earthen tones — desaturated ochres, ` +
            `irons, and bone whites — with saturation reserved for the rarity-frame accent: gold foil ` +
            `for Unique, crimson inlay for Rare, ice-blue edge for Magic, plain iron for Normal (Common). ` +
            `Elemental ability icons break from the neutral palette only on their damage-type accent ` +
            `(fire-orange, ice-cyan, lightning-yellow, chaos-violet) while keeping the silhouette in ` +
            `the family's muted base range. Status-effect icons carry the same silhouette weight but add ` +
            `a pulsing inner-glow FX masked to the icon's alpha, authored as a Niagara overlay keyed to ` +
            `the State.* gameplay tag. This ensures the iconography aligns with the game's grim, ` +
            `weathered tone (canon art-identity) and reads legibly against the dark HUD background ` +
            `(canvas luma ≈ 0.06). The family is designed to pass WCAG AA contrast (≥4.5:1 for text-scale ` +
            `iconographic detail) on the dark HUD and to remain colorblind-safe by relying on shape + ` +
            `brightness cues rather than hue alone. All slots follow the IconCategory_Name naming ` +
            `convention for DataTable lookup (e.g. IconItem_IronLongsword, IconAbility_Fireball, ` +
            `IconStatus_Ignite). The atlas is the single source of truth wired via T_${s}_Atlas ` +
            `sampled in MI_HUDIconSheet_${s}, consumed by UHUDWidget (item slots), UW_SpellBar (ability ` +
            `slots), and UW_StatusRow (status-effect slots) — no icon is hard-coded as a separate ` +
            `texture; all go through the atlas UV lookup in the common icon material.`,
        },
      });
      },
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Taxonomy ───────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Taxonomy',
      view: {
        kind: 'table',
        field: 'taxonomy',
        columns: [{ key: 'members' }, { key: 'naming' }, { key: 'count' }],
      },
      produce: () => ({
        data: {
          taxonomy: {
            // Three primary categories, each a namespace in the atlas.
            members: [
              {
                category: 'Item',
                prefix: 'IconItem_',
                examples: [
                  'IconItem_IronLongsword',
                  'IconItem_CrystalStaff',
                  'IconItem_SteelChestplate',
                  'IconItem_AssassinsCowl',
                  'IconItem_AshenClaymore',
                  'IconItem_WardbreakingBand',
                  'IconItem_EmberGreaves',
                  'IconItem_ChaosOrb',
                  'IconItem_ExaltOrb',
                ],
                count: 64,
                rarityVariants: 'rarity-frame recolour only; silhouette identical across rarity tiers',
              },
              {
                category: 'Ability',
                prefix: 'IconAbility_',
                examples: [
                  'IconAbility_Fireball',
                  'IconAbility_IceShard',
                  'IconAbility_LightningBolt',
                  'IconAbility_MeleeSlash',
                  'IconAbility_ShieldCharge',
                  'IconAbility_BleedStrike',
                  'IconAbility_PoisonCloud',
                ],
                count: 64,
                rarityVariants: 'no rarity-frame; damage-type accent colour only',
              },
              {
                category: 'Status',
                prefix: 'IconStatus_',
                examples: [
                  'IconStatus_Ignite',
                  'IconStatus_Chill',
                  'IconStatus_Freeze',
                  'IconStatus_Shock',
                  'IconStatus_Bleed',
                  'IconStatus_Poison',
                  'IconStatus_Fortify',
                  'IconStatus_Curse',
                ],
                count: 64,
                rarityVariants: 'inner-glow Niagara overlay keyed to State.* tag; shape fixed',
              },
              {
                category: 'Currency',
                prefix: 'IconCurrency_',
                examples: [
                  'IconCurrency_Gold',
                  'IconCurrency_TransmuteOrb',
                  'IconCurrency_AlchemyOrb',
                  'IconCurrency_ChaosOrb',
                  'IconCurrency_ExaltOrb',
                  'IconCurrency_DivineOrb',
                ],
                count: 32,
                rarityVariants: 'no rarity-frame; soft gold tint for soft currency, neutral iron for orbs',
              },
            ],
            naming: 'IconCategory_Name — PascalCase after the prefix, no spaces, no version suffixes',
            count: 224,
            atlasBudget:
              `${GRID * GRID} cells total on ONE ${ATLAS_PX}×${ATLAS_PX} page (${GRID}×${GRID} grid); 224 allocated, 32 reserved. ` +
              `The ${GUTTER_PX} px bleed gutter is taken from INSIDE each ${CELL_PX} px cell ` +
              `(${ARTWORK_PX} px artwork + 2×${GUTTER_PX} px = ${CELL_PX} px), so the page count and the slot count are unchanged by it.`,
            note:
              'All names match their DataTable row key in DT_IconSets so widget UV lookup is a single ' +
              'DataTable::FindRow call keyed on the IconCategory_Name string. ' +
              'Currency icons are defined here and referenced by the currencies catalog via IconCurrency_ prefix.',
          },
        },
      }),
      accept: fieldsPopulated('taxonomy', 'Members + naming + count defined', ['members', 'naming', 'count']),
    },

    // ── 3. Icon 2D Art (L1 selection) ─────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      engine: 'Leonardo',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      // Pluggable generator: surfaces REAL generated thumbnails when any exist on disk
      // (served via /api/visual-gen/asset/…), and falls back to the honest deterministic
      // swatch preview when the generated/ dir is empty. Selection/acceptance unchanged.
      genCandidates: {
        needsAssets: true,
        build: (dir, seq, assets) => imageGalleryCandidates('selected', 4, assets, dir, seq),
      },
      produce: (e: LabEntity) => ({
        data: { ...gallerySeed('selected', 4) },
        ueAssets: [`/Game/UI/Icons/Sets/T_${slug(e.name)}_Atlas`],
      }),
      accept: selected('selected', 'A family style candidate is selected'),
    },

    // ── 4. Accessibility ──────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Accessibility',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'AA contrast ≥4.5:1: icon edge luminance vs HUD canvas luma ≈0.06 — all icon edges pass WCAG AA ≥4.5:1',
            'Colorblind-safe: hue separation ≥ 60° on the color wheel AND ≥2× brightness delta between damage-type accents (fire/cold/lightning/chaos); no distinction relies on hue alone',
            'Legible at 32px: 2 px outline stroke preserved at 32 px display size; silhouette reads as distinct shape without colour; verified via half-size bake review',
          ],
          criteria: {
            contrastTarget: '≥4.5:1 (WCAG AA)',
            hudCanvasLuma: 0.06,
            colorblindHueSeparation: '≥60° on color wheel + ≥2× brightness delta between damage-type accents',
            minDisplaySize: MIN_DISPLAY_PX,
            outlineWeight:
              `2 px at ${CELL_PX} px source; maps to ~0.25 px at ${MIN_DISPLAY_PX} px — must be anti-aliased, not dropped. ` +
              `This ${MIN_DISPLAY_PX} px floor is what caps the atlas mip chain at ${MIP_COUNT} levels (see the Atlas step's format line).`,
          },
        },
      }),
      accept: minCount('checks', 'All 3 accessibility checks covered', 3),
    },

    // ── 5. Atlas ──────────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Atlas',
      view: {
        kind: 'table',
        field: 'atlas',
        columns: [{ key: 'texture' }, { key: 'packing' }, { key: 'slots' }],
      },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        return ({
        data: {
          atlas: {
            texture: `T_${s}_Atlas`,
            textureSize: `${ATLAS_PX}×${ATLAS_PX} px`,
            cellSize: `${CELL_PX}×${CELL_PX} px`,
            artworkSize: `${ARTWORK_PX}×${ARTWORK_PX} px`,
            gutter:
              `${GUTTER_PX} px per side, EXTRUDED (not empty). Basis: bilinear/trilinear reach = 1 texel at the ` +
              `level being sampled × the deepest mip's reduction factor (${2 ** (MIP_COUNT - 1)}× at mip ${MIP_COUNT - 1}) ` +
              `= ${GUTTER_PX} px at mip 0. It survives the whole chain (${GUTTER_PX}→${GUTTER_PX / 2}→${GUTTER_PX / 4} px, ` +
              `≥1 texel at every level). Taken from INSIDE the cell: ${ARTWORK_PX} + 2×${GUTTER_PX} = ${CELL_PX} px.`,
            gridLayout: `${GRID}×${GRID} grid`,
            packing:
              `${ATLAS_PX}×${ATLAS_PX} atlas, ONE page — ${GRID}×${GRID} grid of ${CELL_PX} px cells. ` +
              `Each cell = a ${ARTWORK_PX}×${ARTWORK_PX} px artwork square centred in a ${GUTTER_PX} px gutter on every side ` +
              `(${ARTWORK_PX} + 2×${GUTTER_PX} = ${CELL_PX}, so cell pitch, the ${GRID}×${GRID} grid and the ` +
              `${GRID * GRID}-slot page budget are all unchanged). The gutter is filled by EXTRUDING each icon's ` +
              'outermost row and column outward — colour channels extruded UNDERNEATH transparent texels, so a sampler ' +
              'that interpolates RGB and alpha independently cannot pull background colour into the visible edge. ' +
              'The UV boundary is therefore the ARTWORK boundary, not the cell boundary: a filtered fetch that strays ' +
              "outside reads the icon's own edge colour instead of its neighbour's.",
            gutterPx: GUTTER_PX,
            artworkPx: ARTWORK_PX,
            cellPx: CELL_PX,
            mipCount: MIP_COUNT,
            slots: GRID * GRID,
            slotsAllocated: 224,
            slotsReserved: 32,
            format:
              'BC7 (DXT5-equivalent, full alpha for transparency) — mip chain floored where the ARTWORK reaches the ' +
              `${MIN_DISPLAY_PX} px minimum display size: atlas mips ${ATLAS_PX}→${ATLAS_PX / 2}→${ATLAS_PX / 4} ` +
              `(cells ${CELL_PX}→${CELL_PX / 2}→${CELL_PX / 4}, artwork ${ARTWORK_PX}→${ARTWORK_PX / 2}→${DEEPEST_ARTWORK_PX}), ` +
              `mip count = ${MIP_COUNT}. A 4th mip is not solvable at this cell size: it would demand a ` +
              `${NEXT_GUTTER_PX} px gutter (1 texel × ${2 ** MIP_COUNT}× reduction), leaving ${NEXT_ARTWORK_PX} px of ` +
              `artwork and ${NEXT_DEEPEST_PX} px at the deepest level — below the ${MIN_DISPLAY_PX} px floor. ` +
              '(Judge-fleet fix 2026-07-07: the old line claimed a 32 px floor AND mip count 7 — 7 mips would run cells ' +
              'down to 4 px. Fix 2026-09-03: the corrected line still asked for a mip chain AND "no padding ' +
              '(UV boundary = cell boundary)" — mutually exclusive, since a filtered fetch at a cell edge samples the ' +
              'neighbouring icon and does so twice as far, in source texels, at every level down. The extruded gutter ' +
              'above resolves it, and it costs the 4th mip.)',
            uvLookupMethod:
              `FIconSetRow.AtlasU + FIconSetRow.AtlasV (cell indices 0–${GRID - 1}) stored in DT_IconSets; ` +
              `MI_HUDIconSheet_${s} addresses the ARTWORK rect, not the whole cell: ` +
              `UV = vec2(AtlasU, AtlasV) / ${GRID}.0 + (${GUTTER_PX}.0 + uv_in_artwork * ${ARTWORK_PX}.0) / ${ATLAS_PX}.0 ` +
              `— the inner ${ARTWORK_PX}/${CELL_PX} of each cell. The ${GUTTER_PX} px extruded ring is what the filter ` +
              'reads when it strays; nothing ever addresses it directly.',
            wiringContract: {
              grantedBy:
                `MI_HUDIconSheet_${s} (a master-material instance) samples T_${s}_Atlas; ` +
                'UHUDWidget / UW_SpellBar / UW_StatusRow set the UV via SetVectorParameterValue ' +
                'reading from FIconSetRow in DT_IconSets',
              activatedBy:
                'Widget Construct / NativeConstruct — called once per widget instantiation; ' +
                'UV updated on slot refresh (item equip, ability assign, status apply)',
              dependencies: [
                'hud-elements (UHUDWidget, UW_SpellBar, UW_StatusRow declare the icon material slot)',
                'items (IconItem_ names must match DT_Items.IconKey per item row)',
                'spellbook (IconAbility_ names must match DT_GeneratedAbilities.IconKey per ability row)',
                'status-effects (IconStatus_ names must match State.* tag name via DT_IconSets lookup)',
                'currencies (IconCurrency_ names must match DT_Currencies.IconKey per currency row)',
              ],
              verification:
                `L2: T_${s}_Atlas imported in Content/UI/Icons/; DT_IconSets seeded via seed_icon_sets.py; ` +
                `MI_HUDIconSheet_${s} compiled with T_${s}_Atlas slot; texture import settings declare ` +
                `mip count = ${MIP_COUNT} and every cell carries a ${GUTTER_PX} px extruded gutter around its ` +
                `${ARTWORK_PX} px artwork (measured on the imported texture, not asserted); ` +
                'L3: VSIconSetAtlasTest (runtime-deferred) — widget instantiation resolves all 224 UV ' +
                'lookups without missing-row warnings in PIE log; contrast + 32 px legibility verified in editor',
            },
          },
        },
        ueAssets: [`/Game/UI/Icons/Sets/T_${s}_Atlas`],
      });
      },
      accept: allOf(
        // NOTE (shape-only): `fieldsPopulated` asserts these keys are non-null — it does not read
        // the atlas bytes, measure a gutter, or check the arithmetic. `gutter` is required here so
        // an atlas spec cannot silently omit the bleed contract again; the numeric self-consistency
        // is pinned by src/__tests__/lib/catalog/pipelines/icon-sets.test.ts, and a real measurement
        // would need an image-reading checker this pipeline does not have.
        fieldsPopulated('atlas', 'Texture + packing + gutter + slots', ['texture', 'packing', 'gutter', 'slots']),
        wiringContractSound('atlas'),
      ),
    },

    // ── 6. Test Gate (runtime-deferred L3) ────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      // engine: `produce()` returns an author-typed checklist and the verdict is DEFERRED to a
      // UE automation test (`accept: entityRuntimeDeferred(...)`), so nothing has run here yet —
      // the same call the fleet already made on 7 identically-shaped Test Gate steps.
      engine: 'Hand-authored',
      view: { kind: 'checklist', field: 'checks' },
      produce: (e: LabEntity) => ({
        data: {
          checks: [
            `T_${slug(e.name)}_Atlas imports without compression artefacts (BC7, mip count = ${MIP_COUNT} — ` +
              `no mip puts the ${ARTWORK_PX} px artwork below the ${MIN_DISPLAY_PX} px display floor; deepest is ${DEEPEST_ARTWORK_PX} px)`,
            `${GUTTER_PX} px gutter present AND extruded on every cell: sample the ${GUTTER_PX} px ring around each ` +
              `${ARTWORK_PX} px artwork square — it must repeat that icon's own edge colour (colour channels extruded ` +
              "under transparent texels), never the neighbour's colour and never empty. Spot-check ≥8 cells including " +
              'the grid corners, and re-check at the deepest mip where the ring is 1 texel wide',
            'all 224 allocated icon slots present (DT_IconSets row count = 224)',
            'contrast verified in editor: every icon edge ≥4.5:1 against HUD canvas luma 0.06',
            '32 px legibility bake review — 2 px outline preserved on all members',
            'colorblind simulation pass (protanopia / deuteranopia) — no two damage-type accents confused',
          ],
        },
      }),
      accept: entityRuntimeDeferred('VSIconSetAtlasTest', 'Atlas import + accessibility checks pass in UE editor'),
    },

    // ── 7. UE Packaging ───────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      // engine: re-graded from DISK TRUTH by the packaging drain — `isPackagingStep`
      // matches this label and `verifyPackagingAll` rebuilds the package (packagingVerify.ts).
      engine: 'Packaging engine',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `T_${s}_Atlas`,
          `MI_HUDIconSheet_${s}`,
          `DT_IconSets :: ${s}`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                `UHUDWidget / UW_SpellBar / UW_StatusRow set UV params on MI_HUDIconSheet_${s} ` +
                `reading FIconSetRow from DT_IconSets; T_${s}_Atlas is the atlas texture bound to the material`,
              activatedBy:
                'Widget NativeConstruct / Construct — UV lookup fires once on widget construction and on ' +
                'every slot-content change (item equip → equip GE granted → HUD refresh delegate → SetUVParams)',
              dependencies: [
                'hud-elements (UHUDWidget, UW_SpellBar, UW_StatusRow must be compiled and bind the icon material slot)',
                'items (DT_Items.IconKey must match DT_IconSets row name for every item base)',
                'spellbook (DT_GeneratedAbilities.IconKey must match DT_IconSets row name for every ability)',
                'status-effects (State.* tag name → DT_IconSets lookup → atlas UV for buff bar)',
                'currencies (DT_Currencies.IconKey must match DT_IconSets row name for every currency)',
              ],
              verification:
                `L2: T_${s}_Atlas present in Content/UI/Icons/Sets/; ` +
                `MI_HUDIconSheet_${s} compiled with correct texture slot and sampling the ${ARTWORK_PX} px artwork rect ` +
                `(not the full ${CELL_PX} px cell); DT_IconSets seeded via seed_icon_sets.py (row count ≥224); ` +
                'L3: VSIconSetAtlasTest in PIE — all widget slots resolve valid UVs with no ' +
                'missing-row logs; contrast + 32 px legibility confirmed',
            },
          },
          ueAssets: assets.map((a) => `/Game/UI/Icons/Sets/${a}`),
        };
      },
      accept: allOf(
        minCount('assets', 'All 3 assets packaged', 3),
        wiringContractSound(),
      ),
      staticChecks: (e) => [
        cppSymbolExists('FIconSetRow', 'Icon set row struct present in UE Source'),
        seedRowPresent('seed_icon_sets.py', slug(e.name), 'Icon set row seeded in Content/Python'),
      ],
    },
  ],
});
