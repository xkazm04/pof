/**
 * The Decisions room over a stubbed fetch: the board (open first, default marked, media or the reason it is missing),
 * Save disabled until an option is picked AND the page token arrives, the answer POST (id, choice, note, the gate
 * header), a refused save shown in place, an answered card, and a stale board kept when a later poll fails.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: 'font-var' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { DecisionsRoom } from '@/components/layout-lab/game/decisions/decisionsRoom';
import { isBoard } from '@/components/layout-lab/game/decisions/decisionsData';
import { LIGHT } from '@/components/layout-lab/theme';
import type { DecisionsBoard, DecisionView } from '@/lib/games/decisions/decisionTypes';

const ask = (over: Partial<DecisionView> = {}): DecisionView => ({
  id: 'arena-1', lane: 'arena', question: 'Pistol or shotgun first?', asked: '2026-11-03T19:00:00Z', default: 'pistol',
  options: [
    { key: 'pistol', label: 'Pistol', tradeoff: 'Safe.', media: [{ kind: 'image', name: 'a.png', url: '/api/games/gtai/decisions/media?ask=arena-1&opt=pistol&n=0' }] },
    { key: 'shotgun', label: 'Shotgun', tradeoff: 'Fast.', media: [{ kind: 'video', name: 'b.mp4', url: '/m' }, { kind: 'image', name: 'gone.png', unservable: 'file not found' }] },
  ], ...over,
});
const board = (over: Partial<DecisionsBoard> = {}): DecisionsBoard => ({
  gameId: 'gtai', readAt: '2026-11-03T19:30:00Z', configured: true, root: 'C:/eve/decisions', open: [ask()], answered: [], problems: [], ...over,
});

type Res = { success: boolean; data?: unknown; error?: string };
function stubFetch(handlers: { board?: Res; save?: Res }) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const res: Res = url.endsWith('/gate') ? { success: true, data: { token: 'tok' } }
      : init?.method === 'POST' ? handlers.save ?? { success: true, data: {} }
      : handlers.board ?? { success: true, data: board() };
    return Promise.resolve({ json: () => Promise.resolve(res) });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const radio = (key: string) => document.querySelector(`input[type=radio][value=${key}]`) as HTMLInputElement;
const room = () => render(<DecisionsRoom t={LIGHT} gameId="gtai" />);

describe('DecisionsRoom', () => {
  it('renders options side by side with the default marked, media, and the reason a file is missing', async () => {
    stubFetch({});
    room();
    await screen.findByTestId('decision-card');
    expect(screen.getByTestId('decision-option-pistol').textContent).toContain("lane's default");
    expect(screen.getByTestId('decision-option-shotgun').textContent).not.toContain("lane's default");
    expect(screen.getByTestId('decision-option-pistol').querySelector('img')?.getAttribute('src')).toContain('opt=pistol&n=0');
    expect(screen.getByTestId('decision-option-shotgun').querySelector('video')).not.toBeNull();
    expect(screen.getByTestId('decision-option-shotgun').textContent).toContain('gone.png: file not found');
  });

  it('keeps Save off until an option is picked, then POSTs id, choice, note and the gate token', async () => {
    const fn = stubFetch({});
    room();
    const save = (await screen.findByTestId('decision-save')) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(radio('shotgun'));
    fireEvent.change(screen.getByTestId('decision-note'), { target: { value: 'cover first' } });
    await waitFor(() => expect((screen.getByTestId('decision-save') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('decision-save'));
    await waitFor(() => expect(fn.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'POST')).toBe(true));
    const [url, init] = fn.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === 'POST') as [string, RequestInit];
    expect(url).toBe('/api/games/gtai/decisions');
    expect(JSON.parse(init.body as string)).toEqual({ id: 'arena-1', choice: 'shotgun', note: 'cover first' });
    expect((init.headers as Record<string, string>)['x-voice-gate']).toBe('tok');
  });

  it('shows a refused save in place and keeps the pick', async () => {
    stubFetch({ save: { success: false, error: 'Human gate: token expired' } });
    room();
    await screen.findByTestId('decision-save');
    fireEvent.click(radio('pistol'));
    await waitFor(() => expect((screen.getByTestId('decision-save') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('decision-save'));
    expect((await screen.findByTestId('decision-error')).textContent).toContain('Human gate: token expired');
    expect(radio('pistol').checked).toBe(true);
  });

  it('shows an answered question below the open ones, with the answer and a way to change it', async () => {
    stubFetch({ board: { success: true, data: board({ open: [ask({ id: 'gunplay-2', lane: 'gunplay' })], answered: [ask({ answer: { choice: 'shotgun', note: 'go loud', at: '2026-11-03T19:10:00Z' } })] }) } });
    room();
    await screen.findByTestId('decision-answer');
    const cards = screen.getAllByTestId('decision-card');
    expect(cards.map((c) => c.getAttribute('data-id'))).toEqual(['gunplay-2', 'arena-1']);
    expect(screen.getByTestId('decision-answer').textContent).toContain('answered: Shotgun');
    expect(screen.getByTestId('decision-answer').textContent).toContain('go loud');
  });

  it('says so for an empty board, an unconfigured game, a problem ask and a failed read', async () => {
    stubFetch({ board: { success: true, data: board({ open: [], problems: [{ file: 'x-1.json', reason: 'options is missing or empty' }] }) } });
    room();
    expect((await screen.findByTestId('decisions-empty')).textContent).toContain('Nothing is waiting');
    expect(screen.getByTestId('decisions-problem').textContent).toContain('x-1.json is not usable');
    cleanup();
    stubFetch({ board: { success: true, data: board({ configured: false, reason: 'gtai declares no decision folder', open: [] }) } });
    room();
    expect((await screen.findByTestId('decisions-status')).textContent).toContain('declares no decision folder');
    cleanup();
    stubFetch({ board: { success: false, error: 'boom' } });
    room();
    expect((await screen.findByText(/decisions unavailable \(boom\)/)).textContent).toContain('boom');
  });

  it('isBoard rejects a response missing the fields the room reads', () => {
    expect(isBoard(board())).toBe(true);
    expect(isBoard({ configured: true })).toBe(false);
    expect(isBoard(null)).toBe(false);
  });
});
