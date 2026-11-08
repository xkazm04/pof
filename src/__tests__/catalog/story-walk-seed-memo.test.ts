/**
 * storyWalkFresh re-walks the CURRENT Story Graph when the stored summary is for an older graph,
 * using the stored summary's seed. Before, that re-walk was memoised per graph object ONLY, so a
 * second stale summary with a different seed, graded against the same graph object, got the first
 * seed's walk back: the verdict named seed 1 when seed 5 was asked for.
 */
import { describe, it, expect } from 'vitest';
import { starterStoryGraph, storyWalkFresh, walkSummary, STORY_GRAPH_STEP } from '@/lib/catalog/pipelines/storyArcs/storyArcsWalk';

const entity = { id: 'arc-test', name: 'Ashen Pact', lifecycle: 'planned', data: {} } as never;

describe('story-arcs Impact Walk — the re-walk honours the stored seed', () => {
  it('two stale summaries with different seeds against one graph object each walk their own seed', () => {
    const current = starterStoryGraph(entity, 'nodes 14');
    const older = starterStoryGraph(entity, 'nodes 8');
    const ctx = { siblings: { [STORY_GRAPH_STEP]: { storyGraph: current } } } as never;
    const check = storyWalkFresh();

    const first = check({ walk: walkSummary(older, 'seed 1') }, ctx);
    const second = check({ walk: walkSummary(older, 'seed 5') }, ctx);

    expect(first.status).toBe('pass');
    expect(first.detail).toMatch(/seed 1 /);
    expect(second.status).toBe('pass');
    expect(second.detail).toMatch(/walked the CURRENT graph/);
    expect(second.detail).toMatch(/seed 5 /);
  });
});
