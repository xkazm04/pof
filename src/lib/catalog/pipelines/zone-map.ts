import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Zone Map pipeline (catalogId: 'zone-map').
 *
 * An explorable region that HOSTS combat encounters (arena slices) and drives
 * encounter density + loot ilvl through its areaLevel.  Per ARPG-LAWS §11 and
 * canon `arpg-area-level`: areaLevel is the master scalar — monster level and
 * dropped-item ilvl derive from it; never hand-tune per-enemy numbers per area.
 *
 * Cross-catalog composition:
 *   combat-map::arena-ravaged-courtyard  — the seeded arena slice this zone hosts
 *   bestiary::bestiary-brute             — the enemy archetype placed in that arena
 *   materials::mat-weathered-stone       — ground/surface material family
 *   ambient::ambient-forest-day          — environmental soundscape
 *   music::music-combat-a               — adaptive combat music track
 *   icon-sets::iconset-abilities         — shared icon set (universal step)
 *
 * Target entity: Ashen Forest (z-ashen), seeded via seedZoneEntries() from ZONES.
 * Seeded entity id: 'zone-z-ashen' (zoneToEntry prefixes 'zone-' to the zone id).
 *
 * Area level drives the whole chain per ARPG-LAWS §11:
 *   Ashen Forest areaLevel 5 (levelMax from ZONES) → monsterLevel 5 → loot ilvl 5.
 *   Enemy pack sizes use the §6c density formula; encounter density targets ~38 enemies
 *   across 5 sectors (matching ENEMY_DENSITY_CONFIG, on par with Whisper Woods).
 */
registerCatalogPipeline({
  catalogId: 'zone-map',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is the explorable-region entity for the Ashen Forest — the scorched ` +
            `eastern continuation of Whisper Woods, burning after a wildfire touched off by ` +
            `the post-Sundering ley-line rupture. Once verdant, the clearing is now charred ` +
            `deadfall, drifting ash, smouldering ember pits, and a low dusk sun filtered ` +
            `through smoke haze. The zone sits at area level 5 (levelRange 3–5), making it ` +
            `the leveling bridge between Whisper Woods (1–3) and Bandit Camp (3–5). ` +
            `Architecturally it is a ~44 m scorched clearing ringed by charred trunks, with ` +
            `a seamless entry from Whisper Woods and a loading-door exit to Bandit Camp. ` +
            `Its role in the game loop: the zone HOSTS the Ravaged Courtyard arena slice ` +
            `(combat-map::arena-ravaged-courtyard), supplies ~38 enemies across 5 sectors ` +
            `(Brute archetype density balanced for areaLevel 5), and delivers loot at ilvl 5 ` +
            `— driving the first Rare gear tier for players finishing the Whisper Woods band. ` +
            `Ambient character: desaturated greys, dull ember orange, ExponentialHeightFog + ` +
            `post-process desaturation + warm bloom; mood is "the green you knew, burned." ` +
            `The UE asset is /Game/Maps/AshenForest.umap (baked, reload-verified, committed ` +
            `to pof-exp @1ec6353). Lighting is MOVABLE (dusk DirectionalLight + SkyLight + ` +
            `ember PointLight) to avoid a Lightmass bake in headless CI.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Macro Layout & POIs ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Macro Layout & POIs',
      view: {
        kind: 'table',
        field: 'layout',
        columns: [
          { key: 'clearingDiameterM' },
          { key: 'sectors' },
          { key: 'pois' },
          { key: 'navigationContract' },
        ],
      },
      produce: () => ({
        data: {
          layout: {
            // Scorched clearing: ~44 m diameter walkable area, ringed by charred deadfall.
            clearingDiameterM: 44,
            sectors: [
              { name: 'NW', label: 'North-West Deadfall',   enemyDensityLabel: '6',  terrain: 'charred trunks + ground ember pits' },
              { name: 'NE', label: 'North-East Ash Field',  enemyDensityLabel: '9',  terrain: 'open ash, low visibility via fog' },
              { name: 'Center', label: 'Clearing Centre',   enemyDensityLabel: '11', terrain: 'ember bonfire, shrine, highest density' },
              { name: 'SW', label: 'South-West Tree Line',  enemyDensityLabel: '5',  terrain: 'sparse trunks, natural funnel' },
              { name: 'SE', label: 'South-East Ember Bank', enemyDensityLabel: '7',  terrain: 'ember pits + falling-deadfall hazard band' },
            ],
            // Per ZONE_POIS: 3 quest, 2 treasure, 1 shrine, 1 bonfire (discovery 0% initially).
            pois: [
              { type: 'quest',    count: 3, note: 'Scout log, corpse, ley-stone inscription — feed quests::quest-ember-pact' },
              { type: 'treasure', count: 2, note: 'Locked chest + buried cache; ilvl 5 rolls' },
              { type: 'shrine',   count: 1, note: 'Ember shrine — temp resist buff while active' },
              { type: 'bonfire',  count: 1, note: '"Ashen Crossing" fast-travel node; saves on interact' },
            ],
            navigationContract: {
              // Seamless from Whisper Woods (navMeshContinuity:true); loading-door to Bandit Camp.
              entry: { from: 'z2 (Whisper Woods)', edgeType: 'seamless', navMeshContinuity: true, transitionSec: 0 },
              exit:  { to:   'z4 (Bandit Camp)',   edgeType: 'door',     navMeshContinuity: false, transitionSec: 1.5 },
              fastTravelNode: 'Ashen Crossing',
              // NavMesh bake is a documented gap (plan.md §3) — config gate proves lighting/PP, not traversal.
              navMeshBaked: false,
              navMeshGapNote: 'RecastNavMesh bake and ProcGenWalkTest are a shared gap — see plan.md §Finding-Nav.',
            },
            wiringContract: {
              grantedBy:
                'AARPGEncounterVolume at sector positions; ZONE_EDGES + ZONE_POIS data models drive the nav graph',
              activatedBy:
                'Level load — ZONE_EDGES.edgeType seamless means navMesh carries through from z2 without a load screen',
              dependencies: [
                'ZONE_EDGES z2→z-ashen (seamless), z-ashen→z4 (door) in sub_world/_shared/data.ts',
                'ZONE_POIS z-ashen entries (quest×3, treasure×2, shrine×1, bonfire×1)',
                'FAST_TRAVEL_NODES "Ashen Crossing" entry',
              ],
              verification:
                'L0: ZONE_EDGES + ZONE_POIS entries present in data.ts seed; ' +
                'L2: AARPGEncounterVolume declared in Source/PoF/; ' +
                'L3: VSZoneTest — zone loads, bonfire POI reachable from entry',
            },
          },
        },
      }),
      accept: fieldsPopulated('layout', 'Sectors / POIs / navigation contract populated', [
        'sectors',
        'pois',
        'navigationContract',
      ]),
    },

    // ── 3. Area Level & Density ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Area Level & Density',
      view: {
        kind: 'table',
        field: 'density',
        columns: [
          { key: 'areaLevel' },
          { key: 'monsterLevel' },
          { key: 'lootIlvl' },
          { key: 'totalEnemies' },
          { key: 'packDensity' },
        ],
      },
      produce: () => ({
        data: {
          density: {
            // ARPG-LAWS §11: areaLevel is the ONLY scalar changed between difficulty copies.
            // monsterLevel = areaLevel (1:1); loot ilvl = areaLevel.
            areaLevel: 5,
            monsterLevel: 5,   // 1:1 with areaLevel per §6c
            lootIlvl: 5,       // dropped-item ilvl = areaLevel per §7c
            // Life / damage scale super-linearly: ≈+5–8%/level life, ≈+4–6%/level damage from §6c.
            // At level 5 (vs level-1 baseline), life ≈ baseline × 1.06^4 ≈ ×1.26.
            monsterLifeScaleFactor: 1.26,
            monsterDamageScaleFactor: 1.20,
            // ~38 total enemies across 5 sectors — matching ENEMY_DENSITY_CONFIG row 11.
            // Sector breakdown: NW=6, NE=9, Center=11, SW=5, SE=7 (sum=38).
            totalEnemies: 38,
            sectorBreakdown: { NW: 6, NE: 9, Center: 11, SW: 5, SE: 7 },
            // Pack composition per ARPG-LAWS §6c: trash packs 4–12.
            packDensity: {
              normalPacks: { count: 3, packSize: '4–6', note: 'Brute trash — Normal rarity, ×1 life/damage' },
              magicPacks:  { count: 1, packSize: '6–8', note: 'Brute elite — Magic rarity, ×1.75 life, +1 modifier, extra 2–4 adds' },
              rareElite:   { count: 1, packSize: '1 + 3 adds', note: 'Rare Brute — ×5 life, +3 modifiers (Extra Fast/Extra Life/Elemental Weakness)' },
            },
            // Area modifiers per ARPG-LAWS §11c — none applied at base areaLevel 5;
            // no player resist penalty at this tier (reserved for endgame 80–84+).
            areaModifiers: [],
            rewardScalar: 1.0,
            wiringContract: {
              grantedBy:
                'AARPGEncounterVolume.areaLevel=5 on the z-ashen map; spawner reads areaLevel from the volume',
              activatedBy:
                'ASpawnVolume reads areaLevel at wave start to scale monsterLevel (= areaLevel 1:1) ' +
                'and passes it to UARPGLootDropComponent for ilvl (= areaLevel) per §11',
              dependencies: [
                'AARPGEncounterVolume (Source/PoF/ — reads areaLevel from the volume actor)',
                'ASpawnVolume (uses areaLevel to configure wave difficulty)',
                'UARPGLootDropComponent (ilvl = areaLevel on kill)',
                'bestiary::bestiary-brute (enemy archetype placed in all packs)',
              ],
              verification:
                'L2: AARPGEncounterVolume + ASpawnVolume declared in Source/PoF/; ' +
                'L3: VSZoneTest — spawned Brutes have monsterLevel=5, loot drops have ilvl=5',
            },
          },
        },
      }),
      accept: fieldsPopulated('density', 'areaLevel / monsterLevel / lootIlvl / totalEnemies populated', [
        'areaLevel',
        'monsterLevel',
        'lootIlvl',
        'totalEnemies',
      ]),
      staticChecks: () => [
        cppSymbolExists('AARPGEncounterVolume', 'Encounter volume actor present in UE Source'),
      ],
    },

    // ── 4. Encounter Placement ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Encounter Placement',
      view: {
        kind: 'table',
        field: 'encounters',
        columns: [{ key: 'hostedArena' }, { key: 'packPlacements' }, { key: 'wiringContract' }],
      },
      produce: () => ({
        data: {
          encounters: {
            // The zone HOSTS the Ravaged Courtyard arena slice — a mid-zone two-wave skirmish.
            // Arena id: 'arena-ravaged-courtyard' → catalogId 'combat-map'.
            // Seeded via arenaSliceToEntry → arena-${spec.id}.
            hostedArena: {
              catalogRef: 'combat-map::arena-ravaged-courtyard',
              arenaName: 'Ravaged Courtyard',
              position: 'middle',
              baseDifficultyLevel: 3,
              areaLevelOverride:
                'Zone areaLevel=5 sets the AARPGEncounterVolume.areaLevel; ' +
                'the arena slice baseDifficultyLevel=3 offsets within that envelope.',
              waves: [
                { enemyArchetype: 'kath-hound', count: 4, spawnIntervalSec: 0.5, note: 'fast softener wave' },
                { enemyArchetype: 'mandalorian-warrior', count: 3, spawnIntervalSec: 0.7, note: 'armoured press-in' },
              ],
              winCondition: 'clear-all-waves',
              // Within the 38-enemy total: the arena slice contributes ~7 enemies (4+3);
              // remaining ~31 are distributed across the 5 sectors as ambient packs.
            },
            // Ambient pack placements outside the arena — one per sector.
            packPlacements: [
              { sector: 'NW',     archetype: 'bestiary::bestiary-brute', count: 6,  rarity: 'Normal', position: 'entrance zone' },
              { sector: 'NE',     archetype: 'bestiary::bestiary-brute', count: 9,  rarity: 'Normal', position: 'ash field patrol route' },
              { sector: 'Center', archetype: 'bestiary::bestiary-brute', count: 11, rarity: 'Rare',   position: 'around the ember bonfire; Rare Brute elite' },
              { sector: 'SW',     archetype: 'bestiary::bestiary-brute', count: 5,  rarity: 'Normal', position: 'tree-line funnel chokepoint' },
              { sector: 'SE',     archetype: 'bestiary::bestiary-brute', count: 7,  rarity: 'Magic',  position: 'ember-bank patrol; Magic Brute elite with Extra Fast' },
            ],
            wiringContract: {
              grantedBy:
                'ASpawnVolume actors placed at sector positions in /Game/Maps/AshenForest.umap; ' +
                'each volume references AARPGEncounterVolume (parent) for areaLevel propagation',
              activatedBy:
                'Level BeginPlay — ASpawnVolume begins Wave 1 on player aggro detection ' +
                '(per AARPGEncounterArena enter-trigger)',
              dependencies: [
                'combat-map::arena-ravaged-courtyard (the hosted arena slice spec)',
                'bestiary::bestiary-brute (enemy archetype for all ambient packs)',
                'AARPGEncounterVolume (areaLevel=5 source for monsterLevel+lootIlvl)',
                'ASpawnVolume (wave config reads this volume)',
              ],
              verification:
                'L2: AARPGEncounterVolume + ASpawnVolume declared in Source/PoF/; ' +
                'L3: VSZoneTest — Brute packs spawn at correct sector positions, ' +
                'arena-ravaged-courtyard waves trigger on entry, monsterLevel=5',
            },
            // Resolvable top-level cross-catalog links.
            links: [
              { catalogId: 'combat-map', entityId: 'arena-ravaged-courtyard', role: 'hosted-arena' },
              { catalogId: 'bestiary',   entityId: 'bestiary-brute',          role: 'encounter-pack' },
            ],
          },
          links: [
            { catalogId: 'combat-map', entityId: 'arena-ravaged-courtyard', role: 'hosted-arena' },
            { catalogId: 'bestiary',   entityId: 'bestiary-brute',          role: 'encounter-pack' },
          ],
        },
        links: [
          { catalogId: 'combat-map', entityId: 'arena-ravaged-courtyard', role: 'hosted-arena' },
          { catalogId: 'bestiary',   entityId: 'bestiary-brute',          role: 'encounter-pack' },
        ],
      }),
      accept: fieldsPopulated('encounters', 'Hosted arena + pack placements + wiring contract declared', [
        'hostedArena',
        'packPlacements',
        'wiringContract',
      ]),
      staticChecks: () => [
        cppSymbolExists('ASpawnVolume', 'Spawn volume actor present in UE Source'),
      ],
    },

    // ── 5. Streaming / LOD ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Streaming / LOD',
      view: {
        kind: 'table',
        field: 'streaming',
        columns: [{ key: 'budgets' }, { key: 'lodStrategy' }, { key: 'gaps' }],
      },
      produce: () => ({
        data: {
          streaming: {
            // STREAMING_BUDGETS from sub_world/_shared/data.ts (the canonical budget table).
            budgets: {
              memory:      { current: 380, max: 512, unit: 'MB', warnAt: 420,  dangerAt: 480  },
              loadTime:    { current: 2.1, max: 3.0, unit: 's',  warnAt: 2.5,  dangerAt: 2.8  },
              cellCount:   { current: 12,  max: 20,  unit: '',   warnAt: 16,   dangerAt: 18   },
              texturePool: { current: 45,  max: 64,  unit: 'MB', warnAt: 52,   dangerAt: 60   },
            },
            // Ashen Forest shipped as a monolithic .umap — World Partition and HLOD are documented gaps.
            lodStrategy: {
              worldPartition: false,
              hlod: false,
              levelStreamingSublevels: 0,
              approach:
                'Monolithic .umap with 30 static meshes (26 charred trunks + 4 arena pillars). ' +
                'Individually placed SM_CharredTrunk StaticMeshActors — not HISM. ' +
                'Scale path: AARPGVegetationScatter → HISM batch (biome-scatter dispatch) ' +
                'when scatter pipeline is extended to zone-map. ' +
                'Per-mesh LODs: LOD0 (full), LOD1 (50% tris), LOD2 (culled at 4000 cm) ' +
                'per art-3d canon rule — set in SM_CharredTrunk properties.',
            },
            gaps: [
              'World Partition + OFPA grid: not wired (single-level .umap; see plan.md §4)',
              'HLOD generation: deferred until World Partition is enabled',
              'HISM instancing for scatter: monolithic mesh actors; replace with AARPGVegetationScatter',
              'NavMesh bake: RecastNavMesh not present — headless CI cannot bake nav',
            ],
          },
        },
      }),
      accept: fieldsPopulated('streaming', 'Streaming budgets + LOD strategy populated', [
        'budgets',
        'lodStrategy',
      ]),
    },

    // ── 6. 3D / Biome ─────────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: '3D / Biome',
      view: { kind: 'gallery', field: 'biome', candidates: 3 },
      produce: (e: LabEntity) => ({
        data: { biome: 0 },
        ueAssets: [
          `/Game/Zones/${slug(e.name)}/SM_CharredTrunk`,
          `/Game/Zones/${slug(e.name)}/SM_AshenRock`,
          `/Game/Zones/${slug(e.name)}/SM_EmberPit`,
        ],
      }),
      accept: selected('biome', 'A biome mesh candidate is selected'),
    },

    // ── 7. Material ───────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Material',
      view: {
        kind: 'table',
        field: 'materials',
        columns: [{ key: 'surfaceFamily' }, { key: 'instances' }, { key: 'wiringContract' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          materials: {
            // Weathered Stone master material — the seeded surface baseline.
            // id: 'mat-weathered-stone' is confirmed in seed-materials.ts:22.
            surfaceFamily: 'materials::mat-weathered-stone',
            surfaceFamilyNote:
              'Weathered Stone instance (mat-weathered-stone) is the canonical ground/rock surface ' +
              'for post-Sundering masonry and rocky terrain. Shared with the Arena Slice pillars ' +
              'and the Ruined Keep environment. Exposes wear/tint/soot params per art-material canon.',
            instances: [
              {
                name: `MI_${slug(e.name)}_Ground`,
                masterMaterial: 'mat-weathered-stone',
                params: {
                  tint: 'desaturated grey #5a5a55',
                  wearAmount: 0.85,
                  sootIntensity: 0.7,
                  sootTint: 'black #1a1a18',
                },
                ueAssetPath: `/Game/Zones/${slug(e.name)}/MI_${slug(e.name)}_Ground`,
                note: 'Ground plane and ember-pit floor; charred dark to read "burned earth".',
              },
              {
                name: `MI_${slug(e.name)}_Trunk`,
                masterMaterial: 'mat-weathered-stone',
                params: {
                  // Charred trunk reuses the weathered-stone master's wear channel as a char channel.
                  tint: 'charcoal #2a2a26',
                  wearAmount: 1.0,
                  sootIntensity: 1.0,
                  sootTint: '#0a0a08',
                },
                ueAssetPath: `/Game/Zones/${slug(e.name)}/MI_${slug(e.name)}_Trunk`,
                note: 'Charred tree-trunk surface; full soot + zero albedo saturation.',
              },
            ],
            wiringContract: {
              grantedBy:
                'MI_AshenForest_Ground + MI_AshenForest_Trunk are material instances of ' +
                'the mat-weathered-stone master material, applied to zone static meshes in the .umap',
              activatedBy:
                'Static mesh actor material slot assignment in /Game/Maps/AshenForest.umap',
              dependencies: [
                'materials::mat-weathered-stone (master material — must be seeded/present)',
                'art-material canon (Albedo/Normal/ORM maps required; expose wear/tint/soot params)',
              ],
              verification:
                'L0: mat-weathered-stone entry present in seed-materials.ts; ' +
                'L2: /Game/Maps/AshenForest.umap contains static mesh actors with MI_AshenForest_Ground applied; ' +
                'L4 (deferred): visual read "burned earth" confirmed via RHI+Gemini render check',
            },
            links: [
              { catalogId: 'materials', entityId: 'mat-weathered-stone', role: 'surface-family' },
            ],
          },
          links: [
            { catalogId: 'materials', entityId: 'mat-weathered-stone', role: 'surface-family' },
          ],
        },
        links: [
          { catalogId: 'materials', entityId: 'mat-weathered-stone', role: 'surface-family' },
        ],
      }),
      accept: fieldsPopulated('materials', 'Surface family + instances + wiring contract populated', [
        'surfaceFamily',
        'instances',
        'wiringContract',
      ]),
    },

    // ── 8. Ambient & Music ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Ambient & Music',
      view: {
        kind: 'table',
        field: 'audio',
        columns: [{ key: 'ambient' }, { key: 'music' }, { key: 'wiringContract' }],
      },
      produce: () => ({
        data: {
          audio: {
            // ambient-forest-day: seeded in new-catalogs.ts:55 under catalogId 'ambient'.
            ambient: {
              catalogRef: 'ambient::ambient-forest-day',
              description:
                'Forest Day soundscape (bed + one-shots) re-skinned for the Ashen Forest: ' +
                'base bed = low wind through dead trees + distant crackle; ' +
                'one-shots = ember drift (10–20 s random interval), collapsing branch (30–60 s), ' +
                'distant crow call replaced with a hollow silence beat. ' +
                'Attenuation: AmbientZoneSettings on the level; volume −6 dB from Whisper Woods ' +
                'to emphasize absence of life.',
              wwise_event: 'Play_AMB_ForestDay_Ashen',
              attenuationProfile: 'ZoneAmbient_Medium',
            },
            // music-combat-a: seeded in new-catalogs.ts:54 under catalogId 'music'.
            music: {
              catalogRef: 'music::music-combat-a',
              description:
                'Combat Theme A (adaptive, stems) — triggers on enemy aggro. ' +
                'Ashen Forest configuration: tempo held at 92 BPM (slower than standard 120 BPM ' +
                'for a foreboding, oppressive feel matching the zone tone); ' +
                'exploration stem loops the low-register bed only until combat threshold is reached. ' +
                'Horizontal re-sequencing: Explore → CombatBuild → Combat → Victory layers via Wwise RTPC.',
              wwise_event: 'Play_MUS_Combat_A_Zone_Ashen',
              combatThreshold: 'EnemyAggro broadcast (UARPGAbilitySystemComponent OnCombatStart)',
              bpmOverride: 92,
            },
            wiringContract: {
              grantedBy:
                'UAudioComponent placed in /Game/Maps/AshenForest.umap for ambient bed; ' +
                'Wwise AkAmbientSound component plays Play_AMB_ForestDay_Ashen on BeginPlay; ' +
                'music triggered by OnCombatStart GAS event broadcast',
              activatedBy:
                'Ambient: BeginPlay (level load); Music: UARPGAbilitySystemComponent CombatStart broadcast',
              dependencies: [
                'ambient::ambient-forest-day (bed + one-shots audio asset row)',
                'music::music-combat-a (adaptive combat track row)',
                'UARPGAbilitySystemComponent (CombatStart event triggers music stem switch)',
              ],
              verification:
                'L0: ambient-forest-day + music-combat-a entries present in new-catalogs.ts starters; ' +
                'L3 (deferred): VSZoneTest — ambient plays on load, music transitions on enemy aggro',
            },
            links: [
              { catalogId: 'ambient', entityId: 'ambient-forest-day', role: 'zone-soundscape' },
              { catalogId: 'music',   entityId: 'music-combat-a',     role: 'combat-music' },
            ],
          },
          links: [
            { catalogId: 'ambient', entityId: 'ambient-forest-day', role: 'zone-soundscape' },
            { catalogId: 'music',   entityId: 'music-combat-a',     role: 'combat-music' },
          ],
        },
        links: [
          { catalogId: 'ambient', entityId: 'ambient-forest-day', role: 'zone-soundscape' },
          { catalogId: 'music',   entityId: 'music-combat-a',     role: 'combat-music' },
        ],
      }),
      accept: fieldsPopulated('audio', 'Ambient + music + wiring contract populated', [
        'ambient',
        'music',
        'wiringContract',
      ]),
    },

    // ── 9. Minimap UI ─────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Minimap UI',
      view: {
        kind: 'table',
        field: 'minimap',
        columns: [{ key: 'discoveryPct' }, { key: 'fastTravelNode' }, { key: 'hudBinding' }],
      },
      produce: () => ({
        data: {
          minimap: {
            // Per ZONE_POIS: Ashen Forest discoveryPct = 0 initially (zone is locked/undiscovered).
            discoveryPct: 0,
            fastTravelNode: {
              name: 'Ashen Crossing',
              discovered: false,
              travelTimes: [
                { to: 'Woods Gate', seconds: 10 },
                { to: 'Camp Outskirts', seconds: 12 },
              ],
            },
            // Minimap renders all ZONE_POIS types: quest, treasure, shrine, bonfire.
            poiIconBindings: [
              { type: 'quest',    icon: 'ScrollText', hudColor: 'STATUS_INFO',     count: 3 },
              { type: 'treasure', icon: 'Gem',        hudColor: 'ACCENT_EMERALD',  count: 2 },
              { type: 'shrine',   icon: 'Star',       hudColor: 'ACCENT_VIOLET',   count: 1 },
              { type: 'bonfire',  icon: 'Flame',      hudColor: 'ACCENT_ORANGE',   count: 1 },
            ],
            hudBinding: {
              // Per canon proj-hud-binding: declare widget + display-format + HUD anchor.
              widget: 'WBP_MinimapZone',
              displayFormat: '"Ashen Forest" | level range "3–5" | discovery % shown',
              hudAnchor: 'TopRight',
              hudElementsCatalogRef: 'hud-elements::hud-health-bar (shared HUD shell; minimap is a sub-panel)',
              note:
                'Full minimap widget (WBP_MinimapZone) is in the hud-elements catalog scope. ' +
                'Zone-map declares its binding contract (widget + anchor + display format) here; ' +
                'the widget implementation is a hud-elements responsibility.',
            },
            wiringContract: {
              grantedBy:
                'WBP_MinimapZone reads ZONE_POIS (via API) and FAST_TRAVEL_NODES to populate the minimap; ' +
                'discovery state written by the exploration event system on first visit',
              activatedBy:
                'Zone load → HUD mounts WBP_MinimapZone; first-visit detection fires discovery event; ' +
                'bonfire interact sets FastTravelNode.discovered = true',
              dependencies: [
                'ZONE_POIS z-ashen entries (quest×3, treasure×2, shrine×1, bonfire×1)',
                'FAST_TRAVEL_NODES "Ashen Crossing" entry',
                'hud-elements::hud-health-bar (shared HUD shell that hosts the minimap panel)',
                'proj-hud-binding canon rule (widget + display-format + anchor declaration)',
              ],
              verification:
                'L0: ZONE_POIS + FAST_TRAVEL_NODES entries present in data.ts; ' +
                'L3 (deferred): VSZoneTest — minimap mounts, POI icons appear, discovery % updates on fog-of-war clear',
            },
          },
        },
      }),
      accept: fieldsPopulated('minimap', 'Discovery / fast-travel / HUD binding declared', [
        'discoveryPct',
        'fastTravelNode',
        'hudBinding',
      ]),
    },

    // ── 10. Icon 2D Art (universal) ───────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        // Link conceptually to the shared iconset-abilities set (the seeded icon-sets entity).
        ueAssets: [
          `/Game/UI/Icons/T_${slug(e.name)}_ZoneIcon_Ashen`,
          `/Game/UI/Icons/T_${slug(e.name)}_ZoneIcon_Explored`,
          `/Game/UI/Icons/T_${slug(e.name)}_ZoneIcon_Locked`,
          `/Game/UI/Icons/T_${slug(e.name)}_ZoneIcon_Active`,
        ],
      }),
      accept: selected('selected', 'A zone icon candidate is selected'),
      // icon-sets::iconset-abilities is the seeded shared icon family; zone icons belong to the same set.
      // Link declared in produce output below to satisfy linkTargetsExist.
    },

    // ── 11. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'level loads without crash (DirectionalLight + SkyLight + PostProcessVolume present)',
            'Ashen Crossing bonfire fast-travel node present and interactable',
            'Brute packs spawn at correct sector positions with monsterLevel=5',
            'Ravaged Courtyard arena slice triggers on entry, waves complete, loot ilvl=5',
            'Ambient bed plays on load; music transitions on enemy aggro',
            'Minimap discovery % updates on fog-of-war clear for first-visit',
            'AARPGEncounterVolume.areaLevel=5 confirmed at runtime',
          ],
        },
      }),
      accept: runtimeDeferred('VSZoneTest', 'Zone setup + encounter + loot-ilvl test passes in UE'),
    },

    // ── 12. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `/Game/Maps/AshenForest.umap`,
          `DT_ZoneMap :: zone-z-ashen`,
          `AARPGEncounterVolume :: z-ashen (areaLevel=5)`,
          `ASpawnVolume :: Sector_NW, Sector_NE, Sector_Center, Sector_SW, Sector_SE`,
          `MI_${s}_Ground (mat-weathered-stone instance)`,
          `MI_${s}_Trunk  (mat-weathered-stone instance)`,
          `T_${s}_ZoneIcon_Ashen`,
        ];
        return {
          data: {
            assets,
            umap: '/Game/Maps/AshenForest.umap',
            umapNote:
              'Baked and reload-verified (DirLight 1 / SkyLight 1 / PPV 1 / StaticMeshes 30 / Test 1). ' +
              'Committed to pof-exp at 1ec6353. Single monolithic .umap (World Partition pending).',
            wiringContract: {
              grantedBy:
                '/Game/Maps/AshenForest.umap (the realised zone asset) + DT_ZoneMap row for zone-z-ashen; ' +
                'AARPGEncounterVolume actor in the map declares areaLevel=5',
              activatedBy:
                'Level load — AARPGEncounterVolume BeginPlay propagates areaLevel to ASpawnVolume actors; ' +
                'ASpawnVolume begins Wave 1 on player aggro; UARPGLootDropComponent uses areaLevel as ilvl',
              dependencies: [
                'combat-map::arena-ravaged-courtyard (hosted arena slice, waves spawn brutes)',
                'bestiary::bestiary-brute (enemy archetype, DT_AttributeDefaults row)',
                'materials::mat-weathered-stone (master material for ground/trunk instances)',
                'ambient::ambient-forest-day (ambient soundscape)',
                'music::music-combat-a (adaptive combat music)',
                'icon-sets::iconset-abilities (shared icon family; zone icons share the set style)',
                'AARPGEncounterVolume (C++ actor, areaLevel source)',
                'ASpawnVolume (C++ actor, wave orchestration)',
                'UARPGLootDropComponent (on-death ilvl = areaLevel)',
              ],
              verification:
                'L2: AARPGEncounterVolume + ASpawnVolume compiled in Source/PoF/; ' +
                'AshenForest.umap present in pof-exp @1ec6353; DT_ZoneMap seeded; ' +
                'L3: VSZoneTest (deferred) — level loads, areaLevel=5 confirmed, ' +
                'Brutes spawn at monsterLevel=5, loot ilvl=5, arena waves trigger',
            },
            links: [
              { catalogId: 'combat-map',  entityId: 'arena-ravaged-courtyard', role: 'hosted-arena' },
              { catalogId: 'bestiary',    entityId: 'bestiary-brute',          role: 'encounter-pack' },
              { catalogId: 'materials',   entityId: 'mat-weathered-stone',     role: 'surface-family' },
              { catalogId: 'ambient',     entityId: 'ambient-forest-day',      role: 'zone-soundscape' },
              { catalogId: 'music',       entityId: 'music-combat-a',          role: 'combat-music' },
              { catalogId: 'icon-sets',   entityId: 'iconset-abilities',       role: 'icon-family' },
            ],
          },
          links: [
            { catalogId: 'combat-map',  entityId: 'arena-ravaged-courtyard', role: 'hosted-arena' },
            { catalogId: 'bestiary',    entityId: 'bestiary-brute',          role: 'encounter-pack' },
            { catalogId: 'materials',   entityId: 'mat-weathered-stone',     role: 'surface-family' },
            { catalogId: 'ambient',     entityId: 'ambient-forest-day',      role: 'zone-soundscape' },
            { catalogId: 'music',       entityId: 'music-combat-a',          role: 'combat-music' },
            { catalogId: 'icon-sets',   entityId: 'iconset-abilities',       role: 'icon-family' },
          ],
          ueAssets: assets,
        };
      },
      accept: minCount('assets', '≥3 UE assets packaged', 3),
      staticChecks: () => [
        cppSymbolExists('AARPGEncounterVolume', 'Encounter volume actor compiled in UE Source'),
        cppSymbolExists('ASpawnVolume', 'Spawn volume actor compiled in UE Source'),
      ],
    },
  ],
});
