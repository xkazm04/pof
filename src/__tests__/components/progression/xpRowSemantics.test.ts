import { describe, it, expect } from 'vitest';
import { progressionToUE5Struct } from '@/components/modules/core-engine/sub_progression/_internals/XpTableGenerator/helpers';

/** The loader assigns ExperienceToNextLevel from the row of the level just reached. */
describe('FProgressionCurveRow field docs', () => {
  const header = progressionToUE5Struct();

  it('describes XPRequired as the cost of clearing the row level', () => {
    expect(header).toContain('XP required to clear this level');
    expect(header).not.toContain('to reach this level from the previous one');
  });

  it('describes XPTotal as cumulative through the row level', () => {
    expect(header).toContain('Cumulative XP to clear levels 1 through this one');
    expect(header).not.toContain('needed to reach this level from level 1');
  });
});
