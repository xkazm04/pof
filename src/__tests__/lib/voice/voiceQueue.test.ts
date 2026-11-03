import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_VOICE_DIR = `${dir}/pof-vitest/voice-queue-${process.pid}/voice`;
});
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createVoiceDb, listTakes, setVerdict, castVoice, listVoices, verdictFeed, verdictHistory } from '@/lib/voice/voice-db';
import { queueEntries, statusView, syncQueue } from '@/lib/voice/lineQueue';
import { generateTakes, type TakeDeps } from '@/lib/voice/takes';
import { addStockCandidate, bibleDescription, designForCharacter, ORIGINAL_VOICE_CLAUSE, readBible } from '@/lib/voice/design';
import { DEFAULT_VOICE_TARGET, MIX_TABLE, isSafeTreatment, masterArgs, voiceMasterTarget, type VoiceMasterTarget } from '@/lib/voice/mastering';
import { exportQuest } from '@/lib/voice/exportQuest';
import { directionTags, speechText } from '@/lib/audio-gen/providers/elevenlabs-speech';
import { makeFixtureRoot, makeGameRoot, writeQuest } from './voiceFixture';

let db: Database.Database;
let root: string;
const deps: TakeDeps = {
  synth: async (r) => ({ bytes: Buffer.from('mp3'), format: 'mp3', sentText: speechText(r.text, r.direction, r.settings.model), chars: speechText(r.text, r.direction, r.settings.model).length }),
  createVoice: async () => 'created-voice',
  measure: async () => ({ durationMs: 1234, loudnessLufs: -18.5, maxSilenceMs: 300 }),
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

  it('the verdict feed lists every verdict with its line, direction and note, oldest first, after `since`', async () => {
    syncQueue(db, 'gtai', root);
    addStockCandidate(db, 'gtai', 'dock-guard', 'stock-g', 'Chris', null);
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z1', n: 2, direction: 'shouting' }, deps);
    if (!r.ok) throw new Error(r.error);
    const [t1, t2] = r.data;
    setVerdict(db, t1.id, 'rejected', 'too calm', 100);
    setVerdict(db, t1.id, 'approved', null, 200);
    setVerdict(db, t2.id, 'approved', 'the one', 300);
    const feed = verdictFeed(db, 'gtai');
    expect(feed.map((f) => [f.takeId, f.verdict, f.note, f.at])).toEqual([
      [t1.id, 'rejected', 'too calm', 100], [t1.id, 'approved', null, 200],
      [t1.id, 'superseded', `replaced by ${t2.id}`, 300], [t2.id, 'approved', 'the one', 300],
    ]);
    expect(feed[0]).toMatchObject({ questId: 'zulu', lineId: 'z1', direction: 'shouting', model: 'eleven_v3' });
    expect(verdictFeed(db, 'gtai', 200).map((f) => f.verdict)).toEqual(['superseded', 'approved']);
    expect(verdictFeed(db, 'other-game')).toEqual([]);
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
  it('writes only proven lines into the game root: audio = res:// path (a String), audioTake = { takeId, voiceId, model }', async () => {
    syncQueue(db, 'gtai', root);
    addStockCandidate(db, 'gtai', 'dock-guard', 'stock-g', 'Chris', null);
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z1', n: 1, direction: 'shouting' }, deps);
    if (!r.ok) throw new Error(r.error);
    setVerdict(db, r.data[0].id, 'approved', 'yes');
    const game = makeGameRoot('zulu', ['z1', 'z2']);
    // The audio lane's temp voice on the unproven line (a flat res:// String, as the game holds it today).
    const qf = path.join(game, 'project', 'quests', 'zulu', 'quest.json');
    const pre = JSON.parse(fs.readFileSync(qf, 'utf8'));
    pre.lines[1].audio = 'res://assets/audio/voice/z2.ogg';
    fs.writeFileSync(qf, JSON.stringify(pre, null, 2));
    // The game declares its voice level in audio_mix.json; export masters every file to it and measures after.
    fs.mkdirSync(path.join(game, 'project', 'data', 'tables'), { recursive: true });
    fs.writeFileSync(path.join(game, 'project', 'data', 'tables', 'audio_mix.json'), JSON.stringify({ loudness: { voice_lufs: -20, voice_true_peak_db: -3 } }));
    const converted: string[] = [];
    const targets: VoiceMasterTarget[] = [];
    const ex = await exportQuest(db, 'gtai', 'zulu', game, {
      convert: async (_s, d, t) => { converted.push(d); targets.push(t); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, 'ogg'); return null; },
      measureLufs: async () => -22.1,
    });
    if (!ex.ok) throw new Error(ex.error);
    expect(targets).toEqual([{ lufs: -20, truePeakDb: -3, source: MIX_TABLE }]);
    expect(ex.data.mastering).toEqual(targets[0]);
    expect(ex.data.written).toEqual([{ lineId: 'z1', path: 'res://assets/audio/voice/zulu/z1.ogg', takeId: r.data[0].id, lufs: -22.1, onLevel: false }]);
    expect(ex.data.skipped).toEqual([{ lineId: 'z2', reason: 'not proven (no-takes)' }]);
    expect(converted).toEqual([path.join(game, 'project', 'assets', 'audio', 'voice', 'zulu', 'z1.ogg')]);
    const q = JSON.parse(fs.readFileSync(path.join(game, 'project', 'quests', 'zulu', 'quest.json'), 'utf8'));
    // `audio` is the String the game's quest_voice.gd plays; the take record sits beside it.
    expect(q.lines[0].audio).toBe('res://assets/audio/voice/zulu/z1.ogg');
    expect(q.lines[0].audioTake).toEqual({ takeId: r.data[0].id, voiceId: 'stock-g', model: 'eleven_v3' });
    expect(q.lines[1].audio).toBe('res://assets/audio/voice/z2.ogg');
    expect(q.lines[1].audioTake).toBeUndefined();
    expect(ex.data.stale).toEqual([]);

    // The line's text changes in the package: its exported take is no longer proven. A second export
    // writes nothing for it, leaves the game file as is, and REPORTS that the game still plays it.
    writeQuest(root, 'zulu', 'act1', '2026-11-02T00:00:00Z', [
      { id: 'z1', speaker: 'dock-guard', text: 'Rewritten guard line.' }, { id: 'z2', speaker: 'rivet', text: 'Okay. Okay okay okay.' },
    ]);
    syncQueue(db, 'gtai', root);
    const before = fs.readFileSync(qf, 'utf8');
    const again = await exportQuest(db, 'gtai', 'zulu', game, { convert: async () => { throw new Error('nothing proven: must not convert'); }, measureLufs: async () => null });
    if (!again.ok) throw new Error(again.error);
    expect(again.data.written).toEqual([]);
    expect(again.data.stale).toEqual([{ lineId: 'z1', takeId: r.data[0].id, reason: `the game still plays take ${r.data[0].id.slice(0, 8)}, no longer proven here (no-takes)` }]);
    expect(fs.readFileSync(qf, 'utf8')).toBe(before);
  });

  it('masters like the game processor; a game without a usable mix table gets the default, named', () => {
    const game = makeGameRoot('zulu', ['z1']);
    expect(voiceMasterTarget(game)).toEqual(DEFAULT_VOICE_TARGET);
    const table = path.join(game, 'project', 'data', 'tables');
    fs.mkdirSync(table, { recursive: true });
    fs.writeFileSync(path.join(table, 'audio_mix.json'), '{ not json');
    expect(voiceMasterTarget(game)).toMatchObject({ lufs: -18, truePeakDb: -2, source: `default: ${MIX_TABLE} is not valid JSON` });
    fs.writeFileSync(path.join(table, 'audio_mix.json'), JSON.stringify({ loudness: { voice_lufs: 'loud' } }));
    expect(voiceMasterTarget(game).source).toContain('no usable loudness');
    const args = masterArgs('in.mp3', 'out.ogg', { lufs: -18, truePeakDb: -2, source: 'x' });
    expect(args.join(' ')).toContain('-ac 1 -ar 44100 -af loudnorm=I=-18:TP=-2:LRA=11 -c:a libvorbis -q:a 4 out.ogg');
  });

  it('a speaker treatment from voice_treatments is applied before loudnorm; a chain with a non-tone filter is refused, named', async () => {
    syncQueue(db, 'gtai', root);
    addStockCandidate(db, 'gtai', 'dock-guard', 'stock-g', 'Chris', null);
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z1', n: 1, direction: '' }, deps);
    if (!r.ok) throw new Error(r.error);
    setVerdict(db, r.data[0].id, 'approved', 'yes');
    const game = makeGameRoot('zulu', ['z1', 'z2']);
    const table = path.join(game, 'project', 'data', 'tables');
    fs.mkdirSync(table, { recursive: true });
    const phone = 'highpass=f=320, lowpass=f=3400,acompressor=threshold=-20dB:ratio=3';
    fs.writeFileSync(path.join(table, 'audio_mix.json'), JSON.stringify({
      loudness: { voice_lufs: -18, voice_true_peak_db: -2 },
      voice_treatments: { 'dock-guard': phone, rivet: 'amovie=elsewhere.wav,lowpass=f=1000' },
    }));
    const seen: Array<string | undefined> = [];
    const ex = await exportQuest(db, 'gtai', 'zulu', game, {
      convert: async (_s, d, _t, tr) => { seen.push(tr); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, 'ogg'); return null; },
      measureLufs: async () => -18.2,
    });
    if (!ex.ok) throw new Error(ex.error);
    const chain = 'highpass=f=320,lowpass=f=3400,acompressor=threshold=-20dB:ratio=3';
    expect(seen).toEqual([chain]);
    expect(ex.data.written[0]).toMatchObject({ lineId: 'z1', treatment: chain, onLevel: true });
    expect(ex.data.mastering.treatments).toEqual({ 'dock-guard': chain });
    expect(ex.data.mastering.refused).toEqual(['rivet: only highpass, lowpass, bandpass, equalizer, acompressor, volume are accepted']);
    expect(masterArgs('a.mp3', 'b.ogg', ex.data.mastering, chain)).toContain(`${chain},loudnorm=I=-18:TP=-2:LRA=11`);
    expect(isSafeTreatment('lowpass=f=3400;amovie=x')).toBe(false);
  });
});

describe('re-cast', () => {
  it('casting a different voice un-proves lines approved in the old voice (a re-cast event)', async () => {
    syncQueue(db, 'gtai', root);
    const a = addStockCandidate(db, 'gtai', 'rivet', 'stock-a', 'A', null, 1);
    const b = addStockCandidate(db, 'gtai', 'rivet', 'stock-b', 'B', null, 2);
    const r = await generateTakes(db, { gameId: 'gtai', questId: 'zulu', lineId: 'z2', n: 1, direction: '', voiceId: a.id }, deps);
    if (!r.ok) throw new Error(r.error);
    setVerdict(db, r.data[0].id, 'approved', 'ok');
    const proven = () => queueEntries(db, 'gtai', syncQueue(db, 'gtai', root)).find((e) => e.lineId === 'z2')!.state;
    expect(proven()).toBe('proven');
    castVoice(db, a.id);
    expect(proven()).toBe('proven');
    castVoice(db, b.id);
    expect(proven()).toBe('no-takes');
  });
});

describe('silence screen', () => {
  it('reports the longest INTERNAL silence, ignoring leading and trailing silence', async () => {
    const { maxInternalSilenceMs } = await import('@/lib/voice/storage');
    const stderr = [
      '[silencedetect @ 0] silence_start: 0', '[silencedetect @ 0] silence_end: 0.4 | silence_duration: 0.4',
      '[silencedetect @ 0] silence_start: 3.73', '[silencedetect @ 0] silence_end: 4.35 | silence_duration: 0.617574',
      '[silencedetect @ 0] silence_start: 5.39', '[silencedetect @ 0] silence_end: 5.81 | silence_duration: 0.42',
      '[silencedetect @ 0] silence_start: 9.1', '[silencedetect @ 0] silence_end: 10 | silence_duration: 0.9',
    ].join('\r\n');
    expect(maxInternalSilenceMs(stderr, 10)).toBe(618);
    expect(maxInternalSilenceMs('', 10)).toBe(0);
  });
});

describe('stock candidates', () => {
  it('adding the same premade voice twice for a character keeps one candidate', () => {
    const a = addStockCandidate(db, 'gtai', 'rivet', 'stock-x', 'X', null);
    const b = addStockCandidate(db, 'gtai', 'rivet', 'stock-x', 'X again', null);
    expect(b.id).toBe(a.id);
    expect(listVoices(db, 'gtai').filter((v) => v.characterId === 'rivet')).toHaveLength(1);
  });
});
