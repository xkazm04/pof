import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { graphValid } from '../acceptance/graphCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Dialog Trees pipeline (catalogId: 'dialog-trees').
 *
 * Represents a branching NPC conversation authored as a node/edge graph with
 * conditions (flag checks, stat gates), effects (quest advance, world-state
 * mutation), voice-over hooks, camera framing, subtitle/choice UI, and
 * localization keys.  Each dialog tree is a DT_DialogTree DataTable row read
 * by UARPGDialogComponent on the NPC actor.
 *
 * Target entity: "Gatekeeper Greeting" (dialog-gatekeeper) — a gate-NPC
 * opening conversation for Captain Vael.  The player can greet, threaten, or
 * attempt a Persuasion skill-check (Intelligence ≥ 14) that unlocks the Ember Pact
 * quest branch.  A HOSTILE terminal is reachable if the player threatens
 * without the skill gate passing.
 *
 * Wiring: the NPC's AARPGNPCActor holds a UARPGDialogComponent; on player
 * interact it loads the tree row keyed by entity id from DT_DialogTrees and
 * evaluates node conditions against UARPGAttributeSet + Quest/World-state
 * gameplay tags.  Effects fire GameplayEvents that drive AARPGQuestComponent
 * stage advances and world-state tag mutations.  Branches are authored here
 * (app → UE via seed_dialog_trees.py); the app validates, never re-authors
 * UE dialog engine schema (canon proj-sot).
 *
 * Top-level cross-catalog links:
 *   characters::char-captain-vael  — the speaker NPC (role: 'host')
 *   quests::quest-ember-pact       — the quest this dialog can advance (role: 'advances')
 *   icon-sets::iconset-abilities   — source for the dialog icon art (role: 'icon-source')
 */
registerCatalogPipeline({
  catalogId: 'dialog-trees',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is the opening conversation with Captain Vael at the gate of the Ashen Order ` +
            `outpost north of the Ashen Forest.  It is the player's first point of contact with the ` +
            `faction and the on-ramp to quest-ember-pact.  The tree establishes Vael's voice: ` +
            `weathered, precise, and suspicious — a soldier who has survived the post-Sundering world ` +
            `by trusting no one who cannot prove their worth.  ` +
            `Three opening branches reflect the player's approach — a civil Greeting (default, always ` +
            `available), an aggressive Threaten (opens a HOSTILE terminal without the skill gate), and ` +
            `a Persuasion check (Intelligence attribute ≥ 14 via UARPGAttributeSet) that unlocks the ` +
            `EmberPact topic and fires Ability.Quest.EmberPact.Start.  The tree is reused by ` +
            `quests::quest-ember-pact (stage-1 accept dialogue) via the EmberPact topic branch. ` +
            `Tone: terse, guarded, earned — no friendly exposition.  Power is demonstrated, not ` +
            `announced.  Inline VO direction per node (line length ≤ 10 words, no filler).`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Branch Graph ────────────────────────────────────────────────────────
    // KEY STEP — archetype: 'graph', view: graph, accept: graphValid
    // Node/edge graph of the Gatekeeper Greeting dialog tree.
    // Nodes: greeting (root) → ask / threaten / skill-check → outcomes → terminals.
    // graphValid enforces: no dangling edges, all nodes reachable from [0], ≥1 terminal node.
    {
      archetype: 'graph',
      label: 'Branch Graph',
      view: { kind: 'graph', field: 'graph' },
      produce: () => ({
        data: {
          graph: {
            nodes: [
              // ── Root ────────────────────────────────────────────────────────
              {
                id: 'greeting',
                label: 'Vael: "State your business or leave." [root]',
              },
              // ── Player choices ──────────────────────────────────────────────
              {
                id: 'ask',
                label: 'Player: "I\'m here to learn about the Order."',
              },
              {
                id: 'threaten',
                label: 'Player: "Step aside or I\'ll make you." [aggressive]',
              },
              {
                id: 'skill_check',
                label: 'Player: "I know about the Ember Pact." [Intelligence ≥ 14 gate]',
              },
              // ── Outcomes ────────────────────────────────────────────────────
              {
                id: 'ask_response',
                label: 'Vael: "The Order doesn\'t recruit.  Come back stronger." [dismissal]',
              },
              {
                id: 'threaten_warn',
                label: 'Vael draws blade: "Last warning." [escalation]',
              },
              {
                id: 'skill_pass',
                label: 'Vael: "You\'ve done your homework.  Follow." [EmberPact branch unlocked]',
              },
              {
                id: 'skill_fail',
                label: 'Vael: "Words without proof.  Go." [insufficient Intelligence]',
              },
              // ── Terminals ───────────────────────────────────────────────────
              {
                id: 'dismissed',
                label: 'DISMISSED — dialog ends; no quest advance; player may return',
                terminal: true,
              },
              {
                id: 'hostile',
                label: 'HOSTILE — Vael turns hostile; faction-ashen-order standing −30',
                terminal: true,
              },
              {
                id: 'ember_pact_unlocked',
                label: 'EMBER_PACT_UNLOCKED — fires Ability.Quest.EmberPact.Start; quest advances to stage 1',
                terminal: true,
              },
            ],
            edges: [
              // From root player can ask, threaten, or attempt skill-check
              { from: 'greeting',     to: 'ask',           label: 'Player selects ASK' },
              { from: 'greeting',     to: 'threaten',      label: 'Player selects THREATEN' },
              { from: 'greeting',     to: 'skill_check',   label: 'Player selects PERSUADE (always visible)' },

              // Ask path → dismissal terminal
              { from: 'ask',          to: 'ask_response' },
              { from: 'ask_response', to: 'dismissed',     label: 'Dialog ends — no condition met' },

              // Threaten path → hostile terminal (no skill gate required)
              { from: 'threaten',     to: 'threaten_warn' },
              { from: 'threaten_warn', to: 'hostile',      label: 'Player confirms or Vael triggers combat' },

              // Skill-check path: pass (Intelligence ≥ 14) → ember pact terminal
              { from: 'skill_check',  to: 'skill_pass',   label: 'condition: Intelligence ≥ 14' },
              { from: 'skill_check',  to: 'skill_fail',   label: 'condition: Intelligence < 14' },
              { from: 'skill_pass',   to: 'ember_pact_unlocked' },
              { from: 'skill_fail',   to: 'dismissed',    label: 'Vael dismisses player; try again at higher Intelligence' },
            ],
            note:
              'Three terminals: DISMISSED (neutral, reachable via ask + skill-fail), ' +
              'HOSTILE (reachable via threaten), EMBER_PACT_UNLOCKED (success, Intelligence ≥ 14). ' +
              'graphValid: 11 nodes, 11 edges, all reachable from greeting[0]. ' +
              'Wiring: UARPGDialogComponent evaluates node conditions against UARPGAttributeSet.Intelligence; ' +
              'EMBER_PACT_UNLOCKED fires GameplayEvent Ability.Quest.EmberPact.Start → AARPGQuestComponent ' +
              'advances quest-ember-pact to stage 1.',
          },
          wiringContract: {
            grantedBy:
              'UARPGDialogComponent on char-captain-vael reads the DT_DialogTrees row keyed ' +
              '"dialog-gatekeeper".  Node conditions are FARPGDialogCondition structs evaluated ' +
              'against UARPGAttributeSet (Intelligence attribute) and gameplay tags.',
            activatedBy:
              'Player interact with Vael\'s collision capsule → UARPGDialogComponent.OpenTree("dialog-gatekeeper") → ' +
              'renders the root node and evaluates edge conditions each step.',
            dependencies: [
              'characters (char-captain-vael — the host NPC actor)',
              'quests (quest-ember-pact — stage 1 triggered on EMBER_PACT_UNLOCKED terminal)',
            ],
            verification:
              'L2: FARPGDialogTreeRow in Source/PoF/ + DT_DialogTrees seeded via seed_dialog_trees.py + ' +
              'UARPGDialogComponent.cpp compiled; ' +
              'L3: VSDialogBranchTest — all 3 terminals reachable, Intelligence gate enforced, quest event fires (deferred)',
          },
        },
        links: [
          { catalogId: 'characters', entityId: 'char-captain-vael', role: 'host' },
          { catalogId: 'quests',     entityId: 'quest-ember-pact',  role: 'advances' },
        ],
      }),
      accept: graphValid('graph', 'Dialog branches reachable + have terminals'),
    },

    // ── 3. Conditions & Effects ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Conditions & Effects',
      view: {
        kind: 'table',
        field: 'conditionsEffects',
        columns: [{ key: 'node' }, { key: 'condition' }, { key: 'effect' }],
      },
      produce: () => ({
        data: {
          conditionsEffects: {
            // Per-node conditions and effects for the three non-trivial nodes
            skillCheck: {
              node: 'skill_check',
              condition:
                'UARPGAttributeSet.Intelligence ≥ 14  →  edge to skill_pass; ' +
                'UARPGAttributeSet.Intelligence < 14  →  edge to skill_fail. ' +
                'Evaluated by FARPGDialogCondition{stat:"Intelligence", op:"gte", value:14}.',
              effect:
                'No direct effect on condition check; effect fires on terminal resolution (see EMBER_PACT_UNLOCKED).',
            },
            emberPactUnlocked: {
              node: 'ember_pact_unlocked',
              condition: 'Always reached when skill_pass exits (no further gate).',
              effect:
                'Fires GameplayEvent Ability.Quest.EmberPact.Start on the player character. ' +
                'UGameplayAbility_QuestAdvance receives the event and activates quest-ember-pact stage 1. ' +
                'World-state tag State.Dialog.EmberPactIntroPlayed applied via ' +
                'GE_WorldState_EmberPactIntroPlayed (prevents re-triggering the quest start branch).',
            },
            hostile: {
              node: 'hostile',
              condition: 'Reached only if threaten_warn exit is selected (player confirms threat or auto-triggers).',
              effect:
                'UARPGDialogComponent fires GameplayEvent Ability.Faction.AshenOrder.HostileTriggered. ' +
                'faction-ashen-order standing delta −30 applied via GE_FactionDelta_AshenOrder (SetByCaller −30). ' +
                'Vael\'s AARPGNPCActor hostility flag set to true (persisted to AARPGWorldStateComponent).',
            },
            dismissed: {
              node: 'dismissed',
              condition: 'Reached via ask_response or skill_fail.',
              effect:
                'No gameplay effect; UARPGDialogComponent closes the widget and restores input. ' +
                'State.Dialog.EmberPactIntroPlayed NOT set — player may retry on re-interact if Intelligence is raised.',
            },
          },
          wiringContract: {
            grantedBy:
              'FARPGDialogCondition structs in DT_DialogTrees row + GE_WorldState_EmberPactIntroPlayed + ' +
              'GE_FactionDelta_AshenOrder — authored in DA_GatekeeperGreeting_Effects DataAsset.',
            activatedBy:
              'Terminal node reached during UARPGDialogComponent playback → ' +
              'fires mapped GameplayEvent or applies listed GEs.',
            dependencies: [
              'characters (char-captain-vael — hostility flag)',
              'quests (quest-ember-pact — stage advance)',
              'factions (faction-ashen-order — rep delta)',
            ],
            verification:
              'L2: DA_GatekeeperGreeting_Effects seeded; FARPGDialogCondition struct present; ' +
              'GE_WorldState_EmberPactIntroPlayed + GE_FactionDelta_AshenOrder compiled; ' +
              'L3: VSDialogBranchTest — conditions evaluated correctly per terminal path (deferred)',
          },
        },
        ueAssets: ['/Game/Dialog/DA_GatekeeperGreeting_Effects'],
      }),
      accept: fieldsPopulated('conditionsEffects', 'skill-check, ember-pact, hostile, dismissed nodes defined', [
        'skillCheck',
        'emberPactUnlocked',
        'hostile',
        'dismissed',
      ]),
    },

    // ── 4. Skill Checks ───────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Skill Checks',
      view: {
        kind: 'table',
        field: 'skillChecks',
        columns: [{ key: 'attribute' }, { key: 'threshold' }, { key: 'passEdge' }, { key: 'failEdge' }],
      },
      produce: () => ({
        data: {
          skillChecks: [
            {
              node: 'skill_check',
              attribute: 'Intelligence',
              ueAttribute: 'UARPGAttributeSet.Intelligence',
              threshold: 14,
              thresholdOp: 'gte',
              passEdge: 'skill_check → skill_pass',
              failEdge: 'skill_check → skill_fail',
              note:
                'Intelligence is the speech/magic attribute (ARPG-LAWS §9). ' +
                'Base Intelligence starts at 8 for a new character; +1 per 4 Int points allocated; ' +
                'reaches 14 around character level 25–30 on an Int-focused build. ' +
                'Gate level is intentionally noteworthy — reachable mid-game on a dedicated build, ' +
                'not a day-one trivial pass. ' +
                'Threshold value stored in DA_GatekeeperGreeting_Effects.intelligenceGate = 14; ' +
                'FARPGDialogCondition reads it — never hardcoded.',
              balanceNote:
                'Intelligence ≥ 14 is the only skill gate in this tree.  No Strength or Dexterity checks — ' +
                'consistent with a diplomatic/knowledge encounter rather than a combat/agility challenge.',
            },
          ],
          wiringContract: {
            grantedBy:
              'FARPGDialogCondition{stat:"Intelligence", op:"gte", value:14} embedded in the DT_DialogTrees row ' +
              'for the skill_check→skill_pass edge.',
            activatedBy:
              'UARPGDialogComponent evaluates the condition when the player selects the PERSUADE option ' +
              '(skill_check node is rendered).',
            dependencies: [
              'characters (UARPGAttributeSet.Intelligence — validated against char-captain-vael stat row)',
            ],
            verification:
              'L2: UARPGAttributeSet declares Intelligence attribute; DA_GatekeeperGreeting_Effects.intelligenceGate = 14; ' +
              'L3: VSDialogBranchTest — Intelligence 13 routes to dismissed; Intelligence 14 routes to ember_pact_unlocked (deferred)',
          },
        },
        ueAssets: ['/Game/Dialog/DA_GatekeeperGreeting_Effects'],
      }),
      accept: minCount('skillChecks', '≥1 skill-check rule defined', 1),
    },

    // ── 5. VO Script ──────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'VO Script',
      view: { kind: 'checklist', field: 'voLines' },
      produce: (e: LabEntity) => ({
        data: {
          voLines: [
            `DIALOG_${slug(e.name).toUpperCase()}_VAEL_ROOT: "State your business or leave."`,
            `DIALOG_${slug(e.name).toUpperCase()}_PLAYER_ASK: "I\'m here to learn about the Order."`,
            `DIALOG_${slug(e.name).toUpperCase()}_PLAYER_THREATEN: "Step aside or I\'ll make you."`,
            `DIALOG_${slug(e.name).toUpperCase()}_PLAYER_PERSUADE: "I know about the Ember Pact."`,
            `DIALOG_${slug(e.name).toUpperCase()}_VAEL_ASK_RESP: "The Order doesn\'t recruit. Come back stronger."`,
            `DIALOG_${slug(e.name).toUpperCase()}_VAEL_THREATEN_WARN: "Last warning."`,
            `DIALOG_${slug(e.name).toUpperCase()}_VAEL_SKILL_PASS: "You\'ve done your homework. Follow."`,
            `DIALOG_${slug(e.name).toUpperCase()}_VAEL_SKILL_FAIL: "Words without proof. Go."`,
          ],
          voDirection: {
            vaelTone:
              'Vael: flat, measured, military — no warmth.  Short sentences, clipped ends.  ' +
              'No rising inflection — every line is a statement, never a question.  ' +
              'Slight gravel in the voice (weathered, 40s).  References: Geralt of Rivia (calm), ' +
              'Sergeant-style authority.',
            playerTone:
              'Player lines are placeholders; actual VO direction delegated to character class selection.',
            maxLineLength: 10,
            maxLineLengthNote:
              'Per plan.md: ≤10 words per VO line.  Longer descriptions are stage directions, not spoken.',
          },
        },
        ueAssets: [
          `/Game/Audio/VO/Dialog/SC_${slug(e.name)}_VaelRoot`,
          `/Game/Audio/VO/Dialog/SC_${slug(e.name)}_VaelAskResp`,
          `/Game/Audio/VO/Dialog/SC_${slug(e.name)}_VaelThreatWarn`,
          `/Game/Audio/VO/Dialog/SC_${slug(e.name)}_VaelSkillPass`,
          `/Game/Audio/VO/Dialog/SC_${slug(e.name)}_VaelSkillFail`,
        ],
      }),
      accept: minCount('voLines', '≥1 VO line script entry present', 1),
    },

    // ── 6. Camera ─────────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Camera',
      view: {
        kind: 'table',
        field: 'camera',
        columns: [{ key: 'phase' }, { key: 'shot' }, { key: 'anchor' }],
      },
      produce: () => ({
        data: {
          camera: {
            opening: {
              phase: 'opening',
              shot: 'Medium two-shot: player left, Vael right, 3/4 angle.  Depth of field: Vael in focus.',
              anchor:
                'Cinematic camera activated via ACineCameraActor_Dialog spawned at the NPC interact point. ' +
                'Position offset: 200 cm behind player, 180 cm height, yaw −30° toward Vael.',
              blend: '0.4 s ease-in-out blend from gameplay camera on dialog open.',
            },
            vaelSpeaking: {
              phase: 'vael_speaking',
              shot: 'Close-up on Vael face (bust shot, slight Dutch angle −5°) when Vael delivers a line.',
              anchor: 'Bone socket: Vael head bone + 20 cm Y offset.  FOV 50°.',
              blend: '0.25 s cut on line start.',
            },
            playerChoice: {
              phase: 'player_choice',
              shot: 'Pull back to two-shot for player choice display; choices overlay top-right.',
              anchor: 'Midpoint between player and Vael, height 160 cm.  FOV 65°.',
              blend: '0.2 s ease-out.',
            },
            close: {
              phase: 'close',
              shot: 'Blend back to gameplay camera over 0.5 s on terminal node reached.',
              anchor: 'Restore original gameplay camera transform.',
              blend: '0.5 s ease-in.',
            },
            hudBinding: {
              widget: 'WBP_DialogCamera',
              format: '[{phase}] {shot}',
              anchor: 'Managed by UARPGDialogComponent — never hard-coded placement (canon proj-hud-binding).',
            },
          },
        },
        ueAssets: ['/Game/Cinematics/Dialog/BP_DialogCameraRig_GatekeeperGreeting'],
      }),
      accept: fieldsPopulated('camera', 'opening / vael-speaking / player-choice / close phases defined', [
        'opening',
        'vaelSpeaking',
        'playerChoice',
        'close',
      ]),
    },

    // ── 7. Subtitles & Choices UI ─────────────────────────────────────────────
    // Wiring contract: canon proj-hud-binding
    {
      archetype: 'rules',
      label: 'Subtitles & Choices UI',
      view: {
        kind: 'table',
        field: 'subtitleUI',
        columns: [{ key: 'widget' }, { key: 'format' }, { key: 'anchor' }],
      },
      produce: () => ({
        data: {
          subtitleUI: {
            subtitleWidget: 'WBP_DialogSubtitle',
            subtitleFormat: '[{speakerName}]: {line}',
            subtitleAnchor:
              'HUD bottom-center, 80% screen width, 3 lines max visible.  ' +
              'Font: 18 pt, white, background 40% black panel.  ' +
              'Bound to hud-elements presentation entry hud-dialog-subtitle (canon proj-hud-binding).',
            choiceWidget: 'WBP_DialogChoiceList',
            choiceFormat: '[{choiceIndex}] {choiceText}  [{conditionHint}]',
            choiceAnchor:
              'HUD top-right, 30% screen width, stacked list, max 4 choices visible.  ' +
              'Locked choices shown greyed-out with condition hint (e.g. "Intelligence ≥ 14"). ' +
              'Bound to hud-dialog-choices presentation entry.',
            accessibilityNote:
              'Choice highlight uses shape + color (not color alone).  ' +
              'Subtitle text scales with global font-size setting.  ' +
              'AA contrast minimum on dark HUD background (canon art-icon-a11y).',
          },
          wiringContract: {
            grantedBy:
              'WBP_DialogSubtitle + WBP_DialogChoiceList owned by UARPGDialogComponent.  ' +
              'Widget class references set in ProjectSettings → ARPG → DialogWidgetClass.',
            activatedBy:
              'UARPGDialogComponent.OpenTree() creates and adds the widgets to the HUD viewport; ' +
              'destroyed on terminal node reached.',
            dependencies: ['hud-elements (hud-dialog-subtitle, hud-dialog-choices — presentation binding)'],
            verification:
              'L2: WBP_DialogSubtitle + WBP_DialogChoiceList present in /Game/UI/Dialog/; ' +
              'L3: VSDialogBranchTest — subtitle displays Vael root line, choices render all 3 options (deferred)',
          },
        },
      }),
      accept: fieldsPopulated('subtitleUI', 'subtitle widget / choice widget / anchors defined', [
        'subtitleWidget',
        'choiceWidget',
        'subtitleAnchor',
        'choiceAnchor',
      ]),
    },

    // ── 8. Localization ───────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Localization',
      view: { kind: 'checklist', field: 'locKeys' },
      produce: (e: LabEntity) => ({
        data: {
          locKeys: [
            `DIALOG_${slug(e.name).toUpperCase()}_SPEAKER_VAEL`,
            `DIALOG_${slug(e.name).toUpperCase()}_ROOT`,
            `DIALOG_${slug(e.name).toUpperCase()}_CHOICE_ASK`,
            `DIALOG_${slug(e.name).toUpperCase()}_CHOICE_THREATEN`,
            `DIALOG_${slug(e.name).toUpperCase()}_CHOICE_PERSUADE`,
            `DIALOG_${slug(e.name).toUpperCase()}_CHOICE_PERSUADE_LOCKED_HINT`,
            `DIALOG_${slug(e.name).toUpperCase()}_ASK_RESP`,
            `DIALOG_${slug(e.name).toUpperCase()}_THREATEN_WARN`,
            `DIALOG_${slug(e.name).toUpperCase()}_SKILL_PASS`,
            `DIALOG_${slug(e.name).toUpperCase()}_SKILL_FAIL`,
          ],
          locNotes:
            'All keys follow the DIALOG_<TREE>_<SPEAKER>_<LINE> convention and are authored in ' +
            'Content/Localization/Dialog/GatekeeperGreeting.csv.  ' +
            'Non-English strings must maintain ≤10-word cap on Vael lines (VO timing constraint). ' +
            'Condition hint strings (LOCKED_HINT) require a {statName} + {threshold} token pair.',
        },
      }),
      accept: minCount('locKeys', '≥1 localization key defined', 1),
    },

    // ── 9. Accessibility ──────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Accessibility',
      view: { kind: 'checklist', field: 'a11yChecks' },
      produce: () => ({
        data: {
          a11yChecks: [
            'Subtitle font scales with global font-size setting (scales 14–24 pt)',
            'Choices distinguished by shape + index number, not color alone (colorblind-safe)',
            'AA contrast on all subtitle and choice text against dark HUD background',
            'Skill-check locked choices show condition hint (e.g. "Intelligence ≥ 14") not a blank disable',
            'Dialog can be paused / advanced by controller or keyboard (no mouse-only flow)',
            'No timed choices — dialog waits for player input indefinitely',
            'VO caption includes speaker name so deaf players identify the speaker',
          ],
        },
      }),
      accept: minCount('a11yChecks', '≥1 accessibility check listed', 1),
    },

    // ── 10. Icon 2D Art ───────────────────────────────────────────────────────
    // Universal Icon step — every row includes this.
    // Linked conceptually to icon-sets::iconset-abilities (the shared ability/character icon family).
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-source' },
        ],
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_DialogIcon`],
      }),
      accept: selected('selected', 'A dialog icon is selected'),
    },

    // ── 11. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'dialog opens on player interact with Vael',
            'root node presents all 3 choices (ask / threaten / persuade)',
            'persuade with Intelligence < 14 → dismissed terminal (no quest advance)',
            'persuade with Intelligence ≥ 14 → ember_pact_unlocked terminal (quest-ember-pact stage 1 fires)',
            'threaten → hostile terminal (faction standing −30 applied)',
            'HOSTILE terminal: Vael turns hostile; does not offer dialog again',
            'DISMISSED terminal: dialog closes, player may re-interact to retry',
            'State.Dialog.EmberPactIntroPlayed tag applied after ember_pact_unlocked (no re-trigger)',
            'subtitle displays speaker name + line text on each Vael line',
            'all 11 nodes reachable from greeting in automated branch-coverage walk',
          ],
        },
      }),
      accept: runtimeDeferred('VSDialogBranchTest', 'All branches reachable + skill-check gates resolve in PIE'),
    },

    // ── 12. UE Packaging ──────────────────────────────────────────────────────
    // Wiring contract per arpg-wiring-contract canon.
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `DT_DialogTrees :: ${s}`,
          `DA_${s}_Effects`,
          `BP_DialogCameraRig_${s}`,
          `WBP_DialogSubtitle`,
          `WBP_DialogChoiceList`,
          `T_${s}_DialogIcon`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                `UARPGDialogComponent on char-captain-vael reads FARPGDialogTreeRow from ` +
                `DT_DialogTrees keyed by entity id ("${e.id}"). ` +
                `DA_${s}_Effects declares all node conditions (FARPGDialogCondition[]) + ` +
                `effect GameplayEvent references.  ` +
                `BP_DialogCameraRig_${s} is spawned at dialog open and destroyed on terminal.`,
              activatedBy:
                `Player interact collision on char-captain-vael → ` +
                `UARPGDialogComponent.OpenTree("${e.id}") → node-by-node evaluation loop → ` +
                `on terminal: fires listed GameplayEvents, applies listed GEs, closes widgets.`,
              dependencies: [
                'characters (char-captain-vael — host NPC; AARPGNPCActor with UARPGDialogComponent)',
                'quests (quest-ember-pact — stage-1 advance on EMBER_PACT_UNLOCKED terminal)',
                'factions (faction-ashen-order — rep delta −30 on HOSTILE terminal)',
                'icon-sets (iconset-abilities — source icon family)',
              ],
              verification:
                `L2: FARPGDialogTreeRow declared in Source/PoF/ + DT_DialogTrees seeded via ` +
                `seed_dialog_trees.py + UARPGDialogComponent.cpp compiled; ` +
                `DA_${s}_Effects seeded; WBP_DialogSubtitle + WBP_DialogChoiceList in /Game/UI/Dialog/; ` +
                `L3: VSDialogBranchTest — all 3 terminal paths reached in PIE, conditions enforced, ` +
                `GameplayEvents fired, faction delta applied (deferred)`,
            },
          },
          ueAssets: assets.map((a) => `/Game/Dialog/${s}/${a}`),
        };
      },
      accept: minCount('assets', '≥3 UE dialog assets packaged', 3),
    },
  ],
});
