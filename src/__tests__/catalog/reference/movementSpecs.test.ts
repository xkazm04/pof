import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import {
  deriveHeroWalkSpeed,
  DIABLO1_INPUT_SPEC,
  DIABLO1_MOVEMENT_LAWS,
  DIABLO1_MOVEMENT_SPEC,
  inputEntity,
  movementEntity,
  seedInputSteps,
  seedMovementSteps,
} from '@/lib/catalog/reference/movementSpecs';

describe('Diablo I engine-derived hero movement', () => {
  it('derives walk speed at runtime from synthetic aggregate class animation frames', () => {
    const hero = {
      id: 'synthetic-class',
      name: 'Synthetic Hero',
      data: {
        animations: {
          dungeon: { walkingFrames: '4' },
          town: { walkingFrames: '9' },
        },
      },
    };
    const dungeon = deriveHeroWalkSpeed(hero, 'dungeon');
    expect(dungeon).toMatchObject({
      classId: 'synthetic-class',
      walkingFrames: 4,
      ticksPerFrame: 1,
      ticksPerTile: 5,
      tilesPerSecond: 4,
    });
    const town = deriveHeroWalkSpeed(hero, 'town');
    expect(town.ticksPerTile).toBe(10);
    expect(town.tilesPerSecond).toBe(2);
    expect(() => deriveHeroWalkSpeed({ id: 'missing', data: {} })).toThrow(/walkingFrames/);
  });

  it('names the grid, path limits, costs, blockers, interruptions, and port-only speed options', () => {
    expect(DIABLO1_MOVEMENT_SPEC.grid.directions).toHaveLength(8);
    expect(DIABLO1_MOVEMENT_SPEC.pathfinding.constants).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'MaxPathLengthPlayer', value: 100, source: 'Source/engine/path.h:20' }),
      expect.objectContaining({ name: 'PathAxisAlignedStepCost', value: 100 }),
      expect.objectContaining({ name: 'PathDiagonalStepCost', value: 101 }),
    ]));
    expect(DIABLO1_MOVEMENT_SPEC.blockers.map((blocker) => blocker.kind)).toEqual(
      expect.arrayContaining(['terrain', 'objects', 'players', 'monsters', 'corners']),
    );
    expect(DIABLO1_MOVEMENT_SPEC.interruptions.length).toBeGreaterThanOrEqual(4);
    expect(DIABLO1_MOVEMENT_SPEC.speedOptions.vanillaSprint).toBe(false);
    expect(DIABLO1_MOVEMENT_SPEC.speedOptions.runInTown).toMatch(/excluded from base Diablo I/);
  });

  it('promotes one engine-provenance movement entity without pretending UE steps are filled', () => {
    const entity = movementEntity().entity;
    expect(entity.id).toBe('d1-movement-hero');
    expect(entity.provenance).toMatchObject({ kind: 'ingest', canonProfile: 'diablo1' });
    expect(entity.provenance.sourceFile).toContain('engine: Source/player.cpp');
    expect(entity.data.openQuestions).toEqual(expect.arrayContaining([
      expect.stringMatching(/jump, dodge, sprint, or stamina/),
    ]));
    expect(seedMovementSteps(entity)).toEqual([]);
  });
});

describe('Diablo I vanilla input specification', () => {
  it('keeps every binding in the required input/context/action/file:line shape', () => {
    expect(DIABLO1_INPUT_SPEC.bindings.length).toBeGreaterThanOrEqual(18);
    for (const binding of DIABLO1_INPUT_SPEC.bindings) {
      expect(Object.keys(binding).sort()).toEqual(['action', 'context', 'input', 'source']);
      expect(binding.input.length).toBeGreaterThan(0);
      expect(binding.context.length).toBeGreaterThan(0);
      expect(binding.action.length).toBeGreaterThan(0);
      expect(binding.source).toMatch(/^Source\/.+:\d+-\d+$/);
    }
    expect(DIABLO1_INPUT_SPEC.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ input: 'Shift + left mouse button', action: expect.stringMatching(/Attack in place/) }),
      expect.objectContaining({ input: 'Right mouse button', action: expect.stringMatching(/cast the readied spell/) }),
      expect.objectContaining({ input: '1-8' }),
      expect.objectContaining({ input: 'F5-F8', context: 'gameplay' }),
      expect.objectContaining({ input: 'F1', action: expect.stringMatching(/Help/) }),
    ]));
    expect(DIABLO1_INPUT_SPEC.exclusions.map((entry) => entry.feature).join(' ')).toMatch(/gamepad and touch/);
  });

  it('seeds only source-supported input steps and every artifact stays non-pass', () => {
    const entity = inputEntity().entity;
    const seeds = seedInputSteps(entity);
    expect(seeds.map((seed) => seed.step)).toEqual([
      'Concept Brief',
      'Action Mapping',
      'Context Stack',
      'Tutorial Prompts',
    ]);
    expect(seeds.every((seed) => seed.data.sourced != null)).toBe(true);
    const pipeline = getCatalogPipeline('input-schemes')!;
    for (const seed of seeds) {
      const verdict = pipeline.steps.find((step) => step.label === seed.step)!.accept(seed.data);
      expect(verdict.status, seed.step).not.toBe('pass');
      expect(verdict.status, seed.step).not.toBe('fail');
    }
    expect(entity.data.openQuestions).toEqual(expect.arrayContaining([
      expect.stringMatching(/analog input/),
      expect.stringMatching(/contextual prompts/),
    ]));
  });
});

describe('movement and input canon laws', () => {
  it('generates three concise pinned laws and registers them in the Diablo I profile', () => {
    expect(DIABLO1_MOVEMENT_LAWS.map((law) => law.id)).toEqual([
      'd1-player-walk-law',
      'd1-pathfinding-law',
      'd1-click-context-law',
    ]);
    for (const law of DIABLO1_MOVEMENT_LAWS) {
      expect(law.body.length, law.id).toBeLessThanOrEqual(450);
      expect(law.refs?.length).toBeGreaterThan(0);
      expect(law.refs?.every((ref) => ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/'))).toBe(true);
      expect(DIABLO1_CANON.some((candidate) => candidate.id === law.id)).toBe(true);
    }
  });
});
