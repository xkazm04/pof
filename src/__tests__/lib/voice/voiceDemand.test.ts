/** Casting knows the line demand, and a take from an uncast speaker is an audition: heard, never proven. */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-demand-${process.pid}/voice`;
});
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { castVoice, createVoiceDb, listTakes, setVerdict } from '@/lib/voice/voice-db';
import { queueEntries, statusView, syncQueue } from '@/lib/voice/lineQueue';
import { castingDemand } from '@/lib/voice/castingDemand';
import { generateTakes, type TakeDeps } from '@/lib/voice/takes';
import { addStockCandidate } from '@/lib/voice/design';
import { exportQuest } from '@/lib/voice/exportQuest';
import { roomState, lineDetail } from '@/lib/voice/room';
import { makeFixtureRoot, makeGameRoot, writeQuest } from './voiceFixture';

let db: Database.Database;
let root: string;
const deps: TakeDeps = {
  synth: async (r) => ({ bytes: Buffer.from('mp3'), format: 'mp3', sentText: r.text, chars: r.text.length }),
  createVoice: async () => 'created-voice',
  measure: async () => ({ durationMs: 1000, loudnessLufs: -18, maxSilenceMs: 100 }),
  now: () => 1000,
};
beforeEach(() => {
  db = new Database(':memory:');
  createVoiceDb(db);
  root = makeFixtureRoot();
  // zulu (act 1): dock-guard x1 story + bark, rivet x1; alpha (act 2): rivet, dock-guard. Add a bark and a speaker.
  writeQuest(root, 'zulu', 'act1', '2026-11-02T00:00:00Z', [
    { id: 'z1', speaker: 'dock-guard', text: 'Who do we call?!' }, { id: 'z2', speaker: 'rivet', text: 'Okay.' },
    { id: 'z3', speaker: 'nurse', text: 'Hold still.', when: ['hurt'] }, { id: 'z4', speaker: 'nurse', text: 'Breathe.' },
  ]);
  syncQueue(db, 'gtai', root);
});
afterAll(() => fs.rmSync(String(process.env.POF_VOICE_DIR), { recursive: true, force: true }));

describe('castingDemand', () => {
  it('counts present lines per speaker by class, in first-appearance order, with cast state and the cast voices that speak nothing', () => {
    const rivet = addStockCandidate(db, 'gtai', 'rivet', 'stock-r', 'Liam', null);
    castVoice(db, rivet.id);
    const ohm = addStockCandidate(db, 'gtai', 'ohm', 'stock-o', 'Ohm', null);
    castVoice(db, ohm.id);
    const d = castingDemand(db, 'gtai');
    expect(d.speakers.map((s) => [s.speaker, s.story, s.bark, s.lines, s.firstQuestId, s.firstLineId])).toEqual([
      ['dock-guard', 2, 0, 2, 'zulu', 'z1'], ['rivet', 2, 0, 2, 'zulu', 'z2'], ['nurse', 1, 1, 2, 'zulu', 'z3'],
    ]);
    expect(d.speakers.find((s) => s.speaker === 'rivet')?.cast).toEqual({ voiceId: rivet.id, name: 'Liam' });
    expect(d.needsVoice.map((s) => s.speaker)).toEqual(['dock-guard', 'nurse']);
    expect(d.castWithoutLines).toEqual([{ characterId: 'ohm', voiceId: ohm.id, name: 'Ohm' }]);
    expect(roomState(db, 'gtai', root).status.needsVoice.map((s) => s.speaker)).toEqual(['dock-guard', 'nurse']);
  });

  it('ignores lines that left the packages (not present)', () => {
    writeQuest(root, 'zulu', 'act1', '2026-11-02T00:00:00Z', [{ id: 'z2', speaker: 'rivet', text: 'Okay.' }]);
    syncQueue(db, 'gtai', root);
    expect(castingDemand(db, 'gtai').speakers.map((s) => s.speaker)).toEqual(['rivet', 'dock-guard']);
  });
});

describe('audition', () => {
  it('a take from an uncast candidate is an audition: never proven, even if the verdict row says approved; export skips it with the cast-first reason', async () => {
    addStockCandidate(db, 'gtai', 'dock-guard', 'stock-g', 'Chris', null);
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z1', n: 1, direction: '' }, deps);
    if (!r.ok) throw new Error(r.error);
    setVerdict(db, r.data[0].id, 'approved', 'forced past the route');
    const e = queueEntries(db, 'gtai', syncQueue(db, 'gtai', root)).find((x) => x.lineId === 'z1')!;
    expect(e).toMatchObject({ state: 'no-takes', takes: 0, auditions: 1 });
    expect(statusView(queueEntries(db, 'gtai', syncQueue(db, 'gtai', root)), {}, 0).proven).toBe(0);
    const detail = lineDetail(db, 'gtai', root, 'zulu', 'z1')!;
    expect(detail.takes[0]).toMatchObject({ stale: true, reason: 'audition' });
    const game = makeGameRoot('zulu', ['z1', 'z2', 'z3', 'z4']);
    const ex = await exportQuest(db, 'gtai', 'zulu', game, { convert: async () => { throw new Error('must not convert'); }, measureLufs: async () => null });
    if (!ex.ok) throw new Error(ex.error);
    expect(ex.data.written).toEqual([]);
    expect(ex.data.skipped.find((s) => s.lineId === 'z1')?.reason).toBe(`not proven (no-takes): approved take ${r.data[0].id.slice(0, 8)} is stale: audition`);
    // Casting the candidate turns the same take into a current one: audition is about the speaker, not the take.
    castVoice(db, listTakes(db, 'gtai', 'zulu', 'z1')[0].voiceId);
    expect(queueEntries(db, 'gtai', syncQueue(db, 'gtai', root)).find((x) => x.lineId === 'z1')?.state).toBe('proven');
  });
});
