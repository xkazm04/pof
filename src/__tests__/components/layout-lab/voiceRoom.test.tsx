/**
 * The GTAI Voice room over a URL-routed stubbed fetch: the queue groups lines by quest in play order
 * with per-quest proven counts, the selected line shows its takes, and Approve sends the verdict WITH
 * the page's gate token in `x-voice-gate` (the human gate's client half). Plain DOM, own cleanup.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: 'font-var' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { VoiceRoom } from '@/components/layout-lab/game/voice/voiceRoom';
import { groupByQuest } from '@/components/layout-lab/game/voice/voiceQueue';
import { VOICE_GATE_HEADER } from '@/components/layout-lab/game/voice/voiceGateClient';
import { LIGHT } from '@/components/layout-lab/theme';
import type { QueueEntry } from '@/lib/voice/types';

const entry = (questId: string, lineId: string, questOrder: number, lineOrder: number, state: QueueEntry['state'] = 'no-takes'): QueueEntry => ({
  gameId: 'gtai', questId, lineId, speaker: 'rivet', text: `${lineId} text`, textHash: 'h', purpose: ['funny'], questOrder, lineOrder,
  lineClass: lineId === 'a1' ? 'bark' : 'story', when: lineId === 'a1' ? ['static-whisper-burst'] : [],
  beatId: 'b1', beatTitle: 'Line Stopped', beatSummary: 'Rivet hides in a dumpster while the heat drains.',
  present: true, syncedAt: 0, state, takes: state === 'no-takes' ? 0 : 1, pending: state === 'awaiting-verdict' ? 1 : 0, approvedTakeId: null,
});

const QUEUE = [entry('first-quest', 'a1', 0, 0, 'awaiting-verdict'), entry('first-quest', 'a2', 0, 1), entry('second-quest', 'b1', 1, 0, 'proven')];
const STATE = {
  status: {
    proven: 1, total: 3, chars: 120, next: [QUEUE[0], QUEUE[1]],
    quests: [{ questId: 'first-quest', title: 'First', questOrder: 0, proven: 0, total: 2 }, { questId: 'second-quest', title: 'Second', questOrder: 1, proven: 1, total: 1 }],
  },
  queue: QUEUE,
  voices: [],
};
const TAKE = {
  id: 'take-1', gameId: 'gtai', questId: 'first-quest', lineId: 'a1', voiceId: 'v1', providerVoiceId: 'p1', textHash: 'h', direction: 'whispered, fast',
  sentText: '[whispered] [fast] a1 text', settings: { model: 'eleven_v3', stability: 0.5, similarityBoost: 0.75, style: 0.3, speed: 1 },
  durationMs: 2100, loudnessLufs: -18.2, chars: 26, verdict: 'pending', verdictNote: null, verdictAt: null, createdAt: 1, stale: false,
};
const DETAIL = { line: QUEUE[0], bible: '# Voice bible: Rivet', takes: [TAKE], history: [], voices: [] };

const ok = (data: unknown) => Promise.resolve({ json: () => Promise.resolve({ success: true, data }) });

function stubRoutes() {
  const fn = vi.fn((url: string) => {
    if (url.endsWith('/voice/gate')) return ok({ token: 'TOKEN-123', expiresAt: Date.now() + 600_000 });
    if (url.includes('/voice/lines?')) return ok(DETAIL);
    if (url.endsWith('/voice/takes/verdict')) return ok({ take: { ...TAKE, verdict: 'approved' } });
    if (url.endsWith('/voice')) return ok(STATE);
    return Promise.resolve({ json: () => Promise.resolve({ success: false, error: `unrouted ${url}` }) });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Voice room', () => {
  it('groupByQuest keeps play order and contiguous quests', () => {
    expect(groupByQuest(QUEUE).map((g) => [g.questId, g.lines.map((l) => l.lineId)])).toEqual([
      ['first-quest', ['a1', 'a2']], ['second-quest', ['b1']],
    ]);
  });

  it('renders the queue grouped by quest in order with proven counts', async () => {
    stubRoutes();
    render(<VoiceRoom t={LIGHT} />);
    await waitFor(() => expect(screen.getAllByTestId('voice-quest').length).toBe(2));
    const quests = screen.getAllByTestId('voice-quest');
    expect(quests.map((q) => q.getAttribute('data-quest'))).toEqual(['first-quest', 'second-quest']);
    expect(quests[0].textContent).toContain('0/2 proven');
    expect(quests[1].textContent).toContain('1/1 proven');
    expect(screen.getAllByTestId('voice-queue-line').map((b) => b.getAttribute('data-line'))).toEqual(['a1', 'a2', 'b1']);
    expect(screen.getByTestId('voice-status').textContent).toContain('1 / 3 lines proven');
  });

  it('Approve posts the verdict with the page gate token header and the note', async () => {
    const fetchFn = stubRoutes();
    render(<VoiceRoom t={LIGHT} />);
    await waitFor(() => expect(screen.queryByTestId('voice-take')).not.toBeNull());
    const approve = screen.getByTestId('voice-approve') as HTMLButtonElement;
    await waitFor(() => expect(approve.disabled).toBe(false));
    const note = screen.getByTestId('voice-verdict-note') as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: 'perfect panic' } });
    fireEvent.click(approve);
    await waitFor(() => expect(fetchFn.mock.calls.some(([u]) => String(u).endsWith('/voice/takes/verdict'))).toBe(true));
    const [, init] = fetchFn.mock.calls.find(([u]) => String(u).endsWith('/voice/takes/verdict'))! as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)[VOICE_GATE_HEADER]).toBe('TOKEN-123');
    expect(VOICE_GATE_HEADER).toBe('x-voice-gate');
    expect(JSON.parse(String(init.body))).toEqual({ takeId: 'take-1', verdict: 'approved', note: 'perfect panic' });
  });

  it('marks barks in the queue and shows the line class and its scene', async () => {
    stubRoutes();
    render(<VoiceRoom t={LIGHT} />);
    await waitFor(() => expect(screen.queryByTestId('voice-line-context')).not.toBeNull());
    expect(screen.getAllByTestId('voice-line-class')).toHaveLength(1);
    const ctx = screen.getByTestId('voice-line-context');
    expect(ctx.getAttribute('data-class')).toBe('bark');
    expect(ctx.textContent).toContain('when: static-whisper-burst');
    expect(screen.getByTestId('voice-line-beat').textContent).toContain('Scene: Line Stopped');
  });

  it('shows the no-clone note in Cast', async () => {
    stubRoutes();
    render(<VoiceRoom t={LIGHT} />);
    await waitFor(() => expect(screen.getAllByTestId('voice-quest').length).toBe(2));
    fireEvent.click(screen.getByRole('tab', { name: /Cast/ }));
    await waitFor(() => expect(screen.queryByTestId('voice-gate-note')).not.toBeNull());
    expect(screen.getByTestId('voice-gate-note').textContent).toContain('Never imitate or clone');
  });
});
