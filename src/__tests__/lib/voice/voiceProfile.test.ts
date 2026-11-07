/** Cast voices carry their take profile; an approval is bound to it (a render change un-proves the lines whose sound changed). */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-profile-${process.pid}/voice`;
});
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { castVoice, createVoiceDb, getLine, getVoice, listTakes, listVoices, setVerdict } from '@/lib/voice/voice-db';
import { queueEntries, syncQueue, voiceCtx } from '@/lib/voice/lineQueue';
import { approvalRefusal } from '@/lib/voice/approval';
import { editTakeProfile } from '@/lib/voice/profileEdit';
import { parseProfile, profileMatches, withProfile } from '@/lib/voice/takeProfile';
import { generateTakes, type TakeDeps } from '@/lib/voice/takes';
import { addStockCandidate } from '@/lib/voice/design';
import { makeFixtureRoot, writeQuest } from './voiceFixture';
import type { SpeechRequest } from '@/lib/audio-gen/types';

let db: Database.Database;
let root: string;
let seen: SpeechRequest[] = [];
const deps: TakeDeps = {
  synth: async (r) => { seen.push(r); return { bytes: Buffer.from('mp3'), format: 'mp3', sentText: r.text, chars: r.text.length }; },
  createVoice: async () => 'created-voice',
  measure: async () => ({ durationMs: 1000, loudnessLufs: -18, maxSilenceMs: 100 }),
  now: () => 1000,
};
const LINES = ['r1', 'r2', 'r3', 'r4'];
beforeEach(() => {
  seen = [];
  db = new Database(':memory:');
  createVoiceDb(db);
  root = makeFixtureRoot();
  writeQuest(root, 'zulu', 'act1', '2026-11-02T00:00:00Z', LINES.map((id) => ({ id, speaker: 'kerf', text: `Line ${id}.` })));
  syncQueue(db, 'gtai', root);
});
afterAll(() => fs.rmSync(String(process.env.POF_VOICE_DIR), { recursive: true, force: true }));

const states = () => Object.fromEntries(queueEntries(db, 'gtai', syncQueue(db, 'gtai', root)).filter((e) => e.speaker === 'kerf').map((e) => [e.lineId, e.state]));
const take = async (lineId: string, settings = {}) => {
  const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId, n: 1, direction: '', settings }, deps);
  if (!r.ok) throw new Error(r.error);
  return r.data[0];
};

describe('migration', () => {
  it('adds takeProfile to a voice_voices table created before it, keeping every row', () => {
    const old = new Database(':memory:');
    old.exec(`CREATE TABLE voice_voices (id TEXT PRIMARY KEY, gameId TEXT NOT NULL, characterId TEXT NOT NULL, name TEXT NOT NULL,
      providerVoiceId TEXT, source TEXT NOT NULL, designPrompt TEXT, previews TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'candidate', createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)`);
    old.prepare("INSERT INTO voice_voices VALUES ('v1','gtai','kerf','Old','p','stock',NULL,'[]','cast',1,1)").run();
    createVoiceDb(old);
    createVoiceDb(old); // idempotent
    expect(listVoices(old, 'gtai').map((v) => [v.id, v.name, v.takeProfile])).toEqual([['v1', 'Old', null]]);
    addStockCandidate(old, 'gtai', 'ohm', 'stock-o', 'Ohm', null);
    expect(listVoices(old, 'gtai')).toHaveLength(2);
  });
});

describe('profile defaults', () => {
  it('a take defaults to its voice profile; an explicit override wins and is recorded on the take', async () => {
    const v = addStockCandidate(db, 'gtai', 'kerf', 'stock-k', 'Kerf', null);
    castVoice(db, v.id);
    expect(editTakeProfile(db, 'gtai', root, v.id, { model: 'eleven_multilingual_v2', speed: 1.2, stability: 0.4, style: 0.1 }).ok).toBe(true);
    const a = await take('r1');
    expect(a.settings).toMatchObject({ model: 'eleven_multilingual_v2', speed: 1.2, stability: 0.4, style: 0.1 });
    expect(seen[0].settings).toMatchObject({ speed: 1.2 });
    const b = await take('r2', { speed: 1.0, model: undefined });
    expect(b.settings).toMatchObject({ model: 'eleven_multilingual_v2', speed: 1.0, stability: 0.4 });
    expect(withProfile(null, { speed: undefined })).toEqual({});
  });

  it('a voice with no profile behaves as before: provider defaults, never profile-changed', async () => {
    const v = addStockCandidate(db, 'gtai', 'kerf', 'stock-k', 'Kerf', null);
    castVoice(db, v.id);
    const a = await take('r1');
    expect(a.settings).toMatchObject({ model: 'eleven_v3', speed: 1, stability: 0.5, style: 0 });
    setVerdict(db, a.id, 'approved', null);
    expect(states().r1).toBe('proven');
  });
});

describe('profile-changed', () => {
  it('a recipe change un-proves approved takes rendered with the old one; MEASURED on a 4-line fixture', async () => {
    const v = addStockCandidate(db, 'gtai', 'kerf', 'stock-k', 'Kerf', null);
    castVoice(db, v.id);
    // Three lines approved at the default pace, one at the pace the owner later decides (the CASTING.md situation).
    const takes = [await take('r1'), await take('r2'), await take('r3'), await take('r4', { speed: 1.2 })];
    for (const t of takes) setVerdict(db, t.id, 'approved', null);
    expect(Object.values(states())).toEqual(['proven', 'proven', 'proven', 'proven']);
    const r = editTakeProfile(db, 'gtai', root, v.id, { model: 'eleven_v3', speed: 1.2, stability: 0.5, style: 0 });
    if (!r.ok) throw new Error(r.error);
    // Measured: 3 of 4 approved lines (75 %) lose their proof; only the take already at 1.2 survives.
    expect(r.unproven).toBe(3);
    expect(states()).toEqual({ r1: 'no-takes', r2: 'no-takes', r3: 'no-takes', r4: 'proven' });
    const line = getLine(db, 'gtai', 'zulu', 'r1')!;
    expect(approvalRefusal(listTakes(db, 'gtai', 'zulu', 'r1')[0], line, voiceCtx(db, 'gtai'))).toMatch(/not its voice's take profile/);
    // A new take (defaults to the profile) re-proves the line; clearing the profile makes every take current again.
    const again = await take('r1');
    setVerdict(db, again.id, 'approved', null);
    expect(states().r1).toBe('proven');
    expect(editTakeProfile(db, 'gtai', root, v.id, null)).toMatchObject({ ok: true, unproven: 0 });
    expect(Object.values(states())).toEqual(['proven', 'proven', 'proven', 'proven']);
  });

  it('compares the model exactly and the numbers within 0.001', () => {
    const s = { model: 'eleven_v3', stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1.2 };
    expect(profileMatches({ ...s, speed: 1.2000004 }, { model: 'eleven_v3', speed: 1.2, stability: 0.5, style: 0 })).toBe(true);
    expect(profileMatches({ ...s, speed: 1.19 }, { model: 'eleven_v3', speed: 1.2, stability: 0.5, style: 0 })).toBe(false);
    expect(profileMatches(s, { model: 'eleven_multilingual_v2', speed: 1.2, stability: 0.5, style: 0 })).toBe(false);
  });
});

describe('editing a profile', () => {
  it('only a cast voice carries one, and out-of-range values are refused, not clamped', () => {
    const v = addStockCandidate(db, 'gtai', 'kerf', 'stock-k', 'Kerf', null);
    expect(editTakeProfile(db, 'gtai', root, v.id, { model: 'eleven_v3', speed: 1, stability: 0.5, style: 0 })).toMatchObject({ ok: false, status: 409 });
    castVoice(db, v.id);
    expect(editTakeProfile(db, 'gtai', root, v.id, { model: 'eleven_v3', speed: 2, stability: 0.5, style: 0 })).toMatchObject({ ok: false, status: 400 });
    expect(editTakeProfile(db, 'gtai', root, v.id, { model: 'nope', speed: 1, stability: 0.5, style: 0 })).toMatchObject({ ok: false, status: 400 });
    expect(editTakeProfile(db, 'gtai', root, 'missing', null)).toMatchObject({ ok: false, status: 404 });
    expect(getVoice(db, v.id)?.takeProfile).toBeNull();
    expect(parseProfile(null)).toEqual({ ok: true, data: null });
  });
});
