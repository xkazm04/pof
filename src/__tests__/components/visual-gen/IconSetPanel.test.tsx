/**
 * Icon Set mode — see which entities lack art, plan the sheets, one paid click.
 *
 * Every request is a stub. The guard this suite exists for: rendering, planning and opening
 * the prompt preview issue ZERO requests to the paid route; only the run button does, and it
 * is disabled with the provider's own reason when the server cannot run the sheet provider.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { IconSetPanel } from '@/components/modules/visual-gen/asset-forge/IconSetPanel';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { iconFileBase } from '@/lib/visual-gen/generated-icons';

const CAT = 'bestiary';
const STEP = 'Concept 2D Art';
const iconEntry = (entityId?: string) => {
  const name = `${iconFileBase(CAT, STEP, entityId)}.png`;
  return {
    name,
    slug: name.replace(/\.png$/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase(),
    scope: entityId ? 'entity' : 'step',
    ...(entityId ? { entityId } : {}),
    url: `/api/visual-gen/icon/${name}`,
    mtimeMs: 1,
  };
};

const QWEN_READY = { id: 'qwen-image', name: 'Qwen-Image', description: 'sheets', executable: true };
const QWEN_NO_KEY = {
  id: 'qwen-image', name: 'Qwen-Image', description: 'sheets', executable: false, missingKey: true,
  reason: 'Qwen-Image has no API key on this server — set QWEN_API_KEY or DASHSCOPE_API_KEY and restart.',
};

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const bad = (status: number, error: string, details?: unknown) =>
  new Response(JSON.stringify({ success: false, error, ...(details ? { details } : {}) }), { status, headers: { 'Content-Type': 'application/json' } });

let icons: unknown[];
let sheetAnswers: (() => Response)[];

function mockFetch(provider: unknown) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/visual-gen/contact-sheet')) return sheetAnswers.shift()!();
    if (url.startsWith('/api/catalog/pipelines')) {
      return ok([
        { catalogId: 'spellbook', label: 'Spellbook', category: 'x', description: '', steps: [], entityCount: 0, registered: false },
        { catalogId: CAT, label: 'Bestiary', category: 'x', description: '', steps: [STEP, 'Sprite Render'], entityCount: 5, registered: true },
      ]);
    }
    if (url.startsWith('/api/catalog/entities')) {
      return ok(['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: `${id.toUpperCase()} beast`, lifecycle: 'planned', ueAssets: [], canonProfile: 'pof' })));
    }
    if (url.startsWith('/api/visual-gen/icons')) return ok({ icons });
    if (url.startsWith('/api/visual-gen/generate-2d')) return ok({ providers: [provider], defaultProviderId: 'qwen-image' });
    throw new Error(`unexpected request ${init?.method ?? 'GET'} ${url}`);
  });
  vi.stubGlobal('fetch', fn as unknown as typeof fetch);
  return fn;
}

const sheetCalls = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.filter((c) => String(c[0]).startsWith('/api/visual-gen/contact-sheet'));

beforeEach(() => {
  icons = [iconEntry('a'), iconEntry('b'), iconEntry()];
  sheetAnswers = [];
  useForgeStore.setState({ activeStyleDna: null, applyStyleDna: false });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function coverage() {
  const el = await screen.findByTestId('icon-set-coverage');
  await waitFor(() => expect(el.getAttribute('data-missing')).toBe('3'));
  return el;
}

describe('IconSetPanel — free until the one paid click', () => {
  it('case 6 [guard]: render, plan and preview issue 0 sheet requests; the run is disabled with the provider reason', async () => {
    const fn = mockFetch(QWEN_NO_KEY);
    render(<IconSetPanel />);
    const cov = await coverage();
    expect(cov.getAttribute('data-covered')).toBe('2');
    expect(screen.getByTestId('icon-set-plan').textContent).toContain('2 generations instead of 3');

    fireEvent.click(screen.getByTestId('icon-set-preview-toggle'));
    const preview = await screen.findByTestId('icon-set-preview');
    expect(preview.textContent).toContain('C beast');
    expect(preview.textContent).toContain('2 columns by 1 rows');

    const run = screen.getByTestId('icon-set-run');
    await waitFor(() => expect(screen.getByTestId('icon-set-run-block').textContent).toContain('QWEN_API_KEY'));
    expect(run.hasAttribute('disabled')).toBe(true);
    fireEvent.click(run);
    expect(sheetCalls(fn)).toHaveLength(0);
  });

  it('the step picker shows how many entities lack their own art at each step', async () => {
    mockFetch(QWEN_READY);
    render(<IconSetPanel />);
    await coverage();
    const options = [...(screen.getByTestId('icon-set-step') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toEqual([`${STEP} — 3 of 5 lack art`, 'Sprite Render — 5 of 5 lack art']);
  });

  it('case 7: after a run whose first sheet cut 2 icons, coverage is re-derived from a refetched listing; the uncut sheet stays listed', async () => {
    const fn = mockFetch(QWEN_READY);
    sheetAnswers = [
      () => {
        icons = [...icons, iconEntry('c'), iconEntry('d')];
        return ok({
          ok: true, sheetUrl: '/api/visual-gen/image/s1.png', verdict: { sliceable: true, reasons: [] },
          icons: ['c', 'd'].map((id) => ({ entityId: id, file: `${iconFileBase(CAT, STEP, id)}.png`, url: `/api/visual-gen/icon/${iconFileBase(CAT, STEP, id)}.png` })),
          styleDnaApplied: null, styleDnaWithheld: null, styleDnaDropped: [],
        });
      },
      () => bad(502, 'the sheet was generated but not cut: cell 0 is flat', {
        sheetUrl: '/api/visual-gen/image/s2.png', verdict: { sliceable: false, reasons: ['cell 0 is flat'] },
      }),
    ];
    render(<IconSetPanel />);
    await coverage();
    const run = screen.getByTestId('icon-set-run');
    await waitFor(() => expect(run.hasAttribute('disabled')).toBe(false));
    expect(run.textContent).toContain('2 sheets');
    expect(run.textContent).toContain('3 icons');
    fireEvent.click(run);

    await waitFor(() => expect(screen.getByTestId('icon-set-coverage').getAttribute('data-missing')).toBe('1'));
    expect(sheetCalls(fn)).toHaveLength(2);
    const iconGets = fn.mock.calls.filter((c) => String(c[0]).startsWith('/api/visual-gen/icons'));
    expect(iconGets.length).toBeGreaterThanOrEqual(2);

    const first = screen.getByTestId('icon-set-outcome-0');
    expect(first.getAttribute('data-kind')).toBe('cut');
    const uncut = screen.getByTestId('icon-set-outcome-1');
    expect(uncut.getAttribute('data-kind')).toBe('uncut');
    expect(uncut.innerHTML).toContain('/api/visual-gen/image/s2.png');
    expect(uncut.textContent).toContain('cell 0 is flat');
  });

  it('case 8: with the forge Style DNA switch on, every POSTed sheet body carries applyStyleDna:true (and the canon profile)', async () => {
    useForgeStore.setState({ applyStyleDna: true });
    const fn = mockFetch(QWEN_READY);
    sheetAnswers = [() => bad(502, 'provider down'), () => bad(502, 'provider down')];
    render(<IconSetPanel />);
    await coverage();
    const run = screen.getByTestId('icon-set-run');
    await waitFor(() => expect(run.hasAttribute('disabled')).toBe(false));
    fireEvent.click(run);
    await waitFor(() => expect(sheetCalls(fn)).toHaveLength(2));
    for (const c of sheetCalls(fn)) {
      const body = JSON.parse(String((c[1] as RequestInit).body));
      expect(body.applyStyleDna).toBe(true);
      expect(body.canonProfile).toBe('pof');
    }
  });

  it('the preview labels its Style line as the default only when the switch is off', async () => {
    mockFetch(QWEN_READY);
    render(<IconSetPanel />);
    await coverage();
    fireEvent.click(screen.getByTestId('icon-set-preview-toggle'));
    const line = await screen.findByTestId('icon-set-style-line');
    expect(line.getAttribute('data-style-source')).toBe('default');
    expect(line.textContent).toContain('default');

    useForgeStore.setState({ applyStyleDna: true });
    await waitFor(() => expect(screen.getByTestId('icon-set-style-line').getAttribute('data-style-source')).toBe('style-dna'));
    expect(screen.getByTestId('icon-set-style-line').textContent).toContain('Style DNA');
  });

  it('a brief edited to blank refuses the plan, naming the entity, and nothing can be run', async () => {
    mockFetch(QWEN_READY);
    render(<IconSetPanel />);
    await coverage();
    fireEvent.change(screen.getByTestId('icon-set-brief-d'), { target: { value: '  ' } });
    await waitFor(() => expect(screen.getByTestId('icon-set-run-block').textContent).toContain('"d"'));
    expect(screen.getByTestId('icon-set-run').hasAttribute('disabled')).toBe(true);
  });
});
