import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Characters pipeline (catalogId: 'characters').
 *
 * Named NPC / hero character — config-driven over the shared AARPGNPCActor production type.
 * Per ARPG-LAWS §9 (classes + attributes) and §8 (defenses/EHP).
 *
 * Wiring: BP child of AARPGNPCActor; stats in DT_AttributeDefaults (FARPGAttributeInitRow);
 * abilities granted via UARPGAbilitySystemComponent at BeginPlay; dialogue bound via
 * UARPGDialogueComponent + NPCID; quest-giver role activates the AARPGQuestSubsystem
 * TalkTo event. No new C++ per canon `char-config-not-cpp`.
 */
registerCatalogPipeline({
  catalogId: 'characters',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief', label: 'Concept & Role',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a named NPC character in PoF — a plate-armored human officer who anchors ` +
            `the early-game hub. He serves as the primary quest-giver for the introductory campaign ` +
            `arc, leveraging the existing AARPGNPCActor role system (NPCRole=QuestGiver) which ` +
            `automatically displays a gold "!" indicator via GetRoleColor/GetRoleDisplayText. ` +
            `Martially capable but a talker first: level-5 base stats, Strength-primary attribute ` +
            `spread, and grants both Melee Attack (off-phy-01) and Heavy Attack (off-phy-02) via the ` +
            `shared UARPGAbilitySystemComponent. His dialogue tree is bound to NPCID=CaptainVael; ` +
            `the TalkTo quest-subsystem event grants the introductory quest on conversation end. ` +
            `Visual presentation reuses the SKM_Manny + ABP_Manny mannequin path (no bespoke mesh ` +
            `pipeline exists yet); a captain-specific texture/material pass is a gap pending the ` +
            `MetaHuman/Blender character pipeline. Stats live in DT_AttributeDefaults (one ` +
            `FARPGAttributeInitRow row, canon char-stat-source) — no per-character C++ class.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Concept 2D Art ────────────────────────────────────────────────────
    {
      archetype: 'gallery', label: 'Concept 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({ data: { selected: 0 }, ueAssets: [`/Game/Characters/${slug(e.name)}/T_${slug(e.name)}_Concept`] }),
      accept: selected('selected', 'A concept is selected'),
    },

    // ── 3. Stat Block ─────────────────────────────────────────────────────────
    {
      archetype: 'schema', label: 'Stat Block',
      view: { kind: 'table', field: 'stats', columns: [{ key: 'health' }, { key: 'damage' }, { key: 'armor' }, { key: 'moveSpeed' }] },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        return {
          data: {
            stats: {
              // ── Primary attributes (ARPG-LAWS §9c) — Str-primary, Dex secondary, Int tertiary ──
              // Canonical seeded values (seed-characters.ts CAPTAIN_VAEL.data.attributes).
              // Per §9c: every 10 Str → +5 life flat; every 10 Dex → +10 accuracy/evasion rating.
              strength: 16,    // seeded canonical value
              dexterity: 12,   // seeded canonical value
              intelligence: 11, // seeded canonical value

              // ── Derived offensive stats (ARPG-LAWS §3c) ──
              // Base weapon DPS = ((dmgMin+dmgMax)/2) × APS; sword APS ≈ 1.3 (mid-range, §1c).
              // damage = ((22+32)/2) × 1.3 = 27 × 1.3 ≈ 35 Physical, fits level-5 envelope.
              health: 220,     // seeded canonical value; life-math: 215 base + floor(16/10)×5 = +5 → 220 (§9c: +5 life per 10 Str)
              damage: 35,      // (22+32)/2 × APS 1.3 ≈ 35 Physical (§3c, Physical type)
              damageMin: 22,
              damageMax: 32,
              attackSpeed: 1.3,
              critChance: 5.5, // sword class base 5–6.5% (§1c)
              critMulti: 150,  // global base +150% (×2.5 on crit, §1c)
              damageType: 'Physical', // §3a — explicit damage type (schema-down: matches UE Physical enum)

              // ── Defensive stats (ARPG-LAWS §8) ──
              armor: 120,      // plate-armored officer: strong vs small physical hits (§3 soft-cap formula)
              evasion: 60,     // low evasion — plate archetype invests in armor not dodge
              block: 0,        // no shield in base config
              energyShield: 0, // Str/physical build; no ES investment
              moveSpeed: 350,

              // ── Resistance profile (ARPG-LAWS §4 + §8c) ──
              // Human officer archetype: capped fire/cold (plate + tempering), weak to chaos.
              // NPC resistances are uncapped (§4c: monsters have no 75% cap).
              // These sit in the "normal 0–40% for themed pack" NPC range (§4c).
              fireResistance: 30,       // tempered plate — good vs fire
              coldResistance: 25,       // moderate vs cold
              lightningResistance: 15,  // low vs lightning (metal armor is a conductor)
              chaosResistance: 0,       // human — no chaos resistance (standard NPC baseline)

              // ── Recovery (ARPG-LAWS §8c) ──
              regenPerSec: 4.0, // mid-NPC regen: ~4/s (regen build range 2–8%/s at 220 life → ~1.8%/s, in envelope)

              note:
                'Str-primary officer at L5. Canonical seeded stats (seed-characters.ts). ' +
                'Per §9c: every 10 Str +5 life (Str 16 → floor(16/10)×5 = +5 bonus; 215 base + 5 = 220); ' +
                'Dex 12 grants accuracy/evasion rating. DamageType=Physical routes through ' +
                'ARPGDamageExecution added→increased→more pipeline (§3). Resistance profile: ' +
                'NPC has no 75% cap (§4c); fire/cold moderate, chaos 0 (human baseline). ' +
                'Stats live in DT_AttributeDefaults (FARPGAttributeInitRow, canon char-stat-source).',
            },
            wiringContract: {
              grantedBy: 'AARPGNPCActor at BeginPlay — reads FARPGAttributeInitRow from DT_AttributeDefaults keyed by NPCID=CaptainVael',
              activatedBy: 'BeginPlay → UARPGAbilitySystemComponent::InitAbilityActorInfo → attribute init from DT_AttributeDefaults row',
              dependencies: ['spellbook (off-phy-01 Melee Attack, off-phy-02 Heavy Attack — granted by UARPGAbilitySystemComponent)'],
              verification:
                'L2: FARPGAttributeInitRow struct compiled in Source/PoF/; CaptainVael row present in DT_AttributeDefaults; ' +
                'L3: VSCharacterVaelTest — deferred (asserts NPCID/role/indicator config; runtime attribute init pending PIE run)',
            },
          },
          ueAssets: [`/Game/Characters/${s}/DT_AttributeDefaults_${s}`],
        };
      },
      accept: fieldsPopulated('stats', 'Stat block populated', ['health', 'damage', 'armor', 'moveSpeed']),
      staticChecks: (e) => [
        cppSymbolExists('FARPGAttributeInitRow', 'Attribute init row struct present'),
        seedRowPresent('seed_attribute_defaults.py', slug(e.name), 'CaptainVael stat row seeded in DT_AttributeDefaults'),
      ],
    },

    // ── 4. 3D & Rig ──────────────────────────────────────────────────────────
    {
      archetype: 'gallery', label: '3D & Rig',
      view: { kind: 'gallery', field: 'mesh', candidates: 3 },
      produce: (e: LabEntity) => ({ data: { mesh: 0 }, ueAssets: [`/Game/Characters/${slug(e.name)}/SK_${slug(e.name)}`] }),
      accept: selected('mesh', 'A rigged mesh candidate is selected'),
    },

    // ── 5. Material / Outfit ─────────────────────────────────────────────────
    {
      archetype: 'gallery', label: 'Material / Outfit',
      view: { kind: 'gallery', field: 'material', candidates: 3 },
      produce: (e: LabEntity) => ({ data: { material: 0 }, ueAssets: [`/Game/Characters/${slug(e.name)}/MI_${slug(e.name)}_Outfit`] }),
      accept: selected('material', 'A material candidate is selected'),
    },

    // ── 6. Locomotion Anim ───────────────────────────────────────────────────
    {
      archetype: 'checklist', label: 'Locomotion Anim',
      view: { kind: 'checklist', field: 'clips' },
      produce: () => ({ data: { clips: ['Idle', 'Walk', 'Run'] } }),
      accept: minCount('clips', '≥3 locomotion clips', 3),
    },

    // ── 7. Combat Anim ───────────────────────────────────────────────────────
    {
      archetype: 'checklist', label: 'Combat Anim',
      view: { kind: 'checklist', field: 'clips' },
      produce: () => ({ data: { clips: ['MeleeAttack_Montage', 'HeavyAttack_Montage'] } }),
      accept: minCount('clips', '≥2 combat animation clips', 2),
    },

    // ── 8. VO ────────────────────────────────────────────────────────────────
    {
      archetype: 'checklist', label: 'VO',
      view: { kind: 'checklist', field: 'lines' },
      produce: () => ({ data: { lines: ['Greeting: "Halt, traveler — I need your help."'] } }),
      accept: minCount('lines', '≥1 VO line authored', 1),
    },

    // ── 9. Behavior (NPC) ────────────────────────────────────────────────────
    {
      archetype: 'rules', label: 'Behavior (NPC)',
      view: { kind: 'table', field: 'behavior', columns: [{ key: 'role' }, { key: 'npcId' }, { key: 'dialogueBinding' }] },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        return {
          data: {
            behavior: {
              role: 'QuestGiver',
              npcId: s,
              // Real seeded dialog-trees entity; Vael's flavor name noted as pending its own seed.
              dialogueBinding: 'dialog-gatekeeper',
              roleNote:
                'QuestGiver activates gold "!" indicator via AARPGNPCActor.GetRoleColor/GetRoleDisplayText. ' +
                '"dialog-gatekeeper" is the resolvable seeded dialog-trees entity; ' +
                'Vael\'s bespoke dialog-captain-vael entry is pending a dialog-trees catalog row (unblocking dep).',
              questNote:
                'Quest link targets quest-ember-pact (seeded). Vael\'s own quest (quest-vael-intro) ' +
                'is pending a quests catalog row; referenced in data.links as a pending note per ' +
                'plan.md cross-catalog dependencies.',
            },
            wiringContract: {
              grantedBy: 'AARPGNPCActor — UARPGDialogueComponent bound via NPCID=CaptainVael; AARPGQuestSubsystem TalkTo event fires on dialogue end',
              activatedBy: 'Player interaction (overlap + input) → NPCID TalkTo lookup → UARPGDialogueComponent::StartDialogue → quest grant on complete',
              dependencies: [
                'dialog-trees (dialog-gatekeeper — resolvable seeded entry; dialog-captain-vael pending catalog row)',
                'quests (quest-ember-pact — resolvable seeded entry; quest-vael-intro pending catalog row)',
                'spellbook (off-phy-01 Melee Attack, off-phy-02 Heavy Attack)',
              ],
              verification:
                'L2: AARPGNPCActor NPCID/role config compiled; dialog-gatekeeper + quest-ember-pact present in their catalog seeds; ' +
                'L3: VSCharacterVaelTest — deferred (interaction + quest grant in PIE)',
            },
            links: [
              // Resolvable seeded ids — confirmed in new-catalogs.ts
              { catalogId: 'dialog-trees', entityId: 'dialog-gatekeeper', role: 'host' },
              { catalogId: 'quests', entityId: 'quest-ember-pact', role: 'giver' },
              // Spellbook abilities granted to this character
              { catalogId: 'spellbook', entityId: 'off-phy-01', role: 'granted-ability' },
              { catalogId: 'spellbook', entityId: 'off-phy-02', role: 'granted-ability' },
            ],
          },
        };
      },
      accept: fieldsPopulated('behavior', 'Role + npcId + dialogueBinding', ['role', 'npcId', 'dialogueBinding']),
    },

    // ── 10. Icon 2D Art (portrait) ───────────────────────────────────────────
    {
      archetype: 'gallery', label: 'Icon 2D Art (portrait)',
      view: { kind: 'gallery', field: 'portrait', candidates: 4 },
      produce: (e: LabEntity) => ({ data: { portrait: 0 }, ueAssets: [`/Game/Characters/${slug(e.name)}/T_${slug(e.name)}_Portrait`] }),
      accept: selected('portrait', 'A portrait is selected'),
    },

    // ── 11. Test Gate ────────────────────────────────────────────────────────
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'NPC spawns in PIE with correct NPCID=CaptainVael',
            'QuestGiver role indicator (gold "!") renders via GetRoleColor',
            'dialogue interaction fires UARPGDialogueComponent::StartDialogue',
            'quest-ember-pact objective granted on dialogue completion',
            'FARPGAttributeInitRow values match DT_AttributeDefaults CaptainVael row',
            'off-phy-01 + off-phy-02 abilities granted by UARPGAbilitySystemComponent at BeginPlay',
          ],
        },
      }),
      accept: runtimeDeferred('VSCharacterVaelTest', 'NPC spawns + talks + gives quest in PIE'),
    },

    // ── 12. UE Packaging ─────────────────────────────────────────────────────
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `BP_${s}`,                      // BP child of AARPGNPCActor (no new C++ per char-config-not-cpp)
          `SK_${s}`,                       // Skeletal mesh (mannequin path: SKM_Manny)
          `DT_AttributeDefaults :: ${s}`,  // FARPGAttributeInitRow row (canon char-stat-source)
          `DT_Characters :: ${s}`,         // Character catalog DataTable row
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'AARPGNPCActor (BP_CaptainVael) — reads NPCID/role from BP defaults; ' +
                'stats from DT_AttributeDefaults keyed by entity slug; ' +
                'abilities from UARPGAbilitySystemComponent StartupAbilities array',
              activatedBy:
                'BeginPlay → AARPGNPCActor::BeginPlay: init attribute set from DT_AttributeDefaults, ' +
                'grant startup abilities (off-phy-01, off-phy-02), activate role indicator logic',
              dependencies: [
                'spellbook (off-phy-01 Melee Attack + off-phy-02 Heavy Attack — compiled GEs in DT_GeneratedAbilities)',
                'dialog-trees (dialog-gatekeeper seeded; dialog-captain-vael pending)',
                'quests (quest-ember-pact seeded; quest-vael-intro pending)',
              ],
              verification:
                'L2: AARPGNPCActor compiled + FARPGAttributeInitRow in Source/PoF/; ' +
                'DT_AttributeDefaults + DT_Characters seeded via seed_attribute_defaults.py + seed_characters.ts; ' +
                'L3: VSCharacterVaelTest (deferred) — asserts NPC identity/role/indicator config in PIE',
            },
          },
          ueAssets: assets.map((a) => `/Game/Characters/${s}/${a}`),
        };
      },
      accept: minCount('assets', 'All assets packaged', 4),
      staticChecks: (e) => [
        cppSymbolExists('AARPGNPCActor', 'NPC actor class present'),
        seedRowPresent('seed_characters.ts', slug(e.name), 'Character catalog row seeded for this entity'),
      ],
    },
  ],
});
