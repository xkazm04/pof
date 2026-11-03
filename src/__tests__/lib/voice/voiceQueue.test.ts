import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-queue-${process.pid}/voice`;
});
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createVoiceDb, listTakes, setVerdict, castVoice, listVoices, verdictHistory } from '@/lib/voice/voice-db';
import { queueEntries, statusView, syncQueue } from '@/lib/voice/lineQueue';
import { generateTakes, type TakeDeps } from '@/lib/voice/takes';
import { addStockCandidate, bibleDescription, designForCharacter, ORIGINAL_VOICE_CLAUSE, readBible } from '@/lib/voice/design';
import { exportQuest } from '@/lib/voice/exportQuest';
import { directionTags, speechText } from '@/lib/audio-gen/providers/elevenlabs-speech';
import { makeFixtureRoot, makeGameRoot, writeQuest } from './voiceFixture';

let db: Database.Database;
let root: string;
const deps: TakeDeps = {
  synth: async (r) => ({ bytes: Buffer.from('mp3'), format: 'mp3', sentText: speechText(r.text, r.direction, r.settings.model), chars: speechText(r.text, r.direction, r.settings.model).length }),
  createVoice: async () => 'created-voice',
  measure: async () => ({ durationMs: 1234, loudnessLufs: -18.5 }),
  now: () => 1000,
};

beforeEach(() => {
  db = new Database(':memory:');
  createVoiceDb(db);
  root = makeFixtureRoot();
});
afterAll(() => fs.rmSync(String(process.env.POF_VOICE_DIR), { recursive: true, force: true }));

describe('line queue', () => {
  it('orders lines chronologically: act first, then lines[] order — not folder name', () => {
    const q = syncQueue(db, 'gtai', root);
    expect(q.map((l) => `${l.questId}/${l.lineId}`)).toEqual(['zulu/z1', 'zulu/z2', 'alpha/a1', 'alpha/a2']);
  });

  it('keeps profanity verbatim and re-reads a text change from the package; old takes go stale', async () => {
    syncQueue(db, 'gtai', root);
    expect(syncQueue(db, 'gtai', root).find((l) => l.lineId === 'a1')?.text).toContain('Fuck');
    addStockCandidate(db, 'gtai', 'rivet', 'stock-1', 'Liam', null);
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'alpha', lineId: 'a1', n: 1, direction: 'panicking' }, deps);
    expect(r.ok).toBe(true);
    let e = queueEntries(db, 'gtai', syncQueue(db, 'gtai', root)).find((x) => x.lineId === 'a1')!;
    expect(e.state).toBe('awaiting-verdict');
    writeQuest(root, 'alpha', 'act2', '2026-11-05T00:00:00Z', [
      { id: 'a1', speaker: 'rivet', text: 'Alpha one, rewritten.' }, { id: 'a2', speaker: 'dock-guard', text: 'Who do we call?!' },
    ]);
    const lines = syncQueue(db, 'gtai', root);
    expect(lines.find((l) => l.lineId === 'a1')?.text).toBe('Alpha one, rewritten.');
    e = queueEntries(db, 'gtai', lines).find((x) => x.lineId === 'a1')!;
    expect(e.state).toBe('no-takes');
    expect(e.takes).toBe(0);
  });

  it('a line is proven only by an approved take; approving another supersedes it with history kept', async () => {
    syncQueue(db, 'gtai', root);
    addStockCandidate(db, 'gtai', 'dock-guard', 'stock-g', 'Chris', null);
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z1', n: 2, direction: 'shouting, panicking' }, deps);
    if (!r.ok) throw new Error(r.error);
    const [t1, t2] = r.data;
    expect(t1.sentText.startsWith('[shouting] [panicking] ')).toBe(true);
    expect(t1.durationMs).toBe(1234);
    setVerdict(db, t1.id, 'rejected', 'too calm');
    let st = statusView(queueEntries(db, 'gtai', syncQueue(db, 'gtai', root)), {}, 0);
    expect(st.proven).toBe(0);
    setVerdict(db, t1.id, 'approved', 'actually fine');
    setVerdict(db, t2.id, 'approved', 'better');
    const takes = listTakes(db, 'gtai', 'zulu', 'z1');
    expect(takes.filter((t) => t.verdict === 'approved').map((t) => t.id)).toEqual([t2.id]);
    expect(takes.find((t) => t.id === t1.id)?.verdict).toBe('superseded');
    expect(verdictHistory(db, [t1.id]).map((h) => h.verdict)).toEqual(['rejected', 'approved', 'superseded']);
    st = statusView(queueEntries(db, 'gtai', syncQueue(db, 'gtai', root)), { zulu: 'Zulu' }, 0);
    expect(st.proven).toBe(1);
    expect(st.quests.map((q) => [q.questId, q.proven, q.total])).toEqual([['zulu', 1, 2], ['alpha', 0, 2]]);
    expect(st.next[0].lineId).toBe('z2');
  });
});

describe('direction per model', () => {
  it('v3 gets audio tags; multilingual_v2 gets the bare text (tags would be spoken)', () => {
    expect(directionTags('whispered, panicking, fast')).toBe('[whispered] [panicking] [fast]');
    expect(speechText('Hi.', 'whispered', 'eleven_v3')).toBe('[whispered] Hi.');
    expect(speechText('Hi.', 'whispered', 'eleven_multilingual_v2')).toBe('Hi.');
  });
});

describe('voice design and casting', () => {
  it('designs candidates from the bible (original-voice clause, no clone) and casts one per character', async () => {
    syncQueue(db, 'gtai', root);
    const desc = bibleDescription(readBible(root, 'dock-guard')!);
    expect(desc).toContain('Dock 9 Contractor');
    expect(desc).toContain('Shouted, short');
    expect(desc.endsWith(ORIGINAL_VOICE_CLAUSE)).toBe(true);
    const seen: string[] = [];
    const r = await designForCharacter(db, root, 'gtai', 'dock-guard', { n: 3 }, {
      design: async (req) => { seen.push(req.text); return { text: req.text, chars: req.text.length, previews: [1, 2, 3].map((i) => ({ generatedVoiceId: `g${i}`, bytes: Buffer.from('p'), durationMs: 900 })) }; },
      now: () => 5,
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.data.voices).toHaveLength(3);
    expect(seen[0].length).toBeGreaterThanOrEqual(100);
    expect(r.data.voices.every((v) => v.status === 'candidate')).toBe(true);
    castVoice(db, r.data.voices[0].id);
    castVoice(db, r.data.voices[1].id);
    expect(listVoices(db, 'gtai').filter((v) => v.status === 'cast').map((v) => v.id)).toEqual([r.data.voices[1].id]);
    // A take with a designed (not yet created) voice creates the provider voice first.
    const t = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z1', n: 1, direction: '' }, deps);
    if (!t.ok) throw new Error(t.error);
    expect(t.data[0].providerVoiceId).toBe('created-voice');
  });
});

describe('export', () => {
  it('writes only proven lines into the game root and sets audio { path, takeId, voiceId }', async () => {
    syncQueue(db, 'gtai', root);
    addStockCandidate(db, 'gtai', 'dock-guard', 'stock-g', 'Chris', null);
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z1', n: 1, direction: 'shouting' }, deps);
    if (!r.ok) throw new Error(r.error);
    setVerdict(db, r.data[0].id, 'approved', 'yes');
    const game = makeGameRoot('zulu', ['z1', 'z2']);
    const converted: string[] = [];
    const ex = await exportQuest(db, 'gtai', 'zulu', game, { convert: async (_s, d) => { converted.push(d); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, 'ogg'); return null; } });
    if (!ex.ok) throw new Error(ex.error);
    expect(ex.data.written.map((w) => w.lineId)).toEqual(['z1']);
    expect(ex.data.skipped).toEqual([{ lineId: 'z2', reason: 'not proven (no-takes)' }]);
    expect(converted).toEqual([path.join(game, 'project', 'assets', 'audio', 'voice', 'zulu', 'z1.ogg')]);
    const q = JSON.parse(fs.readFileSync(path.join(game, 'project', 'quests', 'zulu', 'quest.json'), 'utf8'));
    expect(q.lines[0].audio).toEqual({ path: 'res://assets/audio/voice/zulu/z1.ogg', takeId: r.data[0].id, voiceId: 'stock-g' });
    expect(q.lines[1].audio).toBeNull();
  });
});
