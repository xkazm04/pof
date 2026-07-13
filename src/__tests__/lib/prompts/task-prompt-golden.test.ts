import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

/**
 * Golden-file snapshots of the fully composed prompt for a representative task
 * of each shape. These pin the byte-exact output so the Direction-1 refactor
 * (shared domain-section composer + ctx-derived engine paths) is proven
 * byte-stable, and every later intentional change (Directions 2 & 3) shows up as
 * a reviewed snapshot diff rather than a silent drift.
 *
 * Callback ids embed `Date.now()` so they are normalized to a stable token —
 * everything else in the prompt is deterministic for a fixed ProjectContext.
 */
const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.7.2',
};

const ORIGIN = 'http://localhost:3000';

/** Replace the non-deterministic `cb-<timestamp>-<n>` callback ids. */
function normalize(prompt: string): string {
  return prompt.replace(/cb-\d+-\d+/g, 'cb-TEST');
}

describe('task prompt golden files', () => {
  it('checklist', () => {
    const task = TaskFactory.checklist(
      'arpg-combat',
      'combat-hit-detect',
      'Implement melee hit detection with a TSet dedup.',
      'Combat',
      ORIGIN,
    );
    expect(normalize(buildTaskPrompt(task, CTX))).toMatchSnapshot();
  });

  it('quick-action', () => {
    const task = TaskFactory.quickAction('arpg-loot', 'List the loot tables in this module.', 'Loot');
    expect(normalize(buildTaskPrompt(task, CTX))).toMatchSnapshot();
  });

  it('feature-fix', () => {
    const task = TaskFactory.featureFix(
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
    );
    expect(normalize(buildTaskPrompt(task, CTX))).toMatchSnapshot();
  });

  it('mixamo-import (python task)', () => {
    const task = TaskFactory.mixamoImport(
      'arpg-animation',
      { importDir: 'C:\\drops\\mixamo', targetSkeleton: '/Game/Characters/SK_Mannequin' },
      ORIGIN,
      'Mixamo',
    );
    expect(normalize(buildTaskPrompt(task, CTX))).toMatchSnapshot();
  });

  it('generate (items recipe, author-python)', () => {
    const entity: StoredCatalogEntity = {
      id: 'itm-rusty-sword',
      catalogId: 'items',
      name: 'Rusty Sword',
      categoryPath: ['Weapons', 'Swords'],
      tags: ['common', 'starter'],
      lifecycle: 'scaffolded',
      data: { itemType: 'weapon', rarity: 'common', damage: 5 },
    };
    const task = TaskFactory.generate('arpg-inventory', entity, 'author-python', ORIGIN, 'Items');
    expect(normalize(buildTaskPrompt(task, CTX))).toMatchSnapshot();
  });

  it('audio-import (python task, ctx-derived engine)', () => {
    const task = TaskFactory.importAudioSet(
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
    );
    expect(normalize(buildTaskPrompt(task, CTX))).toMatchSnapshot();
  });
});
