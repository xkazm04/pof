/**
 * Read-back status: a failure is a recorded state with its reason (never a forever-"pending"), unscreened takes are
 * counted apart from flagged ones, runs are single-flight, an old-shape voice_takes table upgrades in place, and
 * the room says "failed", not "pending".
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-readback-status-${process.pid}/voice`;
});
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: 'font-var' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { castVoice, createVoiceDb, getTake, setReadbackStatus } from '@/lib/voice/voice-db';
import { queueEntries, statusView, syncQueue } from '@/lib/voice/lineQueue';
import { generateTakes, type TakeDeps } from '@/lib/voice/takes';
import { addStockCandidate } from '@/lib/voice/design';
import { readbackTakes, type Transcribe } from '@/lib/voice/readback';
import { LEGACY_REASON } from '@/lib/voice/readbackState';
import { readbackInBackground, readbackQueued, reapOrphanedPending, singleFlight } from '@/lib/voice/readbackQueue';
import { VoiceTake } from '@/components/layout-lab/game/voice/voiceTake';
import { LIGHT } from '@/components/layout-lab/theme';
import type { TakeView } from '@/lib/voice/room';
import { makeFixtureRoot } from './voiceFixture';

const deps: TakeDeps = {
  synth: async (r) => ({ bytes: Buffer.from('mp3'), format: 'mp3', sentText: r.text, chars: r.text.length }),
  createVoice: async () => 'created-voice',
  measure: async () => ({ durationMs: 1000, loudnessLufs: -18, maxSilenceMs: 100 }),
  now: () => 1000,
};
let db: Database.Database;
const gen = async (n = 1) => {
  const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z2', n, direction: '' }, deps);
  if (!r.ok) throw new Error(r.error);
  return r.data.map((t) => t.id);
};
const z2 = () => queueEntries(db, 'gtai', syncQueue(db, 'gtai', makeFixtureRoot()));

beforeEach(() => {
  db = new Database(':memory:');
  createVoiceDb(db);
  syncQueue(db, 'gtai', makeFixtureRoot());
  castVoice(db, addStockCandidate(db, 'gtai', 'rivet', 'stock-r', 'Liam', null).id);
});
afterEach(cleanup);
afterAll(() => fs.rmSync(String(process.env.POF_VOICE_DIR), { recursive: true, force: true }));

describe('read-back status', () => {
  it('a new take is pending; the unavailable-model path ends failed with the reason, counted unscreened not flagged', async () => {
    const [id] = await gen();
    expect(getTake(db, id)).toMatchObject({ readbackStatus: 'pending', readbackReason: null });
    const down: Transcribe = async () => ({ ok: false, error: 'read-back worker exit 1: OSError: model not in cache' });
    expect((await readbackTakes(db, [id], down)).ok).toBe(false);
    expect(getTake(db, id)).toMatchObject({ readbackStatus: 'failed', readbackWer: null, readbackReason: 'read-back worker exit 1: OSError: model not in cache' });
    const entries = z2();
    const e = entries.find((x) => x.lineId === 'z2')!;
    expect([e.unscreened, e.flagged]).toEqual([1, 0]);
    const s = statusView(entries, {}, 0);
    expect([s.unscreenedLines, s.flaggedLines]).toEqual([1, 0]);
  });

  it('per-take unmeasured entries and a take the worker returned nothing for are failed with reasons', async () => {
    const [a, b, c] = await gen(3);
    await readbackTakes(db, [a, b, c], async () => ({ ok: true, data: [{ id: a, text: 'Okay okay okay okay', error: null }, { id: b, text: null, error: 'decode failed' }] }));
    expect(getTake(db, a)).toMatchObject({ readbackStatus: 'measured', readbackWer: 0 });
    expect(getTake(db, b)).toMatchObject({ readbackStatus: 'failed', readbackReason: 'decode failed' });
    expect(getTake(db, c)?.readbackStatus).toBe('failed');
    // a later successful retry measures it and clears the reason
    await readbackTakes(db, [b], async () => ({ ok: true, data: [{ id: b, text: 'okay okay okay okay', error: null }] }));
    expect(getTake(db, b)).toMatchObject({ readbackStatus: 'measured', readbackReason: null });
  });

  it('a transcribe that throws is recorded failed', async () => {
    const [id] = await gen();
    const r = await readbackTakes(db, [id], async () => { throw new Error('spawn exploded'); });
    expect(r.ok).toBe(false);
    expect(getTake(db, id)).toMatchObject({ readbackStatus: 'failed', readbackReason: 'read-back worker threw: spawn exploded' });
  });

  it('the background call never rejects, even when the run itself crashes', async () => {
    const [id] = await gen();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const broken = new Database(':memory:'); // no tables: setReadbackStatus throws before the run
    expect(() => readbackInBackground(broken, [id], async () => ({ ok: true, data: [] }))).not.toThrow();
    const r = await readbackQueued(db, [id], async () => { throw new Error('boom'); });
    await new Promise((res) => setTimeout(res, 20));
    process.off('unhandledRejection', unhandled);
    expect(r.ok).toBe(false);
    expect(unhandled).not.toHaveBeenCalled();
    expect(getTake(db, id)?.readbackStatus).toBe('failed');
  });

  it('off is recorded and counted unscreened', async () => {
    const [id] = await gen();
    setReadbackStatus(db, id, 'off');
    expect(getTake(db, id)?.readbackStatus).toBe('off');
    expect(z2().find((x) => x.lineId === 'z2')!.unscreened).toBe(1);
  });

  it('reaps takes left pending by a restart, but not young ones', async () => {
    const [id] = await gen();
    expect(reapOrphanedPending(db, 'gtai', 1000 + 60_000)).toBe(0);
    expect(reapOrphanedPending(db, 'gtai', 1000 + 10 * 60_000)).toBe(1);
    expect(getTake(db, id)?.readbackReason).toContain('did not run');
  });
});

describe('single flight', () => {
  it('a second call starts only after the first ends, even when the first fails', async () => {
    const log: string[] = [];
    const slow = singleFlight(async () => { log.push('a:start'); await new Promise((r) => setTimeout(r, 30)); log.push('a:end'); throw new Error('a failed'); });
    const fast = singleFlight(async () => { log.push('b:start'); log.push('b:end'); return 1; });
    await expect(slow).rejects.toThrow('a failed');
    expect(await fast).toBe(1);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('two read-back requests run one transcribe at a time and the later take stays pending meanwhile', async () => {
    const [a, b] = await gen(2);
    let running = 0;
    let peak = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const t: Transcribe = async (items) => {
      running++; peak = Math.max(peak, running);
      await gate;
      running--;
      return { ok: true, data: items.map((i) => ({ id: i.id, text: 'okay okay okay okay', error: null })) };
    };
    const p1 = readbackQueued(db, [a], t);
    const p2 = readbackQueued(db, [b], t);
    await new Promise((r) => setTimeout(r, 20));
    expect(getTake(db, b)?.readbackStatus).toBe('pending');
    release();
    await Promise.all([p1, p2]);
    expect(peak).toBe(1);
    expect(getTake(db, b)?.readbackStatus).toBe('measured');
  });
});

describe('migration', () => {
  it('an old-shape voice_takes table upgrades in place: a WER reads measured, a null WER reads failed (never pending, never measured)', () => {
    const old = new Database(':memory:');
    old.exec(`CREATE TABLE voice_takes (
      id TEXT PRIMARY KEY, gameId TEXT NOT NULL, questId TEXT NOT NULL, lineId TEXT NOT NULL, voiceId TEXT NOT NULL,
      providerVoiceId TEXT NOT NULL, textHash TEXT NOT NULL, direction TEXT NOT NULL, sentText TEXT NOT NULL, settings TEXT NOT NULL,
      file TEXT NOT NULL, durationMs INTEGER, loudnessLufs REAL, chars INTEGER NOT NULL, verdict TEXT NOT NULL DEFAULT 'pending',
      verdictNote TEXT, verdictAt INTEGER, createdAt INTEGER NOT NULL, readbackText TEXT, readbackWer REAL)`);
    const ins = old.prepare(`INSERT INTO voice_takes (id,gameId,questId,lineId,voiceId,providerVoiceId,textHash,direction,sentText,settings,file,chars,createdAt,readbackText,readbackWer)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    ins.run('m', 'gtai', 'q', 'l', 'v', 'p', 'h', '', 'x', '{}', 'f', 1, 1, 'hi', 0.1);
    ins.run('n', 'gtai', 'q', 'l', 'v', 'p', 'h', '', 'x', '{}', 'f', 1, 2, null, null);
    createVoiceDb(old);
    createVoiceDb(old); // idempotent
    expect(getTake(old, 'm')).toMatchObject({ readbackStatus: 'measured', readbackReason: null });
    expect(getTake(old, 'n')).toMatchObject({ readbackStatus: 'failed', readbackReason: LEGACY_REASON });
  });
});

describe('the room', () => {
  const TAKE: TakeView = {
    id: 'take-1', gameId: 'gtai', questId: 'q', lineId: 'l', voiceId: 'v1', providerVoiceId: 'p1', textHash: 'h', direction: '', sentText: 'x',
    settings: { model: 'eleven_v3', stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1 }, durationMs: 1000, loudnessLufs: -18, maxSilenceMs: 100,
    readbackText: null, readbackWer: null, chars: 1, verdict: 'pending', verdictNote: null, verdictAt: null, createdAt: 1, stale: false, reason: null,
  };
  const show = (over: Partial<TakeView>) => {
    render(<VoiceTake t={LIGHT} take={{ ...TAKE, ...over }} voiceName="Chris" gate={{ token: 'T', error: null }} onChanged={() => {}} />);
    const el = screen.getByTestId('voice-readback');
    return { text: el.textContent ?? '', status: el.getAttribute('data-readback') };
  };
  it('shows failed with its reason, distinct from pending, off and a measured WER', () => {
    expect(show({ readbackStatus: 'failed', readbackReason: 'model not in cache' })).toEqual({ text: 'read-back failed: model not in cache', status: 'failed' });
    cleanup();
    expect(show({ readbackStatus: 'pending' })).toEqual({ text: 'read-back pending', status: 'pending' });
    cleanup();
    expect(show({ readbackStatus: 'off' })).toEqual({ text: 'read-back off', status: 'off' });
    cleanup();
    expect(show({ readbackStatus: 'measured', readbackWer: 0.5 }).text).toBe('read-back 50 % word errors');
  });
});
