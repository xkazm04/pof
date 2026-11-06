import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-casting-${process.pid}/voice`;
});
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createVoiceDb, listVoices } from '@/lib/voice/voice-db';
import { syncQueue } from '@/lib/voice/lineQueue';
import { createCastingDb, openRound, roundViews, submitRound } from '@/lib/voice/castingDb';
import { designRound, validateRound, type RoundDeps } from '@/lib/voice/castingRound';
import { castingCharacters, castingView, renderCastingLog, resolveArt, writeCastingLog } from '@/lib/voice/castingView';
import type { SpeechDesignRequest } from '@/lib/audio-gen/types';
import { makeFixtureRoot } from './voiceFixture';

let db: Database.Database;
let root: string;
let calls: SpeechDesignRequest[];
let seedN: number;
const deps: RoundDeps = {
  design: async (req) => {
    calls.push(req);
    return { previews: [{ generatedVoiceId: `gen-${calls.length}`, bytes: Buffer.from('mp3'), durationMs: 4200 }], text: req.text, chars: req.text.length };
  },
  now: () => 5000,
  seed: () => ++seedN,
};
const SAMPLE = 'He has got a NAIL GUN! Is that even legal? Who do we call?! Oh shit, we ARE who you call! Somebody page the supervisor.';
const cand = (label: string, extra: Record<string, unknown> = {}) => ({ label, description: `A panicked dock guard voice, ${label}, shouting`, ...extra });

beforeEach(() => {
  db = new Database(':memory:');
  createVoiceDb(db);
  createCastingDb(db);
  root = makeFixtureRoot();
  syncQueue(db, 'gtai', root);
  calls = [];
  seedN = 100;
});

describe('casting rounds', () => {
  it('designs one voice per candidate description, each with its own seed, on the v3 design model', async () => {
    const r = await designRound(db, { gameId: 'gtai', characterId: 'dock-guard', brief: 'range: age and grit', candidates: [cand('young'), cand('old'), cand('gravel')] }, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.voices).toHaveLength(3);
    expect(calls.map((c) => c.seed)).toEqual([101, 102, 103]);
    expect(calls.every((c) => c.model === 'eleven_ttv_v3' && c.description.includes('not an imitation of any real person'))).toBe(true);
    expect(r.data.round.roundNo).toBe(1);
    expect(roundViews(db, 'gtai', 'dock-guard')[0].candidates.map((c) => c.candidate.verdict)).toEqual(['pending', 'pending', 'pending']);
  });

  it('refuses a second round while one is open, and more than 5 candidates', async () => {
    expect(validateRound({ gameId: 'gtai', characterId: 'x', brief: 'b', candidates: Array.from({ length: 6 }, (_, i) => cand(`c${i}`)) })).toMatch(/1-5/);
    await designRound(db, { gameId: 'gtai', characterId: 'dock-guard', brief: 'b', candidates: [cand('a')] }, deps);
    const again = await designRound(db, { gameId: 'gtai', characterId: 'dock-guard', brief: 'b', candidates: [cand('b')] }, deps);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toMatch(/still open/);
  });

  it('a submission needs a verdict for every voice and at most one cast; iterate keeps the parent seed next round', async () => {
    const r1 = await designRound(db, { gameId: 'gtai', characterId: 'dock-guard', brief: 'b', candidates: [cand('a'), cand('b')] }, deps);
    if (!r1.ok) throw new Error(r1.error);
    const [a, b] = r1.data.voices;
    const partial = submitRound(db, r1.data.round.id, [{ voiceId: a.id, verdict: 'iterate', note: 'close, but younger' }], 'more panic');
    expect(partial.ok).toBe(false);
    const twoCasts = submitRound(db, r1.data.round.id, [{ voiceId: a.id, verdict: 'cast', note: null }, { voiceId: b.id, verdict: 'cast', note: null }], null);
    expect(twoCasts.ok).toBe(false);
    expect(roundViews(db, 'gtai', 'dock-guard')[0].candidates.every((c) => c.candidate.verdict === 'pending')).toBe(true);
    const ok = submitRound(db, r1.data.round.id, [{ voiceId: a.id, verdict: 'iterate', note: 'close, but younger' }, { voiceId: b.id, verdict: 'decline', note: 'too calm' }], 'more panic');
    expect(ok.ok && ok.round.status).toBe('closed');
    expect(ok.ok && ok.round.ownerNote).toBe('more panic');
    expect(openRound(db, 'gtai', 'dock-guard')).toBeNull();
    const r2 = await designRound(db, { gameId: 'gtai', characterId: 'dock-guard', brief: 'iterate a', candidates: [cand('a younger', { parentVoiceId: a.id })], sampleText: SAMPLE }, deps);
    expect(r2.ok).toBe(true);
    expect(calls[2].seed).toBe(calls[0].seed);
    expect(r2.ok && r2.data.round.roundNo).toBe(2);
  });

  it('a cast verdict casts the voice, closes the round and is written into the casting log', async () => {
    const r1 = await designRound(db, { gameId: 'gtai', characterId: 'dock-guard', brief: 'b', candidates: [cand('a'), cand('b')] }, deps);
    if (!r1.ok) throw new Error(r1.error);
    const [a, b] = r1.data.voices;
    const res = submitRound(db, r1.data.round.id, [{ voiceId: a.id, verdict: 'decline', note: null }, { voiceId: b.id, verdict: 'cast', note: 'that is him' }], null);
    expect(res.ok && res.round.status).toBe('cast');
    expect(listVoices(db, 'gtai').find((v) => v.id === b.id)?.status).toBe('cast');
    expect(submitRound(db, r1.data.round.id, [{ voiceId: a.id, verdict: 'decline', note: null }, { voiceId: b.id, verdict: 'decline', note: null }], null).ok).toBe(false);
    const md = renderCastingLog(castingView(db, root, 'gtai', 'dock-guard'));
    expect(md).toMatch(/\*\*Cast\*\* in round 1/);
    expect(md).toMatch(/that is him/);
    const file = writeCastingLog(db, root, 'gtai', 'dock-guard');
    expect(file && fs.readFileSync(file, 'utf8')).toContain('Casting log');
  });
});

describe('casting art', () => {
  it('serves only images the art map lists, inside games/gtai', () => {
    const dir = path.join(root, 'games', 'gtai', 'voice', 'casting');
    fs.mkdirSync(path.join(root, 'games', 'gtai', 'art'), { recursive: true });
    fs.writeFileSync(path.join(root, 'games', 'gtai', 'art', 'g.png'), 'png');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'art.json'), JSON.stringify({ 'dock-guard': [{ file: 'art/g.png', label: 'g' }, { file: '../../../etc.png', label: 'x' }] }));
    expect(resolveArt(root, 'dock-guard', 0)).toMatch(/g\.png$/);
    expect(resolveArt(root, 'dock-guard', 1)).toBeNull();
    expect(resolveArt(root, 'rivet', 0)).toBeNull();
    expect(castingCharacters(db, root, 'gtai')[0]).toMatchObject({ id: 'dock-guard', hasArt: true });
  });
});

describe('casting roles', () => {
  it('reads the role from the bible id line and groups the cast', async () => {
    const { bibleRole, groupOf } = await import('@/lib/voice/castingView');
    expect(bibleRole('- id: `gunsmith` · name: **Brass Halloran** · gives Rivet his first weapon')).toBe('gives Rivet his first weapon');
    expect(groupOf('rivet', '')).toBe('Lead');
    expect(groupOf('kerf', 'soul · the laser-cutter ghost')).toBe('Souls');
    expect(groupOf('king', 'act antagonist (REG)')).toBe('Bosses');
    expect(groupOf('patch', 'the payphone job router')).toBe('Cast');
  });
});
