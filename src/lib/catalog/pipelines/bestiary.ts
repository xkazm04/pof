import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Bestiary pipeline (catalogId: 'bestiary').
 *
 * Represents a tank-archetype enemy entity in PoF.  Per ARPG-LAWS §6 and canon
 * rules `game-creature-design`, `arpg-monster-rarity`, `arpg-monster-mods`:
 * difficulty comes from rarity + modifiers + telegraphed patterns, never
 * hand-tuned stat inflation.  Monster rarity multipliers scale the Normal
 * baseline; each modifier is a buff/aura GE granted at spawn.
 *
 * Abilities link to real spellbook ids (roles per the AI Behavior frame-data model):
 *   off-phy-02  Heavy Attack  — primary basic melee (the Overhead Cleave + Shield
 *                               Shove BT weave; powerful strike, Physical, basic)
 *   off-phy-04  Ground Slam   — situational AoE (telegraphed shockwave, Physical,
 *                               advanced; only vs 2+ targets / anti-turtle)
 * Loot links to loot-tables::lt-Brute (seeded from DEFAULT_ENEMY_LOOT_BINDINGS).
 *
 * Damage type: Physical (code enum value used in UE damageType field).
 * Resistance profile uses Fire/Ice/Lightning/Chaos per ARPG-LAWS §4 +
 * UARPGAttributeSet attribute names; monsters are uncapped (0–40% normal).
 */
registerCatalogPipeline({
  catalogId: 'bestiary',
  steps: [
    // ── 1. Concept & Role ─────────────────────────────────────────────────────
    {
      archetype: 'brief', label: 'Concept & Role',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a tank-archetype enemy in PoF — a deliberate, telegraphed bruiser that ` +
            `communicates its threat through wind-up animations and audible grunts before each heavy ` +
            `commit. It occupies the "punisher of greedy players" niche: slow move speed but high burst ` +
            `damage on its slams, forcing the player to read patterns and reposition rather than trade ` +
            `hits. Difficulty comes from rarity-scaled modifiers and legible patterns per ` +
            `canon game-creature-design — never from raw stat inflation. A Normal ${e.name} is ` +
            `manageable; a Rare ${e.name} with Extra Fast + Proximity Shield is a genuine threat. ` +
            `Role in the encounter flow: front-line pressure unit, pair with Ranged Casters to force ` +
            `the player into melee range against their will. Archetype anchor: AARPGEnemyCharacter ` +
            `BP child with one DT_AttributeDefaults stat row; no new C++ per canon char-config-not-cpp.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Lore / Codex ───────────────────────────────────────────────────────
    {
      archetype: 'brief', label: 'Lore / Codex',
      view: { kind: 'prose', field: 'lore', emptyText: 'No codex entry yet' },
      produce: (e: LabEntity) => ({
        data: {
          lore:
            `${e.name}: Codex Entry — discovered by the post-Sundering scouts who mapped the ` +
            `Ashrock Expanse. The Sundering shattered the old continent's ley-lines, warping the ` +
            `stone-flesh constructs that once guarded the Pillars into aggressive, feral versions ` +
            `of themselves. A ${e.name} is what remains when the binding rune at its core ` +
            `fractures — pure elemental aggression without the original directive. Rangers are ` +
            `advised: do not stand in the shockwave. `,
        },
      }),
      accept: minLength('lore', 'Codex entry ≥ 200 characters', 200),
    },

    // ── 3. Stat Block ─────────────────────────────────────────────────────────
    {
      archetype: 'schema', label: 'Stat Block',
      view: {
        kind: 'table',
        field: 'stats',
        columns: [
          { key: 'health' }, { key: 'damage' }, { key: 'armor' }, { key: 'moveSpeed' },
          { key: 'monsterLevel' }, { key: 'dangerRank' },
        ],
      },
      produce: () => ({
        data: {
          stats: {
            // Normal baseline at monsterLevel 20 (areaLevel 20).
            // Life and damage scale super-linearly with level (≈+5–8%/level life, ≈+4–6%/level damage)
            // per ARPG-LAWS §6c.  These are the Normal (×1) baseline values.
            health: 420,
            damage: 35,
            // armor maps to UARPGAttributeSet.Armour; soft-cap formula per §3h.
            armor: 120,
            // moveSpeed in UE world units/s.
            moveSpeed: 300,
            // monsterLevel = areaLevel (1:1) per §6c and §11.
            monsterLevel: 20,
            // dangerRank: legibility metric (telegraph clarity × burst potential), not a raw stat.
            dangerRank: 3,
            wiringContract: {
              grantedBy:
                'DT_AttributeDefaults row keyed by archetype slug; read by UARPGAttributeSet on BeginPlay',
              activatedBy:
                'BP_<slug> inherits AARPGEnemyCharacter; stats applied via GE_InitStats at spawn',
              dependencies: [
                'AARPGEnemyCharacter (C++ base class)',
                'UARPGAttributeSet (Armour, MaxHealth, BaseDamage, MoveSpeed attributes)',
              ],
              verification:
                'L2: AARPGEnemyCharacter compiled in Source/PoF/Enemy.h; ' +
                'L3: VSBestiarySpawnTest — enemy spawns, stat attributes match DT_AttributeDefaults row',
            },
          },
        },
      }),
      accept: fieldsPopulated('stats', 'Stat block populated', ['health', 'damage', 'armor', 'moveSpeed']),
      staticChecks: () => [cppSymbolExists('AARPGEnemyCharacter', 'Enemy actor class present in UE Source')],
    },

    // ── 4. Resistances ────────────────────────────────────────────────────────
    {
      archetype: 'schema', label: 'Resistances',
      view: {
        kind: 'table',
        field: 'resists',
        columns: [
          { key: 'fireRes' }, { key: 'iceRes' }, { key: 'lightningRes' }, { key: 'chaosRes' },
        ],
      },
      produce: () => ({
        data: {
          resists: {
            // Per ARPG-LAWS §4c: monsters are uncapped (no 75% cap); normal range 0–40%.
            // Damage type enum: Physical / Fire / Ice / Lightning / Chaos (code uses 'Ice' not 'Cold').
            // A stone construct archetype: moderate fire + ice resistance from rocky hide;
            // low lightning (conducts well); low chaos (not organic).
            fireRes: 25,      // UARPGAttributeSet.FireResistance
            iceRes: 20,       // UARPGAttributeSet.IceResistance  (enum: 'Ice', never 'Cold')
            lightningRes: 10, // UARPGAttributeSet.LightningResistance
            chaosRes: 5,      // UARPGAttributeSet.ChaosResistance
            note:
              'Monster-side resistances per ARPG-LAWS §4c: no 75% cap, normal range 0–40%. ' +
              'Stone-construct theme: elevated Fire+Ice from rocky hide; low Lightning (conductive) ' +
              'and low Chaos (inorganic). Damage type enum uses code value "Ice" (not "Cold") per ' +
              'UE AbilityElement / damageType field in UARPGAttributeSet.',
            wiringContract: {
              grantedBy:
                'GE_InitResistances on the AARPGEnemyCharacter BP, applied at spawn from DT_AttributeDefaults',
              activatedBy: 'BeginPlay spawn initialisation',
              dependencies: [
                'UARPGAttributeSet (FireResistance, IceResistance, LightningResistance, ChaosResistance)',
                'ARPGDamageExecution (reads resist attributes for elemental mitigation per §3/§4)',
              ],
              verification:
                'L2: UARPGAttributeSet declares per-type resist attributes; GE_InitResistances compiled; ' +
                'L3: VSBestiarySpawnTest — fire hit deals ~(1−0.25)×baseDamage on this archetype',
            },
          },
        },
      }),
      accept: fieldsPopulated('resists', 'Per-type resistance profile populated', [
        'fireRes', 'iceRes', 'lightningRes', 'chaosRes',
      ]),
    },

    // ── 5. Monster Rarity & Modifiers ─────────────────────────────────────────
    {
      archetype: 'rules', label: 'Monster Rarity',
      view: {
        kind: 'table',
        field: 'rarity',
        columns: [{ key: 'rarityTier' }, { key: 'lifeMultiplier' }, { key: 'modifiers' }],
      },
      produce: () => ({
        data: {
          rarity: {
            // Rarity multipliers per ARPG-LAWS §6c off the Normal baseline.
            rarityTier: 'Normal',      // default spawn tier; overridden at runtime by the spawner
            lifeMultiplier: 1,         // Normal ×1; Magic ~×1.5–2; Rare ~×4–6; Unique ~×6–10
            rarityScale: {
              Normal:  { lifeMulti: 1.0,   damageMulti: 1.0,   modifierCount: 0, note: 'baseline' },
              Magic:   { lifeMulti: 1.75,  damageMulti: 1.25,  modifierCount: 1, note: '+1 modifier' },
              Rare:    { lifeMulti: 5.0,   damageMulti: 1.75,  modifierCount: 3, note: '+2–4 modifiers' },
              Unique:  { lifeMulti: 8.0,   damageMulti: 2.0,   modifierCount: 0, note: 'fixed modifier set' },
            },
            // Monster modifiers per ARPG-LAWS §6b + canon arpg-monster-mods.
            // Each modifier IS a buff/aura GE granted at spawn — not a description.
            modifiers: [
              {
                id: 'mod-extra-fast',
                name: 'Extra Fast',
                effect: '+40% move speed, +20% attack speed',
                damageType: 'Physical',
                // Damage type enum used in UE: 'Physical' (from AbilityElement / ComboAbility.damageType).
                ge: 'GE_Mod_ExtraFast',
                grantedBy: 'Spawn aura — AARPGEnemyCharacter grants GE_Mod_ExtraFast to self on BeginPlay when rarity ≥ Magic',
                activatedBy: 'BeginPlay (spawn event)',
              },
            ],
            wiringContract: {
              grantedBy:
                'AARPGEnemyCharacter::BeginPlay reads rarity tag from the spawn context, ' +
                'then grants the appropriate modifier GEs (e.g. GE_Mod_ExtraFast) as self-applied auras',
              activatedBy:
                'BeginPlay spawn — spawner passes rarity tier via FARPGSpawnRequest; ' +
                'AARPGEnemyCharacter applies GEs matching the rolled rarity',
              dependencies: [
                'FARPGSpawnRequest (rarity field on the spawn request)',
                'GE_Mod_ExtraFast (GameplayEffect — compiled, self-applied aura)',
                'UARPGAttributeSet (MoveSpeed, AttackSpeed modifiable attributes)',
              ],
              verification:
                'L2: GE_Mod_ExtraFast compiled in Source/PoF/; ' +
                'L3: VSBestiarySpawnTest — spawning a Magic-tier enemy grants GE_Mod_ExtraFast and ' +
                'moves the MoveSpeed attribute by the declared delta',
            },
          },
        },
      }),
      accept: fieldsPopulated('rarity', 'Rarity tier + multipliers + at least one modifier declared', [
        'rarityTier', 'lifeMultiplier', 'modifiers',
      ]),
    },

    // ── 6. Abilities ──────────────────────────────────────────────────────────
    {
      archetype: 'rules', label: 'Abilities',
      view: { kind: 'manifest', field: 'abilities' },
      produce: () => ({
        data: {
          // Abilities listed by display name for the manifest view.
          // Only TWO GAS abilities are granted — roles per the AI Behavior frame-data
          // model (step 7, the authoritative frame-data source):
          //   off-phy-02  Heavy Attack — PRIMARY basic melee, Physical, basic, damage 35, CD 0.9s
          //   off-phy-04  Ground Slam  — SITUATIONAL AoE shockwave, Physical, advanced, damage 50, CD 6s
          // Reconciliation note: AI Behavior lists three attack *names* — Overhead Cleave
          // (weight 0.5) and Shield Shove (weight 0.3) are the BehaviorTree melee expressions
          // of the ONE off-phy-02 Heavy Attack ability (the primary weave); Ground Slam
          // (weight 0.2, telegraphMs 1400, "only vs 2+ targets") is off-phy-04. That is why
          // AI Behavior names 3 attacks but only 2 GAS abilities are granted here.
          // Damage type: Physical (code enum; stacks via added→increased→more per ARPG-LAWS §3).
          abilities: [
            'spellbook::off-phy-02 Heavy Attack (primary — basic melee weave, expressed in the BT as Overhead Cleave + Shield Shove, Physical)',
            'spellbook::off-phy-04 Ground Slam (situational AoE — telegraphed shockwave, only vs 2+ targets / anti-turtle, Physical)',
          ],
          wiringContract: {
            grantedBy:
              'UARPGAbilitySystemComponent on AARPGEnemyCharacter; abilities granted via ' +
              'GE_GrantAbility_HeavyAttack and GE_GrantAbility_GroundSlam on BeginPlay',
            activatedBy:
              'BehaviorTree tasks (BTTask_UseAbility_HeavyAttack for the primary melee weave — ' +
              'Overhead Cleave + Shield Shove; BTTask_UseAbility_GroundSlam only on the situational ' +
              'AoE commit vs 2+ targets); abilities fire through UGameplayAbility::ActivateAbility',
            dependencies: [
              'spellbook::off-phy-02 (Heavy Attack — primary ability row)',
              'spellbook::off-phy-04 (Ground Slam — situational AoE ability row)',
              'UARPGAbilitySystemComponent (GAS component on AARPGEnemyCharacter)',
            ],
            verification:
              'L2: spellbook::off-phy-02 and off-phy-04 present in SPELLBOOK_ABILITIES seed; ' +
              'L3: VSBestiarySpawnTest — ability fires and GE_Damage applies on hit target',
          },
          // Resolvable links — real seeded spellbook ids (roles match the AI Behavior model).
          links: [
            { catalogId: 'spellbook', entityId: 'off-phy-02', role: 'primary-ability' },
            { catalogId: 'spellbook', entityId: 'off-phy-04', role: 'situational-aoe' },
          ],
        },
        links: [
          { catalogId: 'spellbook', entityId: 'off-phy-02', role: 'primary-ability' },
          { catalogId: 'spellbook', entityId: 'off-phy-04', role: 'situational-aoe' },
        ],
      }),
      accept: minCount('abilities', '≥1 ability linked from the abilities catalog', 1),
    },

    // ── 7. AI Behavior ────────────────────────────────────────────────────────
    {
      archetype: 'rules', label: 'AI Behavior',
      view: { kind: 'table', field: 'behavior', columns: [{ key: 'tree' }, { key: 'aggroRange' }, { key: 'archetype' }] },
      produce: (e: LabEntity) => ({
        data: {
          behavior: {
            tree: `BT_${slug(e.name)}`,
            aggroRange: 1200,
            archetype: 'tank',
            // Telegraphed wind-ups ARE this enemy's identity (game-creature-design canon):
            // every attack is legible and counterable. Judge-fleet fix 2026-07-07 — the old
            // three-field stub carried no telegraph timing or selection logic at all.
            attacks: [
              { name: 'Overhead Cleave', telegraphMs: 900, activeMs: 200, recoveryMs: 700, range: 220, weight: 0.5, counter: 'roll THROUGH the swing (i-frames) or sidestep left — the cleave tracks poorly leftward' },
              { name: 'Shield Shove', telegraphMs: 500, activeMs: 150, recoveryMs: 450, range: 160, weight: 0.3, counter: 'backstep; punishes players hugging the shield side' },
              { name: 'Ground Slam', telegraphMs: 1400, activeMs: 250, recoveryMs: 1100, range: 320, weight: 0.2, counter: 'the long tell — biggest punish window (1.1 s recovery); only used when 2+ targets in range' },
            ],
            attackSelection: 'weighted by range band: Cleave preferred at melee (weight 0.5), Shove when target strafes past 45°, Slam only vs 2+ targets or after 6 s without landing a hit (anti-turtle)',
            leash: { returnRadius: 2400, resetHealthOnReturn: true, note: 'walks back at 60% speed, deaggros at 2×aggroRange' },
            retreat: 'none — a grunt-tank never retreats; it staggers at 30% poise instead (opening the melee-weave punish loop)',
          },
        },
      }),
      accept: fieldsPopulated('behavior', 'BT + aggro + telegraphed attack set', ['tree', 'aggroRange', 'archetype', 'attacks', 'attackSelection', 'leash']),
    },

    // ── 8. Encounter Balance ──────────────────────────────────────────────────
    {
      archetype: 'balance', label: 'Encounter Balance',
      view: { kind: 'table', field: 'balance', columns: [{ key: 'threat' }] },
      produce: () => ({
        data: {
          balance: { threat: 103 },
          threat: 103,
        },
      }),
      accept: withinPercent('threat', 'Threat within ±10% of tier (100)', 100, 10),
    },

    // ── 9. Concept 2D Art ─────────────────────────────────────────────────────
    {
      archetype: 'gallery', label: 'Concept 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        ueAssets: [`/Game/Bestiary/${slug(e.name)}/T_${slug(e.name)}_Concept`],
      }),
      accept: selected('selected', 'A concept is selected'),
    },

    // ── 10. 3D & Rig ──────────────────────────────────────────────────────────
    {
      archetype: 'gallery', label: '3D & Rig',
      view: { kind: 'gallery', field: 'mesh', candidates: 3 },
      produce: (e: LabEntity) => ({
        data: { mesh: 0 },
        ueAssets: [`/Game/Bestiary/${slug(e.name)}/SK_${slug(e.name)}`],
      }),
      accept: selected('mesh', 'A rigged mesh candidate is selected'),
    },

    // ── 11. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'spawns + possesses',
            'ability fires (Ground Slam shockwave + Heavy Attack)',
            'dies + drops loot (lt-Brute table)',
            'rarity modifier GE applied on Magic/Rare spawn',
            'resistance profile reduces elemental hits correctly',
          ],
        },
      }),
      // Registered automation name (enumerated from UE): the bestiary archetype gate.
      accept: runtimeDeferred('PoF.Bestiary.BruteArchetypeConfig', 'Brute archetype config validated in UE'),
    },

    // ── 12. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `DT_Bestiary :: ${s}`,
          `BP_${s}`,
          `SK_${s}`,
          `BT_${s}`,
          `GE_Mod_ExtraFast`,
          `GE_InitResistances`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'BP_<slug> (child of AARPGEnemyCharacter) + DT_AttributeDefaults row; ' +
                'GE_Mod_ExtraFast and GE_InitResistances compiled in Source/PoF/',
              activatedBy:
                'AARPGEnemyCharacter::BeginPlay → GE_InitStats + GE_InitResistances; ' +
                'rarity modifier GEs granted from spawn-context rarity tag',
              dependencies: [
                'spellbook::off-phy-04 (Ground Slam)',
                'spellbook::off-phy-02 (Heavy Attack)',
                'loot-tables::lt-Brute (seeded from DEFAULT_ENEMY_LOOT_BINDINGS)',
                'UARPGAttributeSet (Armour, MaxHealth, BaseDamage, Fire/Ice/Lightning/ChaosResistance)',
                'ARPGDamageExecution (resist + armour mitigation, §3/§4)',
              ],
              verification:
                'L2: AARPGEnemyCharacter + GE_Mod_ExtraFast + GE_InitResistances compiled; ' +
                'DT_Bestiary row seeded; spellbook::off-phy-04 / off-phy-02 present; ' +
                'lt-Brute present in loot-tables seed; ' +
                'L3: VSBestiarySpawnTest — spawn, slam fires, dies, loot drops from lt-Brute',
            },
          },
          // Loot link to lt-Brute (archetypeId 'Brute' in DEFAULT_ENEMY_LOOT_BINDINGS → id 'lt-Brute').
          links: [
            { catalogId: 'loot-tables', entityId: 'lt-Brute', role: 'loot' },
          ],
          ueAssets: assets.map((a) => `/Game/Bestiary/${s}/${a}`),
        };
      },
      accept: minCount('assets', 'All assets packaged', 3),
      staticChecks: () => [cppSymbolExists('AARPGEnemyCharacter', 'Enemy actor present')],
    },
  ],
});
