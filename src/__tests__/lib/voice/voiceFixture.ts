/** Fixture repo root with two GTAI quest packages (act order opposite to folder order) + a bible. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface FixtureLine { id: string; speaker: string; text: string; when?: string[] }
export interface FixtureBeat { id: string; title: string; summary: string; lineIds: string[] }

export function writeQuest(root: string, id: string, act: string, fusedAt: string, lines: FixtureLine[], beats: FixtureBeat[] = []): void {
  const dir = path.join(root, 'games', 'gtai', 'quests', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'quest.json'), JSON.stringify({
    schema: 'gtai.quest/1', id, act, title: `Quest ${id}`, provenance: { fusedAt }, beats,
    lines: lines.map((l) => ({ ...l, purpose: ['character'], audio: null })),
  }, null, 2));
}

export function makeFixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-voice-'));
  // `alpha` sorts first by name but is act 2; `zulu` is act 1, so play order is zulu, alpha.
  writeQuest(root, 'alpha', 'act2', '2026-11-05T00:00:00Z', [
    { id: 'a1', speaker: 'rivet', text: 'Alpha one. Fuck, the line stopped.' },
    { id: 'a2', speaker: 'dock-guard', text: 'Who do we call?!' },
  ]);
  writeQuest(root, 'zulu', 'act1', '2026-11-02T00:00:00Z', [
    { id: 'z1', speaker: 'dock-guard', text: 'He has got a NAIL GUN! Is that even legal? Who do we call?! Oh shit, we ARE who you call! Somebody page the supervisor, this is not in my contract.' },
    { id: 'z2', speaker: 'rivet', text: 'Okay. Okay okay okay.' },
  ]);
  fs.mkdirSync(path.join(root, 'games', 'gtai', 'quests', '_council'), { recursive: true });
  const voices = path.join(root, 'games', 'gtai', 'voices');
  fs.mkdirSync(voices, { recursive: true });
  fs.writeFileSync(path.join(voices, 'dock-guard.md'), [
    '# Voice bible: Dock 9 Contractor (the dock guards)', '', '## Want, refusal', '- Wants: to not be here.', '',
    '## Rhythm (checkable)', '- Barks: one panicked exclamation. Shouted, short.', '', '## Profanity register', 'Frequent, panicked: "Oh shit".', '',
    '## Never says (literal, machine-read)', '- General Krump', '',
  ].join('\n'));
  return root;
}

/** A fixture GAME root: `project/quests/<id>/quest.json` as the game repo holds it. */
export function makeGameRoot(questId: string, lineIds: string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-voice-game-'));
  const dir = path.join(root, 'project', 'quests', questId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'quest.json'), JSON.stringify({ id: questId, lines: lineIds.map((id) => ({ id, audio: null })) }, null, 2));
  return root;
}
