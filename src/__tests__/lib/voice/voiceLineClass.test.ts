/**
 * Line class + scene (registry `game-dialogue-voice-pipeline`: the line has a class, recorded per line):
 * a line with `when` tags is a bark, one without is a story line; the beat that lists the line is its
 * scene; both are re-read from the package; a DB from before the columns migrates in place.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createVoiceDb } from '@/lib/voice/voice-db';
import { syncQueue } from '@/lib/voice/lineQueue';
import { makeFixtureRoot, writeQuest } from './voiceFixture';

let db: Database.Database;
let root: string;
const BEAT = { id: 'b1-dock', title: 'Dock 9', summary: 'Waves of guards at the dock.', lineIds: ['a2'] };

beforeEach(() => {
  db = new Database(':memory:');
  createVoiceDb(db);
  root = makeFixtureRoot();
});

describe('line class and scene', () => {
  it('a line with when-tags is a bark, without is a story line; the listing beat is its scene', () => {
    writeQuest(root, 'alpha', 'act2', '2026-11-05T00:00:00Z', [
      { id: 'a1', speaker: 'rivet', text: 'Alpha one.' },
      { id: 'a2', speaker: 'dock-guard', text: 'Who do we call?!', when: ['wave-start'] },
    ], [BEAT]);
    const q = syncQueue(db, 'gtai', root);
    const a1 = q.find((l) => l.lineId === 'a1')!;
    const a2 = q.find((l) => l.lineId === 'a2')!;
    expect(a1).toMatchObject({ lineClass: 'story', when: [], beatId: null, beatTitle: null });
    expect(a2).toMatchObject({ lineClass: 'bark', when: ['wave-start'], beatId: 'b1-dock', beatTitle: 'Dock 9', beatSummary: 'Waves of guards at the dock.' });
  });

  it('re-reads a when-tag change from the package: dropping the tags makes the bark a story line', () => {
    writeQuest(root, 'alpha', 'act2', '2026-11-05T00:00:00Z', [{ id: 'a2', speaker: 'dock-guard', text: 'Who?', when: ['wave-start'] }], [BEAT]);
    expect(syncQueue(db, 'gtai', root).find((l) => l.lineId === 'a2')?.lineClass).toBe('bark');
    writeQuest(root, 'alpha', 'act2', '2026-11-05T00:00:00Z', [{ id: 'a2', speaker: 'dock-guard', text: 'Who?' }]);
    const a2 = syncQueue(db, 'gtai', root).find((l) => l.lineId === 'a2')!;
    expect(a2).toMatchObject({ lineClass: 'story', when: [], beatId: null });
  });

  it('an unchanged ledger is re-read but its rows are not rewritten; a changed one is', () => {
    syncQueue(db, 'gtai', root, 100);
    const at = () => (db.prepare("SELECT syncedAt FROM voice_lines WHERE lineId='z1'").get() as { syncedAt: number }).syncedAt;
    expect(at()).toBe(100);
    expect(syncQueue(db, 'gtai', root, 200).map((l) => l.lineId)).toEqual(['z1', 'z2', 'a1', 'a2']);
    expect(at()).toBe(100);
    writeQuest(root, 'zulu', 'act1', '2026-11-02T00:00:00Z', [{ id: 'z1', speaker: 'dock-guard', text: 'Changed.' }]);
    const q = syncQueue(db, 'gtai', root, 300);
    expect(at()).toBe(300);
    expect(q.map((l) => l.lineId)).toEqual(['z1', 'a1', 'a2']);
    expect(q[0].text).toBe('Changed.');
  });

  it('migrates a voice_lines table created before the class/beat columns', () => {
    const old = new Database(':memory:');
    old.exec(`CREATE TABLE voice_lines (gameId TEXT NOT NULL, questId TEXT NOT NULL, lineId TEXT NOT NULL, speaker TEXT NOT NULL,
      text TEXT NOT NULL, textHash TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '[]', questOrder INTEGER NOT NULL, lineOrder INTEGER NOT NULL,
      present INTEGER NOT NULL DEFAULT 1, syncedAt INTEGER NOT NULL, PRIMARY KEY (gameId, questId, lineId))`);
    old.prepare("INSERT INTO voice_lines VALUES ('gtai','zulu','z1','rivet','t','h','[]',0,0,1,0)").run();
    createVoiceDb(old);
    const q = syncQueue(old, 'gtai', root);
    expect(q.find((l) => l.lineId === 'z1')).toMatchObject({ lineClass: 'story', when: [] });
    expect(q).toHaveLength(4);
  });
});
