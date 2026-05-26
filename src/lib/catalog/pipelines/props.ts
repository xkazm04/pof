import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Props pipeline (catalogId: 'props').
 *
 * Represents interactable / destructible world objects in PoF.  The seeded
 * starter is the Reinforced Crate — a loot container that can be opened (intact)
 * or destroyed (Chaos fracture) to spill its contents.
 *
 * Key wiring:
 *   AARPGDestructibleActor (Physics/ARPGDestructibleActor.h) — the Chaos-backed
 *     base class; BP_ReinforcedCrate extends it.
 *   UARPGLootDropComponent (Loot/ARPGLootDropComponent.h) — attached to the BP;
 *     invoked on AARPGDestructibleActor::OnBroken delegate → executes the
 *     loot-tables::lt-Brute drop roll at ilvl = areaLevel.
 *   materials::mat-weathered-stone — the crate surface MI (MI_ReinforcedCrate
 *     over M_ARPG_Surface_Master).
 *   vfx::vfx-fire-impact — shared NS_FireImpactBurst played at the fracture
 *     point on the OnBroken event (keyed via AnimNotify on the fracture
 *     geometry-collection animation).
 *   icon-sets::iconset-abilities — icon-family source for the prop thumbnail.
 *
 * Per ARPG-LAWS §7 the loot table sets weights and ilvl; §1/§2 fill the dropped
 * item.  The prop never authors item stats inline (canon proj-links).
 */
registerCatalogPipeline({
  catalogId: 'props',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a mid-weight destructible loot container placed in dungeon and arena ` +
            `environments throughout PoF. Built from iron-banded hardwood reinforced with riveted ` +
            `corner plates, it reads as well-used and weathered — consistent with the grim, ` +
            `earned tone of the post-Sundering world (canon game-tone, art-identity). In gameplay ` +
            `terms it is a secondary faucet: a static object the player can interact with (tap to ` +
            `open, or strike to destroy) to receive a single loot-table roll from lt-Brute at ` +
            `ilvl = the current area level (ARPG-LAWS §7c). It is not a treasure chest — normal ` +
            `play encounters it alongside enemy packs, rewarding thorough exploration rather than ` +
            `targeted farming. Destruction is satisfying but not required: opening intact is ` +
            `loot-equivalent to destroying. The prop exists at the intersection of environment ` +
            `art, physics, and loot — it must look right in the arena, fracture convincingly ` +
            `under Chaos, and reliably fire the drop component on break. Variants planned: ` +
            `Cracked Crate (lower health, faster fracture, same loot table) and Arcane Lockbox ` +
            `(requires unlock interaction, boosted rare odds). This starter entity drives the ` +
            `full pipeline end-to-end from Concept Brief to Test Gate.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Interaction ────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Interaction',
      view: {
        kind: 'table',
        field: 'interaction',
        columns: [
          { key: 'interactType' },
          { key: 'triggerCondition' },
          { key: 'prompt' },
          { key: 'healthThreshold' },
        ],
      },
      produce: () => ({
        data: {
          interaction: {
            interactType: 'destructible/openable',
            triggerCondition:
              'Player enters UE5 SphereComponent overlap radius (120 cm); ' +
              'Enhanced Input IA_Interact fires (hold 0.4 s, toggleable per input-a11y canon); ' +
              'OR the crate health drops to 0 from damage — both paths invoke the same OnBroken delegate.',
            prompt: 'Open Crate [hold E / hold A]',
            healthThreshold: {
              total: 80,
              note:
                'Reinforced Crate baseline HP = 80 (≈ 2 light player attacks). ' +
                'Damaged state triggers at 40 HP (50% loss); destroyed state triggers at 0 HP. ' +
                'These are world-object HP values, not character sheet attributes — they live in ' +
                'the BP default properties, not DT_AttributeDefaults (which governs actor/enemy stats).',
            },
            openBehavior:
              'Intact-open plays a swing-lid anim (A_ReinforcedCrate_Open, 0.6 s) then triggers ' +
              'UARPGLootDropComponent::ExecuteDrop. No fracture; mesh stays intact.',
            destroyBehavior:
              'AARPGDestructibleActor::ApplyDestructionDamage is called when HP reaches 0; ' +
              'Chaos fracture breaks the geometry collection into debris chunks (4–8 pieces); ' +
              'OnBroken delegate → UARPGLootDropComponent::ExecuteDrop + NS_FireImpactBurst spawn.',
            wiringContract: {
              grantedBy:
                'BP_ReinforcedCrate (child of AARPGDestructibleActor) — UARPGLootDropComponent ' +
                'attached as a component in the BP defaults',
              activatedBy:
                'Enhanced Input IA_Interact (intact path: open animation → ExecuteDrop) OR ' +
                'AARPGDestructibleActor::OnBroken delegate broadcast (destroy path → ExecuteDrop)',
              dependencies: [
                'UARPGLootDropComponent (Loot/ARPGLootDropComponent.h)',
                'AARPGDestructibleActor (Physics/ARPGDestructibleActor.h)',
                'loot-tables::lt-Brute (drop pool)',
              ],
              verification:
                'L2: AARPGDestructibleActor + UARPGLootDropComponent in Source/PoF/; ' +
                'L3: VSPropInteractTest — Open intact triggers ExecuteDrop; Destroy triggers OnBroken + ExecuteDrop in PIE',
            },
          },
        },
      }),
      accept: fieldsPopulated('interaction', 'interactType / triggerCondition / prompt / healthThreshold populated', [
        'interactType',
        'triggerCondition',
        'prompt',
        'healthThreshold',
      ]),
    },

    // ── 3. 3D & LODs ──────────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: '3D & LODs',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: {
          selected: 0,
          meshName: `SM_${slug(e.name)}`,
          triBudget: {
            LOD0: {
              tris: 1200,
              note:
                'Reinforced Crate LOD0 target ≤ 1 200 tris (a compact mid-size prop; ' +
                'art-3d canon: PBR + Nanite-friendly, grounded real-world scale). ' +
                'Box body 480 t, lid 220 t, iron bands × 4 at 80 t each = 1 020 t base; ' +
                'rivet details can push to 1 200 t max.',
            },
            LOD1: { tris: 600, note: 'LOD1 at ~5 m camera distance — 50% of LOD0; drop rivet geometry' },
            LOD2: { tris: 200, note: 'LOD2 at ~15 m — box silhouette only; Nanite handles LOD0→LOD1 range' },
            LOD3: { tris: 80, note: 'LOD3 / impostor at ~30 m; cull at 40 m' },
          },
          nanite: true,
          note:
            'Per art-3d canon: Nanite enabled on LOD0 mesh; tri budget above is the pre-Nanite ' +
            'source mesh target. Chaos geometry-collection (GC_ReinforcedCrate) is a separate ' +
            'asset generated from the LOD0 source — GC does not use Nanite (UE5 limitation). ' +
            'The intact SM and the fractured GC share the same material slot (MI_ReinforcedCrate).',
        },
        ueAssets: [
          `/Game/Props/SM_${slug(e.name)}`,
          `/Game/Props/GC_${slug(e.name)}`,
        ],
      }),
      accept: selected('selected', 'A 3D mesh candidate is selected (L1)'),
    },

    // ── 4. Collision & Physics ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Collision & Physics',
      view: {
        kind: 'table',
        field: 'physics',
        columns: [
          { key: 'collisionPreset' },
          { key: 'massKg' },
          { key: 'chaosEnabled' },
        ],
      },
      produce: () => ({
        data: {
          physics: {
            collisionPreset:
              'BlockAllDynamic — the intact crate blocks player movement and projectiles. ' +
              'Overlap sphere (120 cm radius) on a separate SphereComponent (ECC_WorldDynamic, ' +
              'GenerateOverlapEvents = true) drives the interact prompt. ' +
              'Post-fracture debris chunks use SimulatePhysics = true with the PhysicsObject ' +
              'preset (no character-blocking; debris resolves against WorldStatic).',
            massKg: 45,
            massNote:
              '45 kg for a hardwood + iron-banded crate of ~80 × 60 × 60 cm. ' +
              'UE physics material: density ≈ 700 kg/m³ (dense hardwood + iron fittings). ' +
              'Chaos fracture impulse strength = 500 (AARPGDestructibleActor default) provides ' +
              'convincing scatter without "flying debris" at this mass.',
            chaosEnabled: true,
            chaosNotes:
              'GeometryCollection (GC_ReinforcedCrate) authored in the Fracture Editor: ' +
              '8–12 voronoi cells weighted toward the lid and corner-plate seams. ' +
              'Damage threshold = 80 (full HP) so a single player heavy-attack (≈ 80+ damage) ' +
              'fractures in one hit; lighter attacks accumulate via ApplyDestructionDamage. ' +
              'generate_on_begin_play = false (ref: ue-scatter-begin-play-regen — avoids ' +
              'discarding edit-time collision on BeginPlay).',
            footstepSurface:
              'PhysicalMaterial = PM_Wood_Hollow — maps to wooden-hollow footstep cue ' +
              'SC_Footstep_Wood; debris pieces use PM_Stone_Debris after fracture.',
            wiringContract: {
              grantedBy:
                'BP_ReinforcedCrate ConstructionScript sets CollisionPreset and attaches ' +
                'the overlap SphereComponent; Chaos GC asset referenced in GeometryCollectionComponent',
              activatedBy:
                'AARPGDestructibleActor::ApplyDestructionDamage called by damage pipeline; ' +
                'GeometryCollectionComponent activates Chaos simulation on fracture threshold',
              dependencies: [
                'AARPGDestructibleActor (Physics/ARPGDestructibleActor.h)',
                'GC_ReinforcedCrate (Chaos geometry-collection asset)',
              ],
              verification:
                'L2: AARPGDestructibleActor declared in Source/PoF/Physics/; ' +
                'L3: VSPropInteractTest — crate blocks player movement intact; debris scatters on destroy in PIE',
            },
          },
        },
      }),
      accept: fieldsPopulated('physics', 'collisionPreset / massKg / chaosEnabled populated', [
        'collisionPreset',
        'massKg',
        'chaosEnabled',
      ]),
    },

    // ── 5. Material ───────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Material',
      view: {
        kind: 'table',
        field: 'material',
        columns: [{ key: 'instance' }, { key: 'parentMaterial' }, { key: 'parameters' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          material: {
            instance: `MI_${slug(e.name)}`,
            parentMaterial: '/Game/Materials/M_ARPG_Surface_Master',
            instanceNote:
              'MI_ReinforcedCrate is a MaterialInstanceConstant of the project-wide master ' +
              '(M_ARPG_Surface_Master) following the art-material canon: never a standalone ' +
              'master material. The surface reads as banded hardwood + aged iron — both handled ' +
              'by the master\'s wear and tint paths.',
            parameters: {
              BaseColorTint: [0.55, 0.42, 0.30],
              TilingScale: 1.2,
              DetailTiling: 6.0,
              WearAmount: 0.85,
              RoughnessMultiplier: 1.05,
              EmissiveStrength: 0.0,
              note:
                'BaseColorTint [0.55, 0.42, 0.30] = warm dark-brown (weathered hardwood). ' +
                'WearAmount 0.85 = heavily aged surface; edge-brightening reveals bare wood grain. ' +
                'RoughnessMultiplier 1.05 = matte/raw wood; iron bands are a second material overlay ' +
                'handled by a tri-planar blend in the master (or a separate MI_ReinforcedCrate_Metal ' +
                'for the bands if the master supports a second layer). ' +
                'DetailTiling 6.0 = wood-grain micro-detail at 6× world-space tile.',
            },
            physicalMaterial: 'PM_Wood_Hollow',
            wiringContract: {
              grantedBy:
                'StaticMeshComponent.Materials[0] = MI_ReinforcedCrate on BP_ReinforcedCrate; ' +
                'same MI applied to the GeometryCollectionComponent material slots',
              activatedBy: 'UE render pipeline — material slot resolved at draw call',
              dependencies: [
                'M_ARPG_Surface_Master (parent material)',
                'materials::mat-weathered-stone (surface-family reference — this MI is within the same family)',
              ],
              verification:
                'L2: FARPGSurfaceMaterialDef declared in ARPGEnvironmentMaterialSet.h; ' +
                'L3: VSMasterMaterialInstanceTest — MI_ReinforcedCrate compiles, all texture slots non-null',
            },
          },
        },
        links: [
          { catalogId: 'materials', entityId: 'mat-weathered-stone', role: 'surface-family' },
        ],
        ueAssets: [`/Game/Materials/MI_${slug(e.name)}`],
      }),
      accept: fieldsPopulated('material', 'instance / parentMaterial / parameters populated', [
        'instance',
        'parentMaterial',
        'parameters',
      ]),
    },

    // ── 6. Destruction States ─────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Destruction States',
      view: {
        kind: 'table',
        field: 'destructionStates',
        columns: [
          { key: 'intact' },
          { key: 'damaged' },
          { key: 'destroyed' },
        ],
      },
      produce: () => ({
        data: {
          destructionStates: {
            intact: {
              hpRange: '80–41 HP',
              mesh: 'SM_ReinforcedCrate (static mesh, full geometry)',
              material: 'MI_ReinforcedCrate (WearAmount 0.85)',
              stateTag: 'State.Prop.Intact',
              note: 'Default state. Collision preset BlockAllDynamic. Interact prompt active.',
            },
            damaged: {
              hpRange: '40–1 HP',
              mesh: 'SM_ReinforcedCrate with damage decals (D_CrateImpact_01)',
              material: 'MI_ReinforcedCrate + dynamic damage parameter override (WearAmount → 1.0)',
              stateTag: 'State.Prop.Damaged',
              note:
                'Triggered when HP drops below 50% (40 HP). A material parameter collection ' +
                'dynamic instance lerps WearAmount from 0.85 → 1.0 on entering this state. ' +
                'Board-crack decal spawned at the last impact point. Interact prompt still active.',
            },
            destroyed: {
              hpRange: '0 HP',
              mesh: 'GC_ReinforcedCrate (Chaos geometry collection — 8–12 fracture chunks)',
              material: 'MI_ReinforcedCrate (applied per-chunk)',
              stateTag: 'State.Prop.Destroyed',
              note:
                'AARPGDestructibleActor::OnBroken delegate fires. Chaos simulation activates: ' +
                'chunks scatter with ImpulseStrength 500, then settle and fade after 8 s ' +
                '(UE Geometry Collection auto-disable on sleep + a timed GC sweep). ' +
                'UARPGLootDropComponent::ExecuteDrop called from OnBroken. ' +
                'Interact prompt disabled. Cannot re-enter Intact or Damaged.',
            },
            chaosFractureSpec: {
              cellCount: '8–12 voronoi cells',
              fracturePattern: 'Weighted toward lid seam and corner plates — reads as breaking at the weakest joints',
              debrisFadeDelay: 8.0,
              impulseStrength: 500,
            },
            wiringContract: {
              grantedBy:
                'BP_ReinforcedCrate Blueprint graph: OnBroken event → set State.Prop.Destroyed tag ' +
                '(UAbilitySystemComponent::AddLooseGameplayTag) + call ExecuteDrop on UARPGLootDropComponent',
              activatedBy:
                'AARPGDestructibleActor damage accumulation → ApplyDestructionDamage → fracture threshold crossed',
              dependencies: [
                'AARPGDestructibleActor (Physics/ARPGDestructibleActor.h)',
                'GC_ReinforcedCrate (Chaos geometry collection)',
                'State.Prop.* gameplay tag hierarchy registered in GameplayTags.ini',
              ],
              verification:
                'L2: AARPGDestructibleActor declared in Source/PoF/Physics/; State.Prop tags present in .ini; ' +
                'L3: VSPropInteractTest — destroy transitions Intact→Damaged→Destroyed in PIE; debris scatters',
            },
          },
        },
      }),
      accept: fieldsPopulated('destructionStates', 'intact / damaged / destroyed states defined', [
        'intact',
        'damaged',
        'destroyed',
      ]),
    },

    // ── 7. Loot on Destroy ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Loot on Destroy',
      view: {
        kind: 'table',
        field: 'lootOnDestroy',
        columns: [{ key: 'lootTable' }, { key: 'ilvlSource' }, { key: 'dropCount' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          lootOnDestroy: {
            lootTable: 'loot-tables::lt-Brute',
            lootTableNote:
              'The Reinforced Crate draws from the lt-Brute loot pool — the same table used by ' +
              'Brute/Goblin archetype enemies in the mid-game area band (ilvl 40–60). ' +
              'This gives the crate a meaningful but unsurprising reward: a reliable currency ' +
              'trickle + occasional Rare upgrade, consistent with the "exploration reward" tier. ' +
              'Per ARPG-LAWS §7: the loot table sets itemClassWeights + rarityWeights; ilvl ' +
              'is sourced from areaLevel at time of fracture — the prop never self-assigns ilvl ' +
              'or re-authors item stats (canon proj-links).',
            ilvlSource: 'areaLevel at the moment UARPGLootDropComponent::ExecuteDrop fires',
            dropCount: {
              intact_open: { min: 1, max: 2, note: 'Standard loot table roll — same as a Normal monster drop' },
              destroy: { min: 1, max: 2, note: 'Destroy path is loot-equivalent to intact open; no bonus drops' },
            },
            rarityBaselineNote:
              'Baseline rarity from lt-Brute (per ARPG-LAWS §7b): Normal ~75% / Magic ~20% / ' +
              'Rare ~4.5% / Unique ~0.5%. Container source rarity is treated as "Normal monster" — ' +
              'no rarity uplift vs a trash pack. IIR/IIQ from the player\'s UARPGAttributeSet applies.',
            pity: {
              enabled: false,
              note: 'No pity counter on prop containers — pity is reserved for enemy sources (lt-Brute §4)',
            },
            wiringContract: {
              grantedBy:
                'UARPGLootDropComponent attached to BP_ReinforcedCrate; bound to the lt-Brute ' +
                'FARPGLootTableRow by entityId slug "ltBrute" (slug(lt-Brute) in seed_loot_tables.py)',
              activatedBy:
                'BP_ReinforcedCrate::OnBroken event → ExecuteDrop; also fired on intact-open ' +
                'animation completion notify (A_ReinforcedCrate_Open → AnimNotify_LootDrop)',
              dependencies: [
                'loot-tables::lt-Brute (drop pool — seeded from DEFAULT_ENEMY_LOOT_BINDINGS)',
                'UARPGLootDropComponent (Loot/ARPGLootDropComponent.h)',
                'DT_LootTables (UE DataTable binding)',
              ],
              verification:
                'L2: UARPGLootDropComponent in Source/PoF/Loot/; lt-Brute row in DT_LootTables; ' +
                'L3: VSPropInteractTest — Destroy → drops loot + spawns debris in PIE',
            },
          },
          // top-level links for the store fold + readLinks
          links: [
            { catalogId: 'loot-tables', entityId: 'lt-Brute', role: 'loot-on-destroy' },
          ],
        },
        links: [
          { catalogId: 'loot-tables', entityId: 'lt-Brute', role: 'loot-on-destroy' },
        ],
      }),
      accept: minCount('links', '≥1 loot-table link declared', 1),
      staticChecks: () => [
        cppSymbolExists('UARPGLootDropComponent', 'Loot drop component present in Source/PoF/Loot/'),
      ],
    },

    // ── 8. VFX / Audio ────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'VFX / Audio',
      view: {
        kind: 'table',
        field: 'vfxAudio',
        columns: [{ key: 'destructionVfx' }, { key: 'openAudio' }, { key: 'impactAudio' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          vfxAudio: {
            destructionVfx: {
              asset: 'NS_FireImpactBurst (vfx::vfx-fire-impact)',
              spawnPoint: 'Crate centroid at fracture moment',
              scaleFactor: 0.6,
              note:
                'The NS_FireImpactBurst Niagara system from vfx::vfx-fire-impact is scaled to 0.6× ' +
                '(a prop-sized burst, not an ability hit-flash) and tinted to a wood-dust amber palette ' +
                'via a Niagara parameter override. Spawned from BP_ReinforcedCrate::OnBroken → ' +
                'UNiagaraFunctionLibrary::SpawnSystemAtLocation. Per vfx-budget canon: fires from an ' +
                'AnimNotify on the GeometryCollection activation (not BeginPlay/timer), 3 LOD tiers, ' +
                'peak GPU ≤ 0.48 ms.',
            },
            openAudio: {
              cue: 'SC_Crate_Open',
              trigger: 'AnimNotify_LootDrop on A_ReinforcedCrate_Open at 0.4 s into the swing-lid animation',
              note:
                'Wood-creak + hinge-squeal composite cue, ~0.5 s. ' +
                'Attenuation: InnerRadius 200 cm / FalloffDistance 600 cm (audible at interact range).',
            },
            impactAudio: {
              cue: 'SC_Crate_Impact',
              trigger: 'Each call to ApplyDestructionDamage that lowers HP below the damaged threshold',
              note: 'Wood-thud impact ~0.2 s; randomized pitch ± 5% via SoundCue modulator node.',
            },
            destroyAudio: {
              cue: 'SC_Crate_Destroy',
              trigger: 'OnBroken delegate — fired simultaneously with the VFX spawn',
              note:
                'Wood-splinter crack + metal-ring resonance, ~0.7 s. Spatially attenuated. ' +
                'Overlaps with debris physics impact sounds (PM_Wood_Hollow physical material cue).',
            },
            wiringContract: {
              grantedBy:
                'BP_ReinforcedCrate Blueprint event graph: OnBroken → SpawnSystemAtLocation(NS_FireImpactBurst) ' +
                '+ SpawnSoundAtLocation(SC_Crate_Destroy); AnimNotify_LootDrop → SpawnSoundAtLocation(SC_Crate_Open)',
              activatedBy:
                'AARPGDestructibleActor::OnBroken broadcast (destroy path) / AnimNotify (open path)',
              dependencies: [
                'vfx::vfx-fire-impact (NS_FireImpactBurst Niagara system)',
                'AARPGDestructibleActor (OnBroken delegate)',
              ],
              verification:
                'L2: AARPGDestructibleActor::OnBroken delegate declared in Source/PoF/Physics/; ' +
                'L3: VSPropInteractTest — NS_FireImpactBurst spawns at crate centroid on destroy in PIE',
            },
          },
        },
        links: [
          { catalogId: 'vfx', entityId: 'vfx-fire-impact', role: 'destruction-vfx' },
        ],
      }),
      accept: fieldsPopulated('vfxAudio', 'destructionVfx / openAudio / impactAudio defined', [
        'destructionVfx',
        'openAudio',
        'impactAudio',
      ]),
    },

    // ── 9. Icon 2D Art (universal; L1 selection) ──────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        links: [{ catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' }],
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`],
      }),
      accept: selected('selected', 'A prop icon candidate is selected (L1)'),
    },

    // ── 10. Test Gate (L3 runtime-deferred) ───────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'Interact prompt appears when player enters overlap radius',
            'Intact-open path: swing-lid anim plays then ExecuteDrop fires',
            'Destroy path: HP drains to 0 → OnBroken fires → Chaos fracture + NS_FireImpactBurst + ExecuteDrop',
            'Loot drop resolves at ilvl = current areaLevel (not a fixed value)',
            'Debris chunks scatter with SimulatePhysics = true and do not block the player after fracture',
            'State.Prop.Destroyed tag applied on OnBroken; interact prompt disabled post-destroy',
            'Crate cannot be re-opened or re-destroyed after the first destroy event',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSPropInteractTest',
        'Destroy → drops loot + spawns debris in PIE',
      ),
    },

    // ── 11. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `SM_${s}`,
          `GC_${s}`,
          `BP_${s}`,
          `MI_${s}`,
          `A_${s}_Open`,
          `NS_${s}_Destroy`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                `BP_${s} (child of AARPGDestructibleActor) — UARPGLootDropComponent attached; ` +
                `StaticMeshComponent + GeometryCollectionComponent reference SM_${s} and GC_${s}; ` +
                `material slot 0 = MI_${s} on both`,
              activatedBy:
                `Enhanced Input IA_Interact overlap → intact-open path (A_${s}_Open anim + AnimNotify_LootDrop) OR ` +
                `AARPGDestructibleActor::ApplyDestructionDamage → fracture threshold → OnBroken → ` +
                `UARPGLootDropComponent::ExecuteDrop + NS_FireImpactBurst spawn`,
              dependencies: [
                'AARPGDestructibleActor (Physics/ARPGDestructibleActor.h)',
                'UARPGLootDropComponent (Loot/ARPGLootDropComponent.h)',
                'loot-tables::lt-Brute (drop pool — DT_LootTables)',
                'materials::mat-weathered-stone (surface-family; MI inherits M_ARPG_Surface_Master)',
                'vfx::vfx-fire-impact (NS_FireImpactBurst — destruction VFX)',
              ],
              verification:
                `L2: AARPGDestructibleActor + UARPGLootDropComponent in Source/PoF/; ` +
                `MI_${s} inherits M_ARPG_Surface_Master; ` +
                `L3: VSPropInteractTest — destroy fires OnBroken + ExecuteDrop + NS_FireImpactBurst in PIE`,
            },
          },
          links: [
            { catalogId: 'loot-tables', entityId: 'lt-Brute',            role: 'loot-on-destroy' },
            { catalogId: 'materials',   entityId: 'mat-weathered-stone', role: 'surface-family' },
            { catalogId: 'vfx',         entityId: 'vfx-fire-impact',     role: 'destruction-vfx' },
            { catalogId: 'icon-sets',   entityId: 'iconset-abilities',   role: 'icon-family' },
          ],
          ueAssets: assets.map((a) => `/Game/Props/${a}`),
        };
      },
      accept: minCount('assets', '≥4 UE assets packaged', 4),
      staticChecks: () => [
        cppSymbolExists('AARPGDestructibleActor', 'Destructible actor base class in Source/PoF/Physics/'),
        cppSymbolExists('UARPGLootDropComponent', 'Loot drop component in Source/PoF/Loot/'),
      ],
    },
  ],
});
