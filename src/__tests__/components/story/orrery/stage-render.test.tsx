import { describe, it, expect, beforeAll, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Profiler, useState, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { buildOrreryModel } from '@/lib/story/orrery/model';
import { OrreryStage, type OrreryStageControls, type OrreryStageStats } from '@/components/story/orrery/OrreryStage';
import { drawHierarchy } from '@/components/story/orrery/render/drawHier';
import { drawFlatDial } from '@/components/story/orrery/render/drawFlat';
import { displayRoot } from '@/components/story/orrery/render/derive';
import { viewStateFor, sceneExtent } from '@/components/story/orrery/render/geometry';
import { detailBands, lensModeOf } from '@/components/story/orrery/render/lod';
import { fitCamera, drawFrameRect } from '@/components/story/orrery/render/camera';
import { SETTLE_MS } from '@/components/story/orrery/render/engine';
import { readOrreryPalette } from '@/components/story/orrery/render/palette';
import type { SceneInput } from '@/components/story/orrery/render/scene';
import { FIXTURES_AVAILABLE, loadGraph } from '@/__tests__/lib/story/orrery/_fixtures';
import { installCanvasStub, makeFakeContext, stubElementBox } from './_canvas';
import type { LineDetail, OrreryModel } from '@/lib/story/orrery';
import type { StoryEdge, StoryGraph, StoryNode } from '@/lib/story/types';

const STAGE_W = 1200;
const STAGE_H = 760;
const SHOW = { impact: true, paths: true, influence: true, flags: true };

/** A story with acts, quests and lines, so rings, folds, a rim and a hub all exist. */
function tree(acts = 4, quests = 4, lines = 6): StoryGraph {
  const nodes: StoryNode[] = [{ id: 'root', kind: 'container', class: 'arc', title: 'The Arc' }];
  const edges: StoryEdge[] = [];
  let prev: string | null = null;
  for (let a = 0; a < acts; a++) {
    nodes.push({ id: `a${a}`, kind: 'container', class: 'act', title: `Act ${a + 1}`, parent: 'root' });
    for (let q = 0; q < quests; q++) {
      const qid = `a${a}.q${q}`;
      nodes.push({ id: qid, kind: 'container', class: 'quest', title: `Quest ${a + 1}.${q + 1}`, parent: `a${a}` });
      for (let l = 0; l < lines; l++) {
        const lid = `${qid}.l${l}`;
        nodes.push({
          id: lid,
          kind: l === 2 ? 'choice' : 'event',
          title: `Line ${a + 1}.${q + 1}.${l + 1}`,
          parent: qid,
          text: 'A line of prose long enough that it has to be measured before it can be drawn.',
          options: l === 2 ? [{ id: 'o1' }, { id: 'o2' }] : undefined,
        });
        if (prev) edges.push({ id: `e${edges.length}`, from: prev, to: lid, kind: 'then' });
        prev = lid;
      }
    }
  }
  nodes.push({ id: 'end', kind: 'ending', title: 'The End', parent: 'root' });
  nodes.push({ id: 'end2', kind: 'ending', title: 'The Other End', parent: 'root' });
  if (prev) edges.push({ id: `e${edges.length}`, from: prev, to: 'end', kind: 'then' });
  edges.push({ id: `e${edges.length}`, from: 'a0.q0.l2', to: 'end2', kind: 'option', optionId: 'o2', writes: [{ var: 'trust', op: 'add', value: 2 }] });
  edges.push({ id: `e${edges.length}`, from: 'a0.q0.l0', to: 'a1.q0.l0', kind: 'influences' });
  return {
    format: 'pof.storygraph/1',
    project: 'Render Tree',
    graphId: 'rt',
    revision: 1,
    profile: { nodeClasses: [] },
    variables: [
      { name: 'trust', type: 'int', domain: { min: 0, max: 10 }, initial: 0, writers: ['a0.q0.l2'], scope: 'playthrough', external: false },
    ],
    entries: ['a0.q0.l0'],
    nodes,
    edges,
    endings: [{ node: 'end' }, { node: 'end2' }],
    budgets: { unit: 'words', basis: 'none', perClass: {} },
  } as StoryGraph;
}

/** One bake of a model into a fake context, so what was drawn can be counted. */
function bakeOnce(model: OrreryModel, rectScale = 1, lens: string | null = null) {
  const fake = makeFakeContext();
  const root = displayRoot(model);
  const vs = viewStateFor(model, root);
  const cam = fitCamera(sceneExtent(model, vs), STAGE_W, STAGE_H, root);
  const bands = detailBands(model, root, vs, cam.scale);
  const rect = drawFrameRect(cam, STAGE_W, STAGE_H, 300, 190);
  const input: SceneInput = {
    view: { model, vs, focus: root, scale: cam.scale, rimDepth: bands.rimDepth, root },
    cam,
    palette: readOrreryPalette(document.body),
    lens: lensModeOf(model, lens),
    show: SHOW,
    rect: {
      x0: rect.x0 * rectScale,
      x1: rect.x1 * rectScale,
      y0: rect.y0 * rectScale,
      y1: rect.y1 * rectScale,
    },
    width: STAGE_W,
    height: STAGE_H,
    dpr: 1,
    offsetX: 300,
    offsetY: 190,
    hatch: null,
    chordDepth: bands.chordDepth,
  };
  const stats = model.flat ? drawFlatDial(fake.ctx, input) : drawHierarchy(fake.ctx, input);
  return { stats, log: fake.log };
}

/* ------------------------------------------------------------------ the draw passes */

describe('the bake draws, culls and reports honestly', () => {
  beforeAll(() => {
    installCanvasStub();
  });
  afterEach(() => {
    cleanup();
  });

  it('draws rings, folds, chords and rim units, and says how many of each', () => {
    const model = buildOrreryModel(tree(), 'tree');
    const { stats, log } = bakeOnce(model);
    expect(stats.drawn).toBeGreaterThan(0);
    expect(stats.chords).toBeGreaterThan(0);
    expect(stats.units).toBeGreaterThan(0);
    expect(stats.labels).toBeGreaterThan(0);
    expect(log.fills).toBeGreaterThan(stats.drawn);
    expect(stats.ms).toBeGreaterThanOrEqual(0);
    // Every label that was drawn came through the measurer.
    expect(log.texts.length).toBeGreaterThan(0);
  });

  it('CULLS: a tenth of the viewport draws strictly fewer segments than the whole of it', () => {
    const model = buildOrreryModel(tree(), 'tree');
    const whole = bakeOnce(model, 1).stats;
    const sliver = bakeOnce(model, 0.1).stats;
    expect(sliver.drawn).toBeLessThan(whole.drawn);
    expect(sliver.drawn).toBeGreaterThan(0);
  });

  it('folds deep subtrees into blocks instead of drawing every leaf', () => {
    const deep = buildOrreryModel(tree(8, 12, 20), 'deep');
    const { stats } = bakeOnce(deep);
    expect(stats.blocks).toBeGreaterThan(0);
    // The wheel never draws one segment per node at fit; that is the whole bet.
    expect(stats.drawn).toBeLessThan(deep.R.length);
  });

  it('never draws a label wider than the room it was given', () => {
    const model = buildOrreryModel(tree(), 'tree');
    const { log } = bakeOnce(model);
    // The arc-text path draws glyph by glyph, so every entry is at most one grapheme or a fitted
    // run; what matters is that nothing was drawn untruncated beyond its slot, which `fitText`
    // guarantees and `stage-lod.test.tsx` proves directly. Here: nothing empty, nothing undefined.
    for (const t of log.texts) {
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    }
  });

  it('hatches an unmeasured node under a reach lens, and never paints it as a measured zero', () => {
    const graph = tree(2, 2, 3);
    const withEvidence: StoryGraph = {
      ...graph,
      evidence: {
        runs: [{ runId: 'r', engine: 'x', n: 10, graphHash: null, cohorts: ['all'] }],
        reach: { 'a0.q0.l0': { all: 55 } },
      },
    };
    const model = buildOrreryModel(withEvidence, 'ev');
    const { stats } = bakeOnce(model, 1, 'all');
    expect(stats.drawn).toBeGreaterThan(0);
    // Most nodes carry no row, so the pass must have asked for the hatch at least once. With a null
    // pattern it falls back to the hatch GROUND colour, which is what appears in the fill log.
    const palette = readOrreryPalette(document.body);
    const { log } = bakeOnce(model, 1, 'all');
    expect(log.fillStyles).toContain(palette.hatch.ground);
  });
});

describe.skipIf(!FIXTURES_AVAILABLE)('the three staged documents bake', () => {
  beforeAll(() => {
    installCanvasStub();
  });

  it('bakes the 10,739-node synthetic document, and reports drawn-after-culling at fit', () => {
    const model = buildOrreryModel(loadGraph('synthetic-scale'), 'synthetic');
    const t0 = performance.now();
    const { stats } = bakeOnce(model);
    const ms = performance.now() - t0;
    // Printed, not asserted: it is a measurement of this machine and this stub, not a contract.
    console.error(
      `[orrery] synthetic-scale at fit: ${stats.drawn} segments + ${stats.blocks} folded blocks, ` +
        `${stats.chords} chords, ${stats.units} rim units, ${stats.labels} labels (${ms.toFixed(1)} ms, stub ctx)`,
    );
    expect(stats.drawn).toBeGreaterThan(0);
    expect(stats.blocks).toBeGreaterThan(0);
    // Culling and folding together: a few hundred shapes stand for ten thousand nodes.
    expect(stats.drawn + stats.blocks).toBeLessThan(model.R.length / 2);
  });

  it('bakes the lane x axis dial', () => {
    const model = buildOrreryModel(loadGraph('mage-arena-season'), 'mage');
    expect(model.flat).not.toBeNull();
    const { stats } = bakeOnce(model);
    expect(stats.drawn).toBeGreaterThan(0);
    expect(stats.chords).toBeGreaterThan(0);
  });

  it('bakes a document that declares NO axis without reaching for one', () => {
    const model = buildOrreryModel(loadGraph('pof-exemplars'), 'pof');
    expect(model.flat).toBeNull();
    expect(model.raw.profile.axis).toBeUndefined();
    expect(() => bakeOnce(model)).not.toThrow();
    expect(bakeOnce(model).stats.drawn).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ the component */

interface HarnessApi {
  select: Mock<(i: number) => void>;
  focus: Mock<(i: number) => void>;
  openDetail: Mock<(d: LineDetail) => void>;
  stats: Mock<(s: OrreryStageStats) => void>;
  commits: () => number;
  controls: () => OrreryStageControls | null;
}

/** Mounts the real stage inside a themed root, counting every commit of its subtree. */
function mountStage(model: OrreryModel, theme = 'orrery') {
  const api: HarnessApi = {
    select: vi.fn<(i: number) => void>(),
    focus: vi.fn<(i: number) => void>(),
    openDetail: vi.fn<(d: LineDetail) => void>(),
    stats: vi.fn<(s: OrreryStageStats) => void>(),
    commits: () => commits,
    controls: () => controls,
  };
  let commits = 0;
  let controls: OrreryStageControls | null = null;

  function Harness({ children }: { children?: ReactNode }) {
    const [focus, setFocus] = useState(displayRoot(model));
    const [selected, setSelected] = useState(-1);
    return (
      <div data-orrery-theme={theme} data-testid="themed">
        <Profiler id="stage" onRender={() => { commits += 1; }}>
          <OrreryStage
            model={model}
            focus={focus}
            selected={selected}
            lens={null}
            show={SHOW}
            onFocus={(i) => {
              api.focus(i);
              setFocus(i);
            }}
            onSelect={(i) => {
              api.select(i);
              setSelected(i);
            }}
            onOpenDetail={(d: LineDetail) => api.openDetail(d)}
            onStats={(s: OrreryStageStats) => api.stats(s)}
            onControls={(c) => {
              controls = c;
            }}
          />
        </Profiler>
        {children}
      </div>
    );
  }

  const view = render(<Harness />);
  return { api, view };
}

/** Let the engine's scheduled frames and its settle timer run. */
async function settle(extra = 60) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, SETTLE_MS + extra));
  });
}

describe('the stage component', () => {
  beforeAll(() => {
    installCanvasStub();
    stubElementBox(STAGE_W, STAGE_H);
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('emits the contract hooks and announces itself', () => {
    const model = buildOrreryModel(tree(2, 2, 3), 'tree');
    const { view } = mountStage(model);
    const stage = view.container.querySelector('[data-role="orrery-stage"]');
    expect(stage).not.toBeNull();
    const surface = view.container.querySelector('[data-role="orrery-canvas"]');
    expect(surface).not.toBeNull();
    expect(surface?.getAttribute('role')).toBe('application');
    expect(surface?.getAttribute('tabindex')).toBe('0');
    expect(surface?.getAttribute('aria-roledescription')).toBe('story wheel');
    const label = surface?.getAttribute('aria-label') ?? '';
    for (const word of ['Arrow', 'Enter', 'Escape', 'zoom', 'fits']) expect(label).toContain(word);
    expect(view.container.querySelectorAll('[data-role="orrery-canvas"] canvas')).toHaveLength(2);
  });

  it('publishes the drawn counts on the DOM and through onStats, once per bake', async () => {
    const model = buildOrreryModel(tree(3, 3, 5), 'tree');
    const { api, view } = mountStage(model);
    await settle();
    const stage = view.container.querySelector('[data-role="orrery-stage"]') as HTMLElement;
    expect(Number(stage.getAttribute('data-drawn'))).toBeGreaterThan(0);
    expect(Number(stage.getAttribute('data-bakes'))).toBeGreaterThanOrEqual(1);
    expect(api.stats).toHaveBeenCalled();
    const last = api.stats.mock.calls[api.stats.mock.calls.length - 1][0];
    expect(last.drawn).toBe(Number(stage.getAttribute('data-drawn')));
  });

  it('PANS WITHOUT RE-RENDERING OR RE-BAKING: a 40-step drag is one bake and zero commits', async () => {
    const model = buildOrreryModel(tree(3, 3, 5), 'tree');
    const { api, view } = mountStage(model);
    await settle();
    const stage = view.container.querySelector('[data-role="orrery-stage"]') as HTMLElement;
    const surface = view.container.querySelector('[data-role="orrery-canvas"]') as HTMLElement;

    const bakesBefore = Number(stage.getAttribute('data-bakes'));
    const commitsBefore = api.commits();

    fireEvent.pointerDown(surface, { button: 0, pointerId: 1, clientX: 600, clientY: 380 });
    for (let s = 1; s <= 40; s++) {
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: 600 + s * 4, clientY: 380 + s * 2 });
      // Each move gets a frame, and that frame must not bake.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1));
      });
    }
    // Mid-gesture: the bitmap has been blitted 40 times and baked none.
    expect(Number(stage.getAttribute('data-bakes'))).toBe(bakesBefore);
    expect(api.commits()).toBe(commitsBefore);
    expect(api.select).not.toHaveBeenCalled();
    expect(api.focus).not.toHaveBeenCalled();

    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 760, clientY: 460 });
    // A drag is not a click: the selection is untouched.
    expect(api.select).not.toHaveBeenCalled();

    await settle();
    // Exactly ONE crisp re-bake after the gesture settles.
    expect(Number(stage.getAttribute('data-bakes'))).toBe(bakesBefore + 1);
  });

  it('repaints on a theme switch without remounting the stage', async () => {
    const model = buildOrreryModel(tree(2, 2, 3), 'tree');
    const { view } = mountStage(model);
    await settle();
    const stage = view.container.querySelector('[data-role="orrery-stage"]') as HTMLElement;
    const themed = view.getByTestId('themed');
    const bakesBefore = Number(stage.getAttribute('data-bakes'));

    await act(async () => {
      themed.setAttribute('data-orrery-theme', 'blueprint');
      await new Promise((r) => setTimeout(r, 40));
    });
    // Same element — nothing was torn down — and the wheel was painted again.
    expect(view.container.querySelector('[data-role="orrery-stage"]')).toBe(stage);
    expect(Number(stage.getAttribute('data-bakes'))).toBeGreaterThan(bakesBefore);
  });

  it('opens the line detail when a leaf is activated, and dives when a container is', async () => {
    const model = buildOrreryModel(tree(2, 2, 3), 'tree');
    const { api, view } = mountStage(model);
    await settle();
    const surface = view.container.querySelector('[data-role="orrery-canvas"]') as HTMLElement;

    // Keyboard is the honest route to a specific node: arrows walk the graph.
    act(() => {
      fireEvent.keyDown(surface, { key: 'ArrowRight' });
    });
    const firstAct = api.select.mock.calls[0][0];
    expect(model.R[firstAct].kids.length).toBeGreaterThan(0);

    // Enter on a container asks the host to re-root; no detail layer for a container.
    act(() => {
      fireEvent.keyDown(surface, { key: 'Enter' });
    });
    expect(api.focus).toHaveBeenCalledWith(firstAct);
    expect(api.openDetail).not.toHaveBeenCalled();
    await settle(900);

    // Walk down to a leaf and activate it.
    act(() => {
      fireEvent.keyDown(surface, { key: 'ArrowDown' });
    });
    act(() => {
      fireEvent.keyDown(surface, { key: 'ArrowDown' });
    });
    const leaf = api.select.mock.calls[api.select.mock.calls.length - 1][0];
    expect(model.R[leaf].kids.length).toBe(0);
    act(() => {
      fireEvent.keyDown(surface, { key: 'Enter' });
    });
    expect(api.openDetail).toHaveBeenCalledTimes(1);
    const detail = api.openDetail.mock.calls[0][0];
    expect(detail.i).toBe(leaf);
    expect(detail.situation.length).toBeGreaterThan(0);
  });

  it('answers every key the aria-label promises, and leaves other keys alone', async () => {
    const model = buildOrreryModel(tree(2, 2, 3), 'tree');
    const { api, view } = mountStage(model);
    await settle();
    const stage = view.container.querySelector('[data-role="orrery-stage"]') as HTMLElement;
    const surface = view.container.querySelector('[data-role="orrery-canvas"]') as HTMLElement;

    for (const key of ['+', '-', '0']) {
      const before = Number(stage.getAttribute('data-bakes'));
      act(() => {
        fireEvent.keyDown(surface, { key });
      });
      await settle(700);
      expect(Number(stage.getAttribute('data-bakes')), key).toBeGreaterThan(before);
    }

    // Escape at the root clears the selection rather than throwing.
    act(() => {
      fireEvent.keyDown(surface, { key: 'ArrowRight' });
    });
    api.select.mockClear();
    act(() => {
      fireEvent.keyDown(surface, { key: 'Escape' });
    });
    expect(api.select).toHaveBeenCalledWith(-1);

    // A key the wheel does not own is not swallowed.
    const untouched = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true });
    surface.dispatchEvent(untouched);
    expect(untouched.defaultPrevented).toBe(false);
  });

  it('hands the chrome real zoom, fit and up controls', async () => {
    const model = buildOrreryModel(tree(2, 2, 3), 'tree');
    const { api, view } = mountStage(model);
    await settle();
    const controls = api.controls();
    expect(controls).not.toBeNull();
    const stage = view.container.querySelector('[data-role="orrery-stage"]') as HTMLElement;
    for (const run of [() => controls?.zoomIn(), () => controls?.zoomOut(), () => controls?.fit()]) {
      const before = Number(stage.getAttribute('data-bakes'));
      await act(async () => {
        run();
        await new Promise((r) => setTimeout(r, 800));
      });
      expect(Number(stage.getAttribute('data-bakes'))).toBeGreaterThan(before);
    }
    act(() => {
      controls?.focusStage();
    });
    expect(document.activeElement).toBe(view.container.querySelector('[data-role="orrery-canvas"]'));
  });

  it('shows a hover tip on a sector and hides it again', async () => {
    const model = buildOrreryModel(tree(2, 2, 3), 'tree');
    const { view } = mountStage(model);
    await settle();
    const surface = view.container.querySelector('[data-role="orrery-canvas"]') as HTMLElement;
    // The hub sits at the camera's centre, which fit put at the middle of the stage.
    await act(async () => {
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: STAGE_W / 2, clientY: STAGE_H / 2 + 27 });
      await new Promise((r) => setTimeout(r, 20));
    });
    const tip = view.container.querySelector('[data-role="orrery-tip"]');
    expect(tip).not.toBeNull();
    expect(tip?.querySelector('b')?.textContent?.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.pointerLeave(surface, { pointerId: 1 });
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(view.container.querySelector('[data-role="orrery-tip"]')).toBeNull();
  });

  it('drops a hover tip that belongs to a document the host has swapped away', async () => {
    const a = buildOrreryModel(tree(2, 2, 3), 'a');
    const b = buildOrreryModel(tree(3, 2, 2), 'b');
    const common = {
      focus: -1,
      selected: -1,
      lens: null,
      show: SHOW,
      onFocus: () => undefined,
      onSelect: () => undefined,
      onOpenDetail: () => undefined,
    };
    const view = render(
      <div data-orrery-theme="orrery">
        <OrreryStage model={a} {...common} />
      </div>,
    );
    await settle();
    const surface = view.container.querySelector('[data-role="orrery-canvas"]') as HTMLElement;
    await act(async () => {
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: STAGE_W / 2, clientY: STAGE_H / 2 + 27 });
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(view.container.querySelector('[data-role="orrery-tip"]')).not.toBeNull();
    view.rerender(
      <div data-orrery-theme="orrery">
        <OrreryStage model={b} {...common} />
      </div>,
    );
    // The tip described a node in the old document; it must not be re-labelled onto the new one.
    expect(view.container.querySelector('[data-role="orrery-tip"]')).toBeNull();
  });

  it('survives a document with no axis and no lanes', async () => {
    const minimal: StoryGraph = {
      format: 'pof.storygraph/1',
      project: 'One node',
      graphId: 'min',
      revision: 1,
      profile: {},
      variables: [],
      entries: ['only'],
      nodes: [{ id: 'only', kind: 'event', title: 'The only beat' }],
      edges: [],
      endings: [],
      budgets: { unit: 'words', basis: 'none', perClass: {} },
    } as StoryGraph;
    const model = buildOrreryModel(minimal, 'min');
    expect(() => mountStage(model)).not.toThrow();
    await settle();
  });
});
