/**
 * Scene Composer "Dress from image": the store behind two explicit clicks.
 *
 * Decompose is a paid vision call (plus one per prop when crop gating is on), so picking an
 * image must cost nothing and the gating choice must be SENT, never left to the route's
 * gate-on default. The blockout goes through the one Blender dispatcher (Script History
 * row), and only a receipt Blender printed counts as built.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { SceneDressPanel } from '@/components/modules/visual-gen/scene-composer/SceneDressPanel';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { useSceneDressStore } from '@/components/modules/visual-gen/scene-composer/useSceneDressStore';
import { useSceneComposerStore } from '@/components/modules/visual-gen/scene-composer/useSceneComposerStore';
import { useBlenderStore } from '@/components/modules/visual-gen/blender-pipeline/useBlenderStore';
import { DRESS_FIXTURE } from '../../lib/visual-gen/sceneDressFixture';

const DECOMPOSE = '/api/visual-gen/scene-decompose';
const EXECUTE = '/api/blender-mcp/execute';
const IMAGE = 'data:image/png;base64,iVBORw0KGgo=';

let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = global.fetch;

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function route(handlers: Record<string, () => Response | Promise<Response>>) {
  fetchMock = vi.fn(async (url: string) => {
    for (const [path, h] of Object.entries(handlers)) if (String(url).includes(path)) return h();
    throw new Error(`unexpected fetch ${url}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
}

const refreshScene = vi.fn(async () => {});

beforeEach(() => {
  useSceneDressStore.getState().reset();
  useBlenderStore.setState({ scripts: [] });
  refreshScene.mockClear();
  useSceneComposerStore.setState({ refreshScene });
  route({});
});

afterEach(() => {
  cleanup();
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('decompose', () => {
  it('setImage spends nothing', () => {
    useSceneDressStore.getState().setImage(IMAGE, 'scene.png');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useSceneDressStore.getState()).toMatchObject({ imageDataUrl: IMAGE, status: 'idle' });
  });

  it('sends gateCrops explicitly (default false) and lands a plan', async () => {
    route({ [DECOMPOSE]: () => reply(200, { success: true, data: DRESS_FIXTURE }) });
    expect(useSceneDressStore.getState().gateCrops).toBe(false);
    useSceneDressStore.getState().setImage(IMAGE);
    await useSceneDressStore.getState().decompose();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).toEqual({ imageDataUrl: IMAGE, gateCrops: false });

    const s = useSceneDressStore.getState();
    expect(s.status).toBe('planned');
    expect(s.plan?.placed).toHaveLength(4);
    expect(s.plan?.unplaced).toHaveLength(1);
  });

  it('a 502 is failed with the route error text', async () => {
    route({ [DECOMPOSE]: () => reply(502, { success: false, error: 'scene decomposition could not run: socket hang up' }) });
    useSceneDressStore.getState().setImage(IMAGE);
    await useSceneDressStore.getState().decompose();
    expect(useSceneDressStore.getState()).toMatchObject({
      status: 'failed',
      error: 'scene decomposition could not run: socket hang up',
      plan: null,
    });
  });

  it('an honest empty 200 is empty with its note, not failed', async () => {
    route({
      [DECOMPOSE]: () =>
        reply(200, {
          success: true,
          data: { props: [], assets: [], composition: { props: [], unplaced: [] }, gate: [], note: 'no movable props in this image' },
        }),
    });
    useSceneDressStore.getState().setImage(IMAGE);
    await useSceneDressStore.getState().decompose();
    expect(useSceneDressStore.getState()).toMatchObject({ status: 'empty', note: 'no movable props in this image', error: null });
  });
});

describe('buildBlockout', () => {
  async function planned() {
    route({ [DECOMPOSE]: () => reply(200, { success: true, data: DRESS_FIXTURE }) });
    useSceneDressStore.getState().setImage(IMAGE);
    await useSceneDressStore.getState().decompose();
    expect(useSceneDressStore.getState().status).toBe('planned');
  }

  it('dispatches once through executeViaMCP and refreshes the tree once on a confirmed receipt', async () => {
    await planned();
    route({ [EXECUTE]: () => reply(200, { success: true, data: { output: 'POF_RESULT={"kind": "blockout", "placed": 4}\n' } }) });
    await useSceneDressStore.getState().buildBlockout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const scripts = useBlenderStore.getState().scripts;
    expect(scripts).toHaveLength(1);
    expect(scripts[0].scriptName).toBe('Block out set dressing (4 props)');
    expect(useSceneDressStore.getState()).toMatchObject({ status: 'built', buildError: null });
    expect(refreshScene).toHaveBeenCalledTimes(1);
  });

  it('a transport error is build-failed with the reason and no refresh', async () => {
    await planned();
    route({
      [EXECUTE]: () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:9876');
      },
    });
    await useSceneDressStore.getState().buildBlockout();
    const s = useSceneDressStore.getState();
    expect(s.status).toBe('build-failed');
    expect(s.buildError).toContain('ECONNREFUSED');
    expect(refreshScene).not.toHaveBeenCalled();
    // the plan survives a failed build so the operator can retry
    expect(s.plan?.placed).toHaveLength(4);
  });

  it('a script that ran without the receipt is unconfirmed, never built', async () => {
    await planned();
    route({ [EXECUTE]: () => reply(200, { success: true, data: { output: 'ok' } }) });
    await useSceneDressStore.getState().buildBlockout();
    expect(useSceneDressStore.getState().status).toBe('unconfirmed');
    expect(useSceneDressStore.getState().buildError).toMatch(/receipt/i);
  });

  it('does nothing without a plan', async () => {
    await useSceneDressStore.getState().buildBlockout();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useBlenderStore.getState().scripts).toHaveLength(0);
  });
});

describe('SceneDressPanel', () => {
  it('shows the placed plan and holds Block out until Blender is connected', async () => {
    route({ [DECOMPOSE]: () => reply(200, { success: true, data: DRESS_FIXTURE }) });
    useSceneDressStore.getState().setImage(IMAGE, 'scene.png');
    await useSceneDressStore.getState().decompose();
    const connection = useBlenderMCPStore.getState().connection;
    useBlenderMCPStore.setState({ connection: { ...connection, connected: false } });

    render(createElement(SceneDressPanel));
    expect(screen.getByRole('img', { name: /4 placed props/ })).toBeTruthy();
    expect(screen.getByText('trading-post-table_0')).toBeTruthy();
    expect(screen.getByText(/Not placed: clay bottle — no support surface/)).toBeTruthy();
    const build = screen.getByRole('button', { name: /Block out in Blender \(4\)/ }) as HTMLButtonElement;
    expect(build.disabled).toBe(true);
    // Rendering the plan spent nothing beyond the one decompose.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
