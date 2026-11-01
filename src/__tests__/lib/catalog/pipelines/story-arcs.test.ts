import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import '@/lib/catalog/pipelines/story-arcs';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stepGradability } from '@/lib/catalog/acceptance/stepGradability';
import { readsDirection } from '@/lib/catalog/stepSpec';
import { storyGraphAcceptance } from '@/lib/catalog/acceptance/storyCheckers';
import { storyContentHash } from '@/lib/story/canonical';
import { parseStoryGraph } from '@/lib/story/importer';
import { generateStoryGraph } from '@/lib/story/fixtures';
import type { StoryGraph } from '@/lib/story/types';
import { sha256HexSync, storyContentHashSync } from '@/lib/catalog/pipelines/storyArcs/storyArcsHash';
import { starterStoryGraph, walkSummary, STORY_GRAPH_STEP, type WalkSummary } from '@/lib/catalog/pipelines/storyArcs/storyArcsWalk';
import { ViewPanel } from '@/components/layout-lab/steps/ArchetypeStep';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { CheckerContext } from '@/lib/catalog/acceptance/types';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const entity: LabEntity = { id: 'arc-ember-pact', name: 'The Ember Pact Arc', lifecycle: 'planned', data: {} };
const pipeline = getCatalogPipeline('story-arcs')!;
const step = (label: string) => pipeline.steps.find((s) => s.label === label)!;
const ctxWith = (siblings: Record<string, Record<string, unknown>>): CheckerContext =>
  ({ catalog: 'story-arcs', siblings, has: () => true });

describe('story-arcs pipeline', () => {
  afterEach(cleanup);

  it('registers three labelled steps, packaging-exempt with a reason, every body reading its direction', () => {
    expect(pipeline.steps.map((s) => s.label)).toEqual(['Concept Brief', 'Story Graph', 'Impact Walk']);
    expect(pipeline.packagingExempt).toMatch(/data document, not a UE asset package/);
    for (const s of pipeline.steps) {
      expect(readsDirection(s), s.label).toBe(true);
      expect(s.engine, s.label).toBeTruthy();
    }
  });

  it('every step label is server-gradable as `registered` (Rule 4b), never `unknown`', () => {
    const has = (c: string, l: string) => !!getCatalogPipeline(c)?.steps.some((s) => s.label === l);
    for (const s of pipeline.steps) expect(stepGradability('story-arcs', s.label, has)).toEqual({ kind: 'registered' });
  });

  it('a clean Produce of each step drives Acceptance to pass — with and without sibling context', () => {
    const produced: Record<string, Record<string, unknown>> = {};
    for (const s of pipeline.steps) produced[s.label] = s.produce(entity).data ?? {};
    for (const s of pipeline.steps) {
      expect(s.accept(produced[s.label]).status, `${s.label} (no ctx)`).toBe('pass');
      expect(s.accept(produced[s.label], ctxWith(produced)).status, `${s.label} (ctx)`).toBe('pass');
    }
  });

  it('each step View renders its produced data', () => {
    const t = LAB_THEMES[0];
    const expectText: Record<string, RegExp> = { 'Concept Brief': /pof\.storygraph\/1/, 'Story Graph': /START/, 'Impact Walk': /pof-walker@1/ };
    for (const s of pipeline.steps) {
      const { container, unmount } = render(createElement(ViewPanel, { t, view: s.view, data: s.produce(entity).data ?? {} }));
      expect(container.textContent ?? '', s.label).toMatch(expectText[s.label]);
      unmount();
    }
  });

  it('the starter Story Graph has zero blocking structural findings at every size the direction allows', () => {
    const accept = storyGraphAcceptance();
    for (const dir of ['nodes 4', 'nodes 9', '', 'nodes 33', 'nodes 64', 'nodes 999']) {
      for (const id of ['arc-ember-pact', 'arc-other', 'x']) {
        const g = starterStoryGraph({ ...entity, id }, dir);
        const r = accept({ storyGraph: g });
        expect(r.status, `${id} ${dir}: ${r.reason ?? r.detail}`).toBe('pass');
      }
    }
    expect(starterStoryGraph(entity, 'nodes 20').nodes).toHaveLength(20);
    expect(starterStoryGraph(entity, 'nodes 999').nodes).toHaveLength(64);
    expect(starterStoryGraph(entity).nodes).toHaveLength(14);
  });

  it('the direction is consumed: nodes resizes the graph, seed changes the walk', () => {
    const graph = step('Story Graph');
    expect(JSON.stringify(graph.produce(entity, 'nodes 20'))).not.toEqual(JSON.stringify(graph.produce(entity)));
    const walk = step('Impact Walk');
    const a = walk.produce(entity).data!.walk as WalkSummary;
    const b = walk.produce(entity, 'seed 9').data!.walk as WalkSummary;
    expect(a.seed).toBe(1);
    expect(b.seed).toBe(9);
    expect(b.graphHash).toBe(a.graphHash);
  });

  it('the sync content hash equals the async reference storyContentHash', async () => {
    expect(sha256HexSync(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256HexSync(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    const graphs: StoryGraph[] = [starterStoryGraph(entity), generateStoryGraph({ nodes: 1 }), generateStoryGraph({ nodes: 300, seed: 5 })];
    for (const g of graphs) {
      const parsed = parseStoryGraph(g);
      if (!parsed.ok) throw new Error(parsed.error);
      expect(storyContentHashSync(parsed.data)).toBe(await storyContentHash(parsed.data));
    }
  });

  describe('Impact Walk acceptance', () => {
    const walk = step('Impact Walk');

    it('a STALE record is never what passes: the CURRENT graph is walked and named, and a record of an older graph is called old', () => {
      const summary = walk.produce(entity).data!;
      const current = { storyGraph: starterStoryGraph(entity, 'nodes 20') };
      const r = walk.accept(summary, ctxWith({ [STORY_GRAPH_STEP]: current }));
      expect(r.status).toBe('pass');
      expect(r.detail).toMatch(/walked the CURRENT graph/);
      expect(r.detail).toMatch(/older graph/);
      // not the fast path's "bound to" claim
      expect(r.detail).not.toMatch(/bound to/);
    });

    it('an edit to the current graph after the walk is walked fresh; a graph that no longer parses fails', () => {
      const g = starterStoryGraph(entity);
      const summary = { walk: walkSummary(g) };
      const ok = walk.accept(summary, ctxWith({ [STORY_GRAPH_STEP]: { storyGraph: g } }));
      expect(ok.status).toBe('pass');
      expect(ok.detail).toMatch(/bound to/);
      const edited = { ...g, nodes: g.nodes.map((n) => (n.id === 'START' ? { ...n, title: 'A different road' } : n)) };
      const after = walk.accept(summary, ctxWith({ [STORY_GRAPH_STEP]: { storyGraph: edited } }));
      expect(after.status).toBe('pass');
      expect(after.detail).toMatch(/older graph/);
      const broken = walk.accept(summary, ctxWith({ [STORY_GRAPH_STEP]: { storyGraph: { format: 'nope' } } }));
      expect(broken.status).toBe('fail');
    });

    it('the fresh walk is memoised per graph object (one walk however many graders read it)', () => {
      const summary = walk.produce(entity).data!;
      const graph = starterStoryGraph(entity, 'nodes 24');
      const siblings = { [STORY_GRAPH_STEP]: { storyGraph: graph } };
      const a = walk.accept(summary, ctxWith(siblings));
      const b = walk.accept(summary, ctxWith(siblings));
      expect(b.detail).toBe(a.detail);
    });

    it('binds to a graph stored as JSON text as well as an object', () => {
      const g = starterStoryGraph(entity);
      const summary = { walk: walkSummary(g) };
      expect(walk.accept(summary, ctxWith({ [STORY_GRAPH_STEP]: { storyGraph: JSON.stringify(g) } })).status).toBe('pass');
    });

    it('is pending while there is no graph yet, and pending with no summary', () => {
      const summary = walk.produce(entity).data!;
      expect(walk.accept(summary, ctxWith({})).status).toBe('pending');
      expect(walk.accept({}, ctxWith({})).status).toBe('pending');
    });

    it('leads are reported in the detail and never fail the step', () => {
      const g = starterStoryGraph(entity);
      const base = walkSummary(g);
      const leady = { walk: { ...base, leadCounts: { SOFTLOCK_LEAD: 3, NODE_NEVER_REACHED: 1 } } };
      const r = walk.accept(leady, ctxWith({ [STORY_GRAPH_STEP]: { storyGraph: g } }));
      expect(r.status).toBe('pass');
      expect(r.detail).toMatch(/LEADS \(not defects\): SOFTLOCK_LEAD ×3, NODE_NEVER_REACHED ×1/);
    });

    it('a malformed summary fails with its reason; no-context grading says freshness was not checked', () => {
      const bad = walk.accept({ walk: { engine: 'pof-walker@1', seed: 1, samples: 64, graphHash: 'nope', gradeable: true, leadCounts: {} } });
      expect(bad.status).toBe('fail');
      expect(bad.reason).toMatch(/graphHash/);
      expect(walk.accept(walk.produce(entity).data!).detail).toMatch(/freshness NOT checked/);
    });
  });
});
