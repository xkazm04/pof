/**
 * `UeImportPanel` — the human-reachable end of the import chain.
 *
 * What is pinned here is the honesty of the card, not the styling: `use` must never be
 * pre-selected; the plan and the replace verdict are PREVIEWED (a read-only route) before the
 * one explicit Send; Send posts exactly the previewed tuple, so an edit after the preview
 * disables it until a new preview returns; and the collision the panel REQUESTED must never
 * be rendered as the collision it OBSERVED.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { UeImportPanel } from '@/components/modules/visual-gen/asset-forge/UeImportPanel';
import { useForgeStore, type GenerationJob } from '@/components/modules/visual-gen/asset-forge/useForgeStore';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  useForgeStore.setState({ jobs: [] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useForgeStore.setState({ jobs: [] }); });

const ok = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
const fail = (error: string) => ({ ok: false, json: async () => ({ success: false, error }) });

const PLAN_URL = '/api/visual-gen/ue-import/plan';
const IMPORT_URL = '/api/visual-gen/ue-import';

/** A plan answer for `name` — measured, 3 shells, convex, new unless `replaces` says so. */
const planFor = (name: string, over: Record<string, unknown> = {}) => ({
  collision: { kind: 'convex', hullCount: 6, maxHullVerts: 16, reason: '3 shells — convex decomposition' },
  planBasis: 'measured',
  shells: 3,
  scale: { derivable: false, basis: 'no-target', reason: 'no target — imports at its delivered size' },
  destPath: `/Game/Generated/${name}`,
  assetPath: `/Game/Generated/${name}/${name}`,
  replaces: false,
  ...over,
});

/** Route the fetch mock by URL: the plan answers `planOver`, the import starts j1, status answers `status`. */
function routes(opts: { planOver?: Record<string, unknown>; status?: Record<string, unknown>; startError?: string } = {}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === PLAN_URL) {
      const body = JSON.parse(String(init?.body));
      return ok(planFor(body.assetName, opts.planOver));
    }
    if (url === IMPORT_URL) return opts.startError ? fail(opts.startError) : ok({ jobId: 'j1' });
    return ok(opts.status ?? { status: 'running' });
  });
}

const calls = (url: string) => fetchMock.mock.calls.filter(([u]) => u === url);
const submit = () => screen.getByTestId('ue-import-submit') as HTMLButtonElement;

/** Type a path + name and pick a use, then wait for the preview to answer. */
async function fill(glb: string, name: string, use: 'blocking' | 'decorative' | 'character') {
  fireEvent.change(screen.getByTestId('ue-import-glb'), { target: { value: glb } });
  fireEvent.change(screen.getByTestId('ue-import-name'), { target: { value: name } });
  fireEvent.click(screen.getByTestId(`ue-import-use-${use}`));
  await screen.findByTestId('ue-import-preview', {}, { timeout: 5_000 });
  await waitFor(() => expect(submit().disabled).toBe(false));
}

const delivered: GenerationJob = {
  id: 'job-crate',
  mode: 'text-to-3d',
  prompt: 'a rusty iron-bound crate, game ready',
  providerId: 'tripo3d',
  status: 'completed',
  progress: 100,
  createdAt: 1,
  accepted: true,
  assetClass: 'prop',
  meshPath: 'C:/p/generated/tripo3d/crate.glb',
  finish: { state: 'done', summary: 'decimated', improved: true, meshPath: 'C:/p/generated/mesh-finish/crate_lowpoly.glb' },
};

describe('UeImportPanel — pick, preview, then Send', () => {
  it('pre-selects NO use — collision has no safe default', () => {
    render(<UeImportPanel />);
    for (const id of ['blocking', 'decorative', 'character']) {
      expect(screen.getByTestId(`ue-import-use-${id}`).getAttribute('aria-pressed')).toBe('false');
    }
    expect(screen.getByTestId('ue-import-use-hint').textContent).toMatch(/pick one/i);
  });

  it('picking a delivery fills path + SM_ name, pre-selects no use, and previews the plan before any import POST', async () => {
    routes();
    useForgeStore.setState({ jobs: [delivered] });
    render(<UeImportPanel />);

    fireEvent.change(screen.getByTestId('ue-import-candidate'), { target: { value: 'job-crate' } });
    expect((screen.getByTestId('ue-import-glb') as HTMLInputElement).value).toBe('C:/p/generated/mesh-finish/crate_lowpoly.glb');
    expect((screen.getByTestId('ue-import-name') as HTMLInputElement).value).toBe('SM_RustyIronBoundCrate');
    for (const id of ['blocking', 'decorative', 'character']) {
      expect(screen.getByTestId(`ue-import-use-${id}`).getAttribute('aria-pressed')).toBe('false');
    }
    expect(submit().disabled).toBe(true);

    fireEvent.click(screen.getByTestId('ue-import-use-blocking'));
    const preview = await screen.findByTestId('ue-import-preview', {}, { timeout: 5_000 });
    expect(preview.textContent).toMatch(/convex/);
    expect(preview.textContent).toMatch(/3 shell\(s\)/);
    expect(preview.textContent).toMatch(/MEASURED/);
    expect(calls(PLAN_URL)).toHaveLength(1);
    expect(JSON.parse(String(calls(PLAN_URL)[0][1]?.body))).toMatchObject({ assetClass: 'prop', use: 'blocking' });
    expect(calls(IMPORT_URL)).toHaveLength(0);

    await waitFor(() => expect(submit().disabled).toBe(false));
    fireEvent.click(submit());
    await waitFor(() => expect(calls(IMPORT_URL)).toHaveLength(1));
    expect(JSON.parse(String(calls(IMPORT_URL)[0][1]?.body))).toEqual({
      glbPath: 'C:/p/generated/mesh-finish/crate_lowpoly.glb',
      use: 'blocking',
      assetName: 'SM_RustyIronBoundCrate',
      destPath: '/Game/Generated/SM_RustyIronBoundCrate',
      assetClass: 'prop',
    });
  });

  it('a delivery that did not pass is offered with its verdict, never as a pass', () => {
    useForgeStore.setState({ jobs: [{ ...delivered, accepted: false }] });
    render(<UeImportPanel />);
    fireEvent.change(screen.getByTestId('ue-import-candidate'), { target: { value: 'job-crate' } });
    expect(screen.getByTestId('ue-import-candidate-verdict').textContent).toMatch(/REJECTED/);
  });

  it('replaces:true keeps Send disabled until the operator ticks the replace', async () => {
    routes({ planOver: { replaces: true, replacesReason: '2 file(s) already under the folder — SM_Crate.uasset, T_Base.uasset' } });
    render(<UeImportPanel />);
    fireEvent.change(screen.getByTestId('ue-import-glb'), { target: { value: 'a.glb' } });
    fireEvent.change(screen.getByTestId('ue-import-name'), { target: { value: 'SM_Crate' } });
    fireEvent.click(screen.getByTestId('ue-import-use-blocking'));
    await screen.findByTestId('ue-import-preview', {}, { timeout: 5_000 });
    const tick = await screen.findByLabelText('Replace /Game/Generated/SM_Crate');
    expect(submit().disabled).toBe(true);
    fireEvent.click(tick);
    expect(submit().disabled).toBe(false);
  });

  it('replaces:false enables Send once a use is picked', async () => {
    routes();
    render(<UeImportPanel />);
    await fill('a.glb', 'SM_Crate', 'blocking');
    expect(screen.queryByLabelText('Replace /Game/Generated/SM_Crate')).toBeNull();
  });

  it('a blank name is never submitted as an absent assetName — no preview, Send disabled', async () => {
    routes();
    render(<UeImportPanel />);
    fireEvent.change(screen.getByTestId('ue-import-glb'), { target: { value: 'a.glb' } });
    fireEvent.click(screen.getByTestId('ue-import-use-blocking'));
    await new Promise((r) => setTimeout(r, 700));
    expect(calls(PLAN_URL)).toHaveLength(0);
    expect(submit().disabled).toBe(true);
    fireEvent.click(submit());
    expect(calls(IMPORT_URL)).toHaveLength(0);
  });

  it('editing the name after the preview disables Send until a new preview returns', async () => {
    let release: (() => void) | null = null;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (url === PLAN_URL && body.assetName === 'SM_Crate2') {
        await new Promise<void>((r) => { release = r; });
      }
      return ok(planFor(body.assetName));
    });
    render(<UeImportPanel />);
    await fill('a.glb', 'SM_Crate', 'blocking');

    fireEvent.change(screen.getByTestId('ue-import-name'), { target: { value: 'SM_Crate2' } });
    expect(submit().disabled).toBe(true);
    await waitFor(() => expect(release).not.toBeNull(), { timeout: 5_000 });
    expect(submit().disabled).toBe(true);
    release!();
    await waitFor(() => expect(submit().disabled).toBe(false));
    expect(screen.getByTestId('ue-import-preview').textContent).toMatch(/SM_Crate2\/SM_Crate2/);
  });

  it('a refused preview says why and keeps Send disabled', async () => {
    fetchMock.mockResolvedValue(fail('no file at a.glb'));
    render(<UeImportPanel />);
    fireEvent.change(screen.getByTestId('ue-import-glb'), { target: { value: 'a.glb' } });
    fireEvent.change(screen.getByTestId('ue-import-name'), { target: { value: 'SM_A' } });
    fireEvent.click(screen.getByTestId('ue-import-use-blocking'));
    await waitFor(() => expect(screen.getByTestId('ue-import-preview-error').textContent).toMatch(/no file at/));
    expect(submit().disabled).toBe(true);
  });
});

describe('UeImportPanel — the import result', () => {
  it('renders the observed element count separately from the requested plan', async () => {
    routes({
      status: {
        status: 'done',
        glbPath: 'a.glb',
        use: 'blocking',
        assetPath: '/Game/Generated/Chair/Chair.Chair',
        collision: { kind: 'convex', hullCount: 6, maxHullVerts: 16, reason: '4 shells — convex decomposition' },
        planBasis: 'measured',
        shells: 4,
        collisionElements: 7,
      },
    });
    render(<UeImportPanel />);
    await fill('a.glb', 'Chair', 'blocking');
    fireEvent.click(submit());

    const card = await screen.findByTestId('ue-import-result', {}, { timeout: 10_000 });
    expect(screen.getByTestId('ue-import-verdict').textContent).toMatch(/IMPORTED/);
    expect(screen.getByTestId('ue-import-plan').textContent).toMatch(/convex/);
    expect(screen.getByTestId('ue-import-plan').textContent).toMatch(/MEASURED/i);
    // The observation is its own line, with its own number.
    expect(card.textContent).toMatch(/7 ELEM/);
  }, 15_000);

  it('a requested collision that was never counted reads NOT COUNTED, not silence', async () => {
    routes({
      status: {
        status: 'error',
        glbPath: 'a.glb',
        use: 'blocking',
        collision: { kind: 'simple', shape: 'BOX', reason: 'single-shell mesh' },
        planBasis: 'measured',
        shells: 1,
        collisionElements: null,
        error: 'the mesh reported no body_setup count',
      },
    });
    render(<UeImportPanel />);
    await fill('a.glb', 'A', 'blocking');
    fireEvent.click(submit());

    const card = await screen.findByTestId('ue-import-result', {}, { timeout: 10_000 });
    expect(card.textContent).toMatch(/NOT COUNTED/);
    expect(screen.getByTestId('ue-import-verdict').textContent).toMatch(/FAILED/);
  }, 15_000);

  it('a decorative import shows "none requested", not a red NOT COUNTED', async () => {
    routes({
      planOver: { collision: { kind: 'none', reason: 'decorative asset — no collision at all' }, planBasis: 'not-needed', shells: null },
      status: {
        status: 'done',
        glbPath: 'sign.glb',
        use: 'decorative',
        assetPath: '/Game/Generated/Sign/Sign.Sign',
        collision: { kind: 'none', reason: 'decorative asset — no collision at all' },
        planBasis: 'not-needed',
        shells: null,
        collisionElements: null,
      },
    });
    render(<UeImportPanel />);
    await fill('sign.glb', 'Sign', 'decorative');
    fireEvent.click(submit());

    const card = await screen.findByTestId('ue-import-result', {}, { timeout: 10_000 });
    expect(card.textContent).toMatch(/none requested/);
    expect(card.textContent).not.toMatch(/NOT COUNTED/);
  }, 15_000);

  it('surfaces an assumed plan as such when the critic could not run', async () => {
    routes({
      status: {
        status: 'done',
        glbPath: 'a.glb',
        use: 'blocking',
        assetPath: '/Game/x.x',
        collision: { kind: 'simple', shape: 'BOX', reason: 'single-shell — ASSUMED: the geometry critic did not run' },
        planBasis: 'assumed',
        shells: null,
        collisionElements: 1,
        critiqueUnavailable: true,
        critiqueError: 'trimesh not installed',
      },
    });
    render(<UeImportPanel />);
    await fill('a.glb', 'A', 'blocking');
    fireEvent.click(submit());

    await screen.findByTestId('ue-import-result', {}, { timeout: 10_000 });
    expect(screen.getByTestId('ue-import-plan').textContent).toMatch(/ASSUMED/i);
    expect(screen.getByTestId('ue-import-critique-unavailable').textContent).toMatch(/trimesh not installed/);
  }, 15_000);

  it('reports a start failure instead of leaving the button spinning', async () => {
    routes({ startError: 'no file at a.glb' });
    render(<UeImportPanel />);
    await fill('a.glb', 'A', 'blocking');
    fireEvent.click(submit());

    await waitFor(() => expect(screen.getByTestId('ue-import-error').textContent).toMatch(/no file at/));
    expect(submit().disabled).toBe(false);
  });
});
