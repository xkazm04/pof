/**
 * "As the game plays it": the room's player streams a take mastered the way export renders it. Rendered once
 * per take and target (a second ask reuses the file), the speaker's treatment from the game's mix table is
 * applied, a game without a root gets the default target, and a failed render leaves no half file.
 * ffmpeg is mocked (the recipe itself is pinned in voiceQueue.test.ts `masterArgs`).
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-asgame-${process.pid}/voice`;
});
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createVoiceDb, insertVoice, castVoice } from '@/lib/voice/voice-db';
import { syncQueue } from '@/lib/voice/lineQueue';
import { generateTakes, type TakeDeps } from '@/lib/voice/takes';
import { addStockCandidate } from '@/lib/voice/design';
import { asGameFile, asGamePreview, type AsGameDeps } from '@/lib/voice/asGame';
import { DEFAULT_VOICE_TARGET } from '@/lib/voice/mastering';
import { voiceDir, writeVoiceFile } from '@/lib/voice/storage';
import { makeFixtureRoot, makeGameRoot } from './voiceFixture';

const deps: TakeDeps = {
  synth: async (r) => ({ bytes: Buffer.from('mp3'), format: 'mp3', sentText: r.text, chars: r.text.length }),
  createVoice: async () => 'created-voice',
  measure: async () => ({ durationMs: 1000, loudnessLufs: -27, maxSilenceMs: 100 }),
  now: () => 1000,
};
let db: Database.Database;
let takeId: string;

beforeEach(async () => {
  db = new Database(':memory:');
  createVoiceDb(db);
  syncQueue(db, 'gtai', makeFixtureRoot());
  castVoice(db, addStockCandidate(db, 'gtai', 'rivet', 'stock-r', 'Liam', null).id);
  const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z2', n: 1, direction: 'whispered' }, deps);
  if (!r.ok) throw new Error(r.error);
  takeId = r.data[0].id;
});
afterAll(() => fs.rmSync(String(process.env.POF_VOICE_DIR), { recursive: true, force: true }));

function recorder() {
  const calls: Array<{ dst: string; lufs: number; treatment?: string }> = [];
  const d: AsGameDeps = {
    convert: async (_src, dst, t, treatment) => { calls.push({ dst, lufs: t.lufs, treatment }); fs.writeFileSync(dst, 'ogg'); return null; },
  };
  return { calls, d };
}

describe('asGameFile', () => {
  it('renders once with the speaker treatment from the game table, then reuses the file', async () => {
    const game = makeGameRoot('zulu', ['z2']);
    fs.mkdirSync(path.join(game, 'project', 'data', 'tables'), { recursive: true });
    fs.writeFileSync(path.join(game, 'project', 'data', 'tables', 'audio_mix.json'), JSON.stringify({
      loudness: { voice_lufs: -18, voice_true_peak_db: -2 }, voice_treatments: { rivet: 'lowpass=f=3400' },
    }));
    const { calls, d } = recorder();
    const a = await asGameFile(db, takeId, game, d);
    if (!a.ok) throw new Error(a.error);
    expect(a.data.treatment).toBe('lowpass=f=3400');
    expect(path.dirname(a.data.file)).toBe(path.join(voiceDir(), 'as-game'));
    expect(fs.readFileSync(a.data.file, 'utf8')).toBe('ogg');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ lufs: -18, treatment: 'lowpass=f=3400' });
    expect(calls[0].dst).not.toBe(a.data.file); // rendered to a temp name, then renamed
    const b = await asGameFile(db, takeId, game, d);
    expect(b.ok && b.data.file).toBe(a.data.file);
    expect(calls).toHaveLength(1);
    // A changed target is a different master (the file name carries the target key).
    fs.writeFileSync(path.join(game, 'project', 'data', 'tables', 'audio_mix.json'), JSON.stringify({ loudness: { voice_lufs: -20, voice_true_peak_db: -2 } }));
    const c = await asGameFile(db, takeId, game, d);
    expect(c.ok && c.data.file).not.toBe(a.data.file);
    expect(calls).toHaveLength(2);
  });

  it('no game root -> the default target; a failed render returns the reason and leaves no file', async () => {
    const ok = await asGameFile(db, takeId, null, recorder().d);
    expect(ok.ok && ok.data.target).toEqual(DEFAULT_VOICE_TARGET);
    const before = fs.readdirSync(path.join(voiceDir(), 'as-game')).length;
    const failing: AsGameDeps = { convert: async (_s, dst) => { fs.writeFileSync(dst, 'half'); return 'ffmpeg could not master x'; } };
    const game = makeGameRoot('zulu', ['z2']);
    fs.mkdirSync(path.join(game, 'project', 'data', 'tables'), { recursive: true });
    fs.writeFileSync(path.join(game, 'project', 'data', 'tables', 'audio_mix.json'), JSON.stringify({ loudness: { voice_lufs: -23, voice_true_peak_db: -2 } }));
    expect(await asGameFile(db, takeId, game, failing)).toEqual({ ok: false, error: 'ffmpeg could not master x' });
    expect(fs.readdirSync(path.join(voiceDir(), 'as-game')).length).toBe(before);
    expect(await asGameFile(db, 'nope', null, failing)).toEqual({ ok: false, error: 'no such take audio' });
  });

  it('a design preview is mastered too, with its character treatment (casting compares at matched loudness)', async () => {
    const file = writeVoiceFile('gtai/previews/patch/p1.mp3', Buffer.from('mp3'));
    insertVoice(db, {
      id: 'v-patch', gameId: 'gtai', characterId: 'patch', name: 'Switchboard', providerVoiceId: null, source: 'designed',
      designPrompt: 'cheerful router', previews: [{ generatedVoiceId: 'g1', file, durationMs: 3000 }], status: 'candidate', createdAt: 1, updatedAt: 1,
    });
    const game = makeGameRoot('zulu', ['z2']);
    fs.mkdirSync(path.join(game, 'project', 'data', 'tables'), { recursive: true });
    fs.writeFileSync(path.join(game, 'project', 'data', 'tables', 'audio_mix.json'), JSON.stringify({
      loudness: { voice_lufs: -18, voice_true_peak_db: -2 }, voice_treatments: { patch: 'highpass=f=320,lowpass=f=3400' },
    }));
    const { calls, d } = recorder();
    const r = await asGamePreview(db, 'v-patch', game, d);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.treatment).toBe('highpass=f=320,lowpass=f=3400');
    expect(path.basename(r.data.file).startsWith('preview-v-patch-')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(await asGamePreview(db, 'nope', game, d)).toEqual({ ok: false, error: 'no such preview audio' });
  });
});
