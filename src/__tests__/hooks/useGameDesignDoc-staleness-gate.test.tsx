import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, renderHook, screen, waitFor, cleanup, act } from '@testing-library/react';
import { useModuleStore } from '@/stores/moduleStore';
import { useGameDesignDoc, __resetGddDocCache } from '@/hooks/useGameDesignDoc';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function doc(title: string): GDDDocument {
  return {
    title,
    generatedAt: '2026-08-18T00:00:00.000Z',
    sections: [{ id: 'overview', title: 'Overview', updatedAt: '2026-08-18T00:00:00.000Z', content: 'x' }],
    stats: {
      totalFeatures: 1, implementedFeatures: 0, checklistTotal: 1, checklistDone: 0,
      levelCount: 0, audioSceneCount: 0, buildCount: 0, evalFindingCount: 0,
    },
  };
}

interface Call { url: string; init?: RequestInit }

/** Records every call so syntheses can be counted per tab-flip sequence. */
function installFetch(): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const action = init?.body ? JSON.parse(String(init.body)).action : 'generate';
    const data =
      action === 'export-markdown' ? { markdown: '# md' }
        : action === 'export-pitch' ? { html: '<html></html>' }
          : doc('PoF GDD');
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ success: true, data }),
      text: () => Promise.resolve(''),
    });
  }) as unknown as typeof fetch;
  return calls;
}

/** Counts only the calls that cost a server-side `synthesizeGDD`. */
function syntheses(calls: Call[]): number {
  return calls.filter((c) => {
    if (c.url.includes('checklist=')) return true; // legacy GET synthesis
    if (!c.init?.body) return c.url.includes('/api/game-design-doc');
    const action = JSON.parse(String(c.init.body)).action;
    return action === 'generate' || action === undefined;
  }).length;
}

/** Mirrors `GameDesignDocView`'s regenerate-on-mount effect (index.tsx:32-34). */
function Harness({ project }: { project: string }) {
  const { gdd, generate } = useGameDesignDoc(project);
  useEffect(() => { void generate(); }, [generate]);
  return <div data-testid="doc">{gdd ? gdd.title : 'none'}</div>;
}

/** The same mount effect, exposed through `renderHook` for direct API calls. */
function useMountedDoc() {
  const api = useGameDesignDoc('PoF');
  const { generate } = api;
  useEffect(() => { void generate(); }, [generate]);
  return api;
}

beforeEach(() => {
  __resetGddDocCache();
  useModuleStore.setState({ checklistProgress: { combat: { a: true } } });
});

describe('useGameDesignDoc — staleness gate', () => {
  it('performs zero synthesis when a tab flip remounts an unchanged GDD', async () => {
    const calls = installFetch();

    const first = render(<Harness project="PoF" />);
    await waitFor(() => expect(screen.getByTestId('doc').textContent).toBe('PoF GDD'));
    expect(syntheses(calls)).toBe(1);

    // Tab away (the view is conditionally rendered → unmount) and back, twice.
    first.unmount();
    const second = render(<Harness project="PoF" />);
    await waitFor(() => expect(screen.getByTestId('doc').textContent).toBe('PoF GDD'));
    second.unmount();
    render(<Harness project="PoF" />);
    await waitFor(() => expect(screen.getByTestId('doc').textContent).toBe('PoF GDD'));

    expect(syntheses(calls)).toBe(1);
  });

  it('re-generates when the checklist changed while the view was away', async () => {
    const calls = installFetch();

    const first = render(<Harness project="PoF" />);
    await waitFor(() => expect(syntheses(calls)).toBe(1));
    first.unmount();

    act(() => { useModuleStore.setState({ checklistProgress: { combat: { a: true, b: true } } }); });

    render(<Harness project="PoF" />);
    await waitFor(() => expect(syntheses(calls)).toBe(2));
  });

  it('re-generates when the project changed', async () => {
    const calls = installFetch();

    const first = render(<Harness project="PoF" />);
    await waitFor(() => expect(syntheses(calls)).toBe(1));
    first.unmount();

    render(<Harness project="Other" />);
    await waitFor(() => expect(syntheses(calls)).toBe(2));
  });

  it('forces a fresh synthesis when Refresh passes force', async () => {
    const calls = installFetch();
    const { result } = renderHook(useMountedDoc);

    await waitFor(() => expect(syntheses(calls)).toBe(1));
    await act(async () => { await result.current.generate(true); });
    expect(syntheses(calls)).toBe(2);
  });

  it('sends the checklist in a POST body, never in the query string', async () => {
    const calls = installFetch();

    render(<Harness project="PoF" />);
    await waitFor(() => expect(syntheses(calls)).toBe(1));

    const gen = calls[0];
    expect(gen.url).toBe('/api/game-design-doc');
    expect(gen.url).not.toContain('checklist=');
    expect(gen.init?.method).toBe('POST');
    const body = JSON.parse(String(gen.init?.body));
    expect(body.action).toBe('generate');
    expect(body.projectName).toBe('PoF');
    expect(body.checklist).toEqual({ combat: { a: true } });
  });
});

describe('useGameDesignDoc — exports reuse one document instance', () => {
  it('posts the in-memory document for both exports instead of re-synthesizing', async () => {
    const calls = installFetch();
    const { result } = renderHook(useMountedDoc);

    await waitFor(() => expect(result.current.gdd).not.toBeNull());
    const rendered = result.current.gdd!;

    await act(async () => { await result.current.exportMarkdown(rendered); });
    await act(async () => { await result.current.exportPitch(rendered); });

    // Still exactly one synthesis: the exports formatted the document we hold.
    expect(syntheses(calls)).toBe(1);

    const bodies = calls.slice(1).map((c) => JSON.parse(String(c.init?.body)));
    expect(bodies.map((b) => b.action)).toEqual(['export-markdown', 'export-pitch']);
    for (const b of bodies) {
      expect(b.document).toEqual(rendered);
      expect(b.checklist).toBeUndefined();
    }
  });
});
