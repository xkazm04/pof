/**
 * The active project is part of the GDD staleness gate's cache key.
 *
 * Wave 12 moved GDD generation to a POST body with an in-memory freshness gate keyed
 * on `(projectName, checklistHash)`. Once the synthesis became project-SCOPED, that
 * key was too narrow in both directions:
 *   • switching projects served the previous project's document from the cache
 *     (RED before this change: the second mount performed ZERO syntheses);
 *   • the generate body carried no project at all, so the server had nothing to
 *     scope with (RED: `projectPath` was undefined in the payload).
 *
 * The project rides the same payload wave 12 introduced — explicitly, never inferred.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { useModuleStore } from '@/stores/moduleStore';
import { useGameDesignDoc, __resetGddDocCache } from '@/hooks/useGameDesignDoc';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const PROJECT_A = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF';
const PROJECT_B = 'C:\\Users\\kazda\\Documents\\Unreal Projects\\jinx';

function doc(title: string): GDDDocument {
  return {
    title,
    generatedAt: '2026-08-19T00:00:00.000Z',
    scope: { projectId: '', scoped: false },
    sections: [{ id: 'overview', title: 'Overview', updatedAt: '2026-08-19T00:00:00.000Z', content: 'x' }],
    stats: {
      totalFeatures: 1, implementedFeatures: 0, checklistTotal: 1, checklistDone: 0,
      levelCount: 0, audioSceneCount: 0, buildCount: 0, evalFindingCount: 0,
    },
  };
}

interface Call { url: string; init?: RequestInit }

function installFetch(): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ success: true, data: doc(`GDD for ${body.projectPath || '(global)'}`) }),
      text: () => Promise.resolve(''),
    });
  }) as unknown as typeof fetch;
  return calls;
}

function generates(calls: Call[]): Record<string, unknown>[] {
  return calls
    .map((c) => (c.init?.body ? JSON.parse(String(c.init.body)) as Record<string, unknown> : {}))
    .filter((b) => b.action === 'generate');
}

/** Mirrors `GameDesignDocView`'s regenerate-on-mount effect. */
function Harness({ name, path }: { name: string; path: string }) {
  const { gdd, generate } = useGameDesignDoc(name, path);
  useEffect(() => { void generate(); }, [generate]);
  return <div data-testid="doc">{gdd ? gdd.title : 'none'}</div>;
}

beforeEach(() => {
  __resetGddDocCache();
  useModuleStore.setState({ checklistProgress: { combat: { a: true } } });
});

describe('useGameDesignDoc — the project is part of the cache key', () => {
  it('regenerates when the project changes, instead of serving the other project\'s document', async () => {
    const calls = installFetch();

    const first = render(<Harness name="Shared Name" path={PROJECT_A} />);
    await waitFor(() => expect(generates(calls)).toHaveLength(1));
    first.unmount();

    // Same display name, different project — the PATH is the identity.
    render(<Harness name="Shared Name" path={PROJECT_B} />);
    await waitFor(() => expect(generates(calls)).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId('doc').textContent).toContain('jinx'));
  });

  it('still costs zero syntheses when nothing moved (wave 12\'s gate survives)', async () => {
    const calls = installFetch();

    const first = render(<Harness name="PoF" path={PROJECT_A} />);
    await waitFor(() => expect(generates(calls)).toHaveLength(1));
    first.unmount();

    render(<Harness name="PoF" path={PROJECT_A} />);
    await waitFor(() => expect(screen.getByTestId('doc').textContent).not.toBe('none'));
    expect(generates(calls)).toHaveLength(1);
  });

  it('does not re-synthesize for a path spelled differently — one project, one document', async () => {
    const calls = installFetch();

    const first = render(<Harness name="PoF" path={PROJECT_A} />);
    await waitFor(() => expect(generates(calls)).toHaveLength(1));
    first.unmount();

    render(<Harness name="PoF" path={PROJECT_A.replace(/\\/g, '/').toUpperCase() + '/'} />);
    await waitFor(() => expect(screen.getByTestId('doc').textContent).not.toBe('none'));
    expect(generates(calls)).toHaveLength(1);
  });

  it('sends the project in the generate body, normalized', async () => {
    const calls = installFetch();

    render(<Harness name="PoF" path={PROJECT_A} />);
    await waitFor(() => expect(generates(calls)).toHaveLength(1));

    expect(generates(calls)[0].projectPath).toBe('c:/users/kazda/documents/unreal projects/pof');
  });

  it('sends the unscoped id when no project is active (the documented global view)', async () => {
    const calls = installFetch();

    render(<Harness name="PoF" path="" />);
    await waitFor(() => expect(generates(calls)).toHaveLength(1));

    expect(generates(calls)[0].projectPath).toBe('');
  });
});
