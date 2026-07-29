import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  TaskFactory,
  buildTaskPrompt,
  UNKNOWN_TASK_TYPE_MARKER,
  UNKNOWN_TASK_TYPE_NOTE,
  type CLITask,
  type CLITaskType,
} from '@/lib/cli-task';
import { taskPromptHandlers } from '@/lib/cli-task-handlers';
import type { ProjectContext } from '@/lib/prompt-context';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { FeatureDefinition } from '@/lib/feature-definitions';
import type { EditorEffect, TagRule } from '@/lib/ability/spec';
import type { AbilityRef } from '@/lib/ability/logic-prompts';
import type { TestSuite } from '@/types/ai-testing';
import { logger } from '@/lib/logger';
import { expectGolden } from './golden';
import { STANDALONE_BUILDERS } from './builder-fixtures';

/**
 * The golden rail — byte-level regression armour for EVERY composed prompt.
 *
 * Coverage: all 18 `CLITaskType`s (a coverage guard fails if a type is added
 * without a pin) plus every standalone builder in `src/lib/prompts/`. Goldens
 * live as reviewable `.md` files under `__golden__/`; a mismatch names the
 * drifted markdown SECTION before showing the line diff (see `golden.ts`).
 *
 * Re-record an intentional change with:
 *   POF_UPDATE_GOLDEN=1 npx vitest run src/__tests__/lib/prompts
 *
 * Callback ids embed `Date.now()`, so they are normalized to a stable token —
 * everything else is deterministic for a fixed ProjectContext.
 */
const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.8.0',
};

const ORIGIN = 'http://localhost:3000';

/** Replace the non-deterministic `cb-<timestamp>-<n>` callback ids. */
function normalize(prompt: string): string {
  return prompt.replace(/cb-\d+-\d+/g, 'cb-TEST');
}

const ENTITY: StoredCatalogEntity = {
  id: 'itm-rusty-sword',
  catalogId: 'items',
  name: 'Rusty Sword',
  categoryPath: ['Weapons', 'Swords'],
  tags: ['common', 'starter'],
  lifecycle: 'scaffolded',
  data: { itemType: 'weapon', rarity: 'common', damage: 5 },
};

const FEATURES: FeatureDefinition[] = [
  { featureName: 'Hit detection', category: 'Combat', description: 'Sweep-based melee hit detection' },
  { featureName: 'Damage application', category: 'Combat', description: 'GE-driven damage', dependsOn: ['Hit detection'] },
];

const ABILITY_REF: AbilityRef = {
  name: 'Fireball',
  element: 'Fire',
  tag: 'Ability.Fire.Fireball',
  category: 'Offensive',
  tier: 'T2',
};

const EFFECTS: EditorEffect[] = [
  {
    id: 'fx-1',
    name: 'GE_FireballDamage',
    duration: 'instant',
    durationSec: 0,
    cooldownSec: 6,
    color: 'var(--accent)',
    modifiers: [{ attribute: 'Health', operation: 'add', magnitude: -35 }],
    grantedTags: [],
  },
];

const TAG_RULES: TagRule[] = [
  { id: 'tr-1', sourceTag: 'Ability.Fire.Fireball', targetTag: 'State.Dead', type: 'blocks' },
];

const SUITE: TestSuite = {
  id: 1,
  name: 'Skeleton Aggro Suite',
  description: 'Perception + chase behaviour for the crypt skeleton.',
  targetClass: 'AARPGEnemyAIController',
  scenarios: [
    {
      id: 1,
      suiteId: 1,
      name: 'Sees player at 50m',
      description: 'Player walks into the sight cone at 50 metres.',
      stimuli: [
        {
          id: 'st-1',
          type: 'perception_sight',
          label: 'Player enters sight at 50m',
          description: 'Spawn the player inside the sight cone at 5000 units.',
          params: { distance: '5000' },
        },
      ],
      expectedActions: [{ id: 'ea-1', action: 'Enter Chase state', btNode: 'BTT_Chase', timeoutSeconds: 3 }],
      status: 'ready',
      lastRunOutput: '',
      lastRunAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** One pinned task per `CLITaskType`. Keyed so the coverage guard can diff keys. */
const TASK_CASES: Record<CLITaskType, () => CLITask> = {
  'checklist': () =>
    TaskFactory.checklist('arpg-combat', 'combat-hit-detect', 'Implement melee hit detection with a TSet dedup.', 'Combat', ORIGIN),
  'quick-action': () => TaskFactory.quickAction('arpg-loot', 'List the loot tables in this module.', 'Loot'),
  // Deliberately a `level-design` module: its Domain Context is the one built
  // from the version-keyed engine facts, so this golden pins the MegaLights /
  // PCG framing against the project's actual engine.
  'ask-claude': () => TaskFactory.askClaude('level-design', 'How are room spawn managers wired today?', 'Level Design'),
  'feature-fix': () =>
    TaskFactory.featureFix(
      'arpg-combat',
      {
        featureName: 'Hit detection',
        status: 'partial',
        nextSteps: 'Add TSet dedup and clamp overlaps per swing.',
        filePaths: ['Source/PoF/Combat/HitDetect.h', 'Source/PoF/Combat/HitDetect.cpp'],
        qualityScore: 3,
      },
      'Combat',
      ORIGIN,
    ),
  'feature-review': () => TaskFactory.featureReview('arpg-combat', 'Combat', FEATURES, ORIGIN, 'Combat Review'),
  'module-scan': () => TaskFactory.moduleScan('arpg-combat', ['structure', 'quality'], ORIGIN, 'Combat Scan'),
  'wbp-starter': () => TaskFactory.wbpStarter('arpg-ui', 'UARPGHUDWidget', ORIGIN, 'WBP Starter'),
  'procgen-dungeon': () => TaskFactory.procgenDungeon('arpg-world', { roomCount: 8, seed: 1234 }, ORIGIN, 'ProcGen'),
  'biome-scatter': () => TaskFactory.scatterBiome('arpg-world', { density: 1.5, seed: 99 }, ORIGIN, 'Scatter'),
  'mixamo-import': () =>
    TaskFactory.mixamoImport(
      'arpg-animation',
      { importDir: 'C:\\drops\\mixamo', targetSkeleton: '/Game/Characters/SK_Mannequin' },
      ORIGIN,
      'Mixamo',
    ),
  'character-setup': () =>
    TaskFactory.characterSetup(
      'arpg-character',
      {
        source: 'mannequin',
        playerMesh: '/MoverTests/Characters/Mannequins/Meshes/SKM_Manny',
        enemyMesh: '/MoverTests/Characters/Mannequins/Meshes/SKM_Manny_Simple',
        animBlueprint: '/MoverTests/Characters/Mannequins/Animations/ABP_Manny',
        enemyMaterial: '/Game/VerticalSlice/M_EnemyRed',
      },
      ORIGIN,
      'Characters',
    ),
  'audio-import': () =>
    TaskFactory.importAudioSet(
      {
        setName: 'footstep-stone',
        eventKey: 'AnimNotify_FootstepEffect',
        surface: 'stone',
        assets: [
          { filename: 'step_01.wav', srcAbsPath: 'C:\\audio\\step_01.wav' },
          { filename: 'step_02.wav', srcAbsPath: 'C:\\audio\\step_02.wav' },
        ],
      },
      ORIGIN,
    ),
  'generate': () => TaskFactory.generate('arpg-inventory', ENTITY, 'author-python', ORIGIN, 'Items'),
  'evaluate-track': () => TaskFactory.evaluateTrack('arpg-inventory', ENTITY, 'logic', ORIGIN, 'Track'),
  'draft-ability-spec': () =>
    TaskFactory.draftAbilitySpec(
      'arpg-gas',
      { catalogId: 'abilities', entityId: 'abl-fireball', ref: ABILITY_REF, instruction: 'Make it a two-stage burn.' },
      ORIGIN,
      'Ability Spec',
    ),
  'generate-gas-effects': () =>
    TaskFactory.generateGasEffects(
      'arpg-gas',
      { ref: ABILITY_REF, effects: EFFECTS, tagRules: TAG_RULES, scalars: { manaCost: 20, cooldown: 6, damage: 35 }, catalogId: 'spellbook', entityId: 'off-fire-01' },
      ORIGIN,
      'GAS Effects',
    ),
  'run-ai-tests': () => TaskFactory.runAITests('ai-behavior', SUITE, ORIGIN, 'AI Tests'),
  'detect-stimuli': () =>
    TaskFactory.detectStimuli(
      'ai-behavior',
      { scenarioId: 1, scenarioDescription: 'The player sprints past the guard at 10 metres.', targetClass: 'AARPGEnemyAIController' },
      ORIGIN,
      'Detect Stimuli',
    ),
};

describe('golden rail — CLI task prompts', () => {
  it('pins EVERY registered task type (coverage guard)', () => {
    expect(Object.keys(TASK_CASES).sort()).toEqual(Object.keys(taskPromptHandlers).sort());
  });

  for (const [type, make] of Object.entries(TASK_CASES) as [CLITaskType, () => CLITask][]) {
    it(`task: ${type}`, () => {
      expectGolden(`task-${type}`, normalize(buildTaskPrompt(make(), CTX)));
    });
  }
});

describe('golden rail — standalone builders', () => {
  for (const testCase of STANDALONE_BUILDERS) {
    it(`builder: ${testCase.name}`, () => {
      expectGolden(`builder-${testCase.name}`, normalize(testCase.build(CTX)));
    });
  }
});

describe('loud fallbacks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('an unregistered task type warns AND stamps the prompt (never a silent raw dispatch)', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const rogue = {
      type: 'not-a-real-type' as CLITaskType,
      prompt: 'Do the thing.',
      moduleId: 'arpg-combat',
      label: 'Rogue',
    } as CLITask;

    const prompt = buildTaskPrompt(rogue, CTX);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('no prompt handler registered');
    expect(String(warn.mock.calls[0][0])).toContain('not-a-real-type');
    expect(prompt).toContain(`${UNKNOWN_TASK_TYPE_MARKER}:not-a-real-type`);
    expect(prompt).toContain(UNKNOWN_TASK_TYPE_NOTE);
    // The raw prompt still ships (behaviour preserved) — it is just no longer silent.
    expect(prompt).toContain('Do the thing.');
  });

  it('a registered task type never carries the unknown-type marker', () => {
    const prompt = buildTaskPrompt(TASK_CASES['quick-action'](), CTX);
    expect(prompt).not.toContain(UNKNOWN_TASK_TYPE_MARKER);
  });

  it('a generate task for a catalog with NO recipe warns and returns the bare entity name', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const orphan: StoredCatalogEntity = {
      ...ENTITY,
      id: 'xxx-1',
      catalogId: 'no-such-catalog',
      name: 'Orphan Entity',
    };
    const task = TaskFactory.generate('arpg-inventory', orphan, 'author-python', ORIGIN, 'Orphan');

    const prompt = buildTaskPrompt(task, CTX);

    // The historical fallback is preserved byte-for-byte…
    expect(prompt).toBe('Orphan Entity');
    // …but it is no longer silent, and it names the missing recipe.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('no recipe registered');
    expect(String(warn.mock.calls[0][0])).toContain('no-such-catalog');
  });
});
