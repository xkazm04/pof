import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { graphValid } from '../acceptance/graphCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'quests',
  steps: [
    {
      archetype: 'brief', label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({ data: { brief: `${e.name} is a multi-stage quest in PoF. The player forges a pact with the Ember Court, uncovering the cost of power. `.repeat(4) } }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'graph', label: 'Objective Graph',
      view: { kind: 'graph', field: 'graph' },
      produce: () => ({ data: { graph: {
        nodes: [
          { id: 'start', label: 'Accept' },
          { id: 'gather', label: 'Gather embers' },
          { id: 'choice', label: 'Choose' },
          { id: 'done', label: 'Resolve', terminal: true },
          { id: 'failed', label: 'Failed', terminal: true },
        ],
        edges: [ { from: 'start', to: 'gather' }, { from: 'gather', to: 'choice' }, { from: 'choice', to: 'done' }, { from: 'choice', to: 'failed' } ],
      } } }),
      accept: graphValid('graph', 'Objective graph is reachable + has a terminal'),
    },
    {
      archetype: 'rules', label: 'Triggers & World-State',
      view: { kind: 'table', field: 'triggers', columns: [{ key: 'start' }, { key: 'fail' }, { key: 'worldMutation' }] },
      produce: () => ({
        data: {
          triggers: {
            start: 'Player talks to NPC_EmberKeeper + level ≥ 10',
            fail: 'Player kills EmberKeeper before stage-2',
            worldMutation: 'EmberZone faction-state set to PACT_ACTIVE on completion',
          },
        },
        ueAssets: [`/Game/Quests/Conditions/DA_EmberPact_Conditions`],
      }),
      accept: fieldsPopulated('triggers', 'Start trigger, fail condition, and world mutation defined', ['start', 'fail', 'worldMutation']),
    },
    {
      archetype: 'rules', label: 'Rewards',
      view: { kind: 'manifest', field: 'rewards' },
      produce: () => ({
        data: {
          rewards: ['loot', 'gold', 'rep'],
        },
        links: [
          { catalogId: 'loot-tables', entityId: 'lt_ember_pact_chest', role: 'completion-loot' },
          { catalogId: 'currencies', entityId: 'currency-gold', role: 'gold-reward' },
          { catalogId: 'factions', entityId: 'faction-ember-court', role: 'reputation-grant' },
        ],
        ueAssets: [`/Game/Quests/EmberPact/DA_EmberPact_Rewards`],
      }),
      accept: minCount('rewards', '≥1 reward linked', 1),
    },
    {
      archetype: 'rules', label: 'NPC & Dialog Binding',
      view: { kind: 'manifest', field: 'npcs' },
      produce: () => ({
        data: {
          npcs: [
            'characters::npc-ember-keeper (quest giver)',
            'characters::npc-ash-herald (stage-3 antagonist)',
            'dialog-trees::dt_ember_pact_intro',
            'dialog-trees::dt_ember_pact_choice',
          ],
          links: [
            { catalogId: 'characters', entityId: 'npc-ember-keeper', role: 'quest-giver' },
            { catalogId: 'characters', entityId: 'npc-ash-herald', role: 'antagonist' },
            { catalogId: 'dialog-trees', entityId: 'dt_ember_pact_intro', role: 'intro-dialog' },
            { catalogId: 'dialog-trees', entityId: 'dt_ember_pact_choice', role: 'choice-dialog' },
          ],
        },
      }),
      accept: minCount('npcs', '≥1 NPC or dialog tree bound', 1),
    },
    {
      archetype: 'rules', label: 'Marker / Tracker UI',
      view: { kind: 'table', field: 'tracker', columns: [{ key: 'widget' }, { key: 'format' }, { key: 'anchor' }] },
      produce: () => ({
        data: {
          tracker: {
            widget: 'WBP_QuestTracker',
            format: '[Stage {n}/{total}] {objective}',
            anchor: 'HUD top-right · minimap icon T_EmberPact_MapIcon',
          },
        },
        ueAssets: [`/Game/UI/HUD/WBP_QuestTracker`, `/Game/UI/Icons/T_EmberPact_MapIcon`],
      }),
      accept: fieldsPopulated('tracker', 'Widget, format, and anchor defined', ['widget', 'format', 'anchor']),
    },
    {
      archetype: 'brief', label: 'Journal / Lore',
      view: { kind: 'prose', field: 'journal', emptyText: 'No journal entry yet' },
      produce: (e: LabEntity) => ({
        data: {
          journal: `${e.name}: The ember spirits speak in riddles of ash and sacrifice. Those who bind themselves to the Ember Court inherit both power and its price — a flame that consumes from within. Follow the trail of cinders north of the Ashen Forest to discover what the spirits demand. `.repeat(2),
        },
      }),
      accept: minLength('journal', 'Journal entry ≥ 200 characters', 200),
    },
    {
      archetype: 'gallery', label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`],
      }),
      accept: selected('selected', 'A quest icon is selected'),
    },
    {
      archetype: 'checklist', label: 'Localization',
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
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'quest starts on trigger',
            'stage-2 choice branches correctly',
            'completion grants rewards (loot + gold + rep)',
            'failed state reached via kill condition',
          ],
        },
      }),
      accept: runtimeDeferred('VSQuestFlowTest', 'Quest completes stage→reward in PIE'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
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
          data: { assets },
          ueAssets: assets.map((a) => `/Game/Quests/${s}/${a}`),
        };
      },
      accept: minCount('assets', 'All quest assets packaged', 3),
    },
  ],
});
