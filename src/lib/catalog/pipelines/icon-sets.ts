import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

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
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `The ${e.name} icon family establishes one coherent visual language across all members ` +
            `rendered at 256 px and packed to a 4096×4096 atlas with 256 px cells (256 icon slots). ` +
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
            `IconStatus_Ignite). The atlas is the single source of truth wired via T_<Slug>_Atlas ` +
            `sampled in MI_HUDIconSheet, consumed by UHUDWidget (item slots), UW_SpellBar (ability ` +
            `slots), and UW_StatusRow (status-effect slots) — no icon is hard-coded as a separate ` +
            `texture; all go through the atlas UV lookup in the common icon material.`,
        },
      }),
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
            atlasBudget: '256 cells total in the 4096×4096 atlas (16×16 grid); 224 allocated, 32 reserved',
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
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
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
            minDisplaySize: 32,
            outlineWeight: '2 px at 256 px source; maps to ~0.25 px at 32 px — must be anti-aliased, not dropped',
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
      produce: (e: LabEntity) => ({
        data: {
          atlas: {
            texture: `T_${slug(e.name)}_Atlas`,
            textureSize: '4096×4096 px',
            cellSize: '256×256 px',
            gridLayout: '16×16 grid',
            packing: '4096×4096 atlas — 256 px cells, 16×16 grid, no padding (UV boundary = cell boundary)',
            slots: 256,
            slotsAllocated: 224,
            slotsReserved: 32,
            format: 'BC7 (DXT5-equivalent, full alpha for transparency) — no mip below 32 px (mip count = 7)',
            uvLookupMethod:
              'FIconSetRow.AtlasU + FIconSetRow.AtlasV (cell indices 0–15) stored in DT_IconSets; ' +
              'MI_HUDIconSheet UV = vec2(AtlasU, AtlasV) / 16.0 + uv_in_cell / 16.0',
            wiringContract: {
              grantedBy:
                'MI_HUDIconSheet (a master-material instance) samples T_<Slug>_Atlas; ' +
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
                'L2: T_<Slug>_Atlas imported in Content/UI/Icons/; DT_IconSets seeded via seed_icon_sets.py; ' +
                'MI_HUDIconSheet compiled with T_<Slug>_Atlas slot; ' +
                'L3: VSIconSetAtlasTest (runtime-deferred) — widget instantiation resolves all 224 UV ' +
                'lookups without missing-row warnings in PIE log; contrast + 32 px legibility verified in editor',
            },
          },
        },
        ueAssets: [`/Game/UI/Icons/Sets/T_${slug(e.name)}_Atlas`],
      }),
      accept: fieldsPopulated('atlas', 'Texture + packing + slots', ['texture', 'packing', 'slots']),
    },

    // ── 6. Test Gate (runtime-deferred L3) ────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'atlas imports without compression artefacts (BC7, no mip below 32 px)',
            'all 224 allocated icon slots present (DT_IconSets row count = 224)',
            'contrast verified in editor: every icon edge ≥4.5:1 against HUD canvas luma 0.06',
            '32 px legibility bake review — 2 px outline preserved on all members',
            'colorblind simulation pass (protanopia / deuteranopia) — no two damage-type accents confused',
          ],
        },
      }),
      accept: runtimeDeferred('VSIconSetAtlasTest', 'Atlas import + accessibility checks pass in UE editor'),
    },

    // ── 7. UE Packaging ───────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
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
                `MI_HUDIconSheet_${s} compiled with correct texture slot; ` +
                `DT_IconSets seeded via seed_icon_sets.py (row count ≥224); ` +
                'L3: VSIconSetAtlasTest in PIE — all widget slots resolve valid UVs with no ' +
                'missing-row logs; contrast + 32 px legibility confirmed',
            },
          },
          ueAssets: assets.map((a) => `/Game/UI/Icons/Sets/${a}`),
        };
      },
      accept: minCount('assets', 'All 3 assets packaged', 3),
      staticChecks: (e) => [
        cppSymbolExists('FIconSetRow', 'Icon set row struct present in UE Source'),
        seedRowPresent('seed_icon_sets.py', slug(e.name), 'Icon set row seeded in Content/Python'),
      ],
    },
  ],
});
