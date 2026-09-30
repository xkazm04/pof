/**
 * The Style DNA panel's CLAIMS, held against what the code actually does.
 *
 * Three defects this suite exists to keep dead:
 *  1. the toggle read "Applied to prompts" while the flag reached exactly one consumer
 *     (the 3D submit) — the label must name the reach, and the declared reach must
 *     match the real senders;
 *  2. a failed ACTIVATION offered a Retry wired to `distill` — a paid VLM call the user
 *     never asked for;
 *  3. the mood-board intake had no `onerror`, no caps and no unmount guard, so an
 *     unreadable or oversize image silently never appeared.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  StyleDnaPanel,
  MAX_BOARD_IMAGES,
  MAX_BOARD_IMAGE_BYTES,
} from '@/components/modules/visual-gen/asset-forge/StyleDnaPanel';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { Image2DPanel } from '@/components/modules/visual-gen/asset-forge/Image2DPanel';
import {
  STYLE_DNA_REACH,
  STYLE_DNA_SENDERS,
  STYLE_PROMPT_MAX_LENGTH,
  applyStyleFragment,
} from '@/lib/visual-gen/style-dna';
import type { StyleDnaProfile } from '@/lib/visual-gen/style-dna-db';

afterEach(cleanup);

const PROFILE: StyleDnaProfile = {
  id: 'dna-1',
  name: 'Alice gothic',
  dna: {
    palette: ['desaturated teal'],
    materials: ['aged brass'],
    mood: [],
    render: ['painterly'],
    motifs: [],
  },
  sourceImageCount: 4,
  active: true,
  createdAt: '2026-07-13',
};
const OTHER: StyleDnaProfile = { ...PROFILE, id: 'dna-2', name: 'Neon grit', active: false };

const envelope = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
const failure = (error: string, status = 500) => ({
  ok: false,
  status,
  json: async () => ({ success: false, error }),
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  useForgeStore.setState({ activeStyleDna: null, applyStyleDna: true });
  fetchMock = vi.fn(async () => envelope({ active: null, profiles: [] }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const methodsOf = (m: ReturnType<typeof vi.fn>) =>
  m.mock.calls.map((c) => ((c[1] as RequestInit | undefined)?.method ?? 'GET').toUpperCase());

// ---------------------------------------------------------------------------
// 1. The claimed reach vs the ACTUAL senders
// ---------------------------------------------------------------------------

/** Every `src/` file (tests excluded) that READS the apply flag off the forge store. */
function realSenders(): string[] {
  const root = join(process.cwd(), 'src');
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === '__tests__') continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      const rel = full.slice(root.length + 1).replace(/\\/g, '/');
      // The store DEFINES the flag and the panel TOGGLES it; neither injects it into a
      // submitted prompt. A sender is a file that reads it to build a prompt.
      if (rel.endsWith('asset-forge/useForgeStore.ts') || rel.endsWith('asset-forge/StyleDnaPanel.tsx')) continue;
      if (/\bs\.applyStyleDna\b|\bapplyStyleDna\s*&&/.test(readFileSync(full, 'utf8'))) {
        hits.push(`src/${rel}`);
      }
    }
  };
  walk(root);
  return hits.sort();
}

describe('Style DNA reach — the label cannot claim more than the senders deliver', () => {
  it('STYLE_DNA_REACH.senders is exactly the set of files that inject the fragment', () => {
    expect(realSenders()).toEqual([...STYLE_DNA_REACH.senders].sort());
  });

  it('the reach is DERIVED from the sender table: senders, label and note all come from it', () => {
    expect(STYLE_DNA_REACH.senders).toEqual(STYLE_DNA_SENDERS.map((s) => s.file));
    // The 2D forge is a sender now — resolved on the server, canon-aware.
    const twoD = STYLE_DNA_SENDERS.find((s) => s.file.endsWith('asset-forge/Image2DPanel.tsx'));
    expect(twoD).toMatchObject({ path: '2D', resolution: 'server' });
    for (const s of STYLE_DNA_SENDERS) {
      expect(STYLE_DNA_REACH.label).toContain(s.path);
      expect(STYLE_DNA_REACH.note).toContain(s.reaches);
    }
    expect(STYLE_DNA_REACH.label).toBe('2D + 3D prompts');
  });

  it('the label names no path that no sender delivers', () => {
    const paths = new Set(STYLE_DNA_SENDERS.map((s) => s.path));
    for (const p of STYLE_DNA_REACH.label.match(/\b\dD\b/g) ?? []) expect(paths.has(p as '2D' | '3D')).toBe(true);
  });

  it('the toggle renders the reach in its label and the full note beside it', async () => {
    fetchMock.mockResolvedValueOnce(envelope({ active: PROFILE, profiles: [PROFILE] }));
    render(<StyleDnaPanel />);
    const toggle = await screen.findByTestId('style-dna-toggle');
    expect(toggle.textContent).toContain(STYLE_DNA_REACH.label);
    expect(toggle.getAttribute('title')).toBe(STYLE_DNA_REACH.note);

    fireEvent.click(screen.getByRole('button', { name: /project style/i }));
    expect(screen.getByTestId('style-dna-reach').textContent).toBe(STYLE_DNA_REACH.note);
  });
});

describe('the 2D forge sends the flag; the server resolves the style', () => {
  const LEO = { id: 'leonardo', name: 'Leonardo', description: 'cloud', executable: true };
  async function submitFrom2D(styleResult: Record<string, unknown> = {}) {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? envelope({ ok: true, providerId: 'leonardo', providerName: 'Leonardo', url: '/api/visual-gen/image/l.png', name: 'l.png', durationMs: 1, ...styleResult })
        : envelope({ providers: [LEO], defaultProviderId: 'leonardo' }));
    render(<Image2DPanel />);
    await screen.findByTestId('image2d-provider-leonardo');
    fireEvent.change(screen.getByTestId('image2d-prompt'), { target: { value: 'a sword' } });
    fireEvent.click(screen.getByTestId('image2d-submit'));
    await waitFor(() => expect(methodsOf(fetchMock)).toContain('POST'));
    const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST')!;
    return JSON.parse(String((post[1] as RequestInit).body)) as Record<string, unknown>;
  }

  it('case 8: with the switch on and an active style, the 2D submit carries applyStyleDna: true', async () => {
    useForgeStore.setState({ activeStyleDna: PROFILE, applyStyleDna: true });
    const body = await submitFrom2D({ styleDnaApplied: 'Alice gothic', styleDnaWithheld: null, styleDnaDropped: [] });
    expect(body).toEqual({ prompt: 'a sword', providerId: 'leonardo', applyStyleDna: true });
    // The prompt is sent RAW: the server applies the style, the client never pre-renders it.
    expect(String(body.prompt)).not.toContain('In the established project art style');
    expect((await screen.findByTestId('image2d-style-outcome')).textContent).toContain('Alice gothic');
  });

  it('case 8: with the switch off the body is byte-identical to the unstyled request', async () => {
    useForgeStore.setState({ activeStyleDna: PROFILE, applyStyleDna: false });
    const body = await submitFrom2D();
    expect(body).toEqual({ prompt: 'a sword', providerId: 'leonardo' });
    expect(screen.queryByTestId('image2d-style-note')).toBeNull();
  });

  it('with no active style the body stays unstyled even though the switch defaults on', async () => {
    useForgeStore.setState({ activeStyleDna: null, applyStyleDna: true });
    expect(await submitFrom2D()).toEqual({ prompt: 'a sword', providerId: 'leonardo' });
  });

  it('the chips a long prompt drops are named beside the result, not hidden', async () => {
    useForgeStore.setState({ activeStyleDna: PROFILE, applyStyleDna: true });
    await submitFrom2D({ styleDnaApplied: 'Alice gothic', styleDnaDropped: ['1 chip past the 1500-char budget behind a 1490-char prompt: “painterly”'] });
    const outcome = await screen.findByTestId('image2d-style-outcome');
    expect(outcome.textContent).toContain('1500-char budget');
  });
});

// ---------------------------------------------------------------------------
// 2. Prompt-length capping — one helper, both paths
// ---------------------------------------------------------------------------

describe('applyStyleFragment', () => {
  it('caps the COMBINED prompt at the provider ceiling', () => {
    const out = applyStyleFragment('x'.repeat(1400), 'In the established project art style — ' + 'y'.repeat(400));
    expect(out.length).toBe(STYLE_PROMPT_MAX_LENGTH);
  });

  it('leaves the prompt untouched (and uncapped) when there is no fragment', () => {
    const long = 'x'.repeat(2000);
    expect(applyStyleFragment(long, null)).toBe(long);
    expect(applyStyleFragment('a sword', '')).toBe('a sword');
  });

  it('returns an empty prompt untouched rather than a bare style fragment', () => {
    expect(applyStyleFragment('   ', 'In the established project art style — painterly.')).toBe('   ');
  });

  it('honours a caller-supplied ceiling (the Leonardo route passes its own)', () => {
    expect(applyStyleFragment('a sword', 'painterly.', 12).length).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// 3. A retry re-runs the action that failed — never a paid distillation
// ---------------------------------------------------------------------------

describe('Style DNA panel error recovery', () => {
  it("a failed ACTIVATION's retry re-PATCHes and never calls the paid distill endpoint", async () => {
    fetchMock.mockResolvedValueOnce(envelope({ active: PROFILE, profiles: [PROFILE, OTHER] }));
    render(<StyleDnaPanel />);
    await screen.findByText('Alice gothic');
    fireEvent.click(screen.getByRole('button', { name: /project style/i }));

    fetchMock.mockResolvedValueOnce(failure('style-dna PATCH failed: database is locked'));
    fireEvent.click(screen.getByRole('button', { name: /use “neon grit”/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('database is locked');

    fetchMock.mockResolvedValueOnce(envelope({ active: OTHER }));
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(useForgeStore.getState().activeStyleDna?.name).toBe('Neon grit'));
    // THE money assertion: no POST (= no VLM distillation) anywhere in this flow.
    expect(methodsOf(fetchMock)).not.toContain('POST');
    expect(methodsOf(fetchMock).filter((m) => m === 'PATCH')).toHaveLength(2);
  });

  it('a failed LOAD surfaces the reason and its retry re-runs the load, not a distill', async () => {
    fetchMock.mockResolvedValueOnce(failure('style-dna read failed: no such table'));
    render(<StyleDnaPanel />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('no such table');

    fetchMock.mockResolvedValueOnce(envelope({ active: PROFILE, profiles: [PROFILE] }));
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(useForgeStore.getState().activeStyleDna?.name).toBe('Alice gothic'));
    expect(methodsOf(fetchMock)).toEqual(['GET', 'GET']);
  });
});

// ---------------------------------------------------------------------------
// 4. Mood-board intake refuses out loud
// ---------------------------------------------------------------------------

const bigFile = (name: string, size: number) => {
  const f = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('mood-board intake', () => {
  it('an unreadable file surfaces a reason instead of silently never appearing', async () => {
    class FailingFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      error = { message: 'permission denied' };
      result: string | null = null;
      readAsDataURL() {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    vi.stubGlobal('FileReader', FailingFileReader);

    render(<StyleDnaPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('mood-board-input'), {
      target: { files: [new File(['b'], 'broken.png', { type: 'image/png' })] },
    });

    const notice = await screen.findByTestId('style-dna-notice');
    expect(notice.textContent).toContain('broken.png');
    expect(notice.textContent).toContain('permission denied');
  });

  it('an oversize image is refused by name and size, and never reaches the board', async () => {
    render(<StyleDnaPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('mood-board-input'), {
      target: { files: [bigFile('huge.png', MAX_BOARD_IMAGE_BYTES + 1)] },
    });

    const notice = await screen.findByTestId('style-dna-notice');
    expect(notice.textContent).toContain('huge.png');
    expect(notice.textContent).toMatch(/cap/i);
    expect(screen.queryByAltText('mood board image 1')).toBeNull();
  });

  it(`caps the board at ${MAX_BOARD_IMAGES} images and says how many it skipped`, async () => {
    render(<StyleDnaPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const files = Array.from({ length: MAX_BOARD_IMAGES + 2 }, (_, i) =>
      new File(['b'], `m${i}.png`, { type: 'image/png' }),
    );
    fireEvent.change(screen.getByTestId('mood-board-input'), { target: { files } });

    await screen.findByAltText(`mood board image ${MAX_BOARD_IMAGES}`);
    expect(screen.queryByAltText(`mood board image ${MAX_BOARD_IMAGES + 1}`)).toBeNull();
    expect(screen.getByTestId('style-dna-notice').textContent).toContain('2 file(s) skipped');
  });
});
