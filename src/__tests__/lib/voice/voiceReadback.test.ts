/**
 * Read-back (words-only ear proxy): WER is word-level after punctuation/case are dropped; a batch stores
 * text + WER per take against the LINE text; a take the worker could not hear stays null (never a fake score);
 * a worker that did not run is an error, not zeros. The Python worker is mocked (no Python in unit tests).
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-readback-${process.pid}/voice`;
});
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { createVoiceDb, getTake } from '@/lib/voice/voice-db';
import { queueEntries, statusView, syncQueue } from '@/lib/voice/lineQueue';
import { generateTakes, type TakeDeps } from '@/lib/voice/takes';
import { addStockCandidate } from '@/lib/voice/design';
import { readbackTakes, rescoreReadbacks, wordErrorRate, words, type Transcribe } from '@/lib/voice/readback';
import { setReadback } from '@/lib/voice/voice-db';
import { makeFixtureRoot } from './voiceFixture';

const deps: TakeDeps = {
  synth: async (r) => ({ bytes: Buffer.from('mp3'), format: 'mp3', sentText: r.text, chars: r.text.length }),
  createVoice: async () => 'created-voice',
  measure: async () => ({ durationMs: 1000, loudnessLufs: -18, maxSilenceMs: 100 }),
  now: () => 1000,
};
let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  createVoiceDb(db);
  syncQueue(db, 'gtai', makeFixtureRoot());
  addStockCandidate(db, 'gtai', 'rivet', 'stock-r', 'Liam', null);
});
afterAll(() => fs.rmSync(String(process.env.POF_VOICE_DIR), { recursive: true, force: true }));

describe('word error rate', () => {
  it('ignores case and punctuation, keeps apostrophes', () => {
    expect(words("Hands, stop shaking. Those are MY hands — who's there?")).toEqual(['hands', 'stop', 'shaking', 'those', 'are', 'my', 'hands', "who's", 'there']);
    expect(wordErrorRate('Okay. Okay okay okay.', 'okay, okay okay okay')).toBe(0);
  });
  it('reads digits as spoken numbers (Whisper writes 40 for "Forty")', () => {
    expect(words('40 crates, 39 and 1999')).toEqual(['forty', 'crates', 'thirty', 'nine', 'and', 'one', 'thousand', 'nine', 'hundred', 'ninety', 'nine']);
    expect(wordErrorRate('Forty crates. You make it thirty-nine.', '40 crates. You make it 39.')).toBe(0);
  });
  it('counts substitutions, drops and insertions against the reference length', () => {
    expect(wordErrorRate('one two three four', 'one too three four')).toBe(0.25);
    expect(wordErrorRate('one two three four', 'one three four')).toBe(0.25);
    expect(wordErrorRate('one two', 'uh one two whispers')).toBe(1);
  });
});

describe('readbackTakes', () => {
  it('stores what was heard and its WER against the line text; an unheard take stays null', async () => {
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z2', n: 2, direction: 'panicking' }, deps);
    if (!r.ok) throw new Error(r.error);
    const [a, b] = r.data;
    const transcribe: Transcribe = async (items) => {
      expect(items.map((i) => i.id)).toEqual([a.id, b.id]);
      return { ok: true, data: [{ id: a.id, text: 'Okay, okay. Okay. Okay.', error: null }, { id: b.id, text: null, error: 'decode failed' }] };
    };
    const out = await readbackTakes(db, [a.id, b.id], transcribe);
    expect(out).toEqual({ ok: true, data: { measured: 1, failed: [`${b.id}: decode failed`] } });
    expect(getTake(db, a.id)).toMatchObject({ readbackText: 'Okay, okay. Okay. Okay.', readbackWer: 0 });
    expect(getTake(db, b.id)).toMatchObject({ readbackText: null, readbackWer: null });
    // A garbled read-back flags the take; the queue row and the status count it.
    setReadback(db, b.id, 'okay uh', 0.5);
    const entries = queueEntries(db, 'gtai', syncQueue(db, 'gtai', makeFixtureRoot()));
    expect(entries.find((e) => e.lineId === 'z2')?.flagged).toBe(1);
    expect(statusView(entries, {}, 0).flaggedLines).toBe(1);
  });

  it('rescore re-derives a stored WER from the stored transcript (no model run)', async () => {
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z2', n: 1, direction: '' }, deps);
    if (!r.ok) throw new Error(r.error);
    setReadback(db, r.data[0].id, 'okay okay okay okay', 0.9);
    expect(rescoreReadbacks(db, 'gtai')).toBe(1);
    expect(getTake(db, r.data[0].id)?.readbackWer).toBe(0);
    expect(rescoreReadbacks(db, 'gtai')).toBe(0);
  });

  it('a worker that did not run is an error and writes nothing', async () => {
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z2', n: 1, direction: '' }, deps);
    if (!r.ok) throw new Error(r.error);
    const out = await readbackTakes(db, [r.data[0].id], async () => ({ ok: false, error: 'read-back worker did not start: ENOENT' }));
    expect(out.ok).toBe(false);
    expect(getTake(db, r.data[0].id)?.readbackWer).toBeNull();
  });
});
