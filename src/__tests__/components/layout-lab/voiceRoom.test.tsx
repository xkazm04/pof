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

import { VoiceRoom, exportNoteText } from '@/components/layout-lab/game/voice/voiceRoom';
import { groupByQuest, nextToJudge } from '@/components/layout-lab/game/voice/voiceQueue';
import { UI_TIMEOUTS } from '@/lib/constants';
import { VOICE_GATE_HEADER } from '@/components/layout-lab/game/voice/voiceGateClient';
import { LIGHT } from '@/components/layout-lab/theme';
import type { QueueEntry } from '@/lib/voice/types';

const entry = (questId: string, lineId: string, questOrder: number, lineOrder: number, state: QueueEntry['state'] = 'no-takes'): QueueEntry => ({
  gameId: 'gtai', questId, lineId, speaker: 'rivet', text: `${lineId} text`, textHash: 'h', purpose: ['funny'], questOrder, lineOrder,
  lineClass: lineId === 'a1' ? 'bark' : 'story', when: lineId === 'a1' ? ['static-whisper-burst'] : [],
  beatId: 'b1', beatTitle: 'Line Stopped', beatSummary: 'Rivet hides in a dumpster while the heat drains.',
  present: true, syncedAt: 0, state, takes: state === 'no-takes' ? 0 : 1, pending: state === 'awaiting-verdict' ? 1 : 0, approvedTakeId: null,
  flagged: lineId === 'a1' ? 1 : 0,
});

const QUEUE = [entry('first-quest', 'a1', 0, 0, 'awaiting-verdict'), entry('first-quest', 'a2', 0, 1), entry('second-quest', 'b1', 1, 0, 'proven')];
const STATE = {
  status: {
    proven: 1, total: 3, chars: 120, flaggedLines: 1, next: [QUEUE[0], QUEUE[1]],
    quests: [{ questId: 'first-quest', title: 'First', questOrder: 0, proven: 0, total: 2 }, { questId: 'second-quest', title: 'Second', questOrder: 1, proven: 1, total: 1 }],
  },
  queue: QUEUE,
  voices: [],
};
const TAKE = {
  id: 'take-1', gameId: 'gtai', questId: 'first-quest', lineId: 'a1', voiceId: 'v1', providerVoiceId: 'p1', textHash: 'h', direction: 'whispered, fast',
  sentText: '[whispered] [fast] a1 text', settings: { model: 'eleven_v3', stability: 0.5, similarityBoost: 0.75, style: 0.3, speed: 1 },
  durationMs: 2100, loudnessLufs: -18.2, chars: 26, verdict: 'pending', verdictNote: null, verdictAt: null, createdAt: 1, stale: false, reason: null,
  maxSilenceMs: 200, readbackText: 'a one text whispers', readbackWer: 0.5,
};
const DETAIL = { line: QUEUE[0], bible: '# Voice bible: Rivet', takes: [TAKE], history: [], voices: [] };

const ok = (data: unknown) => Promise.resolve({ json: () => Promise.resolve({ success: true, data }) });

function stubRoutes(state: unknown = STATE) {
  const fn = vi.fn((url: string) => {
    if (url.endsWith('/voice/gate')) return ok({ token: 'TOKEN-123', expiresAt: Date.now() + 600_000 });
    if (url.includes('/voice/lines?')) return ok(DETAIL);
    if (url.endsWith('/voice/takes/verdict')) return ok({ take: { ...TAKE, verdict: 'approved' } });
    if (url.endsWith('/voice')) return ok(state);
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

  it('Approve unlocks only after the take is heard, then posts the verdict with the page gate token header and the note', async () => {
    const fetchFn = stubRoutes();
    render(<VoiceRoom t={LIGHT} />);
    await waitFor(() => expect(screen.queryByTestId('voice-take')).not.toBeNull());
    const approve = screen.getByTestId('voice-approve') as HTMLButtonElement;
    // Locked until the owner has heard the take: half-way is not enough, played through (>= 80 %) unlocks it.
    await waitFor(() => expect((screen.getByTestId('voice-reject') as HTMLButtonElement).disabled).toBe(false));
    expect(approve.disabled).toBe(true);
    expect(screen.getByTestId('voice-listen-first').textContent).toContain('played this take through');
    const audio = screen.getByTestId('voice-take').querySelector('audio')!;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 10 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 5 });
    fireEvent.timeUpdate(audio);
    expect(approve.disabled).toBe(true);
    audio.currentTime = 8.5;
    fireEvent.timeUpdate(audio);
    await waitFor(() => expect(approve.disabled).toBe(false));
    expect(screen.queryByTestId('voice-listen-first')).toBeNull();
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
    expect(screen.getAllByTestId('voice-line-flagged').map((f) => f.textContent)).toEqual(['1 flagged']);
    const ctx = screen.getByTestId('voice-line-context');
    expect(ctx.getAttribute('data-class')).toBe('bark');
    expect(ctx.textContent).toContain('when: static-whisper-burst');
    expect(screen.getByTestId('voice-line-beat').textContent).toContain('Scene: Line Stopped');
  });

  it('shows the read-back and flags a take whose words did not come out', async () => {
    stubRoutes();
    render(<VoiceRoom t={LIGHT} />);
    await waitFor(() => expect(screen.queryByTestId('voice-take')).not.toBeNull());
    const take = screen.getByTestId('voice-take');
    expect(screen.getByTestId('voice-readback').textContent).toBe('read-back 50 % word errors');
    expect(take.textContent).toContain('read-back differs (50 %): listen for garbled words');
    expect(take.textContent).toContain('heard (local Whisper read-back, words only): a one text whispers');
  });

  it('a take whose audio fails to load says so instead of showing a merely silent player', async () => {
    stubRoutes();
    render(<VoiceRoom t={LIGHT} />);
    await waitFor(() => expect(screen.queryByTestId('voice-take')).not.toBeNull());
    expect(screen.queryByTestId('voice-audio-error')).toBeNull();
    const audio = () => screen.getByTestId('voice-take').querySelector('audio')!;
    // The room plays a take as the game plays it (mastered); if that fails it falls back to the provider
    // original ONCE and says so, and only a failing original is an error.
    expect(audio().getAttribute('src')).toContain('&as=game');
    fireEvent.error(audio());
    expect(audio().getAttribute('src')).not.toContain('as=game');
    expect(screen.getByTestId('voice-audio-fallback').textContent).toContain('provider original');
    expect(screen.queryByTestId('voice-audio-error')).toBeNull();
    fireEvent.error(audio());
    expect(screen.getByTestId('voice-audio-error').textContent).toContain('Audio did not load');
  });

  it('the listen-mode toggle switches a take between as-the-game-plays-it and the provider original', async () => {
    stubRoutes();
    render(<VoiceRoom t={LIGHT} />);
    await waitFor(() => expect(screen.queryByTestId('voice-take')).not.toBeNull());
    const toggle = screen.getByTestId('voice-take-listen-mode');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('voice-take').querySelector('audio')!.getAttribute('src')).not.toContain('as=game');
  });

  it('nextToJudge walks forward in play order to the next line awaiting a verdict, wrapping, never the open line', () => {
    const q = [entry('q', 'w1', 0, 0, 'awaiting-verdict'), entry('q', 'n1', 0, 1), entry('q', 'w2', 0, 2, 'awaiting-verdict'), entry('q', 'p1', 0, 3, 'proven')];
    expect(nextToJudge(q, null)?.lineId).toBe('w1');
    expect(nextToJudge(q, { questId: 'q', lineId: 'w1' })?.lineId).toBe('w2');
    expect(nextToJudge(q, { questId: 'q', lineId: 'w2' })?.lineId).toBe('w1');
    expect(nextToJudge([q[0], q[1]], { questId: 'q', lineId: 'w1' })).toBeNull();
  });

  it('re-reads the queue on the poll interval, so CLI-generated takes appear without a click', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fetchFn = stubRoutes();
      render(<VoiceRoom t={LIGHT} />);
      await waitFor(() => expect(screen.getAllByTestId('voice-quest').length).toBe(2));
      const roomReads = () => fetchFn.mock.calls.filter(([u]) => String(u).endsWith('/voice')).length;
      const before = roomReads();
      await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.voiceRoomPoll + 10);
      await waitFor(() => expect(roomReads()).toBeGreaterThan(before));
    } finally {
      vi.useRealTimers();
    }
  });

  it('Cast of a voice with a preview unlocks only after the preview was played through', async () => {
    const designed = {
      id: 'v-designed', gameId: 'gtai', characterId: 'rivet', name: 'Designed #1', providerVoiceId: null, source: 'designed', designPrompt: 'a nervous robot',
      previews: [{ generatedVoiceId: 'g1', file: 'f', durationMs: 3000 }], status: 'candidate', createdAt: 0, updatedAt: 0,
    };
    stubRoutes({ ...STATE, voices: [designed] });
    render(<VoiceRoom t={LIGHT} />);
    await waitFor(() => expect(screen.getAllByTestId('voice-quest').length).toBe(2));
    fireEvent.click(screen.getByRole('tab', { name: /^Cast$/ }));
    await waitFor(() => expect(screen.queryByTestId('voice-candidate')).not.toBeNull());
    const btn = screen.getByTestId('voice-cast-btn') as HTMLButtonElement;
    await waitFor(() => expect(screen.getByTestId('voice-candidate').textContent).toContain('Cast unlocks once you have played the preview through'));
    expect(btn.disabled).toBe(true);
    fireEvent.ended(screen.getByTestId('voice-candidate').querySelector('audio')!);
    await waitFor(() => expect(btn.disabled).toBe(false));
  });

  it('shows the no-clone note in Cast', async () => {
    stubRoutes();
    render(<VoiceRoom t={LIGHT} />);
    await waitFor(() => expect(screen.getAllByTestId('voice-quest').length).toBe(2));
    fireEvent.click(screen.getByRole('tab', { name: /^Cast$/ }));
    await waitFor(() => expect(screen.queryByTestId('voice-gate-note')).not.toBeNull());
    expect(screen.getByTestId('voice-gate-note').textContent).toContain('Never imitate or clone');
  });
});

describe('exportNoteText', () => {
  it('names the master level and its source, and points at an off-level line', () => {
    const text = exportNoteText({
      written: [{ lineId: 'a1', onLevel: true }, { lineId: 'a2', onLevel: false }], skipped: [{}], stale: [],
      mastering: { lufs: -18, truePeakDb: -2, source: 'project/data/tables/audio_mix.json' },
    });
    expect(text).toBe('2 written · 1 skipped (not proven) · mastered to -18 LUFS / -2 dBTP (project/data/tables/audio_mix.json) · off level after mastering, listen: a2');
  });
});
