import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { graphValid } from '../acceptance/graphCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Quests pipeline (catalogId: 'quests').
 *
 * Represents a multi-stage player objective with branching stages, triggers,
 * world-state mutations, rewards, NPC bindings, and narrative beats.
 *
 * Target asset: "The Ember Pact" — a 3-stage introductory quest in which the
 * player discovers the Ashen Order's pact ritual north of the Ashen Forest,
 * forges (or refuses) the pact, and faces consequences of that choice.
 *
 * Wiring: quest state is tracked via an AARPGQuestComponent on the player
 * character; stage transitions fire GameplayEvents (Ability.Quest.*) consumed
 * by a UGameplayAbility_QuestAdvance; rewards are granted via GE_QuestReward_*
 * GameplayEffects activated on stage completion. Never re-authors loot/currency
 * data — links CatalogLink to loot-tables and currencies (canon proj-links).
 */
registerCatalogPipeline({
  catalogId: 'quests',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a 3-stage introductory quest for PoF, designed as the player's first ` +
            `sustained narrative encounter with the post-Sundering world. The Ashen Order — a ` +
            `militant faction who survived the cataclysm by binding themselves to ash-elemental ` +
            `forces — recruit the player to recover three Ember Cores from corrupted stone-brute ` +
            `spawn sites north of the Ashen Forest. On returning, a binding ritual offers a fateful ` +
            `choice: forge the Ember Pact (gain faction standing + an ember-laced loot chest) or ` +
            `refuse and expose the Order's corruption (gain a different reward, lock the faction). ` +
            `Stage 1: Accept the quest from Captain Vael (level ≥ 10 gate). Stage 2: Recover 3 ` +
            `Ember Cores from Stone Brute packs (loot-tables::lt-Brute). Stage 3: Ritual choice — ` +
            `PACT (success terminal) or REFUSE (alternate-success terminal). Failure terminal: ` +
            `killing Captain Vael before Stage 2 completes locks the quest in the BETRAYED state. ` +
            `Tone: morally ambiguous, faithful to the post-Sundering setting — power has a cost, ` +
            `factions have agendas, and the player's choice reshapes the EmberZone world-state.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Objective Graph ─────────────────────────────────────────────────────
    {
      archetype: 'graph',
      label: 'Objective Graph',
      view: { kind: 'graph', field: 'graph' },
      produce: () => ({
        data: {
          graph: {
            nodes: [
              { id: 'start',   label: 'Accept quest from Captain Vael (level ≥ 10)' },
              { id: 'gather',  label: 'Recover 3 Ember Cores from Stone Brute packs' },
              { id: 'return',  label: 'Return to Captain Vael — trigger ritual' },
              { id: 'choice',  label: 'Ritual choice: Forge Pact OR Refuse' },
              { id: 'pact',    label: 'Forge Pact — PACT_ACTIVE world state', terminal: true },
              { id: 'refuse',  label: 'Refuse Pact — PACT_REFUSED world state', terminal: true },
              { id: 'betray',  label: 'BETRAYED — Vael killed before Stage 2', terminal: true },
            ],
            edges: [
              { from: 'start',  to: 'gather' },
              { from: 'gather', to: 'return',  label: 'coresCollected == 3' },
              { from: 'return', to: 'choice' },
              { from: 'choice', to: 'pact',   label: 'Player selects FORGE_PACT' },
              { from: 'choice', to: 'refuse',  label: 'Player selects REFUSE' },
              { from: 'start',  to: 'betray',  label: 'Vael killed (any stage < return)' },
              { from: 'gather', to: 'betray',  label: 'Vael killed (any stage < return)' },
            ],
            note:
              'Two success terminals (pact / refuse) + one failure terminal (betray). ' +
              'All nodes reachable from start. Stage transitions fire Ability.Quest.EmberPact.* ' +
              'GameplayEvents consumed by UGameplayAbility_QuestAdvance.',
          },
        },
      }),
      accept: graphValid('graph', 'Objective graph is reachable + has a success and a fail terminal'),
    },

    // ── 3. Triggers & World-State ──────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Triggers & World-State',
      view: {
        kind: 'table',
        field: 'triggers',
        columns: [{ key: 'start' }, { key: 'fail' }, { key: 'worldMutation' }],
      },
      produce: () => ({
        data: {
          triggers: {
            start:
              'Player interacts with Captain Vael (char-captain-vael) AND ' +
              'player characterLevel ≥ 10 (UARPGAttributeSet.CharacterLevel gate). ' +
              'Fires GameplayEvent Ability.Quest.EmberPact.Start → ' +
              'UGameplayAbility_QuestAdvance activates quest component.',
            fail:
              'Player kills Captain Vael (char-captain-vael) before reaching the "return" node ' +
              '(stage < Stage3_Ritual). Fires GameplayEvent Ability.Quest.EmberPact.Betray → ' +
              'quest transitions to BETRAYED terminal; faction-ashen-order standing locked at -100.',
            worldMutation:
              'On PACT terminal: EmberZone faction-state tag set to State.Faction.EmberPact.Active ' +
              'via GE_WorldState_EmberPactActive (persisted to save via AARPGWorldStateComponent). ' +
              'On REFUSE terminal: State.Faction.EmberPact.Refused set; faction-ashen-order ' +
              'standing −50. On BETRAY: State.Faction.EmberPact.Betrayed; Vael respawn blocked.',
            conditions:
              'DA_EmberPact_Conditions DataAsset declares all gate values. ' +
              'Level gate (10) validates against UARPGAttributeSet.CharacterLevel (canon char-stat-source). ' +
              'Core-count (3) is a transient integer on AARPGQuestComponent — reset on quest abandon.',
          },
        },
        ueAssets: [`/Game/Quests/Conditions/DA_EmberPact_Conditions`],
      }),
      accept: fieldsPopulated('triggers', 'Start trigger, fail condition, and world mutation defined', [
        'start',
        'fail',
        'worldMutation',
      ]),
    },

    // ── 4. Rewards ─────────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Rewards',
      view: { kind: 'manifest', field: 'rewards' },
      produce: () => ({
        data: {
          // Array drives minCount acceptance; objects below carry ARPG-grade detail.
          rewards: ['pact-path', 'refuse-path'],
          rewardDetail: {
            pactPath: {
              lootTable: {
                catalogId: 'loot-tables',
                entityId: 'lt-Brute',
                role: 'completion-loot',
                note:
                  'Draws one guaranteed-Rare roll from the Stone Brute loot table (lt-Brute) ' +
                  'at ilvl = player characterLevel at time of completion. Per ARPG-LAWS §7: ' +
                  'ilvl is always the source level; the table never self-assigns ilvl.',
              },
              gold: {
                catalogId: 'currencies',
                entityId: 'currency-gold',
                role: 'gold-reward',
                amount: 350,
                note:
                  '350 gold — within the mid-game faucet band for a 3-stage quest. ' +
                  'Granted by GE_QuestReward_EmberPact_Gold (instant modifier on currency-gold attribute). ' +
                  'Per canon proj-economy: soft currency only; no premium currency grants from quests.',
              },
              factionRep: {
                catalogId: 'factions',
                entityId: 'faction-ashen-order',
                role: 'reputation-grant',
                delta: +75,
                note:
                  'faction-ashen-order repTier increments by +75 standing on PACT terminal. ' +
                  'Applied by GE_QuestReward_EmberPact_Rep (modifies UARPGAttributeSet.FactionRep ' +
                  'with a SetByCaller magnitude keyed to faction-ashen-order). Pending factions ' +
                  'catalog full pipeline — entity seeded as starter in new-catalogs.ts.',
              },
            },
            refusePath: {
              gold: {
                catalogId: 'currencies',
                entityId: 'currency-gold',
                role: 'gold-reward',
                amount: 200,
                note:
                  '200 gold for the REFUSE path — lower than PACT to preserve choice asymmetry. ' +
                  'Granted by GE_QuestReward_EmberPact_RefuseGold.',
              },
              lootTable: {
                catalogId: 'loot-tables',
                entityId: 'lt-EliteKnight',
                role: 'completion-loot',
                note:
                  'Refuse path draws from lt-EliteKnight (Hollow Knight loot table) — thematically ' +
                  'the player receives salvage from the Order\'s armory, not the ember chest. ' +
                  'Note: pending the factions-pipeline wiring — reward source swapped once a ' +
                  '"defector\'s cache" loot table is seeded.',
              },
            },
            wiringContract: {
              grantedBy:
                'GE_QuestReward_EmberPact_Gold / GE_QuestReward_EmberPact_Rep / ' +
                'GE_QuestReward_EmberPact_RefuseGold — GameplayEffects applied by ' +
                'UGameplayAbility_QuestAdvance on terminal-node activation.',
              activatedBy:
                'AARPGQuestComponent fires Ability.Quest.EmberPact.Complete (or .CompletedRefuse) → ' +
                'UGameplayAbility_QuestAdvance activates the corresponding reward GE batch.',
              dependencies: [
                'loot-tables (lt-Brute, lt-EliteKnight — seeded from DEFAULT_ENEMY_LOOT_BINDINGS)',
                'currencies (currency-gold — seeded in new-catalogs.ts)',
                'factions (faction-ashen-order — starter in new-catalogs.ts, pending full pipeline)',
              ],
              verification:
                'L2: GE_QuestReward_EmberPact_Gold + GE_QuestReward_EmberPact_Rep compiled + ' +
                'DA_EmberPact_Rewards seeded; ' +
                'L3: VSQuestFlowTest — pact path grants ≥350 gold + rep delta +75; ' +
                'refuse path grants ≥200 gold (deferred, PIE)',
            },
          },
        },
        links: [
          { catalogId: 'loot-tables', entityId: 'lt-Brute',       role: 'completion-loot-pact' },
          { catalogId: 'loot-tables', entityId: 'lt-EliteKnight',  role: 'completion-loot-refuse' },
          { catalogId: 'currencies',  entityId: 'currency-gold',   role: 'gold-reward' },
          { catalogId: 'factions',    entityId: 'faction-ashen-order', role: 'reputation-grant' },
        ],
        ueAssets: [`/Game/Quests/EmberPact/DA_EmberPact_Rewards`],
      }),
      accept: minCount('rewards', '≥1 reward path defined', 1),
    },

    // ── 5. NPC & Dialog Binding ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'NPC & Dialog Binding',
      view: { kind: 'manifest', field: 'npcs' },
      produce: () => ({
        data: {
          npcs: [
            'characters::char-captain-vael (quest giver; stage-1 trigger and stage-3 ritual host)',
            'characters::char-captain-vael (stage-3 antagonist role — same actor, different dialogue node)',
            'dialog-trees::dialog-gatekeeper (reused for the stage-1 accept node with EmberPact topic branch)',
          ],
          npcFlavor: {
            vaelRole:
              'Captain Vael (char-captain-vael) is the sole named NPC for this quest. ' +
              'His AARPGNPCActor facePlayerInDialogue=true; on stage-1 he plays the accept ' +
              'dialogue; on stage-3 he hosts the ritual choice node. If he dies before stage-3, ' +
              'the BETRAY terminal fires immediately via his OnDeath delegate.',
            dialogBinding:
              'dialog-gatekeeper is reused for the stage-1 accept conversation by adding an ' +
              '"EmberPact" topic branch to the existing Gatekeeper tree. Pending: a dedicated ' +
              'dt_ember_pact_choice tree for the stage-3 ritual will be authored once the dialog-trees ' +
              'pipeline seeded row is promoted (note: pending dialog-trees full pipeline).',
            pendingDialogTrees:
              'dt_ember_pact_intro and dt_ember_pact_choice are design-flavor names for future ' +
              'dedicated dialog tree rows. They are NOT in the resolvable links. Once seeded, ' +
              'they will replace the dialog-gatekeeper binding above.',
          },
          links: [
            { catalogId: 'characters',   entityId: 'char-captain-vael',  role: 'quest-giver' },
            { catalogId: 'dialog-trees', entityId: 'dialog-gatekeeper',  role: 'intro-dialog' },
          ],
          wiringContract: {
            grantedBy:
              'AARPGNPCActor (char-captain-vael) + UARPGDialogComponent bind the quest start. ' +
              'UARPGDialogComponent reads dialog-gatekeeper tree row from DT_DialogTrees.',
            activatedBy:
              'Player interacts with Vael → UARPGDialogComponent plays the accept node → ' +
              'fires GameplayEvent Ability.Quest.EmberPact.Start if level gate passes.',
            dependencies: [
              'characters (char-captain-vael — seeded in seed-characters.ts)',
              'dialog-trees (dialog-gatekeeper — starter in new-catalogs.ts)',
            ],
            verification:
              'L2: AARPGNPCActor BP for CaptainVael configured with dialogTree=dialog-gatekeeper + ' +
              'EmberPact topic branch present; ' +
              'L3: VSQuestFlowTest — dialog fires on interact, quest start event received (deferred, PIE)',
          },
        },
      }),
      accept: minCount('npcs', '≥1 NPC or dialog tree bound', 1),
    },

    // ── 6. Marker / Tracker UI ─────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Marker / Tracker UI',
      view: {
        kind: 'table',
        field: 'tracker',
        columns: [{ key: 'widget' }, { key: 'format' }, { key: 'anchor' }],
      },
      produce: () => ({
        data: {
          tracker: {
            widget: 'WBP_QuestTracker',
            format: '[Stage {n}/{total}] {objective}  ·  Cores: {coresCollected}/3',
            anchor: 'HUD top-right · minimap icon T_EmberPact_MapIcon (48×48, RGBA)',
          },
        },
        ueAssets: [`/Game/UI/HUD/WBP_QuestTracker`, `/Game/UI/Icons/T_EmberPact_MapIcon`],
      }),
      accept: fieldsPopulated('tracker', 'Widget, format, and anchor defined', ['widget', 'format', 'anchor']),
    },

    // ── 7. Journal / Lore ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Journal / Lore',
      view: { kind: 'prose', field: 'journal', emptyText: 'No journal entry yet' },
      produce: (e: LabEntity) => ({
        data: {
          journal:
            `${e.name}: The ember spirits speak in riddles of ash and sacrifice. ` +
            `The Ashen Order survived the Sundering by feeding the spirits their own blood — ` +
            `a compact renewed every generation in the ritual north of the Ashen Forest. ` +
            `Those who bind themselves inherit both power and its price: a flame that consumes ` +
            `from within, slowly, until nothing remains but cinders and conviction. ` +
            `Follow the trail of scorched stone north of the forest to discover what the spirits ` +
            `demand — and what the Order has been willing to pay. Whether the pact is forged or ` +
            `refused, the EmberZone remembers. The world-state shifts, and the Order will not ` +
            `forget who chose which side of the altar.`,
        },
      }),
      accept: minLength('journal', 'Journal entry ≥ 200 characters', 200),
    },

    // ── 8. Icon 2D Art ─────────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`],
      }),
      accept: selected('selected', 'A quest icon is selected'),
    },

    // ── 9. Localization ────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Localization',
      view: { kind: 'checklist', field: 'keys' },
      produce: (e: LabEntity) => ({
        data: {
          keys: [
            `QUEST_${slug(e.name).toUpperCase()}_TITLE`,
            `QUEST_${slug(e.name).toUpperCase()}_BRIEF`,
            `QUEST_${slug(e.name).toUpperCase()}_STAGE1`,
            `QUEST_${slug(e.name).toUpperCase()}_STAGE2`,
            `QUEST_${slug(e.name).toUpperCase()}_JOURNAL`,
          ],
        },
      }),
      accept: minCount('keys', '≥1 localization key extracted', 1),
    },

    // ── 10. Test Gate ──────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'quest starts on Vael interact + level ≥ 10 gate',
            'BETRAY terminal fires when Vael killed before stage-3',
            'stage-2 core-count increments to 3 before allowing stage-3 transition',
            'PACT path: 350 gold + rep +75 granted, PACT_ACTIVE world-state tag applied',
            'REFUSE path: 200 gold granted, PACT_REFUSED world-state tag applied',
            'lt-Brute loot draw resolves at player characterLevel as ilvl',
          ],
        },
      }),
      accept: runtimeDeferred('VSQuestFlowTest', 'Quest completes stage→reward in PIE'),
    },

    // ── 11. UE Packaging ───────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `DT_QuestStages_${s}`,
          `DA_${s}_Conditions`,
          `DA_${s}_Rewards`,
          `WBP_QuestTracker`,
          `T_${s}_Icon`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'AARPGQuestComponent (on the player character) reads FARPGQuestStageRow from ' +
                `DT_QuestStages_${s} keyed by quest id (quest-ember-pact). ` +
                'DA_EmberPact_Conditions declares level/core-count gates. ' +
                'DA_EmberPact_Rewards declares GE handles for each terminal path.',
              activatedBy:
                'Stage transitions: GameplayEvent Ability.Quest.EmberPact.{Start|CoreCollected|' +
                'Complete|CompletedRefuse|Betray} → UGameplayAbility_QuestAdvance reads ' +
                `DT_QuestStages_${s} row, advances stage, applies reward GEs on terminal.`,
              dependencies: [
                'characters (char-captain-vael — quest-giver NPC actor)',
                'dialog-trees (dialog-gatekeeper — stage-1 accept dialogue)',
                'loot-tables (lt-Brute for PACT path, lt-EliteKnight for REFUSE path)',
                'currencies (currency-gold — reward faucet)',
                'factions (faction-ashen-order — rep delta)',
              ],
              verification:
                `L2: FARPGQuestStageRow in Source/PoF/ + DT_QuestStages_${s} seeded via ` +
                'seed_quests.py + AARPGQuestComponent.cpp compiled; ' +
                'L3: VSQuestFlowTest in PIE — all three terminal paths reached, rewards granted, ' +
                'world-state tags applied (deferred)',
            },
          },
          ueAssets: assets.map((a) => `/Game/Quests/${s}/${a}`),
        };
      },
      accept: minCount('assets', 'All quest assets packaged', 3),
    },
  ],
});
