import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assessQuest } from '@/lib/games/gtai-quest/assess';
import { loadQuestContext, loadQuestPlaces } from '@/lib/games/gtai-quest/loadContext';
import { parseQuestPlaces, placeFindings } from '@/lib/games/gtai-quest/questPlaces';
import { assessVocabulary } from '@/lib/games/gtai-quest/vocabGuard';
import { CLEAN, RULES, RULES_RAW, ctx, mutate } from '@/__tests__/games/gtai-quest/fixtures';
import type { QuestDesign, QuestPlaces } from '@/lib/games/gtai-quest/types';

const PLACES: QuestPlaces = { markers: ['fax-office', 'dock'], vehicles: ['van'], actors: ['mertz'], encounters: ['dock'] };
const RAW = { schema: 'gtai.questMarkers/1', markers: { 'fax-office': {}, dock: {} }, vehicles: { van: {} }, actors: { mertz: {} }, encounters: { dock: {} } };
const withPlaces = (d: QuestDesign) => assessVocabulary(d, ctx({ places: new Map([['q', PLACES]]) }), 'q');
const codes = (d: QuestDesign) => withPlaces(d).findings.map((f) => `${f.code}@${f.ref}`);

describe('parseQuestPlaces', () => {
  it('projects the tag names, encounters optional', () => {
    expect(parseQuestPlaces(RAW)).toEqual({ ok: true, data: PLACES });
    const noEnc = { ...RAW, encounters: undefined };
    expect(parseQuestPlaces(noEnc)).toMatchObject({ ok: true, data: { encounters: [] } });
  });
  it.each([
    ['another schema', { ...RAW, schema: 'gtai.questMarkers/2' }],
    ['no markers', { ...RAW, markers: undefined }],
    ['actors as an array', { ...RAW, actors: [] }],
    ['not an object', 'x'],
  ])('refuses %s', (_n, raw) => { expect(parseQuestPlaces(raw).ok).toBe(false); });
});

describe('place check inside the vocabulary guard', () => {
  it('the clean fixture passes against a table that has its place', () => {
    const v = withPlaces(CLEAN);
    expect(v.state).toBe('green');
    expect(v.basis).toContain('places checked against 2 markers');
  });

  it('names a location the world does not have, and the beat', () => {
    const d = mutate((x) => { x.beats[0].objective = { verb: 'meet', location: 'Narnia' }; });
    expect(codes(d)).toEqual(['VOCAB_UNKNOWN_PLACE@the-call']);
    expect(withPlaces(d).findings[0].message).toContain('"Narnia"');
    expect(withPlaces(d).state).toBe('red');
  });

  it('a vehicle verb needs a vehicle tag, any other targeted verb an actor tag', () => {
    expect(codes(mutate((x) => { x.beats[0].objective = { verb: 'steal', target: 'mertz' }; }))).toEqual(['VOCAB_UNKNOWN_TARGET@the-call']);
    expect(codes(mutate((x) => { x.beats[0].objective = { verb: 'steal', target: 'van' }; }))).toEqual([]);
    expect(codes(mutate((x) => { x.beats[0].objective = { verb: 'kill', target: 'van' }; }))).toEqual(['VOCAB_UNKNOWN_TARGET@the-call']);
    expect(codes(mutate((x) => { x.beats[0].objective = { verb: 'kill', target: 'mertz' }; }))).toEqual([]);
  });

  it('an encounter verb needs a marker that holds one', () => {
    expect(codes(mutate((x) => { x.beats[0].objective = { verb: 'sabotage', location: 'fax-office' }; }))).toEqual(['VOCAB_NO_ENCOUNTER@the-call']);
    expect(codes(mutate((x) => { x.beats[0].objective = { verb: 'sabotage', location: 'dock' }; }))).toEqual([]);
  });

  it('an unknown verb is left to the verb check, a missing location to the missing-location check', () => {
    expect(placeFindings(mutate((x) => { x.beats[0].objective = { verb: 'smuggle', location: 'Narnia' }; }), RULES, PLACES)).toEqual([]);
    expect(placeFindings(mutate((x) => { x.beats[0].objective = { verb: 'meet' }; }), RULES, PLACES)).toEqual([]);
  });

  it('a quest with no staged table is not place-checked', () => {
    const d = mutate((x) => { x.beats[0].objective = { verb: 'meet', location: 'Narnia' }; });
    expect(assessVocabulary(d, ctx({ places: new Map() }), 'q').findings).toEqual([]);
    expect(assessVocabulary(d, ctx(), 'q').basis).toContain('no places table staged');
    expect(assessVocabulary(d, ctx({ places: new Map([['other', PLACES]]) }), 'q').findings).toEqual([]);
  });

  it('assessQuest keys the table by selfId, else the subject, and the finding blocks', () => {
    const d = mutate((x) => { x.beats[0].objective = { verb: 'meet', location: 'Narnia' }; });
    const c = ctx({ places: new Map([['q', PLACES]]) });
    expect(assessQuest('q', d, c).blockedBy).toContain('vocabulary');
    expect(assessQuest('subject', d, c, [], 'q').blockedBy).toContain('vocabulary');
    expect(assessQuest('subject', d, c).blockedBy).not.toContain('vocabulary');
  });
});

describe('loadQuestPlaces', () => {
  const dirs: string[] = [];
  const root = (files: Record<string, string>): string => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-places-'));
    dirs.push(d);
    fs.mkdirSync(path.join(d, 'project', 'data', 'tables'), { recursive: true });
    for (const [n, body] of Object.entries(files)) fs.writeFileSync(path.join(d, 'project', 'data', 'tables', n), body);
    return d;
  };
  afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

  it('keys a table by quest id (underscores become dashes) and skips bad ones', () => {
    const map = loadQuestPlaces(root({ 'collect_call_places.json': JSON.stringify(RAW), 'broken_places.json': '{nope', 'other_places.json': JSON.stringify({ ...RAW, schema: 'x' }), 'quest_rules.json': '{}' }));
    expect([...map.keys()]).toEqual(['collect-call']);
    expect(map.get('collect-call')).toEqual(PLACES);
  });
  it('is empty for no root or no tables folder', () => {
    expect(loadQuestPlaces(null).size).toBe(0);
    expect(loadQuestPlaces(path.join(os.tmpdir(), 'pof-no-such-root')).size).toBe(0);
  });
  it('loadQuestContext carries them next to the rules', () => {
    const r = root({ 'quest_rules.json': JSON.stringify(RULES_RAW), 'collect_call_places.json': JSON.stringify(RAW) });
    expect(loadQuestContext(root({}), null, r).places?.has('collect-call')).toBe(true);
  });
});
