/**
 * The pitch-intake review panel (spark gtai-uprising-project, WP3): proposals grouped by kind with
 * their pitch quote; Run is disabled with the reason while the pitch is a placeholder; accept/reject
 * PATCH the intake and re-hydrate the canon only on accept; a failed action names its reason; and
 * "Accept all rules" goes through a confirm dialog.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';

const h = vi.hoisted(() => ({ hydrate: vi.fn(async () => {}) }));
vi.mock('@/components/layout-lab/canonStore', () => ({ useCanonStore: { getState: () => ({ hydrate: h.hydrate }) } }));
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: 'font-mock-var' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { CanonIntakePanel, runBlockedReason } from '@/components/layout-lab/canon/canonIntakePanel';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import type { StoredIntakeProposal } from '@/lib/games/intake/types';

const t = LAB_THEMES[0];

const rule = (id: string, status: StoredIntakeProposal['status'] = 'pending'): StoredIntakeProposal => ({
  id, kind: 'rule', gameId: 'gtai', runId: 'run-1', status, sourceSection: `## Section of ${id}`,
  rule: { id: `gtai-${id}`, category: 'game', scope: 'global', title: `Rule ${id}`, body: `Body ${id}`, profile: 'gtai' },
});
const entity: StoredIntakeProposal = {
  id: 'run-1:e1', kind: 'entity', gameId: 'gtai', runId: 'run-1', status: 'pending', sourceSection: '## Cops',
  entity: { catalogId: 'bestiary', entityId: 'gtai-beat-cop', name: 'Beat Cop', tags: ['police'], data: {} },
};

type Reply = { status?: number; body: unknown };
let view: { proposals: StoredIntakeProposal[]; pending: number; pitch: { placeholder: boolean } };
let patchReply: Reply;
let fetchMock: ReturnType<typeof vi.fn>;

const json = ({ status = 200, body }: Reply) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

beforeEach(() => {
  h.hydrate.mockClear();
  view = { proposals: [rule('run-1:r1'), rule('run-1:r2'), entity, rule('run-0:r0', 'rejected')], pending: 3, pitch: { placeholder: true } };
  patchReply = { body: { success: true, data: {} } };
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') return json(patchReply);
    if (init?.method === 'POST') return json({ body: { success: true, data: { inserted: 0 } } });
    return json({ body: { success: true, data: view } });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const patches = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH').map(([, init]) => JSON.parse(init.body));

describe('runBlockedReason', () => {
  it('blocks while loading and on a placeholder pitch, and allows a real pitch', () => {
    expect(runBlockedReason('gtai', null)).toBe('loading the intake');
    expect(runBlockedReason('gtai', { proposals: [], pending: 0, pitch: { placeholder: true } })).toMatch(/games\/gtai\/pitch\.md is a placeholder/);
    expect(runBlockedReason('gtai', { proposals: [], pending: 0, pitch: { placeholder: false } })).toBeNull();
  });
});

describe('CanonIntakePanel', () => {
  it('groups proposals by kind with their pitch quote and actions only while pending', async () => {
    render(<CanonIntakePanel t={t} gameId="gtai" />);
    const rules = await screen.findByTestId('canon-intake-group-rule');
    expect(rules.textContent).toContain('Proposed rules · 3');
    expect(screen.getByTestId('canon-intake-group-entity').textContent).toContain('Beat Cop');
    const rows = screen.getAllByTestId('canon-intake-row');
    const rejected = rows.find((r) => r.getAttribute('data-status') === 'rejected')!;
    expect(within(rejected).queryByTestId('canon-intake-accept')).toBeNull();
    expect(within(rows[0]).getByTestId('canon-intake-source').textContent).toBe('## Section of run-1:r1');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/games/gtai/intake');
  });

  it('disables Run with the reason while the pitch is a placeholder', async () => {
    render(<CanonIntakePanel t={t} gameId="gtai" />);
    await screen.findByTestId('canon-intake-group-rule');
    expect(screen.getByTestId('canon-intake-run').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('canon-intake-run-note').textContent).toBe('no pitch yet: games/gtai/pitch.md is a placeholder');
  });

  it('runs the intake through the server route once a pitch exists', async () => {
    view.pitch.placeholder = false;
    render(<CanonIntakePanel t={t} gameId="gtai" />);
    await waitFor(() => expect(screen.getByTestId('canon-intake-run').hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByTestId('canon-intake-run'));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => u === '/api/games/gtai/intake/run' && i?.method === 'POST')).toBe(true));
  });

  it('accept PATCHes and re-hydrates the canon; reject does not re-hydrate', async () => {
    render(<CanonIntakePanel t={t} gameId="gtai" />);
    await screen.findByTestId('canon-intake-group-rule');
    fireEvent.click(within(screen.getAllByTestId('canon-intake-row')[0]).getByTestId('canon-intake-accept'));
    await waitFor(() => expect(h.hydrate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByTestId('canon-intake-reject')[0].hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getAllByTestId('canon-intake-reject')[0]);
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(patches()).toEqual([{ id: 'run-1:r1', decision: 'accept' }, { id: 'run-1:r1', decision: 'reject' }]);
    expect(h.hydrate).toHaveBeenCalledTimes(1);
  });

  it('names the reason when a decision fails', async () => {
    patchReply = { status: 409, body: { success: false, error: 'Proposal "run-1:r1" is already accepted' } };
    render(<CanonIntakePanel t={t} gameId="gtai" />);
    await screen.findByTestId('canon-intake-group-rule');
    fireEvent.click(screen.getAllByTestId('canon-intake-reject')[0]);
    await waitFor(() => expect(document.body.textContent).toContain('Reject failed: Proposal "run-1:r1" is already accepted'));
  });

  it('accepts every pending rule only after the confirm dialog', async () => {
    render(<CanonIntakePanel t={t} gameId="gtai" />);
    fireEvent.click(await screen.findByTestId('canon-intake-accept-rules'));
    expect(patches()).toEqual([]);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Accept all 2 proposed rules?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept all' }));
    await waitFor(() => expect(patches()).toEqual([{ id: 'run-1:r1', decision: 'accept' }, { id: 'run-1:r2', decision: 'accept' }]));
    await waitFor(() => expect(h.hydrate).toHaveBeenCalled());
  });

  it('says so when there are no proposals', async () => {
    view = { proposals: [], pending: 0, pitch: { placeholder: true } };
    render(<CanonIntakePanel t={t} gameId="gtai" />);
    expect((await screen.findByTestId('canon-intake-empty')).textContent).toBe('no proposals');
    expect(screen.queryByTestId('canon-intake-accept-rules')).toBeNull();
  });
});
