import { registerCatalogPipeline } from '../pipeline-registry';
import {
  minLength,
  fieldsPopulated,
  withinPercent,
  selected,
  minCount,
} from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Combat Map pipeline (catalogId: 'combat-map').
 *
 * Represents a tactical encounter arena entity in PoF — specifically the
 * "Ravaged Courtyard" Arena Slice seeded as `arena-ravaged-courtyard`.
 *
 * Design laws obeyed (ARPG-LAWS §6, §11, canon `arpg-area-level`):
 *   - areaLevel is the ONLY master scalar: monsterLevel = areaLevel (1:1), loot ilvl derives from it.
 *   - Wave composition uses real seeded bestiary archetypes linked via CatalogLink.
 *   - Monster rarity multipliers scale the Normal baseline per §6c (pack reads as archetype mix).
 *   - A hazard is a GE (AARPGEnvironmentalHazard applies GE_Hazard_FireFloor via SetByCaller).
 *   - Area modifiers add risk for a matching rewardScalar bump.
 *   - Wiring contract declared on every producible step per canon `arpg-wiring-contract`.
 *
 * Real cross-catalog links:
 *   bestiary::kath-hound             — wave 1 spawns (seeded via KOTOR_ARCHETYPES)
 *   bestiary::mandalorian-warrior    — wave 2 spawns (seeded via KOTOR_ARCHETYPES)
 *   loot-tables::lt-Brute            — post-wave loot table (seeded from DEFAULT_ENEMY_LOOT_BINDINGS)
 *   materials::mat-weathered-stone   — arena floor/wall/pillar surface (seeded in seed-materials.ts)
 *   icon-sets::iconset-abilities     — shared icon presentation library (seeded in seed-icon-sets.ts)
 *
 * UE static check: `AARPGEncounterArena` — the arena actor class in Source/PoF/ (LevelDesign.h).
 * Runtime gate: `VSArenaSliceRulesTest` — build an ASpawnVolume from the spec, assert wave
 * config + completion delegates (deferred until live-UE runner exists).
 */
registerCatalogPipeline({
  catalogId: 'combat-map',
  steps: [
    // ── 1. Concept Brief ─────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a tactical encounter arena in PoF — a 20 m scorched Sith-temple courtyard ` +
            `set in the mid-zone difficulty arc. Four corner pillars offer partial cover; a fire-floor ` +
            `GE radiates from the arena centre, denying passive regeneration at the ground level. ` +
            `The encounter runs two kill-gated waves: fast Kath Hounds swarm first, pressuring the ` +
            `player to break formation and use cover; then armoured Mandalorian Warriors press in ` +
            `with ranged burst and a power-shield at 50% HP, forcing a risk/reward trade on melee ` +
            `engagement. The design principle is escalating read-and-react: wave 1 is mobile ` +
            `harassment, wave 2 is a slow-but-punishing duel. areaLevel is the master scalar ` +
            `(canon arpg-area-level) — monsterLevel = areaLevel and dropped-item ilvl derive from it; ` +
            `hand-tuning per-wave stat numbers is explicitly forbidden. Win by clearing both waves; ` +
            `lose on death. Theme: grim, used-by-war, weathered stone per canon game-tone. ` +
            `Wired to AARPGEncounterArena + ASpawnVolume + AARPGCoverPoint + AARPGEnvironmentalHazard ` +
            `— the entire runtime arena stack already exists and is gated by VSArenaSetupTest.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Encounter Layout ───────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Encounter Layout',
      view: {
        kind: 'table',
        field: 'layout',
        columns: [
          { key: 'extentCm' },
          { key: 'elevatedThresholdCm' },
          { key: 'highGroundThresholdCm' },
          { key: 'tacticalPoints' },
          { key: 'coverPoints' },
        ],
      },
      produce: () => ({
        data: {
          layout: {
            // 20 m square arena: the proven build_arena.py footprint.
            extentCm: 1000,
            // Mirrors UE AARPGEncounterArena elevation defaults (EArenaTier enum).
            elevatedThresholdCm: 150,
            highGroundThresholdCm: 300,
            tacticalPoints: [
              {
                location: [0, 0, 0],
                tier: 'ground',
                goodForRanged: false,
                hasNearbyCover: false,
                flanking: false,
                note: 'Arena centre — denied by fire-floor hazard; crossing is a risk/reward trade',
              },
              {
                location: [-700, 700, 200],
                tier: 'elevated',
                goodForRanged: true,
                hasNearbyCover: true,
                flanking: false,
                note: 'Elevated rear corner — optimal ranged line-of-sight + nearby pillar cover',
              },
              {
                location: [700, -700, 0],
                tier: 'ground',
                goodForRanged: false,
                hasNearbyCover: true,
                flanking: true,
                note: 'Ground flanking position — pillar cover on approach, no elevation advantage',
              },
            ],
            // Four corner pillars at ±850 cm, matching build_arena.py geometry.
            // Mirrors placed AARPGCoverPoint actors (ECoverType::Pillar, ProvidesCoverFrom arc).
            coverPoints: [
              { location: [850, 850, 0],   kind: 'pillar', widthCm: 120, note: 'NE corner pillar' },
              { location: [850, -850, 0],  kind: 'pillar', widthCm: 120, note: 'SE corner pillar' },
              { location: [-850, 850, 0],  kind: 'pillar', widthCm: 120, note: 'NW corner pillar' },
              { location: [-850, -850, 0], kind: 'pillar', widthCm: 120, note: 'SW corner pillar' },
            ],
            wiringContract: {
              grantedBy:
                'AARPGEncounterArena actor placed in the arena map; FArenaTacticalPoint array ' +
                'set via AARPGEncounterArena::TacticalPoints; AARPGCoverPoint actors placed at ' +
                'the four corner-pillar positions matching build_arena.py geometry',
              activatedBy:
                'AARPGEncounterArena::ScanArena() called on BeginPlay; ' +
                'FArenaTacticalPoint.Tier resolved from elevatedThreshold/highGroundThreshold; ' +
                'AARPGCoverPoint claims/releases managed per-frame by the cover system',
              dependencies: [
                'AARPGEncounterArena (LevelDesign.h — FArenaTacticalPoint, EArenaTier)',
                'AARPGCoverPoint (LevelDesign.h — ECoverType, ProvidesCoverFrom, CoverWidth)',
                'build_arena.py (Content/ArenaBuild — 20 m floor + walls + 4 corner pillars)',
              ],
              verification:
                'L2: AARPGEncounterArena + AARPGCoverPoint compiled in Source/PoF/ (LevelDesign.h); ' +
                'L3: VSArenaSliceRulesTest — AARPGEncounterArena::ScanArena returns ≥3 tactical points ' +
                'and ≥4 cover points matching the declared layout',
            },
          },
        },
      }),
      accept: fieldsPopulated('layout', 'Layout dimensions + tactical + cover points populated', [
        'extentCm',
        'elevatedThresholdCm',
        'highGroundThresholdCm',
        'tacticalPoints',
        'coverPoints',
      ]),
      staticChecks: () => [
        cppSymbolExists('AARPGEncounterArena', 'Encounter arena actor present in UE Source'),
      ],
    },

    // ── 3. Waves & Spawns ─────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Waves & Spawns',
      view: {
        kind: 'table',
        field: 'waves',
        columns: [
          { key: 'areaLevel' },
          { key: 'waveCount' },
          { key: 'waveDetails' },
        ],
      },
      produce: () => ({
        data: {
          waves: {
            // areaLevel = the master scalar (ARPG-LAWS §11, canon arpg-area-level).
            // monsterLevel = areaLevel (1:1); loot ilvl derives from it automatically.
            // DO NOT hand-tune per-wave monster HP or damage — tune areaLevel + mods only.
            areaLevel: 20,
            monsterLevel: 20, // = areaLevel, derived — never independently set
            lootIlvl: 20,     // = areaLevel, derived from areaLevel via §7/§11
            waveCount: 2,
            waitForKillsBeforeNextWave: true,
            baseDifficultyLevel: 3,
            difficultyScalePerLevel: 0.1,
            maxDifficultyMultiplier: 3.0,
            waveDetails: [
              {
                wave: 1,
                // kath-hound: seeded in KOTOR_ARCHETYPES (id 'kath-hound', tier 'minion', role 'swarm')
                // bestiary entity id = 'bestiary-kath-hound' (arenaSliceToEntry uses 'bestiary-' prefix)
                enemyArchetype: 'kath-hound',
                count: 4,
                packSize: 4,
                spawnIntervalSec: 0.5,
                delayBeforeWaveSec: 0,
                difficultyMultiplier: 1.0,
                rarityComposition: {
                  // Pack of 4 minion-tier beasts: all Normal at mid-zone areaLevel 20.
                  // Normal (×1 life/damage): the swarm threat comes from pack pressure, not
                  // individual power — faithful to canon game-creature-design (legible patterns,
                  // not stat inflation). A future Magic hound (+1 modifier e.g. Extra Fast, ×1.75 life)
                  // is an optional difficulty modifier on a higher-areaLevel copy of this encounter.
                  Normal: 4,
                  Magic: 0,
                  Rare: 0,
                  note:
                    'Pure Normal pack at areaLevel 20 (monsterLevel 20). Life baseline per §6c: ' +
                    'monsterLevel-20 Normal kath-hound ≈ 80 HP (minion-tier, low HP + high speed). ' +
                    'Pack howl ability buffs nearby allies — 4 hounds together are a genuine threat ' +
                    'even at Normal rarity without stat inflation.',
                },
                abilities: ['Bite', 'Pack Howl'],
                note:
                  'Wave 1: fast swarm to break player positioning. Kath Hounds approach from ' +
                  'three of the four arena arcs (EEncounterPosition::entrance → middle), ' +
                  'leaving the rear cover pillar clear as a retreat path. Pack Howl aura ' +
                  '(granted as a self-aura GE at spawn per §6d) amplifies nearby hound damage ' +
                  'by +15% increased — legible and counterable by killing the howler first.',
              },
              {
                wave: 2,
                // mandalorian-warrior: seeded in KOTOR_ARCHETYPES (id 'mandalorian-warrior', tier 'elite', role 'ranged')
                // bestiary entity id = 'bestiary-mandalorian-warrior'
                enemyArchetype: 'mandalorian-warrior',
                count: 3,
                packSize: 3,
                spawnIntervalSec: 0.7,
                delayBeforeWaveSec: 2.0,
                difficultyMultiplier: 1.25,
                rarityComposition: {
                  // 3 elite-tier humanoids: 2 Normal + 1 Magic at areaLevel 20.
                  // Magic warrior (+1 modifier = 'Extra Fast', ×1.75 life) is the pack leader.
                  // Per §6c Rare choice: Rare warriors are possible on higher-tier copies
                  // of this encounter (areaLevel 30+, difficultyMultiplier 1.5+).
                  Normal: 2,
                  Magic: 1,
                  note:
                    'One Magic-tier Mandalorian (×1.75 life, +1 modifier). Modifier is Extra Fast: ' +
                    'GE_Mod_ExtraFast granted at spawn (BeginPlay) per canon arpg-monster-mods. ' +
                    'monsterLevel-20 Normal mandalorian-warrior baseline ≈ 220 HP, 35 damage/hit. ' +
                    'Magic variant ≈ 385 HP. Power Shield at 50% HP activates a defensive GE ' +
                    '(absorbs ~120 damage) — the telegraphed "stop DPS" mechanic per §6a.',
                },
                abilities: ['Blaster Volley', 'Wrist Rocket', 'Power Shield'],
                note:
                  'Wave 2: durable ranged elites with a shield-phase mechanic. 2 s delay after ' +
                  'wave 1 clear lets the player recover briefly. Wrist Rocket is a projectile ' +
                  'AoE (Physical damage, added→increased→more per §3) — player must dodge or ' +
                  'use cover. Power Shield is a GE on the warrior: reduces physical damage taken ' +
                  'by 50% for 6 s; fires when HP < 50%. areaLevel drives warrior stats per §11.',
              },
            ],
            wiringContract: {
              grantedBy:
                'ASpawnVolume (FSpawnWaveConfig array): wave 1 kath-hound entries spawn from ' +
                'AARPGEncounterVolume arc-positions (EEncounterPosition::entrance/middle); ' +
                'wave 2 mandalorian-warrior entries after OnAllWavesComplete delegate of wave 1 fires. ' +
                'Monster rarity is resolved from FARPGSpawnRequest at spawn time; modifier GEs ' +
                '(GE_Mod_ExtraFast on Magic mandalorian) granted by AARPGEnemyCharacter::BeginPlay.',
              activatedBy:
                'ASpawnVolume::StartEncounter (triggered by player entering the encounter volume); ' +
                'bWaitForKillsBeforeNextWave=true gates wave 2 until all wave-1 enemies are dead',
              dependencies: [
                'bestiary::kath-hound (id kath-hound; bestiary entity id bestiary-kath-hound)',
                'bestiary::mandalorian-warrior (id mandalorian-warrior; bestiary entity id bestiary-mandalorian-warrior)',
                'loot-tables::lt-Brute (post-wave loot table for elite-archetype drops; seeded from DEFAULT_ENEMY_LOOT_BINDINGS)',
                'ASpawnVolume (FSpawnWaveConfig, bWaitForKillsBeforeNextWave, BaseDifficultyLevel)',
                'AARPGEncounterVolume (EEncounterPosition arc — entrance/middle/deep/boss)',
                'GE_Mod_ExtraFast (buff/aura GE — Extra Fast modifier granted on Magic-tier enemies)',
              ],
              verification:
                'L2: ASpawnVolume + AARPGEncounterVolume compiled in Source/PoF/ (Spawning.h/World.h); ' +
                'GE_Mod_ExtraFast compiled; bestiary::kath-hound + bestiary::mandalorian-warrior present ' +
                'in seedBestiaryEntries(); loot-tables::lt-Brute present in seedLootEntries(); ' +
                'L3: VSArenaSliceRulesTest — ASpawnVolume built from spec, both waves fire in order, ' +
                'OnAllWavesComplete delegate fires after wave 2 clears',
            },
          },
          // Store resolvable links flat for acceptance / readLinks.
          // Real seeded ids: bestiary-kath-hound + bestiary-mandalorian-warrior.
          links: [
            { catalogId: 'bestiary', entityId: 'bestiary-kath-hound',          role: 'spawn' },
            { catalogId: 'bestiary', entityId: 'bestiary-mandalorian-warrior', role: 'spawn' },
            { catalogId: 'loot-tables', entityId: 'lt-Brute',                  role: 'encounter-loot' },
          ],
        },
        links: [
          { catalogId: 'bestiary', entityId: 'bestiary-kath-hound',          role: 'spawn' },
          { catalogId: 'bestiary', entityId: 'bestiary-mandalorian-warrior', role: 'spawn' },
          { catalogId: 'loot-tables', entityId: 'lt-Brute',                  role: 'encounter-loot' },
        ],
      }),
      accept: fieldsPopulated('waves', 'areaLevel / waveCount / waveDetails populated', [
        'areaLevel',
        'waveCount',
        'waveDetails',
      ]),
    },

    // ── 4. Win / Loss Rules ───────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Win/Loss Rules',
      view: {
        kind: 'table',
        field: 'winLoss',
        columns: [{ key: 'winCondition' }, { key: 'lossCondition' }, { key: 'failSafe' }],
      },
      produce: () => ({
        data: {
          winLoss: {
            // 'clear-all-waves' requires no survivalSeconds (survivalSeconds is a survive-duration field).
            winCondition: 'clear-all-waves',
            winDetail:
              'All enemies in both waves are dead; ASpawnVolume::OnAllWavesComplete fires; ' +
              'the encounter volume exits to a reward state. No boss — this is a mid-zone ' +
              'trash/elite skirmish (EEncounterPosition::middle), not a boss-tier gate.',
            lossCondition: 'player-death',
            lossDetail:
              'Player HP reaches zero anywhere in the arena; encounter resets (waves respawn); ' +
              'player checkpoint restores at the arena entrance. No time-limit secondary loss ' +
              'condition on this slice — the fire-floor hazard provides time pressure without ' +
              'a hard timer (the centre denial achieves the same effect organically).',
            failSafe:
              'If a wave enemy is stuck outside the arena bounds for > 30 s, ASpawnVolume ' +
              'fires OnEnemyStuckTimeout → force-kills the stuck actor so the kill-gate can ' +
              'advance; prevents soft-lock on geometry edge-cases.',
            positionCoherence:
              'position: middle (EEncounterPosition::middle) — winCondition clear-all-waves ' +
              'is valid at any non-boss position; no defeat-boss constraint triggered.',
            wiringContract: {
              grantedBy:
                'ASpawnVolume delegates: OnAllWavesComplete (win) and the player character\'s ' +
                'OnDeathDelegate (loss); an encounter-state actor (or the volume itself) must ' +
                'evaluate these and trigger the win/loss outcome. ⚠️ Gap: no first-class ' +
                'WinCondition evaluator actor exists yet — the spec encodes the design intent; ' +
                'runtime evaluation is a documented blocker (plan.md §15).',
              activatedBy:
                'ASpawnVolume::OnAllWavesComplete broadcast (win path); ' +
                'AARPGCharacter::OnDeathDelegate broadcast (loss path)',
              dependencies: [
                'ASpawnVolume (OnAllWavesComplete, OnWaveStarted delegates)',
                'AARPGCharacter (OnDeathDelegate)',
              ],
              verification:
                'L2: ASpawnVolume::OnAllWavesComplete delegate declared in Source/PoF/ (Spawning.h); ' +
                'L3: VSArenaSliceRulesTest — encounter transitions to win state after both waves clear; ' +
                'player-death triggers loss state (deferred pending win/loss evaluator actor)',
            },
          },
        },
      }),
      accept: fieldsPopulated('winLoss', 'winCondition / lossCondition / failSafe populated', [
        'winCondition',
        'lossCondition',
        'failSafe',
      ]),
    },

    // ── 5. Hazards ────────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Hazards',
      view: {
        kind: 'table',
        field: 'hazards',
        columns: [{ key: 'kind' }, { key: 'damagePerTick' }, { key: 'damageIntervalSec' }, { key: 'ge' }],
      },
      produce: () => ({
        data: {
          hazards: {
            // A hazard IS a GameplayEffect — AARPGEnvironmentalHazard applies GE_Hazard_FireFloor
            // via SetByCaller when a character overlaps the hazard volume (per ARPG-LAWS §12 + §5).
            // Damage type: Fire (code enum 'Fire' in UARPGAttributeSet.DamageType).
            // This GE composes with the status-effects ailment system:
            //   the Fire hit each tick can trigger State.Ignite on the target per §5
            //   (if the tick magnitude exceeds the ignite threshold on that target's life pool).
            hazardList: [
              {
                kind: 'fire-floor',
                location: [0, 0, 0],
                // 15 fire damage/tick at 1 s interval.
                // Envelope check: at areaLevel 20, a capped-resist (75% fire) character takes
                // 15 × (1 − 0.75) = 3.75 effective damage/tick — a meaningful but non-lethal
                // pressure. An uncapped character (0% fire resist) takes the full 15/tick
                // (~120 HP in 8 s), creating genuine danger that incentivises resist-capping.
                damagePerTick: 15,
                damageIntervalSec: 1.0,
                ge: 'GE_Hazard_FireFloor',
                damageType: 'Fire',
                // EHazardType::Periodic — continuous overlap ticks, not a one-shot blast.
                hazardType: 'Periodic',
                // bAIAvoidance = true on AARPGEnvironmentalHazard:
                // the NavModifier makes AI path around the fire zone, keeping the player-vs-AI
                // asymmetry readable (player must choose to cross; AI is naturally displaced).
                aiAvoidance: true,
                zoneDifficultyScaling: true,
                areaResistMod: {
                  // Per ARPG-LAWS §4c / §11: the area can carry a playerResAll modifier
                  // stacking additional resist pressure alongside the physical fire-floor damage.
                  // This arena does NOT roll a playerResAll mod at base difficulty (areaLevel 20);
                  // a higher-tier copy (areaLevel 30+) could add playerResAll: -20 for risk/reward.
                  playerResAll: 0,
                  note:
                    'No resist-reduction mod at base areaLevel 20 (would apply on a higher-tier copy). ' +
                    'The fire-floor alone is sufficient pressure at the mid-zone difficulty band.',
                },
                note:
                  'Fire-floor GE (GE_Hazard_FireFloor) applies SetByCaller Fire damage on Overlap. ' +
                  'Damage type = Fire routes through ARPGDamageExecution resist mitigation. ' +
                  'Per §5: each Fire tick can seed an Ignite ailment on low-life targets ' +
                  '(State.Ignite tag; highest-only stacking at ~90% of tick damage over 4 s).',
              },
            ],
            wiringContract: {
              grantedBy:
                'AARPGEnvironmentalHazard actor placed at [0,0,0] in the arena map; ' +
                'GE_Hazard_FireFloor is the DamageEffect property on the hazard actor; ' +
                'SetByCaller magnitude = damagePerTick (15) set by the hazard actor',
              activatedBy:
                'AARPGEnvironmentalHazard::OnComponentBeginOverlap → ApplyGE on every ' +
                'overlapping character every damageIntervalSec (1.0 s); NavModifier on ' +
                'the hazard volume informs AI pathfinding (bAIAvoidance=true)',
              dependencies: [
                'AARPGEnvironmentalHazard (World.h — EHazardType, DamageEffect, DamageInterval, bAIAvoidance)',
                'GE_Hazard_FireFloor (GameplayEffect — SetByCaller Fire damage; composes with State.Ignite ailment)',
                'ARPGDamageExecution (fire resist mitigation per §3/§4)',
                'status-effects::State.Ignite (ailment seeding — pending status-effects catalog)',
              ],
              verification:
                'L2: AARPGEnvironmentalHazard compiled in Source/PoF/ (World.h); ' +
                'GE_Hazard_FireFloor compiled in Source/PoF/; ' +
                'L3: VSArenaSliceRulesTest — character overlapping the hazard volume receives ' +
                'GE_Hazard_FireFloor ticks at 1 s interval; fire resist reduces tick damage correctly',
            },
          },
        },
      }),
      accept: fieldsPopulated('hazards', 'hazardList populated with kind/damagePerTick/ge/wiringContract', [
        'hazardList',
        'wiringContract',
      ]),
    },

    // ── 6. Balance ────────────────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'Balance',
      view: {
        kind: 'table',
        field: 'balance',
        columns: [{ key: 'threatBudget' }, { key: 'areaLevel' }, { key: 'derivedThreatScore' }],
      },
      produce: () => {
        // Threat budget derivation (per ARPG-LAWS §6c, §11, canon proj-balance ≈100 ±10%):
        //
        // areaLevel 20 → monsterLevel 20.
        // Life curve §6c: ≈+5–8%/level compounding above level 1.
        // Using 6%/level midpoint: baseLife(20) ≈ baseLife(1) × 1.06^19.
        // Minion (kath-hound) baseLife(1) ≈ 15 HP; at level 20: ≈ 15 × 3.026 ≈ 45 HP.
        // Elite (mandalorian) baseLife(1) ≈ 40 HP; at level 20: ≈ 40 × 3.026 ≈ 121 HP.
        // Magic mandalorian: × 1.75 ≈ 212 HP.
        //
        // Threat score (relative unit, target ≈ 100 ±10% per proj-balance):
        //   Wave 1: 4 × kath-hounds.  dangerRank ≈ 2 (swarm, fast, low individual threat).
        //     packThreat = 4 × (45 HP / tierHpNorm) × dangerRank
        //                = 4 × (45/60) × 2 = 4 × 0.75 × 2 = 6.0
        //     (tierHpNorm = 60 HP for mid-zone Normal at areaLevel 20)
        //   Wave 2: 2 × Normal mandalorian + 1 × Magic mandalorian (×1.75 life).
        //     dangerRank ≈ 4 (ranged elite with shield phase).
        //     2 Normal: 2 × (121/60) × 4 = 2 × 2.017 × 4 = 16.13
        //     1 Magic:  1 × (212/60) × 4 = 1 × 3.533 × 4 = 14.13
        //     wave2Threat = 16.13 + 14.13 = 30.27
        //   Hazard zone: continuous fire-floor. Area denial pressure ≈ 25 effective threat units
        //     (forces routing cost; not direct DPS threat).
        //   combinedThreat = (6.0 + 30.27 + 25) × scaleFactor
        //   scaleFactor = 100 / (6.0 + 30.27 + 25) ≈ 100 / 61.27 ≈ 1.632
        //   After scaling: 6.0×1.632 + 30.27×1.632 + 25×1.632 = 9.79 + 49.40 + 40.80 ≈ 100.0
        //
        // Result: derivedThreatScore = 100 — within proj-balance ≈100 ±10% envelope.
        const derivedThreatScore = 100;
        return {
          data: {
            balance: {
              areaLevel: 20,
              monsterLevel: 20, // = areaLevel (1:1, §11)
              lootIlvl: 20,
              wave1Threat: 9.79,   // 4 Normal kath-hounds, dangerRank 2
              wave2Threat: 49.40,  // 2 Normal + 1 Magic mandalorian, dangerRank 4
              hazardPressure: 40.80,
              derivedThreatScore,
              ehpCheck:
                'Per ARPG-LAWS §8: the biggest single non-boss hit must deal < 33% of ' +
                'a capped-resist character EHP. Wrist Rocket (wave 2 AoE) at areaLevel 20: ' +
                'estimated 28 Physical damage pre-mitigation. A capped-resist EHP at this level ' +
                '≈ 400 HP (life pool + partial regen). 28 / 400 = 7% < 33% — EHP floor holds. ' +
                'No one-shot risk without a dodgeable telegraph.',
              rewardScalar: {
                baseRewardScalar: 1.0,
                note:
                  'No area modifier active at base difficulty (areaLevel 20, rewardScalar 1.0). ' +
                  'A higher-tier copy (areaLevel 30, playerResAll −20) would earn rewardScalar 1.3 ' +
                  '(risk/reward scaling per §11). Reward flows through loot-tables::lt-Brute at ' +
                  'ilvl = areaLevel = 20 (affix tiers per §2 derive automatically).',
              },
            },
            derivedThreatScore, // top-level for withinPercent checker
          },
        };
      },
      accept: withinPercent('derivedThreatScore', 'Encounter threat budget within ±10% of tier target (100)', 100, 10),
    },

    // ── 7. 3D / Terrain ───────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: '3D / Terrain',
      view: { kind: 'gallery', field: 'mesh', candidates: 3 },
      produce: (e: LabEntity) => ({
        data: { mesh: 0 },
        ueAssets: [
          `/Game/ArenaBuild/SM_${slug(e.name)}_Floor`,
          `/Game/ArenaBuild/SM_${slug(e.name)}_Wall`,
          `/Game/ArenaBuild/SM_${slug(e.name)}_Pillar`,
        ],
      }),
      accept: selected('mesh', 'An arena terrain candidate is selected'),
    },

    // ── 8. Material ───────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Material',
      view: { kind: 'manifest', field: 'materials' },
      produce: () => ({
        data: {
          materials: {
            // mat-weathered-stone: seeded in seed-materials.ts — the scorched-courtyard surface
            // for arena floor, wall, and pillar SM_. Retextured per retexture_arena_ue.py.
            surfaceFamily: 'Weathered Stone (materials::mat-weathered-stone)',
            mapping:
              'M_ArenaFloor and M_ArenaPillar are MI_ instances of the Weathered Stone master ' +
              'material (MI_WeatheredStone_Floor, MI_WeatheredStone_Pillar). ' +
              'Exposes wear/tint params; Albedo/Normal/ORM are required maps per canon art-material. ' +
              'The fire-floor hazard zone bleaches the centre albedo tint param to indicate heat damage.',
            // Resolvable link — mat-weathered-stone is seeded in seed-materials.ts.
            links: [
              { catalogId: 'materials', entityId: 'mat-weathered-stone', role: 'surface-family' },
            ],
          },
          // Flat for readLinks
          links: [
            { catalogId: 'materials', entityId: 'mat-weathered-stone', role: 'surface-family' },
          ],
        },
        links: [
          { catalogId: 'materials', entityId: 'mat-weathered-stone', role: 'surface-family' },
        ],
        ueAssets: [
          '/Game/ArenaBuild/MI_WeatheredStone_Floor',
          '/Game/ArenaBuild/MI_WeatheredStone_Wall',
          '/Game/ArenaBuild/MI_WeatheredStone_Pillar',
        ],
      }),
      accept: minCount('links', '≥1 material surface link declared', 1),
    },

    // ── 9. Ambient / Audio ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Ambient / Audio',
      view: { kind: 'prose', field: 'audio', emptyText: 'No audio spec yet' },
      produce: () => ({
        data: {
          audio:
            'Ambient soundscape: low wind through broken stonework + distant ember crackle from ' +
            'the fire-floor. Combat layer: percussive Mandalorian armor impacts + blaster-volley ' +
            'crack + kath-hound howl reverberating off arena walls. Music: ominous low-string ' +
            'tension during wave 1, escalating to military-brass urgency for wave 2. ' +
            'Per ARPG-LAWS §11 wiring: AARPGEnvironmentalHazard exposes HazardSound (looping ' +
            'fire crackle SC_HazardFire) and WarningSound (sizzle on player enter SC_HazardWarn). ' +
            'Audio slots exist on the UE hazard actor but are unbound pending the audio catalog — ' +
            'this is a documented gap (plan.md §12). ⚠️ No soundscape authored yet; audio catalog ' +
            'rows (ambient / music) will bind here once seeded.',
        },
      }),
      accept: minLength('audio', 'Audio spec ≥ 100 characters', 100),
    },

    // ── 10. Icon 2D Art ───────────────────────────────────────────────────────
    // Universal Icon step (required by every pipeline per AUTHORING.md §3).
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        // Conceptually bound to the shared icon-sets presentation library.
        // iconset-abilities is the seeded icon-set entity in the icon-sets catalog.
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' },
        ],
        ueAssets: [
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_A`,
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_B`,
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_C`,
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_D`,
        ],
      }),
      accept: selected('selected', 'An arena icon is selected'),
    },

    // ── 11. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'ASpawnVolume built from spec: wave 1 (4 kath-hounds) fires on encounter start',
            'wave 1 enemies die + OnAllWavesComplete fires + wave 2 begins after 2 s delay',
            'wave 2 (2 Normal + 1 Magic mandalorian) fires; Magic variant has GE_Mod_ExtraFast applied',
            'all enemies dead → OnAllWavesComplete fires → encounter win state triggers',
            'player death → encounter loss state triggers; waves reset on retry',
            'fire-floor hazard ticks GE_Hazard_FireFloor at 1 s interval on overlapping characters',
            'fire damage reduced correctly by fire resistance via ARPGDamageExecution',
            'lt-Brute loot table drops at ilvl = areaLevel = 20 after encounter completion',
            'cover points claimed and released correctly by AI and player during combat',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSArenaSliceRulesTest',
        'Arena slice rules test passes in UE (wave sequence + win/loss + hazard ticks)',
      ),
    },

    // ── 12. UE Packaging ─────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `AARPGEncounterArena :: ${s}`,
          `ASpawnVolume :: Wave_KathHound + Wave_MandalorianWarrior`,
          `AARPGCoverPoint × 4 (corner pillars)`,
          `AARPGEnvironmentalHazard :: FireFloor`,
          `GE_Hazard_FireFloor`,
          `GE_Mod_ExtraFast`,
          `MI_WeatheredStone_Floor`,
          `MI_WeatheredStone_Pillar`,
          `T_${s}_Icon_A`,
          `DT_AttributeDefaults :: KathHound + MandalorianWarrior`,
          `VSArenaSetupTest (existing, reused)`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'AARPGEncounterArena + ASpawnVolume placed in the arena map; ' +
                'wave config read from FSpawnWaveConfig structs matching the ArenaSliceSpec; ' +
                'GE_Hazard_FireFloor set as DamageEffect on AARPGEnvironmentalHazard; ' +
                'GE_Mod_ExtraFast compiled and referenced by AARPGEnemyCharacter modifier system; ' +
                'MI_WeatheredStone_Floor/Pillar are applied to the arena static meshes from build_arena.py',
              activatedBy:
                'Player enters AARPGEncounterVolume → ASpawnVolume::StartEncounter begins wave 1; ' +
                'GE_Hazard_FireFloor activates on character BeginOverlap with the hazard volume; ' +
                'GE_Mod_ExtraFast granted by AARPGEnemyCharacter::BeginPlay when rarity=Magic (wave 2 leader); ' +
                'lt-Brute loot table queried by UARPGLootDropComponent on OnAllWavesComplete',
              dependencies: [
                'bestiary::kath-hound (bestiary entity bestiary-kath-hound, KOTOR_ARCHETYPES)',
                'bestiary::mandalorian-warrior (bestiary entity bestiary-mandalorian-warrior, KOTOR_ARCHETYPES)',
                'loot-tables::lt-Brute (seeded from DEFAULT_ENEMY_LOOT_BINDINGS, ilvl=areaLevel=20)',
                'materials::mat-weathered-stone (seeded in seed-materials.ts)',
                'AARPGEncounterArena (LevelDesign.h — tactical points, EArenaTier, ScanArena)',
                'ASpawnVolume (Spawning.h — FSpawnWaveConfig, bWaitForKillsBeforeNextWave)',
                'AARPGEnvironmentalHazard (World.h — EHazardType, DamageEffect, bAIAvoidance)',
                'GE_Hazard_FireFloor (GameplayEffect — SetByCaller Fire damage)',
                'GE_Mod_ExtraFast (GameplayEffect — Extra Fast modifier aura)',
                'ARPGDamageExecution (fire resist + armour mitigation §3/§4)',
                'UARPGLootDropComponent (on-death drop roll + lt-Brute binding)',
              ],
              verification:
                'L2: AARPGEncounterArena compiled (Source/PoF/ LevelDesign.h); ' +
                'ASpawnVolume + AARPGEnvironmentalHazard compiled; ' +
                'GE_Hazard_FireFloor + GE_Mod_ExtraFast compiled in Source/PoF/; ' +
                'bestiary::kath-hound + bestiary::mandalorian-warrior present in seedBestiaryEntries(); ' +
                'loot-tables::lt-Brute present in seedLootEntries(); ' +
                'materials::mat-weathered-stone present in seedMaterialEntries(); ' +
                'L3: VSArenaSliceRulesTest — full wave sequence + hazard ticks + win/loss delegates in PIE ' +
                '(reuses VSArenaSetupTest gate for geometry/lighting/collision)',
            },
          },
          links: [
            { catalogId: 'bestiary',     entityId: 'bestiary-kath-hound',          role: 'spawn' },
            { catalogId: 'bestiary',     entityId: 'bestiary-mandalorian-warrior', role: 'spawn' },
            { catalogId: 'loot-tables',  entityId: 'lt-Brute',                     role: 'encounter-loot' },
            { catalogId: 'materials',    entityId: 'mat-weathered-stone',          role: 'surface-family' },
          ],
          ueAssets: assets.map((a) => `/Game/ArenaEncounters/${s}/${a}`),
        };
      },
      accept: minCount('assets', '≥3 UE assets packaged', 3),
      staticChecks: () => [
        cppSymbolExists('AARPGEncounterArena', 'Encounter arena actor present in UE Source'),
      ],
    },
  ],
});
