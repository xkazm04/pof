/** A throwaway decision folder: two asks (one with real media), an answers file, and a lane-listed file outside it. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

export interface Fixture { root: string; media: string; secret: string; cleanup: () => void }

export function makeDecisionsFixture(opts: { answers?: string | null } = {}): Fixture {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-decisions-'));
  const root = path.join(base, 'decisions');
  const media = path.join(base, 'frames');
  fs.mkdirSync(path.join(root, 'asks'), { recursive: true });
  fs.mkdirSync(media);
  const shot = path.join(media, 'a.png');
  const clip = path.join(media, 'b.mp4');
  const secret = path.join(base, 'secret.bin');
  fs.writeFileSync(shot, PNG);
  fs.writeFileSync(clip, Buffer.alloc(64, 7));
  fs.writeFileSync(secret, 'not media');
  const ask = (name: string, body: unknown) => fs.writeFileSync(path.join(root, 'asks', name), JSON.stringify(body));
  ask('arena-1.json', {
    id: 'arena-1', lane: 'arena', question: 'Pistol or shotgun first?', asked: '2026-11-03T19:00:00Z', default: 'pistol',
    options: [
      { key: 'pistol', label: 'Pistol', tradeoff: 'Safe, slow kills.', frames: [shot, clip] },
      { key: 'shotgun', label: 'Shotgun', tradeoff: 'Fast kills, close range.', frames: [path.join(media, 'missing.png'), secret] },
    ],
  });
  ask('gunplay-2.json', {
    id: 'gunplay-2', lane: 'gunplay', question: 'Recoil?', asked: '2026-11-03T20:00:00Z',
    options: [{ key: 'low', label: 'Low', tradeoff: '', frames: [] }, { key: 'high', label: 'High', tradeoff: '', frames: [] }],
  });
  ask('broken-3.json', { id: 'bad id', question: 'x', options: [] });
  if (opts.answers !== null) {
    fs.writeFileSync(path.join(root, 'answers.json'), opts.answers ?? JSON.stringify({ answers: [{ id: 'old-0', choice: 'a', note: 'kept', at: '2026-11-03T18:00:00Z', extra: 1 }] }));
  }
  return { root, media, secret, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}
