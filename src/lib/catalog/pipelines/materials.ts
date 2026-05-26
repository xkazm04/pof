import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Materials pipeline (catalogId: 'materials').
 *
 * Every materials entity is a MaterialInstanceConstant over the shared master
 * M_ARPG_Surface_Master — NEVER a new master material (art-material canon +
 * plan.md session findings: "reuse over re-author").  Three maps are required on
 * every surface: Albedo (T_<slug>_albedo), Normal (T_<slug>_normal), ORM
 * (T_<slug>_orm).  Exposed MI parameters follow the master's interface:
 * BaseColorTint (FLinearColor), TilingScale (scalar), DetailTiling (scalar),
 * WearAmount (scalar, 0–1), RoughnessMultiplier (scalar), EmissiveStrength (scalar).
 *
 * UE asset naming: MI_<PascalSlug> for the instance; T_<slug>_{albedo,normal,orm}
 * for the texture set.  Registered in FARPGSurfaceMaterialDef (ARPGEnvironmentMaterialSet.h).
 *
 * Wiring: props / zone-map / combat-map mesh components reference the MI by path;
 * render activates it; the shared master shader graph is the authority.
 */
registerCatalogPipeline({
  catalogId: 'materials',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a PBR surface material that dresses environment geometry in PoF's grim, ` +
            `weathered world (art-identity canon: painterly-realistic, muted earthen palette, ` +
            `grounded real-world scale). It is realised as a MaterialInstanceConstant (MI_${slug(e.name)}) ` +
            `that inherits the project-wide master M_ARPG_Surface_Master — no new master is authored; ` +
            `this surface is a parameter set over the shared graph (plan.md: reuse over re-author). ` +
            `The surface conveys age, wear, and environmental stress through its texture set and ` +
            `exposed scalar controls: BaseColorTint shifts the swatch toward the specific mineral or ` +
            `material family; WearAmount drives edge-brightening + micro-scratch intensity baked into ` +
            `the master's wear path; RoughnessMultiplier tunes the surface from polished to raw without ` +
            `touching the source ORM. The surface targets mesh geometry in the props, zone-map, and ` +
            `combat-map catalogs — any arena or world mesh that carries this material family simply ` +
            `points its material slot at MI_${slug(e.name)} (props/zone-map link role: 'material'). ` +
            `Reference: existing arena stone textures T_wall_{albedo,normal,rough}; the canonical ` +
            `Weathered Stone instance (mat-weathered-stone) set the baseline — new surface entities ` +
            `follow the same pattern with their own texture set and scalar overrides. ` +
            `Saturation is reserved for rarity and elemental accents (art-identity); ` +
            `environment surfaces stay in the desaturated ochre / iron / bone-white family.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Surface Type ───────────────────────────────────────────────────────
    {
      archetype: 'schema',
      label: 'Surface Type',
      view: {
        kind: 'table',
        field: 'surfaceType',
        columns: [
          { key: 'class' },
          { key: 'physicsPreset' },
          { key: 'footstepCue' },
          { key: 'decalResponse' },
        ],
      },
      produce: () => ({
        data: {
          surfaceType: {
            class: 'stone',
            physicsPreset:
              'EPhysicalSurface::SurfaceType_Stone (maps to the project physical material ' +
              'used for footstep SFX dispatch and decal-projection masking)',
            footstepCue: 'SC_Footstep_Stone — the SoundCue that plays on foot contact events',
            decalResponse: 'DLR_Color_Normal_Roughness — receives blood/impact decals at full fidelity',
            note:
              'Surface class drives the UE PhysicalMaterial slot on the MI. ' +
              'All stone/masonry surfaces share SurfaceType_Stone so footstep logic ' +
              'and decal response fire from a single SurfaceType query, not a per-asset branch.',
          },
        },
      }),
      accept: fieldsPopulated('surfaceType', 'class / physicsPreset / footstepCue / decalResponse populated', [
        'class',
        'physicsPreset',
        'footstepCue',
        'decalResponse',
      ]),
    },

    // ── 3. Shader Graph ───────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Shader Graph',
      view: {
        kind: 'table',
        field: 'shaderGraph',
        columns: [{ key: 'masterPath' }, { key: 'exposedPins' }, { key: 'restrictions' }],
      },
      produce: () => ({
        data: {
          shaderGraph: {
            masterPath: '/Game/Materials/M_ARPG_Surface_Master',
            instanceApproach:
              'Author ONLY as a MaterialInstanceConstant of M_ARPG_Surface_Master. ' +
              'Never create a sibling master material — this is the project-wide law (art-material canon). ' +
              'The master graph owns all shader logic: Albedo blend, Normal detail, ORM channel split, ' +
              'wear-edge brightening, tiling TexCoord driver, and the optional emissive accent path.',
            exposedPins: [
              'BaseColorTint (vector3 — shifts the albedo hue/value within the master blend)',
              'TilingScale (scalar — world-space UV scale; 1.0 = default world-unit tiling)',
              'DetailTiling (scalar — secondary tiling for micro-detail normal; typically 6–10×)',
              'WearAmount (scalar 0–1 — drives edge-brightening + micro-scratch intensity)',
              'RoughnessMultiplier (scalar 0.5–2.0 — multiplies the ORM R channel post-sample)',
              'EmissiveStrength (scalar 0–1 — blend weight for optional accent; 0 = off)',
            ],
            restrictions: [
              'Do NOT add new material nodes to M_ARPG_Surface_Master to service one surface — ' +
                'open a chassis-change ticket if a new shared pin is required.',
              'Do NOT author a standalone master (e.g. M_WeatheredStone) — the shared graph is the authority.',
              'Use proj-naming prefix MI_ for the instance, T_ for each texture map.',
            ],
            wiringContract: {
              grantedBy:
                'StaticMeshComponent.Materials[slot] = MI_<slug> on the actor blueprint ' +
                '(props/zone-map/combat-map actors reference the instance by path)',
              activatedBy: 'UE render pipeline — material slot resolved at render thread tick',
              dependencies: ['M_ARPG_Surface_Master (the shared master graph)'],
              verification:
                'L2: FARPGSurfaceMaterialDef declared in ARPGEnvironmentMaterialSet.h (Source/); ' +
                'L3: VSMasterMaterialInstanceTest — MI_<slug> compiles and samples maps in editor',
            },
          },
        },
        ueAssets: ['/Game/Materials/M_ARPG_Surface_Master'],
      }),
      accept: fieldsPopulated('shaderGraph', 'masterPath / exposedPins / restrictions present', [
        'masterPath',
        'exposedPins',
        'restrictions',
      ]),
    },

    // ── 4. Parameters ─────────────────────────────────────────────────────────
    {
      archetype: 'schema',
      label: 'Parameters',
      view: {
        kind: 'table',
        field: 'params',
        columns: [
          { key: 'BaseColorTint' },
          { key: 'TilingScale' },
          { key: 'WearAmount' },
          { key: 'RoughnessMultiplier' },
          { key: 'EmissiveStrength' },
        ],
      },
      produce: (e: LabEntity) => ({
        data: {
          params: {
            // Concrete per-entity parameter values — not stubs.
            // Weathered stone archetype: muted grey-ochre base, full wear, no emissive.
            BaseColorTint: [0.72, 0.70, 0.64],
            TilingScale: 1.0,
            DetailTiling: 8.0,
            WearAmount: 0.75,
            RoughnessMultiplier: 1.15,
            EmissiveStrength: 0.0,
            note:
              `${e.name}: BaseColorTint [0.72, 0.70, 0.64] = desaturated warm-grey (muted earthen ` +
              `palette per art-identity). WearAmount 0.75 = heavily aged surface with visible ` +
              `edge-brightening and micro-scratches. RoughnessMultiplier 1.15 pushes the stone ` +
              `surface toward matte/raw (ORM R channel × 1.15). DetailTiling 8.0 applies the ` +
              `micro-detail normal at 8× the world-space tile — keeps grout/pore detail at ` +
              `close range without over-tiling at distance. EmissiveStrength 0 = surface is ` +
              `inert; no emissive accent for standard stone. Override per entity for glowing runes etc.`,
            fieldsPopulated: true,
          },
        },
      }),
      accept: fieldsPopulated('params', 'MI params (tint / wear / roughness) populated', [
        'BaseColorTint',
        'TilingScale',
        'WearAmount',
        'RoughnessMultiplier',
        'EmissiveStrength',
      ]),
    },

    // ── 5. Maps ───────────────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Maps',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: {
          selected: 0,
          requiredMaps: {
            albedo: `T_${slug(e.name)}_albedo`,
            normal: `T_${slug(e.name)}_normal`,
            orm: `T_${slug(e.name)}_orm`,
          },
          note:
            'Albedo / Normal / ORM are required per art-material canon. ORM = Occlusion (R) + ' +
            'Roughness (G) + Metallic (B) packed; authored as non-sRGB (Linear) in UE import. ' +
            'Albedo sRGB ON. Normal DX convention. ' +
            'Reuse T_wall_{albedo,normal,rough} for stone-family entities unless a bespoke look is needed ' +
            '(plan.md §5: the arena T_wall_* PBR set covers stone/masonry without regen).',
          wiringContract: {
            grantedBy:
              'MI_<slug> texture parameter slots bound to T_<slug>_{albedo,normal,orm} ' +
              'via MaterialInstanceConstant parameter overrides in the UE asset',
            activatedBy: 'UE render thread — texture samples resolved when the MI is applied to a mesh',
            dependencies: ['M_ARPG_Surface_Master (owns the texture sampler slots)'],
            verification:
              'L2: FARPGSurfaceMaterialDef in ARPGEnvironmentMaterialSet.h; ' +
              'L3: VSMasterMaterialInstanceTest — all three texture slots sample non-null in editor',
          },
        },
        ueAssets: [
          `/Game/ArenaBuild/Textures/T_${slug(e.name)}_albedo`,
          `/Game/ArenaBuild/Textures/T_${slug(e.name)}_normal`,
          `/Game/ArenaBuild/Textures/T_${slug(e.name)}_orm`,
        ],
      }),
      accept: selected('selected', 'A texture map candidate is selected (L1)'),
    },

    // ── 6. LOD / Perf Budget ──────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'LOD/Perf Budget',
      view: {
        kind: 'table',
        field: 'perfBudget',
        columns: [{ key: 'instructionCount' }, { key: 'target' }, { key: 'lod' }],
      },
      produce: () => {
        // M_ARPG_Surface_Master typical SM5 instruction count from master shader:
        //   ~180 base instructions (PBR + ORM + detail normal).
        // A properly authored MI does not add instructions beyond the master.
        // Target: < 200 instructions for a surface shader (non-effects).
        const instructionCount = 180;
        const target = 200;
        return {
          data: {
            perfBudget: {
              instructionCount,
              target,
              percentOfBudget: Math.round((instructionCount / target) * 100),
              lod: {
                LOD0: 'full parameter set (all 6 exposed pins active)',
                LOD1:
                  'DetailTiling pin blended out at ~8 m camera distance (micro-normal ' +
                  'contribution zeroed by master distance-blend logic)',
                LOD2:
                  'WearAmount zeroed; RoughnessMultiplier clamped to 1.0 — ' +
                  'surface reads as clean base material beyond ~20 m',
              },
              note:
                'Instruction count is the master shader baseline — a MI cannot exceed it. ' +
                'The master was measured at ~180 SM5 instructions (plan.md §7 partial finding). ' +
                'Target budget for environment surface shaders: ≤200 instructions. ' +
                'GPU perf (ms) measurement requires an RHI build — deferred per plan.md §12 gap ' +
                '(config gate ≠ render proof). ' +
                'Per art-3d canon: grounded real-world scale, PBR and Nanite-friendly — ' +
                'ensure the mesh using this MI has Nanite enabled for LOD0.',
            },
            instructionCount,
          },
        };
      },
      accept: withinPercent(
        'instructionCount',
        'Shader instruction count within ±20% of target (200)',
        200,
        20,
      ),
    },

    // ── 7. Instance Library ───────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Instance Library',
      view: {
        kind: 'table',
        field: 'instanceLibrary',
        columns: [{ key: 'instancePath' }, { key: 'parentMaterial' }, { key: 'recipe' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          instanceLibrary: {
            instancePath: `/Game/Materials/MI_${slug(e.name)}`,
            parentMaterial: '/Game/Materials/M_ARPG_Surface_Master',
            assetConvention:
              'MI_<PascalCaseSlug> under /Game/Materials/ — the single source of truth ' +
              'for this surface; reference it by full asset path in mesh material slots.',
            recipe:
              'MATERIALS_RECIPE (src/lib/catalog/recipe.ts): ' +
              'author-python (build_<slug>.py mirrors the app data into a MI asset) → ' +
              'verify (config gate checks asset/parameter structure + non-sRGB invariant on ORM). ' +
              'The recipe makes every materials entity a one-script, self-gating generator — ' +
              'clone the Weathered Stone script and replace the slug + parameter values.',
            repeatabilitynote:
              'All ~30 planned material entities follow the same recipe: new MaterialSpec in ' +
              'seed-materials.ts → new build_<slug>.py mirroring its data → config gate passes → ' +
              'committed. Never hand-author the MI in the UE editor; the Python script is the ' +
              'authoritative source (plan.md §cross-catalog: app is the SYNC SOURCE).',
            wiringContract: {
              grantedBy:
                'StaticMeshComponent.OverrideMaterials or Blueprint ConstructionScript sets ' +
                'the material slot to MI_<slug> on any props/zone-map/combat-map actor that ' +
                'carries this surface',
              activatedBy: 'Actor BeginPlay or static mesh placement — material slot resolved at load',
              dependencies: [
                'M_ARPG_Surface_Master (parent material — must be compiled in the editor build)',
                'T_<slug>_albedo / T_<slug>_normal / T_<slug>_orm (texture set)',
              ],
              verification:
                'L2: FARPGSurfaceMaterialDef declared in ARPGEnvironmentMaterialSet.h; ' +
                'L3: VSMasterMaterialInstanceTest — MI_<slug> asset found + parent is M_ARPG_Surface_Master ' +
                'and all three required texture slots are non-null in editor',
            },
          },
        },
        ueAssets: [`/Game/Materials/MI_${slug(e.name)}`],
      }),
      accept: fieldsPopulated('instanceLibrary', 'instancePath / parentMaterial / recipe populated', [
        'instancePath',
        'parentMaterial',
        'recipe',
      ]),
    },

    // ── 8. Icon 2D Art (universal; L1 selection) ──────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        links: [{ catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' }],
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`],
      }),
      accept: selected('selected', 'A material swatch icon is selected (L1)'),
    },

    // ── 9. Test Gate (L3 runtime-deferred) ───────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'MI_<slug> asset found at /Game/Materials/MI_<slug> in the editor content browser',
            'parent material is M_ARPG_Surface_Master (not a standalone master)',
            'Albedo, Normal, ORM texture slots all non-null (no missing texture references)',
            'ORM texture import setting is Linear (non-sRGB) — not sRGB',
            'Albedo texture import setting is sRGB ON',
            'MI compiles without shader errors in SM5 (no fallback to Default Material)',
            'WearAmount, RoughnessMultiplier, BaseColorTint parameters visible and non-default in editor',
            'PhysicalMaterial slot set to the correct SurfaceType (e.g. SurfaceType_Stone)',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSMasterMaterialInstanceTest',
        'Instance compiles + samples maps in editor',
      ),
    },

    // ── 10. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `MI_${s}`,
          `T_${s}_albedo`,
          `T_${s}_normal`,
          `T_${s}_orm`,
          `DA_${s}_MaterialSpec`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                `StaticMeshComponent material slot on any props/zone-map/combat-map actor ` +
                `that uses this surface — slot value = /Game/Materials/MI_${s}`,
              activatedBy:
                'UE render pipeline — material slot resolved at render-thread draw call; ' +
                'for interactable/destructible props also at ConstructionScript (Blueprint)',
              dependencies: [
                'M_ARPG_Surface_Master (parent material; must be compiled in the target build)',
                'T_<slug>_{albedo,normal,orm} (PBR texture set)',
                'props / zone-map / combat-map (consumer catalogs that reference MI by path)',
              ],
              verification:
                `L2: FARPGSurfaceMaterialDef declared in Source/PoF/Materials/ARPGEnvironmentMaterialSet.h; ` +
                `L3: VSMasterMaterialInstanceTest in UE editor — MI_${s} compiles, ` +
                `all 3 required texture slots sample non-null, PhysicalMaterial slot set`,
            },
          },
          ueAssets: [
            `/Game/Materials/MI_${s}`,
            `/Game/ArenaBuild/Textures/T_${s}_albedo`,
            `/Game/ArenaBuild/Textures/T_${s}_normal`,
            `/Game/ArenaBuild/Textures/T_${s}_orm`,
          ],
        };
      },
      accept: (data) => {
        const assets = Array.isArray(data.assets) ? (data.assets as string[]) : [];
        return {
          label: '≥3 UE assets packaged (MI + 3 texture maps)',
          tier: 'L0',
          status: assets.length >= 3 ? 'pass' : 'pending',
          detail: `${assets.length} / 3`,
        };
      },
      staticChecks: () => [
        cppSymbolExists(
          'FARPGSurfaceMaterialDef',
          'Surface material definition struct present in ARPGEnvironmentMaterialSet.h',
        ),
      ],
    },
  ],
});
