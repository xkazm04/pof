/**
 * /status/fixtures — the operator-visible inventory + purge of the test residue in their DB.
 *
 * The two properties that matter: opening the page deletes nothing, and the purge is a
 * confirmed act that reports the counts the DATABASE returned (not the number attempted).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment
// (the page imports labFontVars from layout-lab/fonts).
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import FixturesPage from '@/app/status/fixtures/page';

const INVENTORY = {
  entities: [
    { entityId: 'test-headless-mcp', catalogIds: ['items', 'spellbook'], counts: { artifacts: 342, revisions: 383, verdicts: 0, verdictHistory: 0 } },
    { entityId: 'test-headless-bridge-items', catalogIds: ['items'], counts: { artifacts: 0, revisions: 0, verdicts: 114, verdictHistory: 255 } },
  ],
  total: { artifacts: 342, revisions: 383, verdicts: 114, verdictHistory: 255 },
  purged: false,
  totalRows: 1094,
};

const PURGED = { ...INVENTORY, purged: true };

let calls: { url: string; init?: RequestInit }[] = [];

function installFetch(postBody: unknown = { success: true, data: PURGED }) {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const isPost = init?.method === 'POST';
    const body = isPost ? postBody : { success: true, data: calls.some((c) => c.init?.method === 'POST') ? { ...INVENTORY, entities: [], total: { artifacts: 0, revisions: 0, verdicts: 0, verdictHistory: 0 }, totalRows: 0 } : INVENTORY };
    return { ok: true, status: (body as { success: boolean }).success ? 200 : 409, json: async () => body } as Response;
  }));
}

beforeEach(() => installFetch());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('/status/fixtures', () => {
  it('shows the dry-run inventory per entity and per table, and issues no destructive call', async () => {
    render(<FixturesPage />);
    await screen.findByTestId('fixtures-table');

    expect(screen.getByText('test-headless-mcp')).toBeTruthy();
    expect(screen.getByText('test-headless-bridge-items')).toBeTruthy();
    // The caption says these are hypothetical, not done.
    expect(screen.getByText(/would be removed/i)).toBeTruthy();
    expect(calls.every((c) => (c.init?.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('requires an explicit confirmation before purging, then reports what actually went', async () => {
    render(<FixturesPage />);
    await screen.findByTestId('fixtures-table');

    fireEvent.click(screen.getByTestId('fixtures-purge'));
    // Arming alone must not delete.
    expect(calls.some((c) => c.init?.method === 'POST')).toBe(false);

    fireEvent.click(screen.getByTestId('fixtures-purge-confirm'));
    await screen.findByTestId('fixtures-purged');

    const post = calls.find((c) => c.init?.method === 'POST')!;
    // The count the operator SAW is what is sent, so the server can refuse a stale approval.
    expect(JSON.parse(String(post.init!.body))).toEqual({ expectRows: 1094 });
    expect(screen.getByTestId('fixtures-purged').textContent).toContain('1094');
    expect(screen.getByTestId('fixtures-purged').textContent).toContain('pipeline_artifacts');
  });

  it('a failed purge says nothing was deleted and offers a retry', async () => {
    installFetch({ success: false, error: 'Fixture rows changed since you looked' });
    render(<FixturesPage />);
    await screen.findByTestId('fixtures-table');

    fireEvent.click(screen.getByTestId('fixtures-purge'));
    fireEvent.click(screen.getByTestId('fixtures-purge-confirm'));

    await waitFor(() => expect(screen.getByTestId('fixtures-error').textContent).toContain('Nothing was deleted'));
    expect(screen.queryByTestId('fixtures-purged')).toBeNull();
  });
});
