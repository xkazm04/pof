/** `staleReason`: the one definition of "current take" (registry game-dialogue-voice-pipeline: a render is bound to what produced it). */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-current-${process.pid}/voice`;
});
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { castVoice, createVoiceDb, listTakes, setVerdict } from '@/lib/voice/voice-db';
import { queueEntries, staleReason, syncQueue, voiceCtx } from '@/lib/voice/lineQueue';
import { approvalRefusal } from '@/lib/voice/approval';
import { generateTakes, type TakeDeps } from '@/lib/voice/takes';
import { addStockCandidate } from '@/lib/voice/design';
import { exportQuest } from '@/lib/voice/exportQuest';
import { getLine } from '@/lib/voice/voice-db';
import { makeFixtureRoot, makeGameRoot, writeQuest } from './voiceFixture';

let db: Database.Database;
let root: string;
const deps: TakeDeps = {
  synth: async (r) => ({ bytes: Buffer.from('mp3'), format: 'mp3', sentText: r.text, chars: r.text.length }),
  createVoice: async () => 'created-voice',
  measure: async () => ({ durationMs: 1000, loudnessLufs: -18, maxSilenceMs: 100 }),
  now: () => 1000,
};
const zulu = (speaker: string) => writeQuest(root, 'zulu', 'act1', '2026-11-02T00:00:00Z', [
  { id: 'z1', speaker, text: 'He has got a NAIL GUN!' }, { id: 'z2', speaker: 'rivet', text: 'Okay.' },
]);

beforeEach(() => {
  db = new Database(':memory:');
  createVoiceDb(db);
  root = makeFixtureRoot();
  zulu('dock-guard');
});
afterAll(() => fs.rmSync(String(process.env.POF_VOICE_DIR), { recursive: true, force: true }));

async function approvedForGuard() {
  syncQueue(db, 'gtai', root);
  const v = addStockCandidate(db, 'gtai', 'dock-guard', 'stock-g', 'Chris', null);
  castVoice(db, v.id);
  const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z1', n: 1, direction: '' }, deps);
  if (!r.ok) throw new Error(r.error);
  setVerdict(db, r.data[0].id, 'approved', 'yes');
  return r.data[0];
}
const entry = (id: string) => queueEntries(db, 'gtai', syncQueue(db, 'gtai', root)).find((e) => e.lineId === id)!;

describe('wrong-speaker', () => {
  it('a line reassigned to a speaker with no voice un-proves the old character\'s approved take, and export skips it with the reason', async () => {
    const take = await approvedForGuard();
    expect(entry('z1').state).toBe('proven');
    zulu('nurse');
    expect(entry('z1').state).toBe('no-takes');
    const line = getLine(db, 'gtai', 'zulu', 'z1')!;
    expect(line.speaker).toBe('nurse');
    expect(staleReason(listTakes(db, 'gtai', 'zulu', 'z1')[0], line, voiceCtx(db, 'gtai'))).toBe('wrong-speaker');
    const game = makeGameRoot('zulu', ['z1', 'z2']);
    const ex = await exportQuest(db, 'gtai', 'zulu', game, { convert: async () => { throw new Error('nothing proven: must not convert'); }, measureLufs: async () => null });
    if (!ex.ok) throw new Error(ex.error);
    expect(ex.data.written).toEqual([]);
    expect(ex.data.skipped.find((s) => s.lineId === 'z1')?.reason).toBe(`not proven (no-takes): approved take ${take.id.slice(0, 8)} is stale: wrong-speaker`);
  });

  it('a line reassigned to a speaker WITH a cast voice is not proven by the old character\'s take either', async () => {
    await approvedForGuard();
    const other = addStockCandidate(db, 'gtai', 'nurse', 'stock-n', 'Nan', null);
    castVoice(db, other.id);
    zulu('nurse');
    expect(entry('z1').state).toBe('no-takes');
  });

  it('refuses approving a take whose voice belongs to another character, naming both', async () => {
    syncQueue(db, 'gtai', root);
    addStockCandidate(db, 'gtai', 'dock-guard', 'stock-g', 'Chris', null);
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z1', n: 1, direction: '' }, deps);
    if (!r.ok) throw new Error(r.error);
    zulu('nurse');
    syncQueue(db, 'gtai', root);
    const msg = approvalRefusal(r.data[0], getLine(db, 'gtai', 'zulu', 'z1'), voiceCtx(db, 'gtai'));
    expect(msg).toMatch(/belongs to dock-guard.*speaker nurse/);
  });
});
